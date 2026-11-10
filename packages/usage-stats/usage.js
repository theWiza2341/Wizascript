// packages/usage-stats/usage.js
//
// The Usage Statistics window, opened from the 📊 footer button (left of the Card
// Maker's, or in its spot). It shows what the Wizascript server publishes from
// every opted-in player's games (Worker 1.8 /v1/stats; format in
// claude/worker-1.8.md): which cards, artifacts and souls are played, and how
// they do, by time range and division. Nobody's own deck is ever shown: in
// Today's ranked divisions the server leaves out anything fewer than 3 players
// used, and merges thin divisions; this window says so where it applies.

import { getStats } from "./api.js";
import { SOULS, LADDER, TRUE_HUB_ELO, t, esc, soulHtml, divHtml } from "./common.js";
import { allCards, ensureCards, artifacts } from "../misc/card-history/game.js";

const WIN_KEY = "wizascript.usageStats.window"; // { x, y, w, h }
const STYLE_ID = "wz-us-usage-style";
const TOP = 40;
const PRIVATE = [...LADDER, "TRUEHUB"];
const TIMES = [["TODAY", "Today"], ["WEEK", "This Week"], ["SEASON", "This Season"], ["ALL", "All Time"]];
const TIME_NAMES = Object.fromEntries(TIMES);
const DIVS = ["TOTAL", ...LADDER, "UNRANKED", "TRUEHUB"];
const NAMES = { TOTAL: "Total", LEGEND: "LEGEND", ULTIMATE_MASTER: "Ultimate Master", HIGH_MASTER: "High Master", MASTER: "Master", UNRANKED: "Unranked", TRUEHUB: "True Hub+" };
const VIEWS = [["CARDS", "Cards"], ["ARTIFACTS", "Artifacts"], ["SOULS", "Souls"]];
const SORTS = [["USAGE", "Most used"], ["WINRATE", "Win rate"], ["NAME", "Name"], ["ID", "ID"]];
const CATALOG_RARITIES = ["COMMON", "RARE", "EPIC", "LEGENDARY", "DETERMINATION"];

export const ICON = `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><rect width="20" height="20" rx="3" fill="#000"/>
<rect x="4" y="9" width="3" height="7" fill="#43b05c"/><rect x="8.5" y="12" width="3" height="4" fill="#e04848"/><rect x="13" y="5" width="3" height="11" fill="#3b82f6"/>
<rect x="3" y="16" width="14" height="1" fill="#888"/></svg>`;

