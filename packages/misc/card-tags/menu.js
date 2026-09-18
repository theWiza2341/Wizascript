// packages/misc/card-tags/menu.js
//
// Cursor-positioned tag menu (right-click a card to open it), the
// "+ New Tag" creation prompt, and the "Manage Tags..." rename/delete
// dialog. Both dialogs use BootstrapDialog, the same native pattern
// Deck Tracker's "Save as Preset" prompt uses.

import { getPageWindow } from "../../core/page-window.js";
import {
  allTags, createTag, updateTag, deleteTag,
  cardHasTag, toggleCardTag, DEFAULT_COLORS
} from "./storage.js";
import { decorateCard, decorateAllCards } from "./indicators.js";

let logger = null;
export function setMenuLogger(instance) {
  logger = instance;
}

let openMenuEl = null;
let outsideClick = null;
let outsideContext = null;

// Only worth re-running the native search filter if the search box
// actually has something typed in it - that's the only thing a tag
// change can affect (a tag-name search match appearing/disappearing).
// Every on-card indicator update already happens explicitly wherever a
// tag actually changes (see the decorateCard()/decorateAllCards() calls
// below), so there's nothing else this needs to cover. Running it
// unconditionally forces a full grid re-render - and a visible
// indicator-dot flash, since the re-render briefly wipes every dot
// until the next redraw - for no benefit the vast majority of the time.
function maybeRefreshSearch() {
  const searchEl = document.getElementById("searchInput");
  if (searchEl && searchEl.value.trim()) refreshSearch();
}

function refreshSearch() {
  const pageWindow = getPageWindow();
  try {
    if (typeof pageWindow.applyFilters === "function") pageWindow.applyFilters();
    if (typeof pageWindow.showPage === "function") pageWindow.showPage(pageWindow.currentPage);
    // Redraw indicators right away instead of waiting on the on-card
    // indicator's MutationObserver debounce - applyFilters()/showPage()
    // are synchronous, so the grid is already rebuilt by this point,
    // and redrawing immediately avoids a visible gap where dots are
    // briefly missing.
    decorateAllCards();
  } catch (e) {
    logger?.warn(null, "applyFilters()/showPage() call failed.", e);
  }
}

function closeTagMenu() {
  if (!openMenuEl) return;
  if (outsideClick) document.removeEventListener("click", outsideClick);
  if (outsideContext) document.removeEventListener("contextmenu", outsideContext);
  outsideClick = null;
  outsideContext = null;
  openMenuEl.remove();
  openMenuEl = null;
  maybeRefreshSearch();
}

