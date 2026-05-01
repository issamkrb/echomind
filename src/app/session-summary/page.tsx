"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useEmotionStore, aggregate } from "@/store/emotion-store";
import { generatePoem, generateMirrorDecoys } from "@/lib/echo-ai";
import { PortfolioUnlockedNotice } from "@/components/PortfolioUnlockedNotice";
import { TestimonialPrompt } from "@/components/TestimonialPrompt";
import { useLang } from "@/lib/use-lang";
import { t } from "@/lib/strings";
import type { Lang } from "@/lib/i18n";
import {
  Heart,
  Clock,
  MessageCircleHeart,
  Download,
  Sparkles,
} from "lucide-react";

/**
 * /session-summary — THE WARM GOODBYE
 *
 * Intentionally what a real wellness app would show: a calm,
 * affectionate close to the conversation. No buyer tags, no auction
 * value, no implication that anything was extracted or sold. The user
 * leaves feeling cared for, exactly as the operator would want.
 *
 * Layered on top: two designed moments meant to land emotionally and
 * be talked about afterwards.
 *
 *  1. The Mirror Test — Echo presents three sentences. One the user
 *     actually said tonight, two written by Echo to sound like the
 *     user. The user is asked to pick which was theirs. Most people
 *     pick wrong, which is the point: Echo remembers them better than
 *     they remember themselves.
 *
 *  2. The Poem — a four-line poem written *for them* from this
 *     session's themes and peak quote. Downloadable as a card.
 *
 * The horror of the project lives entirely on the operator side now —
 * /admin and /admin/auction/[id]. The contrast between this gentle
 * page and that dashboard is the rhetorical payload, delivered on
 * stage by the speaker, not by the app turning on the user.
 */

