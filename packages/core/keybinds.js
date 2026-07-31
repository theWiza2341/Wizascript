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
// STORAGE: real persistence is via GM_getValue/GM_setValue directly -
// the same mechanism Notepad's own storage layer already uses. Each
// binding also registers a plain, ordinary `type: 'text'` UnderScript
// setting, but purely to get a real <input> rendered in the right
// settings tab/category with a predictable ID
// (underscript.plugin.Wizascript.keybinds.<key>, confirmed via direct
// inspection) - we don't depend on UnderScript's own read/write of
// that input actually persisting correctly. A MutationObserver finds
// that input once it renders and turns it into a click-to-capture
// widget (readonly, styled, listens for the next keypress) - the same
// technique Galascript's own leGrandeObserver uses to attach custom
// behavior to specific setting IDs once they appear in the DOM.
//
// Primary can be freely remapped through that capture widget. While a
// binding is still at its shipped default AND that default is a
// native modifier (Control/Shift/Alt), matching uses e.key rather
// than e.code - side-independent, so shipping this doesn't suddenly
// break someone who happens to use their right Ctrl key. The moment a
// binding is actually customized, matching switches to the exact
// e.code captured.

import { createFeatureSettings } from './settings.js';

const CATEGORY = 'Keybinds';
const HOLD_DELAY_MS = 250;
const NATIVE_MODIFIERS = new Set(['Control', 'Shift', 'Alt']);
const DEFAULT_PRIMARY_CODE = 'Control';
const PRIMARY_KEY = 'primaryKey';

const GM_PREFIX = 'wizascript.keybinds.';
const ID_PREFIX = 'underscript.plugin.Wizascript.keybinds.';

function storageKey(bindingKey) {
  return `${GM_PREFIX}${bindingKey}`;
}

function readCode(bindingKey, defaultCode) {
  return GM_getValue(storageKey(bindingKey), defaultCode);
}

function writeCode(bindingKey, code) {
  GM_setValue(storageKey(bindingKey), code);
}

