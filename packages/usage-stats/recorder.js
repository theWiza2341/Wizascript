// packages/usage-stats/recorder.js
//
// Records the player's own PvP games on /Game (never CPU games, never while
// spectating). Everything comes from what the game already shows the player:
//  - match start (`connect`): the opponent's name and soul, and the player's
//    own STARTING deck + artifacts, read from their saved deck for this soul
//    (UnderScript's user.getDecks(); start-of-game effects can't be in it);
//  - the end message (`getVictory` / `getDefeat`): soul, division and Elo
//    before/after (placed players), whether the player is placed.
// Nothing is worked out about the opponent's cards, and nothing during play.

import { getPageWindow } from "../core/page-window.js";
import { selfInfo } from "../core/account.js";
import { enqueue, flush } from "./api.js";
import { log, ensureAccount } from "./common.js";

// Souls arrive as { id, name } objects, or as that object JSON-stringified on the
// connect message ('{"id":6,"name":"PATIENCE"}'), or as a bare name.
const nameOf = (s) => {
  if (typeof s === "string" && s.trim().startsWith("{")) { try { s = JSON.parse(s); } catch (e) { return null; } }
  return s && typeof s === "object" ? s.name || null : typeof s === "string" && /^[A-Z]+$/.test(s) ? s : null;
};
const parse = (v) => { try { return typeof v === "string" ? JSON.parse(v) : v || {}; } catch (e) { return {}; } };

export function startRecorder(plugin) {
  let match = null;
  plugin.events.on("connect", (data) => {
    try {
      const w = getPageWindow();
      if (!data || data.gameType !== "RANKED") { match = null; return; }
      const enemy = parse(data.enemy), you = parse(data.you);
      const soul = nameOf(w.yourSoul) || nameOf(data.yourSoul) || nameOf(you.soul);
      const prev = match && match.gameId === data.gameId ? match : null; // a reconnect keeps the deck read before
      match = {
        gameId: data.gameId !== undefined && data.gameId !== null ? String(data.gameId) : null,
        soul,
        enemyName: enemy.username || null,
        enemySoul: nameOf(w.enemySoul) || nameOf(data.enemySoul) || nameOf(enemy.soul),
        deck: prev ? prev.deck : null,
        artifacts: prev ? prev.artifacts : null
      };
      if (match.deck) return;
      const us = w.underscript;
      if (!us || !us.user || typeof us.user.getDecks !== "function") { log("no getDecks (UnderScript 0.65+): the deck isn't sent"); return; }
      const m = match;
      Promise.resolve(us.user.getDecks()).then((decks) => {
        const d = decks && decks[soul];
        if (!d) return;
        const counts = {};
        for (const c of d.cards || []) if (c && Number.isInteger(c.id)) counts[c.id] = (counts[c.id] || 0) + 1;
        m.deck = Object.entries(counts).map(([id, n]) => [Number(id), Math.min(3, n)]);
        m.artifacts = (d.artifacts || []).map((a) => a && a.id).filter(Number.isInteger);
        log(`deck read: ${(d.cards || []).length} cards, ${m.artifacts.length} artifact(s)`);
      }).catch((e) => log("deck read failed:", e && e.message));
    } catch (e) { log("connect:", e); }
  });

  const onEnd = (win) => (data) => {
    try {
      if (!data || data.gameType !== "RANKED") return;
      const at = Date.now();
      const self = selfInfo();
      const m = match || {};
      const game = {
        gameId: m.gameId || `${self.selfId || "x"}-${Math.floor(at / 1000)}`,
        at,
        soul: data.soul || m.soul,
        win,
        rankedUnlocked: !!data.rankedUnlocked,
        oldDivision: data.oldDivision || null,
        newDivision: data.newDivision || null,
        oldElo: Number.isInteger(data.oldElo) ? data.oldElo : null,
        newElo: Number.isInteger(data.newElo) ? data.newElo : null,
        enemyName: m.enemyName || null,
        enemySoul: m.enemySoul || null,
        deck: m.deck || [],
        artifacts: m.artifacts || []
      };
      match = null;
      if (!game.soul) return;
      ensureAccount().then((name) => {
        if (!name) { log("not linked: game not kept"); return; }
        enqueue(game);
        setTimeout(() => flush(), 1500);
      });
      log(`recorded: ${win ? "win" : "loss"} ${game.soul} vs ${game.enemyName} (${game.oldDivision || "Unranked"} ${game.oldElo ?? ""}→${game.newElo ?? ""})`);
    } catch (e) { log("end:", e); }
  };
  plugin.events.on("getVictory", onEnd(true));
  plugin.events.on("getDefeat", onEnd(false));
}
