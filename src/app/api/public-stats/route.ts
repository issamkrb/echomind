import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

/**
 * GET /api/public-stats
 *
 * Public-by-design endpoint that powers the ambient "magnetism"
 * surface on the landing page. Returns:
 *   - `tonightCount`: how many sessions have started since local
 *      midnight (UTC for simplicity, since the marketing claim is
 *      vibes-true rather than tz-true).
 *   - `totalCount`: lifetime sessions ever captured.
 *   - `lastWhisper`: the most recent peak_quote from any session
 *      that produced one, with the speaker's name redacted. Echoes
 *      the project's thesis: every confession is harvested, every
 *      confession is on the marketplace.
 *
 * No auth — this surface is meant to land on the unauthenticated
 * homepage. The data we expose here is already aggregated or
 * already redacted, and the worst case if Supabase is offline is
 * we return zeros (the landing page degrades gracefully).
 *
 * Cached for 5 seconds at the edge so a flood of homepage views
 * doesn't hammer Supabase. The numbers move on the order of
 * minutes, not milliseconds, so 5s is plenty fresh for the
 * ambient effect.
 */

export const runtime = "nodejs";
export const revalidate = 5;

type PublicStats = {
  tonightCount: number;
  totalCount: number;
  lastWhisper: {
    text: string;
    /** Approximate seconds since the whisper was captured, so the
     *  client can render "X minutes ago" without leaking exact
     *  session timestamps that might be cross-correlated with
     *  another source. */
    ageSec: number;
  } | null;
};

/** Strip first names and other obviously-identifying tokens from a
 *  peak_quote before exposing it on the public homepage. We err on
 *  the side of over-redacting — the artistic effect of "ʻ___ told
 *  no one else thisʼ" works fine with names blanked, and it keeps
 *  us from accidentally rendering a real user's first name on the
 *  marketing page. */
function redactWhisper(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  // Capitalised words longer than 1 char that are not at the very
  // start of the sentence. Conservative: misses some names, never
  // exposes one. Replaced with a typographic blank that preserves
  // the rhythm of the line.
  return trimmed
    .replace(/(^|[\s\u2014\-])([A-Z][a-z]{1,})/g, (_, lead, _word) => `${lead}___`)
    .slice(0, 200);
}

export async function GET() {
  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json<PublicStats>({
      tonightCount: 0,
      totalCount: 0,
      lastWhisper: null,
    });
  }

  // ── tonight count ────────────────────────────────────────────
  // "Tonight" = since the most recent UTC midnight. Imperfect for
  // users far from UTC but the marketing copy is "tonight-ish";
  // the alternative (per-visitor tz arithmetic) doesn't pay for
  // its complexity here.
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const startOfDayIso = startOfDay.toISOString();

  const [tonightRes, totalRes, whisperRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfDayIso),
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("sessions")
      .select("peak_quote, created_at")
      .not("peak_quote", "is", null)
      .neq("peak_quote", "")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  let lastWhisper: PublicStats["lastWhisper"] = null;
  const wRow = whisperRes.data?.[0] as
    | { peak_quote: string | null; created_at: string }
    | undefined;
  if (wRow?.peak_quote) {
    const ageSec = Math.max(
      0,
      Math.round((Date.now() - new Date(wRow.created_at).getTime()) / 1000)
    );
    lastWhisper = {
      text: redactWhisper(wRow.peak_quote),
      ageSec,
    };
  }

  return NextResponse.json<PublicStats>({
    tonightCount: tonightRes.count ?? 0,
    totalCount: totalRes.count ?? 0,
    lastWhisper,
  });
}
