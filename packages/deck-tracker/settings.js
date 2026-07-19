import { createFeatureSettings } from "../core/settings.js";

export function registerDeckTrackerSettings(plugin) {
  const settings = createFeatureSettings(plugin, "decktracker", "Deck Tracker");

  const enabled = settings.add("enabled", {
    name: "Enable Deck Tracker",
    type: "boolean",
    default: true
  });

  const debugLogging = settings.add("debugLogging", {
    name: "Enable debug logging",
    type: "boolean",
    default: false
  });

  // Independent from favoriting - this remembers whatever was left
  // open (favorited or not) at the end of a session and restores it
  // once, in the same spot, until the user explicitly closes it.
  const retainUnclosedPresets = settings.add("retainUnclosedPresets", {
    name: "Retain Unclosed Presets Between Matches",
    type: "boolean",
    default: false
  });

  // Off by default, matching the original design: auto-loading your
  // OWN favorited/retained presets while merely spectating someone
  // else's match felt like it shouldn't happen unless deliberately
  // opted into. Soul-based auto-load above is unaffected by this -
  // it already always applies to spectating regardless.
  const allowFavoritedRetainedWhileSpectating = settings.add("allowFavoritedRetainedWhileSpectating", {
    name: "Auto-load Favorited/Retained Presets While Spectating",
    type: "boolean",
    default: false
  });

  // Lets the user tune how dim the tracker button gets while a
  // blocking modal (messageBox, mulligan, card-choice) is open, since
  // there's no single "correct" value - it just needs to visually
  // match whatever the rest of the dimmed screen looks like.
  const dimOpacity = settings.add("dimOpacity", {
    name: "Tracker Button Dim Opacity",
    type: "slider",
    default: 0.4,
    min: 0,
    max: 1,
    step: 0.05
  });

  return {
    settings,
    enabled,
    debugLogging,
    retainUnclosedPresets,
    allowFavoritedRetainedWhileSpectating,
    dimOpacity
  };
}
