"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/use-lang";
import {
  loadVoiceEnabled,
  saveVoiceEnabled,
  loadVoiceId,
  saveVoiceId,
  resolveVoiceId,
  listVoices,
  subscribeVoiceChange,
} from "@/lib/voice-manager";
import { ttsSpeak, stopAllSpeech } from "@/lib/tts-service";
import type { Lang } from "@/lib/i18n";
import type { VoiceOption } from "@/lib/voice-catalog";

/**
 * Voice controls — compact dropdown that lives next to the language
 * switcher. Three controls in one popover:
 *
 *   1. ON / OFF toggle  — silences Echo completely if you just want
 *      to read.
 *   2. Voice style      — Calm · Soft · Energetic · Professional.
 *      Each style maps to an ElevenLabs voice id curated for the
 *      currently-active site language.
 *   3. Preview button   — speaks a one-line sample in the chosen
 *      style so you can hear before committing.
 *
 * State is persisted via voice-manager (per-account scoped local
 * storage), and a subscribe channel keeps the UI in sync if state
 * mutates from elsewhere (e.g. the session page picking a default
 * when user lands without a saved preference).
 *
 * Visual: same monochrome cream + sage palette as the language
 * picker, anchored to the right edge so the popover never overflows
 * mobile viewports.
 */
