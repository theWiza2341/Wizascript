// packages/misc/card-history/cards-view.js
//
// Draws a card's history: one card per version, using the game's own card
// renderer (appendCard), with the version number where the Crafting page shows
// the quantity. "*" = not certain, or has a note (hover the number).

import { allCards, appendCard, gameFontSize } from "./game.js";
import { formatText } from "./format.js";
import { spriteUrl } from "./data.js";
import { tagNode } from "./reports.js";

const PER_ROW = 4;

// "43.0", "38.1", "A2.7", "PA", "<1.3".
export function versionLabel(v) {
  if (!v) return { text: "?", title: "Version not recorded" };
  const before = v.label.match(/^Before\s+(Alpha|Beta)\s*([\d.]+)/i);
  if (before) return { text: `<${/alpha/i.test(before[1]) ? "A" : ""}${before[2]}`, title: `${v.label} (from the wiki's Previous Versions page)` };
  if (/^Pre-?Alpha$/i.test(v.label)) return { text: "PA", title: "Pre-Alpha (from the Miraheze wiki)" };
  const when = v.date ? ` (${v.date})` : "";
  const a = v.label.match(/^Alpha\s*([\d.]+)/i);
  if (a) return { text: `A${a[1]}`, uncertain: !!v.guessed, title: `${v.guessed ? "Probably " : ""}${v.label}${when}` };
  const m = v.label.match(/^Beta\s*([\d.]+)/i);
  return { text: m ? m[1] : v.label, uncertain: !!v.guessed, title: `${v.guessed ? "Probably " : ""}${v.label}${when}` };
}

function fitText(desc, html) {
  const inner = document.createElement("div");
  inner.innerHTML = html;
  desc.textContent = "";
  desc.appendChild(inner);
  gameFontSize(inner, 81);
}

function setQuantity(el, label, note) {
  let q = el.querySelector(".cardQuantity");
  if (!q) { q = document.createElement("div"); q.className = "cardQuantity"; el.appendChild(q); }
  q.textContent = label.text + (note || label.uncertain ? " *" : "");
  q.title = label.title + (note ? `\n${note}` : "");
}

function tidy(el) {
  [...el.classList].filter((c) => /^col-/.test(c)).forEach((c) => el.classList.remove(c));
  el.classList.remove("pointer");
  el.removeAttribute("id"); // not a real card: Card Tags / middle-click must ignore it
  el.style.margin = "0";
  el.style.float = "none";
}

// Fallback when the page has no appendCard.
function plainCard(card) {
  const ext = card.extension === "DELTARUNE" ? "DELTARUNE" : card.extension === "UTY" ? "UTY" : "BASE";
  const el = document.createElement("div");
  el.className = `card ${card.typeCard === 0 ? "monster" : "spell"} undertale-frame standard-skin`;
  const part = (cls, text) => { const d = document.createElement("div"); d.className = cls; if (text !== undefined) d.textContent = text; el.appendChild(d); return d; };
  part("cardFrame"); part("cardBackground"); part("cardHeader");
  part("cardName").appendChild(document.createElement("div")).textContent = card.name;
  part("cardCost", String(card.cost));
  part("cardStatus"); part("cardTribes");
  part("cardImage").style.background = `url("images/cards/${card.image}.png") no-repeat transparent`;
  part("cardDesc").appendChild(document.createElement("div"));
  part("cardFooter");
  if (card.typeCard === 0) { part("cardATK", String(card.attack)); part("cardHP", String(card.hp)); }
  part("cardRarity").style.background = `url("images/rarity/${ext}_${card.rarity}.png") no-repeat transparent`;
  part("cardQuantity");
  return el;
}

const makeCard = (card) => appendCard(card) || plainCard(card);

function drawVersion(base, ver, f, currentDescHtml) {
  const card = JSON.parse(JSON.stringify(base));
  const isMonster = card.typeCard === 0;
  if (ver.cost != null) { card.cost = ver.cost; card.originalCost = ver.cost; }
  if (isMonster) {
    if (ver.atk != null) { card.attack = ver.atk; card.originalAttack = ver.atk; }
    if (ver.hp != null) { card.hp = ver.hp; card.maxHp = ver.hp; card.originalHp = ver.hp; }
  }
  if (ver.rarity && ver.rarity !== "GENERATED") card.rarity = ver.rarity;
  // Only what this version really had - never today's tribes or powers.
  card.tribes = Array.isArray(ver.tribes) ? ver.tribes : [];
  card.statuses = Array.isArray(ver.statuses)
    ? ver.statuses.map((x) => ({ statusType: "POSITIVE", statusBehavior: x.displayCounter ? "STACKABLE" : "UNIQUE", ...x }))
    : [];
  if (ver.soul !== undefined) card.soul = ver.soul;
  const el = makeCard(card);
  tidy(el);
  const art = el.querySelector(".cardImage");
  // Old art for a reworked card shown under its old name (never a name a card still has).
  if (ver.sprite && art) art.style.backgroundImage = `url("${spriteUrl(ver.sprite)}")`;
  // An older art file, if the server still has it and no card uses it today.
  const usedToday = ver.image && allCards().some((c) => c.image === ver.image);
  if (!ver.sprite && ver.image && ver.image !== base.image && !usedToday && art) {
    const probe = new Image();
    probe.onload = () => { art.style.backgroundImage = `url("images/cards/${ver.image}.png")`; };
    probe.src = `images/cards/${ver.image}.png`;
  }
  const nameEl = el.querySelector(".cardName");
  if (nameEl) {
    const nd = nameEl.firstElementChild || nameEl;
    if (nd.textContent !== ver.name) { nd.textContent = ver.name; if (nd !== nameEl) gameFontSize(nd, 25); }
  }
  const costEl = el.querySelector(".cardCost");
  if (costEl && ver.cost != null) costEl.textContent = ver.cost;
  if (isMonster) {
    el.querySelectorAll('[class*="ATK" i], [class*="attack" i]').forEach((n) => { if (ver.atk != null && !n.children.length) n.textContent = ver.atk; });
    el.querySelectorAll('[class*="cardHP" i], [class*="health" i]').forEach((n) => { if (ver.hp != null && !n.children.length) n.textContent = ver.hp; });
  }
  const desc = el.querySelector(".cardDesc");
  if (desc) {
    if (ver.sameAsToday && !ver.legacy && currentDescHtml !== null) desc.innerHTML = currentDescHtml; // the game's own text
    else if (ver.textKnown && !ver.truncated && ver.text) fitText(desc, formatText(ver.text, f));
    else fitText(desc, "?"); // not recorded (or too early to assume today's text)
  }
  setQuantity(el, versionLabel(ver.version), ver.note);
  return el;
}

