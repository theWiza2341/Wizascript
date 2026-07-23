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
const PEN_COLOR_KEY = "wizascript.misc.notepad.penColor";
const RECENT_COLORS_KEY = "wizascript.misc.notepad.recentColors";
const TITLE_KEY = "wizascript.misc.notepad.title";

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

// { hue, saturation, lightness, color } | null - hue/saturation/
// lightness are stored alongside the resolved color string so the
// wheel can be restored to the exact spot that produced it, rather
// than re-deriving a (possibly different) wheel position from the
// color alone.
export function getSavedPenColor() {
  return readJSON(PEN_COLOR_KEY, null);
}

export function setSavedPenColor(state) {
  writeJSON(PEN_COLOR_KEY, state);
}

export function clearSavedPenColor() {
  try {
    GM_deleteValue(PEN_COLOR_KEY);
  } catch (e) {
    // ignore - nothing to clear
  }
}

// [{ hue, saturation, lightness, color }, ...] most-recently-applied
// first. Capping and dedup is the caller's responsibility (see
// recent-colors.js) - this is just storage.
export function getRecentColors() {
  return readJSON(RECENT_COLORS_KEY, []);
}

export function setRecentColors(list) {
  writeJSON(RECENT_COLORS_KEY, list);
}

export function clearRecentColors() {
  try {
    GM_deleteValue(RECENT_COLORS_KEY);
  } catch (e) {
    // ignore - nothing to clear
  }
}

// The user-editable name shown in the header and used as the
// downloaded PNG's filename. string | null.
export function getSavedTitle() {
  return readJSON(TITLE_KEY, null);
}

export function setSavedTitle(title) {
  writeJSON(TITLE_KEY, title);
}

export function clearSavedTitle() {
  try {
    GM_deleteValue(TITLE_KEY);
  } catch (e) {
    // ignore - nothing to clear
  }
}
