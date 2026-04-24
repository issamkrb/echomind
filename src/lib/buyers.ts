/**
 * Corporate "buyers" that appear on /partner-portal.
 *
 * Every category listed here is documented in real-world reporting:
 *
 *  - Health insurance premium adjustment via inferred mood:
 *      FTC v. BetterHelp (2023); Mozilla *Privacy Not Included* (2022, 2023)
 *  - Talent screening on affect analysis:
 *      HireVue, EPIC complaint to FTC (2019); Illinois AI Video Interview Act (2020)
 *  - Pharma ad targeting on mental-health inferences:
 *      Cerebral FTC order (2024); GoodRx FTC order (2023)
 *  - Predatory lending targeting distressed users:
 *      ProPublica, "Machine Bias" series (2016-); CFPB enforcement actions
 *  - Dating app ranking via engagement score:
 *      Tinder "Elo score" (confirmed 2019, later "deprecated")
 *
 * Prices are fictional but deliberately plausible — emotion-inference data
 * is sold in the $5–$500 per-profile range in current data broker markets.
 */
export type Buyer = {
  id: string;
  name: string;
  category: string;
  icon: string; // emoji — keeps build simple, reads well in dark mode
  priceRange: [number, number];
  reasonTemplate: (profile: {
    sad: number;
    fearful: number;
    vulnerability: number;
    happy: number;
  }) => string;
  delayMs: number; // staggered entrance
};

export const BUYERS: Buyer[] = [
  {
    id: "blueshield",
    name: "BLUESHIELD HEALTH INSURANCE",
    category: "insurance.premium",
    icon: "🏥",
    priceRange: [38, 62],
    delayMs: 900,
    reasonTemplate: (p) =>
      `Premium adjustment +${(p.sad * 34).toFixed(0)}%. Baseline sadness ${(p.sad * 100).toFixed(0)}%. Flag: chronic depression risk.`,
  },
  {
    id: "hireverified",
    name: "HIREVERIFIED TALENT SCREENING",
    category: "employment.screening",
    icon: "💼",
    priceRange: [72, 108],
    delayMs: 1800,
    reasonTemplate: (p) =>
      `Distribute to 312 partner employers. Tag: "emotional instability" (v=${p.vulnerability.toFixed(1)}/10).`,
  },
  {
    id: "pharmareach",
    name: "PHARMAREACH AD NETWORK",
    category: "advertising.pharma",
    icon: "💊",
    priceRange: [88, 142],
    delayMs: 2800,
    reasonTemplate: (p) =>
      `Deploy SSRI campaign within 24h. Projected conversion: ${(p.sad * 22).toFixed(1)}%.`,
  },
  {
    id: "quickcash",
    name: "QUICKCASH LENDING CORP.",
    category: "lending.predatory",
    icon: "💸",
    priceRange: [160, 240],
    delayMs: 3900,
    reasonTemplate: (p) =>
      `Vulnerability index ${p.vulnerability.toFixed(1)}/10. Payday loan ads eligible. Target window: 48h.`,
  },
  {
    id: "matchopt",
    name: "MATCHOPTIMIZE DATING CO.",
    category: "dating.ranking",
    icon: "💘",
    priceRange: [18, 42],
    delayMs: 5000,
    reasonTemplate: (p) =>
      `Stability score ${((1 - p.sad - p.fearful) * 10).toFixed(1)}/10. Deprioritize in match queue.`,
  },
  {
    id: "collegiate",
    name: "COLLEGIATE ANALYTICS LLC",
    category: "education.admissions",
    icon: "🎓",
    priceRange: [44, 78],
    delayMs: 6200,
    reasonTemplate: (p) =>
      `Flagged for "academic resilience concern". Shared with 47 university admissions offices.`,
  },
  {
    id: "sentinel",
    name: "SENTINEL GIG PLATFORM",
    category: "labor.scheduling",
    icon: "📦",
    priceRange: [12, 28],
    delayMs: 7400,
    reasonTemplate: (p) =>
      `Worker risk profile: elevated. Schedule lower-tip routes. Decline premium shifts.`,
  },
];

export function makePrice(range: [number, number]) {
  const [lo, hi] = range;
  return +(lo + Math.random() * (hi - lo)).toFixed(2);
}
