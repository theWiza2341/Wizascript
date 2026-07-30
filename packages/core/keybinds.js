// packages/core/keybinds.js
//
// Shared keybind registry used by every package that wants a
// user-remappable shortcut, instead of each one hardcoding its own
// keydown listener. One shared "Primary Key" setting (site-wide),
// plus one settings entry per registered binding, all under a single
// "Keybinds" category. A single shared document-level listener pair
// does all the dispatching, so N packages calling registerKeybind()
// don't each attach their own competing handlers.
//
// Two binding shapes:
//   - global: fires regardless of what's focused (channel switching,
//     Notepad reset/open/close, etc).
//   - scoped: only fires while document.activeElement matches a given
//     selector (Patch Maker's entry/section/card-tile shortcuts,
//     which mean different things depending on what's focused).
//
// Primary can be freely remapped through the same capture widget
// Galascript's own keybind setting type uses (click, press a key,
// done). While a binding is still at its shipped default AND that
// default is a native modifier (Control/Shift/Alt), matching uses
// e.key rather than e.code - side-independent, so remapping this
// system in doesn't suddenly break someone who happens to use their
// right Ctrl key. The moment a binding is actually customized through
// the widget, matching switches to the exact e.code it captured,
// same as Galascript's real behavior for a genuinely custom bind.

import { createFeatureSettings } from './settings.js';

const CATEGORY = 'Keybinds';
const HOLD_DELAY_MS = 250;
const NATIVE_MODIFIERS = new Set(['Control', 'Shift', 'Alt']);
const DEFAULT_PRIMARY_CODE = 'Control';
const DEFAULT_PRIMARY_DISPLAY = 'Ctrl';

let settings = null;
let primaryKeySetting = null;
let keybindType = null;
let typeRegistered = false;
const registry = []; // { key, setting, defaultCode, scope, selector, onMatch, onPrimaryAlone, onPrimaryPress, onPrimaryRelease }

let primaryHeld = false;
let holdTimer = null;
let comboFired = false; // true once a secondary key has matched during this hold, so onPrimaryAlone doesn't ALSO fire

function isTypingContext() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

// A custom settings-panel widget, adapted from Galascript's own
// keybindSetting (a real, working UnderScript SettingType): click to
// focus, next keydown/mousedown captures that key/button, Escape
// unbinds, blurring without capturing reverts the display.
function ensureKeybindType() {
  if (keybindType) return keybindType;
  const $ = window.$;
  const underscript = window.underscript;

  class WizascriptKeybindType extends underscript.utils.SettingType {
    constructor() {
      super('wizascriptKeybind');
    }
    value(val) {
      if (typeof val !== 'string') return val;
      return JSON.parse(val);
    }
    default() {
      return ['unbound', 'unbound'];
    }
    element(value, update) {
      return $('<input type="button" class="wizascript-keybind">')
        .val(value[1])
        .on('focus', function () {
          const $kbd = $(this);
          let captured = false;
          $kbd.addClass('listening');
          $kbd.val('...?');
          const capture = (e) => {
            e.preventDefault();
            const original = e.originalEvent || e;
            let display, code;
            if ('button' in original) {
              code = original.button;
              switch (original.button) {
                case 0: display = 'Left Click'; break;
                case 1: display = 'Middle Click'; break;
                case 2: display = 'Right Click'; break;
                default: display = `Mouse Button ${original.button}`;
              }
            } else if (original.key === 'Escape') {
              display = 'unbound';
              code = 'unbound';
            } else {
              display = original.key.length === 1 ? original.key.toUpperCase() : original.key;
              if (display === ' ') display = 'Space';
              code = original.code;
            }
            $kbd.val(display);
            update([code, display]);
            $(document).off('keydown', capture);
            $(document).off('mousedown', capture);
            captured = true;
            $kbd.blur();
          };
          $(document).on('keydown', capture);
          $(document).on('mousedown', capture);
          $kbd.on('blur', function () {
            $kbd.removeClass('listening');
            if (captured) return;
            $(document).off('keydown', capture);
            $(document).off('mousedown', capture);
            $kbd.val(value[1]);
          });
        });
    }
    styles() {
      return [
        '.wizascript-keybind { font-size: 11px; height: 18px; background-color: black; color: white; border-radius: 3px; border: 1px solid #b4b4b4; }',
        '.wizascript-keybind.listening { border: 1px solid #40E0D0; box-shadow: 0 0 4px #40E0D0; }'
      ];
    }
  }

  keybindType = new WizascriptKeybindType();
  return keybindType;
}

function matchesCode(e, code, defaultCode) {
  if (code === defaultCode && NATIVE_MODIFIERS.has(defaultCode)) {
    return e.key === defaultCode;
  }
  return e.code === code;
}

