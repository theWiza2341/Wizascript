import { createFeatureSettings } from "../core/settings.js";

const NOTEPAD_RANT_NAME =
  "Enable The Notepad They Said Was Fine I Swear Don't Send Them After Me It Was ONE Time Ok? Look I Read The Actual Statement Very Carefully And It Specifically Says Pen And Paper Type Tools Are Completely Fine And This Is Quite Literally Just Digital Pen And Paper, It Doesn't Calculate Anything, It Doesn't Hook Into Any Game Events, It Doesn't Even Know What Turn It Is, Please I Am Begging You Just Let Me Have This One Silly Little Drawing Feature And I Promise I Will Never Ever Ask For Anything Ever Again";
const NOTEPAD_SHORT_NAME = "Enable Notepad Overlay Option";

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

  // A lighthearted callback to the exact "pen and paper / notepad
  // files" defense given during the moderation discussion - a
  // genuinely manual drawing surface, no calculation, no game-event
  // hooking, just a literal digital scratchpad the player operates by
  // hand.
  //
  // Registered with a placeholder name first, so it appears ABOVE
  // "Disable Wiza Ranting" below (matching the joke's intended order,
  // where the setup line comes before the setting that turns it off) -
  // the real name is set via direct property mutation right after
  // BOTH settings exist, once we actually know the toggle's value.
  // UNCONFIRMED whether the settings panel reflects a mutated .name
  // after registration versus only ever showing what was passed to
  // .add() - worth testing live. If it doesn't take, the fallback is
  // just showing the placeholder name, not a crash or broken setting.
  const enableNotepad = settings.add("enableNotepad", {
    name: NOTEPAD_SHORT_NAME,
    type: "boolean",
    default: false
  });

  // NOTE: renamed from "Enable Stupid Ass Name" to "Disable Wiza
  // Ranting" - this FLIPS the polarity, since "Disable X" set to true
  // should mean X is turned OFF, the opposite of the old "Enable X"
  // meaning. Default flipped to false to match (ranting NOT disabled
  // by default = long name shows by default, same actual starting
  // behavior as before).
  const disableWizaRanting = settings.add("disableWizaRanting", {
    name: "Disable Wiza Ranting",
    type: "boolean",
    default: false
  });

  // Attempt to rename the notepad setting now that both exist and we
  // know the toggle's actual value - see the uncertainty noted above.
  try {
    enableNotepad.name = disableWizaRanting.value() ? NOTEPAD_SHORT_NAME : NOTEPAD_RANT_NAME;
  } catch (e) {
    // If .name isn't actually writable on this object, this just no-
    // ops rather than breaking the rest of settings registration.
  }

  return {
    settings,
    enabled,
    debugLogging,
    retainUnclosedPresets,
    allowFavoritedRetainedWhileSpectating,
    dimOpacity,
    enableNotepad,
    disableWizaRanting
  };
}
