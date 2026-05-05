import { getServerSupabase } from "@/lib/supabase";

/**
 * App-flag accessors. Flags live in the `app_flags` table (migration
 * 0014) and are read by the admin controls page, the middleware
 * (maintenance_mode), and the user-facing API routes that need to
 * respect kill-switches (/api/echo, /api/submit-testimonial, …).
 *
 * Reads are cached in-memory for 30s so a busy /api/echo route
 * doesn't slam Supabase with a flag lookup on every conversation
 * turn. The cache is per-server-instance (Vercel cold-warm cycle)
 * which is fine — when an admin flips a flag, the longest a stale
 * value can survive is 30s.
 */

export const FLAG_KEYS = {
  PAUSE_SESSIONS: "pause_sessions",
  PAUSE_TESTIMONIALS: "pause_testimonials",
  MAINTENANCE_MODE: "maintenance_mode",
} as const;

export type FlagKey = (typeof FLAG_KEYS)[keyof typeof FLAG_KEYS];

export type AppFlag = {
  key: string;
  value: boolean;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
};

const CACHE_TTL_MS = 30_000;
type CacheEntry = { at: number; value: boolean };
const flagCache = new Map<string, CacheEntry>();

/**
 * Read a single flag value. Defaults to `false` (everything
 * operational) when the flag is missing, the table doesn't exist,
 * or Supabase is unavailable. The kill-switch posture is fail-open
 * — a broken flag table should not lock the operator out of their
 * own product.
 */
export async function getFlag(key: FlagKey | string): Promise<boolean> {
  const now = Date.now();
  const cached = flagCache.get(key);
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    flagCache.set(key, { at: now, value: false });
    return false;
  }

  try {
    const { data, error } = await supabase
      .from("app_flags")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      // Most likely cause: migration 0014 hasn't been applied yet.
      // Fall back to operational.
      flagCache.set(key, { at: now, value: false });
      return false;
    }

    const value = Boolean(data?.value);
    flagCache.set(key, { at: now, value });
    return value;
  } catch {
    flagCache.set(key, { at: now, value: false });
    return false;
  }
}

/** Read all flags for the admin controls page. */
export async function listFlags(): Promise<AppFlag[]> {
  const supabase = getServerSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("app_flags")
    .select("key, value, description, updated_by, updated_at")
    .order("key", { ascending: true });

  if (error) return [];
  return (data ?? []) as AppFlag[];
}

/**
 * Write a flag. Upserts on `key`. Updates the in-memory cache
 * immediately so the next read on this server instance is fresh.
 */
export async function setFlag(
  key: FlagKey | string,
  value: boolean,
  by: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServerSupabase();
  if (!supabase) return { ok: false, error: "supabase-unavailable" };

  const { error } = await supabase
    .from("app_flags")
    .upsert(
      {
        key,
        value,
        updated_by: by,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

  if (error) return { ok: false, error: error.message };

  flagCache.set(key, { at: Date.now(), value });
  return { ok: true };
}

/** Test-only / signal helper to clear the in-memory cache. */
export function clearFlagCache() {
  flagCache.clear();
}
