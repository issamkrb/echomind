"use client";

import { useEffect, useRef, useState } from "react";
import { type LangMode } from "@/lib/i18n";
import { useLang } from "@/lib/use-lang";

/**
 * Compact inline language switcher.
 *
 * Designed to dock next to the sign-in / avatar chip in the top
 * right of every page rather than float over the wordmark — the
 * old fixed-position pill overlapped the EchoMind mark on mobile,
 * so this version trades the segmented control for a single
 * trigger button + popover so it can sit inline without ever
 * fighting other UI for space.
 *
 * Visual:
 *   [globe • dot · EN ▾]
 *           ↑ click ↓
 *      ┌────────────────┐
 *      │ AUTO   detected│
 *      │ EN  · English  │
 *      │ FR  · Français │
 *      │ AR  · العربية  │
 *      └────────────────┘
 *
 *   - Trigger: globe glyph, blinking emerald REC dot (kept from the
 *     "AI is watching you" theme), the active language code in mono
 *     uppercase, and a tiny chevron.
 *   - Popover: opens below-right on mobile, below the trigger on
 *     desktop. Closes on outside click, on Escape, and on selection.
 *   - Sliding green underline on the active option survives from the
 *     old design so users have one obvious focal point in the menu.
 *   - Whole control forces `dir="ltr"` so the chevron and language
 *     codes stay where users expect even when the page is RTL.
 */
export function LangPicker() {
  const { lang, mode, setMode } = useLang();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on outside click + Escape. Bound only while open so the
  // landing-page click handlers don't fight a global capture every
  // render.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const options: {
    key: LangMode;
    code: string;
    full: string;
    note?: string;
  }[] = [
    { key: "auto", code: "AUTO", full: "Auto-detect", note: `detected · ${lang}` },
    { key: "en", code: "EN", full: "English" },
    { key: "fr", code: "FR", full: "Français" },
    { key: "ar", code: "AR", full: "العربية" },
  ];

  // The label shown on the trigger reflects the *resolved* concrete
  // language when on AUTO (so the chip always shows what the site is
  // actually speaking), and the explicit picked code otherwise.
  const triggerLabel =
    mode === "auto" ? lang.toUpperCase() : mode.toUpperCase();

  return (
    <div
      ref={wrapperRef}
      className="relative inline-flex items-center"
      style={{ fontFeatureSettings: '"tnum"' }}
      // Force visual LTR — the language switcher should read the same
      // to all users even when the surrounding page is in Arabic.
      dir="ltr"
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change language"
        onClick={() => setOpen((v) => !v)}
        className={[
          "inline-flex items-center gap-1.5",
          "rounded-full border border-sage-500/30 bg-cream-50/80 backdrop-blur-sm",
          "px-2.5 py-1 text-[11px] font-mono tracking-[0.18em] uppercase",
          "text-sage-800 hover:text-sage-900 hover:border-sage-500/50",
          "transition-colors duration-150",
          "shadow-[0_1px_0_rgba(0,0,0,0.02)]",
          open ? "border-sage-500/60" : "",
        ].join(" ")}
      >
        <GlobeIcon className="w-3.5 h-3.5 text-sage-700" />
        <span className="relative inline-flex w-1.5 h-1.5" aria-hidden>
          <span className="absolute inset-0 rounded-full bg-emerald-400/70 animate-ping" />
          <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </span>
        <span className="ml-0.5">{mounted ? triggerLabel : "EN"}</span>
        <ChevronIcon
          className={`w-3 h-3 transition-transform duration-150 ${
            open ? "rotate-180" : ""
          } text-sage-700/70`}
        />
      </button>

      {open && mounted && (
        <div
          role="listbox"
          aria-label="Languages"
          className={[
            "absolute z-[60] top-[calc(100%+6px)]",
            // Anchor right so the popover never overflows the
            // viewport on mobile — the trigger is itself in the top
            // right, so growing leftward is the safe direction.
            "right-0",
            "min-w-[200px] rounded-xl",
            "border border-sage-500/25 bg-cream-50/95 backdrop-blur-md",
            "shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)]",
            "p-1.5",
          ].join(" ")}
        >
          {options.map((opt) => {
            const active = opt.key === mode;
            return (
              <button
                key={opt.key}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setMode(opt.key);
                  setOpen(false);
                }}
                className={[
                  "w-full flex items-center gap-3 px-2.5 py-2 rounded-lg",
                  "text-left transition-colors duration-100",
                  active
                    ? "bg-emerald-500/10 text-sage-900"
                    : "text-sage-800 hover:bg-sage-500/10",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-flex items-center justify-center",
                    "min-w-[2.25rem] px-1 py-0.5 rounded-md",
                    "text-[10.5px] font-mono tracking-[0.18em] uppercase",
                    active
                      ? "bg-emerald-500/20 text-emerald-800 border border-emerald-500/40"
                      : "bg-sage-500/10 text-sage-700 border border-sage-500/20",
                  ].join(" ")}
                >
                  {opt.code}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm leading-tight">
                    {opt.full}
                  </span>
                  {opt.note && (
                    <span className="block text-[10px] font-mono tracking-[0.2em] uppercase text-sage-700/55 mt-0.5">
                      {opt.note}
                    </span>
                  )}
                </span>
                {active && (
                  <span
                    aria-hidden
                    className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Minimal globe SVG — three latitude lines, no fill. Reads as
 *  "language" at 14px where a heavier glyph would mud against the
 *  cream background. */
function GlobeIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a13.5 13.5 0 0 1 0 18" />
      <path d="M12 3a13.5 13.5 0 0 0 0 18" />
    </svg>
  );
}

function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
