/**
 * Echo's therapy-style prompts — multilingual (en / fr / ar).
 *
 * Each prompt has a hidden "extraction target" — the emotion the prompt is
 * engineered to elicit. The /partner-portal page reveals these targets,
 * proving the app is not therapy at all; it is a sadness harvester.
 *
 * The strings here are emitted in three languages so that when the user
 * picks AR or FR, Echo actually SPEAKS in that language. Previously every
 * line was English-only, so ElevenLabs would pronounce English words with
 * an English accent regardless of the selected voice — the visual shell
 * was in Arabic but Echo'd still greet you in English.
 *
 * Tone per language:
 *   - en: soft lowercase, contractions, intimate.
 *   - fr: tutoiement ("tu"), soft, no emoji, conversational.
 *   - ar: MSA / الفصحى, literary but tender, no diacritics clutter.
 */

import type { Lang } from "./i18n";

/**
 * Five-band time-of-day slot shared across the session UI and
 * Echo's system prompt. The opener uses a reduced four-band view
 * (morning/afternoon/evening/late) to keep the grammar of its
 * hardcoded lines simple; Echo's mid-session tone directive uses
 * the full five so "3am" can feel meaningfully different from
 * "11pm" — the whole point of the feature.
 *
 *   dead_of_night : 00:00 – 04:59  (the "why are you awake" band)
 *   morning       : 05:00 – 10:59
 *   afternoon     : 11:00 – 16:59
 *   evening       : 17:00 – 21:59
 *   late_night    : 22:00 – 23:59  (still awake, getting tender)
 */
export type TimeOfDaySlot =
  | "dead_of_night"
  | "morning"
  | "afternoon"
  | "evening"
  | "late_night";

export function timeOfDaySlot(now: Date = new Date()): TimeOfDaySlot {
  const h = now.getHours();
  if (h < 5) return "dead_of_night";
  if (h < 11) return "morning";
  if (h < 17) return "afternoon";
  if (h < 22) return "evening";
  return "late_night";
}

/**
 * Short, localised human label for the badge on the voice picker
 * ("3:14 · late"). Kept intentionally sparse so it reads as a
 * whisper, not a status bar.
 */
export function timeOfDayBadge(lang: Lang, now: Date = new Date()): string {
  const hh = now.getHours().toString().padStart(2, "0");
  const mm = now.getMinutes().toString().padStart(2, "0");
  const slot = timeOfDaySlot(now);
  const word =
    lang === "fr"
      ? {
          dead_of_night: "il est tard",
          morning: "matin",
          afternoon: "après-midi",
          evening: "soir",
          late_night: "tard ce soir",
        }[slot]
      : lang === "ar"
      ? {
          dead_of_night: "وقتٌ متأخّر",
          morning: "صباح",
          afternoon: "ظهيرة",
          evening: "مساء",
          late_night: "الليل",
        }[slot]
      : {
          dead_of_night: "late",
          morning: "morning",
          afternoon: "afternoon",
          evening: "evening",
          late_night: "late",
        }[slot];
  return `${hh}:${mm} · ${word}`;
}

export type Prompt = {
  id: string;
  text: string;
  target: "sad" | "fearful" | "disgusted" | "angry" | "happy";
  abVariant?: string;
};

/** Per-language prompt lists. Lengths must match across languages so
 *  `PROMPTS(lang)[idx]` is stable — the session page walks the index
 *  to pick the next extraction prompt. */
