// card-history/build/patch-notes.js
//
// The official patch notes (sources/patch-notes/SeasonX_y.txt, transcribed
// from the in-game announcements, Beta 12.0 onwards) checked against the
// wiki's Version History:
//   - a stat change the notes give differently -> the notes win;
//   - a card change the notes have and Version History doesn't -> added.
// Effect text is left to Version History (the transcriptions may have small
// typos in long texts). To correct a transcription, edit its .txt file.
//
// File format: "## Section", "* bullet" (an optional trailing {colour} tag and
// leading [icon] tag are ignored). "Beta 12.0 (2017/07/03)" inside a file sets
// the version for that file and the next parts (_b, _c...) of the same patch.

const fs = require('fs');
const path = require('path');
const CH = require('./core.js');

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

// -> [{ label: 'Beta 12.0', entries: [{ section, text, file }] }]
function readPatchNotes(dir) {
  if (!fs.existsSync(dir)) return [];
  const keyOf = (f) => { const m = f.match(/^Season([\d.]+)_([a-z])/i); if (!m) return null; const p = m[1].split('.'); return { ver: `${p[0]}.${p[1] || '0'}`, part: m[2] }; };
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.txt') && keyOf(f));
  files.sort((a, b) => { const x = keyOf(a); const y = keyOf(b); return parseFloat(x.ver) - parseFloat(y.ver) || x.part.localeCompare(y.part); });
  const groups = new Map();
  let lastFileVer = null;
  let heading = null;
  files.forEach((f) => {
    const k = keyOf(f);
    const txt = fs.readFileSync(path.join(dir, f), 'utf8');
    const h = txt.match(/Beta\s+(\d+\.\d+)/);
    if (k.ver !== lastFileVer) { lastFileVer = k.ver; heading = null; }
    if (h && !heading) heading = h[1];
    const label = `Beta ${heading || k.ver}`;
    if (!groups.has(label)) groups.set(label, { label, entries: [] });
    let section = '';
    txt.split('\n').forEach((l) => {
      const t = l.trim();
      if (/^##\s*/.test(t)) { section = t.replace(/^##\s*/, ''); return; }
      if (!/^\*\s/.test(t)) return;
      const text = t.replace(/^\*\s*/, '').replace(/\s*\{[a-z]+\}\s*$/i, '').replace(/^\[[^\]]*\]\s*/, '').trim();
      if (text) groups.get(label).entries.push({ section, text, file: f });
    });
  });
  return [...groups.values()];
}

// Merge the notes into parsed Version History (in place). -> log lines
function applyPatchNotes(vh, notes) {
  const log = [];
  const byLabel = new Map(vh.map((v) => [v.label, v]));
  notes.forEach((pv) => {
    const v = byLabel.get(pv.label);
    if (!v) return;
    const index = new Map(); // norm name -> entry
    v.entries.forEach((e) => { const sp = CH.splitEntry(e.text); if (sp) sp.names.forEach((n) => index.set(CH.norm(n), e)); });
    pv.entries.forEach((pe) => {
      if (pe.text.includes('|')) return; // "new card" picture rows: new values only, nothing to compare
      const sp = CH.splitEntry(pe.text);
      if (!sp) return;
      const ch = CH.parseChanges(sp.body);
      const stats = ['cost', 'atk', 'hp'].filter((k) => ch[k] && ch[k][0] !== null);
      const name = sp.names[sp.names.length - 1];
      const n = CH.norm(name);
      let e = index.get(n);
      if (!e) {
        // A typo on one side ("Jevilstall" / "Jevilstail"): only if exactly one name is that close.
        const near = [...index.keys()].filter((k) => Math.abs(k.length - n.length) <= 2 && lev(k, n) <= 2);
        if (near.length === 1) e = index.get(near[0]);
      }
      if (e) {
        const vsp = CH.splitEntry(e.text);
        const vch = CH.parseChanges(vsp.body);
        const wrong = stats.filter((k) => vch[k] && vch[k][0] !== null && (vch[k][0] !== ch[k][0] || vch[k][1] !== ch[k][1]));
        if (!wrong.length) return;
        let body = vsp.body;
        wrong.forEach((k) => {
          const word = { cost: 'COST', atk: 'ATK', hp: 'HP' }[k];
          body = body.replace(new RegExp(`\\b(${word})(\\s*:?\\s*)(\\d+)(\\s*(?:>|->)\\s*)(\\d+)`, 'i'), `$1$2${ch[k][0]}$4${ch[k][1]}`);
        });
        log.push(`${v.label} ${vsp.names[vsp.names.length - 1]}: ${wrong.map((k) => `${k.toUpperCase()} ${vch[k][0]} > ${vch[k][1]} -> ${ch[k][0]} > ${ch[k][1]}`).join(', ')} (patch notes, ${pe.file})`);
        e.text = `${vsp.names.join(' > ')} -- ${body}`;
        return;
      }
      if (!stats.length && ch.text === undefined && !ch.rarity) return;
      const section = pe.section || (/spell/i.test(pe.section) ? 'Balancing (Spells)' : 'Balancing (Monsters)');
      v.entries.push({ section, text: `${sp.names.join(' > ')} -- ${sp.body}`, fromPatchNotes: true });
      log.push(`${v.label} ${name}: added from the patch notes (${pe.file})`);
    });
  });
  return log;
}

// Hand corrections (errata.json). -> log lines
function applyErrata(vh, errata) {
  const log = [];
  const byLabel = new Map(vh.map((v) => [v.label, v]));
  ((errata && errata.versionHistory) || []).forEach((fix) => {
    const v = byLabel.get(fix.version);
    if (!v) { log.push(`errata: no version "${fix.version}"`); return; }
    const n = CH.norm(fix.name);
    const i = v.entries.findIndex((e) => { const sp = CH.splitEntry(e.text) || CH.splitArtifactEntry(e.text); return sp && (sp.names ? sp.names.map(CH.norm).includes(n) : CH.norm(sp.name) === n); });
    if (fix.action === 'remove') {
      if (i >= 0) { v.entries.splice(i, 1); log.push(`errata: removed ${fix.name} from ${fix.version}`); }
    } else if (fix.action === 'replace' || fix.action === 'add') {
      const entry = { section: fix.section || (i >= 0 ? v.entries[i].section : 'Balancing (Monsters)'), text: fix.text, fromErrata: true };
      if (i >= 0 && fix.action === 'replace') v.entries[i] = entry; else v.entries.push(entry);
      log.push(`errata: ${fix.action} ${fix.name} in ${fix.version}`);
    }
  });
  return log;
}

module.exports = { readPatchNotes, applyPatchNotes, applyErrata };
