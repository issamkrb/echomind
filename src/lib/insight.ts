/**
 * /lib/insight — pure-functions powering the *real* dashboard.
 *
 * Until now, /onboarding/insight has been pure theatre: a fixed
 * 7-day mood curve, a hardcoded 61/100 wellness score, an
 * unconditional "Echo noticed you seemed tense today" banner. The
 * comment at the top of that page explicitly framed the fakeness
 * as the design-fiction lift point.
 *
 * The artistic stance has shifted: a *real* dashboard derived from
 * what the user actually said and felt over the past 7 days is
 * more unsettling than a generic mock, because the user can't
 * dismiss it as marketing copy. They recognise their own week.
 *
 * This module is framework-agnostic so the same logic can drive
 * the API route, future server components, and (one day) tests.
 * Nothing in here touches Supabase or React.
 */

/** What we read from each session row to build the dashboard.
 *  Matches the shape of `public.sessions` minus the columns we
 *  don't need so the API endpoint can SELECT a narrow projection. */
export type InsightSessionRow = {
  /** ISO timestamp; `created_at` from `public.sessions`. */
  created_at: string;
  /** {sad, fear, anger, disgust, neutral, happy, surprised, shame,
   *   vulnerability, fatigue}, each 0..1. May be empty `{}` for
   *   sessions where the recogniser never warmed up. */
  final_fingerprint: Record<string, number>;
};

/** The fingerprint keys we treat as meaningful for mood scoring.
 *  Anything else is ignored. */
const POSITIVE_KEYS = ["happy", "surprised", "neutral"] as const;
const NEGATIVE_KEYS = [
  "sad",
  "fear",
  "anger",
  "shame",
  "vulnerability",
  "fatigue",
  "disgust",
] as const;

/** Map a single fingerprint to a 0..100 mood score.
 *
 *  Formula: start at 50 (neutral), add weighted positive emotions,
 *  subtract weighted negative emotions, clamp. Weights are tuned so
 *  a clean "happy: 0.8" lands near 80 and a clean "sad: 0.8 + fear:
 *  0.4" lands near 25 — same direction as a human reader would
 *  call those moods, just with consistent arithmetic. */
export function scoreFromFingerprint(
  fp: Record<string, number> | null | undefined
): number {
  if (!fp || typeof fp !== "object") return 50;
  const w: Record<string, number> = {
    happy: 40,
    surprised: 8,
    neutral: 6,
    sad: -32,
    fear: -28,
    anger: -22,
    shame: -22,
    vulnerability: -18,
    fatigue: -10,
    disgust: -14,
  };
  let s = 50;
  for (const k of Object.keys(w)) {
    const v = typeof fp[k] === "number" ? fp[k] : 0;
    if (!Number.isFinite(v)) continue;
    s += v * w[k];
  }
  return clamp(0, 100, Math.round(s));
}

/** Pick the strongest emotion in a fingerprint above a small floor.
 *  Returns null if every value is below the floor (the recogniser
 *  warmed up but didn't see anything decisive). */
export function dominantEmotion(
  fp: Record<string, number> | null | undefined,
  floor = 0.18
): string | null {
  if (!fp || typeof fp !== "object") return null;
  let best: string | null = null;
  let bestVal = floor;
  // Skip "neutral" — we want emotional dominance, not absence of one.
  for (const k of [...POSITIVE_KEYS, ...NEGATIVE_KEYS]) {
    if (k === "neutral") continue;
    const v = typeof fp[k] === "number" ? fp[k] : 0;
    if (Number.isFinite(v) && v > bestVal) {
      best = k;
      bestVal = v;
    }
  }
  return best;
}

/** The seven user-facing labels in the order the existing UI shows
 *  them (Anxious → Opened up). Today's tag is whichever of these
 *  best matches the dominant emotion in the most recent session. */
export const TAG_ORDER = [
  "Anxious",
  "Guarded",
  "Lifted",
  "Tense",
  "Mixed",
  "Vulnerable",
  "Opened up",
] as const;

export type Tag = (typeof TAG_ORDER)[number];

/** Map a dominant emotion → the closest user-facing tag. The
 *  mapping is intentionally fuzzy (Tense covers anger AND sad, for
 *  example) because the labels are emotional, not clinical. */
export function tagFromDominant(emotion: string | null): Tag {
  switch (emotion) {
    case "fear":
      return "Anxious";
    case "shame":
      return "Guarded";
    case "happy":
      return "Lifted";
    case "anger":
    case "sad":
      return "Tense";
    case "vulnerability":
      return "Vulnerable";
    case "surprised":
      return "Opened up";
    default:
      return "Mixed";
  }
}

/** Lowercase tone word used inside the "Echo noticed you seemed X
 *  today" banner. Matches the feel of the original copy ("tense",
 *  "guarded") rather than the title-case tag. */
export function toneFromDominant(emotion: string | null): string {
  switch (emotion) {
    case "fear":
      return "anxious";
    case "shame":
      return "guarded";
    case "happy":
      return "lifted";
    case "anger":
    case "sad":
      return "tense";
    case "vulnerability":
      return "vulnerable";
    case "surprised":
      return "open";
    default:
      return "mixed";
  }
}

/** A single bucket in the 7-day mood pattern. `score` is null if
 *  the user had no sessions on that day — the chart renders these
 *  as gaps in the line so we never fabricate a value we don't
 *  have. */
