// packages/misc/tier-list/tiers-view.js
//
// Draws the tier rows and the small tier editor (rename, recolour,
// move, add, clear, delete). Rows and tiles carry stable data ids
// (data-tier-id, data-key) so drag.js - and a v2 controller mode - can
// address them.

import * as model from "./model.js";
import { resolveItem, RARITY_COLORS } from "./items.js";

export function buildTile(key, { placed = false } = {}) {
  const item = resolveItem(key);
  const tile = document.createElement("div");
  tile.className = "wz-tl-tile";
  tile.dataset.key = key;
  tile.tabIndex = -1;
  if (item.image) tile.style.backgroundImage = `url("${item.image}")`;
  else tile.classList.add("wz-tl-noimg");
  if (item.rarity && RARITY_COLORS[item.rarity]) tile.style.setProperty("--wz-tl-rarity", RARITY_COLORS[item.rarity]);
  if (placed) tile.classList.add("wz-tl-placed");
  const name = document.createElement("div");
  name.className = "wz-tl-tile-name";
  name.textContent = item.label;
  tile.appendChild(name);
  return tile;
}

export function createTiersView({ body, signal }) {
  const container = document.createElement("div");
  container.className = "wz-tl-tiers";
  body.appendChild(container);

  let editor = null; // { el, tierId }

  function closeEditor() {
    if (editor) editor.el.remove();
    editor = null;
  }

  function openEditor(tierId, anchor) {
    closeEditor();
    const list = model.getActiveList();
    const index = list.tiers.findIndex((t) => t.id === tierId);
    const tier = list.tiers[index];
    if (!tier) return;

    const el = document.createElement("div");
    el.className = "wz-tl-editor";
    el.dataset.tierId = tierId;

    const name = document.createElement("input");
    name.type = "text";
    name.maxLength = 40;
    name.value = tier.label;
    name.placeholder = "Tier name";
    const commitName = () => model.renameTier(tierId, name.value);
    name.addEventListener("change", commitName);
    name.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { commitName(); closeEditor(); }
      if (e.key === "Escape") closeEditor();
    });

    const swatches = document.createElement("div");
    swatches.className = "wz-tl-swatches";
    model.TIER_COLORS.forEach((color) => {
      const s = document.createElement("div");
      s.className = "wz-tl-swatch" + (color === tier.color ? " wz-tl-active" : "");
      s.style.background = color;
      s.title = color;
      s.addEventListener("click", () => {
        model.recolorTier(tierId, color);
        swatches.querySelectorAll(".wz-tl-swatch").forEach((n) => n.classList.toggle("wz-tl-active", n === s));
        custom.value = color;
      });
      swatches.appendChild(s);
    });
    const custom = document.createElement("input");
    custom.type = "color";
    custom.value = tier.color;
    custom.title = "Custom colour";
    custom.addEventListener("change", () => model.recolorTier(tierId, custom.value));
    swatches.appendChild(custom);

    const grid = document.createElement("div");
    grid.className = "wz-tl-editor-buttons";
    const btn = (label, fn, opts = {}) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wz-tl-btn";
      b.textContent = label;
      if (opts.disabled) b.disabled = true;
      b.addEventListener("click", () => {
        commitName();
        fn();
        if (opts.close) closeEditor();
        else reopen();
      });
      grid.appendChild(b);
      return b;
    };
    const reopen = () => {
      const row = container.querySelector(`.wz-tl-row[data-tier-id="${tierId}"]`);
      if (row) openEditor(tierId, row);
      else closeEditor();
    };
    btn("▲ Move up", () => model.moveTier(tierId, -1), { disabled: index === 0 });
    btn("▼ Move down", () => model.moveTier(tierId, 1), { disabled: index === list.tiers.length - 1 });
    btn("+ Row above", () => model.addTier(index), { close: true });
    btn("+ Row below", () => model.addTier(index + 1), { close: true });
    btn("Clear row", () => model.clearTier(tierId), { disabled: !tier.items.length });
    const del = btn("Delete row", () => model.deleteTier(tierId), { close: true });
    del.classList.add("wz-tl-danger");
    btn("Done", () => {}, { close: true }).style.gridColumn = "1 / -1";

    el.append(name, swatches, grid);
    body.appendChild(el);

    // Under the row's label, kept inside the window.
    const bodyRect = body.getBoundingClientRect();
    const aRect = anchor.getBoundingClientRect();
    let top = aRect.bottom - bodyRect.top + 2;
    if (top + el.offsetHeight > body.clientHeight) top = Math.max(2, aRect.top - bodyRect.top - el.offsetHeight - 2);
    el.style.top = Math.max(2, top) + "px";
    el.style.left = "6px";
    editor = { el, tierId };
    name.focus();
    name.select();
  }

  function render() {
    const list = model.getActiveList();
    const scroll = container.scrollTop;
    container.innerHTML = "";
    list.tiers.forEach((tier) => {
      const row = document.createElement("div");
      row.className = "wz-tl-row";
      row.dataset.tierId = tier.id;

      const label = document.createElement("div");
      label.className = "wz-tl-row-label";
      label.style.background = tier.color;
      label.textContent = tier.label;
      label.title = "Click to edit this tier";
      label.addEventListener("click", () => openEditor(tier.id, row));

      const items = document.createElement("div");
      items.className = "wz-tl-row-items";
      tier.items.forEach((key) => items.appendChild(buildTile(key)));

      const tools = document.createElement("div");
      tools.className = "wz-tl-row-tools";
      const gear = document.createElement("button");
      gear.type = "button";
      gear.textContent = "⚙";
      gear.title = "Edit this tier";
      gear.addEventListener("click", () => openEditor(tier.id, row));
      const up = document.createElement("button");
      up.type = "button";
      up.textContent = "▲";
      up.title = "Move tier up";
      up.addEventListener("click", () => model.moveTier(tier.id, -1));
      const down = document.createElement("button");
      down.type = "button";
      down.textContent = "▼";
      down.title = "Move tier down";
      down.addEventListener("click", () => model.moveTier(tier.id, 1));
      tools.append(up, gear, down);

      row.append(label, items, tools);
      container.appendChild(row);
    });

    const add = document.createElement("button");
    add.type = "button";
    add.className = "wz-tl-btn wz-tl-add-row";
    add.textContent = "+ Add tier";
    add.addEventListener("click", () => model.addTier());
    container.appendChild(add);
    container.scrollTop = scroll;

    // Keep an open editor in sync (e.g. after undo) or close it if its
    // tier is gone.
    if (editor && !list.tiers.some((t) => t.id === editor.tierId)) closeEditor();
  }

  // Clicking elsewhere closes the editor.
  document.addEventListener("pointerdown", (e) => {
    if (!editor) return;
    if (editor.el.contains(e.target)) return;
    if (e.target.closest(".wz-tl-row-label, .wz-tl-row-tools")) return;
    closeEditor();
  }, { signal, capture: true });

  return { render, closeEditor, element: container };
}
