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
import { getTextLabel } from "./model.js";

let cards = [];
let byId = new Map();
const nameCache = new Map();
const readyListeners = new Set();

// Hidden unless their rarity is picked explicitly.
const HIDDEN_BY_DEFAULT = new Set(["TOKEN", "GENERATED", "STORY"]);

export const RARITY_COLORS = {
  BASE: "#9a9a9a", COMMON: "#e8e8e8", RARE: "#58b4ff", EPIC: "#c86bff",
  LEGENDARY: "#ffcc00", DETERMINATION: "#ff3030", TOKEN: "#6b6b6b", GENERATED: "#6b6b6b", STORY: "#6b6b6b"
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

// ---------- souls ----------

export const SOULS = ["DETERMINATION", "PATIENCE", "BRAVERY", "INTEGRITY", "PERSEVERANCE", "KINDNESS", "JUSTICE"];
const SOUL_COLORS = {
  DETERMINATION: "#ff0000", PATIENCE: "#41fcff", BRAVERY: "#fca500", INTEGRITY: "#0064ff",
  PERSEVERANCE: "#d535d9", KINDNESS: "#00c000", JUSTICE: "#ffff00"
};

function i18n(key, ...args) {
  try {
    const $ = getPageWindow().$;
    if ($ && $.i18n) {
      const value = $.i18n(key, ...args);
      if (value && value !== key) return stripHtml(value);
    }
  } catch (e) { /* translations not loaded yet */ }
  return "";
}

export function soulName(soul) {
  return i18n(`soul-${soul.toLowerCase()}`, 1) || soul.charAt(0) + soul.slice(1).toLowerCase();
}

// ---------- artifacts ----------
// Not in allCards: they come from the Decks page's own data request
// (GET DecksConfig, the same one UnderScript's getAllArtifacts() uses),
// fetched the first time the Artifacts picker is opened and cached for
// a day so other pages (and offline moments) still have them.

const ARTIFACT_CACHE_KEY = "wizascript.tierlist.artifacts";
const ARTIFACT_CACHE_MS = 24 * 60 * 60 * 1000;
let artifacts = [];
let artifactsById = new Map();
let artifactLoad = null;

function setArtifacts(list) {
  if (!Array.isArray(list) || !list.length) return false;
  artifacts = list.filter((a) => a && a.id !== undefined && a.id !== null)
    .map((a) => ({ id: a.id, name: a.name, image: a.image, rarity: a.rarity }));
  artifactsById = new Map(artifacts.map((a) => [String(a.id), a]));
  return true;
}

function readArtifactCache() {
  try {
    const raw = GM_getValue(ARTIFACT_CACHE_KEY, null);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// Resolves to true when artifacts are available.
export function loadArtifacts() {
  if (artifactLoad) return artifactLoad;
  const cached = readArtifactCache();
  if (cached && setArtifacts(cached.list) && Date.now() - cached.time < ARTIFACT_CACHE_MS) {
    artifactLoad = Promise.resolve(true);
    return artifactLoad;
  }
  artifactLoad = fetch("/DecksConfig", { credentials: "same-origin" })
    .then((r) => r.json())
    .then((data) => {
      const raw = data && data.allArtifacts;
      const list = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!setArtifacts(list)) return artifacts.length > 0;
      try { GM_setValue(ARTIFACT_CACHE_KEY, JSON.stringify({ time: Date.now(), list: artifacts })); } catch (e) { /* ignore */ }
      return true;
    })
    .catch(() => artifacts.length > 0)
    .then((ok) => {
      if (!ok) artifactLoad = null; // allow a retry next time
      return ok;
    });
  return artifactLoad;
}

export function hasArtifacts() {
  return artifacts.length > 0;
}

export function artifactName(a) {
  return i18n(`artifact-name-${a.id}`, 1) || stripHtml(a.name || `Artifact ${a.id}`);
}

// ---------- tiles ----------

// What a tile needs to draw itself. Unknown keys still get a tile, so
// a list never silently loses an entry (e.g. a card from a newer patch
// than this browser's cache).
export function resolveItem(key) {
  const str = String(key);
  const at = str.indexOf(":");
  const kind = str.slice(0, at);
  const id = str.slice(at + 1);
  if (kind === "card") {
    const card = getCard(id);
    if (card) {
      return { key, kind, card, label: cardName(card), image: cardImage(card), rarity: card.rarity };
    }
    return { key, kind, card: null, label: "Unknown card", image: "", rarity: null };
  }
  if (kind === "soul" && SOULS.includes(id)) {
    return { key, kind, card: null, label: soulName(id), image: `/images/souls/${id}.png`, rarity: null, color: SOUL_COLORS[id] };
  }
  if (kind === "artifact") {
    const a = artifactsById.get(id);
    if (a) return { key, kind, card: null, label: artifactName(a), image: a.image ? `/images/artifacts/${a.image}.png` : "", rarity: a.rarity };
    return { key, kind, card: null, label: "Artifact", image: "", rarity: null };
  }
  if (kind === "text") {
    const label = getTextLabel(id);
    return { key, kind, card: null, label: label === null ? "(deleted text)" : label, image: "", rarity: null, text: true };
  }
  return { key, kind, card: null, label: "Unknown item", image: "", rarity: null };
}

export function searchSouls(text) {
  const q = String(text || "").trim().toLowerCase();
  return SOULS.filter((s) => !q || soulName(s).toLowerCase().includes(q) || s.toLowerCase().includes(q)).map((s) => `soul:${s}`);
}

export function searchArtifacts(text) {
  const q = String(text || "").trim().toLowerCase();
  return artifacts
    .filter((a) => !q || artifactName(a).toLowerCase().includes(q) || String(a.name || "").toLowerCase().includes(q))
    .sort((a, b) => artifactName(a).localeCompare(artifactName(b)))
    .map((a) => `artifact:${a.id}`);
}

// ---------- picker search ----------
//
// Same filters as the Crafting/Decks pages, with the same icons:
//  - rarity toggles (any ticked = only those rarities; none ticked =
//    everything except Token, Generated and Story cards);
//  - "monsters with tribes", monster, spell (monster/spell: either one);
//  - Undertale / Deltarune / Undertale Yellow (any ticked = only those).
// Groups combine with AND, like the game's own filter.

// filters: { text, rarities: Set, tribes: bool, monster: bool, spell: bool, sets: Set }
export function isFilterActive(f) {
  return !!(String(f.text || "").trim() || f.rarities.size || f.tribes || f.monster || f.spell || f.sets.size);
}

export function searchCards(f, limit = 150) {
  if (!isFilterActive(f)) return { results: [], total: 0 };
  const text = String(f.text || "").trim().toLowerCase();
  const matches = cards.filter((c) => {
    if (f.rarities.size) {
      if (!f.rarities.has(c.rarity)) return false;
    } else if (HIDDEN_BY_DEFAULT.has(c.rarity)) {
      return false;
    }
    if (f.monster || f.spell) {
      const isSpell = Number(c.typeCard) === 1;
      if (!((f.monster && !isSpell) || (f.spell && isSpell))) return false;
    }
    if (f.tribes && !(Number(c.typeCard) !== 1 && Array.isArray(c.tribes) && c.tribes.length)) return false;
    if (f.sets.size && !f.sets.has(c.extension)) return false;
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
