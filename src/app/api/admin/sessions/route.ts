import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { getServerAuthSupabase } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin-auth";

/**
 * GET /api/admin/sessions?token=<ADMIN_TOKEN>
 *
 * Read-only listing of the last ~100 sessions. Protected by two
 * independent gates — defence in depth, matching the middleware:
 *   1. `?token=` must equal `ADMIN_TOKEN`
 *   2. The request cookie must belong to a signed-in Supabase user
 *      whose email is listed in `ADMIN_EMAILS`
 *
 * If either is wrong, we return 401. If `ADMIN_TOKEN` is unset, the
 * endpoint is disabled entirely.
 */

export const runtime = "nodejs";

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

  // Identity gate — the session cookie must belong to a whitelisted
  // admin email. The page fetching this endpoint went through the
  // middleware's same check, but endpoints validate independently
  // so a leaked token URL can't be used from a signed-out curl.
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
    return NextResponse.json({ ok: true, sessions: [] });
  }
  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, sessions: [] });
  }

  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, created_at, anon_user_id, first_name, goodbye_email, peak_quote, keywords, audio_seconds, revenue_estimate, final_fingerprint, auth_user_id, email, full_name, avatar_url, auth_provider"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { ok: false, reason: "db-read-failed", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, sessions: data ?? [] });
}
