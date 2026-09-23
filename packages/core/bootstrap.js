// Waits for underscript to exist on the REAL page window, then registers
// the single suite-wide Plugin() instance. Past that point, no defensive
// ?. on plugin.* calls - the plugin's own methods are guaranteed once it
// exists.
//
// IMPORTANT: this script grants GM_getValue/GM_setValue/GM_deleteValue,
// which puts it in Tampermonkey's sandbox. Inside that sandbox, plain
// `window` is NOT the page's real window - UnderScript (which runs
// @grant none, unsandboxed) sets `window.underscript` on the real page
// window instead. Reading bare `window.underscript` here would silently
// and permanently return undefined, with no error, ever. getPageWindow()
// resolves to unsafeWindow specifically to avoid that.

import { getPageWindow } from "./page-window.js";

const SUITE_NAME = "Wizascript";
// Injected by build.js (esbuild `define`) so the stable and dev channels
// each report their own version and self-update from their own branch.
// A dev build must never point its updater at main, or the next stable
// release would silently replace it.
const SUITE_VERSION = __WIZASCRIPT_VERSION__;
const DOWNLOAD_URL = __WIZASCRIPT_DOWNLOAD_URL__;
const RETRY_MS = 250;
const WARN_AFTER_ATTEMPTS = 40; // ~10s - if UnderScript still isn't found by then, something's wrong

let suitePlugin = null;
let attempts = 0;
const readyCallbacks = [];

function tryBootstrap() {
  if (suitePlugin) return;
  attempts++;

  const pageWindow = getPageWindow();

  if (typeof pageWindow.underscript === "undefined" || typeof pageWindow.underscript.plugin !== "function") {
    if (attempts === WARN_AFTER_ATTEMPTS) {
      console.warn(
        "[Wizascript] Still waiting for UnderScript after ~10s. " +
        "Is UnderScript installed and enabled for this page?"
      );
    }
    setTimeout(tryBootstrap, RETRY_MS);
    return;
  }

  suitePlugin = pageWindow.underscript.plugin(SUITE_NAME, SUITE_VERSION);
  suitePlugin.updater(DOWNLOAD_URL); // single-arg form, per UnderScript author

  console.log(`[Wizascript] Registered with UnderScript (v${SUITE_VERSION}).`);

  readyCallbacks.forEach(cb => cb(suitePlugin));
  readyCallbacks.length = 0;
}

export function bootstrap(onReady) {
  if (suitePlugin) {
    onReady(suitePlugin);
    return;
  }
  readyCallbacks.push(onReady);
  tryBootstrap();
}
