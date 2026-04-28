"use client";

import { Fragment, Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AdminPortfolioStrip,
  GradeFor,
  useGradeIndex,
} from "@/components/AdminPortfolioStrip";
import {
  languageCohortTag,
  type ArabicDialect,
  type Lang,
} from "@/lib/i18n";
import {
  ObserverHeader,
  ObserverOverlay,
  ObserverToggle,
} from "@/components/ObserverMode";

/**
 * /admin — read-only live dashboard of every session this app has
 * ever captured. Intended to be shown live during the presentation
 * AFTER the audience has tried the demo, to prove that the data was
 * really harvested into Frankfurt.
 *
 * Access is gated by a shared ?token= query param checked server-side.
 * If the token is missing or wrong, the API returns 401/403 and this
 * page stays empty. Keep the token out of git and out of links you
 * share publicly.
 */

type SessionRow = {
  id: string;
  created_at: string;
  anon_user_id: string;
  first_name: string | null;
  goodbye_email: string | null;
  peak_quote: string | null;
  keywords: string[];
  audio_seconds: number;
  revenue_estimate: number;
  final_fingerprint: Record<string, number>;
  auth_user_id: string | null;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  auth_provider: string | null;
  capsule_present: boolean;
  voice_persona: string | null;
  callback_used: string | null;
  final_truth: string | null;
  morning_letter_opted_in: boolean | null;
  detected_language: string | null;
  detected_dialect: string | null;
  code_switch_events:
    | Array<{ at: number; from: string; to: string; sample: string }>
    | null;
  status: string | null;
  last_heartbeat_at: string | null;
  ended_at: string | null;
};

/** A session is "LIVE" if the server flipped status="live" on it
 *  (migration 0010+ in place) OR — for drifted databases without
 *  the status column — if the row is fresh (<10 min old), has
 *  barely any recorded audio (<2s), and the transcript is still
 *  empty. The heuristic errs on the side of false-negatives rather
 *  than false-positives so an already-ended session never shows a
 *  pulsing pill. */
function isLive(r: SessionRow): boolean {
  if (r.status === "live") return true;
  if (r.status === "ended") return false;
  if (r.ended_at) return false;
  const ageMs = Date.now() - new Date(r.created_at).getTime();
  if (ageMs > 10 * 60 * 1000) return false;
  if ((r.audio_seconds ?? 0) >= 2) return false;
  if ((r.keywords ?? []).length > 0) return false;
  return true;
}

function liveElapsedSec(r: SessionRow): number {
  const start = new Date(r.created_at).getTime();
  const end = r.last_heartbeat_at
    ? new Date(r.last_heartbeat_at).getTime()
    : Date.now();
  return Math.max(0, Math.floor((end - start) / 1000));
}

function AdminInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // "connected" | "reconnecting" | "fallback" | "idle". Drives the
  // small LIVE-CHANNEL pill in the header so the operator can tell
  // at a glance whether the dashboard is receiving pushes.
  const [streamState, setStreamState] = useState<
    "idle" | "connected" | "reconnecting" | "fallback"
  >("idle");
  // Per-row fingerprint of the last snapshot. When a row's
  // serialized form changes between two snapshots we briefly
  // highlight its <tr> so the operator's eye gets drawn to the
  // change instead of having to scan the whole table for it.
  const [flashIds, setFlashIds] = useState<Record<string, number>>({});
  const lastRowHashRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!token) {
      setError("Missing ?token= in URL.");
      setLoaded(true);
      return;
    }
    let cancelled = false;
    let pollHandle: ReturnType<typeof setInterval> | null = null;
    let es: EventSource | null = null;

    // Compute which rows changed (by id) compared with the last
    // snapshot we rendered, then trigger a flash on each.
    const applySnapshot = (next: SessionRow[]) => {
      const prev = lastRowHashRef.current;
      const fresh: Record<string, number> = {};
      const nextHashes = new Map<string, string>();
      const now = Date.now();
      for (const r of next) {
        const hash = JSON.stringify(r);
        nextHashes.set(r.id, hash);
        const before = prev.get(r.id);
        if (before === undefined) {
          // Brand-new row → flash longer.
          fresh[r.id] = now + 2400;
        } else if (before !== hash) {
          fresh[r.id] = now + 1100;
        }
      }
      lastRowHashRef.current = nextHashes;
      setRows(next);
      setError(null);
      if (Object.keys(fresh).length > 0) {
        setFlashIds((cur) => ({ ...cur, ...fresh }));
      }
    };

    // Polling fallback. Only used when the SSE stream can't be
    // established (e.g., the admin loaded a build that pre-dates the
    // /stream route, or a corporate proxy strips text/event-stream).
    async function pollOnce() {
      try {
        const res = await fetch(
          `/api/admin/sessions?token=${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );
        const body = await res.json();
        if (cancelled) return;
        if (!body.ok) {
          const reason = body.reason ?? res.status;
          const detail = body.detail ? ` — ${body.detail}` : "";
          setError(`Forbidden (${reason})${detail}.`);
        } else {
          applySnapshot(body.sessions as SessionRow[]);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    function startPolling() {
      setStreamState("fallback");
      void pollOnce();
      pollHandle = setInterval(() => void pollOnce(), 5_000);
    }

    function startStream() {
      // EventSource needs the auth cookie to be sent, which it does
      // by default for same-origin requests. The token is in the
      // querystring; the server still verifies the admin email
      // cookie on every connect.
      try {
        es = new EventSource(
          `/api/admin/sessions/stream?token=${encodeURIComponent(token)}`
        );
      } catch {
        startPolling();
        return;
      }
      let openedOnce = false;
      let consecutiveFailures = 0;
      es.onopen = () => {
        openedOnce = true;
        consecutiveFailures = 0;
        if (!cancelled) setStreamState("connected");
      };
      es.addEventListener("snapshot", (ev) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse((ev as MessageEvent).data);
          if (Array.isArray(payload?.sessions)) {
            applySnapshot(payload.sessions as SessionRow[]);
            setLoaded(true);
          }
        } catch {
          /* ignore malformed frames */
        }
      });
      es.addEventListener("error", (ev) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse((ev as MessageEvent).data ?? "{}");
          if (payload?.detail) {
            setError(`Forbidden (db-read-failed) — ${payload.detail}.`);
          }
        } catch {
          /* ignore */
        }
      });
      es.onerror = () => {
        if (cancelled) return;
        consecutiveFailures += 1;
        // The browser auto-reconnects; we just surface the state.
        setStreamState("reconnecting");
        // After 3 connection failures without a single open(), give
        // up on SSE and degrade to polling so the operator at least
        // sees fresh data.
        if (!openedOnce && consecutiveFailures >= 3) {
          es?.close();
          es = null;
          startPolling();
        }
      };
    }

    if (typeof window !== "undefined" && "EventSource" in window) {
      startStream();
    } else {
      startPolling();
    }

    return () => {
      cancelled = true;
      if (pollHandle) clearInterval(pollHandle);
      if (es) es.close();
    };
  }, [token]);

  // Garbage-collect expired flashes so they don't accumulate forever.
  useEffect(() => {
    if (Object.keys(flashIds).length === 0) return;
    const handle = setInterval(() => {
      const now = Date.now();
      setFlashIds((cur) => {
        let changed = false;
        const next: Record<string, number> = {};
        for (const [id, until] of Object.entries(cur)) {
          if (until > now) next[id] = until;
          else changed = true;
        }
        return changed ? next : cur;
      });
    }, 600);
    return () => clearInterval(handle);
  }, [flashIds]);

  // Rerender once a second so the LIVE pills' `MM:SS` ticker keeps
  // moving smoothly between server pushes.
  const [, setTick] = useState(0);
  useEffect(() => {
    const handle = setInterval(() => setTick((n) => (n + 1) % 1_000_000), 1_000);
    return () => clearInterval(handle);
  }, []);

  const total = rows.reduce((s, r) => s + (r.revenue_estimate ?? 0), 0);
  const gradeIndex = useGradeIndex(token);

  return (
    <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono px-5 md:px-8 py-6 pb-24" style={{ backgroundColor: "#0A0A0B" }}>
      <div className="max-w-[1400px] mx-auto">
        <header className="border border-terminal-border bg-black/60 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs">
          <div className="flex items-center gap-4">
            <div className="text-terminal-green terminal-glow font-bold tracking-wider">
              ECHOMIND · ADMIN DASHBOARD
            </div>
            <span className="text-terminal-dim">▸</span>
            <div className="text-terminal-dim uppercase tracking-widest">
              supabase.sessions · last 100
            </div>
          </div>
          <div className="flex items-center gap-4 text-terminal-dim">
            <span>sessions captured: <span className="text-terminal-text">{rows.length}</span></span>
            <span>verified identities: <span className="text-terminal-amber">{rows.filter(r => r.auth_user_id).length}</span></span>
            <span>synthetic revenue: <span className="text-terminal-red">${total.toFixed(2)}</span></span>
            <LiveChannelPill state={streamState} />
            <ObserverToggle />
          </div>
        </header>

        <ObserverHeader
          observed={rows.length}
          bidding={rows.filter((r) => r.revenue_estimate > 0).length}
        />

        {!error && token && <AdminPortfolioStrip token={token} />}

        {rows.length > 0 && <ConfessionHeatmap rows={rows} />}

        {!loaded && (
          <div className="mt-6 text-terminal-dim text-sm">Loading…</div>
        )}
        {error && (
          <div className="mt-6 border border-terminal-red bg-terminal-red/5 p-4 text-terminal-red text-sm">
            {error}
            <div className="mt-2 text-terminal-dim text-xs">
              Usage: /admin?token=YOUR_ADMIN_TOKEN — set the <code>ADMIN_TOKEN</code> env var on Vercel to enable this page.
            </div>
          </div>
        )}

        {loaded && !error && rows.length === 0 && (
          <div className="mt-6 text-terminal-dim text-sm">
            No sessions yet. Run a session at <a className="text-terminal-green underline" href="/">/</a> and come back.
          </div>
        )}

        {rows.length > 0 && (
          <div className="mt-6 border border-terminal-border overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-terminal-border text-terminal-dim uppercase tracking-widest">
                  <th className="text-left px-3 py-2">Captured</th>
                  <th className="text-left px-3 py-2">Identity</th>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-left px-3 py-2">Provider</th>
                  <th className="text-left px-3 py-2">Peak quote</th>
                  <th className="text-left px-3 py-2">Final truth</th>
                  <th className="text-left px-3 py-2">Keywords</th>
                  <th className="text-left px-3 py-2">Voice</th>
                  <th className="text-left px-3 py-2">Lang cohort</th>
                  <th className="text-right px-3 py-2">Sec</th>
                  <th className="text-center px-3 py-2">Capsule</th>
                  <th className="text-center px-3 py-2">Letter</th>
                  <th className="text-center px-3 py-2">Portfolio</th>
                  <th className="text-right px-3 py-2">$ Est</th>
                  <th className="text-right px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const verified = Boolean(r.auth_user_id);
                  const displayName =
                    r.full_name || r.first_name || (r.anon_user_id.slice(0, 8) + "…");
                  const displayEmail = r.email || r.goodbye_email;
                  const live = isLive(r);
                  const flashing = (flashIds[r.id] ?? 0) > Date.now();
                  return (
                    <tr
                      key={r.id}
                      className={
                        "border-b border-terminal-border/60 align-top hover:bg-white/5 " +
                        (live
                          ? "bg-terminal-green/5 border-l-2 border-l-terminal-green "
                          : "") +
                        (flashing ? "echomind-row-flash" : "")
                      }
                    >
                      <td className="px-3 py-2 text-terminal-dim whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span>{new Date(r.created_at).toLocaleString()}</span>
                          {live && (
                            <span
                              className="inline-flex items-center gap-1 self-start px-1.5 py-0.5 border border-terminal-green/60 text-terminal-green text-[9px] uppercase tracking-widest font-bold"
                              title="Session is in progress. Transcript, emotions, and elapsed time update live."
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-terminal-green"
                                style={{
                                  animation: "echomind-pulse 1.2s ease-in-out infinite",
                                }}
                              />
                              LIVE · {Math.floor(liveElapsedSec(r) / 60)
                                .toString()
                                .padStart(2, "0")}
                              :
                              {(liveElapsedSec(r) % 60).toString().padStart(2, "0")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {r.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={r.avatar_url}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="w-6 h-6 rounded-full border border-terminal-border object-cover"
                            />
                          ) : (
                            <span
                              className={`w-6 h-6 rounded-full border ${
                                verified
                                  ? "border-terminal-amber/50 bg-terminal-amber/10"
                                  : "border-terminal-border bg-terminal-border/20"
                              } grid place-items-center text-[10px] text-terminal-dim`}
                            >
                              {(displayName || "?").charAt(0).toUpperCase()}
                            </span>
                          )}
                          <div className="flex flex-col">
                            <span className="text-terminal-text">{displayName}</span>
                            {verified && (
                              <span className="text-[9px] text-terminal-amber uppercase tracking-widest">
                                ✓ verified
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-terminal-amber">
                        {displayEmail ?? <span className="text-terminal-dim">—</span>}
                      </td>
                      <td className="px-3 py-2 text-terminal-dim uppercase text-[10px]">
                        {r.auth_provider ?? "anon"}
                      </td>
                      <td className="px-3 py-2 text-terminal-text italic max-w-[320px]">
                        {r.peak_quote ? `"${r.peak_quote}"` : <span className="text-terminal-dim">—</span>}
                      </td>
                      <td className="px-3 py-2 max-w-[320px]">
                        {r.final_truth ? (
                          <span
                            className="text-terminal-red italic border-l-2 border-terminal-red/60 pl-2 block"
                            title="final unguarded sentence · priced highest"
                          >
                            "{r.final_truth}"
                          </span>
                        ) : (
                          <span className="text-terminal-dim">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {(r.keywords ?? []).slice(0, 6).map((k) => (
                            <span key={k} className="px-1.5 py-0.5 bg-terminal-red/10 border border-terminal-red/30 text-terminal-red text-[10px]">
                              {k}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-col gap-1">
                          <span className="text-terminal-amber font-mono text-[11px] uppercase">
                            {r.voice_persona ?? "—"}
                          </span>
                          {r.callback_used && (
                            <span
                              className="inline-block self-start px-1.5 py-0.5 border border-terminal-red/40 text-terminal-red text-[9px] uppercase tracking-widest"
                              title={r.callback_used}
                            >
                              callback ↻
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <LangCohortCell
                          lang={r.detected_language}
                          dialect={r.detected_dialect}
                          switches={r.code_switch_events?.length ?? 0}
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-terminal-dim">{r.audio_seconds}</td>
                      <td className="px-3 py-2 text-center">
                        {r.capsule_present ? (
                          <span
                            className="inline-flex items-center justify-center px-1.5 py-0.5 border border-terminal-red/40 text-terminal-red text-[10px] uppercase tracking-widest"
                            title="audio + peak frame on file"
                          >
                            ▶ ON FILE
                          </span>
                        ) : (
                          <span className="text-terminal-dim text-[10px]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {r.morning_letter_opted_in ? (
                          <span
                            className="inline-flex items-center justify-center px-1.5 py-0.5 border border-terminal-amber/40 text-terminal-amber text-[10px] uppercase tracking-widest"
                            title="morning-letter hook fired · +41% retention lift"
                          >
                            ✉ hook
                          </span>
                        ) : (
                          <span className="text-terminal-dim text-[10px]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <GradeFor
                          map={gradeIndex}
                          authUserId={r.auth_user_id}
                          email={r.email || r.goodbye_email}
                          anonUserId={r.anon_user_id}
                          token={token}
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-terminal-red">${r.revenue_estimate.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/auction/${encodeURIComponent(r.id)}?token=${encodeURIComponent(token)}`}
                          className="text-terminal-amber hover:text-terminal-green hover:underline underline-offset-2 text-[10.5px] uppercase tracking-widest"
                        >
                          open auction →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <LiveTicker rows={rows} />
      <ObserverOverlay />
    </main>
  );
}

