// packages/controller/settings.js
//
// Registers the "Keybinds - Controller" settings category and everything
// needed to remap a gamepad button (or, as of this round, a keyboard key -
// see enhanceControllerCaptureInput's keydown-as-capture support) to a
// Wizascript action: the preset selector/name widgets, the master "Enable
// Controller Support" toggle, and one capture ("Press a button or key...")
// widget per remappable binding. Mirrors packages/core/keybinds.js's own
// MutationObserver + click-to-capture pattern, but captures a raw gamepad
// button or keyboard code rather than reading through Wizascript's own
// Primary-relative keybind model, so it can't reuse that registry
// directly - these are a genuinely different kind of input to capture and
// persist.

import { createFeatureSettings } from '../core/settings.js';
import {
  PRESET_COUNT, getActivePreset, setActivePreset, getPresetName, setPresetName,
  presetKey, migrateFlatBindingsToPresetOne, resetPresetBindings, csGet, csSet
} from './storage.js';
import { getMergedGamepad, buttonToDisplay, bindingToDisplay, connectWebHidController, isHidConnected } from './gamepad.js';

// One entry per real Wizascript keybind this package's Primary+<button>
// relay dispatches (see actions.js). `context` decides which subset of
// these apply on a given frame: 'always' (Notepad toggle/reset, which
// fire unconditionally), 'patchMaker', 'channelSwitch', or 'default'.
// `defaultButton` reproduces the prototype's original hardcoded layout so
// nothing changes for anyone until they actually remap something.
export const CONTROLLER_ACTIONS = [
  { key: 'previousChannel', name: 'Previous Channel', packageLabel: 'UC TV', context: 'channelSwitch', defaultButton: 14, dispatch: { code: 'ArrowLeft', key: 'ArrowLeft' } },
  { key: 'nextChannel', name: 'Next Channel', packageLabel: 'UC TV', context: 'channelSwitch', defaultButton: 15, dispatch: { code: 'ArrowRight', key: 'ArrowRight' } },
  { key: 'toggleNotepad', name: 'Toggle Notepad', packageLabel: 'Notepad', context: 'always', defaultButton: 3, dispatch: { code: 'KeyO', key: 'o' } },
  { key: 'resetNotepad', name: 'Reset Notepad', packageLabel: 'Notepad', context: 'always', defaultButton: 2, dispatch: { code: 'KeyN', key: 'n' } },
  { key: 'undoNotepad', name: 'Undo Drawing', packageLabel: 'Notepad', context: 'default', defaultButton: 13, dispatch: { code: 'KeyZ', key: 'z' } },
  { key: 'redoNotepad', name: 'Redo Drawing', packageLabel: 'Notepad', context: 'default', defaultButton: 12, dispatch: { code: 'KeyY', key: 'y' } },
  { key: 'moveEntryUp', name: 'Move Entry Up', packageLabel: 'Patch Maker', context: 'patchMaker', defaultButton: 12, dispatch: { code: 'ArrowUp', key: 'ArrowUp' } },
  { key: 'moveEntryDown', name: 'Move Entry Down', packageLabel: 'Patch Maker', context: 'patchMaker', defaultButton: 13, dispatch: { code: 'ArrowDown', key: 'ArrowDown' } },
  // Shortened from "Move Balance Section Up/Down" - the "- Primary +
  // <button>" suffix registerControllerSettings() appends below already
  // pushed the combined row name wide enough to force a horizontal
  // scrollbar in the settings dialog. "Section" alone is unambiguous
  // here (Patch Maker only has one thing called a "section"), matching
  // "Entry"/"Card" already being bare nouns in the two actions above.
  { key: 'moveSectionUp', name: 'Move Section Up', packageLabel: 'Patch Maker', context: 'patchMaker', defaultButton: 12, dispatch: { code: 'ArrowUp', key: 'ArrowUp' } },
  { key: 'moveSectionDown', name: 'Move Section Down', packageLabel: 'Patch Maker', context: 'patchMaker', defaultButton: 13, dispatch: { code: 'ArrowDown', key: 'ArrowDown' } },
  { key: 'moveCardUp', name: 'Move Card Up', packageLabel: 'Patch Maker', context: 'patchMaker', defaultButton: 12, dispatch: { code: 'ArrowUp', key: 'ArrowUp' } },
  { key: 'moveCardDown', name: 'Move Card Down', packageLabel: 'Patch Maker', context: 'patchMaker', defaultButton: 13, dispatch: { code: 'ArrowDown', key: 'ArrowDown' } }
];
export const CONTROLLER_ACTIONS_BY_KEY = {};
CONTROLLER_ACTIONS.forEach((a) => { CONTROLLER_ACTIONS_BY_KEY[a.key] = a; });

