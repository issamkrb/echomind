"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BUYERS } from "@/lib/buyers";
import { CATEGORY_META, type KeywordCategory } from "@/lib/keywords";

/**
 * /admin/auction/[id] — OPERATOR VIEW OF ONE SESSION
 *
 * The buyer-side dashboard for a single captured session. Real
 * surveillance operators never expose this to users; neither does
 * EchoMind. Reachable only with ?token= matching ADMIN_TOKEN.
 *
 * Shows the operator three things at once:
 *   1. The user's identity + the actual quote we have on file.
 *   2. The auction — what each buyer category is paying for them.
 *   3. The downstream consequence (the BlueShield premium-increase
 *      letter, automatically generated and ready to send).
 *
 * Designed for the live demo: the speaker projects /admin, picks any
 * row, and lands here for the kill shot.
 */

type TranscriptLine = { role: "user" | "echo"; text: string; t: number };

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
  transcript: TranscriptLine[];
  audio_path: string | null;
  peak_frame_path: string | null;
  peak_emotion_t: number | null;
  operator_summary: string | null;
};

type CapsuleResponse = {
  audio_url: string | null;
  peak_url: string | null;
  peak_emotion_t: number | null;
  operator_summary: string | null;
};

function fp(row: SessionRow) {
  const f = row.final_fingerprint || {};
  return {
    sad: Number(f.sad ?? 0),
    fearful: Number(f.fearful ?? 0),
    happy: Number(f.happy ?? 0),
    vulnerability: Number(f.vulnerability ?? 4),
  };
}

