// packages/misc/wishlist/index.js
//
// Cosmetic Wishlist: pin avatars, emotes and profile skins you'd like, and
// get a message when one of them is in the Cosmetics Shop.
//
//   detect.js   what's a cosmetic (by image folder)
//   menu.js     right-click "Add to / Remove from Wishlist" (+ controller)
//   shop.js     reading the shop (background copy or the live page)
//   check.js    when to read it, owned removal, reminders, toasts
//   storage.js  GM storage
//
// Listed under Miscellaneous but - unlike Notepad and Card Tags - with a
// tab of its own: the list of pins (with remove buttons), Check Shop Now,
// and two settings. Read-only towards the site: one GET of /CosmeticsShop
// per shop refresh at most, never a purchase; notices are local toasts.
//
// Disabled plugin = settings registered (so they exist), nothing else.

import { createFeatureSettings } from "../../core/settings.js";
import { isPluginEnabled } from "../../core/plugins.js";
import { registerSettingWidget, asButton } from "../../core/setting-widgets.js";
import { matchesPage } from "../../core/page-match.js";
import { injectWishlistStyle } from "./styles.js";
import { wireWishlistMenu } from "./menu.js";
import { getItemList, getItems, removeItem, onItemsChange, getState } from "./storage.js";
import { imageUrl, TYPE_INFO } from "./detect.js";
import {
  FREQUENCIES, FREQ_REFRESH, REMINDS, REMIND_ONCE,
  backgroundCheck, manualCheck, readLiveShop, formatIn
} from "./check.js";

const TAB = "Cosmetic Wishlist";
const BACKGROUND_DELAY_MS = 3000;

let settings = null;
let pluginRef = null;

function setting(key, fallback) {
  try { return settings ? settings.value(key) : fallback; } catch (e) { return fallback; }
}

function whenText(at) {
  if (!at) return "";
  const d = new Date(at);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function lastSeenText(pin) {
  const s = pin.lastSeen;
  if (!s) return "Not seen in the shop yet";
  const where = s.section === "Sale" ? "on sale" : `in ${s.section}`;
  return `Last seen ${where}, ${whenText(s.at)}${s.cost != null ? ` · ${s.cost} UCP` : ""}`;
}

// ---------- the list on the tab ----------
function renderList(box, label) {
  const pins = getItemList();
  if (label) label.textContent = `Your Wishlist (${pins.length})`;
  box.textContent = "";
  if (!pins.length) {
    const empty = document.createElement("div");
    empty.className = "wz-wl-list-empty";
    empty.textContent = "Nothing pinned yet. Right-click an avatar, emote or profile skin anywhere on the site and choose Add to Wishlist.";
    box.appendChild(empty);
    return;
  }
  pins.forEach((pin) => {
    const row = document.createElement("div");
    row.className = "wz-wl-row";
    const img = document.createElement("img");
    img.src = imageUrl(pin.type, pin.file);
    img.alt = "";
    if (pin.type === "profile-skin") img.className = "wz-wl-wide";
    const text = document.createElement("div");
    text.className = "wz-wl-row-text";
    text.append(pin.name || pin.file);
    const sub = document.createElement("small");
    sub.textContent = `${(TYPE_INFO[pin.type] || {}).label || pin.type} · ${lastSeenText(pin)}`;
    text.appendChild(sub);
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "×";
    del.title = "Remove from your wishlist";
    del.setAttribute("aria-label", `Remove ${pin.name || pin.file}`);
    del.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeItem(pin.key);
    });
    row.append(img, text, del);
    box.appendChild(row);
  });
}

