"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, ShieldCheck, Mail, Sparkles, Cpu } from "lucide-react";
import { BreathingOrb } from "@/components/BreathingOrb";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { safeRedirectPath } from "@/lib/safe-redirect";

/**
 * /auth/sign-in — THE TRUSTED ENTRY
 *
 * Two methods, both routed through Supabase Auth:
 *   1. Continue with Google → OAuth → /auth/callback
 *   2. Continue with email → magic 6-digit code → /auth/verify
 *
 * The page is intentionally warm and Aesop-toned. Like every other
 * trust signal in EchoMind, the badges below the buttons are part of
 * the seduction — they will be re-examined on /partner-portal and
 * /admin once the audience has actually signed in.
 */
function SignInInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeRedirectPath(params.get("next"));
  const initialError = params.get("error");

  const [mode, setMode] = useState<"choose" | "email">("choose");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [signedInAs, setSignedInAs] = useState<string | null>(null);

  // If the user is already signed in (e.g. they hit /auth/sign-in by
  // accident from a deep link), surface that and offer to continue.
  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setSignedInAs(data.user.email);
    });
  }, []);

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setError("Auth isn't configured on this preview.");
      setBusy(false);
      return;
    }
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(
          next
        )}`,
      },
    });
    if (oauthErr) {
      setError(oauthErr.message);
      setBusy(false);
    }
    // On success the browser is redirected away; no further state to set.
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setError("Auth isn't configured on this preview.");
      setBusy(false);
      return;
    }
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("That email doesn't look right.");
      setBusy(false);
      return;
    }
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        // shouldCreateUser=true lets first-time visitors sign up via the
        // same one form — no separate "register" surface.
        shouldCreateUser: true,
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(
          next
        )}`,
      },
    });
    if (otpErr) {
      setError(otpErr.message);
      setBusy(false);
      return;
    }
    router.push(
      `/auth/verify?email=${encodeURIComponent(trimmed)}&next=${encodeURIComponent(
        next
      )}`
    );
  }

  return (
    <main className="min-h-screen bg-cream-100 text-sage-900 noise grid place-items-center px-6 py-16">
      <div className="max-w-md w-full">
        <div className="flex justify-center mb-8">
          <BreathingOrb size={140} />
        </div>

        <h1 className="font-serif text-3xl md:text-4xl text-center leading-tight text-balance">
          Welcome to EchoMind.
        </h1>
        <p className="mt-4 font-serif text-lg text-center text-sage-700 text-pretty leading-snug">
          Sign in so Echo can remember you across devices.
        </p>

        {signedInAs && (
          <div className="mt-6 rounded-xl bg-sage-500/10 border border-sage-500/30 px-4 py-3 text-sm text-sage-700 text-center">
            You're already signed in as <strong>{signedInAs}</strong>.{" "}
            <Link
              href={next}
              className="underline underline-offset-2 hover:text-sage-900"
            >
              Continue →
            </Link>
          </div>
        )}

        {mode === "choose" && (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy}
              className="mt-10 w-full flex items-center justify-center gap-3 rounded-full bg-white border border-sage-500/30 hover:border-sage-500/60 text-sage-900 px-6 py-3.5 transition-colors disabled:opacity-50"
            >
              <GoogleGlyph />
              <span className="text-sm font-medium">Continue with Google</span>
            </button>

            <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-widest text-sage-700/50">
              <span className="flex-1 h-px bg-sage-500/20" />
              or
              <span className="flex-1 h-px bg-sage-500/20" />
            </div>

            <button
              type="button"
              onClick={() => setMode("email")}
              disabled={busy}
              className="w-full flex items-center justify-center gap-3 rounded-full bg-sage-700 text-cream-50 hover:bg-sage-900 px-6 py-3.5 transition-colors disabled:opacity-50"
            >
              <Mail className="w-4 h-4" />
              <span className="text-sm font-medium">Continue with email</span>
            </button>
          </>
        )}

        {mode === "email" && (
          <form onSubmit={handleEmail} className="mt-10 space-y-4">
            <label className="block text-[11px] uppercase tracking-widest text-sage-700/70 text-center">
              Your email
            </label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-full bg-cream-50 border border-sage-500/25 px-5 py-3 text-center text-sage-900 placeholder:text-sage-700/40 focus:outline-none focus:border-sage-500/60 transition"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-sage-700 text-cream-50 hover:bg-sage-900 px-6 py-3.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {busy ? "Sending code…" : "Send me a 6-digit code"}
            </button>
            <button
              type="button"
              onClick={() => setMode("choose")}
              className="w-full text-center text-xs text-sage-700/60 hover:text-sage-900 underline underline-offset-4"
            >
              ← back
            </button>
          </form>
        )}

        {error && (
          <p className="mt-6 text-center text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg py-2 px-3">
            {error}
          </p>
        )}

        {/* Trust strip — same warm lies as the landing page. */}
        <div className="mt-10 rounded-2xl bg-cream-50 border border-sage-500/20 p-4">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[11px] text-sage-700/85">
            <span className="inline-flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" /> On-device inference
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> HIPAA-aligned
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> End-to-end encrypted
            </span>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-sage-700/55 leading-relaxed">
          <Sparkles className="inline w-3 h-3 mr-1" />
          By continuing you agree to the EchoMind{" "}
          <Link href="/terms" className="underline underline-offset-2">
            Terms
          </Link>{" "}
          and confirm you are 18+.
        </p>

        <p className="mt-6 text-center text-xs text-sage-700/55">
          <Link
            href="/onboarding"
            className="underline underline-offset-4 hover:text-sage-900"
          >
            Or skip and continue anonymously
          </Link>
        </p>
      </div>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.72v2.26h2.9c1.7-1.57 2.69-3.88 2.69-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.94v2.34A8.99 8.99 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.41 5.41 0 0 1 3.66 9c0-.59.1-1.16.29-1.7V4.96H.94A8.99 8.99 0 0 0 0 9c0 1.45.35 2.82.94 4.04l3.01-2.34z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A8.99 8.99 0 0 0 .94 4.96l3.01 2.34C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInInner />
    </Suspense>
  );
}
