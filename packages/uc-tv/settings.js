// packages/uc-tv/settings.js

import { createFeatureSettings } from '../core/settings.js';

export const LOG = '[UC TV]';

export const KNOWN_MODES = ['RANKED', 'STANDARD', 'CUSTOM', 'CPU', 'STORY'];

export function titleCase(name) {
  return name.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}

let settingsRef = null; // set once via setSettingsRef(), once real UnderScript settings exist

export function setSettingsRef(ref) {
  settingsRef = ref;
}

export function registerUcTvSettings(plugin, divisionTiers) {
  const settings = createFeatureSettings(plugin, 'ucTv', 'UC TV');

  const enabled = settings.add('enabled', {
    name: 'Enable UC TV',
    type: 'boolean',
    default: true,
    page: 'Spectate'
  });

  const debugLogs = settings.add('debugLogs', {
    name: 'Enable Debug Logs',
    type: 'boolean',
    default: false,
    page: 'Spectate'
  });

  const FILTER_CATEGORY = 'UC TV - Filter Settings';

  // Registered first so it's the top entry within Filter Settings -
  // it's the master switch for everything else in that category.
  const filteringEnabled = settings.add('filteringEnabled', {
    name: 'Enable Match Filtering',
    type: 'boolean',
    default: true,
    category: FILTER_CATEGORY,
    page: 'Spectate'
  });

  // Yes/No selects rather than native booleans, and one per mode
  // rather than a single multi-select widget (no confirmed evidence
  // this framework has a fixed-option checklist type). Stored value
  // is the string 'yes'/'no' rather than a raw boolean - every
  // confirmed 'select' setting anywhere in the actual client uses
  // string or number option values, never booleans, so this avoids
  // gambling on an untested value type in the persistence layer.
  const modeToggles = {};
  KNOWN_MODES.forEach((mode) => {
    modeToggles[mode] = settings.add(`ignoreMode${mode}`, {
      name: `Ignore ${titleCase(mode)} Matches?`,
      type: 'select',
      data: [['Yes', 'yes'], ['No', 'no']],
      default: 'no',
      category: FILTER_CATEGORY,
      page: 'Spectate'
    });
  });

  // Slider was a bad fit for this - replaced with a preset dropdown.
  // 0 keeps the "no effect" default; 1/50/100/200/400/600/800/1000
  // roughly tracks early (1-200) / mid (200-500) / late (501+) game,
  // without being an overwhelming number of choices.
  const minLevel = settings.add('minLevel', {
    name: 'Minimum Player Level',
    type: 'select',
    data: [
      ['No minimum', 0],
      ['1', 1],
      ['50', 50],
      ['100', 100],
      ['200', 200],
      ['400', 400],
      ['600', 600],
      ['800', 800],
      ['1000', 1000]
    ],
    default: 0,
    category: FILTER_CATEGORY,
    page: 'Spectate'
  });

  const levelFilterMode = settings.add('levelFilterMode', {
    name: 'Minimum Level Applies To',
    type: 'select',
    data: [['Either player', 'either'], ['Both players', 'both']],
    default: 'either',
    category: FILTER_CATEGORY,
    page: 'Spectate'
  });

  // Default COPPER (the worst tier) is a deliberate no-op, mirroring
  // minLevel's "0 = no effect" - see filters.js's rankMeetsMin for the
  // explicit COPPER bypass this requires.
  const minRankTier = settings.add('minRankTier', {
    name: 'Minimum Ranked Mode Level',
    type: 'select',
    data: divisionTiers.map((t) => [titleCase(t.name), t.name]),
    default: 'COPPER',
    category: FILTER_CATEGORY,
    page: 'Spectate'
  });

  const rankFilterMode = settings.add('rankFilterMode', {
    name: 'Minimum Rank Applies To',
    type: 'select',
    data: [['Either player', 'either'], ['Both players', 'both']],
    default: 'either',
    category: FILTER_CATEGORY,
    page: 'Spectate'
  });

  const autoMode = settings.add('autoMode', {
    name: 'Enable auto-mode when spectating',
    type: 'boolean',
    default: false,
    page: 'Spectate'
  });

  const countdownSeconds = settings.add('countdownSeconds', {
    name: 'Auto-continue delay (seconds)',
    type: 'select',
    data: Array.from({ length: 15 }, (_, i) => i + 1).map((n) => [`${n}`, n]),
    default: 5,
    page: 'Spectate'
  });

  return {
    enabled, debugLogs, filteringEnabled, modeToggles,
    minLevel, levelFilterMode, minRankTier, rankFilterMode,
    autoMode, countdownSeconds
  };
}

// Every CONFIG.xxx read throughout the package proxies to live
// UnderScript settings once registered, falling back to sensible
// defaults during the brief window before setSettingsRef() is called.
export const CONFIG = {
  get masterEnabled() { return settingsRef ? settingsRef.enabled.value() : true; },
  get debugLogs() { return settingsRef ? settingsRef.debugLogs.value() : false; },
  get filteringEnabled() { return settingsRef ? settingsRef.filteringEnabled.value() : true; },
  get disabledModes() {
    if (!settingsRef) return [];
    return KNOWN_MODES.filter((mode) => settingsRef.modeToggles[mode].value() === 'yes');
  },
  get minLevel() { return settingsRef ? settingsRef.minLevel.value() : 0; },
  get levelFilterMode() { return settingsRef ? settingsRef.levelFilterMode.value() : 'either'; },
  get minRankTier() { return settingsRef ? settingsRef.minRankTier.value() : 'COPPER'; },
  get rankFilterMode() { return settingsRef ? settingsRef.rankFilterMode.value() : 'either'; },
  get autoMode() { return settingsRef ? settingsRef.autoMode.value() : false; },
  get countdownSeconds() { return settingsRef ? settingsRef.countdownSeconds.value() : 5; }
};

export function logDebug(...args) {
  if (CONFIG.debugLogs) console.log(LOG, ...args);
}

// Always logs (not gated behind Enable Debug Logs) - if settings
// themselves aren't behaving, gating this behind another setting
// would hide the one thing needed to diagnose that. Callable anytime
// as __ucTVSettings() to check live values without needing to
// refresh - change a setting in the panel, run this again with no
// reload, and see immediately whether the read reflects it.
export function dumpSettingsState() {
  const snapshot = {
    masterEnabled: CONFIG.masterEnabled,
    debugLogs: CONFIG.debugLogs,
    filteringEnabled: CONFIG.filteringEnabled,
    disabledModes: CONFIG.disabledModes,
    minLevel: CONFIG.minLevel,
    levelFilterMode: CONFIG.levelFilterMode,
    minRankTier: CONFIG.minRankTier,
    rankFilterMode: CONFIG.rankFilterMode,
    autoMode: CONFIG.autoMode,
    countdownSeconds: CONFIG.countdownSeconds
  };
  console.log(`${LOG} [settings] Current live values:`, snapshot);
  return snapshot;
}
