import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { recordAdminAction } from "@/lib/admin/audit";
import { listFlags, setFlag } from "@/lib/admin/flags";

/**
 * Operator kill-switches.
 *
 *   GET /api/admin/flags
 *     → { ok: true, flags: [{ key, value, description, updated_by, updated_at }] }
 *
 *   PUT /api/admin/flags
 *     body: { key: string, value: boolean }
 *     → { ok: true, key, value }
 *
 * Flips are audited. `key` is constrained to keys that already exist
 * in `app_flags` (we don't auto-create new flags from an HTTP body —
 * that would let a future XSS introduce silent kill-switches).
 */

export const runtime = "nodejs";

const ALLOWED_KEYS = new Set([
  "pause_sessions",
  "pause_testimonials",
  "maintenance_mode",
]);

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;

  const flags = await listFlags();
  return NextResponse.json({ ok: true, flags });
}

export async function PUT(req: NextRequest) {
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
  const key = b.key;
  const value = b.value;
  if (typeof key !== "string" || !ALLOWED_KEYS.has(key)) {
    return NextResponse.json(
      { ok: false, reason: "unknown-flag" },
      { status: 400 }
    );
  }
  if (typeof value !== "boolean") {
    return NextResponse.json(
      { ok: false, reason: "bad-value" },
      { status: 400 }
    );
  }

  const result = await setFlag(key, value, gate.adminEmail);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, reason: "db-write-failed", detail: result.error },
      { status: 500 }
    );
  }

  await recordAdminAction(req, {
    adminEmail: gate.adminEmail,
    action: "flag.set",
    targetTable: "app_flags",
    targetId: key,
    meta: { value },
  });

  return NextResponse.json({ ok: true, key, value });
}
