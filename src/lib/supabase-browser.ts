"use client";

import { createBrowserClient, type CookieOptionsWithName } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client used for sign-in flows. Manages the
 * auth session in cookies (so the server can read it on the next
 * request via /lib/supabase-server). Falls back to a no-op client
 * when env vars are missing so the app still builds on un-configured
 * preview hosts.
 */
let cached: SupabaseClient | null = null;
export function getBrowserSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const cookieOptions: CookieOptionsWithName = {
    name: "sb-echomind-auth",
    sameSite: "lax",
    secure: typeof location !== "undefined" && location.protocol === "https:",
    path: "/",
  };
  cached = createBrowserClient(url, key, { cookieOptions });
  return cached;
}
