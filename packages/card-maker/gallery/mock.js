// packages/card-maker/gallery/mock.js
//
// SAMPLE DATA, for trying the Contest and Review layouts while there's no
// real data yet (the Preview bar's "Sample data" switch). Made from real
// Undercards cards (the game's own card list, the same one Tier List Maker
// and Card History read) and artifacts (the Decks page's /DecksConfig), plus a
// few invented enchantments, with made-up authors, dates and scores.
// Nothing here is ever sent: every action on a sample is local, and it's all
// forgotten on a page refresh. Ids start with "smp", which the Worker never
// makes.

import { getPageWindow } from "../../core/page-window.js";

const AUTHORS = ["SampleMaker", "PixelSmith", "CardFan", "MockAuthor", "DraftWizard", "ExampleUser", "Placeholder", "TestDummy", "FakeFroggit", "NotARealPlayer"];
const JUDGES = ["Sample Judge A", "Sample Judge B", "Sample Judge C"];

let cardFile = null; // the game's card file, when this page has no card list
function gameCards() {
  const w = getPageWindow();
  if (Array.isArray(w.allCards) && w.allCards.length) return w.allCards;
  if (cardFile && cardFile.length) return cardFile;
  try {
    const ls = JSON.parse(w.localStorage.getItem("allCards") || "[]");
    if (Array.isArray(ls)) return ls;
  } catch (e) { /* no cached list */ }
  return [];
}

function tr(key) {
  try {
    const $ = getPageWindow().$;
    const v = $ && $.i18n ? $.i18n(key) : "";
    if (!v || v === key) return "";
    const d = document.createElement("div");
    d.innerHTML = String(v).replace(/<br\s*\/?>/gi, "\n");
    return d.textContent;
  } catch (e) {
    return "";
  }
}

function cardPart(c) {
  const ext = c.extension === "DELTARUNE" ? "DELTARUNE" : c.extension === "UTY" ? "UTY" : "BASE";
  const monster = c.typeCard === 0;
  return {
    type: monster ? "Monster" : "Spell",
    name: tr(`card-name-${c.fixedId || c.id}`) || c.name || "",
    cost: c.cost,
    atk: monster ? c.attack : undefined,
    hp: monster ? c.hp : undefined,
    desc: tr(`card-${c.fixedId || c.id}`) || (c.description ? String(c.description).replace(/<[^>]+>/g, "") : ""),
    art: c.image ? `/images/cards/${c.image}.png` : "",
    rarity: c.rarity ? `${ext}_${c.rarity}` : "",
    tribes: []
  };
}
function artifactPart(a) {
  const rarity = a.unavailable === true ? "TOKEN" : a.legendary === true ? "LEGENDARY" : "COMMON";
  return {
    type: "Artifact",
    name: tr(`artifact-name-${a.id}`) || a.name || "",
    desc: tr(`artifact-${a.id}`) || (a.description ? String(a.description).replace(/<[^>]+>/g, "") : ""),
    art: `/images/artifacts/${a.image}.png`,
    rarity
  };
}
const ENCHANTS = [
  ["Sample Bonfire", "After a monster is played here, deal 2 DMG to it."],
  ["Sample Snowfall", "Monsters here have -1 ATK."],
  ["Sample Spotlight", "At the end of your turn, give the monster here +1/+1."],
  ["Sample Echo Flowers", "When a monster here dies, draw 1 card."],
  ["Sample Conveyor", "At the start of your turn, the monster here gets Haste."],
  ["Sample Puzzle Floor", "Spells that target a monster here cost 1 more."]
];
// Without the game's card list (e.g. a page that has none), plain invented spells.
const fallbackPart = (i) => ({ type: i % 2 ? "Spell" : "Monster", name: `Sample Card ${i + 1}`, cost: i % 7, atk: i % 2 ? undefined : 1 + (i % 5), hp: i % 2 ? undefined : 1 + (i % 4), desc: "A sample card.", art: "", rarity: "BASE_COMMON", tribes: [] });

let artifacts = null;
let extras = null;
// The card list and artifacts, when this page hasn't loaded them itself.
// Resolves true if anything new arrived.
export function loadSampleExtras() {
  if (extras) return extras;
  const cards = gameCards().length ? Promise.resolve(false) : (() => {
    const cfg = getPageWindow().cardsClientConfig;
    if (!cfg || !cfg.url) return Promise.resolve(false);
    return fetch(cfg.url, { credentials: "same-origin" }).then((r) => r.json()).then((d) => {
      const list = Array.isArray(d) ? d : (d && (d.cards || d.allCards)) || [];
      cardFile = typeof list === "string" ? JSON.parse(list) : list;
      return cardFile.length > 0;
    }).catch(() => false);
  })();
  const arts = fetch("/DecksConfig", { credentials: "same-origin" })
    .then((r) => r.json())
    .then((d) => {
      const raw = d && d.allArtifacts;
      artifacts = ((typeof raw === "string" ? JSON.parse(raw) : raw) || []).filter((a) => a && a.image && !a.disabled && !a.custom);
      return artifacts.length > 0;
    })
    .catch(() => false);
  extras = Promise.all([cards, arts]).then(([a, b]) => { cache = null; return a || b; });
  return extras;
}

