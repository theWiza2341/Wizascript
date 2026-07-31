// packages/uc-tv/utils.js

const SCRIPT_START = Date.now();
const NAV_COOLDOWN_MS = 1000;

// 1s cooldown after page load - avoids rapid-fire reload chains if a
// keybind or auto-continue fires immediately on a fresh page.
export function navigationReady() {
  return Date.now() - SCRIPT_START >= NAV_COOLDOWN_MS;
}
