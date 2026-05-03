import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { isAdminEmail } from "@/lib/admin-auth";

/**
 * Middleware that:
 *   1. Adds defence-in-depth security headers on every response (the
 *      same-name headers are also declared statically in
 *      next.config.mjs; setting them here covers the few code paths
 *      where the static config doesn't run, e.g. the early return
 *      paths in this file itself).
 *   2. Rejects mutating /api/* requests whose Origin/Referer doesn't
 *      match the deployment host. Routes do this themselves via
 *      guard(), but the middleware is a redundant outer wall so even
 *      a route that forgets to call guard() is still protected from
 *      drive-by curls.
 *   3. Gates the admin namespace by URL token + signed-in identity.
 *   4. Refreshes the Supabase auth session on every request so
 *      cookies stay valid (rotated access token, fresh expiry)
 *      before any Server Component or Route Handler reads them.
 *
 * The site is otherwise public — no soft "speak the word we agreed
 * on" gate. Visitors land directly on /, /session, /partner-portal
 * (still admin-token-gated separately), etc.
 *
 * Skips static assets, image optimisation routes, and — critically —
 * the entire /auth/* namespace plus /api/sign-out. The OAuth and
 * email-magic-link callbacks rely on a delicate PKCE cookie dance
 * (the browser sets `*-code-verifier`, the callback route reads it
 * back, then Supabase rotates it). Running the middleware's own
 * `getUser()` against the same Supabase instance during that
 * round-trip can clobber the verifier cookie and fail the exchange
 * with "PKCE code verifier not found in storage."
 */

/** Headers we set on every response in addition to the static set in
 *  next.config.mjs. Exists so the early-return paths below (admin
 *  404s, /api 403s) still ship the security baseline. */
function applySecurityHeaders(res: NextResponse) {
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  return res;
}

/** Same-origin check used as a redundant outer wall on /api/* writes.
 *  The route-level guard() does this too with a richer allowlist;
 *  this is the cheap version that runs even before route handler
 *  code loads. Returns true if the request looks same-origin. */
function isSameOriginCoarse(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  // No Origin header = legitimate non-browser caller (server-to-
  // server, no-CORS GET, sendBeacon in some configurations). The
  // route-level guard makes the finer call; here we fail-open.
  if (!origin) return true;
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  // The request URL's host is the deployment host, regardless of
  // whether we're behind Vercel's edge or a custom domain.
  if (originHost === req.nextUrl.host) return true;
  // Allow Vercel preview deploys (any *.vercel.app) so PR previews
  // still talk to themselves.
  if (originHost.endsWith(".vercel.app")) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const method = req.method.toUpperCase();
  const isAdminArea =
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/partner-portal" ||
    path.startsWith("/partner-portal/");

  // ── Coarse same-origin guard on mutating /api/* ────────────────
  // The route-level guard() does the same check with the full
  // allowlist; this is the redundant outer wall. We skip /api/auth/*
  // (Supabase auth callbacks come back with no Origin) and
  // /api/sign-out (handles its own cookies and also runs without an
  // origin in some flows).
  if (
    path.startsWith("/api/") &&
    !path.startsWith("/api/auth/") &&
    path !== "/api/sign-out" &&
    (method === "POST" ||
      method === "PUT" ||
      method === "PATCH" ||
      method === "DELETE")
  ) {
    if (!isSameOriginCoarse(req)) {
      return applySecurityHeaders(
        new NextResponse(
          JSON.stringify({ ok: false, reason: "bad-origin" }),
          { status: 403, headers: { "content-type": "application/json" } }
        )
      );
    }
  }

  // ── Admin namespace: token gate (obscurity layer) ──────────────
  // Both /admin/* and /partner-portal/* are the operator-side reveal
  // of the critique. The URL is gated by a shared ADMIN_TOKEN; the
  // identity is gated below by ADMIN_EMAILS. If the token is missing
  // or wrong we 404 — same response a real operator surface would
  // give a stranger, and it gives nothing away about the route
  // actually existing.
  if (isAdminArea) {
    const expected = process.env.ADMIN_TOKEN;
    const provided =
      req.nextUrl.searchParams.get("token") ??
      // Cookie fallback: once a real operator has visited /admin
      // /partner-portal with the URL token once, we mint a signed
      // cookie so the URL token can be stripped from subsequent
      // navigations (kills the Referer-leak class entirely). The
      // cookie value is the token itself; the cookie attributes
      // (HttpOnly, Secure, SameSite=Strict, Path=/) make it
      // unreachable from JavaScript and unsendable cross-site.
      req.cookies.get("admin_token")?.value ??
      null;
    if (!expected || !provided || provided !== expected) {
      return applySecurityHeaders(new NextResponse(null, { status: 404 }));
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Supabase not configured. The token-only gate above is all we have.
    // In production ADMIN_EMAILS is strongly recommended too.
    return applySecurityHeaders(NextResponse.next());
  }

  const res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(url, key, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        req.cookies.set({ name, value, ...options });
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        req.cookies.set({ name, value: "", ...options });
        res.cookies.set({ name, value: "", ...options });
      },
    },
  });

  // Calling getUser() forces the client to refresh the session if
  // the access token is close to expiry, and writes new cookies on
  // the response if so.
  const { data: userData } = await supabase.auth.getUser();

  // ── Admin namespace: identity gate (ADMIN_EMAILS allowlist) ────
  // Token was already verified above; now verify the signed-in
  // identity. If not signed in at all, redirect to sign-in with a
  // return URL so they come back to the same admin page after auth.
  // If signed in but the email isn't on the allowlist, 404 — same
  // as a stranger. Admins in the allowlist pass through.
  if (isAdminArea) {
    const email = userData.user?.email ?? null;
    if (!userData.user) {
      const signInUrl = req.nextUrl.clone();
      signInUrl.pathname = "/auth/sign-in";
      signInUrl.search = `?next=${encodeURIComponent(
        req.nextUrl.pathname + req.nextUrl.search
      )}`;
      return applySecurityHeaders(NextResponse.redirect(signInUrl));
    }
    if (!isAdminEmail(email)) {
      return applySecurityHeaders(new NextResponse(null, { status: 404 }));
    }
    // Mint the admin_token cookie on every successful admin pass. The
    // cookie is HttpOnly + Secure + SameSite=Strict so a stored XSS
    // payload can't read it and a cross-site link can't trigger an
    // authenticated request.
    const expectedToken = process.env.ADMIN_TOKEN;
    if (expectedToken) {
      res.cookies.set("admin_token", expectedToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
        // Match the rotating env-var posture: the cookie expires
        // after 30 days. Bumping ADMIN_TOKEN invalidates every
        // existing cookie automatically because the value comparison
        // above will fail on the next request.
        maxAge: 60 * 60 * 24 * 30,
      });
    }
  }

  return applySecurityHeaders(res);
}

export const config = {
  matcher: [
    // Run on every path except Next internals, static assets, the
    // favicon, the auth namespace (PKCE-sensitive), and sign-out
    // (which manages its own cookies on the response).
    "/((?!_next/static|_next/image|favicon.ico|icon.png|icon-192.png|icon-512.png|apple-touch-icon.png|models/|auth/|api/sign-out|api/me|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
