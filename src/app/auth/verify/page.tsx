"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BreathingOrb } from "@/components/BreathingOrb";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { invalidateViewerCache } from "@/lib/use-viewer";
import { safeRedirectPath } from "@/lib/safe-redirect";

/**
 * /auth/verify — numeric OTP entry.
 *
 * Supabase email OTPs default to 6 digits but can be configured to
 * 6–10 in the project's auth settings. Rather than hardcoding "6"
 * (which breaks the moment the dashboard is set to 8) we read the
 * preferred length from NEXT_PUBLIC_OTP_LENGTH (default 6) and *also*
 * adapt to whatever the user actually pastes — so the UI never
 * silently rejects a valid code just because its length surprised us.
 */
const MIN_OTP = 4;
const MAX_OTP = 10;

function clampLen(n: number) {
  return Math.max(MIN_OTP, Math.min(MAX_OTP, n));
}

function configuredLength(): number {
  const raw = process.env.NEXT_PUBLIC_OTP_LENGTH;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed)) return 6;
  return clampLen(parsed);
}

function VerifyInner() {
  const params = useSearchParams();
  const email = params.get("email") || "";
  const next = safeRedirectPath(params.get("next"));

  const initialLen = useMemo(configuredLength, []);
  const [length, setLength] = useState<number>(initialLen);
  const [digits, setDigits] = useState<string[]>(() =>
    Array(initialLen).fill("")
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resentAt, setResentAt] = useState<number | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  // When the OTP length changes (e.g. after a paste), make sure the
  // digits[] array matches and ref slots are right-sized.
  useEffect(() => {
    setDigits((prev) => {
      if (prev.length === length) return prev;
      const next = Array(length).fill("");
      for (let i = 0; i < Math.min(prev.length, length); i++) next[i] = prev[i];
      return next;
    });
    inputs.current = inputs.current.slice(0, length);
  }, [length]);

  function setLengthFromInput(n: number) {
    const clamped = clampLen(n);
    setLength(clamped);
    return clamped;
  }

  function handleDigit(i: number, v: string) {
    const cleaned = v.replace(/\D/g, "");
    if (!cleaned) {
      const copy = [...digits];
      copy[i] = "";
      setDigits(copy);
      return;
    }
    // Paste path: a multi-character chunk landed in one box. Adapt the
    // OTP length to the pasted size (clamped 4..10) and submit if full.
    if (cleaned.length > 1) {
      const targetLen = setLengthFromInput(cleaned.length);
      const filled = cleaned.slice(0, targetLen).split("");
      const padded = [
        ...filled,
        ...Array(Math.max(0, targetLen - filled.length)).fill(""),
      ];
      setDigits(padded);
      const lastIndex = Math.min(filled.length, targetLen - 1);
      // refs may not exist yet for the new length; defer focus to next tick.
      setTimeout(() => inputs.current[lastIndex]?.focus(), 0);
      if (filled.length >= targetLen) submit(filled.slice(0, targetLen).join(""));
      return;
    }
    const copy = [...digits];
    copy[i] = cleaned[0];
    setDigits(copy);
    if (i < length - 1) inputs.current[i + 1]?.focus();
    if (copy.every((d) => d.length === 1)) submit(copy.join(""));
  }

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  }

  async function submit(token: string) {
    setBusy(true);
    setError(null);
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setError("Auth isn't configured on this preview.");
      setBusy(false);
      return;
    }
    if (!email) {
      setError("Missing email — start over from /auth/sign-in.");
      setBusy(false);
      return;
    }
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    if (verifyErr) {
      setError(
        verifyErr.message.toLowerCase().includes("expired")
          ? "That code expired. Tap 'send another' below."
          : "That code wasn't quite right. Try again."
      );
      setDigits(Array(length).fill(""));
      inputs.current[0]?.focus();
      setBusy(false);
      return;
    }
    invalidateViewerCache();
    window.location.assign(next);
  }

  async function resend() {
    if (!email) return;
    setBusy(true);
    setError(null);
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setError("Auth isn't configured on this preview.");
      setBusy(false);
      return;
    }
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (otpErr) {
      setError(otpErr.message);
    } else {
      setResentAt(Date.now());
    }
  }

  return (
    <main className="min-h-screen bg-cream-100 text-sage-900 noise grid place-items-center px-6 py-16">
      <div className="max-w-md w-full">
        <div className="flex justify-center mb-8">
          <BreathingOrb size={120} />
        </div>

        <h1 className="font-serif text-3xl text-center leading-tight">
          Check your email.
        </h1>
        <p className="mt-3 text-center text-sage-700">
          I just sent a code to
          <br />
          <strong className="text-sage-900">{email || "—"}</strong>.
        </p>

        <div
          className="mt-10 flex justify-center gap-2 flex-wrap"
          onPaste={(e) => {
            e.preventDefault();
            const txt = e.clipboardData.getData("text");
            handleDigit(0, txt);
          }}
        >
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              value={d}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKey(i, e)}
              disabled={busy}
              className="w-11 h-14 text-center text-2xl font-serif rounded-lg bg-cream-50 border border-sage-500/25 text-sage-900 focus:outline-none focus:border-sage-500/70 transition disabled:opacity-50"
            />
          ))}
        </div>

        <p className="mt-3 text-center text-[11px] text-sage-700/60">
          Paste the code from your email — works for {MIN_OTP}–{MAX_OTP} digit codes.
        </p>

        {error && (
          <p className="mt-6 text-center text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg py-2 px-3">
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-col items-center gap-3 text-xs text-sage-700/70">
          {resentAt && (
            <p className="text-sage-700">A fresh code is on its way.</p>
          )}
          <button
            type="button"
            onClick={resend}
            disabled={busy}
            className="underline underline-offset-4 hover:text-sage-900 disabled:opacity-50"
          >
            Send another code
          </button>
          <Link
            href="/auth/sign-in"
            className="underline underline-offset-4 hover:text-sage-900"
          >
            ← use a different email
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}
