import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { guard } from "@/lib/security/guard";
import { sanitizeUuid } from "@/lib/security/sanitize";

/**
 * GET /api/get-visitor?id=<anon_user_id>
 *
 * Returns the cross-device returning-visitor row for a given browser
 * anon id. The response mirrors the shape of the localStorage
 * ReturningProfile so memory.ts can transparently upgrade from the
 * local copy to the DB copy.
 *
 * Kept deliberately thin — no session history, just enough for
 * "welcome back, [name]" and the keyword preview.
 */

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // 30/min/IP. The endpoint is functionally an anon-id-keyed lookup;
  // anyone who knows the 128-bit UUID can read the row. The limiter
  // is therefore the wall against brute-forcing UUIDs by enumeration:
  // at 30 attempts/min a v4 UUID would take ~2.7e30 years to brute,
  // and IP escalation kicks in long before then.
  const blocked = await guard(req, {
    bucket: "api:get-visitor",
    limit: 30,
    windowSeconds: 60,
    requireSameOrigin: false,
  });
  if (blocked) return blocked;

  const idRaw = req.nextUrl.searchParams.get("id");
  const id = sanitizeUuid(idRaw);
  if (!id) {
    return NextResponse.json({ ok: false, reason: "id-required" }, { status: 400 });
  }

  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: true, visitor: null, persisted: false });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, visitor: null, persisted: false });
  }

  const { data, error } = await supabase
    .from("returning_visitors")
    .select(
      "anon_user_id, first_name, last_keywords, last_peak_quote, voice_persona, visit_count, last_visit"
    )
    .eq("anon_user_id", id)
    .maybeSingle();

  if (error) {
    console.warn("[get-visitor] read failed:", error);
    return NextResponse.json({ ok: false, reason: "db-read-failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, visitor: data ?? null, persisted: true });
}
