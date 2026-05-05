"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminTopNav } from "@/components/AdminTopNav";

/**
 * /admin/audit — append-only feed of admin actions.
 *
 * Every trash, restore, purge, kill-switch flip, forget-user, or
 * export call writes a row to `admin_audit`. This page renders
 * those in reverse-chronological order so the operator can be
 * watched too.
 *
 * Self-reflexive on purpose: the project is about asymmetric
 * surveillance, and an admin panel without an audit log is the
 * exact failure mode the project critiques.
 */

type AuditRow = {
  id: string;
  ts: string;
  admin_email: string;
  action: string;
  target_table: string | null;
  target_id: string | null;
  target_count: number | null;
  meta: Record<string, unknown> | null;
};

function summarize(row: AuditRow): string {
  const verb = row.action;
  const count = row.target_count ?? 0;
  const table = row.target_table ?? "";
  switch (verb) {
    case "trash":
      return `moved ${count} ${table} to trash`;
    case "restore":
      return `restored ${count} ${table} from trash`;
    case "purge": {
      const m = (row.meta as
        | { sessions?: number; visitor_logs?: number; testimonials?: number; storage_objects?: number }
        | null) ?? null;
      const parts: string[] = [];
      if (m?.sessions) parts.push(`${m.sessions} sessions`);
      if (m?.visitor_logs) parts.push(`${m.visitor_logs} logs`);
      if (m?.testimonials) parts.push(`${m.testimonials} testimonials`);
      if (m?.storage_objects) parts.push(`${m.storage_objects} blobs`);
      return parts.length > 0
        ? `purged ${parts.join(", ")}`
        : "purge ran (nothing to delete)";
    }
    case "flag.set": {
      const v = (row.meta as { value?: boolean } | null)?.value;
      return `set flag ${row.target_id} = ${v ? "ON" : "OFF"}`;
    }
    case "forget":
      return `forgot user (${count} rows soft-deleted)`;
    case "export.jsonl":
      return `exported ${count} rows as JSONL`;
    case "export.manifest":
      return `exported manifest (${count} signed URLs)`;
    default:
      return `${verb}${table ? ` on ${table}` : ""}${count ? ` × ${count}` : ""}`;
  }
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 60 * 60_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 24 * 60 * 60_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function AuditInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setError("Missing ?token= in URL.");
      setLoaded(true);
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/audit?token=${encodeURIComponent(token)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        setError(`Audit list failed: ${res.status}`);
        setLoaded(true);
        return;
      }
      const data = await res.json();
      setRows((data?.items ?? []) as AuditRow[]);
      setLoaded(true);
      setError(null);
    } catch (e) {
      setError(`Audit errored: ${(e as Error).message}`);
      setLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    void load();
    const h = setInterval(load, 10_000);
    return () => clearInterval(h);
  }, [load]);

  return (
    <main
      className="min-h-screen bg-terminal-bg text-terminal-text font-mono px-5 md:px-8 py-6 pb-24"
      style={{ backgroundColor: "#0A0A0B" }}
    >
      <div className="max-w-[1400px] mx-auto">
        <header className="border border-terminal-border bg-black/60 px-4 py-3 flex items-center gap-4 text-xs">
          <div className="text-terminal-green terminal-glow font-bold tracking-wider">
            ECHOMIND · AUDIT
          </div>
          <span className="text-terminal-dim">▸</span>
          <div className="text-terminal-dim uppercase tracking-widest">
            admin_audit · {rows.length} rows
          </div>
        </header>

        <AdminTopNav token={token} />

        <div className="mt-6 text-terminal-dim/80 text-[11px] leading-relaxed max-w-2xl">
          Every admin action — trash, restore, purge, kill-switch flips,
          forget-user, exports — is recorded here. Append-only. The IP
          column in the database is a sha-256 hash; it never appears on
          this page.
        </div>

        {!loaded && (
          <div className="mt-6 text-terminal-dim text-sm">Loading…</div>
        )}
        {error && (
          <div className="mt-6 border border-terminal-red bg-terminal-red/5 p-4 text-terminal-red text-sm">
            {error}
          </div>
        )}
        {loaded && !error && rows.length === 0 && (
          <div className="mt-6 text-terminal-dim text-sm">
            No actions recorded yet.
          </div>
        )}

        {rows.length > 0 && (
          <div className="mt-6 border border-terminal-border overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-terminal-border text-terminal-dim uppercase tracking-widest">
                  <th className="text-left px-3 py-2">When</th>
                  <th className="text-left px-3 py-2">Admin</th>
                  <th className="text-left px-3 py-2">Action</th>
                  <th className="text-left px-3 py-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-terminal-border/60 align-top hover:bg-white/5"
                  >
                    <td className="px-3 py-2 text-terminal-dim tabular-nums whitespace-nowrap">
                      <div>{relativeTime(r.ts)}</div>
                      <div className="text-[10px] text-terminal-dim/60">
                        {new Date(r.ts).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-terminal-text">
                      {r.admin_email}
                    </td>
                    <td className="px-3 py-2 text-terminal-amber uppercase tracking-widest">
                      {r.action}
                    </td>
                    <td className="px-3 py-2 text-terminal-text">
                      {summarize(r)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

export default function AuditPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono p-6">
          Loading…
        </main>
      }
    >
      <AuditInner />
    </Suspense>
  );
}
