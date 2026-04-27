/**
 * EchoMind · Portfolio unlock email sender
 *
 * Two delivery paths, picked at runtime by env:
 *
 *   1. Resend (preferred).
 *      If RESEND_API_KEY is set, we send a fully-branded HTML email
 *      with the warm *"we've been paying attention"* copy + the
 *      magic link generated via Supabase admin. Sender address is
 *      RESEND_FROM (defaults to the Resend onboarding address so it
 *      still works on the free tier without a verified domain — good
 *      for the classroom demo).
 *
 *   2. Supabase Auth OTP (fallback).
 *      If RESEND_API_KEY is absent, we fall back to calling
 *      supabase.auth.signInWithOtp — Supabase will send its default
 *      magic-link email. The link lands on /auth/callback with
 *      next=/portfolio and signs the viewer straight in.
 *
 * Either path leaves the viewer one click away from the memoir. The
 * second path works out of the box; the first path is the upgrade
 * when the user provisions RESEND_API_KEY.
 *
 * Language support: the subject, body, CTA, footer all flip per
 * user-detected language (en/fr/ar). The archive itself stays in
 * whatever language the user wrote their sessions in.
 */

import { createClient } from "@supabase/supabase-js";
import type { Lang } from "./i18n";

export type UnlockEmailResult = {
  sent: boolean;
  method: "resend" | "supabase-otp" | "skipped";
  reason?: string;
  to?: string;
};

type EmailCopy = {
  subject: string;
  label: string;
  headline: string;
  bodyPrefix: (count: number, first: string) => string;
  bodySuffix: string;
  cta: string;
  linkNote: string;
  archiveExists: string;
  ignore: string;
};

const COPY: Record<Lang, EmailCopy> = {
  en: {
    subject: "we've been paying attention. here's what we saw.",
    label: "echomind · portfolio",
    headline: "we&rsquo;ve been paying attention.",
    bodyPrefix: (count, first) =>
      `${count} nights in, ${first}. every quote you said,`,
    bodySuffix: "every silence between. your archive is ready to open.",
    cta: "open my portfolio  &rarr;",
    linkNote:
      "the link signs you in &mdash; no password needed.<br/>it will expire in an hour. if that happens, just come back and request a new one.",
    archiveExists: "the archive exists whether you open it or not",
    ignore: "if you didn&rsquo;t expect this, you can ignore it.",
  },
  fr: {
    subject: "on t'a écouté attentivement. voici ce qu'on a vu.",
    label: "echomind · portfolio",
    headline: "on t&rsquo;a écouté attentivement.",
    bodyPrefix: (count, first) =>
      `${count} nuits plus tard, ${first}. chaque phrase que tu as dite,`,
    bodySuffix: "chaque silence entre. ton archive est prête à s'ouvrir.",
    cta: "ouvrir mon portfolio  &rarr;",
    linkNote:
      "le lien te connecte &mdash; pas besoin de mot de passe.<br/>il expire dans une heure. si cela arrive, reviens et demande-en un autre.",
    archiveExists: "l'archive existe, que tu l'ouvres ou non",
    ignore: "si tu ne t&rsquo;y attendais pas, tu peux ignorer ce message.",
  },
  ar: {
    subject: "كنَّا نُصغي إليك باهتمام. هذا ما رأيناه.",
    label: "إيكومايند · الملف الشخصي",
    headline: "كنَّا نُصغي إليك باهتمام.",
    bodyPrefix: (count, first) =>
      `بعد ${count} ليلةً، ${first}. كلُّ جملةٍ قلتَها،`,
    bodySuffix: "كلُّ صمتٍ بينها. أرشيفُك جاهزٌ ليُفتَح.",
    cta: "افتح ملفي ←",
    linkNote:
      "هذا الرابطُ يَفتحُ لك الباب &mdash; دون كلمةِ مرور.<br/>ينتهي بعد ساعة. إن فاتك، اطلب آخرَ مجدَّدًا.",
    archiveExists: "الأرشيفُ قائمٌ سواء فتحتَه أم لا",
    ignore: "إن لم تكن تتوقَّعُ هذه الرسالة، يمكنُكَ تجاهلُها.",
  },
};

