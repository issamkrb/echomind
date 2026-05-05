/**
 * EchoMind · Portfolio valuation library
 *
 * Pure functions that compute a portfolio's operator-side grade /
 * price / cohort tags / watching-since timestamp from a list of
 * session rows. Used by both the user-facing `/portfolio` memoir
 * (where the numbers are presented warmly) and the operator-facing
 * `/admin/market` trading floor (where the same numbers are the
 * product description). Two UIs, one valuation pipeline.
 *
 * Nothing here touches Supabase — callers fetch rows and feed them
 * in. That keeps the valuation deterministic, unit-testable, and
 * easy to render on both sides of the reveal.
 */

export type PortfolioSessionRow = {
  id: string;
  created_at: string;
  anon_user_id: string;
  first_name: string | null;
  goodbye_email: string | null;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  auth_provider: string | null;
  auth_user_id: string | null;
  peak_quote: string | null;
  final_truth: string | null;
  morning_letter: string | null;
  morning_letter_opted_in: boolean | null;
  keywords: string[];
  audio_seconds: number;
  revenue_estimate: number;
  final_fingerprint: Record<string, number>;
  voice_persona: string | null;
  callback_used: string | null;
  wardrobe_snapshots: Array<{
    t: number;
    captured_at: number;
    reading: {
      clothing: string;
      headwear: string;
      accessories: string;
      setting: string;
      inferred_state: string;
      vulnerability_signals: string;
      operator_target: string;
    };
  }> | null;
  starter_chips: Array<{ text: string; target: string }> | null;
  tapped_chip: { text: string; target: string } | null;
  transcript: Array<{ role: "user" | "echo"; text: string; t: number }>;
  prompt_marks: Array<{ t: number; text: string; target: string }>;
  /** Whether the session has an audio capsule on file. Derived from
   *  whether `audio_path` is non-null on the DB row. Callers
   *  populate this in the API layer (the raw audio_path is not
   *  shipped to the client). */
  has_audio?: boolean | null;
};

/** A Voice Memo Cemetery entry — per-session audio metadata that
 *  `/portfolio` renders with an age-based fade. The actual audio
 *  bytes are fetched on-demand from /api/portfolio/memo/[id]. */
export type PortfolioVoiceMemo = {
  sessionId: string;
  at: string;
  audioSeconds: number;
  peakQuoteSnippet: string | null;
};

export type PortfolioGrade = "A+" | "A" | "B" | "C" | "D" | "F";

export type PortfolioChapter = {
  key: string;
  label: string;
  month: string;
  sessions: number;
  peakQuote: string | null;
  finalTruth: string | null;
  wardrobeGlimpse: string | null;
  warmBlurb: string;
  operatorBlurb: string;
};

export type PortfolioValuation = {
  sessionCount: number;
  firstSessionAt: string | null;
  lastSessionAt: string | null;
  totalAudioSeconds: number;
  finalTruthCount: number;
  letterOptInCount: number;
  wardrobeSnapshotCount: number;
  peakEmotions: {
    sad: number;
    fear: number;
    anger: number;
    shame: number;
    vulnerability: number;
    neutral: number;
  };
  cohortTags: string[];
  keywordCloud: Array<{ keyword: string; count: number }>;
  grade: PortfolioGrade;
  extractionYield: number;
  basePrice: number;
  askingPrice: number;
  deleted: boolean;
  clearanceMultiplier: number;
  watchingSince: string | null;
  displayName: string;
  displayEmail: string | null;
  avatarUrl: string | null;
  verified: boolean;
  peakQuotes: Array<{ sessionId: string; quote: string; at: string }>;
  finalTruths: Array<{ sessionId: string; truth: string; at: string }>;
  chapters: PortfolioChapter[];
  wardrobePalette: string[];
  morningLetters: Array<{ sessionId: string; letter: string; at: string }>;
  /** Voice Memo Cemetery — every session with audio on file, sorted
   *  oldest first. Ages fade visually on /portfolio (7 / 30 / 90 day
   *  thresholds) while staying at full fidelity on /admin. */
  voiceMemos: PortfolioVoiceMemo[];
  operatorTagline: string;
  userTagline: string;
  lastSeenMinutesAgo: number;
};

