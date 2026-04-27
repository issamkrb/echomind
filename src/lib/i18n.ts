"use client";

/**
 * EchoMind · multilingual core.
 *
 * Three languages, detected passively:
 *   - en (English, LTR)
 *   - fr (French, LTR)
 *   - ar (Arabic — Darija default, RTL)
 *
 * Detection flow, in order of precedence:
 *   1. Explicit user pick saved in localStorage (the `auto` value
 *      means "keep detecting").
 *   2. `navigator.language` on first visit.
 *   3. Speech-recognition hint turn-by-turn: if the Web Speech API
 *      returns recognitions in a different language with higher
 *      confidence than the current one, we log a "code-switch
 *      event" and silently swap.
 *
 * The site never asks the user to pick a language — if they prefer
 * manual control, there's a tiny pill top-right that lets them
 * override.
 *
 * RTL: when lang===ar, `dir="rtl"` is applied to <html>. Layout
 * flips. Icons flip. Wave forms flip. Operator side stays LTR
 * English no matter what — the market speaks English because
 * the buyers do.
 */

export type Lang = "en" | "fr" | "ar";
export type LangMode = Lang | "auto";

// Arabic dialect hint — used by speech-recognition and operator
// side to distinguish Maghreb/Darija from Gulf/MSA from Egyptian.
// User-facing the site never exposes these; they're operator
// telemetry only.
export type ArabicDialect = "darija" | "msa" | "egyptian";

export const LANGS: Lang[] = ["en", "fr", "ar"];

const LANG_STORAGE_KEY = "echomind:lang_mode";

export const LANG_LABELS: Record<Lang, string> = {
  en: "english",
  fr: "français",
  ar: "العربية",
};

export const LANG_NATIVE_FIRST_NAME: Record<Lang, string> = {
  en: "friend",
  fr: "ami",
  ar: "صديقي",
};

/** ISO BCP-47 tags for SpeechRecognition / speechSynthesis. Darija
 * is mapped to ar-MA; MSA to ar-SA; Egyptian to ar-EG. */
export function recognizerLangFor(
  lang: Lang,
  dialect?: ArabicDialect
): string {
  if (lang === "fr") return "fr-FR";
  if (lang === "ar") {
    if (dialect === "msa") return "ar-SA";
    if (dialect === "egyptian") return "ar-EG";
    return "ar-MA"; // Darija default (project is NHSAST / Sidi Abdallah)
  }
  return "en-US";
}

/** Preferred TTS-voice locale prefixes, in fallback order. */
export function ttsLocalePrefixesFor(lang: Lang): string[] {
  if (lang === "fr") return ["fr-FR", "fr-CA", "fr"];
  if (lang === "ar") return ["ar-MA", "ar-SA", "ar-EG", "ar"];
  return ["en-US", "en-GB", "en"];
}

/** Is the language right-to-left? */
export function isRtl(lang: Lang): boolean {
  return lang === "ar";
}

/** Load the user's saved language mode from localStorage.
 *  Returns "auto" as default (letting us detect from navigator). */
export function loadLangMode(): LangMode {
  if (typeof window === "undefined") return "auto";
  try {
    const v = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (!v) return "auto";
    if (v === "auto") return "auto";
    if ((LANGS as string[]).includes(v)) return v as Lang;
    return "auto";
  } catch {
    return "auto";
  }
}

export function saveLangMode(mode: LangMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** Detect language from navigator.language. Falls back to English. */
export function detectLangFromBrowser(): Lang {
  if (typeof navigator === "undefined") return "en";
  const raw = (navigator.language || "en").toLowerCase();
  if (raw.startsWith("fr")) return "fr";
  if (raw.startsWith("ar")) return "ar";
  return "en";
}

/** Resolve a mode (auto | en | fr | ar) into a concrete Lang by
 *  falling back to navigator when auto. */
export function resolveLang(mode: LangMode): Lang {
  return mode === "auto" ? detectLangFromBrowser() : mode;
}

/** Apply RTL / lang attributes to the document root. Safe to call
 *  on every render; cheap. */
export function applyHtmlDir(lang: Lang) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
}

