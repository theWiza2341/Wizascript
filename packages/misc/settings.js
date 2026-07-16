import { createFeatureSettings } from "../core/settings.js";

export function registerMiscSettings(plugin) {
  const settings = createFeatureSettings(plugin, "misc", "Miscellaneous");

  return {
    settings,
    // A lighthearted easter egg - Doom is an artifact that procs every
    // 12 turns, and because of the long wait, players often forget
    // it's ticking. This recreates the community meme of pinging
    // someone "don't forget about doom" as a fake, purely client-side
    // chat message - nothing is ever sent over the network, so nobody
    // else ever sees it.
    enableDoomReminder: settings.add("enableDoomReminder", {
      name: "Enable Doom Reminder",
      type: "boolean",
      default: false
    })
  };
}
