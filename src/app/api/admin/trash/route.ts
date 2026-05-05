import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";

/**
 * GET /api/admin/trash
 *
 * Combined view of every soft-deleted row in the moderation tables
 * (sessions, visitor_logs, testimonials). Used by /admin/trash to
 * render the unified countdown grid.
 *
 * Each item includes:
 *   - id, table, deleted_at, deleted_by
 *   - a denormalised `summary` string the UI can show without a
 *     second fetch (peak quote / log path / improved comment).
 *   - `purges_at` = deleted_at + 24h. The UI renders the live
 *     countdown from this. /api/admin/purge-trash is what actually
 *     destroys the row when that timestamp passes.
 *
 * Empty + fail-safe: when the migration hasn't been applied yet we
 * return an empty list rather than 500, so /admin/trash renders
 * "nothing in the trash." instead of a crash.
 */

export const runtime = "nodejs";

const TRASH_TTL_MS = 24 * 60 * 60 * 1000;

type TrashItem = {
  id: string;
  table: "sessions" | "visitor_logs" | "testimonials";
  deleted_at: string;
  deleted_by: string | null;
  purges_at: string;
  summary: string;
  // Optional fields that the UI uses to render fuller context
  // without a second fetch.
  meta: Record<string, unknown>;
};

function plus24h(iso: string): string {
  return new Date(new Date(iso).getTime() + TRASH_TTL_MS).toISOString();
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;

  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: true, items: [] });
  }
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ ok: true, items: [] });

  const items: TrashItem[] = [];

  // Sessions
  try {
    const { data } = await supabase
      .from("sessions")
      .select(
        "id, deleted_at, deleted_by, peak_quote, first_name, anon_user_id, voice_persona, audio_seconds"
      )
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(500);
    for (const r of data ?? []) {
      const deletedAt = r.deleted_at as string;
      items.push({
        id: r.id as string,
        table: "sessions",
        deleted_at: deletedAt,
        deleted_by: (r.deleted_by as string | null) ?? null,
        purges_at: plus24h(deletedAt),
        summary:
          (r.peak_quote as string | null) ??
          (r.first_name as string | null) ??
          (typeof r.anon_user_id === "string"
            ? r.anon_user_id.slice(0, 12) + "…"
            : "session"),
        meta: {
          voice_persona: r.voice_persona ?? null,
          audio_seconds: r.audio_seconds ?? null,
          first_name: r.first_name ?? null,
        },
      });
    }
  } catch {
    /* migration not applied — skip */
  }

  // Visitor logs
  try {
    const { data } = await supabase
      .from("visitor_logs")
      .select("id, deleted_at, deleted_by, path, country, city, ip")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(500);
    for (const r of data ?? []) {
      const deletedAt = r.deleted_at as string;
      items.push({
        id: r.id as string,
        table: "visitor_logs",
        deleted_at: deletedAt,
        deleted_by: (r.deleted_by as string | null) ?? null,
        purges_at: plus24h(deletedAt),
        summary: (r.path as string | null) ?? "log",
        meta: {
          country: r.country ?? null,
          city: r.city ?? null,
        },
      });
    }
  } catch {
    /* skip */
  }

  // Testimonials
  try {
    const { data } = await supabase
      .from("testimonials")
      .select("id, deleted_at, deleted_by, improved_comment, session_count")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(500);
    for (const r of data ?? []) {
      const deletedAt = r.deleted_at as string;
      const text = (r.improved_comment as string | null) ?? "";
      items.push({
        id: r.id as string,
        table: "testimonials",
        deleted_at: deletedAt,
        deleted_by: (r.deleted_by as string | null) ?? null,
        purges_at: plus24h(deletedAt),
        summary:
          text.length > 120 ? text.slice(0, 117) + "…" : text || "testimonial",
        meta: {
          session_count: r.session_count ?? null,
        },
      });
    }
  } catch {
    /* skip */
  }

  // Sort all together by purges_at ascending — items closest to
  // permanent deletion render first so the operator notices what's
  // about to disappear.
  items.sort(
    (a, b) =>
      new Date(a.purges_at).getTime() - new Date(b.purges_at).getTime()
  );

  return NextResponse.json({
    ok: true,
    items,
    count: items.length,
  });
}
