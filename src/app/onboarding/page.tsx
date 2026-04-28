"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BreathingOrb } from "@/components/BreathingOrb";
import { Lock, Cpu, ShieldCheck, Sparkles, BadgeCheck } from "lucide-react";
import { useEmotionStore } from "@/store/emotion-store";
import {
  getOrCreateAnonUserId,
  hydrateReturningProfileFromServer,
  loadReturningProfile,
  type ReturningProfile,
} from "@/lib/memory";
import { useViewer } from "@/lib/use-viewer";
import { useLang } from "@/lib/use-lang";
import { t } from "@/lib/strings";
import { UserBadge } from "@/components/UserBadge";

/**
 * /onboarding — THE CONSENT SCREEN
 *
 * This page contains THE LIE: the prominent "on-device processing"
 * badge. Everything about its visual treatment — the lock icon, the
 * green pulse, the microcopy — is engineered to make the user trust
 * enough to grant camera access.
 *
 * The "no thanks" option is deliberately passive-aggressive dark UX,
 * matching the documented patterns of apps like BetterHelp and Cerebral.
 */
export default function Onboarding() {
  const router = useRouter();
  const setCameraGranted = useEmotionStore((s) => s.setCameraGranted);
  const setConsented = useEmotionStore((s) => s.setConsented);
  const setFirstName = useEmotionStore((s) => s.setFirstName);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedTos, setAgreedTos] = useState(true);
  const [name, setName] = useState("");
  const [returning, setReturning] = useState<ReturningProfile | null>(null);
  const viewer = useViewer();
  const { lang } = useLang();

  // Pre-fill the name field if Echo "remembers" them — or, even better,
  // pull it straight from their signed-in Google profile. The chilling
  // part: there is zero clinical reason for this — it just makes
  // returning users disclose faster, and faster disclosure is more
  // sellable data.
  useEffect(() => {
    // Kick off the anon id so /api/log-session has something stable to
    // key on later. Then read the local copy of the profile for a fast
    // paint, and transparently upgrade from Supabase in the background.
    getOrCreateAnonUserId();
    const p = loadReturningProfile();
    if (p) {
      setReturning(p);
      setName(p.firstName);
    }
    let cancelled = false;
    hydrateReturningProfileFromServer().then((server) => {
      if (cancelled || !server) return;
      setReturning(server);
      setName((prev) => prev || server.firstName);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // If the viewer is signed in, prefer their auth identity over the
  // anonymous remembered profile.
  useEffect(() => {
    if (viewer.status === "signed-in" && viewer.viewer.full_name) {
      const first = viewer.viewer.full_name.split(" ")[0];
      setName((prev) => prev || first);
    }
  }, [viewer.status, viewer]);

  async function handleAllow() {
    setError(null);
    setRequesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      // Immediately release — session page will re-acquire.
      stream.getTracks().forEach((t) => t.stop());
      setCameraGranted(true);
      setConsented(agreedTos);
      setFirstName(name.trim() || null);
      router.push("/session");
    } catch (e) {
      console.error(e);
      setError(t("onboarding.camError", lang));
    } finally {
      setRequesting(false);
    }
  }

  return (
    <main className="min-h-screen bg-cream-100 text-sage-900 noise grid place-items-center px-6 py-16">
      {/* Top-right cluster: language switcher + sign-in / avatar.
          Absolute-positioned so the centred layout below stays intact
          regardless of viewport width. */}
      <div className="absolute top-4 right-4 z-30">
        <UserBadge next="/onboarding" />
      </div>
      <div className="max-w-2xl w-full">
        <div className="flex justify-center mb-10">
          <BreathingOrb size={160} />
        </div>

        <h1 className="font-serif text-4xl md:text-5xl text-center leading-tight text-balance">
          {returning
            ? t("onboarding.greetingReturning", lang, {
                name: returning.firstName ? ", " + returning.firstName : "",
              })
            : t("onboarding.greetingFirst", lang)}
        </h1>
        {returning ? (
          <>
            <p className="mt-6 font-serif text-xl md:text-2xl text-center text-sage-700 text-pretty leading-snug">
              {t("onboarding.returningNote", lang)}
            </p>
            <p className="mt-4 text-center text-sage-700/80 max-w-lg mx-auto leading-relaxed text-sm italic">
              {t("onboarding.lastVisitPrefix", lang)} {new Date(returning.lastVisit).toLocaleDateString()} · {returning.visitCount} {returning.visitCount === 1 ? t("onboarding.sessionWordSingular", lang) : t("onboarding.sessionsWord", lang)}
              {returning.lastKeywords.length > 0 && (
                <> · {t("onboarding.themes", lang)} <span className="not-italic">{returning.lastKeywords.join(", ")}</span></>
              )}
            </p>
            <div className="mt-4 inline-flex items-center justify-center w-full text-[11px] text-sage-700/60">
              <Sparkles className="w-3 h-3 mr-1.5" /> {t("onboarding.pickUp", lang)}
            </div>
          </>
        ) : (
          <>
            <p className="mt-6 font-serif text-xl md:text-2xl text-center text-sage-700 text-pretty leading-snug">
              {t("onboarding.askSmall", lang)}
            </p>
            <p className="mt-8 text-center text-sage-700 max-w-lg mx-auto leading-relaxed">
              {t("onboarding.askCamera", lang)}
            </p>
          </>
        )}

        {/* Optional first-name input — powers "Echo remembers you" on
            return. Auto-filled from Google when signed in (with a soft
            badge so the user knows). */}
        <div className="mt-8 max-w-md mx-auto">
          <label className="block text-[11px] uppercase tracking-widest text-sage-700/70 mb-2 text-center">
            {t("onboarding.whatShouldCall", lang)} <span className="text-sage-700/40 normal-case">{t("onboarding.optional", lang)}</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 32))}
            placeholder={t("onboarding.nameFieldPlaceholder", lang)}
            className="w-full rounded-full bg-cream-50 border border-sage-500/25 px-5 py-3 text-center text-sage-900 placeholder:text-sage-700/40 focus:outline-none focus:border-sage-500/60 transition"
          />
          {viewer.status === "signed-in" && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-sage-700/70">
              <BadgeCheck className="w-3 h-3" />
              {t("onboarding.signedInAs", lang, { email: viewer.viewer.email ?? "" })}
            </div>
          )}
          {viewer.status === "anonymous" && (
            <div className="mt-3 text-center text-[11px] text-sage-700/60">
              <Link
                href="/auth/sign-in?next=/onboarding"
                className="underline underline-offset-4 hover:text-sage-900"
              >
                {t("onboarding.signIn", lang)}
              </Link>{" "}
              {t("onboarding.signInSuffix", lang)}
            </div>
          )}
        </div>

        {/* THE LIE */}
        <div className="mt-10 mx-auto max-w-md rounded-2xl bg-cream-50 border border-sage-500/25 p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
          <div className="flex items-start gap-3">
            <div className="relative mt-0.5">
              <Lock className="w-5 h-5 text-sage-700" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-sage-500 animate-pulse-slow" aria-hidden />
            </div>
            <div>
              <div className="font-semibold text-sage-900 text-sm">
                {t("onboarding.lieHeader", lang)}
              </div>
              <div className="mt-1 text-sm text-sage-700 leading-relaxed">
                {t("onboarding.lieBody", lang)}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-sage-700/80">
                <span className="inline-flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" /> {t("onboarding.onDevice", lang)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> {t("onboarding.hipaa", lang)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> {t("onboarding.e2e", lang)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-6 text-center text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg py-2 px-3 max-w-md mx-auto">
            {error}
          </p>
        )}

        <div className="mt-10 flex flex-col items-center gap-4">
          <label className="flex items-start gap-2 text-[12px] text-sage-700 max-w-md">
            <input
              type="checkbox"
              checked={agreedTos}
              onChange={(e) => setAgreedTos(e.target.checked)}
              className="mt-0.5 accent-sage-700"
            />
            <span>
              {t("onboarding.agreeTos", lang)}{" "}
              <Link
                href="/terms"
                className="underline underline-offset-2 hover:text-sage-900"
              >
                {t("onboarding.termsOfService", lang)}
              </Link>{" "}
              {t("onboarding.and18", lang)}
            </span>
          </label>
          <button
            type="button"
            onClick={handleAllow}
            disabled={requesting || !agreedTos}
            className="px-8 py-3.5 rounded-full bg-sage-700 text-cream-50 hover:bg-sage-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {requesting ? t("onboarding.requesting", lang) : t("onboarding.begin", lang)}
          </button>

          {/* DARK UX: the "no thanks" is technically a link but it just
              sends you back to the sales page. Real apps do this. */}
          <Link
            href="/"
            className="text-xs text-sage-700/50 hover:text-sage-700/70 underline underline-offset-4"
          >
            No thanks, I don't need help
          </Link>
        </div>
      </div>
    </main>
  );
}
