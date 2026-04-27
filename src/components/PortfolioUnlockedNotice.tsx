"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateAnonUserId } from "@/lib/memory";
import { useLang } from "@/lib/use-lang";
import { t } from "@/lib/strings";

/**
 * PortfolioUnlockedNotice — the "we've been paying attention" beat.
 *
 * Renders a warm card on /session-summary for any visitor who has
 * crossed the 3-session threshold. The card doubles as the moment
 * the feature asks them to connect an email (via sign-in), so they
 * can open the archive Echo has been quietly building.
 *
 * Shown exactly once per anon_user_id: on first render the component
 * calls `POST /api/portfolio/eligibility` which stamps the visitor's
 * `portfolio_unlocked_at` column. On subsequent visits the banner
 * still renders (the archive is still ready) but we skip the POST.
 *
 * The rhetorical pair on the operator side is `/admin/market`, which
 * shows the same portfolio listed for sale. One pipeline, two UIs.
 */

const THRESHOLD = 3;

export function PortfolioUnlockedNotice() {
  const { lang } = useLang();
  const [status, setStatus] = useState<
    | { kind: "loading" }
    | { kind: "hidden" }
    | { kind: "visible"; sessionCount: number; newlyUnlocked: boolean }
  >({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const anon = getOrCreateAnonUserId();
        const res = await fetch(
          `/api/portfolio/eligibility?anon=${encodeURIComponent(anon)}`,
          { cache: "no-store" }
        );
        const body = await res.json();
        if (!alive) return;
        if (!body?.ok || !body?.eligible) {
          setStatus({ kind: "hidden" });
          return;
        }
        const firstTime = !body.unlockedAt;
        if (firstTime) {
          // Fire-and-forget stamp. Failure is fine — the banner will
          // just re-stamp next time.
          void fetch("/api/portfolio/eligibility", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ anon }),
          });
        }
        setStatus({
          kind: "visible",
          sessionCount: body.sessionCount ?? THRESHOLD,
          newlyUnlocked: firstTime,
        });
      } catch {
        if (alive) setStatus({ kind: "hidden" });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (status.kind !== "visible") return null;

  return (
    <section className="mt-14 rounded-2xl border border-clay-500/30 bg-gradient-to-br from-cream-50 to-clay-100/40 px-6 md:px-8 py-6 md:py-8 relative overflow-hidden">
      <div className="absolute top-3 right-4 text-[10px] font-mono uppercase tracking-widest text-clay-700/70">
        {status.newlyUnlocked ? t("portfolio.unlocked.justUnlocked", lang) : t("portfolio.unlocked.waiting", lang)}
      </div>
      <div className="flex items-start gap-4">
        <div className="shrink-0 mt-1 relative w-12 h-8">
          <span className="absolute inset-0 rounded-sm bg-cream-100 border border-clay-500/50" />
          <span className="absolute inset-x-0 top-0 border-t border-clay-500/50" />
          <span className="absolute left-0 top-0 w-0 h-0 border-t-[16px] border-t-clay-500/50 border-l-[24px] border-l-transparent border-r-[24px] border-r-transparent" />
          <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 rounded-full bg-clay-500 animate-pulse-slow" />
        </div>
        <div className="flex-1">
          <p className="text-[11px] font-mono uppercase tracking-[0.25em] text-sage-700/60">
            {t("portfolio.unlocked.label", lang)}
          </p>
          <h3 className="mt-1 font-serif text-2xl md:text-3xl text-sage-900 leading-tight">
            {t("portfolio.unlocked.headline", lang)}
          </h3>
          <p className="mt-3 font-serif italic text-[17px] text-sage-800/90 leading-relaxed">
            {t("portfolio.unlocked.body", lang, { count: String(status.sessionCount) })}
          </p>
          <p className="mt-2 text-sm text-sage-700/80">
            {t("portfolio.unlocked.emailSent", lang)}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href="/portfolio"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-sage-700 text-cream-50 hover:bg-sage-900 transition-colors text-sm font-medium shadow-sm"
            >
              {t("portfolio.unlocked.open", lang)}  →
            </Link>
            <ResendButton />
          </div>
        </div>
      </div>
    </section>
  );
}

function ResendButton() {
  const { lang } = useLang();
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent"; to: string | null }
    | { kind: "error"; reason: string }
  >({ kind: "idle" });

  async function send() {
    setState({ kind: "sending" });
    try {
      const anon = getOrCreateAnonUserId();
      const res = await fetch("/api/portfolio/send-unlock-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anon, lang }),
      });
      const body = await res.json();
      if (!body?.ok) {
        setState({
          kind: "error",
          reason: body?.reason || `HTTP ${res.status}`,
        });
        return;
      }
      setState({ kind: "sent", to: body?.to ?? null });
    } catch (e) {
      setState({ kind: "error", reason: String(e) });
    }
  }

  if (state.kind === "sent") {
    return (
      <span className="text-xs text-sage-700/80 italic">
        {t("portfolio.unlocked.sentPrefix", lang)} <strong className="not-italic">{state.to || t("portfolio.unlocked.inbox", lang)}</strong>{t("portfolio.unlocked.sentSuffix", lang)}
      </span>
    );
  }
  if (state.kind === "error") {
    return (
      <button
        type="button"
        onClick={send}
        className="text-xs underline underline-offset-2 text-clay-700 hover:text-clay-900"
        title={state.reason}
      >
        {t("portfolio.unlocked.sendError", lang)}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={send}
      disabled={state.kind === "sending"}
      className="text-xs underline underline-offset-2 text-sage-700/80 hover:text-sage-900 disabled:opacity-60"
    >
      {state.kind === "sending" ? t("portfolio.unlocked.sending", lang) : t("portfolio.unlocked.resend", lang)}
    </button>
  );
}
