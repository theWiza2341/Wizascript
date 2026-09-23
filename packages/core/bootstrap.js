// Waits for underscript to exist on the REAL page window, then registers
// the suite-wide Plugin() instance (plus any independent plugins shipped
// in this same script - see bootstrapPlugin below). Past that point, no defensive
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

// Generic "wait for UnderScript, then register a plugin" - used for the
// Wizascript suite itself AND for independent plugins that ship in this
// same script (DT Animations). Each registration gets its own polling
// loop and its own callback list, so one plugin's init throwing can't
// stop another from registering.
function createPluginBootstrap({ name, version, updaterUrl }) {
  let plugin = null;
  let attempts = 0;
  let polling = false;
  const readyCallbacks = [];

  function tryRegister() {
    if (plugin) return;
    attempts++;
    const pageWindow = getPageWindow();
    if (typeof pageWindow.underscript === "undefined" || typeof pageWindow.underscript.plugin !== "function") {
      if (attempts === WARN_AFTER_ATTEMPTS) {
        console.warn(
          `[${name}] Still waiting for UnderScript after ~10s. ` +
          "Is UnderScript installed and enabled for this page?"
        );
      }
      setTimeout(tryRegister, RETRY_MS);
      return;
    }

    plugin = pageWindow.underscript.plugin(name, version);
    if (updaterUrl) plugin.updater(updaterUrl); // single-arg form, per UnderScript author
    console.log(`[${name}] Registered with UnderScript (v${version}).`);

    readyCallbacks.splice(0).forEach((cb) => {
      try {
        cb(plugin);
      } catch (err) {
        console.error(`[${name}] init failed:`, err);
      }
    });
  }

  return function onReady(cb) {
    if (plugin) {
      cb(plugin);
      return;
    }
    readyCallbacks.push(cb);
    if (!polling) {
      polling = true;
      tryRegister();
    }
  };
}

const suiteBootstrap = createPluginBootstrap({
  name: SUITE_NAME,
  version: SUITE_VERSION,
  updaterUrl: DOWNLOAD_URL
});

// The Wizascript suite plugin.
export function bootstrap(onReady) {
  suiteBootstrap(onReady);
}

// An independent plugin shipped inside this same script (own settings
// page, own UnderScript "Enabled" toggle). Deliberately NO updater by
// default: the suite plugin already updates the whole file, and a second
// updater would mean two update prompts for one download.
const extraBootstraps = new Map();
export function bootstrapPlugin(name, onReady, { version = SUITE_VERSION } = {}) {
  if (!extraBootstraps.has(name)) {
    extraBootstraps.set(name, createPluginBootstrap({ name, version }));
  }
  extraBootstraps.get(name)(onReady);
}