const CSS = `
#wz-usage-btn a { display:flex; align-items:center; }
#wz-usage-btn svg { vertical-align:-5px; }
#wz-usage-btn a[aria-pressed="true"] svg { filter: drop-shadow(0 0 3px #fff); }
#wz-usage-win { position:fixed; z-index:1000; min-width:560px; min-height:360px; display:flex; flex-direction:column; background:rgba(8,4,12,.96); border:1px solid #fff; box-shadow:0 6px 24px rgba(0,0,0,.7); color:#fff; font-size:14px; box-sizing:border-box; }
#wz-usage-win .uw-title { display:flex; align-items:center; gap:8px; padding:4px 6px 4px 10px; border-bottom:1px solid rgba(255,255,255,.4); cursor:move; user-select:none; }
#wz-usage-win .uw-title b { flex:1; font-weight:normal; }
#wz-usage-win .uw-x { background:none; border:none; color:#fff; font-size:18px; line-height:1; cursor:pointer; }
#wz-usage-win .uw-bar { display:flex; align-items:center; gap:6px; flex-wrap:wrap; padding:6px 10px 0; }
#wz-usage-win .uw-btn { background:transparent; color:#fff; border:1px solid #fff; padding:3px 9px; font:inherit; font-size:13px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; white-space:nowrap; }
#wz-usage-win .uw-btn:hover { background:rgba(255,255,255,.12); }
#wz-usage-win .uw-btn.on { background:#fff; color:#000; }
#wz-usage-win .uw-btn.th { border-color:#ffd700; color:#ffd700; } #wz-usage-win .uw-btn.th.on { background:#ffd700; color:#000; }
#wz-usage-win .uw-btn img, #wz-usage-win .uw-btn .divisionIcon { height:16px !important; width:auto !important; max-height:16px !important; margin:0 !important; }
#wz-usage-win .uw-sep { flex:1; }
#wz-usage-win .uw-meta { color:#aaa; font-size:12px; }
#wz-usage-win label.uw-adv { font-size:12px; color:#ccc; display:flex; align-items:center; gap:4px; cursor:pointer; margin:0; font-weight:normal; }
#wz-usage-win .uw-body { flex:1; overflow-y:auto; margin:8px 10px 10px; border-top:1px solid rgba(255,255,255,.25); }
#wz-usage-win table { width:100%; border-collapse:collapse; }
#wz-usage-win th { text-align:left; font-weight:normal; color:#aaa; font-size:12px; padding:4px 6px; position:sticky; top:0; background:rgba(8,4,12,1); }
#wz-usage-win td { padding:3px 6px; border-bottom:1px solid rgba(255,255,255,.08); vertical-align:middle; }
#wz-usage-win .uw-rank { color:#888; width:26px; text-align:right; }
#wz-usage-win .uw-thumb { height:26px; width:26px; object-fit:cover; object-position:top; vertical-align:middle; margin-right:6px; border:1px solid rgba(255,255,255,.3); background:#111; }
#wz-usage-win .uw-meter { position:relative; height:14px; width:120px; background:rgba(255,255,255,.08); display:inline-block; vertical-align:middle; margin-right:6px; }
#wz-usage-win .uw-meter i { position:absolute; left:0; top:0; bottom:0; background:#4a8; }
#wz-usage-win .uw-meter.art i { background:#c9a227; } #wz-usage-win .uw-meter.soul i { background:#58f; }
#wz-usage-win .uw-empty { color:#999; text-align:center; padding:24px; }
#wz-usage-win .uw-hidden { color:#888; font-size:12px; padding:6px; }
#wz-usage-win .uw-note { color:#aaa; font-size:12px; padding:4px 10px 0; }
#wz-usage-win .uw-right { display:flex; flex-direction:column; align-items:flex-end; gap:2px; }
#wz-usage-win .uw-recorded { color:#ccc; font-size:12px; }
#wz-usage-win .uw-btn.off, #wz-usage-win .uw-btn.off:hover { opacity:.35; cursor:not-allowed; background:transparent; }
#wz-usage-win .uw-tools { gap:8px; font-size:12px; color:#ccc; }
#wz-usage-win .uw-search { flex:1; max-width:280px; background:#111; color:#fff; border:1px solid #888; padding:3px 6px; font:inherit; font-size:13px; }
#wz-usage-win .uw-sort, #wz-usage-win .uw-sort option { background:#222; color:#fff; border:1px solid #888; font:inherit; font-size:13px; }
#wz-usage-win .uw-id { color:#777; font-size:11px; }
#wz-usage-win tr.uw-unused-head td { color:#999; font-size:12px; cursor:pointer; padding:6px; user-select:none; }
#wz-usage-win tr.uw-unused-head:hover td { color:#fff; }
#wz-usage-win tr.uw-unused td { opacity:.55; }
#wz-usage-win .uw-grip { position:absolute; right:0; bottom:0; width:14px; height:14px; cursor:nwse-resize; background:linear-gradient(135deg, transparent 50%, rgba(255,255,255,.7) 50%); }
`;

// ---- the footer button -----------------------------------------------------------
let footerItem = null;
let toggleWindow = () => {};
export function addUsageButton() {
  if (document.getElementById("wz-usage-btn")) return true;
  const cm = document.getElementById("wz-cardmaker-btn");
  const friends = document.querySelector("a span.nbFriends");
  const before = cm || (friends && friends.closest("li"));
  if (!before) return false;
  injectStyle();
  footerItem = document.createElement("li");
  footerItem.id = "wz-usage-btn";
  footerItem.innerHTML = `<a href="#" title="Usage Statistics" aria-label="Usage Statistics" role="button" aria-pressed="false">${ICON}</a>`;
  footerItem.querySelector("a").addEventListener("click", (e) => { e.preventDefault(); toggleWindow(); });
  before.parentNode.insertBefore(footerItem, before);
  return true;
}
function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement("style"); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st);
}

