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
      if (f) { first = f; if (!first.name) first.name = r.oldestName; source = `Previous Versions (${title.replace(/_/g, ' ')})`; break; }
    }
  }
  const built = CH.buildVersions(walkCurrent, r.events, first);

  // After the tracker starts, today's name (following renames) gives version numbers and text.
  let wikiAll = built.versions;
  if (tf) {
    const today = CH.cardEvents(ctx.vh, card.name);
    const todayBuilt = CH.buildVersions(current, today.events, null);
    wikiAll = built.versions.concat(todayBuilt.versions.filter((v) => v.version && v.version.date && CH.ymd(v.version.date) >= tf.when));
  }
  const merged = CH.mergeTracker(wikiAll, snaps, ctx.vh);
  let versions = merged.versions;

  // Miraheze (old names too, unless another card has that name today).
  const names = [...new Set([card.name, walkName, r.oldestName, ...versions.map((v) => v.name)])]
    .filter((n) => n && (n === card.name || !ctx.otherCardNames(card.id).has(n)));
  const rows = names.flatMap((n) => ctx.mhBySubject.get(n) || []);
  const mh = CH.applyMiraheze(versions, rows, { introName: r.oldestName });
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
