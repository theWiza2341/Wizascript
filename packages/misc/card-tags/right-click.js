// packages/misc/card-tags/right-click.js
//
// Delegated contextmenu listener - a fallback, not first-in-line. Cards
// can carry their own native right-click behavior: keyword/tribe icons
// and card references use inline oncontextmenu="...; return false;"
// handlers, and returning false from those is the browser's own way of
// calling preventDefault(). Listening on the bubble phase (not capture)
// means any such handler on a more specific inner element always runs
// first - by the time the event reaches us at document,
// e.defaultPrevented already reflects whether something closer to the
// click claimed it. We only open the tag menu when nothing did.

import { CARD_LIST_SELECTOR } from "./constants.js";
import { openTagMenu } from "./menu.js";

function getCardById(cards, id) {
  return cards.find(c => c && String(c.id) === String(id)) || null;
}

export function wireRightClick(cards) {
  document.addEventListener("contextmenu", function (e) {
    const container = e.target.closest(CARD_LIST_SELECTOR);
    if (!container) return; // not inside a card list at all, let native behavior through

    if (e.defaultPrevented) return; // a more specific native handler already claimed this right-click

    const cardEl = e.target.closest(".card");
    const card = cardEl && cardEl.id ? getCardById(cards, cardEl.id) : null;
    if (!card) return; // let it through

    e.preventDefault();
    // stopImmediatePropagation (not just stopPropagation): also blocks
    // any other 'contextmenu' listener registered on document itself for
    // this same event - specifically a still-open menu's own outside-
    // closer, registered earlier - so opening a new menu here can't get
    // raced by the old one's close logic on the same event.
    e.stopImmediatePropagation();
    openTagMenu(card, cards, e.clientX, e.clientY);
  }); // bubble phase - deliberately NOT capture, see file header
}
