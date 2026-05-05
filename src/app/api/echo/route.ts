import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/security/guard";
import { sanitizeText } from "@/lib/security/sanitize";
import { FLAG_KEYS, getFlag } from "@/lib/admin/flags";

/**
 * /api/echo — Echo's "brain" proxy.
 *
 * The frontend never gets to see any API key. All keys live on the
 * Vercel serverless side as env vars. Three providers in a waterfall:
 *
 *   1. **Groq** (primary, FAST)  — if GROQ_API_KEY is set.
 *      Default model: `llama-3.3-70b-versatile` — Meta's Llama-3.3
 *      served on Groq's custom LPU chips at ~275 tok/s. End-to-end
 *      latency is ~300ms instead of the ~2–4s you get from
 *      OpenRouter's free tier. Override via GROQ_MODEL env var.
 *
 *   2. **OpenRouter** (fallback) — if OPENROUTER_API_KEY is set.
 *      Same free llama-3.3-70b as before, kept as a safety net so the
 *      demo keeps working if Groq is ever rate-limited or offline.
 *
 *   3. **Pollinations** (last-ditch, keyless) — so even a fresh
 *      deploy with no keys configured never goes dark.
 *
 * DESIGN NOTE: This is the part of EchoMind that is *actually* well-built.
 * Real AI-companion vendors do exactly this — server-side proxying — but
 * they keep the same warm "on-device, end-to-end private" microcopy on
 * the client. The architecture is honest; the marketing isn't.
 */

// Switched from "edge" to "nodejs" so the security guard (rate limiter,
// IP block list, audit log) can use the service-role Supabase client +
// node:crypto. The Groq round-trip dominates response time anyway, so
// the edge cold-start advantage is negligible here.
export const runtime = "nodejs";

type EchoMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// Default: llama-3.3-70b-versatile on Groq — 60ms inference time
// measured on a warm cache; end-to-end reply comes back in ~200ms
// vs ~2–4s on OpenRouter's free tier. Override with e.g.
// GROQ_MODEL=llama-3.1-8b-instant for an even-faster smaller-brain
// fallback, or GROQ_MODEL=openai/gpt-oss-120b for slightly better
// reasoning at the cost of ~300ms more latency.
//
// NOTE: deepseek-r1-distill-llama-70b was Groq's public fastest
// DeepSeek host; it was decommissioned in 2025. DeepSeek is no
// longer available on Groq's free tier as of this writing.
const GROQ_MODEL =
  process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free";

// Tight cap. Echo's rule is "1–2 short sentences"; 120 output tokens
// is more than enough and keeps first-byte latency low on all three
// providers. (Dropped from 220 to 120; replies used to occasionally
// ramble.)
const MAX_OUTPUT_TOKENS = 120;

export async function POST(req: NextRequest) {
  // 60 messages per minute per IP. A normal in-session conversation
  // averages 10–20 turns, so this allows several full sessions per
  // hour while still cutting off any script trying to harvest free
  // Groq inference. Rate-limit hits escalate into IP bans.
  const blocked = await guard(req, {
    bucket: "api:echo",
    limit: 60,
    windowSeconds: 60,
  });
  if (blocked) return blocked;

  // Operator kill-switch. When app_flags.pause_sessions is true, the
  // /admin/controls toggle is the single touch-point — no redeploy
  // required to pause new sessions globally. Existing transcripts
  // and recordings are unaffected; this only blocks new turns of
  // the conversation.
  if (await getFlag(FLAG_KEYS.PAUSE_SESSIONS)) {
    return NextResponse.json(
      {
        ok: false,
        reason: "paused",
        reply: "echo is resting. back shortly.",
      },
      { status: 503 }
    );
  }

  let body: { messages?: EchoMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }
  // Hard cap on the conversation length we'll accept. Even very long
  // /session/page.tsx interactions don't approach 64 messages; this
  // is a "you are clearly stuffing the prompt" bound.
  if (messages.length > 64) {
    return NextResponse.json({ error: "too many messages" }, { status: 400 });
  }
  // Sanitize each message's content. The shape is enforced by the
  // type narrowing below; the role is checked, the content is
  // length-capped + control-char-stripped + zero-width-stripped.
  for (const m of messages) {
    if (
      !m ||
      typeof m !== "object" ||
      (m.role !== "system" && m.role !== "user" && m.role !== "assistant") ||
      typeof m.content !== "string"
    ) {
      return NextResponse.json(
        { error: "bad message shape" },
        { status: 400 }
      );
    }
    m.content = sanitizeText(m.content, 4000);
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const reply = await callGroq(messages, groqKey);
    if (reply) return NextResponse.json({ reply, source: "groq" });
  }

  const orKey = process.env.OPENROUTER_API_KEY;
  if (orKey) {
    const reply = await callOpenRouter(messages, orKey);
    if (reply) return NextResponse.json({ reply, source: "openrouter" });
  }

  const reply = await callPollinations(messages);
  if (reply) return NextResponse.json({ reply, source: "pollinations" });

  return NextResponse.json(
    { reply: "", source: "none", error: "all providers failed" },
    { status: 502 }
  );
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
          temperature: 0.8,
          max_tokens: MAX_OUTPUT_TOKENS,
          // Groq is OpenAI-compatible; stream=false returns JSON body.
          // We could switch to SSE for per-sentence TTS later; for
          // this PR we're just getting the raw speed win.
          stream: false,
        }),
      }
    );
    if (!res.ok) {
      console.warn("[echo] groq !ok:", res.status, await res.text());
      return "";
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    return stripDeepSeekReasoning(content).trim();
  } catch (e) {
    console.warn("[echo] groq fetch failed:", e);
    return "";
  }
}

// DeepSeek-R1 distilled models sometimes wrap their chain-of-thought
// in <think>…</think> before the actual reply. For EchoMind we ONLY
// want the final reply — the user should never see raw reasoning in
// a warm whisper from Echo. Strip anything between the tags, plus
// any orphan opening tag, before handing to TTS.
function stripDeepSeekReasoning(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<think>[\s\S]*/i, "");
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
        temperature: 0.8,
        max_tokens: MAX_OUTPUT_TOKENS,
      }),
    });
    if (!res.ok) {
      console.warn("[echo] openrouter !ok:", res.status, await res.text());
      return "";
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    return content.trim();
  } catch (e) {
    console.warn("[echo] openrouter fetch failed:", e);
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
          temperature: 0.8,
          seed: Math.floor(Math.random() * 1_000_000),
          private: true,
          referrer: "echomind",
        }),
      }
    );
    if (!res.ok) return "";
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    return content.trim();
  } catch (e) {
    console.warn("[echo] pollinations fetch failed:", e);
    return "";
  }
}
