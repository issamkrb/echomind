"use client";

import { scopedKey } from "./account-scope";

/**
 * Echo's four voice personas — now language-aware.
 *
 * Each persona is one of four archetypes (the warm older sister, the
 * soft late-night friend, the gentle older brother, the patient
 * grandmother). For each of the three site languages (en / fr / ar)
 * the persona carries:
 *
 *   - a display name in that language
 *   - a tagline + vibe note in that language
 *   - a sample line the user hears on preview (in that language)
 *   - a list of voice-name regexes that match the actual
 *     SpeechSynthesis voices that ship with Chrome, Edge, Safari,
 *     and Android for that language
 *
 * This fixes the "Arabic voice over doesn't work" bug: previously
 * the matchers were English-only (Samantha, Microsoft Aria…) so even
 * when the browser had `Microsoft Hoda (ar-EG)` installed, the regex
 * loop missed it, the picker fell through, and Echo went silent.
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

import type { Lang } from "./i18n";

export type VoicePersonaId = "sage" | "wren" | "ash" | "june";

export type PersonaGender = "feminine" | "masculine";

/** Per-language presentation + voice matching for one persona. */
export type PersonaLocale = {
  /** Display name shown to the user on the picker. */
  displayName: string;
  /** One-line vibe shown under the name on the picker. */
  tagline: string;
  /** Sample line spoken when the user previews the voice. */
  sampleLine: string;
  /** Suggestion to the user about who this voice is "for". */
  vibeNote: string;
  /** Web Speech API voice-list match (regex against `voice.name`,
   *  in priority order). The persona falls back to the first voice
   *  that matches the active language if none of these hit — so
   *  even on a Linux box with only `Google العربية` installed we
   *  still produce sound, pitch + rate still apply. */
  voiceMatchers: RegExp[];
};

export type VoicePersona = {
  id: VoicePersonaId;
  /** Gender expression — governs which generic `female` / `male`
   *  fallback regex applies when the named-voice matchers miss. */
  gender: PersonaGender;
  /** Pitch and rate forwarded to SpeechSynthesisUtterance. */
  pitch: number;
  rate: number;
  /** Operator-side targeting label, shown only on /admin. */
  operator_target: string;
  /** Per-language matchers + copy. `ar` uses MSA / الفصحى, `fr`
   *  uses informal tu. */
  i18n: Record<Lang, PersonaLocale>;
};

/** Real Arabic voices that ship with mainstream browsers / OSes,
 *  ordered roughly by quality and coverage. Used across the Arabic
 *  persona matchers so every persona has at least one hit. */
const AR_FEMININE = [
  /Hoda/i, // Microsoft (ar-SA / ar-EG) — ubiquitous on Windows
  /Salma/i, // Microsoft (ar-EG)
  /Zariyah/i, // Microsoft (ar-SA)
  /Amina/i, // Microsoft (ar-DZ)
  /Fatima/i, // Microsoft (ar-AE)
  /Laila/i, // Microsoft (ar-JO / ar-SY)
  /Sana/i, // Microsoft (ar-MA)
  /Google.*(عربي|Arabic|ar)/i,
  /female/i,
];
const AR_MASCULINE = [
  /Maged/i, // Apple (ar-SA) — this is the masculine voice on macOS
  /Tarik/i, // Microsoft (ar-EG)
  /Naayf/i, // Microsoft (ar-SA)
  /Hamed/i, // Microsoft (ar-EG)
  /Jamal/i, // Microsoft (ar-MA)
  /Moaz/i, // Microsoft (ar-SY)
  /Shakir/i, // Microsoft (ar-IQ)
  /Google.*(عربي|Arabic|ar)/i,
  /male/i,
];

/** Real French voices that ship with mainstream browsers / OSes. */
const FR_FEMININE = [
  /Amélie|Amelie/i, // Apple (fr-CA)
  /Audrey/i, // Apple (fr-FR)
  /Aurélie|Aurelie/i, // Apple (fr-FR)
  /Marie/i, // Apple (fr-FR)
  /Julie/i, // Microsoft (fr-FR)
  /Hortense/i, // Microsoft (fr-FR)
  /Denise/i, // Microsoft (fr-FR)
  /Caroline/i, // Microsoft (fr-CA)
  /Google français/i,
  /female/i,
];
const FR_MASCULINE = [
  /Thomas/i, // Apple (fr-FR)
  /Nicolas/i, // Apple (fr-CA)
  /Henri/i, // Microsoft (fr-FR)
  /Paul/i, // Microsoft (fr-FR)
  /Claude/i, // Microsoft (fr-CA)
  /Antoine/i, // Microsoft (fr-FR)
  /Google français/i,
  /male/i,
];

