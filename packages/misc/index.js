import { registerMiscSettings } from "./settings.js";
import { showNotepad, hideNotepad } from "./notepad.js";

export function initMisc(plugin) {
  const settings = registerMiscSettings(plugin);

  // No isGamePage() gate here, deliberately - unlike deck-tracker,
  // this package is meant to work on any page, including outside of
  // matches entirely.
  function syncNotepadVisibility() {
    if (settings.enableNotepad.value()) {
      showNotepad(() => settings.enableNotepadDebugLogging.value());
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
}
