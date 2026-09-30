import { createFeatureSettings } from "../core/settings.js";
import { getPluginToggle, isPluginEnabled } from "../core/plugins.js";
import { debugLoggingSetting } from "../core/debug.js";

export function registerPatchMakerSettings(plugin) {
  const settings = createFeatureSettings(plugin, "patchmaker", {
    tab: "Patch Maker",
    visible: () => isPluginEnabled("patchMaker")
  });

  return {
    settings,
    // The on/off switch itself now lives in the Plugins list (core/plugins.js).
    enabled: getPluginToggle("patchMaker"),
    // One suite-wide switch on the General tab since 1.5.0 (core/debug.js).
    debugLogging: debugLoggingSetting,
    hideControls: settings.add("hideControls", { name: "Hide Patch Maker controls", type: "boolean", default: false }),
    cardHovers: settings.add("enableCardHovers", { name: "Enable card hovers", type: "boolean", default: true }),
    language: settings.add("patchLanguage", {
      name: "Select Language",
      type: "select",
      options: ["Auto / Default", "English", "French", "Spanish", "Portuguese", "Chinese", "Italian", "Polish", "German", "Russian"],
      default: "Auto / Default",
      onChange: () => location.reload()
    }),
    openOnLoad: settings.add("openPatchNotesOnPageLoad", { name: "Auto-Load Patch Maker", type: "boolean", default: false })
  };
}
