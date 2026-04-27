/**
 * Helpers for tolerating Supabase schema drift — i.e. a live database
 * that's missing one or more columns the app references because the
 * project is behind on `supabase/migrations/`.
 *
 * Both PostgREST and Postgres surface "column doesn't exist" failures,
 * but with different codes and message wordings. supabase-js most
 * often returns:
 *
 *   - PGRST204  (PostgREST schema-cache miss on insert/update):
 *       Could not find the 'foo' column of 'sessions' in the schema cache
 *   - 42703     (Postgres native undefined_column on select/where):
 *       column "foo" of relation "sessions" does not exist
 *
 * Occasional variants drop quotes or omit the relation suffix. We
 * deliberately don't gate detection on a specific error code — the
 * message-shape parser is the source of truth, and any error whose
 * message names a missing column is treated as recoverable schema
 * drift. Read paths fall back to `select("*")`; write paths drop the
 * named column from the payload and retry.
 */

/** Extract a column name from a missing-column error message, or
 *  return null if the message doesn't look like a missing-column
 *  failure. */
export function parseMissingColumn(message: string): string | null {
  // PostgREST: Could not find the 'foo' column of 'sessions' in the schema cache
  const m1 = message.match(
    /Could not find the ['"]?([A-Za-z0-9_]+)['"]?\s+column/i
  );
  if (m1) return m1[1];
  // Postgres: column "foo" of relation "sessions" does not exist
  const m2 = message.match(/column\s+"([A-Za-z0-9_]+)"\s+of\s+relation/i);
  if (m2) return m2[1];
  // Postgres alt: column foo does not exist
  const m3 = message.match(/column\s+([A-Za-z0-9_]+)\s+does\s+not\s+exist/i);
  if (m3) return m3[1];
  return null;
}

/** Convenience predicate: does this supabase-js error look like a
 *  missing-column failure that read paths should handle by falling
 *  back to `select("*")`? */
export function looksLikeMissingColumn(
  err: { code?: string; message?: string } | null | undefined
): boolean {
  if (!err) return false;
  return parseMissingColumn(err.message ?? "") !== null;
}
