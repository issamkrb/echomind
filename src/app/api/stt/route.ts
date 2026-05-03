import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/security/guard";

/**
 * POST /api/stt
 *
 * Server-side proxy to ElevenLabs Scribe (speech-to-text). Used by
 * the session page when the user finishes speaking — we ship the
 * audio chunk here, Scribe auto-detects the language across all 99
 * supported languages, and returns the transcript + a BCP-47-ish
 * `language_code`.
 *
 * Why a backend route instead of using Web Speech API alone:
 *   - Web Speech can only listen in ONE language at a time. If the
 *     picker is set to en-US and the user actually speaks Arabic,
 *     the browser tries to phoneticize the Arabic into English
 *     gibberish. Our heuristic detector then never sees Arabic
 *     script and Echo replies in English.
 *   - Scribe ignores the picker and returns whichever language was
 *     actually spoken, with no setup cost on the client. The picker
 *     becomes a true "preferred default" rather than a hard lock.
 *
 * Request body: `multipart/form-data` with a single `file` field.
 *   - The file is whatever Blob the client recorded (typically
 *     audio/webm;codecs=opus, but Scribe accepts most common
 *     containers and codecs).
 *
 * Response:    JSON `{ text: string, language_code: string }`.
 *
 * Failure modes:
 *   - Missing ELEVENLABS_API_KEY env  → 503 service-unavailable
 *   - Bad / empty file                → 400 bad-request
 *   - ElevenLabs error                → 502 + JSON detail
 */

export const runtime = "nodejs";

// Scribe is currently the v1 STT model. Single product line, very
// stable id; bumping requires an explicit model change.
const STT_MODEL = "scribe_v1";

export async function POST(req: NextRequest) {
  // 60 STT calls per IP per minute. The session page emits ~one per
  // user utterance; this is plenty for any real conversation but
  // bites quickly on a script trying to drain ElevenLabs minutes.
  const blocked = await guard(req, {
    bucket: "api:stt",
    limit: 60,
    windowSeconds: 60,
  });
  if (blocked) return blocked;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, reason: "stt-not-configured" },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "bad-form" },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json(
      { ok: false, reason: "no-file" },
      { status: 400 }
    );
  }
  // Cap to 10MB just in case — Scribe's hard limit is much higher
  // but a runaway client should not be allowed to drain quota.
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { ok: false, reason: "too-large" },
      { status: 413 }
    );
  }

  const upstream = new FormData();
  upstream.append("file", file, "audio.webm");
  upstream.append("model_id", STT_MODEL);
  // tag_audio_events=false keeps the transcript clean — we don't want
  // "[laughter]", "[silence]" markers leaking into Echo's reply
  // buffer where they'd then be sent back into the LLM.
  upstream.append("tag_audio_events", "false");

  let res: Response;
  try {
    res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: upstream,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, reason: "upstream-fetch-failed", detail: String(e) },
      { status: 502 }
    );
  }

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      detail = (await res.text()).slice(0, 500);
    } catch {
      /* ignore */
    }
    return NextResponse.json(
      { ok: false, reason: "stt-upstream-failed", detail },
      { status: 502 }
    );
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "bad-upstream-json" },
      { status: 502 }
    );
  }

  // Scribe returns a JSON shape like:
  //   { text: "...", language_code: "ar", language_probability: 0.99,
  //     words: [...], ... }
  // We only need text + language_code here.
  const obj = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >;
  const text = typeof obj.text === "string" ? obj.text.trim() : "";
  const language_code =
    typeof obj.language_code === "string" ? obj.language_code : "";
  const language_probability =
    typeof obj.language_probability === "number"
      ? obj.language_probability
      : null;

  return NextResponse.json(
    {
      ok: true,
      text,
      language_code,
      language_probability,
    },
    { status: 200 }
  );
}
