import { bootstrap } from "./packages/core/bootstrap.js";
import { initPatchMaker } from "./packages/patch-maker/index.js";
import { initTrueHubBridge } from "./packages/true-hub-bridge/index.js";
import { initDeckTracker } from "./packages/deck-tracker/index.js";

// NOTE: packages/misc/ (Doom Reminder, both "Classic" chat-ping and
// "Evil" clickbait-overlay modes) is deliberately NOT wired in here -
// confirmed by UC moderation to cross the line on automatically
// hooking into game events, even though the underlying information
// (turn count) isn't itself hidden. Left in place, unreferenced,
// rather than deleted - the sound-effect infrastructure and
// hotkey/console-testing patterns built for it may be reused by a
// future, compliant feature.

bootstrap(plugin => {
  initPatchMaker(plugin);
  initTrueHubBridge(plugin);
  initDeckTracker(plugin);
});
