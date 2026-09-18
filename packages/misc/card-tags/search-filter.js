// packages/misc/card-tags/search-filter.js
//
// One plugin.addFilter() registration, covering both /Crafting and
// /Decks (they share the same filter pipeline and search box). Only
// overrides an exclusion the search box itself caused (results.search)
// - never one from another filter, such as the native Shiny/non-Shiny
// toggle in Crafting - otherwise a tag match would force a shiny card
// to show even with that filter off, fighting its own exclusivity.

import { tagObjectsForCard } from "./storage.js";

export function wireSearchFilter(plugin, logger) {
  if (typeof plugin.addFilter !== "function") {
    logger.warn(null, "plugin.addFilter is not available - Card Tags search integration disabled.");
    return;
  }

  plugin.addFilter(function cardTagsFilter(card, removed, results) {
    if (!removed || !results || !results.search) return removed;
    if (!card || card.id == null) return removed;

    const searchEl = document.getElementById("searchInput");
    const term = searchEl ? searchEl.value.trim().toLowerCase() : "";
    if (!term) return removed;

    const tags = tagObjectsForCard(card.id);
    if (!tags.length) return removed;

    const matched = tags.some(t => t.name.toLowerCase().includes(term));
    return matched ? false : removed;
  });
}
