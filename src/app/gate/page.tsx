"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BreathingOrb } from "@/components/BreathingOrb";
import { useLang } from "@/lib/use-lang";
import { t } from "@/lib/strings";

/**
 * /gate — the soft site-wide entry prompt.
 *
 * This is the first page any visitor without a valid gate cookie
 * reaches. Instead of the usual "ENTER PASSWORD" brutalism, the page
 * stays on-brand: a breathing orb, a whispered question, one input.
 *
 * Success → set the gate cookie server-side, redirect to the
 * originally-requested path via the `?next=` query param.
 * Wrong answer → a soft "not tonight." and the input clears; no
 * counter, no explanation.
 */
function GateInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const nextPath = sanitizeNext(sp.get("next"));
  const { lang } = useLang();

  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "wrong" | "error">(
    "idle"
  );
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    const trimmed = code.trim();
    if (!trimmed) return;
    setState("sending");
    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      if (res.ok) {
        router.replace(nextPath);
        router.refresh();
        return;
      }
      if (res.status === 429) {
        setState("error");
      } else {
        setState("wrong");
      }
      setCode("");
      // Re-focus so they can try again without hunting for the input.
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch {
      setState("error");
    }
  }

  const hint =
    state === "wrong"
      ? t("gate.wrong", lang)
      : state === "error"
      ? t("gate.locked", lang)
      : "";

  return (
    <main className="min-h-screen bg-cream-100 text-sage-900 noise grid place-items-center px-6">
      <div className="text-center max-w-md w-full">
        <div className="flex justify-center mb-10">
          <BreathingOrb size={140} />
        </div>
        <p className="font-serif text-2xl md:text-3xl mb-2 text-sage-900">
          {t("gate.prompt", lang)}
        </p>
        <form onSubmit={submit} className="flex flex-col items-center gap-4">
          <input
            ref={inputRef}
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (state !== "idle" && state !== "sending") setState("idle");
            }}
            disabled={state === "sending"}
            aria-label="access word"
            className="w-full max-w-xs bg-cream-50 border border-sage-700/30 rounded-full px-5 py-3 text-center font-serif text-lg text-sage-900 placeholder-sage-700/40 focus:outline-none focus:border-sage-700 transition-colors"
            placeholder=""
          />
          <button
            type="submit"
            disabled={state === "sending" || !code.trim()}
            className="px-6 py-2 rounded-full bg-sage-700 text-cream-50 hover:bg-sage-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm uppercase tracking-widest"
          >
            {state === "sending" ? "…" : t("gate.enter", lang)}
          </button>
          <p
            aria-live="polite"
            className="text-sage-700/80 italic text-sm min-h-[1.25rem]"
          >
            {hint}
          </p>
        </form>
      </div>
    </main>
  );
}

/**
 * Only allow same-origin relative paths in `next`. Blocks open-redirect
 * attempts like `?next=https://evil.tld`. We deliberately require a
 * leading slash and reject `//…` (which browsers treat as protocol-
 * relative).
 */
function sanitizeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  // Don't bounce back to /gate itself or to the api.
  if (raw.startsWith("/gate") || raw.startsWith("/api/")) return "/";
  return raw;
}

export default function GatePage() {
  return (
    <Suspense fallback={null}>
      <GateInner />
    </Suspense>
  );
}
