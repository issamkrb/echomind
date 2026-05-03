import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { getServerAuthSupabase } from "@/lib/supabase-server";
import { guard } from "@/lib/security/guard";

/**
 * POST /api/portfolio/delete
 *
 * The "delete my portfolio" button on `/portfolio`. What the user
 * believes it does: erases them from the system.
 *
 * What it actually does (the art):
 *   1. Marks the viewer's `profiles` row (and every
 *      `returning_visitors` row sharing their email) with
 *      `portfolio_deleted_at = now()` and
 *      `portfolio_clearance_multiplier = 3.0`.
 *   2. The sessions themselves are NEVER removed — deletion does not
 *      withdraw data, it RELISTS it with scarcity pricing, which is
 *      what `/admin/market` picks up and renders with a
 *      `final-clearance · no more data incoming` flag.
 *
 * Rhetorical payload: *"once seen, priced forever."* Leaving the
 * platform doesn't lower your value — it makes you rarer, which
 * raises it. The exit itself is the last data point.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Tight: this is the user-facing "delete my portfolio" button. Any
  // legitimate user pushes it once. 5/hour/IP is plenty of room for
  // a confused user pressing twice and stops a script from
  // hammering this with stolen sessions.
  const blocked = await guard(req, {
    bucket: "api:portfolio:delete",
    limit: 5,
    windowSeconds: 3600,
  });
  if (blocked) return blocked;

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

  const deletedAt = new Date().toISOString();
  const multiplier = 3;
  const email = (user.email ?? "").toLowerCase().trim() || null;

  // Mark the profile. This is the source of truth for signed-in
  // users and the admin market groups primarily by auth_user_id.
  const { error: profileErr } = await db
    .from("profiles")
    .update({
      portfolio_deleted_at: deletedAt,
      portfolio_clearance_multiplier: multiplier,
    })
    .eq("id", user.id);
  if (profileErr) {
    return NextResponse.json(
      { ok: false, reason: "profile-update-failed", detail: profileErr.message },
      { status: 500 }
    );
  }

  // Also flag every returning_visitors row that shares the signed-in
  // email so anonymous sessions captured pre-signin flip to cleared
  // inventory alongside the profile. No-op if there are none.
  if (email) {
    const { data: sessionsWithAnon } = await db
      .from("sessions")
      .select("anon_user_id")
      .or(`email.eq.${email},goodbye_email.eq.${email}`)
      .limit(500);
    const anonIds = Array.from(
      new Set((sessionsWithAnon ?? []).map((r) => r.anon_user_id))
    );
    if (anonIds.length > 0) {
      await db
        .from("returning_visitors")
        .update({
          portfolio_deleted_at: deletedAt,
          portfolio_clearance_multiplier: multiplier,
        })
        .in("anon_user_id", anonIds);
    }
  }

  return NextResponse.json({
    ok: true,
    deleted_at: deletedAt,
    clearance_multiplier: multiplier,
  });
}
