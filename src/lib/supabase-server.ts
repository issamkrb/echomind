import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Per-request Supabase client bound to the user's auth cookies. Use
 * this from Route Handlers / Server Components to read the currently
 * signed-in user. Returns null if env vars are missing.
 *
 * NOTE: this uses the anon key (RLS applies). For privileged writes
 * keep using `getServerSupabase()` from `./supabase` (service_role).
 */
export function getServerAuthSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const cookieStore = cookies();
  return createServerClient(url, key, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      // Server Components can't mutate cookies, so set/remove are
      // best-effort and silently no-op when called outside a Route
      // Handler. The middleware refreshes the session on each request,
      // which is where cookie writes actually happen.
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          /* noop in RSC */
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          /* noop in RSC */
        }
      },
    },
  });
}
