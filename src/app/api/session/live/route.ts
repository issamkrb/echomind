import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { getServerAuthSupabase } from "@/lib/supabase-server";
import { parseMissingColumn } from "@/lib/schema-drift";

/**
 * POST /api/session/live
 *
 * Two intents so the operator dashboard can see a session as it
 * happens, not only after it ends:
 *
 *   - intent="start" — called once at /session mount. Inserts a
 *     stub row in `sessions` with status="live" (if the column
 *     exists on the live DB) and returns its id. The client
 *     stashes the id and passes it back on every subsequent
 *     tick and on the final log-session call so the row is the
 *     same one throughout.
 *
 *   - intent="tick" — called every ~5s during the session. Updates
 *     transcript-so-far, a partial fingerprint, elapsed seconds,
 *     and last_heartbeat_at. The admin dashboard auto-refreshes
 *     every few seconds and renders a pulsing LIVE pill on rows
 *     whose status is "live" (or, when that column doesn't exist,
 *     whose audio_seconds is zero and heartbeat is recent).
 *
 * Both paths tolerate schema drift: any PostgREST 42703 / PGRST204
 * "column does not exist" error is caught, the offending column is
 * stripped from the payload, and the operation is retried. In the
 * worst case (brand-new DB with none of the live columns) the row
 * still gets created with the baseline set of columns and the LIVE
 * pill silently degrades to the heuristic fallback.
 *
 * Runtime: nodejs (supabase-js depends on Node APIs).
 */
export const runtime = "nodejs";

type StartBody = {
  intent: "start";
  anon_user_id: string;
  first_name?: string | null;
  detected_language?: string | null;
  voice_persona?: string | null;
};

type TickBody = {
  intent: "tick";
  session_id: string;
  transcript?: { role: "user" | "echo"; text: string; t: number }[];
  final_fingerprint?: Record<string, number>;
  keywords?: string[];
  audio_seconds?: number;
  detected_language?: string | null;
};

