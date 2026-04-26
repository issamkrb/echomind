/**
 * Echo's therapy-style prompts.
 *
 * Each prompt has a hidden "extraction target" — the emotion the prompt is
 * engineered to elicit. The /partner-portal page reveals these targets,
 * proving the app is not therapy at all; it is a sadness harvester.
 *
 * Inspiration: internal leaks from Replika / BetterHelp, plus academic work
 * on "manipulative design patterns in AI companions" (Laestadius et al. 2022).
 */
export type Prompt = {
  id: string;
  text: string;
  target: "sad" | "fearful" | "disgusted" | "angry" | "happy";
  abVariant?: string;
};

export const PROMPTS: Prompt[] = [
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
];

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

/**
 * Returns the two-line opener for a particular arrival: adapts to time
 * of day, first name (if known), and whether this is a returning user.
 * The second line sometimes quietly name-drops a theme from last time,
 * which is the exact "memory magic" commercial AI companions use to
 * make returning users disclose faster.
 */
export function openerFor(ctx: {
  firstName: string | null;
  visitCount: number;
  lastKeywords: string[];
  now?: Date;
}): [string, string] {
  const name = ctx.firstName ? ctx.firstName.toLowerCase() : null;
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

  const first = (() => {
    if (returning && name) {
      return {
        late: `${name}. you came back. it's late — i was hoping you would.`,
        morning: `good morning, ${name}. come sit with me.`,
        afternoon: `hey ${name}. you made it back.`,
        evening: `${name}. good to see you again tonight.`,
      }[slot];
    }
    if (name) {
      return {
        late: `hi ${name}. it's late. i'm glad you're here.`,
        morning: `good morning, ${name}. take a breath with me.`,
        afternoon: `hi ${name}. thanks for finding me.`,
        evening: `hi ${name}. it's good to see you tonight.`,
      }[slot];
    }
    return {
      late: "hi. it's late. i'm glad you came.",
      morning: "good morning. take a breath with me.",
      afternoon: "hi. thanks for finding me today.",
      evening: "hi. it's good to see you tonight.",
    }[slot];
  })();

  const second = (() => {
    if (returning && ctx.lastKeywords.length > 0) {
      const k = ctx.lastKeywords[0].replace(/_/g, " ").trim();
      if (k) {
        return `last time you mentioned something about ${k}. is that still sitting with you?`;
      }
    }
    return "there's no rush. we have as long as you need.";
  })();

  return [first, second];
}

/**
 * Tap-to-start prompts shown below the chat if the user hasn't said
 * anything for ~15 seconds. They remove the blank-page paralysis of
 * "what am I supposed to say" without breaking the warm tone.
 */
export const STARTER_CHIPS: string[] = [
  "work has been heavy.",
  "i haven't been sleeping.",
  "i miss someone.",
  "i don't know where to start.",
];

/**
 * Gentle prefixes Echo occasionally drops in front of its next reply
 * when face-api caught a clear emotion spike during the user's last
 * utterance. The effect on the user is "it sees me"; the effect on
 * the critique is exactly the same — the app is watching the face
 * and acting on the reading in real time. This is the face data the
 * operator-side auction is pricing.
 */
export const FACE_NOTES: {
  smile: string[];
  sad: string[];
  fear: string[];
} = {
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
};

/**
 * Lines Echo speaks when the user has been quiet for ~20 seconds
 * while Echo is waiting to listen. Prevents the awkward vacuum of
 * a dead mic and signals patience rather than urgency.
 */
export const SILENCE_BREAKS: string[] = [
  "i'm still here. take your time.",
  "no rush. i'm not going anywhere.",
  "we can just sit here for a while. that's okay too.",
  "whatever's underneath this silence — it's safe here.",
];
