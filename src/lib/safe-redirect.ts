/**
 * Returns `next` if it is a safe same-origin relative path, otherwise
 * returns the fallback. Prevents open-redirect attacks where an
 * attacker crafts a link like `/auth/verify?next=https://evil.com` —
 * after the victim signs in, a naive `window.location.assign(next)`
 * would happily send them anywhere.
 *
 * Rules:
 * - Must be a non-empty string.
 * - Must start with a single `/` (relative to site root).
 * - Must NOT start with `//` (protocol-relative URL pointing off-site).
 * - Must NOT start with `/\` (rare Edge/IE quirk that can also escape).
 */
export function safeRedirectPath(
  next: string | null | undefined,
  fallback = "/onboarding"
): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  if (next.startsWith("/\\")) return fallback;
  return next;
}
