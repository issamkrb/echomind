import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Middleware that refreshes the Supabase auth session on every
 * request, so the cookies stay valid (rotated access token, fresh
 * expiry) before any Server Component or Route Handler reads them.
 *
 * Skips static assets and image optimisation routes.
 */
export async function middleware(req: NextRequest) {
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
    // Run on every path except Next internals, static assets, and the
    // favicon. Auth pages and API routes are deliberately included.
    "/((?!_next/static|_next/image|favicon.ico|icon.png|icon-192.png|icon-512.png|apple-touch-icon.png|models/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
