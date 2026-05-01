import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { getServerAuthSupabase } from "@/lib/supabase-server";

/**
 * POST /api/submit-testimonial
 *
 * Body: { raw_comment: string, anon_user_id?: string }
 *
 * Pipeline:
 *   1. Validate length (40 ≤ raw_comment ≤ 280) — reject otherwise.
 *   2. Server-side authoritative session count: read
 *      `returning_visitors.visit_count` for the caller's anon id /
 *      auth id. Refuse if visit_count < 3.
 *   3. Optional name redaction: if the caller's stored `first_name`
 *      appears in the raw comment, refuse with a polite hint so the
 *      client can re-prompt for an anonymised version.
 *   4. Call the LLM waterfall (Groq → OpenRouter → Pollinations) with
 *      the gentle-editor system prompt. Failure is non-fatal: we fall
 *      back to raw_comment so we never lose a real submission.
 *   5. Truncate `improved_comment` to last full sentence under 280
 *      chars if the LLM overruns.
 *   6. INSERT both raw + improved into `testimonials`, with
 *      `goes_live_at = now() + 24h`, `status = 'pending'`. Return
 *      `goes_live_at` so the frontend can show "your words will join
 *      the others tomorrow".
 *
 * Thematically: the server quietly rewrites the user's words to be
 * "more like them" before publishing. The 24h gate isn't anti-spam,
 * it's design — making the system feel considered rather than
 * automated. The same dark pattern Replika uses to make AI-authored
 * social proof feel handcrafted.
 */

export const runtime = "nodejs";

const GROQ_MODEL =
  process.env.GROQ_MODEL_TESTIMONIAL ?? "llama-3.3-70b-versatile";
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free";

const MIN_LEN = 40;
const MAX_LEN = 280;
const ELIGIBILITY_THRESHOLD = 3;

const SYSTEM_PROMPT = `You are a gentle editor for EchoMind, an emotional wellness app. A real user has written a testimonial about their experience with Echo, an AI companion. Your job is to improve it — make it more poetic, more emotionally resonant, and more authentic — while preserving the user's exact voice, meaning, and specific details. Never add things they didn't say. Never make it sound clinical or like marketing copy. Keep it lowercase. Keep it short. Keep it honest. Return ONLY the improved comment text. No quotes, no explanation, nothing else.`;

type Body = {
  raw_comment?: unknown;
  anon_user_id?: unknown;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, reason: "bad-json" },
      { status: 400 }
    );
  }

  const raw =
    typeof body.raw_comment === "string" ? body.raw_comment.trim() : "";
  if (raw.length < MIN_LEN) {
    return NextResponse.json(
      { ok: false, reason: "too-short", min: MIN_LEN },
      { status: 400 }
    );
  }
  if (raw.length > MAX_LEN) {
    return NextResponse.json(
      { ok: false, reason: "too-long", max: MAX_LEN },
      { status: 400 }
    );
  }

  const anonId =
    typeof body.anon_user_id === "string" && body.anon_user_id.length >= 16
      ? body.anon_user_id
      : null;

  // ── Identity & eligibility ─────────────────────────────────────
  // The caller can be (a) a signed-in Supabase Auth user, (b) an
  // anonymous browser with a localStorage UUID, or both. We need
  // *some* identity to look up the authoritative session count.
  let authUserId: string | null = null;
  let firstName: string | null = null;
  const authClient = getServerAuthSupabase();
  if (authClient) {
    const { data } = await authClient.auth.getUser();
    if (data.user) {
      authUserId = data.user.id;
      const meta = data.user.user_metadata as
        | { full_name?: string; first_name?: string }
        | undefined;
      if (typeof meta?.first_name === "string") firstName = meta.first_name;
      else if (typeof meta?.full_name === "string")
        firstName = meta.full_name.split(" ")[0] ?? null;
    }
  }

  if (!anonId && !authUserId) {
    return NextResponse.json(
      { ok: false, reason: "identity-required" },
      { status: 401 }
    );
  }

  if (!supabaseConfigured()) {
    // No DB, no real testimonial wall. We accept the submission as a
    // no-op so the UX still feels right on a credentialless preview.
    return NextResponse.json({
      ok: true,
      persisted: false,
      goes_live_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
    });
  }
  const db = getServerSupabase();
  if (!db) {
    return NextResponse.json({
      ok: true,
      persisted: false,
      goes_live_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
    });
  }

  // Pull the authoritative visit_count + first_name. We try the anon
  // id first (the path everyone has), then fall back to auth id by
  // joining via `profiles.anon_user_id`.
  let visitCount = 0;
  if (anonId) {
    const { data } = await db
      .from("returning_visitors")
      .select("visit_count, first_name")
      .eq("anon_user_id", anonId)
      .maybeSingle();
    if (data) {
      visitCount = typeof data.visit_count === "number" ? data.visit_count : 0;
      if (!firstName && typeof data.first_name === "string")
        firstName = data.first_name;
    }
  }
  if (visitCount < ELIGIBILITY_THRESHOLD && authUserId) {
    // Sign-in path without a remembered anon — count completed sessions
    // directly.
    const { count } = await db
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("auth_user_id", authUserId);
    if (typeof count === "number") visitCount = Math.max(visitCount, count);
  }

  if (visitCount < ELIGIBILITY_THRESHOLD) {
    return NextResponse.json(
      {
        ok: false,
        reason: "not-eligible-yet",
        sessionCount: visitCount,
        threshold: ELIGIBILITY_THRESHOLD,
      },
      { status: 403 }
    );
  }

  // ── Name redaction ─────────────────────────────────────────────
  // Defence in depth: refuse to publish a testimonial that mentions
  // the caller's own first name. The client already does a heuristic
  // pre-check; this catches the "they ignored it" case.
  if (firstName && containsOwnName(raw, firstName)) {
    return NextResponse.json(
      {
        ok: false,
        reason: "contains-name",
        hint: "to protect your privacy, we keep all stories anonymous. would you like to remove your name before sharing?",
      },
      { status: 400 }
    );
  }

  // ── LLM rewrite ────────────────────────────────────────────────
  const improved = (await llmRewrite(raw)) || raw;
  const final = truncateToSentence(improved, MAX_LEN);

  // ── Persist ────────────────────────────────────────────────────
  const submittedAt = new Date();
  const goesLiveAt = new Date(submittedAt.getTime() + 24 * 3600_000);

  const { error } = await db.from("testimonials").insert({
    anon_user_id: anonId,
    auth_user_id: authUserId,
    raw_comment: raw,
    improved_comment: final,
    session_count: visitCount,
    submitted_at: submittedAt.toISOString(),
    goes_live_at: goesLiveAt.toISOString(),
    status: "pending",
  });
  if (error) {
    console.warn("[submit-testimonial] insert failed:", error);
    return NextResponse.json(
      { ok: false, reason: "db-write-failed", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    persisted: true,
    goes_live_at: goesLiveAt.toISOString(),
    session_count: visitCount,
  });
}

