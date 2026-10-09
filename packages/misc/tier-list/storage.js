// packages/misc/tier-list/storage.js
//
// GM-storage wrapper for the Tier List Maker. Two keys:
//  - wizascript.tierlist.lists  - every saved list + which one is active
//  - wizascript.tierlist.window - window geometry, maximised state and
//                                 whether the picker is open
// Both are under the "wizascript." prefix, so Back up / Restore picks
// them up without any extra wiring.

const LISTS_KEY = "wizascript.tierlist.lists";
const WINDOW_KEY = "wizascript.tierlist.window";

function readJSON(key, fallback) {
  try {
    const raw = GM_getValue(key, null);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn("[Tier List] Failed to read storage key", key, e);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    GM_setValue(key, JSON.stringify(value));
  } catch (e) {
    console.warn("[Tier List] Failed to write storage key", key, e);
  }
}

export function loadLists() {
  return readJSON(LISTS_KEY, null);
}

export function saveLists(data) {
  writeJSON(LISTS_KEY, data);
}

export function loadWindowState() {
  return readJSON(WINDOW_KEY, null);
}

export function saveWindowState(state) {
  writeJSON(WINDOW_KEY, state);
}
