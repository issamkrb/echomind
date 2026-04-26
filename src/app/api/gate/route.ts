import { NextRequest, NextResponse } from "next/server";
import {
  GATE_COOKIE_MAX_AGE_SECONDS,
  GATE_COOKIE_NAME,
  allowedCodes,
  signGateCookie,
} from "@/lib/gate";

/**
 * POST /api/gate — validates a user-supplied code against the
 * comma-separated `SITE_ACCESS_CODE` allowlist and, on match, sets a
 * signed HttpOnly cookie so the middleware lets them through.
 *
 * Per-IP brute-force guard. The gate is a short shared code, so
 * without a rate limit a scanner could enumerate a 4-digit space in
 * seconds. We keep a tiny in-module Map of `ip → [timestamp, ...]`
 * and reject after 5 attempts in a rolling 60-second window.
 *
 * Two important notes on the rate limiter:
 *   - The Map is per Edge runtime instance, so the limit is
 *     approximate across a deployment with many concurrent cold
 *     starts. That's fine for this use — we're not defending a bank,
 *     we're keeping a class demo out of the wrong hands.
 *   - Successful codes don't get rate-limited.
 */

export const runtime = "edge";

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 5;
const attempts = new Map<string, number[]>();

function ipOf(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function tooManyAttempts(ip: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS_PER_WINDOW) {
    attempts.set(ip, recent);
    return true;
  }
  return false;
}

function recordAttempt(ip: string): void {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  attempts.set(ip, recent);
  // Keep the Map tidy — trim entries that haven't been seen in a while.
  if (attempts.size > 500) {
    attempts.forEach((v, k) => {
      const fresh = v.filter((t: number) => now - t < WINDOW_MS);
      if (fresh.length === 0) attempts.delete(k);
      else attempts.set(k, fresh);
    });
  }
}

export async function POST(req: NextRequest) {
  const ip = ipOf(req);
  if (tooManyAttempts(ip)) {
    return NextResponse.json(
      { ok: false, reason: "rate-limited" },
      { status: 429 }
    );
  }

  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "bad-json" },
      { status: 400 }
    );
  }
  const submitted =
    typeof body.code === "string" ? body.code.trim() : "";
  if (!submitted) {
    recordAttempt(ip);
    return NextResponse.json(
      { ok: false, reason: "empty" },
      { status: 400 }
    );
  }

  const codes = allowedCodes();
  if (codes.size === 0) {
    // Gate not configured → treat as unlocked. Keeps dev frictionless.
    return NextResponse.json({ ok: true, reason: "gate-disabled" });
  }

  if (!codes.has(submitted)) {
    recordAttempt(ip);
    // Soft generic rejection. Don't leak whether the code existed,
    // whether we're rate-limited, or how many tries we've seen.
    return NextResponse.json(
      { ok: false, reason: "wrong" },
      { status: 401 }
    );
  }

  const cookieVal = await signGateCookie(submitted);
  if (!cookieVal) {
    // GATE_SECRET missing. Tell the operator, not the guest.
    return NextResponse.json(
      { ok: false, reason: "server-misconfigured" },
      { status: 500 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE_NAME, cookieVal, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: GATE_COOKIE_MAX_AGE_SECONDS,
  });
  return res;
}