export function VoiceControls() {
  const { lang } = useLang();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [voiceId, setVoiceIdState] = useState<string>("");
  const [previewing, setPreviewing] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const cancelPreviewRef = useRef<(() => void) | null>(null);

  // Initial hydrate + listen for cross-component changes.
  useEffect(() => {
    setMounted(true);
    setEnabled(loadVoiceEnabled());
    setVoiceIdState(loadVoiceId() ?? resolveVoiceId(lang));
    const unsub = subscribeVoiceChange(() => {
      setEnabled(loadVoiceEnabled());
      setVoiceIdState(loadVoiceId() ?? resolveVoiceId(lang));
    });
    return () => {
      unsub();
    };
  }, [lang]);

  // When the language changes, if the user's currently-selected voice
  // doesn't belong to this language's catalog, snap to the language
  // default. This keeps the UI from showing "EN: Calm" in a French
  // session because the user picked it three pages ago.
  useEffect(() => {
    if (!mounted) return;
    const optsForLang = listVoices(lang);
    if (!optsForLang.some((o) => o.id === voiceId)) {
      const next = resolveVoiceId(lang);
      setVoiceIdState(next);
      // Don't persist — the user's *explicit* choice (loadVoiceId)
      // remains intact for if they switch back. We just present a
      // sensible default for the new language.
    }
  }, [lang, mounted, voiceId]);

  // Outside-click + Escape to close, mirroring the LangPicker UX.
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

  // Stop any preview when the popover closes.
  useEffect(() => {
    if (open) return;
    cancelPreviewRef.current?.();
    cancelPreviewRef.current = null;
    setPreviewing(null);
  }, [open]);

  function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    saveVoiceEnabled(next);
    if (!next) {
      // Going OFF: kill anything currently playing immediately.
      stopAllSpeech();
    }
  }

  function pickVoice(opt: VoiceOption) {
    setVoiceIdState(opt.id);
    saveVoiceId(opt.id);
  }

  function previewVoice(opt: VoiceOption, currentLang: Lang) {
    cancelPreviewRef.current?.();
    setPreviewing(opt.id);
    const sample = SAMPLE_LINE[currentLang];
    const cancel = ttsSpeak(sample, {
      voiceId: opt.id,
      lang: currentLang,
      onEnd: () => {
        setPreviewing((cur) => (cur === opt.id ? null : cur));
      },
    });
    cancelPreviewRef.current = cancel;
  }

  const triggerLabel = enabled ? "VOICE" : "MUTED";
  const opts = listVoices(lang);
  const activeOpt = opts.find((o) => o.id === voiceId) ?? opts[0];

  return (
    <div
      ref={wrapperRef}
      className="relative inline-flex items-center"
      style={{ fontFeatureSettings: '"tnum"' }}
      dir="ltr"
    >
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Voice controls"
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
        {enabled ? (
          <SpeakerIcon className="w-3.5 h-3.5 text-sage-700" />
        ) : (
          <MutedIcon className="w-3.5 h-3.5 text-sage-700" />
        )}
        <span className="ml-0.5">{mounted ? triggerLabel : "VOICE"}</span>
        <ChevronIcon
          className={`w-3 h-3 transition-transform duration-150 ${
            open ? "rotate-180" : ""
          } text-sage-700/70`}
        />
      </button>

      {open && mounted && (
        <div
          role="dialog"
          aria-label="Voice settings"
          className={[
            "absolute z-[60] top-[calc(100%+6px)] right-0",
            "w-[260px] rounded-xl",
            "border border-sage-500/25 bg-cream-50/95 backdrop-blur-md",
            "shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)]",
            "p-2",
          ].join(" ")}
        >
          {/* ON/OFF row. */}
          <div className="flex items-center justify-between px-2 py-1.5 mb-1 rounded-lg">
            <div className="text-[10.5px] font-mono tracking-[0.2em] uppercase text-sage-700/80">
              echo&apos;s voice
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={toggleEnabled}
              className={[
                "relative inline-flex items-center h-5 w-9 rounded-full transition-colors",
                enabled
                  ? "bg-emerald-500/40 border border-emerald-500/50"
                  : "bg-sage-500/15 border border-sage-500/30",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-block w-3.5 h-3.5 rounded-full bg-cream-50 shadow-sm transition-transform",
                  enabled ? "translate-x-[18px]" : "translate-x-[3px]",
                ].join(" ")}
              />
            </button>
          </div>

          {/* Divider. */}
          <div className="h-px bg-sage-500/15 mx-2 my-1" />

          {/* Style list. Greyed out when voice is OFF. */}
          <div
            className={[
              "px-1 py-1 transition-opacity",
              enabled ? "opacity-100" : "opacity-40 pointer-events-none",
            ].join(" ")}
          >
            <div className="px-1.5 mb-1 text-[10px] font-mono tracking-[0.2em] uppercase text-sage-700/60">
              style — {lang.toUpperCase()}
            </div>
            {opts.map((opt) => {
              const active = opt.id === voiceId;
              const isPreviewing = previewing === opt.id;
              return (
                <div
                  key={opt.id}
                  className={[
                    "flex items-center gap-2 px-1.5 py-1.5 rounded-lg",
                    "transition-colors duration-100",
                    active
                      ? "bg-emerald-500/10"
                      : "hover:bg-sage-500/10",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => pickVoice(opt)}
                    className="flex-1 flex items-center gap-2.5 text-left"
                    aria-pressed={active}
                  >
                    <span
                      className={[
                        "inline-flex items-center justify-center min-w-[2.5rem] px-1 py-0.5 rounded-md",
                        "text-[10.5px] font-mono tracking-[0.18em] uppercase",
                        active
                          ? "bg-emerald-500/20 text-emerald-800 border border-emerald-500/40"
                          : "bg-sage-500/10 text-sage-700 border border-sage-500/20",
                      ].join(" ")}
                    >
                      {styleLabel(opt.style)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm leading-tight text-sage-900 capitalize">
                        {opt.style}
                      </span>
                      <span className="block text-[10px] text-sage-700/70 truncate">
                        {opt.speaker} · {opt.description}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => previewVoice(opt, lang)}
                    aria-label={`Preview ${opt.style} voice`}
                    className={[
                      "shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full",
                      "border transition-colors",
                      isPreviewing
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-800"
                        : "bg-cream-50 border-sage-500/25 text-sage-700 hover:border-sage-500/50",
                    ].join(" ")}
                  >
                    {isPreviewing ? (
                      <PauseIcon className="w-3 h-3" />
                    ) : (
                      <PlayIcon className="w-3 h-3" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footnote. */}
          <div className="px-2 py-1 mt-1 text-[9.5px] font-mono tracking-[0.2em] uppercase text-sage-700/45">
            powered by elevenlabs · {activeOpt?.speaker ?? "—"}
          </div>
        </div>
      )}
    </div>
  );
}

/** Per-language sample line played by the preview button. Short
 *  enough to feel snappy, long enough to convey the voice's tone. */
const SAMPLE_LINE: Record<Lang, string> = {
  en: "I'm here. Take your time. There's no rush tonight.",
  fr: "Je suis là. Prends ton temps. Rien ne presse ce soir.",
  ar: "أنا هنا. خذ وقتك. لا تستعجل الليلة.",
};

function styleLabel(style: string): string {
  // Keep labels to ≤4 chars so the chip stays compact.
  switch (style) {
    case "calm":
      return "CALM";
    case "soft":
      return "SOFT";
    case "energetic":
      return "ENRG";
    case "professional":
      return "PRO";
    default:
      return style.slice(0, 4).toUpperCase();
  }
}

function SpeakerIcon({ className = "" }: { className?: string }) {
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
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function MutedIcon({ className = "" }: { className?: string }) {
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
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M22 9l-6 6" />
      <path d="m16 9 6 6" />
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

function PlayIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}
