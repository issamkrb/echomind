"use client";

/**
 * Echo's voice — now powered exclusively by ElevenLabs (server-side
 * proxy at /api/tts). The previous Web Speech API path has been
 * removed at the user's request: no `speechSynthesis` anywhere.
 *
 * This module preserves the historical `speak()` / `stopSpeaking()` /
 * `warmUpVoices()` surface so the rest of the app (notably
 * `src/app/session/page.tsx`) doesn't need to change. Internally it
 * routes through `tts-service.ts` (network + cache + playback) and
 * `voice-manager.ts` (selected voice id + on/off flag).
 *
 * Behaviour:
 *   - speak(text, opts):  returns a `cancel` function. If voice is
 *                         disabled (`loadVoiceEnabled() === false`),
 *                         it no-ops AND fires onEnd synchronously so
 *                         the conversation loop continues silently.
 *   - stopSpeaking():     hard-stops every in-flight or playing
 *                         utterance.
 *   - warmUpVoices():     no-op kept for source-compat. ElevenLabs
 *                         doesn't need a voice list to be warmed.
 */

import { loadPersonaId, type VoicePersonaId } from "./voice-personas";
import { type Lang } from "./i18n";
import { ttsSpeak, stopAllSpeech } from "./tts-service";
import { loadVoiceEnabled, resolveVoiceId } from "./voice-manager";

export function speak(
  text: string,
  opts: {
    onEnd?: () => void;
    /** Legacy parameter — pitch was a Web Speech concept. ElevenLabs
     *  controls inflection per voice id, so this is ignored. Kept in
     *  the signature for source-compat with the session page. */
    rate?: number;
    pitch?: number;
    /** Legacy parameter — persona is now expressed via `voiceId`
     *  selection in voice-manager. Persona id is logged for debug
     *  but doesn't affect playback. */
    personaId?: VoicePersonaId | null;
    /** Active user-facing language. Decides which voice to fall
     *  back to when the user hasn't explicitly picked one. */
    lang?: Lang;
    /** Optional explicit voice override (used by the persona/voice
     *  preview button so it can audition any voice without mutating
     *  saved state). */
    voiceId?: string;
  } = {}
) {
  if (typeof window === "undefined") {
    opts.onEnd?.();
    return () => {};
  }

  // Voice toggled off → fire onEnd synchronously and stay silent.
  // Important: we still `setTimeout(0)` so the call stack unwinds
  // before onEnd runs — synchronous resolution from inside the
  // session loop's awaited speak() can re-enter the loop in ways
  // some race-sensitive code in /session was never designed for.
  if (!loadVoiceEnabled()) {
    setTimeout(() => opts.onEnd?.(), 0);
    return () => {};
  }

  const lang: Lang = opts.lang ?? "en";
  const voiceId = opts.voiceId ?? resolveVoiceId(lang);

  // Touch persona for legacy debug parity (so we still log which
  // persona was active when something speaks). loadPersonaId() is a
  // pure read; no side effects.
  void (opts.personaId ?? loadPersonaId());

  return ttsSpeak(text, {
    voiceId,
    lang,
    onEnd: opts.onEnd,
  });
}

export function stopSpeaking() {
  stopAllSpeech();
}

/** Kept as a no-op for source compat. The Web Speech API needed an
 *  async voice-list warmup; ElevenLabs doesn't. */
export function warmUpVoices() {
  /* intentionally empty */
}