// Single-button, direct DOM hardware shortcuts (End Turn, Concede,
// dustpiles, Settings, Open Wizascript Settings, Go Home, opening Deck
// Tracker's own preset picker) - no Primary hold needed. Labeled
// "In-Game Inputs" in the settings UI (see registerControllerSettings
// below) to make clear these are the ones that matter DURING a match, as
// opposed to the Primary+<button> bindings above them, which mostly
// aren't. Deliberately NOT included: R1's Underscript-menu-toggle,
// because it doubles as the OSK-pause toggle using the exact same
// physical button unconditionally.
export const HARDWARE_SHORTCUT_ACTIONS = [
  { key: 'openSettings', name: 'Open Settings' },
  { key: 'yourDustpile', name: 'Check Your Dustpile' },
  { key: 'opponentDustpile', name: "Check Opponent's Dustpile" },
  { key: 'endTurn', name: 'End Turn' },
  { key: 'openWizascriptSettings', name: 'Open Wizascript Settings' },
  { key: 'concede', name: 'Concede' },
  { key: 'goHome', name: 'Go to Home Page' },
  { key: 'openDeckTrackerPresets', name: 'Open Deck Tracker Presets' }
];
export const HARDWARE_SHORTCUT_DEFAULTS = {
  openSettings: 9, yourDustpile: 10, opponentDustpile: 11, endTurn: 17,
  openWizascriptSettings: 7, concede: 8, goHome: 16, openDeckTrackerPresets: 6
};
export const HARDWARE_SHORTCUT_ACTIONS_BY_KEY = {};
HARDWARE_SHORTCUT_ACTIONS.forEach((a) => { HARDWARE_SHORTCUT_ACTIONS_BY_KEY[a.key] = a; });

export const DEFAULT_PRIMARY_BUTTON = 4; // L1

// A bound "input" is one of: null (unbound), a number (gamepad button
// index - the only shape that ever existed before this round), or
// { type: 'key', code } (a real keyboard KeyboardEvent.code, captured via
// enhanceControllerCaptureInput's new keydown-as-capture support below).
// Encoded as a plain string either way, so every value already persisted
// from before keyboard capture existed keeps decoding exactly as it
// always has - 'unbound' -> null, a bare number -> that button index -
// with 'kb:<code>' as the one new shape layered on top.
function encodeBoundInput(value) {
  if (value === null || value === undefined) return 'unbound';
  if (typeof value === 'number') return String(value);
  if (value && value.type === 'key') return 'kb:' + value.code;
  return 'unbound';
}
function decodeBoundInput(raw, defaultValue) {
  if (raw === 'unbound') return null;
  if (typeof raw === 'string' && raw.indexOf('kb:') === 0) return { type: 'key', code: raw.slice(3) };
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? defaultValue : n;
}

export function getControllerPrimaryButton() {
  return decodeBoundInput(csGet(presetKey('keybinds.__primary'), String(DEFAULT_PRIMARY_BUTTON)), DEFAULT_PRIMARY_BUTTON);
}
export function setControllerPrimaryButton(value) {
  csSet(presetKey('keybinds.__primary'), encodeBoundInput(value));
}

// UC TV channel guide - a SEPARATE hold button from Controller Primary
// (per request, after the round-B tap-toggle attempt turned out to be the
// wrong fix for the original "locks the cursor" complaint - the real
// problem was the guide sharing input with every other Primary+<button>
// combo, not the hold gesture itself). Default Unbound rather than
// reusing any existing default button - every other raw button index
// already has SOME standalone or combo-secondary meaning in this package,
// and shipping this pre-bound to one of them risked a real double-meaning
// collision the first time someone held both at once. Unbound means this
// is fully inert until a player deliberately binds it, exactly like
// Controller Primary itself already behaves when unbound.
export function getChannelGuideButton() {
  return decodeBoundInput(csGet(presetKey('keybinds.__channelGuide'), 'unbound'), null);
}
export function setChannelGuideButton(value) {
  csSet(presetKey('keybinds.__channelGuide'), encodeBoundInput(value));
}

export function getBoundButton(actionKey) {
  const action = CONTROLLER_ACTIONS_BY_KEY[actionKey];
  return decodeBoundInput(csGet(presetKey('keybinds.' + actionKey), String(action.defaultButton)), action.defaultButton);
}
export function setBoundButton(actionKey, value) {
  csSet(presetKey('keybinds.' + actionKey), encodeBoundInput(value));
}
export function getBoundShortcutButton(actionKey) {
  const defaultButton = HARDWARE_SHORTCUT_DEFAULTS[actionKey];
  return decodeBoundInput(csGet(presetKey('shortcuts.' + actionKey), String(defaultButton)), defaultButton);
}
export function setBoundShortcutButton(actionKey, value) {
  csSet(presetKey('shortcuts.' + actionKey), encodeBoundInput(value));
}

