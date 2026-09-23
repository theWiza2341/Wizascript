# dt-animations

Special on-screen animations for DT cards. Purely cosmetic (staff-approved).
Animations are added over time, a few per update.

DT Animations is its **own UnderScript plugin**. It ships inside the
Wizascript script but registers separately (see `manifest.js` and
`bootstrapPlugin` in `core/bootstrap.js`), so it:

- has its own page under Plugins -> "DT Animations", not rows in Wizascript's tab;
- uses UnderScript's built-in **Enabled** toggle on that page as its master switch;
- depends only on `core/` utilities, never on another Wizascript package, so it keeps working with every Wizascript feature turned off.

## Adding a new DT animation

1. Create `animations/<name>.js`. If the animation needs several files, create `animations/<name>/index.js` instead.
2. Rebuild. `build.js` discovers every file in `animations/` automatically. You don't need to edit `index.js`, `manifest.js` or `settings.js`.

The build log lists what it found:

```
[build] DT animations: titan.js
```

Files or folders starting with `_` are skipped. Use that prefix for drafts or shared helpers.

## Module shape

```js
export default {
  id: "titan",            // stable forever: setting keys are built from it
  name: "Titan",          // shown in settings
  description: "...",     // optional, shown under the toggle
  defaultEnabled: true,   // optional
  kind: "persistent",     // optional: "persistent" (default - lasts until its detector ends it, e.g. Titan)
                          //   or "oneShot" (plays once and ends itself, e.g. The Barrier)
  settings: {             // optional: normal UnderScript setting configs
    darkness: { name: "Background darkness", type: "slider", default: 1, min: 0, max: 1, step: 0.05 },
    style:    { name: "Style", type: "select", data: [["Classic", "classic"], ["Revamped", "revamped"]], default: "revamped" }
  },                      //   shown in this DT's category, hidden while it's disabled
  createEffect(ctx) { ... },    // visuals
  createDetector(api) { ... }   // when to start, react or end
};
```

### `createEffect(ctx)` returns `{ play, reset, forceStop, isActive, react?, destroy? }`

| method | meaning |
|---|---|
| `play()` | Start the animation. Return `false` if it can't start (e.g. no `#board` yet). |
| `reset()` | Graceful exit, such as the eyes shattering. Keep `isActive()` true until the exit has fully finished. |
| `forceStop()` | Instant hard cut. Used at game end and when another DT replaces this one. |
| `isActive()` | True from `play()` until the exit has completely finished. |
| `react(kind)` | Optional mid-animation reaction, e.g. `"hurt"`. |
| `preload()` | Optional. Called at match start while the animation is enabled, e.g. to fetch a GIF ahead of time. |
| `debugVariants({ refresh })` | Optional. Resolves to `[{ label, value }]` for the debug panel's second picker. The Barrier lists its styles plus every custom clip. |

`play({ resumed, variant })`:
- `resumed` is true when a persistent animation comes back after a one-shot interrupted it. Titan uses it to skip its slow 3 s darkening.
- `variant` is only set by the debug panel. It's the value picked from `debugVariants()`, and it should override the settings for that one play.

`ctx.setting(key)` returns the current value of one of the module's own settings. Read it inside `play()` so changes apply on the next play. `ctx.log`, `ctx.warn` and `ctx.pageWindow` are also available.

`ctx.finished()`: effects that end on their own (one-shots) **must** call this once they're fully gone, after the fade. That's how the host knows to resume a persistent animation the one-shot suspended.

Build the DOM lazily in `play()`, not in `createEffect()`. The effect is only created the first time it plays.

### `createDetector(api)` returns `{ onGameEvent(event), reset? }`

The detector receives every `GameEvent` while its animation is enabled. It decides what the event means and asks the host to act:

| api | meaning |
|---|---|
| `api.isRelevantPlayer(playerId)` | Whether this player's DTs should count. By default that's only you, or the spectated player when spectating. The experimental opponent setting widens it. |
| `api.isMine(playerId)` | Strictly you or the spectated player, ignoring the opponent setting. |
| `api.start(ownerId)` | Ask to play. The host applies the overlap policy and may refuse. |
| `api.end()` | Graceful end. This is a no-op if the animation isn't the one currently playing. |
| `api.react(kind)` | Forwarded to `effect.react` only while this animation is playing. |
| `api.isPlaying()` | Whether this animation is currently the one on screen. |
| `api.setting(key)` | The same values `ctx.setting` gives the effect, e.g. for a "skip generated copies" option. |
| `api.log/warn` | Output only appears while debug is on. |

`reset()` is called at match start or reconnect to clear any per-match state.

## What the host handles

- **Ownership.** By default only your own DTs trigger animations. An experimental setting also allows the opponent's.
- **Overlap.** Only one animation plays at a time. A newer DT either replaces the current one (the default) or is ignored, depending on the setting. An animation that is already fading out always gets replaced.
- **One-shots over persistent animations.** If a one-shot replaces a persistent animation, the persistent one is only **suspended**. It resumes as soon as the one-shot calls `ctx.finished()`, unless its detector ended it in the meantime.
- **Game end.** `getVictory`, `getDefeat` and `getResult` call `forceStop()` on every effect.
- **Page gating.** Nothing runs outside `/Game` and `/Spectate*`.
- **Settings.** The page has a **General** category (overlap, opponent, debug), then one category per DT. Each DT category starts with "Enable <name> animation". The DT's own options sit under that toggle and are hidden while it's off, so a disabled DT takes up one row. Flipping the toggle re-renders the page, so no reload is needed.
- **Debug.** With "Debug mode" on (it can be switched mid-match):
  - A small panel appears in the bottom-left of matches, with Play, React, End and Stop all buttons plus a gear that opens this settings page.
  - When the selected animation offers variants, a second picker appears, with **↻** to reload it. It lets you play a specific style or clip without changing settings.
  - Console logging is turned on.
  - `__wizaDtAnimations` in the console exposes `play(id)`, `react(id)`, `reset(id)`, `forceStop()` and `current()`.
  - Nothing is registered in Wizascript's Keybinds category.

## Assets (GIFs, images, sounds)

Binary files go in the repo under `assets/dt-animations/`. They're **not** bundled into the userscript; they're fetched at runtime with `loadAssetBlob(path)` from `core/assets.js`. Stable builds read from `main` and dev builds read from `dev`, so an asset has to be committed on that branch before it will load there. Keep them small: The Barrier's GIF was re-encoded from 1.7 MB down to 116 KB with no visible difference. If an asset can't load, the animation should fall back to something drawn in code, like Barrier falling back from "classic" to "remake".

The Barrier's Custom style reads `assets/dt-animations/barrier-custom/clips.json`. See the README in that folder.

## Rules for detectors (compliance)

Detectors react only to **public, on-board state** that both players can already see, such as a card on the board or an artifact and its counter. They never react to hand, deck, or anything hidden. They must stay purely cosmetic: no reminders, counts or predictions.
