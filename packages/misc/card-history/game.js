// packages/misc/card-history/game.js
//
// Everything Card History reads from the game page. Wizascript runs in
// Tampermonkey's sandbox, so page globals ($, appendCard, BootstrapDialog,
// getResizedFontSize, allCards) come through getPageWindow().

import { getPageWindow } from "../../core/page-window.js";

const W = () => getPageWindow();
let cardFile = null; // the page's own card file, when allCards is empty here
let artifactList = null;

export const page$ = () => W().$;
export const hasI18n = () => { const $ = page$(); return !!($ && $.i18n); };

// The card list. Some pages (Artifacts) have an EMPTY allCards, so fall back
// to the site's own localStorage cache, then to the page's current card file.
export function allCards() {
  const w = W();
  if (Array.isArray(w.allCards) && w.allCards.length) return w.allCards;
  if (cardFile && cardFile.length) return cardFile;
  try {
    const ls = JSON.parse(w.localStorage.getItem("allCards") || "[]");
    if (Array.isArray(ls) && ls.length) return ls;
  } catch (e) { /* ignore */ }
  return [];
}

export async function ensureCards() {
  if (allCards().length) return;
  const cfg = W().cardsClientConfig;
  if (!cfg || !cfg.url) return;
  try {
    const d = await (await fetch(cfg.url, { credentials: "same-origin" })).json();
    const list = Array.isArray(d) ? d : (d && (d.cards || d.allCards)) || [];
    cardFile = typeof list === "string" ? JSON.parse(list) : list;
  } catch (e) { /* formatting just won't link card names */ }
}

export function findCard(q) {
  const list = allCards();
  const s = String(q);
  if (/^\d+$/.test(s)) return list.find((c) => String(c.id) === s || String(c.fixedId) === s) || null;
  const n = norm(s);
  return list.find((c) => norm(c.name) === n) || null;
}

export async function artifacts() {
  if (artifactList) return artifactList;
  try {
    const data = await (await fetch("/DecksConfig", { credentials: "same-origin" })).json();
    const raw = data && data.allArtifacts;
    artifactList = (typeof raw === "string" ? JSON.parse(raw) : raw) || [];
  } catch (e) {
    artifactList = [];
  }
  return artifactList;
}

export const norm = (s) => String(s || "").toLowerCase().replace(/&amp;/g, "&").replace(/[^a-z0-9]/g, "");

// ---------- translations ----------
export function tr(key, ...args) {
  try {
    const v = page$().i18n(key, ...args);
    if (!v || v === key) return "";
    const d = document.createElement("div");
    d.innerHTML = v;
    return d.textContent.trim();
  } catch (e) { return ""; }
}

// Internal names that slipped through untranslated ("rarity-generated", "kw-ranged").
const INTERNAL_KEY = /\b(?:kw|rarity|tribe|soul|enchant|status)-([a-z0-9]+(?:-[a-z0-9]+)*)\b/g;
export const unkey = (html) => String(html).replace(/(^|>)([^<]*)/g, (m, gt, text) =>
  gt + text.replace(INTERNAL_KEY, (k, id) => id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())));

// The game's own translated HTML (codes already rendered and coloured).
export function trHtml(key) {
  try { const v = page$().i18n(key); return v && v !== key ? unkey(v) : ""; } catch (e) { return ""; }
}

export const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// "KW:RANGED" / "RARITY:GENERATED|override=x" -> "Ranged" / "x" (how the game would show it).
function prettyCode(raw) {
  const s = String(raw || "");
  const ov = s.match(/override=([^|}]+)/);
  if (ov) return ov[1];
  const m = s.match(/^[A-Z_]+:([^|}]+)/);
  return m ? m[1].toLowerCase().replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : s;
}

// A game code ({{KW:TAUNT}}, {{CARD:12|1}}...) -> the game's HTML for it.
export function render(code, fallback) {
  try {
    const v = page$().i18n(code);
    if (!v || v === code || /^\s*[a-z]+(?:-[a-z0-9]+)+\s*$/.test(v)) return escHtml(prettyCode(fallback));
    return unkey(v);
  } catch (e) { return escHtml(prettyCode(fallback)); }
}

// Translation keys the game knows with this prefix (picks up new keywords etc.).
export function knownKeys(prefix) {
  try {
    const i = page$().i18n();
    const store = i.messageStore;
    const msgs = Object.assign({}, store.messages.en || {}, store.messages[i.locale] || {});
    return Object.keys(msgs).filter((k) => k.startsWith(prefix) && !/-desc$/.test(k)).map((k) => k.slice(prefix.length));
  } catch (e) { return []; }
}

// ---------- drawing helpers ----------
export function appendCard(card) {
  const fn = W().appendCard;
  if (typeof fn !== "function") return null;
  try { const r = fn(card, null); return (r && (r[0] || r)) || null; } catch (e) { return null; }
}

// The game's text sizing, exactly as appendCard uses it:
// getResizedFontSize($cardDescDiv, 81) and getResizedFontSize($cardNameDiv, 25).
export function gameFontSize(div, maxHeight) {
  try {
    const w = W();
    if (typeof w.getResizedFontSize === "function" && w.$) {
      div.style.fontSize = "";
      div.style.fontSize = `${w.getResizedFontSize(w.$(div), maxHeight)}px`;
    }
  } catch (e) { /* keep the game's default size */ }
}

export function dialogApi() {
  const w = W();
  return w.BootstrapDialog && w.BootstrapDialog.show ? { BD: w.BootstrapDialog, $: w.$ } : null;
}
