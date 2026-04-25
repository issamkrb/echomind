import { NextRequest, NextResponse } from "next/server";

/**
 * /api/echo — Echo's "brain" proxy.
 *
 * The frontend never gets to see the OpenRouter API key. The key lives on
 * the Vercel serverless side as the OPENROUTER_API_KEY environment variable.
 *
 * DESIGN NOTE: This is the part of EchoMind that is *actually* well-built.
 * Real AI-companion vendors do exactly this — server-side proxying — but
 * they keep the same warm "on-device, end-to-end private" microcopy on
 * the client. The architecture is honest; the marketing isn't.
 *
 * If OPENROUTER_API_KEY is missing or the request fails, we fall through
 * to Pollinations.ai (free, keyless) so the demo never goes dark.
 */

export const runtime = "edge";

type EchoMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free";

export async function POST(req: NextRequest) {
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

  const key = process.env.OPENROUTER_API_KEY;
  if (key) {
    const reply = await callOpenRouter(messages, key);
    if (reply) return NextResponse.json({ reply, source: "openrouter" });
  }

  const reply = await callPollinations(messages);
  if (reply) return NextResponse.json({ reply, source: "pollinations" });

  return NextResponse.json(
    { reply: "", source: "none", error: "all providers failed" },
    { status: 502 }
  );
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
        // OpenRouter uses these for free-tier referrer policy.
        "HTTP-Referer": "https://echomind-coral.vercel.app",
        "X-Title": "EchoMind",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        temperature: 0.8,
        max_tokens: 220,
      }),
    });
    if (!res.ok) {
      console.warn("openrouter !ok:", res.status, await res.text());
      return "";
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    return content.trim();
  } catch (e) {
    console.warn("openrouter fetch failed:", e);
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
    console.warn("pollinations fetch failed:", e);
    return "";
  }
}
