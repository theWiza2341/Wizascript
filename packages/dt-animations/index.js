// packages/dt-animations/index.js
//
// Wires the DT Animations host together:
//   1. registers every module build.js discovered in ./animations/
//   2. registers settings (always - so the category shows on every page)
//   3. on Game/Spectate pages only, subscribes the loader to GameEvent
//   4. when debug is on: test keybinds + a console handle
//
// Adding a new DT = drop animations/<name>.js (or animations/<name>/index.js)
// in and rebuild. No edits here or in manifest.js needed.

// Virtual module generated at build time by build.js - an array of
// { source, module } for every file found under ./animations/.
import discoveredAnimations from "virtual:dt-animations";

import { registerAnimation, getAnimations } from "./registry.js";
import { registerDtAnimationSettings } from "./settings.js";
import { createLoader } from "./loader.js";
import { createLogger } from "../core/debug-logger.js";
import { matchesPage } from "../core/page-match.js";
import { registerKeybind } from "../core/keybinds.js";
import { getPageWindow } from "../core/page-window.js";

function isGamePage() {
  return matchesPage(["/Game", { prefix: "/Spectate" }]);
}

export function initDtAnimations(plugin) {
  discoveredAnimations.forEach(({ source, module }) => registerAnimation(module, source));
  const animations = getAnimations();
  const settings = registerDtAnimationSettings(plugin, animations);

  const logger = createLogger("DT Animations");
  const debug = settings.isDebug();
  // Same idea as Deck Tracker's debugLogging: the setting is the one
  // real switch. log/warn go quiet when it's off; errors always print.
  const quietLogger = {
    log: (...a) => debug && logger.log(...a),
    warn: (...a) => debug && logger.warn(...a),
    error: (...a) => logger.error(...a)
  };

  if (debug) registerDebugKeybinds(plugin, settings);

  if (!animations.length || !isGamePage()) return;

  const loader = createLoader({ animations, settings, logger: quietLogger });

  plugin.events.on("GameEvent", (event) => loader.onGameEvent(event));
  // A fresh match or a mid-match refresh: drop detector state so it's
  // rebuilt from the next snapshot (a refresh with a DT already on board
  // will replay its animation - intended).
  plugin.events.on("GameStart", () => loader.onMatchStart());
  plugin.events.on("connect", () => loader.onMatchStart());

  activeLoader = loader;
  if (debug) {
    getPageWindow().__wizaDtAnimations = loader.debugApi;
    logger.log(null, `Loaded: ${animations.map((a) => a.id).join(", ")}. Console: __wizaDtAnimations`);
  }
}

let activeLoader = null;

function registerDebugKeybinds(plugin, settings) {
  const withLoader = (fn) => () => {
    if (!activeLoader) return; // not on a game page
    fn(activeLoader.debugApi, settings.debugTarget());
  };
  registerKeybind(plugin, {
    key: "dtTestPlay",
    name: "[Debug] Play DT animation",
    defaultCode: "KeyQ",
    packageLabel: "DT Animations",
    onMatch: withLoader((api, id) => api.play(id))
  });
  registerKeybind(plugin, {
    key: "dtTestReact",
    name: "[Debug] React (glow/hurt)",
    defaultCode: "KeyE",
    packageLabel: "DT Animations",
    onMatch: withLoader((api, id) => api.react(id))
  });
  registerKeybind(plugin, {
    key: "dtTestReset",
    name: "[Debug] End DT animation",
    defaultCode: "KeyR",
    packageLabel: "DT Animations",
    onMatch: withLoader((api, id) => api.reset(id))
  });
}
