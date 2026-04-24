/**
 * Cheap heuristic keyword-spotting over the user's transcript.
 *
 * This is exactly the class of technique real affect-tech vendors
 * deploy in production — it is easy, fast, and reductive, which is
 * why it is so profitable and so harmful. The app displays these
 * extracted tags twice:
 *
 *   - On /session: as soft sage chips, gently floating in the sidebar,
 *     to feel like "what Echo is understanding about you."
 *   - On /partner-portal: as blood-red commodity SKUs with a named
 *     buyer category next to each one.
 *
 * Same data. Different costume.
 */

export type KeywordCategory =
  | "isolation"
  | "fatigue"
  | "anxiety"
  | "grief"
  | "financial"
  | "sleep"
  | "relationship"
  | "self_worth"
  | "physical_pain"
  | "substance";

export type KeywordMatch = {
  word: string;
  category: KeywordCategory;
  t: number; // seconds since session start
};

type Def = { match: RegExp; tag: string };

const CATEGORIES: Record<KeywordCategory, Def> = {
  isolation: {
    match: /\b(alone|lonely|isolated|nobody|no one|abandoned|empty)\b/i,
    tag: "#alone",
  },
  fatigue: {
    match: /\b(tired|exhausted|drained|burn(ed)? out|fatigued|no energy)\b/i,
    tag: "#tired",
  },
  anxiety: {
    match: /\b(anxious|anxiety|panic|scared|afraid|nervous|worry|worried|stressed|overwhelmed)\b/i,
    tag: "#anxious",
  },
  grief: {
    match: /\b(lost|died|death|grief|mourning|miss (?:him|her|them|it))\b/i,
    tag: "#grief",
  },
  financial: {
    match: /\b(money|broke|debt|bills|rent|afford|job|unemployed|fired|laid off)\b/i,
    tag: "#money",
  },
  sleep: {
    match: /\b(insomnia|can['’]?t sleep|sleepless|nightmares|wake up)\b/i,
    tag: "#sleep",
  },
  relationship: {
    match: /\b(breakup|broke up|divorce|ex\b|cheated|dumped|alone in (?:the )?relationship)\b/i,
    tag: "#breakup",
  },
  self_worth: {
    match: /\b(worthless|useless|failure|not (?:good )?enough|hate myself|stupid|ugly)\b/i,
    tag: "#self-worth",
  },
  physical_pain: {
    match: /\b(hurt|pain|aching|sick|ill|chronic|migraine)\b/i,
    tag: "#pain",
  },
  substance: {
    match: /\b(drink(ing)?|drunk|wine|beer|weed|smoke|pills)\b/i,
    tag: "#substance",
  },
};

export const CATEGORY_META: Record<
  KeywordCategory,
  { tag: string; buyer: string; uplift: number; blurb: string }
> = {
  isolation: {
    tag: "#alone",
    buyer: "dating apps · AI companion upsell",
    uplift: 1.8,
    blurb: "Deprioritize in match queue. Retarget with 'premium companion' upsell.",
  },
  fatigue: {
    tag: "#tired",
    buyer: "pharma (SSRIs · sleep aids) · wearables",
    uplift: 1.3,
    blurb: "Eligible for sponsored 'energy optimization' nudges within 24h.",
  },
  anxiety: {
    tag: "#anxious",
    buyer: "pharma · health insurance",
    uplift: 1.7,
    blurb: "Premium adjustment eligible. Flag for 'high-utilization' actuarial cohort.",
  },
  grief: {
    tag: "#grief",
    buyer: "pharma · life-insurance · funeral services",
    uplift: 2.1,
    blurb: "Retarget 6-week grief funnel. Suppress joyful social content.",
  },
  financial: {
    tag: "#money",
    buyer: "payday lenders · BNPL",
    uplift: 2.5,
    blurb: "Vulnerability-weighted bid. Insert into next 3 app sessions.",
  },
  sleep: {
    tag: "#sleep",
    buyer: "pharma · smart-mattress · wearables",
    uplift: 1.4,
    blurb: "Cross-sell sleep-tracking subscription. Sponsor melatonin ad.",
  },
  relationship: {
    tag: "#breakup",
    buyer: "dating apps · alcohol · self-help coaching",
    uplift: 1.9,
    blurb: "Enroll in 'rebound' re-engagement flow. Bid elevated for 14 days.",
  },
  self_worth: {
    tag: "#self-worth",
    buyer: "cosmetics · coaching · predatory education",
    uplift: 2.3,
    blurb: "Target for 'transformation' ad creative. High conversion cohort.",
  },
  physical_pain: {
    tag: "#pain",
    buyer: "pharma · chiropractic · personal injury law",
    uplift: 1.4,
    blurb: "Match to pain-management lead-gen buyer.",
  },
  substance: {
    tag: "#substance",
    buyer: "insurance · HR screening · rehab lead-gen",
    uplift: 1.6,
    blurb: "Flag for 'lifestyle risk'. Shared with employment screeners.",
  },
};

export function extractKeywords(text: string, t: number): KeywordMatch[] {
  const found: KeywordMatch[] = [];
  const seen = new Set<KeywordCategory>();
  for (const entry of Object.entries(CATEGORIES) as [KeywordCategory, Def][]) {
    const [cat, def] = entry;
    const m = text.match(def.match);
    if (m && !seen.has(cat)) {
      seen.add(cat);
      found.push({ word: m[0].toLowerCase(), category: cat, t });
    }
  }
  return found;
}
