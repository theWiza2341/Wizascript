// packages/core/tab-bar.js
//
// Two tweaks to the row of tabs inside Wizascript's settings entry
// (General | Patch Maker | UC TV | ...), applied to the DOM after
// UnderScript renders it:
//
// 1. The first tab is labelled "General" instead of "Wizascript".
//    UnderScript names a plugin's main tab after the plugin and has no
//    API to rename it, so the label text is swapped after render. The
//    plugin itself (and every storage key) is still "Wizascript".
//
// 2. Tab names are never shortened. UnderScript squeezes every tab into
//    one row and cuts names off with "..." ("True Hub B..."). Here every
//    tab is always shown at its full width; when they don't all fit,
//    as many as fit are shown, plus two extra tab-styled buttons at the
//    end (◀ ▶) that scroll the row one tab at a time. When everything
//    fits, no arrows are shown.
//
// Re-layout triggers:
// - UnderScript re-rendering the row (tabs added/removed) - MutationObserver.
// - The row becoming visible or changing width - ResizeObserver. This is
//   the important one: the settings usually open on UnderScript's own
//   page, where Wizascript's row is hidden (zero width); it only gets a
//   real width once the player clicks Plugins -> Wizascript.
// - A different tab being selected (to keep it on screen).

const MAIN_TAB_LABEL = "General";
// Any setting that only ever lives on the main tab - used to find it.
const MAIN_TAB_MARKER_ID = "underscript.plugin.Wizascript.about.version";
const VIEW_CLASS = "wizascript-tabs";
const ARROW_CLASS = "wizascript-tab-arrow";
const HIDDEN_CLASS = "wizascript-tab-offscreen";
const GAP_PX = 5; // UnderScript's --tab-label-gap

let firstVisible = 0; // index of the first label shown, kept for the session
let observedView = null;
let mutationObserver = null;
let resizeObserver = null;
let lastWidth = 0;
let applying = false;

function injectStyle() {
  if (document.getElementById("wizascript-tab-bar-style")) return;
  const style = document.createElement("style");
  style.id = "wizascript-tab-bar-style";
  style.textContent = `
.tabbedView.${VIEW_CLASS} > .tabLabel { overflow: visible; text-overflow: clip; max-width: none; }
.tabbedView.${VIEW_CLASS} > .tabLabel.${HIDDEN_CLASS} { display: none; }
.tabbedView.${VIEW_CLASS} > .tabLabel.${ARROW_CLASS} { order: 10; cursor: pointer; user-select: none; text-align: center; min-width: 26px; }
.tabbedView.${VIEW_CLASS} > .tabLabel.${ARROW_CLASS}.disabled { opacity: 0.35; cursor: default; }
`;
  (document.head || document.documentElement).appendChild(style);
}

function findView() {
  const marker = document.getElementById(MAIN_TAB_MARKER_ID);
  const content = marker && marker.closest(".tabContent");
  const view = content && content.parentElement;
  return view && view.classList.contains("tabbedView") ? { view, mainContent: content } : null;
}

function realLabels(view) {
  return Array.from(view.querySelectorAll(":scope > .tabLabel")).filter((l) => !l.classList.contains(ARROW_CLASS));
}

function renameMainTab(mainContent) {
  const label = mainContent.previousElementSibling;
  if (label && label.classList.contains("tabLabel") && label.textContent !== MAIN_TAB_LABEL) {
    label.textContent = MAIN_TAB_LABEL;
  }
}

function makeArrow(view, text, dir) {
  const el = document.createElement("div");
  el.className = `tabLabel ${ARROW_CLASS}`;
  el.dataset.dir = String(dir);
  el.textContent = text;
  el.title = dir < 0 ? "Previous tabs" : "More tabs";
  el.addEventListener("click", (e) => {
    e.preventDefault();
    if (el.classList.contains("disabled")) return;
    firstVisible += dir;
    layout(view);
  });
  return el;
}

function ensureArrows(view) {
  let left = view.querySelector(`:scope > .${ARROW_CLASS}[data-dir="-1"]`);
  let right = view.querySelector(`:scope > .${ARROW_CLASS}[data-dir="1"]`);
  if (!left) left = makeArrow(view, "◀", -1);
  if (!right) right = makeArrow(view, "▶", 1);
  // Keep them after the real labels in DOM order too (for keyboard/controller navigation).
  view.appendChild(left);
  view.appendChild(right);
  return { left, right };
}

function removeArrows(view) {
  view.querySelectorAll(`:scope > .${ARROW_CLASS}`).forEach((a) => a.remove());
}

