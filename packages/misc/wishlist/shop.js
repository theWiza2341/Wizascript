// packages/misc/wishlist/shop.js
//
// Reads the Cosmetics Shop - either a background copy of /CosmeticsShop
// (fetched with the player's own session, read-only) or the live page.
//
// The page is server-rendered, so the raw HTML already has everything:
//  - three sections, each a <p> holding <span data-i18n="[html]cosmetics-
//    daily|new|sales"> and a .cosmetics-timer (seconds left, as a plain
//    number in the raw HTML; cosmetics.js turns it into "d:hh:mm:ss" on
//    the live page);
//  - per item: the image (type + file), and either a
//    form.cosmetic-purchase (data-name, data-cost) or an OWNED label
//    (<span data-i18n="[html]cardskins-shop-owned">), plus "(-50 %)" on sales.
// Note the "[html]" prefix on data-i18n values in the raw HTML.

import { fromSrc } from "./detect.js";

const SECTIONS = { "cosmetics-daily": "Daily", "cosmetics-new": "New", "cosmetics-sales": "Sale" };

function i18nKey(el) {
  return (el.getAttribute("data-i18n") || "").replace(/^\[[a-z]+\]/i, "");
}

// "20021" (raw) or "05:33:41" / "4:05:33:41" (formatted) -> seconds.
export function parseTimer(text) {
  const t = String(text == null ? "" : text).trim();
  if (/^\d+$/.test(t)) return Number(t);
  const parts = t.split(":").map((p) => Number(p));
  if (!parts.length || parts.some((p) => !Number.isFinite(p))) return null;
  const [s = 0, m = 0, h = 0, d = 0] = parts.reverse();
  return d * 86400 + h * 3600 + m * 60 + s;
}

// -> { items: [{ key, type, file, name, section, cost, sale, owned, img }],
//      timers: { Daily, New, Sale } (seconds or null) }
// Throws if the document isn't the shop (logged out, a Cloudflare check,
// or the page changed).
export function parseShop(doc) {
  const heads = [...doc.querySelectorAll("span[data-i18n]")].filter((s) => SECTIONS[i18nKey(s)]);
  if (!heads.length) throw new Error(`not the Cosmetics Shop (page title: "${doc.title || "none"}")`);

  const timers = { Daily: null, New: null, Sale: null };
  heads.forEach((h) => {
    const t = h.parentElement && h.parentElement.querySelector(".cosmetics-timer");
    timers[SECTIONS[i18nKey(h)]] = t ? parseTimer(t.textContent) : null;
  });

  const items = [];
  const seen = new Set();
  doc.querySelectorAll("img").forEach((img) => {
    const found = fromSrc(img.getAttribute("src"));
    if (!found) return;
    // The section is the last heading before the image; anything before
    // the first heading (the player's own avatar in the header) is skipped.
    let section = null;
    heads.forEach((h) => {
      if (h.compareDocumentPosition(img) & 4 /* FOLLOWING */) section = SECTIONS[i18nKey(h)];
    });
    if (!section) return;
    const box = img.closest(".col-sm-1") || img.closest("tr") || img.parentElement;
    const form = box.querySelector("form.cosmetic-purchase");
    const sale = (box.textContent.match(/\(-\s*(\d+)\s*%\)/) || [])[1];
    const owned = [...box.querySelectorAll("[data-i18n]")].some((n) => i18nKey(n) === "cardskins-shop-owned");
    const id = `${section}|${found.key}`;
    if (seen.has(id)) return;
    seen.add(id);
    items.push({
      ...found,
      name: (form && form.getAttribute("data-name")) || found.name,
      section,
      cost: form ? Number(form.getAttribute("data-cost")) : null,
      sale: sale ? Number(sale) : 0,
      owned,
      img
    });
  });
  return { items, timers };
}

export async function fetchShop() {
  const res = await fetch("/CosmeticsShop", { credentials: "same-origin", cache: "no-store" });
  if (!res.ok) throw new Error(`the shop answered with HTTP ${res.status}`);
  const html = await res.text();
  return parseShop(new DOMParser().parseFromString(html, "text/html"));
}
