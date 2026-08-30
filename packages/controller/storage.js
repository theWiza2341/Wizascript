// packages/controller/storage.js
//
// Controller-specific persistence. Every other Wizascript package stores
// its data through GM_getValue/GM_setValue (see packages/core/keybinds.js's
// own GM_PREFIX convention) - the standalone prototype this package was
// built from used raw localStorage instead, since it shipped `@grant none`
// and had no GM_* access at all. Now that the controller lives inside the
// real Wizascript bundle (which already grants GM_getValue/GM_setValue for
// True Hub Bridge and the real keybind registry), it gets to use the same
// mechanism as everything else - this file is the only place that
// conversion happens, so nothing above it needs to know or care that the
// backing store changed.
//
// v0.56: 3-slot preset system. Every per-binding key (keybinds.*,
// shortcuts.*, keybinds.__primary) gets namespaced by whichever preset is
// currently active via presetKey() below, so switching presets is free -
// a preset that's never been touched simply has no keys under its own
// namespace yet, and every getter in settings.js falls through to its
// hardcoded default exactly the same way it always has.

const GM_PREFIX = 'wizascript.controller.';

export function csGet(key, fallback) {
  try {
    const v = GM_getValue(GM_PREFIX + key, null);
    return v === null || v === undefined ? fallback : v;
  } catch (e) {
    console.warn('[Wizascript Controller] GM_getValue failed, falling back to default:', e);
    return fallback;
  }
}

export function csSet(key, value) {
  try {
    GM_setValue(GM_PREFIX + key, value);
  } catch (e) {
    console.warn('[Wizascript Controller] GM_setValue failed, binding will not persist:', e);
  }
}

export const PRESET_COUNT = 3;
const DEFAULT_PRESET_NAME_PREFIX = 'Preset ';

export function getActivePreset() {
  const raw = csGet('activePreset', '1');
  const n = parseInt(raw, 10);
  return (Number.isNaN(n) || n < 1 || n > PRESET_COUNT) ? 1 : n;
}
export function setActivePreset(n) {
  csSet('activePreset', String(n));
}
export function getPresetName(n) {
  return csGet('presetName.' + n, DEFAULT_PRESET_NAME_PREFIX + n);
}
export function setPresetName(n, name) {
  const trimmed = (name || '').trim();
  csSet('presetName.' + n, trimmed === '' ? (DEFAULT_PRESET_NAME_PREFIX + n) : trimmed);
}
// Every per-binding key (keybinds.*, shortcuts.*, keybinds.__primary) gets
// routed through this before hitting csGet/csSet, so it lives under
// whichever preset is active RIGHT NOW.
export function presetKey(rawKey) {
  return 'preset' + getActivePreset() + '.' + rawKey;
}

// One-time migration of pre-preset-system flat keybind/shortcut/primary
// storage into Preset 1's namespace - carried over from the prototype
// verbatim (still GM-backed now instead of localStorage-backed) so anyone
// upgrading from a build that predates presets doesn't lose their existing
// customizations. Guarded by a one-time marker; only copies a key forward
// if the OLD flat value exists AND the NEW preset1-namespaced value
// doesn't already exist, so this can never clobber a real preset-1
// customization made after upgrading.
export function migrateFlatBindingsToPresetOne(controllerActionKeys, hardwareShortcutKeys) {
  if (csGet('migratedToPresetsV056', null) !== null) return;
  const migrate = (rawKey) => {
    const oldVal = csGet(rawKey, null);
    if (oldVal === null) return;
    const newKey = 'preset1.' + rawKey;
    if (csGet(newKey, null) !== null) return;
    csSet(newKey, oldVal);
  };
  migrate('keybinds.__primary');
  controllerActionKeys.forEach((key) => migrate('keybinds.' + key));
  hardwareShortcutKeys.forEach((key) => migrate('shortcuts.' + key));
  csSet('migratedToPresetsV056', 'true');
  console.log('[Wizascript Controller] migrated any pre-preset-system bindings into Preset 1.');
}
