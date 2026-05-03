import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";

/**
 * Postgres-backed sliding-window rate limiter.
 *
 * Why Postgres and not Redis: the project is already on Supabase.
 * Adding a second piece of stateful infra (Upstash, Cloudflare KV)
 * would expand the attack surface and the operational footprint.
 * The hot-path cost is two queries (insert + count) which on the
 * Frankfurt Supabase region is ~30–80ms — small enough that even
 * /api/echo's 200ms target stays comfortable.
 *
 * The window is a true sliding window: we ask "how many events from
 * this (bucket, ip) in the last `windowSeconds`?" rather than the
 * cheaper-but-leakier fixed-bucket count. That means a burst at the
 * boundary of two windows can't double the budget.
 *
 * Failure mode: if Supabase is unreachable, we FAIL OPEN. The whole
 * project is designed to keep working without Supabase (visitors
 * still get a session, the LLM proxy still answers). Dropping every
 * request when the DB blips would be a worse failure than briefly
 * losing the limiter. The rate-limit *budgets* themselves are
 * intentionally generous enough that fail-open during a database
 * outage is not a meaningful exfiltration channel.
 */

export type RateLimitResult =
  | { ok: true; remaining: number; limit: number }
  | { ok: false; retryAfterSeconds: number; limit: number };

export type RateLimitOptions = {
  /** Bucket name, e.g. 'api:echo' or 'api:submit-testimonial:body'. */
  bucket: string;
  /** Hashed key for the requester (typically the SHA-256 of the IP). */
  keyHash: Buffer;
  /** How many events are allowed in `windowSeconds`. */
  limit: number;
  /** Sliding window length, in seconds. */
  windowSeconds: number;
};

export async function checkRateLimit(
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  const { bucket, keyHash, limit, windowSeconds } = opts;

  if (!supabaseConfigured()) {
    // No DB — fail open. The route's own validation still applies.
    return { ok: true, remaining: limit, limit };
  }
  const db = getServerSupabase();
  if (!db) return { ok: true, remaining: limit, limit };

  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  // Step 1 — count existing events in this window. We do this BEFORE
  // inserting a new event so that on rejection we don't grow the
  // table forever (and so the count is exact, not off-by-one).
  const { count, error: countErr } = await db
    .from("rate_limit_events")
    .select("*", { count: "exact", head: true })
    .eq("bucket", bucket)
    .eq("key_hash", keyHash as unknown as string) // supabase-js encodes bytea as base64 over the wire
    .gte("ts", since);
  if (countErr) {
    console.warn("[rate-limit] count failed, failing open:", countErr.message);
    return { ok: true, remaining: limit, limit };
  }

  const used = count ?? 0;
  if (used >= limit) {
    // Compute a soft retry-after as the full window length. We could
    // do better by reading the oldest event in the window and
    // returning (windowSeconds - age) but the simpler answer is
    // correct enough — and giving a precise retry-after just helps
    // the attacker time their next burst.
    return { ok: false, retryAfterSeconds: windowSeconds, limit };
  }

  // Step 2 — record this hit. We don't await an error here: a failed
  // insert just means the limiter under-counts by one for one
  // request, which is harmless.
  const { error: insErr } = await db.from("rate_limit_events").insert({
    bucket,
    key_hash: keyHash as unknown as string,
  });
  if (insErr) {
    console.warn("[rate-limit] insert failed:", insErr.message);
  }

  return { ok: true, remaining: Math.max(0, limit - used - 1), limit };
}
