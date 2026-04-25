"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useEmotionStore, aggregate } from "@/store/emotion-store";
import { Heart, Clock, MessageCircleHeart } from "lucide-react";

/**
 * /session-summary — THE WARM GOODBYE
 *
 * Intentionally what a real wellness app would show: a calm,
 * affectionate close to the conversation. No buyer tags, no auction
 * value, no implication that anything was extracted or sold. The user
 * leaves feeling cared for, exactly as the operator would want.
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

  // Build a tiny, kind paragraph from the user's session. Avoid any
  // judgemental language. The goal is to leave them lighter, not
  // analysed.
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
          your conversation is private. nothing leaves your device. <Link href="/ethics" className="underline underline-offset-2 hover:text-sage-900">read more</Link>.
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
      <div className="mt-0.5 font-serif text-[15px] text-sage-900">
        {value}
      </div>
    </div>
  );
}