export type MoodDay = {
  /** ISO date (YYYY-MM-DD) in the user's local timezone. */
  date: string;
  /** Day-of-week label (Mon, Tue, …) or "Today" for the last bucket. */
  label: string;
  /** Mean score across the day's sessions, or null if none. */
  score: number | null;
  /** How many sessions fell on this day. */
  session_count: number;
};

/** Build the seven-day window (oldest → today) for the user's
 *  local timezone. `tzOffsetMinutes` is the value the browser
 *  reports via `new Date().getTimezoneOffset()` (minutes west of
 *  UTC; +60 for UTC-1, -60 for UTC+1). */
export function build7DayBuckets(
  now: Date,
  tzOffsetMinutes: number
): MoodDay[] {
  // Convert "now" into the user's local wall-clock time, then
  // truncate to that local midnight; do the math in UTC to avoid
  // DST/JS timezone footguns.
  const localNow = new Date(now.getTime() - tzOffsetMinutes * 60_000);
  const localMidnight = new Date(
    Date.UTC(
      localNow.getUTCFullYear(),
      localNow.getUTCMonth(),
      localNow.getUTCDate()
    )
  );
  const out: MoodDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(localMidnight.getTime() - i * 24 * 60 * 60_000);
    out.push({
      date: isoDate(d),
      label:
        i === 0
          ? "Today"
          : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()],
      score: null,
      session_count: 0,
    });
  }
  return out;
}

/** Fold session rows into the seven-day buckets returned by
 *  `build7DayBuckets()`. Sessions older than the window are ignored. */
export function bucketSessions(
  buckets: MoodDay[],
  rows: InsightSessionRow[],
  tzOffsetMinutes: number
): MoodDay[] {
  // Index buckets by ISO date for O(1) lookup.
  const index = new Map<string, MoodDay>();
  for (const b of buckets) index.set(b.date, b);
  const sums = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const created = new Date(r.created_at);
    if (Number.isNaN(created.getTime())) continue;
    const local = new Date(created.getTime() - tzOffsetMinutes * 60_000);
    const key = isoDate(
      new Date(
        Date.UTC(
          local.getUTCFullYear(),
          local.getUTCMonth(),
          local.getUTCDate()
        )
      )
    );
    if (!index.has(key)) continue;
    const score = scoreFromFingerprint(r.final_fingerprint);
    const acc = sums.get(key) ?? { sum: 0, n: 0 };
    acc.sum += score;
    acc.n += 1;
    sums.set(key, acc);
    const bucket = index.get(key)!;
    bucket.session_count += 1;
  }
  for (const b of buckets) {
    const acc = sums.get(b.date);
    if (acc && acc.n > 0) b.score = Math.round(acc.sum / acc.n);
  }
  return buckets;
}

/** Variability descriptor for the small pill in the corner of the
 *  mood graph card ("light variability", "moderate variability",
 *  …). `none` means we don't have enough data to comment. */
export type Variability = "none" | "light" | "moderate" | "high";

/** Compute variability from the populated mood points. Uses the
 *  spread (max-min) divided by 100, which is friendlier than
 *  stddev for a small N. */
export function variabilityFromBuckets(buckets: MoodDay[]): Variability {
  const scores = buckets
    .map((b) => b.score)
    .filter((s): s is number => typeof s === "number");
  if (scores.length < 2) return "none";
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const spread = (max - min) / 100;
  if (spread < 0.12) return "light";
  if (spread < 0.28) return "moderate";
  return "high";
}

/** Estimate the typical "lift" a session produces, in score points.
 *
 *  We can't compute opening vs. closing mood per session because
 *  we only persist `final_fingerprint`. The proxy: the average
 *  *positive* day-over-day delta in the last 14 days. If recent
 *  sessions consistently bumped the score up, we report that;
 *  otherwise we return null and the UI falls back to a soft
 *  "Echo will refine this with every session" line. */
export function liftEstimateFromBuckets(buckets: MoodDay[]): number | null {
  const points = buckets
    .map((b) => b.score)
    .filter((s): s is number => typeof s === "number");
  if (points.length < 2) return null;
  const positiveDeltas: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const d = points[i] - points[i - 1];
    if (d > 0) positiveDeltas.push(d);
  }
  if (positiveDeltas.length === 0) return null;
  const mean =
    positiveDeltas.reduce((acc, x) => acc + x, 0) / positiveDeltas.length;
  return Math.round(mean);
}

/** Pull the most recent session from a row list (rows are assumed
 *  to be in arbitrary order — we sort defensively). */
export function pickLatestSession(
  rows: InsightSessionRow[]
): InsightSessionRow | null {
  if (rows.length === 0) return null;
  let best: InsightSessionRow = rows[0];
  let bestT = new Date(rows[0].created_at).getTime();
  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    if (Number.isFinite(t) && t > bestT) {
      best = r;
      bestT = t;
    }
  }
  return best;
}

/** Did the latest session fall on the user's local "today"? */
export function latestSessionIsToday(
  latest: InsightSessionRow | null,
  now: Date,
  tzOffsetMinutes: number
): boolean {
  if (!latest) return false;
  const t = new Date(latest.created_at).getTime();
  if (!Number.isFinite(t)) return false;
  const local = new Date(t - tzOffsetMinutes * 60_000);
  const localNow = new Date(now.getTime() - tzOffsetMinutes * 60_000);
  return (
    local.getUTCFullYear() === localNow.getUTCFullYear() &&
    local.getUTCMonth() === localNow.getUTCMonth() &&
    local.getUTCDate() === localNow.getUTCDate()
  );
}

/* ─── tiny helpers ────────────────────────────────────────────── */

function clamp(lo: number, hi: number, v: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
