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
const RETAINED_KEY = "wizascript.decktracker.retained";

// Registered preset TYPES - built-ins (SAVE Tracker, CoW, Curve
// Tracker) register themselves here at load time via registerPresetType.
// Custom presets are added dynamically via createCustomPreset() and
// persist across sessions, so they're merged in at read-time too.
const presetTypes = new Map();

// Active instances THIS SESSION ONLY - never persisted. Counts reset
// every match by design. Map<id, { count, listeners: Set<fn> }>
const activeInstances = new Map();

let favoritesCache = null;
let customPresetsCache = null;
let retainedCache = null;
let retainEnabledGetter = () => false;

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

// ---- preset type registration (built-ins call this at load time) ----

export function registerPresetType(definition, { onGameEvent } = {}) {
  if (!definition || !definition.id) throw new Error("Preset definition requires an id");
  presetTypes.set(definition.id, { definition, onGameEvent: onGameEvent || null });
}

// ---- custom preset CRUD ----

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

// ---- listing (for the picker dialog) ----

// FIX: this used to only run inside getAvailablePresets() - meaning
// custom presets were only ever merged into presetTypes as a side
// effect of opening the picker dialog. If GameStart fired and tried to
// auto-spawn a favorited custom preset BEFORE the picker had ever been
// opened this session, getDefinition() would find nothing (even though
// the preset was genuinely persisted in storage), and spawnPreset would
// silently bail with "Unknown preset id." Extracted so both read paths
// ensure custom presets are loaded first.
function ensureCustomPresetsRegistered() {
  loadCustomPresets().forEach(def => {
    if (!presetTypes.has(def.id)) presetTypes.set(def.id, { definition: def, onGameEvent: null });
  });
}

export function getAvailablePresets() {
  ensureCustomPresetsRegistered();

  return [...presetTypes.values()].map(entry => ({
    ...entry.definition,
    favorited: isFavorited(entry.definition.id)
  }));
}

export function getDefinition(id) {
  ensureCustomPresetsRegistered();
  return presetTypes.get(id)?.definition || null;
}

// ---- favorite + layout persistence ----
// Layout (position/size) is only ever persisted for favorited presets -
// dragging/resizing a non-favorited tracker just doesn't stick between
// matches, matching what we validated in the console mocks.

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
  if (!favorites[id]) return; // not favorited - nothing to persist
  favorites[id].layout = layout;
  saveFavorites();
}

export function getFavoritedPresetIds() {
  return Object.keys(loadFavorites());
}

// ---- active instance tracking (session-only) ----

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

// hud.js subscribes here so an event-driven preset's count change
// (triggered via dispatchGameEvent below) re-renders the right widget.
export function onCountChange(id, callback) {
  const instance = activeInstances.get(id);
  if (!instance) return () => {};
  instance.listeners.add(callback);
  return () => instance.listeners.delete(callback);
}

// ---- game event dispatch ----
// Called once per GameEvent by deck-tracker/index.js's single
// subscription - NOT one listener per preset. Fans out internally only
// to presets that are both event-driven and currently active.

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

// ---- retained state ("Retain Unclosed Presets Between Matches") ----
// Independent from favorites - tracks whatever is CURRENTLY open
// (regardless of favorited status) so it can come back once, in the
// same spot, next match. Cleared the moment that preset is closed,
// unconditionally, regardless of the setting's current value - closing
// always means "don't bring this back."

function loadRetained() {
  if (retainedCache) return retainedCache;
  try {
    retainedCache = JSON.parse(GM_getValue(RETAINED_KEY, "{}"));
  } catch {
    retainedCache = {};
  }
  return retainedCache;
}

function saveRetained() {
  GM_setValue(RETAINED_KEY, JSON.stringify(retainedCache || {}));
}

// index.js calls this once at startup (after settings are registered)
// so registry.js can check the setting without importing settings.js
// directly - keeps settings registration and persistence policy as
// separate concerns.
export function setRetainEnabledGetter(fn) {
  retainEnabledGetter = fn;
}

export function getRetainedPresetIds() {
  return Object.keys(loadRetained());
}

export function getRetainedLayout(id) {
  return loadRetained()[id]?.layout || null;
}

// Called by hud.js on every spawn and every drag/resize-end,
// UNCONDITIONALLY - whether this actually persists anything depends on
// the injected setting, checked here rather than by every caller.
export function trackActiveLayout(id, layout) {
  if (!retainEnabledGetter()) return;
  const retained = loadRetained();
  retained[id] = { layout };
  saveRetained();
}

// Called by hud.js on every close, UNCONDITIONALLY.
export function forgetActiveLayout(id) {
  const retained = loadRetained();
  if (retained[id]) {
    delete retained[id];
    saveRetained();
  }
}
