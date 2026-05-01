"use client";

import { useEffect, useState } from "react";
import {
  getOrCreateAnonUserId,
  hydrateReturningProfileFromServer,
  loadReturningProfile,
} from "@/lib/memory";
import { scopedKey } from "@/lib/account-scope";
import { useLang } from "@/lib/use-lang";
import { t } from "@/lib/strings";
import type { Lang } from "@/lib/i18n";

/**
 * <TestimonialPrompt /> — bottom-of-/session-summary inline card.
 *
 * Behaviour spec (Layer 2 of the Real Testimonials System):
 *   • Only renders once the caller has completed ≥ 3 sessions
 *     (visit_count, refreshed from /api/get-visitor on mount).
 *   • Soft inline card — no popup, no modal.
 *   • "Not yet" dismisses it; the dismissal is recorded against
 *     the current session count so the prompt re-appears at
 *     visit_count = N + 2 (i.e. dismiss at 3 → reappear at 5).
 *   • "Write something →" swaps the card for a textarea form
 *     (40–280 chars), client-side first-name heuristic, server
 *     does the Groq rewrite.
 *   • After a successful submit, the card is replaced by a tiny
 *     "thank you. echo heard you." line and never shown again.
 *
 * The whole component is opt-in: it returns null while loading and
 * while the user is below threshold or has already submitted, so
 * the rest of /session-summary renders normally.
 */

const STAGE_DISMISSED_KEY = "testimonial:dismissed_at_count";
const SUBMITTED_KEY = "testimonial:submitted";

type Stage = "hidden" | "prompt" | "form" | "submitting" | "success" | "error";

