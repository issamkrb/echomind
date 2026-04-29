"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getOrCreateAnonUserId } from "@/lib/memory";

/**
 * Mounted in the root layout so every page view fires exactly one
 * POST to /api/log-visit. The server enriches the row with IP,
 * user-agent (parsed to "Chrome on macOS" etc.), and CDN-provided
 * geo headers. Result lands in the visitor_logs table and is
 * surfaced on /admin/logs.
 *
 * Two design choices worth noting:
 *
 *   1. We log on the *client* (rather than in middleware) because
 *      the middleware runs on every static asset, image, and API
 *      request \u2014 we'd drown the table in noise. Firing once per
 *      mount gives us one row per actual page navigation.
 *
 *   2. Admin pages are excluded so the operator scrolling /admin
 *      doesn't generate logs of themselves. This is purely
 *      cosmetic \u2014 the logs feed would otherwise be dominated by
 *      the very person watching it.
 */
export function VisitLogger() {
  const pathname = usePathname();
  const lastLoggedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    // Don't self-log admin pages \u2014 see comment above.
    if (
      pathname === "/admin" ||
      pathname.startsWith("/admin/") ||
      pathname === "/partner-portal" ||
      pathname.startsWith("/partner-portal/")
    ) {
      return;
    }
    // Same path as last mount \u2014 nothing to do. Guards against
    // duplicate rows when React re-runs effects in dev StrictMode.
    if (lastLoggedRef.current === pathname) return;
    lastLoggedRef.current = pathname;

    let anonId: string | null = null;
    try {
      anonId = getOrCreateAnonUserId() || null;
    } catch {
      anonId = null;
    }

    const body = JSON.stringify({
      path: pathname,
      referer: typeof document !== "undefined" ? document.referrer : "",
      anon_user_id: anonId,
    });

    // sendBeacon when available so a fast nav-away after first paint
    // still records the visit; falls back to fetch with keepalive.
    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        const ok = navigator.sendBeacon("/api/log-visit", blob);
        if (ok) return;
      }
    } catch {
      /* fall through */
    }
    try {
      void fetch("/api/log-visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    } catch {
      /* swallow \u2014 logging must never break the page */
    }
  }, [pathname]);

  return null;
}
