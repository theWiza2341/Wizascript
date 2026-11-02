// packages/card-maker/storage.js
//
// GM storage for the Card Maker. Both keys are under "wizascript.", so
// Back up / Restore picks them up:
//  - wizascript.cardMaker.window  window size, place, filled/shrunk state
//  - wizascript.cardMaker.hotfix  "1" while the hotfix for feildmaster's
//                                 editor is on. GM storage, not an
//                                 UnderScript setting, because frame.js
//                                 reads it inside his editor's frame,
//                                 where undercards.net's localStorage
//                                 can't be reached (the setting on the
//                                 tab mirrors it).
//
// What players make in the editors is stored by the editors themselves,
// not here.

const WINDOW_KEY = "wizascript.cardMaker.window";
export const HOTFIX_KEY = "wizascript.cardMaker.hotfix";

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

export function isHotfixOn() {
  try {
    return GM_getValue(HOTFIX_KEY, "") === "1";
  } catch (e) {
    return false;
  }
}

export function setHotfix(on) {
  try {
    GM_setValue(HOTFIX_KEY, on ? "1" : "");
  } catch (e) {
    console.warn("[Card Maker] Failed to save the hotfix setting", e);
  }
}