// ---- the window ------------------------------------------------------------------
let win = null;
const state = { time: "SEASON", div: "TOTAL", view: "CARDS", adv: false, perPlayer: false, sort: "USAGE", q: "", showUnused: false };
const files = {}; // window -> stats file
let loadError = "";

toggleWindow = () => { if (win && win.style.display !== "none") setOpen(false); else setOpen(true); };
export const openUsageWindow = () => setOpen(true);

let rect = { x: null, y: null, w: 720, h: 520 };
const saveRect = () => { try { GM_setValue(WIN_KEY, JSON.stringify(rect)); } catch (e) { /* no GM */ } };
function keepOnScreen() {
  const m = 8;
  rect.w = Math.min(rect.w, innerWidth - 2 * m); rect.h = Math.min(rect.h, innerHeight - 2 * m);
  rect.x = Math.max(m, Math.min(rect.x, innerWidth - rect.w - m)); rect.y = Math.max(m, Math.min(rect.y, innerHeight - rect.h - m));
  Object.assign(win.style, { left: rect.x + "px", top: rect.y + "px", width: rect.w + "px", height: rect.h + "px" });
}
function build() {
  injectStyle();
  try { rect = { ...rect, ...JSON.parse(GM_getValue(WIN_KEY, "null")) }; } catch (e) { /* defaults */ }
  win = document.createElement("div"); win.id = "wz-usage-win"; win.style.display = "none";
  win.innerHTML = `
    <div class="uw-title">${ICON}<b>Usage Statistics</b><span class="uw-meta uw-count"></span><button type="button" class="uw-x" title="Close">×</button></div>
    <div class="uw-bar uw-time"></div>
    <div class="uw-bar uw-div"></div>
    <div class="uw-bar uw-view"></div>
    <div class="uw-bar uw-tools"></div>
    <div class="uw-note"></div>
    <div class="uw-body"></div><div class="uw-grip"></div>`;
  document.body.appendChild(win);
  win.querySelector(".uw-x").addEventListener("click", () => setOpen(false));
  const follow = (e0, apply) => {
    e0.preventDefault();
    const s = { ...rect, px: e0.clientX, py: e0.clientY };
    const mv = (e) => { apply(s, e.clientX - s.px, e.clientY - s.py); keepOnScreen(); };
    const up = () => { document.removeEventListener("pointermove", mv, true); document.removeEventListener("pointerup", up, true); saveRect(); };
    document.addEventListener("pointermove", mv, true); document.addEventListener("pointerup", up, true);
  };
  win.querySelector(".uw-title").addEventListener("pointerdown", (e) => { if (!e.target.closest(".uw-x")) follow(e, (s, dx, dy) => { rect.x = s.x + dx; rect.y = s.y + dy; }); });
  win.querySelector(".uw-grip").addEventListener("pointerdown", (e) => follow(e, (s, dx, dy) => { rect.w = Math.max(560, s.w + dx); rect.h = Math.max(360, s.h + dy); }));
  addEventListener("resize", () => { if (win.style.display !== "none") keepOnScreen(); });
  const tools = win.querySelector(".uw-tools");
  tools.innerHTML = `<input type="search" class="uw-search" placeholder="Search by name or ID…"><span>Sort:</span><select class="uw-sort">${SORTS.map(([id, txt]) => `<option value="${id}">${txt}</option>`).join("")}</select>`;
  tools.querySelector(".uw-search").addEventListener("input", (e) => { state.q = e.target.value; renderBody(); });
  tools.querySelector(".uw-sort").addEventListener("change", (e) => { state.sort = e.target.value; renderBody(); });
  // Typing in the window never reaches the game's hotkeys.
  win.addEventListener("keydown", (e) => e.stopPropagation());
  win.addEventListener("keyup", (e) => e.stopPropagation());
}
function setOpen(open) {
  if (open && !win) build();
  if (!win) return;
  if (open && rect.x === null) { rect.x = (innerWidth - rect.w) / 2; rect.y = (innerHeight - rect.h) / 2; }
  win.style.display = open ? "flex" : "none";
  if (footerItem) footerItem.querySelector("a").setAttribute("aria-pressed", String(open));
  if (open) { keepOnScreen(); render(); load(); }
}

