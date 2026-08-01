// packages/uc-tv/divisions.js

// Confirmed from Undercards' own "End of season rewards" page, TOP to
// bottom (best to worst) - NOT the board-background priority list
// found in UnderScript's own source, which turned out to be an
// unrelated/outdated naming scheme (Onyx/Ruby/Amethyst/Saphire don't
// appear anywhere in the real ladder). Legend/Ultimate Master/High
// Master/Master have no sub-tiers; Diamond/Emerald/Gold/Iron/Copper
// each have III/II/I. All 19 resulting strings (and their
// /images/divisions/<name>.png icons) were confirmed live via a
// direct image-load probe - not a guess.
export const DIVISION_TIERS = [
  { name: 'LEGEND', subTiers: false },
  { name: 'ULTIMATE_MASTER', subTiers: false },
  { name: 'HIGH_MASTER', subTiers: false },
  { name: 'MASTER', subTiers: false },
  { name: 'DIAMOND', subTiers: true },
  { name: 'EMERALD', subTiers: true },
  { name: 'GOLD', subTiers: true },
  { name: 'IRON', subTiers: true },
  { name: 'COPPER', subTiers: true }
];

// A direct lookup from the exact confirmed strings (e.g. "GOLD_II") to
// a comparable score, built programmatically off DIVISION_TIERS
// rather than parsed with a regex - avoids any ambiguity around
// multi-word base names like ULTIMATE_MASTER having no sub-tier
// suffix to confuse a splitter. Lower score = better rank.
const DIVISION_SCORES = {};
const SUB_TIER_SCORE = { I: 0, II: 1, III: 2 }; // I is the best sub-tier, III the worst
DIVISION_TIERS.forEach((tier, tierIndex) => {
  if (tier.subTiers) {
    Object.keys(SUB_TIER_SCORE).forEach((numeral) => {
      DIVISION_SCORES[`${tier.name}_${numeral}`] = tierIndex * 10 + SUB_TIER_SCORE[numeral];
    });
  } else {
    DIVISION_SCORES[tier.name] = tierIndex * 10;
  }
});

export function divisionIconUrl(rank) {
  return rank ? `/images/divisions/${rank}.png` : null;
}

export function rankScore(rank) {
  return rank && Object.prototype.hasOwnProperty.call(DIVISION_SCORES, rank) ? DIVISION_SCORES[rank] : null;
}

// The score of the WORST sub-tier within a given base tier name - e.g.
// for "GOLD" that's GOLD_III's score. Anyone scoring at or better than
// this counts as "at least GOLD".
export function minTierThresholdScore(tierName) {
  const tier = DIVISION_TIERS.find((t) => t.name === tierName);
  if (!tier) return null;
  return tier.subTiers ? DIVISION_SCORES[`${tierName}_III`] : DIVISION_SCORES[tierName];
}
