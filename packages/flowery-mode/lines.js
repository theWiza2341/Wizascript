// packages/flowery-mode/lines.js
//
// Flowery Mode's engine. WHICH clip plays WHEN is not in the script: the
// rules live in flowery/index.json on the repo's `sounds` branch (read by
// index.js), so new interactions and tuning need no script update. This file
// only matches rules against events, rolls their odds and keeps clips rare.
// No page access, so it can be tested on its own.
//
// Background (Event Recorder, 2026-10-29): the game's own Flowery lines are
// sent by the SERVER (`getPlaySound`) only while Flowery is in play, and the
// page plays /sounds/<name>.wav. Flowery Mode plays those files (and the wiki
// clips on the `sounds` branch) on public events: cards played, attacks, the
// battle log, animations, the result, chat, and Wizascript's own moments.
// Nothing is ever sent to the server.
//
// ---- index.json (version 2) ----
//   game:   [{ sound, use: [rule…] }]                the game's /sounds/<sound>.wav
//   lines:  [{ file, title, seconds, use: [rule…] }]  wiki clips on the sounds branch
//   random: [rule…]                                   plays a random clip from all of the above
// A rule:
//   on       "play"        a card played from hand (monster) or cast (spell)
//            "attack"      a card attacks
//            "log"         a battle-log entry of `type` ("BURN", "DEATH", …)
//            "animation"   a game animation of `type` ("SILENCE", "HEAL", …)
//            "overdraw"    a card is discarded because a hand is full
//            "victory" / "defeat"   your match ends
//            "wizascript"  a Wizascript/site moment, `event`
//   card, id    which card (name and/or game fixedId)
//   type        for log / animation
//   event       for wizascript
//   who         "any" (default), "me", "opponent": whose card / turn / hand
//   target      attack: "player" | "monster"; animation: "ally" | "enemy" (the target monster's side)
//   cardType    "monster" | "spell" (play, overdraw)
//   minBuff     play: at least +N/+N over the card's base stats
//   chance      1 in N (default 1), before the Frequency setting
//   always      true = every time, ignoring Frequency, the gap and the budget
//   budget      false = doesn't use up (or wait for) the per-match budget, still rolls its odds
//   repeat      [min, max]: plays the clip that many times in a row
//   alt         [{ file | sound, chance }]: 1 in `chance` of playing that clip instead
//   summoned    play: also count monsters put on the board by an effect (not only from hand)
//   nameWord    play: the card's name contains this word ("kid" matches "Monster Kid", not "Kidnap")
//   maxCost     play: the card costs at most this
//   minAttack   attack: the attacker has at least this much ATK
//   turn        kill: "me" | "opponent": whose turn it happened on
//   from        random rules: pick from these [{ sound } | { file }] instead of all clips
//   key, label  a stable id and a readable name: the Advanced Settings row for this rule
//   kill        (on) a monster dies; target "ally" | "enemy" = whose monster

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const KINDS = new Set(["play", "attack", "log", "animation", "overdraw", "kill", "victory", "defeat", "wizascript"]);
const KEY_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
const FILE_RE = /^[A-Za-z0-9_\-']+\.wav$/; // no commas (they wouldn't load), no paths
const SOUND_RE = /^flowery[A-Za-z0-9]+$/;
const clampN = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

function clipOf(x, seconds) {
  if (x && x.sound != null && SOUND_RE.test(String(x.sound))) return { kind: "game", name: String(x.sound) };
  if (x && x.file != null && FILE_RE.test(String(x.file))) return { kind: "file", file: String(x.file), seconds: Number(seconds) || 0 };
  return null;
}

