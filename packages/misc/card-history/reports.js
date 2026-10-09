// packages/misc/card-history/reports.js
//
// "Report as Bugged/Inaccurate": players flag a version that looks wrong, then
// send their reports as short chat messages in room 0 ("void"), where the UC
// Report Hub collects them.
//
//   1. Right-click a version in the history window -> "Report as Bugged/
//      Inaccurate". Saved on this computer only (GM wizascript.cardHistory.reports);
//      the version gets a ⚑ badge. Right-click again to take it back.
//   2. "My Reports" (history window button) turns them into chat lines of
//      at most 250 characters (report-codes.js). "Send" opens room 0 with a
//      line typed in (core/uc-report.js); the player presses Enter. That, or
//      "Copy", marks the line's reports as sent.
//   3. The hub files them under reports/WZ/; the `card-history` branch's
//      "Card History reports" Action turns them into card-history/reports.json:
//      versions reported by 2+ players get a ⚠ for everyone.
//
// Nothing is ever sent by the script: the player presses Enter themselves.

import { getReports } from "./data.js";
import { dialogApi, escHtml } from "./game.js";
import { encodeLines } from "./report-codes.js";
import { canOpenVoid, openVoid } from "../../core/uc-report.js";

const STORE = "wizascript.cardHistory.reports";

// ---- this player's flags ----------------------------------------------

