// packages/misc/index.js

import { registerMiscSettings } from "./settings.js";
import { showNotepad, hideNotepad, forceResetNotepad, undoNotepad, redoNotepad, isNotepadOpen } from "./notepad/index.js";
import { initCardTags } from "./card-tags/index.js";
import { registerKeybind } from "../core/keybinds.js";

export function initMisc(plugin) {
  const settings = registerMiscSettings(plugin);

  initCardTags(plugin, settings.enableCardTags);

  // null = follow "Open Notepad on Page Load"; true/false once the
  // Toggle Notepad shortcut has been used on this page. Deliberately not
  // persisted - the setting decides what happens on the next page load.
  let shownThisPage = null;

  function syncNotepadVisibility() {
    const wanted = shownThisPage !== null ? shownThisPage : settings.notepadOpenOnLoad.value();
    if (settings.enableNotepad.value() && wanted) {
      showNotepad();
    } else {
      hideNotepad();
    }
  }

  syncNotepadVisibility();
  plugin.events.on("connect", () => {
    syncNotepadVisibility();
  });

  // Opens/closes the notepad for this page only. Doesn't touch the
  // Notepad plugin toggle (that would also disable this very shortcut)
  // or "Open Notepad on Page Load". Reads the real open state, so it
  // still works after the notepad's own close button was used.
  registerKeybind(plugin, {
    key: "toggleNotepad",
    name: "Toggle Notepad",
    defaultCode: "KeyO",
    packageLabel: "Notepad",
    onMatch: () => {
      shownThisPage = !isNotepadOpen();
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
      const wasOpen = isNotepadOpen();
      forceResetNotepad();
      if (wasOpen) showNotepad();
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