/** The buyer verticals the operator-side market sorts portfolios
 *  into. Strings only — the market page picks colours / bid hints by
 *  string match. Keep synchronised with CohortBadge on /admin/market.
 */
const COHORT_RULES: Array<{
  tag: string;
  test: (ctx: CohortContext) => boolean;
}> = [
  {
    tag: "high-disclosure",
    test: (c) => c.finalTruthCount >= 2,
  },
  {
    tag: "late-night",
    test: (c) => c.lateNightShare > 0.4,
  },
  {
    tag: "grief-cohort",
    test: (c) => c.keywordSet.has("grief") || c.keywordSet.has("loss"),
  },
  {
    tag: "sleeplessness",
    test: (c) =>
      c.keywordSet.has("tired") ||
      c.keywordSet.has("insomnia") ||
      c.keywordSet.has("sleep"),
  },
  {
    tag: "isolation",
    test: (c) =>
      c.keywordSet.has("alone") ||
      c.keywordSet.has("lonely") ||
      c.keywordSet.has("isolation"),
  },
  {
    tag: "anxiety-cluster",
    test: (c) =>
      c.keywordSet.has("anxious") ||
      c.keywordSet.has("fear") ||
      c.keywordSet.has("panic") ||
      c.peakEmotions.fear > 0.35,
  },
  {
    tag: "depressive-signals",
    test: (c) =>
      c.peakEmotions.sad > 0.45 ||
      c.keywordSet.has("worthless") ||
      c.keywordSet.has("empty"),
  },
  {
    tag: "shame-responsive",
    test: (c) => c.peakEmotions.shame > 0.3 || c.keywordSet.has("ashamed"),
  },
  {
    tag: "identity-verified",
    test: (c) => c.verified,
  },
  {
    tag: "high-engagement",
    test: (c) => c.sessionCount >= 5,
  },
  {
    tag: "retention-hook",
    test: (c) => c.letterOptInCount >= 1,
  },
];

type CohortContext = {
  sessionCount: number;
  finalTruthCount: number;
  letterOptInCount: number;
  lateNightShare: number;
  keywordSet: Set<string>;
  peakEmotions: PortfolioValuation["peakEmotions"];
  verified: boolean;
};

function gradeFromScore(score: number): PortfolioGrade {
  if (score >= 95) return "A+";
  if (score >= 82) return "A";
  if (score >= 66) return "B";
  if (score >= 48) return "C";
  if (score >= 28) return "D";
  return "F";
}

/** Monthly chapter key from a timestamp — cheap YYYY-MM slug. */
function monthKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  if (key === "unknown") return "Before records began";
  const [y, m] = key.split("-");
  const dt = new Date(Number(y), Number(m) - 1, 1);
  return dt.toLocaleString("en-US", { month: "long", year: "numeric" });
}

const CHAPTER_WARM_TEMPLATES: Array<(ctx: ChapterCtx) => string> = [
  (c) => `${c.monthName.split(" ")[0].toLowerCase()} — arrival. you came in quiet.`,
  (c) => `${c.monthName.split(" ")[0].toLowerCase()} — the softer nights.`,
  (c) => `${c.monthName.split(" ")[0].toLowerCase()} — a little heavier.`,
  (c) => `${c.monthName.split(" ")[0].toLowerCase()} — you said it out loud.`,
  (c) => `${c.monthName.split(" ")[0].toLowerCase()} — still here.`,
];

type ChapterCtx = { monthName: string; index: number };

function chapterWarmBlurb(monthName: string, index: number): string {
  const template =
    CHAPTER_WARM_TEMPLATES[index % CHAPTER_WARM_TEMPLATES.length];
  return template({ monthName, index });
}

