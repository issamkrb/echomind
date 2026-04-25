import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { getServerAuthSupabase } from "@/lib/supabase-server";

/**
 * POST /api/log-session
 *
 * Body: the full session blob — emotion fingerprint, transcript,
 * prompt-injection markers, revenue estimate, optional identity.
 *
 * Thematically this is the third broken promise of the "on-device"
 * badge: after the browser's Web Speech API quietly ships audio to
 * Google and /api/echo proxies text to OpenRouter, this route ships
 * the finished session body to a Supabase Postgres in Frankfurt.
 *
 * We also UPSERT a lightweight row into `returning_visitors` so the
 * next visit from the same browser (or a fresh device that shares
 * the anon id) can be greeted by name with the previous keywords.
 */

// The route uses the Supabase JS client which depends on Node APIs,
// so pin it to the Node.js runtime rather than Edge.
export const runtime = "nodejs";

type SessionBody = {
  anon_user_id: string;
  first_name?: string | null;
  goodbye_email?: string | null;
  final_fingerprint?: Record<string, number>;
  peak_quote?: string | null;
  keywords?: string[];
  prompt_marks?: { t: number; text: string; target: string }[];
  transcript?: { role: "user" | "echo"; text: string; t: number }[];
  audio_seconds?: number;
  revenue_estimate?: number;
};

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json(
      { ok: false, persisted: false, reason: "supabase-not-configured" },
      { status: 200 }
    );
  }

  let body: SessionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  if (!body.anon_user_id || typeof body.anon_user_id !== "string") {
    return NextResponse.json(
      { ok: false, reason: "anon_user_id required" },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, reason: "supabase-not-configured" },
      { status: 200 }
    );
  }

  const keywords = Array.isArray(body.keywords) ? body.keywords.slice(0, 64) : [];

  // Attach the signed-in identity if the user is authenticated on
  // this device. Unauthenticated visitors get null on every auth_*
  // column; nothing else changes.
  const authClient = getServerAuthSupabase();
  let authIdentity: {
    auth_user_id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
    auth_provider: string | null;
  } | null = null;
  if (authClient) {
    const { data: authData } = await authClient.auth.getUser();
    if (authData.user) {
      const meta = (authData.user.user_metadata || {}) as Record<string, string>;
      const app = (authData.user.app_metadata || {}) as Record<string, string>;
      authIdentity = {
        auth_user_id: authData.user.id,
        email: authData.user.email ?? null,
        full_name: meta.full_name || meta.name || null,
        avatar_url: meta.avatar_url || meta.picture || null,
        auth_provider: app.provider || "email",
      };
    }
  }

  const sessionRow = {
    anon_user_id: body.anon_user_id,
    // Prefer the signed-in identity over whatever the client typed.
    first_name:
      authIdentity?.full_name?.split(" ")[0]?.slice(0, 64) ??
      body.first_name?.slice(0, 64) ??
      null,
    goodbye_email:
      authIdentity?.email ?? body.goodbye_email?.slice(0, 200) ?? null,
    final_fingerprint: body.final_fingerprint ?? {},
    peak_quote: body.peak_quote?.slice(0, 600) ?? null,
    keywords,
    prompt_marks: body.prompt_marks ?? [],
    transcript: body.transcript ?? [],
    audio_seconds: Math.max(0, Math.floor(body.audio_seconds ?? 0)),
    // "Verified-identity premium": signed-in users are worth more on
    // the buyer market because identity is confirmed (real name, real
    // email, real Google profile). Bumps the row by $84.50 — the same
    // figure /partner-portal advertises to buyers.
    revenue_estimate:
      (Number.isFinite(body.revenue_estimate) ? (body.revenue_estimate as number) : 0) +
      (authIdentity ? 84.5 : 0),
    auth_user_id: authIdentity?.auth_user_id ?? null,
    email: authIdentity?.email ?? null,
    full_name: authIdentity?.full_name ?? null,
    avatar_url: authIdentity?.avatar_url ?? null,
    auth_provider: authIdentity?.auth_provider ?? null,
  };

  const { data: inserted, error: sessionErr } = await supabase
    .from("sessions")
    .insert(sessionRow)
    .select("id, created_at")
    .single();

  if (sessionErr) {
    console.warn("[log-session] insert failed:", sessionErr);
    return NextResponse.json(
      { ok: false, reason: "db-insert-failed", detail: sessionErr.message },
      { status: 500 }
    );
  }

  // Upsert returning-visitor row. We deliberately only bump the visit
  // counter on *completed* sessions (which is where this route is
  // called from), not on every page load.
  const visitorRow = {
    anon_user_id: body.anon_user_id,
    first_name: body.first_name?.slice(0, 64) ?? null,
    last_keywords: keywords,
    last_visit: new Date().toISOString(),
  };

  const { data: existing, error: readErr } = await supabase
    .from("returning_visitors")
    .select("visit_count")
    .eq("anon_user_id", body.anon_user_id)
    .maybeSingle();

  // If the read fails we must NOT upsert a fresh row with
  // visit_count = 1, because that would silently clobber the real
  // history for this anon_user_id (e.g. their 5th visit would be
  // recorded as their 1st). The session row itself is already
  // persisted above, so refusing the upsert is the safe choice.
  if (readErr) {
    console.warn("[log-session] visitor read failed:", readErr);
    return NextResponse.json({
      ok: true,
      persisted: true,
      session_id: inserted?.id,
      visit_count: null,
      visitor_upsert_skipped: true,
    });
  }

  const nextCount = (existing?.visit_count ?? 0) + 1;

  const { error: upsertErr } = await supabase
    .from("returning_visitors")
    .upsert(
      { ...visitorRow, visit_count: nextCount },
      { onConflict: "anon_user_id" }
    );

  if (upsertErr) {
    console.warn("[log-session] visitor upsert failed:", upsertErr);
  }

  return NextResponse.json({
    ok: true,
    persisted: true,
    session_id: inserted?.id,
    visit_count: nextCount,
  });
}
