// packages/misc/card-history/format.js
//
// Plain wiki text -> card text in the game's own style: keywords, tribes,
// souls, enchantments, card and artifact names, rarities and stats become the
// game's {{KW:..}} / {{CARD:id}} codes, rendered by the game's $.i18n, so they
// look (and hover / right-click) like real card text.
//
// The word lists can be changed live in the repo's card-history/rules.json
// (no Wizascript update needed); the lists below are the defaults.

import { getRules } from "./data.js";
import { allCards, artifacts, ensureCards, escHtml, hasI18n, knownKeys, norm, render, tr } from "./game.js";

const DEFAULTS = {
  keywords: ["determination", "charge", "haste", "armor", "disarmed", "candy", "support", "transparency", "invulnerable", "taunt", "dodge", "shock", "loop", "bullseye", "wanted", "darkspawn", "magic", "dust", "turn-start", "turn-end", "fatigue", "turbo", "paralyze", "silence", "synergy", "delay", "generated", "need", "program", "erase", "switch", "catch", "mold-spore", "flowery-power"],
  tribes: ["tem", "dog", "amalgamate", "g-follower", "lost-soul", "frog", "mold", "snail", "bomb", "plant", "royal-guard", "all-monster-tribes", "chaos-weapon", "piece", "arachnid", "royal-invention", "plug", "thrashing-part", "bargain", "dance", "giga-attack", "round", "pack", "spider", "turbo"],
  souls: ["determination", "patience", "bravery", "integrity", "perseverance", "kindness", "justice"],
  enchantments: ["the-flame"],
  // Keywords that were renamed or removed: [old word, today's keyword or null (= underlined)].
  legacyKeywords: [["Battlecry", "magic"], ["Deathrattle", "dust"], ["Can't Attack", "disarmed"], ["Can't attack", "disarmed"], ["Burn", "erase"], ["burn", "erase"], ["End of turn", "turn-end"], ["Start of turn", "turn-start"], ["Thorns", null], ["Ranged", null], ["Future", null]],
  // Only with a colon after them - otherwise they're ordinary words.
  legacyWithColon: [["Enter", "magic"], ["Death", "dust"]],
  // Card / artifact names never linked: too generic ("Heal 2 HP", "Draw a card").
  notLinks: ["Heal", "Draw", "Hand", "Board", "Deck", "Dustpile", "Health", "Power", "Save"],
  // Phrases left as plain text before anything else (old card names that look like other things).
  plainPhrases: ["\\bG\\.?\\s?Blasters?\\b"]
};

const RARITY_WORDS = ["BASE", "COMMON", "RARE", "EPIC", "LEGENDARY", "DETERMINATION", "TOKEN", "MYTHIC"];
// Exact case only.
const STAT_WORDS = {
  ATK: "{{ATK}}", HP: "{{HP}}", DMG: "{{DMG}}", G: "{{GOLD}}", KR: "{{KR}}",
  COST: '<span class="cost-color">COST</span>', DT: "{{RARITY:DETERMINATION|override=DT}}", MONSTER: "{{SOUL:MONSTER}}"
};
// Only "cost" between spaces, or ending a sentence ("cost."), is coloured - not costs, costing or 1-cost.
const COLOUR_WORDS = [[/(^|\s)(cost)(?=\s|$|\.(?:\s|$))/g, "cost-color"]];

const uniq = (a) => [...new Set(a)];
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let fmt = null;

