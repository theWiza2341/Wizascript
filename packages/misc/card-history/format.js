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
import { allCards, artifacts, ensureCards, escHtml, hasI18n, knownKeys, render, tr } from "./game.js";

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
    (await artifacts()).forEach((a) => { if (a && a.id != null) addExact(tr(`artifact-name-${a.id}`) || a.name, `{{ARTIFACT:${a.id}}}`); });
    allCards().forEach((c) => {
      const id = c.fixedId || c.id;
      const name = tr(`card-name-${id}`, 1) || c.name;
      if (notLinks.has(name)) return;
      addExact(name, `{{CARD:${id}|1}}`);
      addExact(tr(`card-name-${id}`, 2), `{{CARD:${id}|2}}`);
      if (!/s$/i.test(name)) addExact(`${name}s`, `{{CARD:${id}|2}}`);
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
  fmt = { cs, cap, csRe, capRe, statRe, colonCodes, links, plain };
  return fmt;
}

// Text before this point ends a sentence (or a "Keyword:"), so a single-word
// name here is an ordinary word ("Draw a card."), not a card or artifact.
const atSentenceStart = (before) => /(^|[.!?:]|\u0002)\s*$/.test(before);

export function formatText(text, f) {
  if (!hasI18n()) return escHtml(text);
  const tokens = [];
  const hold = (code, raw) => `\u0001${tokens.push({ code, raw }) - 1}\u0002`;
  // Old wiki text sometimes starts with ". " or ", " - a card text never does.
  let work = String(text).replace(/^[\s.,;:!?\-–—]+/, "");
  f.plain.forEach((re) => { work = work.replace(re, (m) => hold(`<span>${escHtml(m)}</span>`, m)); });
  // The game's own codes stay as they are; plain words around them are still formatted.
  work = work.replace(/\{\{[^{}]+\}\}/g, (m) => hold(m, m.replace(/^\{\{|\}\}$/g, "")));
  work = work.replace(f.statRe, (m, pre, a, b, c) => pre + hold(c !== undefined ? `{{STATS:${a}|${b}|${c}}}` : `{{STATS:${a}|${b}}}`, m.slice(pre.length)));
  f.colonCodes.forEach((code, word) => {
    work = work.replace(new RegExp(`(^|[^\\p{L}])(${escRe(word)})(?=\\s*:)`, "gu"), (m, pre, w) => pre + hold(code, w));
  });
  work = work.replace(f.csRe, (m, pre, word, offset, whole) => {
    if (f.links.has(word) && !/\s/.test(word) && atSentenceStart(whole.slice(0, offset + pre.length))) return m;
    return pre + hold(f.cs.get(word), word);
  });
  if (f.capRe) work = work.replace(f.capRe, (m, pre, word) => pre + hold(f.cap.get(word.toLowerCase()), word));
  return work.split(/(\u0001\d+\u0002)/).map((part) => {
    const m = part.match(/^\u0001(\d+)\u0002$/);
    if (m) {
      const t = tokens[+m[1]];
      return t.code.startsWith("<") ? t.code : render(t.code, t.raw);
    }
    let html = escHtml(part);
    COLOUR_WORDS.forEach(([re, cls]) => { html = html.replace(re, `$1<span class="${cls}">$2</span>`); });
    return html;
  }).join("");
}
