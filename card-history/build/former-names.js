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

// The same for artifacts: { name, current, from, until }, where `current` is
// the artifact's name today (artifacts have no game id in the wiki data; the
// plugin matches `current` to the game's artifact list). Example: Outbreak was
// renamed Dark Fountain in Beta 66.1, and Soulless Kris's old text, which the
// game stores as {{ARTIFACT:34}}, should read "Outbreak" at those versions.
function formerArtifactNames(artifacts) {
  const out = [];
  artifacts.forEach(({ name: today, versions }) => {
    let run = null;
    // Skipped: case/spacing-only differences (Save / SAVE) and names that
    // were renamed in the patch that introduced them (no era to speak of).
    // Wiki lines that only look like renames ("Experience > Is no longer
    // free", the card Mine > Explosion listed under "Artifact names") can get
    // in; the plugin ignores any entry whose `current` isn't a real artifact.
    const flat = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
    const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a[0] === b[0] && a[1] === b[1];
    const close = (until) => {
      if (run && flat(run.name) !== flat(today) && !same(run.from, until)) out.push({ name: run.name, current: today, from: run.from, until });
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
    close(null);
  });
  return out.sort((a, b) => a.name.localeCompare(b.name) || a.current.localeCompare(b.current));
}

module.exports = { formerNames, formerArtifactNames };
