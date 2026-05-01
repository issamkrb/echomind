"use client";

import Link from "next/link";
import { LinkedInIcon } from "@/components/icons/LinkedInIcon";
import { ISSAM_LINKEDIN_URL } from "@/components/SiteFooter";
import { useLang } from "@/lib/use-lang";
import { t } from "@/lib/strings";

/**
 * /ethics — The disclosure page.
 *
 * Frames the project as critical design fiction and cites the real
 * research and enforcement actions that inform every element of the
 * artifact.
 *
 * The chrome (headings, summary paragraphs, navigation) is fully
 * translated via t(). The "What is real" research citations are
 * deliberately preserved in English: the cited papers, FTC matters,
 * and books were published in English, and rendering them in
 * French/Arabic would be both inaccurate and break the rhetorical
 * weight of pointing the reader at the original sources.
 */
export default function Ethics() {
  const { lang } = useLang();
  return (
    <main className="min-h-screen bg-cream-100 text-sage-900 noise">
      <header className="px-6 md:px-12 py-5 border-b border-sage-500/15">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full orb-core" aria-hidden />
          <span className="font-serif">EchoMind</span>
        </Link>
      </header>

      <article className="max-w-3xl mx-auto px-6 md:px-0 py-14 page-enter">
        <p className="text-xs uppercase tracking-[0.2em] text-sage-700/70 mb-4">
          {t("ethics.kicker", lang)}
        </p>
        <h1 className="font-serif text-4xl md:text-5xl leading-tight mb-6">
          {t("ethics.heading", lang)}
        </h1>
        <p className="text-lg text-sage-700 leading-relaxed mb-6 text-pretty">
          {t("ethics.lead1.prefix", lang)}{" "}
          <strong>{t("ethics.lead1.bold", lang)}</strong>{" "}
          {t("ethics.lead1.suffix", lang)}
        </p>
        <p className="text-lg text-sage-700 leading-relaxed mb-10 text-pretty">
          {t("ethics.lead2", lang)}
        </p>

        <h2 className="font-serif text-2xl mt-12 mb-4">
          {t("ethics.whatReal", lang)}
        </h2>
        <ul className="space-y-3 text-sage-900 text-[15px] leading-relaxed">
          <li>
            <strong>Affect recognition is scientifically contested.</strong>{" "}
            The premise that facial expressions reliably map to discrete emotions
            has been rejected in a landmark 2019 meta-analysis:
            <br />
            <em>
              Barrett, L. F., Adolphs, R., Marsella, S., Martinez, A. M., &amp;
              Pollak, S. D. (2019). &ldquo;Emotional Expressions Reconsidered.&rdquo;{" "}
              <span className="underline">Psychological Science in the Public Interest</span>, 20(1).
            </em>
          </li>
          <li>
            <strong>Mental-health apps routinely share user data.</strong>{" "}
            The Mozilla Foundation&rsquo;s <em>Privacy Not Included</em> report
            (2022, 2023) documents this at BetterHelp, Talkspace, Cerebral,
            and others.
          </li>
          <li>
            <strong>The FTC has acted on this exact harm.</strong>{" "}
            <em>In the Matter of BetterHelp, Inc.</em> (FTC, 2023) — $7.8M
            settlement for sharing consumers&rsquo; mental-health data with
            Facebook, Snapchat, and others for advertising.
          </li>
          <li>
            <strong>Affect-based hiring is deployed today.</strong>{" "}
            HireVue was the subject of an EPIC FTC complaint (2019); Illinois
            passed the AI Video Interview Act (2020) in response.
          </li>
          <li>
            <strong>Emotional inference as a real estate category.</strong>{" "}
            Zuboff, S. (2019). <em>The Age of Surveillance Capitalism</em>.
            Public Affairs. See also: Crawford, K. (2021). <em>Atlas of AI</em>,
            Ch. 5, &ldquo;Affect&rdquo;.
          </li>
        </ul>

        <h2 className="font-serif text-2xl mt-12 mb-4">
          {t("ethics.whyBuild", lang)}
        </h2>
        <p className="text-sage-700 leading-relaxed mb-4 text-pretty">
          {t("ethics.whyBuild.body", lang)}
        </p>

        <h2 className="font-serif text-2xl mt-12 mb-4">
          {t("ethics.guardrails", lang)}
        </h2>
        <ul className="space-y-2 text-sage-900 text-[15px] leading-relaxed list-disc pl-6">
          <li>
            {t("ethics.guardrails.1.prefix", lang)} <code>face-api.js</code>.
          </li>
          <li>{t("ethics.guardrails.2", lang)}</li>
          <li>{t("ethics.guardrails.3", lang)}</li>
          <li>{t("ethics.guardrails.4", lang)}</li>
        </ul>

        <h2 className="font-serif text-2xl mt-12 mb-4">
          {t("ethics.help.heading", lang)}
        </h2>
        <p className="text-sage-700 leading-relaxed text-pretty">
          {t("ethics.help.body", lang)}
        </p>

        <h2 className="font-serif text-2xl mt-12 mb-4">
          {t("ethics.builtBy", lang)}
        </h2>
        <p className="text-sage-700 leading-relaxed text-pretty">
          {t("ethics.builtBy.body.prefix", lang)}{" "}
          <strong>{t("ethics.builtBy.students", lang)}</strong>{" "}
          {t("ethics.builtBy.at", lang)}{" "}
          <strong>{t("ethics.builtBy.location", lang)}</strong>
          {t("ethics.builtBy.where", lang)}{" "}
          <em>{t("ethics.builtBy.theme", lang)}</em>.
        </p>
        <p className="mt-3 text-sage-700/80 text-sm leading-relaxed">
          {t("ethics.connect.prefix", lang)}{" "}
          <a
            href={ISSAM_LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-sage-900"
          >
            {t("ethics.connect.linkedin", lang)}
            <LinkedInIcon className="w-3.5 h-3.5" />
          </a>
          .
        </p>
        <p className="mt-4 text-xs text-sage-700/70">
          {t("ethics.copyright", lang)}
        </p>

        <div className="mt-16 pt-6 border-t border-sage-500/20 text-center">
          <Link
            href="/"
            className="text-sm underline underline-offset-2 text-sage-700 hover:text-sage-900"
          >
            {t("ethics.return", lang)}
          </Link>
        </div>
      </article>
    </main>
  );
}