export function openTagMenu(card, cards, x, y) {
  closeTagMenu();

  const menu = document.createElement("div");
  menu.className = "wiza-tag-menu";
  Object.assign(menu.style, {
    position: "fixed", left: x + "px", top: y + "px", zIndex: 999999,
    background: "#1b1b1f", border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "8px", minWidth: "200px", maxWidth: "260px",
    boxShadow: "0 4px 18px rgba(0,0,0,0.5)", overflow: "hidden",
    fontFamily: "inherit", fontSize: "13px", color: "#eee"
  });

  // Filter box - mainly for once there are a lot of tags (10+ gets hard
  // to scan/scroll through). Doubles as a fast way to jump straight to
  // one by typing a few letters.
  const filterInput = document.createElement("input");
  filterInput.type = "text";
  filterInput.placeholder = "Filter tags…";
  Object.assign(filterInput.style, {
    width: "100%", boxSizing: "border-box", padding: "7px 10px", border: "none",
    borderBottom: "1px solid rgba(255,255,255,0.15)", background: "transparent",
    color: "#eee", outline: "none", fontSize: "13px"
  });
  menu.appendChild(filterInput);

  const rowsWrap = document.createElement("div");
  Object.assign(rowsWrap.style, { maxHeight: "220px", overflowY: "auto" });

  function makeRow({ label, onClick, active, secondary, swatch }) {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 12px", cursor: "pointer", gap: "8px",
      background: active ? "rgba(120,170,255,0.18)" : "transparent",
      borderBottom: "1px solid rgba(255,255,255,0.08)"
    });
    row.addEventListener("mouseenter", () => { if (!active) row.style.background = "rgba(255,255,255,0.08)"; });
    row.addEventListener("mouseleave", () => { row.style.background = active ? "rgba(120,170,255,0.18)" : "transparent"; });

    const left = document.createElement("span");
    left.style.cssText = "display:flex;align-items:center;gap:8px;overflow:hidden;flex:1;";
    if (swatch) {
      const dot = document.createElement("span");
      dot.style.cssText = "width:10px;height:10px;border-radius:50%;background:" + swatch + ";flex-shrink:0;";
      left.appendChild(dot);
    }
    const text = document.createElement("span");
    text.textContent = (active ? "✓ " : "") + label;
    text.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
    left.appendChild(text);
    row.appendChild(left);

    if (secondary) {
      const secBtn = document.createElement("span");
      secBtn.textContent = secondary.label;
      secBtn.title = secondary.title || "";
      secBtn.style.cssText = "color:#9ab;flex-shrink:0;padding:2px 4px;";
      secBtn.addEventListener("click", (ev) => { ev.stopPropagation(); secondary.onClick(); });
      row.appendChild(secBtn);
    }

    // stopPropagation so a row click never reaches the document-level
    // "click outside the menu closes it" listener below.
    row.addEventListener("click", (ev) => { ev.stopPropagation(); onClick(); });
    return row;
  }

  function renderRows(filterTerm) {
    rowsWrap.innerHTML = "";
    const term = (filterTerm || "").trim().toLowerCase();
    const tags = allTags().filter(t => !term || t.name.toLowerCase().includes(term));

    if (!tags.length) {
      const empty = document.createElement("div");
      empty.style.cssText = "padding:10px 12px;color:#999;";
      empty.textContent = allTags().length ? "No matching tags." : "No tags yet.";
      rowsWrap.appendChild(empty);
      return;
    }

    tags.forEach(tag => {
      rowsWrap.appendChild(makeRow({
        label: tag.name,
        swatch: tag.color,
        active: cardHasTag(card.id, tag.id),
        onClick: () => {
          toggleCardTag(card.id, tag.id);
          decorateCard(card.id); // instant on-card feedback, independent of the close-time refresh
          renderRows(filterInput.value); // stay open, just reflect the new state
        },
        secondary: {
          label: "👁",
          title: 'See cards tagged "' + tag.name + '"',
          onClick: () => showCardsForTag(tag, cards)
        }
      }));
    });
  }
  renderRows("");
  menu.appendChild(rowsWrap);

  filterInput.addEventListener("input", () => renderRows(filterInput.value));

  const divider = document.createElement("div");
  divider.style.cssText = "height:1px;background:rgba(255,255,255,0.15);";
  menu.appendChild(divider);

  const newTagRow = makeRow({ label: "+ New Tag", onClick: () => { closeTagMenu(); promptNewTag(card, cards, x, y); } });
  newTagRow.style.color = "#8f8";
  menu.appendChild(newTagRow);

  const manageRow = makeRow({ label: "Manage Tags…", onClick: () => { closeTagMenu(); openManageTagsDialog(); } });
  manageRow.style.color = "#9ab";
  menu.appendChild(manageRow);

  // Backstop alongside each row's own stopPropagation() above.
  menu.addEventListener("click", ev => ev.stopPropagation());

  document.body.appendChild(menu);
  openMenuEl = menu;

  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = Math.max(0, window.innerWidth - rect.width - 8) + "px";
  if (rect.bottom > window.innerHeight) menu.style.top = Math.max(0, window.innerHeight - rect.height - 8) + "px";

  filterInput.focus();

  // Close on a click/right-click outside the menu. Some trackpads/mice
  // fire an extra 'click' (occasionally even a second 'contextmenu') as
  // part of the SAME physical right-click gesture that just opened this
  // menu - without a short grace window, that stray event closes the
  // menu the instant it opens. A real, deliberate outside click is
  // never this fast. Listeners are removed explicitly in closeTagMenu()
  // so nothing is left dangling regardless of how the menu closes.
  const openedAt = performance.now();
  function outsideCloser(e) {
    if (performance.now() - openedAt < 200) return; // same-gesture ghost event - ignore
    if (menu.contains(e.target)) return; // click landed inside the menu itself
    closeTagMenu();
  }
  outsideClick = outsideCloser;
  outsideContext = outsideCloser;
  document.addEventListener("click", outsideClick);
  document.addEventListener("contextmenu", outsideContext);
}