// Master toggle. Lives under "Miscellaneous" now, not this package's own
// "Keybinds - Controller" category - registered by packages/misc/settings.js
// and handed in as registerControllerSettings(plugin, controllerEnabledSetting)'s
// second argument (manifest.js wires initMisc's return value through to
// initController), the same setting object either way. Moved so a brand
// new user (off by default) doesn't see an entire category of gamepad
// keybind rows before they've even connected a controller - see
// registerControllerSettings() below, which now skips registering the
// rest of "Keybinds - Controller" entirely while this reads false,
// mirroring exactly how packages/uc-tv/settings.js hides its own
// "Filter Settings" category while UC TV itself is disabled. Fails OPEN
// (treated as enabled) if settings registration itself never completes,
// rather than silently bricking every feature with no way to turn it
// back on.
let controllerEnabledSetting = null;
export function isControllerSupportEnabled() {
  if (!controllerEnabledSetting || typeof controllerEnabledSetting.value !== 'function') return true;
  try {
    const v = controllerEnabledSetting.value();
    return v === undefined || v === null ? true : !!v;
  } catch (e) {
    return true;
  }
}

// The persistent green debug status readout (index.js's `hud`) - OFF by
// default, unlike Enable Controller Support above, since this one is
// diagnostic text nobody needs for normal play and it can sit on top of
// other UI if left on. Fails CLOSED (treated as disabled) rather than
// open if settings registration never completes, the opposite default
// direction from isControllerSupportEnabled() above and deliberately so -
// a debug overlay silently appearing for everyone on a registration hiccup
// is a worse failure mode than it silently staying off.
let debugTextEnabledSetting = null;
// Direct read of the checkbox's own `.checked`, kept in sync by a real
// 'change' listener attached the moment the row renders (see
// observeDebugTextCheckbox() in the MutationObserver dispatch below).
// null until that row has actually appeared in the DOM at least once;
// boolean from then on. This exists as a belt-and-suspenders path
// alongside debugTextEnabledSetting.value() below - first live test of
// this toggle came back stuck permanently OFF even after checking it and
// refreshing, which fits a `.value()` accessor that isn't reliably live
// for a brand-new setting key the way it evidently is for the
// long-established "Enable Controller Support" one. Reading the DOM
// checkbox itself can't have that problem, whatever it turns out to be.
let debugTextCheckedLive = null;
function observeDebugTextCheckbox(el) {
  el.setAttribute('data-wc-enhanced', 'true');
  debugTextCheckedLive = !!el.checked;
  el.addEventListener('change', () => { debugTextCheckedLive = !!el.checked; });
}
export function isDebugTextEnabled() {
  if (debugTextCheckedLive !== null) return debugTextCheckedLive;
  if (!debugTextEnabledSetting || typeof debugTextEnabledSetting.value !== 'function') return false;
  try {
    return !!debugTextEnabledSetting.value();
  } catch (e) {
    return false;
  }
}

// Selection-outline highlight color. Presets tied to each soul's own
// color coding rather than a free color picker, both because a fixed
// small set is far more reliable to persist as a 'select' SettingType
// (string values, matching every other confirmed-working 'select' in
// this codebase - see packages/uc-tv/settings.js) than trying a THIRD
// unproven SettingType, and because it directly answers what was asked:
// a background-proof default that isn't just "light blue" for everyone.
// Values pulled verbatim from packages/patch-maker/formatting.js's own
// BASE_WORD_COLORS (the same colors that already highlight each soul's
// name in a patch note), generalized to plain color names here rather
// than the class names, per request - a player who's never touched
// Patch Maker still immediately knows what "Orange" looks like.
export const HIGHLIGHT_COLOR_PRESETS = [
  ['Light Blue (default)', '#3ea6ff'],
  ['Yellow', '#ffff00'],   // JUSTICE
  ['Red', 'red'],          // DETERMINATION
  ['Green', '#00c000'],    // KINDNESS
  ['Orange', '#fca500'],   // BRAVERY
  ['Blue', '#0064ff'],     // INTEGRITY
  ['Cyan', '#41fcff'],     // PATIENCE
  ['Magenta', '#d535d9']   // PERSEVERANCE
];
const DEFAULT_HIGHLIGHT_COLOR = HIGHLIGHT_COLOR_PRESETS[0][1];

let highlightColorSetting = null;
// Same belt-and-suspenders direct-DOM-read fallback as
// isDebugTextEnabled() above, for the same reason: this package's own
// documented history is that anything past 'boolean'/'text' SettingTypes
// was never confirmed working end to end before now, and a live 'change'
// listener on the rendered element can't have whatever reliability quirk
// `.value()` turned out to have for debugTextEnabled. Works whether
// Underscript renders a 'select' SettingType as a real `<select>` or as
// an `<input>` with its own dropdown behavior - both fire 'change' the
// same way and both expose the current value via `.value`.
let highlightColorLive = null;
function observeHighlightColorSelect(el) {
  el.setAttribute('data-wc-enhanced', 'true');
  highlightColorLive = el.value || null;
  el.addEventListener('change', () => { highlightColorLive = el.value || null; });
}
export function getHighlightColor() {
  if (highlightColorLive) return highlightColorLive;
  if (!highlightColorSetting || typeof highlightColorSetting.value !== 'function') return DEFAULT_HIGHLIGHT_COLOR;
  try {
    return highlightColorSetting.value() || DEFAULT_HIGHLIGHT_COLOR;
  } catch (e) {
    return DEFAULT_HIGHLIGHT_COLOR;
  }
}

