"use client";

import { scopedKey } from "./account-scope";
import {
  VOICE_CATALOG,
  defaultVoiceId,
  findVoiceById,
  type VoiceOption,
  type VoiceStyle,
} from "./voice-catalog";
import type { Lang } from "./i18n";

/**
 * Voice manager — the single source of truth for "should Echo speak,
 * which voice should she use, and what language is that voice in".
 *
 * Persists to scoped localStorage (per-account, not per-device, see
 * `account-scope.ts`) so:
 *   - Account A picking "Energetic FR" doesn't leak to Account B on
 *     the same browser.
 *   - Signing out wipes the guest bucket, so the next anonymous user
 *     starts fresh.
 *
 * The session page treats `voiceEnabled === false` as "stay silent" —
 * we still render text and run the conversation loop, just without
 * audio. This is the only way for a user to disable TTS entirely.
 */

const ENABLED_BASE_KEY = "voice_enabled";
const VOICE_ID_BASE_KEY = "voice_id";

export type VoiceState = {
  /** Whether to actually speak Echo's responses. Defaults to true. */
  enabled: boolean;
  /** Currently selected ElevenLabs voice id. */
  voiceId: string;
};

/** Load the on/off flag. Defaults to ON (matches the previous Web
 *  Speech behaviour where Echo always spoke). */
export function loadVoiceEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(scopedKey(ENABLED_BASE_KEY));
    if (v === null) return true;
    return v === "1";
  } catch {
    return true;
  }
}

export function saveVoiceEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      scopedKey(ENABLED_BASE_KEY),
      enabled ? "1" : "0"
    );
    notifyChange();
  } catch {
    /* ignore */
  }
}

/** Load the user's chosen voice id, or null if they've never picked. */
export function loadVoiceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(scopedKey(VOICE_ID_BASE_KEY));
    if (!v) return null;
    // Validate against the catalog so a stale id from a removed voice
    // doesn't poison playback. Fall through to lang default if so.
    return findVoiceById(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveVoiceId(voiceId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(scopedKey(VOICE_ID_BASE_KEY), voiceId);
    notifyChange();
  } catch {
    /* ignore */
  }
}

/** Resolve the voice that should speak right now, given the active
 *  language. If the user has explicitly picked a voice, honour it.
 *  Otherwise fall back to the per-language default. */
export function resolveVoiceId(lang: Lang): string {
  const explicit = loadVoiceId();
  if (explicit) return explicit;
  return defaultVoiceId(lang);
}

/** All voice options for a given language, ordered for the dropdown. */
export function listVoices(lang: Lang): VoiceOption[] {
  return VOICE_CATALOG[lang];
}

/** Find a voice option by id, regardless of language. */
export function getVoiceOption(voiceId: string): VoiceOption | null {
  const found = findVoiceById(voiceId);
  return found ? found.option : null;
}

/** Lightweight in-tab event channel so the VoiceControls UI re-renders
 *  the moment another component mutates voice state (e.g. the lang
 *  picker switching to FR also auto-bumps the voice to the FR
 *  default). */
const listeners = new Set<() => void>();
function notifyChange() {
  for (const l of Array.from(listeners)) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}
export function subscribeVoiceChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export type { VoiceOption, VoiceStyle };
