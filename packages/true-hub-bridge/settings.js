import { createFeatureSettings } from "../core/settings.js";
import { getPluginToggle, isPluginEnabled } from "../core/plugins.js";
import { debugLoggingSetting } from "../core/debug.js";

// Fixes a real bug from the original standalone script: it called
// `thSettings.get?.("autoOpenTrueHub")`, but UnderScript's settings API
// has no `.get()` method (only `.value()` on the object returned by
// `.add()`), and the original discarded `.add()`'s return value
// entirely. Both settings silently always fell back to their default
// on load, regardless of what the user had actually set. Fixed here by
// capturing the real setting object and reading `.value()` from it,
// same pattern as patch-maker/settings.js.
export function registerTrueHubBridgeSettings(plugin) {
  const settings = createFeatureSettings(plugin, "truehubbridge", {
    tab: "True Hub Bridge",
    visible: () => isPluginEnabled("trueHub")
  });

  return {
    settings,
    // The on/off switch itself now lives in the Plugins list (core/plugins.js).
    enabled: getPluginToggle("trueHub"),
    // One suite-wide switch on the General tab since 1.5.0 (core/debug.js).
    debugLogging: debugLoggingSetting,
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
