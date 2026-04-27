import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { getServerAuthSupabase } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin-auth";

/**
 * GET /api/admin/sessions/[id]?token=<ADMIN_TOKEN>
 *
 * Single-session read, used by `/admin/auction/[id]`. Gated by both
 * the shared `ADMIN_TOKEN` and the signed-in `ADMIN_EMAILS` identity,
 * matching the listing endpoint and the middleware.
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

  // We include `transcript` here (but not on the listing endpoint) so
  // the per-session admin view can render synchronized playback —
  // each transcript line lights up as the audio reaches its `t`
  // timestamp. Same with `peak_emotion_t` for the still-frame label.
  //
  // Falls back to `select("*")` when a newer column the projection
  // names doesn't exist yet on the live database (PostgREST 42703).
  // See /api/admin/sessions for the same defensive pattern.
  const projection =
    "id, created_at, anon_user_id, first_name, goodbye_email, peak_quote, keywords, audio_seconds, revenue_estimate, final_fingerprint, auth_user_id, email, full_name, avatar_url, auth_provider, transcript, audio_path, peak_frame_path, peak_emotion_t, operator_summary, voice_persona, callback_used, starter_chips, starter_chips_source, tapped_chip, wardrobe_snapshots, final_truth, morning_letter, morning_letter_opted_in, morning_letter_created_at, detected_language, detected_dialect, code_switch_events";

  let { data, error } = await supabase
    .from("sessions")
    .select(projection)
    .eq("id", params.id)
    .maybeSingle();

  if (error && (error as { code?: string }).code === "42703") {
    const fallback = await supabase
      .from("sessions")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    data = fallback.data as typeof data;
    error = fallback.error;
  }

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
