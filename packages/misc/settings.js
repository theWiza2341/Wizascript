// packages/misc/settings.js
//
// 1.5.0: Notepad and Card Tags are listed under "Miscellaneous" on the
// main Wizascript tab, and Controller Support under "Plugins" - all
// registered centrally in core/plugins.js (same storage keys as the old
// "Miscellaneous" toggles). Notepad's "Open Notepad on Page Load" is
// registered there too, so it can sit directly under Notepad's toggle.
// This just hands the relevant setting objects to the misc package.

import { getPluginToggle, getNotepadOpenOnLoadSetting } from "../core/plugins.js";

export function registerMiscSettings() {
  return {
    enableNotepad: getPluginToggle("notepad"),
    enableController: getPluginToggle("controller"),
    enableCardTags: getPluginToggle("cardTags"),
    notepadOpenOnLoad: getNotepadOpenOnLoadSetting()
  };
}
