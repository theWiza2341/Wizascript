// packages/card-maker/storage.js
//
// GM storage for the Card Maker (under "wizascript.", so Back up /
// Restore picks it up):
//  - wizascript.cardMaker.window  window size, place, filled/shrunk state
// 1.7.0-1.7.1 also kept wizascript.cardMaker.hotfix (the feildmaster editor
// hotfix, removed in 1.7.2); index.js clears it on load.
//
// What players make in the editors is stored by the editors themselves,
// not here.

const WINDOW_KEY = "wizascript.cardMaker.window";
export const OLD_HOTFIX_KEY = "wizascript.cardMaker.hotfix"; // removed in 1.7.2; cleared on load

export function loadWindowState() {
  try {
    const raw = GM_getValue(WINDOW_KEY, null);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function saveWindowState(state) {
  try {
    GM_setValue(WINDOW_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("[Card Maker] Failed to save the window", e);
  }
}