function load() {
  try {
    const v = JSON.parse(GM_getValue(STORE, "[]"));
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}
function save(list) { GM_setValue(STORE, JSON.stringify(list)); changed(); }

const listeners = new Set();
export const onReportsChanged = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
function changed() { listeners.forEach((fn) => { try { fn(); } catch (e) { /* view gone */ } }); }

// One version of one card or artifact: { kind: "c"|"a", id, name, label, shown }
//   id     card id, or the artifact's file slug
//   label  the version as the window shows it ("28.0", "PA", "<1.6", "today")
//   shown  what the player saw, e.g. "6/4/4 RARE: Magic: ..." (for whoever checks it)
export const reportKey = (t) => `${t.kind}:${t.id}:${t.label}`;

export const myReports = () => load();
export const isReported = (t) => load().some((r) => r.key === reportKey(t));
export const unsentCount = () => load().filter((r) => !r.sent).length;

export function toggleReport(t) {
  const key = reportKey(t);
  const list = load();
  const i = list.findIndex((r) => r.key === key);
  if (i >= 0) list.splice(i, 1);
  else list.push({ key, kind: t.kind, id: String(t.id), name: t.name, label: t.label, shown: String(t.shown || "").slice(0, 140), built: t.built || "", at: new Date().toISOString().slice(0, 10) });
  save(list);
  return i < 0;
}
function removeReport(key) { save(load().filter((r) => r.key !== key)); }

// ---- everyone's reports (card-history/reports.json, built from the hub) ----

let remote = null;
export async function remoteReports() {
  if (remote) return remote;
  const data = await getReports().catch(() => null);
  remote = (data && data.items) || {};
  return remote;
}
export const remoteCount = (t) => (remote && remote[reportKey(t)] ? remote[reportKey(t)].n || 1 : 0);

// ---- badges on the history window ----------------------------------------

// Marks a version node: data for the right-click menu, and its badge.
export function tagNode(node, target) {
  node.dataset.wzChReport = JSON.stringify(target);
  node.classList.add("wz-ch-reportable");
  paintNode(node);
}

export function paintNode(node) {
  let t;
  try { t = JSON.parse(node.dataset.wzChReport); } catch (e) { return; }
  let badge = node.querySelector(":scope > .wz-ch-badge, :scope .wz-ch-badge");
  const mine = isReported(t);
  const others = remoteCount(t);
  if (!mine && !others) { if (badge) badge.remove(); return; }
  if (!badge) {
    badge = document.createElement("div");
    badge.className = "wz-ch-badge";
    (node.querySelector(".wz-ch-badge-spot") || node).appendChild(badge);
  }
  badge.textContent = mine ? "⚑" : "⚠";
  badge.classList.toggle("wz-ch-badge-mine", mine);
  const lines = [];
  if (others) lines.push(`Reported as inaccurate by ${others} player${others === 1 ? "" : "s"}. Being checked.`);
  if (mine) lines.push("You reported this. Right-click to undo; send it from My Reports.");
  badge.title = lines.join("\n");
}

export function repaintAll(root) {
  root.querySelectorAll(".wz-ch-reportable").forEach(paintNode);
}

// ---- right-click menu -------------------------------------------------------

let menu = null;
export const isReportMenuOpen = () => !!(menu && menu.isConnected);
// Controller: ✕ presses the menu's action (it only has one).
export function pressReportMenu() {
  const li = menu && menu.querySelector("li:not(.wz-ch-menu-off)");
  if (li) li.click();
}
export function closeReportMenu() {
  const was = !!(menu && menu.isConnected);
  if (menu) menu.remove();
  menu = null;
  return was;
}

function openMenu(node, x, y) {
  closeReportMenu();
  const t = JSON.parse(node.dataset.wzChReport);
  const mine = isReported(t);
  menu = document.createElement("ul");
  menu.className = "wz-ch-menu";
  const head = document.createElement("header");
  head.textContent = `${t.name} - ${t.label === "today" ? "today" : t.label}`;
  const li = document.createElement("li");
  li.textContent = mine ? "⚑ Undo my report" : "⚑ Report as Bugged/Inaccurate";
  li.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleReport(t);
    closeReportMenu();
  });
  menu.append(head, li);
  const others = remoteCount(t);
  if (others) {
    const note = document.createElement("li");
    note.className = "wz-ch-menu-off";
    note.textContent = `⚠ Already reported by ${others}`;
    menu.appendChild(note);
  }
  document.body.appendChild(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(4, Math.min(x, window.innerWidth - r.width - 4))}px`;
  menu.style.top = `${Math.max(4, Math.min(y, window.innerHeight - r.height - 4))}px`;
}

let wired = false;
export function wireReportMenu() {
  if (wired) return;
  wired = true;
  document.addEventListener("contextmenu", (e) => {
    if (menu && menu.contains(e.target)) { e.preventDefault(); return; }
    const node = e.target.closest && e.target.closest(".wz-ch-reportable");
    if (!node) return;
    e.preventDefault();
    e.stopPropagation();
    openMenu(node, e.clientX, e.clientY);
  }, true);
  document.addEventListener("mousedown", (e) => {
    if (menu && e.button === 0 && !menu.contains(e.target)) closeReportMenu();
  }, true);
  let swallowEscUp = false;
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && closeReportMenu()) { e.stopPropagation(); swallowEscUp = true; }
  }, true);
  document.addEventListener("keyup", (e) => {
    if (e.key === "Escape" && swallowEscUp) { swallowEscUp = false; e.stopPropagation(); }
  }, true);
}

// ---- My Reports dialog ----------------------------------------------------

async function copy(text, box) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall back */ }
  try { box.focus(); box.select(); return document.execCommand("copy"); } catch (e) { return false; }
}

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const button = (label, cls, fn) => { const b = el("button", `btn ${cls}`, label); b.type = "button"; b.addEventListener("click", fn); return b; };

function markSent(keys) { save(load().map((r) => (keys.has(r.key) ? { ...r, sent: true } : r))); }

export async function openMyReports() {
  const api = dialogApi();
  if (!api) return;
  const wrap = el("div", "wz-ch-myreports");
  const chat = canOpenVoid();

  const render = () => {
    const list = load().sort((a, b) => (a.sent ? 1 : 0) - (b.sent ? 1 : 0));
    wrap.replaceChildren();
    if (!list.length) {
      const p = el("p");
      p.innerHTML = "No reports yet. Right-click a version that looks wrong and choose <b>Report as Bugged/Inaccurate</b>.";
      wrap.append(p);
      return;
    }
    const table = el("table", "wz-ch-myreports-list");
    list.forEach((r) => {
      const tr = el("tr");
      tr.innerHTML = `<td>${escHtml(r.name)}</td><td>${escHtml(r.label)}</td><td class="wz-ch-dim">${r.sent ? "sent" : "not sent"}</td><td></td>`;
      tr.lastChild.appendChild(button("×", "btn-xs btn-default", () => { removeReport(r.key); render(); }));
      table.appendChild(tr);
    });
    const unsent = list.filter((r) => !r.sent);
    const toSend = unsent.length ? unsent : list;
    const intro = el("p");
    intro.innerHTML = chat
      ? `${unsent.length ? "" : "Everything's been sent. "}<b>Send</b> opens the chat with ${toSend.length === 1 ? "your report" : "a report line"} typed in: press <b>Enter</b> to send it. ${encodeLines(toSend).length > 1 ? "Send one line, then come back for the next." : ""}`
      : "Open this on a page with chat (like Home) to send your reports.";
    const lines = el("div", "wz-ch-codelines");
    const status = el("div", "wz-ch-dim");
    const encoded = encodeLines(toSend);
    encoded.forEach(({ line, reports }) => {
      const keys = new Set(reports.map((r) => r.key));
      const row = el("div", "wz-ch-codeline");
      const code = el("input", "wz-ch-code");
      code.readOnly = true;
      code.value = line;
      code.addEventListener("focus", () => code.select());
      row.appendChild(code);
      if (chat) {
        row.appendChild(button("Send", "btn-primary btn-sm", () => {
          markSent(keys);
          openVoid(line);
        }));
      }
      row.appendChild(button("Copy", "btn-default btn-sm", async () => {
        const ok = await copy(line, code);
        markSent(keys);
        status.textContent = ok ? "Copied." : "Select the line and copy it.";
      }));
      lines.appendChild(row);
    });
    wrap.append(intro, table, lines, status);
  };
  render();
  api.BD.show({
    title: "My Card History Reports",
    message: api.$(wrap),
    buttons: [{ label: "Close", action: (d) => d.close() }]
  });
}
