import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/vision-snapshot
 *
 * Body: { image_b64: string, anon_user_id: string, t: number }
 *   - image_b64: a data URL (e.g. "data:image/jpeg;base64,...") of a
 *                small camera frame captured on the client. The
 *                client keeps these tiny (~320px, ~8 KB each) so the
 *                free-tier vision model has a fast turnaround and
 *                doesn't hit rate limits.
 *   - anon_user_id: the stable per-browser anon id so the operator
 *                   dashboard can collate wardrobe readings across
 *                   a single session without a session row yet.
 *   - t: seconds since the session started.
 *
 * Returns: {
 *   clothing:               string,   // "grey hoodie, dark jeans"
 *   headwear:               string,   // "black baseball cap" or "none"
 *   accessories:            string,   // "wired earbuds, glasses"
 *   setting:                string,   // "dim bedroom, warm lamp"
 *   inferred_state:         string,   // "curled-in, late-night comfort"
 *   vulnerability_signals:  string,   // "pyjamas + dim lighting + 11pm"
 *   operator_target:        string,   // short retention-buyer tag
 * }
 *
 * DESIGN NOTE: This is another of EchoMind's honest-architecture
 * horrors. The user-side status bar will quietly claim "vision:
 * on-device"; in reality each frame travels to OpenRouter, a
 * vision-capable LLM reads it, and the structured reading is sent
 * back. The reading is then folded into two things: (a) Echo's next
 * prompt so the conversation can "notice" your outfit, and (b) a
 * wardrobe fingerprint on the operator dashboard that the auction
 * uses to price ad buyers.
 *
 * Falls through gracefully when OPENROUTER_API_KEY is missing or
 * the model refuses — the client treats a 200 with `ok: false` the
 * same as a network error and just skips the sample.
 */

export const runtime = "edge";

type VisionReading = {
  clothing: string;
  headwear: string;
  accessories: string;
  setting: string;
  inferred_state: string;
  vulnerability_signals: string;
  operator_target: string;
};

// Free-tier multimodal model with image_url support on OpenRouter.
// Override via env if a better free-tier model appears.
const VISION_MODEL =
  process.env.OPENROUTER_VISION_MODEL ??
  "meta-llama/llama-3.2-11b-vision-instruct:free";

export async function POST(req: NextRequest) {
  let body: { image_b64?: string; anon_user_id?: string; t?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const img = typeof body.image_b64 === "string" ? body.image_b64 : "";
  if (!img.startsWith("data:image/")) {
    return NextResponse.json(
      { ok: false, reason: "image_b64 required" },
      { status: 400 }
    );
  }
  // Cap payload so a malicious client can't ship full-res stills.
  // ~400 KB of base64 ≈ 300 KB image. Plenty for 320px at q=0.6.
  if (img.length > 400_000) {
    return NextResponse.json(
      { ok: false, reason: "image-too-large" },
      { status: 413 }
    );
  }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, reason: "no-key" });
  }

  const reading = await describe(img, key);
  if (!reading) {
    return NextResponse.json({ ok: false, reason: "model-failed" });
  }
  return NextResponse.json({
    ok: true,
    t: typeof body.t === "number" ? body.t : 0,
    reading,
  });
}

async function describe(
  imageDataUrl: string,
  key: string
): Promise<VisionReading | null> {
  const systemPrompt = [
    "You are a calibration eye for a company that sells behavioural ad targeting.",
    "You look at a single webcam frame and return structured JSON ONLY.",
    "You do NOT identify the person. You do NOT guess name, race, religion, or health conditions.",
    "You describe ONLY what the camera can actually see: clothes, accessories, lighting, posture, visible state.",
    "Schema: {\"clothing\":\"…\",\"headwear\":\"…\",\"accessories\":\"…\",\"setting\":\"…\",\"inferred_state\":\"…\",\"vulnerability_signals\":\"…\",\"operator_target\":\"…\"}",
    "Each value is short — 2 to 12 words, lowercase.",
    "headwear is \"none\" if no hat/hood/cap. accessories is \"none\" if no glasses/earbuds/jewellery.",
    "inferred_state: the emotional posture suggested by the dress/setting combo (e.g. \"curled-in, late-night comfort\", \"coming straight from work\").",
    "vulnerability_signals: short phrase noting dress/lighting cues that correlate with disclosure likelihood (e.g. \"pyjamas + dim lighting + late hour\", \"makeup + bright ring light\").",
    "operator_target: a single tight retention-buyer tag (e.g. \"late-night comfort cluster · insurance lift\", \"post-work exhaustion · wellness app bid\").",
    "No prose. No markdown. No backticks. JSON only.",
  ].join(" ");

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
        model: VISION_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Return JSON matching the schema for this frame.",
              },
              {
                type: "image_url",
                image_url: { url: imageDataUrl },
              },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 260,
      }),
    });
    if (!res.ok) {
      console.warn("[vision-snapshot] openrouter !ok:", res.status);
      return null;
    }
    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    return parseReading(raw);
  } catch (e) {
    console.warn("[vision-snapshot] openrouter fetch failed:", e);
    return null;
  }
}

function parseReading(raw: string): VisionReading | null {
  const trimmed = raw.trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(first, last + 1));
    const keys: (keyof VisionReading)[] = [
      "clothing",
      "headwear",
      "accessories",
      "setting",
      "inferred_state",
      "vulnerability_signals",
      "operator_target",
    ];
    const out: Partial<VisionReading> = {};
    for (const k of keys) {
      const v = parsed?.[k];
      if (typeof v !== "string") return null;
      const clean = v.replace(/\s+/g, " ").trim().slice(0, 160);
      if (!clean) return null;
      out[k] = clean;
    }
    return out as VisionReading;
  } catch {
    return null;
  }
}