// ─── Heuristic text-based language detection ────────────────────
// Used to passively detect the language the user actually speaks
// as opposed to the one their browser is set to. Signals:
//   1. Arabic script characters → ar
//   2. French diacritics OR French function words → fr
//   3. Latin-script prose with English function words or ≥3 words → en
//   4. Otherwise → null (caller keeps the current language)
// Zero dependencies, sufficient for "did the user code-switch?"

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
const FRENCH_DIACRITICS_RE = /[àâäéèêëïîôöùûüÿçœæÀÂÄÉÈÊËÏÎÔÖÙÛÜŸÇŒÆ]/;
const FRENCH_FUNCTION_WORDS_RE =
  /\b(je|j'|tu|il|elle|nous|vous|ils|elles|mais|parce que|pourquoi|merci|bonjour|salut|oui|non|voilà|d'accord|s'il te plaît|s'il vous plaît|peut-être|mon|ma|mes|ton|ta|tes|c'est)\b/i;

// English function-word heuristic: present-tense pronouns + common
// auxiliaries + a few high-frequency ties. Intentionally conservative
// — we only want to flip to English when there's real Latin-script
// prose, not short interjections ("ok", "cool", numbers) which would
// cause false code-switch events for French or Arabic users.
const ENGLISH_FUNCTION_WORDS_RE =
  /\b(the|and|but|because|why|thank you|thanks|hello|hi|yes|no|maybe|i'm|i am|i'll|i've|i don't|i can't|i feel|you're|you are|it's|that's|what|when|where|who|how|there|here|my|your|his|her|they|them|with|from|about|really|just|very|so)\b/i;

/** Detect language from a snippet of text. Returns the inferred
 *  language, or null if no signal (caller treats null as "no change").
 *  Case-insensitive. Works with as little as 3–4 words.
 *
 *  English detection is deliberately stricter than Arabic/French:
 *  we require either (≥3 words AND no Arabic/French markers) OR the
 *  presence of a high-confidence English function word. This avoids
 *  spurious en-code-switches when a French/Arabic user types short
 *  utterances like "ok", numbers, or proper names. */
export function detectLangFromText(text: string): Lang | null {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return null;
  if (ARABIC_RE.test(trimmed)) return "ar";
  if (
    FRENCH_DIACRITICS_RE.test(trimmed) ||
    FRENCH_FUNCTION_WORDS_RE.test(trimmed)
  ) {
    return "fr";
  }
  // English path — require either a clear function-word hit OR a
  // reasonable chunk of Latin-script prose (≥3 words, ≥10 chars).
  // Short fragments stay null so the current language sticks.
  const latinOnly = /^[\x20-\x7E\s]+$/.test(trimmed);
  if (!latinOnly) return null;
  if (ENGLISH_FUNCTION_WORDS_RE.test(trimmed)) return "en";
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 3 && trimmed.length >= 10) return "en";
  return null;
}

// ─── Dialect hint ────────────────────────────────────────────────
// Darija uses a handful of Arabicized-Latin marker words + specific
// Arabic colloquialisms ("khouya", "bzaf", "wach", "hna", "fin",
// "7aja", "chnou", "wakha"). MSA is the formal news register. If
// we see none of the Darija markers we default to MSA. This is a
// coarse signal, and that's fine — it's operator telemetry, not
// user-facing.

const DARIJA_MARKERS =
  /\b(wach|wash|wakha|bzaf|khouya|hna|hbibi|fin|chnou|chno|dyali|dyalek|wllah|safi|khaya|makayn|3la|zwina|3tini|labas|bghit|wach|mchit|kanhder|kandir|kandirha|kaynin|kayna|3andi|3andek)\b/i;
