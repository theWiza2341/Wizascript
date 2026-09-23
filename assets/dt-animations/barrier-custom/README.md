# The Barrier: custom clips

Clips for The Barrier's **Custom** style. Each time The Barrier plays with
that style, one clip from this folder is picked at random. It's never the
same clip twice in a row.

## Adding a clip

1. Make it with the Clip Squisher page: up to 3.1 s long, saved as `.webm`.
2. Drop the `.webm` file into this folder.
3. Add its line to `clips.json`. The Squisher gives you the line to copy.
   ```json
   {
     "clips": [
       {"file":"my-clip.webm","title":"My clip","durationMs":3100},
       {"file":"another.webm","title":"Another one","durationMs":2800},
     ]
   }
   ```
   A trailing comma after the last line is fine.
4. Commit it to the branch you're testing on. Dev builds read from `dev`
   and stable builds read from `main`.

## Fields

- `file`: the file name in this folder.
- `title`: shown in the debug panel's clip picker and in the console log.
- `durationMs`: how long the clip stays on screen before fading out.
  The maximum is 3100.
- `enabled`: optional. Set it to `false` to keep a clip in the folder
  without it ever being picked.

## Testing a clip

Turn on **Debug mode** in the DT Animations settings, then open a match.
In the debug panel:

1. Pick **The Barrier**.
2. Pick the clip, or **Custom: random clip**, from the second list.
3. Press **Play**.

**↻** reloads `clips.json`, so a clip you just pushed shows up without
refreshing the page. GitHub can take up to about 5 minutes to serve the
new version.

Keep clips small (480p is usually 150–400 KB). Every player who uses
Custom downloads them.
