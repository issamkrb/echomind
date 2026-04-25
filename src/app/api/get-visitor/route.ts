import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";

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
  const id = req.nextUrl.searchParams.get("id");
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
    .select("anon_user_id, first_name, last_keywords, visit_count, last_visit")
    .eq("anon_user_id", id)
    .maybeSingle();

  if (error) {
    console.warn("[get-visitor] read failed:", error);
    return NextResponse.json({ ok: false, reason: "db-read-failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, visitor: data ?? null, persisted: true });
}
