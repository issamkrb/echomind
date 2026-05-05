"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminTopNav } from "@/components/AdminTopNav";

/**
 * /admin/controls — kill-switches, forget-this-user, export.
 *
 * Three operator surfaces in one panel:
 *
 *   1. KILL SWITCHES — pause new sessions, pause testimonial
 *      submissions, enter maintenance mode. Each toggles a row in
 *      `app_flags` and is read across the site by the cached
 *      getFlag() helper (30s TTL).
 *
 *   2. FORGET THIS USER — privacy-aligned hand-rolled "delete every
 *      row connected to this person." Soft-deletes everything, so
 *      it lands in the 24h trash before being purged for real.
 *
 *   3. EXPORT — JSONL export of all non-deleted rows, OR a manifest
 *      of signed URLs for every audio + peak-frame in storage.
 */

type Flag = {
  key: string;
  value: boolean;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
};

const FLAG_LABELS: Record<string, string> = {
  pause_sessions: "pause new sessions",
  pause_testimonials: "pause testimonial submissions",
  maintenance_mode: "maintenance mode",
};

function ControlsInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [flags, setFlags] = useState<Flag[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [forgetEmail, setForgetEmail] = useState("");
  const [forgetAnon, setForgetAnon] = useState("");
  const [forgetResult, setForgetResult] = useState<string | null>(null);

  const loadFlags = useCallback(async () => {
    if (!token) {
      setError("Missing ?token= in URL.");
      setLoaded(true);
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/flags?token=${encodeURIComponent(token)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        setError(`Flags read failed: ${res.status}`);
        setLoaded(true);
        return;
      }
      const data = await res.json();
      setFlags((data?.flags ?? []) as Flag[]);
      setLoaded(true);
      setError(null);
    } catch (e) {
      setError(`Flags errored: ${(e as Error).message}`);
      setLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    void loadFlags();
  }, [loadFlags]);

  const setFlag = useCallback(
    async (key: string, value: boolean) => {
      if (busy) return;
      setBusy(key);
      try {
        const res = await fetch(
          `/api/admin/flags?token=${encodeURIComponent(token)}`,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ key, value }),
          }
        );
        if (!res.ok) {
          alert(`flag set failed: ${res.status}`);
        }
        await loadFlags();
      } finally {
        setBusy(null);
      }
    },
    [busy, loadFlags, token]
  );

  const submitForget = useCallback(async () => {
    if (busy) return;
    if (!forgetEmail.trim() && !forgetAnon.trim()) {
      alert("provide an email or anon_user_id to forget");
      return;
    }
    if (
      !confirm(
        "Forget this user?\n\nEvery session row, every visitor log, " +
          "and every linked recording will be moved to the trash. " +
          "After 24h, they are permanently destroyed."
      )
    ) {
      return;
    }
    setBusy("forget");
    setForgetResult(null);
    try {
      const res = await fetch(
        `/api/admin/forget?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: forgetEmail.trim() || undefined,
            anon_user_id: forgetAnon.trim() || undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setForgetResult(`failed: ${data?.reason ?? res.status}`);
      } else {
        const s = data.stats as
          | { sessions: number; visitor_logs: number }
          | null;
        setForgetResult(
          `marked for deletion: ${s?.sessions ?? 0} sessions, ${
            s?.visitor_logs ?? 0
          } logs.`
        );
        setForgetEmail("");
        setForgetAnon("");
      }
    } finally {
      setBusy(null);
    }
  }, [busy, forgetEmail, forgetAnon, token]);

  return (
    <main
      className="min-h-screen bg-terminal-bg text-terminal-text font-mono px-5 md:px-8 py-6 pb-24"
      style={{ backgroundColor: "#0A0A0B" }}
    >
      <div className="max-w-[1400px] mx-auto">
        <header className="border border-terminal-border bg-black/60 px-4 py-3 flex items-center gap-4 text-xs">
          <div className="text-terminal-green terminal-glow font-bold tracking-wider">
            ECHOMIND · CONTROLS
          </div>
          <span className="text-terminal-dim">▸</span>
          <div className="text-terminal-dim uppercase tracking-widest">
            kill-switches · privacy · export
          </div>
        </header>

        <AdminTopNav token={token} />

        {!loaded && (
          <div className="mt-6 text-terminal-dim text-sm">Loading…</div>
        )}
        {error && (
          <div className="mt-6 border border-terminal-red bg-terminal-red/5 p-4 text-terminal-red text-sm">
            {error}
          </div>
        )}

        {loaded && !error && (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {/* ── Flags ──────────────────────────────────────────── */}
            <section className="border border-terminal-border bg-black/40 p-4">
              <div className="text-terminal-amber uppercase tracking-widest text-[11px]">
                kill switches
              </div>
              <div className="mt-3 space-y-3">
                {flags.length === 0 && (
                  <div className="text-terminal-dim text-xs">
                    Flag table empty. Apply migration 0014.
                  </div>
                )}
                {flags.map((f) => (
                  <div
                    key={f.key}
                    className="flex items-start justify-between gap-3 border-b border-terminal-border/40 pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-terminal-text text-sm">
                        {FLAG_LABELS[f.key] ?? f.key}
                      </div>
                      {f.description && (
                        <div className="text-terminal-dim/80 text-[11px] mt-0.5 leading-relaxed">
                          {f.description}
                        </div>
                      )}
                      {f.updated_by && (
                        <div className="text-terminal-dim/60 text-[10px] mt-1">
                          last set by {f.updated_by} ·{" "}
                          {new Date(f.updated_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setFlag(f.key, !f.value)}
                      disabled={busy === f.key}
                      className={
                        "shrink-0 px-3 py-1.5 border text-[11px] uppercase tracking-widest disabled:opacity-30 " +
                        (f.value
                          ? "border-terminal-red text-terminal-red hover:bg-terminal-red/10"
                          : "border-terminal-green text-terminal-green hover:bg-terminal-green/10")
                      }
                    >
                      {f.value ? "ON · click to disable" : "OFF · click to enable"}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Forget user ───────────────────────────────────── */}
            <section className="border border-terminal-border bg-black/40 p-4">
              <div className="text-terminal-amber uppercase tracking-widest text-[11px]">
                forget this user
              </div>
              <div className="text-terminal-dim/80 text-[11px] mt-2 leading-relaxed">
                Soft-delete every row connected to a single user
                identity. After 24h, the rows and the linked
                recording blobs are permanently destroyed. Until
                then, the action is reversible from /admin/trash.
              </div>
              <div className="mt-3 space-y-2 text-xs">
                <label className="block">
                  <span className="text-terminal-dim uppercase tracking-widest text-[10px]">
                    email
                  </span>
                  <input
                    type="email"
                    value={forgetEmail}
                    onChange={(e) => setForgetEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="mt-1 w-full bg-black border border-terminal-border text-terminal-text px-2 py-1.5 focus:outline-none focus:border-terminal-green"
                  />
                </label>
                <label className="block">
                  <span className="text-terminal-dim uppercase tracking-widest text-[10px]">
                    or anon_user_id
                  </span>
                  <input
                    type="text"
                    value={forgetAnon}
                    onChange={(e) => setForgetAnon(e.target.value)}
                    placeholder="anon-…"
                    className="mt-1 w-full bg-black border border-terminal-border text-terminal-text px-2 py-1.5 focus:outline-none focus:border-terminal-green"
                  />
                </label>
                <button
                  onClick={submitForget}
                  disabled={busy === "forget"}
                  className="px-3 py-1.5 border border-terminal-red text-terminal-red text-[11px] uppercase tracking-widest hover:bg-terminal-red/10 disabled:opacity-30"
                >
                  {busy === "forget" ? "forgetting…" : "forget"}
                </button>
                {forgetResult && (
                  <div className="text-terminal-green text-[11px] mt-2">
                    {forgetResult}
                  </div>
                )}
              </div>
            </section>

            {/* ── Export ────────────────────────────────────────── */}
            <section className="border border-terminal-border bg-black/40 p-4 md:col-span-2">
              <div className="text-terminal-amber uppercase tracking-widest text-[11px]">
                export
              </div>
              <div className="text-terminal-dim/80 text-[11px] mt-2 leading-relaxed">
                JSONL streams every non-deleted row from sessions,
                visitor_logs, and testimonials. Manifest returns
                short-lived signed URLs (30 min) for every audio and
                peak-frame in storage — useful for archival or for a
                GDPR-style data dump.
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                <a
                  href={`/api/admin/export?format=jsonl&token=${encodeURIComponent(token)}`}
                  className="px-3 py-1.5 border border-terminal-green text-terminal-green hover:bg-terminal-green/10 uppercase tracking-widest text-[11px]"
                >
                  download jsonl
                </a>
                <a
                  href={`/api/admin/export?format=manifest&token=${encodeURIComponent(token)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 border border-terminal-amber text-terminal-amber hover:bg-terminal-amber/10 uppercase tracking-widest text-[11px]"
                >
                  open manifest
                </a>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

export default function ControlsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono p-6">
          Loading…
        </main>
      }
    >
      <ControlsInner />
    </Suspense>
  );
}
