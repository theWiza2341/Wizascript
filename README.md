# Wizascript

Wizascript is an all-in-one UnderScript plugin suite for [Undercards](https://undercards.net) — a single Tampermonkey userscript that combines several previously-separate plugins into one download, one plugin registration, and one settings tab.

**Current version:** 1.5.0 (see [CHANGELOG.md](CHANGELOG.md))
**Repository:** [theWiza2341/Wizascript](https://github.com/theWiza2341/Wizascript) (public)

## Compliance note

Wizascript's feature set is intentionally scoped to comply with UC moderation guidelines: no automated gameplay assistance, no hooking into game events to calculate or predict hidden information, and no automation of player inputs. Every feature below is either purely manual (the player does the clicking/typing), purely cosmetic, or entirely outside of active matches. UC TV's auto-channel-switching operates only on the spectator list of other players' already-in-progress matches. It never touches an active match the player is themselves in, and never affects anyone's gameplay. A small number of earlier features (several automated Card Tracker presets, back when it was called Deck Tracker, and a Doom-artifact turn reminder) were removed for exactly this reason and are not coming back in their original form.

## Settings layout

All of Wizascript's settings live under UnderScript's settings menu, in **Plugins → Wizascript**:

- **General** tab: the **Plugins** and **Miscellaneous** lists, one on/off switch per feature (hover each for a short description), plus the version number, a **Changelog** button, **Back up / Restore settings** (all your Wizascript settings and saved data as one code or file, for moving to another browser or after a reinstall), and a single **Debug logging** switch for the whole suite. New installs start with every plugin switched off. Turning a plugin on or off takes effect after a page refresh.
- **One tab per enabled plugin**, holding only that plugin's settings, with a short **How to use** guide at the bottom (pages it works on, what it does, its inputs). The **?** next to each plugin in the lists opens the same guide, including for Notepad and Card Tags, which have no tab of their own. (Cosmetic Wishlist is the one Miscellaneous plugin with a tab: its list of pinned cosmetics.) Plugins that are switched off don't show a tab at all.
- **Keybinds** tab: appears once you enable a plugin with keyboard shortcuts (Patch Maker, UC TV, Tier List Maker, Notepad), with a General section plus one section per plugin you have on. A warning appears under any shortcut that clashes with another one, with your Primary key, or with UnderScript's Space-to-end-turn hotkey.
- **Controller Support** tab: appears when Controller Support is enabled, split into Setup, General, one section per plugin you have on, and In-Game Inputs. Like the Keybinds tab, it warns under any binding that clashes with another.
- If more tabs are open than fit in one row, they're split into pages, and **◀ ▶** arrows pinned to the right end of the row flip between pages.

## Features

### Patch Maker
Lets players make their own custom changes to the "Patch Notes" page. Entered data persists between page visits, and upon entering a "Viewer" mode, changes are formatted in the same way the page normally does, creating the sense of an "Official" Patch. Some features include the ability to upload custom-made cards as "New Cards", the creation of new balance sections, and a dedicated help button for several shortcuts. Keyboard shortcuts (cycling an entry's balance category, reordering entries/sections/cards) work through the shared Keybinds system below, and are the one place in Wizascript where those shortcuts deliberately keep working while a text field is focused, since that's exactly where they're needed.

### UC TV
A spectator-mode "channel surfer" for browsing other players' live matches. While spectating, holding Primary opens a channel guide overlay listing currently-spectatable matches (filterable by level and rank tier, per game mode); previous/next-channel shortcuts step through them directly. An optional auto mode counts down and switches to another match on its own once the current one ends, with a tap of Primary canceling the countdown. All of it operates purely on which already-in-progress match is being watched — it never sends inputs into, or draws information out of, any match the player is themselves playing.

### True Hub Bridge
Lets players browse published decks from outside of an active match. Deck data is fetched from `bot/decks.json` in this repository, which is kept up to date by a Discord-scraping bot (see `bot/`) and its associated GitHub Actions workflows.

### Card Tracker
*(called Deck Tracker before 1.5.0)*

The core in-match feature. Adds a "+" button during games and while spectating, opening a picker where players can spawn small on-screen tracker widgets:

- **Built-in manual counters** — click-driven trackers for things like Enemy HLBs, Enemy Mines, CJester Procs, Pink Laser ATK, Skris Procs, and Noellecoaster. Every one of these is a plain counter the player updates by clicking; nothing is calculated or inferred automatically.
- **Custom Tracker builder** — lets a player create their own named counter (optionally with a card sprite), and save it as a reusable preset.
- Widgets support drag-to-reposition (position is remembered), favoriting, and optionally retaining an unclosed widget between matches all via settings on the Card Tracker tab.
- The "+" button itself is also drag-to-reposition (middle-click to reset it back to its default spot next to your avatar), so a future UC update repositioning its own UI into that space doesn't strand the button underneath something else again.

### Tier List Maker
A TierMaker-style tier list builder that works on every page, including during matches. Primary + L shows or hides a resizable window (from a minimum size up to full screen). Cards, souls, artifacts and custom text items are dragged from an item panel into tiers that can be renamed, recoloured, reordered, added and removed. The panel stays empty until you search or tick a filter, using the same rarity/type/set icons as the Crafting page; with Card Tags enabled, the search also matches your tags. On Crafting and Decks, cards can be dragged straight in from the page. Lists are saved automatically, any number can be kept, and each can be shared or imported as a code. Card data comes from the game's own card list, so new cards appear without a Wizascript update. Its settings tab covers card size, window opacity, names on tiles, the hover-preview delay, greying out vs hiding ranked items, dragging from Crafting/Decks, and turning it off during your own matches. With Controller Support on, Primary + Touchpad opens it and the d-pad drives it: pick up and place cards, send one straight to a tier, and jump between the tiers and the item panel, all rebindable in the Controller Support tab. It only reads card data and never touches gameplay.

### Cosmetic Wishlist
Pin the avatars, emotes and profile skins you'd like (right-click one in chat, in a match, or in the Cosmetics Shop and choose "Add to Wishlist"; with a controller, △ then ✕), and get a message when the Cosmetics Shop has one of them, with a "Take me there!" button. The shop is read in the background once after each daily and weekly refresh (using the shop's own countdown timers), never during a match; "Shop Check Frequency" can add a 4- or 12-hourly check or turn background checks off ("Only when I visit the shop"), and "Remind Me" chooses between one reminder per refresh and one on every page load. Items the shop shows as owned leave the list by themselves, and free (0 UCP) emotes can't be pinned. Its tab lists your pins with when each was last in the shop, a remove button for each, and "Check Shop Now". It only reads the shop page with your own session (one request per refresh), never buys anything, and its messages are only shown to you. Enable it from the Miscellaneous list.

### Notepad
A small freeform drawing canvas, entirely disconnected from match data. Draw, erase, or flood-fill with the pen color, on up to 6 independent layers (start with one, add more from the toolbar up to the limit, remove from the top down). Undo/redo covers the last several actions across every layer (in-memory only, not saved between sessions). An HSL color wheel handles both pen and paper colors, with a row of your most recently used pen colors for quickly switching back and forth. Clear resets the drawing, paper color, pen color, recent colors, and title back to defaults (but leaves the notepad's position alone), same scope as the "Reset Notepad" keybind, just without the position reset, and without closing and reopening the window to do it. The notepad's name is editable in place and doubles as the filename when saving a doodle as a PNG. Position, drawing (all layers), colors, and name all persist between sessions. Enable it from the Miscellaneous list. "Open Notepad on Page Load" (shown under it once enabled) decides whether it opens by itself; the Toggle Notepad shortcut opens/closes it for the current page.

### Card History
Middle-click a card on Crafting or Decks to see every earlier version of it, drawn with the game's own card renderer (cost, stats, rarity, text, tribes and powers per version), or middle-click an artifact on the Artifacts page for a list of its versions with rarity and text. Uncertain versions are marked with a \* (hover for why). The histories are built by a GitHub Action from the Undercards wikis (Fandom's Version History and Previous Versions pages, and the Miraheze wiki), the official patch notes (transcribed from Beta 12.0 onwards) and feildmaster's Card-Tracker, and are stored on the `card-history` branch (see `card-history/README.md` there). Wizascript reads them on demand, so corrections reach players without an update. Players can right-click a version that looks wrong to report it. **My Reports** turns their reports into short plain-text codes (`WZR1 <data date> <id>@<version> ...`, at most 250 characters, no links) to paste in Undercards chat or on Discord. Whoever gathers reports can switch on collecting (codes seen in chat, or pasted text) and download one file, with each reported version listed once. Versions confirmed as reported can be listed by hand in `card-history/reports.json` on the data branch, which shows a ⚠ to every player. With Controller Support, Primary + ✕ ("Middle Click") opens a history and △ reports a version. Read-only, never touches a match. Enable it from the Miscellaneous list.

### Keybinds
A shared, remappable keybind system used by Patch Maker, UC TV, and Notepad. One "Primary" key (Control by default) combines with a second key to trigger each shortcut: hold Primary and tap the second key, or in a few places just tap or hold Primary alone. Every shortcut, its current key, and which plugin it belongs to are visible and individually remappable on the "Keybinds" settings tab, grouped by plugin. Only shortcuts for enabled plugins are shown. By default, shortcuts don't fire while typing anywhere else on the page (chat, forms, etc.). Patch Maker's own shortcuts are the deliberate exception, since they're built to work while editing its own fields. Double-tapping Primary anywhere (except while typing) opens Wizascript's own settings panel directly, as long as at least one keybind-using plugin (or Controller Support) is enabled.

### Controller Support
Full gamepad navigation, for players who'd rather not reach for a mouse/keyboard, covers Underscript's own settings and dialogs, the in-match hand/board, the on-screen keyboard, and every feature above. Enable it from the Plugins list, then reload, to use it and reveal its "Controller Support" settings tab, where every binding below is shown live and individually remappable. Bindings for plugins you haven't enabled are hidden.

- **Movement & clicking** — the left stick drives a synthetic cursor. The right stick's horizontal axis is a speed dial for it: push it left to speed the cursor up (up to 3x), push it right to slow down for fine positioning (down to 0.3x). The right stick's vertical axis is separate from cursor movement entirely. It free-scrolls whatever list or panel currently has focus (a settings category, the UC TV channel guide, a scrollable dialog), and the d-pad snaps to whatever's now visible the next time you press it, rather than wherever it was pointed before you scrolled. Face buttons click/alt-click/cancel; the d-pad drives structured step-through navigation (menus, dialogs, hand/board) anywhere Wizascript can detect a clear layout to step through.
- **In-Game Inputs** — a fixed set of no-hold-required hardware shortcuts, each individually remappable: Concede, End Turn, opening your/the opponent's dustpile, opening Wizascript's settings, opening Card Tracker's tracker-preset picker, and pausing/resuming the on-screen keyboard while it's open.
- **In Settings** — L1/R1 switch tabs: sidebar categories while the sidebar has focus, or the open plugin's own tabs (e.g. Wizascript's General / Patch Maker / …) while you're in its settings.
- **Presets** — up to 3 independent sets of button bindings, switchable from a dropdown at the top of the tab (handy for sharing one controller between players, or keeping a couple of layouts around). "Restore Settings to Default" (double-click) resets whichever preset is currently selected back to its defaults.

### Card Tags
Custom, user-defined tags for cards in Crafting and Deck-building. That means no preset list, just names you create yourself. Right-click any card to create a tag (with its own color) or toggle it on/off, filter by typing a tag name into the existing search bar, and spot tagged cards at a glance via a small on-card indicator dot. A "Manage Tags…" dialog handles renaming, recoloring, and deleting tags in one place, and can **Share…** some or all of your tags (with the cards they're on) as a code, or **Import…** a friend's code. Imported tags merge into yours by name and never remove anything. Enable it from the Miscellaneous list.

### bot/
A small Node.js bot that scrapes deck codes and metadata from a Discord server and writes them to `bot/decks.json`, which True Hub Bridge reads. Runs both as a one-off full sync (`bot.js`) and an incremental sync (`new-only-sync.js`), automated via GitHub Actions.

## Repository structure

```
packages/
  core/            shared bootstrap, Plugins list + migration, about/changelog, how-to guides, backup/restore + share codes, debug switch, settings wrapper, page-window access, page matching, keybind registry
  patch-maker/
  uc-tv/           spectator-mode channel switching + guide overlay
  true-hub-bridge/
  deck-tracker/    Card Tracker (folder and storage keys keep the old name)
  controller/      full gamepad navigation + remappable controller keybinds (see Controller Support above)
  misc/            Notepad, Card Tags and Cosmetic Wishlist (plus Tier List Maker's files)
    notepad/       freeform drawing canvas (see Notepad above)
    card-tags/     custom card flair tags (see Card Tags above)
    wishlist/      Cosmetic Wishlist (see above)
    tier-list/     Tier List Maker (a full plugin; its files live here because it began as a Misc feature)
bot/               deck-scraping bot + decks.json
assets/logo.png    logo shown in the General tab's Wizascript section (square PNG, 192x192 recommended; embedded into the script at build time)
manifest.js        wires each package's init function together (also flushes the keybind registry once every package has registered its own settings)
CHANGELOG.md        release notes, bundled into the script for the in-game Changelog button
build.js            esbuild bundler + userscript header (version comes from package.json)
wizascript.user.js  the built, installable script
```
