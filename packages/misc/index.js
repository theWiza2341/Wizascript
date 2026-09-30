// packages/misc/index.js

import { registerMiscSettings } from "./settings.js";
import { showNotepad, hideNotepad, forceResetNotepad, undoNotepad, redoNotepad } from "./notepad/index.js";
import { initCardTags } from "./card-tags/index.js";
import { registerKeybind } from "../core/keybinds.js";

export function initMisc(plugin) {
  const settings = registerMiscSettings(plugin, {
    onNotepadVisibilityChange: () => syncNotepadVisibility()
  });

  initCardTags(plugin, settings.enableCardTags);

  // Shown only while the Notepad plugin is enabled AND "Show Notepad"
  // is on.
  function syncNotepadVisibility() {
    if (settings.enableNotepad.value() && settings.notepadVisible.value()) {
      showNotepad();
    } else {
      hideNotepad();
    }
  }

  syncNotepadVisibility();
  plugin.events.on("connect", () => {
    syncNotepadVisibility();
  });

  // Toggles the persisted "Show Notepad" setting (not just
  // showNotepad()/hideNotepad() directly) so a keybind-driven toggle
  // sticks across reloads. It deliberately does NOT touch the Notepad
  // plugin toggle itself - that would also hide this very shortcut.
  registerKeybind(plugin, {
    key: "toggleNotepad",
    name: "Toggle Notepad",
    defaultCode: "KeyO",
    packageLabel: "Notepad",
    onMatch: () => {
      settings.notepadVisible.set(!settings.notepadVisible.value());
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
      syncNotepadVisibility();
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

  // Handed back so manifest.js can pass settings.enableController (the
  // Controller Support plugin toggle) through to initController().
  return settings;
}
