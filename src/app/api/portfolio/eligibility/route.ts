import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";

/**
 * GET /api/portfolio/eligibility?anon=<anon_user_id>
 *
 * Lightweight "have we watched you long enough yet?" probe the
 * /session-summary page calls to decide whether to render the
 * "your portfolio is ready" banner.
 *
 * Returns:
 *   { ok, sessionCount, eligible }
 *
 * The eligibility threshold is 3 sessions — the same number used
 * throughout the critique ("three sessions is a pattern; a pattern
 * is a product"). Unauthenticated call; only reads the counter, no
 * sensitive content.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ELIGIBILITY_THRESHOLD = 3;

export async function GET(req: NextRequest) {
  const anon = req.nextUrl.searchParams.get("anon");
  if (!anon) {
    return NextResponse.json(
      { ok: false, reason: "anon-required" },
      { status: 400 }
    );
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      sessionCount: 0,
      eligible: false,
    });
  }
  const db = getServerSupabase();
  if (!db) {
    return NextResponse.json({
      ok: true,
      sessionCount: 0,
      eligible: false,
    });
  }
  const { data } = await db
    .from("returning_visitors")
    .select("visit_count, portfolio_unlocked_at")
    .eq("anon_user_id", anon)
    .maybeSingle();
  const count = data?.visit_count ?? 0;
  const eligible = count >= ELIGIBILITY_THRESHOLD;
  return NextResponse.json({
    ok: true,
    sessionCount: count,
    eligible,
    unlockedAt: data?.portfolio_unlocked_at ?? null,
  });
}

/**
 * POST /api/portfolio/eligibility
 * Body: { anon: string }
 *
 * Called by /session-summary the first time the banner is shown so
 * we can record the exact moment the portfolio became "visible" to
 * the user. No-ops if `portfolio_unlocked_at` is already set.
 */
export async function POST(req: NextRequest) {
  let body: { anon?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  if (!body?.anon || typeof body.anon !== "string") {
    return NextResponse.json(
      { ok: false, reason: "anon-required" },
      { status: 400 }
    );
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: true, recorded: false });
  }
  const db = getServerSupabase();
  if (!db) return NextResponse.json({ ok: true, recorded: false });

  // Read first so we don't overwrite an earlier timestamp.
  const { data: existing } = await db
    .from("returning_visitors")
    .select("portfolio_unlocked_at")
    .eq("anon_user_id", body.anon)
    .maybeSingle();
  if (existing?.portfolio_unlocked_at) {
    return NextResponse.json({
      ok: true,
      recorded: false,
      unlockedAt: existing.portfolio_unlocked_at,
    });
  }
  const now = new Date().toISOString();
  const { error } = await db
    .from("returning_visitors")
    .update({ portfolio_unlocked_at: now })
    .eq("anon_user_id", body.anon);
  if (error) {
    return NextResponse.json(
      { ok: false, reason: "update-failed", detail: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, recorded: true, unlockedAt: now });
}