// ---- data --------------------------------------------------------------------------
let catalog = { cards: [], arts: [], cardById: new Map(), artById: new Map() };
async function loadCatalog() {
  if (catalog.cards.length) return;
  await ensureCards();
  const cards = allCards();
  let arts = [];
  try { arts = (await artifacts()).filter((a) => !a.unavailable && !a.custom && !a.disabled); } catch (e) { /* names will show as #id */ }
  catalog = {
    cards: cards.filter((c) => CATALOG_RARITIES.includes(c.rarity) && c.name),
    arts,
    cardById: new Map(cards.map((c) => [c.id, c])),
    artById: new Map(arts.map((a) => [a.id, a]))
  };
}
async function fetchWindow(w) {
  try { files[w] = await getStats(w); loadError = ""; } catch (e) { loadError = e.message || "Couldn't reach the Wizascript server."; }
}
async function load() {
  await Promise.all([fetchWindow("SEASON"), fetchWindow("ALL"), loadCatalog()]);
  if (!files[state.time]) await fetchWindow(state.time);
  render();
}

// Game counts per time range (any file has Today/Week/Season; All Time's has ALL).
function counts() {
  const c = {};
  for (const f of Object.values(files)) if (f && f.counts) Object.assign(c, Object.fromEntries(Object.entries(f.counts).filter(([k]) => k !== "ALL")));
  if (files.ALL && files.ALL.counts) c.ALL = files.ALL.counts.ALL;
  return c;
}
const utcDay = (t) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
const utcMonth = (t) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); };
// Greyed out: empty, or the same games as a narrower range (ranges are "games since a start", so equal counts = same games).
function timeTabs() {
  const n = counts(), now = Date.now();
  const starts = { TODAY: utcDay(now), WEEK: now - 7 * 864e5, SEASON: utcMonth(now), ALL: 0 };
  const order = ["TODAY", "WEEK", "SEASON", "ALL"].map((id) => ({ id, start: starts[id], n: n[id] })).sort((a, b) => b.start - a.start);
  const info = {};
  order.forEach((w, i) => {
    if (w.n === undefined) { info[w.id] = { off: false }; return; }
    const same = order.slice(0, i).find((o) => o.n === w.n && o.n > 0);
    info[w.id] = !w.n ? { off: true, why: "No games in this time range yet" } : same ? { off: true, why: `Same games as ${TIME_NAMES[same.id]}`, same: same.id } : { off: false };
  });
  return info;
}

// ---- rendering ---------------------------------------------------------------------------
const pct = (x) => `${(Math.round((x || 0) * 1000) / 10).toFixed(1)}%`;
const meter = (x, cls = "") => `<span class="uw-meter ${cls}"><i style="width:${Math.min(100, (x || 0) * 100)}%"></i></span>${pct(x)}`;
const rate = (w, n) => (n ? `<span class="${w / n >= 0.5 ? "green" : "red"}">${pct(w / n)}</span>` : "-");

