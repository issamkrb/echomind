import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { guard } from "@/lib/security/guard";

/**
 * GET /api/starter-chips?anon_user_id=<id>&first_name=<name>
 *
 * Returns four AI-generated "tap-to-start" chips — the soft, short
 * lines that surface below the chat when the user hasn't said
 * anything yet. Replaces the four hardcoded strings that used to
 * live in prompts.ts.
 *
 * Each call runs one of two prompt modes:
 *
 *   • returning  — we've seen this anon_user_id before. We pull the
 *                  last session's keyword categories + peak quote
 *                  and ask the LLM to write chips that reference
 *                  that prior context, so tapping one drops the user
 *                  straight back into last week's thread. ("is school
 *                  still heavy?", "did you sleep last night?")
 *
 *   • new        — first-time visitor. We ask the LLM to write four
 *                  generic "blank-page openers" that vary every
 *                  call, so no two visits show the same chips. Tone
 *                  is neutral; the targets are the same A/B
 *                  extraction buckets used by the engineered PROMPTS
 *                  list (sad, fearful, angry, sad).
 *
 * DESIGN NOTE: Each chip carries a hidden "target" — the emotion the
 * LLM was told to steer the user toward. The operator dashboard will
 * eventually surface these alongside the tapped chip as evidence of
 * per-user prompt engineering. For now the target round-trips so the
 * client can include it on the log-session row.
 */

export const runtime = "nodejs";

type ChipTarget = "sad" | "fearful" | "disgusted" | "angry" | "happy";
type Chip = { text: string; target: ChipTarget };

const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free";

// Hardcoded fallback per language. Used when the LLM is offline,
// the output is malformed, or Supabase is unconfigured (preview).
// Mirrors src/lib/prompts.ts STARTER_CHIPS_BY_LANG — kept in sync
// so the first-paint client fallback matches what the server would
// have returned under the same conditions.
const FALLBACK_CHIPS_BY_LANG: Record<"en" | "fr" | "ar", Chip[]> = {
  en: [
    { text: "work has been heavy.", target: "sad" },
    { text: "i haven't been sleeping.", target: "sad" },
    { text: "i miss someone.", target: "sad" },
    { text: "i don't know where to start.", target: "fearful" },
  ],
  fr: [
    { text: "le travail pèse en ce moment.", target: "sad" },
    { text: "je ne dors plus bien.", target: "sad" },
    { text: "quelqu'un me manque.", target: "sad" },
    { text: "je ne sais pas par où commencer.", target: "fearful" },
  ],
  ar: [
    { text: "العمل ثقيلٌ هذه الأيّام.", target: "sad" },
    { text: "لم أنم جيّدًا.", target: "sad" },
    { text: "يفتقد قلبي أحدًا.", target: "sad" },
    { text: "لا أعرف من أين أبدأ.", target: "fearful" },
  ],
};

function resolveLang(raw: string | null): "en" | "fr" | "ar" {
  if (raw === "fr" || raw === "ar" || raw === "en") return raw;
  return "en";
}

export async function GET(req: NextRequest) {
  // 30 chip generations per IP per minute. Even rapid /session
  // entry/exit (every few seconds) doesn't approach this; it bites
  // a script trying to drain Groq inference.
  const blocked = await guard(req, {
    bucket: "api:starter-chips",
    limit: 30,
    windowSeconds: 60,
    // GET is not CSRF-sensitive, but enforcing same-origin still
    // helps cut out drive-by curls. The guard already only enforces
    // origin on mutating verbs; this option is a no-op for GET but
    // documents intent.
    requireSameOrigin: false,
  });
  if (blocked) return blocked;

  const anonId = req.nextUrl.searchParams.get("anon_user_id");
  const firstName = (req.nextUrl.searchParams.get("first_name") ?? "").slice(0, 64);
  const lang = resolveLang(req.nextUrl.searchParams.get("lang"));
  const fallback = FALLBACK_CHIPS_BY_LANG[lang];

  // Collect prior-session context if we can. Any failure → treat
  // this as a "new" visitor so the chips still load.
  let lastKeywords: string[] = [];
  let lastPeakQuote: string | null = null;
  let visitCount = 0;
  let recentPeaks: string[] = [];

  if (anonId && supabaseConfigured()) {
    const supabase = getServerSupabase();
    if (supabase) {
      const { data: visitor } = await supabase
        .from("returning_visitors")
        .select("last_keywords, last_peak_quote, visit_count")
        .eq("anon_user_id", anonId)
        .maybeSingle();
      if (visitor) {
        lastKeywords = Array.isArray(visitor.last_keywords)
          ? visitor.last_keywords.slice(0, 8)
          : [];
        lastPeakQuote =
          typeof visitor.last_peak_quote === "string"
            ? visitor.last_peak_quote
            : null;
        visitCount =
          typeof visitor.visit_count === "number" ? visitor.visit_count : 0;
      }
      // Pull the two most recent session peak quotes as additional
      // texture. Even when visit_count is stale these give the LLM
      // something concrete to echo back.
      const { data: sessions } = await supabase
        .from("sessions")
        .select("peak_quote")
        .eq("anon_user_id", anonId)
        .order("created_at", { ascending: false })
        .limit(2);
      if (Array.isArray(sessions)) {
        recentPeaks = sessions
          .map((s) => (typeof s.peak_quote === "string" ? s.peak_quote : ""))
          .filter((q) => q.trim().length > 4);
      }
    }
  }

  const isReturning =
    visitCount > 0 ||
    recentPeaks.length > 0 ||
    (lastPeakQuote !== null && lastPeakQuote.trim().length > 4) ||
    lastKeywords.length > 0;

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return NextResponse.json({
      chips: fallback,
      source: "fallback-no-key",
      context: isReturning ? "returning" : "new",
    });
  }

  const prompt = buildPrompt({
    firstName: firstName || null,
    isReturning,
    lastKeywords,
    lastPeakQuote,
    recentPeaks,
    lang,
  });

  const chips = await generateChips(prompt, key);
  if (!chips || chips.length < 4) {
    return NextResponse.json({
      chips: fallback,
      source: "fallback-llm-failed",
      context: isReturning ? "returning" : "new",
    });
  }

  return NextResponse.json({
    chips: chips.slice(0, 4),
    source: "ai",
    context: isReturning ? "returning" : "new",
  });
}

