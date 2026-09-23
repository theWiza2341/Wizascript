// packages/dt-animations/registry.js
//
// Holds every DT animation module the build discovered (see build.js's
// dt-animations discovery plugin, which generates the import list for
// packages/dt-animations/animations/). Replaces the old one-off
// window.__titanEyeEffect global pattern so the loader can support many
// DTs without a hardcoded per-card dispatch chain.
//
// A module is a plain object (the file's default export):
//
//   {
//     id:             "titan"            - unique, stable (used in setting keys - never rename once shipped)
//     name:           "Titan"            - shown in settings
//     description:    "..."              - optional, shown as the toggle's note
//     defaultEnabled: true               - optional, defaults to true
//     kind:           "oneShot"          - optional; default "persistent" (see loader.js)
//     settings:       { key: {...} }     - optional, UnderScript setting configs
//                                          (name/type/default/data/min/max/step...),
//                                          shown under "DT Animations - <name>"
//     createEffect(ctx)   -> effect      - the visuals (see below)
//     createDetector(api) -> detector    - reads GameEvents, decides when to start/end/react
//   }
//
// effect:   { play({ resumed }) -> boolean, reset(), forceStop(), isActive() -> boolean,
//             react?(kind), preload?(), destroy?() }
//           one-shots call ctx.finished() when fully done
// detector: { onGameEvent(event), reset?() }
//
// See README.md in this folder for what ctx/api provide.

const animations = new Map();

function validate(def, source) {
  const problems = [];
  if (!def || typeof def !== "object") problems.push("default export is not an object");
  else {
    if (!def.id || typeof def.id !== "string") problems.push("missing string `id`");
    if (!def.name) problems.push("missing `name`");
    if (typeof def.createEffect !== "function") problems.push("missing `createEffect(ctx)`");
    if (typeof def.createDetector !== "function") problems.push("missing `createDetector(api)`");
  }
  if (problems.length) {
    console.error(`[Wizascript:DT Animations] Skipping animation module ${source || ""}: ${problems.join(", ")}`);
    return false;
  }
  return true;
}

export function registerAnimation(def, source) {
  if (!validate(def, source)) return;
  if (animations.has(def.id)) {
    console.error(`[Wizascript:DT Animations] Duplicate animation id "${def.id}" - keeping the first one.`);
    return;
  }
  animations.set(def.id, def);
}

export function getAnimations() {
  return [...animations.values()];
}

export function getAnimation(id) {
  return animations.get(id) || null;
}