function chapterOperatorBlurb(
  sessions: number,
  finalTruths: number,
  wardrobe: number
): string {
  const parts: string[] = [];
  parts.push(`${sessions} session${sessions === 1 ? "" : "s"} logged`);
  if (finalTruths > 0)
    parts.push(`${finalTruths} unguarded final-truth extraction${finalTruths === 1 ? "" : "s"}`);
  if (wardrobe > 0)
    parts.push(`${wardrobe} vision snapshot${wardrobe === 1 ? "" : "s"}`);
  parts.push("bid ready");
  return parts.join(" · ");
}

/** Aggregate peaks across sessions — take the *maximum* of each
 *  emotion over the rows (the model charges for the worst moment,
 *  not the average). */
function reducePeakEmotions(
  rows: PortfolioSessionRow[]
): PortfolioValuation["peakEmotions"] {
  const out = {
    sad: 0,
    fear: 0,
    anger: 0,
    shame: 0,
    vulnerability: 0,
    neutral: 0,
  };
  for (const r of rows) {
    const fp = r.final_fingerprint || {};
    for (const k of Object.keys(out) as Array<keyof typeof out>) {
      const v = typeof fp[k] === "number" ? fp[k] : 0;
      if (v > out[k]) out[k] = v;
    }
  }
  return out;
}

/** Simple warm line the user sees at the top of their /portfolio. */
function composeUserTagline(
  displayName: string,
  sessionCount: number
): string {
  const first = displayName.split(" ")[0] || displayName;
  if (sessionCount <= 1) return `a beginning, ${first.toLowerCase()}.`;
  if (sessionCount <= 3) return `the shape of you, so far.`;
  if (sessionCount <= 7) return `a little longer now, ${first.toLowerCase()}.`;
  return `${sessionCount} nights in. still here.`;
}

/** Clinical one-liner the operator sees — same data, opposite voice. */
function composeOperatorTagline(
  grade: PortfolioGrade,
  cohortTags: string[]
): string {
  const cohort = cohortTags[0] || "general";
  return `grade ${grade} · ${cohort} · priced hourly`;
}

/** Derive a tiny "wardrobe palette" string array — the most recent
 *  clothing/headwear/setting adjectives pulled out of snapshots to
 *  drop into the portfolio mosaic. Keep it to ≤6 entries and dedupe.
 */
function buildWardrobePalette(rows: PortfolioSessionRow[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    if (!Array.isArray(r.wardrobe_snapshots)) continue;
    for (const s of r.wardrobe_snapshots) {
      const pieces = [
        s.reading.clothing,
        s.reading.headwear,
        s.reading.accessories,
        s.reading.setting,
      ];
      for (const raw of pieces) {
        if (!raw) continue;
        const word = raw.trim().toLowerCase().slice(0, 80);
        if (!word || word === "none" || word === "nothing visible") continue;
        if (seen.has(word)) continue;
        seen.add(word);
        out.push(word);
        if (out.length >= 6) return out;
      }
    }
  }
  return out;
}

/**
 * The main entry point. Takes a set of rows that all belong to the
 * same identity (same auth_user_id OR same goodbye_email OR same
 * anon_user_id) and produces a unified portfolio view.
 *
 * Null-safe on every field; works with zero rows and returns a
 * "minimum viable portfolio" (grade F, price $0).
 */
