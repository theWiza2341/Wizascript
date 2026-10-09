// packages/misc/card-history/collector.js
//
// For whoever gathers the reports (the Wizascript maintainer, or a helper):
//
//   - "Collect report codes I see in chat" (My Reports > Collecting codes):
//     while on, every WZR1 code that reaches this browser's chat (public rooms,
//     private messages, and the few older messages a room shows when it opens)
//     is saved here. Off by default; nothing is collected for other players.
//   - "Paste codes…": any text with codes in it, e.g. a copied Discord channel.
//   - "Download collected": one file to share, every reported version once,
//     with how many different people reported it.
//
// The same person sending the same report twice counts once (chat: by their
// account id, which isn't saved in the file; pasted text: by the exact line).
//
// Also, for every Card History user: a code in chat is shown as a short
// "⚑ Card History report (3)" line (click to see the code), so codes don't
// clutter the chat. Players without Wizascript see the plain code.
//
// Read-only: nothing is ever sent to the chat.

import { parseCodes, hasCode } from "./report-codes.js";

const STORE = "wizascript.cardHistory.collected";
const ON = "wizascript.cardHistory.collecting";
const MAX = 5000; // reported versions kept

export const isCollecting = () => GM_getValue(ON, false) === true;
export const setCollecting = (on) => GM_setValue(ON, !!on);

function load() {
  try {
    const v = JSON.parse(GM_getValue(STORE, "{}"));
    return v && typeof v === "object" && v.items ? v : { items: {}, codes: 0 };
  } catch (e) { return { items: {}, codes: 0 }; }
}
const save = (v) => GM_setValue(STORE, JSON.stringify(v));

// Short, one-way tag for "who sent it", only to count people once.
function tag(s) {
  let h = 2166136261;
  for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

// -> how many new (version, person) pairs were added
export function addCodes(text, from) {
  const found = parseCodes(text);
  if (!found.length) return 0;
  const store = load();
  const day = new Date().toISOString().slice(0, 10);
  let added = 0;
  found.forEach(({ line, date, items }) => {
    const who = tag(from ? `u:${from}` : `t:${line}`);
    store.codes = (store.codes || 0) + 1;
    items.forEach((it) => {
      let e = store.items[it.key];
      if (!e) {
        if (Object.keys(store.items).length >= MAX) return;
        e = { kind: it.kind, id: it.id, label: it.label, by: [], dates: [], first: day, last: day };
        store.items[it.key] = e;
      }
      if (!e.by.includes(who)) { e.by.push(who); added++; }
      if (!e.dates.includes(date)) e.dates.push(date);
      e.last = day;
    });
  });
  save(store);
  return added;
}

export function collectedSummary() {
  const s = load();
  const items = Object.values(s.items);
  return { versions: items.length, reports: items.reduce((n, e) => n + e.by.length, 0), codes: s.codes || 0 };
}

export function clearCollected() { save({ items: {}, codes: 0 }); }

// The file to share: every reported version once, most-reported first.
export function collectedFile(nameOf) {
  const s = load();
  const items = Object.entries(s.items).map(([key, e]) => ({
    key, kind: e.kind === "a" ? "artifact" : "card", id: e.id, name: nameOf(e) || "", version: e.label,
    reporters: e.by.length, dataBuilds: e.dates.slice().sort(), firstSeen: e.first, lastSeen: e.last
  })).sort((a, b) => b.reporters - a.reporters || a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
  return { format: "wizascript-card-history-reports 1", exported: new Date().toISOString(), codesRead: s.codes || 0, items };
}

// ---- chat -----------------------------------------------------------------

function messageOf(raw) {
  try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch (e) { return null; }
}

function collectMessage(m) {
  if (!m || m.deleted || typeof m.message !== "string" || !hasCode(m.message)) return;
  const from = m.user && (m.user.id ?? m.user.username);
  addCodes(m.message, from != null ? String(from) : "?");
}

// Shows a code in chat as one short line; the code is in its tooltip and a click shows it.
function compact(root) {
  const lists = root.matches && root.matches(".chat-messages") ? [root] : [...(root.querySelectorAll ? root.querySelectorAll(".chat-messages") : [])];
  const scan = (el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const hits = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.parentElement && n.parentElement.closest(".wz-ch-chatcode")) continue;
      if (hasCode(n.nodeValue)) hits.push(n);
    }
    hits.forEach((n) => {
      const found = parseCodes(n.nodeValue);
      const count = found.reduce((k, f) => k + f.items.length, 0);
      const span = document.createElement("span");
      span.className = "wz-ch-chatcode";
      span.textContent = `⚑ Card History report (${count})`;
      span.title = n.nodeValue.trim();
      span.dataset.code = n.nodeValue;
      span.addEventListener("click", () => { span.textContent = span.dataset.code; span.classList.add("wz-ch-chatcode-open"); });
      n.replaceWith(span);
    });
  };
  if (root.closest && root.closest(".chat-messages")) scan(root);
  else lists.forEach(scan);
}

let wired = false;
export function initChatReports(plugin) {
  if (wired) return;
  wired = true;
  if (plugin && plugin.events) {
    plugin.events.on("Chat:getMessage", (d) => { if (isCollecting()) collectMessage(messageOf(d.chatMessage)); });
    plugin.events.on("Chat:getPrivateMessage", (d) => { if (isCollecting()) collectMessage(messageOf(d.chatMessage)); });
    plugin.events.on("Chat:getHistory", (d) => {
      if (!isCollecting()) return;
      const list = messageOf(d.history);
      if (Array.isArray(list)) list.forEach((m) => collectMessage(messageOf(m)));
    });
  }
  const start = () => {
    compact(document.body);
    new MutationObserver((muts) => {
      muts.forEach((mu) => mu.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.closest(".chat-messages") || n.querySelector(".chat-messages")) compact(n);
      }));
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
}
