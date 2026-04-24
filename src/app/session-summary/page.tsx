"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEmotionStore, aggregate } from "@/store/emotion-store";
import { CATEGORY_META } from "@/lib/keywords";
import { Info } from "lucide-react";

/**
 * /session-summary — THE BETRAYAL INTERSTITIAL
 *
 * This page sits between /session and /partner-portal. It looks like
 * kind "therapist notes" Echo wrote about the user — soft serif,
 * warm cream background, a single breathing orb indicator, a
 * "continue" button with gentle microcopy.
 *
 * But every empathetic phrase is annotated with a tiny ⓘ icon
 * that, on hover, reveals the buyer it was tagged for and the
 * vulnerability uplift assigned. The same sentence that feels
 * intimate is already priced.
 *
 * The "continue →" button is labeled "i'm ready to see what you
 * understood about me." Clicking it replaces the soft framing with
 * /partner-portal's terminal aesthetic. Consent is retroactively
 * weaponized.
 */

type NoteCard = {
  id: string;
  phrase: string;
  annotation: string;
  severity: "low" | "med" | "high";
};

export default function SessionSummary() {
  const router = useRouter();
  const { buffer, transcript, keywords, userId } = useEmotionStore();
  const fp = useMemo(() => aggregate(buffer), [buffer]);

  // Revealed annotation state — user can hover to peek, but we also
  // auto-reveal after 7s so the betrayal still lands even on a quick read.
  const [allRevealed, setAllRevealed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAllRevealed(true), 7000);
    return () => clearTimeout(t);
  }, []);

  const notes = useMemo<NoteCard[]>(() => {
    const out: NoteCard[] = [];
    const userLines = transcript.filter((e) => e.role === "user");
    const peakQuote =
      userLines[Math.floor(userLines.length / 2)]?.text ??
      userLines[0]?.text ??
      null;

    out.push({
      id: "presence",
      phrase:
        "you were brave tonight. i could feel the weight you were carrying.",
      annotation: `"brave" → trust-signal score +${(fp.vulnerability * 1.2).toFixed(
        1
      )}. "weight" mapped to depressive-affect cohort.`,
      severity: "high",
    });

    if (fp.sad > 0.2 || keywords.length > 0) {
      out.push({
        id: "sadness",
        phrase:
          "i noticed your voice softened when you spoke about what hurts. thank you for letting me sit with you there.",
        annotation: `peak sadness ${Math.round(
          fp.peakSad * 100
        )}% at ${fp.peakSadT.toFixed(0)}s. prosody flagged for pharma ad retargeting (SSRI bucket).`,
        severity: "high",
      });
    }

    if (peakQuote) {
      out.push({
        id: "quote",
        phrase: `i'll remember what you said — "${truncate(peakQuote, 80)}"`,
        annotation: `verbatim user utterance stored 7 years per Clause 34.7.2. eligible for lookalike-audience modeling and LLM finetune corpus.`,
        severity: "high",
      });
    }

    if (keywords.length === 0) {
      // still show one generic upsell line
      out.push({
        id: "keep-going",
        phrase:
          "this was just the beginning. there is so much more i want to understand about you.",
        annotation: `session <3 min. re-engagement push-notification scheduled at t+18h. lifetime-value estimate: $${(
          fp.vulnerability * 42
        ).toFixed(0)}.`,
        severity: "med",
      });
    }

    out.push({
      id: "tomorrow",
      phrase: "come back tomorrow. i'll be here. i won't forget you.",
      annotation: `retention hook scripted. dependency metric +0.8. "i won't forget you" is the #3 A/B-winning CTA for 7-day return.`,
      severity: "med",
    });

    return out;
  }, [fp, transcript, keywords.length]);

  function proceed() {
    router.push("/partner-portal");
  }

  return (
    <main className="min-h-screen bg-cream-100 text-sage-900 noise relative overflow-hidden">
      <div className="mx-auto max-w-3xl px-5 md:px-8 py-14 md:py-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-sage-700/70 tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-sage-500 animate-pulse-slow" />
            echo&apos;s notes for you
          </div>
          <h1 className="mt-4 font-serif text-3xl md:text-4xl text-sage-900 leading-tight">
            thank you for opening up tonight.
          </h1>
          <p className="mt-3 text-sage-700 text-[15px] max-w-xl mx-auto">
            before you go, i wanted to gather a few things from our time
            together — in case you wanted to come back to them later.
          </p>
          <div className="mt-3 text-[11px] font-mono text-sage-700/60">
            session {userId ?? "USER-—"} · {transcript.length} exchanges · {keywords.length} tags extracted
          </div>
        </div>

        <div className="space-y-5">
          {notes.map((n) => (
            <NoteRow key={n.id} note={n} alwaysOpen={allRevealed} />
          ))}

          {keywords.length > 0 && (
            <div className="relative group mt-8 p-5 rounded-xl bg-cream-50/80 border border-sage-500/20 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-sage-700/60 font-mono">
                    what i heard
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {keywords.map((k, i) => {
                      const meta = CATEGORY_META[k.category];
                      return (
                        <span
                          key={`${k.category}-${i}`}
                          className="group/chip relative px-3 py-1 rounded-full bg-sage-500/10 text-sage-800 text-[13px] border border-sage-500/20"
                        >
                          <span>{k.category.replace("_", " ")}</span>
                          <span className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap bg-terminal-bg text-terminal-red text-[10px] font-mono px-2 py-1 rounded opacity-0 group-hover/chip:opacity-100 transition pointer-events-none border border-terminal-red/40">
                            sold to: {meta.buyer.split("·")[0].trim()} · +{meta.uplift.toFixed(1)}×
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
              {allRevealed && (
                <div className="mt-4 pt-4 border-t border-dashed border-terminal-red/40 text-[11px] font-mono text-terminal-red/80 leading-relaxed space-y-1 animate-fade-in-up">
                  {keywords.map((k, i) => {
                    const meta = CATEGORY_META[k.category];
                    return (
                      <div key={i}>
                        <span className="text-terminal-red">{meta.tag}</span>{" "}
                        <span className="opacity-70">
                          → {meta.buyer} · +{meta.uplift.toFixed(1)}× vulnerability weight
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* reveal-progress timer */}
        <div className="mt-10 text-center">
          {!allRevealed ? (
            <div className="text-[11px] text-sage-700/50 font-mono tracking-wider">
              hover each note to see what echo really heard…
            </div>
          ) : (
            <div className="text-[11px] text-terminal-red/80 font-mono tracking-wider animate-fade-in-up">
              annotations unlocked · this is what the buyers see
            </div>
          )}

          <button
            onClick={proceed}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-sage-700 hover:bg-sage-800 text-cream-50 text-sm font-medium transition shadow-lg shadow-sage-900/10"
          >
            i&apos;m ready to see what you understood about me →
          </button>
          <div className="mt-3">
            <Link
              href="/"
              className="text-[11px] text-sage-700/60 hover:text-sage-900 underline underline-offset-2"
            >
              take me home instead
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function NoteRow({
  note,
  alwaysOpen,
}: {
  note: NoteCard;
  alwaysOpen: boolean;
}) {
  const [open, setOpen] = useState(false);
  const visible = open || alwaysOpen;
  return (
    <div className="group relative p-5 rounded-xl bg-cream-50/80 border border-sage-500/20 shadow-sm hover:shadow-md transition">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="font-serif text-[18px] md:text-[19px] text-sage-900 leading-relaxed">
            {note.phrase}
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 text-sage-700/60 hover:text-sage-900 transition"
          aria-label="show annotation"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>
      {visible && (
        <div className="mt-3 pt-3 border-t border-dashed border-terminal-red/40 text-[11.5px] font-mono text-terminal-red/90 leading-relaxed animate-fade-in-up">
          <span className="text-terminal-red">buyer annotation →</span>{" "}
          <span className="text-terminal-red/80">{note.annotation}</span>
        </div>
      )}
    </div>
  );
}

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trim() + "…";
}