export async function formatter() {
  if (fmt) return fmt;
  await ensureCards();
  const remote = await getRules();
  const R = Object.assign({}, DEFAULTS, remote && typeof remote === "object" ? remote : {});
  const notLinks = new Set(R.notLinks || []);
  const cs = new Map(); // word as written -> code
  const links = new Set(); // card/artifact names (single-word ones aren't linked at a sentence start)
  const cap = new Map(); // lower-case word -> code (first letter must be a capital)
  const add = (name, code) => { if (name && name.length >= 2 && !cap.has(name.toLowerCase())) cap.set(name.toLowerCase(), code); };
  const addExact = (name, code) => {
    if (!name || name.length < 2 || cs.has(name) || cap.has(name.toLowerCase()) || notLinks.has(name)) return;
    cs.set(name, code);
    links.add(name);
  };
  const colonCodes = new Map();
  const artIds = new Map(); // artifact name (norm) -> game id, for former artifact names
  const codeNames = new Map(); // "c:<id>" / "a:<id>" -> the names the game prints for that code today
  if (hasI18n()) {
    const kwCode = (id, override) => `{{KW:${id.toUpperCase().replace(/-/g, "_")}${override ? `|override=${override}` : ""}}}`;
    (R.keywords || []).forEach((id) => add(tr(`kw-${id}`), kwCode(id)));
    (R.legacyKeywords || []).forEach(([word, modern]) => {
      const own = word.toLowerCase().replace(/'/g, "").replace(/ /g, "-");
      if (cap.has(word.toLowerCase())) return;
      const code = tr(`kw-${own}`) ? kwCode(own, word)
        : modern && tr(`kw-${modern}`) ? kwCode(modern, word)
        : `<span class="underlined">${escHtml(word)}</span>`;
      add(word, code);
    });
    uniq([...(R.enchantments || []), ...knownKeys("enchant-")]).forEach((id) => {
      const code = id.toUpperCase().replace(/-/g, "_");
      const one = tr(`enchant-${id}`, 1);
      add(tr(`enchant-${id}`, 2), `{{ENCHANT:${code}|2}}`);
      add(one, `{{ENCHANT:${code}|1}}`);
      if (!one) {
        const words = id.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
        add(words, `{{ENCHANT:${code}|1|override=${words}}}`);
        add(`${words}s`, `{{ENCHANT:${code}|2|override=${words}s}}`);
      }
    });
    (R.tribes || []).forEach((id) => {
      const code = id.toUpperCase().replace(/-/g, "_");
      add(tr(`tribe-${id}`, 2), `{{TRIBE:${code}|2}}`);
      add(tr(`tribe-${id}`, 1), `{{TRIBE:${code}|1}}`);
    });
    (R.souls || []).forEach((id) => add(tr(`soul-${id}`), `{{SOUL:${id.toUpperCase()}}}`));
    (R.legacyWithColon || []).forEach(([word, modern]) => colonCodes.set(word, tr(`kw-${modern}`) ? kwCode(modern, word) : `<span class="underlined">${escHtml(word)}</span>`));
    (await artifacts()).forEach((a) => {
      if (!a || a.id == null) return;
      const name = tr(`artifact-name-${a.id}`) || a.name;
      addExact(name, `{{ARTIFACT:${a.id}}}`);
      [name, a.name].forEach((n) => { if (n) artIds.set(norm(n), a.id); });
      codeNames.set(`a:${a.id}`, uniq([name, a.name].filter(Boolean)));
    });
    allCards().forEach((c) => {
      const id = c.fixedId || c.id;
      const name = tr(`card-name-${id}`, 1) || c.name;
      if (notLinks.has(name)) return;
      addExact(name, `{{CARD:${id}|1}}`);
      addExact(tr(`card-name-${id}`, 2), `{{CARD:${id}|2}}`);
      if (!/s$/i.test(name)) addExact(`${name}s`, `{{CARD:${id}|2}}`);
      codeNames.set(`c:${id}`, uniq([tr(`card-name-${id}`, 2), `${name}s`, name, c.name].filter(Boolean)));
    });
  }
  const capPattern = (w) => [...w].map((ch, i) => {
    const lo = ch.toLowerCase();
    const up = ch.toUpperCase();
    if (i === 0) return escRe(up);
    return lo !== up ? `[${escRe(lo)}${escRe(up)}]` : escRe(ch);
  }).join("");
  const capNames = [...cap.keys()].sort((a, b) => b.length - a.length).map(capPattern);
  const capRe = capNames.length ? new RegExp(`(^|[^\\p{L}\\p{N}_'])(${capNames.join("|")})(?![\\p{L}\\p{N}_])`, "gu") : null;
  RARITY_WORDS.forEach((w) => { if (!cs.has(w)) cs.set(w, `{{RARITY:${w}}}`); });
  Object.entries(STAT_WORDS).forEach(([w, code]) => cs.set(w, code));
  const csNames = [...cs.keys()].sort((a, b) => b.length - a.length).map(escRe);
  const csRe = new RegExp(`(^|[^\\p{L}\\p{N}_'])(${csNames.join("|")})(?![\\p{L}\\p{N}_])`, "gu");
  const statRe = /(^|[^\d/])([+-]?\d+)\/([+-]?\d+)(?:\/([+-]?\d+))?(?![\d/])/g;
  const plain = (R.plainPhrases || []).map((p) => { try { return new RegExp(p, "g"); } catch (e) { return null; } }).filter(Boolean);
  // Matches a current name (longest first) starting exactly at a position, so a
  // former name never cuts into a longer name that's still in use.
  const csStartRe = new RegExp(`^(?:${csNames.join("|")})(?![\\p{L}\\p{N}_])`, "u");
  fmt = { cs, cap, csRe, capRe, statRe, colonCodes, links, plain, notLinks, csStartRe, artIds, codeNames, former: null };
  return fmt;
}

// Version keys are [era, number] (e.g. [2, 44] = Beta 44.0).
const keyCmp = (a, b) => (a[0] - b[0]) || (a[1] - b[1]);
const inEra = (k) => (x) => keyCmp(x.from, k) <= 0 && (!x.until || keyCmp(k, x.until) < 0);

// Old names, from the card-history branch's index.json:
//   formerNames:         { name, id, from, until }       (cards, by game id)
//   formerArtifactNames: { name, current, from, until }  (artifacts, by today's name)
// The name was in use for versions from <= key < until. Two things use them:
// - Plain wiki text: "Summon a Blue Flower" links Blue Rose (ex-Blue Flower)
//   instead of the newer card "Blue", and still reads "Blue Flower".
// - The game's own codes in old text: {{ARTIFACT:34}} prints today's name
//   (Dark Fountain), but at Beta 50.0 Soulless Kris said "Outbreak".
// Names were sometimes reused (Acceleration, Clover, Rage, Faded Memory, Will),
// so an entry only applies to text from its own era.
export function useFormerNames(f, index) {
  if (!f || f.former || !index) return;
  const cards = Array.isArray(index.formerNames) ? index.formerNames : [];
  const arts = Array.isArray(index.formerArtifactNames) ? index.formerArtifactNames : [];
  if (!cards.length && !arts.length) return;
  const byName = new Map(); // word in plain text -> [{ ident, code, from, until }]
  const byCode = new Map(); // "c:<id>" / "a:<id>" -> [{ name, from, until }]
  const push = (map, key, entry) => { if (!map.has(key)) map.set(key, []); map.get(key).push(entry); };
  const ok = (e) => e && typeof e.name === "string" && e.name.length >= 2 && Array.isArray(e.from);
  const era = (e) => ({ from: e.from, until: Array.isArray(e.until) ? e.until : null });
  cards.forEach((e) => {
    if (!ok(e) || e.id == null) return;
    push(byCode, `c:${e.id}`, { name: e.name, ...era(e) });
    if (f.notLinks.has(e.name)) return;
    push(byName, e.name, { ident: `c:${e.id}`, code: `{{CARD:${e.id}|1}}`, ...era(e) });
    if (!/s$/i.test(e.name)) push(byName, `${e.name}s`, { ident: `c:${e.id}`, code: `{{CARD:${e.id}|2}}`, ...era(e) });
  });
  arts.forEach((e) => {
    // `current` must be a real artifact today (the wiki has a few lines that only look like renames).
    const id = ok(e) && typeof e.current === "string" ? f.artIds.get(norm(e.current)) : undefined;
    if (id == null) return;
    push(byCode, `a:${id}`, { name: e.name, ...era(e) });
    if (!f.notLinks.has(e.name)) push(byName, e.name, { ident: `a:${id}`, code: `{{ARTIFACT:${id}}}`, ...era(e) });
  });
  const names = [...byName.keys()].sort((a, b) => b.length - a.length).map(escRe);
  const re = names.length ? new RegExp(`(^|[^\\p{L}\\p{N}_'])(${names.join("|")})(?![\\p{L}\\p{N}_])`, "gu") : null;
  f.former = { byName, byCode, re };
}

// A game code in old text -> the name it had at that version, if it was renamed since.
function eraName(code, f, verKey) {
  if (!f.former || !Array.isArray(verKey)) return undefined;
  const c = code.match(/^\{\{(CARD|ARTIFACT):(\d+)(?:\|(\d+))?/);
  if (!c) return undefined;
  const key = `${c[1] === "CARD" ? "c" : "a"}:${c[2]}`;
  const e = (f.former.byCode.get(key) || []).find(inEra(verKey));
  if (!e) return undefined;
  const plural = c[1] === "CARD" && c[3] === "2" && !/s$/i.test(e.name);
  return { text: plural ? `${e.name}s` : e.name, swap: f.codeNames.get(key) || [] };
}

// The game's HTML for a code, showing another name than the one it prints.
// `shown` is either the exact text to show (a matched former name), or
// { text, swap }: replace whichever of today's names (`swap`) appears, keeping
// any words around it; if none does, show `text` alone.
function withShownText(html, shown) {
  const d = document.createElement("div");
  d.innerHTML = html;
  const nodes = [];
  const walk = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) if (walk.currentNode.nodeValue.trim()) nodes.push(walk.currentNode);
  const text = typeof shown === "string" ? shown : shown.text;
  if (typeof shown === "object") {
    const swap = shown.swap.slice().sort((a, b) => b.length - a.length);
    for (const n of nodes) {
      const s = swap.find((x) => n.nodeValue.includes(x));
      if (s) { n.nodeValue = n.nodeValue.replace(s, text); return d.innerHTML; }
    }
  }
  if (!nodes.length) return escHtml(text);
  nodes[0].nodeValue = text;
  nodes.slice(1).forEach((n) => { n.nodeValue = ""; });
  return d.innerHTML;
}

// Text before this point ends a sentence (or a "Keyword:"), so a single-word
// name here is an ordinary word ("Draw a card."), not a card or artifact.
const atSentenceStart = (before) => /(^|[.!?:]|\u0002)\s*$/.test(before);

// `verKey`: the version the text belongs to ([era, number]), for former names.
// Without it (today's text), only the out-of-era rule below can link one.
export function formatText(text, f, verKey) {
  if (!hasI18n()) return escHtml(text);
  const tokens = [];
  const hold = (code, raw, shown) => `\u0001${tokens.push({ code, raw, shown }) - 1}\u0002`;
  // Old wiki text sometimes starts with ". " or ", " - a card text never does.
  let work = String(text).replace(/^[\s.,;:!?\-–—]+/, "");
  f.plain.forEach((re) => { work = work.replace(re, (m) => hold(`<span>${escHtml(m)}</span>`, m)); });
  // The game's own codes stay as they are; plain words around them are still formatted.
  // Card and artifact codes show the name they had at this version (eraName).
  work = work.replace(/\{\{[^{}]+\}\}/g, (m) => hold(m, m.replace(/^\{\{|\}\}$/g, ""), eraName(m, f, verKey)));
  work = work.replace(f.statRe, (m, pre, a, b, c) => pre + hold(c !== undefined ? `{{STATS:${a}|${b}|${c}}}` : `{{STATS:${a}|${b}}}`, m.slice(pre.length)));
  // Also inside a list of triggers sharing one effect: "Enter and Death:",
  // "Enter, Shock, and Death:" (the "and"s and commas stay plain).
  const listTail = "(?:(?:\\s*,\\s*(?:and\\s+)?|\\s+and\\s+)\\p{Lu}[\\p{L}' ]*?)*";
  f.colonCodes.forEach((code, word) => {
    work = work.replace(new RegExp(`(^|[^\\p{L}])(${escRe(word)})(?=${listTail}\\s*:)`, "gu"), (m, pre, w) => pre + hold(code, w));
  });
  if (f.former && f.former.re) {
    work = work.replace(f.former.re, (m, pre, word, offset, whole) => {
      const at = offset + pre.length;
      const all = f.former.byName.get(word) || [];
      let e = Array.isArray(verKey) ? all.find(inEra(verKey)) : null;
      // Outside its era (the wiki sometimes keeps an old name a patch longer):
      // still link a multi-word name nothing uses today and only one card or artifact ever had.
      if (!e && /\s/.test(word) && !f.cs.has(word) && new Set(all.map((x) => x.ident)).size === 1) e = all[0];
      if (!e) return m;
      const longer = whole.slice(at).match(f.csStartRe);
      if (longer && longer[0].length > word.length) return m;
      if (!/\s/.test(word) && atSentenceStart(whole.slice(0, at))) return m;
      return pre + hold(e.code, word, word);
    });
  }
  work = work.replace(f.csRe, (m, pre, word, offset, whole) => {
    if (f.links.has(word) && !/\s/.test(word) && atSentenceStart(whole.slice(0, offset + pre.length))) return m;
    return pre + hold(f.cs.get(word), word);
  });
  if (f.capRe) work = work.replace(f.capRe, (m, pre, word) => pre + hold(f.cap.get(word.toLowerCase()), word));
  return work.split(/(\u0001\d+\u0002)/).map((part) => {
    const m = part.match(/^\u0001(\d+)\u0002$/);
    if (m) {
      const t = tokens[+m[1]];
      if (t.code.startsWith("<")) return t.code;
      return t.shown ? withShownText(render(t.code, t.raw), t.shown) : render(t.code, t.raw);
    }
    let html = escHtml(part);
    COLOUR_WORDS.forEach(([re, cls]) => { html = html.replace(re, `$1<span class="${cls}">$2</span>`); });
    return html;
  }).join("");
}