// Clean one rule from the (remote) index; null = unusable.
function cleanRule(r, secondsOf) {
  if (!r || typeof r !== "object" || !KINDS.has(r.on)) return null;
  const out = { on: r.on };
  if (r.card != null) out.card = norm(r.card);
  if (Number.isInteger(r.id)) out.id = r.id;
  if (r.type != null) out.type = String(r.type).toUpperCase();
  if (r.event != null) out.event = String(r.event);
  out.who = r.who === "me" || r.who === "opponent" ? r.who : "any";
  if (["player", "monster", "ally", "enemy"].includes(r.target)) out.target = r.target;
  if (r.cardType === "monster" || r.cardType === "spell") out.cardType = r.cardType;
  if (r.minBuff != null) out.minBuff = clampN(r.minBuff, 1, 99, 1);
  if (r.maxCost != null) out.maxCost = clampN(r.maxCost, 0, 99, 0);
  if (r.minAttack != null) out.minAttack = clampN(r.minAttack, 0, 999, 0);
  if (r.nameWord != null && String(r.nameWord).trim()) out.nameWord = String(r.nameWord).trim().toLowerCase().replace(/[^a-z0-9 ]/g, "");
  out.summoned = r.summoned === true;
  if (r.turn === "me" || r.turn === "opponent") out.turn = r.turn;
  if (r.key != null && KEY_RE.test(String(r.key))) out.key = String(r.key);
  if (r.label != null) out.label = String(r.label).slice(0, 80);
  out.chance = clampN(r.chance, 1, 10000, 1);
  out.always = r.always === true;
  out.budget = r.budget !== false;
  if (Array.isArray(r.repeat)) {
    const a = clampN(r.repeat[0], 1, 10, 1);
    out.repeat = [a, clampN(r.repeat[1], a, 10, a)];
  }
  if (Array.isArray(r.alt)) {
    out.alt = r.alt.map((x) => ({ clip: clipOf(x, secondsOf && x && secondsOf(x.file)), chance: clampN(x && x.chance, 1, 10000, 1) }))
      .filter((x) => x.clip);
  }
  if (Array.isArray(r.from)) {
    out.from = r.from.map((x) => clipOf(x, secondsOf && x && secondsOf(x.file))).filter(Boolean);
    if (!out.from.length) return null;
  }
  if (out.on === "play" && out.card == null && out.id == null && out.minBuff == null && out.nameWord == null && out.maxCost == null) return null;
  if (out.on === "attack" && out.card == null && out.id == null && out.minAttack == null) return null;
  if ((out.on === "log" || out.on === "animation") && !out.type) return null;
  if (out.on === "wizascript" && !out.event) return null;
  return out;
}

// index.json → { rules: [{ clip, rule }], all: [clip…] }.
export function compileRules(index) {
  const rules = [];
  const all = [];
  if (!index || typeof index !== "object") return { rules, all };
  const lines = Array.isArray(index.lines) ? index.lines : [];
  const secondsOf = (file) => { const l = lines.find((x) => x && x.file === file); return l ? l.seconds : 0; };
  const add = (clip, uses) => {
    if (!clip) return;
    all.push(clip);
    for (const r of Array.isArray(uses) ? uses : []) {
      const rule = cleanRule(r, secondsOf);
      if (rule) rules.push({ clip, rule });
    }
  };
  for (const g of Array.isArray(index.game) ? index.game : []) add(clipOf(g && { sound: g.sound }), g && g.use);
  for (const l of lines) add(clipOf(l && { file: l.file }, l && l.seconds), l && l.use);
  for (const r of Array.isArray(index.random) ? index.random : []) {
    const rule = cleanRule(r, secondsOf);
    if (rule) rules.push({ clip: { kind: "random" }, rule });
  }
  return { rules, all };
}

export const clipName = (clip) => (clip.kind === "game" ? clip.name : clip.kind === "file" ? clip.file : "random");

// ---- Frequency ----
// odds: multiplies every rule's "1 in N"; budget: Flowery Mode clips per match
// (or per page outside matches); gap: seconds between them.
export const FREQUENCIES = [
  { label: "Much less", odds: 4, budget: 1, gap: 30 },
  { label: "Less", odds: 2, budget: 1, gap: 25 },
  { label: "Normal", odds: 1, budget: 2, gap: 20 },
  { label: "More", odds: 0.5, budget: 4, gap: 12 },
  { label: "Much more", odds: 0.25, budget: 6, gap: 6 }
];
export const DEFAULT_FREQUENCY = "Normal";
// The on-screen testing toggle: every rule plays every time.
export const EVERY_TIME = { label: "Every time", odds: 0, budget: Infinity, gap: 0 };
export function frequency(label) {
  return FREQUENCIES.find((f) => f.label === label) || FREQUENCIES.find((f) => f.label === DEFAULT_FREQUENCY);
}

function parse(v) {
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch (e) { return null; }
}

// A monster that arrives right after an effect resolved was summoned by
// that effect (Ralsei's copy, a Dust effect, an artifact), not played from
// hand; the server gives those no line. Checked against every play in the
// first recording.
const EFFECTS = new Set(["getDoingEffect", "getSoulDoingEffect", "getArtifactDoingEffect"]);
const RESETS = new Set([
  "getTempCancel", "getMonsterTemp", "getSpellTemp", "getTurnStart", "getTurnEnd",
  "getAttackDelock", "getFight", "getFightPlayer", "getMonsterPlayed", "getSpellPlayed"
]);

// Two clips never start within this of each other, and a server Flowery line
// keeps us quiet this long. The server's line arrives within milliseconds of
// its event (Orange then Kris: 1.8 s apart in the game itself).
export const QUIET_MS = 1200;

