// packages/core/keybinds.js
//
// 1.5.0: keybinds live on their own "Keybinds" settings tab, grouped
// into categories: "General" (Primary Key, double-tap) and one per
// plugin (its packageLabel -> core/plugins.js). A plugin's category is
// hidden, and its bindings don't fire, unless that plugin is enabled in
// the Plugins list. General only shows while at least one keybind-using
// plugin is enabled, so the whole tab disappears when none are.
//
// Shared keybind registry used by every package that wants a
// user-remappable shortcut, instead of each one hardcoding its own
// keydown listener. One shared "Primary Key" setting (site-wide),
// plus one settings entry per registered binding, all under a single
// "Keybinds" tab. A single shared document-level listener pair
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
import { anyKeybindPluginEnabled, isPluginEnabled, pluginIdForLabel } from './plugins.js';

const TAB = 'Keybinds';
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

// Public accessor so another package's OWN relay (currently: the
// controller package's CONTROLLER_ACTIONS - see its relaySecondary()
// call site) can dispatch whatever e.code a real keybind is CURRENTLY
// actually bound to, instead of assuming its shipped default is still
// what's stored. Read-only, same value readCode() itself would use -
// this is deliberately the one crack in the "don't reach into another
// package's storage" rule (see the controller relay's own comment on
// why it does NOT do this for the Primary Key itself), justified here
// because the alternative is confirmed broken: a real keybind that's
// ever been remapped away from its default (including by an OLDER
// shipped default than the one currently in this file, since a GM-
// stored value persists across updates) makes a controller action
// relaying the hardcoded default silently never match anything, with
// no error and no visible symptom beyond "it just doesn't work."
export function getBoundKeybindCode(bindingKey, defaultCode) {
  return readCode(bindingKey, defaultCode);
}

function writeCode(bindingKey, code) {
  GM_setValue(storageKey(bindingKey), code);
}

// No separate stored display string - just the raw code, with a
// small formatter to make it readable. One less thing that could
// drift out of sync with the underlying value.
const DISPLAY_OVERRIDES = {
  Control: 'Ctrl', Shift: 'Shift', Alt: 'Alt', Meta: 'Meta',
  ControlLeft: 'Left Ctrl', ControlRight: 'Right Ctrl', ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift',
  AltLeft: 'Left Alt', AltRight: 'Right Alt', MetaLeft: 'Left Meta', MetaRight: 'Right Meta',
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
const infoKeys = new Set(); // keys rendered as a plain text row (no input), not a capture widget
const GENERAL_CATEGORY = 'General';
let observerStarted = false;

// A binding with no pluginId (the double-tap-to-open-settings one) is
// handled separately; everything else follows its plugin's toggle.
function isBindingActive(b) {
  return !b.pluginId || isPluginEnabled(b.pluginId);
}

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
      scheduleConflictRefresh();
      el.removeEventListener('blur', onBlur);
    });
  });
}

// An informational row: just its label, with the placeholder input
// UnderScript renders for it hidden.
function enhanceInfoRow(el) {
  el.setAttribute('data-wizascript-keybind-enhanced', 'true');
  el.readOnly = true;
  el.tabIndex = -1;
  el.style.display = 'none';
}

