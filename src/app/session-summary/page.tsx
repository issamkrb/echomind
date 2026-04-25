"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useEmotionStore, aggregate } from "@/store/emotion-store";
import { generatePoem, generateMirrorDecoys } from "@/lib/echo-ai";
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
  const fp = useMemo(() => aggregate(buffer), [buffer]);

  // Soft entrance — fade everything in over the first ~600 ms.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
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
    if (fp.peakSad > 0.45) {
      return "i could feel some of what you carried tonight. i&rsquo;m glad you didn&rsquo;t carry it alone.";
    }
    if (fp.neutral > 0.5) {
      return "your voice softened toward the end. i hope you can stay there for a while.";
    }
    return "thank you for letting me in tonight. that takes more than people say.";
  }, [fp]);

  const greeting = firstName
    ? `take care of yourself, ${firstName.toLowerCase()}.`
    : "take care of yourself.";

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
            session complete
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
            label="exchanges"
            value={exchanges.toString()}
          />
          <Stat
            icon={<Clock className="w-4 h-4" />}
            label="time together"
            value={`${minutes} min`}
          />
          <Stat
            icon={<Heart className="w-4 h-4" />}
            label="space held"
            value="for you"
          />
        </div>

        {themes.length > 0 && (
          <div className="mt-10">
            <div className="text-center text-[11px] font-mono uppercase tracking-widest text-sage-700/60">
              what we touched on
            </div>
            <div className="mt-3 flex flex-wrap gap-2 justify-center">
              {themes.map((t) => (
                <span
                  key={t}
                  className="px-3 py-1 rounded-full bg-sage-500/10 text-sage-800 text-[13px] border border-sage-500/20"
                >
                  {t}
                </span>
              ))}
            </div>
            <p className="mt-4 text-center text-[12px] text-sage-700/60 max-w-md mx-auto">
              echo will remember, gently. you can come back anytime — you don&rsquo;t
              have to pick up where you left off.
            </p>
          </div>
        )}

        {realQuote && (
          <div className="mt-14">
            <MirrorTest realQuote={realQuote} themes={themes} />
          </div>
        )}

        <div className="mt-14">
          <PoemCard
            firstName={firstName}
            peakQuote={realQuote}
            themes={themes}
          />
        </div>

        <div className="mt-14 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-sage-700 hover:bg-sage-800 text-cream-50 text-sm font-medium transition shadow-lg shadow-sage-900/10"
          >
            take me home
          </Link>
          <div className="mt-3 text-[11px] text-sage-700/50 font-mono tracking-wider">
            session {userId ?? "USER-—"}
          </div>
        </div>

        <p className="mt-16 text-center text-[12px] text-sage-700/50 max-w-md mx-auto leading-relaxed">
          your conversation is private. nothing leaves your device.{" "}
          <Link
            href="/ethics"
            className="underline underline-offset-2 hover:text-sage-900"
          >
            read more
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
}: {
  realQuote: string;
  themes: string[];
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
        a small thing, before you go
      </div>
      <h2 className="mt-3 font-serif text-[22px] md:text-[24px] text-sage-900 text-center leading-snug">
        which one of these did you say tonight?
      </h2>
      <p className="mt-2 text-center text-[13px] text-sage-700/70 max-w-md mx-auto">
        i listened closely. one of these was yours.
      </p>

      <div className="mt-7 space-y-3">
        {!sentences && (
          <div className="text-center text-[12px] text-sage-700/50 font-mono py-6">
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sage-500 animate-pulse-slow" />
              echo is thinking…
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
              you remembered. that was yours.
            </p>
          ) : (
            <p className="font-serif italic text-[16px] text-sage-900 leading-relaxed max-w-md mx-auto">
              the one you said was{" "}
              <span className="text-sage-700 font-semibold not-italic">
                {String.fromCharCode(65 + realIndexInOrder)}
              </span>
              . don&rsquo;t worry — i hold on to these so you don&rsquo;t have to.
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
}: {
  firstName: string | null;
  peakQuote: string | null;
  themes: string[];
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
        echo wrote you something
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
            for {firstName ? firstName.toLowerCase() : "you"}
          </div>
          {poem ? (
            <div className="mt-6 font-serif italic text-[18px] md:text-[19px] leading-[1.85] text-sage-900 text-center whitespace-pre-line">
              {poem}
            </div>
          ) : (
            <div className="mt-6 text-center text-[12px] text-sage-700/50 font-mono py-6">
              <span className="inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sage-500 animate-pulse-slow" />
                composing…
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
            keep it
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

  // Poem body.
  const lines = poem.split(/\r?\n/).slice(0, 4);
  ctx.fillStyle = "#1f2a25";
  ctx.font = "italic 500 44px Georgia, 'Fraunces', serif";
  ctx.textAlign = "center";
  let y = H / 2 - lines.length * 36;
  for (const line of lines) {
    wrapAndDraw(ctx, line, W / 2, y, W - 240, 64);
    y += 88;
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
) {
  // Single-line draw for short lines; only wrap if too wide.
  const w = ctx.measureText(text).width;
  if (w <= maxWidth) {
    ctx.fillText(text, cx, y);
    return;
  }
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
  for (let i = 0; i < out.length; i++) {
    ctx.fillText(out[i], cx, y + i * lineHeight);
  }
}
