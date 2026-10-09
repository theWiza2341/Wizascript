#!/usr/bin/env node
// card-history/build/build.js
//
// Builds every card's and artifact's history into card-history/data/.
// Run by the "Card History data" GitHub Action; can also be run by hand:
//
//   git clone https://github.com/UCProjects/Card-Tracker.git /tmp/card-tracker
//   node card-history/build/build.js --tracker /tmp/card-tracker
//
// Options: --tracker <Card-Tracker clone>  --out <dir> (default card-history/data)
//          --cache <dir> (default card-history/cache)  --offline (wikis from cache only)
//          --only <card id or name> (print one card's result, write nothing)
//
// Credits: Undercards Wiki (Fandom) and The Undercards Wiki (Miraheze), CC BY-SA;
// feildmaster's Card-Tracker (MIT). Patch notes: Undercards' in-game announcements.

const fs = require('fs');
const path = require('path');
const CH = require('./core.js');
const sources = require('./sources.js');
const { readPatchNotes, applyPatchNotes, applyErrata } = require('./patch-notes.js');
const { buildCard, wantedPages } = require('./cards.js');
const { artifactNames, buildArtifact, slug } = require('./artifacts.js');

const ROOT = path.resolve(__dirname, '..');
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback; };
const flag = (name) => process.argv.includes(`--${name}`);

const OUT = path.resolve(arg('out', path.join(ROOT, 'data')));
const CACHE = path.resolve(arg('cache', path.join(ROOT, 'cache')));
const TRACKER = arg('tracker', null);
const ONLY = arg('only', null);
const OFFLINE = flag('offline');

const lines = [];
const log = (s) => { lines.push(s); console.log(s); };

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data)}\n`);
}

async function main() {
  if (!TRACKER) throw new Error('--tracker <path to a Card-Tracker clone> is required');
  const started = Date.now();
  if (OFFLINE) process.env.CARD_HISTORY_OFFLINE = '1';

  // ---- sources ----
  const vhSrc = await sources.versionHistory(CACHE, log);
  const vh = CH.parseVersionHistory(vhSrc.text);
  log(`Version History: ${vh.length} versions`);
  const notes = readPatchNotes(path.join(ROOT, 'sources', 'patch-notes'));
  const noteLog = applyPatchNotes(vh, notes);
  log(`Patch notes: ${notes.length} versions read, ${noteLog.length} corrections/additions to Version History`);
  noteLog.forEach((l) => log(`  ${l}`));
  let errata = {};
  try { errata = JSON.parse(fs.readFileSync(path.join(ROOT, 'errata.json'), 'utf8')); } catch (e) { log(`errata.json not read: ${e.message}`); }
  applyErrata(vh, errata).forEach((l) => log(`  ${l}`));

  const rows = await sources.mirahezeRows(CACHE, log);
  const mhBySubject = new Map();
  rows.forEach((r) => { if (!mhBySubject.has(r.subject)) mhBySubject.set(r.subject, []); mhBySubject.get(r.subject).push(r); });

  const tracker = await sources.cardTracker(path.resolve(TRACKER), log);
  const cards = tracker.current.filter((c) => c && c.id != null && c.name);
  const byName = new Map();
  cards.forEach((c) => { if (!byName.has(c.name)) byName.set(c.name, []); byName.get(c.name).push(c.id); });
  const cardNames = new Set(cards.map((c) => c.name));
  const sprites = new Set(fs.readdirSync(path.join(ROOT, 'assets', 'sprites')).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)));

  const ctx = {
    vh, snaps: tracker.snaps, mhBySubject, sprites, cardNames,
    otherCardNames: (id) => new Set(cards.filter((c) => c.id !== id).map((c) => c.name)),
    pvTitle: sources.pvTitle, pv: new Map()
  };

  const selected = ONLY ? cards.filter((c) => String(c.id) === ONLY || CH.norm(c.name) === CH.norm(ONLY)) : cards;
  const titles = [...new Set(selected.flatMap((c) => wantedPages(c, ctx)).map(sources.pvTitle))];
  ctx.pv = await sources.previousVersions(titles, CACHE, log);

  // ---- cards ----
  const newest = vh.find((v) => v.date);
  const index = { builtAt: new Date().toISOString(), newestVersion: newest ? { label: newest.label, date: newest.date } : null, cards: {}, artifacts: {}, sources: {
    versionHistory: vhSrc.live ? 'live' : 'cached', mirahezeRows: rows.length, cardTracker: tracker.head, patchNoteVersions: notes.length
  } };
  let failed = 0;
  for (const card of selected) {
    try {
      const data = buildCard(card, ctx);
      if (ONLY) { console.log(JSON.stringify(data, null, 1)); continue; }
      writeJson(path.join(OUT, 'cards', `${card.id}.json`), data);
      index.cards[card.id] = data.versions.length;
    } catch (e) {
      failed++;
      log(`card ${card.id} ${card.name}: FAILED ${e.stack.split('\n').slice(0, 5).join(' ')}`);
    }
  }
  if (ONLY) return;
  log(`Cards: ${Object.keys(index.cards).length} written, ${failed} failed`);

  // ---- artifacts ----
  const artNames = artifactNames(vh, rows);
  let artCount = 0;
  artNames.forEach((name) => {
    try {
      const data = buildArtifact(name, ctx);
      if (!data) return;
      writeJson(path.join(OUT, 'artifacts', `${slug(name)}.json`), data);
      index.artifacts[slug(name)] = data.versions.length;
      artCount++;
    } catch (e) {
      log(`artifact ${name}: FAILED ${e.message}`);
    }
  });
  log(`Artifacts: ${artCount} written (${artNames.length} names in the wikis)`);

  index.seconds = Math.round((Date.now() - started) / 1000);
  writeJson(path.join(OUT, 'index.json'), index);
  fs.writeFileSync(path.join(OUT, 'build-log.txt'), `${lines.join('\n')}\n`);
  if (failed > selected.length / 2) process.exitCode = 1; // something is badly wrong; don't publish
}

main().catch((e) => { console.error(e); process.exit(1); });