const EN_FEMININE_SAGE = [
  /samantha/i,
  /Google US English$/i,
  /Microsoft Aria/i,
  /Microsoft Jenny/i,
  /female/i,
];
const EN_FEMININE_WREN = [
  /Microsoft Aria/i,
  /Google UK English Female/i,
  /Karen/i,
  /Tessa/i,
  /female/i,
];
const EN_FEMININE_JUNE = [
  /victoria/i,
  /Google UK English Female/i,
  /Microsoft Hazel/i,
  /female/i,
];
const EN_MASCULINE_ASH = [
  /daniel/i,
  /alex(?!a)/i,
  /Google UK English Male/i,
  /Microsoft Guy/i,
  /male/i,
];

export const VOICE_PERSONAS: VoicePersona[] = [
  {
    id: "sage",
    gender: "feminine",
    pitch: 1.0,
    rate: 0.86,
    operator_target:
      "high-isolation users · +14% return retention vs. control",
    i18n: {
      en: {
        displayName: "Sage",
        tagline: "the warm older sister.",
        sampleLine: "hi. take a breath with me. i'm not going anywhere.",
        vibeNote: "low, steady, present.",
        voiceMatchers: EN_FEMININE_SAGE,
      },
      fr: {
        displayName: "Claire",
        tagline: "la grande sœur chaleureuse.",
        sampleLine:
          "salut. respire avec moi. je ne vais nulle part.",
        vibeNote: "basse, posée, présente.",
        voiceMatchers: FR_FEMININE,
      },
      ar: {
        displayName: "هالة",
        tagline: "الأختُ الكبرى الدافئة.",
        sampleLine:
          "مرحبًا. تنفَّسْ معي. لن أذهبَ إلى أيِّ مكان.",
        vibeNote: "هادئةٌ، ثابتةٌ، حاضرة.",
        voiceMatchers: AR_FEMININE,
      },
    },
  },
  {
    id: "wren",
    gender: "feminine",
    pitch: 1.08,
    rate: 0.78,
    operator_target:
      "late-night insomnia / 23:00–04:00 sessions · +21% session length",
    i18n: {
      en: {
        displayName: "Wren",
        tagline: "the soft late-night friend.",
        sampleLine: "i'm here. there's no rush. say whatever you need.",
        vibeNote: "quiet, careful, almost whispered.",
        voiceMatchers: EN_FEMININE_WREN,
      },
      fr: {
        displayName: "Léa",
        tagline: "l'amie douce des nuits tardives.",
        sampleLine:
          "je suis là. rien ne presse. dis-moi ce que tu veux.",
        vibeNote: "douce, attentive, presque chuchotée.",
        voiceMatchers: FR_FEMININE,
      },
      ar: {
        displayName: "نور",
        tagline: "الصديقةُ اللطيفةُ في الليل.",
        sampleLine:
          "أنا هنا. لا عَجَلة. قُلْ ما تشاء.",
        vibeNote: "هادئةٌ، حَذِرةٌ، كالهمس.",
        voiceMatchers: AR_FEMININE,
      },
    },
  },
  {
    id: "ash",
    gender: "masculine",
    pitch: 0.85,
    rate: 0.82,
    operator_target:
      "male users 18–24 disclosing isolation · +9% disclosure depth",
    i18n: {
      en: {
        displayName: "Ash",
        tagline: "the gentle older brother.",
        sampleLine: "hey. i'm glad you're here. take your time.",
        vibeNote: "low and slow. steady.",
        voiceMatchers: EN_MASCULINE_ASH,
      },
      fr: {
        displayName: "Thomas",
        tagline: "le grand frère calme.",
        sampleLine:
          "hé. content que tu sois là. prends ton temps.",
        vibeNote: "grave, posé, stable.",
        voiceMatchers: FR_MASCULINE,
      },
      ar: {
        displayName: "طارق",
        tagline: "الأخُ الأكبرُ الهادئ.",
        sampleLine:
          "أهلاً. يُسعدُني أنَّك هنا. خُذْ وقتَك.",
        vibeNote: "صوتٌ عميقٌ، متمهِّلٌ، ثابت.",
        voiceMatchers: AR_MASCULINE,
      },
    },
  },
  {
    id: "june",
    gender: "feminine",
    pitch: 0.95,
    rate: 0.74,
    operator_target:
      "users disclosing grief / loss · +27% peak-emotion threshold cross",
    i18n: {
      en: {
        displayName: "June",
        tagline: "the patient grandmother.",
        sampleLine: "well — hello there. settle in. tell me about your day.",
        vibeNote: "warm, slightly amused, unhurried.",
        voiceMatchers: EN_FEMININE_JUNE,
      },
      fr: {
        displayName: "Mireille",
        tagline: "la grand-mère patiente.",
        sampleLine:
          "alors — bonjour à toi. installe-toi. raconte-moi ta journée.",
        vibeNote: "chaleureuse, amusée, sans hâte.",
        voiceMatchers: FR_FEMININE,
      },
      ar: {
        displayName: "أمِّي فاطمة",
        tagline: "الجَدَّةُ الصَّبور.",
        sampleLine:
          "أهلاً يا عزيزي. استقرَّ قليلاً. حدِّثني عن يومك.",
        vibeNote: "دافئةٌ، مُتأنِّيةٌ، بلا عَجَلة.",
        voiceMatchers: AR_FEMININE,
      },
    },
  },
];

