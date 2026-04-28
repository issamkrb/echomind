import { getServerSupabase } from "@/lib/supabase";
import { looksLikeMissingColumn } from "@/lib/schema-drift";

/**
 * Shared loader for the admin sessions listing. Used by both the
 * polled `/api/admin/sessions` endpoint and the live SSE stream at
 * `/api/admin/sessions/stream`. Keeping the projection + fallback
 * logic in one place ensures the dashboard sees identical row
 * shapes whether it's hydrating via fetch or receiving a pushed
 * update.
 */

export type AdminSessionRow = Record<string, unknown> & {
  id: string;
  created_at: string;
  capsule_present: boolean;
};

const PROJECTION =
  "id, created_at, anon_user_id, first_name, goodbye_email, peak_quote, keywords, audio_seconds, revenue_estimate, final_fingerprint, auth_user_id, email, full_name, avatar_url, auth_provider, audio_path, peak_frame_path, voice_persona, callback_used, final_truth, morning_letter_opted_in, detected_language, detected_dialect, code_switch_events, status, last_heartbeat_at, ended_at";

export async function loadAdminSessions(): Promise<{
  rows: AdminSessionRow[];
  error: string | null;
}> {
  const supabase = getServerSupabase();
  if (!supabase) return { rows: [], error: null };

  let { data, error } = await supabase
    .from("sessions")
    .select(PROJECTION)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error && looksLikeMissingColumn(error)) {
    const fallback = await supabase
      .from("sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error) return { rows: [], error: error.message };

  type RawRow = Record<string, unknown> & {
    audio_path?: string | null;
    peak_frame_path?: string | null;
  };
  const rows = ((data ?? []) as RawRow[]).map((r) => {
    const hasAudio = Boolean(r.audio_path);
    const hasFrame = Boolean(r.peak_frame_path);
    const { audio_path: _a, peak_frame_path: _p, ...rest } = r;
    void _a;
    void _p;
    return {
      ...rest,
      voice_persona: rest.voice_persona ?? null,
      callback_used: rest.callback_used ?? null,
      final_truth: rest.final_truth ?? null,
      morning_letter_opted_in: rest.morning_letter_opted_in ?? null,
      detected_language: rest.detected_language ?? null,
      detected_dialect: rest.detected_dialect ?? null,
      code_switch_events: rest.code_switch_events ?? null,
      status: rest.status ?? null,
      last_heartbeat_at: rest.last_heartbeat_at ?? null,
      ended_at: rest.ended_at ?? null,
      capsule_present: hasAudio || hasFrame,
    } as unknown as AdminSessionRow;
  });

  return { rows, error: null };
}
