// packages/misc/index.js

import { registerMiscSettings } from "./settings.js";
import { showNotepad, hideNotepad, forceResetNotepad } from "./notepad/index.js";

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

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.altKey && e.shiftKey && e.key.toLowerCase() === "n") {
      forceResetNotepad();
      if (settings.enableNotepad.value()) {
        showNotepad();
      }
    }
  });
}
