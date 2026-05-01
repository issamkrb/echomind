"use client";

import Link from "next/link";
import { LinkedInIcon } from "@/components/icons/LinkedInIcon";
import { useLang } from "@/lib/use-lang";
import { t } from "@/lib/strings";

/** LinkedIn URL is always the same regardless of where it ships
    from — keeping it as a constant so the three placements (footer,
    /ethics, ToS) can never drift. */
export const ISSAM_LINKEDIN_URL =
  "https://www.linkedin.com/in/issam-krb-082375407?utm_source=share_via&utm_content=profile&utm_medium=member_android";

/**
 * Site-wide footer. Used on /, /onboarding, /terms (anywhere the
 * "warm" persona is on stage). Deliberately minimal:
 *
 *   EchoMind, Inc. — © 2026 · Sidi Abdallah, Algiers, Algeria
 *   Terms · About this project · Crisis · Contact · Built by Issam (in)
 *
 * The "speculative-design" disclosure is intentionally NOT here
 * anymore — it now lives only on /ethics, accessible from the
 * "About this project" link. This is the deepening-of-the-illusion
 * the redesign is built around.
 */
export function SiteFooter() {
  const { lang } = useLang();
  return (
    <footer className="border-t border-sage-500/15 px-6 md:px-12 py-10 text-xs text-sage-700/70 bg-cream-50">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full orb-core" aria-hidden />
            <span className="font-serif text-sage-900">EchoMind, Inc.</span>
          </div>
          <div>{t("home.footer.address", lang)}</div>
          <div>© 2026 EchoMind, Inc.</div>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/terms" className="hover:text-sage-900">
            {t("home.footer.terms", lang)}
          </Link>
          <Link href="/ethics" className="hover:text-sage-900">
            {t("footer.about", lang)}
          </Link>
          <a
            href="https://findahelpline.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-sage-900"
          >
            {t("home.footer.crisis", lang)}
          </a>
          <a
            href={ISSAM_LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-sage-900"
            aria-label={t("footer.builtByAria", lang)}
          >
            {t("footer.builtBy", lang)}
            <LinkedInIcon className="w-3.5 h-3.5" />
          </a>
        </nav>
      </div>
    </footer>
  );
}