// True for as long as ANY capture widget is actively waiting for its next
// button press ("Press a button..."). Without this flag, the Settings
// dialog's own generic fields-pane confirm/navigation handling (in
// index.js's frame loop) runs unconditionally every frame and would
// compete with a capture widget for the exact same press - B/X in
// particular are treated as universal confirm/alt-confirm there, so
// they'd otherwise be permanently uncapturable. index.js reads this via
// isControllerCaptureActive() to stand its own handling down while a
// capture widget owns input.
let controllerCaptureActive = false;
export function isControllerCaptureActive() { return controllerCaptureActive; }

// Every capture/preset widget currently rendered in the settings dialog
// registers its own refreshDisplay() here, so switching the active preset
// can push every visible widget back in sync immediately, without needing
// the user to close and reopen the Settings dialog.
const boundInputRefreshers = [];

function enhanceControllerDivider(el) {
  el.setAttribute('data-wc-enhanced', 'true');
  el.readOnly = true;
  el.tabIndex = -1;
  Object.assign(el.style, {
    backgroundColor: 'transparent', border: 'none', borderBottom: '1px solid #666',
    color: '#8ab4f8', fontWeight: 'bold', cursor: 'default', pointerEvents: 'none',
    // A bit of breathing room above/below each section header - without
    // it every divider sat flush against the row before it, and with
    // "— In-Game Inputs —" no longer followed by its own info row (see
    // registerControllerSettings), that section in particular read as
    // visually cramped against "Move Section Down" right above it.
    marginTop: '14px', marginBottom: '2px', paddingTop: '4px'
  });
}

function enhanceControllerCaptureInput(el, readBound, writeBound) {
  el.setAttribute('data-wc-enhanced', 'true');
  el.readOnly = true;
  Object.assign(el.style, {
    cursor: 'pointer', backgroundColor: 'black', color: 'white',
    border: '1px solid #b4b4b4', borderRadius: '3px', textAlign: 'center'
  });

  function refreshDisplay() {
    el.value = bindingToDisplay(readBound());
  }
  refreshDisplay();
  boundInputRefreshers.push(refreshDisplay);

  el.addEventListener('focus', () => {
    el.style.border = '1px solid #40E0D0';
    el.style.boxShadow = '0 0 4px #40E0D0';
    el.value = 'Press a button or key...';
    controllerCaptureActive = true;

    // Gamepad API has no "buttondown" event to listen for the way a real
    // keydown works - has to be polled. Buttons already held the instant
    // this widget got focus are ignored until released, so this can't
    // instantly self-capture. Merged across every connected pad, so
    // remapping a binding to any connected controller's button works
    // regardless of which one triggered the focus.
    let cancelled = false;
    let ignoreUntilReleased = new Set();
    const gp0 = getMergedGamepad();
    if (gp0) gp0.buttons.forEach((b, i) => { if (b && b.pressed) ignoreUntilReleased.add(i); });

    function captureFrame() {
      if (cancelled) return;
      const gp = getMergedGamepad();
      if (gp) {
        gp.buttons.forEach((b, i) => {
          if (!b) return;
          if (!b.pressed) { ignoreUntilReleased.delete(i); return; }
          if (ignoreUntilReleased.has(i)) return;
          finishCapture(i);
        });
      }
      if (!cancelled) requestAnimationFrame(captureFrame);
    }
    function finishCapture(value) {
      if (cancelled) return;
      cancelled = true;
      writeBound(value);
      cleanup();
      el.blur();
    }
    // EXPERIMENTAL: a real keyboard keydown is now also accepted as a way
    // to fill this same binding slot, alongside a gamepad button - added
    // so a device whose remapped inputs only ever reach the page as
    // synthetic keyboard events (e.g. a Steam Controller back paddle
    // remapped through Steam Input) can still be bound here directly,
    // without needing a dedicated Wizascript action for every possible
    // input. Escape is still reserved for unbinding, exactly as before -
    // it can never itself become a binding. A bare modifier tap (Shift/
    // Control/Alt/Meta alone, with no other key) is ignored outright,
    // since it's far more likely to be part of some other combo the
    // player didn't mean to capture here than a deliberate binding.
    // Controller input is meant to win when both arrive around the same
    // instant: if a real gamepad button is ALSO physically down the
    // moment a keydown lands, this listener steps aside and lets
    // captureFrame's own poll (at most one animation frame later) capture
    // it as a controller button instead.
    function onKeydown(e) {
      if (cancelled) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelled = true;
        writeBound(null);
        cleanup();
        el.blur();
        return;
      }
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
      const gpNow = getMergedGamepad();
      if (gpNow && gpNow.buttons.some((b) => b && b.pressed)) return; // let the controller win this frame
      e.preventDefault();
      finishCapture({ type: 'key', code: e.code });
    }
    function cleanup() {
      document.removeEventListener('keydown', onKeydown, true);
    }
    document.addEventListener('keydown', onKeydown, true);
    requestAnimationFrame(captureFrame);

    el.addEventListener('blur', function onBlur() {
      cancelled = true;
      controllerCaptureActive = false;
      el.style.border = '1px solid #b4b4b4';
      el.style.boxShadow = 'none';
      cleanup();
      refreshDisplay();
      el.removeEventListener('blur', onBlur);
    });
  });
}

