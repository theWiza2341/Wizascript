// packages/dt-animations/settings.js
//
// DT Animations is its own UnderScript plugin, so everything here lives
// on its own page under Plugins -> "DT Animations", not in Wizascript's.
// Layout, top to bottom:
//
//   (UnderScript's own "Enabled" toggle - added automatically for every
//    versioned plugin; it's the master switch, read via plugin.enabled)
//   General      overlap policy, experimental opponent toggle, debug
//   <DT name>    one category per animation (alphabetical by file name):
//                  "Enable <name> animation"
//                  ...that animation's own options, HIDDEN while it's off
//
// So a disabled DT costs exactly one row. UnderScript evaluates `hidden`
// each time the page renders, and flipping a DT's toggle re-renders the
// open page, so its options appear/disappear immediately - no reload.

export const GENERAL = "General";

export const OVERLAP_POLICIES = [
  ["Newest DT replaces the current animation", "replace"],
  ["Keep the current animation, ignore the new DT", "ignore"]
];

export function registerDtAnimationSettings(plugin, animations, { onDebugChange } = {}) {
  const api = plugin.settings();

  // Re-render the settings page if it's open, so `hidden` is re-evaluated.
  // Deferred: we're inside UnderScript's own change handler here.
  const rerender = () => setTimeout(() => {
    try {
      if (api.isOpen()) api.open();
    } catch (err) { /* purely cosmetic - next open shows the right state */ }
  }, 0);

  const overlapPolicy = api.add({
    key: "general.overlapPolicy",
    name: "When a second DT triggers mid-animation",
    type: "select",
    data: OVERLAP_POLICIES,
    default: "replace",
    category: GENERAL
  });

  const allowOpponent = api.add({
    key: "general.allowOpponent",
    name: "[Experimental] Also play for the opponent's DTs",
    note: "Off: only DTs you play (or the player you're spectating) trigger animations.",
    type: "boolean",
    default: false,
    category: GENERAL
  });

  const debug = api.add({
    key: "general.debug",
    name: "Debug mode (console logging + test panel in matches)",
    type: "boolean",
    default: false,
    category: GENERAL,
    onChange: () => onDebugChange && setTimeout(onDebugChange, 0)
  });

  const perAnimation = {};
  const animationValues = {};
  animations.forEach((anim) => {
    const category = anim.name;
    const toggle = api.add({
      key: `${anim.id}.enabled`,
      name: `Enable ${anim.name} animation`,
      note: anim.description,
      type: "boolean",
      default: anim.defaultEnabled !== false,
      category,
      onChange: rerender
    });
    perAnimation[anim.id] = toggle;

    const registered = {};
    Object.entries(anim.settings || {}).forEach(([key, def]) => {
      registered[key] = api.add({
        ...def,
        key: `${anim.id}.${key}`,
        category,
        hidden: () => !toggle.value()
      });
    });
    animationValues[anim.id] = (key) =>
      registered[key] ? registered[key].value() : undefined;
  });

  return {
    // UnderScript's native per-plugin toggle. `enabled` only exists on
    // versioned plugins; treat "missing" as on.
    isMasterEnabled: () => plugin.enabled !== false,
    isAnimationEnabled: (id) => plugin.enabled !== false && !!perAnimation[id] && perAnimation[id].value(),
    overlapPolicy: () => overlapPolicy.value(),
    allowOpponent: () => allowOpponent.value(),
    isDebug: () => debug.value(),
    animationValue: (id, key) => animationValues[id](key),
    open: () => api.open()
  };
}
