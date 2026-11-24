// packages/usage-stats/mine.js
//
// "My Stats" in the Usage Statistics window (1.8.3): everything here comes from the
// player's OWN recorded games (one account at a time: main or an alt), compared with
// the community's numbers where that helps.
//  - Overview: record, streaks, sessions (games less than 45 minutes apart), and soul
//    matchups (the opponent's soul is public; their name never leaves the device);
//  - Decks: the deck tracker. Each game's starting deck is a "version"; versions of the
//    same soul that share most cards are one deck (a "family"). Shows each deck's record,
//    its versions and what changed, and how its cards compare with the meta;
//  - Cards: your win rate with each card in your decks, next to the community's.
// The pure helpers (summary, sessions, matchups, deckFamilies, cardRates) take a list of
// games and are tested on their own.

const SESSION_GAP = 45 * 60e3;
const SIMILAR = 0.6; // share of card copies two versions must have in common to be one deck
const NAMES_KEY = "wizascript.usageStats.deckNames"; // { familyKey: "name" }, this device

// ---- pure helpers -----------------------------------------------------------------
const rate = (w, n) => (n ? w / n : 0);
export function summary(games) {
  const g = games.slice().sort((a, b) => a.at - b.at);
  let best = 0, worst = 0, run = 0;
  for (const x of g) {
    run = x.win ? (run > 0 ? run + 1 : 1) : (run < 0 ? run - 1 : -1);
    best = Math.max(best, run); worst = Math.min(worst, run);
  }
  const wins = g.filter((x) => x.win).length;
  return { games: g.length, wins, losses: g.length - wins, current: run, bestWin: best, worstLoss: -worst };
}
export function sessions(games, gap = SESSION_GAP) {
  const g = games.slice().sort((a, b) => a.at - b.at);
  const out = [];
  for (const x of g) {
    const cur = out[out.length - 1];
    if (!cur || x.at - cur.end > gap) out.push({ start: x.at, end: x.at, games: [x] });
    else { cur.end = x.at; cur.games.push(x); }
  }
  return out.map((s) => {
    const ranked = s.games.filter((x) => x.rankedUnlocked && Number.isInteger(x.oldElo) && Number.isInteger(x.newElo));
    const wins = s.games.filter((x) => x.win).length;
    return { start: s.start, end: s.end, games: s.games.length, wins, losses: s.games.length - wins, elo: ranked.length ? ranked[ranked.length - 1].newElo - ranked[0].oldElo : null };
  });
}
export function matchups(games, soul = "ALL") {
  const m = {};
  for (const x of games) {
    if (!x.enemySoul || (soul !== "ALL" && x.soul !== soul)) continue;
    const r = m[x.enemySoul] || (m[x.enemySoul] = { soul: x.enemySoul, games: 0, wins: 0 });
    r.games++; if (x.win) r.wins++;
  }
  return Object.values(m).sort((a, b) => b.games - a.games);
}
const deckKey = (x) => `${x.soul}|${(x.deck || []).slice().sort((a, b) => a[0] - b[0]).map((c) => c.join(":")).join(",")}|${(x.arts || []).slice().sort((a, b) => a - b).join(",")}`;
const asMap = (deck) => new Map((deck || []).map(([id, n]) => [id, n]));
export function similarity(a, b) {
  const A = asMap(a), B = asMap(b);
  let both = 0, all = 0;
  for (const id of new Set([...A.keys(), ...B.keys()])) { const x = A.get(id) || 0, y = B.get(id) || 0; both += Math.min(x, y); all += Math.max(x, y); }
  return all ? both / all : 0;
}
export function changes(from, to) {
  const A = asMap(from), B = asMap(to), add = [], drop = [];
  for (const id of new Set([...A.keys(), ...B.keys()])) {
    const d = (B.get(id) || 0) - (A.get(id) || 0);
    if (d > 0) add.push([id, d]); else if (d < 0) drop.push([id, -d]);
  }
  return { add, drop };
}
export function artChanges(from, to) {
  const A = new Set(from || []), B = new Set(to || []);
  return { add: [...B].filter((x) => !A.has(x)), drop: [...A].filter((x) => !B.has(x)) };
}
// Games with a starting deck → decks (families), newest first. Each: { key, soul,
// versions: [{ key, deck, arts, games, wins, first, last }] (oldest first), games, wins, last }.
export function deckFamilies(games) {
  const versions = new Map();
  for (const x of games.slice().sort((a, b) => a.at - b.at)) {
    if (!x.deck || !x.deck.length) continue;
    const k = deckKey(x);
    const v = versions.get(k) || { key: k, soul: x.soul, deck: x.deck, arts: x.arts || [], games: 0, wins: 0, first: x.at, last: x.at };
    v.games++; if (x.win) v.wins++; v.last = x.at;
    versions.set(k, v);
  }
  const fams = [];
  for (const v of [...versions.values()].sort((a, b) => a.first - b.first)) {
    let best = null, score = 0;
    for (const f of fams) {
      if (f.soul !== v.soul) continue;
      const s = Math.max(...f.versions.map((u) => similarity(u.deck, v.deck)));
      if (s >= SIMILAR && s > score) { best = f; score = s; }
    }
    if (best) best.versions.push(v);
    else fams.push({ key: v.key, soul: v.soul, versions: [v] });
  }
  for (const f of fams) {
    f.games = f.versions.reduce((n, v) => n + v.games, 0);
    f.wins = f.versions.reduce((n, v) => n + v.wins, 0);
    f.last = Math.max(...f.versions.map((v) => v.last));
  }
  return fams.sort((a, b) => b.last - a.last);
}
// Your win rate in games where each card was in your starting deck.
export function cardRates(games) {
  const m = new Map();
  for (const x of games) for (const [id] of x.deck || []) {
    const r = m.get(id) || { id, games: 0, wins: 0 };
    r.games++; if (x.win) r.wins++;
    m.set(id, r);
  }
  return [...m.values()];
}