const cardMatches = (rule, card) => !!card && (
  (rule.id == null && rule.card == null) ||
  (rule.id != null && rule.id === card.fixedId) || (rule.card != null && rule.card === norm(card.name)));
const typeOk = (rule, card) => !rule.cardType || (card && (rule.cardType === "spell" ? card.typeCard === 1 : card.typeCard === 0));
const wordOk = (rule, card) => rule.nameWord == null || (card && new RegExp("(^|[^a-z0-9])" + rule.nameWord.replace(/ /g, "[^a-z0-9]+") + "s?($|[^a-z0-9])", "i").test(String(card.name || "")));
const costOk = (rule, card) => rule.maxCost == null || (card && Number(card.cost) <= rule.maxCost);
const buffOk = (rule, card) => rule.minBuff == null || (card &&
  (card.attack - card.originalAttack) >= rule.minBuff && ((card.maxHp != null ? card.maxHp : card.hp) - card.originalHp) >= rule.minBuff);

// opts:
//   rules()           compileRules(index) result, read at each event
//   play(clip, n)     play it n times in a row
//   isOwn(playerId)   is this player the one at this screen
//   settings()        { frequency: {odds,budget,gap}, opponent, endLines, spectating, percent(key) → exact % or null }
//   now(), random()   injectable for tests
export function createReactor({ rules, play, isOwn, settings, now = () => Date.now(), random = () => Math.random() }) {
  let lastAction = null;
  let lastAt = -Infinity;       // any clip (ours or the server's): overlap guard
  let lastOursAt = -Infinity;   // our budgeted clips: the gap
  let used = 0;                 // our budgeted clips this match / page
  const spellsSeen = new Set();
  const owners = new Map();     // monster instance id → owner id (public: the board)
  let turnOf = null;            // whose turn it is (getTurnStart)

  const roll = (n) => n <= 1 || Math.floor(random() * n) === 0;

  function whoOk(rule, playerId) {
    const s = settings();
    const mine = isOwn(playerId);
    if (!s.spectating && !mine && !s.opponent) return false;
    if (rule.who === "me") return mine;
    if (rule.who === "opponent") return !mine;
    return true;
  }

  // Candidates matching this moment → odds → one of them plays.
  function fire(matches) {
    if (!matches.length) return null;
    const t = now();
    if (t - lastAt < QUIET_MS) return null;
    const f = settings().frequency;
    const every = f.odds === 0;
    const scaled = (n) => (every ? 1 : Math.max(1, Math.round(n * f.odds)));
    let pick = null;
    const always = matches.filter((m) => m.rule.always);
    if (always.length) {
      pick = always[Math.floor(random() * always.length)];
    } else {
      const budgetFree = (m) => !m.rule.budget;
      const roomy = used < f.budget && t - lastOursAt >= f.gap * 1000;
      const exact = (m) => (m.rule.key && settings().percent ? settings().percent(m.rule.key) : null);
      const passed = matches.filter((m) => {
        if (!(roomy || budgetFree(m))) return false;
        const pct = every ? null : exact(m);
        if (pct != null) return pct > 0 && random() * 100 < pct; // Advanced Settings: exact, ignores Frequency
        return roll(scaled(m.rule.chance));
      });
      if (!passed.length) return null;
      pick = passed[Math.floor(random() * passed.length)];
      if (pick.rule.budget) { used++; lastOursAt = t; }
    }
    let clip = pick.clip;
    if (clip.kind === "random") {
      const pool = pick.rule.from || rules().all;
      if (!pool.length) return null;
      clip = pool[Math.floor(random() * pool.length)];
    }
    // Variants keep their own odds even on the testing toggle (else the main clip never plays).
    for (const a of pick.rule.alt || []) {
      if (roll(a.chance)) { clip = a.clip; break; }
    }
    const r = pick.rule.repeat;
    const times = r ? r[0] + Math.floor(random() * (r[1] - r[0] + 1)) : 1;
    lastAt = t;
    play(clip, times, pick.rule);
    return clip;
  }

  const find = (pred) => rules().rules.filter((m) => pred(m.rule));
  const remember = (card) => { if (card && card.id != null && card.ownerId != null) owners.set(card.id, card.ownerId); };

  // Feed every game event (UnderScript's GameEvent) in order.
  function onEvent(data) {
    if (!data || !data.action) return null;
    const a = data.action;
    let played = null;

    if (a === "getPlaySound" && /^flowery/i.test(String(data.sound || ""))) {
      lastAt = now(); // the server's own Flowery line: stay quiet
    } else if (a === "getMonsterPlayed" || a === "getSpellPlayed") {
      const card = parse(data.card);
      remember(card);
      const pid = data.idPlayer != null ? data.idPlayer : card && card.ownerId;
      let ok = !!card;
      // A MONSTER card in getSpellPlayed is the game showing a Dust effect after a
      // death (or Flowery's quest card at the start), not a play: spells only.
      if (a === "getSpellPlayed" && card && card.typeCard !== 1) ok = false;
      const fromEffect = a === "getMonsterPlayed" && EFFECTS.has(lastAction); // summoned by an effect
      if (ok && a === "getSpellPlayed") { // the game can send the same spell twice
        if (spellsSeen.has(card.id)) ok = false;
        else spellsSeen.add(card.id);
      }
      if (ok) played = fire(find((r) => r.on === "play" && (!fromEffect || r.summoned) && cardMatches(r, card) && typeOk(r, card)
        && buffOk(r, card) && wordOk(r, card) && costOk(r, card) && whoOk(r, pid)));
    } else if (a === "updateCard" || a === "updateMonster") {
      remember(parse(data.monster || data.card));
    } else if (a === "getUpdateBoard") {
      const board = parse(data.board);
      if (Array.isArray(board)) board.forEach(remember);
    } else if (a === "getBattleLog") {
      const log = parse(data.battleLog);
      if (log && log.battleLogType) {
        const type = String(log.battleLogType).toUpperCase();
        const actor = log.cardActor;
        remember(actor);
        played = fire(find((r) => {
          if (r.on === "attack") {
            if (!/^ATTACK_(MONSTER|PLAYER)$/.test(type)) return false;
            if (r.target === "player" && type !== "ATTACK_PLAYER") return false;
            if (r.target === "monster" && type !== "ATTACK_MONSTER") return false;
            if (r.minAttack != null && !(actor && Number(actor.attack) >= r.minAttack)) return false;
            return cardMatches(r, actor) && whoOk(r, log.playerId);
          }
          if (r.on === "log") return r.type === type && cardMatches(r, actor) && whoOk(r, log.playerId);
          return false;
        }));
      }
    } else if (a === "getAnimation") {
      const type = String(data.animation || "").toUpperCase();
      const owner = data.target === "MONSTER" ? owners.get(data.idTarget) : undefined;
      played = fire(find((r) => {
        if (r.on !== "animation" || r.type !== type) return false;
        if (r.target === "ally" || r.target === "enemy") {
          if (settings().spectating) return true; // no "your side" when watching
          if (owner == null) return false;
          return r.target === "ally" ? isOwn(owner) : !isOwn(owner);
        }
        return true;
      }));
    } else if (a === "getTurnStart") {
      turnOf = data.idPlayer;
    } else if (a === "getMonsterDestroyed") {
      const owner = owners.get(data.monsterId);
      const s = settings();
      played = fire(find((r) => {
        if (r.on !== "kill") return false;
        if (s.spectating) return true; // no "your side" when watching
        if (r.turn && (turnOf == null || (r.turn === "me") !== isOwn(turnOf))) return false;
        if (r.target === "ally" || r.target === "enemy") {
          if (owner == null) return false;
          return r.target === "ally" ? isOwn(owner) : !isOwn(owner);
        }
        return true;
      }));
    } else if (a === "getCardDestroyedHandFull") {
      const card = parse(data.card);
      const pid = data.idPlayer != null ? data.idPlayer : card && card.ownerId;
      if (card) played = fire(find((r) => r.on === "overdraw" && cardMatches(r, card) && typeOk(r, card) && whoOk(r, pid)));
    } else if ((a === "getVictory" || a === "getDefeat") && settings().endLines && !settings().spectating) {
      const kind = a === "getVictory" ? "victory" : "defeat";
      played = fire(find((r) => r.on === kind));
    }

    if (EFFECTS.has(a) || RESETS.has(a)) lastAction = a;
    return played;
  }

  // A Wizascript/site moment (not a match event).
  function onWizascript(event) {
    return fire(find((r) => r.on === "wizascript" && r.event === event));
  }

  function reset() {
    lastAction = null;
    lastAt = -Infinity;
    lastOursAt = -Infinity;
    used = 0;
    spellsSeen.clear();
    owners.clear();
    turnOf = null;
  }

  return { onEvent, onWizascript, reset };
}

// Advanced Settings rows: one per rule that has a key, with its default % (at Normal).
export function ruleDefaults(compiled) {
  const seen = new Set();
  const out = [];
  for (const m of compiled.rules) {
    const r = m.rule;
    if (!r.key || seen.has(r.key)) continue;
    seen.add(r.key);
    const pct = r.always ? 100 : Math.round(1000 / r.chance) / 10;
    out.push({ key: r.key, label: r.label || r.key, pct, always: r.always });
  }
  return out;
}
