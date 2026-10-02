// packages/misc/tier-list/items.js
//
// Turns stored item keys ("card:512") into what a tile shows: name,
// picture, rarity. Also the card search behind the picker.
//
// Card data: UnderScript 0.64 emits `allCardsReady` on every page - when
// the page has no allCards global, it fills one from the copy the site
// caches in localStorage ("allCards"). So once a player has opened any
// card page, cards are available everywhere, including /Game and
// Spectate. We also read that cache ourselves as a fallback.

import { getAllCards } from "../../core/card-data.js";
import { getPageWindow } from "../../core/page-window.js";

let cards = [];
let byId = new Map();
const nameCache = new Map();
const readyListeners = new Set();

// Known extensions get friendly names; anything new still appears,
// under its raw name, without needing a Wizascript update.
const EXTENSION_LABELS = { BASE: "Undertale", DELTARUNE: "Deltarune", UTY: "Undertale Yellow" };
const RARITY_ORDER = ["BASE", "COMMON", "RARE", "EPIC", "LEGENDARY", "DETERMINATION", "TOKEN", "GENERATED"];
// Hidden unless their rarity is picked explicitly.
const HIDDEN_BY_DEFAULT = new Set(["TOKEN", "GENERATED"]);

export const RARITY_COLORS = {
  BASE: "#9a9a9a", COMMON: "#e8e8e8", RARE: "#58b4ff", EPIC: "#c86bff",
  LEGENDARY: "#ffcc00", DETERMINATION: "#ff3030", TOKEN: "#6b6b6b", GENERATED: "#6b6b6b"
};

function setCards(list) {
  if (!Array.isArray(list) || !list.length) return false;
  cards = list.filter((c) => c && c.id !== undefined && c.id !== null);
  byId = new Map(cards.map((c) => [String(c.id), c]));
  nameCache.clear();
  readyListeners.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
  return true;
}

function readCachedCards() {
  try {
    const raw = getPageWindow().localStorage.getItem("allCards");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function initItemData(plugin) {
  if (!setCards(getAllCards())) setCards(readCachedCards());
  if (plugin && plugin.events) {
    plugin.events.on("allCardsReady", (list) => setCards(list));
  }
}

export function onCardsReady(fn) {
  readyListeners.add(fn);
  return () => readyListeners.delete(fn);
}

export function hasCards() {
  return cards.length > 0;
}

export function getCard(id) {
  return byId.get(String(id)) || null;
}

function stripHtml(text) {
  const el = document.createElement("div");
  el.innerHTML = String(text);
  return el.textContent.trim();
}

// The name in the player's game language, falling back to the English
// name in the card data.
export function cardName(card) {
  const cached = nameCache.get(card.id);
  if (cached) return cached;
  let name = "";
  try {
    const $ = getPageWindow().$;
    if ($ && $.i18n) {
      const key = `card-name-${card.fixedId || card.id}`;
      const value = $.i18n(key, 1);
      if (value && value !== key) name = stripHtml(value);
    }
  } catch (e) { /* translations not loaded yet */ }
  if (!name) name = stripHtml(card.name || `Card ${card.id}`);
  nameCache.set(card.id, name);
  return name;
}

export function cardImage(card) {
  return card && card.image ? `/images/cards/${card.image}.png` : "";
}

export function cardKey(card) {
  return `card:${card.id}`;
}

// What a tile needs to draw itself. Unknown keys still get a tile, so
// a list never silently loses an entry (e.g. a card from a newer patch
// than this browser's cache).
export function resolveItem(key) {
  const [kind, id] = String(key).split(":");
  if (kind === "card") {
    const card = getCard(id);
    if (card) {
      return { key, kind, card, label: cardName(card), image: cardImage(card), rarity: card.rarity };
    }
    return { key, kind, card: null, label: "Unknown card", image: "", rarity: null };
  }
  return { key, kind, card: null, label: "Unknown item", image: "", rarity: null };
}

// ---------- picker search ----------

export function filterOptions() {
  const exts = [...new Set(cards.map((c) => c.extension).filter(Boolean))];
  const rarities = [...new Set(cards.map((c) => c.rarity).filter(Boolean))]
    .sort((a, b) => {
      const ia = RARITY_ORDER.indexOf(a);
      const ib = RARITY_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  return {
    sets: exts.map((e) => ({ value: e, label: EXTENSION_LABELS[e] || e })),
    rarities: rarities.map((r) => ({ value: r, label: r.charAt(0) + r.slice(1).toLowerCase() }))
  };
}

// filters: { text, set, rarity, type, cost } - "" means "any".
// type: "0" monster, "1" spell. cost: "0".."9" or "10" for 10+.
export function isFilterActive(f) {
  return !!(String(f.text || "").trim() || f.set || f.rarity || f.type || f.cost);
}

export function searchCards(f, limit = 150) {
  if (!isFilterActive(f)) return { results: [], total: 0 };
  const text = String(f.text || "").trim().toLowerCase();
  const matches = cards.filter((c) => {
    if (f.set && c.extension !== f.set) return false;
    if (f.rarity) {
      if (c.rarity !== f.rarity) return false;
    } else if (HIDDEN_BY_DEFAULT.has(c.rarity)) {
      return false;
    }
    if (f.type !== "" && f.type !== undefined && String(c.typeCard) !== String(f.type)) return false;
    if (f.cost !== "" && f.cost !== undefined) {
      const cost = Number(c.cost);
      if (f.cost === "10" ? !(cost >= 10) : cost !== Number(f.cost)) return false;
    }
    if (text) {
      const local = cardName(c).toLowerCase();
      const english = stripHtml(c.name || "").toLowerCase();
      if (!local.includes(text) && !english.includes(text)) return false;
    }
    return true;
  });
  matches.sort((a, b) => (Number(a.cost) - Number(b.cost)) || cardName(a).localeCompare(cardName(b)));
  return { results: matches.slice(0, limit), total: matches.length };
}
