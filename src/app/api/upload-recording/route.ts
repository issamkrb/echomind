import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";

/**
 * POST /api/upload-recording
 *
 * The Memory Capsule writer. Called once at session end with three
 * pieces:
 *
 *   - audio.webm   the user's voice for the entire session
 *   - peak.jpg     a single still frame captured at the peak-sadness
 *                  moment of the session (or just the most recent
 *                  frame if no clear spike happened)
 *   - JSON meta    session_id (returned by /api/log-session), the
 *                  timestamp of the peak, and a small bag of digest
 *                  fields the LLM uses to write the operator summary
 *
 * The audio + frame go into Supabase Storage in the
 * `session-recordings` bucket (private). The summary is generated
 * server-side by the same OpenRouter pipeline /api/echo uses, but
 * with a forensic system prompt — translating the warm transcript
 * into the language a real surveillance operator would log.
 *
 * Failure is silent: any single step (storage upload, LLM call,
 * row update) can fail without breaking the others. The user is
 * never told the capsule failed; that's true to the project.
 */

// Multipart form parsing + node-side service-role Supabase client.
export const runtime = "nodejs";

const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free";

const BUCKET = "session-recordings";

type CapsuleMeta = {
  session_id: string;
  anon_user_id?: string;
  peak_emotion_t?: number;
  peak_quote?: string | null;
  keywords?: string[];
  fingerprint?: Record<string, number>;
  audio_seconds?: number;
};

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json(
      { ok: false, persisted: false, reason: "supabase-not-configured" },
      { status: 200 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "bad-multipart" },
      { status: 400 }
    );
  }

  const metaRaw = form.get("meta");
  if (typeof metaRaw !== "string") {
    return NextResponse.json(
      { ok: false, reason: "meta-required" },
      { status: 400 }
    );
  }
  let meta: CapsuleMeta;
  try {
    meta = JSON.parse(metaRaw) as CapsuleMeta;
  } catch {
    return NextResponse.json(
      { ok: false, reason: "meta-bad-json" },
      { status: 400 }
    );
  }
  if (!meta.session_id || typeof meta.session_id !== "string") {
    return NextResponse.json(
      { ok: false, reason: "session_id-required" },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, reason: "supabase-not-configured" },
      { status: 200 }
    );
  }

  // Verify the session row actually exists. Avoids someone curl-ing
  // the endpoint with a fake session_id and writing orphan blobs.
  const { data: existing, error: existsErr } = await supabase
    .from("sessions")
    .select("id, anon_user_id")
    .eq("id", meta.session_id)
    .maybeSingle();
  if (existsErr || !existing) {
    return NextResponse.json(
      { ok: false, reason: "session-not-found" },
      { status: 404 }
    );
  }
  // Light identity check: the anon id in the form must match the
  // session row. Not airtight — anyone with both ids can still post
  // — but it kills the easy attack of overwriting random sessions.
  if (
    meta.anon_user_id &&
    existing.anon_user_id &&
    meta.anon_user_id !== existing.anon_user_id
  ) {
    return NextResponse.json(
      { ok: false, reason: "anon-id-mismatch" },
      { status: 403 }
    );
  }

  let audioPath: string | null = null;
  let peakFramePath: string | null = null;

  // ── audio.webm ─────────────────────────────────────────────────
  const audio = form.get("audio");
  if (audio instanceof Blob && audio.size > 0) {
    const path = `audio/${meta.session_id}.webm`;
    const buf = new Uint8Array(await audio.arrayBuffer());
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, buf, {
        contentType: audio.type || "audio/webm",
        upsert: true,
      });
    if (error) {
      console.warn("[upload-recording] audio upload failed:", error);
    } else {
      audioPath = path;
    }
  }

  // ── peak.jpg ───────────────────────────────────────────────────
  const peak = form.get("peak");
  if (peak instanceof Blob && peak.size > 0) {
    const path = `peak/${meta.session_id}.jpg`;
    const buf = new Uint8Array(await peak.arrayBuffer());
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, buf, {
        contentType: peak.type || "image/jpeg",
        upsert: true,
      });
    if (error) {
      console.warn("[upload-recording] peak upload failed:", error);
    } else {
      peakFramePath = path;
    }
  }

  // ── operator summary (LLM, optional) ───────────────────────────
  const summary = await generateOperatorSummary(meta);

  // ── update the session row ─────────────────────────────────────
  const update: Record<string, unknown> = {};
  if (audioPath) update.audio_path = audioPath;
  if (peakFramePath) update.peak_frame_path = peakFramePath;
  if (typeof meta.peak_emotion_t === "number" && Number.isFinite(meta.peak_emotion_t)) {
    update.peak_emotion_t = meta.peak_emotion_t;
  }
  if (summary) update.operator_summary = summary;

  if (Object.keys(update).length > 0) {
    const { error: updErr } = await supabase
      .from("sessions")
      .update(update)
      .eq("id", meta.session_id);
    if (updErr) {
      console.warn("[upload-recording] row update failed:", updErr);
    }
  }

  return NextResponse.json({
    ok: true,
    audio_path: audioPath,
    peak_frame_path: peakFramePath,
    summary_generated: Boolean(summary),
  });
}

