// Deck filtering (Soul, text search, card include/exclude) and deck-
// related card/artifact lookups. Kept pure/stateless deliberately - no
// module-level mutable state, no DOM, no rendering. overlay.js owns the
// actual filter state and re-renders when it changes.

import { getPageWindow } from "../core/page-window.js";
import { getAllCards } from "../core/card-data.js";

export function decodeDeck(deckCode) {
  try {
    return JSON.parse(atob(deckCode));
  } catch {
    return null;
  }
}

// FIX: the original called bare `getCard(id)`/`getArtifact(id)` (and
// `allCards` in one place correctly went through unsafeWindow, but not
// consistently). This script grants GM_xmlhttpRequest, which sandboxes
// it exactly like Patch Maker was sandboxed - bare page-global calls
// would silently fail. Routed through getPageWindow() everywhere now.

export function getCardById(id) {
  const getCard = getPageWindow().getCard;
  if (typeof getCard !== "function") return null;
  try { return getCard(id); } catch { return null; }
}

export function getArtifactById(id) {
  const getArtifact = getPageWindow().getArtifact;
  if (typeof getArtifact !== "function") return null;
  try { return getArtifact(id); } catch { return null; }
}

export function getPlayableCards() {
  return getAllCards().filter(c => c.rarity !== "STORY" && c.rarity !== "TOKEN");
}

// Picks the most-repeated monster card in a deck as its representative
// image, used as a fallback when a channel name doesn't match anything
// in CHANNEL_OVERRIDES.
export function determineImageFromDeck(deckCode) {
  const decoded = decodeDeck(deckCode);
  if (!decoded || !decoded.cardIds) return null;

  const counts = new Map();
  decoded.cardIds.forEach(cardId => {
    const card = getCardById(cardId);
    if (!card || card.typeCard !== 0) return;
    counts.set(cardId, (counts.get(cardId) || 0) + 1);
  });

  let winner = null;
  let highestCount = 0;
  decoded.cardIds.forEach(cardId => {
    const card = getCardById(cardId);
    if (!card || card.typeCard !== 0) return;
    const count = counts.get(cardId);
    if (count >= highestCount) {
      highestCount = count;
      winner = card;
    }
  });

  return winner?.image || null;
}

// ---- card include/exclude filter list helpers ----

export function isCardInList(list, id) {
  return list.some(c => c.id === id);
}

export function removeCardFromList(list, id) {
  const idx = list.findIndex(c => c.id === id);
  if (idx !== -1) list.splice(idx, 1);
}

// Adds a card to one list, removing it from the other if present.
// Deliberately no side effects beyond mutating these two arrays - the
// caller re-filters/re-renders afterward.
export function addCardToFilter(targetList, otherList, card) {
  if (isCardInList(targetList, card.id)) return;
  removeCardFromList(otherList, card.id);
  targetList.push({ id: card.id, name: card.name });
}

export function removeCardFromFilter(list, id) {
  removeCardFromList(list, id);
}

// ---- deck filtering ----

export function filterDecks(allDecks, { activeSoulFilter, activeSearch = "", includeCards = [], excludeCards = [] } = {}) {
  const term = activeSearch.trim().toLowerCase();

  return allDecks.filter(deck => {
    if (activeSoulFilter) {
      const decoded = decodeDeck(deck.deckCode);
      if (!decoded) return false;
      const soul = decoded.soul || decoded.classe;
      if (soul !== activeSoulFilter) return false;
    }

    if (term) {
      const name = (deck.channel || "").toLowerCase().replace(/-/g, " ");
      const author = (deck.author || "").toLowerCase();
      const season = (deck.season || "").toLowerCase();
      if (!name.includes(term) && !author.includes(term) && !season.includes(term)) {
        return false;
      }
    }

    if (includeCards.length > 0 || excludeCards.length > 0) {
      const decoded = decodeDeck(deck.deckCode);
      if (!decoded || !Array.isArray(decoded.cardIds)) return false;
      const idSet = new Set(decoded.cardIds);

      for (const c of includeCards) {
        if (!idSet.has(c.id)) return false;
      }
      for (const c of excludeCards) {
        if (idSet.has(c.id)) return false;
      }
    }

    return true;
  });
}
