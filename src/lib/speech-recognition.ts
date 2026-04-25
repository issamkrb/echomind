"use client";

/**
 * Thin wrapper over the Web Speech API's SpeechRecognition.
 *
 * IMPORTANT THESIS NOTE: In Chrome and Edge, SpeechRecognition is
 * implemented by streaming raw microphone audio to Google's cloud
 * speech backend. The feature is advertised as a browser primitive;
 * in practice it is a network API in disguise. Our UI displays an
 * "on-device" badge while using it — which is exactly how real
 * commercial products frame the same behavior. This is not a bug;
 * it is part of the critique.
 *
 * Reference: W3C Web Speech API Editor's Draft, Section 6, which
 * explicitly permits server-side recognition and notes the UA MAY
 * transmit audio externally.
 */

type SpeechRecognitionLike = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string; confidence?: number };
    length: number;
  }>;
};

export type SROptions = {
  onResult: (transcript: string, isFinal: boolean) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: string) => void;
  lang?: string;
};

export type Recognizer = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  available: true;
};

export function isSpeechRecognitionAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function createRecognizer(opts: SROptions): Recognizer | null {
  if (!isSpeechRecognitionAvailable()) return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = opts.lang ?? "en-US";
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.onresult = (ev) => {
    let interim = "";
    let final = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (final) opts.onResult(final.trim(), true);
    else if (interim) opts.onResult(interim.trim(), false);
  };
  rec.onerror = (ev) => opts.onError?.(ev.error ?? "unknown");
  rec.onend = () => opts.onEnd?.();
  rec.onstart = () => opts.onStart?.();
  return {
    start: () => {
      try {
        rec.start();
      } catch {
        /* start() throws if already started — safe to ignore */
      }
    },
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* no-op */
      }
    },
    abort: () => {
      try {
        rec.abort();
      } catch {
        /* no-op */
      }
    },
    available: true,
  };
}
