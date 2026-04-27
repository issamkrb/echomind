"use client";

/**
 * Thin wrapper around the Web Speech API. Used by Echo to speak
 * prompts out loud. Falls back to a visual-only mode if speech
 * synthesis is unavailable (e.g. some iOS configurations).
 *
 * DESIGN NOTE: Echo previously hard-coded a single female voice;
 * voice persona selection now lives in `voice-personas.ts`. This
 * module only knows how to *speak*; the picker decides who.
 */

import {
  getPersona,
  loadPersonaId,
  pickVoiceForPersona,
  type VoicePersonaId,
} from "./voice-personas";
import { ttsLocalePrefixesFor, type Lang } from "./i18n";

export function speak(
  text: string,
  opts: {
    onEnd?: () => void;
    rate?: number;
    pitch?: number;
    /** Override the active persona (e.g. when previewing a voice on
     *  the picker before the user has saved their choice). When
     *  omitted we fall back to whatever's in localStorage. */
    personaId?: VoicePersonaId | null;
    /** Active user-facing language. Controls which browser voices
     *  we consider (fr-*, ar-*, en-*). Defaults to English. */
    lang?: Lang;
  } = {}
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    opts.onEnd?.();
    return () => {};
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);

  const persona = getPersona(opts.personaId ?? loadPersonaId());
  utter.rate = opts.rate ?? persona.rate;
  utter.pitch = opts.pitch ?? persona.pitch;
  utter.volume = 1;
  const lang = opts.lang ?? "en";
  const prefixes = ttsLocalePrefixesFor(lang);
  const v = pickVoiceForPersona(persona, prefixes);
  if (v) utter.voice = v;
  // Ensure utter.lang matches even when we couldn't find a matching
  // voice — some TTS engines will route to an appropriate default.
  utter.lang = prefixes[0];

  // Robustness: some browser configurations (headless Chrome, certain
  // iOS states, Chrome-for-Testing without a voice engine) never fire
  // `onend`. Guard with a proportional timeout so the conversation
  // loop can't wedge.
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    opts.onEnd?.();
  };
  const estimated = Math.min(15000, 900 + text.length * 55);
  const timer = setTimeout(finish, estimated);

  utter.onend = () => {
    clearTimeout(timer);
    finish();
  };
  utter.onerror = () => {
    clearTimeout(timer);
    finish();
  };
  synth.speak(utter);
  return () => {
    clearTimeout(timer);
    synth.cancel();
    finish();
  };
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}
