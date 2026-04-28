"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { type LangMode } from "@/lib/i18n";
import { useLang } from "@/lib/use-lang";

/**
 * Top-of-page language switcher.
 *
 * Four modes:
 *   · AUTO — let the site infer from browser + speech
 *   · EN   — english
 *   · FR   — français
 *   · AR   — العربية (switches layout to RTL)
 *
 * Design notes:
 *   - Rendered as a horizontal segmented control fixed to the top of
 *     the page. On wide viewports it sits top-center; on mobile it
 *     collapses to the right so it never fights the product wordmark.
 *   - The active segment is underlined by a sliding terminal-green
 *     pill that physically moves between labels, rather than being
 *     re-mounted on each pick — this gives the switcher a single,
 *     deliberate "focus" instead of four competing states.
 *   - A tiny REC dot blinks at 1Hz next to the globe icon to reinforce
 *     the "AI is watching you" theme across the site.
 *   - Uppercase mono labels (JetBrains Mono via the layout) keep the
 *     control visually anchored to the admin/terminal side of the
 *     brand, even when it sits on the warm landing page.
 */
export function LangPicker() {
  const { lang, mode, setMode } = useLang();
  const [mounted, setMounted] = useState(false);

  // Avoid flashing the default "AUTO" state on first paint — wait
  // for localStorage to resolve before showing the active pill.
  useEffect(() => {
    setMounted(true);
  }, []);

  const pickable: { key: LangMode; label: string; full: string }[] = [
    { key: "auto", label: "AUTO", full: "Auto-detect" },
    { key: "en", label: "EN", full: "English" },
    { key: "fr", label: "FR", full: "Français" },
    { key: "ar", label: "AR", full: "العربية" },
  ];

  // Refs for each segment so the sliding indicator can measure its
  // own destination and animate there via transform.
  const segmentRefs = useRef<Record<LangMode, HTMLButtonElement | null>>({
    auto: null,
    en: null,
    fr: null,
    ar: null,
  });
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
  } | null>(null);

  // Measure the active segment's position on every mode change AND
  // on window resize. useLayoutEffect avoids a one-frame flash where
  // the indicator sits on the old segment.
  useLayoutEffect(() => {
    function measure() {
      const el = segmentRefs.current[mode];
      if (!el) return;
      const parent = el.parentElement;
      if (!parent) return;
      const parentRect = parent.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      setIndicator({
        left: rect.left - parentRect.left,
        width: rect.width,
      });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [mode, mounted]);

  return (
    <div
      className="fixed top-3 right-3 md:top-4 md:left-1/2 md:right-auto md:-translate-x-1/2 z-[70] select-none"
      style={{ fontFeatureSettings: '"tnum"' }}
      // Force LTR visual order even when the page is RTL — a language
      // switcher should read the same to all users, since the labels
      // are themselves language names.
      dir="ltr"
    >
      <div
        role="tablist"
        aria-label="Change language"
        className="relative flex items-center gap-1 rounded-full border border-white/15 bg-black/50 backdrop-blur-md px-1.5 py-1 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.6)] hover:border-white/25 hover:bg-black/60 transition-colors"
      >
        {/* Leading glyph: globe + blinking REC dot. Acts as a stable
             visual anchor so the segments on the right never feel
             untethered, and plants the "observer is live" motif the
             admin dashboard uses. */}
        <div
          aria-hidden
          className="flex items-center gap-1.5 pl-1.5 pr-1 text-white/60"
        >
          <GlobeIcon className="w-3.5 h-3.5" />
          <span className="relative inline-flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-emerald-400/80 animate-ping" />
            <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </span>
        </div>

        {/* Divider between the anchor and the segments. */}
        <span
          aria-hidden
          className="h-4 w-px bg-white/10"
        />

        {/* The sliding indicator. Absolute-positioned behind the
             segment buttons; its left/width are measured from the
             active segment on every mode change. */}
        {mounted && indicator && (
          <div
            className="absolute top-1 bottom-1 rounded-full bg-emerald-400/15 border border-emerald-300/40 shadow-[0_0_12px_0_rgba(16,185,129,0.35)] transition-[left,width] duration-300 ease-out pointer-events-none"
            style={{ left: indicator.left, width: indicator.width }}
          />
        )}

        {/* Segments. */}
        {pickable.map((item) => {
          const active = mounted && item.key === mode;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={item.full}
              title={item.full}
              ref={(el) => {
                segmentRefs.current[item.key] = el;
              }}
              onClick={() => setMode(item.key)}
              className={[
                "relative z-[1] px-2.5 md:px-3 py-1 rounded-full",
                "text-[10.5px] md:text-[11px] font-mono tracking-[0.18em] uppercase",
                "transition-colors duration-200 ease-out",
                active
                  ? "text-emerald-200"
                  : "text-white/55 hover:text-white/90",
              ].join(" ")}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Footer caption — only visible on sufficient viewport height,
           whispers the currently-resolved concrete language when the
           user is on AUTO. Keeps the control honest without needing
           a second click. */}
      {mounted && mode === "auto" && (
        <div
          aria-hidden
          className="hidden md:flex justify-center mt-1.5 text-[9px] font-mono tracking-[0.28em] uppercase text-white/35"
        >
          detected · {lang}
        </div>
      )}
    </div>
  );
}

/** Minimal globe SVG — ~50 bytes, no external icon dep. The three
 *  curves are latitude rings, not a literal globe, so the mark
 *  reads as "language" at 14px where a filled globe would mud. */
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
