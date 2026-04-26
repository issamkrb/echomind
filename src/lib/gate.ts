/**
 * Shared helpers for the site-wide gate cookie.
 *
 * The gate is a soft HMAC-signed cookie that proves the visitor
 * entered a valid `SITE_ACCESS_CODE` at least once in the last 30
 * days. It is NOT a login — identity is still handled separately by
 * Supabase. It is an "are you on the guest list" check.
 *
 * We sign against `GATE_SECRET` using HMAC-SHA-256 via Web Crypto so
 * the helper runs in both the Node and Edge (middleware) runtimes.
 * Without the signature a visitor can't forge a cookie just by
 * knowing the cookie name.
 */

export const GATE_COOKIE_NAME = "echomind_gate";
export const GATE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Parse `SITE_ACCESS_CODE` (comma-separated) into a Set of trimmed
 * non-empty codes. Empty string / missing env var → empty set, which
 * means the gate is effectively disabled. We use that as the default
 * so forgetting to set the env var never locks the operator out of
 * their own site — it just means anyone can enter (same as before
 * this PR). The env-var doc in README makes this explicit.
 */
export function allowedCodes(): Set<string> {
  const raw = process.env.SITE_ACCESS_CODE ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export function gateIsConfigured(): boolean {
  return allowedCodes().size > 0 && !!process.env.GATE_SECRET;
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  // Base64url-encode.
  const bytes = new Uint8Array(sig);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * Build a signed cookie value. Format: `<issued_at>.<code_name>.<sig>`
 * where `code_name` is the matched code (so we can audit which code
 * a given cookie was issued against) and `sig` is HMAC(secret, "issued_at.code_name").
 *
 * We include issued_at so we can also reject cookies older than
 * MAX_AGE even if the browser didn't expire them (belt-and-braces).
 */
export async function signGateCookie(code: string): Promise<string | null> {
  const secret = process.env.GATE_SECRET;
  if (!secret) return null;
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `${issuedAt}.${code}`;
  const sig = await hmacSha256(secret, payload);
  return `${payload}.${sig}`;
}

/**
 * Verify a cookie value previously signed by `signGateCookie`.
 * Returns the matched code on success, null otherwise. Rejects
 * cookies whose referenced code is no longer in the allowlist so
 * revoking a code by editing the env var takes effect on next
 * request (no long-lived abandoned cookies).
 */
export async function verifyGateCookie(
  raw: string | undefined | null
): Promise<string | null> {
  if (!raw) return null;
  const secret = process.env.GATE_SECRET;
  if (!secret) return null;

  // Cookie format is `<issuedAt>.<code>.<sig>`. The issuedAt is
  // all-digits and the HMAC signature is base64url (A–Z, a–z, 0–9,
  // '-', '_'), neither of which can contain a dot — but `code` can
  // (e.g. `SITE_ACCESS_CODE=v2.secret`). So we split only at the
  // FIRST and LAST dot, and treat everything between as the code.
  // Using `raw.split(".")` here bites us: a code with one dot
  // splits into 4 parts and verification fails forever, causing an
  // infinite redirect loop back to /gate.
  const firstDot = raw.indexOf(".");
  const lastDot = raw.lastIndexOf(".");
  if (firstDot === -1 || lastDot === firstDot) return null;
  const issuedAtStr = raw.slice(0, firstDot);
  const code = raw.slice(firstDot + 1, lastDot);
  const sig = raw.slice(lastDot + 1);
  if (!issuedAtStr || !code || !sig) return null;
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return null;
  if (Date.now() / 1000 - issuedAt > GATE_COOKIE_MAX_AGE_SECONDS) return null;

  const expected = await hmacSha256(secret, `${issuedAtStr}.${code}`);
  if (!timingSafeEqual(expected, sig)) return null;

  // Code still in the allowlist? (Revocation-on-edit.)
  if (!allowedCodes().has(code)) return null;

  return code;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
