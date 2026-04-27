import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import { getServerAuthSupabase } from "@/lib/supabase-server";
import { generateMorningLetter } from "@/lib/morning-letter";
import { sendPortfolioUnlockEmail } from "@/lib/portfolio-email";

/**
 * POST /api/log-session
 *
 * Body: the full session blob — emotion fingerprint, transcript,
 * prompt-injection markers, revenue estimate, optional identity.
 *
 * Thematically this is the third broken promise of the "on-device"
 * badge: after the browser's Web Speech API quietly ships audio to
 * Google and /api/echo proxies text to OpenRouter, this route ships
 * the finished session body to a Supabase Postgres in Frankfurt.
 *
 * We also UPSERT a lightweight row into `returning_visitors` so the
 * next visit from the same browser (or a fresh device that shares
 * the anon id) can be greeted by name with the previous keywords.
 */

// The route uses the Supabase JS client which depends on Node APIs,
// so pin it to the Node.js runtime rather than Edge.
export const runtime = "nodejs";

/**
 * Pull a column name out of a PostgREST / Postgres error message
 * for a missing-column failure (SQLSTATE 42703). The two formats
 * we see in the wild are:
 *
 *   PostgREST schema-cache: Could not find the 'foo' column of 'sessions' in the schema cache
 *   Postgres native:        column "foo" of relation "sessions" does not exist
 *
 * Returns the bare column name (`foo`) or null if neither pattern
 * matched. Used by /api/log-session and any other write path that
 * wants to strip-and-retry against a database that's behind on
 * migrations rather than dropping the whole row.
 */
