import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";

/**
 * GET /api/admin/audit
 *
 * Reverse-chronological feed of admin actions. Renders the
 * /admin/audit page. We surface the structured columns plus a
 * stringified summary so the UI doesn't have to know every action's
 * shape — a single ticker can show "issam@x trashed 7 sessions
 * 2 minutes ago".
 *
 * The IP hash is intentionally NOT returned. Even the audit screen
 * doesn't see it; the column exists in the database for forensics
 * if a future incident needs it.
 *
 * Pagination: optional `?before=<ISO timestamp>` for "older" page.
 * Default page size 100.
 */

export const runtime = "nodejs";

const PAGE_SIZE = 100;

type AuditRow = {
  id: string;
  ts: string;
  admin_email: string;
  action: string;
  target_table: string | null;
  target_id: string | null;
  target_count: number | null;
  meta: Record<string, unknown> | null;
};

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;

  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: true, items: [] });
  }
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ ok: true, items: [] });

  const before = req.nextUrl.searchParams.get("before");
  let q = supabase
    .from("admin_audit")
    .select(
      "id, ts, admin_email, action, target_table, target_id, target_count, meta"
    )
    .order("ts", { ascending: false })
    .limit(PAGE_SIZE);
  if (before) q = q.lt("ts", before);

  const { data, error } = await q;
  if (error) {
    // Migration 0014 not applied → render empty rather than 500.
    return NextResponse.json({ ok: true, items: [] });
  }

  return NextResponse.json({
    ok: true,
    items: (data ?? []) as AuditRow[],
  });
}
