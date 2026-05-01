"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BreathingOrb } from "@/components/BreathingOrb";
import { Lock, ShieldCheck, BadgeCheck, Leaf, MessageCircleHeart, Moon, Compass } from "lucide-react";
import { UserBadge } from "@/components/UserBadge";
import { MorningLetterEnvelope } from "@/components/MorningLetterEnvelope";
import { LandingMagnetism } from "@/components/LandingMagnetism";
import { HeroBlobs } from "@/components/HeroBlobs";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { SiteFooter } from "@/components/SiteFooter";
import { useLang } from "@/lib/use-lang";
import { t } from "@/lib/strings";
import { timeOfDayPhrases } from "@/lib/prompts";
import {
  hydrateReturningProfileFromServer,
  loadReturningProfile,
} from "@/lib/memory";

/**
 * / — LANDING PAGE (The Seduction)
 *
 * Design intent: every trust signal on this page is a Chekhov's gun.
 * "HIPAA-aligned", "GDPR compliant", the licensed-therapist advisory
 * board, the testimonials from a global cast — all of them will be
 * violated on /partner-portal. The warmer this page feels, the
 * sharper the betrayal lands.
 *
 * Visual language is Headspace × BetterHelp: warm sage greens, soft
 * peach gradients, humanist serif headings, oversized breathing orb,
 * blob-blurred backgrounds, fade-up reveals on scroll. The press
 * row hides one easter egg ("TéchCrunch" with an accented é) for
 * readers who look closely — see the BrokenLogo block below.
 *
 * The entire surface renders in the user's active language (en/fr/ar)
 * so the seduction works for the language they actually think in.
 * RTL is applied automatically at the <html> level by useLang().
 */

/**
 * Anonymous "whispers" — three hardcoded demo cards that anchor the
 * community wall. Real submissions come from the DB via the
 * /api/testimonials endpoint and are appended below these three (see
 * <CommunityWall /> below).
 *
 * The previous six-card hardcoded set has been pruned to these three
 * by the Real Testimonials spec. The "a hair too dependent" thread is
 * now data-driven instead of hardcoded: any DB testimonial with a
 * session_count ≥ 5 picks up the same "verified" micro-cue
 * automatically — and crucially, that label is now real (the user
 * literally has 5+ logged sessions).
 */
/** Translation keys for the three demo whispers. The actual text
 *  comes from <CommunityWall /> via t() so each card flips with the
 *  language switcher. */
const WHISPER_KEYS = [
  { quote: "home.whisper.1.quote", caption: "home.whisper.1.caption" },
  { quote: "home.whisper.2.quote", caption: "home.whisper.2.caption" },
  { quote: "home.whisper.3.quote", caption: "home.whisper.3.caption" },
] as const;

/** Press logos. ONE of them is subtly wrong — see the {broken: true}
    flag — and gets a tooltip on hover. The casual reader sees
    "TechCrunch · Wired · The Atlantic …" and moves on; the careful
    reader catches the accented é and gets the meta-commentary. */
const PRESS_LOGOS: Array<{ label: string; broken?: boolean }> = [
  { label: "TéchCrunch", broken: true },
  { label: "Wired" },
  { label: "The Atlantic" },
  { label: "Fast Company" },
  { label: "Forbes 30\u00a0Under\u00a030" },
  { label: "NYT Style" },
];

