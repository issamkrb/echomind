"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminTopNav } from "@/components/AdminTopNav";

/**
 * /admin/gallery — the trading-card grid.
 *
 * Pure picture + voice. A clean grid of every session that has at
 * least one peak frame or audio recording. Click a tile to open
 * the full-size viewer with audio playback. Sortable by:
 *
 *   - newest      (default)
 *   - oldest
 *   - intensity   (max of fear / shame / sadness — the rhetorical sort)
 *   - duration    (audio_seconds desc)
 *
 * The "intensity" sort is the rhetorical climax of the operator
 * surface: it foregrounds the most "valuable" data, the way a real
 * vendor's analytics dashboard would. Same data the consumer side
 * paints in warm colours; here we just re-rank it.
 *
 * Tiles also support trash from this view (one-click) — the
 * receipt confirmation lives in /admin/trash where it can be
 * undone for 24h.
 */

type Tile = {
  id: string;
  created_at: string;
  first_name: string | null;
  voice_persona: string | null;
  audio_seconds: number | null;
  peak_quote: string | null;
  intensity: number;
  audio_url: string | null;
  peak_url: string | null;
  deleted_at: string | null;
};

const SORTS = [
  { key: "newest", label: "newest" },
  { key: "oldest", label: "oldest" },
  { key: "intensity", label: "intensity" },
  { key: "duration", label: "duration" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

function GalleryInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("newest");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [open, setOpen] = useState<Tile | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setError("Missing ?token= in URL.");
      setLoaded(true);
      return;
    }
    try {
      const url =
        `/api/admin/gallery?token=${encodeURIComponent(token)}` +
        `&sort=${encodeURIComponent(sort)}` +
        (includeDeleted ? `&include_deleted=1` : "");
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        setError(`Gallery list failed: ${res.status}`);
        setLoaded(true);
        return;
      }
      const data = await res.json();
      setTiles((data?.tiles ?? []) as Tile[]);
      setLoaded(true);
      setError(null);
    } catch (e) {
      setError(`Gallery errored: ${(e as Error).message}`);
      setLoaded(true);
    }
  }, [token, sort, includeDeleted]);

  useEffect(() => {
    void load();
  }, [load]);

  const trashTile = useCallback(
    async (id: string) => {
      if (busy) return;
      if (
        !confirm(
          "Move this session to the trash?\n\n" +
            "It can be restored from /admin/trash for the next 24 hours.\n" +
            "After that, the row, the audio recording, and the peak " +
            "frame will be permanently destroyed."
        )
      ) {
        return;
      }
      setBusy(true);
      try {
        const res = await fetch(
          `/api/admin/moderate?token=${encodeURIComponent(token)}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              action: "trash",
              table: "sessions",
              ids: [id],
            }),
          }
        );
        if (!res.ok) alert(`trash failed: ${res.status}`);
        setOpen(null);
        await load();
      } finally {
        setBusy(false);
      }
    },
    [busy, load, token]
  );

  return (
    <main
      className="min-h-screen bg-terminal-bg text-terminal-text font-mono px-5 md:px-8 py-6 pb-24"
      style={{ backgroundColor: "#0A0A0B" }}
    >
      <div className="max-w-[1400px] mx-auto">
        <header className="border border-terminal-border bg-black/60 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs">
          <div className="flex items-center gap-4">
            <div className="text-terminal-green terminal-glow font-bold tracking-wider">
              ECHOMIND · GALLERY
            </div>
            <span className="text-terminal-dim">▸</span>
            <div className="text-terminal-dim uppercase tracking-widest">
              picture + voice · {tiles.length} tiles
            </div>
          </div>
          <div className="flex items-center gap-3 text-terminal-dim">
            <span>sort</span>
            <div className="flex gap-2">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  className={
                    sort === s.key
                      ? "text-terminal-green terminal-glow"
                      : "hover:text-terminal-green"
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
            <span className="text-terminal-dim/60">·</span>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)}
                className="accent-terminal-amber"
              />
              <span>include trashed</span>
            </label>
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
        {loaded && !error && tiles.length === 0 && (
          <div className="mt-6 text-terminal-dim text-sm">
            No sessions with capture yet.
          </div>
        )}

        {tiles.length > 0 && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {tiles.map((t) => {
              const trashed = Boolean(t.deleted_at);
              return (
                <button
                  key={t.id}
                  onClick={() => setOpen(t)}
                  className="relative group border border-terminal-border bg-black/40 overflow-hidden hover:border-terminal-amber transition text-left"
                >
                  <div className="relative aspect-[4/3] bg-black">
                    {t.peak_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.peak_url}
                        alt="peak frame"
                        className={
                          "w-full h-full object-cover " +
                          (trashed ? "grayscale opacity-50" : "")
                        }
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-terminal-dim/50 text-[10px]">
                        audio only
                      </div>
                    )}
                    {/* intensity bar — visual sort key */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                      <div
                        className="h-full bg-terminal-red/80"
                        style={{
                          width: `${Math.min(100, Math.round(t.intensity * 100))}%`,
                        }}
                      />
                    </div>
                    {trashed && (
                      <div className="absolute top-1 left-1 bg-black/70 text-terminal-red text-[9px] font-mono px-1.5 py-0.5 rounded">
                        TRASHED
                      </div>
                    )}
                    {t.audio_url && (
                      <div className="absolute top-1 right-1 bg-black/70 text-terminal-green text-[9px] font-mono px-1.5 py-0.5 rounded">
                        ▶
                      </div>
                    )}
                  </div>
                  <div className="px-2 py-1.5 text-[10px] text-terminal-dim leading-tight">
                    <div className="text-terminal-text truncate">
                      {t.first_name ?? "—"}
                      {t.voice_persona ? ` · ${t.voice_persona}` : ""}
                    </div>
                    <div className="flex justify-between">
                      <span>
                        {t.audio_seconds ? `${Math.round(t.audio_seconds)}s` : "—"}
                      </span>
                      <span className="tabular-nums">
                        {Math.round(t.intensity * 100)}%
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {open && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-30 grid place-items-center bg-black/85 p-4"
            onClick={() => setOpen(null)}
          >
            <div
              className="relative max-w-2xl w-full border border-terminal-border bg-black/90 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setOpen(null)}
                className="absolute top-2 right-3 text-terminal-dim hover:text-terminal-green"
                aria-label="close"
              >
                ✕
              </button>
              <div className="text-terminal-amber uppercase tracking-widest text-[11px] mb-3">
                tile · {open.id.slice(0, 8)}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="aspect-[4/3] bg-black border border-terminal-border">
                  {open.peak_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={open.peak_url}
                      alt="peak frame full"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-terminal-dim text-xs">
                      no peak frame
                    </div>
                  )}
                </div>
                <div className="text-xs text-terminal-text space-y-2">
                  <div>
                    <div className="text-terminal-dim uppercase tracking-widest">
                      identity
                    </div>
                    <div>{open.first_name ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-terminal-dim uppercase tracking-widest">
                      voice
                    </div>
                    <div>{open.voice_persona ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-terminal-dim uppercase tracking-widest">
                      duration
                    </div>
                    <div>
                      {open.audio_seconds
                        ? `${Math.round(open.audio_seconds)}s`
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-terminal-dim uppercase tracking-widest">
                      intensity
                    </div>
                    <div>{Math.round(open.intensity * 100)}%</div>
                  </div>
                  {open.peak_quote && (
                    <div>
                      <div className="text-terminal-dim uppercase tracking-widest">
                        peak quote
                      </div>
                      <div className="italic text-terminal-text">
                        “{open.peak_quote}”
                      </div>
                    </div>
                  )}
                  {open.audio_url && (
                    <div>
                      <div className="text-terminal-dim uppercase tracking-widest">
                        audio
                      </div>
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <audio
                        src={open.audio_url}
                        controls
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex justify-between items-center text-xs">
                <a
                  href={`/admin/auction/${open.id}?token=${encodeURIComponent(token)}`}
                  className="text-terminal-amber hover:text-terminal-green underline underline-offset-2"
                >
                  open auction view →
                </a>
                {!open.deleted_at && (
                  <button
                    onClick={() => trashTile(open.id)}
                    disabled={busy}
                    className="text-terminal-red hover:text-terminal-amber disabled:opacity-30"
                  >
                    move to trash
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function GalleryPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono p-6">
          Loading…
        </main>
      }
    >
      <GalleryInner />
    </Suspense>
  );
}
