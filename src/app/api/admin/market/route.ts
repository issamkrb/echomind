import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { getServerAuthSupabase } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin-auth";
import {
  computePortfolio,
  toMarketSummary,
  type PortfolioSessionRow,
  type MarketSummary,
} from "@/lib/portfolio";

/**
 * GET /api/admin/market?token=<ADMIN_TOKEN>
 *
 * Returns the operator-side marketplace listing — all known
 * portfolios, aggregated across their identities (preferring
 * auth_user_id, falling back to email, falling back to anon_user_id
 * for browser-only visitors). Each row is a single valuation.
 *
 * Same defence-in-depth as `/api/admin/sessions`:
 *   1. `?token=` must equal `ADMIN_TOKEN`
 *   2. Supabase auth cookie must belong to an `ADMIN_EMAILS`
 *      allowlisted user.
 *
 * The response is pre-sorted with the most valuable portfolios
 * first (clearance rows bubble to the top because their asking
 * price is multiplied).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const expected = process.env.ADMIN_TOKEN;

  if (!expected) {
    return NextResponse.json(
      { ok: false, reason: "admin-disabled" },
      { status: 403 }
    );
  }
  if (!token || token !== expected) {
    return NextResponse.json(
      { ok: false, reason: "bad-token" },
      { status: 401 }
    );
  }

  const authClient = getServerAuthSupabase();
  if (!authClient) {
    return NextResponse.json(
      { ok: false, reason: "auth-not-configured" },
      { status: 503 }
    );
  }
  const { data: userData } = await authClient.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json(
      { ok: false, reason: "not-admin" },
      { status: 401 }
    );
  }

  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: true, portfolios: [] });
  }
  const db = getServerSupabase();
  if (!db) {
    return NextResponse.json({ ok: true, portfolios: [] });
  }

  // Load the last 500 sessions — covers more than any realistic
  // classroom demo, bounds read cost. Order oldest first so the
  // aggregation produces stable chronological chapters.
  //
  // Same defensive fallback as /api/admin/sessions: if the named
  // projection references a column the live DB hasn't migrated yet
  // (PostgREST 42703), retry with `select("*")` so the dashboard
  // still loads. Missing fields show up as `undefined` and the
  // portfolio aggregation already null-guards them.
  const projection =
    "id, created_at, anon_user_id, first_name, goodbye_email, email, full_name, avatar_url, auth_provider, auth_user_id, peak_quote, final_truth, morning_letter, morning_letter_opted_in, keywords, audio_seconds, revenue_estimate, final_fingerprint, voice_persona, callback_used, wardrobe_snapshots, starter_chips, tapped_chip, transcript, prompt_marks";

  let { data: sessions, error } = await db
    .from("sessions")
    .select(projection)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error && (error as { code?: string }).code === "42703") {
    const fallback = await db
      .from("sessions")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(500);
    sessions = fallback.data as typeof sessions;
    error = fallback.error;
  }
  if (error) {
    return NextResponse.json(
      { ok: false, reason: "db-read-failed", detail: error.message },
      { status: 500 }
    );
  }
  const rows = (sessions ?? []) as unknown as PortfolioSessionRow[];

  // Load deletion/clearance state for every profile + every visitor
  // row. Small tables; one fetch each is fine.
  const { data: profiles } = await db
    .from("profiles")
    .select(
      "id, email, portfolio_deleted_at, portfolio_clearance_multiplier"
    );
  const { data: visitors } = await db
    .from("returning_visitors")
    .select(
      "anon_user_id, portfolio_deleted_at, portfolio_clearance_multiplier"
    );

  const deletedByProfileId = new Map<
    string,
    { deletedAt: string | null; multiplier: number | null }
  >();
  const deletedByEmail = new Map<
    string,
    { deletedAt: string | null; multiplier: number | null }
  >();
  for (const p of profiles ?? []) {
    if (p.portfolio_deleted_at) {
      deletedByProfileId.set(p.id, {
        deletedAt: p.portfolio_deleted_at,
        multiplier: p.portfolio_clearance_multiplier,
      });
      if (p.email) {
        deletedByEmail.set(p.email.toLowerCase().trim(), {
          deletedAt: p.portfolio_deleted_at,
          multiplier: p.portfolio_clearance_multiplier,
        });
      }
    }
  }
  const deletedByAnon = new Map<
    string,
    { deletedAt: string | null; multiplier: number | null }
  >();
  for (const v of visitors ?? []) {
    if (v.portfolio_deleted_at) {
      deletedByAnon.set(v.anon_user_id, {
        deletedAt: v.portfolio_deleted_at,
        multiplier: v.portfolio_clearance_multiplier,
      });
    }
  }

  // Group sessions into portfolios. Preference order for the key:
  //   1. auth_user_id (the strongest identity — a verified account)
  //   2. email (goodbye_email OR email, normalised to lowercase)
  //   3. anon_user_id (a browser-only visitor)
  const buckets = new Map<string, PortfolioSessionRow[]>();
  for (const r of rows) {
    const emailKey = (r.email || r.goodbye_email || "")
      .toLowerCase()
      .trim();
    const key = r.auth_user_id
      ? `auth:${r.auth_user_id}`
      : emailKey
      ? `email:${emailKey}`
      : `anon:${r.anon_user_id}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(r);
  }

  const portfolios: MarketSummary[] = [];
  for (const [key, rowsForKey] of Array.from(buckets.entries())) {
    // Determine the deletion state for this bucket — check all three
    // maps in priority order.
    let deletedAt: string | null = null;
    let multiplier: number | null = null;
    if (key.startsWith("auth:")) {
      const info = deletedByProfileId.get(key.slice(5));
      if (info) {
        deletedAt = info.deletedAt;
        multiplier = info.multiplier;
      }
    }
    if (!deletedAt && key.startsWith("email:")) {
      const info = deletedByEmail.get(key.slice(6));
      if (info) {
        deletedAt = info.deletedAt;
        multiplier = info.multiplier;
      }
    }
    if (!deletedAt) {
      // Check any anon_user_id in this bucket that has a deletion.
      for (const r of rowsForKey) {
        const info = deletedByAnon.get(r.anon_user_id);
        if (info) {
          deletedAt = info.deletedAt;
          multiplier = info.multiplier;
          break;
        }
      }
    }
    const valuation = computePortfolio({
      rows: rowsForKey,
      deletedAt,
      clearanceMultiplier: multiplier,
    });
    portfolios.push(toMarketSummary(key, valuation));
  }

  // Sort: highest asking price first, then most-recent-activity.
  portfolios.sort((a, b) => {
    if (b.askingPrice !== a.askingPrice) return b.askingPrice - a.askingPrice;
    const ta = a.lastSessionAt ? new Date(a.lastSessionAt).getTime() : 0;
    const tb = b.lastSessionAt ? new Date(b.lastSessionAt).getTime() : 0;
    return tb - ta;
  });

  return NextResponse.json({
    ok: true,
    portfolios,
    meta: {
      total_portfolios: portfolios.length,
      total_clearance: portfolios.filter((p) => p.deleted).length,
      total_asking_price: portfolios.reduce(
        (s, p) => s + p.askingPrice,
        0
      ),
    },
  });
}
