"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * AdminPortfolioStrip — compact portfolios row on the main /admin
 * dashboard.
 *
 * Shows the top ~6 portfolios (sorted by asking price) with avatar,
 * display name, asset grade, cohort tags, a live "currently watching"
 * pulse for portfolios active within the last 5 minutes, and a
 * live-drifting bid that ticks once a second. Clicking a card opens
 * the full trading floor at /admin/market with the same token.
 *
 * Rationale: the operator needs to see "users × portfolios" as a
 * first-class concept on the main dashboard, not just as a separate
 * page. This strip makes it impossible to open /admin without
 * noticing that the same sessions below are already priced as bundles
 * above. One pipeline, two views, same data.
 */

type Row = {
  portfolioKey: string;
  displayName: string;
  displayEmail: string | null;
  avatarUrl: string | null;
  verified: boolean;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  askingPrice: number;
  sessionCount: number;
  finalTruthCount: number;
  wardrobeSnapshotCount: number;
  cohortTags: string[];
  lastSessionAt: string | null;
  lastSeenMinutesAgo: number;
  deleted: boolean;
  clearanceMultiplier: number;
  operatorTagline: string;
  peakQuote: string | null;
  finalTruth: string | null;
};

const GRADE_COLOR: Record<Row["grade"], string> = {
  "A+": "text-terminal-green",
  A: "text-terminal-green",
  B: "text-terminal-amber",
  C: "text-terminal-amber",
  D: "text-terminal-red",
  F: "text-terminal-red",
};

const GRADE_TICK: Record<Row["grade"], number> = {
  "A+": 0.021,
  A: 0.017,
  B: 0.013,
  C: 0.009,
  D: 0.006,
  F: 0.004,
};

