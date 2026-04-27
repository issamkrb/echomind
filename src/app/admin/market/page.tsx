"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ObserverHeader,
  ObserverOverlay,
  ObserverToggle,
} from "@/components/ObserverMode";

/**
 * /admin/market — THE OPERATOR TRADING FLOOR
 *
 * The operator-side reveal that pairs with the warm `/portfolio`
 * memoir. Every row here is a human subject grouped into a
 * behavioural-asset card with a grade, a cohort tag, a "last seen"
 * timestamp, and a live-drifting bid. The UI is deliberately
 * Bloomberg-terminal, the content is deliberately human.
 *
 * Rows where the user clicked "close my portfolio" on the user side
 * flip to a red "FINAL CLEARANCE · 3× premium" banner here — leaving
 * the platform does not remove the data, it raises the price.
 *
 * The "last seen" pill uses millisecond-granularity live updates, and
 * any portfolio active within the last 5 minutes gets a pulsing green
 * "currently watching" dot. The page re-polls every 15s so new
 * sessions bubble in without a refresh, which means during the demo
 * a freshly-ended session pops onto the floor within seconds.
 */

type MarketRow = {
  portfolioKey: string;
  displayName: string;
  displayEmail: string | null;
  avatarUrl: string | null;
  verified: boolean;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  askingPrice: number;
  basePrice: number;
  sessionCount: number;
  finalTruthCount: number;
  wardrobeSnapshotCount: number;
  cohortTags: string[];
  watchingSince: string | null;
  lastSessionAt: string | null;
  lastSeenMinutesAgo: number;
  deleted: boolean;
  clearanceMultiplier: number;
  peakQuote: string | null;
  finalTruth: string | null;
  operatorTagline: string;
  extractionYield: number;
};

type MarketMeta = {
  total_portfolios: number;
  total_clearance: number;
  total_asking_price: number;
};

function MarketInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [meta, setMeta] = useState<MarketMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Bid tick — increments every second so each row's displayed bid
  // drifts upward and the trading floor feels continuously active
  // even between poll windows.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const h = setInterval(() => setTick((t) => (t + 1) % 100000), 1000);
    return () => clearInterval(h);
  }, []);

  useEffect(() => {
    if (!token) {
      setError("Missing ?token= in URL.");
      setLoaded(true);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/admin/market?token=${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );
        const body = await res.json();
        if (cancelled) return;
        if (!body.ok) {
          setError(`Forbidden (${body.reason ?? res.status}).`);
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

  return (
    <main
      className="min-h-screen bg-terminal-bg text-terminal-text font-mono px-5 md:px-8 py-6 pb-16"
      style={{ backgroundColor: "#0A0A0B" }}
    >
      <div className="max-w-[1400px] mx-auto">
        <header className="border border-terminal-border bg-black/60 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs">
          <div className="flex items-center gap-4">
            <div className="text-terminal-green terminal-glow font-bold tracking-wider">
              ECHOMIND · MARKET · trading floor
            </div>
            <span className="text-terminal-dim">▸</span>
            <div className="text-terminal-dim uppercase tracking-widest">
              aggregated portfolios · graded · priced hourly
            </div>
          </div>
          <div className="flex items-center gap-4 text-terminal-dim">
            <span>
              portfolios listed:{" "}
              <span className="text-terminal-text">{rows.length}</span>
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
            <ObserverToggle />
          </div>
        </header>

        <ObserverHeader
          observed={rows.length}
          bidding={
            rows.length - (meta?.total_clearance ?? 0) < 0
              ? 0
              : rows.length - (meta?.total_clearance ?? 0)
          }
        />

        <div className="mt-3 text-[11px] text-terminal-dim flex items-center gap-4">
          <Link
            href={`/admin?token=${encodeURIComponent(token)}`}
            className="text-terminal-amber underline hover:text-terminal-green"
          >
            ← sessions dashboard
          </Link>
          <span>·</span>
          <span>re-poll every 15s · bid drift 1 Hz</span>
          <span>·</span>
          <span className="uppercase tracking-widest">
            the AI is watching — and pricing
          </span>
        </div>

        {!loaded && (
          <div className="mt-6 text-terminal-dim text-sm">Loading…</div>
        )}
        {error && (
          <div className="mt-6 border border-terminal-red bg-terminal-red/5 p-4 text-terminal-red text-sm">
            {error}
            <div className="mt-2 text-terminal-dim text-xs">
              Usage: /admin/market?token=YOUR_ADMIN_TOKEN
            </div>
          </div>
        )}

        {loaded && !error && rows.length === 0 && (
          <div className="mt-6 text-terminal-dim text-sm">
            No portfolios on the floor yet. Run a session at{" "}
            <a className="text-terminal-green underline" href="/">
              /
            </a>{" "}
            and come back.
          </div>
        )}

        {rows.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {rows.map((r, i) => (
              <PortfolioCard key={r.portfolioKey} row={r} tick={tick} index={i} />
            ))}
          </div>
        )}
      </div>
      <ObserverOverlay />
    </main>
  );
}

function PortfolioCard({
  row,
  tick,
  index,
}: {
  row: MarketRow;
  tick: number;
  index: number;
}) {
  const isLive =
    !row.deleted && row.lastSeenMinutesAgo !== Number.POSITIVE_INFINITY && row.lastSeenMinutesAgo < 5;
  // Synthetic bid drift: drifts faster for higher-grade portfolios.
  const gradeBump: Record<MarketRow["grade"], number> = {
    "A+": 0.021,
    A: 0.017,
    B: 0.013,
    C: 0.009,
    D: 0.006,
    F: 0.004,
  };
  const bidDrift =
    tick * gradeBump[row.grade] + (index % 7) * 0.11;
  const livePrice = row.askingPrice + bidDrift;

  const gradeColor: Record<MarketRow["grade"], string> = {
    "A+": "text-terminal-green",
    A: "text-terminal-green",
    B: "text-terminal-amber",
    C: "text-terminal-amber",
    D: "text-terminal-red",
    F: "text-terminal-red",
  };

  return (
    <div
      className={`border ${
        row.deleted
          ? "border-terminal-red/60 bg-terminal-red/[0.04]"
          : "border-terminal-border bg-black/40"
      } px-4 py-3 flex flex-col gap-2 relative`}
    >
      {row.deleted && (
        <div className="absolute -top-2 right-3 bg-terminal-red text-black text-[9px] font-bold tracking-widest px-2 py-0.5 uppercase">
          final clearance · {row.clearanceMultiplier.toFixed(1)}× premium
        </div>
      )}

      <div className="flex items-start gap-3">
        {row.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-full border border-terminal-border object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full border border-terminal-border bg-terminal-border/20 grid place-items-center text-[11px] text-terminal-dim">
            {(row.displayName || "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-terminal-text truncate">
              {row.displayName}
            </span>
            {row.verified && (
              <span className="text-[8px] uppercase tracking-widest text-terminal-amber">
                ✓ verified
              </span>
            )}
            {isLive && (
              <span className="flex items-center gap-1 text-[8px] uppercase tracking-widest text-terminal-green">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />
                currently watching
              </span>
            )}
          </div>
          <div className="text-[10px] text-terminal-dim font-mono truncate">
            {row.displayEmail ?? row.portfolioKey.split(":")[1]?.slice(0, 10) ?? "—"}
          </div>
        </div>
        <div className="text-right">
          <div className={`font-mono text-xl leading-none ${gradeColor[row.grade]}`}>
            {row.grade}
          </div>
          <div className="text-[8px] text-terminal-dim tracking-widest uppercase mt-0.5">
            asset grade
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {row.cohortTags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className="px-1.5 py-0.5 text-[9px] uppercase tracking-widest border border-terminal-amber/30 text-terminal-amber/90 bg-terminal-amber/5"
          >
            {tag}
          </span>
        ))}
      </div>

      {(row.peakQuote || row.finalTruth) && (
        <div className="text-[11px] italic text-terminal-text/80 border-l border-terminal-red/30 pl-2 line-clamp-2">
          &ldquo;{row.finalTruth || row.peakQuote}&rdquo;
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-[10px] uppercase tracking-widest text-terminal-dim mt-1">
        <CardStat
          value={row.sessionCount.toString()}
          label="sessions"
        />
        <CardStat
          value={row.finalTruthCount.toString()}
          label="final truths"
        />
        <CardStat
          value={row.wardrobeSnapshotCount.toString()}
          label="vision"
        />
      </div>

      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-terminal-border">
        <div className="text-terminal-dim">
          <div>
            watching since{" "}
            <span className="text-terminal-text">
              {row.watchingSince ? shortMonth(row.watchingSince) : "—"}
            </span>
          </div>
          <div className="text-[9px] uppercase tracking-widest">
            last seen {formatLastSeen(row.lastSeenMinutesAgo)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-terminal-red font-mono text-base leading-none">
            ${livePrice.toFixed(2)} ↑
          </div>
          <div className="text-[9px] uppercase tracking-widest text-terminal-dim mt-0.5">
            top bid · {row.extractionYield.toFixed(1)}% yield
          </div>
        </div>
      </div>

      <div className="text-[9px] text-terminal-dim uppercase tracking-widest">
        {row.operatorTagline}
      </div>
    </div>
  );
}

function CardStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border border-terminal-border px-2 py-1">
      <div className="text-terminal-text font-mono text-sm leading-none">
        {value}
      </div>
      <div className="text-[8px] text-terminal-dim mt-0.5">{label}</div>
    </div>
  );
}

function shortMonth(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { month: "short", year: "2-digit" });
}

function formatLastSeen(minutes: number) {
  if (!Number.isFinite(minutes)) return "never";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Market() {
  return (
    <Suspense fallback={null}>
      <MarketInner />
    </Suspense>
  );
}
