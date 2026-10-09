// packages/misc/card-history/artifacts-view.js
//
// An artifact's history as a list: one row per version (version number,
// rarity, text - the text wraps over as many lines as it needs), oldest first,
// today's last with the game's own text.
//
// Rarity rule (user, 2026-10-07): today's rarity holds for every earlier
// version unless a rarity CHANGE is stated (e.g. "Veteran -- RARITY: Common >
// Legendary"). Today's rarity comes from the game's artifact list, which has no
// rarity field: unavailable: true = Token (only ever generated), else
// legendary: true = Legendary, else Common.

import { escHtml, norm, render, tr, trHtml } from "./game.js";
import { formatText } from "./format.js";
import { versionLabel } from "./cards-view.js";
import { tagNode } from "./reports.js";
import { slug } from "./data.js";

const RARITIES = ["COMMON", "LEGENDARY", "TOKEN"];
const asRarity = (x) => {
  const s = String(x || "").toUpperCase();
  if (/LEGEND/.test(s)) return "LEGENDARY";
  if (/TOKEN|GENERAT/.test(s)) return "TOKEN";
  if (/COMMON|BASE/.test(s)) return "COMMON";
  return undefined;
};

export function todayArtifactRarity(a) {
  if (!a) return undefined;
  if (a.unavailable === true) return "TOKEN";
  if (a.legendary === true) return "LEGENDARY";
  if (a.legendary === false) return "COMMON";
  return asRarity(a.rarity);
}

export function findArtifact(list, q) {
  const s = String(q);
  if (/^\d+$/.test(s)) return list.find((a) => String(a.id) === s) || null;
  const n = norm(s);
  return list.find((a) => norm(a.name) === n || norm(tr(`artifact-name-${a.id}`)) === n)
    || list.find((a) => norm(a.image) === n) || null;
}

function row(ver, rarity, f, todayName, todayHtml, target) {
  const tr2 = document.createElement("tr");
  const v = document.createElement("td");
  v.className = "wz-ch-art-ver wz-ch-badge-spot";
  const label = versionLabel(ver.version);
  v.textContent = label.text + (ver.note || label.uncertain ? " *" : "");
  v.title = label.title + (ver.note ? `\n${ver.note}` : "") + (todayHtml !== undefined ? "\nToday's version." : "");
  const r = document.createElement("td");
  r.className = "wz-ch-art-rar";
  r.innerHTML = RARITIES.includes(rarity) ? render(`{{RARITY:${rarity}}}`, rarity) : "?";
  const t = document.createElement("td");
  t.className = "wz-ch-art-txt";
  const oldName = ver.name && norm(ver.name) !== norm(todayName) ? `<span class="wz-ch-art-oldname">(${escHtml(ver.name)})</span>` : "";
  const body = todayHtml !== undefined ? todayHtml : ver.textKnown && ver.text ? formatText(ver.text, f) : "?";
  // Inside a .cardDesc so the game's card-text colours and keyword styles apply.
  t.innerHTML = `<div class="cardDesc wz-ch-art-desc"><div>${oldName}${body}</div></div>`;
  tr2.append(v, r, t);
  if (target) {
    const d = document.createElement("div");
    d.innerHTML = body;
    tagNode(tr2, { ...target, label: todayHtml !== undefined ? "today" : label.text, shown: `${rarity || "?"}: ${(ver.name && norm(ver.name) !== norm(todayName) ? `(${ver.name}) ` : "")}${d.textContent.replace(/\s+/g, " ").trim()}`.slice(0, 140) });
  }
  return tr2;
}

// -> { node, wikiUrl }
export function artifactHistoryView(a, data, f, index) {
  const todayName = tr(`artifact-name-${a.id}`, 1) || a.name;
  const todayHtml = trHtml(`artifact-${a.id}`) || (a.description ? formatText(a.description, f) : "?");
  const today = todayArtifactRarity(a);
  const versions = (data && data.versions ? data.versions : []).map((v) => ({ ...v }));

  // Rarity per version (see the rule at the top).
  let r = today;
  for (let i = versions.length - 1; i >= 0; i--) {
    const v = versions[i];
    const stated = asRarity(v.rarity);
    const from = asRarity(v.rarityFrom);
    v.shownRarity = today ? (from ? stated : r) : (stated || r);
    r = from || v.shownRarity;
  }

  // Today's row replaces the newest version when the text is the same.
  const shown = (html) => { const d = document.createElement("div"); d.innerHTML = html; return d.textContent.toLowerCase().replace(/[^a-z0-9/+]+/g, ""); };
  const last = versions[versions.length - 1];
  const plainToday = todayHtml && todayHtml !== "?" ? shown(todayHtml) : "";
  let todayVer;
  if (last && last.textKnown && last.text && plainToday && shown(formatText(last.text, f)) === plainToday) {
    versions.pop();
    todayVer = { ...last, name: todayName };
  } else {
    const lk = last && last.version && last.version.key;
    const newer = ((data && data.mirahezeVersions) || [])
      .filter((mv) => !lk || mv.key[0] > lk[0] || (mv.key[0] === lk[0] && mv.key[1] > lk[1]))
      .sort((x, y) => y.key[0] - x.key[0] || y.key[1] - x.key[1])[0];
    const newest = index && index.newestVersion;
    todayVer = {
      version: newer || (newest ? { ...newest, guessed: true } : null),
      name: todayName,
      note: newer ? null : "Today's version - when it last changed isn't recorded."
    };
  }

  const node = document.createElement("div");
  const head = document.createElement("div");
  head.className = "wz-ch-art-head";
  head.innerHTML = `${a.image ? `<img src="images/artifacts/${escHtml(a.image)}.png" alt="">` : ""}<span class="wz-ch-art-title">${escHtml(todayName)}</span>`;
  const table = document.createElement("table");
  table.className = "wz-ch-art-list";
  const target = { kind: "a", id: slug(a.name), name: todayName, built: (index && index.builtAt) || "" };
  versions.forEach((v) => table.appendChild(row(v, v.shownRarity, f, todayName, undefined, target)));
  table.appendChild(row(todayVer, today || (last && last.shownRarity), f, todayName, todayHtml, target));
  node.append(head, table);
  const foot = document.createElement("div");
  foot.className = "wz-ch-foot";
  foot.textContent = `${data ? "" : "No recorded history for this artifact yet. "}Sources: Undercards Wiki (Version History)${data && data.miraheze ? "; The Undercards Wiki (Miraheze)" : ""}; Undercards patch notes. Oldest first, today's last. * = not certain, or has a note - hover the version number. Looks wrong? Right-click the row to report it.`;
  node.appendChild(foot);
  return { node, wikiUrl: `https://undercards.fandom.com/wiki/${a.name.replace(/ /g, "_")}` };
}
