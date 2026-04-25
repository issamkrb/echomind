import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Middleware that refreshes the Supabase auth session on every
 * request, so the cookies stay valid (rotated access token, fresh
 * expiry) before any Server Component or Route Handler reads them.
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
  // ── Admin-only namespace gate ──────────────────────────────────
  // /partner-portal and /partner-portal/letter are part of the
  // critical-design "operator view" — buyer auction + insurance
  // letter. A real surveillance app would never expose these to
  // users, and neither does this art piece. They require the same
  // ?token= as /admin (compared to ADMIN_TOKEN env var). If the
  // token is missing or wrong, return 404 — the same response a
  // real operator surface would give a stranger.
  const path = req.nextUrl.pathname;
  if (path === "/partner-portal" || path.startsWith("/partner-portal/")) {
    const expected = process.env.ADMIN_TOKEN;
    const provided = req.nextUrl.searchParams.get("token");
    if (!expected || !provided || provided !== expected) {
      return new NextResponse(null, { status: 404 });
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

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
  await supabase.auth.getUser();

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