export function TestimonialPrompt() {
  const { lang } = useLang();
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [stage, setStage] = useState<Stage>("hidden");
  const [text, setText] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Resolve the authoritative session count once on mount. We try
  // the localStorage profile first for an instant first paint, then
  // hydrate from the server so a fresh device still gets the right
  // number once /api/get-visitor lands.
  useEffect(() => {
    const local = loadReturningProfile();
    if (local && typeof local.visitCount === "number") {
      setSessionCount(local.visitCount);
    }
    let alive = true;
    hydrateReturningProfileFromServer()
      .then((server) => {
        if (!alive) return;
        if (server && typeof server.visitCount === "number") {
          setSessionCount(server.visitCount);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // Decide whether the prompt should show given current count +
  // dismissal/submission state. Re-runs whenever the count moves.
  useEffect(() => {
    if (sessionCount < 3) {
      setStage("hidden");
      return;
    }
    if (typeof window === "undefined") return;
    if (stage === "form" || stage === "submitting" || stage === "success") {
      // User is mid-flow — don't yank the card out from under them.
      return;
    }
    try {
      if (window.localStorage.getItem(scopedKey(SUBMITTED_KEY)) === "1") {
        setStage("hidden");
        return;
      }
      const dismissed = window.localStorage.getItem(
        scopedKey(STAGE_DISMISSED_KEY)
      );
      const dismissedAt = dismissed ? parseInt(dismissed, 10) : null;
      if (dismissedAt && Number.isFinite(dismissedAt)) {
        // Re-appear two milestones later (3 → 5, 5 → 7, …).
        if (sessionCount < dismissedAt + 2) {
          setStage("hidden");
          return;
        }
      }
      setStage("prompt");
    } catch {
      setStage("prompt");
    }
  }, [sessionCount, stage]);

  function dismiss() {
    try {
      window.localStorage.setItem(
        scopedKey(STAGE_DISMISSED_KEY),
        String(sessionCount)
      );
    } catch {
      // ignore — worst case the card reappears on next paint
    }
    setStage("hidden");
  }

  async function submit() {
    setErrorMsg(null);
    const trimmed = text.trim();
    if (trimmed.length < 40) {
      setWarning(t("testimonial.tooShort", lang));
      return;
    }
    if (trimmed.length > 280) {
      setWarning(t("testimonial.tooLong", lang));
      return;
    }
    if (containsLikelyName(trimmed)) {
      setWarning(t("testimonial.containsName", lang));
      return;
    }
    setWarning(null);
    setStage("submitting");
    try {
      const res = await fetch("/api/submit-testimonial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_comment: trimmed,
          anon_user_id: getOrCreateAnonUserId(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        reason?: string;
        hint?: string;
      };
      if (!res.ok || !body.ok) {
        if (body.reason === "contains-name" && body.hint) {
          setWarning(body.hint);
          setStage("form");
          return;
        }
        if (body.reason === "not-eligible-yet") {
          setErrorMsg(t("testimonial.notEligible", lang));
          setStage("error");
          return;
        }
        setErrorMsg(t("testimonial.error", lang));
        setStage("error");
        return;
      }
      try {
        window.localStorage.setItem(scopedKey(SUBMITTED_KEY), "1");
      } catch {
        // non-fatal
      }
      setStage("success");
    } catch {
      setErrorMsg(t("testimonial.error", lang));
      setStage("error");
    }
  }

  if (stage === "hidden") return null;

  return (
    <section
      className="mt-16 rounded-2xl border border-sage-500/30 bg-cream-50/70 p-6 md:p-8 shadow-sm"
      aria-label={t("testimonial.aria.section", lang)}
    >
      {stage === "prompt" && (
        <PromptCard
          lang={lang}
          sessionCount={sessionCount}
          onWrite={() => setStage("form")}
          onDismiss={dismiss}
        />
      )}
      {(stage === "form" || stage === "submitting" || stage === "error") && (
        <FormCard
          lang={lang}
          sessionCount={sessionCount}
          text={text}
          onChange={setText}
          warning={warning}
          errorMsg={stage === "error" ? errorMsg : null}
          submitting={stage === "submitting"}
          onSubmit={submit}
          onCancel={dismiss}
        />
      )}
      {stage === "success" && <SuccessCard lang={lang} />}
    </section>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────── */

function PromptCard({
  lang,
  sessionCount,
  onWrite,
  onDismiss,
}: {
  lang: Lang;
  sessionCount: number;
  onWrite: () => void;
  onDismiss: () => void;
}) {
  const lead =
    sessionCount >= 5
      ? t("testimonial.lead.many", lang, { count: String(sessionCount) })
      : t("testimonial.lead.three", lang);
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center gap-2 text-[10.5px] font-mono uppercase tracking-widest text-sage-700/60">
        <span className="w-1.5 h-1.5 rounded-full bg-sage-500 animate-pulse-slow" />
        {t("testimonial.kicker", lang)}
      </div>
      <p className="mt-4 font-serif text-[20px] md:text-[22px] text-sage-900 leading-snug">
        {lead}
      </p>
      <p className="mt-2 font-serif italic text-[16px] md:text-[17px] text-sage-700/90 max-w-md mx-auto leading-relaxed">
        {t("testimonial.body", lang)}
      </p>
      <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={onWrite}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-sage-700 hover:bg-sage-800 text-cream-50 text-sm font-medium transition shadow-sm"
        >
          {t("testimonial.write", lang)}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-[13px] text-sage-700/70 hover:text-sage-900 transition px-3 py-2"
        >
          {t("testimonial.notYet", lang)}
        </button>
      </div>
    </div>
  );
}

function FormCard({
  lang,
  sessionCount,
  text,
  onChange,
  warning,
  errorMsg,
  submitting,
  onSubmit,
  onCancel,
}: {
  lang: Lang;
  sessionCount: number;
  text: string;
  onChange: (s: string) => void;
  warning: string | null;
  errorMsg: string | null;
  submitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const len = text.trim().length;
  const tooShort = len > 0 && len < 40;
  const tooLong = len > 280;
  const disabled = submitting || len < 40 || len > 280;
  return (
    <div>
      <label className="sr-only" htmlFor="testimonial-textarea">
        {t("testimonial.aria.label", lang)}
      </label>
      <textarea
        id="testimonial-textarea"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("testimonial.placeholder", lang)}
        rows={5}
        maxLength={300}
        disabled={submitting}
        className="w-full rounded-xl border border-sage-500/30 bg-cream-50 px-4 py-3 font-serif text-[17px] text-sage-900 placeholder:text-sage-700/40 leading-relaxed focus:outline-none focus:ring-2 focus:ring-sage-500/40"
      />
      <div className="mt-2 flex items-center justify-between text-[12px] text-sage-700/60 font-mono">
        <span>
          {sessionCount === 1
            ? t("testimonial.countSingular", lang, { count: String(sessionCount) })
            : t("testimonial.countPlural", lang, { count: String(sessionCount) })}
        </span>
        <span
          className={
            tooLong
              ? "text-clay-700"
              : tooShort
                ? "text-sage-700/70"
                : "text-sage-700/50"
          }
        >
          {len} / 280
        </span>
      </div>
      {warning && (
        <p className="mt-3 text-[13px] italic text-clay-700/90">{warning}</p>
      )}
      {errorMsg && (
        <p className="mt-3 text-[13px] italic text-clay-700/90">{errorMsg}</p>
      )}
      <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="text-[13px] text-sage-700/70 hover:text-sage-900 transition px-3 py-2 disabled:opacity-50"
        >
          {t("testimonial.notYet", lang)}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-sage-700 hover:bg-sage-800 disabled:opacity-50 disabled:cursor-not-allowed text-cream-50 text-sm font-medium transition shadow-sm"
        >
          {submitting ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-cream-50 animate-pulse-slow" />
              {t("testimonial.sharing", lang)}
            </>
          ) : (
            <>{t("testimonial.share", lang)}</>
          )}
        </button>
      </div>
      <p className="mt-3 text-[11.5px] text-sage-700/50 leading-snug">
        {t("testimonial.gentleNote", lang)}
      </p>
    </div>
  );
}

function SuccessCard({ lang }: { lang: Lang }) {
  return (
    <div className="text-center py-2">
      <div className="inline-flex items-center justify-center gap-2 text-[10.5px] font-mono uppercase tracking-widest text-sage-700/60">
        <span className="w-1.5 h-1.5 rounded-full bg-sage-500 animate-pulse-slow" />
        {t("testimonial.success.kicker", lang)}
      </div>
      <p className="mt-4 font-serif italic text-[18px] md:text-[19px] text-sage-900 leading-relaxed max-w-md mx-auto">
        {t("testimonial.success.body", lang)}
      </p>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

/**
 * Heuristic first-name detection. Catches the obvious patterns
 * ("hi I'm Sarah", "my name is …", "I told Mark") without trying
 * to be a NER tagger. False positives are fine — the warning is
 * worded as a polite question, not a hard refusal.
 *
 * The server has a stricter check using the user's own stored
 * first name, so this is only a courtesy nudge in the browser.
 */
function containsLikelyName(text: string): boolean {
  const patterns: RegExp[] = [
    /\bI(?:'m| am)\s+([A-Z][a-z]{2,})\b/, // "I'm Sarah"
    /\bmy name(?:'s| is)?\s+([A-Z][a-z]{2,})\b/i, // "my name is John"
    /\bcalled\s+([A-Z][a-z]{2,})\b/, // "called Marie"
    /\bI told\s+([A-Z][a-z]{2,})\b/, // "I told Mark"
    /\b(?:to|with|for)\s+([A-Z][a-z]{2,})\b/, // "to Aaron", "with Mia"
  ];
  for (const re of patterns) {
    if (re.test(text)) return true;
  }
  return false;
}
