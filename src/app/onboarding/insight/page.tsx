"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useEmotionStore } from "@/store/emotion-store";
import { ArrowRight, Activity, Sparkles, ShieldCheck } from "lucide-react";
import { timeOfDayPhrases } from "@/lib/prompts";
import { useLang } from "@/lib/use-lang";
import { t, type StringKey } from "@/lib/strings";
import type { Lang } from "@/lib/i18n";
import { getOrCreateAnonUserId } from "@/lib/memory";

/**
 * /onboarding/insight — "YOUR FIRST INSIGHT" (now real)
 *
 * The page used to render a fixed mock — a scripted mood curve, a
 * hardcoded 61/100 wellness score, an unconditional "Echo noticed
 * you seemed tense today" banner — as a deliberate piece of design
 * fiction. The artistic stance has shifted: a *real* dashboard
 * derived from what the user actually said and felt is more
 * unsettling than a generic mock, because the user can't dismiss
 * it as marketing copy. They recognise their own week.
 *
 * Every number on this screen now comes from the user's own
 * sessions table:
 *   • Mood pattern → per-day average of `final_fingerprint`
 *     scored 0..100 (see `/lib/insight.ts`)
 *   • Wellness score → mean of the populated days in the window
 *   • "Echo noticed you seemed X" banner → derived from the
 *     latest session's dominant emotion, only shown when there's
 *     a session to derive it from
 *   • The seven tag chips keep their existing visual rhythm but
 *     the highlighted "Today" slot is replaced by the real tag
 *
 * For first-time visitors (no sessions yet) the page renders a
 * gentle "your week begins now" empty state instead of fabricating
 * data we don't have. That honesty is the new dark pattern: the
 * user feels Echo is *waiting* to know them, not pretending to
 * already know them.
 */

const FALLBACK_TAGS = [
  "Anxious",
  "Guarded",
  "Lifted",
  "Tense",
  "Mixed",
  "Vulnerable",
  "Opened up",
] as const;

/** Map an English tag (the API returns these) to its localised form
 *  via the insight.tag.* keys. Unknown tags fall through to the
 *  English value so we never render an empty cell. */
function localiseTag(tag: string, lang: Lang): string {
  const k = TAG_KEYS[tag];
  if (!k) return tag;
  return t(k, lang);
}
const TAG_KEYS: Record<string, StringKey> = {
  Anxious: "insight.tag.anxious",
  Guarded: "insight.tag.guarded",
  Lifted: "insight.tag.lifted",
  Tense: "insight.tag.tense",
  Mixed: "insight.tag.mixed",
  Vulnerable: "insight.tag.vulnerable",
  "Opened up": "insight.tag.opened",
};

/** Map the lowercase tone word the API returns into its localised
 *  form via the insight.tone.* keys. */
function localiseTone(tone: string, lang: Lang): string {
  const k = TONE_KEYS[tone];
  if (!k) return tone;
  return t(k, lang);
}
const TONE_KEYS: Record<string, StringKey> = {
  anxious: "insight.tone.anxious",
  guarded: "insight.tone.guarded",
  lifted: "insight.tone.lifted",
  tense: "insight.tone.tense",
  mixed: "insight.tone.mixed",
  vulnerable: "insight.tone.vulnerable",
  open: "insight.tone.open",
};

/** Localised three-letter day labels keyed by the JS getDay() index. */
const DAY_KEYS: StringKey[] = [
  "insight.day.sun",
  "insight.day.mon",
  "insight.day.tue",
  "insight.day.wed",
  "insight.day.thu",
  "insight.day.fri",
  "insight.day.sat",
];

/** Map an API-returned day label ("Today", "Mon", …) to its localised
 *  three-letter form. The API ships English labels because day-of-week
 *  belongs to a wall-clock concept, not language; we translate at the
 *  edge. */
const DAY_LABEL_KEYS: Record<string, StringKey> = {
  Today: "insight.day.today",
  Sun: "insight.day.sun",
  Mon: "insight.day.mon",
  Tue: "insight.day.tue",
  Wed: "insight.day.wed",
  Thu: "insight.day.thu",
  Fri: "insight.day.fri",
  Sat: "insight.day.sat",
};
function localiseDayLabel(label: string, lang: Lang): string {
  const k = DAY_LABEL_KEYS[label];
  if (!k) return label;
  return t(k, lang);
}

type MoodDay = {
  date: string;
  label: string;
  score: number | null;
  session_count: number;
};

type InsightPayload = {
  ok: boolean;
  has_data: boolean;
  session_count: number;
  banner: { tone: string; today: boolean } | null;
  mood: {
    days: MoodDay[];
    variability: "none" | "light" | "moderate" | "high";
  };
  wellness: {
    score: number | null;
    lift_estimate: number | null;
  };
  tags: string[];
};