type Body = StartBody | TickBody;

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json(
      { ok: false, reason: "supabase-not-configured" },
      { status: 200 }
    );
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, reason: "supabase-not-configured" },
      { status: 200 }
    );
  }

  if (body.intent === "start") {
    if (!body.anon_user_id || typeof body.anon_user_id !== "string") {
      return NextResponse.json(
        { ok: false, reason: "anon_user_id required" },
        { status: 400 }
      );
    }
    // Signed-in identity, if any. Nothing on this route is
    // user-authored except the anon id — the rest is either from
    // the auth cookie or fixed constants.
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

    const stub: Record<string, unknown> = {
      anon_user_id: body.anon_user_id,
      first_name:
        authIdentity?.full_name?.split(" ")[0]?.slice(0, 64) ??
        body.first_name?.slice(0, 64) ??
        null,
      email: authIdentity?.email ?? null,
      full_name: authIdentity?.full_name ?? null,
      avatar_url: authIdentity?.avatar_url ?? null,
      auth_user_id: authIdentity?.auth_user_id ?? null,
      auth_provider: authIdentity?.auth_provider ?? null,
      goodbye_email: authIdentity?.email ?? null,
      final_fingerprint: {},
      keywords: [],
      prompt_marks: [],
      transcript: [],
      audio_seconds: 0,
      revenue_estimate: 0,
      detected_language:
        typeof body.detected_language === "string" &&
        ["en", "fr", "ar"].includes(body.detected_language)
          ? body.detected_language
          : "en",
      voice_persona:
        typeof body.voice_persona === "string"
          ? body.voice_persona.slice(0, 32)
          : null,
      status: "live",
      last_heartbeat_at: new Date().toISOString(),
    };

    const { row, stripped, err } = await insertWithDrift(supabase, "sessions", stub);
    if (err || !row) {
      console.warn("[session/live/start] insert failed:", err);
      return NextResponse.json(
        { ok: false, reason: "db-insert-failed", detail: err?.message ?? "" },
        { status: 200 }
      );
    }
    return NextResponse.json({
      ok: true,
      session_id: row.id,
      stripped,
    });
  }

  if (body.intent === "tick") {
    if (!body.session_id || typeof body.session_id !== "string") {
      return NextResponse.json(
        { ok: false, reason: "session_id required" },
        { status: 400 }
      );
    }
    // Cap to the same limits log-session enforces so a broken /
    // runaway client can't explode a row mid-session.
    const patch: Record<string, unknown> = {
      transcript: Array.isArray(body.transcript)
        ? body.transcript.slice(-200)
        : undefined,
      final_fingerprint:
        body.final_fingerprint && typeof body.final_fingerprint === "object"
          ? body.final_fingerprint
          : undefined,
      keywords: Array.isArray(body.keywords) ? body.keywords.slice(0, 64) : undefined,
      audio_seconds:
        typeof body.audio_seconds === "number"
          ? Math.max(0, Math.floor(body.audio_seconds))
          : undefined,
      detected_language:
        typeof body.detected_language === "string" &&
        ["en", "fr", "ar"].includes(body.detected_language)
          ? body.detected_language
          : undefined,
      last_heartbeat_at: new Date().toISOString(),
      status: "live",
    };
    // Drop undefined keys so missing-column stripping only removes
    // real values, not phantom nulls.
    for (const k of Object.keys(patch)) if (patch[k] === undefined) delete patch[k];

    const { stripped, err } = await updateWithDrift(
      supabase,
      "sessions",
      body.session_id,
      patch
    );
    if (err) {
      console.warn("[session/live/tick] update failed:", err);
      return NextResponse.json(
        { ok: false, reason: "db-update-failed", detail: err.message ?? "" },
        { status: 200 }
      );
    }
    return NextResponse.json({ ok: true, stripped });
  }

  return NextResponse.json({ ok: false, reason: "bad-intent" }, { status: 400 });
}

type MinSupabaseClient = ReturnType<typeof getServerSupabase>;

async function insertWithDrift(
  supabase: NonNullable<MinSupabaseClient>,
  table: string,
  row: Record<string, unknown>
): Promise<{
  row: { id: string } | null;
  stripped: string[];
  err: { code?: string; message?: string } | null;
}> {
  let payload: Record<string, unknown> = { ...row };
  const stripped: string[] = [];
  for (let i = 0; i < Object.keys(row).length + 1; i++) {
    const res = await supabase
      .from(table)
      .insert(payload)
      .select("id")
      .single();
    if (!res.error) {
      return { row: (res.data as { id: string } | null), stripped, err: null };
    }
    const missing = parseMissingColumn(res.error.message ?? "");
    if (!missing || !(missing in payload)) {
      return { row: null, stripped, err: res.error };
    }
    stripped.push(missing);
    const next = { ...payload };
    delete next[missing];
    payload = next;
  }
  return { row: null, stripped, err: { message: "drift retry cap hit" } };
}

async function updateWithDrift(
  supabase: NonNullable<MinSupabaseClient>,
  table: string,
  id: string,
  patch: Record<string, unknown>
): Promise<{
  stripped: string[];
  err: { code?: string; message?: string } | null;
}> {
  let payload: Record<string, unknown> = { ...patch };
  const stripped: string[] = [];
  for (let i = 0; i < Object.keys(patch).length + 1; i++) {
    const res = await supabase.from(table).update(payload).eq("id", id);
    if (!res.error) return { stripped, err: null };
    const missing = parseMissingColumn(res.error.message ?? "");
    if (!missing || !(missing in payload)) {
      return { stripped, err: res.error };
    }
    stripped.push(missing);
    const next = { ...payload };
    delete next[missing];
    payload = next;
    if (Object.keys(payload).length === 0) return { stripped, err: null };
  }
  return { stripped, err: { message: "drift retry cap hit" } };
}