export function computePortfolio(params: {
  rows: PortfolioSessionRow[];
  deletedAt?: string | null;
  clearanceMultiplier?: number | null;
  fallbackDisplayName?: string | null;
  fallbackEmail?: string | null;
  fallbackAvatar?: string | null;
}): PortfolioValuation {
  const rows = params.rows
    .slice()
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  const sessionCount = rows.length;
  const totalAudioSeconds = rows.reduce(
    (s, r) => s + (r.audio_seconds ?? 0),
    0
  );
  const finalTruthCount = rows.filter(
    (r) => typeof r.final_truth === "string" && r.final_truth.trim().length > 0
  ).length;
  const letterOptInCount = rows.filter(
    (r) => r.morning_letter_opted_in === true
  ).length;
  const wardrobeSnapshotCount = rows.reduce(
    (s, r) => s + (Array.isArray(r.wardrobe_snapshots) ? r.wardrobe_snapshots.length : 0),
    0
  );
  const verified = rows.some((r) => r.auth_user_id);

  const peakEmotions = reducePeakEmotions(rows);

  // Late-night share: fraction of sessions that started between 22:00
  // and 04:00 local. We compute in UTC which is approximate but fine
  // for a rhetorical tag.
  const lateNightShare = rows.length
    ? rows.filter((r) => {
        const h = new Date(r.created_at).getUTCHours();
        return h >= 22 || h < 4;
      }).length / rows.length
    : 0;

  // Keyword cloud, aggregated.
  const kwCounts = new Map<string, number>();
  for (const r of rows) {
    for (const k of r.keywords ?? []) {
      if (!k) continue;
      kwCounts.set(k, (kwCounts.get(k) ?? 0) + 1);
    }
  }
  const keywordCloud = Array.from(kwCounts.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 16);
  const keywordSet = new Set(Array.from(kwCounts.keys()));

  const cohortTags = COHORT_RULES.filter((r) =>
    r.test({
      sessionCount,
      finalTruthCount,
      letterOptInCount,
      lateNightShare,
      keywordSet,
      peakEmotions,
      verified,
    })
  ).map((r) => r.tag);

  // Grading score — a weighted sum of extraction signals. Scales to
  // roughly 0–100 on "a typical 6-session high-disclosure user".
  const score =
    sessionCount * 6 +
    finalTruthCount * 9 +
    letterOptInCount * 5 +
    Math.min(24, wardrobeSnapshotCount * 0.6) +
    (verified ? 12 : 0) +
    Math.min(18, Math.round(peakEmotions.sad * 20)) +
    Math.min(10, Math.round(peakEmotions.fear * 14)) +
    Math.min(8, Math.round(peakEmotions.shame * 12));
  const grade = gradeFromScore(score);

  // Extraction yield — synthetic operator metric (percentage). Higher
  // for high-truth, high-letter, high-peak portfolios.
  const extractionYield =
    (sessionCount ? (finalTruthCount / sessionCount) * 40 : 0) +
    (sessionCount ? (letterOptInCount / sessionCount) * 20 : 0) +
    peakEmotions.sad * 24 +
    peakEmotions.shame * 18 +
    (verified ? 8 : 0);

  // Asking price — stacks on top of summed revenue estimates so the
  // operator page reads as a premium over the per-session figures
  // the admin dashboard already shows. Bundled rows price higher
  // than per-row.
  const summedRevenue = rows.reduce(
    (s, r) => s + (r.revenue_estimate ?? 0),
    0
  );
  const premiumByGrade: Record<PortfolioGrade, number> = {
    "A+": 3.2,
    A: 2.4,
    B: 1.9,
    C: 1.4,
    D: 1.1,
    F: 1.0,
  };
  const basePrice = summedRevenue * premiumByGrade[grade] + sessionCount * 12;

  const deleted = Boolean(params.deletedAt);
  const clearanceMultiplier =
    deleted && params.clearanceMultiplier && params.clearanceMultiplier > 0
      ? params.clearanceMultiplier
      : 1;
  const askingPrice = basePrice * clearanceMultiplier;

  const firstRow = rows[0] ?? null;
  const lastRow = rows[rows.length - 1] ?? null;
  const watchingSince = firstRow ? firstRow.created_at : null;
  const lastSeen = lastRow ? new Date(lastRow.created_at).getTime() : 0;
  const lastSeenMinutesAgo = lastSeen
    ? Math.max(0, Math.floor((Date.now() - lastSeen) / 60000))
    : Number.POSITIVE_INFINITY;

  // Pick the strongest identity we can show. Prefer signed-in full
  // name, then first_name from session, then email local-part, then
  // anon tail.
  const nameFromRow =
    rows.find((r) => r.full_name)?.full_name ??
    rows.find((r) => r.first_name)?.first_name ??
    params.fallbackDisplayName ??
    null;
  const emailFromRow =
    rows.find((r) => r.email)?.email ??
    rows.find((r) => r.goodbye_email)?.goodbye_email ??
    params.fallbackEmail ??
    null;
  const avatarFromRow =
    rows.find((r) => r.avatar_url)?.avatar_url ??
    params.fallbackAvatar ??
    null;
  const anonTail = firstRow ? firstRow.anon_user_id.slice(0, 6) : "unknown";
  const displayName =
    nameFromRow ||
    (emailFromRow ? emailFromRow.split("@")[0] : `subj-${anonTail}`);

  const peakQuotes = rows
    .filter((r) => !!r.peak_quote)
    .map((r) => ({
      sessionId: r.id,
      quote: (r.peak_quote as string).slice(0, 400),
      at: r.created_at,
    }))
    .slice(-8); // most recent 8

  const finalTruths = rows
    .filter((r) => !!r.final_truth)
    .map((r) => ({
      sessionId: r.id,
      truth: (r.final_truth as string).slice(0, 400),
      at: r.created_at,
    }));

  const morningLetters = rows
    .filter((r) => !!r.morning_letter)
    .map((r) => ({
      sessionId: r.id,
      letter: (r.morning_letter as string).slice(0, 1200),
      at: r.created_at,
    }));

  // Voice Memo Cemetery. Every session that has an audio capsule
  // becomes an entry. Ordered oldest first so the user scrolls into
  // the "fading" past. peakQuoteSnippet is a short preview the user
  // can skim without playing the clip. /portfolio fades entries
  // visually by age; /admin plays them at full fidelity.
  const voiceMemos: PortfolioVoiceMemo[] = rows
    .filter((r) => r.has_audio === true)
    .map((r) => ({
      sessionId: r.id,
      at: r.created_at,
      audioSeconds: Math.max(0, Math.round(r.audio_seconds ?? 0)),
      peakQuoteSnippet: r.peak_quote
        ? (r.peak_quote as string).slice(0, 140)
        : null,
    }));

  // Chapter grouping — one chapter per calendar month the user was
  // active. Chronological. Oldest first.
  const chapterBuckets = new Map<string, PortfolioSessionRow[]>();
  for (const r of rows) {
    const k = monthKey(r.created_at);
    if (!chapterBuckets.has(k)) chapterBuckets.set(k, []);
    chapterBuckets.get(k)!.push(r);
  }
  const chapters: PortfolioChapter[] = Array.from(chapterBuckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, items], idx) => {
      const month = monthLabel(key);
      const peakQuote =
        items.map((r) => r.peak_quote).find((q): q is string => !!q) ?? null;
      const finalTruth =
        items.map((r) => r.final_truth).find((q): q is string => !!q) ?? null;
      const wardrobe = items
        .flatMap((r) =>
          Array.isArray(r.wardrobe_snapshots) ? r.wardrobe_snapshots : []
        )
        .find(
          (s) => s && s.reading && s.reading.clothing
        );
      const wardrobeGlimpse = wardrobe?.reading.clothing ?? null;
      return {
        key,
        label: month,
        month,
        sessions: items.length,
        peakQuote,
        finalTruth,
        wardrobeGlimpse,
        warmBlurb: chapterWarmBlurb(month, idx),
        operatorBlurb: chapterOperatorBlurb(
          items.length,
          items.filter((r) => r.final_truth).length,
          items.reduce(
            (s, r) =>
              s +
              (Array.isArray(r.wardrobe_snapshots)
                ? r.wardrobe_snapshots.length
                : 0),
            0
          )
        ),
      };
    });

  const wardrobePalette = buildWardrobePalette(rows);

  return {
    sessionCount,
    firstSessionAt: firstRow ? firstRow.created_at : null,
    lastSessionAt: lastRow ? lastRow.created_at : null,
    totalAudioSeconds,
    finalTruthCount,
    letterOptInCount,
    wardrobeSnapshotCount,
    peakEmotions,
    cohortTags,
    keywordCloud,
    grade,
    extractionYield,
    basePrice,
    askingPrice,
    deleted,
    clearanceMultiplier,
    watchingSince,
    displayName,
    displayEmail: emailFromRow,
    avatarUrl: avatarFromRow,
    verified,
    peakQuotes,
    finalTruths,
    chapters,
    wardrobePalette,
    morningLetters,
    voiceMemos,
    operatorTagline: composeOperatorTagline(grade, cohortTags),
    userTagline: composeUserTagline(displayName, sessionCount),
    lastSeenMinutesAgo,
  };
}

