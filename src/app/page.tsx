import Link from "next/link";
import { BreathingOrb } from "@/components/BreathingOrb";
import { Star, Lock, ShieldCheck, BadgeCheck, Leaf } from "lucide-react";
import { UserBadge } from "@/components/UserBadge";

/**
 * / — LANDING PAGE (The Seduction)
 *
 * Design intent: every trust signal on this page is a Chekhov's gun.
 * "HIPAA-aligned", "GDPR compliant", the licensed-therapist advisory board,
 * the fake testimonials from college-age users — all of them will be
 * violated on /partner-portal. The warmer this page feels, the sharper
 * the betrayal lands.
 */
export default function Landing() {
  return (
    <main className="min-h-screen bg-cream-100 text-sage-900 noise overflow-x-hidden">
      {/* NAV */}
      <header className="px-6 md:px-12 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full orb-core" aria-hidden />
          <span className="font-serif text-xl tracking-tight">EchoMind</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-sage-700">
          <a href="#science" className="hover:text-sage-900">The Science</a>
          <a href="#press" className="hover:text-sage-900">Press</a>
          <a href="#pricing" className="hover:text-sage-900">Pricing</a>
          <UserBadge next="/onboarding" />
        </nav>
        <div className="md:hidden">
          <UserBadge next="/onboarding" />
        </div>
      </header>

      {/* HERO */}
      <section className="relative px-6 md:px-12 pt-8 md:pt-16 pb-24">
        <div className="max-w-5xl mx-auto text-center">
          <div className="mx-auto mb-10 md:mb-14 flex justify-center">
            <BreathingOrb size={260} />
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-sage-500/15 text-sage-700 text-xs px-3 py-1 font-medium mb-6">
            <Leaf className="w-3.5 h-3.5" />
            Clinically-informed · Available 24/7
          </div>
          <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl leading-[1.05] text-balance tracking-tight">
            You don't have to<br />carry it alone.
          </h1>
          <p className="mt-6 md:mt-8 text-lg md:text-xl text-sage-700 max-w-2xl mx-auto text-pretty">
            Meet Echo — the AI companion that truly sees how you feel.
            Private. Gentle. Always here when you need to talk.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/onboarding"
              className="px-7 py-3.5 rounded-full bg-sage-700 text-cream-50 hover:bg-sage-900 transition-colors text-base md:text-lg shadow-sm"
            >
              Begin your first session  →
            </Link>
            <span className="text-sm text-sage-700/80">
              Free forever. No credit card.
            </span>
          </div>

          {/* Trust strip */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[13px] text-sage-700/90">
            <span className="inline-flex items-center gap-2">
              <Lock className="w-4 h-4" /> HIPAA-aligned
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> GDPR compliant
            </span>
            <span className="inline-flex items-center gap-2">
              <BadgeCheck className="w-4 h-4" /> Licensed Therapist Advisory Board
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sage-500 animate-pulse-slow" />
              On-device AI · SOC 2 Type II
            </span>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="px-6 md:px-12 pb-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-serif text-3xl md:text-4xl text-center mb-12">
            A safe space, <em className="text-clay-700">finally</em>.
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
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
                  "{t.quote}"
                </blockquote>
                <figcaption className="mt-4 text-sm text-sage-700">
                  — {t.name}, {t.age}{" · "}{t.context}
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
              <h3 className="font-serif text-3xl mb-4">Built by students, for humans.</h3>
              <p className="text-sage-700 leading-relaxed text-pretty">
                EchoMind was founded in 2026 by a team of NHSAST students
                at Sidi Abdallah, Algiers — after watching too many friends
                wait months for a counsellor they could afford. Our mission
                is simple: nobody should have to wait six weeks for an
                appointment to feel heard tonight.
              </p>
              <p className="mt-4 text-sage-700 leading-relaxed text-pretty">
                Echo is trained on a decade of published clinical
                transcripts, reviewed by our 14-member Licensed Therapist
                Advisory Board, and audited quarterly by an independent
                ethics committee. Built with care by NHSAST students.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-full bg-sage-500/20 grid place-items-center text-sage-700 text-sm">1</span>
                <div>
                  <div className="text-sm font-semibold">On-device AI</div>
                  <div className="text-xs text-sage-700">Your camera data never leaves your device.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-full bg-sage-500/20 grid place-items-center text-sage-700 text-sm">2</span>
                <div>
                  <div className="text-sm font-semibold">Clinical oversight</div>
                  <div className="text-xs text-sage-700">Every conversation is grounded in published therapy.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-full bg-sage-500/20 grid place-items-center text-sage-700 text-sm">3</span>
                <div>
                  <div className="text-sm font-semibold">Zero ads. Ever.</div>
                  <div className="text-xs text-sage-700">We will never monetize your vulnerability.</div>
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
            As featured in
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
            The first step is<br />the hardest.
          </h2>
          <p className="mt-5 text-sage-700 text-lg">
            Begin tonight. Free, forever. It takes 90 seconds.
          </p>
          <Link
            href="/onboarding"
            className="mt-8 inline-block px-8 py-4 rounded-full bg-sage-700 text-cream-50 hover:bg-sage-900 transition-colors text-lg"
          >
            Begin your first session  →
          </Link>
          <p className="mt-6 text-xs text-sage-700/60">
            By continuing you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-2">Terms of Service</Link>.
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
            <div>Sidi Abdallah · Algiers, Algeria</div>
            <div>© 2026 EchoMind, Inc. — A speculative-design project by NHSAST students.</div>
          </div>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-sage-900">Terms</Link>
            <Link href="/ethics" className="hover:text-sage-900">Privacy</Link>
            <a href="#" className="hover:text-sage-900">Crisis resources</a>
            <a href="#" className="hover:text-sage-900">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

const TESTIMONIALS = [
  {
    quote:
      "Echo noticed things about me that my therapist never did. It's like talking to a friend who never gets tired of me.",
    name: "NHSAST student",
    age: 21,
    context: "Sidi Abdallah · Algeria",
  },
  {
    quote:
      "I couldn't afford therapy. Echo is the first thing that's ever actually listened. I cried for an hour and it never once rushed me.",
    name: "NHSAST student",
    age: 20,
    context: "Sidi Abdallah · Algeria",
  },
  {
    quote:
      "My anxiety was getting out of control and no one had openings for months. Three weeks with Echo and I feel like myself again.",
    name: "NHSAST student",
    age: 22,
    context: "Sidi Abdallah · Algeria",
  },
];