function promptNewTag(card, cards, reopenX, reopenY) {
  const pageWindow = getPageWindow();
  const BootstrapDialog = pageWindow.BootstrapDialog;
  if (typeof BootstrapDialog === "undefined" || typeof BootstrapDialog.show !== "function") {
    logger?.warn(null, "BootstrapDialog is not available - cannot open the new-tag dialog.");
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex;gap:8px;align-items:center;min-width:260px;";

  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = DEFAULT_COLORS[allTags().length % DEFAULT_COLORS.length];
  colorInput.style.cssText = "width:32px;height:32px;padding:0;border:none;background:none;flex-shrink:0;cursor:pointer;";
  wrapper.appendChild(colorInput);

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Tag name…";
  input.className = "form-control";
  input.style.cssText = "flex:1;padding:6px 8px;font-size:13px;";
  wrapper.appendChild(input);

  BootstrapDialog.show({
    title: "New tag",
    message: wrapper,
    cssClass: "mono",
    buttons: [
      { label: "Cancel", action: d => d.close() },
      {
        label: "Create", cssClass: "btn-success",
        action: d => {
          const name = input.value.trim();
          if (!name) return;
          const tag = createTag(name, colorInput.value);
          toggleCardTag(card.id, tag.id);
          decorateCard(card.id);
          d.close();
          openTagMenu(card, cards, reopenX, reopenY);
        }
      }
    ]
  });
  setTimeout(() => input.focus(), 100);
}

function openManageTagsDialog() {
  const pageWindow = getPageWindow();
  const BootstrapDialog = pageWindow.BootstrapDialog;
  if (typeof BootstrapDialog === "undefined" || typeof BootstrapDialog.show !== "function") {
    logger?.warn(null, "BootstrapDialog is not available - cannot open tag management.");
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "min-width:280px;max-height:320px;overflow-y:auto;";

  function renderList() {
    wrapper.innerHTML = "";
    if (!allTags().length) {
      const empty = document.createElement("div");
      empty.style.cssText = "color:#999;padding:6px 0;";
      empty.textContent = "No tags yet.";
      wrapper.appendChild(empty);
      return;
    }
    allTags().forEach(tag => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);";

      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.value = tag.color || DEFAULT_COLORS[0];
      colorInput.style.cssText = "width:26px;height:26px;padding:0;border:none;background:none;flex-shrink:0;cursor:pointer;";
      colorInput.addEventListener("change", () => {
        updateTag(tag.id, { color: colorInput.value });
        decorateAllCards();
      });
      row.appendChild(colorInput);

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = tag.name;
      nameInput.className = "form-control";
      nameInput.style.cssText = "flex:1;padding:5px 7px;font-size:13px;";
      nameInput.addEventListener("change", () => {
        const v = nameInput.value.trim();
        if (v) updateTag(tag.id, { name: v }); else nameInput.value = tag.name;
        decorateAllCards(); // picks up the new name in each dot's tooltip
      });
      row.appendChild(nameInput);

      // Red "-" box, same look/feel as Patch Maker's destructive
      // controls (uc-li-del/uc-card-del/uc-section-del). No confirm()
      // messagebox - a genuine double-click (e.detail === 2) is the
      // confirmation instead, so this stays quick without a second
      // native dialog stacked inside the one already open.
      const delBtn = document.createElement("div");
      delBtn.textContent = "-";
      delBtn.title = "Double-click to delete (removes from every tagged card)";
      delBtn.style.cssText = "width:26px;height:26px;flex-shrink:0;display:flex;align-items:center;justify-content:center;"
        + "background:rgba(220,53,69,0.15);color:#e05260;border:1px solid rgba(220,53,69,0.5);border-radius:4px;"
        + "font-weight:700;font-size:16px;line-height:1;cursor:pointer;user-select:none;";
      delBtn.addEventListener("mouseenter", () => { delBtn.style.background = "rgba(220,53,69,0.3)"; });
      delBtn.addEventListener("mouseleave", () => { delBtn.style.background = "rgba(220,53,69,0.15)"; });
      delBtn.addEventListener("click", e => {
        if (e.detail !== 2) return; // require a real double-click, not a single stray click
        deleteTag(tag.id);
        decorateAllCards();
        renderList();
      });
      row.appendChild(delBtn);

      wrapper.appendChild(row);
    });
  }
  renderList();

  BootstrapDialog.show({
    title: "Manage Tags",
    message: wrapper,
    cssClass: "mono",
    buttons: [{ label: "Close", action: d => { d.close(); maybeRefreshSearch(); } }]
  });
}

function showCardsForTag(tag, cards) {
  const pageWindow = getPageWindow();
  const BootstrapDialog = pageWindow.BootstrapDialog;

  const matches = cards.filter(c => c && c.id != null && cardHasTag(c.id, tag.id));
  const listText = matches.length
    ? matches.map(c => c.name).join(", ")
    : '(nothing tagged "' + tag.name + '" yet)';

  if (typeof BootstrapDialog === "undefined" || typeof BootstrapDialog.show !== "function") {
    alert('Cards tagged "' + tag.name + '": ' + listText);
    return;
  }
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "max-height:260px;overflow-y:auto;";
  wrapper.textContent = listText;
  BootstrapDialog.show({
    title: 'Tagged "' + tag.name + '" (' + matches.length + ")",
    message: wrapper,
    cssClass: "mono",
    buttons: [{ label: "Close", action: d => d.close() }]
  });
}