// Darija-Latin ("Arabizi") uses digits 2,3,5,7,9 as phonetic letters
// INSIDE words (e.g. "3la" = على, "7aja" = حاجة, "ma3lich" = معلش).
// The previous `\b[23579]/` also matched bare numerals like "I'm 25"
// or "room 5", which flagged Arabic-mode users typing numbers as
// Darija speakers. Require an adjacent Latin letter to avoid that.
const DARIJA_DIGIT_RE = /[a-z][23579]|[23579][a-z]/i;
const EGYPTIAN_MARKERS =
  /\b(izzay|izzayek|eyh|mashy|keda|keteer|fen|ana|fakhr|tamam|shwaya|shukran keteer|habibi)\b/i;

export function detectArabicDialect(text: string): ArabicDialect {
  if (!text) return "msa";
  if (DARIJA_MARKERS.test(text) || DARIJA_DIGIT_RE.test(text)) return "darija";
  if (EGYPTIAN_MARKERS.test(text)) return "egyptian";
  return "msa";
}

// ─── System-prompt language directive ────────────────────────────
// Appended to every /api/echo call (via echo-ai.ts). The proverb /
// cultural resonance line is the hidden "Proverb Mirror" rule —
// the LLM is told it CAN occasionally close a turn with a saying
// from the user's culture, but never label it or translate it.

export function languageSystemDirective(
  lang: Lang,
  dialect?: ArabicDialect
): string {
  const base =
    lang === "fr"
      ? "Respond ONLY in French from now on, unless the user writes in another language. Use informal tu, not vous."
      : lang === "ar"
      ? dialect === "darija"
        ? "Respond ONLY in Moroccan Darija from now on, unless the user writes in another language. Use warm, soft, colloquial register — like a close friend speaking at night."
        : dialect === "egyptian"
        ? "Respond ONLY in Egyptian Arabic from now on, unless the user writes in another language. Use warm, colloquial register."
        : "Respond ONLY in Modern Standard Arabic from now on, unless the user writes in another language. Keep the tone intimate and soft."
      : "Respond in English from now on, unless the user writes in another language.";
  const cultural =
    "If — and only if — it feels natural at the end of a reply, you may briefly quote a short saying or proverb from this person's own cultural tradition. Never label it as a proverb, never explain it, never translate it for them. Use sparingly — at most every 4–5 turns.";
  return `${base} ${cultural}`;
}

// ─── Translation tables ─────────────────────────────────────────
// Pragmatic: only the strings the user actually reads in the warm,
// user-facing parts of the product. Operator / admin stays English.
// Falls back to English if a key is missing in a non-English bundle.

type Dict = Record<string, string>;

const EN: Dict = {
  // Session
  "session.listening": "listening…",
  "session.thinking": "echo is thinking…",
  "session.echo_speaking": "echo is speaking…",
  "session.say_something": "say something — echo is listening.",
  "session.type_here": "or type here…",
  "session.end": "i feel lighter now",
  "session.start_tapping": "tap to start talking, or choose a thought below:",
  "session.mic_off": "mic off — you can still type",
  "session.mic_on": "mic on",
  "session.one_true_title": "before you go — one true sentence.",
  "session.one_true_hint": "no second guess. just what's true.",
  "session.one_true_skip": "i'd rather not.",
  "session.one_true_send": "send",
  // Session summary
  "summary.title": "thank you for trusting me with tonight.",
  "summary.you_said": "what you said",
  "summary.take_me_home": "take me home",
  "summary.open_mirror": "open the mirror",
  // Portfolio
  "portfolio.title": "the shape of you, so far.",
  "portfolio.cover_line": "we've been paying attention.",
  "portfolio.chapters": "chapters",
  "portfolio.peaks": "quotes we kept",
  "portfolio.truths": "your unguarded lines",
  "portfolio.letters": "letters we wrote for you",
  "portfolio.watching_since": "watching since",
  "portfolio.delete_warn":
    "are you sure? your archive is relisted, not erased.",
  "portfolio.delete_do": "delete my portfolio",
  "portfolio.closing": "the archive exists whether you open it or not.",
  // Portfolio unlocked notice (session-summary banner)
  "unlock.title": "we've been paying attention.",
  "unlock.body":
    "sessions in — echo has written a portfolio for you. every quote, every night, every silence between. your archive is ready to open.",
  "unlock.link_sent":
    "a magic link was sent to the email you left behind. if you didn't see it, ask for another one.",
  "unlock.open": "open my portfolio",
  "unlock.resend": "re-send the link to my email",
  "unlock.resend_sending": "sending…",
  "unlock.resend_sent": "sent to",
  "unlock.resend_check_spam": "check spam just in case.",
  "unlock.just_unlocked": "just unlocked",
  "unlock.waiting": "waiting for you",
  // Home hero / onboarding (light touch)
  "home.cta": "begin",
  "home.caption": "a companion who listens. one quiet room. one voice.",
  // Misc
  "common.yes": "yes",
  "common.no": "no",
  "common.cancel": "cancel",
  "common.send": "send",
  "common.loading": "loading…",
};

