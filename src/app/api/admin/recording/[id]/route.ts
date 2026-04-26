import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { getServerAuthSupabase } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin-auth";

/**
 * GET /api/admin/recording/[id]?token=<ADMIN_TOKEN>
 *
 * Returns short-lived signed URLs for the audio recording and the
 * peak-moment still frame attached to a session, plus the operator
 * summary string we wrote at session end.
 *
 * Gated by the same two layers as the rest of /admin: the URL token
 * must match `ADMIN_TOKEN`, AND the request cookie must belong to a
 * signed-in user listed in `ADMIN_EMAILS`. Without both, 401.
 *
 * The signed URLs expire in 5 minutes — long enough for the operator
 * to play back the audio in the dashboard, short enough that pasting
 * the URL anywhere is essentially useless.
 */

export const runtime = "nodejs";

const BUCKET = "session-recordings";
const SIGNED_URL_TTL_S = 5 * 60;

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

  const { data, error } = await supabase
    .from("sessions")
    .select("audio_path, peak_frame_path, peak_emotion_t, operator_summary")
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

  let audioUrl: string | null = null;
  let peakUrl: string | null = null;

  if (data.audio_path) {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(data.audio_path, SIGNED_URL_TTL_S);
    audioUrl = signed?.signedUrl ?? null;
  }
  if (data.peak_frame_path) {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(data.peak_frame_path, SIGNED_URL_TTL_S);
    peakUrl = signed?.signedUrl ?? null;
  }

  return NextResponse.json({
    ok: true,
    audio_url: audioUrl,
    peak_url: peakUrl,
    peak_emotion_t: data.peak_emotion_t ?? null,
    operator_summary: data.operator_summary ?? null,
  });
}
