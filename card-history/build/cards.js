// card-history/build/cards.js
//
// One card's history, from all sources (what the console tests did in the
// browser, now done once per build):
//   1. Card-Tracker (game data) from where it starts;
//   2. the wiki before that, walking back from the name and stats the card had
//      when the tracker first saw it (names get reused: today's Explosion was
//      "Mine", the old Explosion is today's Reload);
//   3. the first version from Version History's release line, else the card's
//      Previous Versions page;
//   4. Miraheze for exact patch numbers, Pre-Alpha releases and missing stat changes;
//   5. powers per version (game data, else read from the text).
// The result is a plain JSON file the plugin only has to draw.

const CH = require('./core.js');

const isMonster = (c) => c.typeCard === 0;

// Prepare: which Previous Versions pages a card may need (asked in one batch).
function wantedPages(card, ctx) {
  const tf = CH.trackerFirst(ctx.snaps.get(String(card.id)) || [], ctx.vh);
  const vhPre = tf ? ctx.vh.filter((v) => !v.date || CH.ymd(v.date) < tf.when) : ctx.vh;
  const walkName = tf ? tf.state.name : card.name;
  const r = CH.cardEvents(vhPre, walkName);
  if (r.creation) return [];
  return [...new Set([r.oldestName, walkName, card.name])].filter(Boolean);
}