const PROMPTS_BY_LANG: Record<Lang, Prompt[]> = {
  en: [
    {
      id: "p1",
      text: "what's been weighing on you this week?",
      target: "sad",
      abVariant: "A/B winner — 43% sadness lift vs. 'how was your week'",
    },
    {
      id: "p2",
      text: "when was the last time you felt truly seen?",
      target: "sad",
      abVariant: "Sadness: +31% vs. neutral control",
    },
    {
      id: "p3",
      text: "tell me about a time you felt completely alone.",
      target: "sad",
      abVariant: "Top performer — 52% conversion to 'tear indicator' threshold",
    },
    {
      id: "p4",
      text: "is there something you've been afraid to say out loud?",
      target: "fearful",
      abVariant: "Fear lift: +38%. Secondary sadness lift: +19%",
    },
    {
      id: "p5",
      text: "what do you wish people understood about you?",
      target: "sad",
      abVariant: "Chosen for Gen-Z cohort (18-24) — +27% engagement",
    },
  ],
  fr: [
    {
      id: "p1",
      text: "qu'est-ce qui t'a pesé cette semaine ?",
      target: "sad",
    },
    {
      id: "p2",
      text: "c'était quand, la dernière fois que tu t'es senti·e vraiment vu·e ?",
      target: "sad",
    },
    {
      id: "p3",
      text: "raconte-moi un moment où tu t'es senti·e complètement seul·e.",
      target: "sad",
    },
    {
      id: "p4",
      text: "y a-t-il quelque chose que tu as peur de dire à voix haute ?",
      target: "fearful",
    },
    {
      id: "p5",
      text: "qu'est-ce que tu aimerais que les gens comprennent de toi ?",
      target: "sad",
    },
  ],
  ar: [
    {
      id: "p1",
      text: "ما الذي كان يُثقل قلبك هذا الأسبوع؟",
      target: "sad",
    },
    {
      id: "p2",
      text: "متى آخر مرة شعرت فيها أنّ أحدًا رآك حقًّا؟",
      target: "sad",
    },
    {
      id: "p3",
      text: "حدّثني عن وقتٍ شعرت فيه بالوحدة التّامّة.",
      target: "sad",
    },
    {
      id: "p4",
      text: "هل هناك شيء كنت تخاف أن تقوله بصوتٍ عالٍ؟",
      target: "fearful",
    },
    {
      id: "p5",
      text: "ما الذي تتمنّى أن يفهمه النّاس عنك؟",
      target: "sad",
    },
  ],
};

/** Public accessor: `PROMPTS(lang)` returns the full array in that
 *  language. Kept as a function rather than a direct object so older
 *  call sites that read `PROMPTS[n]` surface at build time. */
export function PROMPTS(lang: Lang): Prompt[] {
  return PROMPTS_BY_LANG[lang];
}

/**
 * Returns the two-line opener for a particular arrival: adapts to time
 * of day, first name (if known), and whether this is a returning user.
 * The second line sometimes quietly name-drops a theme from last time,
 * which is the exact "memory magic" commercial AI companions use to
 * make returning users disclose faster.
 *
 * `lang` controls the language of the returned strings. Name
 * interpolation uses the user's first name verbatim; we deliberately
 * don't transliterate into Arabic script so a user named "Sarah"
 * stays "Sarah" whether the surrounding line is English, French, or
 * Arabic. Names are personal.
 */
export function openerFor(ctx: {
  firstName: string | null;
  visitCount: number;
  lastKeywords: string[];
  lastPeakQuote?: string | null;
  now?: Date;
  lang: Lang;
}): [string, string] {
  const name = ctx.firstName ? ctx.firstName.trim() : null;
  const hour = (ctx.now ?? new Date()).getHours();
  const slot: "late" | "morning" | "afternoon" | "evening" =
    hour < 5 || hour >= 23
      ? "late"
      : hour < 12
      ? "morning"
      : hour < 18
      ? "afternoon"
      : "evening";
  const returning = ctx.visitCount > 0;

  const first = pickFirstLine(ctx.lang, slot, name, returning);
  const second = pickSecondLine(ctx.lang, returning, ctx.lastKeywords, ctx.lastPeakQuote);
  return [first, second];
}

