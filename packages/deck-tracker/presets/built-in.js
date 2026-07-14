// Shipped-with-the-script preset definitions - manual (click-driven)
// counters for specific card/effect tracking, matching how these were
// already being used as personal custom presets before being promoted
// to the base kit. Registered fresh every page load via
// registerPresetType (not persisted data - only their favorited/layout
// state persists, keyed by these fixed ids).
//
// Sprite names: Hyperlink_Blocked / Mine / Caged_Jester / Soulless_Kris
// are confirmed against true-hub-bridge/channel-overrides.js, where
// these same cards already appear. Pink_Laser and Noellecoaster are
// derived from the game's naming convention (spaces -> underscores)
// but not yet confirmed against real card data - worth checking these
// two specifically once tested, since a wrong guess just silently
// falls back to the generic placeholder rather than erroring.

import { registerPresetType } from "../registry.js";

const BUILT_IN_PRESETS = [
  {
    id: "builtin:enemy-hlbs",
    name: "Enemy HLBs",
    description: "Tracks Hyperlinks Blocked added to the enemy deck",
    sprite: "Hyperlink_Blocked"
  },
  {
    id: "builtin:enemy-mines",
    name: "Enemy Mines",
    description: "Tracks Mines added to the enemy deck",
    sprite: "Mine"
  },
  {
    id: "builtin:cjester-procs",
    name: "CJester Procs",
    description: "Tracks the counters to be added by Freedom",
    sprite: "Caged_Jester"
  },
  {
    id: "builtin:pink-laser-atk",
    name: "Pink Laser ATK",
    description: "Tracks the number of monsters you played this game with 7 base HP",
    sprite: "Pink_Laser" // best-guess image name, not yet confirmed
  },
  {
    id: "builtin:skris-procs",
    name: "Skris Procs",
    description: "Tracks the counters to be added by Dark Fountain",
    sprite: "Soulless_Kris"
  },
  {
    id: "builtin:noellecoaster",
    name: "Noellecoaster",
    description: "Tracks the number of spells costing 2+ G you casted this game",
    sprite: "Noellecoaster" // best-guess image name, not yet confirmed
  }
];

export function registerBuiltInPresets() {
  BUILT_IN_PRESETS.forEach(({ id, name, description, sprite }) => {
    registerPresetType({
      id,
      name,
      description,
      sprite,
      soul: null,     // card/archetype-specific, not a whole-Soul strategy tracker
      custom: false,  // built-in - cannot be deleted via the picker's double-click
      kind: "manual"  // click/right-click/middle-click driven, same as user custom trackers
    });
  });
}
