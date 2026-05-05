import { getServerSupabase } from "@/lib/supabase";

/**
 * Soft-delete / restore primitives shared by the admin moderation
 * routes. Sets `deleted_at` and `deleted_by` for "trash", clears
 * both for "restore". The 24h purge cron uses `deleted_at` as the
 * cutoff signal.
 *
 * Tables that support soft-delete:
 *   - sessions
 *   - visitor_logs
 *   - testimonials
 *
 * Other tables MUST NOT be passed in — the route layer validates
 * before calling here, but we re-validate to keep this primitive
 * safe to import anywhere.
 */

export const TRASHABLE_TABLES = [
  "sessions",
  "visitor_logs",
  "testimonials",
] as const;
export type TrashableTable = (typeof TRASHABLE_TABLES)[number];

export function isTrashableTable(t: string): t is TrashableTable {
  return (TRASHABLE_TABLES as readonly string[]).includes(t);
}

export type TrashResult = {
  ok: boolean;
  table: TrashableTable;
  count: number;
  error?: string;
};

/** Soft-delete by id list. No-op if `ids` is empty. */
export async function trash(
  table: TrashableTable,
  ids: string[],
  adminEmail: string
): Promise<TrashResult> {
  if (ids.length === 0) return { ok: true, table, count: 0 };

  const supabase = getServerSupabase();
  if (!supabase) {
    return { ok: false, table, count: 0, error: "supabase-unavailable" };
  }

  const { error, count } = await supabase
    .from(table)
    .update(
      {
        deleted_at: new Date().toISOString(),
        deleted_by: adminEmail,
      },
      { count: "exact" }
    )
    .in("id", ids)
    .is("deleted_at", null);

  if (error) {
    return { ok: false, table, count: 0, error: error.message };
  }

  return { ok: true, table, count: count ?? 0 };
}

/** Clear `deleted_at` / `deleted_by` for the given ids. No-op if empty. */
export async function restore(
  table: TrashableTable,
  ids: string[]
): Promise<TrashResult> {
  if (ids.length === 0) return { ok: true, table, count: 0 };

  const supabase = getServerSupabase();
  if (!supabase) {
    return { ok: false, table, count: 0, error: "supabase-unavailable" };
  }

  const { error, count } = await supabase
    .from(table)
    .update(
      { deleted_at: null, deleted_by: null },
      { count: "exact" }
    )
    .in("id", ids)
    .not("deleted_at", "is", null);

  if (error) {
    return { ok: false, table, count: 0, error: error.message };
  }

  return { ok: true, table, count: count ?? 0 };
}
