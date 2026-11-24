// packages/usage-stats/preview.js
//
// Preview mode (1.8.3): what Usage Statistics looks like, for players who haven't
// opted in. Everything is SAMPLE data, made up here from the game's own card and
// artifact list, and the window says so on every view. Nothing is sent or read
// from the server.

const SOULS = ["DETERMINATION", "BRAVERY", "INTEGRITY", "JUSTICE", "KINDNESS", "PATIENCE", "PERSEVERANCE"];
const DIVS = ["LEGEND", "ULTIMATE_MASTER", "HIGH_MASTER", "MASTER"];

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// cards: [{ id }], arts: [{ id }] from the game's lists.
export function sampleFiles(cards, arts, now = Date.now()) {
  const r = rng(7);
  const pickC = cards.slice(0, 400).filter((_, i) => i % 3 === 0).slice(0, 90);
  const pickA = arts.slice(0, 40);
  const sel = (players, games, spread) => {
    const pg = players;
    const souls = SOULS.map((s, i) => { const g = Math.round(games * [0.24, 0.18, 0.15, 0.14, 0.11, 0.1, 0.08][i]); const p = Math.max(1, Math.round(pg * g / games)); const w = Math.round(g * (0.44 + r() * 0.12)); return [s, g, w, p, p, Math.round(p * w / Math.max(1, g) * 100) / 100]; });
    const soulBy = new Map(souls.map((x) => [x[0], x]));
    const cardsRows = pickC.map((c, i) => {
      const use = Math.max(0.02, Math.min(0.9, (spread / (i + 3)) + r() * 0.08));
      // A soul's own spell is only in that soul's decks: its numbers are a share of the soul's (never above 100%).
      const so = Number(c.typeCard) === 1 && c.soul && soulBy.get(typeof c.soul === "object" ? c.soul.name : c.soul);
      const g = Math.round((so ? so[1] : games) * use), p = so ? Math.min(so[3], Math.max(1, Math.round(so[3] * use))) : Math.max(1, Math.round(pg * use));
      const w = Math.round(g * (0.4 + r() * 0.22));
      return [c.id, g, w, Math.round(g * (1.2 + r())), p, p, Math.round(p * (w / Math.max(1, g)) * 100) / 100, Math.round(p * 1.6 * 100) / 100];
    }).filter((x) => x[1] > 0);
    // A deck takes 1-2 artifacts, so their shares add up to between 100% and 200% (here about 175%).
    const artRaw = pickA.map((_, i) => Math.max(0.03, 0.5 / (i + 1)));
    const artScale = 1.75 / (artRaw.reduce((n, x) => n + x, 0) || 1);
    const artRows = pickA.map((a, i) => { const g = Math.round(games * Math.min(0.9, artRaw[i] * artScale)); const p = Math.max(1, Math.round(pg * g / games)); const w = Math.round(g * (0.42 + r() * 0.16)); return [a.id, g, w, p, p, Math.round(p * w / Math.max(1, g) * 100) / 100]; });
    const combos = [];
    // Each soul's artifacts as a share of THAT soul's games/players (never above 100%; decks take 2 artifacts, so shares add up to about 200%).
    for (const so of souls.slice(0, 4)) {
      const [soul, sg, , sp, spg] = so;
      const raw = [0.72, 0.55, 0.33, 0.22, 0.12, 0.06].map((x) => x * (0.85 + r() * 0.3));
      const k = 1.75 / raw.reduce((n, x) => n + x, 0); // 1-2 artifacts per deck: about 175% per soul
      const shares = raw.map((x) => Math.min(0.9, x * k));
      pickA.slice(0, 6).forEach((a, i) => {
        const g = Math.round(sg * shares[i]), p = Math.min(sp, Math.max(1, Math.round(sp * shares[i]))), pgs = Math.round(spg * shares[i] * 100) / 100;
        const w = Math.round(g * (0.4 + r() * 0.25));
        if (g > 0) combos.push([soul, a.id, g, w, p, pgs, Math.round(pgs * w / Math.max(1, g) * 100) / 100]);
      });
    }
    return { games, players, souls, cards: cardsRows, arts: artRows, combos, hidden: { cards: 0, arts: 0 } };
  };
  const make = (window, games, players) => {
    const out = { format: 1, window, built: now - 9 * 60e3, private: true, minPlayers: 3, allReady: false, preview: true, counts: { TODAY: 38, WEEK: 412, SEASON: 1250 }, sel: {} };
    out.sel.TOTAL = sel(players, games, 3);
    DIVS.forEach((d, i) => { out.sel[d] = sel(Math.max(3, Math.round(players * [0.12, 0.2, 0.3, 0.38][i])), Math.round(games * [0.1, 0.2, 0.3, 0.4][i]), 2.5); });
    out.sel.UNRANKED = sel(Math.round(players * 0.3), Math.round(games * 0.2), 2);
    out.sel.TRUEHUB = sel(Math.max(3, Math.round(players * 0.1)), Math.round(games * 0.08), 2);
    if (window === "WEEK") for (const k of Object.keys(out.sel)) {
      const s = out.sel[k];
      s.prev = { games: s.games, players: s.players, cards: s.cards.map((x) => { const f = 0.7 + r() * 0.3; return [x[0], Math.round(x[1] * f), Math.round(x[5] * f * 100) / 100]; }), arts: s.arts.map((x) => [x[0], x[1], x[4]]), souls: s.souls.map((x) => [x[0], x[1], x[4]]) };
    }
    return out;
  };
  return { TODAY: make("TODAY", 38, 14), WEEK: make("WEEK", 412, 46), SEASON: make("SEASON", 1250, 84), ALL: { format: 1, window: "ALL", locked: true, preview: true, counts: { ALL: 0 }, sel: {} } };
}

