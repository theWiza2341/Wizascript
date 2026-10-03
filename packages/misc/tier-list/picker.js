// packages/misc/tier-list/picker.js
//
// The bottom panel cards are dragged from. Deliberately starts EMPTY:
// nothing is listed until the player searches or ticks a filter, so the
// window doesn't drown in 1000+ cards. Cards already in a tier are
// greyed out with a tick (dragging them still moves them).
//
// The filters copy the Crafting/Decks pages: the same icons from the
// game's own images, as on/off toggles (see items.js for how they
// combine). Built here rather than borrowed from the page, since the
// tier list also works on pages that have no filters.
//
// Filter state lives only for this page view - each visit starts with
// an empty picker.

import * as model from "./model.js";
import { searchCards, isFilterActive, cardKey, hasCards, onCardsReady } from "./items.js";
import { buildTile } from "./tiers-view.js";

const RESULT_LIMIT = 150;
const SEARCH_DELAY_MS = 150;

// [value, image, title]. Story has no confirmed icon yet - if the
// image is missing, the toggle shows the word instead.
const RARITY_TOGGLES = [
  ["BASE", "images/rarity/BASE_BASE.png", "Base"],
  ["TOKEN", "images/rarity/BASE_TOKEN.png", "Token"],
  ["COMMON", "images/rarity/BASE_COMMON.png", "Common"],
  ["RARE", "images/rarity/BASE_RARE.png", "Rare"],
  ["EPIC", "images/rarity/BASE_EPIC.png", "Epic"],
  ["LEGENDARY", "images/rarity/BASE_LEGENDARY.png", "Legendary"],
  ["DETERMINATION", "images/rarity/BASE_DETERMINATION.png", "Determination"],
  ["STORY", "images/rarity/BASE_STORY.png", "Story"]
];
const KIND_TOGGLES = [
  ["tribes", "images/tribes/ALL.png", "Monsters with tribes"],
  ["monster", "images/souls/MONSTER.png", "Monsters"],
  ["spell", "images/artifacts/Arcane_Scepter.png", "Spells"]
];
const SET_TOGGLES = [
  ["BASE", "images/rarity/BASE.png", "Undertale cards"],
  ["DELTARUNE", "images/rarity/DELTARUNE.png", "Deltarune cards"],
  ["UTY", "images/rarity/UTY.png", "Undertale Yellow cards"]
];

export function createPicker({ body, signal }) {
  const panel = document.createElement("div");
  panel.className = "wz-tl-picker";

  const state = { rarities: new Set(), sets: new Set(), tribes: false, monster: false, spell: false };
  const toggles = []; // { el, isOn }

  const filters = document.createElement("div");
  filters.className = "wz-tl-filters";

  const search = document.createElement("input");
  search.type = "text";
  search.placeholder = "Search cards…";
  search.spellcheck = false;

  function makeToggle([value, src, title], isOn, flip) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "wz-tl-toggle";
    b.title = title;
    b.dataset.filter = value;
    const img = document.createElement("img");
    img.src = "/" + src;
    img.alt = title;
    img.draggable = false;
    img.addEventListener("error", () => {
      img.remove();
      b.textContent = title;
      b.classList.add("wz-tl-toggle-text");
    }, { once: true });
    b.appendChild(img);
    b.addEventListener("click", () => {
      flip(value);
      sync();
      render();
    }, { signal });
    toggles.push({ el: b, isOn: () => isOn(value) });
    return b;
  }

  function group(defs, isOn, flip) {
    const g = document.createElement("div");
    g.className = "wz-tl-toggle-group";
    defs.forEach((d) => g.appendChild(makeToggle(d, isOn, flip)));
    return g;
  }

  const flipSet = (set) => (v) => (set.has(v) ? set.delete(v) : set.add(v));
  const rarityGroup = group(RARITY_TOGGLES, (v) => state.rarities.has(v), flipSet(state.rarities));
  const kindGroup = group(KIND_TOGGLES, (v) => state[v], (v) => { state[v] = !state[v]; });
  const setGroup = group(SET_TOGGLES, (v) => state.sets.has(v), flipSet(state.sets));

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "wz-tl-btn";
  clear.textContent = "Clear";
  clear.title = "Clear the search and filters";

  const searchRow = document.createElement("div");
  searchRow.className = "wz-tl-search-row";
  searchRow.append(search, clear);
  filters.append(searchRow, rarityGroup, kindGroup, setGroup);

  const hint = document.createElement("div");
  hint.className = "wz-tl-hint";
  const results = document.createElement("div");
  results.className = "wz-tl-results";

  panel.append(filters, hint, results);
  body.appendChild(panel);

  function currentFilters() {
    return { text: search.value, ...state };
  }

  function sync() {
    toggles.forEach((t) => t.el.classList.toggle("wz-tl-on", t.isOn()));
    clear.disabled = !isFilterActive(currentFilters());
  }

  function render() {
    results.innerHTML = "";
    sync();
    if (!hasCards()) {
      hint.textContent = "No card data yet. Open the Decks or Crafting page once, then come back.";
      return;
    }
    const f = currentFilters();
    if (!isFilterActive(f)) {
      hint.textContent = "Search or tick a filter to list cards, then drag them into a tier.";
      return;
    }
    const { results: cards, total } = searchCards(f, RESULT_LIMIT);
    if (!total) {
      hint.textContent = "No cards match.";
      return;
    }
    hint.textContent = total > cards.length
      ? `Showing ${cards.length} of ${total} cards. Narrow the search to see the rest.`
      : `${total} card${total === 1 ? "" : "s"}. Drag one into a tier.`;
    const frag = document.createDocumentFragment();
    cards.forEach((card) => {
      const key = cardKey(card);
      frag.appendChild(buildTile(key, { placed: model.isPlaced(key) }));
    });
    results.appendChild(frag);
  }

  let searchTimer = null;
  search.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(render, SEARCH_DELAY_MS);
  }, { signal });
  search.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && search.value) { search.value = ""; render(); }
  }, { signal });
  clear.addEventListener("click", () => {
    search.value = "";
    state.rarities.clear();
    state.sets.clear();
    state.tribes = state.monster = state.spell = false;
    render();
  }, { signal });

  const stopListening = onCardsReady(render);
  signal.addEventListener("abort", stopListening);

  render();

  return {
    element: panel,
    render,
    setOpen(open) { panel.classList.toggle("wz-tl-hidden", !open); },
    focusSearch() { search.focus(); }
  };
}
