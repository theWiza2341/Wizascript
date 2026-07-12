// Deck Tracker's settings block, registered under the "Deck Tracker"
// category: per-preset enable toggles, master enable.

import { createFeatureSettings } from "../core/settings.js";

export function registerDeckTrackerSettings(plugin) {
  const settings = createFeatureSettings(plugin, "decktracker", "Deck Tracker");

  return {
    settings,
    // Master toggle - same "one plugin, categories as boxes" model as
    // patch-maker and true-hub-bridge.
    enabled: settings.add("enabled", {
      name: "Enable Deck Tracker",
      type: "boolean",
      default: true
    }),
    debugLogging: settings.add("debugLogging", {
      name: "Enable debug logging",
      type: "boolean",
      default: false
    }),
    // When enabled, soul-tied presets (SAVE Tracker, Change of Winds,
    // Curve Tracker, etc.) auto-spawn at match start if the player's
    // current Soul matches - but only in matches the player is actually
    // in, not while spectating. More granular per-preset toggles can be
    // added later without touching this shape.
    autoLoadSoulPresets: settings.add("autoLoadSoulPresets", {
      name: "Auto-enable Soul-Specific Presets",
      type: "boolean",
      default: false
    })
  };
}
