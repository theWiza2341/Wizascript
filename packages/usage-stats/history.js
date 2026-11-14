// packages/usage-stats/history.js
//
// Your History page: page 1 is the site's own 20 rows, untouched. Pages 2+ are
// this season's older PvP games that Wizascript recorded (20 a page, newest
// first, back to the 1st of the month), in the site's own row style, with the
// opponent in their soul's colour (the name only for games this device
// recorded: names never leave it, 1.8.0) and an extra Elo column. The pager sits above
// the table (True Hub Bridge's style); the mouse wheel over the table turns
// pages (setting).

import { myGames, opponentOf } from "./api.js";
import { DIV_NAMES, t, esc, soulHtml, seasonOf, log } from "./common.js";

const PER_PAGE = 20;
const STYLE_ID = "wz-us-history-style";
const CSS = `
.wz-hist-row .wz-div-cell img, .wz-hist-row .wz-div-cell .divisionIcon { height:16px !important; width:auto !important; max-height:16px !important; margin:0 4px 0 0 !important; vertical-align:middle; }
.wz-hist-row .wz-div-cell { white-space:nowrap; }
#wz-hist-pager { display:flex; align-items:center; justify-content:flex-end; gap:6px; margin:8px 0; }
#wz-hist-pager select, #wz-hist-pager option { color:#fff; background:#222; border:1px solid #fff; }
#wz-hist-pager .wz-note { margin-right:auto; color:#aaa; font-size:13px; }
`;

export function findHistoryTable() {
  return [...document.querySelectorAll("table.table")].find((tb) => tb.querySelector('[data-i18n*="history-result"]')) || null;
}

// A row's age in minutes (the site prints days, hours, minutes).
const ageOf = (row) => {
  const d = row.querySelector("[data-i18n-args]");
  if (!d) return 0;
  const [dd, hh, mm] = d.getAttribute("data-i18n-args").split(",").map((n) => parseInt(n, 10) || 0);
  return dd * 1440 + hh * 60 + mm;
};

export function startHistory({ wheelPaging }) {
  const table = findHistoryTable();
  if (!table) return null;
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement("style"); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st);
  }
  const allRows = [...table.querySelectorAll("tr")];
  const header = allRows[0];
  const siteRows = allRows.slice(1);
  const eloHead = document.createElement(header.children[0] ? header.children[0].tagName : "td");
  eloHead.textContent = "Elo";
  // Games already on page 1: everything since the site's oldest row (a minute's slack).
  // With fewer than 20 rows the site shows every game there is.
  const boundary = siteRows.length >= PER_PAGE ? Date.now() - (Math.max(0, ...siteRows.map(ageOf)) + 1) * 60e3 : Infinity;
  let games = [];

  const timeText = (at) => {
    const min = Math.max(0, Math.floor((Date.now() - at) / 60e3));
    const d = Math.floor(min / 1440), hh = Math.floor((min % 1440) / 60), m = min % 60;
    return t("history-time", `${d} days ${hh} hours ${m} minutes`, d, hh, m);
  };
  const divIcon = (d) => t(`{{DIVISION:${d}}}`, "");
  const rowFor = (g) => {
    const tr = document.createElement("tr"); tr.className = "wz-hist-row";
    const ranked = g.rankedUnlocked && g.oldElo !== null && g.oldElo !== undefined;
    const delta = ranked ? g.newElo - g.oldElo : 0;
    const moved = ranked && g.oldDivision !== g.newDivision;
    tr.innerHTML = `
      <td class="${g.win ? "green" : "red"}">${g.win ? t("history-victory", "VICTORY") : t("history-defeat", "DEFEAT")}</td>
      <td>${soulHtml(g.soul)}</td>
      <td>${(() => { const n = opponentOf(g.gameId); return n ? `<span class="${esc(g.enemySoul || "")}">${esc(n)}</span>` : `<span style="color:#888" title="Opponents' names stay on the device that recorded the game">${g.enemySoul ? `<span class="${esc(g.enemySoul)}">?</span>` : "—"}</span>`; })()}</td>
      <td>${t("game-type-pvp", "PvP")}</td>
      <td>${timeText(g.at)}</td>
      ${!ranked ? `<td class="wz-div-cell">${t("pvp-unranked", "Unranked")}</td>`
        : `<td class="wz-div-cell" title="${esc(DIV_NAMES[g.oldDivision] || g.oldDivision)}${moved ? " → " + esc(DIV_NAMES[g.newDivision] || g.newDivision) : ""}">${divIcon(g.oldDivision)}<span>${g.oldElo} → ${g.newElo}</span> <span class="${delta >= 0 ? "green" : "red"}">(${delta >= 0 ? "+" : ""}${delta})</span></td>`}`;
    return tr;
  };

  const pager = document.createElement("div"); pager.id = "wz-hist-pager";
  pager.innerHTML = '<span class="wz-note"></span><button type="button" class="btn btn-primary" data-d="-1">&#10094;</button><select></select><span>/</span><span class="wz-max"></span><button type="button" class="btn btn-primary" data-d="1">&#10095;</button>';
  table.before(pager);
  const note = pager.querySelector(".wz-note");
  const sel = pager.querySelector("select");
  const [prevBtn, nextBtn] = pager.querySelectorAll("button");
  let page = 1, added = [], status = ""; // page 1 only shows a note when something went wrong
  const pages = () => 1 + Math.ceil(games.length / PER_PAGE);

  function render() {
    added.forEach((r) => r.remove()); added = [];
    siteRows.forEach((r) => { r.style.display = page === 1 ? "" : "none"; });
    if (page === 1) eloHead.remove(); else header.appendChild(eloHead);
    if (page > 1) {
      added = games.slice((page - 2) * PER_PAGE, (page - 1) * PER_PAGE).map(rowFor);
      (table.tBodies[0] || table).append(...added);
    }
    const n = pages();
    sel.innerHTML = Array.from({ length: n }, (_, i) => `<option value="${i + 1}"${i + 1 === page ? " selected" : ""}>${i + 1}</option>`).join("");
    pager.querySelector(".wz-max").textContent = n;
    prevBtn.disabled = page <= 1; nextBtn.disabled = page >= n;
    note.textContent = page > 1 ? "Older PvP games this season, recorded by Wizascript" : status;
  }
  const go = (p) => { const n = Math.min(pages(), Math.max(1, p)); if (n !== page) { page = n; render(); } };
  pager.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => go(page + Number(b.dataset.d))));
  sel.addEventListener("change", () => go(Number(sel.value)));
  // One page per wheel gesture (a 250 ms lock, so trackpads don't race through pages).
  let wheelLock = 0;
  table.addEventListener("wheel", (e) => {
    if (!wheelPaging() || !e.deltaY || pages() <= 1) return;
    const next = Math.min(pages(), Math.max(1, page + (e.deltaY > 0 ? 1 : -1)));
    if (next === page) return; // at the first/last page the page scrolls as usual
    e.preventDefault();
    const now = Date.now(); if (now < wheelLock) return; wheelLock = now + 250;
    go(next);
  }, { passive: false });
  render();

  myGames(seasonOf(Date.now())).then((d) => {
    games = (d.games || []).filter((g) => g.at < boundary).sort((a, b) => b.at - a.at);
    render();
  }, (e) => { status = `Wizascript: ${e.message || "couldn't load recorded games"}`; log("history:", e); render(); });
  return { render };
}
