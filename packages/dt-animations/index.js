// packages/dt-animations/index.js
//
// DT Animations is registered as its OWN UnderScript plugin ("DT
// Animations"), separate from the Wizascript plugin - see manifest.js.
// It shares Wizascript's core/ utilities (page-window, page-match,
// player-context, debug-logger) but depends on no other Wizascript
// package, so it keeps working even with every Wizascript feature off.
//
//   1. registers every module build.js discovered in ./animations/
//   2. registers settings on the DT Animations plugin page
//   3. on Game/Spectate pages only, subscribes the loader to GameEvent
//   4. while Debug mode is on: floating test panel + console handle
//
// Adding a new DT = drop animations/<name>.js (or animations/<name>/index.js)
// in and rebuild. No edits here or in manifest.js needed.

// Virtual module generated at build time by build.js - an array of
// { source, module } for every file found under ./animations/.
import discoveredAnimations from "virtual:dt-animations";

import { registerAnimation, getAnimations } from "./registry.js";
import { registerDtAnimationSettings } from "./settings.js";
import { createLoader } from "./loader.js";
import { createDebugPanel } from "./debug-panel.js";
import { createLogger } from "../core/debug-logger.js";
import { matchesPage } from "../core/page-match.js";
import { getPageWindow } from "../core/page-window.js";

export const DT_PLUGIN_NAME = "DT Animations"; // UnderScript limit: 20 chars, letters/digits/spaces

function isGamePage() {
  return matchesPage(["/Game", { prefix: "/Spectate" }]);
}

export function initDtAnimations(plugin) {
  discoveredAnimations.forEach(({ source, module }) => registerAnimation(module, source));
  const animations = getAnimations();

  let loader = null;
  let panel = null;
  const syncDebug = () => {
    if (!loader) return;
    const on = settings.isDebug();
    const pageWindow = getPageWindow();
    if (on) {
      pageWindow.__wizaDtAnimations = loader.debugApi;
      panel.show();
    } else {
      delete pageWindow.__wizaDtAnimations;
      panel.hide();
    }
  };

  const settings = registerDtAnimationSettings(plugin, animations, { onDebugChange: syncDebug });

  const logger = createLogger("DT Animations");
  // Debug mode is the one real switch (read live, so toggling it
  // mid-match works). Errors always print.
  const gatedLogger = {
    log: (...a) => settings.isDebug() && logger.log(...a),
    warn: (...a) => settings.isDebug() && logger.warn(...a),
    error: (...a) => logger.error(...a)
  };

  if (!animations.length || !isGamePage()) return;

  loader = createLoader({ animations, settings, logger: gatedLogger });
  panel = createDebugPanel({ animations, debugApi: loader.debugApi, openSettings: settings.open });

  plugin.events.on("GameEvent", (event) => loader.onGameEvent(event));
  // A fresh match or a mid-match refresh: drop detector state so it's
  // rebuilt from the next snapshot (a refresh with a DT already on board
  // will replay its animation - intended).
  plugin.events.on("GameStart", () => loader.onMatchStart());
  plugin.events.on("connect", () => loader.onMatchStart());

  if (document.body) syncDebug();
  else document.addEventListener("DOMContentLoaded", syncDebug, { once: true });

  gatedLogger.log(null, `Loaded: ${animations.map((a) => a.id).join(", ")}. Console: __wizaDtAnimations`);
}
