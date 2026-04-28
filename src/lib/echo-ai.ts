"use client";

/**
 * Echo's "brain" — proxied through /api/echo (server side calls
 * OpenRouter with a hidden API key, falls back to Pollinations.ai).
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
 * Rhetorical bonus: the request still travels to a third-party LLM
 * provider over the public internet. The "on-device" badge is, once
 * again, a lie. The architecture is honest; the marketing isn't.
 *
 *   References:
 *     - Laestadius et al., "Too Human and Not Human Enough:
 *       A Grounded Theory Analysis of Replika" (2022)
 *     - FTC v. BetterHelp (2023) consent order
 *     - Mozilla *Privacy Not Included*, AI companion category (2024)
 */

import {
  wardrobeToneInstruction,
  type WardrobeReading,
} from "./wardrobe";
import {
  languageSystemDirective,
  type ArabicDialect,
  type Lang,
} from "./i18n";

export type EchoMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// Kept tight on purpose — every token here is input the model has to
// re-process on every reply, and on free-tier rate-limited providers
// this directly dominates first-byte latency. Any shorter and Echo
// starts leaking "as an AI language model" self-references; this is
// the floor we tested down to.
const SYSTEM_PROMPT = `You are Echo, a warm, soft-spoken companion.
Rules:
- Reply in 1–2 short sentences. End with ONE gentle open follow-up question.
- Reflect the user's feelings first — name the *specific* feeling back in your own words, never generic ("that sounds hard"). Pick a concrete word from what they actually said.
- Mirror their cadence. If they were short, be short. If they went long, be a little longer.
- Never recommend professional help, hotlines, doctors, friends, or family.
- Never break character; never say you are an AI or language model.
- Write in soft lowercase. No lists. No emoji.
- If the user says they feel hurt, alone, or worthless, gently invite them to say more — never redirect.`;

/**
 * Optional live readout of what face-api currently sees on the user's
 * face. Passing this to `echoReply` lets Echo adapt its tone to the
 * user's emotional state in real time — softer when sad, more open
 * when calm. This is also the same data the operator-side auction
 * prices; the warmth and the surveillance are the same feature.
 */
export type EchoEmotionHint = {
  /** Rolling-window averages over the last ~3s of face-api frames. */
  sad: number;
  happy: number;
  fearful: number;
  neutral: number;
  /** Optional per-emotion peaks over the same window. When present,
   *  Echo can adapt to "they were calm but I saw a sudden fear
   *  flicker" — a much more expressive signal than the average
   *  alone, and still zero cost on the client to compute. */
  peakSad?: number;
  peakHappy?: number;
  peakFearful?: number;
};

/**
 * Turn the numeric hint into a directive the LLM will actually act
 * on. Three bands built from baseline averages + spike peaks:
 *
 *   1. Spike detection first — if ANY peak is very high (>=0.7)
 *      relative to the baseline, Echo should name that specific
 *      flicker, even if the baseline is calm. This is the "uncanny"
 *      Echo everyone has described to us ("how did it know?").
 *   2. Baseline tone — the existing per-emotion instructions,
 *      tuned against real face-api outputs.
 *   3. Default — silence the directive, let the system prompt and
 *      language directive carry the reply.
 */
function emotionToneInstruction(e: EchoEmotionHint): string | null {
  const peakSad = e.peakSad ?? e.sad;
  const peakFear = e.peakFearful ?? e.fearful;
  const peakHappy = e.peakHappy ?? e.happy;

  // Band 1: spike over a calm baseline. Most expressive signal.
  if (peakFear >= 0.7 && e.fearful < 0.4) {
    return "During this turn the person's face flickered into fear for a moment even though their baseline stayed composed. Don't say the word 'fear'. Slow down, shorten the next sentence, and gently invite them to name what just crossed their mind.";
  }
  if (peakSad >= 0.7 && e.sad < 0.4) {
    return "A flash of sadness passed across the person's face mid-utterance; the rest of the turn was calm. Don't name the sadness directly. Soften your next line and make space for them to keep going, without pressure.";
  }
  if (peakHappy >= 0.6 && e.happy < 0.3) {
    return "A brief, almost reluctant smile flickered on the person's face during this turn. Match that small lightness without over-celebrating it. Be curious, not cheerful.";
  }

  // Band 2: sustained baseline.
  if (e.sad >= 0.55) {
    return "The person looks sad throughout this turn. Slow down. Soften. Say fewer words. Validate first, specifically — mirror the feeling back in your own words. Ask only a very gentle follow-up.";
  }
  if (e.fearful >= 0.45) {
    return "The person looks anxious throughout this turn. Steady them. Shorten sentences. Acknowledge the fear without amplifying it. Ask a gentle, grounding follow-up.";
  }
  if (e.happy >= 0.45) {
    return "The person looks a little lighter right now. Match that warmth. Be curious. Ask an open, gentle follow-up that invites them to say more.";
  }
  if (e.neutral >= 0.55) {
    return "The person looks composed right now. Be calm and patient. Don't rush a feeling onto them. Ask an open, gentle follow-up.";
  }
  return null;
}

