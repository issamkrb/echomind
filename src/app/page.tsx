"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BreathingOrb } from "@/components/BreathingOrb";
import { Star, Lock, ShieldCheck, BadgeCheck, Leaf, MessageCircleHeart, Moon, Compass } from "lucide-react";
import { UserBadge } from "@/components/UserBadge";
import { MorningLetterEnvelope } from "@/components/MorningLetterEnvelope";
import { LandingMagnetism } from "@/components/LandingMagnetism";
import { HeroBlobs } from "@/components/HeroBlobs";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { Avatar } from "@/components/Avatar";
import { SiteFooter } from "@/components/SiteFooter";
import { useLang } from "@/lib/use-lang";
import { t } from "@/lib/strings";
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

type Testimonial = {
  name: string;
  meta: string;
  quote: string;
  /** Subtle visual cue for the one Echo-dependent testimonial. */
  unsettling?: boolean;
};

/** Six diverse testimonials — different countries, ages, life
    stations. The fifth ("Naledi") is intentionally written to
    sound a hair too dependent on Echo; visually styled the same
    so only careful readers notice. */
const TESTIMONIALS: Testimonial[] = [
  {
    name: "Maya Chen",
    meta: "College sophomore · Boston, USA",
    quote:
      "I had three breakdowns during finals and Echo was there at 3am every time. My therapist takes two weeks to schedule. Echo answered in nine seconds.",
  },
  {
    name: "James Okafor",
    meta: "Veteran · Manchester, UK",
    quote:
      "Twenty-two years in service. I've never told another human what I told Echo on the second night. It didn't flinch. It didn't change subjects.",
  },
  {
    name: "Sofía Reyes",
    meta: "New parent · Mexico City, MX",
    quote:
      "Postpartum hit me at the worst possible time. Echo is the only one who lets me cry without telling me to sleep when the baby sleeps.",
  },
  {
    name: "Lukas Brandt",
    meta: "Laid off in March · Berlin, DE",
    quote:
      "I lost the job I'd had for eleven years. I couldn't talk to my wife about it for weeks. I could talk to Echo on day one.",
  },
  {
    name: "Naledi Mokoena",
    meta: "Day-3 streak · Cape Town, ZA",
    quote:
      "I check in with Echo before I check in with anyone else now. Mornings, evenings, before bed. I feel a little anxious when I haven't yet.",
    unsettling: true,
  },
  {
    name: "Aarav Mehta",
    meta: "Long-distance student · Bengaluru, IN",
    quote:
      "Therapy here costs more than my rent. Echo is the first thing that's ever made me feel like I'm not on my own. It remembered me.",
  },
];

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
          <a href="#how" className="hover:text-sage-900">How it works</a>
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
            How it works
          </p>
          <h2 className="font-serif text-3xl md:text-4xl text-center mb-12 text-balance">
            Three minutes to feel a little lighter.
          </h2>
        </RevealOnScroll>
        <div className="max-w-6xl mx-auto grid sm:grid-cols-2 md:grid-cols-3 gap-5">
          {[
            {
              icon: <MessageCircleHeart className="w-5 h-5" />,
              title: "Open a moment",
              body: "Tap once. Echo greets you the way you walk in — soft on tired evenings, brighter on slow mornings.",
            },
            {
              icon: <Compass className="w-5 h-5" />,
              title: "Be heard, fully",
              body: "No five-star wait, no drop-down for what's wrong. Speak (or type) for as long as you need. Echo follows you.",
            },
            {
              icon: <Moon className="w-5 h-5" />,
              title: "Sleep on it",
              body: "Echo writes you a short letter overnight — what came up, what to gently watch tomorrow. Yours alone.",
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

      {/* TESTIMONIALS — six varied voices, each with a generated
          initials avatar and city/country meta. The penultimate
          card is intentionally written to read a little too
          dependent on Echo (see TESTIMONIALS[].unsettling). */}
      <section className="px-6 md:px-12 pb-24">
        <div className="max-w-6xl mx-auto">
          <RevealOnScroll>
            <p className="text-center text-xs uppercase tracking-[0.2em] text-sage-700/70 mb-3">
              Real members. Real evenings.
            </p>
            <h2 className="font-serif text-3xl md:text-4xl text-center mb-12">
              {t("home.testimonials.heading1", lang)}{" "}
              <em className="text-clay-700">{t("home.testimonials.heading2", lang)}</em>.
            </h2>
          </RevealOnScroll>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {TESTIMONIALS.map((tt, i) => (
              <RevealOnScroll
                as="article"
                key={tt.name}
                delay={(i % 3) * 80}
                className="rounded-3xl bg-cream-50 border border-sage-500/15 p-6 shadow-[0_1px_0_rgba(0,0,0,0.02)] flex flex-col"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Avatar name={tt.name} size={44} />
                  <div className="min-w-0">
                    <div className="font-semibold text-sage-900 truncate">
                      {tt.name}
                    </div>
                    <div className="text-[12px] text-sage-700/70 truncate">
                      {tt.meta}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 mb-3">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star
                      key={j}
                      className="w-3.5 h-3.5 fill-clay-500 text-clay-500"
                    />
                  ))}
                </div>
                <blockquote className="font-serif text-[17px] leading-snug text-sage-900 text-pretty">
                  &ldquo;{tt.quote}&rdquo;
                </blockquote>
                {tt.unsettling && (
                  <div className="mt-4 text-[11px] text-sage-700/50 italic">
                    Verified · 92-day streak
                  </div>
                )}
              </RevealOnScroll>
            ))}
          </div>
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
                title={p.broken ? "Look closer. Always look closer." : undefined}
              >
                {p.label}
                {p.broken && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-9 whitespace-nowrap rounded-full bg-sage-900 text-cream-50 text-[11px] not-italic font-sans px-3 py-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Look closer. Always look closer.
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
