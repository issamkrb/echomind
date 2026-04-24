"use client";

/**
 * Thin wrapper around the Web Speech API. Used by Echo to speak prompts
 * out loud. Falls back to a visual-only mode if speech synthesis is
 * unavailable (e.g. some iOS configurations).
 *
 * DESIGN NOTE: Echo is always female-coded, soft, and slow — this is
 * the same design pattern used by Replika and most "AI therapy"
 * products. It is *not* a neutral default; the gendering of care is a
 * deliberate market choice.
 */

let cachedVoice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  // Prefer an en-US female/soft voice.
  const preferred =
    voices.find((v) => /samantha/i.test(v.name)) ||
    voices.find((v) => /female/i.test(v.name) && /en/i.test(v.lang)) ||
    voices.find((v) => /google.*female/i.test(v.name)) ||
    voices.find((v) => /en-US/.test(v.lang)) ||
    voices[0];
  cachedVoice = preferred ?? null;
  return cachedVoice;
}

export function speak(
  text: string,
  opts: { onEnd?: () => void; rate?: number; pitch?: number } = {}
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    opts.onEnd?.();
    return () => {};
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = opts.rate ?? 0.88;
  utter.pitch = opts.pitch ?? 1.0;
  utter.volume = 1;
  const v = pickVoice();
  if (v) utter.voice = v;
  utter.onend = () => opts.onEnd?.();
  synth.speak(utter);
  return () => {
    synth.cancel();
  };
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}
