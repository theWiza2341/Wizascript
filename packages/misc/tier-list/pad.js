// packages/misc/tier-list/pad.js
//
// Controller ("d-pad mode") support for the tier list window. Controller
// Support (packages/controller/index.js) drives this every frame while
// the window is open and on top: the d-pad calls nav(), and the Tier
// List controls (rebindable on the Controller Support tab) call
// press() / back() / quickSend() / jump().
//
// Everything is one spatial grid: the d-pad moves a highlight to the
// nearest item in that direction, across the header buttons, tier rows,
// the item panel's tabs/search/filters and its results. Every change to
// the list still goes through model.js, the same as mouse drag and drop.
//
// Items are tracked by a "nav id" rather than by element, because the
// list re-renders (new elements) after every change:
//   hb:<n>   header button n       title       list name
//   l:<id>   tier label            t:<key>     tile in a tier
//   e:<id>   end of a tier row (only while holding an item)
//   add      + Add tier            tab:<type>  panel tab
//   search   search / text box     clear       Clear / Add button
//   f:<n>    filter toggle n       p:<key>     tile in the panel
//   ed:<n> / lm:<n> / qs:<n>  items in the tier editor / Lists menu /
//            quick-send menu (navigation stays inside an open menu)

import * as model from "./model.js";

const TIER_AREA = /^(l:|t:|e:|add$)/;
const PANEL_AREA = /^(p:|tab:|search$|clear$|f:)/;

function visible(el) {
  if (!el || !el.isConnected || !el.getClientRects().length) return false;
  return getComputedStyle(el).visibility !== "hidden";
}

