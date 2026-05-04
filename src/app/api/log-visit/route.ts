import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { getServerAuthSupabase } from "@/lib/supabase-server";
import { parseMissingColumn } from "@/lib/schema-drift";
import { parseUserAgent } from "@/lib/user-agent";
import { guard } from "@/lib/security/guard";

/**
 * POST /api/log-visit
 *
 * Records one row per page view in `visitor_logs`. Triggered by
 * the <VisitLogger /> client component mounted in the root layout.
 *
 * The route deliberately collects only what a CDN already gives us
 * for free (IP + UA + Vercel/Cloudflare geo headers) plus the
 * client-supplied path / anon_user_id / referer. No fingerprinting,
 * no canvas hashes, no extra client probes. The point of the
 * /admin/logs surface is to show what trivially reachable signals
 * any operator already has — which is the same rhetorical move the
 * rest of the app makes about emotion data.
 *
 * Body (JSON, all optional):
 *   - path: string         the URL path being loaded ("/", "/session", ...)
 *   - referer: string      document.referrer
 *   - anon_user_id: string the localStorage UUID (if already minted)
 *
 * Failure is silent. A 400/500 here doesn't break the visitor's
 * page load, and we intentionally swallow DB errors so a
 * misconfigured Supabase project doesn't take down the site.
 */

export const runtime = "nodejs";

type Body = {
  path?: unknown;
  referer?: unknown;
  anon_user_id?: unknown;
};

function firstClientIp(req: NextRequest): string | null {
  // x-forwarded-for is a comma-separated chain; the leftmost entry
  // is the original client. x-real-ip is set by some proxies; fall
  // through to it when xff is missing.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri;
  return null;
}

function geoFromHeaders(req: NextRequest): {
  country: string | null;
  region: string | null;
  city: string | null;
} {
  // Vercel sets x-vercel-ip-{country,country-region,city}.
  // Cloudflare sets cf-ipcountry.
  const country =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    null;
  const region = req.headers.get("x-vercel-ip-country-region") ?? null;
  const city = req.headers.get("x-vercel-ip-city") ?? null;
  // Vercel city/region values are URL-encoded (e.g. "San%20Francisco").
  const decode = (v: string | null) => {
    if (!v) return null;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  return {
    country: decode(country),
    region: decode(region),
    city: decode(city),
  };
}

export async function POST(req: NextRequest) {
  // Generous: 120/min. /api/log-visit fires on every page load and a
  // user clicking through 5 pages in 30s is normal. Below this is
  // not a normal browser.
  const blocked = await guard(req, {
    bucket: "api:log-visit",
    limit: 120,
    windowSeconds: 60,
  });
  if (blocked) return blocked;

  if (!supabaseConfigured()) {
    return NextResponse.json(
      { ok: false, reason: "supabase-not-configured" },
      { status: 200 }
    );
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // Empty / invalid body is fine — log a row anyway with whatever
    // the headers gave us. The page-view itself is the data point.
    body = {};
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, reason: "supabase-not-configured" },
      { status: 200 }
    );
  }

  const ua = req.headers.get("user-agent");
  const parsed = parseUserAgent(ua);
  const ip = firstClientIp(req);
  const { country, region, city } = geoFromHeaders(req);

  // Optionally enrich with the signed-in identity. Same auth client
  // /api/session/live uses; failure here is non-fatal.
  let authUserId: string | null = null;
  let email: string | null = null;
  try {
    const authClient = getServerAuthSupabase();
    if (authClient) {
      const { data } = await authClient.auth.getUser();
      authUserId = data.user?.id ?? null;
      email = data.user?.email ?? null;
    }
  } catch {
    /* ignore */
  }

  const path = typeof body.path === "string" ? body.path.slice(0, 256) : null;
  const referer =
    typeof body.referer === "string" ? body.referer.slice(0, 512) : null;
  const anonUserId =
    typeof body.anon_user_id === "string"
      ? body.anon_user_id.slice(0, 128)
      : null;

  let payload: Record<string, unknown> = {
    anon_user_id: anonUserId,
    auth_user_id: authUserId,
    email,
    path,
    referer,
    ip,
    user_agent: ua ? ua.slice(0, 512) : null,
    device: parsed.display.slice(0, 128),
    country,
    region,
    city,
  };

  // Strip-and-retry pattern, so a database that hasn't applied 0011
  // doesn't take down the layout. Cap at 12 attempts (one per
  // column) — beyond that something else is wrong.
  let lastErr: { code?: string; message?: string } | null = null;
  for (let i = 0; i < Object.keys(payload).length + 1; i++) {
    const res = await supabase.from("visitor_logs").insert(payload);
    if (!res.error) {
      return NextResponse.json({ ok: true });
    }
    lastErr = res.error;
    const missing = parseMissingColumn(res.error.message ?? "");
    if (!missing || !(missing in payload)) break;
    const next = { ...payload };
    delete next[missing];
    payload = next;
    if (Object.keys(payload).length === 0) break;
  }

  console.warn("[log-visit] insert failed:", lastErr);
  // The visitor doesn't need to know.
  return NextResponse.json(
    { ok: false, reason: "db-insert-failed" },
    { status: 200 }
  );
}
