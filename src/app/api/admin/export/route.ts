import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { recordAdminAction } from "@/lib/admin/audit";

/**
 * GET /api/admin/export?format=jsonl|manifest
 *
 * Two export modes:
 *
 *   format=jsonl (default)
 *     Streams a single newline-delimited JSON file containing every
 *     non-deleted row from `sessions`, `visitor_logs`, and
 *     `testimonials` (one row per line, prefixed with `__table` for
 *     parsing). No audio or peak-frame bytes — those are too large
 *     to bundle inline. Use `format=manifest` for those.
 *
 *   format=manifest
 *     Returns JSON with short-lived signed URLs to every audio file
 *     and every peak frame. The operator can then download them at
 *     leisure with their tool of choice. URLs expire in 30 minutes.
 *
 * The export action is audited (action="export.jsonl" /
 * "export.manifest").
 */

export const runtime = "nodejs";

const BUCKET = "session-recordings";
const SIGNED_URL_TTL_S = 30 * 60;

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;

  if (!supabaseConfigured()) {
    return NextResponse.json(
      { ok: false, reason: "supabase-not-configured" },
      { status: 503 }
    );
  }
  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, reason: "supabase-unavailable" },
      { status: 503 }
    );
  }

  const format =
    req.nextUrl.searchParams.get("format") === "manifest"
      ? "manifest"
      : "jsonl";

  if (format === "manifest") {
    const { data, error } = await supabase
      .from("sessions")
      .select("id, audio_path, peak_frame_path")
      .or("audio_path.not.is.null,peak_frame_path.not.is.null")
      .is("deleted_at", null);

    if (error) {
      return NextResponse.json(
        { ok: false, reason: "db-read-failed", detail: error.message },
        { status: 500 }
      );
    }

    type ManifestEntry = {
      id: string;
      audio_url: string | null;
      peak_url: string | null;
    };
    const items: ManifestEntry[] = await Promise.all(
      (data ?? []).map(async (r) => {
        const audioPath = r.audio_path as string | null;
        const peakPath = r.peak_frame_path as string | null;
        const [a, p] = await Promise.all([
          audioPath
            ? supabase.storage
                .from(BUCKET)
                .createSignedUrl(audioPath, SIGNED_URL_TTL_S)
            : Promise.resolve({ data: null }),
          peakPath
            ? supabase.storage
                .from(BUCKET)
                .createSignedUrl(peakPath, SIGNED_URL_TTL_S)
            : Promise.resolve({ data: null }),
        ]);
        return {
          id: r.id as string,
          audio_url: a.data?.signedUrl ?? null,
          peak_url: p.data?.signedUrl ?? null,
        };
      })
    );

    await recordAdminAction(req, {
      adminEmail: gate.adminEmail,
      action: "export.manifest",
      targetCount: items.length,
    });

    return NextResponse.json({
      ok: true,
      generated_at: new Date().toISOString(),
      ttl_seconds: SIGNED_URL_TTL_S,
      items,
    });
  }

  // ── JSONL mode ──────────────────────────────────────────────────
  // We stream by building chunks per table, joined by newlines.
  // Total volume is small (sessions cap ~thousands of rows, each
  // a few KB; total well under what Vercel can stream in a single
  // response).

  const lines: string[] = [];

  type Row = Record<string, unknown>;

  const dump = async (
    table: "sessions" | "visitor_logs" | "testimonials"
  ) => {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(10_000);
    if (error) return;
    for (const row of (data ?? []) as Row[]) {
      lines.push(JSON.stringify({ __table: table, ...row }));
    }
  };

  await dump("sessions");
  await dump("visitor_logs");
  await dump("testimonials");

  const body = lines.join("\n") + "\n";

  await recordAdminAction(req, {
    adminEmail: gate.adminEmail,
    action: "export.jsonl",
    targetCount: lines.length,
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "content-disposition": `attachment; filename="echomind-export-${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.jsonl"`,
      "cache-control": "no-store",
    },
  });
}