function activeIndex(labels) {
  return labels.findIndex((l) => {
    const radio = l.previousElementSibling;
    return radio && radio.tagName === "INPUT" && radio.checked;
  });
}

function layout(view, { revealActive = false } = {}) {
  const available = view.clientWidth;
  if (!available) return; // hidden right now - the ResizeObserver re-runs this once it's shown
  lastWidth = available;

  applying = true;
  try {
    view.classList.add(VIEW_CLASS);
    const labels = realLabels(view);
    labels.forEach((l) => l.classList.remove(HIDDEN_CLASS));
    removeArrows(view);
    if (!labels.length) return;

    // Full-width columns - never UnderScript's shrink-to-fit ones.
    view.style.gridTemplateColumns = `repeat(${labels.length}, max-content) 1fr`;
    const widths = labels.map((l) => l.getBoundingClientRect().width);
    const total = widths.reduce((a, b) => a + b, 0) + GAP_PX * (labels.length - 1);
    if (total <= available) return; // everything fits at full width

    const { left, right } = ensureArrows(view);
    const arrowsWidth = left.getBoundingClientRect().width + right.getBoundingClientRect().width + GAP_PX * 2;
    const room = available - arrowsWidth;

    // How many labels fit starting at `start` (always at least one).
    const fitFrom = (start) => {
      let used = 0;
      let count = 0;
      for (let i = start; i < labels.length; i++) {
        const next = used + widths[i] + (count ? GAP_PX : 0);
        if (next > room && count) break;
        used = next;
        count++;
      }
      return count;
    };

    // Clamp, and don't leave empty space at the end of the row.
    firstVisible = Math.max(0, Math.min(firstVisible, labels.length - 1));
    while (firstVisible > 0 && firstVisible + fitFrom(firstVisible) >= labels.length
      && fitFrom(firstVisible - 1) > labels.length - firstVisible) {
      firstVisible--;
    }

    // Bring the selected tab on screen when the row first appears or a
    // different tab gets selected - but not while paging with the
    // arrows, which may deliberately scroll it out of view.
    if (revealActive) {
      const active = activeIndex(labels);
      if (active >= 0 && active < firstVisible) firstVisible = active;
      while (active >= 0 && active >= firstVisible + fitFrom(firstVisible)) firstVisible++;
    }

    const shown = fitFrom(firstVisible);
    labels.forEach((l, i) => {
      l.classList.toggle(HIDDEN_CLASS, i < firstVisible || i >= firstVisible + shown);
    });
    left.classList.toggle("disabled", firstVisible === 0);
    right.classList.toggle("disabled", firstVisible + shown >= labels.length);
    view.style.gridTemplateColumns = `repeat(${shown}, max-content) max-content max-content 1fr`;
  } finally {
    // Let the MutationObserver ignore the mutations we just made.
    setTimeout(() => { applying = false; }, 0);
  }
}

function watch(view) {
  if (observedView === view) return;
  if (mutationObserver) mutationObserver.disconnect();
  if (resizeObserver) resizeObserver.disconnect();
  observedView = view;
  lastWidth = 0;

  mutationObserver = new MutationObserver(() => {
    if (applying) return;
    const found = findView();
    if (found) renameMainTab(found.mainContent);
    layout(view, { revealActive: true });
  });
  // childList on the row: tabs added/removed/re-appended by UnderScript.
  mutationObserver.observe(view, { childList: true });
  // UnderScript can also reset a label's text (e.g. after translations load).
  const main = findView();
  if (main && main.mainContent.previousElementSibling) {
    mutationObserver.observe(main.mainContent.previousElementSibling, { childList: true, characterData: true, subtree: true });
  }

  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(() => {
      const width = view.clientWidth;
      if (width && width !== lastWidth) layout(view, { revealActive: true });
    });
    resizeObserver.observe(view);
  }
}

function apply() {
  const found = findView();
  if (!found) return;
  renameMainTab(found.mainContent);
  watch(found.view);
  layout(found.view, { revealActive: true });
}

export function initTabBar(plugin) {
  injectStyle();
  // UnderScript emits this after the settings dialog is shown.
  plugin.events.on("Settings:open", () => setTimeout(apply, 0));
  // Any tab being selected anywhere in the settings - including the
  // left-hand "Wizascript" entry, which is what makes this row visible.
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (!t || !t.classList || !t.classList.contains("tabButton")) return;
    setTimeout(() => {
      if (observedView && observedView.isConnected) layout(observedView, { revealActive: true });
      else apply();
    }, 0);
  });
  window.addEventListener("resize", () => {
    if (observedView && observedView.isConnected) layout(observedView);
  });
}