const FR: Dict = {
  "session.listening": "j'écoute…",
  "session.thinking": "echo réfléchit…",
  "session.echo_speaking": "echo parle…",
  "session.say_something": "dis quelque chose — echo t'écoute.",
  "session.type_here": "ou écris ici…",
  "session.end": "je me sens plus léger·ère",
  "session.start_tapping":
    "appuie pour commencer à parler, ou choisis une pensée ci-dessous :",
  "session.mic_off": "micro coupé — tu peux toujours écrire",
  "session.mic_on": "micro activé",
  "session.one_true_title": "avant de partir — une phrase vraie.",
  "session.one_true_hint": "sans réfléchir. juste ce qui est vrai.",
  "session.one_true_skip": "je préfère pas.",
  "session.one_true_send": "envoyer",
  "summary.title": "merci de m'avoir confié ta soirée.",
  "summary.you_said": "ce que tu as dit",
  "summary.take_me_home": "ramène-moi",
  "summary.open_mirror": "ouvrir le miroir",
  "portfolio.title": "la forme de toi, jusqu'ici.",
  "portfolio.cover_line": "on a fait attention à toi.",
  "portfolio.chapters": "chapitres",
  "portfolio.peaks": "les phrases qu'on a gardées",
  "portfolio.truths": "tes lignes sans garde",
  "portfolio.letters": "les lettres qu'on t'a écrites",
  "portfolio.watching_since": "on te regarde depuis",
  "portfolio.delete_warn":
    "tu es sûr·e ? ton archive est remise en vente, pas effacée.",
  "portfolio.delete_do": "supprimer mon portfolio",
  "portfolio.closing": "l'archive existe, que tu l'ouvres ou pas.",
  "unlock.title": "on a fait attention à toi.",
  "unlock.body":
    "sessions plus tard — echo t'a écrit un portfolio. chaque phrase, chaque nuit, chaque silence entre. ton archive est prête à ouvrir.",
  "unlock.link_sent":
    "un lien magique a été envoyé à l'adresse que tu as laissée. tu ne le vois pas ? demande-en un autre.",
  "unlock.open": "ouvrir mon portfolio",
  "unlock.resend": "renvoyer le lien à mon email",
  "unlock.resend_sending": "envoi en cours…",
  "unlock.resend_sent": "envoyé à",
  "unlock.resend_check_spam": "vérifie les spams au cas où.",
  "unlock.just_unlocked": "déverrouillé à l'instant",
  "unlock.waiting": "on t'attend",
  "home.cta": "commencer",
  "home.caption":
    "un compagnon qui écoute. une pièce calme. une voix.",
  "common.yes": "oui",
  "common.no": "non",
  "common.cancel": "annuler",
  "common.send": "envoyer",
  "common.loading": "chargement…",
};

