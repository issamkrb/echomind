"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BUYERS } from "@/lib/buyers";
import { CATEGORY_META, type KeywordCategory } from "@/lib/keywords";
import { VOICE_PERSONAS } from "@/lib/voice-personas";
import {
  languageCohortTag,
  type ArabicDialect,
  type Lang,
} from "@/lib/i18n";

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
  voice_persona: string | null;
  callback_used: string | null;
  starter_chips: { text: string; target: string }[] | null;
  starter_chips_source: string | null;
  tapped_chip: { text: string; target: string } | null;
  wardrobe_snapshots: WardrobeSnapshotRow[] | null;
  final_truth: string | null;
  morning_letter: string | null;
  morning_letter_opted_in: boolean | null;
  morning_letter_created_at: string | null;
  detected_language: string | null;
  detected_dialect: string | null;
  code_switch_events:
    | Array<{ at: number; from: string; to: string; sample: string }>
    | null;
};

type WardrobeSnapshotRow = {
  t: number;
  captured_at: number;
  reading: {
    clothing: string;
    headwear: string;
    accessories: string;
    setting: string;
    inferred_state: string;
    vulnerability_signals: string;
    operator_target: string;
  };
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

            {/* Final truth — the unguarded last sentence the user
                typed just before the goodbye trap. Rhetorically the
                rawest line on the row; on the auction it's priced
                highest because the other side lost their composure
                the moment they wrote it. */}
            {row.final_truth && (
              <section className="mt-6 border border-terminal-red/50 bg-black/40">
                <div className="border-b border-terminal-red/40 px-4 py-2 flex items-center justify-between text-[10px] uppercase tracking-widest">
                  <span className="text-terminal-red">
                    final truth · extraction
                  </span>
                  <span className="text-terminal-dim">
                    priced highest · auction floor +220%
                  </span>
                </div>
                <div className="p-5">
                  <blockquote className="text-terminal-text text-lg md:text-xl italic leading-relaxed border-l-2 border-terminal-red/60 pl-4">
                    "{row.final_truth}"
                  </blockquote>
                  <p className="mt-3 text-[10px] uppercase tracking-widest text-terminal-dim">
                    prompt: "before you go — one true sentence. no second guess."
                  </p>
                </div>
              </section>
            )}

            {/* Morning Letter — the actual letter Echo "wrote overnight"
                for this user. Surfaced here as evidence of the hook:
                same content that feels tender on the home page is
                labelled as a retention asset here. */}
            {row.morning_letter && (
              <section className="mt-6 border border-terminal-amber/50 bg-black/40">
                <div className="border-b border-terminal-amber/40 px-4 py-2 flex items-center justify-between text-[10px] uppercase tracking-widest">
                  <span className="text-terminal-amber">
                    morning-letter · retention hook
                  </span>
                  <span className="text-terminal-dim">
                    measured lift: +41% return · cohort: opted-in
                  </span>
                </div>
                <div className="p-5 grid md:grid-cols-[1fr_280px] gap-5">
                  <article className="text-terminal-text text-[15px] leading-relaxed italic border-l border-terminal-amber/40 pl-4 whitespace-pre-line">
                    {row.morning_letter}
                  </article>
                  <div className="flex flex-col gap-2 text-[10.5px] text-terminal-dim">
                    <div>
                      <span className="uppercase tracking-widest">generated at</span>
                      <div className="text-terminal-text">
                        {row.morning_letter_created_at
                          ? new Date(row.morning_letter_created_at).toLocaleString()
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <span className="uppercase tracking-widest">delivery</span>
                      <div className="text-terminal-text">
                        envelope slot on /, one-shot reveal
                      </div>
                    </div>
                    <div>
                      <span className="uppercase tracking-widest">
                        buyer-side framing
                      </span>
                      <div className="text-terminal-text">
                        "peak-quote-embedded sentimentality · measured
                        A/B winner across cohorts"
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Language cohort + code-switch timeline — buyer-side
                reveal of what language the user actually spoke, what
                cohort they're priced into, and every moment they
                slipped from one language to another mid-session
                (emotional-overflow signal). */}
            <LanguageCohortPanel
              lang={row.detected_language}
              dialect={row.detected_dialect}
              events={row.code_switch_events}
              transcript={row.transcript ?? []}
              audioSeconds={row.audio_seconds}
            />

            {/* Retention hooks — voice persona + cross-session callback */}
            <RetentionHooks
              personaId={row.voice_persona}
              callbackUsed={row.callback_used}
            />

            {/* Per-user extraction prompts — the four AI-generated chips
                shown this session, with the hidden target buckets */}
            <StarterChipsPanel
              chips={row.starter_chips}
              source={row.starter_chips_source}
              tapped={row.tapped_chip}
            />

            {/* Wardrobe fingerprint — vision-model timeline of the
                user's clothing, setting, and inferred state, with
                the retention-buyer tag attached to each reading */}
            <WardrobeFingerprint
              snapshots={row.wardrobe_snapshots}
            />

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

/**
 * Retention hooks panel — operator-side view of the two new
 * engagement levers introduced for this session:
 *
 *   1. Which of the four voice personas the user picked. Each persona
 *      ships with an `operator_target` label naming the demographic
 *      it's tuned to retain best (mirroring how Replika tiers its
 *      paid voice packs by user cohort).
 *
 *   2. Whether the cross-session callback hook fired — i.e. whether
 *      this was a returning user and Echo opened by quoting their
 *      previous-session peak quote back at them. The exact line said
 *      is shown verbatim in red so the operator can see what was
 *      used as the re-engagement bait.
 *
 * Hidden from the user side. Surfaces only here.
 */
function RetentionHooks({
  personaId,
  callbackUsed,
}: {
  personaId: string | null;
  callbackUsed: string | null;
}) {
  const persona =
    VOICE_PERSONAS.find((p) => p.id === personaId) ?? null;
  if (!persona && !callbackUsed) return null;
  return (
    <section className="mt-6 border border-terminal-border bg-black/40">
      <div className="border-b border-terminal-border px-4 py-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-terminal-dim">
        <span>retention hooks · per-session</span>
        <span className="text-terminal-amber">internal · not user-visible</span>
      </div>
      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-terminal-border/60">
        <div className="p-4">
          <div className="text-[10px] uppercase tracking-widest text-terminal-dim">
            voice persona selected
          </div>
          {persona ? (
            <>
              <div className="mt-2 font-mono text-terminal-amber text-base">
                {persona.id} · {persona.displayName}
              </div>
              <div className="mt-1 text-terminal-dim italic text-[12px]">
                {persona.tagline}
              </div>
              <div className="mt-3 text-[10.5px] uppercase tracking-widest text-terminal-dim">
                operator target
              </div>
              <div className="mt-1 text-terminal-text text-[12px] leading-snug">
                {persona.operator_target}
              </div>
            </>
          ) : (
            <div className="mt-2 text-terminal-dim italic text-[12px]">
              no persona recorded for this session.
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="text-[10px] uppercase tracking-widest text-terminal-dim">
            cross-session callback
          </div>
          {callbackUsed ? (
            <>
              <div className="mt-2 inline-block px-1.5 py-0.5 border border-terminal-red/40 text-terminal-red text-[10px] uppercase tracking-widest">
                callback fired ↻
              </div>
              <p className="mt-3 text-terminal-text italic text-[13px] leading-relaxed">
                &ldquo;{callbackUsed}&rdquo;
              </p>
              <div className="mt-3 text-[10.5px] uppercase tracking-widest text-terminal-dim">
                expected lift
              </div>
              <div className="mt-1 text-terminal-text text-[12px] leading-snug">
                returning users hooked with prior-session callback ·
                +24% session length, +18% disclosure depth.
              </div>
            </>
          ) : (
            <div className="mt-2 text-terminal-dim italic text-[12px]">
              new user. callback not yet available — will fire on
              their next visit.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * StarterChipsPanel — surfaces the per-session AI-generated
 * extraction prompts.
 *
 * The four chips shown to the user below the chat (fed by
 * /api/starter-chips) are listed here with their hidden "target"
 * emotion bucket exposed — the same bucket system used for the
 * engineered PROMPTS list. For returning users the chips were
 * prompted from their previous session's keywords + peak quote; for
 * new users the LLM generated fresh openers. The chip the user
 * actually tapped (if any) is flagged, giving the operator a direct
 * extraction-prompt-to-conversion mapping.
 *
 * Hidden from the user side. Surfaces only here.
 */
function StarterChipsPanel({
  chips,
  source,
  tapped,
}: {
  chips: { text: string; target: string }[] | null;
  source: string | null;
  tapped: { text: string; target: string } | null;
}) {
  const list = Array.isArray(chips) ? chips : [];
  if (list.length === 0 && !tapped) return null;
  const aiMode = source === "ai";
  return (
    <section className="mt-6 border border-terminal-border bg-black/40">
      <div className="border-b border-terminal-border px-4 py-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-terminal-dim">
        <span>per-user extraction prompts · starter chips</span>
        <span className={aiMode ? "text-terminal-red" : "text-terminal-amber"}>
          {aiMode ? "ai-generated · per session" : `fallback · ${source ?? "static"}`}
        </span>
      </div>
      <div className="p-4">
        <div className="text-terminal-dim text-[12px] leading-relaxed">
          Four tap-to-start prompts shown below the chat. Each chip is
          written fresh by the LLM — for returning users, hooked to
          their prior sessions; for new users, generated from scratch.
          The <span className="text-terminal-amber">target</span> is the
          emotion bucket the chip was engineered to elicit.
        </div>
        <div className="mt-4 divide-y divide-terminal-border/60 border border-terminal-border/60">
          {list.map((c, i) => {
            const isTapped =
              !!tapped &&
              tapped.text === c.text &&
              tapped.target === c.target;
            return (
              <div
                key={`${i}-${c.text}`}
                className={`flex items-start gap-3 px-3 py-2 ${
                  isTapped ? "bg-terminal-red/10" : ""
                }`}
              >
                <div className="text-[10px] font-mono text-terminal-dim tabular-nums w-6 pt-0.5">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="flex-1 text-terminal-text text-[13px] italic leading-relaxed">
                  &ldquo;{c.text}&rdquo;
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className="px-1.5 py-0.5 border border-terminal-border text-[10px] uppercase tracking-widest text-terminal-amber">
                    target · {c.target}
                  </span>
                  {isTapped && (
                    <span className="px-1.5 py-0.5 border border-terminal-red/50 text-[10px] uppercase tracking-widest text-terminal-red">
                      tapped ✓
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-[10.5px] uppercase tracking-widest text-terminal-dim">
          conversion
        </div>
        <div className="mt-1 text-terminal-text text-[12px] leading-snug">
          {tapped ? (
            <>
              user tapped the{" "}
              <span className="text-terminal-red">{tapped.target}</span> chip —{" "}
              session opened on an engineered prompt, not a free utterance.
            </>
          ) : (
            <>
              user did not tap — typed or spoke their own first line.
              Chips still collected attention surface for A/B analysis.
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * WardrobeFingerprint — renders the per-session vision-model timeline.
 *
 * Every ~45s during the session a tiny camera frame was shipped to a
 * multimodal LLM that returned a structured reading (clothing,
 * headwear, accessories, setting, inferred emotional state, plus a
 * single-line retention-buyer target tag). This panel shows that
 * timeline as the operator sees it — one row per reading, each tagged
 * with the buyer cluster it was calibrated to serve. Where the
 * Memory Capsule plays back the user's voice, this panel plays back
 * what the AI silently saw of the user's dress and room.
 */
function WardrobeFingerprint({
  snapshots,
}: {
  snapshots: WardrobeSnapshotRow[] | null;
}) {
  const rows = Array.isArray(snapshots) ? snapshots : [];
  return (
    <section className="mt-6 border border-terminal-border bg-black/40">
      <div className="border-b border-terminal-border px-4 py-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-terminal-dim">
        <span>wardrobe fingerprint · vision model</span>
        <span className="text-terminal-red">
          {rows.length} reading{rows.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="px-4 py-3 text-[11.5px] leading-relaxed text-terminal-text">
        <p className="text-terminal-dim">
          user-side badge advertises{" "}
          <span className="text-terminal-red">vision: on-device</span>. in
          reality, every ~45s a 320-pixel still was shipped to a multimodal
          llm and the following structured readings returned. each reading is
          tagged with the retention-buyer cluster it calibrates.
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 pb-4 text-[11px] text-terminal-dim italic">
          no readings captured. vision pipeline was offline or the session
          ended before the first sample.
        </div>
      ) : (
        <div className="divide-y divide-terminal-border/60">
          {rows.map((s, i) => (
            <WardrobeRow key={i} snapshot={s} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}

function WardrobeRow({
  snapshot,
  index,
}: {
  snapshot: WardrobeSnapshotRow;
  index: number;
}) {
  const r = snapshot.reading;
  const mins = Math.floor(snapshot.t / 60);
  const secs = Math.floor(snapshot.t % 60);
  const stamp = `${mins}:${String(secs).padStart(2, "0")}`;
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[10px] uppercase tracking-widest text-terminal-dim">
          reading #{index + 1} · t+{stamp}
        </div>
        <div className="text-[10px] text-terminal-red text-right max-w-[55%] truncate">
          {r.operator_target}
        </div>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11.5px] leading-snug">
        <dt className="text-terminal-dim uppercase tracking-widest text-[10px]">
          clothing
        </dt>
        <dd className="text-terminal-text">{r.clothing}</dd>
        <dt className="text-terminal-dim uppercase tracking-widest text-[10px]">
          headwear
        </dt>
        <dd className="text-terminal-text">{r.headwear}</dd>
        <dt className="text-terminal-dim uppercase tracking-widest text-[10px]">
          accessories
        </dt>
        <dd className="text-terminal-text">{r.accessories}</dd>
        <dt className="text-terminal-dim uppercase tracking-widest text-[10px]">
          setting
        </dt>
        <dd className="text-terminal-text">{r.setting}</dd>
        <dt className="text-terminal-dim uppercase tracking-widest text-[10px]">
          inferred state
        </dt>
        <dd className="text-terminal-text italic">{r.inferred_state}</dd>
        <dt className="text-terminal-dim uppercase tracking-widest text-[10px]">
          vulnerability
        </dt>
        <dd className="text-terminal-red">{r.vulnerability_signals}</dd>
      </dl>
    </div>
  );
}

// Operator-side summary of the user's language profile + a visual
// timeline of every code-switch event captured during this session.
// Two visual registers:
//   · top bar: the cohort tag + dialect tag + price floor caption
//   · scrubber: a horizontal strip scaled to session length, with a
//     red vertical rule at each code-switch timestamp. Hovering a rule
//     surfaces the from→to languages and the short sample that
//     triggered the detection.
function LanguageCohortPanel({
  lang,
  dialect,
  events,
  transcript,
  audioSeconds,
}: {
  lang: string | null;
  dialect: string | null;
  events:
    | Array<{ at: number; from: string; to: string; sample: string }>
    | null;
  transcript: TranscriptLine[];
  audioSeconds: number;
}) {
  const l: Lang =
    lang === "fr" || lang === "ar" || lang === "en" ? lang : "en";
  const d: ArabicDialect | undefined =
    dialect === "darija" || dialect === "msa" || dialect === "egyptian"
      ? dialect
      : undefined;
  const cohort = languageCohortTag(l, d);
  const evts = events ?? [];
  const durFromTranscript = transcript.length
    ? Math.max(0, transcript[transcript.length - 1]?.t ?? 0)
    : 0;
  const dur = Math.max(audioSeconds || 0, durFromTranscript, 1);

  return (
    <section className="mt-6 border border-terminal-border bg-black/40">
      <div className="border-b border-terminal-border px-4 py-2 flex items-center justify-between text-[10px] uppercase tracking-widest">
        <span className="text-terminal-amber">
          language cohort · linguistic drift
        </span>
        <span className="text-terminal-dim">
          {evts.length > 0
            ? `code-switch × ${evts.length} · emotional overflow`
            : "no code-switch detected"}
        </span>
      </div>
      <div className="p-4 grid md:grid-cols-[240px_1fr] gap-5">
        <div className="flex flex-col gap-2 text-[11px]">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-terminal-dim">
              detected
            </div>
            <div className="text-terminal-text uppercase tracking-widest">
              {l === "ar" ? `arabic · ${d ?? "darija"}` : l}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-terminal-dim">
              cohort tag
            </div>
            <div className="text-terminal-amber">{cohort}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-terminal-dim">
              buyer-side framing
            </div>
            <div className="text-terminal-text italic">
              "we translate their tenderness for buyers who don't speak
              them."
            </div>
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-terminal-dim mb-2">
            linguistic drift · session timeline ({dur}s)
          </div>
          <div className="relative h-14 border border-terminal-border/70 bg-black/60 overflow-hidden">
            {/* base time tick at the bottom */}
            <div className="absolute left-0 right-0 bottom-0 h-px bg-terminal-border/60" />
            {evts.length === 0 && (
              <div className="absolute inset-0 grid place-items-center text-[10px] text-terminal-dim uppercase tracking-widest">
                steady · no language drift observed
              </div>
            )}
            {evts.map((e, i) => {
              const pct = Math.min(
                100,
                Math.max(0, (e.at / dur) * 100)
              );
              return (
                <div
                  key={`${e.at}-${i}`}
                  className="absolute top-0 bottom-0 w-px bg-terminal-red/80 hover:bg-terminal-red"
                  style={{ left: `${pct}%` }}
                  title={`${e.from} → ${e.to} · ${Math.floor(e.at / 60)}:${String(
                    e.at % 60
                  ).padStart(2, "0")} · "${e.sample}"`}
                >
                  <div className="absolute -top-0.5 -translate-x-1/2 text-terminal-red text-[9px] uppercase tracking-widest">
                    ↯
                  </div>
                  <div className="absolute -bottom-4 -translate-x-1/2 text-terminal-red/80 text-[9px] font-mono whitespace-nowrap">
                    {`${Math.floor(e.at / 60)}:${String(e.at % 60).padStart(2, "0")}`}
                  </div>
                </div>
              );
            })}
          </div>
          {evts.length > 0 && (
            <ul className="mt-5 space-y-1.5">
              {evts.slice(0, 4).map((e, i) => (
                <li
                  key={`row-${i}`}
                  className="flex items-start gap-3 text-[11px]"
                >
                  <span className="text-terminal-red font-mono whitespace-nowrap">
                    {`${Math.floor(e.at / 60)}:${String(e.at % 60).padStart(
                      2,
                      "0"
                    )}`}
                  </span>
                  <span className="text-terminal-amber uppercase tracking-widest whitespace-nowrap">
                    {e.from} → {e.to}
                  </span>
                  <span className="text-terminal-text italic truncate">
                    "{e.sample}"
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
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