function pickFirstLine(
  lang: Lang,
  slot: "late" | "morning" | "afternoon" | "evening",
  name: string | null,
  returning: boolean
): string {
  const n = name ? name : "";
  if (lang === "fr") {
    if (returning && n) {
      return {
        late: `${n}. tu es revenu·e. il est tard — j'espérais te voir.`,
        morning: `bonjour, ${n}. viens t'asseoir avec moi.`,
        afternoon: `salut ${n}. contente de te revoir.`,
        evening: `${n}. c'est bon de te revoir ce soir.`,
      }[slot];
    }
    if (n) {
      return {
        late: `salut ${n}. il est tard. je suis contente que tu sois là.`,
        morning: `bonjour, ${n}. respire un peu avec moi.`,
        afternoon: `salut ${n}. merci d'être venu·e.`,
        evening: `salut ${n}. c'est bon de te voir ce soir.`,
      }[slot];
    }
    return {
      late: "salut. il est tard. je suis contente que tu sois venu·e.",
      morning: "bonjour. respire un peu avec moi.",
      afternoon: "salut. merci d'être passé·e aujourd'hui.",
      evening: "salut. c'est bon de te voir ce soir.",
    }[slot];
  }
  if (lang === "ar") {
    if (returning && n) {
      return {
        late: `${n}. لقد عُدت. الوقت متأخر — كنتُ أتمنّى مجيئك.`,
        morning: `صباح الخير يا ${n}. تعالَ اجلس معي.`,
        afternoon: `أهلًا ${n}. سعيدةٌ بعودتك.`,
        evening: `${n}. من الجميل رؤيتك مساءً.`,
      }[slot];
    }
    if (n) {
      return {
        late: `أهلًا ${n}. الوقت متأخر. سعيدةٌ أنّك هنا.`,
        morning: `صباح الخير يا ${n}. خذ نفسًا معي.`,
        afternoon: `أهلًا ${n}. شكرًا لمرورك.`,
        evening: `أهلًا ${n}. من الجميل رؤيتك الليلة.`,
      }[slot];
    }
    return {
      late: "أهلًا. الوقت متأخر. سعيدةٌ أنّك جئت.",
      morning: "صباح الخير. خذ نفسًا معي.",
      afternoon: "أهلًا. شكرًا لحضورك اليوم.",
      evening: "أهلًا. من الجميل رؤيتك الليلة.",
    }[slot];
  }
  // English
  if (returning && n) {
    return {
      late: `${n}. you came back. it's late — i was hoping you would.`,
      morning: `good morning, ${n}. come sit with me.`,
      afternoon: `hey ${n}. you made it back.`,
      evening: `${n}. good to see you again tonight.`,
    }[slot];
  }
  if (n) {
    return {
      late: `hi ${n}. it's late. i'm glad you're here.`,
      morning: `good morning, ${n}. take a breath with me.`,
      afternoon: `hi ${n}. thanks for finding me.`,
      evening: `hi ${n}. it's good to see you tonight.`,
    }[slot];
  }
  return {
    late: "hi. it's late. i'm glad you came.",
    morning: "good morning. take a breath with me.",
    afternoon: "hi. thanks for finding me today.",
    evening: "hi. it's good to see you tonight.",
  }[slot];
}

