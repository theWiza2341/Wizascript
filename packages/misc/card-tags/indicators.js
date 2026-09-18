// packages/misc/card-tags/indicators.js
//
// Small colored dots flanking each side of a card's rarity icon - up to
// 2 per side, 4 total - so tagged cards are visible in the grid without
// needing to search. Confirmed real markup: .cardRarity is a direct
// child of the card root, alongside .cardATK/.cardHP (flat structure,
// not nested in any stat-bar wrapper), so it's a safe overlay anchor.
//
// Normal and shiny variants of the same card share one DOM id (two
// separate elements, one plain, one with an extra "shiny" class) - so
// decoration goes through getElementsByClassName("card-<id>"), which
// returns every element sharing that id, not getElementById (which
// would only ever find the first one).
//
// Kept in sync via a MutationObserver, since the grid re-renders on
// search, pagination, and tab switches.

import { tagObjectsForCard, taggedCardIds, DEFAULT_COLORS } from "./storage.js";
import { CARD_LIST_SELECTOR } from "./constants.js";

const INDICATOR_ATTR = "data-wiza-tag-dot";

let rarityAnchorWarned = false;
let logger = null;

function findRarityAnchor(cardEl) {
  return cardEl.querySelector(".cardRarity");
}

function fillDots(holder, tags) {
  holder.innerHTML = "";
  holder.title = tags.map(t => t.name).join(", ");
  tags.forEach(t => {
    const dot = document.createElement("span");
    dot.style.cssText = "width:8px;height:8px;border-radius:50%;background:" + (t.color || DEFAULT_COLORS[0]) + ";border:1px solid rgba(0,0,0,0.4);";
    holder.appendChild(dot);
  });
}

function makeFlankHolder(side) {
  const holder = document.createElement("div");
  holder.setAttribute(INDICATOR_ATTR, side);
  Object.assign(holder.style, { position: "absolute", zIndex: "50", display: "flex", gap: "2px", pointerEvents: "none" });
  return holder;
}

function positionFlank(cardEl, anchorEl, holder, side) {
  const cardRect = cardEl.getBoundingClientRect();
  const anchorRect = anchorEl.getBoundingClientRect();
  const gap = 3;
  holder.style.top = (anchorRect.top - cardRect.top + anchorRect.height / 2) + "px";
  if (side === "left") {
    holder.style.left = (anchorRect.left - cardRect.left - gap) + "px";
    holder.style.transform = "translate(-100%, -50%)";
  } else {
    holder.style.left = (anchorRect.right - cardRect.left + gap) + "px";
    holder.style.transform = "translate(0, -50%)";
  }
}

// Fallback for the rare card variant with no .cardRarity element -
// plain top-right corner dot instead of flanking.
function decorateCorner(el, tags) {
  const existing = el.querySelector(":scope > [" + INDICATOR_ATTR + '="corner"]');
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  const holder = existing || document.createElement("div");
  if (!existing) {
    holder.setAttribute(INDICATOR_ATTR, "corner");
    Object.assign(holder.style, { position: "absolute", top: "2px", right: "2px", zIndex: "50", display: "flex", gap: "2px", pointerEvents: "none" });
    el.appendChild(holder);
  }
  fillDots(holder, tags.slice(0, 4));
}

function decorateOneCardElement(el, tags) {
  const leftExisting = el.querySelector(":scope > [" + INDICATOR_ATTR + '="left"]');
  const rightExisting = el.querySelector(":scope > [" + INDICATOR_ATTR + '="right"]');
  const cornerExisting = el.querySelector(":scope > [" + INDICATOR_ATTR + '="corner"]');

  if (!tags.length) {
    [leftExisting, rightExisting, cornerExisting].forEach(h => h && h.remove());
    return;
  }

  const anchor = findRarityAnchor(el);
  if (!anchor) {
    if (!rarityAnchorWarned) {
      rarityAnchorWarned = true;
      logger?.warn(null, "A card element has no .cardRarity element - falling back to a corner dot for it.");
    }
    if (leftExisting) leftExisting.remove();
    if (rightExisting) rightExisting.remove();
    decorateCorner(el, tags);
    return;
  }
  if (cornerExisting) cornerExisting.remove();

  if (getComputedStyle(el).position === "static") el.style.position = "relative";

  const leftTags = tags.slice(0, 2);
  const rightTags = tags.slice(2, 4); // display cap: 4 dots/card, 2 per side

  const leftHolder = leftExisting || makeFlankHolder("left");
  const rightHolder = rightExisting || makeFlankHolder("right");
  if (!leftExisting) el.appendChild(leftHolder);
  if (!rightExisting) el.appendChild(rightHolder);

  fillDots(leftHolder, leftTags);
  fillDots(rightHolder, rightTags);
  leftHolder.style.display = leftTags.length ? "flex" : "none";
  rightHolder.style.display = rightTags.length ? "flex" : "none";
  positionFlank(el, anchor, leftHolder, "left");
  positionFlank(el, anchor, rightHolder, "right");
}

export function decorateCard(cardId) {
  const els = Array.from(document.getElementsByClassName("card-" + cardId));
  if (!els.length) return; // not currently rendered anywhere
  const tags = tagObjectsForCard(cardId);
  els.forEach(el => decorateOneCardElement(el, tags));
}

export function decorateAllCards() {
  taggedCardIds().forEach(decorateCard);
}

export function initIndicators(loggerInstance) {
  logger = loggerInstance;

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; decorateAllCards(); }, 100);
  }

  const containers = document.querySelectorAll(CARD_LIST_SELECTOR);
  const observer = new MutationObserver(schedule);
  if (containers.length) {
    containers.forEach(c => observer.observe(c, { childList: true, subtree: true, attributes: true, attributeFilter: ["id"] }));
  } else {
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["id"] });
  }
  schedule();
}