// What the player saw, for whoever checks a report: "6/4/4 RARE Clam Girl: Magic: ...".
const plain = (t) => String(t || "").replace(/\{\{[A-Z_]+:([^}]*)\}\}/g, "$1").replace(/\{\{([A-Z_]+)\}\}/g, "$1").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
function seen(card, ver) {
  const stats = card.typeCard === 0 ? `${ver.cost ?? "?"}/${ver.atk ?? "?"}/${ver.hp ?? "?"}` : `${ver.cost ?? "?"}`;
  return `${stats} ${ver.rarity || ""} ${ver.name}: ${ver.textKnown && !ver.truncated ? plain(ver.text) : "?"}`.replace(/\s+/g, " ");
}

const n0 = (x) => (x === null || x === undefined ? undefined : x);

// -> { node, fit, wikiUrl } for the dialog.
export function cardHistoryView(base, data, f, index) {
  const nowEl = makeCard(JSON.parse(JSON.stringify(base)));
  tidy(nowEl);
  const nowDesc = nowEl.querySelector(".cardDesc");
  const currentDescHtml = nowDesc ? nowDesc.innerHTML : null;
  const versions = (data && data.versions ? data.versions : []).slice();
  const lastV = versions[versions.length - 1];
  const sameAsNow = lastV && lastV.name === base.name && n0(lastV.cost) === n0(base.cost)
    && (base.typeCard !== 0 || (n0(lastV.atk) === n0(base.attack) && n0(lastV.hp) === n0(base.hp)));
  if (sameAsNow) {
    versions.pop();
    setQuantity(nowEl, versionLabel(lastV.version), lastV.note);
  } else if (data && data.newestMiraheze) {
    setQuantity(nowEl, versionLabel(data.newestMiraheze), "Today's version - its last change, from the Miraheze wiki.");
  } else {
    const newest = index && index.newestVersion;
    setQuantity(nowEl, versionLabel(newest ? { ...newest, guessed: true } : null), "Today's version - when it last changed isn't recorded.");
  }

  const grid = document.createElement("div");
  grid.className = "cardsPreview no-hover wz-ch-grid";
  grid.style.cssText = `display:grid;grid-template-columns:repeat(${PER_ROW},max-content);gap:38px 8px;justify-content:center;padding-bottom:28px;`;
  const built = (index && index.builtAt) || "";
  versions.forEach((v) => {
    const el = drawVersion(base, v, f, currentDescHtml);
    tagNode(el, { kind: "c", id: base.id, name: base.name, label: versionLabel(v.version).text, shown: seen(base, v), built });
    grid.appendChild(el);
  });
  tagNode(nowEl, { kind: "c", id: base.id, name: base.name, label: "today", shown: seen(base, { ...base, atk: base.attack, textKnown: false }), built });
  grid.appendChild(nowEl);

  const node = document.createElement("div");
  node.appendChild(grid);
  const foot = document.createElement("div");
  foot.className = "wz-ch-foot";
  const src = ["Undercards Wiki (Version History"];
  if (data && data.pvTitle) src[0] += `, ${data.pvTitle.replace(/_/g, " ")}`;
  src[0] += ")";
  if (data && data.miraheze) src.push("The Undercards Wiki (Miraheze)");
  if (data && data.trackerStart) src.push(`feildmaster's Card-Tracker (game data since ${data.trackerStart})`);
  src.push("Undercards patch notes");
  const lines = [`Sources: ${src.join("; ")}.`];
  if (!data) lines.unshift("No recorded history for this card yet.");
  else if (!data.firstFrom && !(versions[0] && versions[0].version && versions[0].version.source === "miraheze")) lines.push("Its first version isn't recorded; earlier stats are worked out backwards.");
  lines.push("* = not certain, or has a note - hover the version number. Looks wrong? Right-click it to report it.");
  foot.textContent = lines.join(" ");
  node.appendChild(foot);

  // Shrink the cards a little if 4 don't fit across.
  const fit = () => {
    const avail = node.clientWidth;
    const need = grid.scrollWidth;
    grid.style.zoom = need > avail && avail > 0 ? String(Math.max(0.5, avail / need)) : "";
  };
  const wikiUrl = `https://undercards.fandom.com/wiki/${data && data.pvTitle ? data.pvTitle : `${base.name.replace(/ /g, "_")}/Previous_Versions`}`;
  return { node, fit, wikiUrl };
}
