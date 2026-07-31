// packages/uc-tv/index.js
//
// Unlike the standalone prototype this was developed as, this package
// does NOT register its own separate UnderScript plugin - it receives
// the same shared `plugin` object every other Wizascript package
// does, wired in by manifest.js/bootstrap.js.
//
// Settings register unconditionally (site-wide), same as how
// UnderScript's own settings are always reachable regardless of what
// page you're on - so people can see/adjust what UC TV will do without
// needing to be actively spectating. Everything ACTUAL (keybinds, the
// getResult listener, the debug console commands) stays gated to
// Spectate pages via the same matchesPage() utility Deck Tracker uses,
// since none of it does anything meaningful anywhere else.

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
  const settings = registerUcTvSettings(plugin, DIVISION_TIERS);
  setSettingsRef(settings);
  console.log('[UC TV] Settings registered.');
  dumpSettingsState();

  // Debug console commands - available from anywhere, same as the
  // settings themselves, not just while actively spectating.
  window.__ucTVScope = scopeActiveGames;
  window.__ucTVSettings = dumpSettingsState;

  if (!isSpectatePage()) return;

  bindChannelKeybinds(plugin);
  bindChannelGuideKeybinds(plugin);
  logDebug('Channel switching and channel guide keybinds active (see the Keybinds settings category). 1s navigation cooldown after page load.');

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