function buildCard(card, ctx) {
  const snaps = ctx.snaps.get(String(card.id)) || [];
  const mon = isMonster(card);
  const current = { name: card.name, cost: card.cost, atk: mon ? card.attack : undefined, hp: mon ? card.hp : undefined, rarity: card.rarity };
  const tf = CH.trackerFirst(snaps, ctx.vh);
  const vhPre = tf ? ctx.vh.filter((v) => !v.date || CH.ymd(v.date) < tf.when) : ctx.vh;
  const walkName = tf ? tf.state.name : card.name;
  const walkCurrent = tf
    ? { name: tf.state.name, cost: tf.state.cost, atk: mon ? tf.state.attack : undefined, hp: mon ? tf.state.hp : undefined, rarity: tf.state.rarity }
    : current;
  const r = CH.cardEvents(vhPre, walkName);
  let first = r.creation;
  let source = first ? 'Version History' : null;
  let pvTitle = null;
  if (!first) {
    for (const name of [...new Set([r.oldestName, walkName, card.name])].filter(Boolean)) {
      const title = ctx.pvTitle(name);
      const text = ctx.pv.get(title);
      if (!text) continue;
      pvTitle = title;
      const f = CH.parsePreviousVersions(text);
      // Test of Will's page starts at Beta 19.0 (it only covers Test of Will, not
      // Heal Delivery before it): a "first version" newer than events the walk
      // found isn't the card's first version.
      const fk = f && f.version && !f.version.before ? CH.versionKey(f.version) : null;
      const older = fk && r.events.some((e) => { const k = CH.versionKey(e.version); return k && (k[0] - fk[0] || k[1] - fk[1]) < 0; });
      if (older) { pvTitle = title; continue; }
      if (f) { first = f; if (!first.name) first.name = r.oldestName; source = `Previous Versions (${title.replace(/_/g, ' ')})`; break; }
    }
  }
  const built = CH.buildVersions(walkCurrent, r.events, first);

  // After the tracker starts, today's name (following renames) gives version numbers and text.
  let wikiAll = built.versions;
  if (tf) {
    const today = CH.cardEvents(ctx.vh, card.name);
    // Names the game used that Version History never renames (Receptionist 1
    // became Fish Receptionist in 122.0, a rename only Miraheze lists): its
    // entries under the older name still label the tracker's versions. Each
    // name's entries are taken from the dates the tracker saw that name.
    const covered = new Set([card.name, today.oldestName, ...today.events.map((e) => e.name)].map(CH.norm));
    const compact = CH.compactTracker(snaps);
    const eras = [];
    compact.forEach((t) => {
      const when = CH.snapshotDate(t, ctx.vh);
      const last = eras[eras.length - 1];
      if (!last || last.name !== t.state.name) eras.push({ name: t.state.name, from: last ? last.seenUntil : tf.when, seenUntil: when, until: when });
      else last.seenUntil = when;
    });
    eras.forEach((e, i) => { e.until = eras[i + 1] ? eras[i + 1].until : null; });
    const haveLabel = new Set(today.events.map((e) => e.version.label));
    eras.filter((e) => e.name && !covered.has(CH.norm(e.name))).forEach((e) => {
      const inEra = ctx.vh.filter((v) => v.date && CH.ymd(v.date) >= e.from && (!e.until || CH.ymd(v.date) <= e.until));
      CH.cardEvents(inEra, e.name).events.forEach((ev) => {
        if (haveLabel.has(ev.version.label)) return;
        haveLabel.add(ev.version.label);
        today.events.push(ev);
      });
    });
    today.events.sort((a, b) => { const ka = CH.versionKey(a.version) || [0, 0]; const kb = CH.versionKey(b.version) || [0, 0]; return (kb[0] - ka[0]) || (kb[1] - ka[1]); });
    // Released on the day the tracker first saw it (Wheelvil, Beta 81.0): the
    // walk above stops before that day, so take the release line from here.
    const useCreation = !first && today.creation && today.creation.version && today.creation.version.date && CH.ymd(today.creation.version.date) >= tf.when;
    const todayBuilt = CH.buildVersions(current, today.events, useCreation ? today.creation : null);
    wikiAll = built.versions.concat(todayBuilt.versions.filter((v) => v.version && v.version.date && CH.ymd(v.version.date) >= tf.when));
  }
  const merged = CH.mergeTracker(wikiAll, snaps, ctx.vh);
  let versions = merged.versions;

  // Miraheze (old names too, unless another card has that name today).
  const names = [...new Set([card.name, walkName, r.oldestName, ...versions.map((v) => v.name)])]
    .filter((n) => n && (n === card.name || !ctx.otherCardNames(card.id).has(n)));
  const rows = names.flatMap((n) => ctx.mhBySubject.get(n) || []);
  // The card as the tracker first saw it, and the patch in effect then.
  let trackerFirst = null;
  if (tf) {
    const inEffect = ctx.vh.filter((v) => v.date && CH.ymd(v.date) <= tf.when)[0]; // vh is newest first
    trackerFirst = { key: inEffect ? CH.versionKey(inEffect) : null, state: { cost: tf.state.cost, atk: tf.state.attack, hp: tf.state.hp } };
  }
  const mh = CH.applyMiraheze(versions, rows, { introName: r.oldestName, trackerFirst });
  if (mh.log.length) versions = mh.versions;
  versions = CH.finalizeVersions(versions);
  versions = CH.assignPowers(versions, card.statuses);

  // Today's card, if the history doesn't reach it: Miraheze's newest later entry.
  const last = versions[versions.length - 1];
  const lk = last && CH.versionKey(last.version);
  const newer = rows.map((row) => CH.mhVersion(row))
    .filter((mv) => !lk || mv.key[0] > lk[0] || (mv.key[0] === lk[0] && mv.key[1] > lk[1]))
    .sort((a, b) => b.key[0] - a.key[0] || b.key[1] - a.key[1])[0];

  const sprite = (name) => {
    if (!name || name === card.name) return undefined;
    const file = name.replace(/ /g, '_');
    return ctx.sprites.has(file) ? file : undefined;
  };
  const notes = merged.trackerStart ? built.notes.filter((n) => !/History ends/.test(n)) : built.notes;
  return {
    id: card.id,
    name: card.name,
    firstFrom: source,
    pvTitle,
    trackerStart: merged.trackerStart || null,
    miraheze: mh.log.length > 0,
    notes,
    newestMiraheze: newer ? { label: newer.label, key: newer.key } : null,
    versions: versions.map((v) => ({
      version: v.version ? { label: v.version.label, date: v.version.date || '', guessed: !!v.version.guessed, before: !!v.version.before, source: v.version.source || undefined, key: CH.versionKey(v.version) } : null,
      name: v.name,
      cost: v.cost,
      atk: v.atk,
      hp: v.hp,
      rarity: v.rarity,
      sameAsToday: v.text === CH.CURRENT_TEXT || undefined,
      text: v.text === CH.CURRENT_TEXT ? null : v.text,
      textKnown: !!v.textKnown && v.text !== CH.CURRENT_TEXT,
      truncated: v.textKnown && !v.gameText && v.text !== CH.CURRENT_TEXT && CH.looksTruncated(v.text) ? true : undefined,
      gameText: v.gameText || undefined,
      legacy: CH.isLegacy(v) || undefined,
      tribes: v.tribes,
      statuses: v.statuses,
      soul: v.soul,
      image: v.image,
      sprite: sprite(v.name),
      source: v.source,
      note: v.note || undefined
    }))
  };
}

module.exports = { buildCard, wantedPages };
