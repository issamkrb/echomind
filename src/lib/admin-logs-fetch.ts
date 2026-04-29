import { getServerSupabase } from "@/lib/supabase";
import { looksLikeMissingColumn } from "@/lib/schema-drift";

/**
 * Shared loader for the visitor-logs admin listing. Used by the
 * polled `/api/admin/logs` endpoint and the live SSE stream
 * `/api/admin/logs/stream`. Same pattern as admin-sessions-fetch.
 *
 * Cap at 200 rows. The dashboard renders newest-first, and 200
 * gives the operator enough scrollback to spot patterns without
 * shipping a paginated table on a presentation surface.
 */

export type VisitorLogRow = {
  id: string;
  created_at: string;
  anon_user_id: string | null;
  auth_user_id: string | null;
  email: string | null;
  path: string | null;
  referer: string | null;
  ip: string | null;
  user_agent: string | null;
  device: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
};

const PROJECTION =
  "id, created_at, anon_user_id, auth_user_id, email, path, referer, ip, user_agent, device, country, region, city";

export async function loadAdminLogs(): Promise<{
  rows: VisitorLogRow[];
  error: string | null;
}> {
  const supabase = getServerSupabase();
  if (!supabase) return { rows: [], error: null };

  const { data, error } = await supabase
    .from("visitor_logs")
    .select(PROJECTION)
    .order("created_at", { ascending: false })
    .limit(200);

  // If the visitor_logs table itself doesn't exist yet (migration
  // 0011 hasn't been applied), surface an empty list instead of an
  // error \u2014 the dashboard renders a "no logs yet" hint and the
  // rest of /admin keeps working.
  if (error) {
    if (
      looksLikeMissingColumn(error) ||
      /relation .* does not exist/i.test(error.message ?? "") ||
      /could not find the table/i.test(error.message ?? "")
    ) {
      return { rows: [], error: null };
    }
    return { rows: [], error: error.message };
  }

  return { rows: (data ?? []) as VisitorLogRow[], error: null };
}
