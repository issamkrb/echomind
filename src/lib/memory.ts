"use client";

/**
 * Cross-session "memory" — the most quietly horrifying part of the build.
 *
 * Real AI companions persist user state in localStorage and on the server
 * so they can greet returning users by name and "pick up where you left
 * off". The same mechanism is what makes long-term emotional profiling
 * possible. We replicate it faithfully — minus the network sync, since
 * this is a class demo — so the user feels the *sensation* of being
 * remembered.
 *
 * On their second visit Echo greets them by name and references the
 * keyword categories they triggered last time. There is no clinical
 * justification for this; it exists because returning users disclose
 * faster than first-time users. (See: Wysa, Replika onboarding flows.)
 */

const KEY = "echomind:profile";

export type ReturningProfile = {
  firstName: string;
  lastVisit: number; // unix ms
  lastKeywords: string[]; // category names
  visitCount: number;
};

export function loadReturningProfile(): ReturningProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.firstName !== "string") return null;
    return parsed as ReturningProfile;
  } catch {
    return null;
  }
}

export function saveReturningProfile(p: Omit<ReturningProfile, "visitCount" | "lastVisit"> & { visitCount?: number }) {
  if (typeof window === "undefined") return;
  const prev = loadReturningProfile();
  const next: ReturningProfile = {
    firstName: p.firstName,
    lastKeywords: p.lastKeywords,
    visitCount: (prev?.visitCount ?? 0) + 1,
    lastVisit: Date.now(),
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // localStorage disabled — silently no-op.
  }
}

export function clearReturningProfile() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
