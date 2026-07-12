// Central state for Deck Tracker: known preset definitions (built-in +
// user custom), persisted favorite/layout state, and which presets are
// currently active on screen this session. Deliberately no DOM here -
// hud.js owns rendering, this module owns data so both event-driven
// and manual presets plug into the same shape underneath it.
//
// Preset "kind" is the architectural split flagged early on:
//  - "event": count is driven by correlating GameEvents (SAVE Tracker,
//    Change of Winds, Curve Tracker). Registers an onGameEvent handler.
//  - "manual": count is driven purely by the user's click/right-click/
//    middle-click on the widget itself (Custom trackers).
// Both render through the same HUD widget - this module doesn't care
// which kind a preset is once it's active, only how its count changes.

const FAVORITES_KEY = "wizascript.decktracker.favorites";
const CUSTOM_PRESETS_KEY = "wizascript.decktracker.customPresets";

const presetTypes = new Map();
const activeInstances = new Map();

let favoritesCache = null;
let customPresetsCache = null;

function loadFavorites() {
  if (favoritesCache) return favoritesCache;
  try {
    favoritesCache = JSON.parse(GM_getValue(FAVORITES_KEY, "{}"));
  } catch {
    favoritesCache = {};
  }
  return favoritesCache;
}

function saveFavorites() {
  GM_setValue(FAVORITES_KEY, JSON.stringify(favoritesCache || {}));
}

function loadCustomPresets() {
  if (customPresetsCache) return customPresetsCache;
  try {
    customPresetsCache = JSON.parse(GM_getValue(CUSTOM_PRESETS_KEY, "[]"));
  } catch {
    customPresetsCache = [];
  }
  return customPresetsCache;
}

function saveCustomPresets() {
  GM_setValue(CUSTOM_PRESETS_KEY, JSON.stringify(customPresetsCache || []));
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "tracker";
}

export function registerPresetType(definition, { onGameEvent } = {}) {
  if (!definition || !definition.id) throw new Error("Preset definition requires an id");
  presetTypes.set(definition.id, { definition, onGameEvent: onGameEvent || null });
}

export function createCustomPreset({ name, description = "", sprite = null }) {
  const id = `custom:${slugify(name)}:${Date.now().toString(36)}`;
  const definition = { id, name, description, sprite, soul: null, custom: true, kind: "manual" };

  const list = loadCustomPresets();
  list.push(definition);
  saveCustomPresets();
  presetTypes.set(id, { definition, onGameEvent: null });
  return definition;
}

export function deleteCustomPreset(id) {
  customPresetsCache = loadCustomPresets().filter(p => p.id !== id);
  saveCustomPresets();
  presetTypes.delete(id);
  deactivate(id);
  setFavorited(id, false);
}

export function getAvailablePresets() {
  loadCustomPresets().forEach(def => {
    if (!presetTypes.has(def.id)) presetTypes.set(def.id, { definition: def, onGameEvent: null });
  });

  return [...presetTypes.values()].map(entry => ({
    ...entry.definition,
    favorited: isFavorited(entry.definition.id)
  }));
}

export function getDefinition(id) {
  return presetTypes.get(id)?.definition || null;
}

export function isFavorited(id) {
  return !!loadFavorites()[id]?.favorited;
}

export function setFavorited(id, favorited) {
  const favorites = loadFavorites();
  if (favorited) {
    favorites[id] = { ...(favorites[id] || {}), favorited: true };
  } else {
    delete favorites[id];
  }
  saveFavorites();
}

export function getLayout(id) {
  return loadFavorites()[id]?.layout || null;
}

export function setLayout(id, layout) {
  const favorites = loadFavorites();
  if (!favorites[id]) return;
  favorites[id].layout = layout;
  saveFavorites();
}

export function getFavoritedPresetIds() {
  return Object.keys(loadFavorites());
}

export function activate(id, { initialCount = 0 } = {}) {
  if (activeInstances.has(id)) return activeInstances.get(id);
  const instance = { count: initialCount, listeners: new Set() };
  activeInstances.set(id, instance);
  return instance;
}

export function deactivate(id) {
  activeInstances.delete(id);
}

export function isActive(id) {
  return activeInstances.has(id);
}

export function getCount(id) {
  return activeInstances.get(id)?.count ?? 0;
}

export function setCount(id, count) {
  const instance = activeInstances.get(id);
  if (!instance) return;
  instance.count = Math.max(0, count);
  instance.listeners.forEach(fn => fn(instance.count));
}

export function onCountChange(id, callback) {
  const instance = activeInstances.get(id);
  if (!instance) return () => {};
  instance.listeners.add(callback);
  return () => instance.listeners.delete(callback);
}

export function dispatchGameEvent(event) {
  activeInstances.forEach((instance, id) => {
    const type = presetTypes.get(id);
    if (!type || !type.onGameEvent) return;
    type.onGameEvent(event, {
      getCount: () => instance.count,
      setCount: next => setCount(id, next)
    });
  });
}
