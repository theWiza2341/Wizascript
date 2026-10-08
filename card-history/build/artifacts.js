// card-history/build/artifacts.js
//
// Artifact histories. There's no game-data tracker for artifacts, so they come
// from the wikis only: Version History's artifact sections, plus Miraheze
// (introductions, renames it alone records, changes Version History lacks).
// Built for every artifact name the wikis mention, so today's name always has
// a file. Rarity is left raw (release mentions + stated changes): the plugin
// applies the rule "today's rarity holds unless a change is stated", using the
// game's own artifact list.

const CH = require('./core.js');

const slug = (name) => CH.norm(name) || 'unnamed';

function artifactNames(vh, rows) {
  const names = new Set();
  vh.forEach((v) => v.entries.forEach((e) => {
    if (!/artifact/i.test(e.section)) return;
    const sp = CH.splitArtifactEntry(e.text);
    if (!sp) return;
    [sp.name, sp.renamedTo, sp.renamedFrom].forEach((n) => { if (n) names.add(n.trim()); });
  }));
  const artSubjects = new Set(rows.filter((r) => r.type === 'new' && /\bartifact\b/i.test(CH.mhText(r.change).split('\n')[0])).map((r) => r.subject));
  artSubjects.forEach((n) => names.add(n));
  // Renames only Miraheze records (122.0's Veteran -> Power Band): follow them from any known artifact name.
  const renames = CH.mhRenames(rows);
  for (let pass = 0; pass < 4; pass++) {
    renames.forEach((x) => { if (names.has(x.from) || artSubjects.has(x.from)) names.add(x.to); });
  }
  return [...names].filter((n) => n && n.length < 40);
}

function buildArtifact(name, ctx) {
  // Miraheze rows: this name, then the names Miraheze says it was renamed from.
  let names = [name];
  let rows = (ctx.mhBySubject.get(name) || []).slice();
  for (let hop = 0; hop < 4; hop++) {
    const more = CH.mhRenames(rows).map((x) => x.from).filter((n) => !names.includes(n) && !ctx.cardNames.has(n));
    if (!more.length) break;
    names = names.concat(more);
    more.forEach((n) => { rows = rows.concat(ctx.mhBySubject.get(n) || []); });
  }
  const r = CH.artifactEvents(ctx.vh, name, CH.mhRenames(rows));
  const vhNames = [r.oldestName, ...r.events.filter((e) => e.renamedFrom).map((e) => e.renamedFrom)].filter((n) => n && !names.includes(n) && !ctx.cardNames.has(n));
  vhNames.forEach((n) => { rows = rows.concat(ctx.mhBySubject.get(n) || []); });
  // Same subject as a card: keep only rows about an artifact.
  const subjects = new Set(rows.map((x) => x.subject));
  subjects.forEach((s) => {
    const intros = rows.filter((x) => x.subject === s && x.type === 'new');
    if (intros.length && !intros.some((x) => /\bartifact\b/i.test(CH.mhText(x.change).split('\n')[0]))) rows = rows.filter((x) => x.subject !== s);
  });
  const built = CH.buildArtifactVersions(ctx.vh, { name }, rows);
  const versions = CH.finalizeVersions(built.versions.map((v) => ({ ...v, cost: 0 })));
  if (!versions.length) return null;
  return {
    name,
    oldestName: built.oldestName,
    miraheze: rows.length > 0,
    mirahezeVersions: rows.map((row) => CH.mhVersion(row)).map((v) => ({ label: v.label, key: v.key })),
    versions: versions.map((v) => ({
      version: v.version ? { label: v.version.label, date: v.version.date || '', guessed: !!v.version.guessed, source: v.version.source || undefined, key: CH.versionKey(v.version) } : null,
      name: v.name,
      text: v.textKnown ? v.text : null,
      textKnown: !!v.textKnown && !CH.looksTruncated(v.text),
      rarity: v.rarity || undefined,
      rarityFrom: v.rarityFrom || undefined,
      note: v.note || undefined
    }))
  };
}

module.exports = { artifactNames, buildArtifact, slug };
