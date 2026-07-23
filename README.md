# Wizascript

Wizascript is an all-in-one [UnderScript](https://github.com/UnderScript) plugin suite for [Undercards](https://undercards.net) — a single Tampermonkey userscript that combines several previously-separate plugins into one download, one plugin registration, and one settings tab.

**Current version:** 1.1.04
**Repository:** [theWiza2341/Wizascript](https://github.com/theWiza2341/Wizascript) (public)

## Compliance note

Wizascript's feature set is intentionally scoped to comply with UC moderation guidelines: no automated gameplay assistance, no hooking into game events to calculate or predict hidden information, and no automation of player inputs. Every feature below is either purely manual (the player does the clicking/typing), purely cosmetic, or entirely outside of active matches. A small number of earlier features (several automated Deck Tracker presets, and a Doom-artifact turn reminder) were removed for exactly this reason and are not coming back in their original form.

## Features

### Patch Maker
Lets players make their own custom changes to the "Patch Notes" page. Entered data persists between page visits, and upon entering a "Viewer" mode, are changes are formatted in the same way the page normally does, creating the sense of an "Official" Patch. Some features include the ability to upload custom-made cards as "New Cards", the creation of new balance sections, and a dedicated help button for several shortcuts.

### True Hub Bridge
Lets players browse published decks from outside of an active match. Deck data is fetched from `bot/decks.json` in this repository, which is kept up to date by a Discord-scraping bot (see `bot/`) and its associated GitHub Actions workflows.

### Deck Tracker
The core in-match feature. Adds a "+" button during games and while spectating, opening a picker where players can spawn small on-screen tracker widgets:

- **Built-in manual counters** — click-driven trackers for things like Enemy HLBs, Enemy Mines, CJester Procs, Pink Laser ATK, Skris Procs, and Noellecoaster. Every one of these is a plain counter the player updates by clicking; nothing is calculated or inferred automatically.
- **Custom Tracker builder** — lets a player create their own named counter (optionally with a card sprite), and save it as a reusable preset.
- Widgets support drag-to-reposition (position is remembered), favoriting, and optionally retaining an unclosed widget between matches — all via settings under the Deck Tracker category.

### bot/
A small Node.js bot that scrapes deck codes and metadata from a Discord server and writes them to `bot/decks.json`, which True Hub Bridge reads. Runs both as a one-off full sync (`bot.js`) and an incremental sync (`new-only-sync.js`), automated via GitHub Actions.

## Repository structure

```
packages/
  core/            shared bootstrap, settings wrapper, page-window access
  patch-maker/
  true-hub-bridge/
  deck-tracker/
  misc/            in-progress features, not yet part of the stable feature set
bot/               deck-scraping bot + decks.json
manifest.js        wires each package's init function together
build.js            esbuild bundler + userscript header
wizascript.user.js  the built, installable script
```
