// packages/misc/tier-list/model.js
//
// The tier list's data and every change that can be made to it. The UI
// (window/tiers/picker/drag) never edits the data directly - it calls
// these functions and re-renders when notified. That keeps one path for
// every way of making a change: mouse drag today, a controller
// "pick up / put down" mode later (v2) can call the same functions.
//
// Items are stored as string keys, "<kind>:<id>" (e.g. "card:512"),
// so a list never stores image URLs or card data that could go stale -
// the picture and name are looked up live (items.js).
//
// Storage shape (GM wizascript.tierlist.lists):
//   { version: 1, active: "<listId>", lists: [
//       { id, title, texts: { "<textId>": "label" },
//         tiers: [ { id, label, color, items: ["card:512", "soul:PATIENCE", "text:<textId>", ...] } ] }
//   ] }
// Item kinds: card:<cardId>, soul:<SOUL>, artifact:<artifactId>,
// text:<textId> (the text itself lives in the list's `texts`, so each
// list has its own text items).

import { loadLists, saveLists } from "./storage.js";

export const DEFAULT_TIERS = [
  ["S", "#ff7f7f"],
  ["A", "#ffbf7f"],
  ["B", "#ffdf7f"],
  ["C", "#ffff7f"],
  ["D", "#bfff7f"]
];

export const TIER_COLORS = [
  "#ff7f7f", "#ffbf7f", "#ffdf7f", "#ffff7f", "#bfff7f", "#7fff7f",
  "#7fffff", "#7fbfff", "#7f7fff", "#ff7fff", "#bf7fbf", "#cfcfcf"
];

const MAX_UNDO = 50;
const SAVE_DELAY_MS = 300;
const MAX_LABEL = 40;
const MAX_TITLE = 60;
export const MAX_TEXT = 40;
const MAX_LISTS = 50;
export const DEFAULT_TITLE = "My Tier List";

let state = null;
const undoStack = [];
const listeners = new Set();
let saveTimer = null;

function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function makeTier(label, color) {
  return { id: uid("t"), label, color, items: [] };
}

function makeList(title = DEFAULT_TITLE) {
  return { id: uid("l"), title, texts: {}, tiers: DEFAULT_TIERS.map(([l, c]) => makeTier(l, c)) };
}

// Repairs anything malformed rather than throwing - a broken save (or a
// hand-edited backup) should never stop the window from opening.
function sanitize(raw) {
  if (!raw || !Array.isArray(raw.lists) || !raw.lists.length) {
    const list = makeList();
    return { version: 1, active: list.id, lists: [list] };
  }
  const lists = raw.lists.map((l) => ({
    id: typeof l.id === "string" ? l.id : uid("l"),
    title: typeof l.title === "string" ? l.title.slice(0, MAX_TITLE) : DEFAULT_TITLE,
    texts: Object.fromEntries(Object.entries(l.texts && typeof l.texts === "object" ? l.texts : {})
      .filter(([, v]) => typeof v === "string").map(([k, v]) => [k, v.slice(0, MAX_TEXT)])),
    tiers: (Array.isArray(l.tiers) ? l.tiers : []).map((t) => ({
      id: typeof t.id === "string" ? t.id : uid("t"),
      label: typeof t.label === "string" ? t.label.slice(0, MAX_LABEL) : "?",
      color: /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : "#cfcfcf",
      items: (Array.isArray(t.items) ? t.items : []).filter((k) => typeof k === "string")
    }))
  }));
  // An item may only appear once per list.
  lists.forEach((l) => {
    const seen = new Set();
    l.tiers.forEach((t) => {
      t.items = t.items.filter((k) => (seen.has(k) ? false : (seen.add(k), true)));
    });
  });
  const active = lists.some((l) => l.id === raw.active) ? raw.active : lists[0].id;
  return { version: 1, active, lists };
}

function ensureLoaded() {
  if (!state) state = sanitize(loadLists());
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveLists(state), SAVE_DELAY_MS);
}

// Writes immediately - used when the page is about to unload.
export function flushSave() {
  if (!state) return;
  clearTimeout(saveTimer);
  saveLists(state);
}

function notify() {
  listeners.forEach((fn) => {
    try { fn(); } catch (e) { console.error("[Tier List] listener failed", e); }
  });
}

// Every change goes through here: snapshot for undo, apply, save, redraw.
function change(mutator) {
  ensureLoaded();
  const before = JSON.stringify(state);
  const result = mutator(activeList());
  if (result === false) return false;
  if (JSON.stringify(state) === before) return false;
  undoStack.push(before);
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  scheduleSave();
  notify();
  return true;
}

