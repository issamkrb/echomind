import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { recordAdminAction } from "@/lib/admin/audit";
import {
  isTrashableTable,
  restore,
  trash,
  type TrashableTable,
} from "@/lib/admin/trash";

/**
 * POST /api/admin/moderate
 *
 * Single endpoint that handles both soft-delete ("trash") and
 * undo ("restore") for every soft-deletable entity. The frontend
 * calls this with a single fetch from the dashboard, the trash
 * page, the gallery, and the bulk-select toolbar.
 *
 * Body:
 *   {
 *     action: "trash" | "restore",
 *     table:  "sessions" | "visitor_logs" | "testimonials",
 *     ids:    string[],            // 1..500
 *     reason?: string              // free-form note for the audit log
 *   }
 *
 * Response:
 *   { ok: true, table, count }     // count of rows actually changed
 *
 * Auditing: every successful call writes a row to `admin_audit`. The
 * audit row carries the full id list in `meta.ids` so a future
 * forensics screen can answer "which sessions did Issam soft-delete
 * on March 4th and why?" without joining against the (possibly
 * already purged) target tables.
 *
 * Errors:
 *   401 — bad token / not admin
 *   400 — bad body / unknown table / empty ids
 *   500 — db write failed
 */

export const runtime = "nodejs";

const MAX_IDS = 500;

function parseBody(body: unknown): {
  action: "trash" | "restore";
  table: TrashableTable;
  ids: string[];
  reason: string | null;
} | { error: string } {
  if (!body || typeof body !== "object") return { error: "bad-body" };
  const b = body as Record<string, unknown>;

  const action = b.action;
  if (action !== "trash" && action !== "restore") {
    return { error: "bad-action" };
  }

  const table = b.table;
  if (typeof table !== "string" || !isTrashableTable(table)) {
    return { error: "bad-table" };
  }

  const idsRaw = b.ids;
  if (!Array.isArray(idsRaw) || idsRaw.length === 0) {
    return { error: "empty-ids" };
  }
  if (idsRaw.length > MAX_IDS) return { error: "too-many-ids" };

  const ids: string[] = [];
  for (const x of idsRaw) {
    if (typeof x !== "string" || x.length === 0 || x.length > 64) {
      return { error: "bad-id" };
    }
    ids.push(x);
  }

  const reason =
    typeof b.reason === "string" && b.reason.length <= 240
      ? b.reason
      : null;

  return { action, table, ids, reason };
}

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

  const parsed = parseBody(raw);
  if ("error" in parsed) {
    return NextResponse.json(
      { ok: false, reason: parsed.error },
      { status: 400 }
    );
  }

  const result =
    parsed.action === "trash"
      ? await trash(parsed.table, parsed.ids, gate.adminEmail)
      : await restore(parsed.table, parsed.ids);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, reason: "db-write-failed", detail: result.error },
      { status: 500 }
    );
  }

  await recordAdminAction(req, {
    adminEmail: gate.adminEmail,
    action: parsed.action,
    targetTable: parsed.table,
    targetCount: result.count,
    meta: {
      ids: parsed.ids,
      requested: parsed.ids.length,
      affected: result.count,
      reason: parsed.reason,
    },
  });

  return NextResponse.json({
    ok: true,
    table: result.table,
    count: result.count,
  });
}
