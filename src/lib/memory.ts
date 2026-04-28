"use client";

/**
 * Cross-session "memory" — the most quietly horrifying part of the build.
 *
 * Real AI companions persist user state in localStorage AND on a
 * server database so they can greet returning users by name across
 * devices and "pick up where you left off". The same mechanism is
 * what makes long-term emotional profiling possible. We replicate
 * the full pattern here so the user feels the *sensation* of being
 * remembered, and so /partner-portal can point to a real Postgres
 * row as evidence.
 *
 * On the second visit Echo greets the user by name and references
 * the keyword categories they triggered last time. There is no
 * clinical justification for this; it exists because returning users
 * disclose faster than first-time users. (See: Wysa, Replika
 * onboarding flows.)
 */

import { scopedKey } from "./account-scope";

// These base keys are combined with the current account scope at
// runtime (see `./account-scope.ts`). Each (browser, account) pair
// gets its own anon id and its own profile cache, so switching
// accounts on the same device starts from a clean slate.
const PROFILE_BASE_KEY = "profile";
const ANON_BASE_KEY = "anon_id";

export type ReturningProfile = {
  firstName: string;
  lastVisit: number; // unix ms
  lastKeywords: string[]; // category names
  visitCount: number;
  /** Most recent session's peak quote — the line Echo will call back
   *  to in the opener of the *next* session. Optional because old
   *  rows may not have one yet. */
  lastPeakQuote?: string | null;
  /** Voice persona the user picked last time. We re-use it on the
   *  next visit so the same voice greets them — same dark pattern
   *  Replika uses to make their paid voices feel "personal". */
  voicePersona?: string | null;
};

/** Stable per-browser anon id used to cross-reference sessions in
 *  the Supabase `sessions` and `returning_visitors` tables. Created
 *  lazily on first access. */
export function getOrCreateAnonUserId(): string {
  if (typeof window === "undefined") return "";
  try {
    const key = scopedKey(ANON_BASE_KEY);
    const existing = window.localStorage.getItem(key);
    if (existing && existing.length >= 16) return existing;
    const fresh = safeUuid();
    window.localStorage.setItem(key, fresh);
    return fresh;
  } catch {
    // localStorage disabled — return a fresh id for the duration of
    // this tab. It won't persist, but at least the endpoints work.
    return safeUuid();
  }
}

function safeUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts. `Math.random().toString(16)` can
  // drop trailing zero nibbles and return fewer than `n` hex chars
  // (e.g. `(0.5).toString(16)` → `"0.8"`), which would produce a
  // malformed UUID that Postgres rejects when stored in the `uuid`
  // columns on sessions/returning_visitors. Pad each segment to the
  // exact required length.
  const r = (n: number) =>
    Math.random().toString(16).slice(2).padEnd(n, "0").slice(0, n);
  return `${r(8)}-${r(4)}-${r(4)}-${r(4)}-${r(12)}`;
}

export function loadReturningProfile(): ReturningProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(scopedKey(PROFILE_BASE_KEY));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.firstName !== "string") return null;
    return parsed as ReturningProfile;
  } catch {
    return null;
  }
}

/** Try to upgrade the local profile from the Supabase server. Quietly
 *  no-ops if the endpoint isn't configured or the request fails. */
export async function hydrateReturningProfileFromServer(): Promise<ReturningProfile | null> {
  if (typeof window === "undefined") return loadReturningProfile();
  const anon = getOrCreateAnonUserId();
  try {
    const res = await fetch(`/api/get-visitor?id=${encodeURIComponent(anon)}`, {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) return loadReturningProfile();
    const data = await res.json();
    const v = data?.visitor;
    if (!v || typeof v.first_name !== "string") return loadReturningProfile();
    const merged: ReturningProfile = {
      firstName: v.first_name,
      lastKeywords: Array.isArray(v.last_keywords) ? v.last_keywords : [],
      visitCount: typeof v.visit_count === "number" ? v.visit_count : 1,
      lastVisit: v.last_visit ? new Date(v.last_visit).getTime() : Date.now(),
      lastPeakQuote:
        typeof v.last_peak_quote === "string" ? v.last_peak_quote : null,
      voicePersona:
        typeof v.voice_persona === "string" ? v.voice_persona : null,
    };
    try {
      window.localStorage.setItem(
        scopedKey(PROFILE_BASE_KEY),
        JSON.stringify(merged)
      );
    } catch {
      /* ignore */
    }
    return merged;
  } catch {
    return loadReturningProfile();
  }
}

export function saveReturningProfile(
  p: Omit<ReturningProfile, "visitCount" | "lastVisit"> & { visitCount?: number }
) {
  if (typeof window === "undefined") return;
  const prev = loadReturningProfile();
  const next: ReturningProfile = {
    firstName: p.firstName,
    lastKeywords: p.lastKeywords,
    visitCount: (prev?.visitCount ?? 0) + 1,
    lastVisit: Date.now(),
    lastPeakQuote: p.lastPeakQuote ?? prev?.lastPeakQuote ?? null,
    voicePersona: p.voicePersona ?? prev?.voicePersona ?? null,
  };
  try {
    window.localStorage.setItem(
      scopedKey(PROFILE_BASE_KEY),
      JSON.stringify(next)
    );
  } catch {
    // localStorage disabled — silently no-op.
  }
}

export function clearReturningProfile() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(scopedKey(PROFILE_BASE_KEY));
    window.localStorage.removeItem(scopedKey(ANON_BASE_KEY));
    window.localStorage.removeItem(scopedKey("voice_persona"));
    // Also wipe any pre-scope legacy keys we may have migrated from.
    window.localStorage.removeItem("echomind:profile");
    window.localStorage.removeItem("echomind:anon_id");
    window.localStorage.removeItem("echomind:voice_persona");
  } catch {
    /* ignore */
  }
}