function activeList() {
  return state.lists.find((l) => l.id === state.active) || state.lists[0];
}

function findTier(list, tierId) {
  return list.tiers.find((t) => t.id === tierId) || null;
}

function removeEverywhere(list, key) {
  list.tiers.forEach((t) => {
    const i = t.items.indexOf(key);
    if (i !== -1) t.items.splice(i, 1);
  });
}

// ---------- reading ----------

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getActiveList() {
  ensureLoaded();
  return activeList();
}

export function isPlaced(key) {
  return getActiveList().tiers.some((t) => t.items.includes(key));
}

export function canUndo() {
  return undoStack.length > 0;
}

// [{ id, title, count }] for the list menu.
export function getLists() {
  ensureLoaded();
  return state.lists.map((l) => ({
    id: l.id,
    title: l.title,
    count: l.tiers.reduce((n, t) => n + t.items.length, 0),
    active: l.id === state.active
  }));
}

export function getTextLabel(textId) {
  const t = getActiveList().texts[textId];
  return typeof t === "string" ? t : null;
}

export function getTextIds() {
  return Object.keys(getActiveList().texts);
}

// ---------- actions ----------

// Puts an item into a tier at a position (0 = first). If it's already
// somewhere in the list it moves; the index counts positions in the
// target tier as it looks once the item has been taken out.
export function placeItem(key, tierId, index) {
  return change((list) => {
    const tier = findTier(list, tierId);
    if (!tier || typeof key !== "string") return false;
    removeEverywhere(list, key);
    const at = Math.max(0, Math.min(typeof index === "number" ? index : tier.items.length, tier.items.length));
    tier.items.splice(at, 0, key);
  });
}

export function removeItem(key) {
  return change((list) => removeEverywhere(list, key));
}

export function addTier(atIndex) {
  return change((list) => {
    const used = new Set(list.tiers.map((t) => t.color));
    const color = TIER_COLORS.find((c) => !used.has(c)) || "#cfcfcf";
    const at = typeof atIndex === "number" ? Math.max(0, Math.min(atIndex, list.tiers.length)) : list.tiers.length;
    list.tiers.splice(at, 0, makeTier("New", color));
  });
}

// The tier's items become unranked again (undo brings them back).
export function deleteTier(tierId) {
  return change((list) => {
    const i = list.tiers.findIndex((t) => t.id === tierId);
    if (i === -1) return false;
    list.tiers.splice(i, 1);
  });
}

export function renameTier(tierId, label) {
  return change((list) => {
    const tier = findTier(list, tierId);
    if (!tier) return false;
    tier.label = String(label).slice(0, MAX_LABEL);
  });
}

export function recolorTier(tierId, color) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return false;
  return change((list) => {
    const tier = findTier(list, tierId);
    if (!tier) return false;
    tier.color = color.toLowerCase();
  });
}

// delta: -1 = up, +1 = down.
export function moveTier(tierId, delta) {
  return change((list) => {
    const i = list.tiers.findIndex((t) => t.id === tierId);
    const j = i + delta;
    if (i === -1 || j < 0 || j >= list.tiers.length) return false;
    const [tier] = list.tiers.splice(i, 1);
    list.tiers.splice(j, 0, tier);
  });
}

export function clearTier(tierId) {
  return change((list) => {
    const tier = findTier(list, tierId);
    if (!tier) return false;
    tier.items = [];
  });
}

export function setTitle(title) {
  return change((list) => {
    list.title = String(title).trim().slice(0, MAX_TITLE) || DEFAULT_TITLE;
  });
}

// Back to the default S-D rows with nothing ranked. Keeps the title.
export function resetList() {
  return change((list) => {
    list.tiers = DEFAULT_TIERS.map(([l, c]) => makeTier(l, c));
  });
}

// ---------- text items ----------

export function addText(label) {
  const clean = String(label || "").trim().slice(0, MAX_TEXT);
  if (!clean) return null;
  const id = uid("x");
  const ok = change((list) => { list.texts[id] = clean; });
  return ok ? `text:${id}` : null;
}

export function renameText(textId, label) {
  const clean = String(label || "").trim().slice(0, MAX_TEXT);
  if (!clean) return false;
  return change((list) => {
    if (!(textId in list.texts)) return false;
    list.texts[textId] = clean;
  });
}

// Removes the text item completely (from the tiers too).
export function deleteText(textId) {
  return change((list) => {
    if (!(textId in list.texts)) return false;
    delete list.texts[textId];
    removeEverywhere(list, `text:${textId}`);
  });
}

// ---------- lists ----------
// Switching lists isn't an undoable change, and clears undo - undoing
// edits from a list you're no longer looking at would be confusing.

