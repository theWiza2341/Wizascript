import { bootstrap } from "./packages/core/bootstrap.js";
import { flushKeybindRegistrations } from "./packages/core/keybinds.js";
import { initPatchMaker } from "./packages/patch-maker/index.js";
import { initTrueHubBridge } from "./packages/true-hub-bridge/index.js";
import { initDeckTracker } from "./packages/deck-tracker/index.js";
import { initUcTv } from "./packages/uc-tv/index.js";
import { initMisc } from "./packages/misc/index.js";
import { initController } from "./packages/controller/index.js";

// NOTE: Doom Reminder (both "Classic" chat-ping and "Evil" clickbait-
// overlay modes) has been removed entirely - confirmed by UC
// moderation to cross the line on automatically hooking into game
// events, even though the underlying information (turn count) isn't
// itself hidden. The sound-effect assets remain in the assets repo in
// case a future, compliant feature ends up reusing them, but the
// feature's own source code has been deleted, not just unwired.
//
// The "misc" package houses the Notepad feature - moved out of
// deck-tracker specifically so it works outside of matches too, not
// gated behind deck-tracker's isGamePage() check - plus, now, the
// "Enable Controller Support" master toggle itself. That toggle lives
// under Miscellaneous rather than its own "Keybinds - Controller"
// category so a player who hasn't turned it on yet isn't shown an
// entire category of gamepad keybind rows they can't use - initMisc
// must run BEFORE initController so the setting object it returns
// (miscSettings.enableController) exists in time for
// registerControllerSettings() to read it and decide whether to
// register the rest of "Keybinds - Controller" at all this load.

bootstrap(plugin => {
  initPatchMaker(plugin);
  initTrueHubBridge(plugin);
  initDeckTracker(plugin);
  initUcTv(plugin);
  const miscSettings = initMisc(plugin);
  initController(plugin, miscSettings.enableController);
  flushKeybindRegistrations(); // must come after all of the above
});
