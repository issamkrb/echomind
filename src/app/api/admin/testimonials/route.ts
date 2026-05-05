import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";

/**
 * GET /api/admin/testimonials
 *
 * Admin-side listing of every testimonial row (pending, approved,
 * trashed). The public /api/testimonials view is time-gated and
 * filters trashed rows; this is the operator view that has to see
 * everything in order to moderate it.
 *
 * Includes both `raw_comment` and `improved_comment` so the operator
 * can compare what the user wrote against what Groq produced. This
 * is the only endpoint that reads `raw_comment`; the public read
 * path uses a denormalised projection that excludes it.
 */

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;

  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: true, items: [] });
  }
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ ok: true, items: [] });

  const { data, error } = await supabase
    .from("testimonials")
    .select(
      "id, raw_comment, improved_comment, session_count, submitted_at, goes_live_at, status, deleted_at, deleted_by"
    )
    .order("submitted_at", { ascending: false })
    .limit(300);

  if (error) {
    return NextResponse.json({ ok: true, items: [] });
  }

  return NextResponse.json({ ok: true, items: data ?? [] });
}
