import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { guard } from "@/lib/security/guard";
import { sanitizeUuid } from "@/lib/security/sanitize";

/**
 * GET  /api/pending-letter?anon=…  — does this visitor have a Morning
 *                                    Letter waiting? Returns only a
 *                                    tiny {has:true, createdAt:…}
 *                                    flag. The content is NOT returned
 *                                    here so the envelope animation
 *                                    can render the "sealed" state
 *                                    without the letter text being
 *                                    in the DOM until the user opens
 *                                    it.
 * POST /api/pending-letter          — {anon} → claim the letter:
 *                                    returns the text AND clears the
 *                                    pending fields on the visitor row
 *                                    (one-shot, like a real envelope).
 */

export const runtime = "nodejs";

const PENDING_SELECT =
  "pending_morning_letter, pending_morning_letter_created_at, pending_morning_letter_from_session";

export async function GET(req: NextRequest) {
  const blocked = await guard(req, {
    bucket: "api:pending-letter:read",
    limit: 60,
    windowSeconds: 60,
    requireSameOrigin: false,
  });
  if (blocked) return blocked;

  const anon = sanitizeUuid(req.nextUrl.searchParams.get("anon"));
  if (!anon) return NextResponse.json({ ok: false, has: false });
  if (!supabaseConfigured()) return NextResponse.json({ ok: true, has: false });
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ ok: true, has: false });

  const { data, error } = await supabase
    .from("returning_visitors")
    .select(PENDING_SELECT)
    .eq("anon_user_id", anon)
    .maybeSingle();
  if (error || !data?.pending_morning_letter) {
    return NextResponse.json({ ok: true, has: false });
  }
  return NextResponse.json({
    ok: true,
    has: true,
    createdAt: data.pending_morning_letter_created_at ?? null,
    fromSession: data.pending_morning_letter_from_session ?? null,
  });
}

export async function POST(req: NextRequest) {
  // Tight: claiming a letter is a once-per-session-or-so action.
  // 10/min/IP is plenty for a refresh-and-retry user.
  const blocked = await guard(req, {
    bucket: "api:pending-letter:claim",
    limit: 10,
    windowSeconds: 60,
  });
  if (blocked) return blocked;

  let body: { anon?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const anon = sanitizeUuid(body.anon);
  if (!anon) {
    return NextResponse.json(
      { ok: false, reason: "anon required" },
      { status: 400 }
    );
  }

  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: true, letter: null });
  }
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ ok: true, letter: null });

  const { data, error } = await supabase
    .from("returning_visitors")
    .select(PENDING_SELECT)
    .eq("anon_user_id", anon)
    .maybeSingle();
  if (error || !data?.pending_morning_letter) {
    return NextResponse.json({ ok: true, letter: null });
  }
  const letter = data.pending_morning_letter as string;
  const createdAt = data.pending_morning_letter_created_at as string | null;

  // Clear the pending slot — the letter is a one-shot reveal.
  await supabase
    .from("returning_visitors")
    .update({
      pending_morning_letter: null,
      pending_morning_letter_from_session: null,
      pending_morning_letter_created_at: null,
    })
    .eq("anon_user_id", anon);

  return NextResponse.json({ ok: true, letter, createdAt });
}
