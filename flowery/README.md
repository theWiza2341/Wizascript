# Flowery voice clips

Flowery's voice clips, collected from the Undercards wiki for Wizascript's **Flowery Mode**. The game's own Flowery lines stay on undercards.net (`/sounds/flowery*.wav`) and are played from there; this folder holds the clips the site doesn't have, so later versions of Flowery Mode can play them for conditions of our own.

**License:** free to use for non-commercial purposes only. Wizascript is free and non-commercial. Don't use these clips in anything sold or monetised.

- `index.json` lists every clip: `file`, `title` (from the wiki's file name), `seconds`, and `use` (the cards or moments it's meant for; empty = not used yet). Wizascript reads it, so adding a clip and its entry here needs no script update.
- URLs are `https://raw.githubusercontent.com/theWiza2341/Wizascript/sounds/flowery/` + the file name. File names contain `'` and `,`, so build them with `encodeURIComponent(file)`.
- Format: WAV (16-bit, 44.1 kHz), like the game's own sounds. GitHub serves them as `audio/wav` with `Access-Control-Allow-Origin: *`.
- Adding a clip: upload it here (Add file → Upload files, on the `sounds` branch), then add its entry to `index.json`.

This branch is data only. It's never merged into `main`.
