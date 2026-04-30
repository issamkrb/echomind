"use client";

import { useMemo } from "react";

/**
 * Bloomberg-style "market tape" KPI strip for /admin.
 *
 * Sits directly under the dashboard header and gives the operator
 * a heads-up display of the running metrics that matter most for
 * the auction-floor framing of the project:
 *
 *   LIVE        · how many sessions are still on-mic right now
 *   TONIGHT     · sessions started since UTC midnight
 *   $TONIGHT    · revenue accrued since UTC midnight
 *   TOP VULN    · highest vulnerability index in the last hour,
 *                 with the subject's first-name + minutes-into
 *   AVG SESSION · mean audio_seconds across captured sessions
 *   LAST ENDED  · how long ago the most recent session closed
 *
 * Designed to feel like the strip across the top of a trading
 * terminal — all caps, mono, tiny separators, no scrolling. The
 * existing `LiveBuyerTicker` at the bottom of /admin handles the
 * per-session scrolling-bid theatre; this is the executive view.
 *
 * Pure-render component: takes the same `rows` the dashboard
 * already has in memory and computes locally, no extra fetch.
 */

type Row = {
  id: string;
  created_at: string;
  ended_at: string | null;
  status: string | null;
  audio_seconds: number;
  revenue_estimate: number;
  first_name: string | null;
  full_name: string | null;
  anon_user_id: string;
  final_fingerprint: Record<string, number>;
  last_heartbeat_at: string | null;
};

const STALE_HEARTBEAT_MS = 30_000;

function rowIsLive(r: Row): boolean {
  if (r.status === "ended") return false;
  if (r.ended_at) return false;
  if (r.status === "live") {
    if (r.last_heartbeat_at) {
      const age = Date.now() - new Date(r.last_heartbeat_at).getTime();
      if (age > STALE_HEARTBEAT_MS) return false;
    }
    return true;
  }
  return false;
}

function startOfDayUtc(): number {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function shortName(r: Row): string {
  const n =
    (r.first_name && r.first_name.trim()) ||
    (r.full_name && r.full_name.trim().split(/\s+/)[0]) ||
    null;
  if (n) return n.toLowerCase();
  return r.anon_user_id.slice(0, 6);
}

function fmtAgo(ms: number): string {
  if (ms < 0) return "—";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

export function MarketTape({ rows }: { rows: Row[] }) {
  const stats = useMemo(() => {
    const now = Date.now();
    const sodMs = startOfDayUtc();

    let liveCount = 0;
    let tonightCount = 0;
    let tonightRevenue = 0;
    let totalAudioSec = 0;
    let totalAudioCount = 0;
    let lastEndedMs: number | null = null;

    let topVuln: { vuln: number; name: string; minsInto: number } | null = null;
    const ONE_HOUR = 60 * 60 * 1000;

    for (const r of rows) {
      if (rowIsLive(r)) liveCount += 1;

      const createdMs = new Date(r.created_at).getTime();
      if (createdMs >= sodMs) {
        tonightCount += 1;
        tonightRevenue += r.revenue_estimate ?? 0;
      }

      if (typeof r.audio_seconds === "number" && r.audio_seconds > 0) {
        totalAudioSec += r.audio_seconds;
        totalAudioCount += 1;
      }

      if (r.ended_at) {
        const endedMs = new Date(r.ended_at).getTime();
        if (lastEndedMs === null || endedMs > lastEndedMs) {
          lastEndedMs = endedMs;
        }
      }

      const ageMs = now - createdMs;
      if (ageMs >= 0 && ageMs <= ONE_HOUR) {
        const v = Number(r.final_fingerprint?.vulnerability ?? 0);
        if (v > 0 && (topVuln === null || v > topVuln.vuln)) {
          topVuln = {
            vuln: v,
            name: shortName(r),
            minsInto: Math.max(0, Math.floor(ageMs / 60000)),
          };
        }
      }
    }

    const avgSec =
      totalAudioCount > 0 ? Math.round(totalAudioSec / totalAudioCount) : 0;

    return {
      liveCount,
      tonightCount,
      tonightRevenue,
      avgSec,
      lastEndedAgo: lastEndedMs !== null ? fmtAgo(now - lastEndedMs) : null,
      topVuln,
    };
  }, [rows]);

  const cells: Array<{ label: string; value: React.ReactNode; tone?: "red" | "amber" | "green" | "dim" }> = [
    {
      label: "LIVE",
      tone: stats.liveCount > 0 ? "green" : "dim",
      value: (
        <span className="inline-flex items-center gap-1.5">
          {stats.liveCount > 0 && (
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-terminal-green"
              style={{ animation: "echomind-pulse 1.4s ease-in-out infinite" }}
            />
          )}
          {String(stats.liveCount).padStart(2, "0")}
        </span>
      ),
    },
    {
      label: "TONIGHT",
      tone: "amber",
      value: stats.tonightCount.toLocaleString(),
    },
    {
      label: "$TONIGHT",
      tone: "red",
      value: `$${stats.tonightRevenue.toFixed(2)}`,
    },
    {
      label: "TOP VULN",
      tone: stats.topVuln ? "red" : "dim",
      value: stats.topVuln
        ? `${stats.topVuln.vuln.toFixed(1)} · ${stats.topVuln.name} · ${stats.topVuln.minsInto}m`
        : "—",
    },
    {
      label: "AVG SESS",
      tone: "dim",
      value:
        stats.avgSec > 0
          ? `${Math.floor(stats.avgSec / 60)}m${String(stats.avgSec % 60).padStart(2, "0")}s`
          : "—",
    },
    {
      label: "LAST ENDED",
      tone: "dim",
      value: stats.lastEndedAgo ?? "—",
    },
  ];

  const toneClass = (tone?: "red" | "amber" | "green" | "dim") => {
    switch (tone) {
      case "red":
        return "text-terminal-red";
      case "amber":
        return "text-terminal-amber";
      case "green":
        return "text-terminal-green";
      default:
        return "text-terminal-text";
    }
  };

  return (
    <div className="mt-2 border border-terminal-border bg-black/40 px-4 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px] font-mono">
      <span className="text-terminal-red uppercase tracking-widest font-bold">
        ECHO/MARKET
      </span>
      <span className="text-terminal-dim">▸</span>
      {cells.map((c, i) => (
        <span key={i} className="inline-flex items-baseline gap-1.5">
          <span className="text-terminal-dim uppercase tracking-widest">
            {c.label}
          </span>
          <span className={`tabular-nums ${toneClass(c.tone)}`}>{c.value}</span>
        </span>
      ))}
    </div>
  );
}
