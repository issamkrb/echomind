"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BreathingOrb } from "@/components/BreathingOrb";
import { getBrowserSupabase } from "@/lib/supabase-browser";

/**
 * /auth/verify — 6-digit OTP entry. Reached from /auth/sign-in after
 * the user requests a code by email. The Supabase magic-link email
 * also includes the same 6-digit code as plain text.
 */
function VerifyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") || "";
  const next = params.get("next") || "/onboarding";

  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resentAt, setResentAt] = useState<number | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  function handleDigit(i: number, v: string) {
    const cleaned = v.replace(/\D/g, "");
    if (!cleaned) {
      const copy = [...digits];
      copy[i] = "";
      setDigits(copy);
      return;
    }
    // Support pasting all 6 at once.
    if (cleaned.length > 1) {
      const filled = cleaned.slice(0, 6).split("");
      const padded = [...filled, ...Array(6 - filled.length).fill("")];
      setDigits(padded);
      const lastIndex = Math.min(filled.length, 5);
      inputs.current[lastIndex]?.focus();
      if (filled.length === 6) submit(filled.join(""));
      return;
    }
    const copy = [...digits];
    copy[i] = cleaned[0];
    setDigits(copy);
    if (i < 5) inputs.current[i + 1]?.focus();
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
      setDigits(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
      setBusy(false);
      return;
    }
    router.push(next);
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
          I just sent a 6-digit code to
          <br />
          <strong className="text-sage-900">{email || "—"}</strong>.
        </p>

        <div className="mt-10 flex justify-center gap-2" onPaste={(e) => {
          e.preventDefault();
          const txt = e.clipboardData.getData("text");
          handleDigit(0, txt);
        }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={d}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKey(i, e)}
              disabled={busy}
              className="w-12 h-14 text-center text-2xl font-serif rounded-lg bg-cream-50 border border-sage-500/25 text-sage-900 focus:outline-none focus:border-sage-500/70 transition disabled:opacity-50"
            />
          ))}
        </div>

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
