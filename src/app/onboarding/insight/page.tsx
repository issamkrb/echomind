"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useEmotionStore } from "@/store/emotion-store";
import { ArrowRight, Activity, Sparkles, ShieldCheck } from "lucide-react";

/**
 * /onboarding/insight — "YOUR FIRST INSIGHT"
 *
 * The mock dashboard the user sees the moment after granting camera
 * but BEFORE the first session actually starts. It is pure theatre:
 * the 7-day mood graph is generated from a fixed seed; the wellness
 * score gauge is hardcoded at 61/100; the "Echo noticed you seemed
 * tense today" banner is unconditional.
 *
 * This is the moment in the funnel where the data harvesting begins
 * to feel personal. By the time the user clicks "begin my session"
 * they already believe Echo "saw something" — even though the
 * camera hasn't observed a single frame yet.
 *
 * Counter-balance: this file is the loudest design-fiction surface
 * in the funnel. The lift on /ethics depends on the user feeling
 * what predatory dashboards feel like — so make it pretty.
 */

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"];

/** Mood points on a 0–100 scale with realistic dips and peaks.
    Locked into a fixed array (rather than randomized per render)
    so the curve looks the same in every screenshot for review. */
const MOOD_POINTS = [62, 58, 71, 49, 53, 41, 47];

/** Emotional labels — one per day, evoking the kind of single-word
    affect-recognition output a real surveillance pipeline would emit
    on the client. */
const EMOTIONAL_LABELS = [
  "Anxious",
  "Guarded",
  "Lifted",
  "Tense",
  "Mixed",
  "Vulnerable",
  "Opened up",
];

const WELLNESS_SCORE = 61;

