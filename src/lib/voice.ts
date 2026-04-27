"use client";

/**
 * Thin wrapper around the Web Speech API. Used by Echo to speak
 * prompts out loud. Falls back to a visual-only mode if speech
 * synthesis is unavailable (e.g. some iOS configurations).
 *
 * DESIGN NOTE: Echo previously hard-coded a single female voice;
 * voice persona selection now lives in `voice-personas.ts`. This
 * module only knows how to *speak*; the picker decides who.
 *
 * Voice loading is async on Chrome/Edge — the first call to
 * `speechSynthesis.getVoices()` immediately after page load returns
 * an empty list. This was the root cause of the "Echo types but
 * doesn't speak" bug for Arabic users: by the time we tried to pick
 * an ar-* voice, the voice list hadn't populated yet and we fell
 * through to a silent default-engine utterance. We now wait for
 * `voiceschanged` (up to 2s) before speaking the very first line.
 */

import {
  getPersona,
  loadPersonaId,
  pickVoiceForPersona,
  type VoicePersonaId,
} from "./voice-personas";
import { ttsLocalePrefixesFor, type Lang } from "./i18n";

/** Wait for the browser's voice list to be populated. Resolves as
 *  soon as `getVoices()` returns a non-empty array, or after
 *  `timeoutMs` if it never does. Safe to call repeatedly — after
 *  the first call the list is cached by the browser. */
async function waitForVoices(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const synth = window.speechSynthesis;
  const immediate = synth.getVoices();
  if (immediate.length) return immediate;
  return new Promise((resolve) => {
    let done = false;
    const finish = (list: SpeechSynthesisVoice[]) => {
      if (done) return;
      done = true;
      resolve(list);
    };
    const handler = () => finish(synth.getVoices());
    synth.addEventListener?.("voiceschanged", handler);
    // Some browsers fire the event on the assigned property only.
    const prev = synth.onvoiceschanged;
    synth.onvoiceschanged = () => {
      prev?.call(synth, new Event("voiceschanged"));
      finish(synth.getVoices());
    };
    // Poll as a last resort — some Chromium variants never fire the
    // event but populate the list after ~200–800ms.
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      const list = synth.getVoices();
      if (list.length) {
        clearInterval(iv);
        finish(list);
      } else if (tries * 150 >= timeoutMs) {
        clearInterval(iv);
        finish([]);
      }
    }, 150);
  });
}

/** Log once per page load which voice was picked for each language,
 *  so the user can see in DevTools why Arabic/French might fall back
 *  to a default engine on a device without native voices. */
const loggedLangs = new Set<Lang>();
function logVoicePick(lang: Lang, voice: SpeechSynthesisVoice | null, pool: SpeechSynthesisVoice[]) {
  if (loggedLangs.has(lang)) return;
  loggedLangs.add(lang);
  // eslint-disable-next-line no-console
  console.info(
    `[echomind/voice] lang=${lang} → picked=${voice ? `${voice.name} (${voice.lang})` : "«none — falling back to default engine»"}  ` +
      `available=[${pool.map((v) => `${v.name}:${v.lang}`).join(", ") || "<empty>"}]`
  );
}

// Module-level registry of pending cancel functions. Every live
// `speak()` call registers its cancel here so the global
// `stopSpeaking()` can tear down speech that hasn't actually started
// yet — e.g. an utterance still waiting on `waitForVoices()` to
// resolve. Without this, cleanup during voice loading lets a stale
// utterance slip through and speak on a dead session.
const pendingCancels = new Set<() => void>();

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

  // Robustness: some browser configurations (headless Chrome, certain
  // iOS states, Chrome-for-Testing without a voice engine) never fire
  // `onend`. Guard with a proportional timeout so the conversation
  // loop can't wedge.
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    synth.cancel();
    finish();
  };

  const finish = () => {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    pendingCancels.delete(cancel);
    opts.onEnd?.();
  };

  pendingCancels.add(cancel);

  const speakNow = (voices: SpeechSynthesisVoice[]) => {
    if (cancelled) return;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const persona = getPersona(opts.personaId ?? loadPersonaId());
    utter.rate = opts.rate ?? persona.rate;
    utter.pitch = opts.pitch ?? persona.pitch;
    utter.volume = 1;
    const lang = opts.lang ?? "en";
    const prefixes = ttsLocalePrefixesFor(lang);
    const v = pickVoiceForPersona(persona, prefixes, voices);
    if (v) utter.voice = v;
    // Ensure utter.lang matches even when we couldn't find a matching
    // voice — some TTS engines will route to an appropriate default.
    utter.lang = prefixes[0];
    logVoicePick(lang, v, voices.filter((vx) => prefixes.some((p) => vx.lang.toLowerCase().startsWith(p.toLowerCase()))));

    const estimated = Math.min(15000, 900 + text.length * 55);
    timer = setTimeout(finish, estimated);

    utter.onend = () => finish();
    utter.onerror = () => finish();
    synth.speak(utter);
  };

  // Wait for voices to populate. If they're already there this
  // resolves synchronously on the next microtask.
  waitForVoices().then(speakNow);

  return cancel;
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  // Cancel any utterances still waiting on `waitForVoices()` so they
  // don't start speaking after the caller has torn the session down.
  // Iterate over a snapshot because each cancel mutates the set.
  for (const c of Array.from(pendingCancels)) c();
}

/** Eagerly warm up the browser's voice list. Call once on page mount
 *  so the first `speak()` after user interaction doesn't hit the
 *  async-empty-list race. Safe to call multiple times. */
export function warmUpVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  void waitForVoices(3000);
}