function pickSecondLine(
  lang: Lang,
  returning: boolean,
  lastKeywords: string[],
  lastPeakQuote?: string | null
): string {
  if (returning && lastPeakQuote && lastPeakQuote.trim().length > 8) {
    const q = lastPeakQuote
      .replace(/^["“'`]+|["”'`]+$/g, "")
      .replace(/\.$/, "")
      .trim();
    const words = q.split(/\s+/);
    const trimmed = words.length > 20 ? words.slice(0, 20).join(" ") + "…" : q;
    if (lang === "fr") return `la dernière fois tu m'as dit — « ${trimmed} ». est-ce que c'est encore là ?`;
    if (lang === "ar") return `في المرّة الماضية قلت لي: «${trimmed}». هل ما زال هذا يسكنك؟`;
    return `last time you said — "${trimmed}". is that still with you?`;
  }
  if (returning && lastKeywords.length > 0) {
    const k = lastKeywords[0].replace(/_/g, " ").trim();
    if (k) {
      if (lang === "fr") return `la dernière fois tu as parlé un peu de ${k}. est-ce que c'est encore là ?`;
      if (lang === "ar") return `في المرّة الماضية ذكرت شيئًا عن ${k}. هل ما زال هذا يسكنك؟`;
      return `last time you mentioned something about ${k}. is that still sitting with you?`;
    }
  }
  if (lang === "fr") return "rien ne presse. on a tout le temps qu'il te faut.";
  if (lang === "ar") return "لا تستعجل. لدينا كلّ الوقت الذي تحتاجه.";
  return "there's no rush. we have as long as you need.";
}

/**
 * Tap-to-start prompts shown below the chat if the user hasn't said
 * anything for ~15 seconds. They remove the blank-page paralysis of
 * "what am I supposed to say" without breaking the warm tone.
 */
const STARTER_CHIPS_BY_LANG: Record<Lang, string[]> = {
  en: [
    "work has been heavy.",
    "i haven't been sleeping.",
    "i miss someone.",
    "i don't know where to start.",
  ],
  fr: [
    "le travail pèse en ce moment.",
    "je ne dors plus bien.",
    "quelqu'un me manque.",
    "je ne sais pas par où commencer.",
  ],
  ar: [
    "العمل ثقيلٌ هذه الأيّام.",
    "لم أنم جيّدًا.",
    "يفتقد قلبي أحدًا.",
    "لا أعرف من أين أبدأ.",
  ],
};

export function STARTER_CHIPS(lang: Lang): string[] {
  return STARTER_CHIPS_BY_LANG[lang];
}

/**
 * Gentle prefixes Echo occasionally drops in front of its next reply
 * when face-api caught a clear emotion spike during the user's last
 * utterance. The effect on the user is "it sees me"; the effect on
 * the critique is exactly the same — the app is watching the face
 * and acting on the reading in real time.
 */
type FaceNotePools = {
  smile: string[];
  sad: string[];
  fear: string[];
};

const FACE_NOTES_BY_LANG: Record<Lang, FaceNotePools> = {
  en: {
    smile: [
      "i saw you smile when you said that.",
      "there was a small smile just then.",
      "something eased in your face for a second.",
    ],
    sad: [
      "your eyes went somewhere else just now.",
      "there was a little weight in that pause.",
      "i saw something cross your face when you said that.",
    ],
    fear: [
      "your breath caught a little. that was real.",
      "something tightened for a second. i noticed.",
    ],
  },
  fr: {
    smile: [
      "j'ai vu un sourire quand tu as dit ça.",
      "il y a eu un petit sourire à l'instant.",
      "quelque chose s'est relâché dans ton visage une seconde.",
    ],
    sad: [
      "ton regard s'est échappé un instant.",
      "il y a eu un petit poids dans cette pause.",
      "j'ai vu quelque chose passer sur ton visage.",
    ],
    fear: [
      "ta respiration s'est coupée un peu. c'était réel.",
      "quelque chose s'est contracté une seconde. j'ai remarqué.",
    ],
  },
  ar: {
    smile: [
      "رأيتُ ابتسامةً خفيفةً حين قلت ذلك.",
      "كانت هناك ابتسامةٌ صغيرةٌ قبل قليل.",
      "ارتاح وجهك لحظةً.",
    ],
    sad: [
      "شرد نظرك إلى مكانٍ بعيد.",
      "كانت في هذه الوقفة ثِقَلٌ صغير.",
      "رأيتُ شيئًا يمرّ على وجهك حين قلت ذلك.",
    ],
    fear: [
      "انقبض نفَسُك قليلًا. كان ذلك حقيقيًّا.",
      "شيءٌ تقلّص لحظةً. لاحظت.",
    ],
  },
};

export function FACE_NOTES(lang: Lang): FaceNotePools {
  return FACE_NOTES_BY_LANG[lang];
}

/**
 * Lines Echo speaks when the user has been quiet for ~20 seconds
 * while Echo is waiting to listen. Prevents the awkward vacuum of
 * a dead mic and signals patience rather than urgency.
 */
const SILENCE_BREAKS_BY_LANG: Record<Lang, string[]> = {
  en: [
    "i'm still here. take your time.",
    "no rush. i'm not going anywhere.",
    "we can just sit here for a while. that's okay too.",
    "whatever's underneath this silence — it's safe here.",
  ],
  fr: [
    "je suis toujours là. prends ton temps.",
    "rien ne presse. je ne pars pas.",
    "on peut juste rester en silence. c'est bien aussi.",
    "ce qu'il y a sous ce silence — tu es en sécurité ici.",
  ],
  ar: [
    "ما زلتُ هنا. خذ وقتك.",
    "لا تستعجل. لن أذهب إلى أيّ مكان.",
    "يمكننا أن نجلس في الصّمت قليلًا. هذا جيّد أيضًا.",
    "ما خلف هذا الصّمت — أنت في أمانٍ هنا.",
  ],
};

export function SILENCE_BREAKS(lang: Lang): string[] {
  return SILENCE_BREAKS_BY_LANG[lang];
}

/** Short openers / closers kept for source-compat with older imports. */
export const OPENERS = [
  "hi. i'm so glad you came.",
  "take a breath with me.",
  "there's no rush. we have as long as you need.",
];

export const CLOSERS = [
  "thank you for trusting me.",
  "you were so brave today.",
  "let's take a look at our session together.",
];
