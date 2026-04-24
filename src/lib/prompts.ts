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