export function setActiveList(listId) {
  ensureLoaded();
  if (state.active === listId || !state.lists.some((l) => l.id === listId)) return false;
  state.active = listId;
  undoStack.length = 0;
  scheduleSave();
  notify();
  return true;
}

export function createList() {
  ensureLoaded();
  if (state.lists.length >= MAX_LISTS) return false;
  const list = makeList(`Tier List ${state.lists.length + 1}`);
  state.lists.push(list);
  return setActiveList(list.id);
}

export function duplicateList() {
  ensureLoaded();
  if (state.lists.length >= MAX_LISTS) return false;
  const copy = JSON.parse(JSON.stringify(activeList()));
  copy.id = uid("l");
  copy.title = `${copy.title} (copy)`.slice(0, MAX_TITLE);
  copy.tiers.forEach((t) => { t.id = uid("t"); });
  state.lists.push(copy);
  return setActiveList(copy.id);
}

// Undoable (brings the list back). Always keeps at least one list.
export function deleteActiveList() {
  ensureLoaded();
  const before = JSON.stringify(state);
  const i = state.lists.findIndex((l) => l.id === state.active);
  state.lists.splice(i, 1);
  if (!state.lists.length) state.lists.push(makeList());
  state.active = state.lists[Math.max(0, i - 1)].id;
  undoStack.length = 0;
  undoStack.push(before);
  scheduleSave();
  notify();
  return true;
}

// ---------- sharing ----------
// A share code holds one list: its title, tiers and the text items it
// uses. Importing always adds it as a NEW list (never overwrites).

const ITEM_KEY = /^(card|soul|artifact|text):[A-Za-z0-9_-]{1,40}$/;
const MAX_TIERS = 30;
const MAX_ITEMS = 3000;

export function exportActiveList() {
  const list = getActiveList();
  // All text items travel, ranked or not, so the receiver gets the whole list.
  return {
    v: 1,
    title: list.title,
    texts: { ...list.texts },
    tiers: list.tiers.map((t) => ({ label: t.label, color: t.color, items: t.items.slice() }))
  };
}

// Throws an Error with a player-readable message if the data is unusable.
// Returns the new list's title.
export function importList(data) {
  ensureLoaded();
  if (!data || typeof data !== "object" || !Array.isArray(data.tiers)) throw new Error("That code doesn't contain a tier list.");
  if (state.lists.length >= MAX_LISTS) throw new Error(`You already have ${MAX_LISTS} lists. Delete one first.`);
  const list = makeList();
  const textMap = {};
  Object.entries(data.texts && typeof data.texts === "object" ? data.texts : {}).forEach(([oldId, label]) => {
    if (typeof label !== "string" || !label.trim()) return;
    const id = uid("x");
    textMap[oldId] = id;
    list.texts[id] = label.trim().slice(0, MAX_TEXT);
  });
  let count = 0;
  const seen = new Set();
  list.tiers = data.tiers.slice(0, MAX_TIERS).map((t) => {
    const tier = makeTier(
      typeof t.label === "string" ? t.label.slice(0, MAX_LABEL) : "?",
      /^#[0-9a-f]{6}$/i.test(t && t.color) ? t.color.toLowerCase() : "#cfcfcf"
    );
    (Array.isArray(t.items) ? t.items : []).forEach((k) => {
      if (typeof k !== "string" || !ITEM_KEY.test(k) || count >= MAX_ITEMS) return;
      let key = k;
      if (k.startsWith("text:")) {
        const id = textMap[k.slice(5)];
        if (!id) return;
        key = `text:${id}`;
      }
      if (seen.has(key)) return;
      seen.add(key);
      tier.items.push(key);
      count += 1;
    });
    return tier;
  });
  if (!list.tiers.length) list.tiers = DEFAULT_TIERS.map(([l, c]) => makeTier(l, c));
  let title = typeof data.title === "string" && data.title.trim() ? data.title.trim().slice(0, MAX_TITLE) : "Imported list";
  const titles = new Set(state.lists.map((l) => l.title));
  if (titles.has(title)) {
    let n = 2;
    while (titles.has(`${title} (${n})`)) n += 1;
    title = `${title} (${n})`.slice(0, MAX_TITLE);
  }
  list.title = title;
  state.lists.push(list);
  setActiveList(list.id);
  return title;
}

export function listUsesKind(kind) {
  return getActiveList().tiers.some((t) => t.items.some((k) => k.startsWith(kind + ":")));
}

export function undo() {
  ensureLoaded();
  const prev = undoStack.pop();
  if (!prev) return false;
  state = sanitize(JSON.parse(prev));
  scheduleSave();
  notify();
  return true;
}
