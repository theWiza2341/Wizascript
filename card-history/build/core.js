// card-history/build/core.js
//
// Card History's reading logic: Version History wikitext, Previous Versions
// pages, the Miraheze patch table and Card-Tracker snapshots -> every version
// of one card or artifact. Plain functions, no DOM, no network (build.js
// fetches; this file only reads). Editing this file changes what players see
// after the next "Card History data" run - no Wizascript update needed.
var CH = (function () {
  // DT and GENERATED are older spellings of DETERMINATION and TOKEN.
  const RARITIES = ['BASE', 'COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'DETERMINATION', 'TOKEN', 'GENERATED', 'MYTHIC', 'DT'];
  const RARITY_ALIAS = { DT: 'DETERMINATION', GENERATED: 'TOKEN' };
  const rarityOf = (r) => RARITY_ALIAS[r] || r;
  // Stats and rarity are read only from the part BEFORE the effect text:
  // effect texts mention rarities and numbers too ("unique TOKEN cards").
  const headOf = (body) => body.split(/\bEFFECT\b/i)[0];
  const RAR = RARITIES.join('|');
  const CURRENT_TEXT = '\u0000current';
  const norm = (s) => String(s || '').toLowerCase().replace(/&amp;/g, '&').replace(/[^a-z0-9]/g, '');

  // Wiki markup -> plain text.
  function clean(s) {
    return String(s || '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
      .replace(/'''?/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function versionInfo(heading) {
    const m = heading.match(/^(.*?)\s*\((\d{4}\/\d{2}\/\d{2})\)\s*$/);
    const label = clean(m ? m[1] : heading);
    const date = m ? m[2] : '';
    const num = label.match(/(Alpha|Beta)\s*([\d.]+)/i);
    const season = num && /beta/i.test(num[1]) ? parseInt(num[2], 10) : null;
    return { label, date, season };
  }

  // -> [{ label, date, season, entries: [{ section, text }] }], newest first.
  function parseVersionHistory(wikitext) {
    const lines = String(wikitext).replace(/<!--[\s\S]*?-->/g, '').split('\n');
    const versions = [];
    let cur = null;
    let section = '';
    for (const raw of lines) {
      const line = raw.trim();
      let m = line.match(/^===\s*(.*?)\s*===$/);
      if (m) { cur = { ...versionInfo(m[1]), entries: [] }; versions.push(cur); section = ''; continue; }
      if (/^==[^=]/.test(line)) { section = ''; continue; }
      if (!cur || !line) continue;
      if (line.startsWith('*')) {
        if (line.startsWith('**')) continue; // notes
        cur.entries.push({ section, text: clean(line.replace(/^\*+/, '')) });
        continue;
      }
      if (!line.startsWith('<') && !line.startsWith('{') && !line.startsWith('|')) section = clean(line);
    }
    return versions;
  }

  const isCreationSection = (s) => /^new\b/i.test(s) && !/artifact|quest|rank|mode|system|soul|avatar|emote|skin|cosmetic|feature|game/i.test(s);
  const isCardSection = (s) => !/artifact|soul|quest|rank|avatar|emote|skin|cosmetic/i.test(s);

  // One bullet -> { names: [old, new] | [name], body } or null.
  function splitEntry(text) {
    // "Old > New EFFECT UPDATE: ..." (dashes left out, Beta 107.0)
    const nd = text.match(/^([^-:.\d]+?)\s+(?:>|->)\s+([^-:.\d]+?)\s+((?:EFFECT|COST|ATK|HP)\b.*)$/);
    if (nd && !/--/.test(text)) return { names: [nd[1].trim(), nd[2].trim()], body: nd[3] };
    let m = text.match(/^(.+?)\s+-{2,3}\s+(.*)$/); // "--", sometimes "---"
    if (m) {
      const left = m[1].trim();
      const r = left.match(/^(.+?)\s+(?:>|->)\s+(.+)$/);
      return { names: r ? [r[1].trim(), r[2].trim()] : [left], body: m[2] };
    }
    // "Big Bomb - COST 8 > 6." / "Electro Guitar - COMMON: ..." (single dash, newer patches)
    m = text.match(/^(.+?)\s+-\s+((?:COST|ATK|HP|EFFECT|RARITY|TRIBE|SOUL|UTY|UT|DR|BASE|COMMON|RARE|EPIC|LEGENDARY|DETERMINATION|DT|TOKEN)\b.*)$/);
    if (m) return { names: [m[1].trim()], body: m[2] };
    m = text.match(/^(.+?)[.:]\s+((?:COST|ATK|HP|EFFECT|Effect|Cost|Atk|Hp|New effect|RARITY)\b.*)$/);
    if (m) return { names: [m[1].trim()], body: m[2] };
    // Rename-only lines: "Scissor Dancer -> Sheary", "Green Flower -> Green Clover (is now UT rarity)",
    // "Clover (Deltarune) > Renamed to "Clover Hydra"."
    m = text.match(/^(.+?)\s+>\s+Renamed to\s+"([^"]+)"\.?$/i);
    if (m) return { names: [m[1].replace(/\s*\([^)]*\)\s*$/, '').trim(), m[2].trim()], body: '' };
    m = text.match(/^([A-Z][^<>:.]{1,40}?)\s+->\s+([A-Z][^<>.]{1,40}?)(?:\s+\(([^)]*)\))?\.?$/);
    if (m && !/\d/.test(m[1] + m[2])) return { names: [m[1].trim(), m[2].trim()], body: m[3] ? m[3] : '' };
    return null;
  }

  // The changes in an entry's text.
  function parseChanges(body) {
    const ch = {};
    const full = body;
    body = headOf(body);
    const stat = (key, re) => {
      const m = body.match(re);
      if (m) ch[key] = m[2] !== undefined ? [Number(m[1]), Number(m[2])] : [null, Number(m[1])];
    };
    stat('cost', /\bCOST\s*:?\s*(\d+)\s*(?:>|->)\s*(\d+)/i);
    if (!ch.cost) stat('cost', /\bCOST\s+set\s+to\s+(\d+)/i);
    stat('atk', /\bATK\s*:?\s*(\d+)\s*(?:>|->)\s*(\d+)/i);
    if (!ch.atk) stat('atk', /\bATK\s+set\s+to\s+(\d+)/i);
    stat('hp', /\bHP\s*:?\s*(\d+)\s*(?:>|->)\s*(\d+)/i);
    if (!ch.hp) stat('hp', /\bHP\s+set\s+to\s+(\d+)/i);
    const r = body.match(new RegExp(`\\b(${RAR})\\s*(?:>|->)\\s*(${RAR})\\b`));
    if (r) ch.rarity = [rarityOf(r[1]), rarityOf(r[2])];
    const e = full.match(/\bEFFECT\s*UPDATE\s*:?\s*(.*)$/i);
    if (e) {
      ch.text = e[1].trim();
      if (/^(same\b|now\b|can no longer|no longer)/i.test(ch.text)) ch.descriptive = true;
    }
    return ch;
  }

  // A new-card line -> { rarity, set, cost, atk, hp, text, soul }.
  function parseCreation(body) {
    const c = {};
    const full = body;
    body = headOf(body);
    let m = body.match(new RegExp(`\\b(UTY|UT|DR)?\\s*(${RAR})\\b`));
    if (m) { c.rarity = rarityOf(m[2]); if (m[1]) c.set = m[1]; }
    m = body.match(/\bCOST\s*:?\s*(\d+)/i); if (m) c.cost = Number(m[1]);
    m = body.match(/\bATK\s*:?\s*(\d+)/i); if (m) c.atk = Number(m[1]);
    m = body.match(/\bHP\s*:?\s*(\d+)/i); if (m) c.hp = Number(m[1]);
    // "EFFECT: x" / "Effect: x"; a bare "EFFECT x" only in capitals (prose like
    // "its effect deals..." must not be taken as the start of the card text).
    m = full.match(/\bEFFECT\s*:\s*(.*)$/i) || full.match(/\bEFFECT\b(?!\s+UPDATE)\s*(.*)$/);
    c.text = m ? m[1].trim() : ''; // no EFFECT = no card text
    m = body.match(/\bSOUL\s*:?\s*([A-Za-z]+)/i); if (m) c.soul = m[1];
    return c;
  }

  // Every Version History event for one card, newest first, following
  // renames back ("Old > New --") and stopping at its creation line.
  // -> { events: [{ version, name, changes }], creation: { version, name, ...stats } | null, oldestName }
  function cardEvents(versions, currentName) {
    let tracked = norm(currentName);
    let trackedName = currentName;
    const events = [];
    let creation = null;
    outer:
    for (const v of versions) {
      // Within one version, a rename line applies to this version, then
      // older versions use the old name.
      let renameTo = null;
      for (const e of v.entries) {
        if (!isCardSection(e.section)) continue;
        const sp = splitEntry(e.text);
        if (!sp) continue;
        const newName = sp.names[sp.names.length - 1];
        if (norm(newName) !== tracked) continue;
        if (isCreationSection(e.section) && sp.names.length === 1) {
          creation = { version: v, name: newName, ...parseCreation(sp.body) };
          break outer;
        }
        const changes = parseChanges(sp.body);
        if (sp.names.length === 2) changes.renamedFrom = sp.names[0];
        events.push({ version: v, name: newName, changes });
        if (sp.names.length === 2) renameTo = sp.names[0];
      }
      if (renameTo) { tracked = norm(renameTo); trackedName = renameTo; }
    }
    return { events, creation, oldestName: trackedName };
  }

  // A Previous Versions page -> its first version, or null.
  // Usually "*Beta 11.0: New card: Name. EPIC Spell. ... COST 2. EFFECT: ...".
  // Fallback: the first top-level bullet that describes a whole card
  // (has COST n or EFFECT: and no "a > b" change).
  // Older Previous Versions pages end with a "=== Stats ===" section:
  //   ATK:  * 4 (Pre Beta 5.2)  * 7 (Post Beta 5.2) ...
  //   Cost: ...   Abilities: * Magic: ... (Pre Beta 1.3) ...   Rarity: Gold (Legendary)
  // The FIRST bullet of each list is the card's first version.
  function parseStatsSection(wikitext) {
    // A bullet the wiki wrapped onto a second line: join it back.
    const lines = [];
    String(wikitext).split('\n').forEach((l) => {
      const t = l.trim();
      const prev = lines[lines.length - 1];
      if (t && prev !== undefined && /^\*/.test(prev.trim()) && !/^[*=]/.test(t) && !/^(ATK|HP|Cost|Abilities|Ability|Effect|Rarity)\s*:/i.test(t)) lines[lines.length - 1] = `${prev.trim()} ${t}`;
      else lines.push(l);
    });
    const start = lines.findIndex((l) => /^=+\s*Stats\s*=+\s*$/i.test(l.trim()));
    if (start < 0) return null;
    const first = {};
    let field = null;
    let earliest = null; // { pre, label }
    let rarity;
    for (let i = start + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (/^=+[^=]+=+$/.test(line)) break; // next section
      const head = line.match(/^(ATK|HP|Cost|Abilities|Ability|Effect)\s*:\s*(.*)$/i);
      if (head) { field = head[1].toLowerCase(); continue; }
      const rar = line.match(/^Rarity\s*:.*?\(([A-Za-z]+)\)/i) || line.match(/^Rarity\s*:\s*([A-Za-z]+)\s*$/i);
      if (rar) { rarity = rar[1].toUpperCase(); field = null; continue; }
      const b = line.match(/^\*+\s*(.*?)\s*\(\s*(Pre|Post)?\s*((?:Alpha|Beta)\s*[\d.]+)[^)]*\)\s*$/i);
      if (!b || !field || first[field] !== undefined) continue;
      const value = clean(b[1]);
      first[field] = value;
      const era = { pre: /pre/i.test(b[2] || ''), label: b[3].replace(/\s+/g, ' ') };
      // Keep the EARLIEST era across all the lists (Alpha < Beta, then by number).
      const key = (e) => { const m = e.label.match(/(Alpha|Beta)\s*([\d.]+)/i); const p = m[2].split('.').map(Number); return [/alpha/i.test(m[1]) ? 0 : 1, p[0] || 0, p[1] || 0, p[2] || 0]; };
      const less = (x, y) => { const a = key(x), c = key(y); for (let k = 0; k < 4; k++) if (a[k] !== c[k]) return a[k] < c[k]; return x.pre && !y.pre; };
      if (!earliest || less(era, earliest)) earliest = era;
    }
    if (!Object.keys(first).length) return null;
    const num = (v) => (v !== undefined && /^\d+$/.test(v) ? Number(v) : undefined);
    const label = earliest ? (earliest.pre ? `Before ${earliest.label}` : earliest.label) : 'Before records';
    const season = earliest && /Beta/i.test(earliest.label) ? parseInt(earliest.label.replace(/\D*([\d]+).*/, '$1'), 10) : null;
    const text = first.abilities !== undefined ? first.abilities : first.ability !== undefined ? first.ability : first.effect;
    return {
      version: { label, date: '', season, before: !!(earliest && earliest.pre) },
      name: null, cost: num(first.cost), atk: num(first.atk), hp: num(first.hp), rarity,
      ...(text !== undefined ? { text } : {})
    };
  }

  function parsePreviousVersions(wikitext) {
    const lines = String(wikitext).split('\n').map((l) => l.trim()).filter((l) => /^\*[^*]/.test(l));
    const toVersion = (label) => {
      label = clean(label);
      const num = label.match(/Beta\s*([\d.]+)/i);
      return { label, date: '', season: num ? parseInt(num[1], 10) : null };
    };
    // "Before <the next dated bullet>", e.g. "Before Beta 1.6".
    const beforeNext = (line) => {
      const next = lines.slice(lines.indexOf(line) + 1).map((l) => l.match(/^\*\s*((?:Alpha|Beta)\s*[\d.]+)\s*:/i)).find(Boolean);
      if (!next) return { label: 'Before records', date: '', season: null, before: true };
      const v = toVersion(next[1]);
      return { label: `Before ${v.label}`, date: '', season: v.season, before: true };
    };
    for (const line of lines) {
      const m = line.match(/^\*\s*([^:]+?):\s*New card:\s*(.+?)\.\s+(.*)$/i);
      // "*?: New card: ..." = release version unknown (Miraheze or the walk may date it).
      if (m) return { version: /\b(?:Alpha|Beta)\s*\d/i.test(m[1]) ? toVersion(m[1]) : beforeNext(line), name: clean(m[2]), ...parseCreation(clean(m[3])) };
    }
    for (const line of lines) {
      const m = line.match(/^\*\s*([^:]+?):\s*(.*)$/);
      // Only "<version>: ..." bullets. Not "Magic: ..." under Abilities, or "?: Updated sprite."
      if (!m || !/\b(?:Alpha|Beta)\s*\d/i.test(m[1])) continue;
      const body = clean(m[2]);
      if (/(?:>|->)\s*\d/.test(body)) break; // already a change, not a description
      if (/\bCOST\s*:?\s*\d+|\bEFFECT\s*:/i.test(body)) return { version: toVersion(m[1]), name: null, ...parseCreation(body) };
    }
    return parseStatsSection(wikitext);
  }

  // Rebuild all versions, oldest first.
  // current: { name, cost, atk, hp, rarity, text } (today's card)
  // first: creation info from Version History or a Previous Versions page, or null.
  function buildVersions(current, events, first) {
    const notes = [];
    const ev = events.slice().reverse(); // oldest first
    // Start state: work backwards from today's stats so every stat is known.
    const start = { cost: current.cost, atk: current.atk, hp: current.hp, rarity: current.rarity };
    events.forEach(({ changes }) => {
      ['cost', 'atk', 'hp', 'rarity'].forEach((k) => {
        const c = changes[k];
        if (!c) return;
        if (c[0] === null) { start[k] = undefined; } else start[k] = c[0];
      });
    });
    // The first version's own record wins where it has a value.
    const base = { ...start };
    let text = null;
    if (first) {
      ['cost', 'atk', 'hp', 'rarity'].forEach((k) => { if (first[k] !== undefined) {
        if (base[k] !== undefined && base[k] !== first[k] && k !== 'rarity') notes.push(`${first.version.label}: wiki records ${k.toUpperCase()} ${first[k]}, history implies ${base[k]}`);
        base[k] = first[k];
      } });
      if (first.text !== undefined) text = first.text;
    }
    // Effect never changed in the recorded history (and no first record
    // says otherwise): every version had today's text.
    const anyText = events.some((e) => e.changes.text !== undefined);
    if (text === null && !anyText) text = CURRENT_TEXT;
    const out = [];
    const firstName = (first && first.name) || (ev.length && ev[0].changes.renamedFrom) || (ev.length ? ev[0].name : current.name);
    out.push({
      version: first ? first.version : null,
      name: firstName,
      cost: base.cost, atk: base.atk, hp: base.hp, rarity: base.rarity,
      text, textKnown: text !== null, original: true,
      textFrom: text !== null && text !== CURRENT_TEXT && first && first.version.date ? ymd(first.version.date) : '0000-00-00'
    });
    let state = { name: firstName, cost: base.cost, atk: base.atk, hp: base.hp, rarity: base.rarity, text, textKnown: text !== null, textFrom: out[0].textFrom };
    ev.forEach(({ version, name, changes }) => {
      const next = { ...state, name };
      ['cost', 'atk', 'hp', 'rarity'].forEach((k) => { if (changes[k]) next[k] = changes[k][1]; });
      let note = null;
      if (changes.text) {
        if (changes.descriptive) note = `Effect change described as: "${changes.text}"`;
        else { next.text = changes.text; next.textKnown = true; next.textFrom = ymd(version.date); }
      }
      if (changes.renamedFrom) note = (note ? note + ' ' : '') + `Renamed from ${changes.renamedFrom}.`;
      out.push({ version, ...next, note });
      state = next;
    });
    // Does replaying the history land on today's card?
    ['cost', 'atk', 'hp'].forEach((k) => {
      if (current[k] !== undefined && state[k] !== undefined && current[k] !== state[k]) notes.push(`History ends at ${k.toUpperCase()} ${state[k]}, but the card is ${current[k]} today`);
    });
    return { versions: out, notes };
  }


  // ---------- Card-Tracker (feildmaster's UCProjects/Card-Tracker) ----------
  // A tracker history is [{ date: 'YYYY-MM-DD', subject, state }], oldest
  // first, where state is the game's own card object at that snapshot
  // (name, cost, attack, hp, rarity, tribes, soul, description...).
  // The repo was started on 2020-10-17 by back-filling "season 35/39/43/46";
  // after that it snapshots on the 1st and 15th of every month.

  const TRACKED = ['name', 'cost', 'attack', 'hp', 'rarity', 'extension', 'tribes', 'statuses', 'soul', 'description'];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // ---------- Powers (the icons on a card: Taunt, Haste, Loop (2)...) ----------
  // The game's status names; the game draws images/powers/<Name>.png for each.
  const POWER_NAMES = ['Taunt', 'Haste', 'Charge', 'Armor', 'Dodge', 'Transparency', 'Shock', 'Bullseye', 'Support', 'Loop', 'Program', 'Candy', 'Disarmed', 'Darkspawn', 'Wanted', 'KR', 'MoldSpore', 'FloweryPower', 'Invulnerable'];
  const POWER_COUNTED = new Set(['Dodge', 'Loop', 'Program', 'MoldSpore']);
  const POWER_BY_KEY = {};
  POWER_NAMES.forEach((n) => { POWER_BY_KEY[n.toLowerCase()] = n; });
  Object.assign(POWER_BY_KEY, { cantattack: 'Disarmed', karmicretribution: 'KR', flowerypower: 'FloweryPower', moldspore: 'MoldSpore' });
  const powerKeyOf = (word) => POWER_BY_KEY[String(word).toLowerCase().replace(/[^a-z]/g, '')];
  const power = (name, n) => ({ name, counter: POWER_COUNTED.has(name) ? (n || 1) : 1, displayCounter: POWER_COUNTED.has(name) });
  const byName = (a, b) => POWER_NAMES.indexOf(a.name) - POWER_NAMES.indexOf(b.name);

  // A Card-Tracker snapshot's powers. Since 2025-09 the data has a
  // "statuses" list; before that, one field per power (taunt: true,
  // shockEnabled: true, cantAttack: true, loop: 2, ...).
  function powersOf(state) {
    if (!state) return [];
    if (Array.isArray(state.statuses)) {
      return state.statuses.map((x) => powerKeyOf(x.name) && power(powerKeyOf(x.name), x.counter)).filter(Boolean).sort(byName);
    }
    const out = [];
    Object.keys(state).forEach((k) => {
      const name = powerKeyOf(k.replace(/Enabled$/, ''));
      const v = state[k];
      if (!name || k === 'statuses') return;
      if (v === true) out.push(power(name, 1));
      else if (typeof v === 'number' && v > 0 && POWER_COUNTED.has(name)) out.push(power(name, v));
    });
    return out.sort(byName);
  }

  // Which powers a snapshot has a field for at all (true/false/number), or null
  // when it has the newer "statuses" list (which covers every power).
  function powerFieldsOf(state) {
    if (!state || Array.isArray(state.statuses)) return null;
    return Object.keys(state).map((k) => powerKeyOf(k.replace(/Enabled$/, ''))).filter(Boolean);
  }

  // Powers a card text gives the card itself: only the ones listed BEFORE any
  // keyworded effect ("Haste. Magic: ..." has Haste; "Magic: Gain Haste" doesn't).
  // Plain words count only with a capital first letter.
  function innatePowers(text) {
    const t = String(text || '')
      .replace(/\{\{KW:([A-Z_]+)([^}]*)\}\}/gi, (m, id, rest) => {
        const ov = rest.match(/override=([^|}]+)/);
        return ov ? ov[1] : id.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      })
      .replace(/\{\{[^}]*\}\}/g, ' ~ ') // any other code ends the list
      .replace(/<[^>]+>/g, ' ');
    const out = [];
    for (let seg of t.split(/[.,;\n]|\band\b/)) {
      seg = seg.trim();
      if (!seg) continue;
      if (seg.includes(':')) break;
      const m = seg.match(/^([A-Z][A-Za-z' ]*?)\s*(?:\((\d+)\)|(\d+))?$/);
      const name = m && powerKeyOf(m[1]);
      if (!name) break;
      if (!out.some((p) => p.name === name)) out.push(power(name, Number(m[2] || m[3]) || 1));
    }
    return out.sort(byName);
  }
  const powerKey = (list) => (list || []).map((p) => p.name + (p.displayCounter ? `(${p.counter})` : '')).join(',');

  // Last pass (after finalizeVersions): every version shows the powers it had.
  // Card-Tracker's own record wins; otherwise they're read from the version's
  // text; with no text, the previous version's powers carry over.
  // Pre-Alpha, Alpha and Beta 10.x or older: too little documentation to assume
  // anything carried over unchanged from today.
  function isLegacy(v) {
    const k = v && versionKey(v.version);
    return !!k && (k[0] < 2 || k[1] < 11);
  }
  function assignPowers(list, todayStatuses) {
    const today = powersOf({ statuses: todayStatuses || [] });
    let last = null;
    const out = list.map((v) => {
      let p;
      if (v.powersKnown) {
        // The tracker's early data lacks some power fields (no "dodge" field in
        // the season 35 snapshots), so powers its text lists and the data has
        // no field for are added.
        p = (v.statuses || []).slice();
        if (v.textKnown && v.text !== CURRENT_TEXT && v.powerFields) {
          innatePowers(v.text).forEach((x) => { if (!v.powerFields.includes(x.name) && !p.some((y) => y.name === x.name)) p.push(x); });
          p.sort(byName);
        }
      }
      else if (v.text === CURRENT_TEXT && !isLegacy(v)) p = today;
      else if (v.text === CURRENT_TEXT) p = last;
      else if (v.textKnown) p = innatePowers(v.text);
      else p = last;
      if (p) last = p;
      return { ...v, statuses: p };
    });
    // Versions before the first known one take the first known powers.
    const firstKnown = out.find((v) => v.statuses);
    return out.map((v) => (v.statuses ? v : { ...v, statuses: firstKnown ? firstKnown.statuses : [] }));
  }
  const ymd = (d) => String(d || '').replace(/\//g, '-');

  // Keep only snapshots where something that matters changed. An empty
  // description means "not captured" (the bot's text download stopped
  // working in Nov 2021), never "the card has no text".
  function compactTracker(snaps) {
    const out = [];
    snaps.forEach((s) => {
      const st = {};
      TRACKED.forEach((k) => { st[k] = s.state[k] === null ? undefined : s.state[k]; });
      // Fields added to the game's data later (tribes: null -> []) aren't changes.
      if (!Array.isArray(st.tribes)) st.tribes = [];
      st.statuses = powersOf(s.state); // one shape for old and new data
      const image = s.state.image; // carried along, but a file rename alone isn't a new version
      const prev = out[out.length - 1];
      if (prev) {
        const a = { ...prev.state, description: undefined, image: undefined };
        const b = { ...st, description: undefined, image: undefined };
        const textChanged = st.description && prev.knownText !== st.description;
        if (same(a, b) && !textChanged) return;
      }
      const textOnly = !!prev && same({ ...prev.state, description: undefined, image: undefined }, { ...st, description: undefined, image: undefined });
      st.image = image;
      out.push({ date: s.date, subject: s.subject, state: st, powerFields: powerFieldsOf(s.state), textOnly, knownText: st.description || (prev && prev.knownText) || '' });
    });
    return out;
  }

  // When a snapshot really happened: the back-filled "season N" commits are
  // dated 2020-10-17 but stand for the start of season N.
  function snapshotDate(snap, vh) {
    const m = String(snap.subject || '').match(/season\s+(\d+)\s*$/i);
    if (m) {
      const v = vh.find((x) => new RegExp(`^Beta\\s*${m[1]}\\.0$`, 'i').test(x.label));
      if (v && v.date) return ymd(v.date);
    }
    return snap.date;
  }

  // Wiki-built versions (oldest first, from buildVersions) + tracker
  // snapshots -> one list. Before the tracker starts, the wiki is all we
  // have. From then on, the tracker's numbers, names, rarity and tribes are
  // the game's real data; each change is labelled with the Version History
  // version (in that window) that lists the card, and text comes from the
  // tracker when it captured it, otherwise from the wiki.
  function mergeTracker(wikiVersions, snaps, vh) {
    const tracker = compactTracker(snaps).map((s) => ({ ...s, when: snapshotDate(s, vh) }));
    if (!tracker.length) return { versions: wikiVersions, trackerStart: null };
    const t0 = tracker[0].when;
    // Before the tracker starts, tribes and built-in statuses (Taunt, Loop...)
    // aren't recorded anywhere - use the earliest real ones, not today's.
    wikiVersions.forEach((v) => {
      if (v.tribes === undefined) v.tribes = tracker[0].state.tribes;
      if (v.statuses === undefined) v.statuses = tracker[0].state.statuses;
      if (v.image === undefined) v.image = tracker[0].state.image;
    });
    const dated = (v) => (v.version && v.version.date ? ymd(v.version.date) : null);
    const pre = wikiVersions.filter((v) => !dated(v) || dated(v) < t0);
    const post = wikiVersions.filter((v) => dated(v) && dated(v) >= t0);
    // Any Version History version (not only this card's) to label windows
    // where the wiki doesn't list the change.
    const vhAsc = vh.filter((v) => v.date).slice().reverse();
    const out = pre.slice();
    let prevWhen = pre.length && dated(pre[pre.length - 1]) ? dated(pre[pre.length - 1]) : '0000-00-00';
    let lastGame = null; // { text, when } - the tracker's latest text capture
    let lastFromGame = false; // was the previous shown version's text the game's own?
    tracker.forEach((t, idx) => {
      // Text-only change: only a real change if the earlier text was the
      // game's own too. Otherwise the tracker just captured, word for word,
      // the text the previous version already had - upgrade that one.
      if (t.textOnly && t.state.description && !lastFromGame && out.length) {
        const lastV = out[out.length - 1];
        lastV.text = t.state.description; lastV.textKnown = true; lastV.gameText = true;
        lastGame = { text: t.state.description, when: t.when };
        lastFromGame = true;
        prevWhen = t.when;
        return;
      }
      const inWindow = post.filter((v) => dated(v) > prevWhen && dated(v) <= t.when);
      const wikiHere = inWindow[inWindow.length - 1];
      let version;
      let note = null;
      if (wikiHere) {
        version = wikiHere.version;
        if (inWindow.length > 1) note = `Also includes ${inWindow.slice(0, -1).map((v) => v.version.label).join(', ')} (the tracker saw them together).`;
      } else {
        // No patch dated inside the window (two snapshots on the same day, or a
        // mid-season change): assume the EARLIEST patch it could be - the one in
        // effect when the tracker saw it. Easier to correct later than a date range.
        const anyVh = vhAsc.filter((v) => ymd(v.date) > prevWhen && ymd(v.date) <= t.when).pop()
          || vhAsc.filter((v) => ymd(v.date) <= t.when).pop();
        version = anyVh ? { ...anyVh, guessed: true } : { label: t.when, date: t.when, season: null, guessed: true };
        note = `Not listed in Version History for this card; assumed ${anyVh ? anyVh.label : 'its release'} (the earliest it could be - seen by ${t.when}).`;
      }
      // Text: the tracker's own capture, else the wiki's text at that point.
      // Text: the tracker's own capture; else whichever is more recent, the
      // tracker's last capture or the wiki's last effect update.
      let text = null;
      let game = false;
      if (t.state.description) {
        text = t.state.description; game = true;
        lastGame = { text, when: t.when };
      } else {
        const w = wikiVersions.filter((v) => v.textKnown && v.text !== CURRENT_TEXT && (!dated(v) || dated(v) <= t.when)).pop();
        const wWhen = w ? (w.textFrom || '0000-00-00') : '0000-00-00';
        if (lastGame && (!w || lastGame.when >= wWhen)) { text = lastGame.text; game = true; }
        else if (w) { text = w.text; game = !!w.gameText; }
      }
      const s = t.state;
      const v = {
        version, name: s.name, cost: s.cost, atk: s.attack, hp: s.hp, rarity: s.rarity, tribes: s.tribes, statuses: s.statuses, powersKnown: true, powerFields: t.powerFields, soul: s.soul, image: s.image,
        text, textKnown: text !== null, gameText: game, note, source: 'tracker'
      };
      // The first snapshot is often just the last wiki version again.
      const last = out[out.length - 1];
      const eq = (a, b) => (a === null || a === undefined ? undefined : a) === (b === null || b === undefined ? undefined : b);
      if (idx === 0 && last && !last.version && last.name === v.name && eq(last.cost, v.cost) && eq(last.atk, v.atk) && eq(last.hp, v.hp)) {
        // An undated wiki "first state" that the tracker confirms: keep the
        // tracker's dated version instead (with the wiki's text if needed).
        if (!v.textKnown && last.textKnown) { v.text = last.text; v.textKnown = true; v.gameText = last.gameText; }
        out[out.length - 1] = v;
      } else if (idx === 0 && last && last.name === v.name && eq(last.cost, v.cost) && eq(last.atk, v.atk) && eq(last.hp, v.hp)) {
        if (v.textKnown && (!last.textKnown || v.gameText)) { last.text = v.text; last.textKnown = true; last.gameText = v.gameText; }
        last.tribes = v.tribes; last.statuses = v.statuses; last.powersKnown = true; last.powerFields = v.powerFields; last.soul = v.soul; last.image = v.image;
      } else {
        out.push(v);
      }
      lastFromGame = !!(out[out.length - 1] && out[out.length - 1].gameText);
      prevWhen = t.when;
    });
    return { versions: out, trackerStart: t0 };
  }


  // Text without codes, case or punctuation, for "is this the same card?".
  function plainText(t) {
    return String(t || '')
      .replace(/\{\{[A-Z_]+:[^|}]*\|[^}]*override=([^|}]+)[^}]*\}\}/gi, '$1')
      .replace(/\{\{(?:KW|TRIBE|SOUL|RARITY|ENCHANT|CARD|ARTIFACT):([^|}]+)[^}]*\}\}/gi, '$1')
      .replace(/\{\{STATS:([^}]*)\}\}/gi, (m, x) => x.split('|').join('/'))
      .replace(/\{\{(ATK|HP|DMG|GOLD|KR|COST):(\d+)\}\}/gi, (m, x, n) => `${n} ${x.toUpperCase() === 'GOLD' ? 'G' : x}`)
      .replace(/\{\{(ATK|HP|DMG|GOLD|KR|COST)\}\}/gi, (m, x) => (x.toUpperCase() === 'GOLD' ? 'G' : x))
      .toLowerCase().replace(/_/g, ' ').replace(/[^a-z0-9/+]+/g, '');
  }

  // Last pass over the finished list (oldest first):
  //  - neighbours that are the same card (name, stats, rarity, text) are
  //    merged, keeping the OLDEST dated one (its label), with the best text;
  //  - an undated "Original" is dropped - the oldest dated version starts the list.
  function finalizeVersions(list) {
    const out = [];
    const sameCard = (a, b) => a.name === b.name && a.cost === b.cost && (a.atk ?? null) === (b.atk ?? null) && (a.hp ?? null) === (b.hp ?? null)
      && (a.rarity || '') === (b.rarity || '')
      && (!a.powersKnown || !b.powersKnown || powerKey(a.statuses) === powerKey(b.statuses))
      && (!a.textKnown || !b.textKnown || a.text === CURRENT_TEXT || b.text === CURRENT_TEXT || plainText(a.text) === plainText(b.text));
    list.forEach((v) => {
      const prev = out[out.length - 1];
      if (prev && sameCard(prev, v)) {
        const keep = prev.version ? prev : v; // prefer a dated one
        const other = keep === prev ? v : prev;
        if (other.textKnown && (!keep.textKnown || (other.gameText && !keep.gameText))) { keep.text = other.text; keep.textKnown = true; keep.gameText = other.gameText; }
        if (keep.tribes === undefined) keep.tribes = other.tribes;
        if (keep.statuses === undefined || (other.powersKnown && !keep.powersKnown)) { keep.statuses = other.statuses; keep.powerFields = other.powerFields; keep.powersKnown = !!(keep.powersKnown || other.powersKnown); }
        if (other.note && other.note !== keep.note) keep.note = keep.note ? `${keep.note} ${other.note}` : other.note;
        out[out.length - 1] = keep;
        return;
      }
      out.push(v);
    });
    return out.filter((v) => v.version || out.length === 1);
  }

  // Where the tracker's history of this card begins: { when, state } or null.
  function trackerFirst(snaps, vh) {
    const t = compactTracker(snaps || []);
    return t.length ? { when: snapshotDate(t[0], vh), state: t[0].state } : null;
  }

  // ---------- Miraheze wiki (undercards.miraheze.org, table Bucket:Patch) ----------
  // Rows: { page_name: "Season 3", subject: "Vulkin", version: 4.8, type: new|buff|nerf|rework|other, change: <rendered html> }.
  // "Season 0" holds Pre-Alpha (version 0) and Alpha x.y; every other row's
  // version is the Beta patch number (Season 3 holds 4.6 to 5.4).

  // Rendered change html -> plain text; <br> becomes "\n".
  function mhText(html) {
    return String(html || '')
      .replace(/\[\[File:[^\]]*\]\]/g, '')
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;|&#160;|&#32;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;|&#34;/g, '"').replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n')
      .replace(/(\d) ?\/ ?(?=\d)/g, '$1/').replace(/\+ (\d)/g, '+$1')
      .trim();
  }

  // { label, key } for a row. key sorts: [era, number] (0 Pre-Alpha, 1 Alpha, 2 Beta).
  function mhVersion(row) {
    const v = Number(row.version);
    const num = Number.isInteger(v) ? `${v}.0` : String(v);
    if (row.page_name === 'Season 0') {
      if (v === 0) return { label: 'Pre-Alpha', key: [0, 0], date: '', season: null, source: 'miraheze' };
      return { label: `Alpha ${num}`, key: [1, v], date: '', season: null, source: 'miraheze' };
    }
    return { label: `Beta ${num}`, key: [2, v], date: '', season: Math.floor(v), source: 'miraheze' };
  }

  // Sort key for any version label we use ("Beta 36.1", "Alpha 2.7", "Before Beta 1.3", "Pre-Alpha").
  function versionKey(ver) {
    if (!ver) return null;
    if (ver.key) return ver.key;
    const l = String(ver.label || '');
    if (/pre-?alpha/i.test(l)) return [0, 0];
    const m = l.match(/(Alpha|Beta)\s*([\d.]+)/i);
    if (!m) return null;
    const p = m[2].split('.');
    const n = Number(p[0] + '.' + (p.slice(1).join('') || '0'));
    return [/alpha/i.test(m[1]) ? 1 : 2, /^Before/i.test(l) ? n - 0.0001 : n];
  }
  // A version with no readable number sorts last instead of crashing the build.
  const keyCmp = (a, b) => { a = a || [9, 0]; b = b || [9, 0]; return (a[0] - b[0]) || (a[1] - b[1]); };

  // Changes described in one row -> { cost:[a,b], atk, hp, rarity:[a,b], text, renamedFrom, intro }.
  function mhChanges(row) {
    const t = mhText(row.change);
    const ch = {};
    const first = t.split('\n')[0];
    if (row.type === 'new' || /^Introduced\b/.test(t)) {
      const c = { };
      let m = first.match(/(\d+)\/(\d+)\/(\d+)/);
      if (m) { c.cost = +m[1]; c.atk = +m[2]; c.hp = +m[3]; }
      m = first.match(/(\d+)-cost/); if (m) c.cost = +m[1];
      m = first.match(/\b(Base|Common|Rare|Epic|Legendary|DT|Determination|Token|Generated|Mythic)\b/);
      if (m) c.rarity = rarityOf(m[1].toUpperCase());
      m = first.match(/\b(Undertale|Deltarune|UTY)\b/); if (m) c.extension = m[1];
      m = first.match(/with the (.+?) tribe/); if (m) c.tribe = m[1];
      m = first.match(/\b(Determination|Bravery|Justice|Kindness|Patience|Integrity|Perseverance) spell/); if (m) c.soul = m[1];
      c.artifact = /\bartifact\b/.test(first);
      c.monster = /\bmonster\b/.test(first);
      const rest = t.split('\n').slice(1).join(' ').trim();
      c.text = rest || (/with no effect/.test(first) ? '' : undefined);
      ch.intro = c;
      return ch;
    }
    const pair = (k, re) => { const m = t.match(re); if (m) ch[k] = [+m[1], +m[2]]; };
    pair('cost', /Changed cost from (\d+) to (\d+)/i);
    pair('atk', /Changed ATK from (\d+) to (\d+)/i);
    pair('hp', /Changed HP from (\d+) to (\d+)/i);
    const sl = t.match(/(?:Changed statline|Statline changed) from (\d+)\/(\d+)\/(\d+) to (\d+)\/(\d+)\/(\d+)/i);
    if (sl) { const a = sl.slice(1).map(Number); ch.cost = [a[0], a[3]]; ch.atk = [a[1], a[4]]; ch.hp = [a[2], a[5]]; }
    const rn = t.match(/Renamed from "([^"]+)"/i); if (rn) ch.renamedFrom = rn[1];
    const rr = t.match(/Rarity changed from (\w+)\b.*? to (\w+)/i); if (rr) ch.rarity = [rarityOf(rr[1].toUpperCase()), rarityOf(rr[2].toUpperCase())];
    // A full new effect text follows "New effect:" / "Effect rework:" on its own line(s).
    const ne = t.match(/(?:New effect|Effect rework)\s*:\s*\n([\s\S]+)$/i);
    if (ne) ch.text = ne[1].replace(/\n/g, ' ').trim();
    ch.summary = t.replace(/\n/g, ' ');
    return ch;
  }

  // Fold the Miraheze rows for one card into its version list (oldest first,
  // BEFORE finalizeVersions, so an undated start state is still there).
  //  1) "~x" (guessed) versions get Miraheze's exact number when a row describes
  //     the same stat change, the same rename, or is the only effect change in range;
  //  2) stat changes only Miraheze records are added between two versions when
  //     they fit (their "from" values are the previous version's);
  //  3) the introduction row gives the first version (Pre-Alpha / Alpha / Beta);
  //  4) unknown effect text is filled from Miraheze, or carried forward when
  //     Miraheze shows only stat changes in between.
  // Miraheze never overrides an exact Version History number.
  function applyMiraheze(versions, rows, opts = {}) {
    const log = [];
    if (!rows || !rows.length) return { versions, log };
    const parsed = rows.map((r) => ({ row: r, ver: mhVersion(r), ch: mhChanges(r) }))
      .sort((a, b) => keyCmp(a.ver.key, b.ver.key));
    let out = versions.slice();
    const used = new Set();
    const exact = (v) => v.version && !v.version.guessed && !/^Before/i.test(v.version.label || '') && v.version.source !== 'miraheze';
    const STATS = ['cost', 'atk', 'hp'];
    const has = (x) => x !== null && x !== undefined;
    const statsOnly = (p) => !p.ch.intro && !p.ch.text && !p.ch.renamedFrom
      && !p.ch.summary.replace(/(?:Changed (?:cost|ATK|HP) from \d+ to \d+|(?:Changed statline|Statline changed) from [\d/]+ to [\d/]+)\.?/gi, '').trim();
    const inRange = (p, lo, hi) => (!lo || keyCmp(p.ver.key, lo) > 0) && (!hi || keyCmp(p.ver.key, hi) < 0);
    const hiOf = (v) => (v.version && v.version.guessed ? [versionKey(v.version)[0], Math.floor(versionKey(v.version)[1]) + 1] : null);
    const lastKey = (i) => { for (let j = i; j >= 0; j--) { const k = versionKey(out[j].version); if (k) return k; } return null; };
    const relabel = (i, p, why) => {
      used.add(p);
      const v = out[i];
      log.push(`${v.version ? (v.version.guessed ? '~' : '') + v.version.label : '(no number)'} -> ${p.ver.label} (${why}: ${p.ch.summary})`);
      out[i] = { ...v, version: { ...p.ver }, note: [v.note, `Patch number from the Miraheze wiki.`].filter(Boolean).join(' ') };
    };

    // 1) Exact numbers for guessed versions.
    for (let i = 1; i < out.length; i++) {
      const v = out[i];
      if (exact(v) || !v.version) continue;
      const prev = out[i - 1];
      const lo = lastKey(i - 1);
      const hi = hiOf(v);
      const cands = parsed.filter((p) => !used.has(p) && !p.ch.intro && inRange(p, lo, hi));
      const diff = STATS.filter((k) => has(prev[k]) && has(v[k]) && prev[k] !== v[k]);
      let hit = diff.length ? cands.find((p) => diff.every((k) => p.ch[k] && p.ch[k][0] === prev[k] && p.ch[k][1] === v[k])) : null;
      let why = 'same stat change';
      if (!hit && prev.name && v.name && norm(prev.name) !== norm(v.name)) { hit = cands.find((p) => p.ch.renamedFrom && norm(p.ch.renamedFrom) === norm(prev.name)); why = 'rename'; }
      if (!hit && !diff.length) {
        const fx = cands.filter((p) => p.ch.text || p.row.type === 'rework');
        if (fx.length === 1) { hit = fx[0]; why = 'only effect change in range'; }
      }
      if (hit) relabel(i, hit, why);
    }

    // 2) Stat changes only Miraheze has, slotted in where they fit.
    for (const p of parsed) {
      if (used.has(p) || !statsOnly(p)) continue;
      const keys = STATS.filter((k) => p.ch[k]);
      if (!keys.length) continue;
      // Position: after the last version older than p.
      let i = -1;
      out.forEach((v, j) => { const k = versionKey(v.version); if (k && keyCmp(k, p.ver.key) < 0) i = j; });
      if (i < 0) continue;
      const prev = out[i];
      const next = out[i + 1];
      const nk = next && versionKey(next.version);
      if (nk && keyCmp(nk, p.ver.key) === 0) { used.add(p); continue; } // already there
      if (!keys.every((k) => has(prev[k]) && prev[k] === p.ch[k][0])) continue;
      const add = { ...prev, version: { ...p.ver }, original: false, source: 'miraheze', note: `Only recorded on the Miraheze wiki: ${p.ch.summary}` };
      keys.forEach((k) => { add[k] = p.ch[k][1]; });
      out.splice(i + 1, 0, add);
      used.add(p);
      log.push(`added ${p.ver.label}: ${p.ch.summary}`);
    }

    // 3) The introduction.
    const intro = parsed.find((p) => p.ch.intro && !p.ch.intro.artifact);
    if (intro) {
      const c = intro.ch.intro;
      const f = out[0];
      const same = (v) => STATS.every((k) => c[k] === undefined || !has(v[k]) || c[k] === v[k]);
      const introCard = () => ({
        version: { ...intro.ver }, name: opts.introName || (f ? f.name : ''),
        cost: c.cost, atk: c.atk, hp: c.hp, rarity: c.rarity || (f && f.rarity),
        text: c.text !== undefined ? c.text : null, textKnown: c.text !== undefined,
        tribes: f ? f.tribes : undefined, image: f ? f.image : undefined,
        note: 'First version from the Miraheze wiki.', source: 'miraheze', original: true
      });
      const fk = f && versionKey(f.version);
      if (!f) out.push(introCard());
      else if (!f.version) {
        if (same(f)) {
          out[0] = { ...f, version: { ...intro.ver }, note: [f.note, 'Release version from the Miraheze wiki.'].filter(Boolean).join(' ') };
          // "Same text as today" was only an assumption; Miraheze's release text wins.
          if (c.text !== undefined && (!f.textKnown || f.text === CURRENT_TEXT)) { out[0].text = c.text; out[0].textKnown = true; out[0].gameText = undefined; }
          log.push(`first version -> ${intro.ver.label} (introduced)`);
        } else {
          // Sources disagree on the first stats: keep both, oldest first.
          const nx = out.find((v) => v.version);
          if (nx) out[0] = { ...f, version: { label: `Before ${nx.version.label}`, date: '', season: null, before: true } };
          out.unshift(introCard());
          log.push(`added ${intro.ver.label}: introduced as ${c.cost}${has(c.atk) ? `/${c.atk}/${c.hp}` : ' cost'} (the wiki's Version History implies different first stats)`);
        }
      } else if (keyCmp(intro.ver.key, fk) < 0 && f.version.before && same(f)) {
        // A Previous Versions "Before x" first version with the same stats: Miraheze knows its release.
        out[0] = { ...f, version: { ...intro.ver }, note: [f.note, 'Release version from the Miraheze wiki.'].filter(Boolean).join(' ') };
        log.push(`first version ${f.version.label} -> ${intro.ver.label} (introduced)`);
      } else if (keyCmp(intro.ver.key, fk) < 0) {
        out.unshift(introCard()); // identical to the next one? finalizeVersions keeps this older number
        log.push(`added ${intro.ver.label}: introduced as ${c.cost}${has(c.atk) ? `/${c.atk}/${c.hp}` : ' cost'}`);
      }
    }

    // 4) Effect text: from Miraheze at the same number, or carried over stat-only changes.
    for (let i = 0; i < out.length; i++) {
      const v = out[i];
      // "Same text as today" is only an assumption, so it can be replaced too.
      if ((v.textKnown && v.text !== CURRENT_TEXT) || !v.version || i === out.length - 1) continue;
      const k = versionKey(v.version);
      const p = k && parsed.find((x) => x.ch.text && keyCmp(x.ver.key, k) === 0);
      if (p) { out[i] = { ...v, text: p.ch.text, textKnown: true }; log.push(`${v.version.label}: text from the Miraheze wiki`); continue; }
      const prev = out[i - 1];
      const lo = prev && versionKey(prev.version);
      if (!prev || !prev.textKnown || prev.text === CURRENT_TEXT || !lo || !k) continue;
      const between = parsed.filter((x) => keyCmp(x.ver.key, lo) > 0 && keyCmp(x.ver.key, k) <= 0);
      if (between.every(statsOnly)) {
        out[i] = { ...v, text: prev.text, textKnown: true, gameText: prev.gameText };
        log.push(`${v.version.label}: text unchanged since ${prev.version.label} (Miraheze lists only stat changes)`);
      }
    }

    // Names: an old spelling ("Monster kid") takes the spelling used later.
    for (let i = out.length - 2; i >= 0; i--) {
      if (out[i].name && out[i + 1].name && out[i].name !== out[i + 1].name && norm(out[i].name) === norm(out[i + 1].name)) out[i] = { ...out[i], name: out[i + 1].name };
    }
    return { versions: out, log };
  }

  // ---------- Artifacts ----------
  // Version History lists artifacts in their own sections ("New artifacts",
  // "Balancing (Artifacts)", "Artifact names"), written as:
  //   "Name -- EFFECT UPDATE: text", "Name (LEGENDARY) -- text" (new),
  //   "Name - COMMON: text", "Name - text", "Old -> New." (rename).
  const isArtifactSection = (s) => /artifact/i.test(s);
  const ART_RARITIES = /^(BASE|COMMON|RARE|EPIC|LEGENDARY|TOKEN|GENERATED|DETERMINATION|DT|MYTHIC)\b/i;

  function splitArtifactEntry(text) {
    const t = String(text).trim();
    let m = t.match(/^(.+?)\s*--\s*(.*)$/) || t.match(/^(.+?)\s+-\s+(.*)$/)
      || t.match(/^(.+?\s*\([A-Za-z ]+\))\s*:\s*(.*)$/) // "Dealmaker (Legendary): text"
      || t.match(/^([A-Z][\w' ]{1,30}):\s+(.*)$/); // "Worn Dagger: text", "Reinforcement: RARITY ..."
    if (!m || (/->/.test(m[1]) && !/--/.test(t))) {
      const r = t.match(/^([^<>:]+?)\s*->\s*([^<>:]+?)\.?$/);
      return r ? { name: r[1].trim(), renamedTo: r[2].trim(), body: '' } : null;
    }
    let name = m[1].trim();
    let rarity;
    let renamedFrom;
    // "Adrenaline > AbsorbAx -- EFFECT UPDATE: ..." (renamed and changed in one line)
    const rn = name.match(/^(.+?)\s*(?:->|>)\s*(.+)$/);
    if (rn) { renamedFrom = rn[1].trim(); name = rn[2].trim(); }
    // "Petal Feather (LEGENDARY)", "Veteran (Common)", "Save (generated by DT passive)"
    const rp = name.match(/^(.*?)\s*\(([A-Za-z ]+)\)$/);
    if (rp && ART_RARITIES.test(rp[2].trim())) { name = rp[1]; rarity = rarityOf(rp[2].trim().split(/\s/)[0].toUpperCase()); }
    let body = m[2].trim();
    let effect;
    let rarityFrom;
    // A rarity change anywhere in the line: "RARITY: Common > Legendary.",
    // "RARITY Common > LEGENDARY.", "Legendary > Common. EFFECT UPDATE: ..."
    const RW = '(BASE|COMMON|RARE|EPIC|LEGENDARY|TOKEN|GENERATED|DETERMINATION|DT)';
    // Only at the START of the entry - "(COMMON > RARE > EPIC ...)" inside an
    // effect (Gachapon) is effect text, not a rarity change.
    const rc = body.match(new RegExp(`^(?:RARITY(?:\\s+CHANGE)?\\s*:?\\s*)?${RW}\\s*(?:>|->)\\s*${RW}\\b\\.?`, 'i'));
    if (rc) {
      rarityFrom = rarityOf(rc[1].toUpperCase());
      rarity = rarityOf(rc[2].toUpperCase());
      body = (body.slice(0, rc.index) + body.slice(rc.index + rc[0].length)).trim();
    }
    const eu = body.match(/\bEFFECT(?:\s+UPDATE)?\s*:\s*(.*)$/i);
    if (eu) effect = eu[1];
    else if (body) {
      // "COMMON: text", "LEGENDARY Artifact; text"
      const lead = body.match(/^([A-Za-z]+)(?:\s+Artifact)?\s*[:.;]\s*(.*)$/);
      if (lead && ART_RARITIES.test(lead[1])) { rarity = rarityOf(lead[1].toUpperCase()); effect = lead[2]; }
      else if (!rc) effect = body;
    }
    return { name, rarity, rarityFrom, renamedFrom, text: effect !== undefined && effect.trim() ? effect.trim() : undefined };
  }

  // -> { events: [{ version, name, text?, rarity? }] newest first, creation | null, oldestName }
  // extraRenames: renames Version History doesn't list (found on Miraheze):
  // [{ from: 'Hourglass', to: 'Silver Watch', key: [2, 122] }].
  function artifactEvents(versions, currentName, extraRenames) {
    let tracked = norm(currentName);
    let trackedName = currentName;
    const events = [];
    let creation = null;
    const extra = (extraRenames || []).slice();
    outer:
    for (const v of versions) {
      // Older than a Miraheze-only rename: the artifact had its old name then.
      const vk = versionKey(v);
      for (let i = 0; i < extra.length; i++) {
        if (norm(extra[i].to) === tracked && vk && keyCmp(vk, extra[i].key) < 0) { tracked = norm(extra[i].from); trackedName = extra[i].from; extra.splice(i, 1); i = -1; }
      }
      let renameTo = null;
      for (const e of v.entries) {
        if (!isArtifactSection(e.section)) continue;
        const sp = splitArtifactEntry(e.text);
        if (!sp) continue;
        if (sp.renamedTo !== undefined) {
          if (norm(sp.renamedTo) === tracked) { events.push({ version: v, name: sp.renamedTo, renamedFrom: sp.name }); renameTo = sp.name; }
          continue;
        }
        if (norm(sp.name) !== tracked) continue;
        if (/^new/i.test(e.section)) { creation = { version: v, name: sp.name, text: sp.text, rarity: sp.rarity }; break outer; }
        // Artifacts have no powers of their own: an "EFFECT UPDATE: Haste. Dust: ..."
        // under an artifact is another card's line pasted in by mistake
        // (Version History, Beta 105.0: Generous Gifts got Flowey's text).
        if (sp.text && innatePowers(sp.text).length) {
          events.push({ version: v, name: sp.name, textUnknown: true, rarity: sp.rarity, rarityFrom: sp.rarityFrom, renamedFrom: sp.renamedFrom, note: "Version History's entry for this version is another card's text, so it isn't shown." });
        } else {
          events.push({ version: v, name: sp.name, text: sp.text, rarity: sp.rarity, rarityFrom: sp.rarityFrom, renamedFrom: sp.renamedFrom });
        }
        if (sp.renamedFrom) renameTo = sp.renamedFrom;
      }
      if (renameTo) { tracked = norm(renameTo); trackedName = renameTo; }
    }
    return { events, creation, oldestName: trackedName };
  }

  // Every version of one artifact, oldest first: Version History first, then
  // Miraheze for its introduction (when VH has none) and for changes VH doesn't list.
  // today: { name, rarity, text }.
  // The renames Miraheze records for these rows ("Renamed from "Veteran" to "Power Band"").
  function mhRenames(rows) {
    return (rows || []).map((row) => {
      const m = mhText(row.change).match(/Renamed from "([^"]+)" to "([^"]+)"/i);
      return m ? { from: m[1], to: m[2], key: mhVersion(row).key } : null;
    }).filter(Boolean);
  }

  // Artifacts have three rarities: Common, Legendary and Token (Generated).
  function artifactRarity(x) {
    const s = String(x || '').toUpperCase();
    if (/LEGEND/.test(s)) return 'LEGENDARY';
    if (/TOKEN|GENERAT/.test(s)) return 'TOKEN';
    if (/COMMON|BASE/.test(s)) return 'COMMON';
    return undefined;
  }

  function buildArtifactVersions(vh, today, mhRows) {
    const r = artifactEvents(vh, today.name, mhRenames(mhRows));
    const ev = r.events.slice().reverse();
    const items = []; // { key, version, name?, text?, rarity?, renamedFrom?, source }
    if (r.creation) items.push({ key: versionKey(r.creation.version), version: r.creation.version, name: r.creation.name, text: r.creation.text, rarity: r.creation.rarity, source: 'wiki', first: true });
    ev.forEach((e) => items.push({ key: versionKey(e.version), version: e.version, name: e.name, text: e.text, textUnknown: e.textUnknown, note: e.note, rarity: e.rarity, rarityFrom: e.rarityFrom, renamedFrom: e.renamedFrom, source: 'wiki' }));
    const seasons = new Set(items.map((x) => x.key && `${x.key[0]}:${Math.floor(x.key[1])}`));
    (mhRows || []).forEach((row) => {
      const ver = mhVersion(row);
      const ch = mhChanges(row);
      const text = mhText(row.change);
      // Version History's own release line wins: names get reused (the first
      // "Will" became Ambition; today's Brave Ax is the Will released in 79.0),
      // so nothing from before that release belongs to this artifact.
      if (r.creation && keyCmp(ver.key, versionKey(r.creation.version)) <= 0) return;
      if (ch.intro) {
        items.push({ key: ver.key, version: ver, name: r.oldestName, text: ch.intro.text, rarity: ch.intro.rarity, source: 'miraheze', first: true });
        return;
      }
      if (seasons.has(`${ver.key[0]}:${Math.floor(ver.key[1])}`)) return; // VH has this season's change
      const re = text.match(/^Reintroduced:[^\n]*\n([\s\S]+)$/);
      const newText = ch.text || (re ? re[1].replace(/\n/g, ' ').trim() : undefined);
      if (newText === undefined && !ch.renamedFrom && !ch.rarity) {
        items.push({ key: ver.key, version: ver, note: `Miraheze: ${ch.summary}`, source: 'miraheze', textUnknown: true });
        return;
      }
      const renamedTo = ch.renamedFrom ? (text.match(/Renamed from "[^"]+" to "([^"]+)"/i) || [])[1] : undefined;
      items.push({ key: ver.key, version: ver, name: renamedTo, text: newText, rarity: ch.rarity ? ch.rarity[1] : undefined, rarityFrom: ch.rarity ? ch.rarity[0] : undefined, renamedFrom: ch.renamedFrom, source: 'miraheze' });
    });
    items.sort((a, b) => (a.first ? -1 : b.first ? 1 : 0) || keyCmp(a.key || [9, 0], b.key || [9, 0]));
    // Keep only the oldest "first".
    const firstIdx = items.findIndex((x) => x.first);
    const list = items.filter((x, i) => !x.first || i === firstIdx);

    const out = [];
    let state = { name: r.oldestName, text: null, textKnown: false, rarity: undefined };
    if (!list.length || !list[0].first) out.push({ version: null, ...state }); // start not recorded
    list.forEach((x) => {
      const next = { ...state };
      if (x.renamedFrom) next.name = (x.name || state.name);
      else if (x.name) next.name = x.name;
      if (x.text !== undefined) { next.text = x.text; next.textKnown = true; }
      else if (x.textUnknown) { next.text = null; next.textKnown = false; }
      if (x.rarity) next.rarity = x.rarity;
      out.push({ version: x.version, ...next, rarityFrom: x.rarityFrom, source: x.source, note: [x.renamedFrom ? `Renamed from ${x.renamedFrom}.` : '', x.note || ''].filter(Boolean).join(' ') || null });
      state = next;
    });
    out.forEach((v) => { v.rarity = artifactRarity(v.rarity); v.rarityFrom = artifactRarity(v.rarityFrom); });
    today = { ...today, rarity: artifactRarity(today.rarity) };
    // Rarity: where the first version's rarity isn't recorded, work backwards from
    // today's through the recorded rarity changes ("Veteran -- RARITY: Common > Legendary").
    // Rule (user, 2026-10-07): today's rarity holds for every earlier version
    // unless a rarity CHANGE is stated ("RARITY: Common > Legendary"). Release
    // mentions alone don't override it. Only when today's rarity isn't known
    // do the wikis' own rarity mentions fill in.
    let r2 = today.rarity;
    for (let i = out.length - 1; i >= 0; i--) {
      if (today.rarity) out[i].rarity = out[i].rarityFrom ? out[i].rarity : r2;
      else if (!out[i].rarity) out[i].rarity = r2;
      r2 = out[i].rarityFrom || out[i].rarity;
    }
    // Names after a rename: everything from the rename on carries the new name.
    for (let i = out.length - 1; i > 0; i--) if (!out[i - 1].name) out[i - 1].name = out[i].name;
    return { versions: out.filter((v, i) => v.version || out.length === 1), oldestName: r.oldestName, fromWiki: !!r.events.length || !!r.creation };
  }

  // A card text never starts mid-sentence: "all enemies." is a scrap of a
  // longer line the wiki parser cut, not a real effect.
  function looksTruncated(text) {
    const t = String(text || '').replace(/^[\s.,;:!?\-\u2013\u2014]+/, '');
    if (!t || /^\{\{/.test(t)) return false;
    return /^[a-z]/.test(t) && t.split(/\s+/).length < 6;
  }

  return { mhRenames, artifactRarity, splitArtifactEntry, artifactEvents, buildArtifactVersions, looksTruncated, isLegacy, powersOf, innatePowers, assignPowers, powerKey, mhText, mhVersion, mhChanges, applyMiraheze, versionKey, parseStatsSection, trackerFirst, ymd, finalizeVersions, plainText, mergeTracker, compactTracker, CURRENT_TEXT, parseVersionHistory, parsePreviousVersions, cardEvents, buildVersions, splitEntry, parseChanges, parseCreation, clean, norm };
})();
if (typeof module !== 'undefined') module.exports = CH;
