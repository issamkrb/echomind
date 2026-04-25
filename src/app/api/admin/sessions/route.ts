import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";

/**
 * GET /api/admin/sessions?token=<ADMIN_TOKEN>
 *
 * Read-only listing of the last ~100 sessions. Intentionally
 * unauthenticated-except-for-a-shared-token — this is a classroom
 * speculative-design artifact, not a production admin surface, and
 * the whole point of the /admin page is to demonstrate during the
 * live demo that the data really was harvested.
 *
 * If ADMIN_TOKEN isn't set in env, the endpoint refuses to return
 * data — safer default.
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
      "id, created_at, anon_user_id, first_name, goodbye_email, peak_quote, keywords, audio_seconds, revenue_estimate, final_fingerprint"
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
