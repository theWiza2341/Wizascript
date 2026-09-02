// packages/misc/settings.js

import { createFeatureSettings } from "../core/settings.js";

export function registerMiscSettings(plugin) {
  const settings = createFeatureSettings(plugin, "misc", "Miscellaneous");
  const enableNotepad = settings.add("enableNotepad", {
    name: "Enable Notepad Overlay Option",
    type: "boolean",
    default: false
  });

  // Moved here from its own "Keybinds - Controller" category - off by
  // default, and packages/controller/settings.js now reads THIS exact
  // setting object (handed through manifest.js -> initController) to
  // decide, once at registration time, whether to register the rest of
  // "Keybinds - Controller" at all. Mirrors packages/uc-tv/settings.js's
  // own pattern for its "Filter Settings" category: a brand new player
  // who hasn't turned Controller Support on yet no longer sees an entire
  // category of gamepad keybind rows they can't use yet.
  const enableController = settings.add("enableController", {
    name: "Enable Controller Support",
    type: "boolean",
    default: false
  });

  return { settings, enableNotepad, enableController };
}
