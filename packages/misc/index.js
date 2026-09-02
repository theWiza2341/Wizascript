// packages/misc/index.js

import { registerMiscSettings } from "./settings.js";
import { showNotepad, hideNotepad, forceResetNotepad, undoNotepad, redoNotepad } from "./notepad/index.js";
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

  // Defaults land on Ctrl+Z/Ctrl+Y with the shipped Primary key -
  // matches the muscle memory almost everyone already has from other
  // software, for free.
  registerKeybind(plugin, {
    key: "undoNotepad",
    name: "Undo Drawing",
    defaultCode: "KeyZ",
    packageLabel: "Notepad",
    onMatch: () => undoNotepad()
  });
  registerKeybind(plugin, {
    key: "redoNotepad",
    name: "Redo Drawing",
    defaultCode: "KeyY",
    packageLabel: "Notepad",
    onMatch: () => redoNotepad()
  });

  // Handed back so manifest.js can pass settings.enableController straight
  // through to initController(plugin, controllerEnabledSetting) - initMisc
  // runs before initController, so this is already registered under
  // "Miscellaneous" by the time the controller package reads it.
  return settings;
}
