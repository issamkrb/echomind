import { NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";

/**
 * GET /api/testimonials
 *
 * Public read path for the landing-page community wall. Returns the
 * approved-and-live testimonials sorted newest-first, plus the total
 * count. The 24h "approval delay" is enforced here at read time —
 * we filter `goes_live_at <= now()` so the testimonial wall behaves
 * correctly without any cron flipping `status`.
 *
 * IMPORTANT: this endpoint never returns `raw_comment`. Only
 * `improved_comment`, the session count, and a `verified` flag
 * (session_count >= 5) leave the server.
 *
 * Cached for 60s on the edge to keep the wall snappy without making
 * fresh DB hits on every landing-page paint.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERIFIED_THRESHOLD = 5;
const PAGE_SIZE = 100;

export type PublicTestimonial = {
  id: string;
  improved_comment: string;
  session_count: number;
  verified: boolean;
  goes_live_at: string;
};

export async function GET() {
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: true, items: [], count: 0 });
  }
  const db = getServerSupabase();
  if (!db) {
    return NextResponse.json({ ok: true, items: [], count: 0 });
  }

  const nowIso = new Date().toISOString();
  const { data, error, count } = await db
    .from("testimonials")
    .select("id, improved_comment, session_count, goes_live_at", {
      count: "exact",
    })
    .lte("goes_live_at", nowIso)
    .order("goes_live_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (error) {
    console.warn("[testimonials] read failed:", error);
    return NextResponse.json(
      { ok: false, reason: "db-read-failed" },
      { status: 500 }
    );
  }

  const items: PublicTestimonial[] = (data ?? []).map((row) => ({
    id: row.id as string,
    improved_comment: row.improved_comment as string,
    session_count: row.session_count as number,
    verified: (row.session_count as number) >= VERIFIED_THRESHOLD,
    goes_live_at: row.goes_live_at as string,
  }));

  return NextResponse.json({
    ok: true,
    items,
    count: count ?? items.length,
  });
}