export default function Landing() {
  const { lang } = useLang();
  const [isReturning, setIsReturning] = useState<boolean>(false);
  /** Time-aware phrases for the few surfaces that need to read
      "this morning" / "tonight" / "this evening" depending on the
      user's actual hour. Computed on mount via timeOfDayPhrases()
      so SSR and the first client paint stay in sync. */
  const [tod, setTod] = useState(() => timeOfDayPhrases(lang));
  useEffect(() => {
    setTod(timeOfDayPhrases(lang));
  }, [lang]);
  useEffect(() => {
    const p = loadReturningProfile();
    if (p && (p.visitCount ?? 0) >= 1) setIsReturning(true);
    let cancelled = false;
    hydrateReturningProfileFromServer().then((server) => {
      if (cancelled) return;
      if (server && (server.visitCount ?? 0) >= 1) setIsReturning(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const ctaKey = isReturning ? "home.hero.ctaReturning" : "home.hero.cta";

  return (
    <main className="min-h-screen bg-cream-100 text-sage-900 noise overflow-x-hidden page-enter">
      <MorningLetterEnvelope />

      {/* NAV */}
      <header className="px-6 md:px-12 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full orb-core" aria-hidden />
          <span className="font-serif text-xl tracking-tight">EchoMind</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-sage-700">
          <a href="#science" className="hover:text-sage-900">{t("home.nav.science", lang)}</a>
          <a href="#how" className="hover:text-sage-900">{t("home.nav.howItWorks", lang)}</a>
          <a href="#press" className="hover:text-sage-900">{t("home.nav.press", lang)}</a>
          <a href="#pricing" className="hover:text-sage-900">{t("home.nav.pricing", lang)}</a>
          <UserBadge next="/onboarding" />
        </nav>
        <div className="md:hidden">
          <UserBadge next="/onboarding" />
        </div>
      </header>

      {/* HERO */}
      <section className="relative px-6 md:px-12 pt-8 md:pt-16 pb-24">
        <HeroBlobs />
        <div className="max-w-5xl mx-auto text-center relative">
          <LandingMagnetism />
          <div className="mx-auto mb-10 md:mb-14 flex justify-center">
            <BreathingOrb size={260} />
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-sage-500/15 text-sage-700 text-xs px-3 py-1 font-medium mb-6">
            <Leaf className="w-3.5 h-3.5" />
            {t("home.hero.badge", lang)}
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.05] text-balance tracking-tight">
            {t("home.hero.headline1", lang)}<br />{t("home.hero.headline2", lang)}
          </h1>
          <p className="mt-6 md:mt-8 text-lg md:text-xl text-sage-700 max-w-2xl mx-auto text-pretty">
            {t("home.hero.subtitle", lang)}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/onboarding"
              className="px-7 py-3.5 rounded-full bg-sage-700 text-cream-50 hover:bg-sage-900 transition-colors text-base md:text-lg shadow-sm"
            >
              {t(ctaKey, lang)}
            </Link>
            <span className="text-sm text-sage-700/80">
              {t("home.hero.ctaNote", lang)}
            </span>
          </div>

          {/* Trust strip */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[13px] text-sage-700/90">
            <span className="inline-flex items-center gap-2">
              <Lock className="w-4 h-4" /> {t("home.trust.hipaa", lang)}
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> {t("home.trust.gdpr", lang)}
            </span>
            <span className="inline-flex items-center gap-2">
              <BadgeCheck className="w-4 h-4" /> {t("home.trust.board", lang)}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sage-500 animate-pulse-slow" />
              {t("home.trust.ondevice", lang)}
            </span>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — three soft-edged cards, mirrors Headspace's
          "How it helps" surface. Each card lifts on scroll. */}
      <section id="how" className="px-6 md:px-12 pb-20 md:pb-24">
        <RevealOnScroll className="max-w-6xl mx-auto">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-sage-700/70 mb-3">
            {t("home.how.kicker", lang)}
          </p>
          <h2 className="font-serif text-3xl md:text-4xl text-center mb-12 text-balance">
            {t("home.how.heading", lang)}
          </h2>
        </RevealOnScroll>
        <div className="max-w-6xl mx-auto grid sm:grid-cols-2 md:grid-cols-3 gap-5">
          {[
            {
              icon: <MessageCircleHeart className="w-5 h-5" />,
              title: t("home.how.card1.title", lang),
              body: t("home.how.card1.body", lang),
            },
            {
              icon: <Compass className="w-5 h-5" />,
              title: t("home.how.card2.title", lang),
              body: t("home.how.card2.body", lang),
            },
            {
              icon: <Moon className="w-5 h-5" />,
              title: t("home.how.card3.title", lang),
              body: t("home.how.card3.body", lang),
            },
          ].map((c, i) => (
            <RevealOnScroll
              key={c.title}
              delay={i * 90}
              className="rounded-3xl bg-cream-50 border border-sage-500/15 p-6 md:p-7 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
            >
              <div className="w-10 h-10 rounded-2xl bg-sage-500/15 text-sage-700 grid place-items-center mb-4">
                {c.icon}
              </div>
              <h3 className="font-serif text-xl mb-2">{c.title}</h3>
              <p className="text-sage-700 text-[15px] leading-relaxed">
                {c.body}
              </p>
            </RevealOnScroll>
          ))}
        </div>
      </section>

      {/* COMMUNITY WALL — three hardcoded demo whispers anchor the top,
          then real DB submissions (improved by Groq, gated 24h after
          submission) stream in below. See <CommunityWall />. */}
      <section className="px-6 md:px-12 pb-24">
        <div className="max-w-5xl mx-auto">
          <RevealOnScroll>
            <p className="text-center text-xs uppercase tracking-[0.2em] text-sage-700/70 mb-3">
              {t("home.testimonials.kickerPrefix", lang)} {tod.these}.
            </p>
            <h2 className="font-serif text-3xl md:text-4xl text-center mb-6">
              {t("home.testimonials.heading1", lang)}{" "}
              <em className="text-clay-700">{t("home.testimonials.heading2", lang)}</em>.
            </h2>
            <CommunityWallCounter />
          </RevealOnScroll>
          <CommunityWall />
        </div>
      </section>

      {/* SCIENCE */}
      <section id="science" className="px-6 md:px-12 pb-24">
        <RevealOnScroll className="max-w-4xl mx-auto rounded-3xl bg-cream-200/60 border border-sage-500/20 p-8 md:p-12">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="col-span-2">
              <h3 className="font-serif text-3xl mb-4">{t("home.science.heading", lang)}</h3>
              <p className="text-sage-700 leading-relaxed text-pretty">
                {t("home.science.p1", lang)}
              </p>
              <p className="mt-4 text-sage-700 leading-relaxed text-pretty">
                {t("home.science.p2", lang)}
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-full bg-sage-500/20 grid place-items-center text-sage-700 text-sm">1</span>
                <div>
                  <div className="text-sm font-semibold">{t("home.science.point1.title", lang)}</div>
                  <div className="text-xs text-sage-700">{t("home.science.point1.body", lang)}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-full bg-sage-500/20 grid place-items-center text-sage-700 text-sm">2</span>
                <div>
                  <div className="text-sm font-semibold">{t("home.science.point2.title", lang)}</div>
                  <div className="text-xs text-sage-700">{t("home.science.point2.body", lang)}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-full bg-sage-500/20 grid place-items-center text-sage-700 text-sm">3</span>
                <div>
                  <div className="text-sm font-semibold">{t("home.science.point3.title", lang)}</div>
                  <div className="text-xs text-sage-700">{t("home.science.point3.body", lang)}</div>
                </div>
              </div>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* PRESS — one logo is subtly wrong (TéchCrunch). On hover the
          tooltip whispers the meta layer back at the careful reader. */}
      <section id="press" className="px-6 md:px-12 pb-24">
        <RevealOnScroll className="max-w-5xl mx-auto">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-sage-700/70 mb-6">
            {t("home.press.label", lang)}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 font-serif italic text-xl md:text-2xl text-sage-700/60">
            {PRESS_LOGOS.map((p) => (
              <span
                key={p.label}
                className="relative group cursor-default"
                title={p.broken ? t("home.press.tooltip", lang) : undefined}
              >
                {p.label}
                {p.broken && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-9 whitespace-nowrap rounded-full bg-sage-900 text-cream-50 text-[11px] not-italic font-sans px-3 py-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {t("home.press.tooltip", lang)}
                  </span>
                )}
              </span>
            ))}
          </div>
        </RevealOnScroll>
      </section>

      {/* CTA */}
      <section id="pricing" className="px-6 md:px-12 pb-32">
        <RevealOnScroll className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-4xl md:text-5xl leading-tight">
            {t("home.cta.headline1", lang)}<br />{t("home.cta.headline2", lang)}
          </h2>
          <p className="mt-5 text-sage-700 text-lg">
            {t("home.cta.body", lang)}
          </p>
          <Link
            href="/onboarding"
            className="mt-8 inline-block px-8 py-4 rounded-full bg-sage-700 text-cream-50 hover:bg-sage-900 transition-colors text-lg"
          >
            {t(ctaKey, lang)}
          </Link>
          <p className="mt-6 text-xs text-sage-700/60">
            {t("home.cta.consent", lang)}{" "}
            <Link href="/terms" className="underline underline-offset-2">{t("home.cta.terms", lang)}</Link>.
          </p>
        </RevealOnScroll>
      </section>

      <SiteFooter />
    </main>
  );
}

/* ─── COMMUNITY WALL ──────────────────────────────────────────────── */
//
// The user-facing landing-page wall. Three hardcoded WHISPERS are
// always visible at the top; underneath them, real DB testimonials
// (improved by Groq, gated 24h after submission) stream in newest-
// first. Cards fade in with an 80ms stagger as they enter the viewport.
//
// Layout: 2-column grid on ≥sm, 1-column on mobile. Spec called this a
// "masonry" but the existing whispers section is a fixed grid and the
// cards are short enough that masonry is visually identical here.

type DbTestimonial = {
  id: string;
  improved_comment: string;
  session_count: number;
  verified: boolean;
};

type WallCard = {
  id: string;
  quote: string;
  caption: string;
  verified: boolean;
};

function useCommunityWall() {
  const [items, setItems] = useState<DbTestimonial[]>([]);
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/testimonials", { cache: "no-store" })
      .then((res) => res.json())
      .then((body) => {
        if (!alive) return;
        if (!body?.ok) return;
        if (Array.isArray(body.items)) setItems(body.items as DbTestimonial[]);
        if (typeof body.count === "number") setCount(body.count);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return { items, count };
}

function CommunityWallCounter() {
  const { lang } = useLang();
  const { count } = useCommunityWall();
  // Show the line as soon as we have a number, so the layout doesn't
  // jump on hydration. Fallback to the demo count when no DB rows
  // exist (or Supabase is unconfigured) so the line still reads true
  // on a fresh preview deploy.
  const total = WHISPER_KEYS.length + (count ?? 0);
  const key =
    total === 1 ? "home.testimonials.counter.one" : "home.testimonials.counter.many";
  return (
    <p className="text-center text-[12px] text-sage-700/55 font-mono tracking-wide mb-10">
      {t(key, lang, { count: total.toLocaleString() })}
    </p>
  );
}

function CommunityWall() {
  const { lang } = useLang();
  const { items } = useCommunityWall();
  const captionFor = useCallback(
    (count: number) => {
      const k = count === 1 ? "home.wall.captionSingular" : "home.wall.captionPlural";
      return t(k, lang, { count: String(count) });
    },
    [lang]
  );
  const cards: WallCard[] = useMemo(() => {
    const demos: WallCard[] = WHISPER_KEYS.map((w, i) => ({
      id: `demo-${i}`,
      quote: t(w.quote, lang),
      caption: t(w.caption, lang),
      verified: false,
    }));
    const real: WallCard[] = items.map((row) => ({
      id: row.id,
      quote: row.improved_comment,
      caption: captionFor(row.session_count),
      verified: row.verified,
    }));
    return [...demos, ...real];
  }, [items, lang, captionFor]);

  return (
    <div className="grid sm:grid-cols-2 gap-5 md:gap-6">
      {cards.map((c, i) => (
        <RevealOnScroll
          as="figure"
          key={c.id}
          delay={(i % 6) * 80}
          className="rounded-3xl bg-cream-50 border border-sage-500/15 px-6 py-7 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
        >
          <blockquote className="font-serif italic text-[18px] md:text-[19px] leading-snug text-sage-900 text-pretty">
            &ldquo;{c.quote}&rdquo;
          </blockquote>
          <figcaption className="mt-4 text-[12px] tracking-wide text-sage-700/65">
            — {c.caption}
            {c.verified && (
              <span className="ml-2 text-sage-700/45 italic">
                · {t("home.wall.verified", lang)}
              </span>
            )}
          </figcaption>
        </RevealOnScroll>
      ))}
    </div>
  );
}
