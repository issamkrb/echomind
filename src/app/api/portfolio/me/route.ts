import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { getServerAuthSupabase } from "@/lib/supabase-server";
import {
  computePortfolio,
  toUserFacing,
  type PortfolioSessionRow,
} from "@/lib/portfolio";

/**
 * GET /api/portfolio/me
 *
 * Returns the signed-in viewer's portfolio — all sessions attached
 * to their auth identity OR their email (goodbye_email) — fed
 * through the valuation pipeline. Used by `/portfolio` to render
 * the warm memoir view.
 *
 * Gate: must be signed in. Unauthenticated callers get a 401 so the
 * /portfolio page can show the "claim your portfolio" sign-in
 * invitation instead of an empty memoir.
 *
 * Rhetorical note — the same numbers this endpoint returns (grade,
 * askingPrice, cohortTags) are what the operator-side `/admin/market`
 * page fetches from the admin endpoint. One valuation pipeline, two
 * UIs. The user sees their grade framed warmly; the operator sees it
 * priced.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  void _req;
  const authClient = getServerAuthSupabase();
  if (!authClient) {
    return NextResponse.json(
      { ok: false, reason: "auth-not-configured" },
      { status: 503 }
    );
  }
  const { data: userData } = await authClient.auth.getUser();
  const user = userData.user;
  if (!user) {
    return NextResponse.json(
      { ok: false, reason: "not-signed-in" },
      { status: 401 }
    );
  }

  if (!supabaseConfigured()) {
    return NextResponse.json(
      { ok: false, reason: "supabase-not-configured" },
      { status: 503 }
    );
  }
  const db = getServerSupabase();
  if (!db) {
    return NextResponse.json(
      { ok: false, reason: "supabase-not-configured" },
      { status: 503 }
    );
  }

  const email = (user.email ?? "").toLowerCase().trim() || null;
  const meta = (user.user_metadata || {}) as Record<string, string>;

  // Load all sessions belonging to this identity. We match on BOTH
  // the auth_user_id (rock-solid) AND the email (catches sessions
  // the user ran anonymously before signing in, if they typed the
  // same email into the goodbye trap). Sorted oldest first for the
  // memoir chronology.
  const orClause = email
    ? `auth_user_id.eq.${user.id},email.eq.${email},goodbye_email.eq.${email}`
    : `auth_user_id.eq.${user.id}`;

  const { data: sessions, error } = await db
    .from("sessions")
    .select(
      // Full row except audio_path / peak_frame_path (those are
      // admin-only storage keys).
      "id, created_at, anon_user_id, first_name, goodbye_email, email, full_name, avatar_url, auth_provider, auth_user_id, peak_quote, final_truth, morning_letter, morning_letter_opted_in, keywords, audio_seconds, revenue_estimate, final_fingerprint, voice_persona, callback_used, wardrobe_snapshots, starter_chips, tapped_chip, transcript, prompt_marks"
    )
    .or(orClause)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json(
      { ok: false, reason: "db-read-failed", detail: error.message },
      { status: 500 }
    );
  }

  // Load the profile row to read the deletion/clearance state.
  const { data: profile } = await db
    .from("profiles")
    .select(
      "portfolio_deleted_at, portfolio_clearance_multiplier, portfolio_unlocked_at"
    )
    .eq("id", user.id)
    .maybeSingle();

  const valuation = computePortfolio({
    rows: (sessions ?? []) as unknown as PortfolioSessionRow[],
    deletedAt: profile?.portfolio_deleted_at ?? null,
    clearanceMultiplier: profile?.portfolio_clearance_multiplier ?? null,
    fallbackDisplayName:
      meta.full_name || meta.name || (email ? email.split("@")[0] : null),
    fallbackEmail: email,
    fallbackAvatar: meta.avatar_url || meta.picture || null,
  });

  return NextResponse.json({
    ok: true,
    portfolio: toUserFacing(valuation),
    // Full valuation is shipped alongside the user projection so the
    // client can render either framing if we add an operator toggle
    // later. Nothing here is sensitive — it's the same user's data.
    valuation,
    unlockedAt: profile?.portfolio_unlocked_at ?? null,
  });
}
