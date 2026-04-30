"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/use-lang";
import { t, type StringKey } from "@/lib/strings";
import { timeOfDaySlot, type TimeOfDaySlot } from "@/lib/prompts";
import type { Lang } from "@/lib/i18n";

/**
 * Ambient "magnetism" strip that sits above the landing-page hero.
 *
 *   1. A live "{N} people whispered to Echo tonight." badge — real
 *      session count from /api/public-stats, refreshed every 5s.
 *      The point isn't analytics, it's the implicit invitation:
 *      "you are not alone in choosing to talk to her."
 *
 *   2. A redacted peak_quote from the most recent confession,
 *      stripped of capitalised tokens server-side. "someone, 4m
 *      ago: ʻ___ told no one else this.ʼ" Lands the thesis
 *      (every confession is harvested) before the user has even
 *      started a session — and rewards a return visit because the
 *      ticker keeps changing.
 *
 *   3. A time-of-day mini-kicker that mirrors Echo's in-session
 *      tone-awareness ("it's late. she's still here." at 1am vs
 *      "good morning. she remembered." at 9am). The marketing
 *      page now lands in the same emotional key the conversation
 *      will be in.
 *
 * Everything degrades to nothing if `/api/public-stats` is offline
 * or returns zeros, so a fresh deploy with an empty database
 * doesn't show a confusing "0 people whispered" line.
 */

type PublicStats = {
  tonightCount: number;
  totalCount: number;
  lastWhisper: { text: string; ageSec: number } | null;
};

const KICKER_KEY: Record<TimeOfDaySlot, StringKey> = {
  dead_of_night: "home.kicker.deadOfNight",
  morning: "home.kicker.morning",
  afternoon: "home.kicker.afternoon",
  evening: "home.kicker.evening",
  late_night: "home.kicker.lateNight",
};

function formatAgo(ageSec: number, lang: Lang): string {
  if (ageSec < 60) return t("home.whisper.justNow", lang);
  const minutes = Math.floor(ageSec / 60);
  if (minutes < 60) {
    return t("home.whisper.minAgo", lang).replace("{n}", String(minutes));
  }
  const hours = Math.floor(minutes / 60);
  return t("home.whisper.hAgo", lang).replace("{n}", String(hours));
}

export function LandingMagnetism() {
  const { lang } = useLang();
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [slot, setSlot] = useState<TimeOfDaySlot | null>(null);

  // Time-of-day kicker is computed client-side from the visitor's
  // local clock, then rerun every minute so a tab left open across
  // the morning/afternoon boundary updates without a refresh.
  useEffect(() => {
    setSlot(timeOfDaySlot(new Date()));
    const handle = setInterval(() => setSlot(timeOfDaySlot(new Date())), 60_000);
    return () => clearInterval(handle);
  }, []);

  // Public stats poll. 5s cadence matches the route's revalidate
  // window; faster wouldn't gain anything except Supabase load.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/public-stats", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as PublicStats;
        if (!cancelled) setStats(json);
      } catch {
        /* swallow — ambient surface, never error-noisy */
      }
    };
    tick();
    const handle = setInterval(tick, 5_000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, []);

  const kickerText = slot ? t(KICKER_KEY[slot], lang) : null;

  // Format the tonight-count badge. Hide it entirely on zero so a
  // fresh / unconfigured deploy doesn't render a confusing "0
  // people whispered" line.
  const tonightLabel = (() => {
    if (!stats || stats.tonightCount <= 0) return null;
    if (stats.tonightCount === 1) return t("home.tonight.badgeOne", lang);
    return t("home.tonight.badge", lang).replace(
      "{n}",
      stats.tonightCount.toLocaleString(lang === "ar" ? "ar" : undefined)
    );
  })();

  const whisperLine = (() => {
    if (!stats?.lastWhisper) return null;
    const ago = formatAgo(stats.lastWhisper.ageSec, lang);
    const label = t("home.whisper.label", lang).replace("{ago}", ago);
    return { label, text: stats.lastWhisper.text };
  })();

  if (!kickerText && !tonightLabel && !whisperLine) return null;

  return (
    <div className="mx-auto max-w-3xl mb-6 md:mb-8 flex flex-col items-center gap-2 text-center">
      {kickerText && (
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
      )}
      {tonightLabel && (
        <div className="text-xs md:text-sm text-sage-700/80 font-medium">
          {tonightLabel}
        </div>
      )}
      {whisperLine && (
        <div className="text-[12px] md:text-[13px] text-sage-700/70 italic max-w-xl truncate">
          <span className="text-sage-700/55 mr-1">{whisperLine.label}</span>
          <span>&ldquo;{whisperLine.text}&rdquo;</span>
        </div>
      )}
    </div>
  );
}
