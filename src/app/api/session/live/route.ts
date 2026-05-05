import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { getServerAuthSupabase } from "@/lib/supabase-server";
import { parseMissingColumn } from "@/lib/schema-drift";
import { guard } from "@/lib/security/guard";

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
 *   - intent="end" — called once when the user leaves /session for
 *     ANY reason: explicit "i feel lighter now" click, browser tab
 *     close (sent via navigator.sendBeacon on pagehide), or in-app
 *     route change. Flips status to "ended" and stamps ended_at so
 *     the admin dashboard immediately drops the LIVE pill. The
 *     route is idempotent — re-ending an already-ended session is
 *     a no-op. The server-side stale-finisher in admin-sessions-
 *     fetch.ts is a safety net for the cases where this beacon
 *     itself never lands (Safari iOS, force-quit, etc.).
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

type EndBody = {
  intent: "end";
  session_id: string;
  /** Optional: how the session ended. "button" | "pagehide" |
   *  "route". Captured for ops curiosity only — the dashboard
   *  treats every ended row the same. */
  reason?: string;
  /** Optional final snapshot from the client — used by the unload
   *  beacon so tab-close sessions still carry a fingerprint /
   *  transcript / revenue into the auction view. If the client
   *  doesn't supply these (e.g. very old cached bundles), the
   *  server falls back to whatever the last heartbeat tick wrote
   *  and to a duration-based revenue floor. */
  final_fingerprint?: Record<string, number>;
  audio_seconds?: number;
  revenue_estimate?: number;
  transcript?: { role: "user" | "echo"; text: string; t: number }[];
  keywords?: string[];
  peak_quote?: string;
};

type Body = StartBody | TickBody | EndBody;

export async function POST(req: NextRequest) {
  // The session heartbeat fires every ~5s during a live session; a
  // single user can therefore make ~12/min. We allow 240/min/IP so
  // a tab refresh, a navigation back+forward, or a /portfolio side
  // tab still has plenty of headroom. Above that is not a normal
  // browser tab.
  const blocked = await guard(req, {
    bucket: "api:session:live",
    limit: 240,
    windowSeconds: 60,
  });
  if (blocked) return blocked;

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

  if (body.intent === "end") {
    if (!body.session_id || typeof body.session_id !== "string") {
      return NextResponse.json(
        { ok: false, reason: "session_id required" },
        { status: 400 }
      );
    }

    // Read current row state so we can:
    //   1. Preserve tick-written fingerprint / transcript when the
    //      client's unload beacon shipped empty fields (or on legacy
    //      bundles that didn't know about the new end-payload shape).
    //   2. Compute a revenue floor from the actual row lifetime when
    //      the session ended too fast for any tick to land — pre-fix,
    //      a user who opened /session and immediately closed the tab
    //      got revenue_estimate = 0 and the auction view rendered
    //      "$0.00 SOLD" for every buyer, which broke the narrative.
    const { data: existing } = await supabase
      .from("sessions")
      .select(
        "created_at, final_fingerprint, audio_seconds, revenue_estimate, transcript, keywords, peak_quote"
      )
      .eq("id", body.session_id)
      .single();
    const existingFp =
      (existing?.final_fingerprint as Record<string, number> | null) || {};
    const existingAudioSec = Number(existing?.audio_seconds ?? 0);
    const existingRevenue = Number(existing?.revenue_estimate ?? 0);
    const createdAtMs = existing?.created_at
      ? new Date(existing.created_at as string).getTime()
      : Date.now();

    const incomingFp =
      body.final_fingerprint && typeof body.final_fingerprint === "object"
        ? (body.final_fingerprint as Record<string, number>)
        : null;
    const incomingAudioSec =
      typeof body.audio_seconds === "number" && body.audio_seconds >= 0
        ? Math.floor(body.audio_seconds)
        : null;
    const incomingRevenue =
      typeof body.revenue_estimate === "number" && body.revenue_estimate >= 0
        ? Math.floor(body.revenue_estimate)
        : null;

    // Resolve the values we'll persist. Prefer the client's unload
    // snapshot; fall back to whatever the last tick left in the row.
    const finalFp = incomingFp ?? existingFp;
    const finalAudioSec = incomingAudioSec ?? existingAudioSec;

    // Revenue ladder:
    //   · If the client sent an explicit figure, honour it.
    //   · Else use whatever the row already had (heartbeat writes
    //     zero, but finalizeAndLeave via the "I feel lighter now"
    //     path writes the real computed number).
    //   · Else compute from the fingerprint using the same formula
    //     the client uses in finalizeAndLeave().
    //   · Floor everything at a duration-based minimum so even a
    //     5-second session isn't $0.00 — every emotional data
    //     point carries a price in the auction view, so shipping
    //     literal zero is off-narrative.
    const sessionElapsedSec = Math.max(
      0,
      Math.floor((Date.now() - createdAtMs) / 1000)
    );
    const computedFromFp =
      Math.max(
        0,
        Number(finalFp.vulnerability ?? 0) * 50 +
          Number(finalFp.sad ?? 0) * 80
      );
    const revenueFloor = Math.round(
      18 + Math.min(sessionElapsedSec, 600) * 0.55
    );
    const resolvedRevenue = Math.max(
      incomingRevenue ?? 0,
      existingRevenue,
      Math.round(computedFromFp),
      revenueFloor
    );

    const patch: Record<string, unknown> = {
      status: "ended",
      ended_at: new Date().toISOString(),
    };
    // Only write fields the client actually supplied OR that we had
    // to synthesise — don't clobber heartbeat-written fingerprints
    // with `null`.
    if (incomingFp) patch.final_fingerprint = finalFp;
    if (incomingAudioSec !== null) patch.audio_seconds = finalAudioSec;
    patch.revenue_estimate = resolvedRevenue;
    // Cap to the same limits log-session and the tick handler
    // enforce so a broken / runaway client can't explode a row via
    // the unload beacon. Mirrors `src/app/api/session/live/route.ts`
    // tick handling at ~L198-205.
    if (Array.isArray(body.transcript) && body.transcript.length > 0) {
      patch.transcript = body.transcript.slice(-200);
    }
    if (Array.isArray(body.keywords) && body.keywords.length > 0) {
      patch.keywords = body.keywords.slice(0, 64);
    }
    if (typeof body.peak_quote === "string" && body.peak_quote.trim()) {
      patch.peak_quote = body.peak_quote;
    }

    const { stripped, err } = await updateWithDrift(
      supabase,
      "sessions",
      body.session_id,
      patch
    );
    if (err) {
      console.warn("[session/live/end] update failed:", err);
      return NextResponse.json(
        { ok: false, reason: "db-update-failed", detail: err.message ?? "" },
        { status: 200 }
      );
    }
    return NextResponse.json({
      ok: true,
      stripped,
      revenue: resolvedRevenue,
    });
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