function buttons(box, list, key, labelFn, info = {}, extra) {
  box.replaceChildren();
  for (const [id, text] of list) {
    const b = document.createElement("button"); b.type = "button";
    const off = info[id] && info[id].off;
    b.className = "uw-btn" + (state[key] === id ? " on" : "") + (id === "TRUEHUB" ? " th" : "") + (off ? " off" : "");
    b.innerHTML = labelFn ? labelFn(id) : esc(text);
    b.title = off ? info[id].why : id === "TRUEHUB" ? `Games started at ${TRUE_HUB_ELO}+ Elo` : id === "WEEK" ? "The last 7 days" : id === "SEASON" ? "This calendar month" : labelFn ? NAMES[id] : "";
    b.disabled = !!off;
    b.addEventListener("click", () => {
      state[key] = id;
      if (key === "time" && !files[id]) fetchWindow(id).then(render);
      render();
    });
    box.appendChild(b);
  }
  if (extra) box.append(...extra());
}

function render() {
  if (!win || win.style.display === "none") return;
  const ti = timeTabs();
  if (ti[state.time] && ti[state.time].off) {
    const order = ["TODAY", "WEEK", "SEASON", "ALL"];
    state.time = ti[state.time].same || order.slice(order.indexOf(state.time)).find((id) => !ti[id].off) || order.find((id) => !ti[id].off) || "ALL";
    if (!files[state.time]) fetchWindow(state.time).then(render);
  }
  const f = files[state.time];
  const di = {};
  for (const d of DIVS) di[d] = d === "TOTAL" || !f || (f.sel && f.sel[d] && f.sel[d].games) ? { off: false } : { off: true, why: "No games in this division for this time range" };
  if (di[state.div].off) state.div = "TOTAL";
  buttons(win.querySelector(".uw-time"), TIMES, "time", null, ti);
  buttons(win.querySelector(".uw-div"), DIVS.map((d) => [d]), "div", (d) => (d === "TRUEHUB" ? NAMES[d] : divHtml(d)), di);
  buttons(win.querySelector(".uw-view"), VIEWS, "view", null, {}, () => {
    const sep = document.createElement("span"); sep.className = "uw-sep";
    const right = document.createElement("div"); right.className = "uw-right";
    const n = f && f.sel && f.sel.TOTAL ? f.sel.TOTAL.games : 0;
    right.innerHTML = `<span class="uw-recorded" title="All PvP games recorded in this time range, every division incl. Unranked">${n} PvP game${n === 1 ? "" : "s"} recorded</span>`;
    const adv = document.createElement("label"); adv.className = "uw-adv";
    adv.innerHTML = `<input type="checkbox" ${state.adv ? "checked" : ""}> Advanced`;
    adv.querySelector("input").addEventListener("change", (e) => { state.adv = e.target.checked; if (!state.adv) state.perPlayer = false; render(); });
    right.appendChild(adv);
    if (state.adv) {
      const pp = document.createElement("label"); pp.className = "uw-adv";
      pp.title = "Off: every game counts. On: each player counts once, however many games they played.";
      pp.innerHTML = `<input type="checkbox" ${state.perPlayer ? "checked" : ""}> Count each player once`;
      pp.querySelector("input").addEventListener("change", (e) => { state.perPlayer = e.target.checked; render(); });
      right.appendChild(pp);
    }
    return [sep, right];
  });
  const tools = win.querySelector(".uw-tools");
  tools.style.display = state.view === "SOULS" ? "none" : "";
  tools.querySelector(".uw-search").placeholder = `Search ${state.view === "CARDS" ? "cards" : "artifacts"} by name or ID…`;
  renderBody();
}