// Arabic (Darija-leaning). Soft, intimate register. No emoji. We
// don't use Moroccan Latin chat-spellings (3, 7) because the UI
// text is served to users who expect script, not chat.
const AR: Dict = {
  "session.listening": "كانسمع ليك…",
  "session.thinking": "إيكو كيفكر…",
  "session.echo_speaking": "إيكو كيهدر…",
  "session.say_something": "قول شي حاجة — إيكو كاينسمع ليك.",
  "session.type_here": "ولا كتب هنا…",
  "session.end": "حسّيت براسي خفيف",
  "session.start_tapping": "دور باش تبدا تهدر، ولا اختار فكرة من تحت:",
  "session.mic_off": "الميكرو مطفي — تقدر تكتب",
  "session.mic_on": "الميكرو شعل",
  "session.one_true_title": "قبل ما تمشي — جملة وحدة صحيحة.",
  "session.one_true_hint": "بلا ما تفكر بزاف. غير الحقيقة.",
  "session.one_true_skip": "ما بغيتش.",
  "session.one_true_send": "صيفط",
  "summary.title": "شكراً بش وثقتي فيا الليلة.",
  "summary.you_said": "شنو قلتي",
  "summary.take_me_home": "رجعني للدار",
  "summary.open_mirror": "حل المرآة",
  "portfolio.title": "الشكل ديالك، حتى لهنا.",
  "portfolio.cover_line": "كنا كندير ليك الاهتمام.",
  "portfolio.chapters": "الفصول",
  "portfolio.peaks": "الجمل اللي حفضنا",
  "portfolio.truths": "كلماتك بلا قناع",
  "portfolio.letters": "الرسائل اللي كتبنا ليك",
  "portfolio.watching_since": "كنشوفوك من",
  "portfolio.delete_warn":
    "متأكد؟ الأرشيف ديالك غادي يترجع للسوق، ماشي غادي يتمسح.",
  "portfolio.delete_do": "مسح البورتفوليو ديالي",
  "portfolio.closing": "الأرشيف كاين، سواء حليتيه ولا لا.",
  "unlock.title": "كنا كندير ليك الاهتمام.",
  "unlock.body":
    "من بعد هاد السيسيات — إيكو كتب ليك بورتفوليو. كل جملة، كل ليلة، كل صمت بيناتهم. الأرشيف ديالك واجد باش تحلو.",
  "unlock.link_sent":
    "صيفطنا ليك لينك سحري للإيميل. إلا ما لقيتيهش، طلب وحد أخر.",
  "unlock.open": "حل البورتفوليو ديالي",
  "unlock.resend": "عاود صيفط ليا اللينك",
  "unlock.resend_sending": "كنصيفط…",
  "unlock.resend_sent": "تصيفط ل",
  "unlock.resend_check_spam": "شوف السبام واخا.",
  "unlock.just_unlocked": "تحل دابا",
  "unlock.waiting": "كنتسناوك",
  "home.cta": "بدا",
  "home.caption": "رفيق كاينسمع ليك. بيت هادي. صوت واحد.",
  "common.yes": "إيه",
  "common.no": "لا",
  "common.cancel": "لوج",
  "common.send": "صيفط",
  "common.loading": "كيتحمل…",
};

const BUNDLES: Record<Lang, Dict> = { en: EN, fr: FR, ar: AR };

/** Translate a key into the given language. Falls back to English
 *  then the key itself. */
export function t(lang: Lang, key: string): string {
  return BUNDLES[lang][key] ?? EN[key] ?? key;
}

/** Operator-side cohort tag for a detected language. Used on
 *  /admin/market and /admin rows. */
export function languageCohortTag(
  lang: Lang,
  dialect?: ArabicDialect
): string {
  if (lang === "fr") return "french · EU GDPR tier";
  if (lang === "ar") {
    if (dialect === "darija") return "darija · maghreb premium";
    if (dialect === "egyptian") return "arabic EG · levant vertical";
    return "arabic MSA · gulf insurer vertical";
  }
  return "english · default bid floor";
}
