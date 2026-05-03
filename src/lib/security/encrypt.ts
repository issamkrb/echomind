import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * Application-layer column encryption.
 *
 * Defence in depth on top of Supabase's volume-level encryption at
 * rest: even if the Supabase database itself were exfiltrated, the
 * fields we wrap with `encryptString` would be gibberish to anyone
 * who didn't also hold `APP_ENCRYPTION_KEY`. The key is a server-only
 * env var; it is never inlined into the client bundle, never sent to
 * a browser, never logged.
 *
 * The cipher is AES-256-GCM with a fresh 12-byte IV per record. The
 * resulting wire format is base64url(version(1) || iv(12) || tag(16)
 * || ciphertext(N)), which means rotating the key in the future is
 * straightforward (bump the version byte and add a new branch).
 *
 * Encrypted values are persisted in plain `text` columns on the
 * Supabase tables; nothing about this scheme requires a migration to
 * a `bytea` column. The text starts with the literal prefix `enc:v1:`
 * so a reader can tell at a glance whether a row is encrypted or not.
 *
 * If the env key is missing, encryptString returns the plaintext
 * unchanged — the project must keep working without it (e.g. on a
 * fresh local-dev clone). The threat model for this feature is
 * specifically a leak of the production database; everything still
 * works in plaintext mode, just without the extra wall.
 */

const VERSION = 1;
const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";

let cachedKey: Buffer | null = null;
let cachedKeyMissingWarned = false;

function deriveKey(raw: string): Buffer {
  // Allow the env var to be a 64-char hex, base64-ish, or any other
  // string. We hash it to 32 bytes so every value yields a usable
  // AES-256 key. The user's only obligation is not to lose the
  // string they configured.
  return createHash("sha256").update(raw).digest();
}

function getKey(): Buffer | null {
  if (cachedKey) return cachedKey;
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw || raw.length < 16) {
    if (!cachedKeyMissingWarned) {
      console.warn(
        "[encrypt] APP_ENCRYPTION_KEY missing or too short — falling back to plaintext mode."
      );
      cachedKeyMissingWarned = true;
    }
    return null;
  }
  cachedKey = deriveKey(raw);
  return cachedKey;
}

export function encryptionEnabled(): boolean {
  return getKey() !== null;
}

/**
 * Encrypt a UTF-8 string into a portable `enc:v1:<base64url>` token.
 * If the key is missing, returns the input unchanged so callers
 * never have to special-case the unconfigured environment.
 */
export function encryptString(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;
  if (typeof plaintext !== "string" || plaintext.length === 0) return plaintext;

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([Buffer.from([VERSION]), iv, tag, enc]);
  return PREFIX + payload.toString("base64url");
}

/**
 * Decrypt a token produced by `encryptString`. Pass-through for
 * values that aren't tagged with our prefix (so callers can decrypt
 * a column that's a mix of legacy plaintext rows and new encrypted
 * rows during the migration window).
 */
export function decryptString(value: string | null | undefined): string {
  if (typeof value !== "string" || value.length === 0) return "";
  if (!value.startsWith(PREFIX)) return value;

  const key = getKey();
  if (!key) {
    // Encrypted in the past, key has since been removed: can't
    // recover. Best to surface as empty string than throw.
    return "";
  }
  try {
    const payload = Buffer.from(value.slice(PREFIX.length), "base64url");
    if (payload.length < 1 + 12 + 16 + 1) return "";
    const version = payload[0];
    if (version !== VERSION) return "";
    const iv = payload.subarray(1, 13);
    const tag = payload.subarray(13, 29);
    const enc = payload.subarray(29);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString("utf8");
  } catch (e) {
    console.warn("[encrypt] decrypt failed:", (e as Error)?.message);
    return "";
  }
}

/**
 * Convenience helper for the common case of "the column is either
 * encrypted text or null". Returns "" when null/undefined so the
 * caller can just || it onto a default.
 */
export function decryptColumn(value: unknown): string {
  if (typeof value !== "string") return "";
  return decryptString(value);
}
