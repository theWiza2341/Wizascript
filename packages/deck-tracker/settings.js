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
  // Attempts to read "Disable Wiza Ranting"'s PERSISTED value directly
  // via GM_getValue, bypassing the official settings API entirely,
  // BEFORE registering either setting - guessing that UnderScript
  // persists it under the same key string passed to settings.add()
  // ("decktracker.disableWizaRanting"). If this guess is correct, we
  // know the toggle's real value before ever calling .add() for the
  // notepad setting, letting it register with the CORRECT name from
  // the start while still appearing first/above (matching the joke's
  // intended order: setup line first, the setting that turns it off
  // second). UNCONFIRMED whether this key format guess is right - a
  // wrong guess just means GM_getValue finds nothing and falls back to
  // the safe default (long rant name), not a crash.
  let rantDisabled;
  try {
    rantDisabled = GM_getValue("decktracker.disableWizaRanting", false);
  } catch (e) {
    rantDisabled = false;
  }

  const enableNotepad = settings.add("enableNotepad", {
    name: rantDisabled ? NOTEPAD_SHORT_NAME : NOTEPAD_RANT_NAME,
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
