// packages/usage-stats/profile.js
//
// Your Profile page: the season stats table, split by division.
//  - left: Total, each division you played that season (highest first), Unranked,
//    and True Hub (gold; games started at 1820+ Elo), as small buttons;
//  - right: ◀ <month> Season ▶ (seasons are calendar months), and an "Elo Graph"
//    button that opens a floating, movable, resizable graph (setting: hide it).
// The site's own table is reused: a button refills its numbers. This season's
// Total is the site's own numbers (every game, also those Wizascript didn't see);
// everything else is the games Wizascript recorded.

import { myGames } from "./api.js";
import { SOULS, LADDER, TRUE_HUB_ELO, DIV_NAMES, minElos, divHtml, seasonOf, shiftSeason, seasonLabel, log } from "./common.js";

const GRAPH_KEY = "wizascript.usageStats.graph"; // { x, y, w, h, open }
const STYLE_ID = "wz-us-profile-style";
const CSS = `
#wz-season-bar { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin:10px 0 6px; position:relative; }
#wz-season-bar .wz-divs { display:flex; gap:6px; flex-wrap:wrap; }
#wz-season-bar .wz-div { background:transparent; color:#fff; border:1px solid #fff; padding:3px 10px; font:inherit; font-size:14px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; white-space:nowrap; }
#wz-season-bar .wz-div img, #wz-season-bar .wz-div .divisionIcon { height:18px !important; width:auto !important; max-height:18px !important; margin:0 !important; }
#wz-season-bar .wz-div:hover { background:rgba(255,255,255,.12); }
#wz-season-bar .wz-div.on { background:#fff; color:#000; }
#wz-season-bar .wz-div.th { border-color:#ffd700; color:#ffd700; }
#wz-season-bar .wz-div.th.on { background:#ffd700; color:#000; }
#wz-season-bar .wz-right { display:flex; align-items:center; gap:14px; }
#wz-season-bar .wz-graph-btn { background:transparent; color:#fff; border:1px solid #fff; padding:3px 10px; font:inherit; font-size:14px; cursor:pointer; white-space:nowrap; }
#wz-season-bar .wz-graph-btn.on { background:#fff; color:#000; }
#wz-season-bar .wz-season { display:flex; align-items:center; gap:10px; margin:0; white-space:nowrap; }
#wz-season-bar .wz-arrow { background:none; border:none; color:#fff; font:inherit; font-size:1em; cursor:pointer; padding:0 4px; }
#wz-season-bar .wz-arrow:disabled { opacity:.25; cursor:default; }
#wz-season-bar .wz-msg { width:100%; color:#aaa; font-size:13px; }
#wz-elo-win { position:fixed; z-index:1000; min-width:260px; min-height:130px; display:flex; flex-direction:column; background:rgba(10,5,15,.92); border:1px solid #fff; box-shadow:0 4px 16px rgba(0,0,0,.6); font-family:inherit; color:#fff; box-sizing:border-box; }
#wz-elo-win .wz-title { display:flex; align-items:center; justify-content:space-between; padding:3px 6px 3px 8px; border-bottom:1px solid rgba(255,255,255,.4); cursor:move; user-select:none; font-size:13px; }
#wz-elo-win .wz-x { background:none; border:none; color:#fff; font:inherit; font-size:16px; line-height:1; cursor:pointer; padding:0 4px; }
#wz-elo-win .wz-chart { position:relative; flex:1; padding:18px 48px 8px 8px; box-sizing:border-box; min-height:0; }
#wz-elo-win .wz-chart svg { width:100%; height:100%; display:block; overflow:visible; }
#wz-elo-win .wz-chart .tip { position:absolute; top:3px; left:8px; right:8px; font-size:11px; color:#ddd; white-space:nowrap; overflow:hidden; pointer-events:none; }
#wz-elo-win .wz-chart .lbl { position:absolute; right:5px; font-size:10px; line-height:10px; transform:translateY(-50%); pointer-events:none; color:rgba(255,255,255,.7); }
#wz-elo-win .wz-chart .lbl.th { color:#ffd700; }
#wz-elo-win .wz-chart .dot { position:absolute; width:7px; height:7px; border-radius:50%; background:#fff; transform:translate(-50%,-50%); pointer-events:none; display:none; }
#wz-elo-win .wz-grip { position:absolute; right:0; bottom:0; width:14px; height:14px; cursor:nwse-resize; background:linear-gradient(135deg, transparent 50%, rgba(255,255,255,.7) 50%); }
tr.wz-empty td { color:#999; text-align:center; font-size:13px; }
`;

