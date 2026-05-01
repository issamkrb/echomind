import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { getServerAuthSupabase } from "@/lib/supabase-server";
import {
  build7DayBuckets,
  bucketSessions,
  dominantEmotion,
  latestSessionIsToday,
  liftEstimateFromBuckets,
  pickLatestSession,
  tagFromDominant,
  toneFromDominant,
  variabilityFromBuckets,
  type InsightSessionRow,
  type MoodDay,
  type Variability,
} from "@/lib/insight";

/**
 * GET /api/insight?anon=<uuid>&tz=<minutes>
 *
 * The "Here's what we've already noticed" dashboard endpoint.
 * Replaces the seeded mock data the page used to render with a
 * real read of the past seven days of sessions belonging to the
 * caller — keyed by either their auth identity (if signed in) or
 * their anon_user_id (cookieless visitors).
 *
 * Returns a stable shape regardless of how much data the user
 * has — the page knows how to render an empty / partial week
 * gracefully (gaps in the line, "—" gauge, soft empty banner).
 *
 * Privacy posture: server-side only. Never returns transcripts,
 * peak quotes, or fingerprints — just the aggregated 0..100 mood
 * score per day plus today's tag. The point of the dashboard is
 * the *recognition*, not the raw data.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InsightResponse = {
  ok: true;
  /** True iff at least one session was found in the 7-day window. */
  has_data: boolean;
  /** Total session count across the window (not all-time). */
  session_count: number;
  /** Echo's leading-banner copy, computed server-side from the
   *  latest session. The page just renders it as-is. */
  banner: {
    /** "tense", "lifted", "guarded", … */
    tone: string;
    /** True iff the latest session was today. The page uses this
     *  to choose between "today" and "this week" framings. */
    today: boolean;
  } | null;
  mood: {
    days: MoodDay[];
    variability: Variability;
  };
  wellness: {
    /** 0..100 — average across all sessions in the window. Null if
     *  has_data is false. */
    score: number | null;
    /** Soft estimate of "how much a session lifts you". Null if we
     *  don't have enough data to be honest about it. */
    lift_estimate: number | null;
  };
  /** The seven user-facing tag labels in display order. The last
   *  one (the "Today" slot) is the only one we currently fill from
   *  real data; the rest are kept for the existing visual rhythm
   *  but rendered as muted defaults until per-day tags exist. */
  tags: string[];
};

const DEFAULT_TAG_ORDER = [
  "Anxious",
  "Guarded",
  "Lifted",
  "Tense",
  "Mixed",
  "Vulnerable",
  "Opened up",
];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const anonId = (url.searchParams.get("anon") || "").trim();
  const tzRaw = url.searchParams.get("tz");
  // Browser sends Date.getTimezoneOffset() — minutes WEST of UTC.
  // Default to 0 (UTC) so a missing param still produces a coherent
  // (if slightly off) week.
  const tzOffsetMinutes = Number.isFinite(Number(tzRaw)) ? Number(tzRaw) : 0;

  // Resolve identity: auth_user_id from cookie wins; anon_user_id
  // is the fallback. We accept either so the page works for signed-
  // in and anonymous visitors alike.
  let authUserId: string | null = null;
  const authClient = getServerAuthSupabase();
  if (authClient) {
    try {
      const { data: userData } = await authClient.auth.getUser();
      if (userData.user?.id) authUserId = userData.user.id;
    } catch {
      // best-effort — continue without auth
    }
  }

  if (!supabaseConfigured()) {
    return NextResponse.json(emptyResponse(tzOffsetMinutes));
  }
  const db = getServerSupabase();
  if (!db) {
    return NextResponse.json(emptyResponse(tzOffsetMinutes));
  }

  // Pull the last 14 days of sessions so we have a buffer for the
  // lift-estimate calculation (which compares deltas across the
  // window). We then bucket the most recent 7 for display.
  const since = new Date(Date.now() - 14 * 24 * 60 * 60_000).toISOString();
  let q = db
    .from("sessions")
    .select("created_at, final_fingerprint")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(200);

  // Constrain to this user. If we have an auth id, prefer it; if
  // we have an anon id too, OR them so we catch both pre- and
  // post-sign-in sessions belonging to the same person.
  if (authUserId && anonId) {
    q = q.or(`auth_user_id.eq.${authUserId},anon_user_id.eq.${anonId}`);
  } else if (authUserId) {
    q = q.eq("auth_user_id", authUserId);
  } else if (anonId) {
    q = q.eq("anon_user_id", anonId);
  } else {
    // No identity at all — return the empty shape so the page can
    // render its first-time-visitor state.
    return NextResponse.json(emptyResponse(tzOffsetMinutes));
  }

  const { data, error } = await q;
  if (error) {
    console.warn("[insight] read failed:", error);
    return NextResponse.json(emptyResponse(tzOffsetMinutes));
  }

  const rows: InsightSessionRow[] = (data ?? []).map((r) => ({
    created_at: r.created_at as string,
    final_fingerprint:
      (r.final_fingerprint as Record<string, number>) ?? {},
  }));

  const now = new Date();
  const buckets = bucketSessions(
    build7DayBuckets(now, tzOffsetMinutes),
    rows,
    tzOffsetMinutes
  );
  const variability = variabilityFromBuckets(buckets);
  const lift = liftEstimateFromBuckets(buckets);

  // Wellness score = mean of all in-window day scores we have.
  const populated = buckets.filter(
    (b): b is MoodDay & { score: number } => typeof b.score === "number"
  );
  const score =
    populated.length === 0
      ? null
      : Math.round(
          populated.reduce((acc, b) => acc + b.score, 0) / populated.length
        );

  // Banner: derived from the latest session's dominant emotion.
  const latest = pickLatestSession(rows);
  const latestDominant = latest
    ? dominantEmotion(latest.final_fingerprint)
    : null;
  const todayLatest = latest
    ? latestSessionIsToday(latest, now, tzOffsetMinutes)
    : false;
  const banner = latest
    ? { tone: toneFromDominant(latestDominant), today: todayLatest }
    : null;

  // Tags row: keep the existing seven labels for visual rhythm,
  // but replace the LAST slot ("Today") with whatever the latest
  // session's tag actually is. That's the only one the page
  // highlights anyway.
  const tags = DEFAULT_TAG_ORDER.slice();
  if (latestDominant) {
    tags[tags.length - 1] = tagFromDominant(latestDominant);
  }

  const body: InsightResponse = {
    ok: true,
    has_data: populated.length > 0,
    session_count: rows.length,
    banner,
    mood: { days: buckets, variability },
    wellness: { score, lift_estimate: lift },
    tags,
  };
  return NextResponse.json(body);
}

function emptyResponse(tzOffsetMinutes: number): InsightResponse {
  return {
    ok: true,
    has_data: false,
    session_count: 0,
    banner: null,
    mood: {
      days: build7DayBuckets(new Date(), tzOffsetMinutes),
      variability: "none",
    },
    wellness: { score: null, lift_estimate: null },
    tags: DEFAULT_TAG_ORDER.slice(),
  };
}
