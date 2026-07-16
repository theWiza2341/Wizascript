import { createFeatureSettings } from "../core/settings.js";

export function registerMiscSettings(plugin) {
  const settings = createFeatureSettings(plugin, "misc", "Miscellaneous");

  return {
    settings,
    // A lighthearted easter egg - Doom is an artifact that procs every
    // 12 turns, and because of the long wait, players often forget
    // it's ticking. A single dropdown rather than a checkbox - lets
    // the user decide both WHETHER this is on and HOW, in one control.
    // "None" is the default (off); "Classic" recreates the community
    // meme via a fake, purely client-side chat ping - nothing is ever
    // sent over the network, so nobody else ever sees it; "Evil" is
    // the clickbait circle+arrows+sound version. Matches the confirmed
    // "select" pattern already used by Patch Maker's language setting.
    doomReminderMode: settings.add("doomReminderMode", {
      name: "Doom Reminder",
      type: "select",
      options: ["None", "Classic", "Evil"],
      default: "None"
    }),
    // Defaults to 50% - confirmed via live testing that full volume on
    // the vine-boom/reaction sounds is genuinely too loud for what
    // this feature is. Only relevant to the "Evil" mode above.
    doomOverlayVolume: settings.add("doomOverlayVolume", {
      name: "Doom Overlay Volume",
      type: "slider",
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.05
    })
  };
}