const ranked = (g) => g.rankedUnlocked && g.oldElo !== null && g.oldElo !== undefined && !!g.oldDivision;
const bucketsOf = (g) => [ranked(g) ? g.oldDivision : "UNRANKED", ...(ranked(g) && g.oldElo >= TRUE_HUB_ELO ? ["TRUEHUB"] : [])];

export function findStatsTable() {
  return [...document.querySelectorAll("table.table")].find((tb) => tb.querySelector('[data-i18n*="profile-win-rate"]')) || null;
}

export function startProfile({ showGraph }) {
  const table = findStatsTable();
  if (!table) return null;
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement("style"); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st);
  }
  const rows = [...table.querySelectorAll("tr")].slice(1); // All + 7 souls
  const original = rows.map((r) => [...r.children].slice(1).map((td) => ({ html: td.innerHTML, cls: td.className })));
  const rowSouls = rows.slice(1).map((r) => {
    const el = r.querySelector('[data-i18n*="SOUL:"]');
    const m = el && el.getAttribute("data-i18n").match(/SOUL:(\w+)/);
    return m ? m[1] : r.children[0].textContent.trim().toUpperCase();
  });

  // The "Current season stats" heading is replaced by the bar.
  let heading = null;
  for (let el = table; el && !heading; el = el.parentElement) {
    for (let s = el.previousElementSibling; s; s = s.previousElementSibling) {
      if (/^H[1-6]$/.test(s.tagName) || /season/i.test(s.textContent)) { heading = s; break; }
    }
    if (el.parentElement === document.body) break;
  }

  const bar = document.createElement("div"); bar.id = "wz-season-bar";
  const divsBox = document.createElement("div"); divsBox.className = "wz-divs";
  const graphBtn = document.createElement("button"); graphBtn.type = "button"; graphBtn.className = "wz-graph-btn"; graphBtn.textContent = "Elo Graph";
  const seasonBox = document.createElement(heading && /^H[1-6]$/.test(heading.tagName) ? heading.tagName : "h2");
  if (heading) seasonBox.className = heading.className;
  seasonBox.classList.add("wz-season");
  seasonBox.innerHTML = '<button type="button" class="wz-arrow" data-d="-1" title="Earlier season">◀</button><span class="wz-label"></span><button type="button" class="wz-arrow" data-d="1" title="Later season">▶</button>';
  seasonBox.title = "A season is a calendar month";
  const right = document.createElement("div"); right.className = "wz-right";
  right.append(graphBtn, seasonBox);
  const msg = document.createElement("div"); msg.className = "wz-msg";
  bar.append(divsBox, right, msg);
  if (heading) heading.style.display = "none";
  (heading || table).parentNode.insertBefore(bar, heading ? heading.nextSibling : table);

  // ---- the Elo Graph window ----
  const win = document.createElement("div"); win.id = "wz-elo-win"; win.style.display = "none";
  win.innerHTML = '<div class="wz-title"><span class="wz-wtitle">Elo Graph</span><button type="button" class="wz-x" title="Close">×</button></div><div class="wz-chart"></div><div class="wz-grip"></div>';
  document.body.appendChild(win);
  const chart = win.querySelector(".wz-chart");
  let rect = { x: null, y: null, w: 460, h: 200, open: false };
  try { rect = { ...rect, ...JSON.parse(GM_getValue(GRAPH_KEY, "null")) }; } catch (e) { /* defaults */ }
  const saveRect = () => { try { GM_setValue(GRAPH_KEY, JSON.stringify(rect)); } catch (e) { /* no GM */ } };
  const keepOnScreen = () => {
    const m = 8;
    rect.w = Math.min(rect.w, innerWidth - 2 * m); rect.h = Math.min(rect.h, innerHeight - 2 * m);
    rect.x = Math.max(m, Math.min(rect.x, innerWidth - rect.w - m)); rect.y = Math.max(m, Math.min(rect.y, innerHeight - rect.h - m));
    Object.assign(win.style, { left: rect.x + "px", top: rect.y + "px", width: rect.w + "px", height: rect.h + "px" });
  };
  function setOpen(open, save = true) {
    if (open && rect.x === null) { const b = bar.getBoundingClientRect(); rect.x = b.right - rect.w; rect.y = b.top - rect.h - 10; }
    win.style.display = open ? "flex" : "none"; graphBtn.classList.toggle("on", open);
    rect.open = open; if (save) saveRect();
    if (open) { keepOnScreen(); drawChart(); }
  }
  graphBtn.addEventListener("click", () => setOpen(win.style.display === "none"));
  win.querySelector(".wz-x").addEventListener("click", () => setOpen(false));
  const follow = (e0, apply) => {
    e0.preventDefault();
    const start = { ...rect, px: e0.clientX, py: e0.clientY };
    const move = (e) => { apply(start, e.clientX - start.px, e.clientY - start.py); keepOnScreen(); };
    const up = () => { document.removeEventListener("pointermove", move, true); document.removeEventListener("pointerup", up, true); saveRect(); };
    document.addEventListener("pointermove", move, true); document.addEventListener("pointerup", up, true);
  };
  win.querySelector(".wz-title").addEventListener("pointerdown", (e) => { if (!e.target.closest(".wz-x")) follow(e, (s, dx, dy) => { rect.x = s.x + dx; rect.y = s.y + dy; }); });
  win.querySelector(".wz-grip").addEventListener("pointerdown", (e) => follow(e, (s, dx, dy) => { rect.w = Math.max(260, s.w + dx); rect.h = Math.max(130, s.h + dy); }));
  win.querySelector(".wz-title").addEventListener("dblclick", () => { rect.w = 460; rect.h = 200; keepOnScreen(); saveRect(); drawChart(); });
  addEventListener("resize", () => { if (win.style.display !== "none") { keepOnScreen(); drawChart(); } });
  new ResizeObserver(() => { if (win.style.display !== "none") drawChart(); }).observe(win);

  // ---- data ----
  const current = seasonOf(Date.now());
  const state = { season: current, div: "TOTAL", earliest: current, data: {}, loading: false, error: "" };
  async function load(season) {
    if (state.data[season]) return;
    state.loading = true; render();
    try {
      const d = await myGames(season);
      state.data[season] = d.games || [];
      const first = (d.seasons || [])[0];
      if (first && first.season < state.earliest) state.earliest = first.season;
      state.error = "";
    } catch (e) {
      state.error = e.message || "Couldn't reach the Wizascript server.";
      log("profile:", e);
    }
    state.loading = false; render();
  }

  const fmtRate = (w, l) => { const n = w + l; if (!n) return { text: "-", cls: "" }; const r = Math.round(w / n * 10000) / 100; return { text: `${r}%`, cls: r >= 50 ? "green" : "red" }; };
  const setRow = (i, w, l) => {
    const c = rows[i].children; const rate = fmtRate(w, l);
    c[1].textContent = w; c[1].className = "green"; c[2].textContent = l; c[2].className = "red";
    c[3].textContent = rate.text; c[3].className = rate.cls;
  };
  const restoreRows = () => rows.forEach((r, i) => [...r.children].slice(1).forEach((td, j) => { td.innerHTML = original[i][j].html; td.className = original[i][j].cls; }));
  let emptyRow = null;

  // ---- the graph: Elo after each ranked game; the selected division's band shaded ----
  const SVGNS = "http://www.w3.org/2000/svg";
  function drawChart() {
    const games = state.data[state.season] || [];
    const bucket = state.div;
    win.querySelector(".wz-wtitle").textContent = `Elo Graph · ${seasonLabel(state.season)}` + (bucket !== "TOTAL" ? ` · ${DIV_NAMES[bucket]}` : "");
    if (win.style.display === "none") return;
    chart.innerHTML = "";
    const pts = games.filter(ranked).filter((g) => g.newElo !== null && g.newElo !== undefined);
    if (pts.length < 2) { chart.innerHTML = '<div class="tip">Not enough ranked games recorded this season.</div>'; return; }
    const MIN_ELOS = minElos();
    const W = 600, H = 100;
    const elos = pts.flatMap((g) => [g.oldElo, g.newElo]);
    const lo = Math.min(...elos) - 20, hi = Math.max(...elos) + 20;
    const x = (i) => i / pts.length * W, y = (e) => H - (e - lo) / (hi - lo) * H;
    const svg = document.createElementNS(SVGNS, "svg"); svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("preserveAspectRatio", "none");
    const add = (tag, attrs) => { const el = document.createElementNS(SVGNS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); svg.appendChild(el); return el; };
    const band = bucket === "TRUEHUB" ? [TRUE_HUB_ELO, Infinity]
      : MIN_ELOS[bucket] !== undefined ? [MIN_ELOS[bucket], Math.min(...Object.values(MIN_ELOS).filter((v) => v > MIN_ELOS[bucket]), Infinity)] : null;
    if (band) {
      const top = y(Math.min(band[1], hi)), bot = y(Math.max(band[0], lo));
      if (bot > top) add("rect", { x: 0, y: top, width: W, height: bot - top, fill: bucket === "TRUEHUB" ? "rgba(255,215,0,.15)" : "rgba(255,255,255,.1)" });
    }
    for (const e of Object.values(MIN_ELOS)) if (e > lo && e < hi) add("line", { x1: 0, x2: W, y1: y(e), y2: y(e), stroke: "rgba(255,255,255,.35)", "stroke-dasharray": "3 3", "vector-effect": "non-scaling-stroke" });
    if (TRUE_HUB_ELO > lo && TRUE_HUB_ELO < hi) add("line", { x1: 0, x2: W, y1: y(TRUE_HUB_ELO), y2: y(TRUE_HUB_ELO), stroke: "rgba(255,215,0,.6)", "stroke-dasharray": "2 2", "vector-effect": "non-scaling-stroke" });
    const pct = (e) => `calc(18px + ${(y(e) / H).toFixed(4)} * (100% - 26px))`;
    const SHORT = { MASTER: "M", HIGH_MASTER: "HM", ULTIMATE_MASTER: "UM", LEGEND: "L" };
    const labels = Object.entries(MIN_ELOS).filter(([, e]) => e > lo && e < hi).map(([d, e]) => [`${SHORT[d] || d} ${e}`, e, ""]);
    if (TRUE_HUB_ELO > lo && TRUE_HUB_ELO < hi) labels.push([`TH ${TRUE_HUB_ELO}`, TRUE_HUB_ELO, "th"]);
    labels.sort((a, b) => (b[2] === "th") - (a[2] === "th"));
    const placed = [];
    for (const [text, e, cls] of labels) {
      const yy = y(e); if (placed.some((p) => Math.abs(p - yy) < 11)) continue; placed.push(yy);
      const l = document.createElement("div"); l.className = "lbl " + cls; l.textContent = text; l.style.top = pct(e); chart.appendChild(l);
    }
    add("polyline", { points: [`0,${y(pts[0].oldElo)}`, ...pts.map((g, i) => `${x(i + 1)},${y(g.newElo)}`)].join(" "), fill: "none", stroke: "#fff", "stroke-width": 1.5, "vector-effect": "non-scaling-stroke" });
    chart.appendChild(svg);
    const dot = document.createElement("div"); dot.className = "dot"; chart.appendChild(dot);
    const tip = document.createElement("div"); tip.className = "tip";
    tip.textContent = `Elo ${pts[0].oldElo} → ${pts[pts.length - 1].newElo} · ${pts.length} ranked games`;
    const idle = tip.textContent; chart.appendChild(tip);
    svg.addEventListener("mousemove", (e) => {
      const r = svg.getBoundingClientRect();
      const i = Math.max(0, Math.min(pts.length - 1, Math.round((e.clientX - r.left) / r.width * pts.length) - 1));
      const g = pts[i];
      dot.style.left = `calc(8px + ${(x(i + 1) / W).toFixed(4)} * (100% - 56px))`; dot.style.top = pct(g.newElo); dot.style.display = "block";
      tip.textContent = `Game ${i + 1}: ${g.win ? "Win" : "Loss"} · ${g.oldElo} → ${g.newElo}${g.oldElo >= TRUE_HUB_ELO ? " · True Hub" : ""}`;
    });
    svg.addEventListener("mouseleave", () => { dot.style.display = "none"; tip.textContent = idle; });
  }

  function render() {
    const games = state.data[state.season] || [];
    const seen = new Set(games.flatMap(bucketsOf));
    const buckets = [...[...LADDER, "UNRANKED"].filter((d) => seen.has(d)), ...(seen.has("TRUEHUB") ? ["TRUEHUB"] : [])];
    if (state.div !== "TOTAL" && !buckets.includes(state.div)) state.div = "TOTAL";
    divsBox.replaceChildren();
    for (const d of ["TOTAL", ...buckets]) {
      const b = document.createElement("button"); b.type = "button";
      b.className = "wz-div" + (d === "TRUEHUB" ? " th" : "") + (state.div === d ? " on" : "");
      b.innerHTML = divHtml(d);
      b.title = d === "TRUEHUB" ? `Games started at ${TRUE_HUB_ELO}+ Elo (True Hub decks can be posted)`
        : d === "TOTAL" ? (state.season === current ? "Every PvP game this season (the site's own numbers)" : "Every recorded game that season") : DIV_NAMES[d];
      b.addEventListener("click", () => { state.div = d; render(); });
      divsBox.appendChild(b);
    }
    seasonBox.querySelector(".wz-label").textContent = `${seasonLabel(state.season)} Season`;
    const [prev, next] = seasonBox.querySelectorAll(".wz-arrow");
    prev.disabled = state.season <= state.earliest; next.disabled = state.season >= current;
    graphBtn.style.display = showGraph() ? "" : "none";
    if (!showGraph() && win.style.display !== "none") setOpen(false, false);
    if (emptyRow) { emptyRow.remove(); emptyRow = null; }
    if (state.season === current && state.div === "TOTAL") restoreRows();
    else {
      const per = Object.fromEntries(SOULS.map((s) => [s, { w: 0, l: 0 }]));
      for (const g of games) if ((state.div === "TOTAL" || bucketsOf(g).includes(state.div)) && per[g.soul]) per[g.soul][g.win ? "w" : "l"]++;
      const all = Object.values(per).reduce((a, x) => ({ w: a.w + x.w, l: a.l + x.l }), { w: 0, l: 0 });
      setRow(0, all.w, all.l);
      rowSouls.forEach((s, i) => { const v = per[s] || { w: 0, l: 0 }; setRow(i + 1, v.w, v.l); });
      if (!games.length && !state.loading) {
        emptyRow = document.createElement("tr"); emptyRow.className = "wz-empty";
        emptyRow.innerHTML = `<td colspan="4">No games recorded for ${seasonLabel(state.season)}.</td>`;
        rows[rows.length - 1].after(emptyRow);
      }
    }
    msg.textContent = state.loading ? "Loading recorded games…" : state.error ? `Wizascript: ${state.error}` : "";
    msg.style.display = msg.textContent ? "" : "none";
    drawChart();
  }
  seasonBox.querySelectorAll(".wz-arrow").forEach((a) => a.addEventListener("click", () => {
    state.season = shiftSeason(state.season, Number(a.dataset.d));
    render(); load(state.season);
  }));
  render();
  load(current).then(() => { if (rect.open && showGraph()) setOpen(true, false); });
  return { refresh: render };
}
