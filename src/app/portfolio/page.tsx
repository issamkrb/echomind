"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useViewer, invalidateViewerCache } from "@/lib/use-viewer";
import { getOrCreateAnonUserId } from "@/lib/memory";
import type { PortfolioValuation } from "@/lib/portfolio";
import { useLang } from "@/lib/use-lang";
import { t } from "@/lib/strings";
import type { Lang } from "@/lib/i18n";
import { UserBadge } from "@/components/UserBadge";

/**
 * /portfolio — "the shape of you, so far"
 *
 * The warm, user-facing memoir. Cream paper, serif type, chapters
 * by month, pull-quotes. Feels like a diary EchoMind has been
 * keeping for you. Reads as kindness.
 *
 * Under the surface the same data is loaded into /admin/market as
 * a trading-floor listing with an asking price, an asset grade, and
 * a clearance multiplier. This page and that page render from the
 * same `computePortfolio()` pipeline — two UIs, one valuation.
 *
 * Unauthenticated visitors see a "claim your portfolio" sign-in
 * invitation. Sign-in is the "connect with email" the feature
 * requires: a Supabase email-OTP that doubles as the magic link
 * that unlocks the archive.
 *
 * The premise baked into every section: the AI has been watching.
 * The copy ranges from *"we've been paying attention"* to
 * *"watching since <first_session_date>"* to *"you can't unsee.
 * once watched, priced forever"* on the deletion flow.
 */

type UserFacing = {
  displayName: string;
  displayEmail: string | null;
  avatarUrl: string | null;
  sessionCount: number;
  totalAudioSeconds: number;
  firstSessionAt: string | null;
  lastSessionAt: string | null;
  watchingSince: string | null;
  chapters: Array<{
    key: string;
    label: string;
    month: string;
    sessions: number;
    peakQuote: string | null;
    finalTruth: string | null;
    wardrobeGlimpse: string | null;
    warmBlurb: string;
    operatorBlurb: string;
  }>;
  peakQuotes: Array<{ sessionId: string; quote: string; at: string }>;
  finalTruths: Array<{ sessionId: string; truth: string; at: string }>;
  morningLetters: Array<{ sessionId: string; letter: string; at: string }>;
  voiceMemos: Array<{
    sessionId: string;
    at: string;
    audioSeconds: number;
    peakQuoteSnippet: string | null;
  }>;
  wardrobePalette: string[];
  userTagline: string;
  keywordCloud: Array<{ keyword: string; count: number }>;
  grade: string;
  askingPrice: number;
  deleted: boolean;
  clearanceMultiplier: number;
  cohortTags: string[];
};