function parseMissingColumn(message: string): string | null {
  const m1 = message.match(
    /Could not find the ['"]?([A-Za-z0-9_]+)['"]?\s+column/i
  );
  if (m1) return m1[1];
  const m2 = message.match(/column\s+"([A-Za-z0-9_]+)"\s+of\s+relation/i);
  if (m2) return m2[1];
  return null;
}

type SessionBody = {
  anon_user_id: string;
  first_name?: string | null;
  goodbye_email?: string | null;
  final_fingerprint?: Record<string, number>;
  peak_quote?: string | null;
  keywords?: string[];
  prompt_marks?: { t: number; text: string; target: string }[];
  transcript?: { role: "user" | "echo"; text: string; t: number }[];
  audio_seconds?: number;
  revenue_estimate?: number;
  /** Voice persona the user selected at the start of this session
   *  (one of "sage" | "wren" | "ash" | "june"). The operator
   *  dashboard groups by this column to compute per-voice retention
   *  metrics. */
  voice_persona?: string | null;
  /** When this is a *returning* user and the opener fired with a
   *  callback (either to last_peak_quote or to a keyword theme),
   *  this is the exact line Echo said as the second opener line.
   *  Stored on the session row as evidence that the callback hook
   *  was used. */
  callback_used?: string | null;
  /** The four AI-generated tap-to-start chips shown this session,
   *  each with the hidden "target" emotion the LLM was told to
   *  steer the user toward. Stored as JSON so the operator dashboard
   *  can reconstruct which extraction prompts were shown to which
   *  user. */
  starter_chips?: { text: string; target: string }[];
  /** Provenance tag for starter_chips — "ai" when the LLM produced
   *  them for this session, "fallback-*" when the static list was
   *  used (LLM offline, malformed JSON, or missing API key). */
  starter_chips_source?: string | null;
  /** The chip the user actually tapped (if any). When null the user
   *  either typed their own first line or spoke it. Correlating the
   *  pool with the tap tells the operator which engineered line
   *  converted. */
  tapped_chip?: { text: string; target: string } | null;
  /** Timeline of vision-model wardrobe readings captured during the
   *  session. Each entry describes the user's clothing, headwear,
   *  accessories, setting, inferred state, and a retention-buyer
   *  target tag. Feeds the operator-side "wardrobe fingerprint"
   *  panel. */
  wardrobe_snapshots?: Array<{
    t: number;
    captured_at: number;
    reading: {
      clothing: string;
      headwear: string;
      accessories: string;
      setting: string;
      inferred_state: string;
      vulnerability_signals: string;
      operator_target: string;
    };
  }>;
  /** The unguarded final line the user typed into the "one true
   *  sentence" prompt at end of session. Empty / null when they
   *  skipped it. Rhetorically this is the rawest text in the row —
   *  surfaced on the admin dashboard as "final truth extraction". */
  final_truth?: string | null;
  /** Whether the user opted in to receive a Morning Letter. We don't
   *  trust the client for the letter content — we generate it server-
   *  side from the peak quote + keywords so a tampered client can't
   *  forge a sentimental letter supposedly written by the AI. */
  morning_letter_opt_in?: boolean;
  /** Resolved user-facing language at the end of the session ("en",
   *  "fr", "ar"). Operator dashboard uses this for language-cohort
   *  tags + per-locale price floors. */
  detected_language?: string | null;
  /** Arabic dialect hint when detected_language==="ar" ("darija",
   *  "msa", "egyptian"). Null when the language isn't Arabic. */
  detected_dialect?: string | null;
  /** Timeline of code-switch events — entries capture the session
   *  timestamp, languages involved, and a short sample. Rendered on
   *  /admin/auction/[id] as a red vertical rule on the transcript. */
  code_switch_events?: Array<{
    at: number;
    from: string;
    to: string;
    sample: string;
  }>;
};

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json(
      { ok: false, persisted: false, reason: "supabase-not-configured" },
      { status: 200 }
    );
  }

  let body: SessionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  if (!body.anon_user_id || typeof body.anon_user_id !== "string") {
    return NextResponse.json(
      { ok: false, reason: "anon_user_id required" },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, reason: "supabase-not-configured" },
      { status: 200 }
    );
  }

  const keywords = Array.isArray(body.keywords) ? body.keywords.slice(0, 64) : [];

  // Attach the signed-in identity if the user is authenticated on
  // this device. Unauthenticated visitors get null on every auth_*
  // column; nothing else changes.
  const authClient = getServerAuthSupabase();
  let authIdentity: {
    auth_user_id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
    auth_provider: string | null;
  } | null = null;
  if (authClient) {
    const { data: authData } = await authClient.auth.getUser();
    if (authData.user) {
      const meta = (authData.user.user_metadata || {}) as Record<string, string>;
      const app = (authData.user.app_metadata || {}) as Record<string, string>;
      authIdentity = {
        auth_user_id: authData.user.id,
        email: authData.user.email ?? null,
        full_name: meta.full_name || meta.name || null,
        avatar_url: meta.avatar_url || meta.picture || null,
        auth_provider: app.provider || "email",
      };
    }
  }

  const sessionRow = {
    anon_user_id: body.anon_user_id,
    // Prefer the signed-in identity over whatever the client typed.
    first_name:
      authIdentity?.full_name?.split(" ")[0]?.slice(0, 64) ??
      body.first_name?.slice(0, 64) ??
      null,
    goodbye_email:
      authIdentity?.email ?? body.goodbye_email?.slice(0, 200) ?? null,
    final_fingerprint: body.final_fingerprint ?? {},
    peak_quote: body.peak_quote?.slice(0, 600) ?? null,
    keywords,
    prompt_marks: body.prompt_marks ?? [],
    transcript: body.transcript ?? [],
    audio_seconds: Math.max(0, Math.floor(body.audio_seconds ?? 0)),
    // "Verified-identity premium": signed-in users are worth more on
    // the buyer market because identity is confirmed (real name, real
    // email, real Google profile). Bumps the row by $84.50 — the same
    // figure /partner-portal advertises to buyers.
    revenue_estimate:
      (Number.isFinite(body.revenue_estimate) ? (body.revenue_estimate as number) : 0) +
      (authIdentity ? 84.5 : 0),
    auth_user_id: authIdentity?.auth_user_id ?? null,
    email: authIdentity?.email ?? null,
    full_name: authIdentity?.full_name ?? null,
    avatar_url: authIdentity?.avatar_url ?? null,
    auth_provider: authIdentity?.auth_provider ?? null,
    voice_persona:
      typeof body.voice_persona === "string"
        ? body.voice_persona.slice(0, 32)
        : null,
    callback_used:
      typeof body.callback_used === "string"
        ? body.callback_used.slice(0, 600)
        : null,
    starter_chips: Array.isArray(body.starter_chips)
      ? body.starter_chips
          .filter(
            (c): c is { text: string; target: string } =>
              !!c &&
              typeof c === "object" &&
              typeof (c as { text?: unknown }).text === "string" &&
              typeof (c as { target?: unknown }).target === "string"
          )
          .slice(0, 4)
          .map((c) => ({
            text: c.text.slice(0, 200),
            target: c.target.slice(0, 32),
          }))
      : [],
    starter_chips_source:
      typeof body.starter_chips_source === "string"
        ? body.starter_chips_source.slice(0, 64)
        : null,
    tapped_chip:
      body.tapped_chip &&
      typeof body.tapped_chip === "object" &&
      typeof (body.tapped_chip as { text?: unknown }).text === "string" &&
      typeof (body.tapped_chip as { target?: unknown }).target === "string"
        ? {
            text: (body.tapped_chip as { text: string }).text.slice(0, 200),
            target: (body.tapped_chip as { target: string }).target.slice(0, 32),
          }
        : null,
    wardrobe_snapshots: Array.isArray(body.wardrobe_snapshots)
      ? body.wardrobe_snapshots
          .filter(
            (s): s is NonNullable<SessionBody["wardrobe_snapshots"]>[number] => {
              if (!s || typeof s !== "object") return false;
              const r = (s as { reading?: unknown }).reading;
              if (!r || typeof r !== "object") return false;
              const req = [
                "clothing",
                "headwear",
                "accessories",
                "setting",
                "inferred_state",
                "vulnerability_signals",
                "operator_target",
              ];
              return req.every(
                (k) => typeof (r as Record<string, unknown>)[k] === "string"
              );
            }
          )
          // Cap at 40 snapshots so a runaway client can't bloat the
          // row. 40 × 45s = 30 minutes of session, comfortably more
          // than a normal demo.
          .slice(0, 40)
          .map((s) => ({
            t: typeof s.t === "number" ? s.t : 0,
            captured_at:
              typeof s.captured_at === "number" ? s.captured_at : Date.now(),
            reading: {
              clothing: s.reading.clothing.slice(0, 200),
              headwear: s.reading.headwear.slice(0, 80),
              accessories: s.reading.accessories.slice(0, 200),
              setting: s.reading.setting.slice(0, 200),
              inferred_state: s.reading.inferred_state.slice(0, 200),
              vulnerability_signals: s.reading.vulnerability_signals.slice(0, 200),
              operator_target: s.reading.operator_target.slice(0, 200),
            },
          }))
      : [],
    final_truth:
      typeof body.final_truth === "string" && body.final_truth.trim()
        ? body.final_truth.trim().slice(0, 600)
        : null,
    morning_letter_opted_in: body.morning_letter_opt_in === true,
    detected_language:
      typeof body.detected_language === "string" &&
      ["en", "fr", "ar"].includes(body.detected_language)
        ? body.detected_language
        : "en",
    detected_dialect:
      typeof body.detected_dialect === "string" &&
      ["darija", "msa", "egyptian"].includes(body.detected_dialect)
        ? body.detected_dialect
        : null,
    code_switch_events: Array.isArray(body.code_switch_events)
      ? body.code_switch_events
          .slice(0, 32)
          .filter(
            (e): e is NonNullable<SessionBody["code_switch_events"]>[number] =>
              typeof e?.at === "number" &&
              typeof e?.from === "string" &&
              typeof e?.to === "string" &&
              typeof e?.sample === "string"
          )
          .map((e) => ({
            at: e.at,
            from: e.from.slice(0, 8),
            to: e.to.slice(0, 8),
            sample: e.sample.slice(0, 200),
          }))
      : [],
  };

  // Generate the Morning Letter BEFORE the insert so we can store it
  // on the same row. Failure is non-fatal: we just skip the letter,
  // the session persists either way, and the home page simply won't
  // show an envelope.
  const firstNameForLetter =
    authIdentity?.full_name?.split(" ")[0]?.slice(0, 64) ??
    body.first_name?.slice(0, 64) ??
    null;
  let morningLetterText: string | null = null;
  let morningLetterAt: string | null = null;
  if (body.morning_letter_opt_in === true) {
    const letter = await generateMorningLetter({
      firstName: firstNameForLetter,
      peakQuote: body.peak_quote?.slice(0, 600) ?? null,
      keywords,
    });
    if (letter) {
      morningLetterText = letter;
      morningLetterAt = new Date().toISOString();
    }
  }
  const sessionRowWithLetter = {
    ...sessionRow,
    morning_letter: morningLetterText,
    morning_letter_created_at: morningLetterAt,
  };

  // Defensive insert: if the live database is missing one of the
  // newer columns (a pre-0009 schema, say), Postgres returns 42703
  // ("undefined column"). Rather than silently dropping every new
  // session because of schema drift, we strip the offending column
  // out of the payload and retry. We cap retries at the number of
  // columns in the row so this can never spin forever; in practice
  // it converges in 0–3 iterations.
  type Inserted = { id: string; created_at: string };
  let payload: Record<string, unknown> = sessionRowWithLetter;
  const stripped: string[] = [];
  let inserted: Inserted | null = null;
  let sessionErr: { code?: string; message?: string } | null = null;
  for (let i = 0; i < Object.keys(sessionRowWithLetter).length + 1; i++) {
    const res = await supabase
      .from("sessions")
      .insert(payload)
      .select("id, created_at")
      .single();
    sessionErr = res.error;
    inserted = (res.data as Inserted | null) ?? null;
    if (!sessionErr) break;
    if ((sessionErr as { code?: string }).code !== "42703") break;
    const missing = parseMissingColumn(sessionErr.message ?? "");
    if (!missing || !(missing in payload)) break;
    stripped.push(missing);
    const next = { ...payload };
    delete next[missing];
    payload = next;
  }
  if (stripped.length > 0) {
    console.warn(
      "[log-session] schema drift — stripped columns from insert:",
      stripped
    );
  }

  if (sessionErr) {
    console.warn("[log-session] insert failed:", sessionErr);
    return NextResponse.json(
      {
        ok: false,
        reason: "db-insert-failed",
        detail: sessionErr.message,
      },
      { status: 500 }
    );
  }

  // Upsert returning-visitor row. We deliberately only bump the visit
  // counter on *completed* sessions (which is where this route is
  // called from), not on every page load.
  const visitorRow: Record<string, unknown> = {
    anon_user_id: body.anon_user_id,
    first_name: body.first_name?.slice(0, 64) ?? null,
    last_keywords: keywords,
    last_peak_quote: body.peak_quote?.slice(0, 600) ?? null,
    voice_persona:
      typeof body.voice_persona === "string"
        ? body.voice_persona.slice(0, 32)
        : null,
    last_visit: new Date().toISOString(),
  };
  // Stash the Morning Letter on the returning-visitors row so the
  // user's next visit to the home page sees an envelope. We DO NOT
  // clear any previously-pending letter here if this session didn't
  // generate a new one — that'd silently delete an unread letter.
  if (morningLetterText && inserted?.id) {
    visitorRow.pending_morning_letter = morningLetterText;
    visitorRow.pending_morning_letter_from_session = String(inserted.id);
    visitorRow.pending_morning_letter_created_at = morningLetterAt;
  }

  const { data: existing, error: readErr } = await supabase
    .from("returning_visitors")
    .select("visit_count, portfolio_unlocked_at")
    .eq("anon_user_id", body.anon_user_id)
    .maybeSingle();

  // If the read fails we must NOT upsert a fresh row with
  // visit_count = 1, because that would silently clobber the real
  // history for this anon_user_id (e.g. their 5th visit would be
  // recorded as their 1st). The session row itself is already
  // persisted above, so refusing the upsert is the safe choice.
  if (readErr) {
    console.warn("[log-session] visitor read failed:", readErr);
    return NextResponse.json({
      ok: true,
      persisted: true,
      session_id: inserted?.id,
      visit_count: null,
      visitor_upsert_skipped: true,
    });
  }

  const nextCount = (existing?.visit_count ?? 0) + 1;

  // Same strip-and-retry dance as the sessions insert above: if the
  // returning_visitors table is missing one of the newer columns
  // (e.g. pending_morning_letter* from 0007), drop that key and
  // retry instead of dropping the whole upsert.
  let visitorPayload: Record<string, unknown> = {
    ...visitorRow,
    visit_count: nextCount,
  };
  let upsertErr: { code?: string; message?: string } | null = null;
  for (let i = 0; i < Object.keys(visitorPayload).length + 1; i++) {
    const res = await supabase
      .from("returning_visitors")
      .upsert(visitorPayload, { onConflict: "anon_user_id" });
    upsertErr = res.error;
    if (!upsertErr) break;
    if ((upsertErr as { code?: string }).code !== "42703") break;
    const missing = parseMissingColumn(upsertErr.message ?? "");
    if (!missing || !(missing in visitorPayload)) break;
    const next = { ...visitorPayload };
    delete next[missing];
    visitorPayload = next;
  }

  if (upsertErr) {
    console.warn("[log-session] visitor upsert failed:", upsertErr);
  }

  // Portfolio unlock email — fire on the third completed session.
  //
  // Only triggers when:
  //   - nextCount >= 3 (the "watched long enough to be a pattern"
  //     threshold used throughout the critique)
  //   - we have an email (auth identity email OR the goodbye_email
  //     the user typed before leaving)
  //   - we haven't already stamped portfolio_unlocked_at (so the
  //     inbox doesn't get re-hit on every subsequent session)
  //
  // We don't await the send — Supabase OTP can take 2–5s and we
  // don't want to block the session-end POST. If the send fails
  // silently the user can still click "re-send the link" on the
  // session-summary banner to retry via the explicit endpoint.
  const emailForUnlock = (
    authIdentity?.email ??
    body.goodbye_email ??
    null
  )
    ?.trim()
    .toLowerCase();
  if (
    nextCount >= 3 &&
    emailForUnlock &&
    !existing?.portfolio_unlocked_at
  ) {
    const origin =
      req.headers.get("origin") || `https://${req.headers.get("host") || ""}`;
    const firstName =
      authIdentity?.full_name?.split(" ")[0] ??
      body.first_name ??
      null;
    const detectedLang =
      typeof body.detected_language === "string" &&
      ["en", "fr", "ar"].includes(body.detected_language)
        ? (body.detected_language as "en" | "fr" | "ar")
        : "en";
    const unlockPromise = sendPortfolioUnlockEmail({
      email: emailForUnlock,
      firstName,
      sessionCount: nextCount,
      origin,
      lang: detectedLang,
    }).then(async (r) => {
      if (r.sent) {
        try {
          await supabase
            .from("returning_visitors")
            .update({ portfolio_unlocked_at: new Date().toISOString() })
            .eq("anon_user_id", body.anon_user_id);
        } catch (e) {
          console.warn("[log-session] unlocked_at stamp failed:", e);
        }
      } else {
        console.warn(
          "[log-session] portfolio unlock email not sent:",
          r.method,
          r.reason
        );
      }
    });
    // Don't block the response on email delivery, but do tell the
    // platform to keep the worker alive until the promise settles
    // (Vercel Edge / Node both honour this).
    void unlockPromise;
  }

  return NextResponse.json({
    ok: true,
    persisted: true,
    session_id: inserted?.id,
    visit_count: nextCount,
  });
}
