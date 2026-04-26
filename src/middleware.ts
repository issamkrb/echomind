import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { isAdminEmail } from "@/lib/admin-auth";
import {
  GATE_COOKIE_NAME,
  gateIsConfigured,
  verifyGateCookie,
} from "@/lib/gate";

/**
 * Middleware that:
 *   1. Enforces the soft site-wide gate — visitors without a valid
 *      `echomind_gate` cookie are redirected to /gate. Only applies
 *      when SITE_ACCESS_CODE and GATE_SECRET are both configured so
 *      a fresh deploy never locks the operator out.
 *   2. Gates the admin namespace by URL token + signed-in identity.
 *   3. Refreshes the Supabase auth session on every request so
 *      cookies stay valid (rotated access token, fresh expiry)
 *      before any Server Component or Route Handler reads them.
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
export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isAdminArea =
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/partner-portal" ||
    path.startsWith("/partner-portal/");

  // ── Site-wide gate ────────────────────────────────────────────
  // Only activates when BOTH env vars are set. The /gate page and
  // its API route are always allowed (otherwise we'd redirect the
  // unlock flow to itself forever). /api/sign-out and /auth/* are
  // already excluded by the `config.matcher` below.
  const pathAllowsGate =
    path === "/gate" ||
    path === "/api/gate" ||
    // Let the auth callback route through — same reason /auth/* is
    // excluded from the matcher: it manages its own PKCE cookies.
    path === "/auth/callback";
  if (gateIsConfigured() && !pathAllowsGate) {
    const cookieVal = req.cookies.get(GATE_COOKIE_NAME)?.value;
    const matchedCode = await verifyGateCookie(cookieVal);
    if (!matchedCode) {
      // API routes should fail closed with a 401 so fetch() sees it
      // as an auth error instead of following a redirect into the
      // HTML /gate page. Pages get a redirect to /gate with a ?next
      // param so they return to the same URL after unlocking.
      if (path.startsWith("/api/")) {
        return NextResponse.json(
          { error: "gated" },
          { status: 401 }
        );
      }
      const gateUrl = req.nextUrl.clone();
      gateUrl.pathname = "/gate";
      gateUrl.search = `?next=${encodeURIComponent(
        req.nextUrl.pathname + req.nextUrl.search
      )}`;
      return NextResponse.redirect(gateUrl);
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
    const provided = req.nextUrl.searchParams.get("token");
    if (!expected || !provided || provided !== expected) {
      return new NextResponse(null, { status: 404 });
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Supabase not configured. The token-only gate above is all we have.
    // In production ADMIN_EMAILS is strongly recommended too.
    return NextResponse.next();
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
      return NextResponse.redirect(signInUrl);
    }
    if (!isAdminEmail(email)) {
      return new NextResponse(null, { status: 404 });
    }
  }

  return res;
}

export const config = {
  matcher: [
    // Run on every path except Next internals, static assets, the
    // favicon, the auth namespace (PKCE-sensitive), and sign-out
    // (which manages its own cookies on the response).
    "/((?!_next/static|_next/image|favicon.ico|icon.png|icon-192.png|icon-512.png|apple-touch-icon.png|models/|auth/|api/sign-out|api/me|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