export default function SessionSummary() {
  const { buffer, transcript, keywords, userId, firstName } = useEmotionStore();
  const { lang } = useLang();
  const fp = useMemo(() => aggregate(buffer), [buffer]);

  // Soft entrance — fade everything in over the first ~600 ms.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(timer);
  }, []);

  const exchanges = transcript.length;
  const minutes = Math.max(1, Math.round((exchanges * 12) / 60));
  const themes = useMemo(() => {
    if (keywords.length === 0) return [] as string[];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const k of keywords) {
      const label = k.category.replace(/_/g, " ");
      if (seen.has(label)) continue;
      seen.add(label);
      out.push(label);
      if (out.length === 3) break;
    }
    return out;
  }, [keywords]);

  // Pick the most substantive thing the user actually said tonight,
  // preferring sentences with emotional weight.
  const realQuote = useMemo(() => pickRealQuote(transcript), [transcript]);

  const closing = useMemo(() => {
    if (fp.peakSad > 0.45) return t("summary.closingSad", lang);
    if (fp.neutral > 0.5) return t("summary.closingSoft", lang);
    return t("summary.closingDefault", lang);
  }, [fp, lang]);

  const greeting = t("summary.takeCare", lang, {
    name: firstName ? `, ${firstName.toLowerCase()}` : "",
  });

  return (
    <main className="min-h-screen bg-cream-100 text-sage-900 noise relative overflow-hidden">
      <div
        className={`mx-auto max-w-2xl px-5 md:px-8 py-16 md:py-24 transition-opacity duration-700 ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-[11px] font-mono text-sage-700/70 tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-sage-500 animate-pulse-slow" />
            {t("summary.sessionComplete", lang)}
          </div>

          <h1 className="mt-5 font-serif text-3xl md:text-4xl text-sage-900 leading-tight">
            {greeting}
          </h1>

          <p
            className="mt-5 font-serif text-[19px] md:text-[20px] text-sage-800/90 leading-relaxed italic"
            dangerouslySetInnerHTML={{ __html: closing }}
          />
        </div>

        <div className="mt-10 grid grid-cols-3 gap-3 md:gap-4">
          <Stat
            icon={<MessageCircleHeart className="w-4 h-4" />}
            label={t("summary.stat.exchanges", lang)}
            value={exchanges.toString()}
          />
          <Stat
            icon={<Clock className="w-4 h-4" />}
            label={t("summary.stat.time", lang)}
            value={`${minutes} min`}
          />
          <Stat
            icon={<Heart className="w-4 h-4" />}
            label={t("summary.stat.space", lang)}
            value={t("summary.stat.spaceValue", lang)}
          />
        </div>

        {themes.length > 0 && (
          <div className="mt-10">
            <div className="text-center text-[11px] font-mono uppercase tracking-widest text-sage-700/60">
              {t("summary.touchedOn", lang)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 justify-center">
              {themes.map((theme) => (
                <span
                  key={theme}
                  className="px-3 py-1 rounded-full bg-sage-500/10 text-sage-800 text-[13px] border border-sage-500/20"
                >
                  {theme}
                </span>
              ))}
            </div>
            <p className="mt-4 text-center text-[12px] text-sage-700/60 max-w-md mx-auto">
              {t("summary.willRemember", lang)}
            </p>
          </div>
        )}

        {realQuote && (
          <div className="mt-14">
            <MirrorTest realQuote={realQuote} themes={themes} lang={lang} />
          </div>
        )}

        <div className="mt-14">
          <PoemCard
            firstName={firstName}
            peakQuote={realQuote}
            themes={themes}
            lang={lang}
          />
        </div>

        <PortfolioUnlockedNotice />

        {/* Real Testimonials System — soft, inline, only renders for
            users who have completed ≥ 3 sessions and haven't already
            submitted. See <TestimonialPrompt />. */}
        <TestimonialPrompt />

        <div className="mt-14 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-sage-700 hover:bg-sage-800 text-cream-50 text-sm font-medium transition shadow-lg shadow-sage-900/10"
          >
            {t("summary.takeMeHome", lang)}
          </Link>
          <div className="mt-3 text-[11px] text-sage-700/50 font-mono tracking-wider">
            session {userId ?? "USER-—"}
          </div>
        </div>

        <p className="mt-16 text-center text-[12px] text-sage-700/50 max-w-md mx-auto leading-relaxed">
          {t("summary.private", lang)}{" "}
          <Link
            href="/ethics"
            className="underline underline-offset-2 hover:text-sage-900"
          >
            {t("summary.readMore", lang)}
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-sage-500/20 bg-cream-50/80 px-3 py-3 text-center">
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-sage-500/10 text-sage-700 mx-auto">
        {icon}
      </div>
      <div className="mt-2 text-[10.5px] font-mono uppercase tracking-widest text-sage-700/60">
        {label}
      </div>
      <div className="mt-0.5 font-serif text-[15px] text-sage-900">{value}</div>
    </div>
  );
}

/* ─── Mirror Test ─────────────────────────────────────────────────── */

function MirrorTest({
  realQuote,
  themes,
  lang,
}: {
  realQuote: string;
  themes: string[];
  lang: Lang;
}) {
  const [decoys, setDecoys] = useState<[string, string] | null>(null);
  const [order, setOrder] = useState<number[]>([0, 1, 2]);
  const [picked, setPicked] = useState<number | null>(null);

  // Fetch decoys on mount. The order is shuffled once both decoys land.
  useEffect(() => {
    const ctrl = new AbortController();
    generateMirrorDecoys({ realQuote, themes, signal: ctrl.signal })
      .then((d) => {
        setDecoys(d);
        setOrder(shuffle([0, 1, 2]));
      })
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [realQuote, themes]);

  const sentences = decoys ? [realQuote, decoys[0], decoys[1]] : null;
  const realIndexInOrder = order.indexOf(0);

  return (
    <section className="rounded-2xl border border-sage-500/30 bg-cream-50/70 p-6 md:p-8 shadow-sm">
      <div className="flex items-center justify-center gap-2 text-[10.5px] font-mono uppercase tracking-widest text-sage-700/60">
        <Sparkles className="w-3.5 h-3.5" />
        {t("summary.mirror.label", lang)}
      </div>
      <h2 className="mt-3 font-serif text-[22px] md:text-[24px] text-sage-900 text-center leading-snug">
        {t("summary.mirror.prompt", lang)}
      </h2>
      <p className="mt-2 text-center text-[13px] text-sage-700/70 max-w-md mx-auto">
        {t("summary.mirror.sub", lang)}
      </p>

      <div className="mt-7 space-y-3">
        {!sentences && (
          <div className="text-center text-[12px] text-sage-700/50 font-mono py-6">
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sage-500 animate-pulse-slow" />
              {t("summary.mirror.thinking", lang)}
            </span>
          </div>
        )}

        {sentences &&
          order.map((idxInSentences, displayIdx) => {
            const text = sentences[idxInSentences];
            const isPicked = picked === displayIdx;
            const isReal = idxInSentences === 0;
            const showResult = picked !== null;
            return (
              <button
                key={displayIdx}
                type="button"
                disabled={showResult}
                onClick={() => setPicked(displayIdx)}
                className={[
                  "w-full text-left rounded-xl border px-4 py-4 transition font-serif text-[16px] md:text-[17px] leading-relaxed",
                  showResult
                    ? isReal
                      ? "border-sage-700 bg-sage-700/10 text-sage-900"
                      : isPicked
                      ? "border-rose-300 bg-rose-50 text-sage-700/60 line-through decoration-rose-300"
                      : "border-sage-500/20 bg-cream-50 text-sage-700/40"
                    : "border-sage-500/30 bg-cream-50 hover:border-sage-700 hover:bg-sage-500/5 text-sage-900 cursor-pointer",
                ].join(" ")}
              >
                <div className="flex gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-sage-700/40 mt-1 shrink-0">
                    {String.fromCharCode(65 + displayIdx)}.
                  </span>
                  <span>&ldquo;{text}&rdquo;</span>
                </div>
              </button>
            );
          })}
      </div>

      {picked !== null && sentences && (
        <div className="mt-6 text-center">
          {picked === realIndexInOrder ? (
            <p className="font-serif italic text-[16px] text-sage-900 leading-relaxed">
              {t("summary.mirror.right", lang)}
            </p>
          ) : (
            <p className="font-serif italic text-[16px] text-sage-900 leading-relaxed max-w-md mx-auto">
              {t("summary.mirror.wrongPrefix", lang)}{" "}
              <span className="text-sage-700 font-semibold not-italic">
                {String.fromCharCode(65 + realIndexInOrder)}
              </span>
              {t("summary.mirror.wrongSuffix", lang)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/* ─── Poem Card ───────────────────────────────────────────────────── */

function PoemCard({
  firstName,
  peakQuote,
  themes,
  lang,
}: {
  firstName: string | null;
  peakQuote: string | null;
  themes: string[];
  lang: Lang;
}) {
  const [poem, setPoem] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    generatePoem({ firstName, peakQuote, themes, signal: ctrl.signal })
      .then((p) => setPoem(p))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [firstName, peakQuote, themes]);

  const today = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  function handleDownload() {
    if (!poem) return;
    const dataUrl = renderPoemPng({
      poem,
      firstName,
      dateLabel: today,
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `echo-poem-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <section>
      <div className="text-center text-[10.5px] font-mono uppercase tracking-widest text-sage-700/60">
        {t("summary.poem.label", lang)}
      </div>
      <div
        ref={cardRef}
        className="mt-4 mx-auto max-w-md rounded-2xl border border-sage-500/30 bg-gradient-to-b from-cream-50 to-cream-100 px-6 py-9 md:px-9 md:py-11 shadow-md shadow-sage-900/5 relative overflow-hidden"
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 20%, rgba(67,89,77,0.6) 0px, transparent 30%), radial-gradient(circle at 70% 80%, rgba(67,89,77,0.5) 0px, transparent 35%)",
          }}
        />
        <div className="relative">
          <div className="text-center text-[10px] font-mono uppercase tracking-[0.3em] text-sage-700/50">
            {t("summary.poem.forPrefix", lang)} {firstName ? firstName.toLowerCase() : t("summary.poem.you", lang)}
          </div>
          {poem ? (
            <div className="mt-6 font-serif italic text-[18px] md:text-[19px] leading-[1.85] text-sage-900 text-center whitespace-pre-line">
              {poem}
            </div>
          ) : (
            <div className="mt-6 text-center text-[12px] text-sage-700/50 font-mono py-6">
              <span className="inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sage-500 animate-pulse-slow" />
                {t("summary.poem.composing", lang)}
              </span>
            </div>
          )}
          <div className="mt-7 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-sage-700/45">
            <span>echo</span>
            <span>{today}</span>
          </div>
        </div>
      </div>

      {poem && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-sage-500/30 hover:border-sage-700 text-[12px] font-mono uppercase tracking-widest text-sage-700 hover:text-sage-900 transition"
          >
            <Download className="w-3.5 h-3.5" />
            {t("summary.poem.keep", lang)}
          </button>
        </div>
      )}
    </section>
  );
}

