import { NextRequest, NextResponse } from "next/server";
import { hashRequestIp } from "@/lib/security/ip";
import { isIpBlocked, recordIpStrike } from "@/lib/security/ip-block";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { isSameOrigin } from "@/lib/security/origin";
import { recordSecurityEvent } from "@/lib/security/log";

/**
 * One-shot security gate for /api/* route handlers.
 *
 * Usage at the top of every protected POST handler:
 *
 *   const blocked = await guard(req, { bucket: "api:echo", limit: 60, windowSeconds: 60 });
 *   if (blocked) return blocked;
 *   // … your route logic here
 *
 * The function returns a NextResponse the handler should bail out
 * with, or `null` if the request is allowed through.
 *
 * What it does, in order:
 *
 *   1. **IP block check.** If this IP is currently in `ip_blocks`,
 *      we 404. The attacker cannot tell "blocked" from "this route
 *      doesn't exist" — invisibility is part of the spec.
 *
 *   2. **Origin / CSRF check.** For mutating verbs (POST/PUT/PATCH/DELETE)
 *      we require an Origin (or Referer) that matches the deployment's
 *      own host. Cross-origin browser POSTs are rejected with 403.
 *      Skipped for GET (which is supposed to be safe) and for
 *      requests with no Origin / Referer at all (server-to-server,
 *      curl from same host).
 *
 *   3. **Rate-limit.** If this (IP, bucket) has used its budget in
 *      the sliding window, we 429 — and also log a strike on the
 *      ip_blocks table. Repeated rate-limit hits fast-track the IP
 *      into a block (escalating duration up to 24h).
 *
 *   4. **Audit log.** Every 4xx we produce gets written to
 *      `security_events` with hashed IP + UA, path, status, reason.
 *
 * Fail-open posture: if Supabase is down, none of the storage-backed
 * checks can run, so we let the request through. The route's own
 * validation is still enforced.
 */

export type GuardOptions = {
  bucket: string;
  limit: number;
  windowSeconds: number;
  /** When true (default), enforce same-origin on mutating verbs. Set
   *  false for routes that need to be reachable cross-origin (e.g.
   *  webhook receivers — we don't have any today, but it keeps the
   *  helper general). */
  requireSameOrigin?: boolean;
};

export async function guard(
  req: NextRequest,
  opts: GuardOptions
): Promise<NextResponse | null> {
  const { bucket, limit, windowSeconds, requireSameOrigin = true } = opts;
  const ipHash = hashRequestIp(req);

  // 1. IP block list
  if (ipHash) {
    const state = await isIpBlocked(ipHash);
    if (state.blocked) {
      await recordSecurityEvent(req, {
        status: 404,
        reason: "ip-blocked",
        meta: { bucket, until: state.until.toISOString() },
      });
      // Silent 404: indistinguishable from "no such route".
      return new NextResponse(null, { status: 404 });
    }
  }

  // 2. Origin check (mutating verbs only)
  const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (isMutating && requireSameOrigin && !isSameOrigin(req)) {
    await recordSecurityEvent(req, {
      status: 403,
      reason: "bad-origin",
      meta: { bucket, origin: req.headers.get("origin") ?? null },
    });
    return NextResponse.json(
      { ok: false, reason: "forbidden" },
      { status: 403 }
    );
  }

  // 3. Rate limit
  if (ipHash) {
    const rl = await checkRateLimit({
      bucket,
      keyHash: ipHash,
      limit,
      windowSeconds,
    });
    if (!rl.ok) {
      await recordIpStrike(ipHash, `rate-limit:${bucket}`);
      await recordSecurityEvent(req, {
        status: 429,
        reason: "rate-limit",
        meta: { bucket, limit: rl.limit },
      });
      // We deliberately do not include the precise retry window in
      // the body — a smarter response would be a Retry-After header
      // on a 429 with an empty body, which is what we send.
      return new NextResponse(null, {
        status: 429,
        headers: {
          "Retry-After": String(rl.retryAfterSeconds),
          "Cache-Control": "no-store",
        },
      });
    }
  }

  return null;
}
