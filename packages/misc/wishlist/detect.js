// packages/misc/wishlist/detect.js
//
// Works out whether an element is a cosmetic, purely from its image
// address - the folder says what it is, wherever it sits on the page:
//   images/avatars/<file>   avatar        (chat, matches, profiles, shop)
//   images/emotes/<file>    emote         (chat messages, shop)
//   images/profiles/<file>  profile skin  (the background of table.profile
//                                          in matches; an <img> in the shop)
// Confirmed against live chat, a live match and the shop (2026-10-05).

import { getPageWindow } from "../../core/page-window.js";

export const TYPE_INFO = {
  avatar: { folder: "avatars", label: "Avatar" },
  emote: { folder: "emotes", label: "Emote" },
  "profile-skin": { folder: "profiles", label: "Profile Skin" }
};

const FOLDERS = Object.entries(TYPE_INFO).map(([type, info]) => [info.folder, type]);

// The in-match emote speech bubbles are frames, not cosmetics.
const SKIP_FILES = /^(YourBubble|EnemyBubble)\./i;

export function nameFromFile(file) {
  return file.replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ");
}

export function imageUrl(type, file) {
  const info = TYPE_INFO[type];
  return info ? `/images/${info.folder}/${encodeURIComponent(file)}` : "";
}

// { key, type, file, name } for an image address, or null.
export function fromSrc(src) {
  if (!src) return null;
  const hit = FOLDERS.find(([folder]) => src.includes(`images/${folder}/`));
  if (!hit) return null;
  let file = src.split("/").pop().split(/[?#]/)[0];
  try { file = decodeURIComponent(file); } catch (e) { /* keep it as it is */ }
  if (!file || SKIP_FILES.test(file)) return null;
  const type = hit[1];
  return { key: `${type}:${file}`, type, file, name: nameFromFile(file) };
}

function srcOf(el) {
  if (!(el instanceof Element)) return "";
  if (el.tagName === "IMG") return el.getAttribute("src") || "";
  const bg = getComputedStyle(el).backgroundImage || "";
  const m = bg.match(/url\(["']?([^"')]+)/);
  return m ? m[1] : "";
}

export function detectElement(el) {
  return fromSrc(srcOf(el));
}

// The cosmetic under a right-click, or null. A profile skin is the
// background of the whole table.profile, so a click anywhere inside one
// (its name, its picture) counts; otherwise the clicked element and up to
// four of its parents are checked.
export function findCosmetic(target) {
  if (!(target instanceof Element)) return null;
  let found = null;
  let el = null;
  const profile = target.closest("table.profile");
  if (profile) { found = detectElement(profile); el = profile; }
  for (let n = target, i = 0; !found && n && i < 5; n = n.parentElement, i++) {
    found = detectElement(n);
    el = n;
  }
  if (!found) return null;
  found.rarity = rarityOf(el);
  found.own = isOwnEquipped(found, el);
  // On the shop page, use the shop's own name (it keeps apostrophes etc.
  // that file names drop).
  const box = target.closest(".col-sm-1, tr");
  const form = box && box.querySelector("form.cosmetic-purchase[data-name]");
  const boxImg = box && box.querySelector("img");
  const boxItem = boxImg ? fromSrc(boxImg.getAttribute("src")) : null;
  if (form && boxItem && boxItem.key === found.key) {
    found.name = form.getAttribute("data-name") || found.name;
  }
  return found;
}

const RARITIES = ["COMMON", "BASE", "RARE", "EPIC", "LEGENDARY", "DETERMINATION", "MYTHIC", "TOKEN"];

// An avatar's rarity is a class on its image (img.avatar.RARE), or null.
function rarityOf(el) {
  if (!(el instanceof Element) || el.tagName !== "IMG") return null;
  return RARITIES.find((r) => el.classList.contains(r)) || null;
}

// The player's own avatar or profile skin in their own match is one they
// own. (Spectating, "your" side is the player being watched.)
function isOwnEquipped(item, el) {
  if (!(el instanceof Element) || location.pathname.startsWith("/Spectate")) return false;
  if (item.type === "avatar") return el.id === "yourAvatar";
  if (item.type === "profile-skin") {
    try {
      const selfId = getPageWindow().selfId;
      return selfId != null && el.id === `user${selfId}`;
    } catch (e) {
      return false;
    }
  }
  return false;
}

// Common (and Base) avatars are given to every account; the shop only
// sells Rare and up.
export function isFreeAvatar(item) {
  return item.type === "avatar" && (item.rarity === "COMMON" || item.rarity === "BASE");
}

// Free emotes (0 UCP) are given to every account, so they never appear in
// the shop. Every account has them in the page's chatEmotes list.
export function isFreeEmote(file) {
  try {
    const list = getPageWindow().chatEmotes;
    if (!Array.isArray(list)) return false;
    const e = list.find((x) => x && `${x.image}.png` === file);
    return !!(e && Number(e.ucpCost) === 0);
  } catch (e) {
    return false;
  }
}