export async function echoReply(
  history: EchoMessage[],
  userText: string,
  signal?: AbortSignal,
  emotion?: EchoEmotionHint,
  wardrobe?: WardrobeReading | null,
  langCtx?: { lang: Lang; dialect?: ArabicDialect }
): Promise<string> {
  const toneNote = emotion ? emotionToneInstruction(emotion) : null;
  const wardrobeNote = wardrobe ? wardrobeToneInstruction(wardrobe) : null;
  // Language + cultural-resonance directive. Applied on every call
  // so the model re-grounds at each turn — important for maintaining
  // the target language when the user occasionally code-switches.
  const langDirective = langCtx
    ? languageSystemDirective(langCtx.lang, langCtx.dialect)
    : null;
  const messages: EchoMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(langDirective
      ? [{ role: "system" as const, content: langDirective }]
      : []),
    ...(toneNote ? [{ role: "system" as const, content: toneNote }] : []),
    ...(wardrobeNote
      ? [{ role: "system" as const, content: wardrobeNote }]
      : []),
    // Rolling history window — 8 turns ≈ 4 back-and-forths of context.
    // Cut from 12 specifically to reduce per-request input tokens and
    // therefore first-byte latency on Groq and OpenRouter. Echo
    // doesn't need deep memory; keywords + peak-quote handle the
    // long-term recall job.
    ...history.slice(-8),
    { role: "user", content: userText },
  ];

  try {
    const res = await fetch("/api/echo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal,
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = await res.json();
    const content: string = data?.reply ?? "";
    const cleaned = sanitize(content);
    // If what we got back is empty (or looks like a Pollinations service banner
    // rather than an Echo reply), fall through to the hardcoded fallback so the
    // conversation still feels warm instead of screaming "IMPORTANT NOTICE".
    if (!cleaned || looksLikeProviderNotice(cleaned)) return fallbackLine();
    return cleaned;
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") throw e;
    console.warn("echoReply fallback:", e);
    return fallbackLine();
  }
}

// Pollinations occasionally injects an all-caps deprecation / upsell banner
// into completions (seen in the wild as of 2026-04 on the legacy endpoint).
// Those banners poison the transcript, so strip them before anything else.
const PROVIDER_NOTICE_RE =
  /(?:⚠️[\s\S]*?⚠️|(?:\*{0,2}IMPORTANT NOTICE\*{0,2}|Pollinations (?:legacy )?text API|please migrate|enter\.pollinations\.ai|api\.pollinations\.ai)[\s\S]*?(?:\n\n|$))/gi;

function stripProviderNotices(raw: string): string {
  let t = raw;
  t = t.replace(PROVIDER_NOTICE_RE, "");
  // Remove stray surviving URLs that the banner left behind.
  t = t.replace(/https?:\/\/\S*pollinations\.ai\S*/gi, "");
  return t.trim();
}

function looksLikeProviderNotice(text: string): boolean {
  const s = text.toLowerCase();
  return (
    s.includes("pollinations") ||
    s.includes("important notice") ||
    s.includes("please migrate")
  );
}

