// packages/misc/wishlist/menu.js
//
// Right-click an avatar, emote or profile skin -> a small menu in the style
// of UnderScript's chat menu: its picture, name and type, then
// "Add to Wishlist" (or "Remove from Wishlist" if it's already pinned).
//
// - Capture phase, and only for cosmetics: cards, usernames (UnderScript's
//   Profile/Mention/Ignore menu sits on the name, not the avatar) and
//   everything else keep their own right-click.
// - Stays open while chat scrolls or updates; a left-click elsewhere or
//   Esc closes it. Right-clicking another cosmetic just moves it.
// - Controller: Controller Support's right-click button fires a real
//   contextmenu at the cursor, so it opens this menu; its click button
//   presses the menu item, and its back button closes it (closeWishlistMenu).

import { findCosmetic, isFreeEmote, imageUrl, TYPE_INFO } from "./detect.js";
import { isPinned, addItem, removeItem } from "./storage.js";

let menu = null;
let wired = false;

export function isWishlistMenuOpen() {
  return !!(menu && menu.isConnected);
}

// true if a menu was open (and is now closed).
export function closeWishlistMenu() {
  const was = isWishlistMenuOpen();
  if (menu) menu.remove();
  menu = null;
  return was;
}

function thumb(item) {
  const img = document.createElement("img");
  img.src = imageUrl(item.type, item.file);
  img.alt = "";
  if (item.type === "profile-skin") img.className = "wz-wl-wide";
  return img;
}

function openMenu(item, x, y) {
  closeWishlistMenu();
  const pinned = isPinned(item.key);
  const free = item.type === "emote" && isFreeEmote(item.file);

  menu = document.createElement("ul");
  menu.className = "wz-wl-menu";
  const head = document.createElement("header");
  const text = document.createElement("div");
  text.append(item.name);
  const sub = document.createElement("small");
  sub.textContent = TYPE_INFO[item.type].label;
  text.append(sub);
  head.append(thumb(item), text);

  const li = document.createElement("li");
  if (free && !pinned) {
    li.textContent = "Free for everyone - can't be pinned";
    li.className = "wz-wl-off";
  } else {
    li.textContent = pinned ? "★ Remove from Wishlist" : "☆ Add to Wishlist";
    if (pinned) li.className = "wz-wl-on";
    li.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isPinned(item.key)) removeItem(item.key);
      else addItem(item);
      closeWishlistMenu();
    });
  }
  menu.append(head, li);
  document.body.appendChild(menu);

  const r = menu.getBoundingClientRect();
  menu.style.left = Math.max(4, Math.min(x, window.innerWidth - r.width - 4)) + "px";
  menu.style.top = Math.max(4, Math.min(y, window.innerHeight - r.height - 4)) + "px";
}

export function wireWishlistMenu() {
  if (wired) return;
  wired = true;

  document.addEventListener("contextmenu", (e) => {
    if (menu && menu.contains(e.target)) { e.preventDefault(); return; }
    const item = findCosmetic(e.target);
    if (!item) return;
    e.preventDefault();
    e.stopPropagation();
    openMenu(item, e.clientX, e.clientY);
  }, true);

  document.addEventListener("mousedown", (e) => {
    if (menu && e.button === 0 && !menu.contains(e.target)) closeWishlistMenu();
  }, true);

  // UnderScript opens its own menu on Escape's keyup, so the keyup that
  // follows an Escape which closed our menu is swallowed too.
  let swallowEscUp = false;
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && closeWishlistMenu()) {
      e.stopPropagation();
      swallowEscUp = true;
    }
  }, true);
  document.addEventListener("keyup", (e) => {
    if (e.key === "Escape" && swallowEscUp) {
      swallowEscUp = false;
      e.stopPropagation();
    }
  }, true);
}
