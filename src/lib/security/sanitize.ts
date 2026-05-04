/**
 * String sanitization helpers used before any user-supplied text is
 * persisted or echoed back. None of these are silver bullets; they're
 * defence-in-depth on top of:
 *
 *   - parameterized Supabase JS queries (no raw SQL concatenation)
 *   - React's auto-escaping of text nodes (no innerHTML)
 *   - the strict CSP in next.config.mjs (no inline scripts)
 *
 * The job here is to keep junk out of the database and to make
 * downstream prompts (e.g. the Groq rewrite of testimonials) safer
 * by stripping control bytes, normalising whitespace, and capping
 * absurd lengths.
 */

const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Cleans a free-text string from a user-controlled body:
 *
 *   - normalises CRLF / CR to LF
 *   - strips ASCII control chars (everything < 0x20 except \n, \t)
 *   - strips zero-width characters that some clients use to evade
 *     length limits (U+200B, U+200C, U+200D, U+FEFF)
 *   - collapses 4+ consecutive newlines into 2
 *   - trims the ends
 *   - truncates to `maxLen` characters
 *
 * Returns the cleaned string. Never throws.
 */
export function sanitizeText(input: unknown, maxLen: number): string {
  if (typeof input !== "string") return "";
  let s = input;
  s = s.replace(/\r\n?/g, "\n");
  s = s.replace(CONTROL_CHARS_RE, "");
  s = s.replace(/[\u200B\u200C\u200D\uFEFF]/g, "");
  s = s.replace(/\n{4,}/g, "\n\n");
  s = s.trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/**
 * For short identifier-like strings (anon ids, voice persona slugs,
 * language codes, dialect tags). Allows ASCII letters, digits, hyphen,
 * underscore. Anything else is rejected by returning "".
 */
export function sanitizeSlug(input: unknown, maxLen = 64): string {
  if (typeof input !== "string") return "";
  const s = input.trim();
  if (s.length === 0 || s.length > maxLen) return "";
  if (!/^[A-Za-z0-9_\-]+$/.test(s)) return "";
  return s;
}

/**
 * For UUID-shaped fields (anon_user_id, session_id, auth_user_id).
 * Returns the UUID lowercased on success, or "" on rejection. Accepts
 * either canonical 36-char UUIDs or 32-char hex.
 */
export function sanitizeUuid(input: unknown): string {
  if (typeof input !== "string") return "";
  const s = input.trim().toLowerCase();
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s) ||
    /^[0-9a-f]{32}$/.test(s)
  ) {
    return s;
  }
  return "";
}

/**
 * Coerce to a finite number in `[min, max]`. Returns `fallback` if the
 * input is not a finite number or is out of range.
 */
export function clampNumber(
  input: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}