function startObserver() {
  if (observerStarted) return;
  observerStarted = true;
  const observer = new MutationObserver(() => {
    if (!bindingDefaults.size && !infoKeys.size) return; // cheap bail once there's nothing left to look for
    document.querySelectorAll(`input[id^="${ID_PREFIX}"]:not([data-wizascript-keybind-enhanced])`).forEach((el) => {
      const bindingKey = el.id.slice(ID_PREFIX.length);
      if (infoKeys.has(bindingKey)) {
        enhanceInfoRow(el);
        return;
      }
      if (!bindingDefaults.has(bindingKey)) return;
      enhanceInput(el, bindingKey, bindingDefaults.get(bindingKey));
      scheduleConflictRefresh();
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

const DOUBLE_TAP_WINDOW_MS = 400;
let tapCount = 0;
let lastTapTime = 0;

function bindGlobalListeners() {
  document.addEventListener('keydown', (e) => {
    const primaryCode = getPrimaryCode();
    const isPrimary = matchesCode(e, primaryCode, DEFAULT_PRIMARY_CODE);

    if (isPrimary) {
      if (primaryHeld) return; // ignore OS key-repeat
      primaryHeld = true;
      comboFired = false;

      // Double-tap detection - measured press-to-press (matching
      // double-click conventions), not tied to release timing at all,
      // since a "tap" here just means "Primary went down again soon
      // after it last went down." Resets after firing so a 3rd rapid
      // tap starts a fresh pair rather than re-triggering immediately.
      const now = Date.now();
      tapCount = (now - lastTapTime <= DOUBLE_TAP_WINDOW_MS) ? tapCount + 1 : 1;
      lastTapTime = now;
      if (tapCount === 2) {
        tapCount = 0;
        registry.forEach((b) => {
          if (b.scope !== 'global' || !b.onPrimaryDoubleTap) return;
          if (!isBindingActive(b)) return;
          if (b.guardTypingContext && isTypingContext()) return;
          b.onPrimaryDoubleTap(e);
        });
      }

      registry.forEach((b) => {
        if (!b.onPrimaryPress) return;
        if (!isBindingActive(b)) return;
        if (b.guardTypingContext && isTypingContext()) return;
        b.onPrimaryPress(e);
      });

      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        if (comboFired) return;
        registry.forEach((b) => {
          if (b.scope !== 'global' || !b.onPrimaryAlone) return;
          if (!isBindingActive(b)) return;
          if (b.guardTypingContext && isTypingContext()) return;
          b.onPrimaryAlone(e);
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
      if (!isBindingActive(b)) continue;
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
      registry.forEach((b) => {
        if (b.scope !== 'global' || !b.onPrimaryRelease) return;
        if (!isBindingActive(b)) return;
        if (b.guardTypingContext && isTypingContext()) return;
        b.onPrimaryRelease(e);
      });
    }
  });
}

let primaryKeySetting = null; // captured for .show() - see the General/open-settings binding below

// Primary Key + "General" rows only make sense while something uses
// them. Controller Support counts for the double-tap row too, since its
// own "Open Wizascript Settings" shortcut is separate but equivalent.
const generalHidden = () => !anyKeybindPluginEnabled();

// Exported so manifest.js can create the Keybinds tab at a chosen point
// in the tab order (before Controller Support's tab), even though the
// individual bindings are only flushed at the very end.
export function initKeybinds(plugin) {
  ensureCore(plugin);
}

function ensureCore(plugin) {
  if (settings) return;
  // 1.5.0: real categories - "General" plus one per plugin (named after
  // its packageLabel). A disabled plugin's rows are hidden, and its then-
  // empty category is hidden too (setting-widgets.js).
  settings = createFeatureSettings(plugin, 'keybinds', { tab: TAB, categories: true });

  startObserver();
  bindGlobalListeners();

  primaryKeySetting = settings.add(PRIMARY_KEY, {
    name: 'Primary Key',
    note: 'Click to remap. Hold for combos below, or tap alone.',
    type: 'text',
    default: DEFAULT_PRIMARY_CODE,
    category: GENERAL_CATEGORY,
    hidden: generalHidden
  });
  bindingDefaults.set(PRIMARY_KEY, DEFAULT_PRIMARY_CODE);

  // Double Tap Primary has no key of its own to remap, so it's a plain
  // informational row under General (its input is hidden - see
  // enhanceInfoRow()).
  const openSettingsInfoKey = '__info_openSettings';
  settings.add(openSettingsInfoKey, {
    name: 'Double Tap Primary \u2192 Open Wizascript Settings',
    type: 'text',
    default: '',
    category: GENERAL_CATEGORY,
    hidden: generalHidden
  });
  infoKeys.add(openSettingsInfoKey);

  registry.push({
    key: 'openWizascriptSettings',
    scope: 'global',
    guardTypingContext: true,
    // Opens the main Wizascript tab (the Plugins list), rather than
    // Primary Key's own row. Active while any keybind plugin is on, or
    // while Controller Support is on (its controller Primary relays a
    // real Primary double-tap).
    onPrimaryDoubleTap: () => {
      if (!anyKeybindPluginEnabled() && !isPluginEnabled('controller')) return;
      plugin.settings().open();
    }
  });
}

const pendingRegistrations = []; // queued registerKeybind() calls, held until flushKeybindRegistrations() runs
let autoFlushScheduled = false;

// The only thing a consuming package needs to call.
//
// config:
//   key            - unique per-binding string, e.g. 'nextChannel'
//   name           - label WITHOUT the "Primary + " suffix, added automatically
//   defaultCode    - shipped default e.code, e.g. 'ArrowRight'
//   scope          - 'global' (default) | 'scoped'
//   selector       - required if scope is 'scoped'
//   packageLabel   - the plugin's category on the Keybinds tab (e.g. 'UC TV')
//   onMatch        - (e) => void, fires when Primary+secondary matches
//   onPrimaryAlone   - (e) => void, global-only: Primary held alone past the hold delay
//   onPrimaryPress   - (e) => void, global-only: fires immediately on Primary keydown
//   onPrimaryRelease - (e) => void, global-only: fires on Primary keyup
//   onPrimaryDoubleTap - (e) => void, global-only: fires on a second Primary press within 400ms of the first
//
// Registration is deferred, not immediate - nothing about a package's
// own registerKeybind() call sites needs to change for that. The
// actual work happens once flushKeybindRegistrations() runs (see
// manifest.js), which is what lets the whole "Keybinds" tab land
// after every other package's own settings have already registered,
// rather than wherever the FIRST package to call this happens to
// land it.
export function registerKeybind(plugin, config) {
  pendingRegistrations.push({ plugin, config });

  // Safety net: if manifest.js's explicit flushKeybindRegistrations()
  // call is ever missing (the same class of mistake as a forgotten
  // initX(plugin) call in bootstrap()), this would otherwise fail
  // completely silently - esbuild tree-shakes the whole registration
  // path out since nothing reachable calls it, so nothing would even
  // show up in the bundle, let alone throw an error. Scheduling a
  // flush on the next tick after the FIRST registerKeybind() call
  // means it still works even without the explicit call - a real
  // flush() call happening synchronously (as manifest.js should do)
  // simply empties the queue first, making this a no-op then.
  if (!autoFlushScheduled) {
    autoFlushScheduled = true;
    setTimeout(() => {
      if (pendingRegistrations.length) flushKeybindRegistrations();
    }, 0);
  }
}

// Called once, after every package's init() has already run - see
// manifest.js. Registers everything queued above, in the order it was
// queued (which is itself just each package's own call order, so
// Cycle Category Up still lands before Cycle Category Down, etc.).
export function flushKeybindRegistrations() {
  const queued = pendingRegistrations.splice(0);
  queued.forEach(({ plugin, config }) => registerKeybindNow(plugin, config));
}

function registerKeybindNow(plugin, config) {
  const {
    key, name, defaultCode,
    scope = 'global', selector,
    // Defaults to true (ignore keybinds while focused in a text field/
    // contenteditable, e.g. chat) - this is what almost every package
    // wants, since a bare Primary+<key> shouldn't fire while someone's
    // just typing and happens to hit a key that collides with a
    // binding. Patch Maker is the one deliberate exception, since its
    // own bindings specifically need to fire while focused on its own
    // contenteditable elements - it opts out explicitly per binding.
    guardTypingContext = true,
    packageLabel,
    onMatch, onPrimaryAlone, onPrimaryPress, onPrimaryRelease, onPrimaryDoubleTap
  } = config;

  ensureCore(plugin);

  const pluginId = pluginIdForLabel(packageLabel);
  const pluginHidden = () => (pluginId ? !isPluginEnabled(pluginId) : false);

  // Only register a secondary-key setting if there's actually a combo
  // to bind it to - a pure "tap/hold Primary alone" binding (like the
  // channel guide) has nothing meaningful to put in a "Primary + <key>"
  // field, and showing one anyway would be actively misleading.
  if (onMatch) {
    // packageLabel is the category, so it isn't repeated in each name.
    settings.add(key, {
      name: `${name} - Primary + <key>`,
      type: 'text',
      default: defaultCode,
      // Each plugin's shortcuts get their own category on the tab.
      category: packageLabel || GENERAL_CATEGORY,
      hidden: pluginHidden
    });
    bindingDefaults.set(key, defaultCode);
  }

  registry.push({ key, name, packageLabel, pluginId, defaultCode, scope, selector, guardTypingContext, onMatch, onPrimaryAlone, onPrimaryPress, onPrimaryRelease, onPrimaryDoubleTap });
  scheduleConflictRefresh();
}

/* ---------- Conflict warnings (1.5.0) ----------
   Shown as a line under a keybind row on the Keybinds tab, recomputed
   whenever the tab renders and right after a rebind:
   - two enabled shortcuts on the same key that can fire in the same
     place (only the first registered one ever fires - see the
     first-match loop in bindGlobalListeners());
   - a shortcut on the same key as Primary itself (can never fire);
   - UnderScript's own hotkeys, which match on the key alone, ignoring
     Ctrl etc - Space ends your turn in a match (unless that's switched
     off in UnderScript's Game settings). */

const WARNING_CLASS = 'wizascript-keybind-warning';

// Esc isn't checked: pressing Esc in a keybind box unbinds it, so no
// shortcut (or Primary) can ever be set to it.
function underscriptClash(code, isPrimary) {
  if (code !== 'Space') return null;
  const v = (k) => { const x = localStorage.getItem(k); return x === '1' || x === 'true'; };
  if (v('underscript.disable.endTurn') || v('underscript.disable.endTurn.space')) return null;
  return isPrimary
    ? "In matches, Space also ends your turn (UnderScript hotkey), so every Primary tap would end it. You can turn that off in UnderScript's Game settings."
    : "In matches, Space also ends your turn (UnderScript hotkey). You can turn that off in UnderScript's Game settings.";
}
// Normalises the shipped side-independent modifier default ('Control')
// so it compares equal to a captured ControlLeft/ControlRight.
function sameKey(a, b) {
  const base = (c) => String(c).replace(/^(Control|Shift|Alt|Meta)(Left|Right)$/, '$1');
  return base(a) === base(b);
}
function canOverlap(a, b) {
  if (a.scope === 'global' && b.scope === 'global') return true;
  if (a.scope === 'scoped' && b.scope === 'scoped') return a.selector === b.selector;
  // Scoped shortcuts fire while one of their own (editable) elements is
  // focused; a global one only competes there if it doesn't stand down
  // while typing.
  const global = a.scope === 'global' ? a : b;
  return !global.guardTypingContext;
}
function describe(b) {
  return b.packageLabel ? `${b.name} (${b.packageLabel})` : b.name;
}

export function computeKeybindConflicts() {
  const out = new Map(); // key -> [message]
  const add = (key, msg) => { if (!out.has(key)) out.set(key, []); out.get(key).push(msg); };
  const primary = getPrimaryCode();
  const combos = registry.filter((b) => b.onMatch && isBindingActive(b))
    .map((b) => ({ b, code: readCode(b.key, b.defaultCode) }))
    .filter(({ code }) => code && code !== 'unbound');

  const primaryClash = underscriptClash(primary, true);
  if (primaryClash && anyKeybindPluginEnabled()) add(PRIMARY_KEY, primaryClash);

  combos.forEach(({ b, code }, i) => {
    if (sameKey(code, primary)) add(b.key, `Same key as your Primary key (${codeToDisplay(primary)}), so this shortcut can't be used.`);
    combos.forEach(({ b: other, code: otherCode }, j) => {
      if (i === j || !sameKey(code, otherCode) || !canOverlap(b, other)) return;
      add(b.key, j < i
        ? `Same key as ${describe(other)}, which takes priority - this one won't fire.`
        : `Same key as ${describe(other)} - this one takes priority, so that one won't fire.`);
    });
    const clash = underscriptClash(code, false);
    if (clash) add(b.key, clash);
  });
  return out;
}

function refreshConflictWarnings() {
  if (!document.querySelector(`input[id^="${ID_PREFIX}"]`)) return;
  const conflicts = computeKeybindConflicts();
  bindingDefaults.forEach((_, key) => {
    const input = document.getElementById(ID_PREFIX + key);
    const row = input && input.closest('.flex-start');
    if (!row) return;
    const messages = conflicts.get(key) || [];
    let warn = row.querySelector(`:scope > .${WARNING_CLASS}`);
    const text = messages.map((m) => `\u26a0 ${m}`).join('\n');
    if (!messages.length) { if (warn) warn.remove(); return; }
    if (!warn) {
      warn = document.createElement('div');
      warn.className = `setting-description ${WARNING_CLASS}`;
      Object.assign(warn.style, { color: '#ffb347', opacity: '1', whiteSpace: 'pre-line' });
      row.appendChild(warn);
    }
    if (warn.textContent !== text) warn.textContent = text;
  });
}

let conflictRefreshQueued = false;
function scheduleConflictRefresh() {
  if (conflictRefreshQueued) return;
  conflictRefreshQueued = true;
  setTimeout(() => { conflictRefreshQueued = false; refreshConflictWarnings(); }, 0);
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
  return registry.some((b) => b.onMatch && isBindingActive(b) && matchesSetting(e, b));
}
