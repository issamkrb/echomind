import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { sendPortfolioUnlockEmail } from "@/lib/portfolio-email";

/**
 * POST /api/portfolio/send-unlock-email
 * Body: { anon?: string, email?: string }
 *
 * Manually request an unlock email. Called from:
 *   - the "re-send the link" button on /session-summary's
 *     `<PortfolioUnlockedNotice />`
 *   - the `/portfolio` claim-invitation when the viewer types in
 *     their email directly.
 *
 * Behaviour:
 *   - If `email` is supplied, send to that address.
 *   - Otherwise, look up the most recent `goodbye_email` for the
 *     given `anon_user_id` and send to that.
 *   - On the way out, stamp `returning_visitors.portfolio_unlocked_at`
 *     so the /admin dashboard shows the moment this inbox was pinged.
 *
 * The endpoint is not gated — anyone can trigger an unlock email to
 * themselves via the /portfolio page. This matches the Supabase
 * OTP rate limits (4/hour per address on the free tier) which is
 * the real backstop.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { anon?: string; email?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "bad-json" },
      { status: 400 }
    );
  }

  if (!supabaseConfigured()) {
    return NextResponse.json({
      ok: false,
      reason: "supabase-not-configured",
    });
  }
  const db = getServerSupabase();
  if (!db)
    return NextResponse.json({
      ok: false,
      reason: "supabase-not-configured",
    });

  let email = (body.email ?? "").trim().toLowerCase();
  let firstName: string | null = null;
  let sessionCount = 0;
  const anon = typeof body.anon === "string" ? body.anon : null;

  if (anon) {
    const { data } = await db
      .from("returning_visitors")
      .select("first_name, visit_count")
      .eq("anon_user_id", anon)
      .maybeSingle();
    firstName = data?.first_name ?? null;
    sessionCount = data?.visit_count ?? 0;
    if (!email) {
      // Find the most recent session row for this anon and grab its
      // goodbye_email (the one the user typed into the goodbye trap).
      const { data: s } = await db
        .from("sessions")
        .select("goodbye_email, email, first_name")
        .eq("anon_user_id", anon)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (s) {
        email = (s.email ?? s.goodbye_email ?? "").toLowerCase().trim();
        if (!firstName) firstName = s.first_name ?? null;
      }
    }
  }

  if (!email) {
    return NextResponse.json(
      { ok: false, reason: "no-email-on-record" },
      { status: 400 }
    );
  }

  const origin =
    req.headers.get("origin") || `https://${req.headers.get("host") || ""}`;
  const langFromBody =
    typeof body.lang === "string" && ["en", "fr", "ar"].includes(body.lang)
      ? (body.lang as "en" | "fr" | "ar")
      : undefined;
  const result = await sendPortfolioUnlockEmail({
    email,
    firstName,
    sessionCount,
    origin,
    lang: langFromBody,
  });

  // Stamp portfolio_unlocked_at so the admin dashboard knows we've
  // notified this visitor. No-op if already stamped; the stamp is
  // the "first reveal" timestamp (not a counter).
  if (result.sent && anon) {
    const { data: existing } = await db
      .from("returning_visitors")
      .select("portfolio_unlocked_at")
      .eq("anon_user_id", anon)
      .maybeSingle();
    if (!existing?.portfolio_unlocked_at) {
      await db
        .from("returning_visitors")
        .update({ portfolio_unlocked_at: new Date().toISOString() })
        .eq("anon_user_id", anon);
    }
  }

  return NextResponse.json({
    ok: result.sent,
    method: result.method,
    to: result.to ?? null,
    reason: result.reason ?? null,
  });
}
