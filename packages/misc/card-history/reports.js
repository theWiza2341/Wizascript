// packages/misc/card-history/reports.js
//
// "Report as Bugged/Inaccurate": players flag a version that looks wrong, then
// paste their reports as short codes in Undercards chat or a Discord channel.
//
//   1. Right-click a version in the history window -> "Report as Bugged/
//      Inaccurate". Saved on this computer only (GM wizascript.cardHistory.reports);
//      the version gets a ⚑ badge. Right-click again to take it back.
//   2. "My Reports" (history window button) turns them into chat lines of
//      at most 250 characters (report-codes.js), each with a Copy button, plus
//      "Copy all" for Discord. Copying marks them as sent.
//   3. Whoever gathers them collects the codes from chat or pasted text and
//      downloads one file (collector.js), which is shared for checking.
//   4. Versions confirmed as reported can be listed by hand in
//      card-history/reports.json on the `card-history` branch
//      ({ "items": { "c:161:28.0": { "n": 3 } } }); they get a ⚠ for every player.
//
// Nothing is ever sent by the script: the player pastes the code themselves.

import { getReports, getRules } from "./data.js";
import { artifacts, dialogApi, escHtml, findCard, norm } from "./game.js";
import { encodeLines } from "./report-codes.js";
import { addCodes, clearCollected, collectedFile, collectedSummary, isCollecting, setCollecting } from "./collector.js";

const STORE = "wizascript.cardHistory.reports";
const DEFAULT_CHANNEL = "Undercards chat or the Discord";

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

// ---- everyone's reports (card-history/reports.json, edited by hand) ------

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

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = el("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// "Collecting codes": for whoever gathers everyone's reports.
function collectSection() {
  const box = el("details", "wz-ch-collect");
  box.appendChild(el("summary", "", "Collecting codes (for whoever gathers reports)"));
  const status = el("div", "wz-ch-dim");
  const refresh = () => {
    const s = collectedSummary();
    status.textContent = `${s.versions} version${s.versions === 1 ? "" : "s"} reported, ${s.reports} report${s.reports === 1 ? "" : "s"} from ${s.codes} code${s.codes === 1 ? "" : "s"}.`;
  };
  const opt = el("label", "wz-ch-myreports-opt");
  const on = el("input");
  on.type = "checkbox";
  on.checked = isCollecting();
  on.addEventListener("change", () => setCollecting(on.checked));
  opt.append(on, " Collect report codes I see in chat");
  const paste = el("textarea", "wz-ch-myreports-code");
  paste.placeholder = "Or paste any text with codes in it (e.g. a copied Discord channel)";
  const btns = el("div", "wz-ch-myreports-btns");
  btns.append(
    button("Add pasted codes", "btn-default", () => { const n = addCodes(paste.value, null); paste.value = ""; refresh(); status.textContent = `${n} new. ${status.textContent}`; }),
    button("Download collected", "btn-primary", async () => {
      const arts = await artifacts().catch(() => []);
      const nameOf = (e) => (e.kind === "a" ? (arts.find((a) => norm(a.name) === e.id) || {}).name : (findCard(e.id) || {}).name);
      download(`card-history-reports-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(collectedFile(nameOf), null, 1));
    }),
    button("Clear", "btn-default", () => { if (window.confirm("Clear every collected report?")) { clearCollected(); refresh(); } })
  );
  box.append(opt, paste, btns, status);
  refresh();
  return box;
}

export async function openMyReports() {
  const api = dialogApi();
  if (!api) return;
  const rules = await getRules().catch(() => null);
  const where = (rules && rules.reports) || {};
  const channel = where.channel || DEFAULT_CHANNEL;
  const wrap = el("div", "wz-ch-myreports");
  const collect = collectSection();

  const render = () => {
    const list = load().sort((a, b) => (a.sent ? 1 : 0) - (b.sent ? 1 : 0));
    wrap.replaceChildren();
    if (!list.length) {
      const p = el("p");
      p.innerHTML = "No reports yet. Right-click a version that looks wrong and choose <b>Report as Bugged/Inaccurate</b>.";
      wrap.append(p, collect);
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
    intro.innerHTML = `${unsent.length ? "Paste" : "Everything's been sent. To send again, paste"} ${toSend.length === 1 ? "this" : "these"} in <b>${escHtml(channel)}</b>. Each line fits one chat message.`;
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
      row.append(code, button("Copy", "btn-primary btn-sm", async () => {
        const ok = await copy(line, code);
        markSent(keys);
        status.textContent = ok ? "Copied." : "Select the line and copy it.";
      }));
      lines.appendChild(row);
    });
    const all = el("div", "wz-ch-myreports-btns");
    if (encoded.length > 1) {
      all.appendChild(button("Copy all (for Discord)", "btn-default", async () => {
        const ok = await copy(encoded.map((x) => x.line).join("\n"), lines.querySelector("input"));
        markSent(new Set(toSend.map((r) => r.key)));
        status.textContent = ok ? "Copied all lines." : "Couldn't copy - copy the lines one by one.";
      }));
    }
    wrap.append(intro, table, lines, all, status, collect);
  };
  render();
  api.BD.show({
    title: "My Card History Reports",
    message: api.$(wrap),
    buttons: [{ label: "Close", action: (d) => d.close() }]
  });
}
