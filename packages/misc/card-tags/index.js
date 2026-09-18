// packages/misc/card-tags/index.js
//
// Custom, user-defined "flair" tags for cards: right-click a card in
// Crafting or Deck-building to create/toggle tags, filter by typing a
// tag name into the existing search bar, and see a small on-card dot
// indicator for anything tagged. No pre-defined tag list - deliberately
// user-created only, since the useful tags are subjective and change
// with the meta.
//
// Gated entirely behind "Enable Card Tags" (packages/misc/settings.js).
// When it's off, NONE of this file's real work runs - no right-click
// listener, no addFilter registration, no MutationObserver, no
// card-list polling - matching the rest of the suite's "off means
// genuinely inert" convention (see patch-maker/index.js, deck-tracker/
// index.js), which matters here specifically for low-end machines that
// want to keep unused features from costing anything at all.

import { matchesPage } from "../../core/page-match.js";
import { getAllCards } from "../../core/card-data.js";
import { createLogger } from "../../core/debug-logger.js";
import { wireRightClick } from "./right-click.js";
import { wireSearchFilter } from "./search-filter.js";
import { initIndicators, decorateAllCards } from "./indicators.js";
import { setMenuLogger } from "./menu.js";

const logger = createLogger("CardTags");

function isCardTagsPage() {
  return matchesPage(["/Crafting", "/Decks"]);
}

function waitForCards(callback, attempt = 0) {
  const cards = getAllCards();
  if (cards.length) {
    callback(cards);
    return;
  }
  if (attempt > 80) {
    logger.warn(null, "Never found a populated card list after ~20s - Card Tags will not activate on this page load.");
    return;
  }
  setTimeout(() => waitForCards(callback, attempt + 1), 250);
}

export function initCardTags(plugin, enableCardTagsSetting) {
  if (!enableCardTagsSetting.value()) return;
  if (!isCardTagsPage()) return;

  setMenuLogger(logger);

  waitForCards(cards => {
    wireSearchFilter(plugin, logger);
    wireRightClick(cards);
    initIndicators(logger);
    decorateAllCards(); // picks up any cards already tagged from a previous session
  });
}
