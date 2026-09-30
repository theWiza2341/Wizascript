// packages/misc/settings.js
//
// 1.5.0: Notepad, Card Tags and Controller Support are regular plugins
// now - their on/off switches live in the Plugins list (core/plugins.js,
// same storage keys as the old "Miscellaneous" toggles). The only
// setting left here is Notepad's own "Show Notepad", on the Notepad tab.

import { createFeatureSettings } from "../core/settings.js";
import { getPluginToggle, isPluginEnabled } from "../core/plugins.js";

export function registerMiscSettings(plugin, { onNotepadVisibilityChange } = {}) {
  const notepadSettings = createFeatureSettings(plugin, "misc", {
    tab: "Notepad",
    visible: () => isPluginEnabled("notepad")
  });

  // Whether the notepad window is currently shown, separate from the
  // plugin itself being enabled - so the Toggle Notepad shortcut can
  // hide the window without the plugin (and its shortcuts) switching
  // off. Defaults to shown, so enabling the plugin shows the notepad
  // straight away, and anyone who had the old "Enable Notepad Overlay
  // Option" on still sees it after updating.
  const notepadVisible = notepadSettings.add("notepadVisible", {
    name: "Show Notepad",
    type: "boolean",
    default: true,
    onChange: () => onNotepadVisibilityChange && onNotepadVisibilityChange()
  });

  return {
    enableNotepad: getPluginToggle("notepad"),
    enableController: getPluginToggle("controller"),
    enableCardTags: getPluginToggle("cardTags"),
    notepadVisible
  };
}