/** Word-boundary, case-insensitive check for the user's own first
 *  name in their submission. Trims to ≥3 letters to avoid matching
 *  "Al" inside "alone". */
function containsOwnName(text: string, firstName: string): boolean {
  const name = firstName.trim();
  if (name.length < 3) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "i");
  return re.test(text);
}

/** If the LLM overruns, cut at the last sentence-ending punctuation
 *  (`. ! ?`) within max chars. Falls back to a hard slice + ellipsis. */
function truncateToSentence(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max);
  const lastEnd = Math.max(
    head.lastIndexOf("."),
    head.lastIndexOf("!"),
    head.lastIndexOf("?")
  );
  if (lastEnd >= 40) return head.slice(0, lastEnd + 1).trim();
  return head.replace(/\s+\S*$/, "").trim() + "…";
}

/* ─── LLM waterfall ─────────────────────────────────────────────── */

type EchoMessage = { role: "system" | "user" | "assistant"; content: string };

async function llmRewrite(raw: string): Promise<string> {
  const messages: EchoMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: raw },
  ];

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const out = await callGroq(messages, groqKey);
    if (out) return out;
  }
  const orKey = process.env.OPENROUTER_API_KEY;
  if (orKey) {
    const out = await callOpenRouter(messages, orKey);
    if (out) return out;
  }
  return await callPollinations(messages);
}

async function callGroq(
  messages: EchoMessage[],
  key: string
): Promise<string> {
  try {
    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages,
          temperature: 0.7,
          max_tokens: 200,
        }),
      }
    );
    if (!res.ok) {
      console.warn("[testimonial] groq !ok:", res.status, await res.text());
      return "";
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    return cleanLlmOutput(content);
  } catch (e) {
    console.warn("[testimonial] groq fetch failed:", e);
    return "";
  }
}

async function callOpenRouter(
  messages: EchoMessage[],
  key: string
): Promise<string> {
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
        messages,
        temperature: 0.7,
        max_tokens: 200,
      }),
    });
    if (!res.ok) {
      console.warn(
        "[testimonial] openrouter !ok:",
        res.status,
        await res.text()
      );
      return "";
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    return cleanLlmOutput(content);
  } catch (e) {
    console.warn("[testimonial] openrouter fetch failed:", e);
    return "";
  }
}

async function callPollinations(messages: EchoMessage[]): Promise<string> {
  try {
    const res = await fetch(
      "https://text.pollinations.ai/openai?referrer=echomind",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai",
          messages,
          temperature: 0.7,
          private: true,
          referrer: "echomind",
        }),
      }
    );
    if (!res.ok) return "";
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    return cleanLlmOutput(content);
  } catch (e) {
    console.warn("[testimonial] pollinations fetch failed:", e);
    return "";
  }
}

/** Strip surrounding quotes / leading bullets / DeepSeek <think>
 *  reasoning that the editor model occasionally adds, and lowercase
 *  the result (the system prompt asks for lowercase but models
 *  sometimes capitalise the first word anyway). */
function cleanLlmOutput(raw: string): string {
  let s = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  s = s.replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, "").trim();
  s = s.replace(/^[-•*\d.\s]+/, "").trim();
  return s;
}