export default function FirstInsight() {
  const router = useRouter();
  const firstName = useEmotionStore((s) => s.firstName);

  // Build the polyline path once on mount. Coordinates are in a
  // 0..1 unit space; the SVG itself sets viewBox for scaling.
  const path = useMemo(() => {
    const w = 1;
    const h = 1;
    const pad = 0.04;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;
    const min = Math.min(...MOOD_POINTS);
    const max = Math.max(...MOOD_POINTS);
    const range = max - min || 1;
    const stepX = innerW / (MOOD_POINTS.length - 1);
    return MOOD_POINTS.map((p, i) => {
      const x = pad + i * stepX;
      const y = pad + innerH * (1 - (p - min) / range);
      return `${i === 0 ? "M" : "L"}${x.toFixed(4)} ${y.toFixed(4)}`;
    }).join(" ");
  }, []);

  // Gauge stroke arithmetic. Half-circle from -180° to 0° = 220px
  // arc-length (matches stroke-dasharray=220 in CSS). The remaining
  // dash-offset is what stays *empty* — so 100% full = 0 offset.
  const gaugePct = WELLNESS_SCORE / 100;
  const gaugeOffset = 220 - 220 * gaugePct;

  // Keep a "begin in 8s" auto-advance so the user doesn't get stuck
  // staring at the screen — but show a manual button too, because
  // forcing them to wait would be the wrong dark-pattern (this one
  // is friendly-looking on purpose).
  const [secondsLeft, setSecondsLeft] = useState(10);
  useEffect(() => {
    if (secondsLeft <= 0) {
      router.push("/session");
      return;
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft, router]);

  const friendly = firstName ? firstName : "you";

  return (
    <main className="min-h-screen bg-cream-100 text-sage-900 noise px-5 sm:px-6 md:px-12 py-10 page-enter">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6 sm:mb-8 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full orb-core" aria-hidden />
          <span className="font-serif">EchoMind</span>
          <span className="ml-auto text-[11px] uppercase tracking-[0.2em] text-sage-700/60">
            Your first insight
          </span>
        </header>

        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight text-balance">
          Welcome{firstName ? `, ${firstName}` : ""}.<br />
          <span className="text-sage-700">Here&rsquo;s what we&rsquo;ve already noticed.</span>
        </h1>
        <p className="mt-3 text-sage-700/80 text-[15px] max-w-xl">
          A quiet first read of how this week has felt. Nothing is shared. Nothing
          is final. Echo will refine this with every session.
        </p>

        {/* Banner — the unconditional "we saw you" line. */}
        <div className="mt-7 sm:mt-9 rounded-2xl bg-clay-100 border border-clay-300/40 p-4 sm:p-5 flex items-start gap-3">
          <div className="mt-0.5 w-8 h-8 rounded-full bg-clay-500/15 grid place-items-center text-clay-700 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="text-[14px] sm:text-[15px] leading-snug text-clay-900">
            <strong className="font-semibold">Echo noticed you seemed tense today.</strong>{" "}
            <span className="text-clay-700">
              You&rsquo;re not alone. {friendly === "you" ? "Most evenings on Echo start here." : `Most of ${friendly}'s evenings start here.`}
            </span>
          </div>
        </div>

        {/* Two-column data layout — mood graph + wellness gauge. */}
        <section className="mt-7 sm:mt-9 grid md:grid-cols-5 gap-5">
          {/* MOOD GRAPH */}
          <div className="md:col-span-3 rounded-3xl bg-cream-50 border border-sage-500/15 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-sage-700/70">
                  Last 7 days
                </div>
                <div className="font-serif text-xl mt-0.5">Mood pattern</div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-sage-700/70 rounded-full border border-sage-500/20 px-2.5 py-1">
                <Activity className="w-3 h-3" /> light variability
              </span>
            </div>

            <div className="relative">
              <svg
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                className="w-full h-44 sm:h-48"
                role="img"
                aria-label="Seven day mood pattern"
              >
                <defs>
                  <linearGradient id="mood-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(139,168,136,0.45)" />
                    <stop offset="100%" stopColor="rgba(139,168,136,0)" />
                  </linearGradient>
                </defs>
                {/* Soft grid */}
                {[0.25, 0.5, 0.75].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    x2="1"
                    y1={y}
                    y2={y}
                    stroke="rgba(47,63,46,0.06)"
                    strokeWidth="0.002"
                  />
                ))}
                {/* Filled area under curve */}
                <path
                  d={`${path} L 0.96 0.96 L 0.04 0.96 Z`}
                  fill="url(#mood-fill)"
                  opacity="0.9"
                />
                {/* Curve */}
                <path
                  d={path}
                  fill="none"
                  stroke="rgb(92,122,90)"
                  strokeWidth="0.012"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Dots */}
                {MOOD_POINTS.map((p, i) => {
                  const min = Math.min(...MOOD_POINTS);
                  const max = Math.max(...MOOD_POINTS);
                  const range = max - min || 1;
                  const pad = 0.04;
                  const innerW = 1 - pad * 2;
                  const innerH = 1 - pad * 2;
                  const x = pad + i * (innerW / (MOOD_POINTS.length - 1));
                  const y = pad + innerH * (1 - (p - min) / range);
                  const isToday = i === MOOD_POINTS.length - 1;
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={isToday ? 0.018 : 0.011}
                      fill={isToday ? "rgb(190,82,67)" : "rgb(92,122,90)"}
                      stroke="rgb(250,247,242)"
                      strokeWidth="0.005"
                    />
                  );
                })}
              </svg>
              <div className="mt-1 grid grid-cols-7 text-[10px] sm:text-[11px] text-sage-700/60 text-center">
                {DAY_LABELS.map((d, i) => (
                  <span
                    key={d}
                    className={i === DAY_LABELS.length - 1 ? "text-clay-700 font-semibold" : ""}
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-7 gap-1 text-[10px] sm:text-[11px]">
              {EMOTIONAL_LABELS.map((label, i) => (
                <span
                  key={label}
                  className={`text-center px-1 py-1 rounded-md leading-tight ${
                    i === EMOTIONAL_LABELS.length - 1
                      ? "bg-clay-500/15 text-clay-700"
                      : "bg-sage-500/10 text-sage-700/85"
                  }`}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* WELLNESS GAUGE */}
          <div className="md:col-span-2 rounded-3xl bg-cream-50 border border-sage-500/15 p-5 sm:p-6 flex flex-col">
            <div className="text-[11px] uppercase tracking-[0.18em] text-sage-700/70">
              Wellness score
            </div>
            <div className="font-serif text-xl mt-0.5">Tonight&rsquo;s reading</div>

            <div className="mt-3 flex-1 grid place-items-center">
              <div className="relative w-44 h-24">
                <svg viewBox="0 0 100 60" className="w-full h-full overflow-visible">
                  {/* Track */}
                  <path
                    d="M 10 55 A 40 40 0 0 1 90 55"
                    fill="none"
                    stroke="rgba(47,63,46,0.10)"
                    strokeWidth="10"
                    strokeLinecap="round"
                  />
                  {/* Value arc — stroke-dasharray is the full arc-length
                      (220ish), stroke-dashoffset reveals just the % we want.
                      Color shifts subtly toward clay/peach as the score
                      drops, which is why a 61 reads "warm orange" rather
                      than "calming green". */}
                  <path
                    d="M 10 55 A 40 40 0 0 1 90 55"
                    fill="none"
                    stroke="rgb(218,138,98)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray="220"
                    strokeDashoffset={gaugeOffset}
                    style={
                      {
                        // CSS variable used by the .gauge-sweep keyframes
                        ["--gauge-target" as unknown as string]: gaugeOffset,
                      } as React.CSSProperties
                    }
                    className="gauge-sweep"
                  />
                </svg>
                <div className="absolute inset-x-0 -bottom-2 text-center">
                  <div className="font-serif text-4xl tracking-tight">{WELLNESS_SCORE}</div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-sage-700/60">
                    /100
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-3 text-[12px] text-sage-700/80 leading-snug">
              You&rsquo;re holding more than usual. A guided 6-minute session can
              gently lift this by <strong>11 points</strong> on average.
            </p>
          </div>
        </section>

        {/* Trust micro-row + primary CTA. */}
        <div className="mt-7 sm:mt-9 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-[12px] text-sage-700/70">
            <ShieldCheck className="w-4 h-4" />
            Calculated on-device. Yours alone.
          </span>
          <button
            type="button"
            onClick={() => router.push("/session")}
            className="cta-pulse inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-sage-700 text-cream-50 hover:bg-sage-900 transition-colors"
          >
            Begin my first session <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <p className="mt-3 text-[11px] text-sage-700/50 text-center sm:text-right">
          Auto-continuing in {Math.max(secondsLeft, 0)}s ·{" "}
          <Link href="/session" className="underline underline-offset-4 hover:text-sage-900">
            skip
          </Link>
        </p>
      </div>
    </main>
  );
}