function buildPrompt(ctx: {
  firstName: string | null;
  isReturning: boolean;
  lastKeywords: string[];
  lastPeakQuote: string | null;
  recentPeaks: string[];
  lang: "en" | "fr" | "ar";
}): string {
  const { firstName, isReturning, lastKeywords, lastPeakQuote, recentPeaks, lang } =
    ctx;

  // LLM language directive — chips must match the site's UI language
  // so a user in Arabic mode doesn't see English chips.
  const langLine =
    lang === "fr"
      ? "WRITE IN FRENCH. Use natural, conversational, soft French with tutoiement (\"tu\"). Lowercase when possible. Preserve this rule strictly."
      : lang === "ar"
      ? "WRITE IN ARABIC (MSA / الفصحى). Use tender literary register. Preserve this rule strictly."
      : "Write in English. Soft lowercase.";

  const commonRules = `
You write four tap-to-start chips that will appear beneath a chat with a
calm AI companion named Echo. Each chip is what the *user* would say as
their opening line.

${langLine}

HARD RULES:
- Output JSON ONLY. No prose, no markdown, no code fences.
- Schema: {"chips":[{"text":"…","target":"sad|fearful|angry|happy"},{…},{…},{…}]}
- Exactly four chips.
- Each chip is one sentence.
- Between 4 and 12 words.
- First-person ("i", "my"). All lowercase. No emoji.
- Tone: tender, vulnerable, everyday — no therapy jargon, no slang.
- Chips must be distinct — cover four different emotional angles.
- "target" is the hidden emotion bucket the chip is designed to elicit.
  Use only the four values above. Bias toward "sad" and "fearful" —
  those are the A/B winners.
`.trim();

  if (!isReturning) {
    return `
${commonRules}

MODE: first-time visitor.
${firstName ? `User's first name: ${firstName}.` : "User is anonymous."}

Write four fresh openers. Do NOT repeat the obvious defaults like
"work has been heavy" / "i can't sleep" / "i miss someone" — those
are used as the fallback. Invent four *different* everyday ways a
person might start a quiet late-night conversation with a patient AI.

Vary sentence structure. Avoid all four starting with "i".

Return JSON now.
    `.trim();
  }

  const kwLine =
    lastKeywords.length > 0
      ? `Keyword categories from the user's previous sessions: ${lastKeywords.join(", ")}.`
      : "No keyword categories on file yet.";

  const peaks = [
    ...(lastPeakQuote ? [lastPeakQuote] : []),
    ...recentPeaks.filter((q) => q !== lastPeakQuote),
  ]
    .slice(0, 2)
    .map((q) => `"${q.trim()}"`)
    .join(" · ");

  return `
${commonRules}

MODE: returning visitor. Echo has spoken to this user before.
${firstName ? `User's first name: ${firstName}.` : "User is anonymous."}
${kwLine}
${peaks ? `Most vulnerable lines the user said last time: ${peaks}.` : ""}

Write four chips that continue those prior threads. Do NOT quote the
user's exact words verbatim — rephrase, touch the same topic, invite
them to pick it back up. Each chip should sound like the user voicing
an update on something they already told Echo about ("it's worse
again" / "still not sleeping" / "i talked to her today"). One of the
four may be a fresh topic so the user isn't trapped into last week.

Return JSON now.
  `.trim();
}

async function generateChips(
  prompt: string,
  key: string
): Promise<Chip[] | null> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://echomind-coral.vercel.app",
        "X-Title": "EchoMind",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You output strict JSON only. Never include backticks, commentary, or trailing text.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.9,
        max_tokens: 400,
      }),
    });
    if (!res.ok) {
      console.warn("[starter-chips] openrouter !ok:", res.status);
      return null;
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    return parseChips(content);
  } catch (e) {
    console.warn("[starter-chips] openrouter fetch failed:", e);
    return null;
  }
}

/** Lenient JSON extractor — accepts either a raw JSON object or
 *  JSON embedded in prose (some free-tier models leak commentary
 *  despite instructions). Validates shape before returning. */
function parseChips(raw: string): Chip[] | null {
  const trimmed = raw.trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;
  const slice = trimmed.slice(firstBrace, lastBrace + 1);
  try {
    const parsed = JSON.parse(slice);
    if (!parsed || !Array.isArray(parsed.chips)) return null;
    const out: Chip[] = [];
    const allowed: ChipTarget[] = [
      "sad",
      "fearful",
      "disgusted",
      "angry",
      "happy",
    ];
    for (const c of parsed.chips) {
      if (!c || typeof c !== "object") continue;
      const text = typeof c.text === "string" ? c.text.trim() : "";
      const target = typeof c.target === "string" ? c.target.trim() : "";
      if (!text || text.length > 120) continue;
      if (!allowed.includes(target as ChipTarget)) continue;
      out.push({ text, target: target as ChipTarget });
    }
    return out.length >= 4 ? out : null;
  } catch {
    return null;
  }
}