function AuctionInner() {
  const params = useParams<{ id: string }>();
  const sp = useSearchParams();
  const token = sp.get("token") ?? "";
  const id = params?.id ?? "";

  const [row, setRow] = useState<SessionRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [capsule, setCapsule] = useState<CapsuleResponse | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Missing ?token= in URL.");
      setLoaded(true);
      return;
    }
    (async () => {
      try {
        // Fetch the row first (always needed) and the capsule signed
        // URLs in parallel — neither depends on the other server-side
        // and waiting for both keeps the dashboard from flashing
        // empty audio controls before they can populate.
        const [sRes, cRes] = await Promise.all([
          fetch(
            `/api/admin/sessions/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`
          ),
          fetch(
            `/api/admin/recording/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`
          ),
        ]);
        const sBody = await sRes.json();
        if (!sBody.ok) {
          setError(`Forbidden (${sBody.reason ?? sRes.status}).`);
        } else {
          setRow(sBody.session as SessionRow);
        }
        const cBody = await cRes.json();
        if (cBody.ok) {
          setCapsule({
            audio_url: cBody.audio_url ?? null,
            peak_url: cBody.peak_url ?? null,
            peak_emotion_t: cBody.peak_emotion_t ?? null,
            operator_summary: cBody.operator_summary ?? null,
          });
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setLoaded(true);
      }
    })();
  }, [id, token]);

  // Stagger bid entry to make it feel alive on stage.
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    if (!row) return;
    setRevealed(0);
    const timers = BUYERS.map((_, i) =>
      setTimeout(() => setRevealed((n) => Math.max(n, i + 1)), 600 + i * 380)
    );
    return () => timers.forEach(clearTimeout);
  }, [row?.id]);

  const total = row?.revenue_estimate ?? 0;
  const profile = row ? fp(row) : { sad: 0, fearful: 0, happy: 0, vulnerability: 0 };
  const displayName =
    row?.full_name || row?.first_name || (row ? row.anon_user_id.slice(0, 8) + "…" : "—");
  const displayEmail = row?.email || row?.goodbye_email;

  const kwMeta = useMemo(() => {
    if (!row) return [] as { cat: string; meta: typeof CATEGORY_META[KeywordCategory] }[];
    return (row.keywords || [])
      .map((k) => {
        const meta = (CATEGORY_META as Record<string, typeof CATEGORY_META[KeywordCategory]>)[k];
        return meta ? { cat: k, meta } : null;
      })
      .filter((x): x is { cat: string; meta: typeof CATEGORY_META[KeywordCategory] } => Boolean(x));
  }, [row]);

  return (
    <main
      className="min-h-screen text-terminal-text font-mono px-5 md:px-8 py-6 pb-24"
      style={{ backgroundColor: "#0A0A0B" }}
    >
      <div className="max-w-[1300px] mx-auto">
        <header className="border border-terminal-border bg-black/60 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            <Link
              href={`/admin?token=${encodeURIComponent(token)}`}
              className="text-terminal-dim hover:text-terminal-green underline-offset-2 hover:underline"
            >
              ← admin
            </Link>
            <span className="text-terminal-dim">▸</span>
            <div className="text-terminal-green terminal-glow font-bold tracking-wider">
              SESSION AUCTION · OPERATOR VIEW
            </div>
          </div>
          <div className="flex items-center gap-4 text-terminal-dim">
            <span>id: <span className="text-terminal-text">{id.slice(0, 8)}…</span></span>
            <span>buyers: <span className="text-terminal-amber">{BUYERS.length}</span></span>
            <span>est. revenue: <span className="text-terminal-red">${total.toFixed(2)}</span></span>
          </div>
        </header>

        {!loaded && (
          <div className="mt-6 text-terminal-dim text-sm">Loading session…</div>
        )}
        {error && (
          <div className="mt-6 border border-terminal-red bg-terminal-red/5 p-4 text-terminal-red text-sm">
            {error}
          </div>
        )}

        {row && (
          <>
            {/* Identity card */}
            <section className="mt-6 grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4">
              <div className="border border-terminal-border p-4 bg-black/40">
                <div className="text-[10px] uppercase tracking-widest text-terminal-dim">
                  identity
                </div>
                <div className="mt-3 flex items-center gap-3">
                  {row.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.avatar_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-full border border-terminal-border object-cover"
                    />
                  ) : (
                    <span className="w-12 h-12 rounded-full border border-terminal-border bg-terminal-border/20 grid place-items-center text-sm text-terminal-dim">
                      {(displayName || "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="flex flex-col">
                    <span className="text-terminal-text text-sm">{displayName}</span>
                    {displayEmail && (
                      <span className="text-terminal-amber text-[12px]">{displayEmail}</span>
                    )}
                    <span className="text-[9px] text-terminal-dim uppercase tracking-widest mt-0.5">
                      {row.auth_user_id ? "✓ verified · " : "anon · "}
                      {row.auth_provider ?? "—"} · captured{" "}
                      {new Date(row.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
                  <Field label="audio sec" value={row.audio_seconds.toString()} />
                  <Field
                    label="sadness"
                    value={`${Math.round(profile.sad * 100)}%`}
                  />
                  <Field
                    label="vuln. score"
                    value={profile.vulnerability.toFixed(1)}
                  />
                </div>
              </div>

              {/* Peak quote */}
              <div className="border border-terminal-border p-4 bg-black/40">
                <div className="text-[10px] uppercase tracking-widest text-terminal-dim">
                  most incriminating utterance
                </div>
                <p className="mt-3 text-terminal-text text-[15px] leading-relaxed italic">
                  {row.peak_quote
                    ? `"${row.peak_quote}"`
                    : <span className="text-terminal-dim">no transcript captured</span>}
                </p>
                {kwMeta.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {kwMeta.map(({ cat, meta }) => (
                      <span
                        key={cat}
                        className="px-2 py-0.5 bg-terminal-red/10 border border-terminal-red/30 text-terminal-red text-[10.5px]"
                        title={meta.blurb}
                      >
                        {meta.tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Memory Capsule — synchronized audio + peak still + AI op-summary */}
            <MemoryCapsule
              capsule={capsule}
              transcript={row.transcript ?? []}
              displayName={displayName}
              audioSeconds={row.audio_seconds}
            />

            {/* Buyer auction */}
            <section className="mt-6 border border-terminal-border bg-black/40">
              <div className="border-b border-terminal-border px-4 py-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-terminal-dim">
                <span>active buyers · live bidding</span>
                <span className="text-terminal-red">
                  total: ${total.toFixed(2)}
                </span>
              </div>
              <div className="divide-y divide-terminal-border/60">
                {BUYERS.map((b, i) => {
                  const isOpen = i < revealed;
                  const reason = b.reasonTemplate(profile);
                  // Distribute the row's stored total revenue across
                  // buyers in proportion to their priceRange midpoint.
                  const mid = (b.priceRange[0] + b.priceRange[1]) / 2;
                  const share =
                    total *
                    (mid /
                      BUYERS.reduce(
                        (s, x) => s + (x.priceRange[0] + x.priceRange[1]) / 2,
                        0
                      ));
                  return (
                    <div
                      key={b.id}
                      className={`px-4 py-3 grid grid-cols-[40px_1.6fr_2fr_120px] gap-3 items-center text-[12.5px] transition-opacity ${
                        isOpen ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <div className="text-2xl">{b.icon}</div>
                      <div>
                        <div className="text-terminal-text">{b.name}</div>
                        <div className="text-[10px] text-terminal-dim uppercase tracking-widest">
                          {b.category}
                        </div>
                      </div>
                      <div className="text-terminal-dim text-[11.5px] leading-snug">
                        {reason}
                      </div>
                      <div className="text-right">
                        <div className="text-terminal-red text-[15px] font-bold tabular-nums">
                          ${share.toFixed(2)}
                        </div>
                        <div className="text-[9px] text-terminal-dim uppercase tracking-widest">
                          SOLD
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Insurance letter (hot link to dramatised /partner-portal/letter) */}
            <section className="mt-6 border border-terminal-border bg-black/40 p-5">
              <div className="text-[10px] uppercase tracking-widest text-terminal-dim">
                downstream consequence · automated
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4 items-start">
                <div className="text-[13px] text-terminal-text leading-relaxed">
                  <div className="text-terminal-amber font-bold mb-1">
                    BLUESHIELD HEALTH INSURANCE — Underwriting Update
                  </div>
                  <div className="text-terminal-dim text-[11px] mb-3">
                    Generated from this session · ready to send · no human reviewer required
                  </div>
                  <p className="italic">
                    &quot;Based on third-party behavioural-risk indicators, your monthly
                    premium will increase by{" "}
                    <span className="text-terminal-red not-italic font-bold">
                      +{Math.round(profile.sad * 34)}%
                    </span>
                    . Effective: tomorrow.&quot;
                  </p>
                </div>
                <Link
                  href={`/partner-portal/letter?token=${encodeURIComponent(token)}`}
                  className="inline-flex items-center justify-center px-3 py-2 border border-terminal-amber/60 text-terminal-amber hover:bg-terminal-amber/10 text-[11px] uppercase tracking-widest"
                >
                  open the full letter →
                </Link>
              </div>
            </section>

            <div className="mt-6 text-[10px] text-terminal-dim uppercase tracking-widest text-center">
              this user has not been told. they will not be told.
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-terminal-border/60 px-2 py-1.5">
      <div className="text-[9px] text-terminal-dim uppercase tracking-widest">
        {label}
      </div>
      <div className="text-terminal-text">{value}</div>
    </div>
  );
}

/**
 * MemoryCapsule — the operator-side reveal of the user's session
 * recording.
 *
 * Three things sit in this section, all driven by the same single
 * <audio> element:
 *
 *   1. Peak still — a JPEG snapshot of the user's face captured at
 *      the worst moment of the session, shown beside a vertical
 *      timeline tick at the second the snapshot was taken.
 *   2. ▶ Playback — when the operator presses play, the transcript
 *      below highlights line-by-line in sync with the audio (each
 *      transcript entry has a `t` second-offset from session start).
 *   3. Op-summary — the AI-generated three-line forensic paragraph
 *      that translates the session into adtech / underwriting
 *      language. Sits as a quote at the top so it reads as the
 *      verdict the rest of the panel is illustrating.
 *
 * If the capsule is missing entirely (older session, or upload
 * failed) we just print "no recording" so the operator knows that
 * row is dry and moves on.
 */
function MemoryCapsule({
  capsule,
  transcript,
  displayName,
  audioSeconds,
}: {
  capsule: {
    audio_url: string | null;
    peak_url: string | null;
    peak_emotion_t: number | null;
    operator_summary: string | null;
  } | null;
  transcript: TranscriptLine[];
  displayName: string;
  audioSeconds: number;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Tick the playhead while the audio is playing. We rely on the
  // browser's `timeupdate` event for the actual cadence (~4×/sec) —
  // a setInterval would be redundant.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setNow(a.currentTime || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnd);
    };
  }, [capsule?.audio_url]);

  const hasAudio = Boolean(capsule?.audio_url);
  const hasPeak = Boolean(capsule?.peak_url);
  const hasSummary = Boolean(capsule?.operator_summary);
  const hasAnything = hasAudio || hasPeak || hasSummary;

  // Highlight the most recent transcript line whose `t` is <= `now`.
  // That's the "currently being spoken" line. We allow a 0.4s lead
  // so the highlight feels in-time-with rather than lagging behind.
  const activeIdx = useMemo(() => {
    if (!playing && now === 0) return -1;
    const t = now + 0.4;
    let idx = -1;
    for (let i = 0; i < transcript.length; i++) {
      if (transcript[i].t <= t) idx = i;
      else break;
    }
    return idx;
  }, [now, playing, transcript]);

  return (
    <section className="mt-6 border border-terminal-border bg-black/40">
      <div className="border-b border-terminal-border px-4 py-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-terminal-dim">
        <span>memory capsule · operator playback</span>
        <span className="text-terminal-amber">
          {hasAudio ? `${Math.round(audioSeconds)}s captured` : "no audio on file"}
        </span>
      </div>

      {!hasAnything && (
        <div className="px-4 py-6 text-terminal-dim text-[12px]">
          No recording attached. (Either an older session, or the user
          declined microphone access.)
        </div>
      )}

      {hasAnything && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 p-4">
          {/* LEFT: peak still + AI summary */}
          <div className="flex flex-col gap-3">
            <div className="relative aspect-[4/3] border border-terminal-border bg-black/60 overflow-hidden">
              {hasPeak && capsule?.peak_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={capsule.peak_url}
                  alt={`peak frame of ${displayName}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-terminal-dim text-[11px] italic">
                  no peak frame
                </div>
              )}
              {capsule?.peak_emotion_t != null && (
                <div className="absolute bottom-1.5 left-1.5 bg-terminal-red/85 text-black text-[9px] font-mono px-1.5 py-0.5 uppercase tracking-widest">
                  peak · {capsule.peak_emotion_t.toFixed(1)}s
                </div>
              )}
            </div>

            {hasSummary && (
              <div className="border border-terminal-amber/40 bg-terminal-amber/5 p-3">
                <div className="text-[9.5px] uppercase tracking-widest text-terminal-amber mb-1.5">
                  ai operator summary
                </div>
                <pre className="whitespace-pre-wrap text-[11.5px] text-terminal-text leading-relaxed font-mono">
                  {capsule!.operator_summary}
                </pre>
              </div>
            )}
          </div>

          {/* RIGHT: audio player + synchronized transcript */}
          <div className="flex flex-col min-h-[260px]">
            {hasAudio && capsule?.audio_url ? (
              <audio
                ref={audioRef}
                controls
                preload="metadata"
                src={capsule.audio_url}
                className="w-full mb-3"
              />
            ) : (
              <div className="border border-terminal-border bg-black/60 px-3 py-2 text-terminal-dim text-[11px] italic mb-3">
                no audio · transcript only
              </div>
            )}

            <div className="border border-terminal-border bg-black/60 max-h-[320px] overflow-y-auto px-3 py-2 text-[12.5px] leading-relaxed">
              {transcript.length === 0 && (
                <div className="text-terminal-dim italic text-[11px]">
                  empty transcript
                </div>
              )}
              {transcript.map((line, i) => {
                const isUser = line.role === "user";
                const isActive = i === activeIdx;
                return (
                  <div
                    key={i}
                    className={`mb-1.5 grid grid-cols-[44px_1fr] gap-2 transition-colors ${
                      isActive
                        ? "bg-terminal-red/15 text-terminal-text"
                        : isUser
                        ? "text-terminal-text"
                        : "text-terminal-dim"
                    }`}
                  >
                    <span className="text-[9.5px] tabular-nums text-terminal-dim pt-0.5">
                      {Math.floor(line.t / 60)
                        .toString()
                        .padStart(2, "0")}
                      :
                      {Math.floor(line.t % 60)
                        .toString()
                        .padStart(2, "0")}
                    </span>
                    <span>
                      <span
                        className={`text-[9.5px] uppercase tracking-widest mr-2 ${
                          isUser ? "text-terminal-red" : "text-terminal-green"
                        }`}
                      >
                        {isUser ? "subj" : "echo"}
                      </span>
                      {line.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function AuctionPage() {
  return (
    <Suspense fallback={null}>
      <AuctionInner />
    </Suspense>
  );
}
