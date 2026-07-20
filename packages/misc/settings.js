import { createFeatureSettings } from "../core/settings.js";

export function registerMiscSettings(plugin) {
  const settings = createFeatureSettings(plugin, "misc", "Miscellaneous");

  // A lighthearted callback to the exact "pen and paper / notepad
  // files" defense given during the moderation discussion - a
  // genuinely manual drawing surface, no calculation, no game-event
  // hooking, just a literal digital scratchpad the player operates by
  // hand. Lives here (not deck-tracker) so it persists and works
  // outside of matches too.
  const enableNotepad = settings.add("enableNotepad", {
    name: "Enable Notepad Overlay Option",
    type: "boolean",
    default: false
  });

  return {
    settings,
    enableNotepad
  };
}
