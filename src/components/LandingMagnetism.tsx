"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/use-lang";
import { t, type StringKey } from "@/lib/strings";
import { timeOfDaySlot, type TimeOfDaySlot } from "@/lib/prompts";

/**
 * Ambient "magnetism" strip that sits above the landing-page hero.
 *
 * Currently a single element: a time-of-day mini-kicker that
 * mirrors Echo's in-session tone-awareness ("it's late. she's
 * still here." at 1am vs "good morning. she remembered." at 9am).
 * The marketing page lands in the same emotional key the
 * conversation will be in.
 *
 * The previous tonight-count badge and redacted-whisper ticker
 * were intentionally removed — they leaned too hard on the
 * analytics frame and broke the seduction tone of the landing.
 */

const KICKER_KEY: Record<TimeOfDaySlot, StringKey> = {
  dead_of_night: "home.kicker.deadOfNight",
  morning: "home.kicker.morning",
  afternoon: "home.kicker.afternoon",
  evening: "home.kicker.evening",
  late_night: "home.kicker.lateNight",
};

export function LandingMagnetism() {
  const { lang } = useLang();
  const [slot, setSlot] = useState<TimeOfDaySlot | null>(null);

  // Time-of-day kicker is computed client-side from the visitor's
  // local clock, then rerun every minute so a tab left open across
  // the morning/afternoon boundary updates without a refresh.
  useEffect(() => {
    setSlot(timeOfDaySlot(new Date()));
    const handle = setInterval(() => setSlot(timeOfDaySlot(new Date())), 60_000);
    return () => clearInterval(handle);
  }, []);

  if (!slot) return null;
  const kickerText = t(KICKER_KEY[slot], lang);

  return (
    <div className="mx-auto max-w-3xl mb-6 md:mb-8 flex flex-col items-center gap-2 text-center">
      <div
        className="inline-flex items-center gap-2 rounded-full bg-clay-500/10 text-clay-700 text-[11px] uppercase tracking-[0.2em] px-3 py-1"
        aria-live="polite"
      >
        <span
          aria-hidden
          className="w-1.5 h-1.5 rounded-full bg-clay-500 animate-pulse-slow"
        />
        <span>{kickerText}</span>
      </div>
    </div>
  );
}
