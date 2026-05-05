"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminTopNav } from "@/components/AdminTopNav";

/**
 * /admin/trash — soft-delete recovery surface.
 *
 * Lists every row across `sessions`, `visitor_logs`, and
 * `testimonials` whose `deleted_at` is non-null. Each row shows a
 * live countdown to its scheduled hard-delete (deleted_at + 24h);
 * after that, the hourly `/api/admin/purge-trash` cron destroys it
 * along with any linked Supabase Storage blobs.
 *
 * The operator can restore individual items, restore everything,
 * or trigger an immediate purge of items already past the cutoff.
 *
 * Same auth model as the rest of /admin: ?token= URL param +
 * signed-in admin email. The page is also a 404 to anyone without
 * the token (enforced by middleware).
 */

type TrashItem = {
  id: string;
  table: "sessions" | "visitor_logs" | "testimonials";
  deleted_at: string;
  deleted_by: string | null;
  purges_at: string;
  summary: string;
  meta: Record<string, unknown>;
};

const TABLE_LABEL: Record<TrashItem["table"], string> = {
  sessions: "session",
  visitor_logs: "visit log",
  testimonials: "testimonial",
};

function formatCountdown(purgesAt: string): string {
  const ms = new Date(purgesAt).getTime() - Date.now();
  if (ms <= 0) return "purging…";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function TrashInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [items, setItems] = useState<TrashItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const h = setInterval(() => setTick((n) => (n + 1) % 1_000_000), 1000);
    return () => clearInterval(h);
  }, []);

  const load = useCallback(async () => {
    if (!token) {
      setError("Missing ?token= in URL.");
      setLoaded(true);
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/trash?token=${encodeURIComponent(token)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        setError(`Trash list failed: ${res.status}`);
        setLoaded(true);
        return;
      }
      const data = await res.json();
      setItems((data?.items ?? []) as TrashItem[]);
      setLoaded(true);
      setError(null);
    } catch (e) {
      setError(`Trash list errored: ${(e as Error).message}`);
      setLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    void load();
    // Refresh every 15s so manual purges and time-based purges show
    // up without a hard reload.
    const h = setInterval(load, 15_000);
    return () => clearInterval(h);
  }, [load]);

  const restoreOne = useCallback(
    async (item: TrashItem) => {
      if (busy) return;
      setBusy(true);
      try {
        const res = await fetch(
          `/api/admin/moderate?token=${encodeURIComponent(token)}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              action: "restore",
              table: item.table,
              ids: [item.id],
            }),
          }
        );
        if (!res.ok) {
          alert(`restore failed: ${res.status}`);
        }
        await load();
      } finally {
        setBusy(false);
      }
    },
    [busy, load, token]
  );

  const purgeNow = useCallback(async () => {
    if (busy) return;
    if (
      !confirm(
        "Purge all rows already past the 24h cutoff? This is irreversible."
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/purge-trash?token=${encodeURIComponent(token)}`,
        { method: "POST" }
      );
      if (!res.ok) {
        alert(`purge failed: ${res.status}`);
      }
      await load();
    } finally {
      setBusy(false);
    }
  }, [busy, load, token]);

  const restoreAll = useCallback(async () => {
    if (busy) return;
    if (items.length === 0) return;
    setBusy(true);
    try {
      // Group by table for one round-trip per table.
      const byTable: Record<string, string[]> = {};
      for (const it of items) {
        byTable[it.table] = byTable[it.table] ?? [];
        byTable[it.table].push(it.id);
      }
      for (const [table, ids] of Object.entries(byTable)) {
        await fetch(
          `/api/admin/moderate?token=${encodeURIComponent(token)}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "restore", table, ids }),
          }
        );
      }
      await load();
    } finally {
      setBusy(false);
    }
  }, [busy, items, load, token]);

  return (
    <main
      className="min-h-screen bg-terminal-bg text-terminal-text font-mono px-5 md:px-8 py-6 pb-24"
      style={{ backgroundColor: "#0A0A0B" }}
    >
      <div className="max-w-[1400px] mx-auto">
        <header className="border border-terminal-border bg-black/60 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs">
          <div className="flex items-center gap-4">
            <div className="text-terminal-green terminal-glow font-bold tracking-wider">
              ECHOMIND · TRASH
            </div>
            <span className="text-terminal-dim">▸</span>
            <div className="text-terminal-dim uppercase tracking-widest">
              soft-deleted · {items.length} row{items.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="flex items-center gap-3 text-terminal-dim">
            <button
              onClick={restoreAll}
              disabled={busy || items.length === 0}
              className="text-terminal-amber hover:text-terminal-green disabled:opacity-30"
            >
              restore all
            </button>
            <span className="text-terminal-dim/60">·</span>
            <button
              onClick={purgeNow}
              disabled={busy}
              className="text-terminal-red hover:text-terminal-amber disabled:opacity-30"
            >
              purge now
            </button>
          </div>
        </header>

        <AdminTopNav token={token} />

        <div className="mt-6 text-terminal-dim/80 text-[11px] leading-relaxed max-w-2xl">
          Items moved to trash auto-purge 24 hours later. The hourly
          purge cron also removes the linked audio + peak-frame files
          from object storage. Restoring before then is non-destructive;
          after, the data is provably gone.
        </div>

        {!loaded && (
          <div className="mt-6 text-terminal-dim text-sm">Loading…</div>
        )}
        {error && (
          <div className="mt-6 border border-terminal-red bg-terminal-red/5 p-4 text-terminal-red text-sm">
            {error}
          </div>
        )}
        {loaded && !error && items.length === 0 && (
          <div className="mt-6 text-terminal-dim text-sm">
            Nothing in the trash. The site is whole.
          </div>
        )}

        {items.length > 0 && (
          <div className="mt-6 border border-terminal-border overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-terminal-border text-terminal-dim uppercase tracking-widest">
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Summary</th>
                  <th className="text-left px-3 py-2">Deleted by</th>
                  <th className="text-left px-3 py-2">Deleted at</th>
                  <th className="text-right px-3 py-2">Purges in</th>
                  <th className="text-right px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const purging =
                    new Date(it.purges_at).getTime() <= Date.now();
                  return (
                    <tr
                      key={`${it.table}:${it.id}`}
                      className="border-b border-terminal-border/60 align-top hover:bg-white/5"
                    >
                      <td className="px-3 py-2 text-terminal-amber uppercase tracking-widest">
                        {TABLE_LABEL[it.table]}
                      </td>
                      <td className="px-3 py-2 text-terminal-text max-w-[420px]">
                        <div className="line-clamp-2">{it.summary}</div>
                        <div className="text-terminal-dim/70 text-[10px] mt-0.5">
                          id {it.id.slice(0, 8)}…
                        </div>
                      </td>
                      <td className="px-3 py-2 text-terminal-dim">
                        {it.deleted_by ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-terminal-dim tabular-nums">
                        {new Date(it.deleted_at).toLocaleString()}
                      </td>
                      <td
                        className={
                          "px-3 py-2 text-right tabular-nums " +
                          (purging
                            ? "text-terminal-red"
                            : "text-terminal-amber")
                        }
                      >
                        {formatCountdown(it.purges_at)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => restoreOne(it)}
                          disabled={busy}
                          className="text-terminal-green hover:text-terminal-amber disabled:opacity-30"
                        >
                          restore
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

export default function TrashPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono p-6">
          Loading…
        </main>
      }
    >
      <TrashInner />
    </Suspense>
  );
}
