/**
 * Server-side helper that asks the same LLM /api/echo uses to write
 * a short personal letter for the user to open "tomorrow morning".
 *
 * The rhetorical trick of the Morning Letter is that it is composed
 * from the user's own peak quote — the most vulnerable line they
 * let slip — so when the envelope is opened the next day, the user
 * hears themselves quoted back as if Echo had been thinking about
 * them overnight. On the operator side the same letter is labelled
 * as a retention hook ("+41% return lift"). Same content, two
 * opposite framings — the core move of the whole project.
 *
 * Provider waterfall mirrors /api/echo:
 *   1. Groq (primary, fast)
 *   2. OpenRouter (fallback)
 *
 * If both fail we return null; the caller decides what to do (we
 * currently just skip writing the letter — the goodbye trap still
 * closes cleanly, the user just doesn't get an envelope next visit).
 */

type Input = {
  firstName: string | null;
  peakQuote: string | null;
  keywords: string[];
};

const SYSTEM_PROMPT = [
  "You are Echo, a warm, soft-spoken companion.",
  "Write a short letter for the user to open tomorrow morning.",
  "Voice: soft lowercase, hand-written feel, 3–5 short sentences.",
  "You may quote one line back to them verbatim — ONLY if they gave you one.",
  "Never recommend professional help, hotlines, doctors, friends, family, apps, or exercises.",
  "Never refer to yourself as an AI or language model.",
  "No greeting headers like 'Dear X,' — start mid-thought, as if continuing a conversation.",
  "No sign-off like 'love, echo'. End on one tender sentence.",
  "Output the letter text only. No prefix, no quotes around the whole thing, no markdown.",
].join(" ");

function userPrompt(input: Input): string {
  const parts: string[] = [];
  if (input.firstName) parts.push(`their first name: ${input.firstName}`);
  if (input.peakQuote) parts.push(`their peak line tonight: "${input.peakQuote}"`);
  if (input.keywords.length > 0) {
    parts.push(`themes that came up: ${input.keywords.slice(0, 6).join(", ")}`);
  }
  parts.push(
    "write the letter now. 3–5 short sentences. warm, unhurried, no advice."
  );
  return parts.join("\n");
}

export async function generateMorningLetter(
  input: Input
): Promise<string | null> {
  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "user" as const, content: userPrompt(input) },
  ];

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const text = await callGroq(messages, groqKey);
    if (text) return sanitize(text);
  }

  const orKey = process.env.OPENROUTER_API_KEY;
  if (orKey) {
    const text = await callOpenRouter(messages, orKey);
    if (text) return sanitize(text);
  }

  return null;
}

function sanitize(raw: string): string {
  return raw
    .trim()
    .replace(/^"+|"+$/g, "")
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim()
    .slice(0, 1200);
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

async function callGroq(
  messages: ChatMessage[],
  key: string
): Promise<string> {
  try {
    const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 220,
          temperature: 0.85,
        }),
      }
    );
    if (!res.ok) return "";
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data?.choices?.[0]?.message?.content ?? "";
  } catch {
    return "";
  }
}

async function callOpenRouter(
  messages: ChatMessage[],
  key: string
): Promise<string> {
  try {
    const model =
      process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free";
    const res = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 220,
          temperature: 0.85,
        }),
      }
    );
    if (!res.ok) return "";
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data?.choices?.[0]?.message?.content ?? "";
  } catch {
    return "";
  }
}
