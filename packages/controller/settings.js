// packages/controller/settings.js
//
// Registers the "Keybinds - Controller" settings category and everything
// needed to remap a gamepad button to a Wizascript action: the preset
// selector/name widgets, the master "Enable Controller Support" toggle,
// and one capture ("Press a button...") widget per remappable binding.
// Mirrors packages/core/keybinds.js's own MutationObserver + click-to-
// capture pattern, but captures a GAMEPAD BUTTON instead of a keyboard
// key, so it can't reuse that registry directly - these are a genuinely
// different kind of input to capture and persist.

import { createFeatureSettings } from '../core/settings.js';
import {
  PRESET_COUNT, getActivePreset, setActivePreset, getPresetName, setPresetName,
  presetKey, migrateFlatBindingsToPresetOne, csGet, csSet
} from './storage.js';
import { getMergedGamepad, buttonToDisplay } from './gamepad.js';

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
  { key: 'moveSectionUp', name: 'Move Balance Section Up', packageLabel: 'Patch Maker', context: 'patchMaker', defaultButton: 12, dispatch: { code: 'ArrowUp', key: 'ArrowUp' } },
  { key: 'moveSectionDown', name: 'Move Balance Section Down', packageLabel: 'Patch Maker', context: 'patchMaker', defaultButton: 13, dispatch: { code: 'ArrowDown', key: 'ArrowDown' } },
  { key: 'moveCardUp', name: 'Move Card Up', packageLabel: 'Patch Maker', context: 'patchMaker', defaultButton: 12, dispatch: { code: 'ArrowUp', key: 'ArrowUp' } },
  { key: 'moveCardDown', name: 'Move Card Down', packageLabel: 'Patch Maker', context: 'patchMaker', defaultButton: 13, dispatch: { code: 'ArrowDown', key: 'ArrowDown' } }
];
export const CONTROLLER_ACTIONS_BY_KEY = {};
CONTROLLER_ACTIONS.forEach((a) => { CONTROLLER_ACTIONS_BY_KEY[a.key] = a; });

// Single-button, direct DOM hardware shortcuts (End Turn, Concede,
// dustpiles, Settings, Open Wizascript Settings, Go Home) - no Primary
// hold needed. Deliberately NOT included: R1's Underscript-menu-toggle,
// because it doubles as the OSK-pause toggle using the exact same
// physical button unconditionally.
export const HARDWARE_SHORTCUT_ACTIONS = [
  { key: 'openSettings', name: 'Open Settings' },
  { key: 'yourDustpile', name: 'Check Your Dustpile' },
  { key: 'opponentDustpile', name: "Check Opponent's Dustpile" },
  { key: 'endTurn', name: 'End Turn' },
  { key: 'openWizascriptSettings', name: 'Open Wizascript Settings' },
  { key: 'concede', name: 'Concede' },
  { key: 'goHome', name: 'Go to Home Page' }
];
export const HARDWARE_SHORTCUT_DEFAULTS = {
  openSettings: 9, yourDustpile: 10, opponentDustpile: 11, endTurn: 17,
  openWizascriptSettings: 7, concede: 8, goHome: 16
};
export const HARDWARE_SHORTCUT_ACTIONS_BY_KEY = {};
HARDWARE_SHORTCUT_ACTIONS.forEach((a) => { HARDWARE_SHORTCUT_ACTIONS_BY_KEY[a.key] = a; });

export const DEFAULT_PRIMARY_BUTTON = 4; // L1

export function getControllerPrimaryButton() {
  const raw = csGet(presetKey('keybinds.__primary'), String(DEFAULT_PRIMARY_BUTTON));
  if (raw === 'unbound') return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? DEFAULT_PRIMARY_BUTTON : n;
}
export function setControllerPrimaryButton(idxOrNull) {
  csSet(presetKey('keybinds.__primary'), idxOrNull === null ? 'unbound' : String(idxOrNull));
}
export function getBoundButton(actionKey) {
  const action = CONTROLLER_ACTIONS_BY_KEY[actionKey];
  const raw = csGet(presetKey('keybinds.' + actionKey), String(action.defaultButton));
  if (raw === 'unbound') return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? action.defaultButton : n;
}
export function setBoundButton(actionKey, idxOrNull) {
  csSet(presetKey('keybinds.' + actionKey), idxOrNull === null ? 'unbound' : String(idxOrNull));
}
export function getBoundShortcutButton(actionKey) {
  const defaultButton = HARDWARE_SHORTCUT_DEFAULTS[actionKey];
  const raw = csGet(presetKey('shortcuts.' + actionKey), String(defaultButton));
  if (raw === 'unbound') return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? defaultButton : n;
}
export function setBoundShortcutButton(actionKey, idxOrNull) {
  csSet(presetKey('shortcuts.' + actionKey), idxOrNull === null ? 'unbound' : String(idxOrNull));
}

