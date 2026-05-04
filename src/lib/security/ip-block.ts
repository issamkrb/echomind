import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";

/**
 * Escalating IP block list.
 *
 * The flow:
 *   1. A request hits a route. The `guard()` helper consults
 *      `isIpBlocked` first — if a row exists and `now() < blocked_until`,
 *      we return 404 (not 429: a 404 is indistinguishable from "this
 *      route doesn't exist", which gives the attacker no signal).
 *   2. If the request makes it past that and then trips the rate
 *      limiter, `recordIpStrike` is called. This either creates a
 *      fresh `ip_blocks` row or bumps an existing one's `hit_count`.
 *   3. The `blocked_until` for the row is computed by a doubling
 *      backoff:
 *          1st strike   →   2 minutes
 *          2nd strike   →   8 minutes
 *          3rd strike   →  30 minutes
 *          4th strike   →   2 hours
 *          5th strike   →   8 hours
 *          6th+ strike  →  24 hours (capped)
 *      That way a bot doing one rate-limit ping every few minutes
 *      gets through quickly, but a determined brute-forcer ends up
 *      effectively muted for a day.
 *
 * Same fail-open posture as the rate limiter: if Supabase is down
 * we don't pretend to know about the block list.
 */

const STRIKE_BAN_MINUTES: ReadonlyArray<number> = [
  2,    // 1st strike
  8,    // 2nd
  30,   // 3rd
  120,  // 4th = 2h
  480,  // 5th = 8h
  1440, // 6th+ = 24h
];

export type IpBlockState = { blocked: true; until: Date } | { blocked: false };

export async function isIpBlocked(keyHash: Buffer): Promise<IpBlockState> {
  if (!supabaseConfigured()) return { blocked: false };
  const db = getServerSupabase();
  if (!db) return { blocked: false };

  const { data, error } = await db
    .from("ip_blocks")
    .select("blocked_until")
    .eq("ip_hash", keyHash as unknown as string)
    .gt("blocked_until", new Date().toISOString())
    .maybeSingle();
  if (error || !data?.blocked_until) return { blocked: false };
  return { blocked: true, until: new Date(data.blocked_until as string) };
}

/**
 * Record a rate-limit strike for an IP and compute / extend its
 * block-until window. Idempotent in the sense that calling it twice
 * for the same IP-instant just bumps the hit count once per call.
 */
export async function recordIpStrike(
  keyHash: Buffer,
  reason: string
): Promise<void> {
  if (!supabaseConfigured()) return;
  const db = getServerSupabase();
  if (!db) return;

  const now = new Date();
  // Read the existing row (if any) to get the prior hit_count so we
  // can compute the right escalation tier.
  const { data: existing } = await db
    .from("ip_blocks")
    .select("hit_count")
    .eq("ip_hash", keyHash as unknown as string)
    .maybeSingle();

  const priorHits = existing?.hit_count ?? 0;
  const tier = Math.min(priorHits, STRIKE_BAN_MINUTES.length - 1);
  const banMinutes = STRIKE_BAN_MINUTES[tier] ?? 1440;
  const blockedUntil = new Date(now.getTime() + banMinutes * 60_000);

  // Upsert by ip_hash. On conflict we bump the hit count, push out
  // blocked_until, and refresh last_offense_at.
  const { error } = await db
    .from("ip_blocks")
    .upsert(
      {
        ip_hash: keyHash as unknown as string,
        first_offense_at: existing ? undefined : now.toISOString(),
        last_offense_at: now.toISOString(),
        hit_count: priorHits + 1,
        blocked_until: blockedUntil.toISOString(),
        reason,
      },
      { onConflict: "ip_hash" }
    );
  if (error) {
    console.warn("[ip-block] strike upsert failed:", error.message);
  }
}
