import { bootstrap } from "./packages/core/bootstrap.js";
import { initPatchMaker } from "./packages/patch-maker/index.js";

bootstrap(plugin => {
  initPatchMaker(plugin);
});