// Master toggle. Fails OPEN (treated as enabled) if settings registration
// itself never completes, rather than silently bricking every feature
// with no way to turn it back on.
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
    color: '#8ab4f8', fontWeight: 'bold', cursor: 'default', pointerEvents: 'none'
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
    el.value = buttonToDisplay(readBound());
  }
  refreshDisplay();
  boundInputRefreshers.push(refreshDisplay);

  el.addEventListener('focus', () => {
    el.style.border = '1px solid #40E0D0';
    el.style.boxShadow = '0 0 4px #40E0D0';
    el.value = 'Press a button...';
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
    function finishCapture(idx) {
      if (cancelled) return;
      cancelled = true;
      writeBound(idx);
      el.blur();
    }
    function onEscape(e) {
      if (e.key === 'Escape') {
        cancelled = true;
        writeBound(null);
        document.removeEventListener('keydown', onEscape, true);
        el.blur();
      }
    }
    document.addEventListener('keydown', onEscape, true);
    requestAnimationFrame(captureFrame);

    el.addEventListener('blur', function onBlur() {
      cancelled = true;
      controllerCaptureActive = false;
      el.style.border = '1px solid #b4b4b4';
      el.style.boxShadow = 'none';
      document.removeEventListener('keydown', onEscape, true);
      refreshDisplay();
      el.removeEventListener('blur', onBlur);
    });
  });
}

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
    }
    document.body.appendChild(menuEl);
    document.addEventListener('mousedown', onOutsideClick, true);
    document.addEventListener('keydown', onEscape, true);
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

let controllerObserverStarted = false;
function startControllerKeybindObserver(idPrefix) {
  if (controllerObserverStarted) return;
  controllerObserverStarted = true;
  let everFoundOne = false;
  const observer = new MutationObserver(() => {
    const matches = document.querySelectorAll(`input[id^="${idPrefix}"]:not([data-wc-enhanced])`);
    matches.forEach((el) => {
      everFoundOne = true;
      const bindingKey = el.id.slice(idPrefix.length);
      if (bindingKey.startsWith('__divider_') || bindingKey.startsWith('__info_')) {
        enhanceControllerDivider(el);
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
      if (bindingKey === 'controllerPrimary') {
        enhanceControllerCaptureInput(el, () => getControllerPrimaryButton(), (v) => setControllerPrimaryButton(v));
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
      // 'enabled' (the boolean toggle) and anything else unrecognized:
      // leave Underscript's own rendering alone, just mark it seen so the
      // observer stops re-scanning it every mutation.
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
// index.js's initController(plugin), directly (not deferred) - unlike the
// standalone prototype, `plugin` here is already guaranteed ready by
// bootstrap.js's contract by the time initController runs.
export function registerControllerSettings(plugin) {
  migrateFlatBindingsToPresetOne(
    CONTROLLER_ACTIONS.map((a) => a.key),
    HARDWARE_SHORTCUT_ACTIONS.map((a) => a.key)
  );

  const CATEGORY = 'Keybinds - Controller';
  const settings = createFeatureSettings(plugin, 'controller', CATEGORY);

  // Preset selector/name, deliberately registered FIRST so they render at
  // the very top of the category, above even "Enable Controller Support".
  settings.add('presetSelector', {
    name: 'Settings Preset',
    note: 'Click to switch presets — each one remembers its own bindings independently.',
    type: 'text',
    default: getPresetName(getActivePreset())
  });
  settings.add('presetName', {
    name: 'Preset Name',
    note: 'Renames whichever preset is currently selected above.',
    type: 'text',
    default: getPresetName(getActivePreset())
  });
  settings.add('__divider_top', { name: '— — —', type: 'text', default: '' });

  controllerEnabledSetting = settings.add('enabled', {
    name: 'Enable Controller Support',
    note: 'Off by default to save CPU. Turn on before configuring anything below.',
    type: 'boolean',
    default: false
  });

  settings.add('controllerPrimary', {
    name: 'Controller Primary',
    note: 'Click to remap. Hold for combos below, same as Wizascript\'s own Primary Key.',
    type: 'text',
    default: buttonToDisplay(DEFAULT_PRIMARY_BUTTON)
  });

  settings.add('__divider_General', { name: '— General —', type: 'text', default: '' });
  settings.add('__info_openSettings', { name: 'Double Tap Controller Primary → Open Wizascript Settings', type: 'text', default: '' });

  const seenLabels = new Set();
  CONTROLLER_ACTIONS.forEach((action) => {
    if (!seenLabels.has(action.packageLabel)) {
      seenLabels.add(action.packageLabel);
      settings.add('__divider_' + action.packageLabel.replace(/\s+/g, '_'), {
        name: '— <b>' + action.packageLabel + '</b> —',
        type: 'text', default: ''
      });
    }
    settings.add(action.key, {
      name: action.name + ' - Primary + <button>',
      type: 'text',
      default: buttonToDisplay(action.defaultButton)
    });
  });

  settings.add('__divider_HardwareShortcuts', { name: '— Hardware Shortcuts (no Primary needed) —', type: 'text', default: '' });
  settings.add('__info_hardwareShortcuts', { name: 'These fire on a single button press, no Controller Primary hold required.', type: 'text', default: '' });
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
