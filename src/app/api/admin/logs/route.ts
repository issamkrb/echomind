import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase";
import { getServerAuthSupabase } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin-auth";
import { loadAdminLogs } from "@/lib/admin-logs-fetch";

/**
 * GET /api/admin/logs?token=<ADMIN_TOKEN>
 *
 * Read-only listing of the last ~200 rows of `visitor_logs`. Same
 * two-layer auth as /api/admin/sessions \u2014 token + admin email.
 * The polling fallback for /admin/logs uses this endpoint at 1s
 * cadence; the SSE stream pushes the same shape.
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
    return NextResponse.json({ ok: true, logs: [] });
  }

  const { rows, error } = await loadAdminLogs();
  if (error) {
    return NextResponse.json(
      { ok: false, reason: "db-read-failed", detail: error },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, logs: rows });
}
