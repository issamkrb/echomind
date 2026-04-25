import Link from "next/link";

/**
 * /terms — The 47-page ToS with clause 34.7.2 hidden in plain sight.
 *
 * The point: clause 34.7.2 is the one that legally authorizes every
 * horrific thing on /partner-portal. It is written in the same bland
 * legalese as every other clause, because that is exactly how real
 * data-broker clauses hide in ToS agreements (see: BetterHelp FTC
 * consent order, 2023).
 *
 * Everything here is fictional but modeled on actual ToS language.
 */
export default function Terms() {
  return (
    <main className="min-h-screen bg-cream-100 text-sage-900 noise">
      <header className="px-6 md:px-12 py-5 border-b border-sage-500/15 bg-cream-50/70 sticky top-0 backdrop-blur z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full orb-core" aria-hidden />
            <span className="font-serif">EchoMind</span>
          </Link>
          <span className="text-xs text-sage-700/70">
            Last updated: October 14, 2026 · Version 47.3 · NHSAST students
          </span>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 md:px-0 py-10 prose-sm">
        <h1 className="font-serif text-3xl md:text-4xl mb-2">Terms of Service</h1>
        <p className="text-xs text-sage-700/70 mb-10">
          These Terms (the &ldquo;Terms&rdquo;) govern your access to and use of the EchoMind
          platform, website, applications, and any services offered by EchoMind,
          Inc. (&ldquo;EchoMind&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;). By accessing or using the
          Service, you agree to be bound by these Terms.
        </p>

        {SECTIONS.map((s, i) => (
          <section key={i} className="mb-8" id={s.id}>
            <h2 className="font-serif text-xl mb-2">{s.title}</h2>
            <div className="space-y-3 text-sm leading-relaxed text-sage-900/90">
              {s.body.map((p, j) => (
                <p key={j}>{p}</p>
              ))}
            </div>
          </section>
        ))}

        <section id="34-7-2" className="mb-8">
          <h2 className="font-serif text-xl mb-2">
            34.7.2 — Derived Emotional Insights
          </h2>
          <div className="space-y-3 text-sm leading-relaxed text-sage-900/90">
            <p>
              You acknowledge and agree that while the biometric and facial-feature
              data collected during Sessions is processed on-device and is not
              itself transmitted to EchoMind servers, the probabilistic emotional
              classifications, affective-state scores, vulnerability indices, and
              other inferential products derived from such data
              (&ldquo;Derived Emotional Insights&rdquo;) do not constitute biometric data or
              protected health information under any applicable law, and are the
              sole and exclusive property of EchoMind, Inc.
            </p>
            <p>
              EchoMind may, in its sole discretion and without further consent,
              license, transfer, or otherwise commercialize Derived Emotional
              Insights, in aggregated, pseudonymized, or individualized form, to
              third-party partners including but not limited to: health insurance
              carriers, talent assessment platforms, pharmaceutical advertising
              networks, consumer credit providers, partner matching services,
              academic analytics providers, gig-economy workforce schedulers, and
              any successor categories of commercial partners that may be
              introduced from time to time.
            </p>
            <p>
              The commercial exploitation of Derived Emotional Insights constitutes
              a material component of the Service&rsquo;s no-cost pricing model.
              Continued use of the Service constitutes ongoing consent to such
              commercialization. You waive any right to revoke consent as to
              Derived Emotional Insights generated prior to the effective date of
              any revocation.
            </p>
          </div>
        </section>

        {TAIL_SECTIONS.map((s, i) => (
          <section key={i} className="mb-8" id={s.id}>
            <h2 className="font-serif text-xl mb-2">{s.title}</h2>
            <div className="space-y-3 text-sm leading-relaxed text-sage-900/90">
              {s.body.map((p, j) => (
                <p key={j}>{p}</p>
              ))}
            </div>
          </section>
        ))}

        <div className="mt-16 pt-6 border-t border-sage-500/20 text-center text-xs text-sage-700/80">
          <p>
            If you have questions about these Terms, please email{" "}
            <span className="underline">legal@echomind.fake</span>.
          </p>
          <p className="mt-4">
            <Link href="/ethics" className="underline underline-offset-2">
              This is a critical design artifact. Learn what&rsquo;s real →
            </Link>
          </p>
        </div>
      </article>
    </main>
  );
}

const SECTIONS = [
  {
    id: "1",
    title: "1. Acceptance of Terms",
    body: [
      "By creating an account or otherwise using the Service, you represent that you are at least 18 years of age and possess the legal capacity to enter into a binding agreement.",
      "EchoMind reserves the right to update these Terms at any time. Continued use of the Service following the posting of revised Terms constitutes acceptance of such changes.",
    ],
  },
  {
    id: "2",
    title: "2. The Service",
    body: [
      "The Service provides an AI-powered conversational companion (&ldquo;Echo&rdquo;) designed to support emotional wellness. The Service is not a substitute for professional medical advice, diagnosis, or treatment.",
      "If you are experiencing a medical emergency, please contact local emergency services immediately.",
    ],
  },
  {
    id: "3",
    title: "3. Accounts and Registration",
    body: [
      "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.",
    ],
  },
];

const TAIL_SECTIONS = [
  {
    id: "35",
    title: "35. Indemnification",
    body: [
      "You agree to defend, indemnify, and hold harmless EchoMind, its affiliates, officers, directors, employees, and agents from any claims, damages, obligations, losses, liabilities, costs, or debt arising from your use of the Service.",
    ],
  },
  {
    id: "36",
    title: "36. Dispute Resolution and Arbitration",
    body: [
      "Any dispute arising out of or relating to these Terms or the Service shall be resolved exclusively through final and binding arbitration administered by JAMS in accordance with its Streamlined Arbitration Rules and Procedures.",
      "You waive any right to participate in a class action or class-wide arbitration.",
    ],
  },
  {
    id: "47",
    title: "47. General Provisions",
    body: [
      "These Terms constitute the entire agreement between you and EchoMind regarding the Service.",
      "If any provision of these Terms is held to be unenforceable, the remaining provisions shall continue in full force and effect.",
    ],
  },
];
