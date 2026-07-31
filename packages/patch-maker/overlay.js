// packages/patch-maker/overlay.js

import { createNewCardsFeature } from "./new-cards.js";
import { enableInputBlocker, disableInputBlocker } from "./input-blocker.js";
import { sanitizeText, formatLine } from "./formatting.js";
import { injectPatchMakerStyle } from "./styles.js";
import { getPageWindow } from "../core/page-window.js";
import { getCardIdByExactGameLookup, resolveCardId, attachCardHover } from "../core/card-data.js";
import { registerKeybind } from "../core/keybinds.js";

const STATE_KEY = "wizascript.patchmaker.state.v1";
const cycleOrder = ["none", "other", "buff", "rework", "nerf"];
const DEFAULT_SECTIONS = [
  "Balancing (Monsters)",
  "Balancing (Spells)",
  "Balancing (Artifacts)",
  "Balancing (Board Slots)",
  "Balancing (Souls)",
  "Balancing (Other)"
];
const DEFAULT_OPEN_SECTIONS = new Set([
  "Balancing (Monsters)",
  "Balancing (Spells)",
  "Balancing (Artifacts)"
]);

function buildHelpMessage(version) {
  return `<u><b>Basic Editing</b></u>
Click any balance change to begin editing
\u2022 Enter  = Confirm change


<u><b>Adding & Removing Entries</b></u>
\u2022 Green/Red +/- Button \u2013 Add a new entry / Remove entry


<u><b>Toggle Balance Sections</b></u>
\u2022 Blue +/- Button \u2013 Toggle visibility of a balance section
<span style="color:#ff5555;">NOTE:</span> Hidden sections will not appear in Viewer Mode


<u><b>Entry Class Type</b></u>
Each entry needs a category:
\u2022 Other (GRAY)
\u2022 Buff (GREEN)
\u2022 Rework (GOLD)
\u2022 Nerf (RED)
\u2022 None (EMPTY)


<u><b>Category & Move Shortcuts</b></u>
These are all remappable in Wizascript's Keybinds settings - defaults shown below:
\u2022 Primary + , / .   \u2192 Change class type
\u2022 Primary + Up / Down   \u2192 Move entry up/down in section


<u><b>Custom Balance Sections</b></u>
\u2022 Green + Button \u2013 Add a new custom balance section
\u2022 Red - Button - Remove custom balance section (Double Click Required)
\u2022 Click a section name to select it
\u2022 Primary + Up / Down \u2013 Move selected section up/down (remappable)


<u><b>Automatic Highlighting</b></u>
The following are highlighted automatically:
\u2022 Stats: ATK, HP, COST, DMG
\u2022 Numeric stats: 3/2, +1/+1, 1/1/1
\u2022 Rarities, resources, keywords, and tribes


<u><b>Manually Ignore Formatting</b></u>
Use backwards slash to skip automatic formatting for words:
Red \\Snail -- \\ATK 2 > 1.


<u><b>Manual Underlining</b></u>
Use underscores to force underline:
Magic: Equip _Example_.


<u><b>Manual Switch Highlighting</b></u>
Use double brackets for switch effects:
Switch: [[Example 1]] or [[Example 2]]


<u><b>Manual Card References</b></u>
Use curly braces to reference cards:
Magic: Cast {Example}.


<u><b>Viewer Mode vs Editor Mode</b></u>
Editor Mode:
\u2022 Editable, no formatting

Viewer Mode:
\u2022 Read-only
\u2022 Formatting applied
\u2022 Clean display


<u><b>Saving & Reset</b></u>
\u2022 Changes save automatically
\u2022 Double-click Reset Data to clear everything

Version: v${version}`;
}

