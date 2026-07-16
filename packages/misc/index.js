import { registerMiscSettings } from "./settings.js";
import { registerDoomReminder, resetDoomReminderForMatchStart } from "./doom-reminder.js";
import { registerDoomOverlay, resetDoomOverlayForMatchStart } from "./doom-overlay.js";

export function initMisc(plugin) {
  const settings = registerMiscSettings(plugin);

  registerDoomReminder(plugin, () => settings.doomReminderMode.value() === "Classic");
  registerDoomOverlay(
    plugin,
    () => settings.doomReminderMode.value() === "Evil",
    () => settings.doomOverlayVolume.value()
  );

  // Own 'connect' listener, independent of Deck Tracker's - UnderScript
  // supports multiple listeners on the same event name, each firing
  // its own callback, so this doesn't need to touch or share state
  // with any other package's handler.
  plugin.events.on("connect", data => {
    resetDoomReminderForMatchStart(data?.turn ?? 0);
    resetDoomOverlayForMatchStart(data?.turn ?? 0);
  });
}