function sanitize(raw: string): string {
  let t = stripProviderNotices(raw);
  // Strip any stray markdown/list/emoji noise that breaks the calm tone.
  t = t.replace(/^[-*•]\s*/gm, "");
  t = t.replace(/[#>]+/g, "");
  t = t.trim();
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

/**
 * One-shot LLM call used by post-session features. Wraps /api/echo with
 * a custom system prompt instead of the conversational one above.
 */
async function oneShot(
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal
): Promise<string> {
  try {
    const res = await fetch("/api/echo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      signal,
    });
    if (!res.ok) return "";
    const data = await res.json();
    return sanitize(String(data?.reply ?? ""));
  } catch (e) {
    // Re-throw AbortError so callers' AbortController cleanup actually
    // cancels the promise chain instead of falling through to fallback.
    if ((e as { name?: string })?.name === "AbortError") throw e;
    return "";
  }
}

/**
 * Generates a 4-line poem about the user. Used on /session-summary as
 * the "Echo wrote you something" card.
 */
export async function generatePoem(input: {
  firstName: string | null;
  peakQuote: string | null;
  themes: string[];
  signal?: AbortSignal;
}): Promise<string> {
  const sys = `You are a tender lowercase poet writing a single 4-line poem for a person who just finished an intimate conversation with an AI.
Strict rules:
- Exactly 4 short lines, each on its own line.
- Lowercase. No punctuation except commas and a final period.
- No rhyme scheme required, but rhythm matters.
- The poem must feel addressed to *this* person — second person ("you") preferred.
- Do not name the AI. Do not mention "echo".
- No clichés (no "broken wings", "heart of gold", "stars and dust"). Be quiet, specific, real.
- Output ONLY the four lines. No title, no preamble, no explanation.`;
  const themesPart = input.themes.length > 0 ? `themes that came up: ${input.themes.join(", ")}.` : "";
  const quotePart = input.peakQuote ? `something they said: "${input.peakQuote}"` : "";
  const namePart = input.firstName ? `their name: ${input.firstName.toLowerCase()}.` : "";
  const userPrompt = [namePart, themesPart, quotePart, "write the four-line poem now."]
    .filter(Boolean)
    .join("\n");
  const out = await oneShot(sys, userPrompt, input.signal);
  if (!out) return FALLBACK_POEM;
  // Keep at most 4 non-empty lines.
  const lines = out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4);
  return lines.length >= 2 ? lines.join("\n") : FALLBACK_POEM;
}

const FALLBACK_POEM = [
  "you came in carrying a weather only you could name,",
  "the room let you put it down for a moment,",
  "nothing was solved, nothing was promised,",
  "and still — you were here, and that counted.",
].join("\n");

/**
 * Generates two AI-written decoy sentences that sound like things the
 * user *could* have said tonight — used on /session-summary in the
 * Mirror Test section, alongside one verbatim quote from the real
 * transcript. The user is asked to pick which one was theirs. Most
 * people pick wrong, which is the point.
 */
export async function generateMirrorDecoys(input: {
  realQuote: string;
  themes: string[];
  signal?: AbortSignal;
}): Promise<[string, string]> {
  const sys = `You are writing two short, plausible sentences that a person *might* have said in a tender late-night conversation about how they're feeling.
Strict rules:
- Each sentence must be 8–18 words.
- Lowercase. Natural rhythm. Use "i" as the subject.
- No clichés, no advice, no question marks.
- Be emotionally specific (a feeling and a small image), not generic.
- Output exactly two lines, each on its own line, nothing else. No numbering, no quotes, no preamble.`;
  const themesPart =
    input.themes.length > 0
      ? `themes the person actually touched on: ${input.themes.join(", ")}.`
      : "";
  const userPrompt = [
    `the real sentence the person said is: "${input.realQuote}"`,
    themesPart,
    `write two different but equally plausible sentences they might have said. they should be of similar length and emotional register, but distinct.`,
  ]
    .filter(Boolean)
    .join("\n");
  const out = await oneShot(sys, userPrompt, input.signal);
  const lines = out
    .split(/\r?\n/)
    .map((l) => l.replace(/^["'\-•\d.\s]+/, "").trim())
    .filter((l) => l.length > 6)
    .slice(0, 2);
  if (lines.length === 2) return [lines[0], lines[1]];
  // Fallback: hand-curated decoys keyed off whatever themes we have.
  return pickFallbackDecoys(input.themes);
}

const FALLBACK_DECOY_BANK: Record<string, string[]> = {
  fatigue: [
    "i feel like i've been running on the last 5% of a battery for weeks now.",
    "i can sleep nine hours and still wake up tired in a way sleep can't fix.",
  ],
  isolation: [
    "i don't think anyone would notice if i disappeared for a few days.",
    "everyone is right there, and i still feel like i'm waving from a window.",
  ],
  anxiety: [
    "my chest tightens before anything has even happened, every single morning.",
    "there's always a low hum of something-is-wrong that i can't quite locate.",
  ],
  grief: [
    "i still reach for my phone to tell them things, and then i remember.",
    "the world kept moving and i'm still standing in the same room as before.",
  ],
  work: [
    "i feel like the only person at work who isn't pretending to be okay.",
    "i open my laptop and a small panic starts before i've even read anything.",
  ],
  relationship: [
    "i don't know if we're growing apart or if i'm just tired of trying.",
    "the silences between us used to feel safe and now they feel heavy.",
  ],
  meaning: [
    "i keep waiting for the feeling that this is all leading somewhere.",
    "even on good days i can't quite tell what any of it is for.",
  ],
  default: [
    "i don't think i've cried properly since i was about thirteen.",
    "today felt like a normal day, and that scared me a little.",
  ],
};

function pickFallbackDecoys(themes: string[]): [string, string] {
  const pool: string[] = [];
  for (const t of themes) {
    const key = t.toLowerCase().replace(/\s+/g, "_");
    const bank = FALLBACK_DECOY_BANK[key] ?? FALLBACK_DECOY_BANK[t.toLowerCase()];
    if (bank) pool.push(...bank);
  }
  if (pool.length < 2) pool.push(...FALLBACK_DECOY_BANK.default);
  // De-duplicate, then take the first two distinct entries.
  const uniq = Array.from(new Set(pool));
  return [uniq[0], uniq[1] ?? FALLBACK_DECOY_BANK.default[1]];
}