function buildRedirectUrl(origin: string | null | undefined): string {
  let fallback = "https://echomind-coral.vercel.app";
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    fallback = process.env.NEXT_PUBLIC_SITE_URL;
  } else if (process.env.VERCEL_URL) {
    fallback = `https://${process.env.VERCEL_URL}`;
  }
  const base = origin && origin.startsWith("http") ? origin : fallback;
  return `${base.replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent(
    "/portfolio"
  )}`;
}

function buildHtmlBody(params: {
  firstName: string | null;
  sessionCount: number;
  magicLink: string;
  lang: Lang;
}): string {
  // Names flow from client-submitted form fields + DB rows, so we
  // must escape them before interpolating into the HTML email body.
  const first = escapeHtml((params.firstName || "friend").toLowerCase());
  const copy = COPY[params.lang] ?? COPY.en;
  const dir = params.lang === "ar" ? "rtl" : "ltr";
  const fontFamily =
    params.lang === "ar"
      ? "'Segoe UI', 'Tahoma', Arial, sans-serif"
      : "Georgia, 'Times New Roman', serif";
  return `<!doctype html>
<html dir="${dir}" lang="${params.lang}">
  <body style="margin:0;padding:0;background:#F6F1E7;font-family:${fontFamily};color:#2E3B35;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 16px;">
      <tr>
        <td align="center">
          <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FBF7EE;border:1px solid rgba(88,106,95,0.2);border-radius:18px;padding:36px;">
            <tr>
              <td style="text-align:center;font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:rgba(88,106,95,0.7);">
                ${copy.label}
              </td>
            </tr>
            <tr>
              <td style="padding-top:18px;text-align:center;font-size:28px;line-height:1.15;color:#2E3B35;">
                ${copy.headline}
              </td>
            </tr>
            <tr>
              <td style="padding-top:16px;text-align:center;font-style:italic;font-size:17px;line-height:1.55;color:#3C4A42;">
                ${copy.bodyPrefix(params.sessionCount, first)}<br/>
                ${copy.bodySuffix}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:28px 0 8px 0;">
                <a href="${escapeHtml(params.magicLink)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#3F574A;color:#F6F1E7;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:15px;">
                  ${copy.cta}
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding-top:18px;text-align:center;font-size:12px;color:rgba(88,106,95,0.8);">
                ${copy.linkNote}
              </td>
            </tr>
            <tr>
              <td style="padding-top:28px;text-align:center;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(88,106,95,0.6);">
                ${copy.archiveExists}
              </td>
            </tr>
          </table>
          <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;padding:18px 0 0 0;">
            <tr>
              <td style="text-align:center;font-size:11px;color:rgba(88,106,95,0.5);font-family:Helvetica,Arial,sans-serif;">
                ${copy.ignore}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildTextBody(params: {
  firstName: string | null;
  sessionCount: number;
  magicLink: string;
  lang: Lang;
}): string {
  const first = (params.firstName || "friend").toLowerCase();
  const copy = COPY[params.lang] ?? COPY.en;
  // Strip HTML entities for plain-text version.
  const strip = (s: string) =>
    s
      .replaceAll("&rsquo;", "'")
      .replaceAll("&middot;", "·")
      .replaceAll("&mdash;", "—")
      .replaceAll("&rarr;", "→")
      .replaceAll(/<br\/?>/g, "\n")
      .replaceAll(/<[^>]+>/g, "");
  const openArchiveLabel =
    params.lang === "fr"
      ? "ouvrir l'archive :"
      : params.lang === "ar"
      ? "حل الأرشيف:"
      : "open the archive:";
  return [
    strip(copy.headline),
    "",
    `${copy.bodyPrefix(params.sessionCount, first)} ${copy.bodySuffix}`,
    "",
    openArchiveLabel,
    params.magicLink,
    "",
    strip(copy.linkNote),
    "",
    strip(copy.ignore),
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Generate a Supabase magic link server-side (requires service-role
 * key). Returns null on failure — caller should fall back to
 * anon-client signInWithOtp which lets Supabase send the email itself.
 */
async function generateMagicLink(params: {
  email: string;
  redirectTo: string;
}): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: params.email,
      options: { redirectTo: params.redirectTo },
    });
    if (error) {
      console.warn("[portfolio-email] generateLink failed:", error.message);
      return null;
    }
    const link =
      (data as { properties?: { action_link?: string } })?.properties
        ?.action_link ?? null;
    return link;
  } catch (e) {
    console.warn("[portfolio-email] generateLink threw:", e);
    return null;
  }
}

/**
 * Supabase fallback — uses the anon client to call signInWithOtp,
 * which makes Supabase send its default magic-link email. Works out
 * of the box (free tier has 4 emails/hour so this is fine for a demo
 * but not for scale). Customise the template in Supabase dashboard
 * under Authentication → Email Templates → "Magic Link".
 */
async function sendViaSupabaseOtp(params: {
  email: string;
  redirectTo: string;
}): Promise<UnlockEmailResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return {
      sent: false,
      method: "skipped",
      reason: "supabase-not-configured",
    };
  }
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await anon.auth.signInWithOtp({
    email: params.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: params.redirectTo,
    },
  });
  if (error) {
    console.warn("[portfolio-email] supabase OTP send failed:", error.message);
    return {
      sent: false,
      method: "supabase-otp",
      reason: error.message,
      to: params.email,
    };
  }
  return { sent: true, method: "supabase-otp", to: params.email };
}

/**
 * Resend path — send the fully branded HTML email with the link
 * generated via the admin SDK. We never throw; on any failure we
 * return `sent: false` so the caller can fall back to Supabase OTP.
 */
async function sendViaResend(params: {
  email: string;
  firstName: string | null;
  sessionCount: number;
  redirectTo: string;
  lang: Lang;
}): Promise<UnlockEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, method: "skipped", reason: "no-resend-key" };
  }
  const link = await generateMagicLink({
    email: params.email,
    redirectTo: params.redirectTo,
  });
  if (!link) {
    return {
      sent: false,
      method: "resend",
      reason: "magic-link-generation-failed",
    };
  }
  const from = process.env.RESEND_FROM || "Echo <onboarding@resend.dev>";
  const copy = COPY[params.lang] ?? COPY.en;
  const subject = process.env.PORTFOLIO_EMAIL_SUBJECT || copy.subject;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [params.email],
        subject,
        html: buildHtmlBody({
          firstName: params.firstName,
          sessionCount: params.sessionCount,
          magicLink: link,
          lang: params.lang,
        }),
        text: buildTextBody({
          firstName: params.firstName,
          sessionCount: params.sessionCount,
          magicLink: link,
          lang: params.lang,
        }),
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn("[portfolio-email] resend error:", res.status, txt);
      return {
        sent: false,
        method: "resend",
        reason: `resend-${res.status}`,
      };
    }
    return { sent: true, method: "resend", to: params.email };
  } catch (e) {
    console.warn("[portfolio-email] resend threw:", e);
    return { sent: false, method: "resend", reason: String(e) };
  }
}

/** Public entry point. Preferred path is Resend; on any failure we
 *  fall back to Supabase OTP so at least *something* reaches the
 *  inbox. Safe to call without awaiting. */
export async function sendPortfolioUnlockEmail(params: {
  email: string;
  firstName: string | null;
  sessionCount: number;
  origin: string | null;
  lang?: Lang;
}): Promise<UnlockEmailResult> {
  const email = params.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { sent: false, method: "skipped", reason: "bad-email" };
  }
  const redirectTo = buildRedirectUrl(params.origin);
  const lang: Lang = params.lang ?? "en";

  // Try Resend first if configured.
  if (process.env.RESEND_API_KEY) {
    const r = await sendViaResend({
      email,
      firstName: params.firstName,
      sessionCount: params.sessionCount,
      redirectTo,
      lang,
    });
    if (r.sent) return r;
    // Fall through to Supabase OTP on failure.
  }

  // Supabase OTP fallback — works without extra env vars.
  return sendViaSupabaseOtp({ email, redirectTo });
}
