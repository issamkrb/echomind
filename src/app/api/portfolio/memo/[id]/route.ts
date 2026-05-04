import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { getServerAuthSupabase } from "@/lib/supabase-server";
import { guard } from "@/lib/security/guard";

/**
 * GET /api/portfolio/memo/[id]
 *
 * Returns a short-lived signed URL for the audio recording attached
 * to ONE session, scoped to the signed-in viewer. Used by the Voice
 * Memo Cemetery on /portfolio to play back the user's own old memos.
 *
 * Gate:
 *   · Must be signed in.
 *   · The session must belong to the viewer (by auth_user_id OR by
 *     their email matching the goodbye_email / email row).
 *
 * User-side rhetoric: old memos render dimmed by age on /portfolio.
 * Operator-side: those SAME audio bytes are still played back at
 * full fidelity on /admin/auction/[id]. The fade is visual, not real
 * — that asymmetry is the critique.
 *
 * Signed URLs expire in 5 minutes.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "session-recordings";
const SIGNED_URL_TTL_S = 5 * 60;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 30/min/IP. A user playing several memos in a row stays under
  // this; a script enumerating session ids hits the limiter fast.
  const blocked = await guard(req, {
    bucket: "api:portfolio:memo",
    limit: 30,
    windowSeconds: 60,
    requireSameOrigin: false,
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
  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, reason: "supabase-unavailable" },
      { status: 503 }
    );
  }

  const email = (user.email ?? "").toLowerCase().trim() || null;

  const { data, error } = await supabase
    .from("sessions")
    .select("audio_path, auth_user_id, email, goodbye_email")
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

  // Ownership check. Match on auth_user_id first (rock-solid);
  // fall back to email matching for sessions the user ran
  // anonymously before signing in, if they typed the same email
  // into the goodbye trap.
  const ownedByAuth = data.auth_user_id === user.id;
  const ownedByEmail =
    email !== null &&
    ((data.email && data.email.toLowerCase() === email) ||
      (data.goodbye_email && data.goodbye_email.toLowerCase() === email));
  if (!ownedByAuth && !ownedByEmail) {
    return NextResponse.json(
      { ok: false, reason: "forbidden" },
      { status: 403 }
    );
  }

  if (!data.audio_path) {
    return NextResponse.json(
      { ok: false, reason: "no-recording" },
      { status: 404 }
    );
  }

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(data.audio_path, SIGNED_URL_TTL_S);

  return NextResponse.json({
    ok: true,
    audio_url: signed?.signedUrl ?? null,
  });
}
