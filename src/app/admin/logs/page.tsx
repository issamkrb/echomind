"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AdminTopNav } from "@/components/AdminTopNav";

/**
 * /admin/logs \u2014 read-only live feed of every visit recorded in
 * `visitor_logs`. Shows timestamp, device, approximate location,
 * path, and (when available) the signed-in identity of the
 * visitor.
 *
 * Same gate as /admin: ADMIN_TOKEN in the URL + a Supabase email
 * on the ADMIN_EMAILS allowlist (enforced by middleware and again
 * by the underlying API routes).
 *
 * Like the main /admin dashboard, this page subscribes to an SSE
 * stream that pushes fresh snapshots every second, with a polling
 * fallback for environments where text/event-stream is blocked.
 */

type LogRow = {
  id: string;
  created_at: string;
  anon_user_id: string | null;
  auth_user_id: string | null;
  email: string | null;
  path: string | null;
  referer: string | null;
  ip: string | null;
  user_agent: string | null;
  device: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
};

function formatLocation(r: LogRow): string {
  const parts: string[] = [];
  if (r.city) parts.push(r.city);
  if (r.region && r.region !== r.city) parts.push(r.region);
  if (r.country) parts.push(r.country);
  return parts.length > 0 ? parts.join(", ") : "\u2014";
}

/** Mask an IPv4 / IPv6 by zeroing the last two octets / hextets. We
 *  still surface enough to prove the row is real (and tell two
 *  visitors apart in /16) without dumping a full address into a
 *  presentation surface. */
function maskIp(ip: string | null): string {
  if (!ip) return "\u2014";
  if (ip.includes(":")) {
    const parts = ip.split(":");
    if (parts.length <= 4) return ip;
    return parts.slice(0, parts.length - 2).join(":") + "::****";
  }
  const segs = ip.split(".");
  if (segs.length === 4) {
    return `${segs[0]}.${segs[1]}.***.***`;
  }
  return ip;
}

function LogsInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [rows, setRows] = useState<LogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [streamState, setStreamState] = useState<
    "idle" | "connected" | "reconnecting" | "fallback"
  >("idle");
  const [flashIds, setFlashIds] = useState<Record<string, number>>({});
  const lastIdSetRef = useRef<Set<string>>(new Set());
  // Bulk-moderate: multi-select log rows and trash them together.
  // Restore happens from /admin/trash within 24h.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moderating, setModerating] = useState(false);
  const [moderationNote, setModerationNote] = useState<string | null>(null);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const trashSelected = useCallback(async () => {
    if (moderating || selectedIds.size === 0 || !token) return;
    const ids = Array.from(selectedIds);
    if (
      !confirm(
        `Move ${ids.length} log row${ids.length === 1 ? "" : "s"} to trash?\n\n` +
          "Restore from /admin/trash within 24h."
      )
    ) {
      return;
    }
    setModerating(true);
    setModerationNote(null);
    try {
      const res = await fetch(
        `/api/admin/moderate?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "trash",
            table: "visitor_logs",
            ids,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setModerationNote(`failed: ${data?.reason ?? res.status}`);
      } else {
        setModerationNote(
          `moved ${data.count} of ${ids.length} log${ids.length === 1 ? "" : "s"} to trash`
        );
        clearSelection();
        const dropped = new Set(ids);
        setRows((cur) => cur.filter((r) => !dropped.has(r.id)));
      }
    } catch (e) {
      setModerationNote(`failed: ${(e as Error).message}`);
    } finally {
      setModerating(false);
    }
  }, [moderating, selectedIds, token, clearSelection]);

  useEffect(() => {
    if (!token) {
      setError("Missing ?token= in URL.");
      setLoaded(true);
      return;
    }
    let cancelled = false;
    let pollHandle: ReturnType<typeof setInterval> | null = null;
    let es: EventSource | null = null;

    const applySnapshot = (next: LogRow[]) => {
      const prev = lastIdSetRef.current;
      const fresh: Record<string, number> = {};
      const nextIds = new Set<string>();
      const now = Date.now();
      for (const r of next) {
        nextIds.add(r.id);
        if (!prev.has(r.id)) {
          fresh[r.id] = now + 1800;
        }
      }
      lastIdSetRef.current = nextIds;
      setRows(next);
      setError(null);
      if (Object.keys(fresh).length > 0) {
        setFlashIds((cur) => ({ ...cur, ...fresh }));
      }
    };

    async function pollOnce() {
      try {
        const res = await fetch(
          `/api/admin/logs?token=${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );
        const body = await res.json();
        if (cancelled) return;
        if (!body.ok) {
          const reason = body.reason ?? res.status;
          const detail = body.detail ? ` \u2014 ${body.detail}` : "";
          setError(`Forbidden (${reason})${detail}.`);
        } else {
          applySnapshot(body.logs as LogRow[]);
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
      pollHandle = setInterval(() => void pollOnce(), 1_000);
    }

    function startStream() {
      try {
        es = new EventSource(
          `/api/admin/logs/stream?token=${encodeURIComponent(token)}`
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
          if (Array.isArray(payload?.logs)) {
            applySnapshot(payload.logs as LogRow[]);
            setLoaded(true);
          }
        } catch {
          /* ignore */
        }
      });
      es.addEventListener("error", (ev) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse((ev as MessageEvent).data ?? "{}");
          if (payload?.detail) {
            setError(`Forbidden (db-read-failed) \u2014 ${payload.detail}.`);
          }
        } catch {
          /* ignore */
        }
      });
      es.onerror = () => {
        if (cancelled) return;
        consecutiveFailures += 1;
        setStreamState("reconnecting");
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

  // Garbage-collect expired flashes.
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

  return (
    <main
      className="min-h-screen bg-terminal-bg text-terminal-text font-mono px-5 md:px-8 py-6 pb-24"
      style={{ backgroundColor: "#0A0A0B" }}
    >
      <div className="max-w-[1400px] mx-auto">
        <header className="border border-terminal-border bg-black/60 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs">
          <div className="flex items-center gap-4">
            <div className="text-terminal-green terminal-glow font-bold tracking-wider">
              ECHOMIND · VISITOR LOGS
            </div>
            <span className="text-terminal-dim">▸</span>
            <div className="text-terminal-dim uppercase tracking-widest">
              supabase.visitor_logs · last 200
            </div>
          </div>
          <div className="flex items-center gap-4 text-terminal-dim">
            <span>
              total: <span className="text-terminal-text">{rows.length}</span>
            </span>
            <Link
              href={`/admin?token=${encodeURIComponent(token)}`}
              className="text-terminal-dim hover:text-terminal-green underline underline-offset-2"
            >
              ← sessions
            </Link>
            <LiveChannelPill state={streamState} />
          </div>
        </header>

        <AdminTopNav token={token} />

        {selectedIds.size > 0 && (
          <div
            role="region"
            aria-label="bulk moderation"
            className="mt-3 border border-terminal-amber bg-terminal-amber/10 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
          >
            <div className="text-terminal-amber uppercase tracking-widest">
              {selectedIds.size} selected
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={trashSelected}
                disabled={moderating}
                className="px-3 py-1 border border-terminal-red text-terminal-red hover:bg-terminal-red/10 disabled:opacity-30 uppercase tracking-widest"
              >
                {moderating ? "moving…" : "move to trash"}
              </button>
              <button
                onClick={clearSelection}
                disabled={moderating}
                className="text-terminal-dim hover:text-terminal-green disabled:opacity-30"
              >
                clear
              </button>
            </div>
          </div>
        )}
        {moderationNote && (
          <div className="mt-2 text-[11px] text-terminal-amber">
            {moderationNote}
          </div>
        )}

        {!loaded && (
          <div className="mt-6 text-terminal-dim text-sm">Loading…</div>
        )}
        {error && (
          <div className="mt-6 border border-terminal-red bg-terminal-red/5 p-4 text-terminal-red text-sm">
            {error}
            <div className="mt-2 text-terminal-dim text-xs">
              Usage: /admin/logs?token=YOUR_ADMIN_TOKEN
            </div>
          </div>
        )}

        {loaded && !error && rows.length === 0 && (
          <div className="mt-6 text-terminal-dim text-sm">
            No visits logged yet. Open <a className="text-terminal-green underline" href="/">/</a> in another tab and refresh.
            <div className="mt-1 text-terminal-dim/70 text-[10px]">
              If you just deployed migration 0011, the visitor_logs
              table needs to exist in Supabase first.
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div className="mt-6 border border-terminal-border overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-terminal-border text-terminal-dim uppercase tracking-widest">
                  <th className="text-left px-2 py-2 w-8">
                    <input
                      type="checkbox"
                      aria-label="select all rows"
                      checked={
                        rows.length > 0 && selectedIds.size === rows.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(new Set(rows.map((r) => r.id)));
                        } else {
                          clearSelection();
                        }
                      }}
                      className="accent-terminal-amber cursor-pointer"
                    />
                  </th>
                  <th className="text-left px-3 py-2">When</th>
                  <th className="text-left px-3 py-2">Device</th>
                  <th className="text-left px-3 py-2">Location</th>
                  <th className="text-left px-3 py-2">IP</th>
                  <th className="text-left px-3 py-2">Path</th>
                  <th className="text-left px-3 py-2">Referer</th>
                  <th className="text-left px-3 py-2">Identity</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const flashing = (flashIds[r.id] ?? 0) > Date.now();
                  return (
                    <tr
                      key={r.id}
                      className={
                        "border-b border-terminal-border/60 align-top hover:bg-white/5 " +
                        (flashing ? "echomind-row-flash" : "")
                      }
                    >
                      <td className="px-2 py-2 align-middle">
                        <input
                          type="checkbox"
                          aria-label={`select log ${r.id}`}
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleSelected(r.id)}
                          className="accent-terminal-amber cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2 text-terminal-dim whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-terminal-text whitespace-nowrap">
                        {r.device || "Unknown device"}
                      </td>
                      <td className="px-3 py-2 text-terminal-text whitespace-nowrap">
                        {formatLocation(r)}
                      </td>
                      <td className="px-3 py-2 text-terminal-dim whitespace-nowrap font-mono">
                        {maskIp(r.ip)}
                      </td>
                      <td className="px-3 py-2 text-terminal-amber font-mono">
                        {r.path || "\u2014"}
                      </td>
                      <td
                        className="px-3 py-2 text-terminal-dim max-w-[260px] truncate"
                        title={r.referer ?? ""}
                      >
                        {r.referer ? r.referer : "\u2014"}
                      </td>
                      <td className="px-3 py-2 text-terminal-text">
                        {r.email ? (
                          <span title={r.auth_user_id ?? ""}>{r.email}</span>
                        ) : r.anon_user_id ? (
                          <span className="text-terminal-dim">
                            anon: {r.anon_user_id.slice(0, 8)}…
                          </span>
                        ) : (
                          <span className="text-terminal-dim">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-6 text-terminal-dim/70 text-[11px] leading-relaxed max-w-3xl">
          Every row above was assembled from headers a CDN already
          collects on every request. Nothing on this page required
          any client-side fingerprinting. The point isn’t that
          we’re collecting more than other sites — it’s
          that this is the floor.
        </p>
      </div>
    </main>
  );
}

function LiveChannelPill({
  state,
}: {
  state: "idle" | "connected" | "reconnecting" | "fallback";
}) {
  const { label, color } =
    state === "connected"
      ? { label: "LIVE CHANNEL", color: "text-terminal-green border-terminal-green/60" }
      : state === "reconnecting"
      ? { label: "RECONNECTING", color: "text-terminal-amber border-terminal-amber/60" }
      : state === "fallback"
      ? { label: "POLLING 1s", color: "text-terminal-dim border-terminal-border" }
      : { label: "IDLE", color: "text-terminal-dim border-terminal-border" };
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 border ${color} text-[9px] uppercase tracking-widest font-bold`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          state === "connected"
            ? "bg-terminal-green"
            : state === "reconnecting"
            ? "bg-terminal-amber"
            : "bg-terminal-dim"
        }`}
        style={
          state === "connected"
            ? { animation: "echomind-pulse 1.2s ease-in-out infinite" }
            : undefined
        }
      />
      {label}
    </span>
  );
}

export default function AdminLogsPage() {
  return (
    <Suspense
      fallback={
        <main
          className="min-h-screen bg-terminal-bg text-terminal-text font-mono px-5 py-6"
          style={{ backgroundColor: "#0A0A0B" }}
        >
          <div className="text-terminal-dim text-sm">Loading…</div>
        </main>
      }
    >
      <LogsInner />
    </Suspense>
  );
}
