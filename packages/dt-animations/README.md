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

`ctx.setting(key)` returns the current value of one of the module's own settings. Read it inside `play()` so changes apply on the next play. `ctx.log`, `ctx.warn` and `ctx.pageWindow` are also available.

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
| `api.log/warn` | Output only appears while debug is on. |

`reset()` is called at match start or reconnect to clear any per-match state.

## What the host handles

- **Ownership.** By default only your own DTs trigger animations. An experimental setting also allows the opponent's.
- **Overlap.** Only one animation plays at a time. A newer DT either replaces the current one (the default) or is ignored, depending on the setting. An animation that is already fading out always gets replaced.
- **Game end.** `getVictory`, `getDefeat` and `getResult` call `forceStop()` on every effect.
- **Page gating.** Nothing runs outside `/Game` and `/Spectate*`.
- **Settings.** The page has a **General** category (overlap, opponent, debug), then one category per DT. Each DT category starts with "Enable <name> animation". The DT's own options sit under that toggle and are hidden while it's off, so a disabled DT takes up one row. Flipping the toggle re-renders the page, so no reload is needed.
- **Debug.** With "Debug mode" on (it can be switched mid-match):
  - A small panel appears in the bottom-left of matches, with Play, React, End and Stop all buttons plus a gear that opens this settings page.
  - Console logging is turned on.
  - `__wizaDtAnimations` in the console exposes `play(id)`, `react(id)`, `reset(id)`, `forceStop()` and `current()`.
  - Nothing is registered in Wizascript's Keybinds category.

## Rules for detectors (compliance)

Detectors react only to **public, on-board state** that both players can already see, such as a card on the board or an artifact and its counter. They never react to hand, deck, or anything hidden. They must stay purely cosmetic: no reminders, counts or predictions.
