/**
 * Curated ElevenLabs voice catalog for EchoMind.
 *
 * Each language exposes 4 distinct "styles" — Calm, Soft, Energetic,
 * Professional — mapped to ElevenLabs preset voice IDs from the
 * public library. All four styles per language go through the
 * `eleven_multilingual_v2` model, so the same Rachel/Charlotte/etc.
 * IDs all speak en/fr/ar correctly. We deliberately keep the *style
 * names* identical across languages so users see a consistent set of
 * options regardless of which language they've picked.
 *
 * IDs come from ElevenLabs' built-in voice library and are stable
 * (their docs explicitly call these out as not subject to deletion).
 * If you swap any of these for a custom cloned voice in your account,
 * update the `id` field — the rest of the system keys off `style` so
 * no other code needs to change.
 */

import type { Lang } from "./i18n";

export type VoiceStyle = "calm" | "soft" | "energetic" | "professional";

export type VoiceOption = {
  /** Stable identifier persisted to localStorage. */
  id: string;
  /** Style label shown in the UI dropdown. */
  style: VoiceStyle;
  /** Friendly speaker name (informational, shown as a sublabel). */
  speaker: string;
  /** One-line description in the UI's language. */
  description: string;
};

/** Per-language list of ~4 voices, ordered Calm → Professional so the
 *  default (first) option is the gentlest one — matches Echo's tone. */
export const VOICE_CATALOG: Record<Lang, VoiceOption[]> = {
  en: [
    {
      id: "21m00Tcm4TlvDq8ikWAM",
      style: "calm",
      speaker: "Rachel",
      description: "calm, natural narration",
    },
    {
      id: "EXAVITQu4vr4xnSDxMaL",
      style: "soft",
      speaker: "Bella",
      description: "soft, late-night friend",
    },
    {
      id: "pNInz6obpgDQGcFmaJgB",
      style: "energetic",
      speaker: "Adam",
      description: "warm, present, alive",
    },
    {
      id: "ErXwobaYiN019PkySvjV",
      style: "professional",
      speaker: "Antoni",
      description: "clear, well-rounded",
    },
  ],
  fr: [
    {
      id: "XB0fDUnXU5powFXDhCwa",
      style: "calm",
      speaker: "Charlotte",
      description: "douce et chaleureuse",
    },
    {
      id: "21m00Tcm4TlvDq8ikWAM",
      style: "soft",
      speaker: "Rachel",
      description: "voix calme",
    },
    {
      id: "AZnzlk1XvdvUeBnXmlld",
      style: "energetic",
      speaker: "Domi",
      description: "voix vivante",
    },
    {
      id: "onwK4e9ZLuTAKqWW03F9",
      style: "professional",
      speaker: "Daniel",
      description: "voix posée et claire",
    },
  ],
  ar: [
    {
      id: "EXAVITQu4vr4xnSDxMaL",
      style: "calm",
      speaker: "Bella",
      description: "صوت دافئ وهادئ",
    },
    {
      id: "21m00Tcm4TlvDq8ikWAM",
      style: "soft",
      speaker: "Rachel",
      description: "صوت ناعم",
    },
    {
      id: "ErXwobaYiN019PkySvjV",
      style: "professional",
      speaker: "Antoni",
      description: "صوت واضح ومتزن",
    },
    {
      id: "AZnzlk1XvdvUeBnXmlld",
      style: "energetic",
      speaker: "Domi",
      description: "صوت حيوي",
    },
  ],
};

/** Return true if `voiceId` exists in the catalog for any language —
 *  used by the proxy as a tiny allow-list so a leaked frontend can't
 *  bill arbitrary voice IDs against the account. */
export function isCatalogVoiceId(voiceId: string): boolean {
  for (const lang of Object.keys(VOICE_CATALOG) as Lang[]) {
    if (VOICE_CATALOG[lang].some((v) => v.id === voiceId)) return true;
  }
  return false;
}

/** Default voice id for a language (the first / "calm" option). */
export function defaultVoiceId(lang: Lang): string {
  return VOICE_CATALOG[lang][0].id;
}

/** Look up a voice by id. Returns null if unknown. */
export function findVoiceById(
  voiceId: string
): { lang: Lang; option: VoiceOption } | null {
  for (const lang of Object.keys(VOICE_CATALOG) as Lang[]) {
    const opt = VOICE_CATALOG[lang].find((v) => v.id === voiceId);
    if (opt) return { lang, option: opt };
  }
  return null;
}
