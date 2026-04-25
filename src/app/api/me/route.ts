import { NextResponse } from "next/server";
import { getServerAuthSupabase } from "@/lib/supabase-server";

/**
 * GET /api/me
 *
 * Returns the currently signed-in identity, or { signedIn: false }.
 * Used by client components (landing page CTA, onboarding, session
 * page) to decide whether to skip the name prompt and which avatar
 * to show.
 *
 * Never returns a token — only the public-ish identity bits.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getServerAuthSupabase();
  if (!supabase) {
    return NextResponse.json({ signedIn: false, reason: "not-configured" });
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ signedIn: false });
  }
  const u = data.user;
  const meta = u.user_metadata || {};
  const app = u.app_metadata || {};
  return NextResponse.json({
    signedIn: true,
    user: {
      id: u.id,
      email: u.email ?? null,
      full_name: meta.full_name || meta.name || null,
      avatar_url: meta.avatar_url || meta.picture || null,
      provider: app.provider || "email",
    },
  });
}
