import type { NextRequest } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { hashRequestIp, hashRequestUa } from "@/lib/security/ip";

/**
 * Writes a single row to `security_events`. Used by the security
 * guard whenever it 4xx's a request — rate-limit, bad origin,
 * blocked IP, validation failure, bad admin token.
 *
 * Failure to write is non-fatal and silent: an audit log that
 * crashes the request path it's auditing would be worse than the
 * gap in the log.
 */

export type SecurityEvent = {
  status: number;
  reason: string;
  /** Free-form metadata (route bucket, validation field, …). Kept
   *  small to avoid bloating the table. */
  meta?: Record<string, unknown>;
};

export async function recordSecurityEvent(
  req: NextRequest,
  evt: SecurityEvent
): Promise<void> {
  if (!supabaseConfigured()) return;
  const db = getServerSupabase();
  if (!db) return;

  const ipHash = hashRequestIp(req);
  const uaHash = hashRequestUa(req);
  const path = req.nextUrl.pathname;
  const method = req.method;

  const { error } = await db.from("security_events").insert({
    ip_hash: ipHash ? (ipHash as unknown as string) : null,
    ua_hash: uaHash ? (uaHash as unknown as string) : null,
    path,
    method,
    status: evt.status,
    reason: evt.reason,
    meta: evt.meta ?? null,
  });
  if (error) {
    console.warn("[security-log] insert failed:", error.message);
  }
}
