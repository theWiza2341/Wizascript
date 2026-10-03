// packages/misc/tier-list/picker.js
//
// The bottom panel items are dragged from. Four kinds, picked with the
// tabs on the left: Cards, Souls, Artifacts and Text.
//
// Cards deliberately start EMPTY: nothing is listed until the player
// searches or ticks a filter, so the window doesn't drown in 1000+
// cards. Souls (7), artifacts and the list's own text items are few
// enough to show straight away. Anything already in a tier is greyed
// out with a tick (dragging it still moves it).
//
// The card filters copy the Crafting/Decks pages: the same icons from
// the game's own images, as on/off toggles (see items.js for how they
// combine). Built here rather than borrowed from the page, since the
// tier list also works on pages that have no filters.
//
// Filter state lives only for this page view.

import * as model from "./model.js";
import {
  searchCards, isFilterActive, cardKey, hasCards, onCardsReady,
  searchSouls, searchArtifacts, loadArtifacts, hasArtifacts
} from "./items.js";
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
const TYPES = [
  ["cards", "Cards"],
  ["souls", "Souls"],
  ["artifacts", "Artifacts"],
  ["text", "Text"]
];

export function createPicker({ body, signal }) {
  const panel = document.createElement("div");
  panel.className = "wz-tl-picker";

  let type = "cards";
  const state = { rarities: new Set(), sets: new Set(), tribes: false, monster: false, spell: false };
  const toggles = []; // { el, isOn }
  const searchText = { cards: "", souls: "", artifacts: "", text: "" };

  const filters = document.createElement("div");
  filters.className = "wz-tl-filters";

  // ---- type tabs ----
  const tabs = document.createElement("div");
  tabs.className = "wz-tl-type-tabs";
  const tabButtons = TYPES.map(([value, label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "wz-tl-type-tab";
    b.dataset.type = value;
    b.textContent = label;
    b.addEventListener("click", () => setType(value), { signal });
    tabs.appendChild(b);
    return b;
  });

  // ---- search / text entry ----
  const search = document.createElement("input");
  search.type = "text";
  search.spellcheck = false;

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "wz-tl-btn";

  const searchRow = document.createElement("div");
  searchRow.className = "wz-tl-search-row";
  searchRow.append(search, clear);

  // ---- card toggles ----
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
  const cardToggles = document.createElement("div");
  cardToggles.className = "wz-tl-card-toggles";
  cardToggles.append(
    group(RARITY_TOGGLES, (v) => state.rarities.has(v), flipSet(state.rarities)),
    group(KIND_TOGGLES, (v) => state[v], (v) => { state[v] = !state[v]; }),
    group(SET_TOGGLES, (v) => state.sets.has(v), flipSet(state.sets))
  );

  filters.append(tabs, searchRow, cardToggles);

  const hint = document.createElement("div");
  hint.className = "wz-tl-hint";
  const results = document.createElement("div");
  results.className = "wz-tl-results";

  panel.append(filters, hint, results);
  body.appendChild(panel);

  function cardFilters() {
    return { text: search.value, ...state };
  }

  function setType(value) {
    searchText[type] = search.value;
    type = value;
    search.value = searchText[type];
    if (type === "artifacts" && !hasArtifacts()) {
      loadArtifacts().then(() => { if (type === "artifacts") render(); });
    }
    render();
    search.focus();
  }

  function syncControls() {
    tabButtons.forEach((b) => b.classList.toggle("wz-tl-active", b.dataset.type === type));
    // Hidden, not removed: keeps its space so the panel (and the tier
    // area above it) doesn't jump when switching between kinds.
    cardToggles.style.visibility = type === "cards" ? "" : "hidden";
    toggles.forEach((t) => t.el.classList.toggle("wz-tl-on", t.isOn()));
    if (type === "text") {
      search.placeholder = "New text item…";
      search.maxLength = model.MAX_TEXT;
      clear.textContent = "Add";
      clear.title = "Add this text as an item you can rank";
      clear.disabled = !search.value.trim();
    } else {
      search.placeholder = type === "cards" ? "Search cards…" : type === "souls" ? "Search souls…" : "Search artifacts…";
      search.removeAttribute("maxLength");
      clear.textContent = "Clear";
      clear.title = "Clear the search and filters";
      clear.disabled = type === "cards" ? !isFilterActive(cardFilters()) : !search.value;
    }
  }

  function showKeys(keys, { deletable = false } = {}) {
    const frag = document.createDocumentFragment();
    keys.forEach((key) => {
      const tile = buildTile(key, { placed: model.isPlaced(key) });
      if (deletable) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "wz-tl-tile-del";
        del.textContent = "×";
        del.title = "Delete this text item";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          model.deleteText(key.slice(5));
        });
        tile.appendChild(del);
      }
      frag.appendChild(tile);
    });
    results.appendChild(frag);
  }

  function renderCards() {
    if (!hasCards()) {
      hint.textContent = "No card data yet. Open the Decks or Crafting page once, then come back.";
      return;
    }
    const f = cardFilters();
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
    showKeys(cards.map(cardKey));
  }

  function renderSouls() {
    const keys = searchSouls(search.value);
    hint.textContent = keys.length ? "Drag a soul into a tier." : "No souls match.";
    showKeys(keys);
  }

  function renderArtifacts() {
    if (!hasArtifacts()) {
      hint.textContent = "Loading artifacts… (if this stays, open the Decks page once, then try again)";
      return;
    }
    const keys = searchArtifacts(search.value);
    hint.textContent = keys.length ? `${keys.length} artifact${keys.length === 1 ? "" : "s"}. Drag one into a tier.` : "No artifacts match.";
    showKeys(keys);
  }

  function renderText() {
    const keys = model.getTextIds().map((id) => `text:${id}`);
    hint.textContent = keys.length
      ? "Drag a text item into a tier. Double-click one to edit it."
      : "Type a label (e.g. an archetype) and press Add to make a text item.";
    showKeys(keys, { deletable: true });
  }

  function render() {
    results.innerHTML = "";
    syncControls();
    if (type === "cards") renderCards();
    else if (type === "souls") renderSouls();
    else if (type === "artifacts") renderArtifacts();
    else renderText();
  }

  function addTextItem() {
    if (model.addText(search.value)) {
      search.value = "";
      render();
    }
  }

  let searchTimer = null;
  search.addEventListener("input", () => {
    if (type === "text") { syncControls(); return; }
    clearTimeout(searchTimer);
    searchTimer = setTimeout(render, SEARCH_DELAY_MS);
  }, { signal });
  search.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && type === "text") { addTextItem(); return; }
    if (e.key === "Escape" && search.value) { search.value = ""; render(); }
  }, { signal });
  clear.addEventListener("click", () => {
    if (type === "text") { addTextItem(); return; }
    search.value = "";
    if (type === "cards") {
      state.rarities.clear();
      state.sets.clear();
      state.tribes = state.monster = state.spell = false;
    }
    render();
  }, { signal });

  const stopListening = onCardsReady(() => { if (type === "cards") render(); });
  signal.addEventListener("abort", stopListening);

  render();

  return {
    element: panel,
    render,
    setOpen(open) { panel.classList.toggle("wz-tl-hidden", !open); },
    focusSearch() { search.focus(); }
  };
}
