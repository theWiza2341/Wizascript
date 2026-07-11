import { createFeatureSettings } from "../core/settings.js";

// Fixes a real bug from the original standalone script: it called
// `thSettings.get?.("autoOpenTrueHub")`, but UnderScript's settings API
// has no `.get()` method (only `.value()` on the object returned by
// `.add()`), and the original discarded `.add()`'s return value
// entirely. Both settings silently always fell back to their default
// on load, regardless of what the user had actually set. Fixed here by
// capturing the real setting object and reading `.value()` from it,
// same pattern as patch-maker/settings.js.
export function registerTrueHubBridgeSettings(plugin) {
  const settings = createFeatureSettings(plugin, "truehubbridge", "True Hub Bridge");

  return {
    settings,
    // Master toggle - lets the whole feature be turned off from within
    // Wizascript's settings, per the "one plugin, categories as boxes"
    // model the rest of the suite follows.
    enabled: settings.add("enabled", {
      name: "Enable True Hub Bridge",
      type: "boolean",
      default: true
    }),
    // The original script had no debug-logging toggle at all (just
    // always-on console.log calls) - added here for consistency with
    // patch-maker, using the same working per-feature debug logger.
    debugLogging: settings.add("debugLogging", {
      name: "Enable debug logging",
      type: "boolean",
      default: false
    }),
    autoOpen: settings.add("autoOpenTrueHub", {
      name: "Auto Open True Hub",
      type: "boolean",
      default: true
    }),
    scrollPaging: settings.add("enableScrollPaging", {
      name: "Enable Scroll Paging",
      type: "boolean",
      default: true
    })
  };
}