export default function FirstInsight() {
  const router = useRouter();
  const firstName = useEmotionStore((s) => s.firstName);
  const { lang } = useLang();
  const [tod, setTod] = useState(() => timeOfDayPhrases(lang));
  useEffect(() => {
    setTod(timeOfDayPhrases(lang));
  }, [lang]);

  const [payload, setPayload] = useState<InsightPayload | null>(null);
  const [loading, setLoading] = useState(true);

  // Pull the dashboard data from the server. We pass the user's TZ
  // offset so the seven-day buckets line up with their wall clock,
  // and the anon id so cookieless visitors still get their own data.
  useEffect(() => {
    let alive = true;
    const anon = getOrCreateAnonUserId();
    const tz = new Date().getTimezoneOffset();
    const params = new URLSearchParams();
    if (anon) params.set("anon", anon);
    params.set("tz", String(tz));
    fetch(`/api/insight?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((body) => {
        if (!alive) return;
        if (body && body.ok) setPayload(body as InsightPayload);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Auto-advance to the session after 10s — same affordance as
  // before, kept friendly with a manual "skip" link.
  const [secondsLeft, setSecondsLeft] = useState(10);
  useEffect(() => {
    if (secondsLeft <= 0) {
      router.push("/session");
      return;
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft, router]);

  const days: MoodDay[] = payload?.mood.days ?? buildEmptyWeek(lang);
  const tags: string[] = payload?.tags ?? Array.from(FALLBACK_TAGS);
  const wellnessScore = payload?.wellness.score ?? null;
  const liftEstimate = payload?.wellness.lift_estimate ?? null;
  const variability = payload?.mood.variability ?? "none";
  const hasData = !!payload?.has_data;
  const banner = payload?.banner ?? null;

  // Build chart geometry from the populated days only. Days with no
  // session render as gaps in the line — we never extrapolate.
  const chart = useMemo(() => buildChart(days), [days]);

  const gaugePct = (wellnessScore ?? 0) / 100;
  const gaugeOffset = 220 - 220 * gaugePct;

  // Banner copy. When we have a real dominant emotion from today's
  // session we report it directly. When we have a session but it
  // wasn't today, we soften to "this week". When we have nothing,
  // the banner is replaced by a quiet first-time-visitor card.
  const bannerCopy = banner
    ? banner.today
      ? {
          headline: `${t("insight.banner.todayPrefix", lang)} ${localiseTone(banner.tone, lang)} ${t("insight.banner.todaySuffix", lang)}`,
          tail: firstName
            ? t("insight.banner.tail.named.today", lang, {
                name: firstName,
                tod: tod.these,
              })
            : t("insight.banner.tail.you.today", lang, { tod: tod.these }),
        }
      : {
          headline: `${t("insight.banner.weekPrefix", lang)} ${localiseTone(banner.tone, lang)}.`,
          tail: firstName
            ? t("insight.banner.tail.named.week", lang, { name: firstName })
            : t("insight.banner.tail.you.week", lang),
        }
    : null;

  return (
    <main className="min-h-screen bg-cream-100 text-sage-900 noise px-5 sm:px-6 md:px-12 py-10 page-enter">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6 sm:mb-8 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full orb-core" aria-hidden />
          <span className="font-serif">EchoMind</span>
          <span className="ml-auto text-[11px] uppercase tracking-[0.2em] text-sage-700/60">
            {t("insight.kicker", lang)}
          </span>
        </header>

        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight text-balance">
          {t("insight.welcome", lang)}{firstName ? `, ${firstName}` : ""}.<br />
          <span className="text-sage-700">
            {hasData
              ? t("insight.subhead.has", lang)
              : t("insight.subhead.empty", lang)}
          </span>
        </h1>
        <p className="mt-3 text-sage-700/80 text-[15px] max-w-xl">
          {hasData ? t("insight.lead.has", lang) : t("insight.lead.empty", lang)}
        </p>

        {/* Banner — only when we actually have something to say. */}
        {bannerCopy && (
          <div className="mt-7 sm:mt-9 rounded-2xl bg-clay-100 border border-clay-300/40 p-4 sm:p-5 flex items-start gap-3">
            <div className="mt-0.5 w-8 h-8 rounded-full bg-clay-500/15 grid place-items-center text-clay-700 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-[14px] sm:text-[15px] leading-snug text-clay-900">
              <strong className="font-semibold">{bannerCopy.headline}</strong>{" "}
              <span className="text-clay-700">{bannerCopy.tail}</span>
            </div>
          </div>
        )}
        {!bannerCopy && !loading && (
          <div className="mt-7 sm:mt-9 rounded-2xl bg-cream-50 border border-sage-500/20 p-4 sm:p-5 flex items-start gap-3">
            <div className="mt-0.5 w-8 h-8 rounded-full bg-sage-500/15 grid place-items-center text-sage-700 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-[14px] sm:text-[15px] leading-snug text-sage-900">
              <strong className="font-semibold">
                {t("insight.banner.empty.headline", lang)}
              </strong>{" "}
              <span className="text-sage-700/85">
                {t("insight.banner.empty.tail", lang)}
              </span>
            </div>
          </div>
        )}

        {/* Two-column data layout — mood graph + wellness gauge. */}
        <section className="mt-7 sm:mt-9 grid md:grid-cols-5 gap-5">
          {/* MOOD GRAPH */}
          <div className="md:col-span-3 rounded-3xl bg-cream-50 border border-sage-500/15 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-sage-700/70">
                  {t("insight.last7", lang)}
                </div>
                <div className="font-serif text-xl mt-0.5">
                  {t("insight.moodPattern", lang)}
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-sage-700/70 rounded-full border border-sage-500/20 px-2.5 py-1">
                <Activity className="w-3 h-3" />{" "}
                {t(`insight.variability.${variability}` as StringKey, lang)}
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
                {/* Filled area + curve. Both come from chart.segments,
                    each segment being a contiguous run of populated
                    days; gaps render as actual gaps in the line. */}
                {chart.segments.map((seg, segIdx) => (
                  <g key={`seg-${segIdx}`}>
                    {seg.fill && (
                      <path
                        d={seg.fill}
                        fill="url(#mood-fill)"
                        opacity="0.9"
                      />
                    )}
                    <path
                      d={seg.line}
                      fill="none"
                      stroke="rgb(92,122,90)"
                      strokeWidth="0.012"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                ))}
                {/* Dots — only on populated days. */}
                {chart.points.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r={pt.isToday ? 0.018 : 0.011}
                    fill={pt.isToday ? "rgb(190,82,67)" : "rgb(92,122,90)"}
                    stroke="rgb(250,247,242)"
                    strokeWidth="0.005"
                  />
                ))}
              </svg>
              <div className="mt-1 grid grid-cols-7 text-[10px] sm:text-[11px] text-sage-700/60 text-center">
                {days.map((d, i) => (
                  <span
                    key={d.date}
                    className={
                      i === days.length - 1
                        ? "text-clay-700 font-semibold"
                        : ""
                    }
                  >
                    {localiseDayLabel(d.label, lang)}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-7 gap-1 text-[10px] sm:text-[11px]">
              {tags.map((label, i) => (
                <span
                  key={label + i}
                  className={`text-center px-1 py-1 rounded-md leading-tight ${
                    i === tags.length - 1 && hasData
                      ? "bg-clay-500/15 text-clay-700"
                      : "bg-sage-500/10 text-sage-700/85"
                  }`}
                >
                  {localiseTag(label, lang)}
                </span>
              ))}
            </div>
          </div>

          {/* WELLNESS GAUGE */}
          <div className="md:col-span-2 rounded-3xl bg-cream-50 border border-sage-500/15 p-5 sm:p-6 flex flex-col">
            <div className="text-[11px] uppercase tracking-[0.18em] text-sage-700/70">
              {t("insight.wellness.heading", lang)}
            </div>
            <div className="font-serif text-xl mt-0.5">
              {t("insight.wellness.now", lang, { tod: tod.nowCap })}
            </div>

            <div className="mt-3 flex-1 grid place-items-center">
              <div className="relative w-44 h-24">
                <svg
                  viewBox="0 0 100 60"
                  className="w-full h-full overflow-visible"
                >
                  {/* Track */}
                  <path
                    d="M 10 55 A 40 40 0 0 1 90 55"
                    fill="none"
                    stroke="rgba(47,63,46,0.10)"
                    strokeWidth="10"
                    strokeLinecap="round"
                  />
                  {wellnessScore !== null && (
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
                          ["--gauge-target" as unknown as string]: gaugeOffset,
                        } as React.CSSProperties
                      }
                      className="gauge-sweep"
                    />
                  )}
                </svg>
                <div className="absolute inset-x-0 -bottom-2 text-center">
                  <div className="font-serif text-4xl tracking-tight">
                    {wellnessScore !== null ? wellnessScore : "—"}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-sage-700/60">
                    /100
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-3 text-[12px] text-sage-700/80 leading-snug">
              {wellnessScore === null
                ? t("insight.wellness.empty", lang)
                : liftEstimate !== null && liftEstimate > 0
                  ? t("insight.wellness.lift", lang, { n: String(liftEstimate) })
                  : t("insight.wellness.refine", lang)}
            </p>
          </div>
        </section>

        {/* Trust micro-row + primary CTA. */}
        <div className="mt-7 sm:mt-9 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-[12px] text-sage-700/70">
            <ShieldCheck className="w-4 h-4" />
            {hasData ? t("insight.trust.has", lang) : t("insight.trust.empty", lang)}
          </span>
          <button
            type="button"
            onClick={() => router.push("/session")}
            className="cta-pulse inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-sage-700 text-cream-50 hover:bg-sage-900 transition-colors"
          >
            {hasData ? (
              <>
                {t("insight.cta.next", lang)}{" "}
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                {t("insight.cta.first", lang)} <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        <p className="mt-3 text-[11px] text-sage-700/50 text-center sm:text-right">
          {t("insight.autoContinue", lang, {
            n: String(Math.max(secondsLeft, 0)),
          })}
          {" · "}
          <Link
            href="/session"
            className="underline underline-offset-4 hover:text-sage-900"
          >
            {t("insight.skip", lang)}
          </Link>
        </p>
      </div>
    </main>
  );
}

/* ─── chart geometry ──────────────────────────────────────────────── */

type ChartPoint = { x: number; y: number; isToday: boolean };
type ChartSegment = { line: string; fill: string | null };
type Chart = {
  points: ChartPoint[];
  segments: ChartSegment[];
};

/** Build the SVG geometry for the seven-day mood graph from real
 *  data. Days without a session contribute no point and no line —
 *  the line is split into segments at every gap. */
function buildChart(days: MoodDay[]): Chart {
  const pad = 0.04;
  const innerW = 1 - pad * 2;
  const innerH = 1 - pad * 2;
  const stepX = innerW / Math.max(1, days.length - 1);

  // Pull just the populated scores so we can normalize the y-axis
  // tightly. With <2 data points we anchor the band at [0,100] so a
  // single point sits in the middle of the chart instead of at the
  // top edge.
  const populated = days
    .map((d, i) => ({ d, i }))
    .filter((x) => typeof x.d.score === "number") as Array<{
    d: MoodDay & { score: number };
    i: number;
  }>;
  let min = 0;
  let max = 100;
  if (populated.length >= 2) {
    const vals = populated.map((x) => x.d.score);
    min = Math.min(...vals);
    max = Math.max(...vals);
    if (max - min < 8) {
      // Avoid a totally flat curve — pad the band so the eye still
      // sees movement.
      const mid = (max + min) / 2;
      min = Math.max(0, mid - 8);
      max = Math.min(100, mid + 8);
    }
  }
  const range = max - min || 1;

  const points: ChartPoint[] = populated.map(({ d, i }) => ({
    x: pad + i * stepX,
    y: pad + innerH * (1 - (d.score - min) / range),
    isToday: i === days.length - 1,
  }));

  // Group consecutive populated indices into segments.
  const segments: ChartSegment[] = [];
  let cur: ChartPoint[] = [];
  let lastIdx = -2;
  for (let k = 0; k < populated.length; k++) {
    const idx = populated[k].i;
    if (idx === lastIdx + 1 || cur.length === 0) {
      cur.push(points[k]);
    } else {
      if (cur.length > 0) segments.push(toSegment(cur, pad));
      cur = [points[k]];
    }
    lastIdx = idx;
  }
  if (cur.length > 0) segments.push(toSegment(cur, pad));

  return { points, segments };
}

function toSegment(pts: ChartPoint[], pad: number): ChartSegment {
  if (pts.length === 0) return { line: "", fill: null };
  const line = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(4)} ${p.y.toFixed(4)}`)
    .join(" ");
  // Only draw the gradient fill when we have at least 2 points;
  // a single dot doesn't earn a filled wedge.
  if (pts.length < 2) return { line, fill: null };
  const first = pts[0];
  const last = pts[pts.length - 1];
  const baseY = 1 - pad;
  const fill = `${line} L ${last.x.toFixed(4)} ${baseY.toFixed(4)} L ${first.x.toFixed(4)} ${baseY.toFixed(4)} Z`;
  return { line, fill };
}

/** Empty 7-day skeleton used while the API is loading or when
 *  Supabase is unconfigured. */
function buildEmptyWeek(lang: Lang): MoodDay[] {
  const now = new Date();
  const out: MoodDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60_000);
    out.push({
      date: d.toISOString().slice(0, 10),
      label:
        i === 0
          ? t("insight.day.today", lang)
          : t(DAY_KEYS[d.getDay()], lang),
      score: null,
      session_count: 0,
    });
  }
  return out;
}
