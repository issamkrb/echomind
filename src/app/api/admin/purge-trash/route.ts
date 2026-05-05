import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { recordAdminAction } from "@/lib/admin/audit";

/**
 * Hard-delete soft-deleted rows whose `deleted_at` is older than
 * 24 hours. Two callers:
 *
 *   1. Vercel Cron — wired in `vercel.json` to fire hourly. The
 *      cron request carries `Authorization: Bearer <CRON_SECRET>`
 *      (per Vercel's contract). We accept that as auth.
 *
 *   2. Manual operator click on /admin/controls or /admin/trash.
 *      This goes through the regular admin gate (token + email).
 *
 * What it deletes:
 *   - sessions whose deleted_at < now() - 24h. The linked Storage
 *     blobs (`audio_path`, `peak_frame_path`) are removed from the
 *     `session-recordings` bucket BEFORE the row, so a failed row
 *     delete leaves the blob also gone (less leakage) rather than
 *     an orphaned blob with no row.
 *   - visitor_logs whose deleted_at < now() - 24h
 *   - testimonials whose deleted_at < now() - 24h
 *
 * Idempotent. If nothing is past the cutoff, returns
 * `{ ok: true, purged: { … all zeros } }`.
 *
 * Audited via `admin_audit` with action="purge".
 */

export const runtime = "nodejs";

const TRASH_TTL_MS = 24 * 60 * 60 * 1000;
const STORAGE_BUCKET = "session-recordings";

type PurgeStats = {
  sessions: number;
  visitor_logs: number;
  testimonials: number;
  storage_objects: number;
};

function isCronCall(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const auth = req.headers.get("authorization");
  if (!auth) return false;
  return auth === `Bearer ${cronSecret}`;
}

export async function POST(req: NextRequest) {
  // Cron callers skip the user-side admin gate but still need
  // CRON_SECRET to be configured. Manual clicks go through the
  // normal admin gate.
  let adminEmail = "system:cron";
  if (!isCronCall(req)) {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.response;
    adminEmail = gate.adminEmail;
  }

  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: true, purged: emptyStats() });
  }
  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, purged: emptyStats() });
  }

  const cutoff = new Date(Date.now() - TRASH_TTL_MS).toISOString();
  const stats: PurgeStats = emptyStats();

  // ── sessions ────────────────────────────────────────────────────
  // We need the storage paths BEFORE deleting the row, so the blobs
  // can be removed too. If the storage delete fails we still drop
  // the row (worst-case orphaned blob, which the bucket lifecycle
  // policy can sweep up later).
  try {
    const { data: sessRows } = await supabase
      .from("sessions")
      .select("id, audio_path, peak_frame_path")
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff)
      .limit(1000);

    const sessIds = (sessRows ?? []).map((r) => r.id as string);
    const blobPaths: string[] = [];
    for (const r of sessRows ?? []) {
      const a = r.audio_path as string | null;
      const p = r.peak_frame_path as string | null;
      if (a) blobPaths.push(a);
      if (p) blobPaths.push(p);
    }

    if (blobPaths.length > 0) {
      const { data: removed } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove(blobPaths);
      stats.storage_objects = removed?.length ?? 0;
    }

    if (sessIds.length > 0) {
      const { error, count } = await supabase
        .from("sessions")
        .delete({ count: "exact" })
        .in("id", sessIds);
      if (error) {
        console.warn("[purge] sessions delete failed:", error.message);
      } else {
        stats.sessions = count ?? 0;
      }
    }
  } catch (e) {
    console.warn("[purge] sessions block threw:", e);
  }

  // ── visitor_logs ────────────────────────────────────────────────
  try {
    const { error, count } = await supabase
      .from("visitor_logs")
      .delete({ count: "exact" })
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff);
    if (error) {
      console.warn("[purge] visitor_logs delete failed:", error.message);
    } else {
      stats.visitor_logs = count ?? 0;
    }
  } catch (e) {
    console.warn("[purge] visitor_logs block threw:", e);
  }

  // ── testimonials ────────────────────────────────────────────────
  try {
    const { error, count } = await supabase
      .from("testimonials")
      .delete({ count: "exact" })
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff);
    if (error) {
      console.warn("[purge] testimonials delete failed:", error.message);
    } else {
      stats.testimonials = count ?? 0;
    }
  } catch (e) {
    console.warn("[purge] testimonials block threw:", e);
  }

  await recordAdminAction(req, {
    adminEmail,
    action: "purge",
    targetCount:
      stats.sessions + stats.visitor_logs + stats.testimonials,
    meta: stats as unknown as Record<string, unknown>,
  });

  return NextResponse.json({ ok: true, purged: stats });
}

// Vercel Cron sends GET by default. Accept both.
export const GET = POST;

function emptyStats(): PurgeStats {
  return {
    sessions: 0,
    visitor_logs: 0,
    testimonials: 0,
    storage_objects: 0,
  };
}
