import { formatLine, sanitizeText } from "./formatting.js";
import {
  getCardIdByExactGameLookup,
  resolveCardId,
  attachCardHover
} from "../core/card-data.js";
import { getPageWindow } from "../core/page-window.js";
import { injectPatchMakerStyle } from "./styles.js";
import { enableInputBlocker, disableInputBlocker } from "./input-blocker.js";
import { createNewCardsFeature } from "./new-cards.js";

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

// Restored from the original script: these three start open on a fresh
// state, the rest start collapsed. Was dropped during the initial port.
const DEFAULT_OPEN_SECTIONS = new Set([
  "Balancing (Monsters)",
  "Balancing (Spells)",
  "Balancing (Artifacts)"
]);

function buildHelpMessage(version) {
  return `<u><b>Basic Editing</b></u>
Click any balance change to begin editing
• Enter  = Confirm change


<u><b>Adding & Removing Entries</b></u>
• Green/Red +/- Button – Add a new entry / Remove entry


<u><b>Toggle Balance Sections</b></u>
• Blue +/- Button – Toggle visibility of a balance section
<span style="color:#ff5555;">NOTE:</span> Hidden sections will not appear in Viewer Mode


<u><b>Entry Class Type</b></u>
Each entry needs a category:
• Other (GRAY)
• Buff (GREEN)
• Rework (GOLD)
• Nerf (RED)
• None (EMPTY)


<u><b>Category Shortcuts</b></u>
• Ctrl  + Up / Down   → Change class type
• Shift + Up / Down   → Move entry up/down in section


<u><b>Custom Balance Sections</b></u>
• Green + Button – Add a new custom balance section
• Red - Button - Remove custom balance section (Double Click Required)
• Click a section name to select it
• Shift + Up / Down – Move selected section up/down


<u><b>Automatic Highlighting</b></u>
The following are highlighted automatically:
• Stats: ATK, HP, COST, DMG
• Numeric stats: 3/2, +1/+1, 1/1/1
• Rarities, resources, keywords, and tribes


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
• Editable, no formatting

Viewer Mode:
• Read-only
• Formatting applied
• Clean display


<u><b>Saving & Reset</b></u>
• Changes save automatically
• Double-click Reset Data to clear everything

Version: v${version}`;
}

