import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";

/**
 * GET /api/admin/gallery
 *
 * The "trading-card grid" view. Returns every session that has at
 * least one media artefact (peak frame OR audio recording), with
 * short-lived signed URLs the gallery page can render directly.
 *
 * Sortable by ?sort=
 *   - newest         (default — created_at desc)
 *   - oldest
 *   - intensity      (max of fear / shame / sad in final_fingerprint, desc)
 *   - duration       (audio_seconds desc)
 *
 * Excludes soft-deleted rows by default; the trash page surfaces
 * those separately. Add ?include_deleted=1 to also return them
 * (the gallery UI greys those tiles and overlays a countdown).
 *
 * Signed URL TTL matches the existing /api/admin/recording route
 * (5 minutes) — long enough to play back, short enough that the
 * URL is essentially useless if pasted elsewhere.
 */

export const runtime = "nodejs";

const BUCKET = "session-recordings";
const SIGNED_URL_TTL_S = 5 * 60;
const PAGE_SIZE = 60;

type Tile = {
  id: string;
  created_at: string;
  first_name: string | null;
  voice_persona: string | null;
  audio_seconds: number | null;
  peak_quote: string | null;
  intensity: number;
  audio_url: string | null;
  peak_url: string | null;
  deleted_at: string | null;
};

type FingerprintLike = {
  sad?: number;
  fearful?: number;
  shame?: number;
};

function intensityFromFingerprint(
  fp: Record<string, number> | null | undefined
): number {
  if (!fp) return 0;
  const f = fp as FingerprintLike;
  return Math.max(f.sad ?? 0, f.fearful ?? 0, f.shame ?? 0);
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;

  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: true, tiles: [] });
  }
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ ok: true, tiles: [] });

  const sort = req.nextUrl.searchParams.get("sort") ?? "newest";
  const includeDeleted =
    req.nextUrl.searchParams.get("include_deleted") === "1";

  let q = supabase
    .from("sessions")
    .select(
      "id, created_at, first_name, voice_persona, audio_seconds, peak_quote, audio_path, peak_frame_path, final_fingerprint, deleted_at"
    )
    .or("audio_path.not.is.null,peak_frame_path.not.is.null");

  if (!includeDeleted) {
    q = q.is("deleted_at", null);
  }

  // Apply DB-side ordering for the simple cases. Intensity sorting
  // requires reading the JSONB, which we do client-side after fetch.
  if (sort === "oldest") {
    q = q.order("created_at", { ascending: true });
  } else if (sort === "duration") {
    q = q.order("audio_seconds", { ascending: false, nullsFirst: false });
  } else {
    q = q.order("created_at", { ascending: false });
  }

  q = q.limit(PAGE_SIZE * 2); // fetch extra so intensity sort has range

  const { data, error } = await q;
  if (error) {
    return NextResponse.json(
      { ok: false, reason: "db-read-failed", detail: error.message },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;

  // Build signed URLs. Done in parallel.
  const tiles: Tile[] = await Promise.all(
    rows.map(async (r) => {
      const audioPath = r.audio_path as string | null;
      const peakPath = r.peak_frame_path as string | null;

      const [audioSigned, peakSigned] = await Promise.all([
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

      const fingerprint = (r.final_fingerprint as
        | Record<string, number>
        | null) ?? null;

      return {
        id: r.id as string,
        created_at: r.created_at as string,
        first_name: (r.first_name as string | null) ?? null,
        voice_persona: (r.voice_persona as string | null) ?? null,
        audio_seconds: (r.audio_seconds as number | null) ?? null,
        peak_quote: (r.peak_quote as string | null) ?? null,
        intensity: intensityFromFingerprint(fingerprint),
        audio_url: audioSigned.data?.signedUrl ?? null,
        peak_url: peakSigned.data?.signedUrl ?? null,
        deleted_at: (r.deleted_at as string | null) ?? null,
      };
    })
  );

  if (sort === "intensity") {
    tiles.sort((a, b) => b.intensity - a.intensity);
  }

  return NextResponse.json({
    ok: true,
    tiles: tiles.slice(0, PAGE_SIZE),
    sort,
  });
}
