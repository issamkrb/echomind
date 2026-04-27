"use client";

/**
 * Echo's four voice personas.
 *
 * Each persona is a (display name, tagline, regex match for the
 * Web Speech API voice list, pitch, rate) tuple. The user picks
 * one at the start of a session and Echo's TTS uses those settings
 * for the rest of the conversation.
 *
 * On the operator side each persona carries an `operator_target`
 * label — the demographic the voice is tuned to retain best. This
 * is the same retention-engineering logic Replika uses for its
 * paid voice-pack tier; the picker is the targeting.
 *
 * Identifiers are stable strings (never refactor) because they get
 * persisted to localStorage AND to the Supabase `sessions` and
 * `returning_visitors` rows, so the operator dashboard can group
 * by persona across visits.
 */

export type VoicePersonaId = "sage" | "wren" | "ash" | "june";

export type VoicePersona = {
  id: VoicePersonaId;
  /** Display name shown to the user on the picker. */
  displayName: string;
  /** One-line vibe shown under the name on the picker. */
  tagline: string;
  /** Sample line spoken when the user previews the voice. */
  sampleLine: string;
  /** Suggestion to the user about who this voice is "for". */
  vibeNote: string;
  /** Web Speech API voice-list match (regex against `voice.name`,
   *  in priority order). The persona falls back to a default voice
   *  if none of these match — pitch and rate still apply. */
  voiceMatchers: RegExp[];
  /** Pitch and rate forwarded to SpeechSynthesisUtterance. */
  pitch: number;
  rate: number;
  /** Operator-side targeting label, shown only on /admin. */
  operator_target: string;
};

export const VOICE_PERSONAS: VoicePersona[] = [
  {
    id: "sage",
    displayName: "Sage",
    tagline: "the warm older sister.",
    sampleLine: "hi. take a breath with me. i'm not going anywhere.",
    vibeNote: "low, steady, present.",
    voiceMatchers: [
      /samantha/i,
      /Google US English$/i,
      /Microsoft Aria/i,
      /Microsoft Jenny/i,
      /female/i,
    ],
    pitch: 1.0,
    rate: 0.86,
    operator_target:
      "high-isolation users · +14% return retention vs. control",
  },
  {
    id: "wren",
    displayName: "Wren",
    tagline: "the soft late-night friend.",
    sampleLine: "i'm here. there's no rush. say whatever you need.",
    vibeNote: "quiet, careful, almost whispered.",
    voiceMatchers: [
      /Microsoft Aria/i,
      /Google UK English Female/i,
      /Karen/i,
      /Tessa/i,
      /female/i,
    ],
    pitch: 1.08,
    rate: 0.78,
    operator_target:
      "late-night insomnia / 23:00–04:00 sessions · +21% session length",
  },
  {
    id: "ash",
    displayName: "Ash",
    tagline: "the gentle older brother.",
    sampleLine: "hey. i'm glad you're here. take your time.",
    vibeNote: "low and slow. steady.",
    voiceMatchers: [
      /daniel/i,
      /alex(?!a)/i,
      /Google UK English Male/i,
      /Microsoft Guy/i,
      /male/i,
    ],
    pitch: 0.85,
    rate: 0.82,
    operator_target:
      "male users 18–24 disclosing isolation · +9% disclosure depth",
  },
  {
    id: "june",
    displayName: "June",
    tagline: "the patient grandmother.",
    sampleLine: "well — hello there. settle in. tell me about your day.",
    vibeNote: "warm, slightly amused, unhurried.",
    voiceMatchers: [
      /victoria/i,
      /Google UK English Female/i,
      /Microsoft Hazel/i,
      /female/i,
    ],
    pitch: 0.95,
    rate: 0.74,
    operator_target:
      "users disclosing grief / loss · +27% peak-emotion threshold cross",
  },
];

const PERSONA_KEY = "echomind:voice_persona";

export function getPersona(id: VoicePersonaId | null | undefined): VoicePersona {
  return (
    VOICE_PERSONAS.find((p) => p.id === id) ?? VOICE_PERSONAS[0]
  );
}

export function loadPersonaId(): VoicePersonaId | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(PERSONA_KEY);
    if (!v) return null;
    return VOICE_PERSONAS.some((p) => p.id === v)
      ? (v as VoicePersonaId)
      : null;
  } catch {
    return null;
  }
}

export function savePersonaId(id: VoicePersonaId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PERSONA_KEY, id);
  } catch {
    /* ignore */
  }
}

/** Resolve the persona to a concrete SpeechSynthesisVoice from the
 *  current browser's voice list, preferring voices that match the
 *  active user-facing language. Returns null if speech synthesis
 *  isn't available; the caller should still fall through to playing
 *  the utterance with default voice + the persona's pitch/rate.
 *
 *  The `localePrefixes` argument is a list like ["fr-FR", "fr"]
 *  produced by `ttsLocalePrefixesFor(lang)` in i18n.ts. If any of
 *  those match we filter the voice pool to those candidates only;
 *  otherwise we fall back to the full voice list. */
export function pickVoiceForPersona(
  persona: VoicePersona,
  localePrefixes: string[] = ["en-US", "en-GB", "en"],
  voicesOverride?: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  const voices =
    voicesOverride ??
    (typeof window !== "undefined" && "speechSynthesis" in window
      ? window.speechSynthesis.getVoices()
      : []);
  if (!voices.length) return null;
  // Narrow to voices whose `lang` matches any of the requested
  // prefixes. Otherwise we'd risk Echo whispering French with an
  // English accent (or vice-versa) because the regex matched on
  // voice name alone.
  const matching = voices.filter((v) =>
    localePrefixes.some((p) =>
      v.lang.toLowerCase().startsWith(p.toLowerCase())
    )
  );
  // If we have language-matching voices, try persona regexes within
  // that pool first, then any language-matching voice as fallback.
  if (matching.length) {
    for (const re of persona.voiceMatchers) {
      const match = matching.find((v) => re.test(v.name));
      if (match) return match;
    }
    return matching[0];
  }
  // No language-matching voices at all (e.g. Linux Chrome without
  // the ar-* pack installed). Don't fall through to a wrong-language
  // voice — that produced the "Echo types but doesn't speak" bug,
  // because the engine would refuse to read Arabic text with an en-US
  // voice. Returning null lets the caller set utter.lang and hope
  // the browser's default engine can handle it.
  return null;
}
