import { NextRequest, NextResponse } from "next/server";
import { getServerAuthSupabase } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin-auth";

/**
 * Shared admin gate for the /api/admin/* moderation routes added in
 * the admin-panel PR.
 *
 * Both layers of the admin namespace are enforced:
 *   1. URL `?token=<ADMIN_TOKEN>` (or `admin_token` cookie minted
 *      by middleware).
 *   2. Signed-in Supabase user whose email is in `ADMIN_EMAILS`.
 *
 * Mirrors the in-line gates in /api/admin/sessions, /api/admin/logs,
 * and /api/admin/recording/[id]. Centralising it here means the new
 * mutating endpoints (trash, restore, purge, flags, forget, export)
 * can't drift from the read endpoints.
 *
 * Returns either:
 *   - `{ ok: true, adminEmail }` when the request is authorised, or
 *   - `{ ok: false, response }` carrying a ready-to-return NextResponse
 *     (404 / 401 / 403 / 503) that the caller should `return` directly.
 */
export type AdminGateResult =
  | { ok: true; adminEmail: string }
  | { ok: false; response: NextResponse };

export async function requireAdmin(req: NextRequest): Promise<AdminGateResult> {
  const expected = process.env.ADMIN_TOKEN;

  if (!expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, reason: "admin-disabled" },
        { status: 403 }
      ),
    };
  }

  // Accept the token from either the URL query (legacy) or the
  // HttpOnly admin_token cookie minted by middleware. Both are
  // checked the same way in middleware.ts.
  const provided =
    req.nextUrl.searchParams.get("token") ??
    req.cookies.get("admin_token")?.value ??
    null;

  if (!provided || provided !== expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, reason: "bad-token" },
        { status: 401 }
      ),
    };
  }

  const authClient = getServerAuthSupabase();
  if (!authClient) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, reason: "auth-not-configured" },
        { status: 503 }
      ),
    };
  }

  const { data: userData } = await authClient.auth.getUser();
  const email = userData.user?.email ?? null;
  if (!userData.user || !isAdminEmail(email)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, reason: "not-admin" },
        { status: 401 }
      ),
    };
  }

  return { ok: true, adminEmail: email! };
}