function center(r) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function createPad({ root, tiers, picker, preview, closeListsMenu, isListsMenuOpen, hide }) {
  let focusId = null;
  let lastRect = null;
  let held = null;        // { key, from: "tier" | "panel" }
  let sendMenu = null;    // { el, key, returnTo }
  let shown = true;       // false while the controller is in cursor mode
  let lastTier = null;    // remembered spots for jump()
  let lastPanel = null;
  let highlighted = null;
  let dirty = true; // set by anything that moves or changes the highlight
  let marker = null;
  let previewFor = null; // the tile whose preview is armed

  // ---------- collecting navigable items ----------

  function trapRoot() {
    if (sendMenu && sendMenu.el.isConnected) return { el: sendMenu.el, prefix: "qs" };
    const editor = root.querySelector(".wz-tl-editor");
    if (editor) return { el: editor, prefix: "ed" };
    const menu = root.querySelector(".wz-tl-menu");
    if (menu) return { el: menu, prefix: "lm" };
    return null;
  }

  function items() {
    const out = [];
    const push = (el, id) => { if (visible(el)) out.push({ el, id }); };
    const trap = trapRoot();
    if (trap) {
      [...trap.el.querySelectorAll("button, input, .wz-tl-swatch")].forEach((el, i) => push(el, `${trap.prefix}:${i}`));
      return out;
    }
    const title = root.querySelector(".wz-tl-title");
    push(title, "title");
    root.querySelectorAll(".wz-tl-header button").forEach((el, i) => push(el, `hb:${i}`));
    root.querySelectorAll(".wz-tl-row").forEach((row) => {
      const tierId = row.dataset.tierId;
      push(row.querySelector(".wz-tl-row-label"), `l:${tierId}`);
      row.querySelectorAll(".wz-tl-row-items .wz-tl-tile").forEach((t) => push(t, `t:${t.dataset.key}`));
      if (held) push(row.querySelector(".wz-tl-row-items"), `e:${tierId}`);
    });
    push(root.querySelector(".wz-tl-add-row"), "add");
    const panel = root.querySelector(".wz-tl-picker");
    if (panel && visible(panel)) {
      panel.querySelectorAll(".wz-tl-type-tab").forEach((el) => push(el, `tab:${el.dataset.type}`));
      push(panel.querySelector(".wz-tl-search-row input"), "search");
      push(panel.querySelector(".wz-tl-search-row button"), "clear");
      panel.querySelectorAll(".wz-tl-toggle").forEach((el, i) => push(el, `f:${i}`));
      panel.querySelectorAll(".wz-tl-results .wz-tl-tile").forEach((t) => push(t, `p:${t.dataset.key}`));
    }
    return out;
  }

  function find(list, id) {
    return list.find((it) => it.id === id) || null;
  }

  // The focused item, or - if it vanished (re-render, hidden by a
  // setting, menu closed) - whatever is now nearest to where it was.
  function current(list = items()) {
    let it = focusId ? find(list, focusId) : null;
    if (!it && list.length) {
      if (lastRect) {
        const c = center(lastRect);
        it = list.reduce((best, cand) => {
          const p = center(cand.el.getBoundingClientRect());
          const d = Math.hypot(p.x - c.x, p.y - c.y);
          return !best || d < best.d ? { it: cand, d } : best;
        }, null).it;
      } else {
        it = list[0];
      }
      setFocus(it);
    }
    return it;
  }

  function setFocus(it) {
    if (!it) return;
    focusId = it.id;
    lastRect = it.el.getBoundingClientRect();
    if (TIER_AREA.test(it.id)) lastTier = it.id;
    else if (PANEL_AREA.test(it.id)) lastPanel = it.id;
    it.el.scrollIntoView({ block: "nearest", inline: "nearest" });
    lastRect = it.el.getBoundingClientRect();
  }

  // ---------- drawing ----------

  function placeMarker(it) {
    if (marker) { marker.remove(); marker = null; }
    if (!held || !it) return;
    let rowItems = null;
    let before = null;
    if (it.id.startsWith("t:")) {
      rowItems = it.el.parentElement;
      before = it.el;
      if (it.el.dataset.key === held.key) return;
    } else if (it.id.startsWith("e:") || it.id.startsWith("l:")) {
      const row = it.el.closest(".wz-tl-row");
      rowItems = row && row.querySelector(".wz-tl-row-items");
    }
    if (!rowItems) return;
    marker = document.createElement("div");
    marker.className = "wz-tl-marker";
    rowItems.insertBefore(marker, before);
  }

  // Called every frame by Controller Support - cheap when nothing changed.
  function syncHeld() {
    root.querySelectorAll(".wz-tl-pad-held").forEach((n) => { if (!held || n.dataset.key !== held.key) n.classList.remove("wz-tl-pad-held"); });
    if (held) root.querySelectorAll(`.wz-tl-tile[data-key="${CSS.escape(held.key)}"]`).forEach((n) => n.classList.add("wz-tl-pad-held"));
  }

  function draw(color) {
    root.classList.add("wz-tl-pad");
    if (color) root.style.setProperty("--wz-tl-pad-color", color);
    // Fast path: same element still highlighted and still on the page.
    if (!dirty && shown && highlighted && highlighted.isConnected && highlighted.dataset.padId === focusId) {
      if (held && marker && !marker.isConnected) placeMarker({ id: focusId, el: highlighted });
      if (held) syncHeld();
      return;
    }
    dirty = false;
    const it = shown ? current() : null;
    const el = it ? it.el : null;
    if (el !== highlighted || (el && el.dataset.padId !== (it && it.id))) {
      if (highlighted) highlighted.classList.remove("wz-tl-pad-focus");
      if (el) { el.classList.add("wz-tl-pad-focus"); el.dataset.padId = it.id; }
      highlighted = el;
    }
    placeMarker(it);
    // Resting on a card shows its full preview after the usual delay
    // (not while holding something or choosing a tier).
    const wantPreview = el && el.classList.contains("wz-tl-tile") && !held && !sendMenu ? el : null;
    if (wantPreview !== previewFor) {
      previewFor = wantPreview;
      if (wantPreview) preview.showNear(wantPreview);
      else preview.hide();
    }
    syncHeld();
  }

  function clearDrawing() {
    if (highlighted) highlighted.classList.remove("wz-tl-pad-focus");
    highlighted = null;
    previewFor = null;
    dirty = true;
    if (marker) { marker.remove(); marker = null; }
    root.querySelectorAll(".wz-tl-pad-held").forEach((n) => n.classList.remove("wz-tl-pad-held"));
    root.classList.remove("wz-tl-pad");
    preview.hide();
  }

  // ---------- d-pad ----------

  function nav(dir) {
    const list = items();
    const it = current(list);
    if (!it) return;
    const cr = it.el.getBoundingClientRect();
    const c = center(cr);
    let best = null;
    list.forEach((cand) => {
      if (cand === it) return;
      const r = cand.el.getBoundingClientRect();
      const p = center(r);
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      let primary;
      let ortho;
      // Left/right only move along the same row - at the end of a row,
      // the highlight stays put rather than jumping diagonally.
      const sameRow = Math.abs(dy) <= Math.max(cr.height, r.height) * 0.6;
      if (dir === "left") { if (dx > -4 || !sameRow) return; primary = -dx; ortho = Math.abs(dy); }
      else if (dir === "right") { if (dx < 4 || !sameRow) return; primary = dx; ortho = Math.abs(dy); }
      else if (dir === "up") { if (dy > -4) return; primary = -dy; ortho = Math.abs(dx); }
      else { if (dy < 4) return; primary = dy; ortho = Math.abs(dx); }
      // Left/right stay on the same row where possible.
      const score = primary + ortho * (dir === "left" || dir === "right" ? 4 : 1.5);
      if (!best || score < best.score) best = { cand, score };
    });
    if (best) setFocus(best.cand);
    dirty = true; // force a redraw
  }

  // ---------- actions ----------

  function tierIndexOf(tierId, key) {
    const tier = model.getActiveList().tiers.find((t) => t.id === tierId);
    if (!tier) return -1;
    return tier.items.filter((k) => k !== held.key).indexOf(key);
  }

  function drop(it) {
    const key = held.key;
    if (it.id.startsWith("t:")) {
      const tierId = it.el.closest(".wz-tl-row").dataset.tierId;
      const target = it.id.slice(2);
      if (target !== key) model.placeItem(key, tierId, tierIndexOf(tierId, target));
    } else if (it.id.startsWith("e:") || it.id.startsWith("l:")) {
      model.placeItem(key, it.id.slice(2));
    } else if (PANEL_AREA.test(it.id)) {
      if (held.from === "tier") model.removeItem(key);
    } else {
      return false; // header etc. - keep holding
    }
    held = null;
    if (model.isPlaced(key) && (it.id.startsWith("t:") || it.id.startsWith("e:") || it.id.startsWith("l:"))) focusId = `t:${key}`;
    dirty = true;
    return true;
  }

  // Returns { osk: element } when a text box needs Controller Support's
  // on-screen keyboard; otherwise handles everything itself.
  function press() {
    const it = current();
    if (!it) return null;
    if (held) { drop(it); return null; }
    const el = it.el;
    if (el.classList.contains("wz-tl-tile")) {
      held = { key: el.dataset.key, from: it.id.startsWith("t:") ? "tier" : "panel" };
      dirty = true;
      return null;
    }
    if (el.tagName === "INPUT" && el.type === "text") return { osk: el };
    if (el.tagName === "INPUT" && el.type === "color") return null; // swatches cover it
    el.click();
    dirty = true;
    return null;
  }

  // Back to the item the menu was opened from (or, if it left the panel
  // because ranked items are hidden, whatever is now nearest to it).
  function closeSendMenu() {
    if (sendMenu) {
      sendMenu.el.remove();
      focusId = sendMenu.returnTo;
      if (sendMenu.returnRect) lastRect = sendMenu.returnRect;
    }
    sendMenu = null;
    dirty = true;
  }

  function back() {
    if (sendMenu) { closeSendMenu(); return; }
    if (held) { held = null; dirty = true; return; }
    if (root.querySelector(".wz-tl-editor")) { tiers.closeEditor(); dirty = true; return; }
    if (isListsMenuOpen()) { closeListsMenu(); dirty = true; return; }
    hide();
  }

  // △: a small menu of tiers for the focused (or held) item.
  function quickSend() {
    if (sendMenu) { closeSendMenu(); return; }
    const it = current();
    const key = held ? held.key : (it && it.el.classList.contains("wz-tl-tile") ? it.el.dataset.key : null);
    if (!key) return;
    const list = model.getActiveList();
    const menu = document.createElement("div");
    menu.className = "wz-tl-send";
    const title = document.createElement("div");
    title.className = "wz-tl-send-title";
    title.textContent = "Send to tier";
    menu.appendChild(title);
    const currentTier = list.tiers.find((t) => t.items.includes(key));
    list.tiers.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wz-tl-send-tier";
      b.style.background = t.color;
      b.textContent = t.label;
      if (currentTier && currentTier.id === t.id) b.classList.add("wz-tl-active");
      b.addEventListener("click", () => {
        model.placeItem(key, t.id);
        held = null;
        closeSendMenu();
      });
      menu.appendChild(b);
    });
    if (currentTier) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wz-tl-btn";
      b.textContent = "Unrank";
      b.addEventListener("click", () => { model.removeItem(key); held = null; closeSendMenu(); });
      menu.appendChild(b);
    }
    root.appendChild(menu);
    // Next to the item, kept inside the window.
    const rr = root.getBoundingClientRect();
    const tr = (it ? it.el : root).getBoundingClientRect();
    let left = tr.right - rr.left + 6;
    if (left + menu.offsetWidth > rr.width - 4) left = Math.max(4, tr.left - rr.left - menu.offsetWidth - 6);
    let top = tr.top - rr.top;
    if (top + menu.offsetHeight > rr.height - 4) top = Math.max(4, rr.height - menu.offsetHeight - 4);
    menu.style.left = left + "px";
    menu.style.top = Math.max(4, top) + "px";
    sendMenu = { el: menu, key, returnTo: focusId, returnRect: lastRect };
    // Start on the item's current tier, else the first.
    const buttons = [...menu.querySelectorAll("button")];
    const start = Math.max(0, buttons.findIndex((b) => b.classList.contains("wz-tl-active")));
    focusId = `qs:${start}`;
    dirty = true;
  }

  // □: hop between the tier area and the item panel.
  function jump() {
    if (trapRoot()) return;
    const list = items();
    const it = current(list);
    const inTiers = it && TIER_AREA.test(it.id);
    if (it && inTiers) lastTier = it.id;
    else if (it && PANEL_AREA.test(it.id)) lastPanel = it.id;
    let target = null;
    if (inTiers) {
      target = (lastPanel && find(list, lastPanel)) || list.find((x) => x.id.startsWith("p:")) || find(list, "search");
    } else {
      target = (lastTier && find(list, lastTier)) || list.find((x) => x.id.startsWith("t:")) || list.find((x) => x.id.startsWith("l:"));
    }
    if (target) setFocus(target);
    dirty = true;
  }

  // On open: the first result if there are any, else the search box.
  function start() {
    const list = items();
    const first = list.find((x) => x.id.startsWith("p:")) || find(list, "search") || list[0];
    if (first) setFocus(first);
  }

  return {
    start,
    draw,
    nav,
    press,
    back,
    quickSend,
    jump,
    clearDrawing,
    // Cursor mode (stick moved): hide the highlight and drop any held item.
    setShown(value) {
      if (shown === !!value) return;
      shown = !!value;
      if (!shown) { held = null; closeSendMenu(); clearDrawing(); }
      dirty = true;
    },
    isShown: () => shown,
    // "send" | "holding" | "idle" - Controller Support writes the HUD text
    // with the player's actual button names.
    state() {
      if (sendMenu) return "send";
      if (held) return "holding";
      return "idle";
    }
  };
}
