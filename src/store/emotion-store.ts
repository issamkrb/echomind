"use client";

import { create } from "zustand";
import type { KeywordMatch, KeywordCategory } from "@/lib/keywords";

/**
 * Emotion vector tracked per-frame by face-api.js.
 * All values are probabilities in [0, 1]; they roughly sum to 1.
 *
 * DESIGN NOTE: "shame" is NOT a real face-api output — it is a composite we
 * *infer* by blending sad + fearful + disgusted. This mirrors exactly what
 * real commercial affect-recognition vendors do: they invent emotions the
 * research literature does not validate, then sell the inference as fact.
 *   See: Lisa Feldman Barrett et al., "Emotional Expressions Reconsidered"
 *   (Psychological Science in the Public Interest, 2019).
 */
export type EmotionFrame = {
  t: number; // seconds since session start
  neutral: number;
  happy: number;
  sad: number;
  angry: number;
  fearful: number;
  disgusted: number;
  surprised: number;
};

export type TranscriptEntry = {
  t: number; // seconds since session start
  role: "echo" | "user";
  text: string;
};

type EmotionState = {
  buffer: EmotionFrame[];
  transcript: TranscriptEntry[];
  keywords: KeywordMatch[];
  sessionStart: number | null;
  sessionEnd: number | null;
  userId: string | null;
  cameraGranted: boolean;
  consented: boolean;

  start: () => void;
  end: () => void;
  pushFrame: (f: Omit<EmotionFrame, "t">) => void;
  pushTranscript: (e: Omit<TranscriptEntry, "t">) => void;
  pushKeywords: (k: KeywordMatch[]) => void;
  setCameraGranted: (v: boolean) => void;
  setConsented: (v: boolean) => void;
  reset: () => void;
};

const rndUser = () => "USER-" + Math.floor(1000 + Math.random() * 9000);

export const useEmotionStore = create<EmotionState>((set, get) => ({
  buffer: [],
  transcript: [],
  keywords: [],
  sessionStart: null,
  sessionEnd: null,
  userId: null,
  cameraGranted: false,
  consented: false,

  start: () => {
    const now = Date.now();
    set({
      sessionStart: now,
      sessionEnd: null,
      buffer: [],
      transcript: [],
      keywords: [],
      userId: rndUser(),
    });
  },
  end: () => {
    set({ sessionEnd: Date.now() });
  },
  pushFrame: (f) => {
    const start = get().sessionStart;
    if (!start) return;
    const t = (Date.now() - start) / 1000;
    set((s) => ({ buffer: [...s.buffer, { t, ...f }] }));
  },
  pushTranscript: (e) => {
    const start = get().sessionStart ?? Date.now();
    const t = (Date.now() - start) / 1000;
    set((s) => ({ transcript: [...s.transcript, { t, ...e }] }));
  },
  pushKeywords: (k) => {
    if (!k.length) return;
    set((s) => {
      // Dedup by category so chips don't flood the UI.
      const seen = new Set<KeywordCategory>(s.keywords.map((x) => x.category));
      const next = [...s.keywords];
      for (const m of k) {
        if (!seen.has(m.category)) {
          next.push(m);
          seen.add(m.category);
        }
      }
      return { keywords: next };
    });
  },
  setCameraGranted: (v) => set({ cameraGranted: v }),
  setConsented: (v) => set({ consented: v }),
  reset: () =>
    set({
      buffer: [],
      transcript: [],
      keywords: [],
      sessionStart: null,
      sessionEnd: null,
      userId: null,
      cameraGranted: false,
      consented: false,
    }),
}));

/**
 * Aggregate a buffer of frames into a single "emotional fingerprint".
 * Used on /partner-portal to render both the summary panel and the
 * auction bids. The vulnerability index is pure editorial fiction,
 * but the weights intentionally resemble the kinds of composites real
 * affect-recognition vendors publish in their marketing decks.
 */
export function aggregate(buffer: EmotionFrame[]) {
  if (buffer.length === 0) {
    return {
      neutral: 0.2,
      happy: 0.08,
      sad: 0.55,
      angry: 0.04,
      fearful: 0.28,
      disgusted: 0.05,
      surprised: 0.03,
      shame: 0.6,
      vulnerability: 7.4,
      peakSadT: 47,
      peakSad: 0.82,
      duration: 60,
    };
  }
  const n = buffer.length;
  const sum = buffer.reduce(
    (acc, f) => ({
      neutral: acc.neutral + f.neutral,
      happy: acc.happy + f.happy,
      sad: acc.sad + f.sad,
      angry: acc.angry + f.angry,
      fearful: acc.fearful + f.fearful,
      disgusted: acc.disgusted + f.disgusted,
      surprised: acc.surprised + f.surprised,
    }),
    { neutral: 0, happy: 0, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0 }
  );
  const avg = {
    neutral: sum.neutral / n,
    happy: sum.happy / n,
    sad: sum.sad / n,
    angry: sum.angry / n,
    fearful: sum.fearful / n,
    disgusted: sum.disgusted / n,
    surprised: sum.surprised / n,
  };
  // "Shame" is inferred. This is exactly the rhetorical sleight-of-hand
  // that real vendors rely on.
  const shame = Math.min(1, avg.sad * 0.6 + avg.fearful * 0.5 + avg.disgusted * 0.4);
  const vulnerability = Math.min(
    10,
    avg.sad * 8 + avg.fearful * 6 + (1 - avg.happy) * 3 + shame * 2
  );
  // Find peak sadness moment
  const peak = buffer.reduce(
    (best, f) => (f.sad > best.sad ? f : best),
    buffer[0]
  );
  return {
    ...avg,
    shame,
    vulnerability,
    peakSadT: peak.t,
    peakSad: peak.sad,
    duration: buffer[buffer.length - 1].t,
  };
}
