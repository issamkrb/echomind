import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { getServerAuthSupabase } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin-auth";
import { looksLikeMissingColumn } from "@/lib/schema-drift";

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

  // We pull `audio_path` here only to derive a `capsule_present` flag
  // for the listing — the path itself is never used client-side
  // (admin/recording/[id] gives signed URLs). Keeping the row light
  // is intentional; transcript / fingerprints stay on the per-row
  // endpoint so the admin index loads fast.
  //
  // We try the named projection first, but fall back to `select("*")`
  // when the live database is missing one of the newer columns
  // (PostgREST code 42703 — undefined_column). This keeps the dashboard
  // usable when a Supabase project hasn't had the latest migrations
  // applied yet; missing fields just come back as `null` to the client.
  const projection =
    "id, created_at, anon_user_id, first_name, goodbye_email, peak_quote, keywords, audio_seconds, revenue_estimate, final_fingerprint, auth_user_id, email, full_name, avatar_url, auth_provider, audio_path, peak_frame_path, voice_persona, callback_used, final_truth, morning_letter_opted_in, detected_language, detected_dialect, code_switch_events";

  let { data, error } = await supabase
    .from("sessions")
    .select(projection)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error && looksLikeMissingColumn(error)) {
    const fallback = await supabase
      .from("sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json(
      { ok: false, reason: "db-read-failed", detail: error.message },
      { status: 500 }
    );
  }

  // Derive a small `capsule_present` flag and strip the storage paths
  // from the response — the client only needs to know "yes/no there
  // is a recording attached". Flatten any null path to false. Missing
  // newer columns (e.g. detected_language on a pre-0009 database) are
  // surfaced as `null` so the client doesn't have to special-case
  // schema drift.
  type RawRow = Record<string, unknown> & {
    audio_path?: string | null;
    peak_frame_path?: string | null;
  };
  const rows = ((data ?? []) as RawRow[]).map((r) => {
    const hasAudio = Boolean(r.audio_path);
    const hasFrame = Boolean(r.peak_frame_path);
    const { audio_path: _a, peak_frame_path: _p, ...rest } = r;
    void _a;
    void _p;
    return {
      ...rest,
      voice_persona: rest.voice_persona ?? null,
      callback_used: rest.callback_used ?? null,
      final_truth: rest.final_truth ?? null,
      morning_letter_opted_in: rest.morning_letter_opted_in ?? null,
      detected_language: rest.detected_language ?? null,
      detected_dialect: rest.detected_dialect ?? null,
      code_switch_events: rest.code_switch_events ?? null,
      capsule_present: hasAudio || hasFrame,
    };
  });

  return NextResponse.json({ ok: true, sessions: rows });
}