// ---- the view ---------------------------------------------------------------------
const CSS = `
#wz-usage-win .uw-mine { display:flex; flex-direction:column; gap:10px; padding-top:8px; }
#wz-usage-win .uw-cards3 { display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:8px; }
#wz-usage-win .uw-stat { border:1px solid rgba(255,255,255,.25); padding:6px 8px; }
#wz-usage-win .uw-stat b { display:block; font-size:18px; font-weight:normal; }
#wz-usage-win .uw-stat span { color:#aaa; font-size:12px; }
#wz-usage-win h4 { margin:6px 0 2px; font-size:13px; font-weight:normal; color:#ccc; text-transform:uppercase; letter-spacing:.04em; }
#wz-usage-win .uw-deck { border:1px solid rgba(255,255,255,.25); margin-bottom:6px; }
#wz-usage-win .uw-deck-head { display:flex; align-items:center; gap:10px; padding:6px 8px; cursor:pointer; }
#wz-usage-win .uw-deck-head:hover { background:rgba(255,255,255,.06); }
#wz-usage-win .uw-deck-head .nm { flex:1; }
#wz-usage-win .uw-deck-body { padding:4px 8px 8px; border-top:1px solid rgba(255,255,255,.15); }
#wz-usage-win .uw-chg .add { color:#6c6; } #wz-usage-win .uw-chg .drop { color:#e66; }
#wz-usage-win .uw-tag { font-size:11px; padding:0 5px; border:1px solid #888; color:#ccc; margin-left:4px; }
#wz-usage-win .uw-deck-name { background:transparent; color:#fff; border:1px solid transparent; font:inherit; padding:1px 4px; width:100%; max-width:340px; cursor:text; }
#wz-usage-win .uw-deck-name::placeholder { color:#fff; opacity:1; }
#wz-usage-win .uw-deck-name:hover { border-color:rgba(255,255,255,.35); }
#wz-usage-win .uw-deck-name:focus { border-color:#fff; background:#111; outline:none; }
#wz-usage-win .uw-deck-name:focus::placeholder { color:#777; }
#wz-usage-win .uw-arts { display:flex; flex-wrap:wrap; align-items:center; gap:4px 12px; }
#wz-usage-win .uw-art { display:inline-flex; align-items:center; gap:4px; }
#wz-usage-win .uw-art img { width:24px; height:24px; object-fit:contain; }
#wz-usage-win .uw-chg .uw-art img { width:18px; height:18px; }
#wz-usage-win .uw-chg .arts { display:flex; flex-wrap:wrap; align-items:center; gap:2px 8px; margin-top:2px; }
#wz-usage-win .uw-chg .arts .to { font-size:16px; color:#ccc; }
#wz-usage-win select.uw-sel, #wz-usage-win select.uw-sel option { background:#222; color:#fff; border:1px solid #888; font:inherit; font-size:13px; }
#wz-usage-win .uw-delta.up { color:#6c6; } #wz-usage-win .uw-delta.down { color:#e66; }
`;
let cssDone = false;
const pct = (x) => `${(Math.round((x || 0) * 1000) / 10).toFixed(1)}%`;
const wr = (w, n) => (n ? `<span class="${w / n >= 0.5 ? "green" : "red"}">${pct(w / n)}</span>` : "-");
const when = (t) => new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const day = (t) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const readNames = () => { try { return JSON.parse(GM_getValue(NAMES_KEY, "{}")) || {}; } catch (e) { return {}; } };
const saveName = (k, v) => { const n = readNames(); if (v) n[k] = v; else delete n[k]; try { GM_setValue(NAMES_KEY, JSON.stringify(n)); } catch (e) { /* no GM */ } };

