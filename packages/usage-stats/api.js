// packages/usage-stats/api.js
//
// The plugin's side of the Wizascript server (Worker 1.8, claude/worker-1.8.md):
//  - recorded games wait in a GM queue and go up to 20 at a time (retried on the
//    next page load if the server can't be reached);
//  - the player's own games per season (Profile, History), cached briefly;
//  - the published statistics (the Usage Statistics window);
//  - opting out (deletes everything sent under the account).

import { authed, call, accountChanged, selfInfo } from "../core/account.js";
import { ensureAccount, seasonOf, log } from "./common.js";

const QUEUE = "wizascript.usageStats.queue"; // [{ player, playerId, game }]
const GAMES_CACHE = "wizascript.usageStats.games"; // { [season]: { at, data } }
const MAX_QUEUE = 200;
const MAX_AGE = 29 * 24 * 3600e3; // the server takes games up to 30 days old
const GAMES_TTL = 10 * 60e3;

const read = (k, d) => { try { return JSON.parse(GM_getValue(k, "null")) || d; } catch (e) { return d; } };
const write = (k, v) => { try { GM_setValue(k, JSON.stringify(v)); } catch (e) { /* no GM */ } };

export const queued = () => read(QUEUE, []);

// A finished game, from the recorder.
export function enqueue(game) {
  const self = selfInfo();
  const q = queued().filter((x) => x.game && Date.now() - x.game.at < MAX_AGE);
  if (q.some((x) => x.game.gameId === game.gameId)) return;
  q.push({ player: self.selfName, playerId: self.selfId, game });
  write(QUEUE, q.slice(-MAX_QUEUE));
}

let flushing = null;
export function flush() {
  if (!flushing) flushing = doFlush().finally(() => { flushing = null; });
  return flushing;
}
async function doFlush() {
  let q = queued();
  if (!q.length) return 0;
  if (!(await ensureAccount())) return 0; // no linked account: nothing is sent (the queue waits)
  let sent = 0;
  // One request per player (an alt's games go under the linked account too), 20 at a time.
  while (q.length) {
    const who = q[0];
    const batch = q.filter((x) => x.player === who.player && x.playerId === who.playerId).slice(0, 20);
    try {
      const r = await authed("POST", "/v1/games", { player: who.player, playerId: who.playerId, games: batch.map((x) => x.game) });
      sent += r.saved || 0;
    } catch (e) {
      if (e.code === "renamed") { accountChanged(null, null); log("account renamed: unlinked; games kept until it's linked again"); return sent; }
      if (e.code === "bad_games") { /* nothing in this batch is usable: drop it */ } else { log("couldn't send games:", e.message); return sent; }
    }
    const done = new Set(batch.map((x) => x.game.gameId));
    q = queued().filter((x) => !done.has(x.game.gameId));
    write(QUEUE, q);
    batch.forEach((x) => dropGamesCache(seasonOf(x.game.at)));
  }
  log(`sent ${sent} game(s)`);
  return sent;
}

// ---- your own games (Profile, History) --------------------------------------------------
function dropGamesCache(season) {
  const c = read(GAMES_CACHE, {});
  if (c[season]) { delete c[season]; write(GAMES_CACHE, c); }
}
export async function myGames(season, { fresh = false } = {}) {
  const c = read(GAMES_CACHE, {});
  const hit = c[season];
  if (!fresh && hit && Date.now() - hit.at < GAMES_TTL) return hit.data;
  const data = await authed("GET", `/v1/games?season=${encodeURIComponent(season)}`);
  const keep = {};
  // keep at most 4 seasons cached
  Object.entries(c).sort((a, b) => b[1].at - a[1].at).slice(0, 3).forEach(([k, v]) => { keep[k] = v; });
  keep[season] = { at: Date.now(), data };
  write(GAMES_CACHE, keep);
  return data;
}

export async function optOut() {
  const r = await authed("POST", "/v1/games/optout");
  write(QUEUE, []);
  write(GAMES_CACHE, {});
  return r.deleted || 0;
}
export const clearLocal = () => { write(QUEUE, []); write(GAMES_CACHE, {}); };

// ---- the published statistics --------------------------------------------------------------
const statsCache = {};
export function getStats(w) {
  const hit = statsCache[w];
  if (hit && Date.now() - hit.at < 5 * 60e3) return hit.p;
  const p = call("GET", `/v1/stats?w=${w}`).catch((e) => { delete statsCache[w]; throw e; });
  statsCache[w] = { at: Date.now(), p };
  return p;
}
