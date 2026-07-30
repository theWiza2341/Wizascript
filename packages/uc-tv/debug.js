// packages/uc-tv/debug.js

import { LOG } from './settings.js';
import { fetchLiveGamesFull } from './game-list.js';

// Dumps every currently-live game with full per-player detail.
// Callable anytime from the console as __ucTVScope() while on a
// Spectate page.
export async function scopeActiveGames() {
  let scoped;
  try {
    scoped = await fetchLiveGamesFull();
  } catch (e) {
    console.error(`${LOG} [scope] Failed to fetch homepage:`, e);
    return [];
  }

  console.log(`${LOG} [scope] ${scoped.length} active game(s).`);
  console.table(scoped.flatMap((g) => g.players.map((p) => ({
    gameId: g.gameId,
    mode: g.mode,
    time: g.time,
    playerId: p.playerId,
    username: p.username,
    soul: p.soul,
    level: p.level,
    rank: p.rank
  }))));
  return scoped;
}
