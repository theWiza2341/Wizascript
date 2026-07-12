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
    }),
    // Independent from favoriting - this remembers whatever was left
    // open (favorited or not) at the end of a session and restores it
    // once, in the same spot, until the user explicitly closes it.
    retainUnclosedPresets: settings.add("retainUnclosedPresets", {
      name: "Retain Unclosed Presets Between Matches",
      type: "boolean",
      default: false
    })
  };
}
