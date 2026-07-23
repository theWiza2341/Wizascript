// packages/misc/settings.js

import { createFeatureSettings } from "../core/settings.js";

export function registerMiscSettings(plugin) {
  const settings = createFeatureSettings(plugin, "misc", "Miscellaneous");
  const enableNotepad = settings.add("enableNotepad", {
    name: "Enable Notepad Overlay Option",
    type: "boolean",
    default: false
  });
  return { settings, enableNotepad };
}
