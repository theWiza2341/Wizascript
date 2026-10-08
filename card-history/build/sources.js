// card-history/build/sources.js
//
// Everything Card History reads, fetched once per build:
//   - Fandom: Version History, and Previous Versions pages (50 per request)
//   - Miraheze: the whole Bucket:Patch table (500 rows per request)
//   - feildmaster's Card-Tracker: every card's snapshots, from a local git clone
// Each wiki read is also saved under card-history/cache/, and used instead when
// a wiki can't be reached (e.g. if it blocks GitHub's servers).

const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const FANDOM = 'https://undercards.fandom.com/api.php';
const MIRAHEZE = 'https://undercards.miraheze.org/w/api.php';
const UA = 'WizascriptCardHistory/1.0 (+https://github.com/theWiza2341/Wizascript; build bot)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 3) {
  if (process.env.CARD_HISTORY_OFFLINE) throw new Error('offline');
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      last = e;
      await sleep(1500 * (i + 1));
    }
  }
  throw last;
}

function readCache(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
}
function writeCache(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

// ---------- Fandom ----------
async function versionHistory(cacheDir, log) {
  const file = path.join(cacheDir, 'version-history.wikitext');
  try {
    const d = await getJson(`${FANDOM}?action=parse&page=Version_History&prop=wikitext&format=json`);
    const text = d && d.parse && d.parse.wikitext && d.parse.wikitext['*'];
    if (!text) throw new Error('empty page');
    writeCache(file, text);
    log('Fandom Version History: read live');
    return { text, live: true };
  } catch (e) {
    const text = readCache(file);
    if (!text) throw new Error(`Version History unreachable (${e.message}) and no cached copy`);
    log(`Fandom Version History: unreachable (${e.message}), using the cached copy`);
    return { text, live: false };
  }
}

const pvTitle = (name) => `${String(name).replace(/ /g, '_')}/Previous_Versions`;
const pvFile = (cacheDir, title) => path.join(cacheDir, 'pv', `${title.replace(/[^A-Za-z0-9_.-]+/g, '_')}.wikitext`);

// -> Map(title -> wikitext | null when the page doesn't exist)
async function previousVersions(titles, cacheDir, log) {
  const out = new Map();
  const missingFile = path.join(cacheDir, 'pv', '_missing.json');
  let knownMissing = [];
  try { knownMissing = JSON.parse(readCache(missingFile) || '[]'); } catch (e) { /* none */ }
  const missing = new Set(knownMissing);
  const list = [...new Set(titles)];
  let live = 0;
  let cached = 0;
  for (let i = 0; i < list.length; i += 50) {
    const batch = list.slice(i, i + 50);
    try {
      const q = new URLSearchParams({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', format: 'json', formatversion: '2', redirects: '1', titles: batch.join('|') });
      const d = await getJson(`${FANDOM}?${q}`);
      const norm = new Map(); // title as asked -> as returned
      ((d.query && d.query.normalized) || []).forEach((n) => norm.set(n.from, n.to));
      ((d.query && d.query.redirects) || []).forEach((n) => norm.set(norm.get(n.from) || n.from, n.to));
      const pages = new Map(((d.query && d.query.pages) || []).map((p) => [p.title, p]));
      batch.forEach((t) => {
        let real = t.replace(/_/g, ' ');
        real = norm.get(t) || norm.get(real) || real;
        if (norm.has(real)) real = norm.get(real);
        const p = pages.get(real);
        const text = p && !p.missing && p.revisions && p.revisions[0] && p.revisions[0].slots ? p.revisions[0].slots.main.content : null;
        out.set(t, text);
        if (text) { writeCache(pvFile(cacheDir, t), text); missing.delete(t); } else missing.add(t);
        live++;
      });
      await sleep(400);
    } catch (e) {
      batch.forEach((t) => { out.set(t, missing.has(t) ? null : readCache(pvFile(cacheDir, t))); cached++; });
    }
  }
  writeCache(missingFile, JSON.stringify([...missing].sort(), null, 1));
  log(`Fandom Previous Versions: ${list.length} pages (${live} read live, ${cached} from cache), ${[...out.values()].filter(Boolean).length} exist`);
  return out;
}

// ---------- Miraheze ----------
async function mirahezeRows(cacheDir, log) {
  const file = path.join(cacheDir, 'miraheze-patch.json');
  try {
    const rows = [];
    for (let off = 0; off < 50000; off += 500) {
      const q = new URLSearchParams({ action: 'bucket', format: 'json', query: `bucket('patch').select('page_name','subject','version','type','change').limit(500).offset(${off}).run()` });
      const d = await getJson(`${MIRAHEZE}?${q}`);
      if (!d.bucket) throw new Error(JSON.stringify(d.error || d).slice(0, 120));
      rows.push(...d.bucket);
      if (d.bucket.length < 500) break;
      await sleep(300);
    }
    writeCache(file, JSON.stringify(rows));
    log(`Miraheze patch table: ${rows.length} rows, read live`);
    return rows;
  } catch (e) {
    const text = readCache(file);
    if (!text) { log(`Miraheze unreachable (${e.message}) and no cached copy - building without it`); return []; }
    const rows = JSON.parse(text);
    log(`Miraheze unreachable (${e.message}), using the cached copy (${rows.length} rows)`);
    return rows;
  }
}

// ---------- Card-Tracker (git) ----------
// Reads many blobs through one `git cat-file --batch` process.
function catFileBatch(repo, specs) {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', ['cat-file', '--batch'], { cwd: repo });
    const chunks = [];
    proc.stdout.on('data', (c) => chunks.push(c));
    proc.on('error', reject);
    proc.on('close', () => {
      const buf = Buffer.concat(chunks);
      const out = [];
      let pos = 0;
      for (let i = 0; i < specs.length; i++) {
        const nl = buf.indexOf(10, pos);
        const header = buf.slice(pos, nl).toString();
        pos = nl + 1;
        if (/ missing$/.test(header)) { out.push(null); continue; }
        const size = parseInt(header.split(' ')[2], 10);
        out.push(buf.slice(pos, pos + size).toString('utf8'));
        pos += size + 1;
      }
      resolve(out);
    });
    proc.stdin.end(specs.map((s) => `${s}\n`).join(''));
  });
}

// -> { snaps: Map(id -> [{ date, subject, state }] oldest first), current: [card states at HEAD] }
async function cardTracker(repo, log) {
  const raw = execFileSync('git', ['log', '--reverse', '--format=@@%H|%aI|%s', '--name-only', '--', 'cards'], { cwd: repo, maxBuffer: 1 << 28 }).toString();
  const specs = [];
  const meta = [];
  let commit = null;
  raw.split('\n').forEach((line) => {
    if (line.startsWith('@@')) {
      const [sha, date, ...subj] = line.slice(2).split('|');
      commit = { sha, date: date.slice(0, 10), subject: subj.join('|') };
      return;
    }
    const m = line.match(/^cards\/(\d+)\.json$/);
    if (m && commit) { specs.push(`${commit.sha}:${line}`); meta.push({ id: m[1], date: commit.date, subject: commit.subject }); }
  });
  const blobs = await catFileBatch(repo, specs);
  const snaps = new Map();
  blobs.forEach((b, i) => {
    if (!b) return;
    let j;
    try { j = JSON.parse(b); } catch (e) { return; }
    const m = meta[i];
    if (!snaps.has(m.id)) snaps.set(m.id, []);
    snaps.get(m.id).push({ date: m.date, subject: m.subject, state: j.card || j });
  });
  // Today's cards: the files at HEAD.
  const current = [];
  fs.readdirSync(path.join(repo, 'cards')).forEach((f) => {
    if (!/^\d+\.json$/.test(f)) return;
    try { const j = JSON.parse(fs.readFileSync(path.join(repo, 'cards', f), 'utf8')); current.push(j.card || j); } catch (e) { /* skip */ }
  });
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo }).toString().trim();
  log(`Card-Tracker: ${specs.length} snapshots of ${snaps.size} cards, ${current.length} cards today (commit ${head.slice(0, 7)})`);
  return { snaps, current, head };
}

module.exports = { versionHistory, previousVersions, pvTitle, mirahezeRows, cardTracker };