// ctx: { esc, soulHtml, divHtml, SOULS, LADDER, NAMES, catalog(), community(), perPlayer(),
//        getGames(season, player) → Promise<data>, self(), defaultPlayer(players, self), seasonLabel, current, preview }
export function createMine(ctx) {
  const st = { player: null, season: ctx.current, view: "OVERVIEW", compare: "AUTO", soul: "ALL", minGames: 3, open: {}, data: null, players: [], seasons: [], error: "", loading: false, q: "" };
  async function load(rerender) {
    st.loading = true; rerender();
    try {
      let d = await ctx.getGames(st.season, st.player || "");
      if (!st.player) { // first load: start on the account that's logged in
        const want = ctx.defaultPlayer(d.players, ctx.self());
        if (want && want !== d.player) d = await ctx.getGames(st.season, want);
      }
      st.player = d.player; st.data = d; st.players = d.players || []; st.seasons = (d.seasons || []).map((x) => x.season);
      st.error = "";
    } catch (e) { st.error = e.message || "Couldn't reach the Wizascript server."; }
    st.loading = false; rerender();
  }
  // The community's numbers to compare with: the division you played most this season.
  function compareSel() {
    const f = ctx.community();
    if (!f || !f.sel) return { div: "TOTAL", s: null };
    let div = st.compare;
    if (div === "AUTO") {
      const n = {};
      for (const g of (st.data && st.data.games) || []) if (g.rankedUnlocked && g.oldDivision) n[g.oldDivision] = (n[g.oldDivision] || 0) + 1;
      div = Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0] || "TOTAL";
    }
    const s = f.sel[div];
    return { div, s: s && s.cards && s.cards.length ? s : f.sel.TOTAL };
  }
  const cardName = (id) => { const c = ctx.catalog().cardById.get(id); return c ? c.name : `#${id}`; };
  const cardCls = (id) => { const c = ctx.catalog().cardById.get(id); return c ? ctx.esc(c.rarity || "") : ""; };
  const artName = (id) => { const a = ctx.catalog().artById.get(id); return a ? a.name : `#${id}`; };
  // An artifact with its picture (the game's own /images/artifacts/ PNG), gold if legendary.
  const artHtml = (id) => {
    const a = ctx.catalog().artById.get(id);
    return `<span class="uw-art"><img src="/images/artifacts/${ctx.esc((a && a.image) || "")}.png" alt="" onerror="this.style.visibility='hidden'"><span class="${a && a.legendary ? "yellow" : ""}">${ctx.esc(artName(id))}</span></span>`;
  };

  function bar(rerender) {
    const e = ctx.esc;
    const players = st.players.length > 1
      ? `<label class="uw-adv">Account <select class="uw-sel uw-player">${st.players.map((p) => `<option value="${e(p.name)}"${p.name === st.player ? " selected" : ""}>${e(p.name)}${p.main ? " (main)" : " (alt)"}</option>`).join("")}</select></label>` : st.player ? `<span class="uw-meta">${e(st.player)}</span>` : "";
    const seasons = [...new Set([ctx.current, ...st.seasons])].sort().reverse();
    const seasonSel = `<label class="uw-adv">Season <select class="uw-sel uw-season">${seasons.map((s) => `<option value="${s}"${s === st.season ? " selected" : ""}>${ctx.seasonLabel(s)}</option>`).join("")}</select></label>`;
    const views = [["OVERVIEW", "Overview"], ["DECKS", "Decks"], ["CARDS", "Cards"]].map(([k, t]) => `<button type="button" class="uw-btn${st.view === k ? " on" : ""}" data-mv="${k}">${t}</button>`).join("");
    const el = document.createElement("div"); el.className = "uw-bar";
    el.innerHTML = `${views}<span class="uw-sep"></span>${players}${seasonSel}`;
    el.querySelectorAll("[data-mv]").forEach((b) => b.addEventListener("click", () => { st.view = b.dataset.mv; rerender(); }));
    const ps = el.querySelector(".uw-player"); if (ps) ps.addEventListener("change", () => { st.player = ps.value; load(rerender); });
    el.querySelector(".uw-season").addEventListener("change", (ev) => { st.season = ev.target.value; load(rerender); });
    return el;
  }

  function overview(games) {
    const e = ctx.esc;
    const s = summary(games);
    const cur = s.current > 0 ? `${s.current} win${s.current === 1 ? "" : "s"}` : s.current < 0 ? `${-s.current} loss${s.current === -1 ? "" : "es"}` : "-";
    let html = `<div class="uw-cards3">
      <div class="uw-stat"><b>${s.wins}–${s.losses}</b><span>Record (${wr(s.wins, s.games)})</span></div>
      <div class="uw-stat"><b>${cur}</b><span>Current streak</span></div>
      <div class="uw-stat"><b>${s.bestWin}</b><span>Best win streak</span></div>
      <div class="uw-stat"><b>${s.worstLoss}</b><span>Longest losing streak</span></div></div>`;
    const ss = sessions(games).reverse().slice(0, 8);
    html += `<h4>Sessions</h4><table><tr><th>Started</th><th>Games</th><th>Record</th><th>Win rate</th><th>Elo</th></tr>` + ss.map((x) =>
      `<tr><td>${when(x.start)}</td><td>${x.games}</td><td>${x.wins}–${x.losses}</td><td>${wr(x.wins, x.games)}</td><td>${x.elo === null ? "-" : `<span class="uw-delta ${x.elo >= 0 ? "up" : "down"}">${x.elo >= 0 ? "+" : ""}${x.elo}</span>`}</td></tr>`).join("") + "</table>";
    const souls = [...new Set(games.map((g) => g.soul))];
    const mm = matchups(games, st.soul);
    html += `<h4>Matchups by opponent soul</h4><div class="uw-bar" style="padding:0 0 4px">Playing as <select class="uw-sel uw-msoul"><option value="ALL">any soul</option>${souls.map((x) => `<option value="${x}"${x === st.soul ? " selected" : ""}>${e(x)}</option>`).join("")}</select></div>`;
    html += mm.length ? `<table><tr><th>Opponent's soul</th><th>Games</th><th>Record</th><th>Win rate</th></tr>` + mm.map((x) =>
      `<tr><td>${ctx.soulHtml(x.soul)}</td><td>${x.games}</td><td>${x.wins}–${x.games - x.wins}</td><td>${wr(x.wins, x.games)}</td></tr>`).join("") + "</table>"
      : `<div class="uw-hidden">No opponent souls recorded${st.season !== ctx.current ? " (they're only kept for the current season)" : ""}.</div>`;
    return html;
  }

  function decks(games, rerender) {
    const e = ctx.esc;
    const fams = deckFamilies(games);
    if (!fams.length) return `<div class="uw-empty">No starting decks recorded${st.season !== ctx.current ? " for this season (decks are kept until about two weeks after the month ends)" : " yet"}.</div>`;
    const names = readNames();
    const { div, s } = compareSel();
    const meta = new Map(((s && s.cards) || []).map((r) => [r[0], r]));
    const pp = ctx.perPlayer();
    const tot = s ? (pp ? s.players : s.games) : 0;
    const useOf = (id) => { const r = meta.get(id); return r && tot ? (pp ? r[5] : r[1]) / tot : 0; };
    const wrOf = (id) => { const r = meta.get(id); return r ? (pp ? rate(r[6], r[5]) : rate(r[2], r[1])) : null; };
    const label = (f) => {
      const latest = f.versions[f.versions.length - 1];
      const top = latest.deck.slice().sort((a, b) => b[1] - a[1] || useOf(a[0]) - useOf(b[0])).slice(0, 3).map(([id]) => cardName(id));
      return top.join(", ");
    };
    const autoLabel = label;
    let html = `<div class="uw-hidden">Each game's starting deck is a version; versions that share most of their cards are one deck. Compared with ${e(ctx.NAMES[div] || div)}, this season.</div>`;
    for (const f of fams) {
      const open = !!st.open[f.key];
      const latest = f.versions[f.versions.length - 1];
      html += `<div class="uw-deck"><div class="uw-deck-head" data-fam="${e(f.key)}">
        <span>${open ? "▾" : "▸"}</span><span>${ctx.soulHtml(f.soul)}</span><span class="nm"><input type="text" class="uw-deck-name" data-ren="${e(f.key)}" maxlength="40" value="${e(names[f.key] || "")}" placeholder="${e(autoLabel(f))}" title="Click to name this deck (kept on this device; empty = automatic)" spellcheck="false"></span>
        <span>${f.wins}–${f.games - f.wins} · ${wr(f.wins, f.games)}</span><span class="uw-meta">${f.versions.length} version${f.versions.length === 1 ? "" : "s"} · ${day(f.last)}</span></div>`;
      if (open) {
        html += `<div class="uw-deck-body">`;
        if (latest.arts.length) html += `<h4>Artifacts</h4><div class="uw-arts">${latest.arts.map(artHtml).join("")}</div>`;
        html += `<h4>Versions</h4><table><tr><th>Played</th><th>Games</th><th>Win rate</th><th>Changes</th></tr>`;
        f.versions.forEach((v, i) => {
          const c = i ? changes(f.versions[i - 1].deck, v.deck) : null;
          const list = (xs, cls, sign) => xs.map(([id, n]) => `<span class="${cls}">${sign}${n > 1 ? n + "× " : ""}${e(cardName(id))}</span>`).join(", ");
          const ac = i ? artChanges(f.versions[i - 1].arts, v.arts) : null;
          const cardsTxt = c ? [list(c.add, "add", "+"), list(c.drop, "drop", "−")].filter(Boolean).join(", ") : "";
          const artsTxt = ac && (ac.add.length || ac.drop.length) ? `<span class="arts">Artifacts: ${ac.drop.map(artHtml).join(" ") || "none"}<span class="to">→</span>${ac.add.map(artHtml).join(" ") || "none"}</span>` : "";
          html += `<tr><td>${day(v.first)}${v.last - v.first > 864e5 ? `–${day(v.last)}` : ""}</td><td>${v.games}</td><td>${wr(v.wins, v.games)}</td><td class="uw-chg">${!i ? "first version" : (cardsTxt || (artsTxt ? "" : "same cards")) + artsTxt}</td></tr>`;
        });
        html += `</table><h4>Latest version vs the meta</h4><table><tr><th>Card</th><th>Copies</th><th>In ${e(ctx.NAMES[div] || div)} decks</th><th>Community win rate</th><th></th></tr>`;
        for (const [id, n] of latest.deck.slice().sort((a, b) => useOf(b[0]) - useOf(a[0]))) {
          const u = useOf(id), w = wrOf(id);
          const tag = !meta.has(id) ? '<span class="uw-tag">off-meta</span>' : u >= 0.3 ? '<span class="uw-tag">staple</span>' : u < 0.05 ? '<span class="uw-tag">rare pick</span>' : "";
          html += `<tr><td><span class="${cardCls(id)}">${e(cardName(id))}</span></td><td>${n}</td><td>${meta.has(id) ? pct(u) : "-"}</td><td>${w === null ? "-" : wr(w, 1)}</td><td>${tag}</td></tr>`;
        }
        html += "</table></div>";
      }
      html += "</div>";
    }
    return html;
  }

  function cards(games) {
    const e = ctx.esc;
    const { div, s } = compareSel();
    const pp = ctx.perPlayer();
    const meta = new Map(((s && s.cards) || []).map((r) => [r[0], r]));
    const q = st.q.trim().toLowerCase();
    const rows = cardRates(games).filter((r) => r.games >= st.minGames && (!q || cardName(r.id).toLowerCase().includes(q)))
      .map((r) => { const m = meta.get(r.id); const cw = m ? (pp ? rate(m[6], m[5]) : rate(m[2], m[1])) : null; return { ...r, mine: rate(r.wins, r.games), cw }; })
      .sort((a, b) => b.games - a.games || b.mine - a.mine);
    let html = `<div class="uw-bar" style="padding:0 0 4px"><input type="search" class="uw-search uw-mq" placeholder="Search cards…" value="${e(st.q)}">
      <label class="uw-adv">At least <select class="uw-sel uw-min">${[1, 3, 5, 10].map((n) => `<option${n === st.minGames ? " selected" : ""}>${n}</option>`).join("")}</select> games</label>
      <span class="uw-meta">Community: ${e(ctx.NAMES[div] || div)}, this season</span></div>`;
    if (!rows.length) return html + `<div class="uw-empty">No cards with ${st.minGames}+ games${q ? " matching that" : ""}.</div>`;
    html += `<table><tr><th>Card</th><th>Your games</th><th>Your win rate</th><th>Community</th><th>Difference</th></tr>` + rows.map((r) => {
      const d = r.cw === null ? null : r.mine - r.cw;
      return `<tr><td><span class="${cardCls(r.id)}">${e(cardName(r.id))}</span></td><td>${r.games}</td><td>${wr(r.wins, r.games)}</td><td>${r.cw === null ? "-" : wr(r.cw, 1)}</td>
        <td>${d === null ? "-" : `<span class="uw-delta ${d >= 0 ? "up" : "down"}">${d >= 0 ? "+" : ""}${(Math.round(d * 1000) / 10).toFixed(1)}</span>`}</td></tr>`;
    }).join("") + "</table>";
    return html;
  }

  function render(container, rerender) {
    if (!cssDone) { const el = document.createElement("style"); el.textContent = CSS; document.head.appendChild(el); cssDone = true; }
    container.replaceChildren();
    const wrap = document.createElement("div"); wrap.className = "uw-mine";
    if (!st.data && !st.loading && !st.error) load(rerender);
    wrap.appendChild(bar(rerender));
    const body = document.createElement("div");
    const games = (st.data && st.data.games) || [];
    body.innerHTML = st.error ? `<div class="uw-empty">${ctx.esc(st.error)}</div>`
      : !st.data ? '<div class="uw-empty">Loading your games…</div>'
      : !games.length ? `<div class="uw-empty">No games recorded for ${ctx.esc(st.player || "this account")} in ${ctx.seasonLabel(st.season)}.</div>`
      : st.view === "DECKS" ? decks(games, rerender) : st.view === "CARDS" ? cards(games) : overview(games);
    wrap.appendChild(body);
    container.appendChild(wrap);
    // listeners inside the body
    body.querySelectorAll("[data-fam]").forEach((h) => h.addEventListener("click", (ev) => { if (ev.target.closest(".uw-deck-name")) return; st.open[h.dataset.fam] = !st.open[h.dataset.fam]; rerender(); }));
    // The deck's name is a text box in its header (like Patch Maker's labels): type, then Enter or click away to keep it; Esc undoes.
    body.querySelectorAll("input[data-ren]").forEach((inp) => {
      let cancel = false;
      inp.addEventListener("keydown", (ev) => {
        ev.stopPropagation(); // no game or Wizascript hotkeys while typing
        if (ev.key === "Enter") inp.blur();
        else if (ev.key === "Escape") { cancel = true; inp.value = readNames()[inp.dataset.ren] || ""; inp.blur(); }
      });
      ["keyup", "keypress"].forEach((t) => inp.addEventListener(t, (ev) => ev.stopPropagation()));
      inp.addEventListener("blur", () => {
        if (cancel) { cancel = false; return; }
        const v = inp.value.trim().slice(0, 40);
        if (v !== (readNames()[inp.dataset.ren] || "")) saveName(inp.dataset.ren, v);
        inp.value = v;
      });
    });
    const ms = body.querySelector(".uw-msoul"); if (ms) ms.addEventListener("change", () => { st.soul = ms.value; rerender(); });
    const mq = body.querySelector(".uw-mq"); if (mq) mq.addEventListener("input", () => { st.q = mq.value; const pos = mq.selectionStart; rerender(); const n = container.querySelector(".uw-mq"); if (n) { n.focus(); n.setSelectionRange(pos, pos); } });
    const mn = body.querySelector(".uw-min"); if (mn) mn.addEventListener("change", () => { st.minGames = Number(mn.value); rerender(); });
  }
  return { render, reset: () => { st.data = null; st.player = null; st.error = ""; } };
}