function renderBody() {
  const body = win.querySelector(".uw-body");
  const noteEl = win.querySelector(".uw-note");
  const countEl = win.querySelector(".uw-count");
  const f = files[state.time];
  if (!f) {
    countEl.textContent = "";
    noteEl.textContent = "";
    body.innerHTML = `<div class="uw-empty">${loadError ? esc(`Couldn't load the statistics: ${loadError}`) : "Loading…"}</div>`;
    return;
  }
  const s = (f.sel && f.sel[state.div]) || { games: 0, players: 0, souls: [], cards: [], arts: [] };
  const priv = !!f.private && PRIVATE.includes(state.div);
  const pp = state.perPlayer;
  const built = f.built ? Math.max(0, Math.round((Date.now() - f.built) / 60e3)) : null;
  countEl.textContent = `${s.games} game${s.games === 1 ? "" : "s"} · ${s.players} player${s.players === 1 ? "" : "s"}` + (built === null ? "" : ` · updated ${built < 1 ? "just now" : built < 60 ? `${built} min ago` : `${Math.round(built / 60)} h ago`}`);
  const notes = [];
  const others = (s.group || []).filter((d) => d !== state.div);
  if (others.length) notes.push(`Not enough players in ${NAMES[state.div]} ${state.time === "TODAY" ? "today" : "yet"}, so this includes ${others.map((d) => NAMES[d]).join(" and ")}.`);
  if (priv) notes.push(`Today, cards and artifacts seen in fewer than ${f.minPlayers || 3} players' decks aren't shown in ranked divisions, for privacy and to avoid skew.`);
  notes.push(pp ? "Counting each player once." : "Counting every game.");
  noteEl.textContent = notes.join(" ");
  if (!s.games) { body.innerHTML = '<div class="uw-empty">No games recorded for this time and division yet.</div>'; return; }
  const total = pp ? s.players : s.games;
  // rows: souls/arts [id, games, wins, players, pGames, pWins]; cards [id, games, wins, copies, players, pGames, pWins, pCopies]
  const advHead = state.adv ? "<th>Games</th><th>Players</th>" : "";

  if (state.view === "SOULS") {
    const by = new Map(s.souls.map((r) => [r[0], r]));
    const all = SOULS.map((soul) => {
      const r = by.get(soul) || [soul, 0, 0, 0, 0, 0];
      return { soul, use: (pp ? r[4] : r[1]) / total, w: pp ? r[5] : r[2], n: pp ? r[4] : r[1], g: r[1], p: r[3] };
    }).sort((a, b) => b.use - a.use);
    body.innerHTML = `<table><tr><th>Soul</th><th>Played</th><th>Win rate</th>${advHead}</tr>` + all.map((x) =>
      `<tr><td><img class="uw-thumb" style="border:none;background:none" src="/images/souls/${x.soul}.png" onerror="this.style.visibility='hidden'">${soulHtml(x.soul)}</td>
        <td>${meter(x.use, "soul")}</td><td>${rate(x.w, x.n)}</td>${state.adv ? `<td>${x.g}</td><td>${x.p}</td>` : ""}</tr>`).join("") + "</table>";
    return;
  }
  const isCards = state.view === "CARDS";
  const rows = isCards ? s.cards : s.arts;
  const byId = isCards ? catalog.cardById : catalog.artById;
  const used = rows.map((r) => {
    const st = isCards
      ? { g: r[1], w: pp ? r[6] : r[2], n: pp ? r[5] : r[1], copies: pp ? r[7] : r[3], p: r[4] }
      : { g: r[1], w: pp ? r[5] : r[2], n: pp ? r[4] : r[1], p: r[3] };
    return { id: r[0], st, use: st.n / total, item: byId.get(r[0]) || { id: r[0], name: `#${r[0]}` } };
  }).sort((a, b) => b.use - a.use || b.st.w - a.st.w).map((r, i) => ({ ...r, rank: i + 1 }));
  const hiddenCount = priv && s.hidden ? (isCards ? s.hidden.cards : s.hidden.arts) : 0;
  const usedIds = new Set(rows.map((r) => r[0]));
  // Unused = in the catalogue with no games. Where rows are hidden they can't be told
  // apart from hidden ones, so they aren't listed there.
  const unused = priv ? [] : (isCards ? catalog.cards : catalog.arts).filter((c) => !usedIds.has(c.id)).map((item) => ({ id: item.id, item }));
  const q = state.q.trim().toLowerCase();
  const match = (r) => !q || String(r.item.name || "").toLowerCase().includes(q) || String(r.id) === q || String(r.id).startsWith(q);
  const cmp = {
    USAGE: (x, y) => x.rank - y.rank,
    WINRATE: (x, y) => (y.st.n ? y.st.w / y.st.n : 0) - (x.st.n ? x.st.w / x.st.n : 0) || x.rank - y.rank,
    NAME: (x, y) => String(x.item.name).localeCompare(String(y.item.name)),
    ID: (x, y) => x.id - y.id
  }[state.sort];
  const shown = used.filter(match).sort(cmp);
  const unusedShown = unused.filter(match).sort(state.sort === "ID" ? (x, y) => x.id - y.id : (x, y) => String(x.item.name).localeCompare(String(y.item.name)));
  const limit = q || state.sort !== "USAGE" ? Infinity : TOP;
  const img = (r) => (isCards ? `/images/cards/${esc(r.item.image || r.item.baseImage || "")}.png` : `/images/artifacts/${esc(r.item.image || "")}.png`);
  const nameCell = (r) => `<img class="uw-thumb" src="${img(r)}" onerror="this.style.visibility='hidden'"><span class="${isCards ? esc(r.item.rarity || "") : r.item.legendary ? "yellow" : ""}">${esc(r.item.name)}</span>${state.sort === "ID" || state.adv ? ` <span class="uw-id">#${r.id}</span>` : ""}`;
  const cols = isCards ? "<th>In decks</th><th>Avg copies</th><th>Win rate</th>" : "<th>In decks</th><th>Win rate</th>";
  const ncols = 2 + (isCards ? 3 : 2) + (state.adv ? 2 : 0);
  let html = `<table><tr><th>#</th><th>${isCards ? "Card" : "Artifact"}</th>${cols}${advHead}</tr>`;
  html += shown.slice(0, limit).map((r) => `<tr><td class="uw-rank">${r.rank}</td><td>${nameCell(r)}</td><td>${meter(r.use, isCards ? "" : "art")}</td>`
    + (isCards ? `<td>${r.st.n ? (r.st.copies / r.st.n).toFixed(1) : "-"}</td>` : "") + `<td>${rate(r.st.w, r.st.n)}</td>${state.adv ? `<td>${r.st.g}</td><td>${r.st.p}</td>` : ""}</tr>`).join("");
  if (shown.length > limit) html += `<tr><td colspan="${ncols}" class="uw-hidden">${shown.length - limit} more used ${isCards ? "cards" : "artifacts"}: search or pick a sort to see them all.</td></tr>`;
  if (q && !shown.length && !unusedShown.length) html += `<tr><td colspan="${ncols}" class="uw-hidden">Nothing matches “${esc(state.q)}”${priv ? ` (or it was seen in fewer than ${f.minPlayers || 3} players' decks today)` : ""}.</td></tr>`;
  if (unusedShown.length) {
    const open = state.showUnused || (q && !shown.length);
    html += `<tr class="uw-unused-head"><td colspan="${ncols}">${open ? "▾" : "▸"} Not used ${TIME_NAMES[state.time].toLowerCase()} in ${NAMES[state.div]}: ${unusedShown.length} ${isCards ? "card" : "artifact"}${unusedShown.length === 1 ? "" : "s"}</td></tr>`;
    if (open) html += unusedShown.map((r) => `<tr class="uw-unused"><td class="uw-rank">–</td><td>${nameCell(r)}</td><td>0.0%</td>${isCards ? "<td>–</td>" : ""}<td>–</td>${state.adv ? "<td>0</td><td>0</td>" : ""}</tr>`).join("");
  }
  html += "</table>";
  if (priv) html += `<div class="uw-hidden">${hiddenCount ? `${hiddenCount} more ${isCards ? "card" : "artifact"}${hiddenCount === 1 ? "" : "s"} not shown (fewer than ${f.minPlayers || 3} players). ` : ""}Unused ${isCards ? "cards" : "artifacts"} aren't listed today in ranked divisions.</div>`;
  body.innerHTML = html;
  const head = body.querySelector(".uw-unused-head");
  if (head) head.addEventListener("click", () => { state.showUnused = !(state.showUnused || (q && !shown.length)); renderBody(); });
}