export function createPatchMakerOverlay({
  logger, getWordColors, getUnderlineTokens, getCardHoversEnabled, getCardNameMap,
  getHideControlsEnabled, getOpenOnLoad, version
}) {
  let overlay, container, toggle, modeToggle, resetBtn, helpBtn;
  let custom = false;
  let isViewerMode = false;
  let originalPatchNotesNodes = []; // the real page's content between navbar and footer
  let controlButtons = [];

  const newCards = createNewCardsFeature({
    isViewerMode: () => overlay.classList.contains("viewer-mode"),
    saveState: () => saveState()
  });

  // ---- persistence (raw GM storage - not a user-facing setting) ----

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

  // ---- generic editable-field behavior (title h2) ----

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

    el.addEventListener("keydown", e => {
      if (overlay.classList.contains("viewer-mode")) return;
      if (e.key === "Enter") { e.preventDefault(); el.blur(); }
      if (e.key === "Escape") {
        e.preventDefault();
        el.textContent = el.dataset.prevText;
        el.blur();
      }
    });

    el.addEventListener("paste", e => {
      if (overlay.classList.contains("viewer-mode")) { e.preventDefault(); return; }
      e.preventDefault();
      const txt = (e.clipboardData || window.clipboardData).getData("text") || "";
      document.execCommand("insertText", false, sanitizeText(txt));
    });
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

    span.addEventListener("paste", e => {
      if (overlay.classList.contains("viewer-mode")) { e.preventDefault(); return; }
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

    labelEl.addEventListener("keydown", e => {
      if (handleShortcut(e)) return;
      if (!isCustom) return;
      if (e.key === "Enter") { e.preventDefault(); labelEl.blur(); }
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

    ul.style.display = startCollapsed ? "none" : "";
    collapseBtn.textContent = startCollapsed ? "+" : "−";

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
      // FIX: the original re-focuses the section label after every move
      // (each of its callers did this individually). The consolidated
      // handler here dropped that step, so every Shift+Arrow press lost
      // focus - meaning repeated moves required re-clicking each time.
      const label = p.querySelector(".uc-section-label");
      if (label) setTimeout(() => label.focus(), 0);
      return true;
    }

    return false;
  }

  // ---- viewer/editor mode ----

  function bindCardHovers() {
    if (!getCardHoversEnabled()) return;
    const cardNameMap = getCardNameMap();

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
      if (span) span.innerHTML = formatLine(li.dataset.raw, getWordColors(), getUnderlineTokens());
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
    const state = { title: "", sections: [], newCards: newCards.collectState(container) };
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

    newCards.restoreState(container, saved.newCards);

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

  // ---- control button visibility ("Hide Patch Maker controls") ----

  function setControlsHidden(hidden) {
    controlButtons.forEach(btn => {
      if (!btn) return;
      btn.style.visibility = hidden ? "hidden" : "visible";
      btn.style.pointerEvents = hidden ? "none" : "auto";
    });
  }

  // ---- init ----

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
      if (!h3 && el.tagName === "H3") { h3 = el.cloneNode(true); continue; }
      if (!hr1 && el.tagName === "HR") { hr1 = el.cloneNode(true); continue; }
      if (!h2 && el.tagName === "H2") { h2 = el.cloneNode(true); continue; }
      if (!hr2 && el.tagName === "HR") { hr2 = el.cloneNode(true); continue; }
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
    newCardsSec.section.style.display = "none"; // collapsed by default, matches original
    const newCardsBtn = newCardsSec.p.querySelector(".uc-collapse-btn");
    if (newCardsBtn) newCardsBtn.textContent = "+";

    DEFAULT_SECTIONS.forEach(label => {
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

    endBRs.forEach(br => container.appendChild(br));

    overlay.appendChild(container);
    headerNav.insertAdjacentElement("afterend", overlay);

    buildControlButtons();
    loadState();
    logger.log("init", "Overlay initialized.");

    if (getOpenOnLoad()) {
      setTimeout(() => { if (!custom) toggle.click(); }, 0);
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

    [toggle, modeToggle, resetBtn, helpBtn].forEach(b => document.body.appendChild(b));
    controlButtons = [toggle, modeToggle, resetBtn, helpBtn];
    setControlsHidden(getHideControlsEnabled());

    toggle.onclick = () => {
      custom = !custom;
      overlay.style.display = custom ? "" : "none";
      originalPatchNotesNodes.forEach(n => n.style.display = custom ? "none" : "");
      toggle.textContent = custom ? "Show Original Patch Notes" : "Show Custom Patch Notes";
      [modeToggle, resetBtn, helpBtn].forEach(b => b.style.display = custom ? "inline-block" : "none");
      if (!custom && isViewerMode) {
        isViewerMode = false;
        overlay.classList.remove("viewer-mode");
        overlay.classList.add("editor-mode");
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

      if (isViewerMode) {
        // Restored: a collapsed section's header should stay fully
        // hidden in Viewer Mode too, not just its (already-hidden)
        // list - so screenshots only show sections the user actually
        // left expanded. This check runs over every <p> in container,
        // which also naturally covers the New Cards header if that
        // section is collapsed.
        container.querySelectorAll("p").forEach(p => {
          const sibling = p.nextElementSibling;
          if (sibling && sibling.style.display === "none") p.style.display = "none";
        });
        applyFormattingOverlay();
        setEditingEnabled(false);
        logger.log("mode", "Switched to viewer mode.");
      } else {
        container.querySelectorAll("p").forEach(p => { p.style.display = ""; });
        clearFormattingOverlay();
        setEditingEnabled(true);
        logger.log("mode", "Switched to editor mode.");
      }
    };

    resetBtn.onclick = e => { if (custom && e.detail === 2) { resetState(); location.reload(); } };

    // FIX: was checking bare `window.BootstrapDialog`, which is always
    // undefined in this script's sandboxed context (same root cause as
    // the earlier UnderScript-not-registering bug). BootstrapDialog is
    // a real page global, so it has to be read via getPageWindow().
    helpBtn.onclick = () => {
      const message = buildHelpMessage(version);
      const pageWindow = getPageWindow();
      const BootstrapDialogRef = pageWindow.BootstrapDialog;
      if (BootstrapDialogRef && typeof BootstrapDialogRef.alert === "function") {
        BootstrapDialogRef.alert({ title: "Custom Patch Maker – Help", message, closable: true });
      } else {
        alert(message.replace(/<[^>]+>/g, ""));
      }
    };
  }

  return { init, setControlsHidden };
}