// A pool of parts to deal entries from, in a fixed (seeded) order.
function pool(rnd) {
  const cards = gameCards().filter((c) => c && c.name && c.image && (c.typeCard === 0 || c.typeCard === 1) && c.rarity !== "TOKEN");
  const parts = cards.slice().sort(() => rnd() - 0.5).map(cardPart);
  const arts = (artifacts || []).slice().sort(() => rnd() - 0.5).map(artifactPart);
  const ench = ENCHANTS.map(([name, desc]) => ({ type: "Enchantment", name, desc, art: "" }));
  let n = 0, a = 0, e = 0;
  return {
    next(k) {
      // every 7th draw an artifact, every 9th an enchantment, when there are some
      k = k || 0;
      if (arts.length && k % 7 === 3) return arts[a++ % arts.length];
      if (k % 9 === 5) return ench[e++ % ench.length];
      return parts.length ? parts[n++ % parts.length] : fallbackPart(n++);
    }
  };
}

const DAY = 864e5;
const CONTESTS = [
  ["Heart of the Underground", "Make a card about a SOUL trait: Determination, Patience, Bravery, Integrity, Perseverance, Kindness or Justice.\nOne card, or a set of up to 4.\nNo copies of existing cards."],
  ["Hotland Heat", "Fire, lava and steam. Anything from Hotland."],
  ["Snowdin Patrol", "Royal Guard members, real or made up."],
  ["Royal Lab", "Amalgamates, machines and experiments."],
  ["Dark World Deals", "Shops, salesmen and the economy of the Dark World."],
  ["Waterfall Echoes", "Echo flowers, rain and quiet places. Spells only."],
  ["Ruins Revival", "New cards for the Ruins. Common or rare only."],
  ["Core Meltdown", "Things go wrong in the CORE."]
];

let cache = null;
// { contests: [contest info, as GET /v1/contests], file: [as contests.json],
//   own: [the player's own sample entries], uploads: [pending, for Review] }
export function sampleData() {
  if (cache) return cache;
  let seed = 4242;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const p = pool(rnd);
  let id = 0, draws = 0;
  const now = Date.now();
  const entry = (contest, t) => {
    const isSet = rnd() < 0.2;
    const size = isSet ? 2 + Math.floor(rnd() * 3) : 1;
    const parts = [];
    for (let k = 0; k < size; k++) {
      let part = p.next(draws++);
      if (isSet && part.type === "Artifact") part = p.next(draws++ + 1); // artifacts stay single
      parts.push({ ...part });
    }
    const n = id++;
    return {
      id: `smp${n.toString(36)}`, kind: size > 1 ? "set" : "single", title: size > 1 ? `Sample Set ${n + 1}` : parts[0].name,
      author: AUTHORS[Math.floor(rnd() * AUTHORS.length)], postedAt: t, approvedAt: t + 3600e3, contest, parts, sample: true
    };
  };
  const contests = [], file = [];
  CONTESTS.forEach(([title, rules], i) => {
    const cid = `csmp${i}`;
    const running = i === 0;
    const closesAt = running ? now + 3 * DAY + 5 * 3600e3 : now - (i * 16 - 4) * DAY;
    const n = running ? 12 : 10 + Math.floor(rnd() * 6);
    const entries = [];
    for (let k = 0; k < n; k++) entries.push(entry(cid, closesAt - (running ? 4 : 14) * DAY + k * 7 * 3600e3));
    const info = { id: cid, title, rules, closesAt, maxEntries: 3, status: running ? "open" : "archived", createdAt: closesAt - 14 * DAY, archivedAt: running ? null : closesAt + 2 * DAY, entries: n, sample: true };
    const f = { ...info, entries };
    if (!running) {
      // made-up scores from three judges, averaged
      const scores = {};
      entries.forEach((e) => {
        const base = 1 + rnd() * 4;
        const by = JUDGES.map((name) => ({ name, score: Math.max(1, Math.min(5, Math.round(base + (rnd() - 0.5) * 2))) }));
        const avg = Math.round((by.reduce((s, b) => s + b.score, 0) / by.length) * 100) / 100;
        scores[e.id] = { avg, n: by.length };
      });
      const order = entries.map((e) => e.id).sort((a, b) => scores[b].avg - scores[a].avg);
      f.results = { manualTop: i === 2, order, scores };
    }
    contests.push(info);
    file.push(f);
  });
  // The player's own entries in the running sample contest: one approved, one waiting.
  const run = file[0];
  const mine = [run.entries[4], entry("csmp0", now - DAY)];
  mine[0] = { ...mine[0], mine: true, status: "approved" };
  run.entries[4] = mine[0];
  mine[1] = { ...mine[1], mine: true, status: "pending" };
  // Uploads waiting for review: a few for the gallery, a few for the running contest.
  const uploads = [];
  for (let k = 0; k < 6; k++) {
    const e = entry(k % 2 ? "csmp0" : null, now - (6 - k) * 3600e3);
    if (!e.contest) delete e.contest;
    uploads.push({ ...e, status: "pending", ...(e.contest ? { contestTitle: CONTESTS[0][0] } : {}) });
  }
  // Other judges' scores on the running one (shown to the owner, as after a deadline).
  const runScores = {};
  run.entries.forEach((e, k) => {
    const by = JUDGES.slice(0, 1 + (k % 3)).map((name, j) => ({ name, score: 1 + ((k * 3 + j * 2) % 5) }));
    runScores[e.id] = { avg: Math.round((by.reduce((s, b) => s + b.score, 0) / by.length) * 100) / 100, n: by.length, by };
  });
  return (cache = { contests, file, own: mine, uploads, runScores });
}
