// packages/uc-tv/index.js
//
// Unlike the standalone prototype this was developed as, this package
// does NOT register its own separate UnderScript plugin - it receives
// the same shared `plugin` object every other Wizascript package
// does, wired in by manifest.js/bootstrap.js. Page-gated to Spectate
// pages via the same matchesPage() utility Deck Tracker uses.

import { matchesPage } from '../core/page-match.js';
import { DIVISION_TIERS } from './divisions.js';
import { registerUcTvSettings, setSettingsRef, dumpSettingsState, CONFIG, logDebug } from './settings.js';
import { bindChannelKeybinds, goToNextMatch } from './channel-switch.js';
import { bindChannelGuideKeybinds } from './channel-guide.js';
import { scopeActiveGames } from './debug.js';

function isSpectatePage() {
  return matchesPage({ prefix: '/Spectate' });
}

export function initUcTv(plugin) {
  if (!isSpectatePage()) return;

  const settings = registerUcTvSettings(plugin, DIVISION_TIERS);
  setSettingsRef(settings);
  console.log('[UC TV] Settings registered.');
  dumpSettingsState();

  // Debug console commands - deliberately global (not gated behind
  // any setting) so they're reachable regardless of whether something
  // else is misbehaving.
  window.__ucTVScope = scopeActiveGames;
  window.__ucTVSettings = dumpSettingsState;

  bindChannelKeybinds(plugin);
  bindChannelGuideKeybinds(plugin);
  logDebug('Ctrl+ArrowLeft/Right channel switching and hold-Ctrl channel guide active. 1s navigation cooldown after page load.');

  let handled = false; // guards against getResult firing more than once per page load
  plugin.events.on('getResult', (data) => {
    logDebug('getResult fired - match ended.', data);
    if (handled) return;
    handled = true;
    if (!CONFIG.masterEnabled) {
      logDebug('Enable UC TV is off - staying put.');
      return;
    }
    if (!CONFIG.autoMode) {
      logDebug('Auto-mode is off - staying put.');
      return;
    }
    goToNextMatch(plugin);
  });
}
