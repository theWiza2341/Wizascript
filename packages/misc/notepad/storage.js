// packages/misc/notepad/storage.js
//
// Persistence for the Notepad overlay - position and the saved
// drawing. Mirrors Deck Tracker's registry.js in spirit (a thin
// try/catch wrapper around GM_getValue/GM_setValue) but scoped to the
// notepad's own two keys, since there's no multi-preset registry to
// manage here.
//
// Background color is now stored as its own explicit field rather
// than being re-derived by sampling a canvas pixel on load - the old
// implementation read the paper color back from pixel (0,0) after
// loading the saved PNG, which silently broke the moment a stroke
// touched that corner (the "background" would then be read as
// whatever ink color was drawn there).

const POSITION_KEY = "wizascript.misc.notepad.position";
const DRAWING_KEY = "wizascript.misc.notepad.drawing";

function readJSON(key, fallback) {
  try {
    const raw = GM_getValue(key, null);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn("[Notepad] Failed to read storage key", key, e);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    GM_setValue(key, JSON.stringify(value));
  } catch (e) {
    console.warn("[Notepad] Failed to write storage key", key, e);
  }
}

// { left, top } | null
export function getSavedPosition() {
  return readJSON(POSITION_KEY, null);
}

export function setSavedPosition(layout) {
  writeJSON(POSITION_KEY, layout);
}

export function clearSavedPosition() {
  try {
    GM_deleteValue(POSITION_KEY);
  } catch (e) {
    // ignore - nothing to clear
  }
}

// { strokesDataUrl, backgroundColor } | null - strokes are saved
// separately from the paper color so re-tinting the paper never needs
// to touch (or guess at) the ink layer.
export function getSavedDrawing() {
  return readJSON(DRAWING_KEY, null);
}

export function setSavedDrawing(drawing) {
  writeJSON(DRAWING_KEY, drawing);
}

export function clearSavedDrawing() {
  try {
    GM_deleteValue(DRAWING_KEY);
  } catch (e) {
    // ignore - nothing to clear
  }
}
