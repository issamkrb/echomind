import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client (service_role). Bypasses RLS.
 * Only ever imported from Next.js Route Handlers — never the browser.
 *
 * When the env vars are missing we fall back to a lazy null client so
 * local previews without credentials (and the static PR preview host
 * we used pre-Vercel) keep building cleanly.
 */
let cached: SupabaseClient | null = null;
export function getServerSupabase(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-client-info": "echomind-server" } },
  });
  return cached;
}

/** Tiny helper so route handlers can early-return a clean 204 when
 *  the Supabase env vars aren't configured (e.g. on a fresh preview). */
export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