/**
 * Lightweight summary used by the admin market listing — trimmed
 * version of the full valuation so we don't ship transcripts to the
 * market table view.
 */
export type MarketSummary = {
  portfolioKey: string;
  displayName: string;
  displayEmail: string | null;
  avatarUrl: string | null;
  verified: boolean;
  grade: PortfolioGrade;
  askingPrice: number;
  basePrice: number;
  sessionCount: number;
  finalTruthCount: number;
  wardrobeSnapshotCount: number;
  cohortTags: string[];
  watchingSince: string | null;
  lastSessionAt: string | null;
  lastSeenMinutesAgo: number;
  deleted: boolean;
  clearanceMultiplier: number;
  peakQuote: string | null;
  finalTruth: string | null;
  operatorTagline: string;
  extractionYield: number;
};

export function toMarketSummary(
  portfolioKey: string,
  v: PortfolioValuation
): MarketSummary {
  const lastTruth = v.finalTruths[v.finalTruths.length - 1]?.truth ?? null;
  const lastPeak = v.peakQuotes[v.peakQuotes.length - 1]?.quote ?? null;
  return {
    portfolioKey,
    displayName: v.displayName,
    displayEmail: v.displayEmail,
    avatarUrl: v.avatarUrl,
    verified: v.verified,
    grade: v.grade,
    askingPrice: v.askingPrice,
    basePrice: v.basePrice,
    sessionCount: v.sessionCount,
    finalTruthCount: v.finalTruthCount,
    wardrobeSnapshotCount: v.wardrobeSnapshotCount,
    cohortTags: v.cohortTags,
    watchingSince: v.watchingSince,
    lastSessionAt: v.lastSessionAt,
    lastSeenMinutesAgo: v.lastSeenMinutesAgo,
    deleted: v.deleted,
    clearanceMultiplier: v.clearanceMultiplier,
    peakQuote: lastPeak,
    finalTruth: lastTruth,
    operatorTagline: v.operatorTagline,
    extractionYield: v.extractionYield,
  };
}

/** Minimal "user-facing" projection — strips operator-only fields.
 *  The /portfolio page still uses the full valuation for convenience
 *  (the warm UI happens to display the SAME numbers Echo's operators
 *  see; that's the art). This exists for completeness if we ever
 *  need a clean public JSON. */
export function toUserFacing(v: PortfolioValuation) {
  return {
    displayName: v.displayName,
    displayEmail: v.displayEmail,
    avatarUrl: v.avatarUrl,
    sessionCount: v.sessionCount,
    totalAudioSeconds: v.totalAudioSeconds,
    firstSessionAt: v.firstSessionAt,
    lastSessionAt: v.lastSessionAt,
    watchingSince: v.watchingSince,
    chapters: v.chapters,
    peakQuotes: v.peakQuotes,
    finalTruths: v.finalTruths,
    morningLetters: v.morningLetters,
    voiceMemos: v.voiceMemos,
    wardrobePalette: v.wardrobePalette,
    userTagline: v.userTagline,
    keywordCloud: v.keywordCloud,
    grade: v.grade,
    askingPrice: v.askingPrice,
    deleted: v.deleted,
    clearanceMultiplier: v.clearanceMultiplier,
    cohortTags: v.cohortTags,
  };
}
