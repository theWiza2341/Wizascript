import { bootstrap } from "./packages/core/bootstrap.js";
import { initPatchMaker } from "./packages/patch-maker/index.js";
import { initTrueHubBridge } from "./packages/true-hub-bridge/index.js";
import { initDeckTracker } from "./packages/deck-tracker/index.js";

bootstrap(plugin => {
  initPatchMaker(plugin);
  initTrueHubBridge(plugin);
  initDeckTracker(plugin);
});
