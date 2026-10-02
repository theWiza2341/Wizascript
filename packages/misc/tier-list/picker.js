// packages/misc/tier-list/picker.js
//
// The bottom panel cards are dragged from. Deliberately starts EMPTY:
// nothing is listed until the player searches or picks a filter, so the
// window doesn't drown in 1000+ cards. Cards already in a tier are
// greyed out with a tick (dragging them still moves them).
//
// Filter state lives only for this page view - each visit starts with
// an empty picker.

import * as model from "./model.js";
import { searchCards, filterOptions, isFilterActive, cardKey, hasCards, onCardsReady } from "./items.js";
import { buildTile } from "./tiers-view.js";

const RESULT_LIMIT = 150;
const SEARCH_DELAY_MS = 150;

export function createPicker({ body, signal }) {
  const panel = document.createElement("div");
  panel.className = "wz-tl-picker";

  const filters = document.createElement("div");
  filters.className = "wz-tl-filters";

  const search = document.createElement("input");
  search.type = "text";
  search.placeholder = "Search cards…";
  search.spellcheck = false;

  function select(title, options) {
    const s = document.createElement("select");
    s.title = title;
    options.forEach(([value, label]) => {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = label;
      s.appendChild(o);
    });
    return s;
  }

  const setSel = select("Set", [["", "Any set"]]);
  const raritySel = select("Rarity", [["", "Any rarity"]]);
  const typeSel = select("Type", [["", "Any type"], ["0", "Monster"], ["1", "Spell"]]);
  const costSel = select("Cost", [["", "Any cost"], ...Array.from({ length: 10 }, (_, i) => [String(i), `Cost ${i}`]), ["10", "Cost 10+"]]);

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "wz-tl-btn";
  clear.textContent = "Clear";
  clear.title = "Clear the search and filters";

  filters.append(search, setSel, raritySel, typeSel, costSel, clear);

  const hint = document.createElement("div");
  hint.className = "wz-tl-hint";
  const results = document.createElement("div");
  results.className = "wz-tl-results";

  panel.append(filters, hint, results);
  body.appendChild(panel);

  function fillDynamicOptions() {
    const { sets, rarities } = filterOptions();
    const refill = (sel, first, opts) => {
      const keep = sel.value;
      sel.innerHTML = "";
      [[ "", first ], ...opts.map((o) => [o.value, o.label])].forEach(([v, l]) => {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = l;
        sel.appendChild(o);
      });
      sel.value = opts.some((o) => o.value === keep) ? keep : "";
    };
    refill(setSel, "Any set", sets);
    refill(raritySel, "Any rarity", rarities);
  }

  function currentFilters() {
    return { text: search.value, set: setSel.value, rarity: raritySel.value, type: typeSel.value, cost: costSel.value };
  }

  function render() {
    results.innerHTML = "";
    if (!hasCards()) {
      hint.textContent = "No card data yet. Open the Decks or Crafting page once, then come back.";
      return;
    }
    const f = currentFilters();
    clear.disabled = !isFilterActive(f);
    if (!isFilterActive(f)) {
      hint.textContent = "Search or pick a filter to list cards, then drag them into a tier.";
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
  [setSel, raritySel, typeSel, costSel].forEach((s) => s.addEventListener("change", render, { signal }));
  clear.addEventListener("click", () => {
    search.value = "";
    [setSel, raritySel, typeSel, costSel].forEach((s) => { s.value = ""; });
    render();
  }, { signal });

  const stopListening = onCardsReady(() => {
    fillDynamicOptions();
    render();
  });
  signal.addEventListener("abort", stopListening);

  fillDynamicOptions();
  render();

  return {
    element: panel,
    render,
    setOpen(open) { panel.classList.toggle("wz-tl-hidden", !open); },
    focusSearch() { search.focus(); }
  };
}
