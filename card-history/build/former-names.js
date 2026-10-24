'use strict';
// Former card names, for linking old card text to the right card.
//
// Old wiki text uses the names cards had back then ("Summon a Blue Flower").
// The plugin links card names in that text, but only knows today's names, so
// "Blue Flower" used to link the newer card "Blue" instead of Blue Rose.
//
// For every card, each run of versions under a name that isn't its name today
// becomes one entry: { name, id, from, until }, where `from` is the version
// key of the first version with that name and `until` the key of the version
// that renamed it (the name was in use for from <= key < until). Names can be
// reused (Acceleration, Clover, Rage, Faded Memory), so the plugin only uses an
// entry for text written in that era.

function formerNames(cards) {
  const out = [];
  cards.forEach(({ id, name: today, versions }) => {
    let run = null;
    const close = (until) => {
      if (run && run.name !== today) out.push({ name: run.name, id, from: run.from, until });
      run = null;
    };
    (versions || []).forEach((v) => {
      const key = v && v.version && v.version.key;
      const name = v && typeof v.name === 'string' ? v.name.trim() : '';
      if (!Array.isArray(key) || !name) return;
      if (run && run.name === name) return;
      close(key);
      run = { name, from: key };
    });
    close(null); // a name still in use at the newest version (shouldn't differ from today's, but kept open-ended)
  });
  return out.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
}

module.exports = { formerNames };