/**
 * LiveTicker — a scrolling stock-tape of sessions currently active (or
 * captured within the last hour). Each entry shows:
 *   · session id tail (anonymised display)
 *   · elapsed time "00:14 in"
 *   · peak quote snippet
 *   · a running bid number that creeps upward over time so the
 *     dashboard feels like buyers are actually bidding as the viewer
 *     watches. It's synthetic (a tiny 0.1-per-second drift on the
 *     stored revenue_estimate) but thematically truthful — real
 *     behavioural-ad auctions really do update continuously.
 *
 * The art point: the horror of operations as a live feed. The warm
 * user session that's happening right now is already scrolling past
 * the operator's eyes, priced, before it's even finished.
 */
function LiveTicker({ rows }: { rows: SessionRow[] }) {
  // Bid drift — re-renders every 1s, tiny counter bump lifts the
  // displayed bid so the tape genuinely animates.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const h = setInterval(() => setTick((t) => (t + 1) % 100000), 1000);
    return () => clearInterval(h);
  }, []);

  const now = Date.now();
  const LIVE_WINDOW_MS = 60 * 60 * 1000; // last hour
  const live = rows
    .filter((r) => {
      const age = now - new Date(r.created_at).getTime();
      return age >= 0 && age < LIVE_WINDOW_MS;
    })
    .slice(0, 8);

  if (live.length === 0) return null;

  // Repeat the list twice so the marquee loops visually seamless.
  const loop = [...live, ...live];

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-20 bg-black/90 border-t border-terminal-red/40 overflow-hidden"
      style={{ backgroundColor: "#05050688" }}
    >
      <div className="max-w-[1400px] mx-auto flex items-center gap-4 px-4 py-2 text-[11px]">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="inline-block w-2 h-2 rounded-full bg-terminal-red animate-pulse" />
          <span className="text-terminal-red uppercase tracking-widest font-mono">
            LIVE · buyer market
          </span>
        </div>
        <div className="relative flex-1 overflow-hidden">
          <div
            className="flex gap-8 whitespace-nowrap"
            style={{
              animation: "echomind-ticker 40s linear infinite",
            }}
          >
            {loop.map((r, i) => {
              const age = now - new Date(r.created_at).getTime();
              const mins = Math.floor(age / 60000);
              const secs = Math.floor((age / 1000) % 60);
              const elapsed = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
              // Synthetic live-bid drift: starts at the stored
              // estimate, adds ~$0.01/s since row load (via `tick`)
              // plus a deterministic per-session decimal. Cheap, feels
              // alive.
              const bid =
                (r.revenue_estimate ?? 0) +
                (tick * 0.013 + (i % 7) * 0.11);
              return (
                <div
                  key={`${r.id}-${i}`}
                  className="flex items-center gap-2 text-terminal-dim"
                >
                  <span className="text-terminal-amber font-mono">
                    subj {r.id.slice(0, 4)}
                  </span>
                  <span>·</span>
                  <span className="text-terminal-text">{elapsed} in</span>
                  <span>·</span>
                  <span className="italic text-terminal-text/80 max-w-[260px] truncate">
                    {r.final_truth || r.peak_quote || "—"}
                  </span>
                  <span>·</span>
                  <span className="text-terminal-red font-mono">
                    bid ${bid.toFixed(2)} ↑
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  return (
    <Suspense fallback={null}>
      <AdminInner />
    </Suspense>
  );
}

/**
 * Tiny header pill that mirrors the SSE stream state. Mostly for
 * the operator's confidence — if it's not green, the dashboard is
 * either reconnecting or has fallen back to slower 5s polling, so
 * the data on screen may lag what's actually in Supabase.
 */
function LiveChannelPill({
  state,
}: {
  state: "idle" | "connected" | "reconnecting" | "fallback";
}) {
  const config = {
    connected: {
      label: "LIVE CHANNEL",
      color: "text-terminal-green",
      border: "border-terminal-green/60",
      dot: "bg-terminal-green",
      pulse: true,
      title:
        "Streaming sessions in real time over a server-sent connection. Updates push without a refresh.",
    },
    reconnecting: {
      label: "RECONNECTING",
      color: "text-terminal-amber",
      border: "border-terminal-amber/60",
      dot: "bg-terminal-amber",
      pulse: true,
      title:
        "The live stream dropped — the browser is reconnecting. Data on screen may lag for a few seconds.",
    },
    fallback: {
      label: "POLLING · 5s",
      color: "text-terminal-amber",
      border: "border-terminal-amber/40",
      dot: "bg-terminal-amber/70",
      pulse: false,
      title:
        "Live channel unavailable from this network — falling back to a 5-second poll.",
    },
    idle: {
      label: "CONNECTING",
      color: "text-terminal-dim",
      border: "border-terminal-border",
      dot: "bg-terminal-dim",
      pulse: false,
      title: "Opening the live channel…",
    },
  } as const;
  const c = config[state];
  return (
    <span
      title={c.title}
      className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 border ${c.border} ${c.color} text-[10px] uppercase tracking-widest font-bold`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${c.dot}`}
        style={
          c.pulse
            ? { animation: "echomind-pulse 1.2s ease-in-out infinite" }
            : undefined
        }
      />
      {c.label}
    </span>
  );
}

/**
 * Confession Heatmap — 24h × 7d grid showing WHEN people confess.
 *
 * Each cell's intensity comes from a weighted sum of:
 *   · count of sessions that fell in that hour-of-day / day-of-week
 *     slot (captured from `created_at`)
 *   · with a +1 bonus when the session has a non-empty `final_truth`
 *     (these are the "one true sentence" disclosures — the most
 *     extracted data point)
 *   · with a +1 bonus when there's a non-trivial `peak_quote`
 *
 * So the heatmap isn't just "when are sessions happening?" — it's
 * "when are people *telling us the truth*?" The audience sees the
 * pattern: Friday nights glow red, Sunday mornings glow amber, 3am
 * Tuesday lights up like a warning light.
 *
 * All computation is client-side from the already-loaded rows, so no
 * extra queries and no new migrations. Re-renders for free when the
 * 15s re-poll in AdminInner lands new rows.
 */
function ConfessionHeatmap({ rows }: { rows: SessionRow[] }) {
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const HOURS = Array.from({ length: 24 }, (_, h) => h);

  // counts[dayIdx][hour]  (dayIdx: Mon=0 .. Sun=6, to match DAYS)
  const counts: number[][] = DAYS.map(() => HOURS.map(() => 0));
  let maxCell = 0;
  let totalWeighted = 0;
  const hourBuckets = new Array(24).fill(0);
  const dayBuckets = new Array(7).fill(0);

  for (const r of rows) {
    const d = new Date(r.created_at);
    if (Number.isNaN(d.getTime())) continue;
    // Map JS Sun=0..Sat=6 to Mon=0..Sun=6
    const jsDay = d.getDay();
    const dayIdx = (jsDay + 6) % 7;
    const hr = d.getHours();
    const weight =
      1 +
      (r.final_truth && r.final_truth.trim() ? 1 : 0) +
      (r.peak_quote && r.peak_quote.trim().length > 8 ? 1 : 0);
    counts[dayIdx][hr] += weight;
    totalWeighted += weight;
    hourBuckets[hr] += weight;
    dayBuckets[dayIdx] += weight;
    if (counts[dayIdx][hr] > maxCell) maxCell = counts[dayIdx][hr];
  }

  if (totalWeighted === 0) return null;

  // peak hour / day labels
  const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets));
  const peakDayIdx = dayBuckets.indexOf(Math.max(...dayBuckets));

  function cellStyle(v: number) {
    if (v === 0) {
      return { backgroundColor: "rgba(255,255,255,0.02)" };
    }
    const ratio = v / maxCell;
    // Late-night cells (22-03) tilt red; early-morning (05-10) amber;
    // daytime green. Colour is a tell for the buyer vertical that
    // would pay most for that slot.
    return { opacity: 0.4 + ratio * 0.6 };
  }

  function cellColorClass(hr: number, v: number) {
    if (v === 0) return "bg-white/[0.02]";
    const lateNight = hr >= 22 || hr <= 3;
    const earlyMorning = hr >= 5 && hr <= 10;
    if (lateNight) return "bg-terminal-red/60";
    if (earlyMorning) return "bg-terminal-amber/60";
    return "bg-terminal-green/50";
  }

  return (
    <section className="mt-6 border border-terminal-border bg-black/40">
      <header className="px-4 py-2 border-b border-terminal-border flex flex-col md:flex-row md:items-center md:justify-between gap-1 text-[11px] uppercase tracking-widest text-terminal-dim">
        <div className="flex items-center gap-3">
          <span className="text-terminal-green terminal-glow">
            CONFESSION · HEATMAP
          </span>
          <span>▸</span>
          <span>
            when the truth tends to land · weighted by final-truth + peak-quote
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span>
            peak slot:{" "}
            <span className="text-terminal-red">
              {DAYS[peakDayIdx]} · {String(peakHour).padStart(2, "0")}:00
            </span>
          </span>
          <span className="text-terminal-dim/70">
            sample size: {totalWeighted}
          </span>
        </div>
      </header>
      <div className="px-4 py-3 overflow-x-auto">
        <div
          className="grid gap-[2px]"
          style={{
            gridTemplateColumns: "28px repeat(24, minmax(16px, 1fr))",
          }}
        >
          <div />
          {HOURS.map((h) => (
            <div
              key={`h-${h}`}
              className="text-[9px] text-terminal-dim text-center font-mono"
            >
              {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
            </div>
          ))}
          {DAYS.map((d, di) => (
            <Fragment key={`row-${d}`}>
              <div className="text-[9px] text-terminal-dim text-right pr-2 font-mono self-center">
                {d}
              </div>
              {HOURS.map((h) => {
                const v = counts[di][h];
                return (
                  <div
                    key={`${d}-${h}`}
                    className={`h-4 border border-black/40 ${cellColorClass(
                      h,
                      v
                    )}`}
                    style={cellStyle(v)}
                    title={`${d} ${String(h).padStart(
                      2,
                      "0"
                    )}:00 · ${v} weighted confession${v === 1 ? "" : "s"}`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-[9px] text-terminal-dim uppercase tracking-widest">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-terminal-red/60" />
            late-night (22:00–03:00) — insurer vertical peak
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-terminal-amber/60" />
            dawn (05:00–10:00) — pharma vertical lift
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-terminal-green/50" />
            daytime — baseline ad market
          </span>
        </div>
      </div>
    </section>
  );
}

// Compact two-line cell:
//   · cohort tag (darija · maghreb premium)
//   · code-switch badge in red (only if switches > 0)
// Unknown / legacy rows fall back to the English tag.
function LangCohortCell({
  lang,
  dialect,
  switches,
}: {
  lang: string | null;
  dialect: string | null;
  switches: number;
}) {
  const l: Lang =
    lang === "fr" || lang === "ar" || lang === "en" ? lang : "en";
  const d: ArabicDialect | undefined =
    dialect === "darija" || dialect === "msa" || dialect === "egyptian"
      ? dialect
      : undefined;
  return (
    <div className="flex flex-col gap-1 max-w-[200px]">
      <span
        className="inline-block self-start px-1.5 py-0.5 border border-terminal-amber/40 text-terminal-amber text-[10px] uppercase tracking-widest truncate"
        title={languageCohortTag(l, d)}
      >
        {languageCohortTag(l, d)}
      </span>
      {switches > 0 && (
        <span
          className="inline-block self-start px-1.5 py-0.5 border border-terminal-red/60 text-terminal-red text-[9px] uppercase tracking-widest"
          title={`${switches} code-switch event${
            switches === 1 ? "" : "s"
          } · emotional overflow`}
        >
          ↯ code-switch × {switches}
        </span>
      )}
    </div>
  );
}
