import { bootstrap } from "./packages/core/bootstrap.js";
import { initPatchMaker } from "./packages/patch-maker/index.js";
import { initTrueHubBridge } from "./packages/true-hub-bridge/index.js";
import { initDeckTracker } from "./packages/deck-tracker/index.js";
import { initMisc } from "./packages/misc/index.js";

// NOTE: Doom Reminder (both "Classic" chat-ping and "Evil" clickbait-
// overlay modes) has been removed entirely - confirmed by UC
// moderation to cross the line on automatically hooking into game
// events, even though the underlying information (turn count) isn't
// itself hidden. The sound-effect assets remain in the assets repo in
// case a future, compliant feature ends up reusing them, but the
// feature's own source code has been deleted, not just unwired.
//
// The "misc" package now houses ONLY the Notepad feature - moved out
// of deck-tracker specifically so it works outside of matches too,
// not gated behind deck-tracker's isGamePage() check.

bootstrap(plugin => {
  initPatchMaker(plugin);
  initTrueHubBridge(plugin);
  initDeckTracker(plugin);
  initMisc(plugin);
});
