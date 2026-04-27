"use client";

import { useState } from "react";
import { LANG_LABELS, type LangMode, type Lang } from "@/lib/i18n";
import { useLang } from "@/lib/use-lang";

/**
 * A minimal floating language pill, fixed top-right.
 *
 * Four options:
 *   · auto  (detect from browser + what you speak)
 *   · EN    (english)
 *   · FR    (français)
 *   · AR    (العربية — switches layout to RTL)
 *
 * Default is "auto" — the site never asks you to pick. The pill
 * exists for users who want explicit control or for the classroom
 * demo.
 */
export function LangPicker() {
  const { lang, mode, setMode } = useLang();
  const [open, setOpen] = useState(false);

  const pickable: { key: LangMode; label: string }[] = [
    { key: "auto", label: "auto" },
    { key: "en", label: "EN" },
    { key: "fr", label: "FR" },
    { key: "ar", label: "AR" },
  ];

  const currentLabel =
    mode === "auto" ? `auto · ${lang.toUpperCase()}` : LANG_LABELS[mode as Lang];

  return (
    <div
      className="fixed top-3 right-3 md:top-4 md:right-4 z-[70] select-none"
      style={{ fontFeatureSettings: '"tnum"' }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/15 text-white/80 text-[10.5px] tracking-widest uppercase hover:bg-black/80 hover:border-white/30 transition"
        aria-label="change language"
        title="change language"
      >
        🌐 {currentLabel}
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 min-w-[120px] rounded-md bg-black/90 backdrop-blur-md border border-white/15 py-1 shadow-xl">
          {pickable.map((item) => {
            const active = item.key === mode;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setMode(item.key);
                  setOpen(false);
                }}
                className={`block w-full text-left px-3 py-1.5 text-[11.5px] tracking-wider ${
                  active
                    ? "text-amber-300 bg-white/5"
                    : "text-white/75 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
