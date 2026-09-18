// packages/misc/card-tags/constants.js
//
// Confirmed real container selectors, shared across the right-click
// listener, the on-card indicator's MutationObserver, and page gating.
// Crafting/collection grids use .cardsList/.cardSkinList; the
// Deck-building list ("(Owned)"/"(Not owned)") uses #loadDeckCards.

export const CARD_LIST_SELECTOR = ".cardsList, .cardSkinList, #loadDeckCards";
