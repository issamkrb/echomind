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
