"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client used for sign-in flows. Manages the
 * auth session in cookies (so the server can read it on the next
 * request via /lib/supabase-server). Falls back to a no-op client
 * when env vars are missing so the app still builds on un-configured
 * preview hosts.
 *
 * IMPORTANT: do NOT pass a custom cookieOptions.name here. The
 * @supabase/ssr library uses the cookie name as the storageKey, and
 * server-side `createServerClient` calls in /lib/supabase-server,
 * /middleware, /auth/callback, and /api/sign-out all use the default
 * URL-derived name. A mismatch makes browser-written sessions
 * invisible to the server, which silently breaks the email-OTP and
 * "already signed in" flows.
 */
let cached: SupabaseClient | null = null;
export function getBrowserSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  cached = createBrowserClient(url, key);
  return cached;
}