export function createPatchMakerOverlay({
  plugin,
  logger,
  getWordColors,
  getUnderlineTokens,
  getCardHoversEnabled,
  getCardNameMap,
  getHideControlsEnabled,
  getOpenOnLoad,
  version
}) {
  let overlay, container, toggle, modeToggle, resetBtn, helpBtn;
  let custom = false;
  let isViewerMode2 = false;
  let originalPatchNotesNodes = [];
  let controlButtons = [];
  const newCards = createNewCardsFeature({
    isViewerMode: () => overlay.classList.contains("viewer-mode"),
    saveState: () => saveState()
  });
  function saveState() {
    try {
      const state = collectState();
      if (state) {
        GM_setValue(STATE_KEY, JSON.stringify(state));
        logger.log("save", "State saved.", { sections: state.sections.length });
      }
    } catch (e) {
      logger.error("save", "Failed to save state", e);
    }
  }
  function loadState() {
    const text = GM_getValue(STATE_KEY, "");
    if (!text) {
      logger.log("load", "No saved state found.");
      return;
    }
    try {
      const saved = JSON.parse(text);
      if (saved && saved.sections) {
        restoreState(saved);
        logger.log("load", "State restored.", { sections: saved.sections.length });
      }
    } catch (e) {
      logger.error("load", "Failed to parse saved state", e);
    }
  }
  function resetState() {
    GM_deleteValue(STATE_KEY);
  }
  function makeEditable(el, placeholder) {
    el.setAttribute("contenteditable", "true");
    el.spellcheck = false;
    el.addEventListener("focus", () => {
      el.dataset.prevText = el.textContent.trim();
      enableInputBlocker();
    });
    el.addEventListener("blur", () => {
      let t = sanitizeText(el.textContent);
      if (!t) t = placeholder;
      el.textContent = t;
      saveState();
      disableInputBlocker();
    });
    el.addEventListener("keydown", (e) => {
      if (overlay.classList.contains("viewer-mode")) return;
      if (e.key === "Enter") {
        e.preventDefault();
        el.blur();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        el.textContent = el.dataset.prevText;
        el.blur();
      }
    });
    el.addEventListener("paste", (e) => {
      if (overlay.classList.contains("viewer-mode")) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      const txt = (e.clipboardData || window.clipboardData).getData("text") || "";
      document.execCommand("insertText", false, sanitizeText(txt));
    });
  }
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
    delBtn.textContent = "\u2212";
    li.appendChild(addBtn);
    li.appendChild(delBtn);
    setupLiTextEditing(li);
    addBtn.onclick = (e) => {
      if (overlay.classList.contains("viewer-mode")) return;
      e.stopPropagation();
      const ul = li.parentElement;
      const newLi = createNewLI();
      ul.insertBefore(newLi, li.nextSibling);
      updateDeleteState(ul);
      saveState();
    };
    delBtn.onclick = (e) => {
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
    lis.forEach((li) => {
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
      enableInputBlocker();
    });
    span.addEventListener("blur", () => {
      let t = sanitizeText(span.textContent);
      if (!t) t = "[New entry]";
      span.textContent = t;
      li.dataset.raw = t;
      saveState();
      disableInputBlocker();
    });
    // No longer starts with a handleShortcut() call - Cycle Category
    // and Move Entry are now dispatched entirely by the shared
    // keybind registry (document-level, bubble phase). This listener
    // only needs to keep handling Enter/Escape for confirming or
    // canceling a text edit, which naturally doesn't overlap with
    // those bindings' own keys.
    span.addEventListener("keydown", (e) => {
      if (overlay.classList.contains("viewer-mode")) return;
      if (e.key === "Enter") {
        e.preventDefault();
        span.blur();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        span.textContent = span.dataset.prevText;
        li.dataset.raw = span.dataset.prevText;
        span.blur();
      }
    }, true);
    span.addEventListener("paste", (e) => {
      if (overlay.classList.contains("viewer-mode")) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      const txt = (e.clipboardData || window.clipboardData).getData("text") || "";
      document.execCommand("insertText", false, sanitizeText(txt));
    });
  }
  function appendSection(label, isCustom, focusName, beforeNode, startCollapsed = false) {
    const p = document.createElement("p");
    p.className = "uc-section-header";
    p.dataset.custom = isCustom ? "true" : "false";
    const labelEl = document.createElement("span");
    labelEl.className = "uc-section-label";
    labelEl.textContent = label || "[New Balance Section]";
    labelEl.setAttribute("contenteditable", isCustom ? "true" : "false");
    labelEl.setAttribute("tabindex", "0");
    labelEl.spellcheck = false;
    labelEl.addEventListener("focus", () => {
      labelEl.dataset.prevText = labelEl.textContent.trim();
      enableInputBlocker();
    });
    labelEl.addEventListener("blur", () => {
      if (isCustom) {
        let t = sanitizeText(labelEl.textContent);
        if (!t) t = "[New Balance Section]";
        labelEl.textContent = t;
        saveState();
      }
      disableInputBlocker();
    });
    // Same simplification as setupLiTextEditing - Move Balance
    // Section is now dispatched by the shared keybind registry.
    labelEl.addEventListener("keydown", (e) => {
      if (!isCustom) return;
      if (e.key === "Enter") {
        e.preventDefault();
        labelEl.blur();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        labelEl.textContent = labelEl.dataset.prevText || "[New Balance Section]";
        labelEl.blur();
      }
    }, true);
    p.appendChild(labelEl);
    const ul = document.createElement("ul");
    ul.appendChild(createNewLI());
    const collapseBtn = document.createElement("button");
    collapseBtn.className = "uc-collapse-btn";
    collapseBtn.onclick = () => {
      if (overlay.classList.contains("viewer-mode")) return;
      const collapsed = ul.style.display === "none";
      ul.style.display = collapsed ? "" : "none";
      collapseBtn.textContent = collapsed ? "\u2212" : "+";
      saveState();
    };
    p.appendChild(collapseBtn);
    if (isCustom) {
      const delBtn = document.createElement("button");
      delBtn.className = "uc-section-del";
      delBtn.title = "Double-click to delete custom section";
      delBtn.textContent = "\u2212";
      delBtn.onclick = (e) => {
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
    ul.style.display = startCollapsed ? "none" : "";
    collapseBtn.textContent = startCollapsed ? "+" : "\u2212";
    if (focusName) setTimeout(() => labelEl.focus(), 0);
    return { p, ul };
  }
  function getSectionPairs() {
    const pairs = [];
    container.querySelectorAll("p.uc-section-header").forEach((p) => {
      const ul = p.nextElementSibling;
      if (ul && ul.tagName === "UL") pairs.push({ p, ul });
    });
    return pairs;
  }
  function moveSection(p, dir) {
    const ul = p.nextElementSibling;
    if (!ul || ul.tagName !== "UL") return;
    const pairs = getSectionPairs();
    const idx = pairs.findIndex((pair) => pair.p === p);
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
    const idx = cycleOrder.findIndex((c) => li.classList.contains(c));
    const newIdx = ((idx === -1 ? 0 : idx) + dir + cycleOrder.length) % cycleOrder.length;
    li.classList.remove(...cycleOrder);
    li.classList.add(cycleOrder[newIdx]);
    saveState();
  }

  // Keybind registrations - replaces the old handleShortcut()
  // function entirely. Each context (list entry / balance section /
  // card tile) gets its own independently-remappable binding rather
  // than one shared "Move" entry, since they're conceptually distinct
  // actions to the person configuring them even though the resulting
  // behavior (move up/down in a list) is similar.
  registerKeybind(plugin, {
    key: "cycleCategoryUp",
    name: "Cycle Entry Category Up",
    defaultCode: "Comma",
    scope: "scoped",
    selector: ".uc-li-text",
    onMatch: () => {
      const li = document.activeElement.closest("li");
      if (li) cycleCategory(li, -1);
    }
  });
  registerKeybind(plugin, {
    key: "cycleCategoryDown",
    name: "Cycle Entry Category Down",
    defaultCode: "Period",
    scope: "scoped",
    selector: ".uc-li-text",
    onMatch: () => {
      const li = document.activeElement.closest("li");
      if (li) cycleCategory(li, 1);
    }
  });
  registerKeybind(plugin, {
    key: "moveEntryUp",
    name: "Move Entry Up",
    defaultCode: "ArrowUp",
    scope: "scoped",
    selector: ".uc-li-text",
    onMatch: () => {
      const li = document.activeElement.closest("li");
      if (li) moveLi(li, -1);
    }
  });
  registerKeybind(plugin, {
    key: "moveEntryDown",
    name: "Move Entry Down",
    defaultCode: "ArrowDown",
    scope: "scoped",
    selector: ".uc-li-text",
    onMatch: () => {
      const li = document.activeElement.closest("li");
      if (li) moveLi(li, 1);
    }
  });
  registerKeybind(plugin, {
    key: "moveSectionUp",
    name: "Move Balance Section Up",
    defaultCode: "ArrowUp",
    scope: "scoped",
    selector: ".uc-section-label",
    onMatch: () => {
      const p = document.activeElement.closest("p.uc-section-header");
      if (!p) return;
      moveSection(p, -1);
      const label = p.querySelector(".uc-section-label");
      if (label) setTimeout(() => label.focus(), 0);
    }
  });
  registerKeybind(plugin, {
    key: "moveSectionDown",
    name: "Move Balance Section Down",
    defaultCode: "ArrowDown",
    scope: "scoped",
    selector: ".uc-section-label",
    onMatch: () => {
      const p = document.activeElement.closest("p.uc-section-header");
      if (!p) return;
      moveSection(p, 1);
      const label = p.querySelector(".uc-section-label");
      if (label) setTimeout(() => label.focus(), 0);
    }
  });
  registerKeybind(plugin, {
    key: "moveCardUp",
    name: "Move Card Up",
    defaultCode: "ArrowUp",
    scope: "scoped",
    selector: ".uc-card-item",
    onMatch: () => newCards.moveCardItem(document.activeElement, -1)
  });
  registerKeybind(plugin, {
    key: "moveCardDown",
    name: "Move Card Down",
    defaultCode: "ArrowDown",
    scope: "scoped",
    selector: ".uc-card-item",
    onMatch: () => newCards.moveCardItem(document.activeElement, 1)
  });

  function bindCardHovers() {
    if (!getCardHoversEnabled()) return;
    const cardNameMap = getCardNameMap();
    container.querySelectorAll(".uc-card-ref").forEach((el) => {
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
    container.querySelectorAll("li").forEach((li) => {
      const span = li.querySelector(".uc-li-text");
      if (span) span.innerHTML = formatLine(li.dataset.raw, getWordColors(), getUnderlineTokens());
    });
    bindCardHovers();
  }
  function clearFormattingOverlay() {
    container.querySelectorAll("li").forEach((li) => {
      const span = li.querySelector(".uc-li-text");
      if (span) span.textContent = li.dataset.raw;
    });
  }
  function setEditingEnabled(enabled) {
    const h2 = container.querySelector("h2");
    if (h2) h2.setAttribute("contenteditable", enabled ? "true" : "false");
    container.querySelectorAll(".uc-li-text").forEach((s) => s.setAttribute("contenteditable", enabled ? "true" : "false"));
    container.querySelectorAll('p.uc-section-header[data-custom="true"] .uc-section-label').forEach((l) => l.setAttribute("contenteditable", enabled ? "true" : "false"));
  }
  function collectState() {
    if (!container) return null;
    const state = { title: "", sections: [], newCards: newCards.collectState(container) };
    const h2 = container.querySelector("h2");
    if (h2) state.title = h2.textContent.trim();
    container.querySelectorAll("p.uc-section-header").forEach((p) => {
      const labelEl = p.querySelector(".uc-section-label");
      const ul = p.nextElementSibling;
      if (!ul) return;
      state.sections.push({
        label: labelEl ? labelEl.textContent.trim() : "",
        custom: p.dataset.custom === "true",
        collapsed: ul.style.display === "none",
        items: [...ul.querySelectorAll(":scope > li")].map((li) => ({
          raw: li.dataset.raw || "",
          category: cycleOrder.find((c) => li.classList.contains(c)) || "other"
        }))
      });
    });
    return state;
  }
  function restoreState(saved) {
    const h2 = container.querySelector("h2");
    if (h2 && saved.title) h2.textContent = saved.title;
    newCards.restoreState(container, saved.newCards);
    getSectionPairs().forEach((pair) => {
      pair.ul.remove();
      pair.p.remove();
    });
    const addSectionRow = container.querySelector(".uc-add-section-row");
    saved.sections.forEach((sec) => {
      const { p, ul } = appendSection(sec.label, !!sec.custom, false, addSectionRow);
      const btn = p.querySelector(".uc-collapse-btn");
      ul.style.display = sec.collapsed ? "none" : "";
      if (btn) btn.textContent = sec.collapsed ? "+" : "\u2212";
      ul.innerHTML = "";
      (sec.items || [{ raw: "[New entry]", category: "other" }]).forEach((item) => {
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
  function setControlsHidden(hidden) {
    controlButtons.forEach((btn) => {
      if (!btn) return;
      btn.style.visibility = hidden ? "hidden" : "visible";
      btn.style.pointerEvents = hidden ? "none" : "auto";
    });
  }
  function init(mainEl) {
    if (document.getElementById("uc-patch-overlay")) {
      logger.warn("init", "Overlay already exists; aborting duplicate init.");
      return;
    }
    injectPatchMakerStyle();
    const navbars = mainEl.querySelectorAll(".navbar.navbar-default");
    const headerNav = navbars[0];
    if (!headerNav) {
      logger.error("init", "Could not find header navbar.");
      return;
    }
    const footer = mainEl.querySelector("footer");
    originalPatchNotesNodes = [];
    let ptr = headerNav.nextElementSibling;
    while (ptr && ptr !== footer) {
      originalPatchNotesNodes.push(ptr);
      ptr = ptr.nextElementSibling;
    }
    let h3 = null, hr1 = null, h2 = null, hr2 = null;
    for (const el of originalPatchNotesNodes) {
      if (!h3 && el.tagName === "H3") {
        h3 = el.cloneNode(true);
        continue;
      }
      if (!hr1 && el.tagName === "HR") {
        hr1 = el.cloneNode(true);
        continue;
      }
      if (!h2 && el.tagName === "H2") {
        h2 = el.cloneNode(true);
        continue;
      }
      if (!hr2 && el.tagName === "HR") {
        hr2 = el.cloneNode(true);
        continue;
      }
    }
    const endBRs = [];
    for (let i = originalPatchNotesNodes.length - 1; i >= 0; i--) {
      if (originalPatchNotesNodes[i].tagName === "BR") endBRs.push(originalPatchNotesNodes[i].cloneNode(true));
      else break;
    }
    endBRs.reverse();
    overlay = document.createElement("div");
    overlay.id = "uc-patch-overlay";
    overlay.style.display = "none";
    overlay.classList.add("editor-mode");
    container = document.createElement("div");
    if (h3) container.appendChild(h3);
    if (hr1) container.appendChild(hr1);
    const titleEl = h2 || document.createElement("h2");
    if (!h2) titleEl.textContent = "[Untitled Patch]";
    makeEditable(titleEl, "[Untitled Patch]");
    container.appendChild(titleEl);
    if (hr2) container.appendChild(hr2);
    const newCardsSec = newCards.createSection(container);
    newCardsSec.section.style.display = "none";
    const newCardsBtn = newCardsSec.p.querySelector(".uc-collapse-btn");
    if (newCardsBtn) newCardsBtn.textContent = "+";
    DEFAULT_SECTIONS.forEach((label) => {
      appendSection(label, false, false, null, !DEFAULT_OPEN_SECTIONS.has(label));
    });
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
    endBRs.forEach((br) => container.appendChild(br));
    overlay.appendChild(container);
    headerNav.insertAdjacentElement("afterend", overlay);
    buildControlButtons();
    loadState();
    logger.log("init", "Overlay initialized.");
    if (getOpenOnLoad()) {
      setTimeout(() => {
        if (!custom) toggle.click();
      }, 0);
    }
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
    Object.assign(toggle.style, {
      position: "fixed", left: "10px", bottom: "10px", padding: "8px 12px",
      background: "#333", color: "white", border: "none", borderRadius: "6px",
      cursor: "pointer", zIndex: "99999"
    });
    Object.assign(modeToggle.style, {
      position: "fixed", left: "10px", bottom: "50px", padding: "8px 12px",
      background: "#333", color: "white", border: "none", borderRadius: "6px",
      cursor: "pointer", zIndex: "99999", fontSize: "14px", display: "none"
    });
    Object.assign(resetBtn.style, {
      position: "fixed", left: "10px", bottom: "90px", padding: "8px 12px",
      background: "#aa3333", color: "white", border: "none", borderRadius: "6px",
      cursor: "pointer", zIndex: "99999", fontSize: "14px", display: "none"
    });
    Object.assign(helpBtn.style, {
      position: "fixed", left: "130px", bottom: "90px", padding: "8px 12px",
      background: "#3366cc", color: "white", border: "none", borderRadius: "6px",
      cursor: "pointer", zIndex: "99999", fontSize: "14px", display: "none"
    });
    [toggle, modeToggle, resetBtn, helpBtn].forEach((b) => document.body.appendChild(b));
    controlButtons = [toggle, modeToggle, resetBtn, helpBtn];
    setControlsHidden(getHideControlsEnabled());
    toggle.onclick = () => {
      custom = !custom;
      overlay.style.display = custom ? "" : "none";
      originalPatchNotesNodes.forEach((n) => n.style.display = custom ? "none" : "");
      toggle.textContent = custom ? "Show Original Patch Notes" : "Show Custom Patch Notes";
      [modeToggle, resetBtn, helpBtn].forEach((b) => b.style.display = custom ? "inline-block" : "none");
      if (!custom && isViewerMode2) {
        isViewerMode2 = false;
        overlay.classList.remove("viewer-mode");
        overlay.classList.add("editor-mode");
        modeToggle.textContent = "Switch to Viewer Mode";
        clearFormattingOverlay();
        setEditingEnabled(true);
      }
    };
    modeToggle.onclick = () => {
      if (!custom) return;
      isViewerMode2 = !isViewerMode2;
      overlay.classList.toggle("viewer-mode", isViewerMode2);
      overlay.classList.toggle("editor-mode", !isViewerMode2);
      modeToggle.textContent = isViewerMode2 ? "Switch to Editor Mode" : "Switch to Viewer Mode";
      if (isViewerMode2) {
        container.querySelectorAll("p").forEach((p) => {
          const sibling = p.nextElementSibling;
          if (sibling && sibling.style.display === "none") p.style.display = "none";
        });
        applyFormattingOverlay();
        setEditingEnabled(false);
        logger.log("mode", "Switched to viewer mode.");
      } else {
        container.querySelectorAll("p").forEach((p) => {
          p.style.display = "";
        });
        clearFormattingOverlay();
        setEditingEnabled(true);
        logger.log("mode", "Switched to editor mode.");
      }
    };
    resetBtn.onclick = (e) => {
      if (custom && e.detail === 2) {
        resetState();
        location.reload();
      }
    };
    helpBtn.onclick = () => {
      const message = buildHelpMessage(version);
      const pageWindow = getPageWindow();
      const BootstrapDialogRef = pageWindow.BootstrapDialog;
      if (BootstrapDialogRef && typeof BootstrapDialogRef.alert === "function") {
        BootstrapDialogRef.alert({ title: "Custom Patch Maker \u2013 Help", message, closable: true });
      } else {
        alert(message.replace(/<[^>]+>/g, ""));
      }
    };
  }
  return { init, setControlsHidden };
}
