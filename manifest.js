import { bootstrap } from "./packages/core/bootstrap.js";
import { flushKeybindRegistrations } from "./packages/core/keybinds.js";
import { initPatchMaker } from "./packages/patch-maker/index.js";
import { initTrueHubBridge } from "./packages/true-hub-bridge/index.js";
import { initDeckTracker } from "./packages/deck-tracker/index.js";
import { initUcTv } from "./packages/uc-tv/index.js";
import { initMisc } from "./packages/misc/index.js";
import { initController } from "./packages/controller/index.js";
import { initDtAnimations } from "./packages/dt-animations/index.js";

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
// gated behind deck-tracker's isGamePage() check - plus the "Enable
// Controller Support" master toggle itself, and now Card Tags
// (right-click a card in Crafting/Deck-building to apply custom flair
// tags, filterable via the existing search bar, with an on-card
// indicator). Both toggles live under Miscellaneous rather than their
// own category so a player who hasn't turned a feature on yet isn't
// shown a whole category of settings for something they can't use -
// initMisc must run BEFORE initController so the setting object it
// returns (miscSettings.enableController) exists in time for
// registerControllerSettings() to read it and decide whether to
// register the rest of "Keybinds - Controller" at all this load. Card
// Tags itself is wired entirely inside initMisc (no manifest.js
// involvement needed) since, unlike Controller, nothing outside the
// misc package needs to read its setting.
//
// DT Animations: cosmetic-only, staff-approved. Its loader reacts ONLY
// to public on-board state (e.g. an artifact both players can see) and
// never to hand/deck/hidden info. Individual animations live in
// packages/dt-animations/animations/ and are discovered by build.js -
// adding one never needs an edit here.

bootstrap(plugin => {
  initPatchMaker(plugin);
  initTrueHubBridge(plugin);
  initDeckTracker(plugin);
  initUcTv(plugin);
  initDtAnimations(plugin);
  const miscSettings = initMisc(plugin);
  initController(plugin, miscSettings.enableController);
  flushKeybindRegistrations(); // must come after all of the above
});