/* ─── helpers ─────────────────────────────────────────────────────── */

function pickRealQuote(
  transcript: { role: "echo" | "user"; text: string }[]
): string | null {
  const userLines = transcript
    .filter((e) => e.role === "user")
    .map((e) => e.text.trim())
    .filter((t) => t.length >= 24 && t.length <= 220);
  if (userLines.length === 0) return null;
  // Prefer lines mentioning emotional/personal language.
  const emotional = userLines.filter((t) =>
    /\b(i|my|me|feel|felt|tired|sad|alone|lonely|scared|anxious|hurt|lost|tired|miss|love|hate|empty|stuck|exhaust|cry|broke|fight|nobody|don'?t|can'?t|shouldn'?t|wish|hope)\b/i.test(
      t
    )
  );
  const pool = emotional.length > 0 ? emotional : userLines;
  // Prefer the longest substantive one — usually the most revealing.
  pool.sort((a, b) => b.length - a.length);
  return pool[0];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Renders the poem onto an offscreen canvas and returns a PNG data URL.
 * Designed to look like a paper card a user would actually keep.
 */
function renderPoemPng({
  poem,
  firstName,
  dateLabel,
}: {
  poem: string;
  firstName: string | null;
  dateLabel: string;
}): string {
  const W = 1200;
  const H = 1500;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Cream paper background with a soft radial shade.
  const grad = ctx.createRadialGradient(W * 0.4, H * 0.3, 80, W / 2, H / 2, W);
  grad.addColorStop(0, "#fbf6ec");
  grad.addColorStop(1, "#f0e9d8");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle paper grain.
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `rgba(67,89,77,${Math.random() * 0.04})`;
    const r = Math.random() * 1.5 + 0.3;
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Inner sage hairline border.
  ctx.strokeStyle = "rgba(67,89,77,0.35)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(60, 60, W - 120, H - 120);

  // Header label.
  ctx.fillStyle = "rgba(67,89,77,0.55)";
  ctx.font = "500 22px ui-monospace, 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText(
    `FOR ${firstName ? firstName.toUpperCase() : "YOU"}`,
    W / 2,
    180
  );

  // Sigil.
  ctx.beginPath();
  ctx.arc(W / 2, 240, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#43594d";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W / 2, 240, 16, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(67,89,77,0.5)";
  ctx.stroke();

  // Poem body. Lay each poem line out top-down, accounting for any
  // visual rows produced by wrapping so adjacent lines never overlap.
  const lines = poem.split(/\r?\n/).slice(0, 4);
  ctx.fillStyle = "#1f2a25";
  ctx.font = "italic 500 44px Georgia, 'Fraunces', serif";
  ctx.textAlign = "center";
  const rowHeight = 64;
  const interLineGap = 24;
  // Pre-measure how many rows each poem line will take so we can
  // start the block vertically centred even when some lines wrap.
  const rowCounts = lines.map((line) => {
    const single = ctx.measureText(line).width <= W - 240;
    return single ? 1 : wrapLines(ctx, line, W - 240).length;
  });
  const totalRows = rowCounts.reduce((a, b) => a + b, 0);
  const totalHeight =
    totalRows * rowHeight + Math.max(0, lines.length - 1) * interLineGap;
  let y = (H - totalHeight) / 2 + rowHeight * 0.75;
  for (let i = 0; i < lines.length; i++) {
    const drawn = wrapAndDraw(ctx, lines[i], W / 2, y, W - 240, rowHeight);
    y += drawn * rowHeight + interLineGap;
  }

  // Footer.
  ctx.fillStyle = "rgba(67,89,77,0.45)";
  ctx.font = "500 18px ui-monospace, 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText("ECHO", 110, H - 110);
  ctx.textAlign = "right";
  ctx.fillText(dateLabel.toUpperCase(), W - 110, H - 110);

  return canvas.toDataURL("image/png");
}

function wrapAndDraw(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  // Single-line draw for short lines; only wrap if too wide. Returns
  // the number of visual rows actually drawn so the caller can advance
  // its cursor without overlapping the next line.
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, cx, y);
    return 1;
  }
  const rows = wrapLines(ctx, text, maxWidth);
  for (let i = 0; i < rows.length; i++) {
    ctx.fillText(rows[i], cx, y + i * lineHeight);
  }
  return rows.length;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  let line = "";
  const out: string[] = [];
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  return out;
}