// Because the preset picker below is a fully custom floating `<div>`
// (appended to `document.body`, not part of Underscript's own settings
// DOM), index.js's generic d-pad field-grid navigation has no way to
// know it opened - the d-pad would otherwise keep moving the highlight
// through the settings rows underneath it. This is the handoff point:
// whichever menu is currently open (if any) publishes its row elements
// and a close() here, and index.js's fields-pane handler wraps this into
// its own trapped-submenu state (see `fieldSubmenu` in index.js) for as
// long as it stays open, the same way it already traps native Underscript
// dropdown-toggle submenus elsewhere.
let presetMenuState = null; // { rows: HTMLElement[], activeIndex: number, close: () => void } | null
export function getPresetMenuState() { return presetMenuState; }

// "Settings Preset" - click-to-open dropdown-style preset picker. Built
// as a plain type:'text' input with fully custom DOM/click handling
// (renders and behaves like a dropdown) rather than a native Underscript
// 'select' SettingType - the prototype's earlier attempts at anything
// beyond 'boolean'/'text' were never confirmed working end to end, so
// this sticks to the two SettingTypes with a proven track record.
function enhancePresetSelector(el) {
  el.setAttribute('data-wc-enhanced', 'true');
  el.readOnly = true;
  el.tabIndex = 0;
  Object.assign(el.style, {
    cursor: 'pointer', backgroundColor: 'black', color: 'white',
    border: '1px solid #b4b4b4', borderRadius: '3px', textAlign: 'center'
  });

  function refreshDisplay() {
    el.value = getPresetName(getActivePreset());
  }
  refreshDisplay();
  boundInputRefreshers.push(refreshDisplay);

  let menuEl = null;
  function onOutsideClick(e) {
    if (menuEl && !menuEl.contains(e.target) && e.target !== el) closeMenu();
  }
  function onEscape(e) {
    if (e.key === 'Escape') closeMenu();
  }
  function closeMenu() {
    if (!menuEl) return;
    menuEl.remove();
    menuEl = null;
    presetMenuState = null;
    document.removeEventListener('mousedown', onOutsideClick, true);
    document.removeEventListener('keydown', onEscape, true);
  }
  function openMenu() {
    if (menuEl) { closeMenu(); return; }
    const rect = el.getBoundingClientRect();
    menuEl = document.createElement('div');
    Object.assign(menuEl.style, {
      position: 'fixed', left: rect.left + 'px', top: (rect.bottom + 2) + 'px',
      width: Math.max(rect.width, 140) + 'px', background: '#111',
      border: '1px solid #40E0D0', borderRadius: '3px',
      zIndex: 2147483647, overflow: 'hidden', fontFamily: 'inherit'
    });
    const rowEls = [];
    for (let n = 1; n <= PRESET_COUNT; n++) {
      const isActive = n === getActivePreset();
      const row = document.createElement('div');
      row.textContent = getPresetName(n) + (isActive ? '  ✓' : '');
      Object.assign(row.style, {
        padding: '6px 10px', cursor: 'pointer', color: 'white',
        background: isActive ? '#333' : 'transparent'
      });
      row.addEventListener('mouseenter', () => { row.style.background = '#40E0D0'; row.style.color = 'black'; });
      row.addEventListener('mouseleave', () => { row.style.background = isActive ? '#333' : 'transparent'; row.style.color = 'white'; });
      row.addEventListener('click', () => {
        setActivePreset(n);
        closeMenu();
        boundInputRefreshers.forEach((fn) => fn());
        console.log('[Wizascript Controller] switched to preset', n, '(' + getPresetName(n) + ')');
      });
      menuEl.appendChild(row);
      rowEls.push(row);
    }
    document.body.appendChild(menuEl);
    document.addEventListener('mousedown', onOutsideClick, true);
    document.addEventListener('keydown', onEscape, true);
    // Published for index.js's d-pad fields-pane handler to pick up (see
    // getPresetMenuState() above) - activeIndex seeds the trapped-submenu
    // highlight on whichever preset is currently active, so d-pad users
    // land on the right row instead of always starting at the top.
    presetMenuState = { rows: rowEls, activeIndex: Math.max(0, getActivePreset() - 1), close: closeMenu };
  }
  el.addEventListener('click', openMenu);
}

