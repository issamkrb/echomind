/**
 * Admin gate — both layers of the admin namespace run through here:
 *
 *   1. `ADMIN_TOKEN` (secret URL param) — obscurity layer, already
 *      enforced in middleware. Protects even against a logged-in
 *      real user accidentally discovering /admin.
 *   2. `ADMIN_EMAILS` (comma-separated allowlist) — identity layer,
 *      enforced here. Even if someone gets the token URL, they still
 *      need to be signed in with one of the allowed email addresses.
 *
 * Set `ADMIN_EMAILS` on Vercel as `foo@example.com,bar@example.com`
 * (no spaces required; trimming + case-insensitive).
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return false;
  const allowed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return false;
  return allowed.includes(email.toLowerCase());
}

/**
 * Machine-readable reasons used by the admin middleware + API routes
 * so the client can tell the difference between "wrong secret URL"
 * (render as 404) and "right URL but you need to sign in" (redirect
 * to /auth/sign-in).
 */
export type AdminGateReason =
  | "token-missing"
  | "token-wrong"
  | "not-signed-in"
  | "not-admin-email"
  | "ok";
