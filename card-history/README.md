# Card History data

This branch holds the data behind Wizascript's **Card History** plugin. Players middle-click a card on Crafting or Decks, or an artifact on Artifacts, and Wizascript reads that card's file from here:

```
https://raw.githubusercontent.com/theWiza2341/Wizascript/card-history/card-history/data/cards/<card id>.json
https://raw.githubusercontent.com/theWiza2341/Wizascript/card-history/card-history/data/artifacts/<name>.json
```

Wizascript reads these files on demand, so anything changed here reaches players the next time they open a history. **No Wizascript update is needed.**

## What's here

| Path | What it is | Edited by |
|---|---|---|
| `rules.json` | Word lists for formatting old card text: keywords, tribes, souls, words that are never links (`notLinks`, e.g. Draw, Hand, Board) and phrases kept as plain text. | You. Read live; no rebuild needed. |
| `errata.json` | Hand corrections to the wiki's Version History. | You. Triggers a rebuild. |
| `sources/patch-notes/` | The official patch notes, Beta 12.0 onwards, as text, with one file per screenshot (`Season49.1_a.txt`). | You. Triggers a rebuild. |
| `assets/sprites/` | Old art for reworked cards whose old art is gone from the game's server. | You. Triggers a rebuild. |
| `build/` | The build script (Node, no dependencies). | You. Triggers a rebuild. |
| `cache/` | Last good copies of the wiki pages, used when a wiki can't be reached. | The Action. |
| `data/` | The built histories. `index.json` has the build time and newest version, and `build-log.txt` says what the build did. | The Action. Don't edit by hand. |

## How a history is built

For what a card **was**, the build trusts the game's own data first: feildmaster's [Card-Tracker](https://github.com/UCProjects/Card-Tracker), which has recorded every card since 2019. For **when** and **how** it changed, the sources are ranked:

1. The official patch notes in `sources/patch-notes/`.
2. Fandom's [Version History](https://undercards.fandom.com/wiki/Version_History).
3. The [Miraheze wiki](https://undercards.miraheze.org/)'s patch records.
4. Fandom's per-card *Previous Versions* pages, for the earliest versions.

When the patch notes and Version History give different numbers, the patch notes win, and the fix is listed in `data/build-log.txt`.

Artifacts have no game-data record, so they come from the wikis and patch notes only. Their rarity follows one rule: today's rarity (from the game) holds for every earlier version unless a rarity change is stated.

Anything the sources can't settle is marked with a **\*** in Wizascript, with a note when the player hovers the version number. When a change's exact patch isn't known, the earliest patch it could be is shown.

## The Action

`.github/workflows/card-history.yml` ("Card History data") rebuilds `data/`:

- on the 2nd and 16th of each month (this schedule runs from the copy on `main`),
- whenever `build/`, `errata.json`, `sources/` or `assets/` change on this branch,
- by hand: **Actions → Card History data → Run workflow**.

It clones Card-Tracker, reads the wikis (falling back to `cache/` if one can't be reached), builds, and commits `data/` and `cache/` back to this branch. It needs **Settings → Actions → General → Workflow permissions** set to **Read and write permissions**. No bot account or token is needed.

After a run, check `data/build-log.txt`. A line like `Fandom Version History: unreachable` means a wiki blocked the runner and the cached copy was used. That's fine for a while, but the cache won't pick up new patches until the wiki can be reached again.

## Common fixes

**A word is coloured or linked when it shouldn't be** (or isn't when it should): edit `rules.json`. Keywords, tribes and souls are lowercase. `notLinks` lists card or artifact names never to link. No rebuild is needed.

**The wiki got a change wrong:** add an entry to `errata.json`:

```json
{ "version": "Beta 105.0", "name": "Generous Gifts", "action": "remove", "why": "Version History pasted Flowey's text here." }
{ "version": "Beta 28.0", "name": "Clam Girl", "action": "replace", "text": "Clam Girl -- Cost 7 > 6.", "why": "..." }
{ "version": "Beta 60.0", "name": "Some Card", "action": "add", "text": "Some Card -- ATK 2 > 3.", "section": "Balancing (Monsters)", "why": "..." }
```

`version` is written as the wiki writes it (`Beta 105.0`, `Alpha 2.7`).

**A patch note transcription has a typo:** fix the `.txt` file. Each line is `* Card Name -- CHANGE.` under `## Section` headings. A trailing `{green}` colour tag is ignored.

**A new patch came out:** nothing is needed, since the next scheduled run picks it up from the wikis. You can also add its notes as `sources/patch-notes/Season124_a.txt` (`_b`, `_c` for more screenshots, `Season124.1_a.txt` for a mid-season patch). The first line should carry its version, e.g. `Beta 124.0 (2026/10/20)`. This is optional, but it lets the notes correct the wiki.

## Running it yourself

```
git clone https://github.com/UCProjects/Card-Tracker.git /tmp/card-tracker
node card-history/build/build.js --tracker /tmp/card-tracker
node card-history/build/build.js --tracker /tmp/card-tracker --only "Clam Girl"   # print one card, write nothing
node card-history/build/build.js --tracker /tmp/card-tracker --offline            # wikis from cache/ only
```

The build needs Node 18 or newer and has no npm dependencies.

## Credits

- [Undercards Wiki](https://undercards.fandom.com/) (Fandom) and [The Undercards Wiki](https://undercards.miraheze.org/) (Miraheze). Wiki text is CC BY-SA.
- feildmaster's [Card-Tracker](https://github.com/UCProjects/Card-Tracker) (MIT).
- Undercards' official patch notes, transcribed from the in-game announcements.
- Legacy card sprites in `assets/sprites/`, used with permission.
