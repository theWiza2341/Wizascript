// packages/misc/index.js

import { registerMiscSettings } from "./settings.js";
import { showNotepad, hideNotepad, forceResetNotepad } from "./notepad/index.js";
import { registerKeybind } from "../core/keybinds.js";

export function initMisc(plugin) {
  const settings = registerMiscSettings(plugin);

  function syncNotepadVisibility() {
    if (settings.enableNotepad.value()) {
      showNotepad();
    } else {
      hideNotepad();
    }
  }

  syncNotepadVisibility();
  plugin.events.on("connect", () => {
    syncNotepadVisibility();
  });

  // Toggles the underlying "Enable Notepad Overlay" setting itself
  // (not just showNotepad()/hideNotepad() directly) so a keybind-driven
  // toggle stays in sync across reloads - otherwise a keybind-opened
  // notepad would silently vanish again on the next page load, since
  // the persisted setting never actually changed.
  registerKeybind(plugin, {
    key: "toggleNotepad",
    name: "Toggle Notepad",
    defaultCode: "KeyO",
    packageLabel: "Notepad",
    onMatch: () => {
      const next = !settings.enableNotepad.value();
      settings.enableNotepad.set(next);
      syncNotepadVisibility();
    }
  });

  // Was Ctrl+Alt+Shift+N (4 keys) - now Primary+N (2 keys). Kept "N"
  // as the secondary key for continuity with existing muscle memory.
  registerKeybind(plugin, {
    key: "resetNotepad",
    name: "Reset Notepad",
    defaultCode: "KeyN",
    packageLabel: "Notepad",
    onMatch: () => {
      forceResetNotepad();
      if (settings.enableNotepad.value()) {
        showNotepad();
      }
    }
  });
}
