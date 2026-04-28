"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";
import { useViewer } from "@/lib/use-viewer";
import { LangPicker } from "@/components/LangPicker";

/**
 * Compact identity chip for the top-right of nav bars. Shows avatar +
 * first name when signed in, "Sign in" link otherwise. Sign-out is a
 * tiny POST form to /api/sign-out so it works without JS too.
 *
 * The LangPicker is embedded directly to the left of the sign-in /
 * avatar so language and identity always live in the same cluster.
 * On mobile the cluster is right-aligned so it never overlaps the
 * EchoMind wordmark.
 *
 * Voice controls are NOT included here — they only belong on the
 * /session page, which renders `<VoiceControls />` directly in its
 * own top bar. Showing the voice picker on home/onboarding/etc.
 * confused users who couldn't preview voices until they'd started
 * a session.
 */
export function UserBadge({
  next = "/",
  align = "right",
}: {
  next?: string;
  align?: "right" | "left";
}) {
  const v = useViewer();

  if (v.status === "loading") {
    return (
      <div
        className={`inline-flex items-center gap-2 ${
          align === "right" ? "justify-end" : ""
        } text-sage-700/40 text-xs`}
        aria-hidden
      >
        <LangPicker />
        <span className="w-7 h-7 rounded-full bg-sage-500/10 animate-pulse" />
      </div>
    );
  }

  if (v.status === "anonymous") {
    return (
      <div className="inline-flex items-center gap-2">
        <LangPicker />
        <Link
          href={`/auth/sign-in?next=${encodeURIComponent(next)}`}
          className="inline-flex items-center gap-1.5 text-xs text-sage-700 hover:text-sage-900 underline-offset-4 hover:underline"
        >
          <LogIn className="w-3.5 h-3.5" />
          Sign in
        </Link>
      </div>
    );
  }

  const u = v.viewer;
  const displayName = u.full_name || u.email || "Friend";
  const initial = (u.full_name || u.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="inline-flex items-center gap-2.5 text-xs text-sage-700">
      <LangPicker />
      {u.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={u.avatar_url}
          alt=""
          referrerPolicy="no-referrer"
          className="w-7 h-7 rounded-full border border-sage-500/30 object-cover"
        />
      ) : (
        <span className="w-7 h-7 rounded-full bg-sage-500/15 border border-sage-500/30 grid place-items-center text-sage-700 text-xs font-serif">
          {initial}
        </span>
      )}
      <span className="hidden sm:inline max-w-[160px] truncate">
        {displayName}
      </span>
      <form action="/api/sign-out" method="post" className="inline">
        <button
          type="submit"
          className="text-[11px] text-sage-700/60 hover:text-sage-900 underline underline-offset-4"
        >
          sign out
        </button>
      </form>
    </div>
  );
}
