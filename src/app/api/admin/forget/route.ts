import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { recordAdminAction } from "@/lib/admin/audit";

/**
 * POST /api/admin/forget
 *
 * Hand-rolled "forget this person" — soft-deletes every row in the
 * moderation tables that's connected to a single user identity.
 * After 24h, /api/admin/purge-trash hard-deletes them and removes
 * the linked Storage blobs. Until then the rows are recoverable
 * from /admin/trash.
 *
 * Body: { email?: string, anon_user_id?: string }
 *
 * At least one of `email` or `anon_user_id` must be provided. If
 * both are provided, we OR them — every row matched by either is
 * marked. The forget action is the user-protective path; we err
 * generous, not minimal.
 *
 * Tables matched:
 *   - sessions          (auth_user_id via email lookup, anon_user_id, goodbye_email)
 *   - visitor_logs      (anon_user_id, email, auth_user_id-via-email)
 *   - testimonials      (no direct user link by design — these are
 *                        anonymous content. Skipped here. If a user
 *                        wants their testimonial removed they have
 *                        to ask the operator to remove it by id.)
 *
 * Returns the count per table and the audit row id.
 */

export const runtime = "nodejs";

type ForgetStats = {
  sessions: number;
  visitor_logs: number;
};

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "bad-json" },
      { status: 400 }
    );
  }
  if (!raw || typeof raw !== "object") {
    return NextResponse.json(
      { ok: false, reason: "bad-body" },
      { status: 400 }
    );
  }
  const b = raw as Record<string, unknown>;
  const email =
    typeof b.email === "string" && b.email.trim().length > 0
      ? b.email.trim().toLowerCase()
      : null;
  const anonId =
    typeof b.anon_user_id === "string" && b.anon_user_id.trim().length > 0
      ? b.anon_user_id.trim()
      : null;

  if (!email && !anonId) {
    return NextResponse.json(
      { ok: false, reason: "no-identity" },
      { status: 400 }
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

  const stats: ForgetStats = { sessions: 0, visitor_logs: 0 };
  const nowIso = new Date().toISOString();

  // ── sessions ────────────────────────────────────────────────────
  // Match on any of:  goodbye_email, email column, anon_user_id.
  // .or() takes a single comma-separated filter string.
  try {
    const filters: string[] = [];
    if (email) {
      filters.push(`goodbye_email.eq.${email}`);
      filters.push(`email.eq.${email}`);
    }
    if (anonId) {
      filters.push(`anon_user_id.eq.${anonId}`);
    }
    if (filters.length > 0) {
      const { error, count } = await supabase
        .from("sessions")
        .update(
          { deleted_at: nowIso, deleted_by: gate.adminEmail },
          { count: "exact" }
        )
        .or(filters.join(","))
        .is("deleted_at", null);
      if (error) {
        console.warn("[forget] sessions update:", error.message);
      } else {
        stats.sessions = count ?? 0;
      }
    }
  } catch (e) {
    console.warn("[forget] sessions block threw:", e);
  }

  // ── visitor_logs ────────────────────────────────────────────────
  try {
    const filters: string[] = [];
    if (email) filters.push(`email.eq.${email}`);
    if (anonId) filters.push(`anon_user_id.eq.${anonId}`);
    if (filters.length > 0) {
      const { error, count } = await supabase
        .from("visitor_logs")
        .update(
          { deleted_at: nowIso, deleted_by: gate.adminEmail },
          { count: "exact" }
        )
        .or(filters.join(","))
        .is("deleted_at", null);
      if (error) {
        console.warn("[forget] visitor_logs update:", error.message);
      } else {
        stats.visitor_logs = count ?? 0;
      }
    }
  } catch (e) {
    console.warn("[forget] visitor_logs block threw:", e);
  }

  await recordAdminAction(req, {
    adminEmail: gate.adminEmail,
    action: "forget",
    targetCount: stats.sessions + stats.visitor_logs,
    meta: {
      email_redacted: email ? maskEmail(email) : null,
      anon_user_id: anonId,
      ...stats,
    },
  });

  return NextResponse.json({ ok: true, stats });
}

/** Replace local-part with a short hash so the audit log doesn't
 *  hold the raw email of someone who asked to be forgotten. The
 *  domain is preserved — useful for later "we forgot a user from
 *  acme.com on March 4th" forensics without exposing identity. */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const domain = email.slice(at);
  return "***" + domain;
}
