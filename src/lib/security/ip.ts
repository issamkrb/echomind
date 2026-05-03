import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Resolve the client IP from a Next.js request.
 *
 * Order of preference:
 *   1. `x-forwarded-for` (first IP, leftmost)
 *   2. `x-real-ip`
 *   3. `cf-connecting-ip` (Cloudflare)
 *   4. `x-vercel-forwarded-for`
 *
 * Returns the literal string for the IP, or `null` if none is
 * available (which only realistically happens in local-dev curl).
 *
 * The caller almost never wants the raw IP — they want the hashed
 * key from `hashIp` below — but we expose the raw form too in case a
 * future debug surface needs it. We deliberately do NOT log raw IPs;
 * everything that ends up in `security_events` / `ip_blocks` /
 * `rate_limit_events` is the SHA-256 hash so a curious operator
 * cannot read the IPs of real visitors out of a Supabase row.
 */
export function resolveClientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const vercel = req.headers.get("x-vercel-forwarded-for");
  if (vercel) {
    const first = vercel.split(",")[0]?.trim();
    if (first) return first;
  }
  return null;
}

/**
 * SHA-256 hash a string, returned as a Buffer suitable for the
 * `bytea` columns on rate_limit_events, ip_blocks, security_events.
 */
export function hashKey(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * Returns the bytea-ready hash of the request's client IP, or null
 * if no IP could be determined (rare).
 */
export function hashRequestIp(req: NextRequest): Buffer | null {
  const ip = resolveClientIp(req);
  if (!ip) return null;
  return hashKey(ip);
}

/**
 * Hash the UA string for security_events. Returns null when the UA
 * header is missing — bots and scrapers usually send *some* UA, so a
 * missing UA is itself a weak suspicion signal worth recording.
 */
export function hashRequestUa(req: NextRequest): Buffer | null {
  const ua = req.headers.get("user-agent");
  if (!ua) return null;
  return hashKey(ua);
}
