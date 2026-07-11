import { bootstrap } from "./packages/core/bootstrap.js";
import { initPatchMaker } from "./packages/patch-maker/index.js";
import { initTrueHubBridge } from "./packages/true-hub-bridge/index.js";

bootstrap(plugin => {
  initPatchMaker(plugin);
  initTrueHubBridge(plugin);
});