// "Preset Name" - real editable text input (NOT read-only, unlike every
// other widget in this settings surface) bound to whichever preset is
// currently active.
function enhancePresetNameInput(el) {
  el.setAttribute('data-wc-enhanced', 'true');
  el.readOnly = false;
  Object.assign(el.style, {
    backgroundColor: 'black', color: 'white',
    border: '1px solid #b4b4b4', borderRadius: '3px', textAlign: 'center'
  });

  function refreshDisplay() {
    // Don't stomp on an in-progress edit if a preset switch happens to
    // fire a refresh while this field itself is focused.
    if (document.activeElement !== el) el.value = getPresetName(getActivePreset());
  }
  refreshDisplay();
  boundInputRefreshers.push(refreshDisplay);

  function commit() {
    setPresetName(getActivePreset(), el.value);
    boundInputRefreshers.forEach((fn) => fn());
  }
  el.addEventListener('blur', commit);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') el.blur();
  });
}

// "Restore Settings to Default" - a real native 'dblclick' (not a
// hand-rolled two-clicks-within-a-window timer) so it actually behaves
// like every other double-click the user already knows, and can't be
// triggered by two unrelated single clicks landing far apart. Scoped to
// whichever preset is currently active (see storage.js's
// resetPresetBindings) - deletes the stored overrides for every keybind/
// shortcut/Primary/Channel-Guide binding in that preset, then refreshes
// every currently-rendered capture widget so the reset is visible
// immediately without needing to close and reopen Settings.
function enhanceResetButton(el) {
  el.setAttribute('data-wc-enhanced', 'true');
  el.readOnly = true;
  el.tabIndex = 0;
  Object.assign(el.style, {
    cursor: 'pointer', backgroundColor: 'black', color: 'white',
    border: '1px solid #b4b4b4', borderRadius: '3px', textAlign: 'center'
  });

  function refreshDisplay() {
    el.value = 'Double Click to Reset';
  }
  refreshDisplay();
  boundInputRefreshers.push(refreshDisplay);

  el.addEventListener('dblclick', () => {
    resetPresetBindings(getActivePreset(), CONTROLLER_ACTIONS.map((a) => a.key), HARDWARE_SHORTCUT_ACTIONS.map((a) => a.key));
    boundInputRefreshers.forEach((fn) => fn());
    el.value = '✅ Reset to Defaults';
    setTimeout(refreshDisplay, 1500);
  });
}

// "Detect Controller" - replaces the old persistent, always-on-screen
// top-right "Connect Controller (WebHID)" button (see gamepad.js). That
// spot was handy for debugging but not something a regular player needs
// sitting on screen permanently; this on-demand row at the very top of
// "Keybinds - Controller" keeps the same one-click WebHID pairing flow
// available for whoever actually needs it (a controller whose native
// Gamepad-API button translation doesn't work over Bluetooth), without
// it being visible the rest of the time. A real click on a readOnly
// `type: 'text'` settings input, same idiom as the preset selector above,
// still counts as the genuine user gesture WebHID's requestDevice()
// requires - connectWebHidController() is called directly and
// synchronously from this element's own 'click' listener, exactly like
// the old button's listener did.
function enhanceDetectControllerButton(el) {
  el.setAttribute('data-wc-enhanced', 'true');
  el.readOnly = true;
  el.tabIndex = 0;
  Object.assign(el.style, {
    cursor: 'pointer', backgroundColor: 'black', color: 'white',
    border: '1px solid #b4b4b4', borderRadius: '3px', textAlign: 'center'
  });

  function refreshDisplay() {
    el.value = isHidConnected() ? '✅ Controller Detected (WebHID)' : '🎮 Click to Detect Controller (WebHID)';
  }
  refreshDisplay();
  boundInputRefreshers.push(refreshDisplay);

  el.addEventListener('click', async () => {
    if (isHidConnected()) return; // already connected, nothing to do
    el.value = 'Check your browser\'s device picker…';
    try {
      await connectWebHidController();
    } finally {
      refreshDisplay();
    }
  });
}