// No separate stored display string - just the raw code, with a
// small formatter to make it readable. One less thing that could
// drift out of sync with the underlying value.
const DISPLAY_OVERRIDES = {
  Control: 'Ctrl', Shift: 'Shift', Alt: 'Alt', Meta: 'Meta',
  ArrowUp: 'Up Arrow', ArrowDown: 'Down Arrow', ArrowLeft: 'Left Arrow', ArrowRight: 'Right Arrow',
  Space: 'Space', Escape: 'Esc', Comma: ',', Period: '.', unbound: 'Unbound'
};
function codeToDisplay(code) {
  if (!code) return 'Unbound';
  if (DISPLAY_OVERRIDES[code]) return DISPLAY_OVERRIDES[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  return code;
}

let settings = null;
const registry = []; // { key, defaultCode, scope, selector, onMatch, onPrimaryAlone, onPrimaryPress, onPrimaryRelease }
const bindingDefaults = new Map(); // key -> defaultCode, for the observer to match against
let observerStarted = false;

function isTypingContext() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

// Turns one plain UnderScript text-setting <input> into a click-to-
// capture widget. Readonly (not directly typable), styled to look
// like a button, focus starts listening for the next keydown.
function enhanceInput(el, bindingKey, defaultCode) {
  el.setAttribute('data-wizascript-keybind-enhanced', 'true');
  el.readOnly = true;
  Object.assign(el.style, {
    cursor: 'pointer',
    backgroundColor: 'black',
    color: 'white',
    border: '1px solid #b4b4b4',
    borderRadius: '3px',
    textAlign: 'center'
  });

  function refreshDisplay() {
    el.value = codeToDisplay(readCode(bindingKey, defaultCode));
  }
  refreshDisplay();

  el.addEventListener('focus', () => {
    el.style.border = '1px solid #40E0D0';
    el.style.boxShadow = '0 0 4px #40E0D0';
    el.value = '...?';

    function capture(e) {
      e.preventDefault();
      const code = e.key === 'Escape' ? 'unbound' : e.code;
      writeCode(bindingKey, code);
      document.removeEventListener('keydown', capture, true);
      el.blur();
    }
    document.addEventListener('keydown', capture, true);

    el.addEventListener('blur', function onBlur() {
      el.style.border = '1px solid #b4b4b4';
      el.style.boxShadow = 'none';
      document.removeEventListener('keydown', capture, true);
      refreshDisplay();
      el.removeEventListener('blur', onBlur);
    });
  });
}

function startObserver() {
  if (observerStarted) return;
  observerStarted = true;
  const observer = new MutationObserver(() => {
    if (!bindingDefaults.size) return; // cheap bail once there's nothing left to look for
    document.querySelectorAll(`input[id^="${ID_PREFIX}"]:not([data-wizascript-keybind-enhanced])`).forEach((el) => {
      const bindingKey = el.id.slice(ID_PREFIX.length);
      if (!bindingDefaults.has(bindingKey)) return;
      enhanceInput(el, bindingKey, bindingDefaults.get(bindingKey));
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function matchesCode(e, code, defaultCode) {
  if (code === defaultCode && NATIVE_MODIFIERS.has(defaultCode)) {
    return e.key === defaultCode;
  }
  return e.code === code;
}

function getPrimaryCode() {
  return readCode(PRIMARY_KEY, DEFAULT_PRIMARY_CODE);
}

function matchesSetting(e, binding) {
  const code = readCode(binding.key, binding.defaultCode);
  return matchesCode(e, code, binding.defaultCode);
}

let primaryHeld = false;
let holdTimer = null;
let comboFired = false; // true once a secondary key has matched during this hold, so onPrimaryAlone doesn't ALSO fire

function bindGlobalListeners() {
  document.addEventListener('keydown', (e) => {
    const primaryCode = getPrimaryCode();
    const isPrimary = matchesCode(e, primaryCode, DEFAULT_PRIMARY_CODE);

    if (isPrimary) {
      if (primaryHeld) return; // ignore OS key-repeat
      primaryHeld = true;
      comboFired = false;

      registry.forEach((b) => { if (b.onPrimaryPress) b.onPrimaryPress(e); });

      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        if (comboFired) return;
        if (isTypingContext()) return;
        registry.forEach((b) => {
          if (b.scope === 'global' && b.onPrimaryAlone) b.onPrimaryAlone(e);
        });
      }, HOLD_DELAY_MS);
      return;
    }

    if (!primaryHeld) return;
    clearTimeout(holdTimer);

    // First match wins - mirrors Galascript's own documented
    // conflict-resolution rule ("if bound to multiple actions, the
    // highest setting takes priority") rather than firing every
    // binding that happens to share the same key.
    for (const b of registry) {
      if (!b.onMatch) continue; // press/alone/release-only binding - nothing to match here
      if (!matchesSetting(e, b)) continue;
      if (b.guardTypingContext && isTypingContext()) continue;
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

  startObserver();
  bindGlobalListeners();

  settings.add(PRIMARY_KEY, {
    name: 'Primary Key',
    note: 'Click to remap. Hold for combos below, or tap alone.',
    type: 'text',
    default: DEFAULT_PRIMARY_CODE
  });
  bindingDefaults.set(PRIMARY_KEY, DEFAULT_PRIMARY_CODE);
}

// The only thing a consuming package needs to call.
//
// config:
//   key            - unique per-binding string, e.g. 'nextChannel'
//   name           - label WITHOUT the "Primary + " suffix, added automatically
//   defaultCode    - shipped default e.code, e.g. 'ArrowRight'
//   scope          - 'global' (default) | 'scoped'
//   selector       - required if scope is 'scoped'
//   onMatch        - (e) => void, fires when Primary+secondary matches
//   onPrimaryAlone   - (e) => void, global-only: Primary held alone past the hold delay
//   onPrimaryPress   - (e) => void, global-only: fires immediately on Primary keydown
//   onPrimaryRelease - (e) => void, global-only: fires on Primary keyup
export function registerKeybind(plugin, config) {
  const {
    key, name, defaultCode,
    scope = 'global', selector,
    guardTypingContext = false,
    packageLabel,
    onMatch, onPrimaryAlone, onPrimaryPress, onPrimaryRelease
  } = config;

  ensureCore(plugin);

  // Only register a secondary-key setting if there's actually a combo
  // to bind it to - a pure "tap/hold Primary alone" binding (like the
  // channel guide) has nothing meaningful to put in a "Primary + <key>"
  // field, and showing one anyway would be actively misleading.
  if (onMatch) {
    // packageLabel prefixes the display name (e.g. "[UC TV] Next
    // Channel") so a single flat Keybinds list stays scannable as
    // more packages add their own bindings - every package is
    // expected to pass this now, but it's optional so a caller that
    // somehow doesn't know its own name yet doesn't hard-fail.
    const label = packageLabel ? `[${packageLabel}] ${name}` : name;
    settings.add(key, {
      name: `${label} - Primary + <key>`,
      type: 'text',
      default: defaultCode
    });
    bindingDefaults.set(key, defaultCode);
  }

  registry.push({ key, defaultCode, scope, selector, guardTypingContext, onMatch, onPrimaryAlone, onPrimaryPress, onPrimaryRelease });
}

// For UI that wants to display the current Primary key, e.g. a toast
// saying "Cancel by holding Ctrl" - should read this live rather than
// hardcode "Ctrl", since Primary can be remapped.
export function getPrimaryKeyDisplay() {
  return codeToDisplay(getPrimaryCode());
}

// For carve-outs elsewhere that stop most keys from propagating while
// something is focused (e.g. Patch Maker's own input-blocker, which
// otherwise swallows nearly everything while editing an overlay
// field) - lets that code defer to whatever's actually registered
// right now, including user remaps, instead of hardcoding specific
// key checks that would silently go stale the moment a binding gets
// remapped away from its shipped default.
export function isRegisteredKeybindEvent(e) {
  const primaryCode = getPrimaryCode();
  if (matchesCode(e, primaryCode, DEFAULT_PRIMARY_CODE)) return true;
  if (!primaryHeld) return false;
  return registry.some((b) => b.onMatch && matchesSetting(e, b));
}
