import { getServerSupabase } from "@/lib/supabase";
import { parseMissingColumn } from "@/lib/schema-drift";

/**
 * Server-side safety net for "live" rows whose client never sent
 * the explicit end signal — i.e. the user closed the tab without
 * the pagehide/beacon getting through (Safari iOS, force-quit,
 * crashed renderer, etc.). Without this, the operator dashboard
 * would show a session pinned at status="live" forever with a
 * frozen elapsed counter (last_heartbeat_at no longer advances).
 *
 * For any sessions row whose status="live" and whose
 * last_heartbeat_at is older than `thresholdSeconds` (default 30s),
 * we flip it to:
 *
 *   - status="ended"
 *   - ended_at = last_heartbeat_at (the last sign of life)
 *
 * Tolerates schema drift the same way the rest of the app does:
 * if the status / ended_at / last_heartbeat_at columns aren't on
 * the live database, we silently bail out with a stripped-columns
 * note rather than failing the caller. This keeps the admin
 * dashboard usable on a database that hasn't run migration 0010+.
 */
export async function finishStaleLiveSessions(
  thresholdSeconds = 30
): Promise<{ finished: number; stripped: string[]; error: string | null }> {
  const supabase = getServerSupabase();
  if (!supabase) return { finished: 0, stripped: [], error: null };

  const cutoff = new Date(Date.now() - thresholdSeconds * 1000).toISOString();

  // Find candidates first so we can:
  //   (a) bail out quickly when nothing is stale (no UPDATE round-trip)
  //   (b) preserve last_heartbeat_at as the ended_at value, per row,
  //       which is more truthful than stamping every stale row with
  //       the same now() — different sessions died at different times.
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, last_heartbeat_at, created_at, final_fingerprint, audio_seconds, revenue_estimate"
    )
    .eq("status", "live")
    .lt("last_heartbeat_at", cutoff)
    .limit(200);

  if (error) {
    // Missing column on a drifted DB → caller doesn't need to know,
    // and there's nothing we can usefully do.
    if (parseMissingColumn(error.message ?? "")) {
      return { finished: 0, stripped: ["status"], error: null };
    }
    return { finished: 0, stripped: [], error: error.message };
  }

  type StaleRow = {
    id: string;
    last_heartbeat_at: string | null;
    created_at: string | null;
    final_fingerprint: Record<string, number> | null;
    audio_seconds: number | null;
    revenue_estimate: number | null;
  };
  const candidates = (data ?? []) as StaleRow[];
  if (candidates.length === 0) {
    return { finished: 0, stripped: [], error: null };
  }

  let finished = 0;
  const strippedAll = new Set<string>();
  for (const row of candidates) {
    const endedAt = row.last_heartbeat_at ?? new Date().toISOString();

    // Also materialise a non-zero revenue_estimate when the session
    // died before finalizeAndLeave could write one. Without this the
    // auction view for a force-quit session shows "$0.00 SOLD" for
    // every buyer. Same ladder as the intent=end handler:
    //   row's stored revenue → fingerprint formula → duration floor.
    const createdAtMs = row.created_at
      ? new Date(row.created_at).getTime()
      : new Date(endedAt).getTime();
    const elapsedSec = Math.max(
      0,
      Math.floor((new Date(endedAt).getTime() - createdAtMs) / 1000)
    );
    const fp = row.final_fingerprint ?? {};
    const fromFp = Math.max(
      0,
      Number(fp.vulnerability ?? 0) * 50 + Number(fp.sad ?? 0) * 80
    );
    const floor = Math.round(18 + Math.min(elapsedSec, 600) * 0.55);
    const resolvedRevenue = Math.max(
      Number(row.revenue_estimate ?? 0),
      Math.round(fromFp),
      floor
    );

    let payload: Record<string, unknown> = {
      status: "ended",
      ended_at: endedAt,
      revenue_estimate: resolvedRevenue,
    };
    let attempts = 0;
    while (attempts <= Object.keys(payload).length) {
      const res = await supabase
        .from("sessions")
        .update(payload)
        .eq("id", row.id);
      if (!res.error) {
        finished += 1;
        break;
      }
      const missing = parseMissingColumn(res.error.message ?? "");
      if (!missing || !(missing in payload)) break;
      strippedAll.add(missing);
      const next = { ...payload };
      delete next[missing];
      payload = next;
      attempts += 1;
      if (Object.keys(payload).length === 0) break;
    }
  }

  return {
    finished,
    stripped: Array.from(strippedAll),
    error: null,
  };
}
