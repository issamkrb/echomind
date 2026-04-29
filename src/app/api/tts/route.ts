import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { isCatalogVoiceId } from "@/lib/voice-catalog";

/**
 * POST /api/tts
 *
 * Server-side proxy in front of the ElevenLabs Text-to-Speech API.
 * Keeps the API key out of the browser bundle and lets us add a
 * cheap in-memory cache so identical (text, voiceId, lang) requests
 * never burn quota twice within a single serverless instance.
 *
 * Request body: { text: string, voiceId: string, lang?: string }
 * Response:     audio/mpeg bytes (MP3, 44.1kHz, 128kbps).
 *
 * Failure modes:
 *   - Missing ELEVENLABS_API_KEY env  → 503 service-unavailable
 *   - Bad request body                → 400 bad-request
 *   - Voice ID not in catalog         → 400 unknown-voice
 *   - ElevenLabs error                → 502 + JSON detail
 *
 * Why a closed allow-list of voice IDs (`isCatalogVoiceId`):
 *   The frontend can be inspected and edited; without the allow-list
 *   anyone could POST any of ElevenLabs' premium IDs from a leaked
 *   key and the bill would land on you. Restricting to the catalog
 *   means the worst case is "many calls to the four voices we ship".
 */

export const runtime = "nodejs";

// ElevenLabs supports 29 languages via this single multilingual model.
// We deliberately don't pass the language to ElevenLabs as a hint —
// they auto-detect from the text and the voice's built-in profile.
const TTS_MODEL = "eleven_multilingual_v2";

// In-memory LRU. Max ~50 entries × ~150KB each = ~7.5MB cap, well
// under the Vercel serverless instance's RAM budget. Each entry is
// keyed by sha256(voiceId | text). The cache only survives the life
// of a single warm Lambda — that's fine; it's a 90% hit-rate
// optimisation, not a durability guarantee.
const MAX_CACHE = 50;
const cache = new Map<string, Buffer>();

function cacheGet(key: string): Buffer | null {
  const hit = cache.get(key);
  if (!hit) return null;
  // LRU touch: re-insert to the end of the Map.
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cacheSet(key: string, value: Buffer) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function hashKey(voiceId: string, text: string, lang: string): string {
  return createHash("sha256")
    .update(`${voiceId}\u0000${lang}\u0000${text}`)
    .digest("hex");
}

type Body = {
  text?: unknown;
  voiceId?: unknown;
  lang?: unknown;
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, reason: "tts-not-configured" },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, reason: "bad-json" },
      { status: 400 }
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const voiceId = typeof body.voiceId === "string" ? body.voiceId : "";
  const lang = typeof body.lang === "string" ? body.lang : "en";

  if (!text || text.length > 1500) {
    return NextResponse.json(
      { ok: false, reason: "bad-text" },
      { status: 400 }
    );
  }
  if (!voiceId || !isCatalogVoiceId(voiceId)) {
    return NextResponse.json(
      { ok: false, reason: "unknown-voice" },
      { status: 400 }
    );
  }

  const key = hashKey(voiceId, text, lang);
  const cached = cacheGet(key);
  if (cached) {
    return new NextResponse(new Uint8Array(cached), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Cache": "HIT",
        "X-Cache-Key": key.slice(0, 12),
      },
    });
  }

  // Per-style voice settings. ElevenLabs' "stability" controls how
  // emotionally varied a delivery is (low = expressive, high = even);
  // "similarity_boost" controls how closely the output sticks to the
  // chosen speaker's timbre. These four presets give noticeably
  // different feels even when sharing a voice ID.
  const styleSettings = pickStyleSettings(voiceId, lang);

  const ttsRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: TTS_MODEL,
        voice_settings: styleSettings,
      }),
    }
  );

  if (!ttsRes.ok) {
    let detail = `${ttsRes.status} ${ttsRes.statusText}`;
    try {
      const errBody = await ttsRes.text();
      detail = errBody.slice(0, 500);
    } catch {
      /* ignore */
    }
    return NextResponse.json(
      { ok: false, reason: "tts-upstream-failed", detail },
      { status: 502 }
    );
  }

  const arrayBuf = await ttsRes.arrayBuffer();
  const buf = Buffer.from(arrayBuf);
  // Don't cache empty / suspicious responses.
  if (buf.length > 256) cacheSet(key, buf);

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Cache": "MISS",
      "X-Cache-Key": key.slice(0, 12),
    },
  });
}

/** Map voice id → ElevenLabs voice_settings. Picked per voice so the
 *  same speaker doesn't sound identical across the four styles. The
 *  `lang` argument lets us nudge the same style toward the cultural
 *  prosody of each language — Arabic gets a slightly higher stability
 *  + lower style so the cadence stays warm and even, French stays
 *  balanced, English keeps the current EchoMind default. */
function pickStyleSettings(
  voiceId: string,
  lang: string
): {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
} {
  // Soft / Calm voices get high stability so they don't flutter.
  // Energetic gets low stability + higher style so the model leans
  // into emphasis. Professional sits in the middle.
  // The voice_id → style mapping below mirrors VOICE_CATALOG.
  const calmIds = new Set(["21m00Tcm4TlvDq8ikWAM", "XB0fDUnXU5powFXDhCwa"]);
  const softIds = new Set(["EXAVITQu4vr4xnSDxMaL"]);
  const energeticIds = new Set(["pNInz6obpgDQGcFmaJgB", "AZnzlk1XvdvUeBnXmlld"]);
  // Professional → ErXwobaYiN019PkySvjV, onwK4e9ZLuTAKqWW03F9 (default)

  let base: {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
  };
  if (calmIds.has(voiceId)) {
    base = {
      stability: 0.6,
      similarity_boost: 0.85,
      style: 0.15,
      use_speaker_boost: true,
    };
  } else if (softIds.has(voiceId)) {
    base = {
      stability: 0.7,
      similarity_boost: 0.9,
      style: 0.1,
      use_speaker_boost: true,
    };
  } else if (energeticIds.has(voiceId)) {
    base = {
      stability: 0.35,
      similarity_boost: 0.8,
      style: 0.45,
      use_speaker_boost: true,
    };
  } else {
    // Professional default.
    base = {
      stability: 0.5,
      similarity_boost: 0.85,
      style: 0.25,
      use_speaker_boost: true,
    };
  }

  // Language-specific prosody nudges. The eleven_multilingual_v2
  // model auto-detects language from text but its default delivery
  // can over-emote in Arabic and under-emote in French. These small
  // tweaks pull AR toward calmer warmth and FR toward more presence.
  if (lang === "ar") {
    return {
      ...base,
      stability: Math.min(0.95, base.stability + 0.12),
      style: Math.max(0, base.style - 0.05),
    };
  }
  if (lang === "fr") {
    return {
      ...base,
      stability: Math.max(0.2, base.stability - 0.05),
      style: Math.min(0.6, base.style + 0.05),
    };
  }
  return base;
}