// A made-up player's season: three decks (one tuned partway through), ranked climbs.
export function sampleGames(cards, arts, now = Date.now()) {
  const r = rng(11);
  const ids = cards.slice(0, 300).map((c) => c.id);
  // Spread over whatever the catalogue holds, so the three decks never share cards (a short list gives smaller decks).
  const size = Math.max(3, Math.min(14, Math.floor(ids.length / 4)));
  const cut = (k) => Math.floor((ids.length * k) / 4);
  const deck = (start) => ids.slice(start, start + size).map((id, i) => [id, i % 3 === 0 ? 2 : 1]);
  const a = deck(cut(0)), b = deck(cut(1)), c = deck(cut(2));
  const extra = ids.slice(cut(3), cut(3) + 2);
  const a2 = a.slice(0, Math.max(1, a.length - 2)).concat(extra.map((id, i) => [id, i ? 1 : 2]));
  const art = (n) => arts.slice(n, n + 2).map((x) => x.id);
  const plans = [["DETERMINATION", a, art(0)], ["DETERMINATION", a2, art(0)], ["PATIENCE", b, art(3)], ["JUSTICE", c, art(6)]];
  const games = [];
  let elo = 1640, at = now - 20 * 864e5;
  for (let i = 0; i < 64; i++) {
    const [soul, d, ar] = plans[i < 18 ? 0 : i < 40 ? (i % 3 === 0 ? 2 : 1) : i % 2 ? 3 : 1];
    const win = r() < (d === a2 ? 0.62 : 0.48);
    const old = elo; elo += win ? 12 + Math.round(r() * 6) : -(10 + Math.round(r() * 6));
    const div = (e) => (e >= 2000 ? "LEGEND" : e >= 1800 ? "ULTIMATE_MASTER" : e >= 1650 ? "HIGH_MASTER" : "MASTER");
    at += (i % 6 === 0 ? 20 * 3600e3 : 0) + 9 * 60e3 + Math.round(r() * 8 * 60e3);
    games.push({ gameId: "preview" + i, at: Math.min(at, now - 60e3), soul, win, rankedUnlocked: true, oldDivision: div(old), newDivision: div(elo), oldElo: old, newElo: elo, enemySoul: SOULS[Math.floor(r() * 7)], deck: d, arts: ar });
  }
  return games;
}
