import { createFeatureSettings } from "../core/settings.js";

const NOTEPAD_RANT_NAME =
  "Enable The Notepad They Said Was Fine I Swear Don't Send Them After Me It Was ONE Time Ok? Look I Read The Actual Statement Very Carefully And It Specifically Says Pen And Paper Type Tools Are Completely Fine And This Is Quite Literally Just Digital Pen And Paper, It Doesn't Calculate Anything, It Doesn't Hook Into Any Game Events, It Doesn't Even Know What Turn It Is, Please I Am Begging You Just Let Me Have This One Silly Little Drawing Feature Its So Cool And Awesome Just Try It Yourself Before You Nuke My Script First Ok?";
const NOTEPAD_SHORT_NAME = "Enable Notepad Overlay Option";

// Our OWN persisted cache of the rant-toggle's value - deliberately
// NOT reading UnderScript's own internal settings storage (two
// separate attempts at guessing that key format both silently failed,
// meaning neither approach actually worked). This key is entirely
// ours, written and read only by us, so there's nothing to guess at.
const RANT_DISABLED_CACHE_KEY = "wizascript.misc.rantDisabledCache";
const CACHE_SYNC_INTERVAL_MS = 3000;

export function registerMiscSettings(plugin) {
  const settings = createFeatureSettings(plugin, "misc", "Miscellaneous");

  // A lighthearted callback to the exact "pen and paper / notepad
  // files" defense given during the moderation discussion - a
  // genuinely manual drawing surface, no calculation, no game-event
  // hooking, just a literal digital scratchpad the player operates by
  // hand. Lives here (not deck-tracker) so it persists and works
  // outside of matches too.
  //
  // Named using OUR OWN cached value (see RANT_DISABLED_CACHE_KEY
  // above), not a live read of the toggle below - this is what lets
  // this setting register FIRST, appearing above "Disable Incessant
  // Ranting" (so the rant is read before the setting that turns it
  // off, matching the intended order), while still eventually
  // reflecting whatever the user last set the toggle to. Doesn't
  // update the SAME session it's toggled in, only from the next page
  // load/match onward, since our cache is synced (see below)
  // throughout the current session for the NEXT one to pick up.
  let cachedRantDisabled;
  try {
    cachedRantDisabled = GM_getValue(RANT_DISABLED_CACHE_KEY, false);
  } catch (e) {
    cachedRantDisabled = false;
  }

  const enableNotepad = settings.add("enableNotepad", {
    name: cachedRantDisabled ? NOTEPAD_SHORT_NAME : NOTEPAD_RANT_NAME,
    type: "boolean",
    default: false
  });

  const disableWizaRanting = settings.add("disableWizaRanting", {
    name: "Disable Incessant Ranting",
    type: "boolean",
    default: false
  });

  // Keeps our own cache fresh throughout the session - there's no
  // "settings changed" event to react to instantly, so this polls
  // instead. Doesn't affect the ALREADY-DECIDED name for this session,
  // only what the NEXT page load/match will read.
  function syncRantCache() {
    try {
      GM_setValue(RANT_DISABLED_CACHE_KEY, disableWizaRanting.value());
    } catch (e) {}
  }
  syncRantCache();
  setInterval(syncRantCache, CACHE_SYNC_INTERVAL_MS);

  return {
    settings,
    enableNotepad,
    disableWizaRanting
  };
}
