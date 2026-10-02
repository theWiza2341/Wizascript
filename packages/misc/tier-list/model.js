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
//       { id, title, tiers: [ { id, label, color, items: ["card:512", ...] } ] }
//   ] }
// dev1 only shows the active list, but the shape already holds several.

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
  return { id: uid("l"), title, tiers: DEFAULT_TIERS.map(([l, c]) => makeTier(l, c)) };
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

export function undo() {
  ensureLoaded();
  const prev = undoStack.pop();
  if (!prev) return false;
  state = sanitize(JSON.parse(prev));
  scheduleSave();
  notify();
  return true;
}