let controllerObserverStarted = false;
function startControllerKeybindObserver(idPrefix) {
  if (controllerObserverStarted) return;
  controllerObserverStarted = true;
  let everFoundOne = false;
  const observer = new MutationObserver(() => {
    // Matches both <input> and <select> - every binding registered so far
    // has rendered as an <input> (including the custom click-to-open
    // pickers above, which are plain readOnly text inputs dressed up to
    // behave like dropdowns), but highlightColor is this package's first
    // real 'select' SettingType, and it's not confirmed from here which
    // tag Underscript renders that as. Costs nothing for the existing
    // input-based bindings either way.
    const matches = document.querySelectorAll(`input[id^="${idPrefix}"]:not([data-wc-enhanced]), select[id^="${idPrefix}"]:not([data-wc-enhanced])`);
    matches.forEach((el) => {
      everFoundOne = true;
      const bindingKey = el.id.slice(idPrefix.length);
      if (bindingKey.startsWith('__divider_') || bindingKey.startsWith('__info_')) {
        enhanceControllerDivider(el);
        return;
      }
      if (bindingKey === 'detectController') {
        enhanceDetectControllerButton(el);
        return;
      }
      if (bindingKey === 'presetSelector') {
        enhancePresetSelector(el);
        return;
      }
      if (bindingKey === 'presetName') {
        enhancePresetNameInput(el);
        return;
      }
      if (bindingKey === 'resetPreset') {
        enhanceResetButton(el);
        return;
      }
      if (bindingKey === 'controllerPrimary') {
        enhanceControllerCaptureInput(el, () => getControllerPrimaryButton(), (v) => setControllerPrimaryButton(v));
        return;
      }
      if (bindingKey === 'channelGuide') {
        enhanceControllerCaptureInput(el, () => getChannelGuideButton(), (v) => setChannelGuideButton(v));
        return;
      }
      if (CONTROLLER_ACTIONS_BY_KEY[bindingKey]) {
        enhanceControllerCaptureInput(el, () => getBoundButton(bindingKey), (v) => setBoundButton(bindingKey, v));
        return;
      }
      if (bindingKey.startsWith('shortcut_')) {
        const shortcutKey = bindingKey.slice('shortcut_'.length);
        if (HARDWARE_SHORTCUT_ACTIONS_BY_KEY[shortcutKey]) {
          enhanceControllerCaptureInput(el, () => getBoundShortcutButton(shortcutKey), (v) => setBoundShortcutButton(shortcutKey, v));
          return;
        }
      }
      if (bindingKey === 'debugTextEnabled') {
        observeDebugTextCheckbox(el);
        return;
      }
      if (bindingKey === 'highlightColor') {
        observeHighlightColorSelect(el);
        return;
      }
      // Anything unrecognized: leave Underscript's own rendering alone,
      // just mark it seen so the observer stops re-scanning it every
      // mutation. ("Enable Controller Support" itself no longer renders
      // under this idPrefix at all now - see registerControllerSettings()
      // below - it moved to packages/misc/settings.js's own category.)
      el.setAttribute('data-wc-enhanced', 'true');
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => {
    if (!everFoundOne) {
      console.warn('[Wizascript Controller] never found any "Keybinds - Controller" <input> elements to enhance after 15s - either the category never rendered, or the assumed id pattern (' + idPrefix + '<key>) is wrong.');
    }
  }, 15000);
}

// Registers the whole "Keybinds - Controller" category. Called once from
// index.js's initController(plugin, controllerEnabledSetting), directly
// (not deferred) - unlike the standalone prototype, `plugin` here is
// already guaranteed ready by bootstrap.js's contract by the time
// initController runs. `controllerEnabledSetting` is the SAME "Enable
// Controller Support" setting object packages/misc/settings.js registers
// under "Miscellaneous" now (manifest.js passes initMisc's return value
// through to initController) - this file no longer registers it itself.
export function registerControllerSettings(plugin, controllerEnabledSettingIn) {
  migrateFlatBindingsToPresetOne(
    CONTROLLER_ACTIONS.map((a) => a.key),
    HARDWARE_SHORTCUT_ACTIONS.map((a) => a.key)
  );

  // Stored regardless of enabled state (module-level, read every frame by
  // isControllerSupportEnabled()) - only whether the REST of this
  // category gets registered below depends on it.
  controllerEnabledSetting = controllerEnabledSettingIn;

  // Mirrors packages/uc-tv/settings.js's own "only register Filter
  // Settings while UC TV itself is enabled" pattern exactly: read the
  // master toggle once, right here at registration time, and skip
  // registering every remaining row in this category entirely while it's
  // off (default off) rather than showing an entire settings category
  // for a feature a new user hasn't turned on yet. Like UC TV's version,
  // this only skips *registering* - stored bindings/presets aren't
  // touched, so turning Controller Support back on and reloading brings
  // everything back exactly as it was left.
  if (!controllerEnabledSetting || typeof controllerEnabledSetting.value !== 'function' || !controllerEnabledSetting.value()) {
    console.log('[Wizascript Controller] Enable Controller Support is off - "Keybinds - Controller" category not registered this load. Turn it on under Miscellaneous, then reload, to configure it.');
    return;
  }

  const CATEGORY = 'Keybinds - Controller';
  const settings = createFeatureSettings(plugin, 'controller', CATEGORY);

  // "Detect Controller" - deliberately the very first row in the whole
  // category, above even the preset selector, since checking whether a
  // controller is actually recognized is the natural first thing to do
  // here, before touching any preset/keybind. See
  // enhanceDetectControllerButton() above.
  settings.add('detectController', {
    name: 'Detect Controller',
    note: 'Click if your controller isn\'t responding.',
    type: 'text',
    default: 'Click to Detect Controller (WebHID)'
  });

  // Preset selector/name, deliberately registered next so they render at
  // the very top of the actual keybind configuration.
  settings.add('presetSelector', {
    name: 'Settings Preset',
    note: 'Click to switch presets.',
    type: 'text',
    default: getPresetName(getActivePreset())
  });
  settings.add('presetName', {
    name: 'Preset Name',
    note: 'Renames whichever preset is currently selected above.',
    type: 'text',
    default: getPresetName(getActivePreset())
  });
  settings.add('resetPreset', {
    name: 'Restore Settings to Default',
    note: 'Double Click to reset selected preset settings',
    type: 'text',
    default: 'Double Click to Reset'
  });
  settings.add('__divider_top', { name: '— — —', type: 'text', default: '' });

  debugTextEnabledSetting = settings.add('debugTextEnabled', {
    name: 'Enable Debug Text',
    type: 'boolean',
    default: false
  });

  highlightColorSetting = settings.add('highlightColor', {
    name: 'Selection Outline Color',
    type: 'select',
    data: HIGHLIGHT_COLOR_PRESETS,
    default: DEFAULT_HIGHLIGHT_COLOR
  });

  settings.add('controllerPrimary', {
    name: 'Controller Primary',
    note: 'Click to remap. Hold for combos below, same as Wizascript\'s own Primary Key.',
    type: 'text',
    default: buttonToDisplay(DEFAULT_PRIMARY_BUTTON)
  });

  settings.add('__divider_General', { name: '— General —', type: 'text', default: '' });
  // Shortened from "Double Tap CONTROLLER Primary → ..." - dropping the
  // redundant word (this whole category is already controller-only)
  // both fixes the horizontal-scroll outlier AND matches the wording
  // packages/core/keybinds.js already uses for the equivalent KEYBOARD
  // shortcut ('Double Tap Primary → Open Wizascript Settings'), so the
  // two now read consistently if a player has both open at once.
  settings.add('__info_openSettings', { name: 'Double Tap Primary → Open Wizascript Settings', type: 'text', default: '' });

  const seenLabels = new Set();
  CONTROLLER_ACTIONS.forEach((action) => {
    if (!seenLabels.has(action.packageLabel)) {
      seenLabels.add(action.packageLabel);
      settings.add('__divider_' + action.packageLabel.replace(/\s+/g, '_'), {
        name: '— <b>' + action.packageLabel + '</b> —',
        type: 'text', default: ''
      });
      // "Channel Guide (hold)" moved here, at the very top of the UC TV
      // section, right under its own divider - it's a UC TV keybind
      // (separate from Controller Primary, see getChannelGuideButton()
      // above and the "Channel Guide" relay section in index.js) and
      // reads more naturally grouped with Previous/Next Channel than up
      // near Controller Primary. Unbound by default; the guide does
      // nothing at all until a button is bound here. Note field dropped -
      // self-explanatory next to the other UC TV rows.
      if (action.packageLabel === 'UC TV') {
        settings.add('channelGuide', {
          name: 'Channel Guide (hold)',
          type: 'text',
          default: buttonToDisplay(null)
        });
      }
    }
    // Suffix shortened from " - Primary + <button>" to " - Primary +
    // <btn>" - a follow-up trim after the round-2 name shortenings still
    // left a horizontal scrollbar (just a narrower one). This suffix is
    // shared across all 12 rows here, so trimming it once saves 3
    // characters on every single one - real keyboard keybinds
    // (packages/core/keybinds.js) already use the even terser "<key>",
    // which is part of why they were never as wide as these to begin
    // with.
    settings.add(action.key, {
      name: action.name + ' - Primary + <btn>',
      type: 'text',
      default: buttonToDisplay(action.defaultButton)
    });
  });

  // Renamed from "Hardware Shortcuts (no Primary needed)" - "In-Game
  // Inputs" says up front what actually distinguishes this section (it's
  // the stuff that matters DURING a match) instead of describing the
  // mechanism (no Primary hold), which needed its own separate info row
  // to explain and was still one of the widest rows in the category. That
  // info row is gone now that the section name itself carries the point.
  settings.add('__divider_HardwareShortcuts', { name: '— In-Game Inputs —', type: 'text', default: '' });
  HARDWARE_SHORTCUT_ACTIONS.forEach((action) => {
    settings.add('shortcut_' + action.key, {
      name: action.name,
      type: 'text',
      default: buttonToDisplay(HARDWARE_SHORTCUT_DEFAULTS[action.key])
    });
  });

  console.log('[Wizascript Controller] controller keybind settings registered under "Keybinds - Controller".');
  // Real DOM id shape, matching every other Wizascript settings input
  // (confirmed directly from packages/core/keybinds.js's own ID_PREFIX):
  // underscript.plugin.Wizascript.<featureName>.<key> - "Wizascript" is
  // the real suite's own registered plugin name (see
  // packages/core/bootstrap.js's SUITE_NAME), not something derived from
  // the `plugin` object at runtime. createFeatureSettings prefixes every
  // key with "controller.", matching the featureName passed above.
  startControllerKeybindObserver('underscript.plugin.Wizascript.controller.');
}