function registerTabWidgets() {
  registerSettingWidget("wishlist.list", (el) => {
    el.readOnly = true;
    el.tabIndex = -1;
    el.style.display = "none";
    const row = el.closest(".flex-start");
    if (!row) return;
    const label = row.querySelector("label");
    if (label) label.style.fontWeight = "bold";
    const box = document.createElement("div");
    box.className = "wz-wl-list";
    row.appendChild(box);
    renderList(box, label);
    const off = onItemsChange(() => {
      if (!box.isConnected) { off(); return; }
      renderList(box, label);
    });
  });

  let checking = false;
  registerSettingWidget("wishlist.checkNow", (el) => {
    asButton("Check Shop Now", async (input) => {
      if (checking) return;
      checking = true;
      input.value = "Checking…";
      const row = input.closest(".flex-start");
      let status = row && row.querySelector(".wz-wl-status");
      if (row && !status) {
        status = document.createElement("div");
        status.className = "wz-wl-status";
        row.appendChild(status);
      }
      const result = await manualCheck(pluginRef);
      checking = false;
      input.value = "Check Shop Now";
      if (!status) return;
      if (result.error) {
        status.textContent = `Couldn't read the shop: ${result.error.message}`;
      } else if (result.matches.length) {
        status.textContent = `In the shop now: ${result.matches.map((m) => m.name).join(", ")}. `
          + "Close Settings to see the message with Take me there!";
      } else {
        const next = getState().nextDailyAt;
        status.textContent = "Nothing from your wishlist is in the shop right now."
          + (next ? ` Next daily refresh in ${formatIn(next - Date.now())}.` : "");
      }
    })(el);
  });
}

// ---------- on the Cosmetics Shop page ----------
function decorateShop(shop) {
  document.querySelectorAll(".wz-wl-shop-star").forEach((n) => n.remove());
  document.querySelectorAll(".wz-wl-shop-pin").forEach((n) => n.classList.remove("wz-wl-shop-pin"));
  const pins = getItems();
  shop.items.forEach((i) => {
    if (!pins[i.key] || !i.img || !i.img.isConnected) return;
    i.img.classList.add("wz-wl-shop-pin");
    const star = document.createElement("span");
    star.className = "wz-wl-shop-star";
    star.textContent = "★";
    star.title = "On your wishlist";
    i.img.parentElement.insertBefore(star, i.img);
  });
}

function initShopPage() {
  const result = readLiveShop(pluginRef);
  if (!result) return;
  const shop = result.shop;
  decorateShop(shop);
  // "Take me there!" lands here with #wz=<key>: bring that item into view.
  const want = (location.hash.match(/wz=([^&]+)/) || [])[1];
  if (want) {
    let key = want;
    try { key = decodeURIComponent(want); } catch (e) { /* use as is */ }
    const hit = shop.items.find((i) => i.key === key);
    if (hit && hit.img) {
      hit.img.scrollIntoView({ block: "center", behavior: "smooth" });
      hit.img.classList.add("wz-wl-shop-target");
    }
  }
  // A pin made or removed here (right-click) updates the outlines straight away.
  onItemsChange(() => decorateShop(shop));
}

export function initWishlist(plugin) {
  pluginRef = plugin;
  settings = createFeatureSettings(plugin, "wishlist", {
    tab: TAB,
    visible: () => isPluginEnabled("wishlist")
  });
  settings.add("list", {
    name: "Your Wishlist",
    type: "text",
    default: ""
  });
  settings.add("checkNow", {
    name: "Check the Shop",
    note: "Read the Cosmetics Shop now and show what's on your wishlist.",
    type: "text",
    default: "Check Shop Now"
  });
  settings.add("frequency", {
    name: "Shop Check Frequency",
    note: "The shop only changes when it refreshes; that's checked by default.",
    type: "select",
    options: FREQUENCIES,
    default: FREQ_REFRESH
  });
  settings.add("remind", {
    name: "Remind Me",
    note: "Show a match once per shop refresh, or on every page load.",
    type: "select",
    options: REMINDS,
    default: REMIND_ONCE
  });
  registerTabWidgets();

  if (!isPluginEnabled("wishlist")) return;

  injectWishlistStyle();
  wireWishlistMenu();

  const start = () => {
    if (matchesPage("/CosmeticsShop")) {
      initShopPage();
      return;
    }
    setTimeout(() => {
      backgroundCheck(plugin, {
        freq: setting("frequency", FREQ_REFRESH),
        remind: setting("remind", REMIND_ONCE)
      }).catch(() => { /* never let a failed check break the page */ });
    }, BACKGROUND_DELAY_MS);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}
