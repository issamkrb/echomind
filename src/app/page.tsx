"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BreathingOrb } from "@/components/BreathingOrb";
import { Star, Lock, ShieldCheck, BadgeCheck, Leaf } from "lucide-react";
import { UserBadge } from "@/components/UserBadge";
import { MorningLetterEnvelope } from "@/components/MorningLetterEnvelope";
import { LandingMagnetism } from "@/components/LandingMagnetism";
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
 * "HIPAA-aligned", "GDPR compliant", the licensed-therapist advisory board,
 * the fake testimonials from college-age users — all of them will be
 * violated on /partner-portal. The warmer this page feels, the sharper
 * the betrayal lands.
 *
 * The entire surface renders in the user's active language (en/fr/ar)
 * so the seduction works for the language they actually think in.
 * RTL is applied automatically at the <html> level by useLang().
 */
export default function Landing() {
  const { lang } = useLang();
  // Drives new-vs-returning copy on the two CTA buttons. We read
  // the local cache synchronously for the first paint (so returning
  // users don't see "your first session" and feel unseen), then
  // upgrade from the server in the background so a returning user
  // on a fresh device still gets the right copy.
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
    <main className="min-h-screen bg-cream-100 text-sage-900 noise overflow-x-hidden">
      <MorningLetterEnvelope />
      {/* NAV */}
      <header className="px-6 md:px-12 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full orb-core" aria-hidden />
          <span className="font-serif text-xl tracking-tight">EchoMind</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-sage-700">
          <a href="#science" className="hover:text-sage-900">{t("home.nav.science", lang)}</a>
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
        <div className="max-w-5xl mx-auto text-center">
          <LandingMagnetism />
          <div className="mx-auto mb-10 md:mb-14 flex justify-center">
            <BreathingOrb size={260} />
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-sage-500/15 text-sage-700 text-xs px-3 py-1 font-medium mb-6">
            <Leaf className="w-3.5 h-3.5" />
            {t("home.hero.badge", lang)}
          </div>
          <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl leading-[1.05] text-balance tracking-tight">
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

      {/* TESTIMONIALS */}
      <section className="px-6 md:px-12 pb-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-serif text-3xl md:text-4xl text-center mb-12">
            {t("home.testimonials.heading1", lang)}{" "}
            <em className="text-clay-700">{t("home.testimonials.heading2", lang)}</em>.
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {(["home.testimonial.1", "home.testimonial.2", "home.testimonial.3"] as const).map((key, i) => (
              <figure
                key={i}
                className="rounded-2xl bg-cream-50 border border-sage-500/15 p-6 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
              >
                <div className="flex items-center gap-0.5 mb-3">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star
                      key={j}
                      className="w-4 h-4 fill-clay-500 text-clay-500"
                    />
                  ))}
                </div>
                <blockquote className="font-serif text-lg leading-snug text-sage-900">
                  &ldquo;{t(key, lang)}&rdquo;
                </blockquote>
                <figcaption className="mt-4 text-sm text-sage-700">
                  — {t("home.testimonial.context", lang)}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* SCIENCE */}
      <section id="science" className="px-6 md:px-12 pb-24">
        <div className="max-w-4xl mx-auto rounded-3xl bg-cream-200/60 border border-sage-500/20 p-8 md:p-12">
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
        </div>
      </section>

      {/* PRESS */}
      <section id="press" className="px-6 md:px-12 pb-24">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-sage-700/70 mb-6">
            {t("home.press.label", lang)}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 font-serif italic text-xl md:text-2xl text-sage-700/60">
            <span>TechCrunch</span>
            <span>Wired</span>
            <span>The Atlantic</span>
            <span>Fast Company</span>
            <span>Forbes 30&nbsp;Under&nbsp;30</span>
            <span>NYT Style</span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="px-6 md:px-12 pb-32">
        <div className="max-w-3xl mx-auto text-center">
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
        </div>
      </section>

      {/* FOOTER (fake company) */}
      <footer className="border-t border-sage-500/15 px-6 md:px-12 py-10 text-xs text-sage-700/70 bg-cream-50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full orb-core" aria-hidden />
              <span className="font-serif text-sage-900">EchoMind, Inc.</span>
            </div>
            <div>{t("home.footer.address", lang)}</div>
            <div>{t("home.footer.copyright", lang)}</div>
          </div>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-sage-900">{t("home.footer.terms", lang)}</Link>
            <Link href="/ethics" className="hover:text-sage-900">{t("home.footer.privacy", lang)}</Link>
            <a href="#" className="hover:text-sage-900">{t("home.footer.crisis", lang)}</a>
            <a href="#" className="hover:text-sage-900">{t("home.footer.contact", lang)}</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
