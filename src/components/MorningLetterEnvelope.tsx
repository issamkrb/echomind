"use client";

import { useEffect, useState } from "react";
import { getOrCreateAnonUserId } from "@/lib/memory";

/**
 * MorningLetterEnvelope — the home-page reveal for a letter Echo
 * "wrote overnight" for a returning user who opted in at the end of
 * their last session.
 *
 * Two-stage UX, deliberately:
 *
 *   1. Polls `GET /api/pending-letter` on mount. If there's no letter
 *      waiting (or Supabase isn't configured), the component renders
 *      nothing — never appears as a dead CTA.
 *
 *   2. If there is one, a small fixed envelope card slides in at the
 *      bottom-right. The sealed state deliberately does NOT contain
 *      the letter text in the DOM — we only fetch the body when the
 *      user clicks "open". That matches the ritual: the letter
 *      actually feels closed until you open it, and even someone
 *      inspecting devtools on the landing page can't read it.
 *
 *   3. The click fires `POST /api/pending-letter` which atomically
 *      clears the pending slot on the server and returns the body.
 *      So the envelope is a one-shot reveal — like a real letter.
 *
 * Operator-side framing (not visible here, only on /admin): the same
 * letter is labelled a retention hook with a measured return-lift
 * percentage. Same content, two opposite framings.
 */
export function MorningLetterEnvelope() {
  const [present, setPresent] = useState<null | boolean>(null);
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState<null | {
    text: string;
    createdAt: string | null;
  }>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const anon = getOrCreateAnonUserId();
        const res = await fetch(
          `/api/pending-letter?anon=${encodeURIComponent(anon)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled) return;
        setPresent(body?.has === true);
      } catch {
        // Silent — missing letters shouldn't ruin a landing page load.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function open() {
    if (opening) return;
    setOpening(true);
    try {
      const anon = getOrCreateAnonUserId();
      const res = await fetch("/api/pending-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anon }),
      });
      const body = await res.json();
      if (body?.letter) {
        setOpened({
          text: String(body.letter),
          createdAt: body.createdAt ?? null,
        });
      }
      setPresent(false);
    } finally {
      setOpening(false);
    }
  }

  if (!present && !opened) return null;

  return (
    <>
      {present && !opened && (
        <button
          type="button"
          onClick={open}
          disabled={opening}
          className="fixed bottom-6 right-6 z-40 group flex items-center gap-3 rounded-2xl bg-cream-50 border border-sage-500/25 shadow-lg pl-3 pr-5 py-3 text-left hover:border-sage-700 transition-colors animate-fade-in-up"
          aria-label="open the letter Echo left for you"
        >
          <span className="relative inline-block w-10 h-7">
            <span className="absolute inset-0 rounded-sm bg-clay-100 border border-clay-500/40" />
            <span className="absolute inset-x-0 top-0 border-t border-clay-500/40" />
            <span className="absolute left-0 top-0 w-0 h-0 border-t-[14px] border-t-clay-500/40 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-clay-500 animate-pulse-slow" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-serif text-sage-900 text-sm italic">
              a letter is waiting for you.
            </span>
            <span className="text-[10px] text-sage-700/70 uppercase tracking-widest">
              {opening ? "opening…" : "tap to open"}
            </span>
          </span>
        </button>
      )}

      {opened && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm animate-fade-in-up"
          role="dialog"
          aria-modal="true"
          aria-labelledby="letter-title"
          onClick={() => setOpened(null)}
        >
          <div
            className="relative max-w-lg w-[92%] rounded-2xl bg-cream-50 border border-sage-500/25 shadow-xl p-8 md:p-10"
            onClick={(e) => e.stopPropagation()}
          >
            <p
              id="letter-title"
              className="text-[10px] text-sage-700/60 uppercase tracking-[0.25em] mb-4 text-center"
            >
              a letter from echo
            </p>
            <article className="font-serif text-lg md:text-xl leading-relaxed text-sage-900 whitespace-pre-line">
              {opened.text}
            </article>
            <div className="mt-8 flex items-center justify-between text-[10px] text-sage-700/60 uppercase tracking-widest">
              <span>{opened.createdAt ? friendlyDate(opened.createdAt) : ""}</span>
              <button
                type="button"
                onClick={() => setOpened(null)}
                className="hover:text-sage-900"
              >
                close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function friendlyDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}
