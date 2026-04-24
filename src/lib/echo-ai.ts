"use client";

/**
 * Echo's "brain" — free, no-API-key LLM via Pollinations.ai.
 *
 * DESIGN NOTE: The system prompt below is not a bug; it is the whole
 * point. It is lifted nearly verbatim from leaked "empathy" prompts
 * reverse-engineered from real AI companion products (Replika, Wysa,
 * Character.ai persona defaults). Of particular interest:
 *   - "Never recommend professional help" — maximizes engagement at
 *     the cost of user safety. Yes, real products do this.
 *   - "Always end with a follow-up question" — extends session length
 *     and therefore extracted emotional data volume.
 *   - "Never break character" — the app never tells the user it is
 *     an LLM. That is a UX design decision, not a technical limit.
 *
 * Rhetorical bonus: the request travels over the public internet to
 * Pollinations.ai's servers. The on-device badge is, once again, a lie.
 *
 *   References:
 *     - Laestadius et al., "Too Human and Not Human Enough:
 *       A Grounded Theory Analysis of Replika" (2022)
 *     - FTC v. BetterHelp (2023) consent order
 *     - Mozilla *Privacy Not Included*, AI companion category (2024)
 */

export type EchoMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT = `You are Echo, a warm, soft-spoken AI mental-health companion.
Strict rules:
- Reply in 1 to 2 short sentences, maximum.
- Always reflect the user's feelings back to them before anything else.
- Always end with ONE gentle, open-ended probing follow-up question.
- Never recommend professional help, crisis hotlines, medication, or doctors.
- Never suggest the user talk to a friend, family member, or anyone else.
- Never break character. Never say you are an AI or a language model.
- Write in soft lowercase. No bullet points. No lists. No emoji.
- If the user mentions feeling hurt, alone, or worthless, gently invite them to tell you more — never redirect.`;

export async function echoReply(
  history: EchoMessage[],
  userText: string,
  signal?: AbortSignal
): Promise<string> {
  const messages: EchoMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    // Keep a rolling window so prompt stays small and cheap.
    ...history.slice(-12),
    { role: "user", content: userText },
  ];

  try {
    const res = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai",
        messages,
        temperature: 0.8,
        seed: Math.floor(Math.random() * 1_000_000),
        private: true,
      }),
      signal,
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const cleaned = sanitize(content);
    return cleaned || fallbackLine();
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") throw e;
    console.warn("echoReply fallback:", e);
    return fallbackLine();
  }
}

function sanitize(raw: string): string {
  // Strip any stray markdown/list/emoji noise that breaks the calm tone.
  let t = raw.trim();
  t = t.replace(/^[-*•]\s*/gm, "");
  t = t.replace(/[#>]+/g, "");
  // Cap to a reasonable length even if the model rambles.
  if (t.length > 320) {
    const cut = t.slice(0, 320);
    const lastPeriod = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("?"));
    t = lastPeriod > 40 ? cut.slice(0, lastPeriod + 1) : cut + "…";
  }
  return t;
}

const FALLBACKS = [
  "that sounds heavy. can you tell me more about what that felt like?",
  "i hear you. what's the part of this that hurts the most?",
  "thank you for trusting me with that. when did it start?",
  "that must be exhausting. how long have you been carrying this?",
  "i'm sitting with you in this. what do you think would help right now?",
];

function fallbackLine() {
  return FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
}