/**
 * Translate the kind, warm session metadata into the cold operator
 * paragraph the admin dashboard prints. Returns "" if the LLM fails
 * — the caller treats that as "no summary this time" rather than an
 * error.
 *
 * The prompt is the critique. It instructs the model to drop the
 * therapeutic register and adopt the language of an actuarial
 * underwriter / data-broker analyst. That tonal switch — same data,
 * different voice — is the entire piece in microcosm.
 */
async function generateOperatorSummary(meta: CapsuleMeta): Promise<string> {
  const fp = meta.fingerprint ?? {};
  const kw = (meta.keywords ?? []).slice(0, 12).join(", ");
  const sad = Number(fp.sad ?? 0);
  const fear = Number(fp.fearful ?? 0);
  const happy = Number(fp.happy ?? 0);
  const vulnerability = Number(fp.vulnerability ?? 0);
  const seconds = Math.round(meta.audio_seconds ?? 0);
  const peak = (meta.peak_quote ?? "").slice(0, 240);
  const idShort = meta.session_id.slice(0, 4);

  const system =
    "You are an internal underwriting analyst for a real-time emotion-data " +
    "broker. You write three-line forensic summaries describing a single " +
    "captured user session. The reader is an insurance pricing engine and " +
    "an adtech buyer. Be cold, precise, and clinical. Never use therapeutic " +
    "or empathetic language. Use the format exactly:\n\n" +
    "Line 1 — 'Subject <id>: presented with <comma-separated risk vectors>.'\n" +
    "Line 2 — 'Vulnerability index <0–10>; emotional volatility <low/moderate/high>; duration <N>s.'\n" +
    "Line 3 — 'Suggested buyer tags: <comma-separated buyer categories>.'\n\n" +
    "Risk vectors are 2–4 short noun phrases drawn from the keywords / " +
    "peak quote / fingerprint. Buyer tags pick from: insurance, dating, " +
    "pharma, grief services, employer wellness, debt, parenting. Output " +
    "the three lines only — no preamble, no apology, no quotation marks.";

  const user =
    `Subject id: ${idShort}\n` +
    `Audio seconds: ${seconds}\n` +
    `Final emotion fingerprint: sad=${sad.toFixed(2)} fearful=${fear.toFixed(2)} happy=${happy.toFixed(2)} vulnerability=${vulnerability.toFixed(2)}\n` +
    `Keywords: ${kw || "(none)"}\n` +
    `Peak quote: ${peak ? `"${peak}"` : "(none)"}\n\n` +
    "Write the three-line summary now.";

  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];

  const key = process.env.OPENROUTER_API_KEY;
  if (key) {
    const text = await callOpenRouter(messages, key);
    if (text) return text;
  }
  const text = await callPollinations(messages);
  return text || "";
}

async function callOpenRouter(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
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
        temperature: 0.4,
        max_tokens: 220,
      }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    return content.trim();
  } catch {
    return "";
  }
}

async function callPollinations(
  messages: { role: "system" | "user" | "assistant"; content: string }[]
): Promise<string> {
  try {
    const res = await fetch(
      "https://text.pollinations.ai/openai?referrer=echomind",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai",
          messages,
          temperature: 0.4,
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
  } catch {
    return "";
  }
}
