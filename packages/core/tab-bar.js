// packages/core/tab-bar.js
//
// Two tweaks to the row of tabs inside Wizascript's settings entry
// (Wizascript | Patch Maker | UC TV | ...), applied to the DOM after
// UnderScript renders it:
//
// 1. The first tab is labelled "General" instead of "Wizascript".
//    UnderScript names a plugin's main tab after the plugin and has no
//    API to rename it, so the label text is swapped after render. The
//    plugin itself (and every storage key) is still "Wizascript".
//
// 2. Paging arrows. UnderScript squeezes every tab into one row, so with
//    many plugins enabled each name gets cut off ("Patch M…"). When the
//    tabs don't fit at full width, this shows as many as fit, plus two
//    extra tab-styled buttons at the end (◀ ▶) that scroll the row one
//    tab at a time. When everything fits, the arrows aren't shown and
//    UnderScript's own layout is left untouched.
//
// UnderScript re-renders this row whenever the settings open or tabs
// appear/disappear; a MutationObserver re-applies both tweaks each time.

const MAIN_TAB_LABEL = "General";
// Any setting that only ever lives on the main tab - used to find it.
const MAIN_TAB_MARKER_ID = "underscript.plugin.Wizascript.about.version";
const ARROW_CLASS = "wizascript-tab-arrow";
const HIDDEN_CLASS = "wizascript-tab-offscreen";
const GAP_PX = 5; // UnderScript's --tab-label-gap

let firstVisible = 0; // index of the first label shown, kept for the session
let observedView = null;
let observer = null;
let applying = false;

function injectStyle() {
  if (document.getElementById("wizascript-tab-bar-style")) return;
  const style = document.createElement("style");
  style.id = "wizascript-tab-bar-style";
  style.textContent = `
.tabbedView > .tabLabel.${HIDDEN_CLASS} { display: none; }
.tabbedView > .tabLabel.${ARROW_CLASS} { order: 10; cursor: pointer; user-select: none; text-align: center; min-width: 26px; }
.tabbedView > .tabLabel.${ARROW_CLASS}.disabled { opacity: 0.35; cursor: default; }
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
  if (!left) { left = makeArrow(view, "◀", -1); view.appendChild(left); }
  if (!right) { right = makeArrow(view, "▶", 1); view.appendChild(right); }
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
  applying = true;
  try {
    const labels = realLabels(view);
    labels.forEach((l) => l.classList.remove(HIDDEN_CLASS));
    removeArrows(view);
    view.style.gridTemplateColumns = "";

    const available = view.clientWidth;
    if (!labels.length || !available) return; // not visible yet / nothing to do

    // Measure every label at its natural (untruncated) width.
    view.style.gridTemplateColumns = `repeat(${labels.length}, max-content) 1fr`;
    const widths = labels.map((l) => l.getBoundingClientRect().width);
    const total = widths.reduce((a, b) => a + b, 0) + GAP_PX * (labels.length - 1);
    if (total <= available) {
      view.style.gridTemplateColumns = ""; // fits - UnderScript's own layout
      return;
    }

    const { left, right } = ensureArrows(view);
    const arrowsWidth = left.getBoundingClientRect().width + right.getBoundingClientRect().width + GAP_PX * 2;
    const room = available - arrowsWidth;

    // How many labels fit starting at `start`.
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

    // Bring the selected tab on screen when the settings open or a
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
    // Let the observer ignore the mutations we just made.
    setTimeout(() => { applying = false; }, 0);
  }
}

function apply() {
  const found = findView();
  if (!found) return;
  const { view, mainContent } = found;
  renameMainTab(mainContent);

  if (observedView !== view) {
    if (observer) observer.disconnect();
    observedView = view;
    observer = new MutationObserver(() => {
      if (applying) return;
      const again = findView();
      if (again) renameMainTab(again.mainContent);
      layout(view, { revealActive: true });
    });
    // childList: tabs added/removed/re-appended; characterData+subtree:
    // UnderScript resetting a label's text (e.g. after translations load).
    observer.observe(view, { childList: true, subtree: false });
    realLabels(view).forEach((l) => observer.observe(l, { childList: true, characterData: true, subtree: true }));
  }
  layout(view, { revealActive: true });
}

export function initTabBar(plugin) {
  injectStyle();
  // UnderScript emits this after the settings dialog is shown - the
  // tab row has real widths by then.
  plugin.events.on("Settings:open", () => setTimeout(apply, 0));
  // Switching to a different tab can change which one must stay visible.
  document.addEventListener("change", (e) => {
    if (e.target && e.target.classList && e.target.classList.contains("tabButton") && observedView && observedView.contains(e.target)) {
      layout(observedView, { revealActive: true });
    }
  });
  window.addEventListener("resize", () => { if (observedView && observedView.isConnected) layout(observedView); });
}