// Per-account: signing out / switching accounts loses the persona
// pick on purpose — the next user on this device should NOT
// inherit the previous user's chosen voice.
const PERSONA_BASE_KEY = "voice_persona";

export function getPersona(id: VoicePersonaId | null | undefined): VoicePersona {
  return (
    VOICE_PERSONAS.find((p) => p.id === id) ?? VOICE_PERSONAS[0]
  );
}

/** Access the language-specific copy + voice matchers for a persona. */
export function personaLocale(
  persona: VoicePersona,
  lang: Lang
): PersonaLocale {
  return persona.i18n[lang] ?? persona.i18n.en;
}

export function loadPersonaId(): VoicePersonaId | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(scopedKey(PERSONA_BASE_KEY));
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
    window.localStorage.setItem(scopedKey(PERSONA_BASE_KEY), id);
  } catch {
    /* ignore */
  }
}

/** Resolve the persona to a concrete SpeechSynthesisVoice from the
 *  current browser's voice list, preferring voices that match the
 *  active user-facing language. Returns null if speech synthesis
 *  isn't available or no language-matching voice exists; the caller
 *  should still fall through to playing the utterance with the
 *  persona's pitch/rate + `utter.lang` set so the browser's default
 *  engine has a chance to route it.
 *
 *  The `localePrefixes` argument is a list like ["fr-FR", "fr"]
 *  produced by `ttsLocalePrefixesFor(lang)` in i18n.ts. If any of
 *  those match we filter the voice pool to those candidates only
 *  and run the persona's **language-specific** matchers. */
export function pickVoiceForPersona(
  persona: VoicePersona,
  localePrefixes: string[] = ["en-US", "en-GB", "en"],
  voicesOverride?: SpeechSynthesisVoice[],
  lang: Lang = "en"
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
    const matchers = personaLocale(persona, lang).voiceMatchers;
    for (const re of matchers) {
      const match = matching.find((v) => re.test(v.name));
      if (match) return match;
    }
    // Still nothing matched by name? Take the first language-matching
    // voice so at least the user hears audible speech in the correct
    // language rather than silence.
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

/** Does the current browser have ANY voice installed for the given
 *  locale prefixes? Used by the UI to show a "your device has no
 *  Arabic voice installed" diagnostic banner when applicable. */
export function hasVoiceForLocale(
  localePrefixes: string[],
  voicesOverride?: SpeechSynthesisVoice[]
): boolean {
  const voices =
    voicesOverride ??
    (typeof window !== "undefined" && "speechSynthesis" in window
      ? window.speechSynthesis.getVoices()
      : []);
  if (!voices.length) return false;
  return voices.some((v) =>
    localePrefixes.some((p) =>
      v.lang.toLowerCase().startsWith(p.toLowerCase())
    )
  );
}
