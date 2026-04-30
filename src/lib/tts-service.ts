"use client";

import type { Lang } from "./i18n";

/**
 * Client-side ElevenLabs TTS playback.
 *
 * Responsibilities:
 *   1. POST to /api/tts with `{ text, voiceId, lang }`.
 *   2. Cache the resulting MP3 as a Blob URL so identical phrases
 *      replay instantly without round-tripping the server.
 *   3. Deduplicate concurrent requests for the same `(text, voiceId,
 *      lang)` triple — two `speak("hello")` calls fired back-to-back
 *      share a single API call.
 *   4. Manage a single shared `<audio>` element so a new utterance
 *      automatically interrupts the previous one (Echo never speaks
 *      over herself).
 *   5. Expose a `cancel()` and a global `stopAllSpeech()` so the
 *      session page can tear playback down on navigation.
 *
 * Deliberately NOT included:
 *   - speechSynthesis fallback (the user removed that path entirely).
 *   - persona pitch/rate (ElevenLabs handles inflection — it's not a
 *     local synthesiser).
 */

type SpeakOpts = {
  voiceId: string;
  lang: Lang;
  /** Fired when the audio finishes playing (or fails / is cancelled). */
  onEnd?: () => void;
  /** Fired the moment the audio actually starts playing — useful for
   *  flipping a UI "speaking" indicator on. */
  onStart?: () => void;
  /** Optional AbortSignal to cancel the request mid-flight. */
  signal?: AbortSignal;
};

/** What we keep per cached utterance. */
type CacheEntry = {
  url: string;
  bytes: number;
};

// Browser-side blob URL cache. Up to MAX_CACHE most-recent entries.
// We revoke `URL.createObjectURL` on eviction to keep memory bounded.
const MAX_CACHE = 60;
const blobCache = new Map<string, CacheEntry>();

// In-flight dedupe: while a request for `key` is in flight, all
// callers asking for the same key wait on this promise instead of
// firing duplicate fetches.
const inflight = new Map<string, Promise<string>>();

// Single shared audio element. We reuse one tag so memory stays flat
// over a long session and so starting a new utterance trivially
// interrupts the old one.
let sharedAudio: HTMLAudioElement | null = null;

// Module-level set of active "settle" callbacks — used by
// `stopAllSpeech()` to fire onEnd for every in-flight or playing
// utterance the moment a teardown happens.
const liveSettlers = new Set<() => void>();

function ensureAudio(): HTMLAudioElement {
  if (sharedAudio) return sharedAudio;
  const a = new Audio();
  a.preload = "auto";
  // Critical for autoplay on first interaction in some browsers —
  // we never want a controlled-volume bar showing in the corner.
  a.controls = false;
  sharedAudio = a;
  return a;
}

function cacheKey(text: string, voiceId: string, lang: Lang): string {
  return `${voiceId}\u0000${lang}\u0000${text}`;
}

function cacheGet(key: string): CacheEntry | null {
  const hit = blobCache.get(key);
  if (!hit) return null;
  // LRU touch.
  blobCache.delete(key);
  blobCache.set(key, hit);
  return hit;
}

function cacheSet(key: string, entry: CacheEntry) {
  if (blobCache.has(key)) blobCache.delete(key);
  blobCache.set(key, entry);
  while (blobCache.size > MAX_CACHE) {
    const oldestKey = blobCache.keys().next().value;
    if (oldestKey === undefined) break;
    const oldest = blobCache.get(oldestKey);
    blobCache.delete(oldestKey);
    if (oldest) {
      try {
        URL.revokeObjectURL(oldest.url);
      } catch {
        /* ignore */
      }
    }
  }
}

/** Fetch a blob URL for the given utterance. Caches and dedupes. */
async function getBlobUrl(
  text: string,
  voiceId: string,
  lang: Lang,
  signal?: AbortSignal
): Promise<string> {
  const key = cacheKey(text, voiceId, lang);

  const cached = cacheGet(key);
  if (cached) return cached.url;

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceId, lang }),
      signal,
    });
    if (!res.ok) {
      let detail = `${res.status}`;
      try {
        const j = await res.json();
        if (j && typeof j.reason === "string") detail = j.reason;
      } catch {
        /* ignore */
      }
      throw new Error(`tts-failed:${detail}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    cacheSet(key, { url, bytes: blob.size });
    return url;
  })();

  inflight.set(key, p);
  try {
    const url = await p;
    return url;
  } finally {
    inflight.delete(key);
  }
}

/**
 * Speak `text` aloud. Returns a `cancel` function that aborts the
 * request and pauses playback if it has started. The promise
 * resolves when the audio finishes naturally (or is cancelled, or
 * fails — `onEnd` always fires exactly once either way).
 */
export function ttsSpeak(text: string, opts: SpeakOpts): () => void {
  if (typeof window === "undefined" || !text.trim()) {
    opts.onEnd?.();
    return () => {};
  }

  const ac = new AbortController();
  let cancelled = false;
  let settled = false;

  const settle = () => {
    if (settled) return;
    settled = true;
    liveSettlers.delete(settle);
    opts.onEnd?.();
  };
  liveSettlers.add(settle);

  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    try {
      ac.abort();
    } catch {
      /* ignore */
    }
    if (sharedAudio) {
      try {
        sharedAudio.pause();
        sharedAudio.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    settle();
  };

  // Kick off the fetch + playback chain.
  (async () => {
    try {
      // Stop any currently-playing utterance so a new speak() always
      // takes priority. This keeps Echo from cross-talking herself.
      if (sharedAudio && !sharedAudio.paused) {
        try {
          sharedAudio.pause();
          sharedAudio.currentTime = 0;
        } catch {
          /* ignore */
        }
      }

      const url = await getBlobUrl(text, opts.voiceId, opts.lang, ac.signal);
      if (cancelled) return;

      const audio = ensureAudio();
      audio.src = url;

      const cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
        audio.onplay = null;
      };

      audio.onplay = () => {
        if (cancelled) return;
        opts.onStart?.();
      };
      audio.onended = () => {
        cleanup();
        settle();
      };
      audio.onerror = () => {
        cleanup();
        settle();
      };

      try {
        await audio.play();
      } catch {
        // Autoplay blocked or aborted — settle so the caller can keep
        // its conversation loop going.
        cleanup();
        settle();
      }
    } catch {
      settle();
    }
  })();

  return cancel;
}

/** Hard-stop every in-flight or playing utterance. Mirrors the old
 *  `stopSpeaking()` that the session page already calls on teardown. */
export function stopAllSpeech() {
  if (typeof window === "undefined") return;
  if (sharedAudio && !sharedAudio.paused) {
    try {
      sharedAudio.pause();
      sharedAudio.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
  for (const s of Array.from(liveSettlers)) s();
}

/** Pre-warm a single utterance so the first replay is instant. Used
 *  by the persona/voice picker to preload a sample line. */
export async function ttsPrefetch(
  text: string,
  voiceId: string,
  lang: Lang
): Promise<void> {
  try {
    await getBlobUrl(text, voiceId, lang);
  } catch {
    /* swallow — prefetch is best-effort */
  }
}

/** Create the shared `<audio>` element synchronously. On iOS Safari
 *  the first `new Audio()` has to happen inside a user-gesture
 *  handler or subsequent `audio.play()` calls are rejected — and
 *  since `ttsSpeak()` does its `new Audio()` after an `await`, it
 *  lives outside the gesture by the time it runs. Call this from
 *  the synchronous part of a click handler (e.g. the picker card
 *  onClick) and the first preview plays cleanly instead of
 *  silently failing the first time. */
export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  ensureAudio();
}
