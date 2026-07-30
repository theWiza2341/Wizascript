// packages/uc-tv/channel-switch.js

import { LOG, CONFIG, logDebug } from './settings.js';
import { fetchLiveGames, parseElapsedSeconds } from './game-list.js';
import { applyFilters } from './filters.js';
import { showCountdown } from './countdown.js';
import { isTypingContext, navigationReady } from './utils.js';

export async function goToNextMatch(plugin) {
  let games;
  try {
    games = await fetchLiveGames();
  } catch (e) {
    console.warn(`${LOG} Failed to fetch the live games list - staying put.`, e);
    return;
  }

  const currentGameId = new URLSearchParams(location.search).get('gameId');
  const candidates = games.filter((g) => g.gameId !== currentGameId);
  const pool = applyFilters(candidates);

  if (!pool.length) {
    logDebug('No other live matches found right now - staying put.');
    return;
  }

  // Least elapsed time first, computed explicitly rather than trusted
  // from table order - a freshly-started match gives the most runway
  // before it ends too, which is the whole point of moving off random
  // selection. Entries with unparseable time sort last rather than
  // being preferred by accident.
  const sorted = [...pool].sort((a, b) => {
    const ta = parseElapsedSeconds(a.time);
    const tb = parseElapsedSeconds(b.time);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta - tb;
  });
  const next = sorted[0];
  logDebug(`Chose gameId=${next.gameId}, playerId=${next.playerId}, elapsed=${next.time} (levels: ${next.levels.join(', ')}). ${pool.length} candidate(s) considered.`);
  showCountdown(plugin, CONFIG.countdownSeconds, () => {
    location.href = `/Spectate?gameId=${next.gameId}&playerId=${next.playerId}`;
  });
}

let switching = false;

async function switchChannel(plugin, direction) {
  if (switching) return;
  if (!navigationReady()) return;
  switching = true;
  try {
    let games;
    try {
      games = await fetchLiveGames();
    } catch (e) {
      console.warn(`${LOG} [channel] Failed to fetch live games:`, e);
      return;
    }

    const pool = applyFilters(games);
    if (!pool.length) {
      logDebug('[channel] No games available to switch to.');
      return;
    }

    const currentGameId = new URLSearchParams(location.search).get('gameId');
    const currentIndex = pool.findIndex((g) => g.gameId === currentGameId);

    let targetIndex;
    if (currentIndex === -1) {
      // Current match isn't in the (possibly filtered) list - e.g. it
      // just ended, or its own mode/level doesn't pass the current
      // filters. Land on the first (Right) or last (Left) slot rather
      // than guessing at a neighbor of an unknown position.
      targetIndex = direction > 0 ? 0 : pool.length - 1;
    } else {
      targetIndex = (((currentIndex + direction) % pool.length) + pool.length) % pool.length;
    }

    const target = pool[targetIndex];
    logDebug(`[channel] Switching to gameId=${target.gameId} (slot ${targetIndex + 1}/${pool.length}).`);
    if (plugin && typeof plugin.toast === 'function') {
      plugin.toast({ title: 'UC TV', text: `Channel ${targetIndex + 1}/${pool.length}` });
    }
    location.href = `/Spectate?gameId=${target.gameId}&playerId=${target.playerId}`;
  } finally {
    switching = false; // irrelevant on the navigate-away path, matters on early returns
  }
}

export function bindChannelKeybinds(plugin) {
  document.addEventListener('keydown', (e) => {
    if (!CONFIG.masterEnabled) return;
    if (!e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (isTypingContext()) return; // don't hijack cursor movement while typing (e.g. in chat)
    e.preventDefault();
    switchChannel(plugin, e.key === 'ArrowRight' ? 1 : -1);
  });
}
