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

const PROFILE_KEY = "echomind:profile";
const ANON_KEY = "echomind:anon_id";

export type ReturningProfile = {
  firstName: string;
  lastVisit: number; // unix ms
  lastKeywords: string[]; // category names
  visitCount: number;
};

/** Stable per-browser anon id used to cross-reference sessions in
 *  the Supabase `sessions` and `returning_visitors` tables. Created
 *  lazily on first access. */
export function getOrCreateAnonUserId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(ANON_KEY);
    if (existing && existing.length >= 16) return existing;
    const fresh = safeUuid();
    window.localStorage.setItem(ANON_KEY, fresh);
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
  // Fallback for non-secure contexts.
  const r = (n: number) => Math.random().toString(16).slice(2, 2 + n);
  return `${r(8)}-${r(4)}-${r(4)}-${r(4)}-${r(12)}`;
}

export function loadReturningProfile(): ReturningProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
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
    };
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
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
  };
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  } catch {
    // localStorage disabled — silently no-op.
  }
}

export function clearReturningProfile() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PROFILE_KEY);
    window.localStorage.removeItem(ANON_KEY);
  } catch {
    /* ignore */
  }
}
