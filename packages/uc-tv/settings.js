// packages/uc-tv/settings.js

import { createFeatureSettings } from '../core/settings.js';
import { getPluginToggle, isPluginEnabled } from '../core/plugins.js';
import { debugLoggingSetting } from '../core/debug.js';

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
  const settings = createFeatureSettings(plugin, 'ucTv', {
    tab: 'UC TV',
    visible: () => isPluginEnabled('ucTv')
  });

  // The on/off switch itself now lives in the Plugins list (core/plugins.js).
  const enabled = getPluginToggle('ucTv');

  // One suite-wide switch on the General tab since 1.5.0 (core/debug.js).
  const debugLogs = debugLoggingSetting;

  const autoMode = settings.add('autoMode', {
    name: 'Enable auto-mode when spectating',
    type: 'boolean',
    default: false
  });

  const countdownSeconds = settings.add('countdownSeconds', {
    name: 'Auto-continue delay (seconds)',
    type: 'select',
    data: Array.from({ length: 15 }, (_, i) => i + 1).map((n) => [`${n}`, n]),
    default: 5
  });

  // 1.5.0: plugin tabs are flat lists (no categories), and the filter
  // settings are always registered. Instead of disappearing, they're
  // greyed out while "Enable Match Filtering" is off - see the
  // onChange below, which refreshes their disabled state live.
  const filterDisabled = () => !filteringEnabled.value();
  const filterDependents = [];
  const addFilter = (key, config) => {
    const setting = settings.add(key, { ...config, disabled: filterDisabled });
    filterDependents.push(setting);
    return setting;
  };

  // Master switch for the filter settings that follow.
  const filteringEnabled = settings.add('filteringEnabled', {
    name: 'Enable Match Filtering',
    type: 'boolean',
    default: true,
    onChange: () => filterDependents.forEach((d) => d.refresh())
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
    modeToggles[mode] = addFilter(`ignoreMode${mode}`, {
      name: `Ignore ${titleCase(mode)} Matches?`,
      type: 'select',
      data: [['Yes', 'yes'], ['No', 'no']],
      default: 'no'
    });
  });

  // Slider was a bad fit for this - replaced with a preset dropdown.
  // 0 keeps the "no effect" default; 1/50/100/200/400/600/800/1000
  // roughly tracks early (1-200) / mid (200-500) / late (501+) game,
  // without being an overwhelming number of choices.
  const minLevel = addFilter('minLevel', {
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
    default: 0
  });

  const levelFilterMode = addFilter('levelFilterMode', {
    name: 'Minimum Level Applies To',
    type: 'select',
    data: [['Either player', 'either'], ['Both players', 'both']],
    default: 'either'
  });

  // Default COPPER (the worst tier) is a deliberate no-op, mirroring
  // minLevel's "0 = no effect" - see filters.js's rankMeetsMin for the
  // explicit COPPER bypass this requires.
  const minRankTier = addFilter('minRankTier', {
    name: 'Minimum Ranked Mode Level',
    type: 'select',
    data: divisionTiers.map((t) => [titleCase(t.name), t.name]),
    default: 'COPPER'
  });

  const rankFilterMode = addFilter('rankFilterMode', {
    name: 'Minimum Rank Applies To',
    type: 'select',
    data: [['Either player', 'either'], ['Both players', 'both']],
    default: 'either'
  });

  return {
    enabled, debugLogs, filteringEnabled, modeToggles,
    minLevel, levelFilterMode, minRankTier, rankFilterMode,
    autoMode, countdownSeconds
  };
}

// Every CONFIG.xxx read throughout the package proxies to live
// UnderScript settings once registered, falling back to sensible
// defaults both before setSettingsRef() is called AND when a given
// setting was conditionally skipped (UC TV disabled - see
// registerUcTvSettings). Guarding each property individually, not
// just settingsRef as a whole, is what makes that safe: logDebug() in
// particular reads CONFIG.debugLogs before anything checks
// masterEnabled - though debugLogs itself always registers now, the
// filter-related getters below (disabledModes/minLevel/minRankTier/
// etc.) can genuinely be null while disabled, so they still need it.
export const CONFIG = {
  get masterEnabled() { return settingsRef ? settingsRef.enabled.value() : true; },
  get debugLogs() { return settingsRef && settingsRef.debugLogs ? settingsRef.debugLogs.value() : false; },
  get filteringEnabled() { return settingsRef && settingsRef.filteringEnabled ? settingsRef.filteringEnabled.value() : true; },
  get disabledModes() {
    if (!settingsRef || !settingsRef.modeToggles) return [];
    return KNOWN_MODES.filter((mode) => settingsRef.modeToggles[mode] && settingsRef.modeToggles[mode].value() === 'yes');
  },
  get minLevel() { return settingsRef && settingsRef.minLevel ? settingsRef.minLevel.value() : 0; },
  get levelFilterMode() { return settingsRef && settingsRef.levelFilterMode ? settingsRef.levelFilterMode.value() : 'either'; },
  get minRankTier() { return settingsRef && settingsRef.minRankTier ? settingsRef.minRankTier.value() : 'COPPER'; },
  get rankFilterMode() { return settingsRef && settingsRef.rankFilterMode ? settingsRef.rankFilterMode.value() : 'either'; },
  get autoMode() { return settingsRef && settingsRef.autoMode ? settingsRef.autoMode.value() : false; },
  get countdownSeconds() { return settingsRef && settingsRef.countdownSeconds ? settingsRef.countdownSeconds.value() : 5; }
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
  // Only called automatically when debug logging is on (see index.js);
  // calling __ucTVSettings() by hand always logs.
  console.log(`${LOG} [settings] Current live values:`, snapshot);
  return snapshot;
}
