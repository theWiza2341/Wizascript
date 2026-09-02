# Wizascript

Wizascript is an all-in-one UnderScript plugin suite for [Undercards](https://undercards.net) — a single Tampermonkey userscript that combines several previously-separate plugins into one download, one plugin registration, and one settings tab.

**Current version:** 1.3.1
**Repository:** [theWiza2341/Wizascript](https://github.com/theWiza2341/Wizascript) (public)

## Compliance note

Wizascript's feature set is intentionally scoped to comply with UC moderation guidelines: no automated gameplay assistance, no hooking into game events to calculate or predict hidden information, and no automation of player inputs. Every feature below is either purely manual (the player does the clicking/typing), purely cosmetic, or entirely outside of active matches. UC TV's auto-channel-switching operates only on the spectator list of other players' already-in-progress matches — it never touches an active match the player is themselves in, and never affects anyone's gameplay. A small number of earlier features (several automated Deck Tracker presets, and a Doom-artifact turn reminder) were removed for exactly this reason and are not coming back in their original form.

## Features

### Patch Maker
Lets players make their own custom changes to the "Patch Notes" page. Entered data persists between page visits, and upon entering a "Viewer" mode, changes are formatted in the same way the page normally does, creating the sense of an "Official" Patch. Some features include the ability to upload custom-made cards as "New Cards", the creation of new balance sections, and a dedicated help button for several shortcuts. Keyboard shortcuts (cycling an entry's balance category, reordering entries/sections/cards) work through the shared Keybinds system below, and are the one place in Wizascript where those shortcuts deliberately keep working while a text field is focused, since that's exactly where they're needed.

### UC TV
A spectator-mode "channel surfer" for browsing other players' live matches. While spectating, holding Primary opens a channel guide overlay listing currently-spectatable matches (filterable by level and rank tier, per game mode); previous/next-channel shortcuts step through them directly. An optional auto mode counts down and switches to another match on its own once the current one ends, with a tap of Primary canceling the countdown. All of it operates purely on which already-in-progress match is being watched — it never sends inputs into, or draws information out of, any match the player is themselves playing.

### True Hub Bridge
Lets players browse published decks from outside of an active match. Deck data is fetched from `bot/decks.json` in this repository, which is kept up to date by a Discord-scraping bot (see `bot/`) and its associated GitHub Actions workflows.

### Deck Tracker
The core in-match feature. Adds a "+" button during games and while spectating, opening a picker where players can spawn small on-screen tracker widgets:

- **Built-in manual counters** — click-driven trackers for things like Enemy HLBs, Enemy Mines, CJester Procs, Pink Laser ATK, Skris Procs, and Noellecoaster. Every one of these is a plain counter the player updates by clicking; nothing is calculated or inferred automatically.
- **Custom Tracker builder** — lets a player create their own named counter (optionally with a card sprite), and save it as a reusable preset.
- Widgets support drag-to-reposition (position is remembered), favoriting, and optionally retaining an unclosed widget between matches — all via settings under the Deck Tracker category.
- The "+" button itself is also drag-to-reposition (middle-click to reset it back to its default spot next to your avatar), so a future UC update repositioning its own UI into that space doesn't strand the button underneath something else again.

### Notepad
A small freeform drawing canvas, entirely disconnected from match data. Draw, erase, or flood-fill with the pen color, on up to 6 independent layers (start with one, add more from the toolbar up to the limit, remove from the top down). Undo/redo covers the last several actions across every layer (in-memory only, not saved between sessions). An HSL color wheel handles both pen and paper colors, with a row of your most recently used pen colors for quickly switching back and forth. Clear resets the drawing, paper color, pen color, recent colors, and title back to defaults (but leaves the notepad's position alone) — same scope as the "Reset Notepad" keybind, just without the position reset, and without closing and reopening the window to do it. The notepad's name is editable in place and doubles as the filename when saving a doodle as a PNG. Position, drawing (all layers), colors, and name all persist between sessions. Lives under Misc settings behind an "Enable Notepad Overlay" toggle (off by default), and currently has no page restriction — available anywhere on undercards.net.

### Keybinds
A shared, remappable keybind system used by Patch Maker, UC TV, and Notepad. One "Primary" key (Control by default) combines with a second key to trigger each shortcut — hold Primary and tap the second key, or in a few places just tap or hold Primary alone. Every shortcut, its current key, and which package it belongs to are visible and individually remappable under a single "Keybinds" settings category, grouped by package. By default, shortcuts don't fire while typing anywhere else on the page (chat, forms, etc.) — Patch Maker's own shortcuts are the deliberate exception, since they're built to work while editing its own fields. Double-tapping Primary anywhere (except while typing) opens Wizascript's own settings panel directly.

### Controller Support
Full gamepad navigation, for players who'd rather not reach for a mouse/keyboard — covers Underscript's own settings and dialogs, the in-match hand/board, Deck Tracker's on-screen keyboard, and every feature above. Off by default; turn on "Enable Controller Support" under Miscellaneous, then reload to reveal its own "Keybinds - Controller" settings category, where every binding below is shown live and individually remappable.

- **Movement & clicking** — the left stick drives a synthetic cursor. The right stick's horizontal axis is a speed dial for it: push it left to speed the cursor up (up to 3x), push it right to slow down for fine positioning (down to 0.3x). The right stick's vertical axis is separate from cursor movement entirely — it free-scrolls whatever list or panel currently has focus (a settings category, the UC TV channel guide, a scrollable dialog), and the d-pad snaps to whatever's now visible the next time you press it, rather than wherever it was pointed before you scrolled. Face buttons click/alt-click/cancel; the d-pad drives structured step-through navigation (menus, dialogs, hand/board) anywhere Wizascript can detect a clear layout to step through.
- **Controller Primary** — one remappable "hold" button (unbound by default) that mirrors Wizascript's own keyboard Primary key. Holding it and tapping a second remapped button fires a shortcut (channel switching, Notepad toggle/reset/undo/redo, Patch Maker entry/section/card reordering); a bare tap, while a Patch Maker entry is focused, cycles its balance category instead. Double-tapping it opens Wizascript's own settings panel, same as double-tapping the keyboard Primary key does.
- **Channel Guide** — its own separate, independently remappable hold button (unbound by default) that opens UC TV's channel guide while spectating, without needing Controller Primary at all. Up/Down moves between listed matches, Left/Right switches between a match's two players, and the right stick free-scrolls the list the same way it does everywhere else.
- **In-Game Inputs** — a fixed set of no-hold-required hardware shortcuts, each individually remappable: Concede, End Turn, opening your/the opponent's dustpile, opening Wizascript's settings, opening Deck Tracker's tracker-preset picker, and pausing/resuming the on-screen keyboard while it's open.
- **Presets** — up to 3 independent sets of button bindings, switchable from a dropdown at the top of the category (handy for sharing one controller between players, or keeping a couple of layouts around). "Restore Settings to Default" (double-click) resets whichever preset is currently selected back to its defaults.

### bot/
A small Node.js bot that scrapes deck codes and metadata from a Discord server and writes them to `bot/decks.json`, which True Hub Bridge reads. Runs both as a one-off full sync (`bot.js`) and an incremental sync (`new-only-sync.js`), automated via GitHub Actions.

## Repository structure

```
packages/
  core/            shared bootstrap, settings wrapper, page-window access, page matching, keybind registry
  patch-maker/
  uc-tv/           spectator-mode channel switching + guide overlay
  true-hub-bridge/
  deck-tracker/
  controller/      full gamepad navigation + remappable controller keybinds (see Controller Support above)
  misc/            small standalone features
    notepad/       freeform drawing canvas (see Notepad above)
bot/               deck-scraping bot + decks.json
manifest.js        wires each package's init function together (also flushes the keybind registry once every package has registered its own settings)
build.js            esbuild bundler + userscript header
wizascript.user.js  the built, installable script
```
