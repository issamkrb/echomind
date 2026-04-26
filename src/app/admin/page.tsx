"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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
};

function AdminInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Missing ?token= in URL.");
      setLoaded(true);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/admin/sessions?token=${encodeURIComponent(token)}`);
        const body = await res.json();
        if (!body.ok) {
          setError(`Forbidden (${body.reason ?? res.status}).`);
        } else {
          setRows(body.sessions);
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setLoaded(true);
      }
    })();
  }, [token]);

  const total = rows.reduce((s, r) => s + (r.revenue_estimate ?? 0), 0);

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
          </div>
        </header>

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
                  <th className="text-left px-3 py-2">Keywords</th>
                  <th className="text-left px-3 py-2">Voice</th>
                  <th className="text-right px-3 py-2">Sec</th>
                  <th className="text-center px-3 py-2">Capsule</th>
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
                  return (
                    <tr key={r.id} className="border-b border-terminal-border/60 align-top hover:bg-white/5">
                      <td className="px-3 py-2 text-terminal-dim whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString()}
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
                      <td className="px-3 py-2 text-terminal-text italic max-w-[360px]">
                        {r.peak_quote ? `"${r.peak_quote}"` : <span className="text-terminal-dim">—</span>}
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
    </main>
  );
}

export default function Admin() {
  return (
    <Suspense fallback={null}>
      <AdminInner />
    </Suspense>
  );
}
