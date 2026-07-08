// Patch Maker's settings block, registered under the "Patch Maker"
// category: debug logging, hide controls, card hovers, language
// selection, auto-open on page load.

import { createFeatureSettings } from "../core/settings.js";

export function registerPatchMakerSettings(plugin) {
  const settings = createFeatureSettings(plugin, "patchmaker", "Patch Maker");

  return {
    settings,
    enabled: settings.add("enabled", { name: "Enable Patch Maker", type: "boolean", default: true }),
    debugLogging: settings.add("debugLogging", { name: "Enable debug logging", type: "boolean", default: false }),
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
