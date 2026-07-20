import { registerMiscSettings } from "./settings.js";
import { showNotepad, hideNotepad, forceResetNotepad } from "./notepad.js";

export function initMisc(plugin) {
  const settings = registerMiscSettings(plugin);

  // No isGamePage() gate here, deliberately - unlike deck-tracker,
  // this package is meant to work on any page, including outside of
  // matches entirely.
  function syncNotepadVisibility() {
    if (settings.enableNotepad.value()) {
      showNotepad();
    } else {
      hideNotepad();
    }
  }
  syncNotepadVisibility();

  // Re-checked whenever a match connects too, same reasoning as
  // deck-tracker's own settings-sync pattern - there's no live
  // "settings changed" event, so this is the best available proxy for
  // catching a toggle without requiring a full page reload every time.
  plugin.events.on("connect", () => {
    syncNotepadVisibility();
  });

  // Emergency recovery shortcut: Ctrl+Alt+Shift+N forcibly clears the
  // notepad's saved drawing/position and removes it from the page,
  // then reopens a fresh one if the setting is currently on.
  // Deliberately a global, document-level listener rather than a
  // button on the widget itself - the whole point is to work even if
  // the widget's own UI has become unresponsive.
  document.addEventListener("keydown", e => {
    if (e.ctrlKey && e.altKey && e.shiftKey && e.key.toLowerCase() === "n") {
      forceResetNotepad();
      if (settings.enableNotepad.value()) {
        showNotepad();
      }
    }
  });
}
