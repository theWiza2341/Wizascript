import { bootstrap } from "./packages/core/bootstrap.js";
import { flushKeybindRegistrations, initKeybinds } from "./packages/core/keybinds.js";
import { registerPluginToggles, runMigrations } from "./packages/core/plugins.js";
import { registerAboutSection, showWhatsNew } from "./packages/core/about.js";
import { registerBackupSection } from "./packages/core/backup.js";
import { initTabBar } from "./packages/core/tab-bar.js";
import { registerStressTabs } from "./packages/core/stress-test.js";

/* global __WIZASCRIPT_STRESS_TABS__ */
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
// The "misc" package houses Notepad and Card Tags, and hands back the
// Controller Support toggle for initController(). Since 1.5.0 all three
// are regular entries in the Plugins list rather than "Miscellaneous"
// toggles.

// 1.5.0 settings layout (see packages/core/plugins.js):
//   General tab     - "Plugins" + "Miscellaneous" lists (one on/off per feature) + "Wizascript" (version, changelog)
//                     (UnderScript names it "Wizascript"; core/tab-bar.js relabels it and adds paging arrows)
//   one tab per ENABLED plugin, in the order registered below
//   Keybinds tab    - only while a keybind-using plugin is enabled
//   Controller tab  - only while Controller Support is enabled
// Tabs appear in the order their first setting is registered, so the
// order of calls here is the order players see.
bootstrap(plugin => {
  // Must run before anything reads a plugin toggle.
  const installState = runMigrations();

  registerPluginToggles(plugin);
  registerAboutSection(plugin);
  registerBackupSection(plugin);
  initTabBar(plugin);

  initPatchMaker(plugin);
  initTrueHubBridge(plugin);
  initDeckTracker(plugin); // shown to players as "Card Tracker"
  initUcTv(plugin);
  const miscSettings = initMisc(plugin);
  initKeybinds(plugin); // creates the Keybinds tab ahead of Controller Support's
  initController(plugin, miscSettings.enableController);
  // Dev-only test tabs - 0 (stripped out) in normal builds; see stress-test.js.
  if (__WIZASCRIPT_STRESS_TABS__) registerStressTabs(plugin, __WIZASCRIPT_STRESS_TABS__);
  flushKeybindRegistrations(); // must come after all of the above

  showWhatsNew(plugin, installState);
});