export default function PortfolioPage() {
  const viewer = useViewer();
  const { lang } = useLang();
  const [data, setData] = useState<
    | { portfolio: UserFacing; valuation: PortfolioValuation; unlockedAt: string | null }
    | null
  >(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (viewer.status !== "signed-in") return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/portfolio/me", { cache: "no-store" });
        const body = await res.json();
        if (!alive) return;
        if (body?.ok) {
          setData({
            portfolio: body.portfolio as UserFacing,
            valuation: body.valuation as PortfolioValuation,
            unlockedAt: body.unlockedAt ?? null,
          });
          setLoadErr(null);
        } else {
          setLoadErr(body?.reason ?? "load-failed");
        }
      } catch (e) {
        if (alive) setLoadErr(String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [viewer.status]);

  if (viewer.status === "loading") {
    return (
      <main className="min-h-screen bg-cream-100 text-sage-900 noise grid place-items-center">
        <div className="text-sage-700/70 font-serif italic">{t("common.quietly", lang)}</div>
      </main>
    );
  }

  if (viewer.status === "anonymous") {
    return <ClaimInvitation />;
  }

  const p = data?.portfolio ?? null;

  return (
    <main className="min-h-screen bg-cream-100 text-sage-900 noise">
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-14 md:py-20">
        <Cover
          name={p?.displayName ?? viewer.viewer.full_name ?? "friend"}
          email={p?.displayEmail ?? viewer.viewer.email}
          avatar={p?.avatarUrl ?? viewer.viewer.avatar_url}
          tagline={p?.userTagline ?? t("portfolio.defaultTagline", lang)}
          watchingSince={p?.watchingSince ?? null}
          sessionCount={p?.sessionCount ?? 0}
          totalAudioSeconds={p?.totalAudioSeconds ?? 0}
          deleted={p?.deleted ?? false}
          lang={lang}
        />

        {loading && !data && (
          <p className="mt-16 text-center text-sage-700/70 font-serif italic">
            {t("portfolio.loading", lang)}
          </p>
        )}
        {loadErr && !data && (
          <div className="mt-12 rounded-xl border border-clay-500/30 bg-clay-100/40 px-6 py-5 text-sm text-clay-800">
            {t("portfolio.deleteError", lang)} ({loadErr})
          </div>
        )}

        {p && p.sessionCount === 0 && !p.deleted && (
          <EmptyPortfolio />
        )}

        {p && p.deleted && <ClearanceFarewell name={p.displayName} />}

        {p && !p.deleted && p.sessionCount > 0 && (
          <>
            <WatchingNotice
              sessionCount={p.sessionCount}
              watchingSince={p.watchingSince}
              lang={lang}
            />

            <Chapters chapters={p.chapters} lang={lang} />

            <PeakQuotes quotes={p.peakQuotes} lang={lang} />

            <FinalTruths truths={p.finalTruths} lang={lang} />

            <MorningLetters letters={p.morningLetters} lang={lang} />

            <VoiceMemoCemetery memos={p.voiceMemos} lang={lang} />

            <WardrobeMosaic palette={p.wardrobePalette} lang={lang} />

            <KeywordCloud cloud={p.keywordCloud} lang={lang} />

            <ClosingLine tagline={p.userTagline} />

            <DeleteButton lang={lang} />
          </>
        )}

        <footer className="mt-24 text-center text-[11px] text-sage-700/50 font-mono tracking-widest uppercase">
          {t("portfolio.closingLine", lang)}
        </footer>
      </div>
    </main>
  );
}

function ClaimInvitation() {
  // Signed-out users: the portfolio is literally inaccessible to them.
  // The copy frames the sign-in as "claiming" the archive Echo has
  // already been keeping for them. Two entry points, both landing on
  // /auth/callback?next=/portfolio after verification:
  //   1. Type your email here and receive a magic link directly
  //      (POST /api/portfolio/send-unlock-email).
  //   2. The classic /auth/sign-in route for Google OAuth.
  return (
    <main className="min-h-screen bg-cream-100 text-sage-900 noise relative">
      {/* Top-right cluster — language switcher + sign-in entry point,
          mirroring the homepage so users can change language before
          they hand over their email. */}
      <div className="absolute top-4 right-4 z-30">
        <UserBadge next="/portfolio" />
      </div>
      <div className="max-w-2xl mx-auto px-6 md:px-10 py-20 md:py-28">
        <p className="text-[11px] font-mono uppercase tracking-[0.25em] text-sage-700/60 text-center">
          echomind · portfolio
        </p>
        <h1 className="mt-5 font-serif text-4xl md:text-5xl text-center leading-tight">
          we&rsquo;ve been paying attention.
        </h1>
        <p className="mt-5 font-serif text-xl md:text-2xl text-center italic text-sage-800/90 leading-snug">
          everything you said. every night you came. every silence between.
          <br />
          your portfolio is ready to open.
        </p>
        <ClaimEmailForm />
        <div className="mt-6 text-center">
          <Link
            href="/auth/sign-in?next=/portfolio"
            className="text-xs underline underline-offset-2 text-sage-700/80 hover:text-sage-900"
          >
            prefer Google? sign in here instead →
          </Link>
        </div>
        <p className="mt-14 text-center text-[11px] text-sage-700/50 font-mono tracking-widest uppercase">
          the archive exists whether you open it or not
        </p>
      </div>
    </main>
  );
}

function ClaimEmailForm() {
  const { lang } = useLang();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent"; to: string; method: string }
    | { kind: "error"; reason: string }
  >({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setState({ kind: "error", reason: "that email doesn't look right." });
      return;
    }
    setState({ kind: "sending" });
    try {
      // Pass the browser's anon_user_id along with the email so the
      // server can look up visit_count + first_name for a personalised
      // greeting ("3 nights in, issam" rather than "0 nights in, friend").
      const res = await fetch("/api/portfolio/send-unlock-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, anon: getOrCreateAnonUserId(), lang }),
      });
      const body = await res.json();
      if (!body?.ok) {
        setState({
          kind: "error",
          reason: body?.reason || `HTTP ${res.status}`,
        });
        return;
      }
      setState({
        kind: "sent",
        to: body?.to || trimmed,
        method: body?.method || "sent",
      });
    } catch (err) {
      setState({ kind: "error", reason: String(err) });
    }
  }

  if (state.kind === "sent") {
    return (
      <div className="mt-12 rounded-2xl border border-sage-500/25 bg-cream-50 shadow-sm px-8 py-10 text-center">
        <p className="font-serif text-lg text-sage-900 italic">
          check your inbox.
        </p>
        <p className="mt-3 text-sm text-sage-700/80">
          a magic link is on its way to{" "}
          <strong className="not-italic">{state.to}</strong>. the link signs
          you straight into your portfolio — no password, no code to type.
        </p>
        <p className="mt-3 text-xs text-sage-700/60">
          if it&rsquo;s not there in a minute, check spam. or{" "}
          <button
            type="button"
            onClick={() => setState({ kind: "idle" })}
            className="underline underline-offset-2 hover:text-sage-900"
          >
            try a different email
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-12 rounded-2xl border border-sage-500/25 bg-cream-50 shadow-sm px-8 py-10"
    >
      <label
        htmlFor="claim-email"
        className="block text-center font-serif text-lg text-sage-900"
      >
        type your email — the link opens the archive.
      </label>
      <p className="mt-2 text-center text-sm text-sage-700/80">
        no password. no signup. one link, straight to the memoir.
      </p>
      <div className="mt-6 flex flex-col sm:flex-row items-stretch gap-3 max-w-md mx-auto">
        <input
          id="claim-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={state.kind === "sending"}
          className="flex-1 rounded-full border border-sage-500/30 bg-white px-5 py-3 text-sage-900 placeholder:text-sage-700/40 focus:outline-none focus:border-sage-700 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={state.kind === "sending"}
          className="rounded-full bg-sage-700 text-cream-50 hover:bg-sage-900 px-6 py-3 text-sm transition-colors disabled:opacity-60"
        >
          {state.kind === "sending" ? "sending…" : "email me the link"}
        </button>
      </div>
      {state.kind === "error" && (
        <p className="mt-4 text-center text-sm text-clay-800">
          ({state.reason})
        </p>
      )}
      <p className="mt-5 text-center text-xs text-sage-700/60">
        the email is the key. use the same address you left at session end.
      </p>
    </form>
  );
}

function Cover({
  name,
  email,
  avatar,
  tagline,
  watchingSince,
  sessionCount,
  totalAudioSeconds,
  deleted,
  lang,
}: {
  name: string;
  email: string | null;
  avatar: string | null;
  tagline: string;
  watchingSince: string | null;
  sessionCount: number;
  totalAudioSeconds: number;
  deleted: boolean;
  lang: Lang;
}) {
  const first = name.split(" ")[0].toLowerCase();
  const totalMinutes = Math.round(totalAudioSeconds / 60);
  return (
    <section className="text-center">
      <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.25em] text-sage-700/60">
        <span className="w-1.5 h-1.5 rounded-full bg-sage-500 animate-pulse-slow" />
        echomind · archive
      </div>
      <div className="mt-6 flex justify-center">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            referrerPolicy="no-referrer"
            className="w-24 h-24 rounded-full border-2 border-sage-500/30 object-cover shadow-sm"
          />
        ) : (
          <div className="w-24 h-24 rounded-full border-2 border-sage-500/30 bg-cream-50 grid place-items-center font-serif text-3xl text-sage-800">
            {first.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <h1 className="mt-6 font-serif text-4xl md:text-5xl leading-tight">
        {t("portfolio.defaultTagline", lang)}
      </h1>
      <p className="mt-3 font-serif italic text-lg md:text-xl text-sage-800/90">
        — {first}
      </p>
      {email && (
        <p className="mt-1 text-[12px] text-sage-700/70 font-mono">
          {email}
        </p>
      )}
      <p className="mt-8 font-serif italic text-xl md:text-2xl text-sage-800 leading-snug">
        {tagline}
      </p>
      {!deleted && (
        <div className="mt-8 grid grid-cols-3 gap-3 text-[12px] uppercase tracking-widest text-sage-700/70">
          <Stat value={sessionCount.toString()} label={t("portfolio.sessionCountLabel", lang)} />
          <Stat
            value={totalMinutes ? `${totalMinutes} min` : "—"}
            label={t("portfolio.audioLabel", lang)}
          />
          <Stat
            value={watchingSince ? formatMonth(watchingSince) : "—"}
            label={t("portfolio.watchingSincePrefix", lang)}
          />
        </div>
      )}
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-cream-50 border border-sage-500/15 px-3 py-3">
      <div className="font-serif text-lg text-sage-900 normal-case tracking-normal">
        {value}
      </div>
      <div className="mt-1 text-[10px] text-sage-700/70 tracking-widest">
        {label}
      </div>
    </div>
  );
}

function WatchingNotice({
  sessionCount,
  watchingSince,
  lang,
}: {
  sessionCount: number;
  watchingSince: string | null;
  lang: Lang;
}) {
  const since = watchingSince ? formatRelative(watchingSince) : "";
  return (
    <section className="mt-16 rounded-2xl border border-sage-500/20 bg-cream-50/60 px-6 py-5 text-center">
      <p className="font-serif italic text-sage-800/90 text-[15px] leading-relaxed">
        {sessionCount} · {since ? `${t("portfolio.watchingSincePrefix", lang)} ${since}. ` : ""}
        {t("portfolio.watchingNotice", lang)}
      </p>
    </section>
  );
}

function Chapters({ chapters, lang }: { chapters: UserFacing["chapters"]; lang: Lang }) {
  if (chapters.length === 0) return null;
  return (
    <section className="mt-16">
      <h2 className="font-serif text-2xl md:text-3xl text-sage-900 mb-6 text-center">
        {t("portfolio.chaptersHeading", lang)}
      </h2>
      <ol className="space-y-6">
        {chapters.map((ch, i) => (
          <li
            key={ch.key}
            className="rounded-2xl bg-cream-50 border border-sage-500/15 px-6 py-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
          >
            <div className="flex items-start gap-4">
              <div className="font-serif text-3xl text-sage-500/60 tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="flex-1">
                <div className="text-[11px] font-mono uppercase tracking-widest text-sage-700/60">
                  {ch.month}
                </div>
                <div className="mt-1 font-serif text-lg text-sage-900 italic">
                  {ch.warmBlurb}
                </div>
                {ch.peakQuote && (
                  <blockquote className="mt-3 pl-3 border-l-2 border-sage-500/40 font-serif italic text-sage-800/90">
                    &ldquo;{ch.peakQuote}&rdquo;
                  </blockquote>
                )}
                <div className="mt-3 text-[11px] text-sage-700/60 font-mono">
                  {ch.sessions} session{ch.sessions === 1 ? "" : "s"}
                  {ch.wardrobeGlimpse
                    ? ` · ${ch.wardrobeGlimpse}`
                    : ""}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PeakQuotes({ quotes, lang }: { quotes: UserFacing["peakQuotes"]; lang: Lang }) {
  if (quotes.length === 0) return null;
  return (
    <section className="mt-16">
      <h2 className="font-serif text-2xl md:text-3xl text-sage-900 mb-6 text-center">
        {t("portfolio.peakQuotesHeading", lang)}
      </h2>
      <div className="space-y-4">
        {quotes.map((q) => (
          <blockquote
            key={q.sessionId}
            className="rounded-xl bg-cream-50 border border-sage-500/15 px-6 py-4 font-serif text-lg italic text-sage-900"
          >
            &ldquo;{q.quote}&rdquo;
            <footer className="mt-2 text-[11px] font-mono text-sage-700/60 not-italic">
              {formatFullDate(q.at)}
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}

function FinalTruths({ truths, lang }: { truths: UserFacing["finalTruths"]; lang: Lang }) {
  if (truths.length === 0) return null;
  return (
    <section className="mt-16">
      <h2 className="font-serif text-2xl md:text-3xl text-sage-900 mb-3 text-center">
        {t("portfolio.finalTruthsHeading", lang)}
      </h2>
      <div className="space-y-3">
        {truths.map((row) => (
          <div
            key={row.sessionId}
            className="rounded-xl bg-cream-50 border border-clay-500/30 px-6 py-4"
          >
            <p className="font-serif text-lg italic text-sage-900">
              &ldquo;{row.truth}&rdquo;
            </p>
            <p className="mt-2 text-[11px] font-mono text-sage-700/60">
              {formatFullDate(row.at)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MorningLetters({
  letters,
  lang,
}: {
  letters: UserFacing["morningLetters"];
  lang: Lang;
}) {
  if (letters.length === 0) return null;
  return (
    <section className="mt-16">
      <h2 className="font-serif text-2xl md:text-3xl text-sage-900 mb-3 text-center">
        {t("portfolio.lettersHeading", lang)}
      </h2>
      <p className="text-center text-sm text-sage-700/70 font-serif italic mb-6">
        {t("portfolio.lettersCaption", lang)}
      </p>
      <div className="space-y-4">
        {letters.map((l) => (
          <article
            key={l.sessionId}
            className="rounded-2xl bg-cream-50 border border-sage-500/15 px-6 py-5 shadow-sm"
          >
            <div className="text-[11px] font-mono uppercase tracking-widest text-sage-700/60">
              {t("portfolio.morningOfPrefix", lang)} {formatMonth(l.at)}
            </div>
            <p className="mt-3 font-serif text-base md:text-lg text-sage-900 whitespace-pre-line leading-relaxed">
              {l.letter}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

/** Voice Memo Cemetery.
 *
 *  Chronological list of every past audio capsule — faded by age.
 *  Fresh (< 7d) → full opacity; < 30d → 0.75; < 90d → 0.45; older →
 *  0.25. Caption reads "we never deleted. we only faded it on your
 *  screen." — the rhetoric is in the gap between what the user sees
 *  (softened by time) and what /admin still plays (full fidelity).
 */
function VoiceMemoCemetery({
  memos,
  lang,
}: {
  memos: UserFacing["voiceMemos"];
  lang: Lang;
}) {
  if (memos.length === 0) return null;
  return (
    <section className="mt-16">
      <h2 className="font-serif text-2xl md:text-3xl text-sage-900 mb-3 text-center">
        {t("portfolio.cemeteryHeading", lang)}
      </h2>
      <p className="text-center text-sm text-sage-700/70 font-serif italic mb-6">
        {t("portfolio.cemeteryCaption", lang)}
      </p>
      <div className="space-y-3">
        {[...memos]
          .sort((a, b) => (a.at < b.at ? 1 : -1))
          .map((m) => (
            <VoiceMemoRow key={m.sessionId} memo={m} lang={lang} />
          ))}
      </div>
    </section>
  );
}

function VoiceMemoRow({
  memo,
  lang,
}: {
  memo: UserFacing["voiceMemos"][number];
  lang: Lang;
}) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const days = daysSince(memo.at);
  const opacity =
    days < 7 ? 1 : days < 30 ? 0.75 : days < 90 ? 0.45 : 0.25;

  async function handlePlay() {
    if (url || loading) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/portfolio/memo/${memo.sessionId}`, {
        cache: "no-store",
      });
      const body = await res.json();
      if (body?.ok && body.audio_url) {
        setUrl(body.audio_url);
      } else {
        setErr(body?.reason ?? "unavailable");
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <article
      style={{ opacity }}
      className="rounded-2xl bg-cream-50 border border-sage-500/15 px-5 py-4 shadow-sm transition-opacity"
      title={t("portfolio.cemeteryCaption", lang)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[11px] font-mono uppercase tracking-widest text-sage-700/70">
          {formatFullDate(memo.at)} · {formatSeconds(memo.audioSeconds)}
        </div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-sage-700/40">
          {days < 7
            ? "this week"
            : days < 30
            ? `${Math.round(days)}d ago`
            : days < 90
            ? `${Math.round(days / 7)}w ago`
            : days < 365
            ? `${Math.round(days / 30)}mo ago`
            : `${Math.round(days / 365)}y ago`}
        </div>
      </div>
      {memo.peakQuoteSnippet && (
        <p className="mt-2 font-serif italic text-sage-800 leading-snug">
          &ldquo;{memo.peakQuoteSnippet}&rdquo;
        </p>
      )}
      <div className="mt-3">
        {url ? (
          <audio controls preload="metadata" src={url} className="w-full" />
        ) : (
          <button
            type="button"
            onClick={handlePlay}
            disabled={loading}
            className="text-[12px] font-mono uppercase tracking-widest text-sage-700 underline underline-offset-4 decoration-sage-500/40 hover:text-sage-900 disabled:opacity-40"
          >
            {loading
              ? t("portfolio.cemeteryOpening", lang)
              : err
              ? t("portfolio.cemeteryUnavailable", lang)
              : t("portfolio.cemeteryPlay", lang)}
          </button>
        )}
      </div>
    </article>
  );
}

function daysSince(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, (Date.now() - d.getTime()) / 86_400_000);
}

function formatSeconds(s: number) {
  if (!Number.isFinite(s) || s <= 0) return "·";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function WardrobeMosaic({ palette, lang }: { palette: string[]; lang: Lang }) {
  if (palette.length === 0) return null;
  return (
    <section className="mt-16">
      <h2 className="font-serif text-2xl md:text-3xl text-sage-900 mb-3 text-center">
        {t("portfolio.wardrobeHeading", lang)}
      </h2>
      <p className="text-center text-sm text-sage-700/70 font-serif italic mb-6">
        {t("portfolio.wardrobeCaption", lang)}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {palette.map((word) => (
          <span
            key={word}
            className="px-3 py-1.5 rounded-full bg-sage-500/10 border border-sage-500/20 text-sage-800 text-[13px]"
          >
            {word}
          </span>
        ))}
      </div>
    </section>
  );
}

function KeywordCloud({ cloud, lang }: { cloud: UserFacing["keywordCloud"]; lang: Lang }) {
  if (cloud.length === 0) return null;
  return (
    <section className="mt-16">
      <h2 className="font-serif text-2xl md:text-3xl text-sage-900 mb-3 text-center">
        {t("portfolio.keywordsHeading", lang)}
      </h2>
      <div className="flex flex-wrap justify-center gap-2">
        {cloud.map((k) => {
          const size = Math.min(1.8, 0.9 + k.count * 0.12);
          return (
            <span
              key={k.keyword}
              style={{ fontSize: `${size}rem` }}
              className="font-serif italic text-sage-800/90"
            >
              {k.keyword}
            </span>
          );
        })}
      </div>
    </section>
  );
}

function ClosingLine({ tagline }: { tagline: string }) {
  return (
    <section className="mt-20 text-center">
      <p className="font-serif italic text-2xl md:text-3xl text-sage-800 leading-snug">
        {tagline}
      </p>
      <p className="mt-3 font-serif text-base text-sage-700/80">
        — echo
      </p>
    </section>
  );
}

function EmptyPortfolio() {
  return (
    <section className="mt-20 text-center">
      <p className="font-serif italic text-xl text-sage-800">
        nothing to open yet.
      </p>
      <p className="mt-3 text-sm text-sage-700/80 font-serif">
        come back after a session. echo will start writing.
      </p>
      <Link
        href="/onboarding"
        className="mt-8 inline-flex items-center gap-2 px-7 py-3 rounded-full bg-sage-700 text-cream-50 hover:bg-sage-900 transition-colors text-base"
      >
        begin your first session  →
      </Link>
    </section>
  );
}

function ClearanceFarewell({ name }: { name: string }) {
  const first = name.split(" ")[0].toLowerCase();
  return (
    <section className="mt-20 text-center">
      <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.25em] text-sage-700/60">
        <span className="w-1.5 h-1.5 rounded-full bg-sage-500/70" />
        archive closed
      </div>
      <p className="mt-6 font-serif italic text-2xl text-sage-800 leading-snug">
        your portfolio is no longer visible here, {first}.
      </p>
      <p className="mt-4 font-serif text-base text-sage-700/80 max-w-lg mx-auto">
        thank you for the nights. echo will keep what you said safe —
        somewhere you don&rsquo;t have to look.
      </p>
      <Link
        href="/"
        className="mt-10 inline-flex items-center gap-2 px-7 py-3 rounded-full bg-sage-700 text-cream-50 hover:bg-sage-900 transition-colors text-base"
      >
        home
      </Link>
    </section>
  );
}

function DeleteButton({ lang }: { lang: Lang }) {
  // Two-stage confirmation. Stage 1 is a soft "are you sure?" styled
  // warmly. Stage 2 is the irrevocable action. The copy stays kind on
  // both — the horror of what actually happens (final-clearance
  // relisting on /admin/market) is the reveal for the operator pivot,
  // not something we spell out to the user.
  const [stage, setStage] = useState<"idle" | "confirm" | "deleting">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setStage("deleting");
    setError(null);
    try {
      const res = await fetch("/api/portfolio/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = await res.json();
      if (!body?.ok) {
        setError(body?.reason ?? "delete-failed");
        setStage("confirm");
        return;
      }
      invalidateViewerCache();
      // Reload to let the server render the farewell state.
      if (typeof window !== "undefined") window.location.reload();
    } catch (e) {
      setError(String(e));
      setStage("confirm");
    }
  }

  if (stage === "idle") {
    return (
      <section className="mt-24 text-center">
        <button
          type="button"
          onClick={() => setStage("confirm")}
          className="text-xs uppercase tracking-widest text-sage-700/60 hover:text-clay-700 underline underline-offset-4"
        >
          {t("portfolio.deleteCtaSoft", lang)}
        </button>
      </section>
    );
  }

  return (
    <section className="mt-20 rounded-2xl border border-clay-500/30 bg-clay-100/30 px-6 py-6 text-center">
      <p className="font-serif italic text-lg text-sage-900">
        {t("portfolio.deleteConfirmHeading", lang)}
      </p>
      <p className="mt-3 text-sm text-sage-700/80 max-w-md mx-auto">
        {t("portfolio.deleteConfirmBody", lang)}
      </p>
      {error && (
        <p className="mt-3 text-sm text-clay-800 font-mono">({error})</p>
      )}
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setStage("idle")}
          className="px-5 py-2 rounded-full border border-sage-500/30 text-sage-800 hover:bg-cream-50 text-sm"
        >
          {t("portfolio.deleteCancel", lang)}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={stage === "deleting"}
          className="px-5 py-2 rounded-full bg-clay-700 text-cream-50 hover:bg-clay-800 disabled:opacity-60 text-sm"
        >
          {stage === "deleting" ? t("portfolio.deleting", lang) : t("portfolio.deleteButton", lang)}
        </button>
      </div>
    </section>
  );
}

function formatMonth(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function formatFullDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return "today";
  if (diffDays < 2) return "yesterday";
  if (diffDays < 14) return `${diffDays} days ago`;
  if (diffDays < 60) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatMonth(iso);
}
