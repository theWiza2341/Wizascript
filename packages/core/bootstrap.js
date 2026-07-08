// Waits for window.underscript to exist, then registers the single
// suite-wide Plugin() instance. Past that point, no defensive ?. on
// plugin.* calls - the plugin's own methods are guaranteed once it exists.

const SUITE_NAME = "Wizascript";
const SUITE_VERSION = "0.1.0";
const DOWNLOAD_URL =
  "https://raw.githubusercontent.com/theWiza2341/Wizascript/refs/heads/main/wizascript.user.js";
const RETRY_MS = 250;

let suitePlugin = null;
const readyCallbacks = [];

function tryBootstrap() {
  if (suitePlugin) return;

  if (typeof window.underscript === "undefined" || typeof window.underscript.plugin !== "function") {
    setTimeout(tryBootstrap, RETRY_MS);
    return;
  }

  suitePlugin = window.underscript.plugin(SUITE_NAME, SUITE_VERSION);
  suitePlugin.updater(DOWNLOAD_URL); // single-arg form, per UnderScript author

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
