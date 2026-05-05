import type { NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { hashRequestIp } from "@/lib/security/ip";

/**
 * Append-only audit logger for admin actions.
 *
 * Every mutation by an admin (trash, restore, purge, flag flip,
 * forget-user, export, etc.) writes a row to `admin_audit`. The
 * `/admin/audit` page renders these in reverse-chronological order
 * so even the operator can be watched.
 *
 * Failure-tolerant: if the insert fails, we log to console and let
 * the calling action proceed. The audit log is for visibility, not
 * for blocking the action.
 */

export type AdminAuditEvent = {
  adminEmail: string;
  /**
   * Verb describing what happened. Loose vocabulary so we can add
   * new actions without an enum migration. Common values:
   *   "trash" / "restore" / "purge"
   *   "flag.set" / "forget" / "export.manifest"
   */
  action: string;
  /** Which table the action targeted (`sessions`, `visitor_logs`, …). */
  targetTable?: string | null;
  /** Single-target row id (UUID or text id), or null for bulk actions. */
  targetId?: string | null;
  /** For bulk actions, how many rows were affected. */
  targetCount?: number | null;
  /** Free-form metadata (id list, before/after, reason, …). */
  meta?: Record<string, unknown> | null;
};

export async function recordAdminAction(
  req: NextRequest,
  evt: AdminAuditEvent
): Promise<void> {
  const supabase = getServerSupabase();
  if (!supabase) return;

  const ipHash = hashRequestIp(req);

  try {
    const { error } = await supabase.from("admin_audit").insert({
      admin_email: evt.adminEmail,
      action: evt.action,
      target_table: evt.targetTable ?? null,
      target_id: evt.targetId ?? null,
      target_count: evt.targetCount ?? null,
      meta: evt.meta ?? null,
      ip_hash: ipHash,
    });
    if (error) {
      // Don't block the action — just surface in server logs.
      console.warn("[admin-audit] insert failed:", error.message);
    }
  } catch (e) {
    console.warn("[admin-audit] insert threw:", e);
  }
}
