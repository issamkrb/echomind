import type { NextRequest } from "next/server";

/**
 * Same-origin guard for mutating /api/* routes.
 *
 * Browsers automatically attach an `Origin` header on cross-origin
 * `POST` / `PUT` / `DELETE` / `PATCH`. A POST coming from a
 * third-party site (CSRF) will therefore have an Origin that doesn't
 * match the site's own origin. We compare the incoming Origin
 * (falling back to Referer) against an allowlist:
 *
 *   - `req.nextUrl.origin`                    (the deployment itself)
 *   - `process.env.ALLOWED_ORIGINS`           (comma-separated env override)
 *   - `https://${process.env.VERCEL_URL}`     (preview-deploy host)
 *   - `process.env.NEXT_PUBLIC_SITE_URL`      (configured public URL)
 *
 * If `Origin` is missing entirely (which happens for a few legitimate
 * cases like same-origin XHR from very old browsers, or curl from
 * the same machine), we fall through and allow — the rate limiter
 * is the line of defence below us. CSRF requires a real browser.
 *
 * Returns true if the request looks same-origin, false otherwise.
 */
export function isSameOrigin(req: NextRequest): boolean {
  const origin =
    req.headers.get("origin") ??
    extractOriginFromReferer(req.headers.get("referer"));

  if (!origin) {
    // No Origin and no Referer at all. Real browser CSRF requires
    // one of the two; this is more likely a same-origin server-to-
    // server call or curl. Allow.
    return true;
  }

  const allowed = collectAllowedOrigins(req);
  return allowed.has(normalizeOrigin(origin));
}

function extractOriginFromReferer(referer: string | null): string | null {
  if (!referer) return null;
  try {
    const u = new URL(referer);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function collectAllowedOrigins(req: NextRequest): Set<string> {
  const set = new Set<string>();
  set.add(normalizeOrigin(req.nextUrl.origin));

  const env = process.env.ALLOWED_ORIGINS;
  if (env) {
    for (const piece of env.split(",")) {
      const cleaned = piece.trim();
      if (cleaned) set.add(normalizeOrigin(cleaned));
    }
  }

  if (process.env.VERCEL_URL) {
    set.add(normalizeOrigin(`https://${process.env.VERCEL_URL}`));
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    set.add(normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL));
  }
  return set;
}

function normalizeOrigin(origin: string): string {
  try {
    const u = new URL(origin);
    return `${u.protocol}//${u.host}`.toLowerCase();
  } catch {
    return origin.toLowerCase().replace(/\/$/, "");
  }
}
