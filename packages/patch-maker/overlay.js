// Builds the #uc-patch-overlay DOM, the floating toggle/mode/reset/help
// buttons, and the editor-mode <-> viewer-mode switching logic. Ported
// from the original startPatchMaker()/init().

import { formatLine, sanitizeText } from "./formatting.js";
import { getPageWindow } from "../core/page-window.js";
import {
  buildLocalizedCardNameMap,
  getCardIdByExactGameLookup,
  resolveCardId,
  attachCardHover
} from "../core/card-data.js";

const STATE_KEY = "wizascript.patchmaker.state.v1";
const cycleOrder = ["none", "other", "buff", "rework", "nerf"];

  export function createPatchMakerOverlay({
  logger, wordColors, underlineTokens, getCardHoversEnabled, languageLabel
}) {
  let overlay, container, toggle, modeToggle, resetBtn, helpBtn;
  let custom = false;
  let isViewerMode = false;
  let cardNameMap = new Map(); // populated async below, empty until then

  // ---- persistence (raw GM storage - not a user-facing setting) ----

  function saveState() {
    try {
      const state = collectState();
      if (state) GM_setValue(STATE_KEY, JSON.stringify(state));
    } catch (e) {
      logger.error("save", "Failed to save state", e);
    }
  }

  function loadState() {
    const text = GM_getValue(STATE_KEY, "");
    if (!text) return;
    try {
      const saved = JSON.parse(text);
      if (saved && saved.sections) restoreState(saved);
    } catch (e) {
      logger.error("load", "Failed to parse saved state", e);
    }
  }

  function resetState() {
    GM_deleteValue(STATE_KEY);
  }

  // ---- section / li construction ----

  function createNewLI() {
    const li = document.createElement("li");
    li.classList.add("other");
    li.dataset.raw = "[New entry]";

    const span = document.createElement("span");
    span.className = "uc-li-text";
    span.textContent = li.dataset.raw;
    li.appendChild(span);

    const addBtn = document.createElement("button");
    addBtn.className = "uc-li-add";
    addBtn.textContent = "+";
    const delBtn = document.createElement("button");
    delBtn.className = "uc-li-del";
    delBtn.textContent = "−";
    li.appendChild(addBtn);
    li.appendChild(delBtn);

    setupLiTextEditing(li);

    addBtn.onclick = e => {
      if (overlay.classList.contains("viewer-mode")) return;
      e.stopPropagation();
      const ul = li.parentElement;
      const newLi = createNewLI();
      ul.insertBefore(newLi, li.nextSibling);
      updateDeleteState(ul);
      saveState();
    };

    delBtn.onclick = e => {
      if (overlay.classList.contains("viewer-mode")) return;
      e.stopPropagation();
      const ul = li.parentElement;
      if (ul.children.length <= 1) return;
      li.remove();
      updateDeleteState(ul);
      saveState();
    };

    return li;
  }

  function updateDeleteState(ul) {
    const lis = ul.querySelectorAll(":scope > li");
    const disable = lis.length <= 1;
    lis.forEach(li => {
      const btn = li.querySelector(".uc-li-del");
      if (btn) btn.disabled = disable;
    });
  }

  function setupLiTextEditing(li) {
    const span = li.querySelector(".uc-li-text");
    span.setAttribute("contenteditable", "true");
    span.spellcheck = false;

    span.addEventListener("focus", () => {
      span.dataset.prevText = span.textContent.trim();
    });

    span.addEventListener("blur", () => {
      let t = sanitizeText(span.textContent);
      if (!t) t = "[New entry]";
      span.textContent = t;
      li.dataset.raw = t;
      saveState();
    });

    span.addEventListener("keydown", e => {
      if (handleShortcut(e)) return;
      if (overlay.classList.contains("viewer-mode")) return;
      if (e.key === "Enter") { e.preventDefault(); span.blur(); }
      if (e.key === "Escape") {
        e.preventDefault();
        span.textContent = span.dataset.prevText;
        li.dataset.raw = span.dataset.prevText;
        span.blur();
      }
    }, true);
  }

  function appendSection(label, isCustom, focusName, beforeNode) {
    const p = document.createElement("p");
    p.className = "uc-section-header";
    p.dataset.custom = isCustom ? "true" : "false";

    const labelEl = document.createElement("span");
    labelEl.className = "uc-section-label";
    labelEl.textContent = label || "[New Balance Section]";
    labelEl.setAttribute("contenteditable", isCustom ? "true" : "false");
    labelEl.setAttribute("tabindex", "0");

    labelEl.addEventListener("blur", () => {
      if (!isCustom) return;
      let t = sanitizeText(labelEl.textContent);
      if (!t) t = "[New Balance Section]";
      labelEl.textContent = t;
      saveState();
    });

    labelEl.addEventListener("keydown", e => handleShortcut(e), true);
    p.appendChild(labelEl);

    const ul = document.createElement("ul");
    ul.appendChild(createNewLI());

    const collapseBtn = document.createElement("button");
    collapseBtn.className = "uc-collapse-btn";
    collapseBtn.textContent = "−";
    collapseBtn.onclick = () => {
      if (overlay.classList.contains("viewer-mode")) return;
      const collapsed = ul.style.display === "none";
      ul.style.display = collapsed ? "" : "none";
      collapseBtn.textContent = collapsed ? "−" : "+";
      saveState();
    };
    p.appendChild(collapseBtn);

    if (isCustom) {
      const delBtn = document.createElement("button");
      delBtn.className = "uc-section-del";
      delBtn.title = "Double-click to delete custom section";
      delBtn.textContent = "−";
      delBtn.onclick = e => {
        if (overlay.classList.contains("viewer-mode") || e.detail !== 2) return;
        ul.remove();
        p.remove();
        saveState();
      };
      p.appendChild(delBtn);
    }

    if (beforeNode) {
      container.insertBefore(p, beforeNode);
      container.insertBefore(ul, beforeNode);
    } else {
      container.appendChild(p);
      container.appendChild(ul);
    }

    updateDeleteState(ul);
    if (focusName) setTimeout(() => labelEl.focus(), 0);
    return { p, ul };
  }

  // ---- reordering ----

  function getSectionPairs() {
    const pairs = [];
    container.querySelectorAll("p.uc-section-header").forEach(p => {
      const ul = p.nextElementSibling;
      if (ul && ul.tagName === "UL") pairs.push({ p, ul });
    });
    return pairs;
  }

  function moveSection(p, dir) {
    const ul = p.nextElementSibling;
    if (!ul || ul.tagName !== "UL") return;
    const pairs = getSectionPairs();
    const idx = pairs.findIndex(pair => pair.p === p);
    if (idx < 0 || pairs.length <= 1) return;

    const newIdx = (idx + dir + pairs.length) % pairs.length;
    const target = pairs[newIdx];
    const addSectionRow = container.querySelector(".uc-add-section-row");

    if (dir < 0) {
      if (idx === 0) {
        container.insertBefore(p, addSectionRow || null);
        container.insertBefore(ul, addSectionRow || null);
      } else {
        container.insertBefore(p, target.p);
        container.insertBefore(ul, target.p);
      }
    } else {
      if (idx === pairs.length - 1) {
        container.insertBefore(ul, pairs[0].p);
        container.insertBefore(p, ul);
      } else {
        const after = target.ul.nextElementSibling;
        container.insertBefore(p, after);
        container.insertBefore(ul, after);
      }
    }
    saveState();
  }

  function moveLi(li, dir) {
    const ul = li.parentElement;
    const items = [...ul.children];
    const idx = items.indexOf(li);
    const newIdx = idx + dir;

    if (newIdx < 0 || newIdx >= items.length) {
      if (items.length <= 1) return;
      if (dir < 0) ul.appendChild(li);
      else ul.insertBefore(li, items[0]);
    } else if (dir < 0) {
      ul.insertBefore(li, items[newIdx]);
    } else {
      ul.insertBefore(li, items[newIdx].nextSibling);
    }
    saveState();
    const span = li.querySelector(".uc-li-text");
    if (span) setTimeout(() => span.focus(), 0);
  }

  function cycleCategory(li, dir) {
    const idx = cycleOrder.findIndex(c => li.classList.contains(c));
    const newIdx = ((idx === -1 ? 0 : idx) + dir + cycleOrder.length) % cycleOrder.length;
    li.classList.remove(...cycleOrder);
    li.classList.add(cycleOrder[newIdx]);
    saveState();
  }

  // ---- consolidated keyboard shortcut handler ----
  // Replaces three overlapping handlers from the original script that
  // all dispatched the same Ctrl/Shift+Arrow logic.

  function handleShortcut(e) {
    if (overlay.classList.contains("viewer-mode")) return false;
    if (e.altKey || e.metaKey) return false;

    const dir = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!dir || (!e.ctrlKey && !e.shiftKey)) return false;

    const active = document.activeElement;
    if (!active) return false;

    if (active.classList.contains("uc-li-text")) {
      const li = active.closest("li");
      if (!li) return false;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      if (e.ctrlKey && !e.shiftKey) cycleCategory(li, dir);
      if (e.shiftKey && !e.ctrlKey) moveLi(li, dir);
      return true;
    }

    if (active.classList.contains("uc-section-label") && e.shiftKey && !e.ctrlKey) {
      const p = active.closest("p.uc-section-header");
      if (!p) return false;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      moveSection(p, dir);
      return true;
    }

    return false;
  }

  // ---- viewer/editor mode ----
    
  function bindCardHovers() {
    if (!getCardHoversEnabled()) return;

    container.querySelectorAll(".uc-card-ref").forEach(el => {
      if (el.dataset.ucHoverBound === "true") return;

      const name = el.textContent.trim();
      const cardId = getCardIdByExactGameLookup(name) || resolveCardId(name, cardNameMap);

      if (!cardId) {
        logger.warn("hover", "Card not found for hover", name);
        return;
      }
      attachCardHover(el, cardId);
    });
  }
    
  function applyFormattingOverlay() {
    container.querySelectorAll("li").forEach(li => {
      const span = li.querySelector(".uc-li-text");
      if (span) span.innerHTML = formatLine(li.dataset.raw, wordColors, underlineTokens);
    });
      bindCardHovers();
  }
    
  function clearFormattingOverlay() {
    container.querySelectorAll("li").forEach(li => {
      const span = li.querySelector(".uc-li-text");
      if (span) span.textContent = li.dataset.raw;
    });
  }

  function setEditingEnabled(enabled) {
    const h2 = container.querySelector("h2");
    if (h2) h2.setAttribute("contenteditable", enabled ? "true" : "false");
    container.querySelectorAll(".uc-li-text").forEach(s => s.setAttribute("contenteditable", enabled ? "true" : "false"));
    container.querySelectorAll('p.uc-section-header[data-custom="true"] .uc-section-label')
      .forEach(l => l.setAttribute("contenteditable", enabled ? "true" : "false"));
  }

  // ---- save/load state shape ----

  function collectState() {
    if (!container) return null;
    const state = { title: "", sections: [] };
    const h2 = container.querySelector("h2");
    if (h2) state.title = h2.textContent.trim();

    container.querySelectorAll("p.uc-section-header").forEach(p => {
      const labelEl = p.querySelector(".uc-section-label");
      const ul = p.nextElementSibling;
      if (!ul) return;
      state.sections.push({
        label: labelEl ? labelEl.textContent.trim() : "",
        custom: p.dataset.custom === "true",
        collapsed: ul.style.display === "none",
        items: [...ul.querySelectorAll(":scope > li")].map(li => ({
          raw: li.dataset.raw || "",
          category: cycleOrder.find(c => li.classList.contains(c)) || "other"
        }))
      });
    });
    return state;
  }

  function restoreState(saved) {
    const h2 = container.querySelector("h2");
    if (h2 && saved.title) h2.textContent = saved.title;

    getSectionPairs().forEach(pair => { pair.ul.remove(); pair.p.remove(); });
    const addSectionRow = container.querySelector(".uc-add-section-row");

    saved.sections.forEach(sec => {
      const { p, ul } = appendSection(sec.label, !!sec.custom, false, addSectionRow);
      const btn = p.querySelector(".uc-collapse-btn");
      ul.style.display = sec.collapsed ? "none" : "";
      if (btn) btn.textContent = sec.collapsed ? "+" : "−";
      ul.innerHTML = "";
      (sec.items || [{ raw: "[New entry]", category: "other" }]).forEach(item => {
        const li = createNewLI();
        li.dataset.raw = item.raw;
        li.classList.remove(...cycleOrder);
        li.classList.add(item.category || "other");
        li.querySelector(".uc-li-text").textContent = item.raw;
        ul.appendChild(li);
      });
      updateDeleteState(ul);
    });
  }

  // ---- init ----

  function init(mainEl) {
    if (document.getElementById("uc-patch-overlay")) {
      logger.warn("init", "Overlay already exists; aborting duplicate init.");
      return;
    }

    const navbars = mainEl.querySelectorAll(".navbar.navbar-default");
    const headerNav = navbars[0];
    if (!headerNav) {
      logger.error("init", "Could not find header navbar.");
      return;
    }

    overlay = document.createElement("div");
    overlay.id = "uc-patch-overlay";
    overlay.style.display = "none";
    overlay.classList.add("editor-mode");

    container = document.createElement("div");
    const h2 = document.createElement("h2");
    h2.textContent = "[Untitled Patch]";
    h2.setAttribute("contenteditable", "true");
    h2.addEventListener("blur", saveState);
    container.appendChild(h2);

    ["Balancing (Monsters)", "Balancing (Spells)", "Balancing (Artifacts)",
     "Balancing (Board Slots)", "Balancing (Souls)", "Balancing (Other)"]
      .forEach(label => appendSection(label, false, false));

    const addSectionRow = document.createElement("div");
    addSectionRow.className = "uc-add-section-row";
    const addSectionBtn = document.createElement("button");
    addSectionBtn.className = "uc-add-section-btn";
    addSectionBtn.textContent = "+";
    addSectionBtn.onclick = () => {
      if (overlay.classList.contains("viewer-mode")) return;
      appendSection("[New Balance Section]", true, true, addSectionRow);
      saveState();
    };
    addSectionRow.appendChild(addSectionBtn);
    container.appendChild(addSectionRow);

    overlay.appendChild(container);
    headerNav.insertAdjacentElement("afterend", overlay);

    buildLocalizedCardNameMap(languageLabel).then(map => {
      cardNameMap = map;
    }).catch(e => logger.error("init", "Failed to build card name map", e));

    buildControlButtons(headerNav);
    loadState();
  }

  function buildControlButtons() {
    toggle = document.createElement("button");
    toggle.textContent = "Show Custom Patch Notes";
    modeToggle = document.createElement("button");
    modeToggle.textContent = "Switch to Viewer Mode";
    resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset Data";
    helpBtn = document.createElement("button");
    helpBtn.textContent = "Help";

    [modeToggle, resetBtn, helpBtn].forEach(b => b.style.display = "none");
    [toggle, modeToggle, resetBtn, helpBtn].forEach(b => document.body.appendChild(b));

    toggle.onclick = () => {
      custom = !custom;
      overlay.style.display = custom ? "" : "none";
      toggle.textContent = custom ? "Show Original Patch Notes" : "Show Custom Patch Notes";
      [modeToggle, resetBtn, helpBtn].forEach(b => b.style.display = custom ? "inline-block" : "none");
      if (!custom && isViewerMode) {
        isViewerMode = false;
        overlay.classList.replace("viewer-mode", "editor-mode");
        modeToggle.textContent = "Switch to Viewer Mode";
        clearFormattingOverlay();
        setEditingEnabled(true);
      }
    };

    modeToggle.onclick = () => {
      if (!custom) return;
      isViewerMode = !isViewerMode;
      overlay.classList.toggle("viewer-mode", isViewerMode);
      overlay.classList.toggle("editor-mode", !isViewerMode);
      modeToggle.textContent = isViewerMode ? "Switch to Editor Mode" : "Switch to Viewer Mode";
      if (isViewerMode) { applyFormattingOverlay(); setEditingEnabled(false); }
      else { clearFormattingOverlay(); setEditingEnabled(true); }
    };

    resetBtn.onclick = e => { if (custom && e.detail === 2) { resetState(); location.reload(); } };
  }

  return { init };
}
