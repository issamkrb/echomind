import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";

/**
 * GET /api/admin/sessions/[id]?token=<ADMIN_TOKEN>
 *
 * Returns a single session row by primary key, gated by the same
 * shared admin token as the listing endpoint. Used by the operator-
 * side `/admin/auction/[id]` view.
 */

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
  if (!supabaseConfigured()) {
    return NextResponse.json(
      { ok: false, reason: "supabase-not-configured" },
      { status: 503 }
    );
  }
  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, reason: "supabase-unavailable" },
      { status: 503 }
    );
  }

  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, created_at, anon_user_id, first_name, goodbye_email, peak_quote, keywords, audio_seconds, revenue_estimate, final_fingerprint, auth_user_id, email, full_name, avatar_url, auth_provider"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, reason: "db-read-failed", detail: error.message },
      { status: 500 }
    );
  }
  if (!data) {
    return NextResponse.json(
      { ok: false, reason: "not-found" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, session: data });
}
