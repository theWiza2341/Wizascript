// packages/dt-animations/settings.js
//
// "DT Animations" category: master enable, overlap policy, the
// experimental opponent toggle, debug, and one enable toggle per
// registered animation (generated from the registry - adding a module
// adds its toggle automatically).
//
// Each animation's OWN settings (module.settings) go in a separate
// "DT Animations - <name>" category, and - same trick as UC TV's
// "Filter Settings" - that category is only registered while both the
// master switch and that animation are enabled. Disabled DTs don't
// clutter the panel, and since this only skips *registering* them, the
// stored values survive: re-enabling + reloading brings them back.

import { createFeatureSettings } from "../core/settings.js";

export const CATEGORY = "DT Animations";

export const OVERLAP_POLICIES = [
  ["Newest DT replaces the current animation", "replace"],
  ["Keep the current animation, ignore the new DT", "ignore"]
];

export function registerDtAnimationSettings(plugin, animations) {
  const settings = createFeatureSettings(plugin, "dtAnimations", CATEGORY);

  const enabled = settings.add("enabled", {
    name: "Enable DT Animations",
    type: "boolean",
    default: true
  });

  const overlapPolicy = settings.add("overlapPolicy", {
    name: "When a second DT triggers mid-animation",
    type: "select",
    data: OVERLAP_POLICIES,
    default: "replace"
  });

  const allowOpponent = settings.add("allowOpponent", {
    name: "[Experimental] Also play for the opponent's DTs",
    note: "Off: only DTs you play trigger animations.",
    type: "boolean",
    default: false
  });

  const debug = settings.add("debug", {
    name: "Enable debug logging + test keybinds",
    note: "Reload the page after changing this.",
    type: "boolean",
    default: false
  });

  const perAnimation = {};
  animations.forEach((anim) => {
    perAnimation[anim.id] = settings.add(`${anim.id}.enabled`, {
      name: `${anim.name} Animation`,
      note: anim.description,
      type: "boolean",
      default: anim.defaultEnabled !== false
    });
  });

  // Only registered while debug is on (read once at load, hence the
  // "reload" note above) - picks which animation the test keybinds drive.
  const debugTarget = debug.value() && animations.length
    ? settings.add("debugTarget", {
        name: "Test keybinds target",
        type: "select",
        data: animations.map((a) => [a.name, a.id]),
        default: animations[0].id
      })
    : null;

  // Per-animation option categories.
  const animationValues = {};
  animations.forEach((anim) => {
    const defs = anim.settings || {};
    const registered = {};
    const visible = enabled.value() && perAnimation[anim.id].value();
    if (visible) {
      Object.entries(defs).forEach(([key, def]) => {
        registered[key] = settings.add(`${anim.id}.${key}`, {
          ...def,
          category: `${CATEGORY} - ${anim.name}`
        });
      });
    }
    // Falls back to the module's declared default when the category
    // wasn't registered this load (animation disabled) - only reachable
    // via the debug keybinds/console, which deliberately ignore the
    // per-animation toggle.
    animationValues[anim.id] = (key) =>
      registered[key] ? registered[key].value() : defs[key] && defs[key].default;
  });

  return {
    isMasterEnabled: () => enabled.value(),
    isAnimationEnabled: (id) => enabled.value() && !!perAnimation[id] && perAnimation[id].value(),
    overlapPolicy: () => overlapPolicy.value(),
    allowOpponent: () => allowOpponent.value(),
    isDebug: () => debug.value(),
    debugTarget: () => (debugTarget ? debugTarget.value() : animations[0] && animations[0].id),
    animationValue: (id, key) => animationValues[id](key)
  };
}