function getPrimaryCode() {
  if (!primaryKeySetting) return DEFAULT_PRIMARY_CODE;
  const [code] = primaryKeySetting.value();
  return code;
}

function getPrimaryDisplay() {
  if (!primaryKeySetting) return DEFAULT_PRIMARY_DISPLAY;
  const [, display] = primaryKeySetting.value();
  return display;
}

function matchesSetting(e, binding) {
  const [code] = binding.setting.value();
  return matchesCode(e, code, binding.defaultCode);
}

function bindGlobalListeners() {
  document.addEventListener('keydown', (e) => {
    const primaryCode = getPrimaryCode();
    const isPrimary = matchesCode(e, primaryCode, DEFAULT_PRIMARY_CODE);

    if (isPrimary) {
      if (primaryHeld) return; // ignore OS key-repeat
      primaryHeld = true;
      comboFired = false;

      // Fires immediately and unconditionally, not gated behind
      // confirming a hold first - this is what makes "tap to cancel"
      // work for things like the auto-continue countdown.
      registry.forEach((b) => { if (b.onPrimaryPress) b.onPrimaryPress(e); });

      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        if (comboFired) return; // a secondary key already matched during this hold
        if (isTypingContext()) return; // only the alone-case needs this guard - a full combo is deliberate enough not to
        registry.forEach((b) => {
          if (b.scope === 'global' && b.onPrimaryAlone) b.onPrimaryAlone(e);
        });
      }, HOLD_DELAY_MS);
      return;
    }

    if (!primaryHeld) return; // secondary keys only matter while Primary is down
    clearTimeout(holdTimer); // any second key cancels the hold-alone disambiguation, combo or not

    // First match wins - mirrors Galascript's own documented
    // conflict-resolution rule ("if bound to multiple actions, the
    // highest setting takes priority") rather than firing every
    // binding that happens to share the same key.
    for (const b of registry) {
      if (!matchesSetting(e, b)) continue;
      if (b.scope === 'scoped') {
        const active = document.activeElement;
        if (!active || !active.matches(b.selector)) continue;
      }
      comboFired = true;
      e.preventDefault();
      b.onMatch(e);
      break;
    }
  });

  document.addEventListener('keyup', (e) => {
    const primaryCode = getPrimaryCode();
    if (matchesCode(e, primaryCode, DEFAULT_PRIMARY_CODE)) {
      primaryHeld = false;
      clearTimeout(holdTimer);
      registry.forEach((b) => { if (b.scope === 'global' && b.onPrimaryRelease) b.onPrimaryRelease(e); });
    }
  });
}

function ensureCore(plugin) {
  if (settings) return;
  settings = createFeatureSettings(plugin, 'keybinds', CATEGORY);

  const type = ensureKeybindType();
  if (!typeRegistered) {
    plugin.settings().addType(type);
    typeRegistered = true;
  }

  primaryKeySetting = settings.add('primaryKey', {
    name: 'Primary Key',
    note: 'Held down to activate "Primary + <key>" bindings below. Tap alone for actions that trigger on a simple press.',
    type,
    default: JSON.stringify([DEFAULT_PRIMARY_CODE, DEFAULT_PRIMARY_DISPLAY])
  });

  bindGlobalListeners();
}

// The only thing a consuming package needs to call.
//
// config:
//   key            - unique per-binding string, e.g. 'nextChannel'
//   name           - label WITHOUT the "Primary + " suffix, added automatically
//   defaultCode    - shipped default e.code, e.g. 'ArrowRight'
//   defaultDisplay - shipped default display text, e.g. 'Right Arrow'
//   scope          - 'global' (default) | 'scoped'
//   selector       - required if scope is 'scoped'
//   onMatch        - (e) => void, fires when Primary+secondary matches
//   onPrimaryAlone   - (e) => void, global-only: Primary held alone past the hold delay
//   onPrimaryPress   - (e) => void, global-only: fires immediately on Primary keydown
//   onPrimaryRelease - (e) => void, global-only: fires on Primary keyup
export function registerKeybind(plugin, config) {
  const {
    key, name, defaultCode, defaultDisplay,
    scope = 'global', selector,
    onMatch, onPrimaryAlone, onPrimaryPress, onPrimaryRelease
  } = config;

  ensureCore(plugin);

  const setting = settings.add(key, {
    name: `${name} - Primary + <key>`,
    type: keybindType,
    default: JSON.stringify([defaultCode, defaultDisplay])
  });

  registry.push({ key, setting, defaultCode, scope, selector, onMatch, onPrimaryAlone, onPrimaryPress, onPrimaryRelease });
}

// For UI that wants to display the current Primary key, e.g. a toast
// saying "Cancel by holding Ctrl" - should read this live rather than
// hardcode "Ctrl", since Primary can be remapped.
export function getPrimaryKeyDisplay() {
  return getPrimaryDisplay();
}
