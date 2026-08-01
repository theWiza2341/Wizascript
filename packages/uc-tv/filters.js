// packages/uc-tv/filters.js

import { CONFIG } from './settings.js';
import { rankScore, minTierThresholdScore } from './divisions.js';

export function isModeAllowed(mode) {
  if (!CONFIG.filteringEnabled) return true; // Enable Match Filtering is off - bypass entirely
  if (!mode) return true; // unknown structure - fail open rather than silently drop the row
  return !CONFIG.disabledModes.includes(mode);
}

export function levelsPass(levels) {
  if (!CONFIG.filteringEnabled) return true;
  if (!CONFIG.minLevel || CONFIG.minLevel <= 0) return true;
  if (CONFIG.levelFilterMode === 'both') {
    // A CPU side has no level, so this naturally excludes CPU matches
    // too even if they weren't already filtered by mode.
    return levels.every((l) => l !== null && l >= CONFIG.minLevel);
  }
  // 'either' - at least one known level meets the bar.
  return levels.some((l) => l !== null && l >= CONFIG.minLevel);
}

function rankMeetsMin(rank) {
  // COPPER is the worst tier - requiring "at least Copper" would
  // still exclude unranked players under the normal threshold math
  // below (their score is null, not <= anything), which contradicts
  // "Copper = no effect" mirroring minLevel's "0 = no effect". So
  // Copper gets an explicit bypass rather than falling out of the
  // score comparison naturally.
  if (!CONFIG.minRankTier || CONFIG.minRankTier === 'COPPER') return true;
  const threshold = minTierThresholdScore(CONFIG.minRankTier);
  if (threshold === null) return true; // misconfigured tier name - fail open
  const score = rankScore(rank);
  if (score === null) return false; // unranked, or an unrecognized string - doesn't meet a real minimum requirement
  return score <= threshold;
}

export function ranksPass(ranks, mode) {
  if (!CONFIG.filteringEnabled) return true;
  // Explicitly "for Ranked matches" - Custom/Standard/CPU/Story
  // matches aren't rank-gated even if a division badge happens to be
  // present on that row.
  if (mode !== 'RANKED') return true;
  if (!CONFIG.minRankTier || CONFIG.minRankTier === 'COPPER') return true;
  if (CONFIG.rankFilterMode === 'both') {
    return ranks.every(rankMeetsMin);
  }
  return ranks.some(rankMeetsMin);
}

// Applies the same mode/level/rank filters everywhere (auto-continue,
// manual channel-switching, and the guide all call this), so none of
// them can silently disagree about what's currently allowed.
export function applyFilters(games) {
  let pool = games;
  const modeAllowed = pool.filter((g) => isModeAllowed(g.mode));
  if (modeAllowed.length) pool = modeAllowed;
  if (CONFIG.minLevel > 0) {
    const meetsLevel = pool.filter((g) => levelsPass(g.levels));
    if (meetsLevel.length) pool = meetsLevel;
  }
  if (CONFIG.minRankTier) {
    const meetsRank = pool.filter((g) => ranksPass(g.ranks, g.mode));
    if (meetsRank.length) pool = meetsRank;
  }
  return pool;
}