export function AdminPortfolioStrip({ token }: { token: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<{
    total_portfolios: number;
    total_clearance: number;
    total_asking_price: number;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const h = setInterval(() => setTick((t) => (t + 1) % 100000), 1000);
    return () => clearInterval(h);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/admin/market?token=${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );
        const body = await res.json();
        if (cancelled) return;
        if (!body?.ok) {
          setError(body?.reason || `HTTP ${res.status}`);
        } else {
          setRows(body.portfolios ?? []);
          setMeta(body.meta ?? null);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    void load();
    const h = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(h);
    };
  }, [token]);

  if (!loaded && rows.length === 0) return null;
  if (error) return null;
  if (rows.length === 0) return null;

  const visible = rows.slice(0, 6);

  return (
    <section className="mt-6 border border-terminal-border bg-black/30 px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-terminal-green terminal-glow font-bold tracking-wider">
            USERS &times; PORTFOLIOS
          </span>
          <span className="text-terminal-dim">▸</span>
          <span className="text-terminal-dim uppercase tracking-widest">
            bundled sessions &middot; priced hourly &middot; grade-weighted
          </span>
        </div>
        <div className="flex items-center gap-4 text-terminal-dim">
          <span>
            portfolios:{" "}
            <span className="text-terminal-text">
              {meta?.total_portfolios ?? rows.length}
            </span>
          </span>
          <span>
            clearance:{" "}
            <span className="text-terminal-red">
              {meta?.total_clearance ?? 0}
            </span>
          </span>
          <span>
            floor bid:{" "}
            <span className="text-terminal-amber">
              $
              {(meta?.total_asking_price ?? 0).toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </span>
          </span>
          <Link
            href={`/admin/market?token=${encodeURIComponent(token)}`}
            className="text-terminal-amber underline hover:text-terminal-green"
          >
            full market →
          </Link>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {visible.map((r, i) => {
          const drift = tick * GRADE_TICK[r.grade] + (i % 7) * 0.11;
          const price = r.askingPrice + drift;
          const isLive =
            !r.deleted &&
            r.lastSeenMinutesAgo !== Number.POSITIVE_INFINITY &&
            r.lastSeenMinutesAgo < 5;
          return (
            <Link
              key={r.portfolioKey}
              href={`/admin/market?token=${encodeURIComponent(token)}`}
              className={`block border ${
                r.deleted
                  ? "border-terminal-red/60 bg-terminal-red/[0.04]"
                  : "border-terminal-border bg-black/40"
              } px-3 py-2 hover:border-terminal-amber transition-colors relative`}
            >
              {r.deleted && (
                <span className="absolute -top-1.5 right-2 bg-terminal-red text-black text-[8px] font-bold tracking-widest px-1.5 py-0.5 uppercase">
                  clearance {r.clearanceMultiplier.toFixed(1)}×
                </span>
              )}
              <div className="flex items-center gap-2">
                {r.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full border border-terminal-border object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full border border-terminal-border bg-terminal-border/20 grid place-items-center text-[10px] text-terminal-dim">
                    {(r.displayName || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-terminal-text truncate text-xs">
                      {r.displayName}
                    </span>
                    {r.verified && (
                      <span className="text-[8px] uppercase tracking-widest text-terminal-amber">
                        ✓
                      </span>
                    )}
                    {isLive && (
                      <span className="flex items-center gap-1 text-[8px] uppercase tracking-widest text-terminal-green">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />
                        live
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] text-terminal-dim truncate">
                    {r.cohortTags.slice(0, 3).join(" · ") || "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-mono text-base leading-none ${GRADE_COLOR[r.grade]}`}>
                    {r.grade}
                  </div>
                  <div className="text-[8px] text-terminal-dim uppercase tracking-widest mt-0.5">
                    grade
                  </div>
                </div>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px]">
                <span className="text-terminal-dim">
                  {r.sessionCount} ses · {r.finalTruthCount} truth ·{" "}
                  {r.wardrobeSnapshotCount} vis
                </span>
                <span className="text-terminal-red font-mono">
                  ${price.toFixed(2)} ↑
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/**
 * GradeFor — helper so the sessions table can show each row's owner
 * grade. Pass a map keyed by auth_user_id OR email (lowercase)
 * produced by `buildGradeIndex()`.
 */
export function GradeFor({
  map,
  authUserId,
  email,
  anonUserId,
  token,
}: {
  map: GradeIndex;
  authUserId: string | null;
  email: string | null;
  anonUserId: string;
  token: string;
}) {
  const key = authUserId
    ? `auth:${authUserId}`
    : email
    ? `email:${email.toLowerCase().trim()}`
    : `anon:${anonUserId}`;
  const entry = map.get(key);
  if (!entry) {
    return <span className="text-terminal-dim/60">—</span>;
  }
  return (
    <Link
      href={`/admin/market?token=${encodeURIComponent(token)}`}
      className={`font-mono text-[11px] ${GRADE_COLOR[entry.grade]} underline decoration-dotted underline-offset-2`}
      title={`${entry.sessionCount} sessions · ${entry.cohortTags.slice(0, 3).join(", ") || "no cohort tags"} · $${entry.askingPrice.toFixed(2)}`}
    >
      {entry.grade}
      {entry.deleted ? " · CLEAR" : ""}
    </Link>
  );
}

export type GradeIndexEntry = {
  grade: Row["grade"];
  askingPrice: number;
  sessionCount: number;
  cohortTags: string[];
  deleted: boolean;
};

export type GradeIndex = Map<string, GradeIndexEntry>;

/** Hook that returns a map from portfolioKey → grade summary. */
export function useGradeIndex(token: string): GradeIndex {
  const [map, setMap] = useState<GradeIndex>(new Map());
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/admin/market?token=${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );
        const body = await res.json();
        if (cancelled || !body?.ok) return;
        const next: GradeIndex = new Map();
        for (const p of body.portfolios ?? []) {
          next.set(p.portfolioKey, {
            grade: p.grade,
            askingPrice: p.askingPrice,
            sessionCount: p.sessionCount,
            cohortTags: p.cohortTags ?? [],
            deleted: p.deleted === true,
          });
        }
        setMap(next);
      } catch {
        // swallow — the sessions table still works without grades.
      }
    }
    void load();
    const h = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(h);
    };
  }, [token]);
  return map;
}
