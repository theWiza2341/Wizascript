// ==UserScript==
// @name         Wizascript
// @namespace    https://github.com/theWiza2341/Wizascript
// @version      1.4.0
// @description  All-in-one UnderScript plugin suite for Undercards.
// @author       TheWiza2341
// @match        https://undercards.net/*
// @match        https://*.undercards.net/*
// @icon         https://i.imgur.com/FOIUHej.png
// @updateURL    https://raw.githubusercontent.com/theWiza2341/Wizascript/refs/heads/main/wizascript.user.js
// @downloadURL  https://raw.githubusercontent.com/theWiza2341/Wizascript/refs/heads/main/wizascript.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// ==/UserScript==

(() => {
  // packages/core/page-window.js
  function getPageWindow() {
    return typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  }

  // packages/core/bootstrap.js
  var SUITE_NAME = "Wizascript";
  var SUITE_VERSION = "1.4.0";
  var DOWNLOAD_URL = "https://raw.githubusercontent.com/theWiza2341/Wizascript/refs/heads/main/wizascript.user.js";
  var RETRY_MS = 250;
  var WARN_AFTER_ATTEMPTS = 40;
  var suitePlugin = null;
  var attempts = 0;
  var readyCallbacks = [];
  function tryBootstrap() {
    if (suitePlugin) return;
    attempts++;
    const pageWindow2 = getPageWindow();
    if (typeof pageWindow2.underscript === "undefined" || typeof pageWindow2.underscript.plugin !== "function") {
      if (attempts === WARN_AFTER_ATTEMPTS) {
        console.warn(
          "[Wizascript] Still waiting for UnderScript after ~10s. Is UnderScript installed and enabled for this page?"
        );
      }
      setTimeout(tryBootstrap, RETRY_MS);
      return;
    }
    suitePlugin = pageWindow2.underscript.plugin(SUITE_NAME, SUITE_VERSION);
    suitePlugin.updater(DOWNLOAD_URL);
    console.log(`[Wizascript] Registered with UnderScript (v${SUITE_VERSION}).`);
    readyCallbacks.forEach((cb) => cb(suitePlugin));
    readyCallbacks.length = 0;
  }
  function bootstrap(onReady) {
    if (suitePlugin) {
      onReady(suitePlugin);
      return;
    }
    readyCallbacks.push(onReady);
    tryBootstrap();
  }

  // packages/core/settings.js
  function createFeatureSettings(plugin, featureName, categoryLabel) {
    const settingsApi = plugin.settings();
    const registered = {};
    function add(key, config) {
      const setting = settingsApi.add({
        ...config,
        key: `${featureName}.${key}`,
        category: config.category || categoryLabel
      });
      registered[key] = setting;
      return setting;
    }
    function value(key) {
      return registered[key].value();
    }
    return { add, value };
  }

  // packages/core/keybinds.js
  var CATEGORY = "Keybinds";
  var HOLD_DELAY_MS = 250;
  var NATIVE_MODIFIERS = /* @__PURE__ */ new Set(["Control", "Shift", "Alt"]);
  var DEFAULT_PRIMARY_CODE = "Control";
  var PRIMARY_KEY = "primaryKey";
  var GM_PREFIX = "wizascript.keybinds.";
  var ID_PREFIX = "underscript.plugin.Wizascript.keybinds.";
  function storageKey(bindingKey) {
    return `${GM_PREFIX}${bindingKey}`;
  }
  function readCode(bindingKey, defaultCode) {
    return GM_getValue(storageKey(bindingKey), defaultCode);
  }
  function writeCode(bindingKey, code) {
    GM_setValue(storageKey(bindingKey), code);
  }
  var DISPLAY_OVERRIDES = {
    Control: "Ctrl",
    Shift: "Shift",
    Alt: "Alt",
    Meta: "Meta",
    ArrowUp: "Up Arrow",
    ArrowDown: "Down Arrow",
    ArrowLeft: "Left Arrow",
    ArrowRight: "Right Arrow",
    Space: "Space",
    Escape: "Esc",
    Comma: ",",
    Period: ".",
    unbound: "Unbound"
  };
  function codeToDisplay(code) {
    if (!code) return "Unbound";
    if (DISPLAY_OVERRIDES[code]) return DISPLAY_OVERRIDES[code];
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    return code;
  }
  var settings = null;
  var registry = [];
  var bindingDefaults = /* @__PURE__ */ new Map();
  var dividerKeys = /* @__PURE__ */ new Set();
  var seenPackageLabels = /* @__PURE__ */ new Set();
  var observerStarted = false;
  function isTypingContext() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
  }
  function enhanceInput(el, bindingKey, defaultCode) {
    el.setAttribute("data-wizascript-keybind-enhanced", "true");
    el.readOnly = true;
    Object.assign(el.style, {
      cursor: "pointer",
      backgroundColor: "black",
      color: "white",
      border: "1px solid #b4b4b4",
      borderRadius: "3px",
      textAlign: "center"
    });
    function refreshDisplay() {
      el.value = codeToDisplay(readCode(bindingKey, defaultCode));
    }
    refreshDisplay();
    el.addEventListener("focus", () => {
      el.style.border = "1px solid #40E0D0";
      el.style.boxShadow = "0 0 4px #40E0D0";
      el.value = "...?";
      function capture(e) {
        e.preventDefault();
        const code = e.key === "Escape" ? "unbound" : e.code;
        writeCode(bindingKey, code);
        document.removeEventListener("keydown", capture, true);
        el.blur();
      }
      document.addEventListener("keydown", capture, true);
      el.addEventListener("blur", function onBlur() {
        el.style.border = "1px solid #b4b4b4";
        el.style.boxShadow = "none";
        document.removeEventListener("keydown", capture, true);
        refreshDisplay();
        el.removeEventListener("blur", onBlur);
      });
    });
  }
  function enhanceDivider(el) {
    el.setAttribute("data-wizascript-keybind-enhanced", "true");
    el.readOnly = true;
    el.tabIndex = -1;
    Object.assign(el.style, {
      backgroundColor: "transparent",
      border: "none",
      borderBottom: "1px solid #666",
      color: "#8ab4f8",
      fontWeight: "bold",
      cursor: "default",
      pointerEvents: "none"
    });
  }
  function startObserver() {
    if (observerStarted) return;
    observerStarted = true;
    const observer = new MutationObserver(() => {
      if (!bindingDefaults.size && !dividerKeys.size) return;
      document.querySelectorAll(`input[id^="${ID_PREFIX}"]:not([data-wizascript-keybind-enhanced])`).forEach((el) => {
        const bindingKey = el.id.slice(ID_PREFIX.length);
        if (dividerKeys.has(bindingKey)) {
          enhanceDivider(el);
          return;
        }
        if (!bindingDefaults.has(bindingKey)) return;
        enhanceInput(el, bindingKey, bindingDefaults.get(bindingKey));
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  function matchesCode(e, code, defaultCode) {
    if (code === defaultCode && NATIVE_MODIFIERS.has(defaultCode)) {
      return e.key === defaultCode;
    }
    return e.code === code;
  }
  function getPrimaryCode() {
    return readCode(PRIMARY_KEY, DEFAULT_PRIMARY_CODE);
  }
  function matchesSetting(e, binding) {
    const code = readCode(binding.key, binding.defaultCode);
    return matchesCode(e, code, binding.defaultCode);
  }
  var primaryHeld = false;
  var holdTimer = null;
  var comboFired = false;
  var DOUBLE_TAP_WINDOW_MS = 400;
  var tapCount = 0;
  var lastTapTime = 0;
  function bindGlobalListeners() {
    document.addEventListener("keydown", (e) => {
      const primaryCode = getPrimaryCode();
      const isPrimary = matchesCode(e, primaryCode, DEFAULT_PRIMARY_CODE);
      if (isPrimary) {
        if (primaryHeld) return;
        primaryHeld = true;
        comboFired = false;
        const now = Date.now();
        tapCount = now - lastTapTime <= DOUBLE_TAP_WINDOW_MS ? tapCount + 1 : 1;
        lastTapTime = now;
        if (tapCount === 2) {
          tapCount = 0;
          registry.forEach((b) => {
            if (b.scope !== "global" || !b.onPrimaryDoubleTap) return;
            if (b.guardTypingContext && isTypingContext()) return;
            b.onPrimaryDoubleTap(e);
          });
        }
        registry.forEach((b) => {
          if (!b.onPrimaryPress) return;
          if (b.guardTypingContext && isTypingContext()) return;
          b.onPrimaryPress(e);
        });
        clearTimeout(holdTimer);
        holdTimer = setTimeout(() => {
          if (comboFired) return;
          registry.forEach((b) => {
            if (b.scope !== "global" || !b.onPrimaryAlone) return;
            if (b.guardTypingContext && isTypingContext()) return;
            b.onPrimaryAlone(e);
          });
        }, HOLD_DELAY_MS);
        return;
      }
      if (!primaryHeld) return;
      clearTimeout(holdTimer);
      for (const b of registry) {
        if (!b.onMatch) continue;
        if (!matchesSetting(e, b)) continue;
        if (b.guardTypingContext && isTypingContext()) continue;
        if (b.scope === "scoped") {
          const active = document.activeElement;
          if (!active || !active.matches(b.selector)) continue;
        }
        comboFired = true;
        e.preventDefault();
        b.onMatch(e);
        break;
      }
    });
    document.addEventListener("keyup", (e) => {
      const primaryCode = getPrimaryCode();
      if (matchesCode(e, primaryCode, DEFAULT_PRIMARY_CODE)) {
        primaryHeld = false;
        clearTimeout(holdTimer);
        registry.forEach((b) => {
          if (b.scope !== "global" || !b.onPrimaryRelease) return;
          if (b.guardTypingContext && isTypingContext()) return;
          b.onPrimaryRelease(e);
        });
      }
    });
  }
  var primaryKeySetting = null;
  function ensureCore(plugin) {
    if (settings) return;
    settings = createFeatureSettings(plugin, "keybinds", CATEGORY);
    startObserver();
    bindGlobalListeners();
    primaryKeySetting = settings.add(PRIMARY_KEY, {
      name: "Primary Key",
      note: "Click to remap. Hold for combos below, or tap alone.",
      type: "text",
      default: DEFAULT_PRIMARY_CODE
    });
    bindingDefaults.set(PRIMARY_KEY, DEFAULT_PRIMARY_CODE);
    const generalDividerKey = "__divider_General";
    settings.add(generalDividerKey, {
      name: "\u2014 General \u2014",
      type: "text",
      default: ""
    });
    dividerKeys.add(generalDividerKey);
    const openSettingsInfoKey = "__info_openSettings";
    settings.add(openSettingsInfoKey, {
      name: "Double Tap Primary \u2192 Open Wizascript Settings",
      type: "text",
      default: ""
    });
    dividerKeys.add(openSettingsInfoKey);
    registry.push({
      key: "openWizascriptSettings",
      scope: "global",
      guardTypingContext: true,
      onPrimaryDoubleTap: () => {
        if (primaryKeySetting && typeof primaryKeySetting.show === "function") {
          primaryKeySetting.show();
        } else {
          console.warn("[Wizascript] Could not open the settings panel - .show() is unavailable on this setting.");
        }
      }
    });
  }
  var pendingRegistrations = [];
  var autoFlushScheduled = false;
  function registerKeybind(plugin, config) {
    pendingRegistrations.push({ plugin, config });
    if (!autoFlushScheduled) {
      autoFlushScheduled = true;
      setTimeout(() => {
        if (pendingRegistrations.length) flushKeybindRegistrations();
      }, 0);
    }
  }
  function flushKeybindRegistrations() {
    const queued = pendingRegistrations.splice(0);
    queued.forEach(({ plugin, config }) => registerKeybindNow(plugin, config));
  }
  function registerKeybindNow(plugin, config) {
    const {
      key,
      name,
      defaultCode,
      scope = "global",
      selector,
      // Defaults to true (ignore keybinds while focused in a text field/
      // contenteditable, e.g. chat) - this is what almost every package
      // wants, since a bare Primary+<key> shouldn't fire while someone's
      // just typing and happens to hit a key that collides with a
      // binding. Patch Maker is the one deliberate exception, since its
      // own bindings specifically need to fire while focused on its own
      // contenteditable elements - it opts out explicitly per binding.
      guardTypingContext = true,
      packageLabel,
      onMatch,
      onPrimaryAlone,
      onPrimaryPress,
      onPrimaryRelease,
      onPrimaryDoubleTap
    } = config;
    ensureCore(plugin);
    if (packageLabel && !seenPackageLabels.has(packageLabel)) {
      seenPackageLabels.add(packageLabel);
      const dividerKey = `__divider_${packageLabel.replace(/\s+/g, "_")}`;
      settings.add(dividerKey, {
        name: `\u2014 ${packageLabel} \u2014`,
        type: "text",
        default: ""
      });
      dividerKeys.add(dividerKey);
    }
    if (onMatch) {
      settings.add(key, {
        name: `${name} - Primary + <key>`,
        type: "text",
        default: defaultCode
      });
      bindingDefaults.set(key, defaultCode);
    }
    registry.push({ key, defaultCode, scope, selector, guardTypingContext, onMatch, onPrimaryAlone, onPrimaryPress, onPrimaryRelease, onPrimaryDoubleTap });
  }
  function getPrimaryKeyDisplay() {
    return codeToDisplay(getPrimaryCode());
  }
  function isRegisteredKeybindEvent(e) {
    const primaryCode = getPrimaryCode();
    if (matchesCode(e, primaryCode, DEFAULT_PRIMARY_CODE)) return true;
    if (!primaryHeld) return false;
    return registry.some((b) => b.onMatch && matchesSetting(e, b));
  }

  // packages/patch-maker/settings.js
  function registerPatchMakerSettings(plugin) {
    const settings2 = createFeatureSettings(plugin, "patchmaker", "Patch Maker");
    return {
      settings: settings2,
      enabled: settings2.add("enabled", { name: "Enable Patch Maker", type: "boolean", default: true }),
      debugLogging: settings2.add("debugLogging", { name: "Enable debug logging", type: "boolean", default: false }),
      hideControls: settings2.add("hideControls", { name: "Hide Patch Maker controls", type: "boolean", default: false }),
      cardHovers: settings2.add("enableCardHovers", { name: "Enable card hovers", type: "boolean", default: true }),
      language: settings2.add("patchLanguage", {
        name: "Select Language",
        type: "select",
        options: ["Auto / Default", "English", "French", "Spanish", "Portuguese", "Chinese", "Italian", "Polish", "German", "Russian"],
        default: "Auto / Default",
        onChange: () => location.reload()
      }),
      openOnLoad: settings2.add("openPatchNotesOnPageLoad", { name: "Auto-Load Patch Maker", type: "boolean", default: false })
    };
  }

  // packages/patch-maker/new-cards.js
  var TARGET_W = 176;
  var TARGET_H = 246;
  var FIELDMARKER_WATERMARK_CROP_PX = 14;
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
  function loadImageFromDataURL(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }
  async function normalizeCardImage(dataUrl) {
    const img = await loadImageFromDataURL(dataUrl);
    if (img.naturalWidth === TARGET_W && img.naturalHeight === TARGET_H) {
      return dataUrl;
    }
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (img.naturalWidth === 163 && img.naturalHeight >= 250) {
      sh = Math.max(1, img.naturalHeight - FIELDMARKER_WATERMARK_CROP_PX);
    }
    const canvas = document.createElement("canvas");
    canvas.width = TARGET_W;
    canvas.height = TARGET_H;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, TARGET_W, TARGET_H);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, TARGET_W, TARGET_H);
    return canvas.toDataURL("image/png");
  }
  function createNewCardsFeature({ isViewerMode: isViewerMode2, saveState }) {
    function ensureCardAddTile(section) {
      const gallery = section.querySelector(".uc-card-gallery");
      if (!gallery) return null;
      let addTile = gallery.querySelector(":scope > .uc-card-add-tile");
      if (addTile) {
        gallery.appendChild(addTile);
        return addTile;
      }
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";
      fileInput.multiple = true;
      fileInput.style.display = "none";
      addTile = document.createElement("div");
      addTile.className = "uc-card-add-tile";
      const addBtn = document.createElement("button");
      addBtn.className = "uc-card-add-btn";
      addBtn.textContent = "+";
      addBtn.title = "Add card image";
      addBtn.onclick = () => {
        if (isViewerMode2()) return;
        fileInput.click();
      };
      fileInput.addEventListener("change", async (e) => {
        const files = [...e.target.files || []];
        if (!files.length) return;
        for (const file of files) {
          if (!file.type.startsWith("image/")) continue;
          const dataUrl = await readFileAsDataURL(file);
          const normalized = await normalizeCardImage(dataUrl);
          addCardImage(section, normalized, file.name || "Card image");
        }
        fileInput.value = "";
        ensureCardAddTile(section);
        saveState();
      });
      addTile.appendChild(addBtn);
      addTile.appendChild(fileInput);
      gallery.appendChild(addTile);
      return addTile;
    }
    function addCardImage(section, src, name = "Card image") {
      const gallery = section.querySelector(".uc-card-gallery");
      if (!gallery) return null;
      ensureCardAddTile(section);
      const item = document.createElement("div");
      item.className = "uc-card-item";
      item.tabIndex = 0;
      item.dataset.src = src;
      item.dataset.name = name;
      const frame = document.createElement("div");
      frame.className = "uc-card-frame";
      const img = document.createElement("img");
      img.src = src;
      img.alt = name;
      frame.appendChild(img);
      item.appendChild(frame);
      const delBtn = document.createElement("button");
      delBtn.className = "uc-card-del";
      delBtn.textContent = "\u2212";
      delBtn.title = "Remove card image";
      delBtn.onclick = (e) => {
        if (isViewerMode2()) return;
        e.stopPropagation();
        item.remove();
        ensureCardAddTile(section);
        saveState();
      };
      item.appendChild(delBtn);
      const addTile = gallery.querySelector(":scope > .uc-card-add-tile");
      if (addTile) gallery.insertBefore(item, addTile);
      else gallery.appendChild(item);
      ensureCardAddTile(section);
      return item;
    }
    function moveCardItem(item, dir) {
      const gallery = item.parentElement;
      if (!gallery) return;
      const items = [...gallery.querySelectorAll(":scope > .uc-card-item")];
      const idx = items.indexOf(item);
      if (idx < 0 || items.length <= 1) return;
      const newIdx = (idx + dir + items.length) % items.length;
      const target = items[newIdx];
      if (dir < 0) {
        if (idx === 0) gallery.appendChild(item);
        else gallery.insertBefore(item, target);
      } else {
        if (idx === items.length - 1) gallery.insertBefore(item, items[0]);
        else gallery.insertBefore(item, target.nextElementSibling);
      }
      ensureCardAddTile(gallery.parentElement);
      saveState();
      setTimeout(() => item.focus(), 0);
    }
    function createSection(container) {
      const p = document.createElement("p");
      p.className = "uc-new-cards-header";
      const label = document.createElement("span");
      label.textContent = "New cards";
      p.appendChild(label);
      const section = document.createElement("div");
      section.className = "uc-card-section";
      const gallery = document.createElement("div");
      gallery.className = "uc-card-gallery";
      section.appendChild(gallery);
      const collapseBtn = document.createElement("button");
      collapseBtn.className = "uc-collapse-btn";
      collapseBtn.textContent = "\u2212";
      collapseBtn.onclick = () => {
        if (isViewerMode2()) return;
        const collapsed = section.style.display === "none";
        section.style.display = collapsed ? "" : "none";
        collapseBtn.textContent = collapsed ? "\u2212" : "+";
        saveState();
      };
      p.appendChild(collapseBtn);
      container.appendChild(p);
      container.appendChild(section);
      ensureCardAddTile(section);
      return { p, section, gallery };
    }
    function collectState(container) {
      const header = container.querySelector("p.uc-new-cards-header");
      const section = header ? header.nextElementSibling : null;
      if (!header || !section) return { collapsed: false, cards: [] };
      return {
        collapsed: section.style.display === "none",
        cards: [...section.querySelectorAll(".uc-card-item")].map((item) => ({
          src: item.dataset.src || "",
          name: item.dataset.name || "Card image"
        })).filter((card) => card.src)
      };
    }
    function restoreState(container, newCards) {
      const header = container.querySelector("p.uc-new-cards-header");
      const section = header ? header.nextElementSibling : null;
      if (!header || !section) return;
      const btn = header.querySelector(".uc-collapse-btn");
      section.style.display = newCards && newCards.collapsed ? "none" : "";
      if (btn) btn.textContent = newCards && newCards.collapsed ? "+" : "\u2212";
      const gallery = section.querySelector(".uc-card-gallery");
      if (gallery) gallery.innerHTML = "";
      ensureCardAddTile(section);
      (newCards && newCards.cards || []).forEach((card) => {
        if (card && card.src) addCardImage(section, card.src, card.name || "Card image");
      });
      ensureCardAddTile(section);
    }
    return { createSection, collectState, restoreState, moveCardItem };
  }

  // packages/patch-maker/input-blocker.js
  function isEditingOverlayField() {
    const ae = document.activeElement;
    return !!(ae && (ae.classList.contains("uc-li-text") || ae.classList.contains("uc-section-label") || ae.tagName === "H2" && ae.getAttribute("contenteditable") === "true"));
  }
  function isViewerMode() {
    const overlay = document.getElementById("uc-patch-overlay");
    return !!(overlay && overlay.classList.contains("viewer-mode"));
  }
  function inputBlocker(e) {
    if (!isEditingOverlayField() || isViewerMode()) return;
    if (isRegisteredKeybindEvent(e)) return;
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (e.key === "Escape" || e.key === "Enter") {
      e.preventDefault();
      if (e.key === "Enter") document.activeElement.blur();
    }
  }
  function enableInputBlocker() {
    window.addEventListener("keydown", inputBlocker, true);
    window.addEventListener("keyup", inputBlocker, true);
    document.addEventListener("keydown", inputBlocker, true);
    document.addEventListener("keyup", inputBlocker, true);
  }
  function disableInputBlocker() {
    window.removeEventListener("keydown", inputBlocker, true);
    window.removeEventListener("keyup", inputBlocker, true);
    document.removeEventListener("keydown", inputBlocker, true);
    document.removeEventListener("keyup", inputBlocker, true);
  }

  // packages/patch-maker/formatting.js
  var BASE_WORD_COLORS = {
    ATK: "#f0003c",
    HP: "#0dd000",
    cost: "#00d0ff",
    DMG: "#ffcc00",
    DETERMINATION: "red",
    PATIENCE: "#41fcff",
    BRAVERY: "#fca500",
    INTEGRITY: "#0064ff",
    PERSEVERANCE: "#d535d9",
    KINDNESS: "#00c000",
    JUSTICE: "#ffff00",
    MONSTER: "#ffffff",
    TOKEN: "#00c800",
    BASE: "gray",
    COMMON: "#fff",
    RARE: "#00b8ff",
    EPIC: "#d535d9",
    LEGENDARY: "gold",
    DT: "red",
    COST: "#00d0ff",
    G: "gold",
    KR: "#d535d9"
  };
  var CARD_REF_REGEX = /\{([^{}]+?)\}/g;
  var UL_OPEN = "__UC_UL_OPEN__";
  var UL_CLOSE = "__UC_UL_CLOSE__";
  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function sanitizeText(str) {
    return str ? str.replace(/\s+/g, " ").trim() : "";
  }
  function insertUnderlineMarkers(text, underlineTokens) {
    let result = text;
    underlineTokens.forEach((token) => {
      const re = new RegExp(`(^|[^A-Za-z0-9])(${escapeRegExp(token)})(?=([^A-Za-z0-9]|$))`, "g");
      result = result.replace(re, (m, pre, word) => pre + UL_OPEN + word + UL_CLOSE);
    });
    return result;
  }
  var CASE_SENSITIVE_COLOR_WORDS = /* @__PURE__ */ new Set(["BASE", "COMMON", "RARE", "EPIC", "LEGENDARY", "TOKEN"]);
  function applyColorWords(seg, wordColors) {
    const allKeys = Object.keys(wordColors).filter(Boolean);
    const caseSensitiveKeys = allKeys.filter((k) => CASE_SENSITIVE_COLOR_WORDS.has(k));
    const caseInsensitiveKeys = allKeys.filter((k) => !CASE_SENSITIVE_COLOR_WORDS.has(k));
    if (caseSensitiveKeys.length) {
      const pattern = caseSensitiveKeys.sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
      const regex = new RegExp(`(^|[^\\p{L}\\p{N}_])(${pattern})(?=([^\\p{L}\\p{N}_]|$))`, "gu");
      seg = seg.replace(regex, (match, pre, word) => {
        const c = wordColors[word];
        return c ? `${pre}<span style="color:${c};">${word}</span>` : match;
      });
    }
    if (caseInsensitiveKeys.length) {
      const pattern = caseInsensitiveKeys.sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
      const regex = new RegExp(`(^|[^\\p{L}\\p{N}_])(${pattern})(?=([^\\p{L}\\p{N}_]|$))`, "giu");
      seg = seg.replace(regex, (match, pre, word) => {
        const c = wordColors[word] || wordColors[word.toUpperCase()] || wordColors[word.toLowerCase()];
        return c ? `${pre}<span style="color:${c};">${word}</span>` : match;
      });
    }
    return seg;
  }
  function applyCardFormatting(seg, wordColors) {
    const cardColor = wordColors.PATIENCE || "#41fcff";
    return seg.replace(CARD_REF_REGEX, (match, inner) => {
      const cleaned = inner.replace(new RegExp(UL_OPEN, "g"), "").replace(new RegExp(UL_CLOSE, "g"), "").replace(/<[^>]*>/g, "").trim();
      return `<span class="uc-card-ref" style="color:${cardColor};">${escapeHtml(cleaned)}</span>`;
    });
  }
  function applyStatFormatting(seg, wordColors) {
    const statPattern = /(?<!\d)([+-]?)(\d+)\/([+-]?)(\d+)(?:\/([+-]?)(\d+))?(?=[^\d/]|$)/g;
    return seg.replace(statPattern, (match, s1, a, s2, b, s3, c) => {
      if (c !== void 0) {
        return `${s1}<span style="color:${wordColors.cost}">${a}</span>/${s2}<span style="color:${wordColors.ATK}">${b}</span>/${s3}<span style="color:${wordColors.HP}">${c}</span>`;
      }
      return `${s1}<span style="color:${wordColors.ATK}">${a}</span>/${s2}<span style="color:${wordColors.HP}">${b}</span>`;
    });
  }
  function formatSegments(work, wordColors, underlineTokens) {
    const parts = [];
    const re = /_(.+?)_/g;
    let last = 0, m;
    while ((m = re.exec(work)) !== null) {
      if (m.index > last) parts.push({ text: work.slice(last, m.index), manual: false });
      parts.push({ text: m[1], manual: true });
      last = m.index + m[0].length;
    }
    if (last < work.length) parts.push({ text: work.slice(last), manual: false });
    return parts.map((part) => {
      let seg = part.text;
      if (part.manual) {
        return `<span style="text-decoration:underline;">${escapeHtml(seg.trim())}</span>`;
      }
      seg = insertUnderlineMarkers(seg, underlineTokens);
      seg = escapeHtml(seg);
      seg = applyColorWords(seg, wordColors);
      seg = applyCardFormatting(seg, wordColors);
      seg = applyStatFormatting(seg, wordColors);
      return seg.replace(new RegExp(UL_OPEN, "g"), `<span style="text-decoration:underline;">`).replace(new RegExp(UL_CLOSE, "g"), `</span>`);
    }).join("");
  }
  function extractSkipTokens(text) {
    const skipped = [];
    const work = text.replace(/\\([A-Za-z0-9\-]+)/g, (m, word) => {
      const idx = skipped.length;
      skipped.push(word);
      return `UCSK${idx}Z`;
    });
    return { work, skipped };
  }
  function formatSwitchInner(rawText, wordColors, underlineTokens) {
    if (!rawText) return "";
    return formatSegments(rawText, wordColors, underlineTokens);
  }
  function formatLine(rawText, wordColors, underlineTokens) {
    if (!rawText) return "";
    const skipData = extractSkipTokens(rawText);
    let work = skipData.work;
    const switchBlocks = [];
    work = work.replace(/\[\[([^\]]+)\]\]/g, (match, inner) => {
      const idx = switchBlocks.length;
      switchBlocks.push(inner);
      return `UCXSW${idx}Y`;
    });
    let formatted = formatSegments(work, wordColors, underlineTokens);
    let switchIndex = 0;
    formatted = formatted.replace(/UCXSW(\d+)Y/g, (match, idxStr) => {
      const innerHtml = formatSwitchInner(switchBlocks[Number(idxStr)] || "", wordColors, underlineTokens);
      const bgColor = switchIndex % 2 === 0 ? "rgba(0, 255, 255, 0.4)" : "rgba(255, 0, 0, 0.4)";
      switchIndex++;
      return `<span style="background-color:${bgColor};">${innerHtml}</span>`;
    });
    formatted = formatted.replace(/UCSK(\d+)Z/g, (m, idx) => escapeHtml(skipData.skipped[Number(idx)] || ""));
    return formatted;
  }

  // packages/patch-maker/styles.js
  var PATCH_MAKER_CSS = `
html, body { overflow-x: hidden !important; }

#uc-patch-overlay {
  min-height: 100vh;
  max-width: 100vw;
  overflow-y: visible !important;
  overflow-x: visible !important;
}
#uc-patch-overlay > div { overflow-x: visible !important; }

#uc-patch-overlay li.buff   { border-left: 3px solid #00c800; }
#uc-patch-overlay li.rework { border-left: 3px solid gold; }
#uc-patch-overlay li.nerf   { border-left: 3px solid red; }
#uc-patch-overlay li.other  { border-left: 3px solid gray; }
#uc-patch-overlay li.none   { border-left: none !important; }

#uc-patch-overlay.editor-mode p  { background-color: rgba(255, 255, 0, 0.10); }
#uc-patch-overlay.editor-mode li { background-color: rgba(173,216,230,0.12); }

#uc-patch-overlay li {
  padding-left: 5px;
  border-radius: 3px;
  position: relative;
  margin: 10px 0;
  list-style-type: disc;
  font-size: 14px;
}

#uc-patch-overlay ul {
  margin-top: 0;
  margin-bottom: 10px;
  padding-left: 40px;
  list-style-position: outside;
}

#uc-patch-overlay p { position: relative; font-size: 14px; }

#uc-patch-overlay .uc-li-text:focus { outline: none; }
#uc-patch-overlay li:focus-within {
  outline: 2px solid white;
  outline-offset: 3px;
  border-radius: 4px;
}

#uc-patch-overlay .uc-collapse-btn {
  position: absolute;
  right: -38px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  background-color: #0099cc;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  opacity: 0.9;
}

#uc-patch-overlay .uc-section-del {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 3px;
  color: white;
  cursor: pointer;
  opacity: 0.9;
  right: -64px;
  background-color: #e74c3c;
}

#uc-patch-overlay .uc-section-label:focus {
  outline: 2px solid white;
  outline-offset: 2px;
}

#uc-patch-overlay .uc-add-section-row {
  margin: 0 0 10px 0;
  background-color: rgba(255, 255, 0, 0.10);
  padding: 0 6px;
  border-radius: 3px;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 24px;
}

#uc-patch-overlay .uc-add-section-btn {
  width: 20px;
  height: 20px;
  line-height: 20px;
  padding: 0;
  background-color: #2ecc71;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  text-align: center;
  font-size: 14px;
  font-weight: bold;
}

#uc-patch-overlay .uc-card-section {
  margin: 8px 0 28px 0;
}

#uc-patch-overlay .uc-card-toolbar {
  display: none;
}

#uc-patch-overlay .uc-card-add-tile {
  width: 176px;
  height: 246px;
  background-color: rgba(255, 255, 0, 0.10);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 3px;
  display: flex;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
  flex: 0 0 auto;
}

#uc-patch-overlay .uc-card-add-btn {
  width: 20px;
  height: 20px;
  line-height: 20px;
  padding: 0;
  background-color: #2ecc71;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  text-align: center;
  font-size: 14px;
  font-weight: bold;
}

#uc-patch-overlay .uc-card-gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: flex-start;
  min-height: 246px;
}

#uc-patch-overlay .uc-card-item {
  position: relative;
  display: inline-block;
  outline: none;
}

#uc-patch-overlay .uc-card-item:focus {
  outline: 2px solid white;
  outline-offset: 3px;
}

#uc-patch-overlay .uc-card-frame {
  width: 176px;
  height: 246px;
  overflow: hidden;
  background: #000;
}

#uc-patch-overlay .uc-card-frame img {
  width: 176px;
  height: 246px;
  display: block;
  image-rendering: auto;
}

#uc-patch-overlay .uc-card-del {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  line-height: 20px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background-color: #e74c3c;
  color: white;
  cursor: pointer;
  text-align: center;
  opacity: 0.95;
}

#uc-patch-overlay .uc-li-add,
#uc-patch-overlay .uc-li-del {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 3px;
  color: white;
  cursor: pointer;
  text-align: center;
  opacity: 0.9;
}

#uc-patch-overlay .uc-li-add { right: -38px; background-color: #2ecc71; }
#uc-patch-overlay .uc-li-del { right: -64px; background-color: #e74c3c; }
#uc-patch-overlay .uc-li-del:disabled {
  background-color: #777;
  opacity: 0.4;
  cursor: not-allowed;
}

#uc-patch-overlay.viewer-mode .uc-li-add,
#uc-patch-overlay.viewer-mode .uc-li-del,
#uc-patch-overlay.viewer-mode .uc-collapse-btn,
#uc-patch-overlay.viewer-mode .uc-section-del,
#uc-patch-overlay.viewer-mode .uc-add-section-row,
#uc-patch-overlay.viewer-mode .uc-card-toolbar,
#uc-patch-overlay.viewer-mode .uc-card-del,
#uc-patch-overlay.viewer-mode .uc-card-add-tile,
#uc-patch-overlay.viewer-mode .uc-card-add-btn {
  display: none !important;
}
#uc-patch-overlay.viewer-mode p,
#uc-patch-overlay.viewer-mode li {
  background-color: transparent !important;
}

.uc-skip { all: unset; }
`;
  function injectPatchMakerStyle() {
    if (document.getElementById("uc-patch-maker-style")) return;
    const style = document.createElement("style");
    style.id = "uc-patch-maker-style";
    style.textContent = PATCH_MAKER_CSS;
    document.head.appendChild(style);
  }

  // packages/core/card-data.js
  var KEYWORD_IDS = [
    "determination",
    "charge",
    "haste",
    "armor",
    "disarmed",
    "candy",
    "support",
    "transparency",
    "invulnerable",
    "taunt",
    "dodge",
    "shock",
    "loop",
    "bullseye",
    "wanted",
    "darkspawn",
    "magic",
    "dust",
    "turn-start",
    "turn-end",
    "fatigue",
    "turbo",
    "paralyze",
    "silence",
    "synergy",
    "delay",
    "generated",
    "need",
    "program",
    "erase",
    "switch",
    "catch"
  ];
  var TRIBE_IDS = [
    "tem",
    "dog",
    "amalgamate",
    "g-follower",
    "lost-soul",
    "frog",
    "mold",
    "snail",
    "bomb",
    "plant",
    "royal-guard",
    "all-monster-tribes",
    "chaos-weapon",
    "piece",
    "arachnid",
    "royal-invention",
    "plug",
    "thrashing-part",
    "bargain",
    "dance",
    "giga-attack",
    "round",
    "pack"
  ];
  var SOUL_IDS = ["determination", "patience", "bravery", "integrity", "perseverance", "kindness", "justice"];
  var RARITY_IDS = ["base", "common", "rare", "epic", "legendary", "token"];
  var STAT_IDS = ["gold", "cost", "atk", "hp", "dmg"];
  var FALLBACK_KEYWORDS = [
    "Determination",
    "Charge",
    "Haste",
    "Armor",
    "Disarmed",
    "Candy",
    "Support",
    "Transparency",
    "Invulnerable",
    "Taunt",
    "Dodge",
    "Shock",
    "Loop",
    "Bullseye",
    "Wanted",
    "Darkspawn",
    "Magic",
    "Dust",
    "Turn start",
    "Turn end",
    "Fatigue",
    "Turbo",
    "Paralyze",
    "Silence",
    "Synergy",
    "Delay",
    "Generated",
    "Need",
    "Program",
    "Erase",
    "Switch",
    "Catch"
  ];
  var FALLBACK_TRIBES = [
    "Tem",
    "Dog",
    "Amalgamate",
    "G Follower",
    "Lost Soul",
    "Frog",
    "Mold",
    "Snail",
    "Bomb",
    "Plant",
    "Royal Guard",
    "All monster tribes",
    "Chaos Weapon",
    "Piece",
    "Arachnid",
    "Royal Invention",
    "Plug",
    "Thrashing Part",
    "Bargain",
    "Dance",
    "Giga Attack",
    "Round",
    "Pack",
    "Tems",
    "Dogs",
    "Amalgamates",
    "G Followers",
    "Lost Souls",
    "Frogs",
    "Molds",
    "Snails",
    "Bombs",
    "Plants",
    "Royal Guards",
    "Chaos Weapons",
    "Pieces",
    "Arachnids",
    "Royal Inventions",
    "Plugs",
    "Thrashing Parts",
    "Bargains",
    "Dances",
    "Giga Attacks",
    "Rounds",
    "Packs"
  ];
  var LANGUAGE_LABEL_TO_CODE = {
    "Auto / Default": "auto",
    "English": "en",
    "French": "fr",
    "Spanish": "es",
    "Portuguese": "pt",
    "Chinese": "cn",
    "Italian": "it",
    "Polish": "pl",
    "German": "de",
    "Russian": "ru"
  };
  var loadedLanguages = /* @__PURE__ */ new Set();
  function cleanText(str) {
    return str ? str.replace(/\s+/g, " ").trim() : "";
  }
  function decodeHtml(input) {
    if (!input) return "";
    try {
      const e = document.createElement("div");
      e.innerHTML = input;
      return e.childNodes.length === 0 ? "" : e.textContent.trim();
    } catch {
      return String(input).trim();
    }
  }
  function getI18n() {
    const pageWindow2 = getPageWindow();
    return pageWindow2.$ && pageWindow2.$.i18n ? pageWindow2.$.i18n : null;
  }
  function getTranslateVersion() {
    const pageWindow2 = getPageWindow();
    return typeof pageWindow2.translateVersion !== "undefined" ? pageWindow2.translateVersion : "";
  }
  function getResolvedLanguage(selectedLabel) {
    const mapped = LANGUAGE_LABEL_TO_CODE[selectedLabel] || "auto";
    if (mapped !== "auto") return mapped;
    try {
      const stored = localStorage.getItem("language");
      if (stored) return stored;
    } catch {
    }
    return "en";
  }
  async function ensureLanguageLoaded(lang) {
    if (!lang || lang === "en" || loadedLanguages.has(lang)) return;
    const i18n = getI18n();
    if (!i18n) return;
    const version = getTranslateVersion();
    const path = `/translation/${lang}.json${version ? "?v=" + version : ""}`;
    await new Promise((resolve, reject) => {
      const deferred = i18n().load({ [lang]: path });
      if (deferred && typeof deferred.done === "function") {
        deferred.done(resolve);
        if (typeof deferred.fail === "function") deferred.fail(reject);
      } else {
        resolve();
      }
    });
    loadedLanguages.add(lang);
  }
  function getLocalizedString(key, ...args) {
    const i18n = getI18n();
    if (!i18n) return "";
    try {
      const value = i18n.apply(i18n, [key, ...args]);
      return !value || value === key ? "" : String(value).trim();
    } catch {
      return "";
    }
  }
  async function buildLocalizedFormattingData(selectedLanguageLabel, baseWordColors) {
    const lang = getResolvedLanguage(selectedLanguageLabel);
    const i18n = getI18n();
    const tokens = FALLBACK_KEYWORDS.concat(FALLBACK_TRIBES);
    const localizedColors = {};
    if (!i18n) {
      return { tokens: [...new Set(tokens)].filter(Boolean).sort((a, b) => b.length - a.length), localizedColors };
    }
    const originalLocale = i18n().locale;
    try {
      await ensureLanguageLoaded(lang);
      i18n().locale = lang;
      KEYWORD_IDS.forEach((id) => {
        const text = getLocalizedString(`kw-${id}`);
        if (text) tokens.push(text);
      });
      TRIBE_IDS.forEach((id) => {
        const singular = getLocalizedString(`tribe-${id}`, 1);
        const plural = getLocalizedString(`tribe-${id}`, 2);
        if (singular) tokens.push(singular);
        if (plural) tokens.push(plural);
      });
      const addColorEntry = (id, colorKey) => {
        const translated = getLocalizedString(colorKey === "stat" ? `stat-${id}` : `${colorKey}-${id}`, 1);
        if (!translated) return;
        const clean = cleanText(decodeHtml(translated));
        const color = baseWordColors[id.toUpperCase()] || (id === "gold" ? baseWordColors.G : void 0);
        if (clean && color) {
          localizedColors[clean] = color;
          localizedColors[clean.toUpperCase()] = color;
        }
      };
      SOUL_IDS.forEach((id) => addColorEntry(id, "soul"));
      RARITY_IDS.forEach((id) => addColorEntry(id, "rarity"));
      STAT_IDS.forEach((id) => addColorEntry(id, "stat"));
      const krText = getLocalizedString("status-kr");
      if (krText) {
        const clean = cleanText(decodeHtml(krText));
        if (clean) {
          localizedColors[clean] = baseWordColors.KR;
          localizedColors[clean.toUpperCase()] = baseWordColors.KR;
        }
      }
    } finally {
      try {
        i18n().locale = originalLocale;
      } catch {
      }
    }
    return {
      tokens: [...new Set(tokens)].filter(Boolean).sort((a, b) => b.length - a.length),
      localizedColors
    };
  }
  function getAllCards() {
    const pageWindow2 = getPageWindow();
    const candidates = [pageWindow2.allCards, pageWindow2.cards, pageWindow2.cardList, pageWindow2.ucCards];
    for (const c of candidates) {
      if (Array.isArray(c) && c.length) return c;
    }
    return [];
  }
  function addNameMapping(map, name, id) {
    const clean = cleanText(decodeHtml(name));
    if (clean && id) map.set(clean.toLowerCase(), id);
  }
  async function buildLocalizedCardNameMap(selectedLanguageLabel, attempt = 0) {
    const lang = getResolvedLanguage(selectedLanguageLabel);
    const i18n = getI18n();
    const cards = getAllCards();
    if (!cards.length && attempt < 40) {
      await new Promise((r) => setTimeout(r, 250));
      return buildLocalizedCardNameMap(selectedLanguageLabel, attempt + 1);
    }
    const map = /* @__PURE__ */ new Map();
    if (!cards.length) return map;
    const originalLocale = i18n ? i18n().locale : null;
    try {
      if (i18n) {
        await ensureLanguageLoaded(lang);
        i18n().locale = lang;
      }
      cards.forEach((card) => {
        if (!card || !card.id) return;
        if (card.name) {
          addNameMapping(map, card.name, card.id);
          const englishPlural = getLocalizedString(`card-name-${card.id}`, 2);
          if (englishPlural) addNameMapping(map, englishPlural, card.id);
        }
        if (i18n) {
          const singular = getLocalizedString(`card-name-${card.id}`, 1);
          const plural = getLocalizedString(`card-name-${card.id}`, 2);
          if (singular) addNameMapping(map, singular, card.id);
          if (plural) addNameMapping(map, plural, card.id);
        }
      });
    } finally {
      if (i18n && originalLocale) {
        try {
          i18n().locale = originalLocale;
        } catch {
        }
      }
    }
    return map;
  }
  function getCardIdByExactGameLookup(name) {
    const pageWindow2 = getPageWindow();
    const getCardWithName = pageWindow2.getCardWithName;
    if (typeof getCardWithName !== "function") return null;
    try {
      const card = getCardWithName(name);
      return card && card.id ? card.id : null;
    } catch {
      return null;
    }
  }
  function resolveCardId(name, cardNameMap) {
    if (!cardNameMap) return null;
    return cardNameMap.get(String(name).toLowerCase()) || null;
  }
  function attachCardHover(el, cardId) {
    const pageWindow2 = getPageWindow();
    const displayCardHelp = pageWindow2.displayCardHelp;
    const removeCardHover = pageWindow2.removeCardHover;
    if (typeof displayCardHelp !== "function" || typeof removeCardHover !== "function") {
      return false;
    }
    el.dataset.ucHoverBound = "true";
    el.style.cursor = "pointer";
    el.addEventListener("mouseover", function() {
      displayCardHelp(this, cardId);
    });
    el.addEventListener("mouseleave", function() {
      removeCardHover();
    });
    return true;
  }

  // packages/patch-maker/overlay.js
  var STATE_KEY = "wizascript.patchmaker.state.v1";
  var cycleOrder = ["none", "other", "buff", "rework", "nerf"];
  var DEFAULT_SECTIONS = [
    "Balancing (Monsters)",
    "Balancing (Spells)",
    "Balancing (Artifacts)",
    "Balancing (Board Slots)",
    "Balancing (Souls)",
    "Balancing (Other)"
  ];
  var DEFAULT_OPEN_SECTIONS = /* @__PURE__ */ new Set([
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
  function createPatchMakerOverlay({
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
    const register = (config) => registerKeybind(plugin, { ...config, packageLabel: "Patch Maker", guardTypingContext: false });
    register({
      key: "cycleCategoryUp",
      // Shortened from "Cycle Entry Category Up" - combined with the
      // registry's own "- Primary + <key>" suffix (packages/core/
      // keybinds.js), the full name was wide enough to force a horizontal
      // scrollbar in the settings dialog. "Entry" was the only word doing
      // no real work here (Patch Maker doesn't have any OTHER kind of
      // category to cycle).
      name: "Cycle Category Up",
      defaultCode: "Comma",
      scope: "scoped",
      selector: ".uc-li-text",
      onMatch: () => {
        const li = document.activeElement.closest("li");
        if (li) cycleCategory(li, -1);
      }
    });
    register({
      key: "cycleCategoryDown",
      name: "Cycle Category Down",
      defaultCode: "Period",
      scope: "scoped",
      selector: ".uc-li-text",
      onMatch: () => {
        const li = document.activeElement.closest("li");
        if (li) cycleCategory(li, 1);
      }
    });
    register({
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
    register({
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
    register({
      key: "moveSectionUp",
      // Shortened from "Move Balance Section Up" to match the identically-
      // renamed controller-package action of the same key (packages/
      // controller/settings.js) - both drove the same horizontal-scroll
      // issue via their shared "- Primary + <key/button>" suffix, and
      // keeping the two names in sync avoids the keyboard and controller
      // versions of the same action reading differently in their
      // respective settings categories.
      name: "Move Section Up",
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
    register({
      key: "moveSectionDown",
      name: "Move Section Down",
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
    register({
      key: "moveCardUp",
      name: "Move Card Up",
      defaultCode: "ArrowUp",
      scope: "scoped",
      selector: ".uc-card-item",
      onMatch: () => newCards.moveCardItem(document.activeElement, -1)
    });
    register({
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
        position: "fixed",
        left: "10px",
        bottom: "10px",
        padding: "8px 12px",
        background: "#333",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        zIndex: "99999"
      });
      Object.assign(modeToggle.style, {
        position: "fixed",
        left: "10px",
        bottom: "50px",
        padding: "8px 12px",
        background: "#333",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        zIndex: "99999",
        fontSize: "14px",
        display: "none"
      });
      Object.assign(resetBtn.style, {
        position: "fixed",
        left: "10px",
        bottom: "90px",
        padding: "8px 12px",
        background: "#aa3333",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        zIndex: "99999",
        fontSize: "14px",
        display: "none"
      });
      Object.assign(helpBtn.style, {
        position: "fixed",
        left: "130px",
        bottom: "90px",
        padding: "8px 12px",
        background: "#3366cc",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        zIndex: "99999",
        fontSize: "14px",
        display: "none"
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
        const pageWindow2 = getPageWindow();
        const BootstrapDialogRef = pageWindow2.BootstrapDialog;
        if (BootstrapDialogRef && typeof BootstrapDialogRef.alert === "function") {
          BootstrapDialogRef.alert({ title: "Custom Patch Maker \u2013 Help", message, closable: true });
        } else {
          alert(message.replace(/<[^>]+>/g, ""));
        }
      };
    }
    return { init, setControlsHidden };
  }

  // packages/core/debug-logger.js
  function createLogger(featureName, initialCategories = {}) {
    const enabled = { ...initialCategories };
    function tag(category) {
      return category ? `[${featureName}:${category}]` : `[${featureName}]`;
    }
    function isEnabled(category) {
      return !category || enabled[category] !== false;
    }
    return {
      setCategory(category, isEnabled2) {
        enabled[category] = isEnabled2;
      },
      log(category, ...args) {
        if (!isEnabled(category)) return;
        console.log(tag(category), ...args);
      },
      warn(category, ...args) {
        if (!isEnabled(category)) return;
        console.warn(tag(category), ...args);
      },
      error(category, ...args) {
        console.error(tag(category), ...args);
      }
    };
  }

  // packages/core/page-match.js
  function normalizePath(pathname) {
    const lower = pathname.toLowerCase();
    return lower.length > 1 && lower.endsWith("/") ? lower.slice(0, -1) : lower;
  }
  function matchesPage(rules, pathname = location.pathname) {
    const path = normalizePath(pathname);
    const list = Array.isArray(rules) ? rules : [rules];
    return list.some(
      (rule) => typeof rule === "string" ? path === normalizePath(rule) : path.startsWith(rule.prefix.toLowerCase())
    );
  }

  // packages/patch-maker/index.js
  var FEATURE_VERSION = "0.1.0";
  function waitForMainContent(callback) {
    const existing = document.querySelector(".mainContent");
    if (existing) return callback(existing);
    setTimeout(() => waitForMainContent(callback), 50);
  }
  function isPatchNotesPage() {
    return matchesPage("/gameUpdates.jsp");
  }
  function initPatchMaker(plugin) {
    const settings2 = registerPatchMakerSettings(plugin);
    const logger = createLogger("PatchMaker");
    const originalWarn = logger.warn.bind(logger);
    const originalLog = logger.log.bind(logger);
    logger.log = (...args) => {
      if (settings2.debugLogging.value()) originalLog(...args);
    };
    logger.warn = (...args) => {
      if (settings2.debugLogging.value()) originalWarn(...args);
    };
    let wordColors = { ...BASE_WORD_COLORS };
    let underlineTokens = [];
    let cardNameMap = /* @__PURE__ */ new Map();
    const overlay = createPatchMakerOverlay({
      plugin,
      logger,
      version: FEATURE_VERSION,
      getWordColors: () => wordColors,
      getUnderlineTokens: () => underlineTokens,
      getCardHoversEnabled: () => settings2.cardHovers.value(),
      getCardNameMap: () => cardNameMap,
      getHideControlsEnabled: () => settings2.hideControls.value(),
      getOpenOnLoad: () => settings2.openOnLoad.value()
    });
    settings2.hideControls.on((value) => overlay.setControlsHidden(value));
    if (!settings2.enabled.value()) return;
    if (!isPatchNotesPage()) return;
    async function refreshLocalizedData() {
      const languageLabel = settings2.language.value();
      const { tokens, localizedColors } = await buildLocalizedFormattingData(languageLabel, BASE_WORD_COLORS);
      underlineTokens = tokens;
      wordColors = { ...BASE_WORD_COLORS, ...localizedColors };
      cardNameMap = await buildLocalizedCardNameMap(languageLabel);
    }
    waitForMainContent((mainEl) => {
      overlay.init(mainEl);
      refreshLocalizedData().catch((e) => logger.error("init", "Failed to load localized data", e));
    });
  }

  // packages/true-hub-bridge/settings.js
  function registerTrueHubBridgeSettings(plugin) {
    const settings2 = createFeatureSettings(plugin, "truehubbridge", "True Hub Bridge");
    return {
      settings: settings2,
      // Master toggle - lets the whole feature be turned off from within
      // Wizascript's settings, per the "one plugin, categories as boxes"
      // model the rest of the suite follows.
      enabled: settings2.add("enabled", {
        name: "Enable True Hub Bridge",
        type: "boolean",
        default: true
      }),
      // The original script had no debug-logging toggle at all (just
      // always-on console.log calls) - added here for consistency with
      // patch-maker, using the same working per-feature debug logger.
      debugLogging: settings2.add("debugLogging", {
        name: "Enable debug logging",
        type: "boolean",
        default: false
      }),
      autoOpen: settings2.add("autoOpenTrueHub", {
        name: "Auto Open True Hub",
        type: "boolean",
        default: true
      }),
      scrollPaging: settings2.add("enableScrollPaging", {
        name: "Enable Scroll Paging",
        type: "boolean",
        default: true
      })
    };
  }

  // packages/true-hub-bridge/channel-overrides.js
  var CHANNEL_OVERRIDES = {
    // Totem
    "Totem": "Totem",
    // Powerhouse
    "phouse": "Powerhouse",
    "powerhouse": "Powerhouse",
    "ph": "Powerhouse",
    // Soulless Kris
    "skris": "Soulless_Kris",
    // Overgrowth
    "og": "Overgrowth",
    "overgrowth": "Overgrowth",
    // Traffic Lights
    "light": "Traffic_Light",
    "lights": "Traffic_Light",
    // Ball Dancer
    "balldancer": "Ball_Dancer",
    // Royal Papyrus
    "rpaps": "Royal_Papyrus",
    "royal-paps": "Royal_Papyrus",
    "royal-p": "Royal_Papyrus",
    // Tsunderplane
    "plane": "Tsunderplane",
    "tsunder": "Tsunderplane",
    // Lab Sign
    "lab-sign": "Lab_Sign",
    // Great Door
    "door": "Great_Door",
    // Librarian
    "librarian": "Librarian",
    "lib": "Librarian",
    // Mad Dragon
    "obama": "Mad_Dragon",
    // Ponman Statue
    "pieces": "Ponman_Statue",
    // Mercenary Hire
    "merc-hire": "Mercenary_Hire",
    "merchire": "Mercenary_Hire",
    // Kris
    "kris": "Kris",
    // Caged Jester
    "cjester": "Caged_Jester",
    "cj": "Caged_Jester",
    "caged-jester": "Caged_Jester",
    "jester": "Caged_Jester",
    "jailed-clown": "Caged_Jester",
    // Maus Cage
    "mauscage": "Maus_Cage",
    "maus-cage": "Maus_Cage",
    "cage": "Maus_Cage",
    // Maus
    "maus": "Maus",
    "rat": "Maus",
    "maice": "Maus",
    // Politician Bear
    "pol-bear": "Politician_Bear",
    "politician-bear": "Politician_Bear",
    // Teacher Alphys
    "talph": "Teacher_Alphys",
    "talphys": "Teacher_Alphys",
    "talphy": "Teacher_Alphys",
    // Giga Queen
    "gq": "GIGA_Queen",
    "giga-queen": "GIGA_Queen",
    "giga": "GIGA_Queen",
    // Forest Worm
    "forest-worm": "Forest_Worm",
    "fworm": "Forest_Worm",
    // Large Chest
    "large-chest": "Large_Chest",
    // Big Bomb
    "big-bomb": "Big_Bomb",
    // Instant Noodles
    "instant-noodles": "Instant_Noodles",
    "noodle": "Instant_Noodles",
    "noodles": "Instant_Noodles",
    // Green Flower
    "green-flower": "Green_Flower",
    "g-flower": "Green_Flower",
    // So Sorry
    "so-sorry": "So_Sorry",
    "sorry": "So_Sorry",
    // Ultimathrash
    "ultimathrash": "Ultimathrash",
    "ultima-thrash": "Ultimathrash",
    "ultima": "Ultimathrash",
    // Thrashing Machine
    "collection": "Thrashing_M",
    "t-machine": "Thrashing_M",
    "thrashing": "Thrashing_M",
    // Clover
    "clover": "Clover",
    // Ball Person
    "ball": "Ball_Person",
    // Ambyu-Lance
    "maso": "Ambyu-Lance",
    // Gemstone
    "gems": "Gemstone",
    "gem": "Gemstone",
    // Fortune Teller
    "fortune-teller": "Fortune_Teller",
    "fteller": "Fortune_Teller",
    "f-teller": "Fortune_Teller",
    // Pile of Dust
    "pile-of-dust": "Pile_of_Dust",
    "pod": "Pile_of_Dust",
    // Migospel
    "migospel": "Migospel",
    // Nice Cream Guy
    "nice-cream-guy": "Nice_Cream_Guy",
    "ncg": "Nice_Cream_Guy",
    // Omega Flowey
    "omega-flowey": "Omega_Flowey",
    "of": "Omega_Flowey",
    // Cyberdly
    "cyberdly": "Cyberdly",
    // Berdly Statue
    "berdly-statue": "Berdly_Statue",
    "statue": "Berdly_Statue",
    // Zenith Martlet
    "zenith-martlet": "Zenith_Martlet",
    "zenith": "Zenith_Martlet",
    "zmart": "Zenith_Martlet",
    "zartlet": "Zenith_Martlet",
    // Chujin Tombstone
    "chujin-tombstone": "Chujin_Tombstone",
    "chutomb": "Chujin_Tombstone",
    "chtomb": "Chujin_Tombstone",
    // Top Chef
    "top-chef": "Top_Chef",
    // Clam Girl
    "clam-girl": "Clam_Girl",
    "clamgirl": "Clam_Girl",
    // C-Round
    "c-round": "C-Round",
    // Bookshelf
    "bookshelf": "Bookshelf",
    "shelf": "Bookshelf",
    // Giga Froggit
    "giga-froggit": "Giga_Froggit",
    // Snoring Monsters
    "snoring-monster": "Snoring_Monsters",
    "snoring": "Snoring_Monsters",
    // The Original
    "first-starwalker": "The_Original",
    "f-walker": "The_Original",
    "fwalker": "The_Original",
    "fwakler": "The_Original",
    // Knight's Shield
    "knight's-shield": "Knights_Shield",
    "knights-shield": "Knights_Shield",
    // Bounty
    "bounty": "Bounty",
    // Temmie Egg
    "temmie-egg": "Temmie_Egg",
    "egg": "Temmie_Egg",
    // Sandstorm
    "sandstorm": "Sandstorm",
    // Oasis
    "oasis": "Oasis",
    // Feast
    "feast": "Feast",
    // Frostermit
    "frostermit": "Frostermit",
    // Hyperlinks
    "hlb": "Hyperlink_Blocked",
    "hyperlink": "Hyperlink_Blocked",
    // Spider
    "spider": "Spider",
    // Red Flower
    "seedlings": "Red_Flower",
    "seedling": "Red_Flower",
    // Casual Undyne
    "casual-undyne": "Casual_Undyne",
    "casdyne": "Casual_Undyne",
    // Mines
    "mines": "Mine",
    "mine": "Mine",
    // Coffin
    "coffin": "Coffin",
    // Berdly
    "berdly": "Berdly",
    // Contamination
    "contamination": "Contamination",
    "contam": "Contamination",
    // Shambling Mass
    "shambling-mass": "Shambling_Mass",
    "shambles": "Shambling_Mass",
    "shamble": "Shambling_Mass",
    // Moldsmal
    "moldsmal": "Moldsmal",
    "mold": "Moldsmal",
    // Cyber Trash
    "cyber-trash": "Cyber_Trash",
    "ctrash": "Cyber_Trash",
    "trash": "Cyber_Trash",
    // Bryan
    "bryan": "Bryan",
    // Gift
    "gift": "Gift",
    // Cactus
    "cactus": "Cactus",
    // Abstract Art
    "abstract-art": "Abstract_Art",
    "abs-art": "Abstract_Art",
    "absart": "Abstract_Art",
    // Seam
    "seam": "Seam",
    // Pipis
    "pipis": "Pipis",
    // Assault
    "assault": "Assault",
    // Angie
    "angie": "Angie",
    // Werewerewire
    "werewerewire": "Werewerewire",
    "plug": "Werewerewire",
    // Gerson Tombstone
    "gerson-tombstone": "Gerson_Tombstone",
    "gertomb": "Gerson_Tombstone",
    // Ceroba Ketsukane
    "ceroba-ketsukane": "Ceroba_Ketsukane",
    "ketsukane": "Ceroba_Ketsukane",
    "ketsu": "Ceroba_Ketsukane",
    // Tasque Singer
    "tasque-singer": "Tasque_Singer",
    "singer": "Tasque_Singer",
    // Cyber Balloon
    "cyber-balloon": "Cyber_Balloon",
    "balloon": "Cyber_Balloon",
    // Burning Snail
    "burning-snail": "Burning_Snail",
    "snail": "Burning_Snail",
    // Tnt Man
    "tnt-man": "TNT_Man",
    "tnt": "TNT_Man",
    // Gardener Asgore
    "gardener-asgore": "Gardener_Asgore",
    "gardengore": "Gardener_Asgore",
    "garden": "Gardener_Asgore",
    // Jigsawry
    "jigsawry": "Jigsawry",
    "jig": "Jigsawry",
    // Pillar
    "pillar": "Pillar",
    // Library Loox
    "library-loox": "Library_Loox",
    "lib-loox": "Library_Loox",
    "libloox": "Library_Loox",
    // Overlord Migosp
    "overlord-migosp": "Overlord_Migosp",
    "overlord": "Overlord_Migosp",
    // Angel of Death
    "angel-of-death": "Angel_of_Death",
    "aod": "Angel_of_Death",
    // Shield
    "soliditdy": "Shield",
    // The Barrier
    "barrier": "The_Barrier",
    // Undyne
    "undyne": "Undyne",
    // Eye
    "Amalgamate": "Eye",
    // Devil Doll
    "devil-doll": "Devil_Doll",
    // Icemeter
    "icemeter": "Icemeter",
    // Dalv's Wardrobe
    "dalvs-wardrobe": "Dalvs_Wardrobe",
    "wardrobe": "Dalvs_Wardrobe",
    // Defrosting
    "defrosting": "Defrosting",
    // Memory Keeper
    "memory-keeper": "Memory_Keeper",
    "meme-keeper": "Memory_Keeper",
    "keeper": "Memory_Keeper",
    // Ribbick
    "ribbick": "Ribbick",
    // Rockstar Kris
    "rockstar-kris": "Rockstar_Kris",
    // Mo
    "mo": "Mo",
    // Gacha Ball
    "gachapon": "Gacha_Ball",
    // Arcade Machine
    "arcade-machine": "Arcade_Machine",
    "arc-mac": "Arcade_Machine",
    "arcmac": "Arcade_Machine",
    // White Cloak
    "white-cloak": "White_Cloak",
    "cloak": "White_Cloak",
    // Whimsalot
    "whimsalot": "Whimsalot",
    "whimsa": "Whimsalot",
    // Rockstar Ralsei
    "rockstar-ralsei": "Rockstar_Ralsei",
    // Royal Loox
    "royal-loox": "Royal_Loox",
    "rloox": "Royal_Loox",
    // Titan Fuzzy
    "titan-fuzzy": "Titan_Fuzzy",
    "fuzzy": "Titan_Fuzzy",
    // Titan
    "titan": "Titan",
    // Shrine Mascot
    "shrine-mascot": "Deflated_Mascot",
    "mascot": "Deflated_Mascot",
    // Pumpkin Head
    "jackenstein": "Pumpkin_Head",
    "dark-zone": "Pumpkin_Head",
    "darkzone": "Pumpkin_Head",
    // Food Enjoyer
    "food-enjoyer": "Food_Enjoyer",
    // Wicabel
    "wicabel": "Wicabel",
    "wica": "Wicabel",
    // Gaster Blaster
    "gaster-blaster": "Gaster_Blaster",
    "science": "Gaster_Blaster",
    // Fire Chimney
    "fire-chimney": "Fire_Chimney",
    "chimney": "Fire_Chimney"
  };
  var ORDERED_CHANNEL_OVERRIDES = Object.entries(CHANNEL_OVERRIDES).sort(([a], [b]) => b.length - a.length);

  // packages/true-hub-bridge/deck-filter.js
  function decodeDeck(deckCode) {
    try {
      return JSON.parse(atob(deckCode));
    } catch {
      return null;
    }
  }
  function getCardById(id) {
    const getCard = getPageWindow().getCard;
    if (typeof getCard !== "function") return null;
    try {
      return getCard(id);
    } catch {
      return null;
    }
  }
  function getArtifactById(id) {
    const getArtifact = getPageWindow().getArtifact;
    if (typeof getArtifact !== "function") return null;
    try {
      return getArtifact(id);
    } catch {
      return null;
    }
  }
  function getPlayableCards() {
    return getAllCards().filter((c) => c.rarity !== "STORY" && c.rarity !== "TOKEN");
  }
  function determineImageFromDeck(deckCode) {
    const decoded = decodeDeck(deckCode);
    if (!decoded || !decoded.cardIds) return null;
    const counts = /* @__PURE__ */ new Map();
    decoded.cardIds.forEach((cardId) => {
      const card = getCardById(cardId);
      if (!card || card.typeCard !== 0) return;
      counts.set(cardId, (counts.get(cardId) || 0) + 1);
    });
    let winner = null;
    let highestCount = 0;
    decoded.cardIds.forEach((cardId) => {
      const card = getCardById(cardId);
      if (!card || card.typeCard !== 0) return;
      const count = counts.get(cardId);
      if (count >= highestCount) {
        highestCount = count;
        winner = card;
      }
    });
    return (winner == null ? void 0 : winner.image) || null;
  }
  function isCardInList(list, id) {
    return list.some((c) => c.id === id);
  }
  function removeCardFromList(list, id) {
    const idx = list.findIndex((c) => c.id === id);
    if (idx !== -1) list.splice(idx, 1);
  }
  function addCardToFilter(targetList, otherList, card) {
    if (isCardInList(targetList, card.id)) return;
    removeCardFromList(otherList, card.id);
    targetList.push({ id: card.id, name: card.name });
  }
  function removeCardFromFilter(list, id) {
    removeCardFromList(list, id);
  }
  function filterDecks(allDecks, { activeSoulFilter, activeSearch = "", includeCards = [], excludeCards = [] } = {}) {
    const term = activeSearch.trim().toLowerCase();
    return allDecks.filter((deck) => {
      if (activeSoulFilter) {
        const decoded = decodeDeck(deck.deckCode);
        if (!decoded) return false;
        const soul = decoded.soul || decoded.classe;
        if (soul !== activeSoulFilter) return false;
      }
      if (term) {
        const name = (deck.channel || "").toLowerCase().replace(/-/g, " ");
        const author = (deck.author || "").toLowerCase();
        const season = (deck.season || "").toLowerCase();
        if (!name.includes(term) && !author.includes(term) && !season.includes(term)) {
          return false;
        }
      }
      if (includeCards.length > 0 || excludeCards.length > 0) {
        const decoded = decodeDeck(deck.deckCode);
        if (!decoded || !Array.isArray(decoded.cardIds)) return false;
        const idSet = new Set(decoded.cardIds);
        for (const c of includeCards) {
          if (!idSet.has(c.id)) return false;
        }
        for (const c of excludeCards) {
          if (idSet.has(c.id)) return false;
        }
      }
      return true;
    });
  }

  // packages/true-hub-bridge/overlay.js
  var DECKS_PER_PAGE = 10;
  var SOUL_COLORS = {
    DETERMINATION: "red",
    PATIENCE: "#41fcff",
    BRAVERY: "#fca500",
    INTEGRITY: "#0064ff",
    PERSEVERANCE: "#d535d9",
    KINDNESS: "#00c000",
    JUSTICE: "#ffff00"
  };
  function createTrueHubOverlay({ logger, getAutoOpen, getScrollPaging }) {
    let allDecks = [];
    let filteredDecks = [];
    let currentPage = 1;
    let mode = "classic";
    let includeCards = [];
    let excludeCards = [];
    let originalDecks = null;
    let template = null;
    let trueHubWrapper = null;
    let trueHubList = null;
    let trueHubNavEl = null;
    let selectPage = null, currentPageEl = null, maxPageEl = null, btnPrevious = null, btnNext = null;
    let ucNavRow = null;
    let classicState = null;
    let activeSoulFilter = null;
    let activeSearch = "";
    let cardFilterPanel = null, cardSearchInput = null, cardDropdown = null, cardTagsContainer = null;
    function setDecks(decks) {
      allDecks = Array.isArray(decks) ? decks : [];
      allDecks.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
      filteredDecks = [...allDecks];
      logger.log("data", "Decks loaded.", { count: allDecks.length });
    }
    function applyFilters2() {
      filteredDecks = filterDecks(allDecks, { activeSoulFilter, activeSearch, includeCards, excludeCards });
      currentPage = 1;
      renderPage();
    }
    function waitForHub(cb) {
      const check = () => {
        const hub = document.getElementById("hubDecks");
        const tmpl = hub == null ? void 0 : hub.querySelector(".hubDeck");
        if (hub && tmpl) cb(hub, tmpl);
        else setTimeout(check, 200);
      };
      check();
    }
    function buildCard(deck) {
      var _a, _b, _c, _d;
      const clone = template.cloneNode(true);
      const nameEl = clone.querySelector(".hubDeckName div");
      if (nameEl) {
        const decoded = decodeDeck(deck.deckCode);
        nameEl.textContent = (deck.channel || "Unknown").replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
        if ((decoded == null ? void 0 : decoded.soul) && SOUL_COLORS[decoded.soul]) {
          nameEl.style.color = SOUL_COLORS[decoded.soul];
        }
      }
      const ownerEl = clone.querySelector(".hubDeckOwner");
      if (ownerEl) {
        const img = ownerEl.querySelector("img");
        if (img) img.remove();
        ownerEl.textContent = deck.author || "Unknown";
        ownerEl.style.textAlign = "center";
      }
      const imageEl = clone.querySelector(".hubDeckImage img");
      if (imageEl) {
        const channel = (deck.channel || "").toLowerCase();
        let imageName = null;
        for (const [term, card] of ORDERED_CHANNEL_OVERRIDES) {
          if (channel.includes(term.toLowerCase())) {
            imageName = card;
            break;
          }
        }
        if (!imageName) imageName = determineImageFromDeck(deck.deckCode);
        if (imageName) imageEl.src = `images/cards/${imageName}.png`;
      }
      const artifactContainer = clone.querySelector(".hubDeckArtifacts");
      if (artifactContainer) {
        artifactContainer.innerHTML = "";
        try {
          const decoded = decodeDeck(deck.deckCode);
          const artifacts = ((decoded == null ? void 0 : decoded.artifactIds) || []).map((id) => getArtifactById(id)).filter(Boolean);
          artifacts.forEach((artifact, index) => {
            const img = document.createElement("img");
            img.src = `images/artifacts/${artifact.image}.png`;
            img.title = artifact.name;
            artifactContainer.appendChild(img);
            if (index < artifacts.length - 1) artifactContainer.append(" ");
          });
        } catch (err) {
          logger.error("card", "Artifact decode failed", err, deck);
        }
      }
      const archetypeEl = clone.querySelector(".hubDeckArchetype div");
      if (archetypeEl) archetypeEl.textContent = deck.season || "s??";
      const likesEl = clone.querySelector(".hubDeckLikes");
      if (likesEl) {
        const wins = (_b = (_a = deck.record) == null ? void 0 : _a.wins) != null ? _b : "-";
        likesEl.innerHTML = `<span style="color:#0dd000">${wins}</span>`;
      }
      const starEl = clone.querySelector(".hubDeckStar");
      if (starEl) {
        const losses = (_d = (_c = deck.record) == null ? void 0 : _c.losses) != null ? _d : "-";
        starEl.innerHTML = `<span style="color:#f0003c">${losses}</span>`;
      }
      const diffEl = clone.querySelector(".hubDeckDifficulty");
      if (diffEl) {
        diffEl.innerHTML = "";
        const btn = document.createElement("button");
        btn.textContent = "Info";
        Object.assign(btn.style, {
          background: "#7a0000",
          border: "1px solid #f0003c",
          color: "white",
          padding: "3px 8px",
          cursor: "pointer",
          opacity: "0.85"
        });
        btn.onclick = (e) => {
          e.stopPropagation();
          showInfo(deck);
        };
        diffEl.appendChild(btn);
      }
      const previewButton = clone.querySelector(".show-button");
      if (previewButton) {
        previewButton.removeAttribute("onclick");
        previewButton.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const code = deck.deckCode;
          const published = deck.publishedAt || (/* @__PURE__ */ new Date()).toISOString();
          const script = document.createElement("script");
          script.textContent = `
          try {
            if (typeof showDeckLoadHub === "function") {
              showDeckLoadHub(${JSON.stringify(code)}, ${JSON.stringify(published)});
            } else {
              console.error("[TrueHub] showDeckLoadHub unavailable.");
            }
          } catch (err) {
            console.error("[TrueHub] Preview failed:", err);
          }
        `;
          document.documentElement.appendChild(script);
          script.remove();
        };
      }
      return clone;
    }
    function renderPage() {
      trueHubList.innerHTML = "";
      const start = (currentPage - 1) * DECKS_PER_PAGE;
      const visible = filteredDecks.slice(start, start + DECKS_PER_PAGE);
      visible.forEach((deck) => trueHubList.appendChild(buildCard(deck)));
      syncNav();
    }
    function buildCardFilterPanel() {
      cardFilterPanel = document.createElement("div");
      cardFilterPanel.id = "th-card-filter-panel";
      Object.assign(cardFilterPanel.style, {
        display: "none",
        width: "100%",
        boxSizing: "border-box",
        margin: "0 0 6px 0",
        padding: "10px 12px",
        background: "#1a1a1a",
        border: "1px solid #444",
        borderRadius: "4px"
      });
      const searchRow = document.createElement("div");
      Object.assign(searchRow.style, { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" });
      cardSearchInput = document.createElement("input");
      cardSearchInput.type = "text";
      cardSearchInput.placeholder = "Search cards to filter...";
      cardSearchInput.className = "form-control";
      Object.assign(cardSearchInput.style, { width: "100%", boxSizing: "border-box", fontSize: "13px" });
      searchRow.appendChild(cardSearchInput);
      cardFilterPanel.appendChild(searchRow);
      cardDropdown = document.createElement("div");
      cardDropdown.id = "th-card-dropdown";
      Object.assign(cardDropdown.style, {
        background: "#222",
        border: "1px solid #555",
        borderRadius: "4px",
        maxHeight: "150px",
        overflowY: "auto",
        marginBottom: "8px",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "0"
      });
      cardDropdown.style.display = "none";
      cardFilterPanel.appendChild(cardDropdown);
      cardTagsContainer = document.createElement("div");
      cardTagsContainer.id = "th-card-tags";
      Object.assign(cardTagsContainer.style, { display: "flex", flexWrap: "wrap", gap: "6px", minHeight: "24px" });
      cardFilterPanel.appendChild(cardTagsContainer);
      cardSearchInput.addEventListener("input", () => {
        const term = cardSearchInput.value.trim().toLowerCase();
        if (!term) {
          cardDropdown.style.display = "none";
          cardDropdown.innerHTML = "";
          return;
        }
        const playable = getPlayableCards();
        const matches = playable.filter((c) => c.name && c.name.toLowerCase().includes(term)).slice(0, 30);
        cardDropdown.innerHTML = "";
        if (matches.length === 0) {
          cardDropdown.style.display = "none";
          return;
        }
        cardDropdown.style.display = "grid";
        matches.forEach((card) => {
          const row = document.createElement("div");
          Object.assign(row.style, {
            display: "flex",
            alignItems: "center",
            gap: "5px",
            padding: "4px 8px",
            fontSize: "12px",
            color: "#eee",
            borderBottom: "1px solid #2a2a2a",
            borderRight: "1px solid #2a2a2a",
            overflow: "hidden"
          });
          const inInclude = isCardInList(includeCards, card.id);
          const inExclude = isCardInList(excludeCards, card.id);
          const nameSpan = document.createElement("span");
          nameSpan.textContent = card.name;
          Object.assign(nameSpan.style, {
            flex: "1",
            minWidth: "0",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: inInclude ? "#4ade80" : inExclude ? "#f87171" : "#eee"
          });
          const btnGroup = document.createElement("div");
          Object.assign(btnGroup.style, { display: "flex", gap: "4px", flexShrink: "0" });
          const btnInclude = document.createElement("button");
          btnInclude.textContent = "+ Inc";
          Object.assign(btnInclude.style, {
            background: "#14532d",
            border: "1px solid #4ade80",
            color: "#4ade80",
            padding: "1px 5px",
            cursor: "pointer",
            fontSize: "10px",
            borderRadius: "3px",
            whiteSpace: "nowrap"
          });
          btnInclude.onclick = (e) => {
            e.stopPropagation();
            addCardToFilter(includeCards, excludeCards, card);
            applyFilters2();
            renderCardFilterTags();
            cardSearchInput.value = "";
            cardDropdown.style.display = "none";
            cardDropdown.innerHTML = "";
          };
          const btnExclude = document.createElement("button");
          btnExclude.textContent = "\u2212 Exc";
          Object.assign(btnExclude.style, {
            background: "#450a0a",
            border: "1px solid #f87171",
            color: "#f87171",
            padding: "1px 5px",
            cursor: "pointer",
            fontSize: "10px",
            borderRadius: "3px",
            whiteSpace: "nowrap"
          });
          btnExclude.onclick = (e) => {
            e.stopPropagation();
            addCardToFilter(excludeCards, includeCards, card);
            applyFilters2();
            renderCardFilterTags();
            cardSearchInput.value = "";
            cardDropdown.style.display = "none";
            cardDropdown.innerHTML = "";
          };
          btnGroup.appendChild(btnInclude);
          btnGroup.appendChild(btnExclude);
          row.appendChild(nameSpan);
          row.appendChild(btnGroup);
          cardDropdown.appendChild(row);
        });
      });
      document.addEventListener("click", (e) => {
        if (!cardFilterPanel.contains(e.target)) cardDropdown.style.display = "none";
      });
      return cardFilterPanel;
    }
    function renderCardFilterTags() {
      if (!cardTagsContainer) return;
      cardTagsContainer.innerHTML = "";
      const makeTag = (card, color, borderColor, list) => {
        const tag = document.createElement("span");
        Object.assign(tag.style, {
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          padding: "2px 8px",
          background: color,
          border: `1px solid ${borderColor}`,
          borderRadius: "3px",
          fontSize: "12px",
          color: "#fff",
          whiteSpace: "nowrap"
        });
        tag.textContent = card.name;
        const x = document.createElement("span");
        x.textContent = "\xD7";
        Object.assign(x.style, { cursor: "pointer", fontWeight: "bold", marginLeft: "2px", lineHeight: "1" });
        x.onclick = () => {
          removeCardFromFilter(list, card.id);
          applyFilters2();
          renderCardFilterTags();
        };
        tag.appendChild(x);
        return tag;
      };
      includeCards.forEach((c) => cardTagsContainer.appendChild(makeTag(c, "#14532d", "#4ade80", includeCards)));
      excludeCards.forEach((c) => cardTagsContainer.appendChild(makeTag(c, "#450a0a", "#f87171", excludeCards)));
      if (includeCards.length === 0 && excludeCards.length === 0) {
        const hint = document.createElement("span");
        hint.textContent = "No card filters active.";
        hint.style.cssText = "font-size:12px; color:#777; font-style:italic;";
        cardTagsContainer.appendChild(hint);
      }
    }
    function buildTrueHubNav() {
      ucNavRow = (btnPrevious == null ? void 0 : btnPrevious.closest("tr, nav, .row, thead")) || (btnPrevious == null ? void 0 : btnPrevious.parentElement);
      const nav = document.createElement("div");
      nav.id = "truehub-nav";
      Object.assign(nav.style, { display: "none", margin: "8px 0", fontFamily: "inherit", boxSizing: "border-box", width: "100%" });
      const toolbar = document.createElement("div");
      toolbar.id = "th-toolbar";
      Object.assign(toolbar.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        boxSizing: "border-box",
        padding: "0",
        margin: "0 0 6px 0"
      });
      const leftControls = document.createElement("div");
      Object.assign(leftControls.style, { display: "flex", alignItems: "center", gap: "10px" });
      const searchBox = document.createElement("input");
      searchBox.id = "th-search";
      searchBox.type = "text";
      searchBox.placeholder = "Search decks...";
      searchBox.className = "form-control";
      Object.assign(searchBox.style, { width: "180px", padding: "4px 8px" });
      leftControls.appendChild(searchBox);
      const originalSoulSelect = document.getElementById("selectSouls");
      if (originalSoulSelect) {
        let updateSoulClass = function() {
          Object.keys(SOUL_COLORS).forEach((soul) => soulSelect.classList.remove(soul));
          if (soulSelect.value) soulSelect.classList.add(soulSelect.value);
        };
        const soulSelect = originalSoulSelect.cloneNode(true);
        soulSelect.id = "th-select-souls";
        const noneOption = soulSelect.querySelector('option[value=""]');
        if (noneOption) {
          noneOption.textContent = "Filter: Soul";
          noneOption.selected = true;
        }
        soulSelect.addEventListener("change", () => {
          updateSoulClass();
          activeSoulFilter = soulSelect.value || null;
          applyFilters2();
        });
        leftControls.appendChild(soulSelect);
      }
      toolbar.appendChild(leftControls);
      const cardFilterBtn = document.createElement("button");
      cardFilterBtn.id = "th-card-filter-btn";
      cardFilterBtn.textContent = "Card Filter";
      cardFilterBtn.className = "btn btn-default";
      Object.assign(cardFilterBtn.style, {
        padding: "4px 16px",
        whiteSpace: "nowrap",
        background: "#0e1a30",
        border: "1px solid #1e3a60",
        color: "#4a7aaa"
      });
      cardFilterBtn.onclick = () => {
        const isOpen = cardFilterPanel.style.display !== "none";
        cardFilterPanel.style.display = isOpen ? "none" : "block";
        if (!isOpen) {
          cardSearchInput.focus();
          renderCardFilterTags();
        }
      };
      toolbar.appendChild(cardFilterBtn);
      const pagerGroup = document.createElement("div");
      Object.assign(pagerGroup.style, { display: "flex", alignItems: "center", gap: "6px" });
      const btnPrev = document.createElement("button");
      btnPrev.id = "th-btn-prev";
      btnPrev.className = "btn btn-primary";
      btnPrev.disabled = true;
      btnPrev.innerHTML = "&#10094;";
      const pageSelect = document.createElement("select");
      pageSelect.id = "th-select-page";
      const slash = document.createElement("span");
      slash.textContent = "/";
      const maxPage = document.createElement("span");
      maxPage.id = "th-max-page";
      maxPage.textContent = "1";
      const btnNext2 = document.createElement("button");
      btnNext2.id = "th-btn-next";
      btnNext2.className = "btn btn-primary";
      btnNext2.innerHTML = "&#10095;";
      pagerGroup.appendChild(btnPrev);
      pagerGroup.appendChild(pageSelect);
      pagerGroup.appendChild(slash);
      pagerGroup.appendChild(maxPage);
      pagerGroup.appendChild(btnNext2);
      toolbar.appendChild(pagerGroup);
      nav.appendChild(toolbar);
      nav.appendChild(buildCardFilterPanel());
      if (ucNavRow) ucNavRow.insertAdjacentElement("afterend", nav);
      else originalDecks.insertAdjacentElement("beforebegin", nav);
      searchBox.addEventListener("input", () => {
        activeSearch = searchBox.value;
        applyFilters2();
      });
      btnPrev.onclick = () => {
        if (currentPage <= 1) return;
        currentPage--;
        renderPage();
      };
      btnNext2.onclick = () => {
        const total = Math.ceil(filteredDecks.length / DECKS_PER_PAGE);
        if (currentPage >= total) return;
        currentPage++;
        renderPage();
      };
      pageSelect.onchange = (e) => {
        currentPage = Number(e.target.value) + 1;
        renderPage();
      };
      trueHubNavEl = nav;
    }
    function syncNav() {
      const total = Math.max(1, Math.ceil(filteredDecks.length / DECKS_PER_PAGE));
      const thSelect = document.getElementById("th-select-page");
      const thMax = document.getElementById("th-max-page");
      const thPrev = document.getElementById("th-btn-prev");
      const thNext = document.getElementById("th-btn-next");
      if (!thSelect || !thMax || !thPrev || !thNext) return;
      thSelect.innerHTML = "";
      for (let i = 1; i <= total; i++) {
        const opt = document.createElement("option");
        opt.value = i - 1;
        opt.textContent = i;
        if (i === currentPage) opt.selected = true;
        thSelect.appendChild(opt);
      }
      thMax.textContent = total;
      thPrev.disabled = currentPage <= 1;
      thNext.disabled = currentPage >= total;
    }
    function enableTrueHubNav() {
      if (ucNavRow) ucNavRow.style.display = "none";
      if (trueHubNavEl) {
        const gridWidth = trueHubWrapper.offsetWidth || originalDecks.offsetWidth;
        if (gridWidth > 0) {
          trueHubNavEl.style.width = gridWidth + "px";
          trueHubNavEl.style.maxWidth = gridWidth + "px";
          if (cardFilterPanel) {
            cardFilterPanel.style.width = "100%";
            cardFilterPanel.style.maxWidth = "100%";
          }
        }
        trueHubNavEl.style.display = "";
      }
    }
    function restoreClassicNav() {
      if (trueHubNavEl) trueHubNavEl.style.display = "none";
      if (ucNavRow) ucNavRow.style.display = "";
      if (!classicState) return;
      const liveSelect = document.getElementById("selectPage");
      const livePrev = document.getElementById("btnPrevious");
      const liveNext = document.getElementById("btnNext");
      const liveCur = document.getElementById("currentPage");
      const liveMax = document.getElementById("maxPage");
      if (liveSelect) liveSelect.innerHTML = classicState.selectHTML;
      if (liveCur) liveCur.textContent = classicState.currentPage;
      if (liveMax) liveMax.textContent = classicState.maxPage;
      if (livePrev) livePrev.disabled = classicState.prevDisabled;
      if (liveNext) liveNext.disabled = classicState.nextDisabled;
    }
    function cleanNotes(notes) {
      if (!notes) return "No description available.";
      return notes.replace(/\\n/g, "\n").replace(/<[^>]+>/g, "").replace(/ {2,}/g, " ").split("\n").filter((line) => !line.trim().toLowerCase().startsWith("creator")).filter((line) => !/https?:\/\//i.test(line)).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    }
    function showInfo(deck) {
      const msg = cleanNotes(deck.notes);
      const BootstrapDialogRef = getPageWindow().BootstrapDialog;
      if (BootstrapDialogRef == null ? void 0 : BootstrapDialogRef.alert) {
        BootstrapDialogRef.alert({ title: deck.channel || "Deck Info", message: msg });
      } else {
        alert(msg);
      }
    }
    function buildToggle() {
      const wrap = document.createElement("div");
      wrap.style.cssText = "text-align:center; margin:20px 0;";
      wrap.innerHTML = `<button id="truehub-switch" class="btn btn-primary">Switch to True Hub</button>`;
      trueHubWrapper.insertAdjacentElement("afterend", wrap);
      document.getElementById("truehub-switch").onclick = () => {
        const btn = document.getElementById("truehub-switch");
        if (mode === "classic") {
          if (!classicState) {
            classicState = {
              selectHTML: selectPage.innerHTML,
              currentPage: currentPageEl.textContent,
              maxPage: maxPageEl.textContent,
              prevDisabled: btnPrevious.disabled,
              nextDisabled: btnNext.disabled
            };
          }
          originalDecks.style.display = "none";
          trueHubWrapper.style.display = "";
          currentPage = 1;
          enableTrueHubNav();
          renderPage();
          btn.textContent = "Switch to Classic Hub";
          mode = "true";
          logger.log("mode", "Switched to True Hub view.");
        } else {
          trueHubWrapper.style.display = "none";
          originalDecks.style.display = "";
          restoreClassicNav();
          btn.textContent = "Switch to True Hub";
          mode = "classic";
          logger.log("mode", "Switched to Classic Hub view.");
        }
      };
    }
    function init() {
      waitForHub((hub, tmpl) => {
        originalDecks = hub;
        template = tmpl;
        selectPage = document.getElementById("selectPage");
        currentPageEl = document.getElementById("currentPage");
        maxPageEl = document.getElementById("maxPage");
        btnPrevious = document.getElementById("btnPrevious");
        btnNext = document.getElementById("btnNext");
        if (!selectPage || !btnPrevious || !btnNext) {
          logger.error("init", "Could not find nav elements.");
          return;
        }
        const style = document.createElement("style");
        style.textContent = `
        #truehub-list .hubDeck { margin-right: 10px; margin-bottom: 10px; }
        #th-card-dropdown::-webkit-scrollbar { width: 6px; }
        #th-card-dropdown::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }
      `;
        document.head.appendChild(style);
        trueHubWrapper = document.createElement("div");
        trueHubWrapper.id = "truehub-wrapper";
        trueHubWrapper.style.display = "none";
        trueHubList = originalDecks.cloneNode(false);
        trueHubList.id = "truehub-list";
        trueHubList.addEventListener("wheel", (e) => {
          if (!getScrollPaging()) return;
          if (mode !== "true") return;
          e.preventDefault();
          const totalPages = Math.max(1, Math.ceil(filteredDecks.length / DECKS_PER_PAGE));
          if (e.deltaY > 0) {
            if (currentPage < totalPages) {
              currentPage++;
              renderPage();
            }
          } else if (e.deltaY < 0) {
            if (currentPage > 1) {
              currentPage--;
              renderPage();
            }
          }
        }, { passive: false });
        trueHubWrapper.appendChild(trueHubList);
        originalDecks.insertAdjacentElement("afterend", trueHubWrapper);
        buildTrueHubNav();
        buildToggle();
        if (getAutoOpen()) {
          const toggleBtn = document.getElementById("truehub-switch");
          logger.log("init", "Auto-opening True Hub view.");
          if (toggleBtn) toggleBtn.click();
        }
        logger.log("init", "Ready.", { decksLoaded: allDecks.length });
      });
    }
    return { init, setDecks };
  }

  // packages/true-hub-bridge/decks-api.js
  var DECKS_URL = "https://raw.githubusercontent.com/theWiza2341/Wizascript/refs/heads/main/bot/decks.json";
  function loadDecks() {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: DECKS_URL,
        onload(res) {
          if (res.status !== 200) {
            reject(new Error(
              `Failed to fetch decks.json (HTTP ${res.status}). Check that the repo is public and bot/decks.json exists on main.`
            ));
            return;
          }
          try {
            const raw = JSON.parse(res.responseText);
            resolve(Array.isArray(raw) ? raw : raw.decks || []);
          } catch (e) {
            reject(e);
          }
        },
        onerror(err) {
          reject(err);
        }
      });
    });
  }

  // packages/true-hub-bridge/index.js
  function isHubPage() {
    return matchesPage("/Hub");
  }
  function initTrueHubBridge(plugin) {
    const settings2 = registerTrueHubBridgeSettings(plugin);
    if (!settings2.enabled.value()) return;
    if (!isHubPage()) return;
    const logger = createLogger("TrueHubBridge");
    const originalWarn = logger.warn.bind(logger);
    const originalLog = logger.log.bind(logger);
    logger.log = (...args) => {
      if (settings2.debugLogging.value()) originalLog(...args);
    };
    logger.warn = (...args) => {
      if (settings2.debugLogging.value()) originalWarn(...args);
    };
    const overlay = createTrueHubOverlay({
      logger,
      getAutoOpen: () => settings2.autoOpen.value(),
      getScrollPaging: () => settings2.scrollPaging.value()
    });
    loadDecks().then((decks) => {
      overlay.setDecks(decks);
      overlay.init();
    }).catch((e) => logger.error("data", "Failed to load decks.json", e));
  }

  // packages/deck-tracker/settings.js
  function registerDeckTrackerSettings(plugin) {
    const settings2 = createFeatureSettings(plugin, "decktracker", "Deck Tracker");
    const enabled = settings2.add("enabled", {
      name: "Enable Deck Tracker",
      type: "boolean",
      default: true
    });
    const debugLogging = settings2.add("debugLogging", {
      name: "Enable debug logging",
      type: "boolean",
      default: false
    });
    const retainUnclosedPresets = settings2.add("retainUnclosedPresets", {
      name: "Retain Unclosed Presets Between Matches",
      type: "boolean",
      default: false
    });
    const allowFavoritedRetainedWhileSpectating = settings2.add("allowFavoritedRetainedWhileSpectating", {
      name: "Auto-load Presets While Spectating",
      note: "Applies to your own favorited/retained tracker presets specifically.",
      type: "boolean",
      default: false
    });
    const dimOpacity = settings2.add("dimOpacity", {
      name: "Tracker Dim Opacity",
      type: "slider",
      default: 0.4,
      min: 0,
      max: 1,
      step: 0.05
    });
    return {
      settings: settings2,
      enabled,
      debugLogging,
      retainUnclosedPresets,
      allowFavoritedRetainedWhileSpectating,
      dimOpacity
    };
  }

  // packages/deck-tracker/registry.js
  var FAVORITES_KEY = "wizascript.decktracker.favorites";
  var CUSTOM_PRESETS_KEY = "wizascript.decktracker.customPresets";
  var RETAINED_KEY = "wizascript.decktracker.retained";
  var POSITIONS_KEY = "wizascript.decktracker.positions";
  var presetTypes = /* @__PURE__ */ new Map();
  var activeInstances = /* @__PURE__ */ new Map();
  var favoritesCache = null;
  var customPresetsCache = null;
  var retainedCache = null;
  var positionsCache = null;
  var retainEnabledGetter = () => false;
  function loadFavorites() {
    if (favoritesCache) return favoritesCache;
    try {
      favoritesCache = JSON.parse(GM_getValue(FAVORITES_KEY, "{}"));
    } catch {
      favoritesCache = {};
    }
    return favoritesCache;
  }
  function saveFavorites() {
    GM_setValue(FAVORITES_KEY, JSON.stringify(favoritesCache || {}));
  }
  function loadCustomPresets() {
    if (customPresetsCache) return customPresetsCache;
    try {
      customPresetsCache = JSON.parse(GM_getValue(CUSTOM_PRESETS_KEY, "[]"));
    } catch {
      customPresetsCache = [];
    }
    return customPresetsCache;
  }
  function saveCustomPresets() {
    GM_setValue(CUSTOM_PRESETS_KEY, JSON.stringify(customPresetsCache || []));
  }
  function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "tracker";
  }
  function registerPresetType(definition, { onGameEvent, hudBehavior } = {}) {
    if (!definition || !definition.id) throw new Error("Preset definition requires an id");
    presetTypes.set(definition.id, { definition, onGameEvent: onGameEvent || null, hudBehavior: hudBehavior || null });
  }
  function getHudBehavior(id) {
    var _a;
    return ((_a = presetTypes.get(id)) == null ? void 0 : _a.hudBehavior) || null;
  }
  function createCustomPreset({ name, description = "", sprite = null }) {
    const id = `custom:${slugify(name)}:${Date.now().toString(36)}`;
    const definition = { id, name, description, sprite, soul: null, custom: true, kind: "manual" };
    const list = loadCustomPresets();
    list.push(definition);
    saveCustomPresets();
    presetTypes.set(id, { definition, onGameEvent: null });
    return definition;
  }
  function deleteCustomPreset(id) {
    customPresetsCache = loadCustomPresets().filter((p) => p.id !== id);
    saveCustomPresets();
    presetTypes.delete(id);
    deactivate(id);
    setFavorited(id, false);
  }
  function ensureCustomPresetsRegistered() {
    loadCustomPresets().forEach((def) => {
      if (!presetTypes.has(def.id)) presetTypes.set(def.id, { definition: def, onGameEvent: null });
    });
  }
  function getAvailablePresets() {
    ensureCustomPresetsRegistered();
    return [...presetTypes.values()].map((entry) => ({
      ...entry.definition,
      favorited: isFavorited(entry.definition.id)
    }));
  }
  function getDefinition(id) {
    var _a;
    ensureCustomPresetsRegistered();
    return ((_a = presetTypes.get(id)) == null ? void 0 : _a.definition) || null;
  }
  function isFavorited(id) {
    var _a;
    return !!((_a = loadFavorites()[id]) == null ? void 0 : _a.favorited);
  }
  function setFavorited(id, favorited) {
    const favorites = loadFavorites();
    if (favorited) {
      favorites[id] = { ...favorites[id] || {}, favorited: true };
    } else {
      delete favorites[id];
    }
    saveFavorites();
  }
  function getFavoritedPresetIds() {
    return Object.keys(loadFavorites());
  }
  function activate(id, { initialCount = 0 } = {}) {
    if (activeInstances.has(id)) return activeInstances.get(id);
    const instance = { count: initialCount, listeners: /* @__PURE__ */ new Set() };
    activeInstances.set(id, instance);
    return instance;
  }
  function deactivate(id) {
    activeInstances.delete(id);
  }
  function getCount(id) {
    var _a, _b;
    return (_b = (_a = activeInstances.get(id)) == null ? void 0 : _a.count) != null ? _b : 0;
  }
  function setCount(id, count) {
    const instance = activeInstances.get(id);
    if (!instance) return;
    instance.count = Math.max(0, count);
    instance.listeners.forEach((fn) => fn(instance.count));
  }
  function onCountChange(id, callback) {
    const instance = activeInstances.get(id);
    if (!instance) return () => {
    };
    instance.listeners.add(callback);
    return () => instance.listeners.delete(callback);
  }
  function dispatchGameEvent(event) {
    activeInstances.forEach((instance, id) => {
      const type = presetTypes.get(id);
      if (!type || !type.onGameEvent) return;
      type.onGameEvent(event, {
        getCount: () => instance.count,
        setCount: (next) => setCount(id, next)
      });
    });
  }
  function loadRetained() {
    if (retainedCache) return retainedCache;
    try {
      retainedCache = JSON.parse(GM_getValue(RETAINED_KEY, "{}"));
    } catch {
      retainedCache = {};
    }
    return retainedCache;
  }
  function saveRetained() {
    GM_setValue(RETAINED_KEY, JSON.stringify(retainedCache || {}));
  }
  function setRetainEnabledGetter(fn) {
    retainEnabledGetter = fn;
  }
  function getRetainedPresetIds() {
    return Object.keys(loadRetained());
  }
  function markRetained(id) {
    if (!retainEnabledGetter()) return;
    const retained = loadRetained();
    retained[id] = true;
    saveRetained();
  }
  function unmarkRetained(id) {
    const retained = loadRetained();
    if (retained[id]) {
      delete retained[id];
      saveRetained();
    }
  }
  function loadPositions() {
    if (positionsCache) return positionsCache;
    try {
      positionsCache = JSON.parse(GM_getValue(POSITIONS_KEY, "{}"));
    } catch {
      positionsCache = {};
    }
    return positionsCache;
  }
  function savePositions() {
    GM_setValue(POSITIONS_KEY, JSON.stringify(positionsCache || {}));
  }
  function getSavedPosition(id) {
    return loadPositions()[id] || null;
  }
  function setSavedPosition(id, layout) {
    const positions = loadPositions();
    positions[id] = layout;
    savePositions();
  }
  function clearSavedPosition(id) {
    const positions = loadPositions();
    if (positions[id]) {
      delete positions[id];
      savePositions();
    }
  }

  // packages/deck-tracker/hud.js
  var CARD_IMAGE_BASE = "https://undercards.net/images/cards/";
  var SPRITE_RATIO = "160 / 90";
  var MIN_WIDTH = 90;
  var MAX_WIDTH = 220;
  var DEFAULT_WIDTH = 155;
  var COMPACT_DEFAULT_WIDTH = 120;
  var CASCADE_STEP = 24;
  var CASCADE_MAX_STEPS = 6;
  var CASCADE_BASE = 20;
  var cascadeIndex = 0;
  function getNextCascadePosition() {
    const step = cascadeIndex % CASCADE_MAX_STEPS;
    cascadeIndex++;
    return {
      right: CASCADE_BASE + step * CASCADE_STEP,
      bottom: CASCADE_BASE + step * CASCADE_STEP
    };
  }
  var liveWidgets = /* @__PURE__ */ new Map();
  function widgetElementId(id) {
    return `dt-tracker-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  }
  function genericIcon() {
    return $("<div>").css({
      width: "100%",
      aspectRatio: SPRITE_RATIO,
      background: "#333",
      borderRadius: "3px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#777"
    }).text("#");
  }
  function spriteImage(sprite) {
    if (!sprite) return genericIcon();
    return $("<img>").attr("src", `${CARD_IMAGE_BASE}${sprite}.png`).css({
      width: "100%",
      aspectRatio: SPRITE_RATIO,
      objectFit: "cover",
      borderRadius: "3px",
      display: "block",
      background: "#000"
    }).on("error", function() {
      $(this).replaceWith(genericIcon());
    });
  }
  function buildWidget({ id, name, sprite, initialCount, initialLabel, isLabelMode = false, savedLayout, showSaveButton = false, showImage = true, contentMode = null, initialListItems = [], onRemoveListItem = null, firstItemLabel = "next" }) {
    const elId = widgetElementId(id);
    $(`#${elId}`).remove();
    const ns = `.dt-widget-${Math.random().toString(36).slice(2)}`;
    let width = (savedLayout == null ? void 0 : savedLayout.width) || (showImage ? DEFAULT_WIDTH : COMPACT_DEFAULT_WIDTH);
    const widget = $(`<div id="${elId}">`).addClass("dt-tracker-widget").css({
      position: "fixed",
      zIndex: 8,
      width: width + "px",
      background: "#1a1a1a",
      border: "2px solid #444",
      borderRadius: "6px",
      padding: "6px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "4px",
      color: "white",
      fontFamily: "inherit",
      boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
      userSelect: "none",
      cursor: "grab"
    });
    if (savedLayout) {
      widget.css({ left: savedLayout.left + "px", top: savedLayout.top + "px", right: "auto", bottom: "auto" });
    } else {
      const pos = getNextCascadePosition();
      widget.css({ bottom: pos.bottom + "px", right: pos.right + "px", left: "auto", top: "auto" });
    }
    const nameLine = $("<div>").css({
      fontWeight: "bold",
      textAlign: "center",
      width: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }).text(name);
    const resizeHandle = $("<div>").css({
      position: "absolute",
      bottom: "-2px",
      right: "-2px",
      width: "14px",
      height: "14px",
      cursor: "nwse-resize",
      background: "transparent"
    });
    if (contentMode === "list") {
      let renderListItems = function(items) {
        listBody.empty();
        if (!items.length) {
          listBody.append($("<div>").css({
            fontSize: "11px",
            color: "#777",
            fontStyle: "italic",
            textAlign: "center",
            padding: "4px 0"
          }).text("No known cards yet"));
          return;
        }
        items.forEach((item, idx) => {
          const row = $("<div>").css({
            fontSize: "12px",
            padding: "3px 6px",
            background: "rgba(255,255,255,0.06)",
            borderRadius: "3px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }).attr("title", "Right-click to remove this card");
          row.append(
            $("<span>").css({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }).text(item.name),
            $("<span>").css({ fontSize: "10px", color: "#777", flexShrink: 0, marginLeft: "6px" }).text(idx === 0 ? firstItemLabel : `+${idx}`)
          );
          row.on("mouseenter", () => row.css("background", "rgba(255,255,255,0.12)"));
          row.on("mouseleave", () => row.css("background", "rgba(255,255,255,0.06)"));
          row.on("mousedown", (e) => e.stopPropagation());
          row.on("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemoveListItem == null ? void 0 : onRemoveListItem(item);
          });
          listBody.append(row);
        });
      }, applySizeList = function(newWidth) {
        width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
        widget.css("width", width + "px");
        nameLine.css("fontSize", Math.round(width * 0.105) + "px");
        listBody.css("fontSize", Math.round(width * 0.09) + "px");
        return width;
      };
      widget.append(nameLine);
      const closeBtnList = $("<span>").text("\xD7").css({
        position: "absolute",
        top: "-8px",
        left: "-8px",
        cursor: "pointer",
        color: "#eee",
        fontSize: "15px",
        fontWeight: "bold",
        background: "rgba(180,30,30,0.75)",
        borderRadius: "50%",
        width: "18px",
        height: "18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: "1"
      });
      closeBtnList.on("mousedown", (e) => e.stopPropagation());
      widget.append(closeBtnList);
      const listBody = $("<div>").css({
        width: "100%",
        maxHeight: "150px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "3px"
      });
      renderListItems(initialListItems);
      widget.append(listBody, resizeHandle);
      $("body").append(widget);
      applySizeList(width);
      return {
        widget,
        nameLine,
        imageWrap: null,
        star: null,
        closeBtn: closeBtnList,
        resizeHandle,
        applySize: applySizeList,
        getWidth: () => width,
        ns,
        setSprite: () => {
        },
        setLabel: () => {
        },
        setListItems: renderListItems
      };
    }
    let imageWrap = null;
    let imageBox = null;
    let star = null;
    if (showImage) {
      imageWrap = $("<div>").css({ position: "relative", width: "100%" });
      imageBox = spriteImage(sprite);
      if (showSaveButton) {
        star = $("<span>").text("\u2606").attr("title", "Save as Preset").css({
          position: "absolute",
          top: "2px",
          right: "2px",
          cursor: "pointer",
          color: "#eee",
          fontSize: "15px",
          background: "rgba(0,0,0,0.55)",
          borderRadius: "50%",
          width: "18px",
          height: "18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: "1"
        });
      }
    }
    const closeBtn = $("<span>").text("\xD7").css({
      position: "absolute",
      top: "2px",
      left: "2px",
      cursor: "pointer",
      color: "#eee",
      fontSize: "15px",
      fontWeight: "bold",
      background: "rgba(180,30,30,0.75)",
      borderRadius: "50%",
      width: "18px",
      height: "18px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: "1"
    });
    if (showImage) {
      imageWrap.append(imageBox);
      if (star) imageWrap.append(star);
      imageWrap.append(closeBtn);
    } else {
      widget.css("position", "fixed");
      closeBtn.css({ top: "-8px", left: "-8px" });
      widget.append(closeBtn);
    }
    const countEl = $("<div>").css({
      fontWeight: "bold",
      width: "100%",
      textAlign: "center",
      background: "rgba(255,255,255,0.08)",
      borderRadius: "3px",
      padding: "2px 0"
    });
    if (isLabelMode) {
      countEl.html(initialLabel != null ? initialLabel : "?");
    } else {
      countEl.text("\xD7" + initialCount);
    }
    function applySize(newWidth) {
      width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
      widget.css("width", width + "px");
      nameLine.css("fontSize", Math.round(width * 0.105) + "px");
      countEl.css("fontSize", Math.round(width * 0.14) + "px");
      return width;
    }
    applySize(width);
    if (showImage) {
      widget.append(nameLine, imageWrap, countEl, resizeHandle);
    } else {
      widget.append(nameLine, countEl, resizeHandle);
    }
    $("body").append(widget);
    if (star) star.on("mousedown", (e) => e.stopPropagation());
    closeBtn.on("mousedown", (e) => e.stopPropagation());
    function setSprite(newSprite) {
      if (!showImage || !imageBox) return;
      const fresh = spriteImage(newSprite);
      imageBox.replaceWith(fresh);
      imageBox = fresh;
    }
    function setLabel(html) {
      countEl.html(html);
    }
    return { widget, nameLine, countEl, imageWrap, star, closeBtn, resizeHandle, applySize, getWidth: () => width, ns, setSprite, setLabel };
  }
  function bindInteractions(parts, { onLeftClick, onRightClick, onMiddleClick, id, trackRetain = false }) {
    const { widget, resizeHandle, applySize, getWidth, ns } = parts;
    widget.off(ns).off("contextmenu" + ns);
    $(document).off(ns);
    resizeHandle.off(ns);
    let dragging = false, dragMoved = false, startX, startY, offsetX, offsetY;
    widget.on("mousedown" + ns, function(e) {
      if (e.button === 1) {
        e.preventDefault();
        onMiddleClick == null ? void 0 : onMiddleClick();
        return;
      }
      if (e.button !== 0) return;
      dragging = true;
      dragMoved = false;
      const rect = widget[0].getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      startX = e.clientX;
      startY = e.clientY;
      widget.css("cursor", "grabbing");
      e.preventDefault();
    });
    $(document).on("mousemove" + ns, function(e) {
      if (!dragging) return;
      if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4) dragMoved = true;
      if (dragMoved) {
        widget.css({ left: e.clientX - offsetX + "px", top: e.clientY - offsetY + "px", right: "auto", bottom: "auto" });
      }
    });
    $(document).on("mouseup" + ns, function() {
      if (!dragging) return;
      dragging = false;
      widget.css("cursor", "grab");
      if (dragMoved) {
        const rect = widget[0].getBoundingClientRect();
        const layout = { left: rect.left, top: rect.top, width: getWidth() };
        if (trackRetain) {
          setSavedPosition(id, layout);
          markRetained(id);
        }
      } else {
        onLeftClick == null ? void 0 : onLeftClick();
      }
    });
    widget.on("contextmenu" + ns, function(e) {
      e.preventDefault();
      onRightClick == null ? void 0 : onRightClick();
    });
    let resizing = false, resizeStartX, resizeStartWidth;
    resizeHandle.on("mousedown" + ns, function(e) {
      e.stopPropagation();
      e.preventDefault();
      resizing = true;
      resizeStartX = e.clientX;
      resizeStartWidth = getWidth();
    });
    $(document).on("mousemove" + ns + "-resize", function(e) {
      if (!resizing) return;
      applySize(resizeStartWidth + (e.clientX - resizeStartX));
    });
    $(document).on("mouseup" + ns + "-resize", function() {
      if (!resizing) return;
      resizing = false;
      const rect = widget[0].getBoundingClientRect();
      const layout = { left: rect.left, top: rect.top, width: getWidth() };
      if (trackRetain) {
        setSavedPosition(id, layout);
        markRetained(id);
      }
    });
  }
  function spawnPreset(id) {
    var _a, _b, _c;
    const definition = getDefinition(id);
    if (!definition) {
      console.warn("[DeckTracker] Unknown preset id:", id);
      return null;
    }
    if (liveWidgets.has(id)) return liveWidgets.get(id).widget;
    activate(id);
    const savedLayout = getSavedPosition(id);
    const behavior = getHudBehavior(id);
    const parts = buildWidget({
      id,
      // The picker lists presets by their real name, but
      // the on-screen widget itself can show something more directly
      // descriptive of what it's currently displaying, if the preset
      // supplies one.
      name: (_a = behavior == null ? void 0 : behavior.widgetTitle) != null ? _a : definition.name,
      sprite: (behavior == null ? void 0 : behavior.getInitialSprite) ? behavior.getInitialSprite() : definition.sprite,
      initialCount: getCount(id),
      initialLabel: (behavior == null ? void 0 : behavior.getInitialLabel) ? behavior.getInitialLabel() : void 0,
      isLabelMode: !!behavior,
      savedLayout,
      showSaveButton: false,
      showImage: !(behavior == null ? void 0 : behavior.compact),
      contentMode: (behavior == null ? void 0 : behavior.listMode) ? "list" : null,
      initialListItems: (behavior == null ? void 0 : behavior.getInitialListItems) ? behavior.getInitialListItems() : [],
      onRemoveListItem: (behavior == null ? void 0 : behavior.onRemoveListItem) ? (item) => behavior.onRemoveListItem(id, item) : null,
      firstItemLabel: (_b = behavior == null ? void 0 : behavior.firstItemLabel) != null ? _b : "next"
    });
    const baselineRect = { left: parts.widget[0].getBoundingClientRect().left, top: parts.widget[0].getBoundingClientRect().top, width: parts.getWidth() };
    setSavedPosition(id, baselineRect);
    markRetained(id);
    parts.closeBtn.on("click", (e) => {
      e.stopPropagation();
      closeWidget(id);
    });
    const interactionCallbacks = behavior ? {
      onLeftClick: () => {
        var _a2;
        return (_a2 = behavior.onLeftClick) == null ? void 0 : _a2.call(behavior, id, parts);
      },
      onRightClick: () => {
        var _a2;
        return (_a2 = behavior.onRightClick) == null ? void 0 : _a2.call(behavior, id, parts);
      },
      onMiddleClick: () => {
        var _a2;
        return (_a2 = behavior.onMiddleClick) == null ? void 0 : _a2.call(behavior, id, parts);
      }
    } : {
      onLeftClick: () => setCount(id, getCount(id) + 1),
      onRightClick: () => setCount(id, getCount(id) - 1),
      onMiddleClick: () => setCount(id, 0)
    };
    bindInteractions(parts, {
      ...interactionCallbacks,
      id,
      trackRetain: true
    });
    const unsubscribe = behavior ? null : onCountChange(id, (count) => parts.countEl.text("\xD7" + count));
    liveWidgets.set(id, { ...parts, unsubscribe });
    (_c = behavior == null ? void 0 : behavior.onMount) == null ? void 0 : _c.call(behavior, id, parts);
    return parts.widget;
  }
  function closeWidget(id, { userInitiated = true } = {}) {
    var _a, _b, _c;
    const entry = liveWidgets.get(id);
    if (!entry) return;
    (_a = entry.unsubscribe) == null ? void 0 : _a.call(entry);
    $(document).off(entry.ns);
    entry.widget.remove();
    deactivate(id);
    liveWidgets.delete(id);
    (_c = (_b = getHudBehavior(id)) == null ? void 0 : _b.onUnmount) == null ? void 0 : _c.call(_b, id);
    if (userInitiated) {
      clearSavedPosition(id);
      unmarkRetained(id);
    }
  }
  function closeAllWidgets() {
    [...liveWidgets.keys()].forEach((id) => closeWidget(id, { userInitiated: false }));
  }
  function isWidgetOpen(id) {
    return liveWidgets.has(id);
  }
  function spawnAdHocCustomTracker({ name, sprite, onRequestSaveAsPreset }) {
    const tempId = `adhoc:${Date.now().toString(36)}`;
    let count = 0;
    const parts = buildWidget({
      id: tempId,
      name,
      sprite,
      initialCount: 0,
      savedLayout: null,
      showSaveButton: true
    });
    liveWidgets.set(tempId, { ...parts, unsubscribe: null });
    function setLocalCount(next) {
      count = Math.max(0, next);
      parts.countEl.text("\xD7" + count);
    }
    bindInteractions(parts, {
      onLeftClick: () => setLocalCount(count + 1),
      onRightClick: () => setLocalCount(count - 1),
      onMiddleClick: () => setLocalCount(0),
      id: tempId,
      trackRetain: false
      // no real registry id yet - nothing meaningful to retain
    });
    parts.closeBtn.on("click", (e) => {
      e.stopPropagation();
      closeWidget(tempId);
    });
    parts.star.on("click", (e) => {
      e.stopPropagation();
      onRequestSaveAsPreset(name, sprite, (savedName, description) => {
        const definition = createCustomPreset({ name: savedName, description, sprite });
        activate(definition.id, { initialCount: count });
        const rect = parts.widget[0].getBoundingClientRect();
        setSavedPosition(definition.id, { left: rect.left, top: rect.top, width: parts.getWidth() });
        parts.widget.attr("id", widgetElementId(definition.id));
        parts.closeBtn.off("click").on("click", (e2) => {
          e2.stopPropagation();
          closeWidget(definition.id);
        });
        bindInteractions(parts, {
          onLeftClick: () => setCount(definition.id, getCount(definition.id) + 1),
          onRightClick: () => setCount(definition.id, getCount(definition.id) - 1),
          onMiddleClick: () => setCount(definition.id, 0),
          id: definition.id,
          trackRetain: true
        });
        const unsubscribe = onCountChange(definition.id, (c) => parts.countEl.text("\xD7" + c));
        liveWidgets.delete(tempId);
        liveWidgets.set(definition.id, { ...parts, unsubscribe });
        parts.star.remove();
      });
    });
    return parts.widget;
  }

  // packages/deck-tracker/picker.js
  function heartIconSVG(filled) {
    const fill = filled ? "#e74c3c" : "none";
    const stroke = filled ? "#e74c3c" : "#888";
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round">
    <path d="M12 21s-6.716-4.35-9.428-8.06C.686 10.06 1.2 6.5 4.2 5.1 6.6 4 9 5 12 8c3-3 5.4-4 7.8-2.9 3 1.4 3.514 4.96 1.628 7.84C18.716 16.65 12 21 12 21z"/>
  </svg>`;
  }
  function starIconSVG(filled) {
    const fill = filled ? "#2ecc71" : "none";
    const stroke = filled ? "#2ecc71" : "#888";
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round">
    <path d="M12 2l2.9 6.6 7.1.6-5.4 4.6 1.6 7-6.2-3.8L6 21l1.6-7L2.2 9.2l7.1-.6L12 2z"/>
  </svg>`;
  }
  function buildPresetRow(preset, onAdd, onCloseWidget, onDelete) {
    const row = $("<div>").css({
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "8px 6px",
      borderBottom: "1px solid rgba(255,255,255,0.1)"
    }).on("mouseenter", function() {
      $(this).css("background", "rgba(255,255,255,0.08)");
    }).on("mouseleave", function() {
      $(this).css("background", "");
    });
    const heart = $("<span>").css({
      width: "20px",
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer"
    });
    function renderHeart() {
      heart.html(heartIconSVG(isFavorited(preset.id)));
    }
    renderHeart();
    heart.attr("title", "Favorite - always auto-load at match start");
    heart.on("click", (e) => {
      e.stopPropagation();
      const nowFavorited = !isFavorited(preset.id);
      setFavorited(preset.id, nowFavorited);
      renderHeart();
    });
    const info = $("<div>").css({ flex: 1 });
    const nameLine = $("<div>").css({ fontWeight: "bold", fontSize: "14px" }).text(preset.name);
    if (preset.soul) {
      nameLine.append($("<span>").text(` (${preset.soul})`).css({
        fontSize: "11px",
        fontWeight: "normal",
        color: "#4a7aaa",
        marginLeft: "6px"
      }));
    }
    const descLine = $("<div>").css({ fontSize: "12px", color: "#aaa", marginTop: "2px" }).text(preset.description || "");
    info.append(nameLine, descLine);
    const starBtn = $("<span>").css({
      width: "28px",
      height: "28px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "4px",
      background: "rgba(255,255,255,0.08)",
      cursor: "pointer",
      flexShrink: 0
    });
    let active = isWidgetOpen(preset.id);
    function renderStar() {
      starBtn.html(starIconSVG(active));
      if (active && preset.custom) {
        starBtn.attr("title", "Double-click to permanently delete this preset");
      } else if (active) {
        starBtn.attr("title", "Remove from screen");
      } else {
        starBtn.attr("title", "Add to screen");
      }
    }
    renderStar();
    starBtn.on("click", (e) => {
      e.stopPropagation();
      if (!active) {
        onAdd(preset.id);
        active = true;
        renderStar();
        return;
      }
      if (preset.custom) {
        if (e.detail !== 2) return;
        onDelete(preset.id);
        row.remove();
        return;
      }
      onCloseWidget(preset.id);
      active = false;
      renderStar();
    });
    row.append(heart, info, starBtn);
    return row;
  }
  function renderList(container, term, onAdd, onCloseWidget, onDelete) {
    container.empty();
    const all = getAvailablePresets();
    const filtered = term ? all.filter((p) => p.name.toLowerCase().includes(term.toLowerCase())) : all;
    if (!filtered.length) {
      container.append($("<div>").text("No presets found.").css({
        padding: "12px",
        color: "#777",
        fontStyle: "italic",
        textAlign: "center"
      }));
      return;
    }
    filtered.sort((a, b) => b.favorited - a.favorited).forEach((p) => container.append(buildPresetRow(p, onAdd, onCloseWidget, onDelete)));
  }
  function buildCustomRow(onCreateAdHoc) {
    const row = $("<div>").css({
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "10px 6px",
      marginTop: "8px",
      borderTop: "2px dashed rgba(255,255,255,0.25)",
      cursor: "pointer"
    }).on("mouseenter", function() {
      $(this).css("background", "rgba(255,255,255,0.08)");
    }).on("mouseleave", function() {
      $(this).css("background", "");
    });
    const info = $("<div>").css({ flex: 1 });
    info.append(
      $("<div>").css({ fontWeight: "bold", fontSize: "14px" }).text("Custom Tracker"),
      $("<div>").css({ fontSize: "12px", color: "#aaa", marginTop: "2px" }).text("Build your own manual counter, named and tracked however you like.")
    );
    const addBtn = $("<button>").text("+").css({
      width: "28px",
      height: "28px",
      lineHeight: "1",
      fontSize: "16px",
      fontWeight: "bold",
      background: "#2ecc71",
      color: "white",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      flexShrink: 0
    }).on("click", (e) => {
      e.stopPropagation();
      onCreateAdHoc();
    });
    row.append(info, addBtn);
    return row;
  }
  function openHelpDialog() {
    const content = $("<div>").css({ fontSize: "13px", lineHeight: "1.5" });
    function section(title, body) {
      content.append(
        $("<div>").css({ fontWeight: "bold", marginTop: "10px" }).text(title),
        $("<div>").css({ color: "#ccc", marginTop: "2px" }).html(body)
      );
    }
    section(
      "Manual trackers (click counters)",
      "Left-click: +1 &nbsp;&nbsp; Right-click: -1 &nbsp;&nbsp; Middle-click: reset to 0."
    );
    section(
      "The heart (\u2665 / \u2661)",
      "Favorites a preset - a favorited preset always auto-loads at the start of every match, in the same spot you left it."
    );
    section(
      "The star (\u2605 / \u2606)",
      "Adds the preset to your screen. Once active, the star fills in - click it again to remove it from screen. For your own custom presets specifically, double-clicking the filled star permanently deletes it (built-in presets can't be deleted this way)."
    );
    section(
      "Creating your own preset",
      'Use "Custom Tracker" below the list to build one - search for a card sprite (optional), name it, and create it. That gives you a plain counter on screen; click its own star to "Save as Preset," adding it to this list permanently.'
    );
    section(
      "Position &amp; size",
      "Drag a tracker by its body to move it, or its bottom-right corner to resize it - it'll remember exactly where you left it until you close it."
    );
    BootstrapDialog.show({
      title: "Deck Tracker Help",
      message: content,
      cssClass: "mono",
      buttons: [{ label: "Got it", cssClass: "btn-primary", action: (dialog) => dialog.close() }]
    });
  }
  function openPresetPicker({ onAddPreset, onCreateAdHoc, onCloseWidget, onDeletePreset }) {
    const wrapper = $("<div>").css({ minWidth: "360px" });
    const searchInput = $('<input type="text" placeholder="Search presets...">').addClass("form-control").css({
      width: "100%",
      boxSizing: "border-box",
      padding: "6px 8px",
      marginBottom: "8px",
      fontSize: "13px"
    });
    const listContainer = $("<div>").css({
      maxHeight: "220px",
      overflowY: "auto",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: "4px"
    });
    let dialogRef = null;
    const customRow = buildCustomRow(() => {
      dialogRef == null ? void 0 : dialogRef.close();
      onCreateAdHoc();
    });
    searchInput.on("input", function() {
      renderList(listContainer, $(this).val(), onAddPreset, onCloseWidget, onDeletePreset);
    });
    wrapper.append(searchInput, listContainer, customRow);
    renderList(listContainer, "", onAddPreset, onCloseWidget, onDeletePreset);
    dialogRef = BootstrapDialog.show({
      title: "Add Tracker Preset",
      message: wrapper,
      cssClass: "mono",
      onshown: () => searchInput.trigger("focus"),
      buttons: [
        // Deliberately does NOT close dialogRef - unlike the Custom
        // Tracker row above, help should stack on top and leave the
        // picker open underneath, since the user likely wants to keep
        // referring back to it while reading.
        { label: "Help", cssClass: "btn-default", action: () => openHelpDialog() },
        { label: "Close", cssClass: "btn-primary", action: (dialog) => dialog.close() }
      ]
    });
    return dialogRef;
  }

  // packages/deck-tracker/presets/custom.js
  var CARD_IMAGE_BASE2 = "https://undercards.net/images/cards/";
  var SPRITE_RATIO2 = "160 / 90";
  function searchSpriteCards(term) {
    if (!term) return [];
    const t = term.toLowerCase();
    return getAllCards().filter((c) => c.name && c.image && c.name.toLowerCase().includes(t)).slice(0, 20);
  }
  function buildSpriteResultRow(card, onPick) {
    const row = $("<div>").css({
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "5px 8px",
      cursor: "pointer",
      fontSize: "13px"
    }).on("mouseenter", function() {
      $(this).css("background", "rgba(255,255,255,0.08)");
    }).on("mouseleave", function() {
      $(this).css("background", "");
    });
    const thumb = $("<img>").attr("src", `${CARD_IMAGE_BASE2}${card.image}.png`).css({
      width: "28px",
      aspectRatio: SPRITE_RATIO2,
      objectFit: "cover",
      flexShrink: 0,
      background: "#111"
    }).on("error", function() {
      $(this).replaceWith($("<div>").css({ width: "28px", aspectRatio: SPRITE_RATIO2, background: "#333", flexShrink: 0 }));
    });
    row.append(thumb, $("<span>").text(card.name));
    row.on("click", () => onPick(card));
    return row;
  }
  function openCustomTrackerBuilder({ onCreate }) {
    let selectedCard = null;
    const wrapper = $("<div>").css({ minWidth: "340px" });
    const spriteSearch = $('<input type="text" placeholder="Search for a card sprite (optional)...">').addClass("form-control").css({ width: "100%", boxSizing: "border-box", padding: "6px 8px", fontSize: "13px" });
    const spriteResults = $("<div>").css({
      maxHeight: "150px",
      overflowY: "auto",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: "4px",
      marginTop: "4px",
      display: "none"
    });
    const selectedPreview = $("<div>").css({
      display: "none",
      alignItems: "center",
      gap: "8px",
      marginTop: "8px",
      padding: "6px",
      background: "rgba(255,255,255,0.06)",
      borderRadius: "4px"
    });
    const nameInput = $('<input type="text" placeholder="Tracker name">').addClass("form-control").css({ width: "100%", boxSizing: "border-box", padding: "6px 8px", fontSize: "13px", marginTop: "10px" });
    spriteSearch.on("input", function() {
      const matches = searchSpriteCards($(this).val());
      spriteResults.empty();
      if (!matches.length) {
        spriteResults.hide();
        return;
      }
      matches.forEach((card) => spriteResults.append(buildSpriteResultRow(card, (picked) => {
        selectedCard = picked;
        nameInput.val(picked.name);
        selectedPreview.empty().css("display", "flex").append(
          $("<img>").attr("src", `${CARD_IMAGE_BASE2}${picked.image}.png`).css({ width: "28px", aspectRatio: SPRITE_RATIO2, objectFit: "cover" }).on("error", function() {
            $(this).replaceWith("(image unavailable)");
          }),
          $("<span>").text(`Sprite: ${picked.name}`)
        );
        spriteResults.hide();
        spriteSearch.val("");
      })));
      spriteResults.show();
    });
    wrapper.append(spriteSearch, spriteResults, selectedPreview, nameInput);
    const dialog = BootstrapDialog.show({
      title: "Create Custom Tracker",
      message: wrapper,
      cssClass: "mono",
      buttons: [
        { label: "Cancel", action: (d) => d.close() },
        {
          label: "Create",
          cssClass: "btn-success",
          action: (d) => {
            const name = nameInput.val().trim() || "Untitled Tracker";
            d.close();
            onCreate({ name, sprite: (selectedCard == null ? void 0 : selectedCard.image) || null });
          }
        }
      ]
    });
    setTimeout(() => spriteSearch.trigger("focus"), 100);
    return dialog;
  }
  function openSaveAsPresetPrompt(defaultName, onSaved) {
    const wrapper = $("<div>").css({ minWidth: "320px" });
    const nameInput = $('<input type="text">').addClass("form-control").val(defaultName).css({ width: "100%", boxSizing: "border-box", padding: "6px 8px", fontSize: "13px", marginBottom: "8px" });
    const descInput = $('<textarea placeholder="Short description (optional)">').addClass("form-control").css({
      width: "100%",
      boxSizing: "border-box",
      padding: "6px 8px",
      fontSize: "13px",
      minHeight: "60px",
      resize: "vertical",
      background: "#111",
      color: "#eee",
      border: "1px solid #444"
    });
    wrapper.append(
      $("<label>").css({ fontSize: "12px", color: "#aaa" }).text("Preset name"),
      nameInput,
      $("<label>").css({ fontSize: "12px", color: "#aaa", marginTop: "6px", display: "block" }).text("Description"),
      descInput
    );
    return BootstrapDialog.show({
      title: "Save as Preset",
      message: wrapper,
      cssClass: "mono",
      buttons: [
        { label: "Cancel", action: (d) => d.close() },
        {
          label: "Save",
          cssClass: "btn-success",
          action: (d) => {
            const name = nameInput.val().trim() || defaultName;
            const description = descInput.val().trim();
            d.close();
            onSaved(name, description);
          }
        }
      ]
    });
  }

  // packages/deck-tracker/presets/built-in.js
  var BUILT_IN_PRESETS = [
    {
      id: "builtin:enemy-hlbs",
      name: "Enemy HLBs",
      description: "Tracks Hyperlinks Blocked added to the enemy deck",
      sprite: "Hyperlink_Blocked"
    },
    {
      id: "builtin:enemy-mines",
      name: "Enemy Mines",
      description: "Tracks Mines added to the enemy deck",
      sprite: "Mine"
    },
    {
      id: "builtin:cjester-procs",
      name: "CJester Procs",
      description: "Tracks the counters to be added by Freedom",
      sprite: "Caged_Jester"
    },
    {
      id: "builtin:pink-laser-atk",
      name: "Pink Laser ATK",
      description: "Tracks the number of monsters you played this game with 7 base HP",
      sprite: "Pink_Laser"
      // best-guess image name, not yet confirmed
    },
    {
      id: "builtin:skris-procs",
      name: "Skris Procs",
      description: "Tracks the counters to be added by Dark Fountain",
      sprite: "Soulless_Kris"
    },
    {
      id: "builtin:noellecoaster",
      name: "Noellecoaster",
      description: "Tracks the number of spells costing 2+ G you casted this game",
      sprite: "Noellecoaster"
      // best-guess image name, not yet confirmed
    }
  ];
  function registerBuiltInPresets() {
    BUILT_IN_PRESETS.forEach(({ id, name, description, sprite }) => {
      registerPresetType({
        id,
        name,
        description,
        sprite,
        soul: null,
        // card/archetype-specific, not a whole-Soul strategy tracker
        custom: false,
        // built-in - cannot be deleted via the picker's double-click
        kind: "manual"
        // click/right-click/middle-click driven, same as user custom trackers
      });
    });
  }

  // packages/core/player-context.js
  function isSpectating() {
    return location.pathname.toLowerCase().includes("spectate");
  }

  // packages/deck-tracker/index.js
  function isGamePage() {
    return matchesPage(["/Game", { prefix: "/Spectate" }]);
  }
  function waitForAvatar(callback) {
    const existing = document.getElementById("yourAvatar");
    if (existing) return callback(existing);
    setTimeout(() => waitForAvatar(callback), 100);
  }
  var BUTTON_POSITION_KEY = "wizascript.deckTracker.buttonPosition";
  function getSavedButtonPosition() {
    const raw = GM_getValue(BUTTON_POSITION_KEY, null);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  function setSavedButtonPosition(pos) {
    GM_setValue(BUTTON_POSITION_KEY, JSON.stringify(pos));
  }
  function clearSavedButtonPosition() {
    GM_deleteValue(BUTTON_POSITION_KEY);
  }
  function initDeckTracker(plugin) {
    const settings2 = registerDeckTrackerSettings(plugin);
    if (!settings2.enabled.value()) return;
    if (!isGamePage()) return;
    const logger = createLogger("DeckTracker");
    const originalWarn = logger.warn.bind(logger);
    const originalLog = logger.log.bind(logger);
    logger.log = (...args) => {
      if (settings2.debugLogging.value()) originalLog(...args);
    };
    logger.warn = (...args) => {
      if (settings2.debugLogging.value()) originalWarn(...args);
    };
    setRetainEnabledGetter(() => settings2.retainUnclosedPresets.value());
    registerBuiltInPresets();
    function handleAddPreset(id) {
      spawnPreset(id);
      logger.log("hud", "Spawned preset from picker:", id);
    }
    function handleCloseWidget(id) {
      closeWidget(id);
      logger.log("hud", "Closed preset from picker:", id);
    }
    function handleDeletePreset(id) {
      closeWidget(id);
      deleteCustomPreset(id);
      logger.log("hud", "Deleted custom preset:", id);
    }
    function handleCreateAdHoc() {
      openCustomTrackerBuilder({
        onCreate: ({ name, sprite }) => {
          spawnAdHocCustomTracker({
            name,
            sprite,
            onRequestSaveAsPreset: (defaultName, _spriteArg, onSaved) => {
              openSaveAsPresetPrompt(defaultName, (savedName, description) => {
                onSaved(savedName, description);
                logger.log("hud", "Saved custom tracker as preset:", savedName);
              });
            }
          });
        }
      });
    }
    function createButton(avatar) {
      const btn = document.createElement("button");
      btn.textContent = "+";
      btn.id = "dt-add-tracker-button";
      btn.title = "Click to add a tracker. Drag to reposition (double-click to reset to the default spot).";
      Object.assign(btn.style, {
        position: "fixed",
        zIndex: 8,
        width: "34px",
        height: "34px",
        borderRadius: "4px",
        background: "#2ecc71",
        color: "white",
        border: "none",
        cursor: "grab",
        fontSize: "20px",
        fontWeight: "bold",
        lineHeight: "1",
        boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
        opacity: "0"
        // hidden until we've confirmed a real position - see tryReveal() below
      });
      document.body.appendChild(btn);
      let revealed = false;
      let hasCustomPosition = false;
      function reposition() {
        if (hasCustomPosition) return true;
        const rect = avatar.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        const btnRect = btn.getBoundingClientRect();
        btn.style.left = rect.left - btnRect.width - 16 + "px";
        btn.style.top = rect.top + (rect.height - btnRect.height) / 2 + "px";
        return true;
      }
      function tryReveal() {
        let lastRect = null;
        let lastChangeTime = performance.now();
        const startTime = performance.now();
        const STABLE_MS = 200;
        const MAX_WAIT_MS = 3e3;
        function ratsMatch(a, b) {
          return a && b && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
        }
        function check() {
          const rect = avatar.getBoundingClientRect();
          const now = performance.now();
          const hasSize = rect.width > 0 || rect.height > 0;
          if (hasSize) {
            if (!ratsMatch(rect, lastRect)) {
              lastRect = rect;
              lastChangeTime = now;
            }
            const stableFor = now - lastChangeTime;
            const waitedTooLong = now - startTime > MAX_WAIT_MS;
            if (stableFor >= STABLE_MS || waitedTooLong) {
              reposition();
              revealed = true;
              btn.style.opacity = "1";
              return;
            }
          }
          requestAnimationFrame(check);
        }
        requestAnimationFrame(check);
      }
      const savedPosition = getSavedButtonPosition();
      if (savedPosition) {
        hasCustomPosition = true;
        btn.style.left = savedPosition.left + "px";
        btn.style.top = savedPosition.top + "px";
        revealed = true;
        btn.style.opacity = "1";
      } else {
        tryReveal();
      }
      function isUnderScriptMenuOpen() {
        const menu = document.querySelector('.menu-content[role="Menu"]');
        return menu !== null && menu.offsetParent !== null;
      }
      function isBlockingModalOpen() {
        return document.body.classList.contains("modal-open") || document.querySelector(".modal-backdrop") !== null || isUnderScriptMenuOpen();
      }
      let isDimmed = false;
      const syncInterval = setInterval(() => {
        if (!revealed) return;
        reposition();
        const shouldDim = isBlockingModalOpen();
        if (shouldDim !== isDimmed) {
          isDimmed = shouldDim;
          btn.style.opacity = shouldDim ? String(settings2.dimOpacity.value()) : "1";
          btn.style.pointerEvents = shouldDim ? "none" : "auto";
        }
      }, 250);
      window.addEventListener("resize", reposition);
      window.addEventListener("scroll", reposition, { passive: true, capture: true });
      const DRAG_THRESHOLD_PX = 4;
      const BTN_SIZE = 34;
      const VIEWPORT_MARGIN = 10;
      let dragging = false;
      let dragMoved = false;
      let dragOffsetX = 0;
      let dragOffsetY = 0;
      btn.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        dragging = true;
        dragMoved = false;
        const rect = btn.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        btn.style.cursor = "grabbing";
        e.preventDefault();
      });
      window.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        let newLeft = e.clientX - dragOffsetX;
        let newTop = e.clientY - dragOffsetY;
        if (!dragMoved) {
          const dx = Math.abs(newLeft - parseFloat(btn.style.left || "0"));
          const dy = Math.abs(newTop - parseFloat(btn.style.top || "0"));
          if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) dragMoved = true;
        }
        if (!dragMoved) return;
        hasCustomPosition = true;
        newLeft = Math.min(Math.max(newLeft, VIEWPORT_MARGIN - BTN_SIZE), window.innerWidth - VIEWPORT_MARGIN);
        newTop = Math.min(Math.max(newTop, VIEWPORT_MARGIN - BTN_SIZE), window.innerHeight - VIEWPORT_MARGIN);
        btn.style.left = newLeft + "px";
        btn.style.top = newTop + "px";
      });
      window.addEventListener("mouseup", () => {
        if (!dragging) return;
        dragging = false;
        btn.style.cursor = "grab";
        if (dragMoved) {
          const rect = btn.getBoundingClientRect();
          setSavedButtonPosition({ left: rect.left, top: rect.top });
          logger.log("hud", "Add-tracker button repositioned by drag.", { left: rect.left, top: rect.top });
        }
      });
      btn.addEventListener("mousedown", (e) => {
        if (e.button === 1) e.preventDefault();
      });
      btn.addEventListener("auxclick", (e) => {
        if (e.button !== 1) return;
        hasCustomPosition = false;
        clearSavedButtonPosition();
        reposition();
        logger.log("hud", "Add-tracker button position reset to the default (avatar-relative) spot.");
      });
      btn.onclick = () => {
        if (dragMoved) return;
        openPresetPicker({
          onAddPreset: handleAddPreset,
          onCreateAdHoc: handleCreateAdHoc,
          onCloseWidget: handleCloseWidget,
          onDeletePreset: handleDeletePreset
        });
      };
      return btn;
    }
    let trackerButton = null;
    waitForAvatar((avatar) => {
      trackerButton = createButton(avatar);
    });
    plugin.events.on("GameEvent", (event) => {
      dispatchGameEvent(event);
      if ((event == null ? void 0 : event.action) === "getVictory" || (event == null ? void 0 : event.action) === "getDefeat" || (event == null ? void 0 : event.action) === "getResult") {
        (trackerButton == null ? void 0 : trackerButton.style) && (trackerButton.style.display = "none");
        closeAllWidgets();
      }
    });
    function restoreFavoritedAndRetained() {
      if (isSpectating() && !settings2.allowFavoritedRetainedWhileSpectating.value()) return;
      const favoritedIds = getFavoritedPresetIds();
      const spawnedFavorites = favoritedIds.filter((id) => spawnPreset(id) !== null);
      if (spawnedFavorites.length) {
        logger.log("autoload", "Spawned favorited presets.", spawnedFavorites);
      }
      if (spawnedFavorites.length < favoritedIds.length) {
        logger.warn(
          "autoload",
          "Some favorited presets could not be spawned (missing definition).",
          favoritedIds.filter((id) => !spawnedFavorites.includes(id))
        );
      }
      if (settings2.retainUnclosedPresets.value()) {
        const retainedIds = getRetainedPresetIds().filter((id) => !favoritedIds.includes(id));
        retainedIds.forEach((id) => spawnPreset(id));
        if (retainedIds.length) {
          logger.log("autoload", "Restored retained (unclosed) presets.", retainedIds);
        }
      }
    }
    plugin.events.on("GameStart", () => {
      if (trackerButton == null ? void 0 : trackerButton.style) trackerButton.style.display = "";
      restoreFavoritedAndRetained();
    });
    plugin.events.on("connect", (data) => {
      restoreFavoritedAndRetained();
    });
  }

  // packages/uc-tv/divisions.js
  var DIVISION_TIERS = [
    { name: "LEGEND", subTiers: false },
    { name: "ULTIMATE_MASTER", subTiers: false },
    { name: "HIGH_MASTER", subTiers: false },
    { name: "MASTER", subTiers: false },
    { name: "DIAMOND", subTiers: true },
    { name: "EMERALD", subTiers: true },
    { name: "GOLD", subTiers: true },
    { name: "IRON", subTiers: true },
    { name: "COPPER", subTiers: true }
  ];
  var DIVISION_SCORES = {};
  var SUB_TIER_SCORE = { I: 0, II: 1, III: 2 };
  DIVISION_TIERS.forEach((tier, tierIndex) => {
    if (tier.subTiers) {
      Object.keys(SUB_TIER_SCORE).forEach((numeral) => {
        DIVISION_SCORES[`${tier.name}_${numeral}`] = tierIndex * 10 + SUB_TIER_SCORE[numeral];
      });
    } else {
      DIVISION_SCORES[tier.name] = tierIndex * 10;
    }
  });
  function divisionIconUrl(rank) {
    return rank ? `/images/divisions/${rank}.png` : null;
  }
  function rankScore(rank) {
    return rank && Object.prototype.hasOwnProperty.call(DIVISION_SCORES, rank) ? DIVISION_SCORES[rank] : null;
  }
  function minTierThresholdScore(tierName) {
    const tier = DIVISION_TIERS.find((t) => t.name === tierName);
    if (!tier) return null;
    return tier.subTiers ? DIVISION_SCORES[`${tierName}_III`] : DIVISION_SCORES[tierName];
  }

  // packages/uc-tv/settings.js
  var LOG = "[UC TV]";
  var KNOWN_MODES = ["RANKED", "STANDARD", "CUSTOM", "CPU", "STORY"];
  function titleCase(name) {
    return name.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
  }
  var settingsRef = null;
  function setSettingsRef(ref) {
    settingsRef = ref;
  }
  function registerUcTvSettings(plugin, divisionTiers) {
    const settings2 = createFeatureSettings(plugin, "ucTv", "UC TV");
    const enabled = settings2.add("enabled", {
      name: "Enable UC TV",
      type: "boolean",
      default: true,
      page: "Spectate"
    });
    const debugLogs = settings2.add("debugLogs", {
      name: "Enable Debug Logs",
      type: "boolean",
      default: false,
      page: "Spectate"
    });
    const autoMode = settings2.add("autoMode", {
      name: "Enable auto-mode when spectating",
      type: "boolean",
      default: false,
      page: "Spectate"
    });
    const countdownSeconds = settings2.add("countdownSeconds", {
      name: "Auto-continue delay (seconds)",
      type: "select",
      data: Array.from({ length: 15 }, (_, i) => i + 1).map((n) => [`${n}`, n]),
      default: 5,
      page: "Spectate"
    });
    if (!enabled.value()) {
      return {
        enabled,
        debugLogs,
        autoMode,
        countdownSeconds,
        filteringEnabled: null,
        modeToggles: {},
        minLevel: null,
        levelFilterMode: null,
        minRankTier: null,
        rankFilterMode: null
      };
    }
    const FILTER_CATEGORY = "UC TV - Filter Settings";
    const filteringEnabled = settings2.add("filteringEnabled", {
      name: "Enable Match Filtering",
      type: "boolean",
      default: true,
      category: FILTER_CATEGORY,
      page: "Spectate"
    });
    const modeToggles = {};
    KNOWN_MODES.forEach((mode) => {
      modeToggles[mode] = settings2.add(`ignoreMode${mode}`, {
        name: `Ignore ${titleCase(mode)} Matches?`,
        type: "select",
        data: [["Yes", "yes"], ["No", "no"]],
        default: "no",
        category: FILTER_CATEGORY,
        page: "Spectate"
      });
    });
    const minLevel = settings2.add("minLevel", {
      name: "Minimum Player Level",
      type: "select",
      data: [
        ["No minimum", 0],
        ["1", 1],
        ["50", 50],
        ["100", 100],
        ["200", 200],
        ["400", 400],
        ["600", 600],
        ["800", 800],
        ["1000", 1e3]
      ],
      default: 0,
      category: FILTER_CATEGORY,
      page: "Spectate"
    });
    const levelFilterMode = settings2.add("levelFilterMode", {
      name: "Minimum Level Applies To",
      type: "select",
      data: [["Either player", "either"], ["Both players", "both"]],
      default: "either",
      category: FILTER_CATEGORY,
      page: "Spectate"
    });
    const minRankTier = settings2.add("minRankTier", {
      name: "Minimum Ranked Mode Level",
      type: "select",
      data: divisionTiers.map((t) => [titleCase(t.name), t.name]),
      default: "COPPER",
      category: FILTER_CATEGORY,
      page: "Spectate"
    });
    const rankFilterMode = settings2.add("rankFilterMode", {
      name: "Minimum Rank Applies To",
      type: "select",
      data: [["Either player", "either"], ["Both players", "both"]],
      default: "either",
      category: FILTER_CATEGORY,
      page: "Spectate"
    });
    return {
      enabled,
      debugLogs,
      filteringEnabled,
      modeToggles,
      minLevel,
      levelFilterMode,
      minRankTier,
      rankFilterMode,
      autoMode,
      countdownSeconds
    };
  }
  var CONFIG = {
    get masterEnabled() {
      return settingsRef ? settingsRef.enabled.value() : true;
    },
    get debugLogs() {
      return settingsRef && settingsRef.debugLogs ? settingsRef.debugLogs.value() : false;
    },
    get filteringEnabled() {
      return settingsRef && settingsRef.filteringEnabled ? settingsRef.filteringEnabled.value() : true;
    },
    get disabledModes() {
      if (!settingsRef || !settingsRef.modeToggles) return [];
      return KNOWN_MODES.filter((mode) => settingsRef.modeToggles[mode] && settingsRef.modeToggles[mode].value() === "yes");
    },
    get minLevel() {
      return settingsRef && settingsRef.minLevel ? settingsRef.minLevel.value() : 0;
    },
    get levelFilterMode() {
      return settingsRef && settingsRef.levelFilterMode ? settingsRef.levelFilterMode.value() : "either";
    },
    get minRankTier() {
      return settingsRef && settingsRef.minRankTier ? settingsRef.minRankTier.value() : "COPPER";
    },
    get rankFilterMode() {
      return settingsRef && settingsRef.rankFilterMode ? settingsRef.rankFilterMode.value() : "either";
    },
    get autoMode() {
      return settingsRef && settingsRef.autoMode ? settingsRef.autoMode.value() : false;
    },
    get countdownSeconds() {
      return settingsRef && settingsRef.countdownSeconds ? settingsRef.countdownSeconds.value() : 5;
    }
  };
  function logDebug(...args) {
    if (CONFIG.debugLogs) console.log(LOG, ...args);
  }
  function dumpSettingsState() {
    const snapshot = {
      masterEnabled: CONFIG.masterEnabled,
      debugLogs: CONFIG.debugLogs,
      filteringEnabled: CONFIG.filteringEnabled,
      disabledModes: CONFIG.disabledModes,
      minLevel: CONFIG.minLevel,
      levelFilterMode: CONFIG.levelFilterMode,
      minRankTier: CONFIG.minRankTier,
      rankFilterMode: CONFIG.rankFilterMode,
      autoMode: CONFIG.autoMode,
      countdownSeconds: CONFIG.countdownSeconds
    };
    console.log(`${LOG} [settings] Current live values:`, snapshot);
    return snapshot;
  }

  // packages/uc-tv/game-list.js
  var ONCLICK_RE = /Spectate\?gameId=(\d+)&playerId=(\d+)/;
  function readMode(row) {
    const cell = row.querySelector("td.home-match-time");
    if (!cell) return null;
    const extra = Array.from(cell.classList).find((c) => c !== "home-match-time");
    return extra || null;
  }
  function readTimeText(row) {
    const cell = row.querySelector("td.home-match-time");
    return cell ? cell.textContent.trim() : null;
  }
  function parseElapsedSeconds(timeText) {
    if (!timeText) return null;
    const parts = timeText.split(":").map(Number);
    if (parts.some((n) => Number.isNaN(n))) return null;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return null;
  }
  function readPlayerInfoSpan(cell) {
    return cell.querySelector(".playerInfo > span");
  }
  function readUsername(cell) {
    const soulSpan = readPlayerInfoSpan(cell);
    if (!soulSpan) return null;
    const clone = soulSpan.cloneNode(true);
    const nestedLevel = clone.querySelector("span");
    if (nestedLevel) nestedLevel.remove();
    const text = clone.textContent.replace(/\s+/g, " ").trim();
    return text || null;
  }
  function readSoul(cell) {
    const soulSpan = readPlayerInfoSpan(cell);
    return soulSpan ? soulSpan.className.trim() || null : null;
  }
  function readDivision(cell) {
    const span = cell.querySelector('span[data-i18n*="DIVISION"]');
    if (!span) return null;
    const raw = span.getAttribute("data-i18n") || "";
    const match = raw.match(/DIVISION:([A-Z_]+)/);
    return match ? match[1] : null;
  }
  function readPlayerCell(cell) {
    const m = (cell.getAttribute("onclick") || "").match(ONCLICK_RE);
    if (!m) return null;
    const levelMatch = cell.textContent.match(/LV\s*(\d+)/);
    const level = levelMatch ? parseInt(levelMatch[1], 10) : null;
    return { gameId: m[1], playerId: m[2], level, rank: readDivision(cell) };
  }
  function readPlayerCellFull(cell) {
    const m = (cell.getAttribute("onclick") || "").match(ONCLICK_RE);
    if (!m) return null;
    const levelMatch = cell.textContent.match(/LV\s*(\d+)/);
    return {
      gameId: m[1],
      playerId: m[2],
      username: readUsername(cell),
      soul: readSoul(cell),
      level: levelMatch ? parseInt(levelMatch[1], 10) : null,
      // e.g. "EMERALD_III", "MASTER", or null if unranked/no badge.
      rank: readDivision(cell)
    };
  }
  function parseRow(row) {
    const cells = Array.from(row.querySelectorAll("td.spectate-player"));
    const players = cells.map(readPlayerCell).filter(Boolean);
    if (!players.length) return null;
    const mode = readMode(row);
    const preferred = players.find((p) => p.level !== null) || players[0];
    return {
      gameId: players[0].gameId,
      playerId: preferred.playerId,
      mode,
      time: readTimeText(row),
      levels: players.map((p) => p.level),
      // e.g. [580, null] for a CPU match
      ranks: players.map((p) => p.rank)
      // e.g. ["EMERALD_III", null]
    };
  }
  function parseRowFull(row) {
    const cells = Array.from(row.querySelectorAll("td.spectate-player"));
    const players = cells.map(readPlayerCellFull).filter(Boolean);
    if (!players.length) return null;
    return {
      gameId: players[0].gameId,
      mode: readMode(row),
      time: readTimeText(row),
      players
    };
  }
  async function fetchHomepageDoc() {
    const res = await fetch("/", { credentials: "same-origin" });
    if (!res.ok) throw new Error(`Homepage fetch failed: ${res.status}`);
    const html = await res.text();
    return new DOMParser().parseFromString(html, "text/html");
  }
  var ROW_SELECTOR = "table.spectateTable tbody tr, #liste table tbody tr";
  async function fetchLiveGames() {
    const doc = await fetchHomepageDoc();
    const rows = Array.from(doc.querySelectorAll(ROW_SELECTOR));
    return rows.map(parseRow).filter(Boolean);
  }
  async function fetchLiveGamesFull() {
    const doc = await fetchHomepageDoc();
    const rows = Array.from(doc.querySelectorAll(ROW_SELECTOR));
    return rows.map(parseRowFull).filter(Boolean);
  }

  // packages/uc-tv/filters.js
  function isModeAllowed(mode) {
    if (!CONFIG.filteringEnabled) return true;
    if (!mode) return true;
    return !CONFIG.disabledModes.includes(mode);
  }
  function levelsPass(levels) {
    if (!CONFIG.filteringEnabled) return true;
    if (!CONFIG.minLevel || CONFIG.minLevel <= 0) return true;
    if (CONFIG.levelFilterMode === "both") {
      return levels.every((l) => l !== null && l >= CONFIG.minLevel);
    }
    return levels.some((l) => l !== null && l >= CONFIG.minLevel);
  }
  function rankMeetsMin(rank) {
    if (!CONFIG.minRankTier || CONFIG.minRankTier === "COPPER") return true;
    const threshold = minTierThresholdScore(CONFIG.minRankTier);
    if (threshold === null) return true;
    const score = rankScore(rank);
    if (score === null) return false;
    return score <= threshold;
  }
  function ranksPass(ranks, mode) {
    if (!CONFIG.filteringEnabled) return true;
    if (mode !== "RANKED") return true;
    if (!CONFIG.minRankTier || CONFIG.minRankTier === "COPPER") return true;
    if (CONFIG.rankFilterMode === "both") {
      return ranks.every(rankMeetsMin);
    }
    return ranks.some(rankMeetsMin);
  }
  function applyFilters(games) {
    let pool = games;
    const modeAllowed = pool.filter((g) => isModeAllowed(g.mode));
    if (modeAllowed.length) pool = modeAllowed;
    if (CONFIG.minLevel > 0) {
      const meetsLevel = pool.filter((g) => levelsPass(g.levels));
      if (meetsLevel.length) pool = meetsLevel;
    }
    if (CONFIG.minRankTier) {
      const meetsRank = pool.filter((g) => ranksPass(g.ranks, g.mode));
      if (meetsRank.length) pool = meetsRank;
    }
    return pool;
  }

  // packages/uc-tv/countdown.js
  var activeCancelFn = null;
  function cancelActiveCountdown() {
    if (activeCancelFn) activeCancelFn();
  }
  function showCountdown(plugin, seconds, onComplete) {
    if (plugin && typeof plugin.toast === "function") {
      showCountdownViaToast(plugin, seconds, onComplete);
    } else {
      console.warn(`${LOG} plugin.toast not available - falling back to a custom overlay.`);
      showCountdownOverlay(seconds, onComplete);
    }
  }
  function cancelHint() {
    return `Cancel by pressing ${getPrimaryKeyDisplay()}`;
  }
  function showCountdownViaToast(plugin, seconds, onComplete) {
    let remaining = seconds;
    const toast = plugin.toast({
      title: "UC TV",
      text: `Spectating a new match in ${remaining}s... (${cancelHint()})`
    });
    function cancel() {
      clearInterval(interval);
      activeCancelFn = null;
      if (toast && typeof toast.setText === "function") toast.setText("Auto-continue canceled.");
      if (toast && typeof toast.close === "function") setTimeout(() => toast.close(), 1500);
      logDebug("Auto-continue canceled - Primary pressed during countdown.");
    }
    activeCancelFn = cancel;
    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        activeCancelFn = null;
        if (toast && typeof toast.close === "function") toast.close();
        onComplete();
        return;
      }
      if (toast && typeof toast.setText === "function") {
        toast.setText(`Spectating a new match in ${remaining}s... (${cancelHint()})`);
      }
    }, 1e3);
  }
  function showCountdownOverlay(seconds, onComplete) {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 999999;
    background: rgba(20,20,20,0.9);
    color: #fff;
    padding: 10px 16px;
    border-radius: 6px;
    font-family: Arial, sans-serif;
    font-size: 13px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  `;
    document.body.appendChild(overlay);
    let remaining = seconds;
    let canceled = false;
    function cancel() {
      if (canceled) return;
      canceled = true;
      activeCancelFn = null;
      overlay.textContent = `${LOG} Auto-continue canceled.`;
      setTimeout(() => overlay.remove(), 1500);
    }
    activeCancelFn = cancel;
    (function tick() {
      if (canceled) return;
      overlay.textContent = `${LOG} Spectating a new match in ${remaining}s... (${cancelHint()})`;
      if (remaining <= 0) {
        activeCancelFn = null;
        overlay.remove();
        onComplete();
        return;
      }
      remaining -= 1;
      setTimeout(tick, 1e3);
    })();
  }

  // packages/uc-tv/utils.js
  var SCRIPT_START = Date.now();
  var NAV_COOLDOWN_MS = 1e3;
  function navigationReady() {
    return Date.now() - SCRIPT_START >= NAV_COOLDOWN_MS;
  }

  // packages/uc-tv/channel-switch.js
  function isSpectatePage() {
    return matchesPage({ prefix: "/Spectate" });
  }
  async function goToNextMatch(plugin) {
    let games;
    try {
      games = await fetchLiveGames();
    } catch (e) {
      console.warn(`${LOG} Failed to fetch the live games list - staying put.`, e);
      return;
    }
    const currentGameId = new URLSearchParams(location.search).get("gameId");
    const candidates = games.filter((g) => g.gameId !== currentGameId);
    const pool = applyFilters(candidates);
    if (!pool.length) {
      logDebug("No other live matches found right now - staying put.");
      return;
    }
    const sorted = [...pool].sort((a, b) => {
      const ta = parseElapsedSeconds(a.time);
      const tb = parseElapsedSeconds(b.time);
      if (ta === null && tb === null) return 0;
      if (ta === null) return 1;
      if (tb === null) return -1;
      return ta - tb;
    });
    const next = sorted[0];
    logDebug(`Chose gameId=${next.gameId}, playerId=${next.playerId}, elapsed=${next.time} (levels: ${next.levels.join(", ")}). ${pool.length} candidate(s) considered.`);
    showCountdown(plugin, CONFIG.countdownSeconds, () => {
      location.href = `/Spectate?gameId=${next.gameId}&playerId=${next.playerId}`;
    });
  }
  var switching = false;
  async function switchChannel(plugin, direction) {
    if (switching) return;
    if (!navigationReady()) return;
    switching = true;
    try {
      let games;
      try {
        games = await fetchLiveGames();
      } catch (e) {
        console.warn(`${LOG} [channel] Failed to fetch live games:`, e);
        return;
      }
      const pool = applyFilters(games);
      if (!pool.length) {
        logDebug("[channel] No games available to switch to.");
        return;
      }
      const currentGameId = new URLSearchParams(location.search).get("gameId");
      const currentIndex = pool.findIndex((g) => g.gameId === currentGameId);
      let targetIndex;
      if (currentIndex === -1) {
        targetIndex = direction > 0 ? 0 : pool.length - 1;
      } else {
        targetIndex = ((currentIndex + direction) % pool.length + pool.length) % pool.length;
      }
      const target = pool[targetIndex];
      logDebug(`[channel] Switching to gameId=${target.gameId} (slot ${targetIndex + 1}/${pool.length}).`);
      if (plugin && typeof plugin.toast === "function") {
        plugin.toast({ title: "UC TV", text: `Channel ${targetIndex + 1}/${pool.length}` });
      }
      location.href = `/Spectate?gameId=${target.gameId}&playerId=${target.playerId}`;
    } finally {
      switching = false;
    }
  }
  function bindChannelKeybinds(plugin) {
    registerKeybind(plugin, {
      key: "previousChannel",
      name: "Previous Channel",
      defaultCode: "ArrowLeft",
      scope: "global",
      packageLabel: "UC TV",
      // Relies on guardTypingContext's default (true) - Ctrl+Left/Right
      // is a native "jump a word" shortcut while typing (e.g. in chat),
      // and this default preserves that. Unlike Patch Maker's own
      // shortcuts, which deliberately opt OUT of this default since they
      // need to fire while a text field is focused.
      onMatch: () => {
        if (!isSpectatePage()) return;
        if (!CONFIG.masterEnabled) return;
        switchChannel(plugin, -1);
      }
    });
    registerKeybind(plugin, {
      key: "nextChannel",
      name: "Next Channel",
      defaultCode: "ArrowRight",
      scope: "global",
      packageLabel: "UC TV",
      onMatch: () => {
        if (!isSpectatePage()) return;
        if (!CONFIG.masterEnabled) return;
        switchChannel(plugin, 1);
      }
    });
  }

  // packages/uc-tv/channel-guide.js
  function isSpectatePage2() {
    return matchesPage({ prefix: "/Spectate" });
  }
  var SOUL_COLORS2 = {
    DETERMINATION: "#ff4d4d",
    BRAVERY: "#ffb03b",
    JUSTICE: "#ffe75e",
    KINDNESS: "#4ddb4d",
    PATIENCE: "#4dd9e8",
    INTEGRITY: "#4d7bff",
    PERSEVERANCE: "#b366ff"
  };
  var MODE_COLORS = {
    RANKED: "#4dd9e8",
    STANDARD: "#7ee787",
    CUSTOM: "#b366ff",
    CPU: "#666666",
    STORY: "#ffb03b"
  };
  var LEGEND_MODES = ["RANKED", "STANDARD", "CUSTOM", "CPU", "STORY"];
  function soulColor(soul) {
    return SOUL_COLORS2[soul] || "#cfd8e3";
  }
  function modeColor(mode) {
    return MODE_COLORS[mode] || "#4dd9e8";
  }
  function jumpTo(plugin, gameId, playerId) {
    if (!navigationReady()) {
      if (plugin && typeof plugin.toast === "function") {
        plugin.toast({ title: "UC TV", text: "Still loading - try again in a moment." });
      }
      return;
    }
    location.href = `/Spectate?gameId=${gameId}&playerId=${playerId}`;
  }
  var GUIDE_FONT = "12px 'DTM-Mono', monospace";
  var GUIDE_MIN_WIDTH = 300;
  var GUIDE_MAX_WIDTH = 480;
  var GUIDE_VISIBLE_ROWS = 10;
  var GUIDE_ROW_HEIGHT_PX = 30;
  var GUIDE_CHROME_HEIGHT_PX = 70;
  var GUIDE_POSITION = "bottom-right";
  var RANK_ICON_WIDTH_PX = 14;
  function estimateWidestRowWidth(list) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = GUIDE_FONT;
    let max = 0;
    list.forEach((entry) => {
      let text = "";
      let iconWidth = 0;
      entry.players.forEach((p, i) => {
        if (i > 0) text += " vs ";
        text += `\u2665 ${p.username || "?"}${p.level !== null ? ` LV ${p.level}` : ""}`;
        if (entry.mode === "RANKED" && p.rank) iconWidth += RANK_ICON_WIDTH_PX;
      });
      text += `   ${entry.time || ""}`;
      const width = ctx.measureText(text).width + iconWidth;
      if (width > max) max = width;
    });
    return max;
  }
  var guideOverlay = null;
  var guideLoading = false;
  async function showChannelGuide(plugin) {
    if (guideOverlay || guideLoading) return;
    guideLoading = true;
    let entries;
    try {
      entries = await fetchLiveGamesFull();
    } catch (e) {
      console.warn("[UC TV] [guide] Failed to fetch live games:", e);
      guideLoading = false;
      return;
    }
    const filtered = entries.filter(
      (entry) => isModeAllowed(entry.mode) && levelsPass(entry.players.map((p) => p.level)) && ranksPass(entry.players.map((p) => p.rank), entry.mode)
    );
    const list = filtered.length ? filtered : entries;
    const currentGameId = new URLSearchParams(location.search).get("gameId");
    const targetWidth = Math.min(GUIDE_MAX_WIDTH, Math.max(GUIDE_MIN_WIDTH, estimateWidestRowWidth(list) + 55));
    const targetHeight = GUIDE_VISIBLE_ROWS * GUIDE_ROW_HEIGHT_PX + GUIDE_CHROME_HEIGHT_PX;
    const positionCSS = GUIDE_POSITION === "center-right" ? "top: 50%; right: 16px; transform: translateY(-50%);" : "bottom: 90px; right: 16px;";
    const overlay = document.createElement("div");
    overlay.id = "uctv-guide-overlay";
    overlay.style.cssText = `
    position: fixed;
    ${positionCSS}
    z-index: 999999;
    width: ${targetWidth}px;
    max-height: ${targetHeight}px;
    overflow-y: auto;
    background: rgba(5, 8, 16, 0.94);
    border: 1px solid rgba(77, 217, 232, 0.4);
    border-radius: 6px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.75);
    font-family: 'DTM-Mono', monospace;
    font-size: 12px;
    color: #d7e6f2;
    padding: 6px;
  `;
    const header = document.createElement("div");
    header.textContent = `UC TV Guide - ${list.length} shown | release ${getPrimaryKeyDisplay()} to close`;
    header.style.cssText = `
    font-size: 12px;
    letter-spacing: 0.5px;
    color: #4dd9e8;
    padding: 4px 6px 8px;
    border-bottom: 1px solid rgba(77,217,232,0.25);
    margin-bottom: 4px;
  `;
    overlay.appendChild(header);
    list.forEach((entry) => {
      const isCurrent = entry.gameId === currentGameId;
      const row = document.createElement("div");
      row.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 6px;
      margin-bottom: 2px;
      border-left: 3px solid ${modeColor(entry.mode)};
      background: ${isCurrent ? "rgba(77,217,232,0.12)" : "rgba(255,255,255,0.03)"};
      border-radius: 2px;
    `;
      entry.players.forEach((p, i) => {
        if (i > 0) {
          const divider = document.createElement("span");
          divider.textContent = "vs";
          divider.style.cssText = "opacity:0.35; font-size:11px; flex-shrink:0;";
          row.appendChild(divider);
        }
        const playerEl = document.createElement("span");
        playerEl.style.cssText = `
        flex: 0 1 auto;
        max-width: 46%;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
      `;
        const showRankIcon = entry.mode === "RANKED" && p.rank;
        const rankIcon = document.createElement("img");
        if (showRankIcon) {
          rankIcon.src = divisionIconUrl(p.rank);
          rankIcon.alt = p.rank;
          rankIcon.title = p.rank.replace(/_/g, " ");
          rankIcon.style.cssText = "height:12px; vertical-align:middle; margin-right:2px;";
        }
        const heart = document.createElement("span");
        heart.textContent = "\u2665 ";
        heart.style.color = soulColor(p.soul);
        const name = document.createElement("span");
        name.textContent = p.username || "?";
        name.style.color = soulColor(p.soul);
        name.style.fontWeight = "bold";
        const lvl = document.createElement("span");
        lvl.textContent = p.level !== null ? ` LV ${p.level}` : "";
        lvl.style.cssText = "color:#6fa8ff; opacity:0.9;";
        if (showRankIcon) playerEl.appendChild(rankIcon);
        playerEl.append(heart, name, lvl);
        playerEl.addEventListener("mouseenter", () => {
          playerEl.style.textDecoration = "underline";
        });
        playerEl.addEventListener("mouseleave", () => {
          playerEl.style.textDecoration = "none";
        });
        playerEl.addEventListener("click", () => {
          logDebug(`[guide] Jumping to gameId=${entry.gameId}, playerId=${p.playerId}.`);
          jumpTo(plugin, entry.gameId, p.playerId);
        });
        row.appendChild(playerEl);
      });
      const timeEl = document.createElement("span");
      timeEl.textContent = entry.time || "";
      timeEl.style.cssText = "color:#7dffb0; font-size:12px; flex-shrink:0; margin-left:4px;";
      row.appendChild(timeEl);
      overlay.appendChild(row);
    });
    const legend = document.createElement("div");
    legend.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 8px 6px 4px;
    margin-top: 4px;
    border-top: 1px solid rgba(77,217,232,0.25);
    font-size: 11px;
  `;
    LEGEND_MODES.forEach((mode) => {
      const item = document.createElement("span");
      item.style.cssText = "display:flex; align-items:center; gap:4px; opacity:0.85;";
      const swatch = document.createElement("span");
      swatch.style.cssText = `width:9px; height:9px; border-radius:2px; background:${MODE_COLORS[mode]}; flex-shrink:0;`;
      const label = document.createElement("span");
      label.textContent = mode;
      item.append(swatch, label);
      legend.appendChild(item);
    });
    overlay.appendChild(legend);
    overlay.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      overlay.scrollTop += delta;
    }, { passive: false });
    document.body.appendChild(overlay);
    guideOverlay = overlay;
    guideLoading = false;
  }
  function hideChannelGuide() {
    if (guideOverlay) {
      guideOverlay.remove();
      guideOverlay = null;
    }
  }
  function bindChannelGuideKeybinds(plugin) {
    registerKeybind(plugin, {
      key: "channelGuide",
      name: "Open Channel Guide",
      scope: "global",
      packageLabel: "UC TV",
      // Fires the instant Primary goes down, not gated behind
      // confirming a hold first - this is what makes a simple tap
      // cancel the auto-continue countdown, rather than needing to hold
      // Primary the same way opening the guide does.
      onPrimaryPress: () => {
        if (!isSpectatePage2()) return;
        if (!CONFIG.masterEnabled) return;
        cancelActiveCountdown();
      },
      onPrimaryAlone: () => {
        if (!isSpectatePage2()) return;
        if (!CONFIG.masterEnabled) return;
        showChannelGuide(plugin);
      },
      onPrimaryRelease: () => {
        if (!isSpectatePage2()) return;
        hideChannelGuide();
      }
    });
  }

  // packages/uc-tv/debug.js
  async function scopeActiveGames() {
    let scoped;
    try {
      scoped = await fetchLiveGamesFull();
    } catch (e) {
      console.error(`${LOG} [scope] Failed to fetch homepage:`, e);
      return [];
    }
    console.log(`${LOG} [scope] ${scoped.length} active game(s).`);
    console.table(scoped.flatMap((g) => g.players.map((p) => ({
      gameId: g.gameId,
      mode: g.mode,
      time: g.time,
      playerId: p.playerId,
      username: p.username,
      soul: p.soul,
      level: p.level,
      rank: p.rank
    }))));
    return scoped;
  }

  // packages/uc-tv/index.js
  function isSpectatePage3() {
    return matchesPage({ prefix: "/Spectate" });
  }
  function initUcTv(plugin) {
    const settings2 = registerUcTvSettings(plugin, DIVISION_TIERS);
    setSettingsRef(settings2);
    console.log("[UC TV] Settings registered.");
    dumpSettingsState();
    window.__ucTVScope = scopeActiveGames;
    window.__ucTVSettings = dumpSettingsState;
    bindChannelKeybinds(plugin);
    bindChannelGuideKeybinds(plugin);
    logDebug("Channel switching and channel guide keybinds registered (see the Keybinds settings category).");
    if (!isSpectatePage3()) return;
    let handled = false;
    plugin.events.on("getResult", (data) => {
      logDebug("getResult fired - match ended.", data);
      if (handled) return;
      handled = true;
      if (!CONFIG.masterEnabled) {
        logDebug("Enable UC TV is off - staying put.");
        return;
      }
      if (!CONFIG.autoMode) {
        logDebug("Auto-mode is off - staying put.");
        return;
      }
      goToNextMatch(plugin);
    });
  }

  // packages/misc/settings.js
  function registerMiscSettings(plugin) {
    const settings2 = createFeatureSettings(plugin, "misc", "Miscellaneous");
    const enableNotepad = settings2.add("enableNotepad", {
      name: "Enable Notepad Overlay Option",
      type: "boolean",
      default: false
    });
    const enableController = settings2.add("enableController", {
      name: "Enable Controller Support",
      type: "boolean",
      default: false
    });
    return { settings: settings2, enableNotepad, enableController };
  }

  // packages/misc/notepad/storage.js
  var POSITION_KEY = "wizascript.misc.notepad.position";
  var DRAWING_KEY = "wizascript.misc.notepad.drawing";
  var PEN_COLOR_KEY = "wizascript.misc.notepad.penColor";
  var RECENT_COLORS_KEY = "wizascript.misc.notepad.recentColors";
  var TITLE_KEY = "wizascript.misc.notepad.title";
  function readJSON(key, fallback) {
    try {
      const raw = GM_getValue(key, null);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn("[Notepad] Failed to read storage key", key, e);
      return fallback;
    }
  }
  function writeJSON(key, value) {
    try {
      GM_setValue(key, JSON.stringify(value));
    } catch (e) {
      console.warn("[Notepad] Failed to write storage key", key, e);
    }
  }
  function getSavedPosition2() {
    return readJSON(POSITION_KEY, null);
  }
  function setSavedPosition2(layout) {
    writeJSON(POSITION_KEY, layout);
  }
  function clearSavedPosition2() {
    try {
      GM_deleteValue(POSITION_KEY);
    } catch (e) {
    }
  }
  function getSavedDrawing() {
    return readJSON(DRAWING_KEY, null);
  }
  function setSavedDrawing(drawing) {
    writeJSON(DRAWING_KEY, drawing);
  }
  function clearSavedDrawing() {
    try {
      GM_deleteValue(DRAWING_KEY);
    } catch (e) {
    }
  }
  function getSavedPenColor() {
    return readJSON(PEN_COLOR_KEY, null);
  }
  function setSavedPenColor(state) {
    writeJSON(PEN_COLOR_KEY, state);
  }
  function clearSavedPenColor() {
    try {
      GM_deleteValue(PEN_COLOR_KEY);
    } catch (e) {
    }
  }
  function getRecentColors() {
    return readJSON(RECENT_COLORS_KEY, []);
  }
  function setRecentColors(list) {
    writeJSON(RECENT_COLORS_KEY, list);
  }
  function clearRecentColors() {
    try {
      GM_deleteValue(RECENT_COLORS_KEY);
    } catch (e) {
    }
  }
  function getSavedTitle() {
    return readJSON(TITLE_KEY, null);
  }
  function setSavedTitle(title) {
    writeJSON(TITLE_KEY, title);
  }
  function clearSavedTitle() {
    try {
      GM_deleteValue(TITLE_KEY);
    } catch (e) {
    }
  }

  // packages/misc/notepad/widget.js
  var DEFAULT_RIGHT = 16;
  var DEFAULT_BOTTOM = 16;
  var DEFAULT_TITLE = "Notepad";
  var TITLE_SAVE_DEBOUNCE_MS = 400;
  function buildNotepadShell(signal) {
    const root = document.createElement("div");
    root.className = "wizascript-notepad";
    const savedLayout = getSavedPosition2();
    if (savedLayout) {
      root.style.left = savedLayout.left + "px";
      root.style.top = savedLayout.top + "px";
    } else {
      root.style.right = DEFAULT_RIGHT + "px";
      root.style.bottom = DEFAULT_BOTTOM + "px";
    }
    const header = document.createElement("div");
    header.className = "wizascript-notepad-header";
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.className = "wizascript-notepad-title-input";
    titleInput.maxLength = 60;
    titleInput.spellcheck = false;
    titleInput.value = getSavedTitle() || DEFAULT_TITLE;
    titleInput.addEventListener("mousedown", (e) => e.stopPropagation(), { signal });
    let titleSaveTimer = null;
    titleInput.addEventListener("input", () => {
      clearTimeout(titleSaveTimer);
      titleSaveTimer = setTimeout(() => {
        setSavedTitle(titleInput.value.trim() || DEFAULT_TITLE);
      }, TITLE_SAVE_DEBOUNCE_MS);
    }, { signal });
    const headerButtons = document.createElement("span");
    headerButtons.className = "wizascript-notepad-header-buttons";
    header.append(titleInput, headerButtons);
    const body = document.createElement("div");
    body.className = "wizascript-notepad-body";
    root.append(header, body);
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;
    header.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      dragging = true;
      const rect = root.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      header.style.cursor = "grabbing";
      e.preventDefault();
    }, { signal });
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      root.style.left = e.clientX - offsetX + "px";
      root.style.top = e.clientY - offsetY + "px";
      root.style.right = "auto";
      root.style.bottom = "auto";
    }, { signal });
    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      header.style.cursor = "grab";
      const rect = root.getBoundingClientRect();
      setSavedPosition2({ left: rect.left, top: rect.top });
    }, { signal });
    return { root, header, body, headerButtons, titleInput };
  }

  // packages/misc/notepad/flood-fill.js
  function floodFillPixels(data, width, height, startX, startY, fillRgb, tolerance = 24) {
    const x0 = Math.floor(startX);
    const y0 = Math.floor(startY);
    if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return false;
    const idx = (x, y) => (y * width + x) * 4;
    const startI = idx(x0, y0);
    const startR = data[startI], startG = data[startI + 1], startB = data[startI + 2], startA = data[startI + 3];
    const [fr, fg, fb] = fillRgb;
    const fa = 255;
    if (startR === fr && startG === fg && startB === fb && startA === fa) return false;
    function matchesStart(i) {
      return Math.abs(data[i] - startR) <= tolerance && Math.abs(data[i + 1] - startG) <= tolerance && Math.abs(data[i + 2] - startB) <= tolerance && Math.abs(data[i + 3] - startA) <= tolerance;
    }
    const visited = new Uint8Array(width * height);
    const stack = [x0, y0];
    visited[y0 * width + x0] = 1;
    let filledAny = false;
    const filledCoords = [];
    while (stack.length) {
      const y = stack.pop();
      const x = stack.pop();
      const i = idx(x, y);
      data[i] = fr;
      data[i + 1] = fg;
      data[i + 2] = fb;
      data[i + 3] = fa;
      filledAny = true;
      filledCoords.push(x, y);
      if (x > 0) tryPush(x - 1, y);
      if (x < width - 1) tryPush(x + 1, y);
      if (y > 0) tryPush(x, y - 1);
      if (y < height - 1) tryPush(x, y + 1);
    }
    function tryPush(nx, ny) {
      const vIdx = ny * width + nx;
      if (visited[vIdx]) return;
      if (!matchesStart(idx(nx, ny))) return;
      visited[vIdx] = 1;
      stack.push(nx, ny);
    }
    if (filledAny) {
      for (let n = 0; n < filledCoords.length; n += 2) {
        const x = filledCoords[n], y = filledCoords[n + 1];
        growIntoSeam(x - 1, y);
        growIntoSeam(x + 1, y);
        growIntoSeam(x, y - 1);
        growIntoSeam(x, y + 1);
      }
    }
    function growIntoSeam(nx, ny) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
      const vIdx = ny * width + nx;
      if (visited[vIdx]) return;
      const i = idx(nx, ny);
      const alpha = data[i + 3];
      if (alpha <= 0 || alpha >= 255) return;
      data[i] = fr;
      data[i + 1] = fg;
      data[i + 2] = fb;
      data[i + 3] = fa;
      visited[vIdx] = 1;
    }
    return filledAny;
  }

  // packages/misc/notepad/canvas.js
  var CANVAS_WIDTH = 240;
  var CANVAS_HEIGHT = 200;
  var DEFAULT_BACKGROUND = "rgb(255, 254, 248)";
  var SAVE_DEBOUNCE_MS = 400;
  var MAX_LAYERS = 6;
  var MAX_HISTORY = 8;
  function resolveColorToRgb(cssColor) {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    const pctx = probe.getContext("2d");
    pctx.fillStyle = cssColor;
    pctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = pctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
  }
  function createDrawingSurface() {
    const wrapper = document.createElement("div");
    wrapper.className = "wizascript-notepad-canvas-wrapper";
    wrapper.style.width = CANVAS_WIDTH + "px";
    wrapper.style.height = CANVAS_HEIGHT + "px";
    const backgroundCanvas = document.createElement("canvas");
    backgroundCanvas.width = CANVAS_WIDTH;
    backgroundCanvas.height = CANVAS_HEIGHT;
    backgroundCanvas.className = "wizascript-notepad-canvas wizascript-notepad-canvas-bg";
    wrapper.appendChild(backgroundCanvas);
    const bgCtx = backgroundCanvas.getContext("2d");
    const interactionCanvas = document.createElement("canvas");
    interactionCanvas.width = CANVAS_WIDTH;
    interactionCanvas.height = CANVAS_HEIGHT;
    interactionCanvas.className = "wizascript-notepad-canvas wizascript-notepad-canvas-ink";
    const cursorIndicator = document.createElement("div");
    cursorIndicator.className = "wizascript-notepad-cursor-indicator";
    let backgroundColor = DEFAULT_BACKGROUND;
    let strokeColor = "rgb(26, 26, 26)";
    let saveTimer = null;
    let lastX = null;
    let lastY = null;
    const layers = [];
    let activeLayerIndex = 1;
    let onLayersChange = null;
    function notifyLayersChange() {
      if (onLayersChange) onLayersChange(layers.length, activeLayerIndex);
    }
    function createLayerCanvas() {
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      canvas.className = "wizascript-notepad-canvas wizascript-notepad-canvas-layer";
      return canvas;
    }
    function insertLayerCanvas(canvas) {
      const insertBefore = interactionCanvas.isConnected ? interactionCanvas : null;
      wrapper.insertBefore(canvas, insertBefore);
    }
    function addLayerInternal() {
      const canvas = createLayerCanvas();
      insertLayerCanvas(canvas);
      layers.push({ canvas, ctx: canvas.getContext("2d") });
      return layers[layers.length - 1];
    }
    function addLayer() {
      if (layers.length >= MAX_LAYERS) return false;
      addLayerInternal();
      activeLayerIndex = layers.length;
      scheduleSave();
      notifyLayersChange();
      return true;
    }
    function removeLayer() {
      if (layers.length <= 1) return false;
      const removed = layers.pop();
      removed.canvas.remove();
      if (activeLayerIndex > layers.length) activeLayerIndex = layers.length;
      scheduleSave();
      notifyLayersChange();
      return true;
    }
    function setActiveLayer(layerNum) {
      if (layerNum < 1 || layerNum > layers.length) return;
      activeLayerIndex = layerNum;
      notifyLayersChange();
    }
    function getActiveLayer() {
      return activeLayerIndex;
    }
    function getLayerCount() {
      return layers.length;
    }
    function activeCtx() {
      return layers[activeLayerIndex - 1].ctx;
    }
    function setOnLayersChange(cb) {
      onLayersChange = cb;
    }
    function paintBackground(color) {
      backgroundColor = color;
      bgCtx.fillStyle = color;
      bgCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    function snapshotState() {
      return {
        layers: layers.map((l) => l.canvas.toDataURL("image/png")),
        backgroundColor
      };
    }
    function scheduleSave() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        setSavedDrawing(snapshotState());
      }, SAVE_DEBOUNCE_MS);
    }
    function loadLayerContent(ctx, dataUrl) {
      return new Promise((resolve) => {
        if (!dataUrl) {
          resolve();
          return;
        }
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          resolve();
        };
        img.onerror = () => {
          console.warn("[Notepad] A saved layer failed to load - leaving it blank.");
          resolve();
        };
        img.src = dataUrl;
      });
    }
    function loadInitial() {
      const saved = getSavedDrawing();
      paintBackground((saved == null ? void 0 : saved.backgroundColor) || DEFAULT_BACKGROUND);
      const savedLayerUrls = (saved == null ? void 0 : saved.layers) || ((saved == null ? void 0 : saved.strokesDataUrl) ? [saved.strokesDataUrl] : [null]);
      const count = Math.max(1, Math.min(MAX_LAYERS, savedLayerUrls.length));
      for (let i = 0; i < count; i++) {
        addLayerInternal();
      }
      activeLayerIndex = Math.min((saved == null ? void 0 : saved.activeLayerIndex) || 1, layers.length);
      return Promise.all(layers.map((l, i) => loadLayerContent(l.ctx, savedLayerUrls[i])));
    }
    const initialLoad = loadInitial();
    wrapper.append(interactionCanvas, cursorIndicator);
    let undoStack = [];
    let redoStack = [];
    let onHistoryChange = null;
    let restoreGeneration = 0;
    function notifyHistoryChange() {
      if (onHistoryChange) onHistoryChange(undoStack.length > 0, redoStack.length > 0);
    }
    async function restoreState(state) {
      const myGeneration = ++restoreGeneration;
      paintBackground(state.backgroundColor);
      while (layers.length < state.layers.length) addLayerInternal();
      while (layers.length > state.layers.length) {
        const removed = layers.pop();
        removed.canvas.remove();
      }
      if (activeLayerIndex > layers.length) activeLayerIndex = layers.length || 1;
      layers.forEach((l) => l.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT));
      await Promise.all(layers.map((l, i) => loadLayerContent(l.ctx, state.layers[i])));
      if (myGeneration !== restoreGeneration) return;
      scheduleSave();
      notifyLayersChange();
    }
    function pushUndoSnapshot() {
      undoStack.push(snapshotState());
      if (undoStack.length > MAX_HISTORY) undoStack.shift();
      redoStack = [];
      notifyHistoryChange();
    }
    function undo() {
      if (!undoStack.length) return false;
      const current = snapshotState();
      const previous = undoStack.pop();
      redoStack.push(current);
      if (redoStack.length > MAX_HISTORY) redoStack.shift();
      restoreState(previous);
      notifyHistoryChange();
      return true;
    }
    function redo() {
      if (!redoStack.length) return false;
      const current = snapshotState();
      const next = redoStack.pop();
      undoStack.push(current);
      if (undoStack.length > MAX_HISTORY) undoStack.shift();
      restoreState(next);
      notifyHistoryChange();
      return true;
    }
    function resetAll() {
      while (layers.length > 1) {
        const removed = layers.pop();
        removed.canvas.remove();
      }
      layers[0].ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      activeLayerIndex = 1;
      paintBackground(DEFAULT_BACKGROUND);
      undoStack = [];
      redoStack = [];
      clearTimeout(saveTimer);
      clearSavedDrawing();
      notifyLayersChange();
      notifyHistoryChange();
    }
    function clear() {
      pushUndoSnapshot();
      activeCtx().clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      scheduleSave();
    }
    function setBackgroundColor(color) {
      if (color === backgroundColor) return;
      pushUndoSnapshot();
      paintBackground(color);
      scheduleSave();
    }
    function strokeTo(x, y, { erase, size }) {
      const ctx = activeCtx();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = erase ? size * 2.2 : size;
      ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
      ctx.strokeStyle = erase ? "rgba(0,0,0,1)" : strokeColor;
      ctx.beginPath();
      ctx.moveTo(lastX != null ? lastX : x, lastY != null ? lastY : y);
      ctx.lineTo(x, y);
      ctx.stroke();
      lastX = x;
      lastY = y;
    }
    function beginStroke(x, y, opts) {
      pushUndoSnapshot();
      lastX = null;
      lastY = null;
      strokeTo(x, y, opts);
    }
    function endStroke() {
      lastX = null;
      lastY = null;
      scheduleSave();
    }
    function fill(x, y) {
      pushUndoSnapshot();
      const ctx = activeCtx();
      const fillRgb = resolveColorToRgb(strokeColor);
      const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      const changed = floodFillPixels(imageData.data, CANVAS_WIDTH, CANVAS_HEIGHT, x, y, fillRgb);
      if (!changed) {
        undoStack.pop();
        notifyHistoryChange();
        return;
      }
      ctx.putImageData(imageData, 0, 0);
      scheduleSave();
    }
    function downloadAsPng(filename = "notepad-doodle.png") {
      const flattened = document.createElement("canvas");
      flattened.width = CANVAS_WIDTH;
      flattened.height = CANVAS_HEIGHT;
      const fctx = flattened.getContext("2d");
      fctx.drawImage(backgroundCanvas, 0, 0);
      layers.forEach((l) => fctx.drawImage(l.canvas, 0, 0));
      const link = document.createElement("a");
      link.download = filename;
      link.href = flattened.toDataURL("image/png");
      link.click();
    }
    function getPointFromEvent(e) {
      const rect = interactionCanvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    return {
      wrapper,
      inkCanvas: interactionCanvas,
      // kept as `inkCanvas` for index.js's existing mouse-listener wiring
      cursorIndicator,
      ready: initialLoad,
      // resolves once any saved layers have finished loading
      beginStroke,
      strokeTo,
      endStroke,
      clear,
      fill,
      resetAll,
      undo,
      redo,
      setOnHistoryChange: (cb) => {
        onHistoryChange = cb;
      },
      setBackgroundColor,
      downloadAsPng,
      getPointFromEvent,
      setStrokeColor: (color) => {
        strokeColor = color;
      },
      getBackgroundColor: () => backgroundColor,
      addLayer,
      removeLayer,
      setActiveLayer,
      getActiveLayer,
      getLayerCount,
      setOnLayersChange
    };
  }

  // packages/misc/notepad/color-wheel.js
  var WHEEL_SIZE = 96;
  var WHEEL_RADIUS = WHEEL_SIZE / 2;
  var WHEEL_FIXED_LIGHTNESS = 0.5;
  function hslToRgbString(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(h / 60 % 2 - 1));
    const m = l - c / 2;
    let r, g, b;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const R = Math.round((r + m) * 255);
    const G = Math.round((g + m) * 255);
    const B = Math.round((b + m) * 255);
    return `rgb(${R}, ${G}, ${B})`;
  }
  function drawColorWheel(canvas) {
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(WHEEL_SIZE, WHEEL_SIZE);
    const data = imageData.data;
    for (let y = 0; y < WHEEL_SIZE; y++) {
      for (let x = 0; x < WHEEL_SIZE; x++) {
        const dx = x - WHEEL_RADIUS;
        const dy = y - WHEEL_RADIUS;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const idx = (y * WHEEL_SIZE + x) * 4;
        if (dist > WHEEL_RADIUS) {
          data[idx + 3] = 0;
          continue;
        }
        let angle = Math.atan2(dy, dx) * 180 / Math.PI;
        if (angle < 0) angle += 360;
        const saturation = Math.min(1, dist / WHEEL_RADIUS);
        const [r, g, b] = hslToRgbString(angle, saturation, WHEEL_FIXED_LIGHTNESS).match(/\d+/g).map(Number);
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }
  function buildColorPicker({ signal, initialHue = 0, initialSaturation = 1, initialLightness = 0.5, onChange }) {
    let hue = initialHue;
    let saturation = initialSaturation;
    let lightness = initialLightness;
    const container = document.createElement("div");
    container.className = "wizascript-notepad-colorpicker";
    const wheelWrapper = document.createElement("div");
    wheelWrapper.className = "wizascript-notepad-wheel-wrapper";
    const wheelCanvas = document.createElement("canvas");
    wheelCanvas.width = WHEEL_SIZE;
    wheelCanvas.height = WHEEL_SIZE;
    wheelCanvas.className = "wizascript-notepad-wheel";
    drawColorWheel(wheelCanvas);
    const indicator = document.createElement("div");
    indicator.className = "wizascript-notepad-wheel-indicator";
    wheelWrapper.append(wheelCanvas, indicator);
    const lightnessRow = document.createElement("div");
    lightnessRow.className = "wizascript-notepad-lightness-row";
    const darkLabel = document.createElement("span");
    darkLabel.className = "wizascript-notepad-lightness-label";
    darkLabel.textContent = "Dark";
    const lightnessSlider = document.createElement("input");
    lightnessSlider.type = "range";
    lightnessSlider.min = "0";
    lightnessSlider.max = "100";
    lightnessSlider.value = String(Math.round(lightness * 100));
    lightnessSlider.className = "wizascript-notepad-lightness-slider";
    const lightLabel = document.createElement("span");
    lightLabel.className = "wizascript-notepad-lightness-label";
    lightLabel.textContent = "Light";
    lightnessRow.append(darkLabel, lightnessSlider, lightLabel);
    const preview = document.createElement("div");
    preview.className = "wizascript-notepad-color-preview";
    function updateIndicatorPosition() {
      const rad = hue * Math.PI / 180;
      const dist = saturation * WHEEL_RADIUS;
      indicator.style.left = WHEEL_RADIUS + Math.cos(rad) * dist + "px";
      indicator.style.top = WHEEL_RADIUS + Math.sin(rad) * dist + "px";
    }
    function currentColor() {
      return hslToRgbString(hue, saturation, lightness);
    }
    function currentState() {
      return { hue, saturation, lightness };
    }
    function setState(nextHue, nextSaturation, nextLightness) {
      hue = nextHue;
      saturation = nextSaturation;
      lightness = nextLightness;
      lightnessSlider.value = String(Math.round(lightness * 100));
      updateIndicatorPosition();
      notify();
    }
    function notify() {
      const color = currentColor();
      preview.style.background = color;
      onChange(color);
    }
    function pickFromEvent(e) {
      const rect = wheelCanvas.getBoundingClientRect();
      const dx = e.clientX - rect.left - WHEEL_RADIUS;
      const dy = e.clientY - rect.top - WHEEL_RADIUS;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > WHEEL_RADIUS) return;
      let angle = Math.atan2(dy, dx) * 180 / Math.PI;
      if (angle < 0) angle += 360;
      hue = angle;
      saturation = Math.min(1, dist / WHEEL_RADIUS);
      updateIndicatorPosition();
      notify();
    }
    let picking = false;
    wheelCanvas.addEventListener("mousedown", (e) => {
      picking = true;
      pickFromEvent(e);
    }, { signal });
    document.addEventListener("mousemove", (e) => {
      if (picking) pickFromEvent(e);
    }, { signal });
    document.addEventListener("mouseup", () => {
      picking = false;
    }, { signal });
    lightnessSlider.addEventListener("input", () => {
      lightness = Number(lightnessSlider.value) / 100;
      notify();
    }, { signal });
    updateIndicatorPosition();
    notify();
    container.append(wheelWrapper, lightnessRow, preview);
    return { element: container, getColor: currentColor, getState: currentState, setState };
  }

  // packages/misc/notepad/recent-colors.js
  var MAX_RECENT = 5;
  function recordRecentColor(entry) {
    const existing = getRecentColors();
    const deduped = existing.filter((c) => c.color !== entry.color);
    const next = [entry, ...deduped].slice(0, MAX_RECENT);
    setRecentColors(next);
    return next;
  }
  function buildRecentColorsRow({ signal, onSelect }) {
    const wrap = document.createElement("div");
    wrap.className = "wizascript-notepad-recent-wrap";
    const label = document.createElement("div");
    label.className = "wizascript-notepad-side-label";
    label.textContent = "Recent Colors";
    const row = document.createElement("div");
    row.className = "wizascript-notepad-recent-colors";
    wrap.append(label, row);
    function render(colors) {
      row.innerHTML = "";
      colors.forEach((entry) => {
        const swatch = document.createElement("span");
        swatch.className = "wizascript-notepad-recent-swatch";
        swatch.style.background = entry.color;
        swatch.title = entry.color;
        swatch.addEventListener("mousedown", (e) => e.stopPropagation(), { signal });
        swatch.addEventListener("click", () => onSelect(entry), { signal });
        row.appendChild(swatch);
      });
    }
    return { element: wrap, render };
  }

  // packages/misc/notepad/index.js
  var DEFAULT_THICKNESS = 5;
  var mounted = null;
  function sanitizeFilename(rawTitle) {
    const cleaned = (rawTitle || "").trim().replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").slice(0, 60);
    return cleaned || "notepad-doodle";
  }
  function showNotepad() {
    var _a;
    if (mounted) return;
    injectStyle();
    const controller = new AbortController();
    const { signal } = controller;
    const { root, body, headerButtons, titleInput } = buildNotepadShell(signal);
    const surface = createDrawingSurface();
    const DEFAULT_PEN_STATE = { hue: 0, saturation: 0, lightness: 0.1, color: "rgb(26, 26, 26)" };
    const savedPen = (_a = getSavedPenColor()) != null ? _a : DEFAULT_PEN_STATE;
    let currentTool = "draw";
    let currentThickness = DEFAULT_THICKNESS;
    let currentPenColor = savedPen.color;
    let pendingColor = currentPenColor;
    let drawing = false;
    surface.setStrokeColor(currentPenColor);
    const undoBtn = document.createElement("span");
    undoBtn.textContent = "\u21B6";
    undoBtn.title = "Undo";
    undoBtn.classList.add("wizascript-notepad-history-btn");
    const redoBtn = document.createElement("span");
    redoBtn.textContent = "\u21B7";
    redoBtn.title = "Redo";
    redoBtn.classList.add("wizascript-notepad-history-btn");
    const clearBtn = document.createElement("span");
    clearBtn.textContent = "Clear";
    const saveBtn = document.createElement("span");
    saveBtn.textContent = "Save PNG";
    const closeBtn = document.createElement("span");
    closeBtn.textContent = "\xD7";
    headerButtons.append(undoBtn, redoBtn, clearBtn, saveBtn, closeBtn);
    const mainColumn = document.createElement("div");
    mainColumn.className = "wizascript-notepad-main-column";
    const toolbar = document.createElement("div");
    toolbar.className = "wizascript-notepad-toolbar";
    const drawBox = document.createElement("div");
    drawBox.className = "wizascript-notepad-tool-box active";
    drawBox.title = "Click to select this tool.";
    const colorIndicator = document.createElement("span");
    colorIndicator.className = "wizascript-notepad-color-indicator";
    colorIndicator.style.background = currentPenColor;
    drawBox.append("Draw", colorIndicator);
    const eraseBox = document.createElement("div");
    eraseBox.className = "wizascript-notepad-tool-box";
    eraseBox.textContent = "Erase";
    const fillBox = document.createElement("div");
    fillBox.className = "wizascript-notepad-tool-box";
    fillBox.textContent = "Fill";
    fillBox.title = "Click inside an enclosed area to fill it with the current pen color.";
    const sizeSlider = document.createElement("input");
    sizeSlider.type = "range";
    sizeSlider.className = "wizascript-notepad-size-slider";
    sizeSlider.min = "1";
    sizeSlider.max = "30";
    sizeSlider.value = String(currentThickness);
    sizeSlider.title = "Brush size";
    toolbar.append(drawBox, eraseBox, fillBox, sizeSlider);
    mainColumn.append(toolbar, surface.wrapper);
    const layersColumn = document.createElement("div");
    layersColumn.className = "wizascript-notepad-layers-column";
    function renderLayerButtons() {
      layersColumn.innerHTML = "";
      const count = surface.getLayerCount();
      const active = surface.getActiveLayer();
      for (let n = 1; n <= count; n++) {
        const btn = document.createElement("div");
        btn.className = "wizascript-notepad-layer-btn" + (n === active ? " active" : "");
        btn.textContent = String(n);
        btn.title = n === count && n > 1 ? "Click to work on this layer. Double-click to remove it (this layer only, since it's the topmost)." : "Click to work on this layer.";
        btn.addEventListener("click", () => {
          surface.setActiveLayer(n);
          renderLayerButtons();
        }, { signal });
        if (n === count && n > 1) {
          btn.addEventListener("dblclick", () => {
            surface.removeLayer();
            renderLayerButtons();
          }, { signal });
        }
        layersColumn.appendChild(btn);
      }
      if (count < 6) {
        const addBtn = document.createElement("div");
        addBtn.className = "wizascript-notepad-layer-add-btn";
        addBtn.textContent = "+";
        addBtn.title = "Add a new layer on top (up to 6 total).";
        addBtn.addEventListener("click", () => {
          surface.addLayer();
          renderLayerButtons();
        }, { signal });
        layersColumn.appendChild(addBtn);
      }
    }
    renderLayerButtons();
    const colorColumn = document.createElement("div");
    colorColumn.className = "wizascript-notepad-side-column";
    const colorLabel = document.createElement("div");
    colorLabel.className = "wizascript-notepad-side-label";
    colorLabel.textContent = "Color Picker";
    const picker = buildColorPicker({
      signal,
      initialHue: savedPen.hue,
      initialSaturation: savedPen.saturation,
      initialLightness: savedPen.lightness,
      onChange: (color) => {
        pendingColor = color;
      }
    });
    const applyPenBtn = document.createElement("button");
    applyPenBtn.type = "button";
    applyPenBtn.className = "wizascript-notepad-apply-btn";
    applyPenBtn.textContent = "Apply Pen Color";
    const applyBgBtn = document.createElement("button");
    applyBgBtn.type = "button";
    applyBgBtn.className = "wizascript-notepad-apply-btn";
    applyBgBtn.textContent = "Apply Paper Color";
    function applyPenColor(entry) {
      currentPenColor = entry.color;
      colorIndicator.style.background = entry.color;
      surface.setStrokeColor(entry.color);
      setSavedPenColor(entry);
      recentColorsRow.render(recordRecentColor(entry));
    }
    const recentColorsRow = buildRecentColorsRow({
      signal,
      onSelect: (entry) => {
        picker.setState(entry.hue, entry.saturation, entry.lightness);
        applyPenColor(entry);
      }
    });
    recentColorsRow.render(getRecentColors());
    colorColumn.append(colorLabel, picker.element, applyPenBtn, applyBgBtn, recentColorsRow.element);
    body.append(mainColumn, layersColumn, colorColumn);
    document.body.appendChild(root);
    function selectTool(tool) {
      currentTool = tool;
      drawBox.classList.toggle("active", tool === "draw");
      eraseBox.classList.toggle("active", tool === "erase");
      fillBox.classList.toggle("active", tool === "fill");
      surface.inkCanvas.classList.toggle("wizascript-notepad-canvas-ink-fill-tool", tool === "fill");
      updateCursorIndicatorSize();
    }
    function updateCursorIndicatorSize() {
      if (currentTool === "fill") {
        surface.cursorIndicator.style.display = "none";
        return;
      }
      const size = currentTool === "erase" ? currentThickness * 2.2 : currentThickness;
      surface.cursorIndicator.style.width = size + "px";
      surface.cursorIndicator.style.height = size + "px";
    }
    surface.inkCanvas.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      const pt = surface.getPointFromEvent(e);
      if (currentTool === "fill") {
        surface.fill(pt.x, pt.y);
        return;
      }
      drawing = true;
      surface.beginStroke(pt.x, pt.y, { erase: currentTool === "erase", size: currentThickness });
    }, { signal });
    surface.inkCanvas.addEventListener("mouseenter", () => {
      surface.cursorIndicator.style.display = "block";
      updateCursorIndicatorSize();
    }, { signal });
    surface.inkCanvas.addEventListener("mouseleave", () => {
      surface.cursorIndicator.style.display = "none";
    }, { signal });
    surface.inkCanvas.addEventListener("mousemove", (e) => {
      const pt = surface.getPointFromEvent(e);
      surface.cursorIndicator.style.left = pt.x + "px";
      surface.cursorIndicator.style.top = pt.y + "px";
    }, { signal });
    document.addEventListener("mousemove", (e) => {
      if (!drawing) return;
      const pt = surface.getPointFromEvent(e);
      surface.strokeTo(pt.x, pt.y, { erase: currentTool === "erase", size: currentThickness });
    }, { signal });
    document.addEventListener("mouseup", () => {
      if (!drawing) return;
      drawing = false;
      surface.endStroke();
    }, { signal });
    drawBox.addEventListener("click", () => selectTool("draw"), { signal });
    eraseBox.addEventListener("click", () => selectTool("erase"), { signal });
    fillBox.addEventListener("click", () => selectTool("fill"), { signal });
    sizeSlider.addEventListener("input", () => {
      currentThickness = Number(sizeSlider.value);
      updateCursorIndicatorSize();
    }, { signal });
    applyPenBtn.addEventListener("mousedown", (e) => e.stopPropagation(), { signal });
    applyPenBtn.addEventListener("click", () => {
      applyPenColor({ color: pendingColor, ...picker.getState() });
    }, { signal });
    applyBgBtn.addEventListener("mousedown", (e) => e.stopPropagation(), { signal });
    applyBgBtn.addEventListener("click", () => surface.setBackgroundColor(pendingColor), { signal });
    undoBtn.addEventListener("mousedown", (e) => e.stopPropagation(), { signal });
    undoBtn.addEventListener("click", () => surface.undo(), { signal });
    redoBtn.addEventListener("mousedown", (e) => e.stopPropagation(), { signal });
    redoBtn.addEventListener("click", () => surface.redo(), { signal });
    undoBtn.classList.add("wizascript-notepad-history-btn-disabled");
    redoBtn.classList.add("wizascript-notepad-history-btn-disabled");
    surface.setOnHistoryChange((canUndo, canRedo) => {
      undoBtn.classList.toggle("wizascript-notepad-history-btn-disabled", !canUndo);
      redoBtn.classList.toggle("wizascript-notepad-history-btn-disabled", !canRedo);
    });
    clearBtn.addEventListener("mousedown", (e) => e.stopPropagation(), { signal });
    clearBtn.addEventListener("click", () => {
      surface.resetAll();
      renderLayerButtons();
      currentPenColor = DEFAULT_PEN_STATE.color;
      colorIndicator.style.background = currentPenColor;
      surface.setStrokeColor(currentPenColor);
      picker.setState(DEFAULT_PEN_STATE.hue, DEFAULT_PEN_STATE.saturation, DEFAULT_PEN_STATE.lightness);
      clearSavedPenColor();
      clearRecentColors();
      recentColorsRow.render([]);
      titleInput.value = DEFAULT_TITLE;
      clearSavedTitle();
    }, { signal });
    saveBtn.addEventListener("mousedown", (e) => e.stopPropagation(), { signal });
    saveBtn.addEventListener("click", () => {
      surface.downloadAsPng(`${sanitizeFilename(titleInput.value)}.png`);
    }, { signal });
    closeBtn.addEventListener("mousedown", (e) => e.stopPropagation(), { signal });
    closeBtn.addEventListener("click", () => hideNotepad(), { signal });
    mounted = { root, controller, surface };
  }
  function hideNotepad() {
    if (!mounted) return;
    mounted.controller.abort();
    mounted.root.remove();
    mounted = null;
  }
  function undoNotepad() {
    if (!mounted) return;
    mounted.surface.undo();
  }
  function redoNotepad() {
    if (!mounted) return;
    mounted.surface.redo();
  }
  function forceResetNotepad() {
    hideNotepad();
    clearSavedPosition2();
    clearSavedDrawing();
    clearSavedPenColor();
    clearRecentColors();
    clearSavedTitle();
    console.log("[Wizascript] Notepad forcibly reset - drawing, position, colors, and title cleared.");
  }
  function injectStyle() {
    if (document.getElementById("wizascript-notepad-style")) return;
    const style = document.createElement("style");
    style.id = "wizascript-notepad-style";
    style.textContent = STYLE_CSS;
    document.head.appendChild(style);
  }
  var STYLE_CSS = `
.wizascript-notepad {
  position: fixed;
  /* Deliberately much higher than Deck Tracker's widgets (z-index 8).
     Those spawn over open board space and rarely get dragged, so a
     low z-index rarely collides with anything. The notepad is
     user-draggable to ANY point on screen, including under native
     Undercards chrome (menus, top bar, tooltips, etc.) that can sit
     above z-index 8 in some screen regions - which silently eats
     clicks on whatever notepad control happens to be underneath it,
     while areas that aren't covered (e.g. the canvas) keep working
     normally. A near-max z-index means the notepad wins that stacking
     fight regardless of where it's dropped. */
  z-index: 2147483000;
  background: #fdf6e3;
  border: 2px solid #8a7355;
  border-radius: 6px;
  box-shadow: 0 4px 14px rgba(0,0,0,0.5);
  font-family: Arial, sans-serif;
  user-select: none;
}
.wizascript-notepad-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px;
  background: #8a7355;
  color: #fff;
  font-size: 12px;
  font-weight: bold;
  cursor: grab;
  border-radius: 4px 4px 0 0;
}
.wizascript-notepad-header-buttons span {
  cursor: pointer;
  margin-left: 6px;
  font-size: 12px;
  background: rgba(255,255,255,0.2);
  border-radius: 3px;
  padding: 1px 5px;
}
.wizascript-notepad-history-btn {
  font-weight: bold;
}
.wizascript-notepad-history-btn-disabled {
  opacity: 0.35;
  pointer-events: none;
  cursor: default;
}
.wizascript-notepad-title-input {
  /* Widened generously (was 72px) - longer names were getting cut
     off with the old width, and it's easier to trim this back later
     if it turns out too roomy than to keep nudging it up in small
     increments. The whole notepad widens to fit, same as it already
     does to fit the canvas+sidebar body - this isn't a fixed-width
     header fighting a fixed-width body, it's just a wider header. */
  flex: none;
  width: 180px;
  background: transparent;
  border: none;
  outline: none;
  color: #fff;
  font-size: 12px;
  font-weight: bold;
  font-family: inherit;
  padding: 1px 2px;
  cursor: text;
  text-overflow: ellipsis;
}
.wizascript-notepad-title-input:hover,
.wizascript-notepad-title-input:focus {
  background: rgba(255,255,255,0.15);
  border-radius: 2px;
}
.wizascript-notepad-body {
  padding: 8px;
  display: flex;
  gap: 6px;
}
.wizascript-notepad-main-column {
  display: flex;
  flex-direction: column;
}
.wizascript-notepad-canvas-wrapper {
  position: relative;
}
.wizascript-notepad-canvas {
  position: absolute;
  top: 0;
  left: 0;
  border: 1px solid #d8cbb0;
  display: block;
}
.wizascript-notepad-canvas-bg {
  pointer-events: none;
}
.wizascript-notepad-canvas-layer {
  pointer-events: none;
}
.wizascript-notepad-canvas-ink {
  cursor: none;
}
.wizascript-notepad-canvas-ink-fill-tool {
  /* Fill has no brush-size indicator (see updateCursorIndicatorSize) -
     fall back to a real visible cursor so the click point stays
     visible, instead of the invisible cursor draw/erase rely on their
     own circular indicator to replace. */
  cursor: crosshair;
}
.wizascript-notepad-cursor-indicator {
  position: absolute;
  pointer-events: none;
  border-radius: 50%;
  border: 1.5px solid rgba(0,0,0,0.75);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.7);
  transform: translate(-50%, -50%);
  display: none;
  z-index: 2;
}
.wizascript-notepad-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.wizascript-notepad-tool-box {
  padding: 3px 10px;
  border: 2px solid #8a7355;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
  color: #5a4a35;
  background: #efe4cf;
  cursor: pointer;
}
.wizascript-notepad-tool-box.active {
  background: #d4a017;
  color: #fff;
  border-color: #a97e0f;
}
.wizascript-notepad-color-indicator {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.4);
  margin-left: 5px;
  vertical-align: middle;
}
.wizascript-notepad-size-slider {
  flex: 1;
  min-width: 50px;
}
.wizascript-notepad-layers-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding-top: 2px;
}
.wizascript-notepad-layer-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #8a7355;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  color: #5a4a35;
  background: #efe4cf;
  cursor: pointer;
}
.wizascript-notepad-layer-btn.active {
  background: #d4a017;
  color: #fff;
  border-color: #a97e0f;
}
.wizascript-notepad-layer-add-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed #8a7355;
  border-radius: 4px;
  font-size: 13px;
  font-weight: bold;
  color: #8a7355;
  background: transparent;
  cursor: pointer;
}
.wizascript-notepad-side-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 108px;
}
.wizascript-notepad-side-label {
  font-size: 9px;
  color: #6b5a42;
}
.wizascript-notepad-colorpicker {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.wizascript-notepad-wheel-wrapper {
  position: relative;
  width: 96px;
  height: 96px;
}
.wizascript-notepad-wheel {
  border-radius: 50%;
  cursor: crosshair;
}
.wizascript-notepad-wheel-indicator {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.6);
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.wizascript-notepad-lightness-row {
  display: flex;
  align-items: center;
  gap: 3px;
  width: 100%;
}
.wizascript-notepad-lightness-label {
  font-size: 8px;
  color: #6b5a42;
}
.wizascript-notepad-lightness-slider {
  flex: 1;
  min-width: 40px;
}
.wizascript-notepad-color-preview {
  width: 100%;
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(0,0,0,0.3);
}
.wizascript-notepad-apply-btn {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid #8a7355;
  background: #efe4cf;
  color: #5a4a35;
  cursor: pointer;
  font-weight: bold;
  width: 100%;
}
.wizascript-notepad-recent-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: 100%;
  margin-top: 4px;
}
.wizascript-notepad-recent-colors {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 5px;
}
.wizascript-notepad-recent-swatch {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.4);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.5);
  cursor: pointer;
}
`;

  // packages/misc/index.js
  function initMisc(plugin) {
    const settings2 = registerMiscSettings(plugin);
    function syncNotepadVisibility() {
      if (settings2.enableNotepad.value()) {
        showNotepad();
      } else {
        hideNotepad();
      }
    }
    syncNotepadVisibility();
    plugin.events.on("connect", () => {
      syncNotepadVisibility();
    });
    registerKeybind(plugin, {
      key: "toggleNotepad",
      name: "Toggle Notepad",
      defaultCode: "KeyO",
      packageLabel: "Notepad",
      onMatch: () => {
        const next = !settings2.enableNotepad.value();
        settings2.enableNotepad.set(next);
        syncNotepadVisibility();
      }
    });
    registerKeybind(plugin, {
      key: "resetNotepad",
      name: "Reset Notepad",
      defaultCode: "KeyN",
      packageLabel: "Notepad",
      onMatch: () => {
        forceResetNotepad();
        if (settings2.enableNotepad.value()) {
          showNotepad();
        }
      }
    });
    registerKeybind(plugin, {
      key: "undoNotepad",
      name: "Undo Drawing",
      defaultCode: "KeyZ",
      packageLabel: "Notepad",
      onMatch: () => undoNotepad()
    });
    registerKeybind(plugin, {
      key: "redoNotepad",
      name: "Redo Drawing",
      defaultCode: "KeyY",
      packageLabel: "Notepad",
      onMatch: () => redoNotepad()
    });
    return settings2;
  }

  // packages/controller/gamepad.js
  var pageWindow = getPageWindow();
  var pressIndicator = document.createElement("div");
  Object.assign(pressIndicator.style, {
    position: "fixed",
    top: "16px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 2147483647,
    background: "rgba(0,150,0,0.92)",
    color: "#fff",
    font: 'bold 22px -apple-system, "Segoe UI", sans-serif',
    padding: "10px 22px",
    borderRadius: "10px",
    pointerEvents: "none",
    boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
    display: "none",
    textAlign: "center"
  });
  var pressIndicatorHideTimer = null;
  function showPressIndicator(text) {
    pressIndicator.textContent = text;
    pressIndicator.style.display = "block";
    if (pressIndicatorHideTimer) clearTimeout(pressIndicatorHideTimer);
    pressIndicatorHideTimer = setTimeout(() => {
      pressIndicator.style.display = "none";
    }, 1e3);
  }
  var BUTTON_LABELS = {
    0: "\u2715",
    1: "\u25CB",
    2: "\u25A1",
    3: "\u25B3",
    4: "L1",
    5: "R1",
    6: "L2",
    7: "R2",
    8: "Select",
    9: "Start",
    10: "L3",
    11: "R3",
    12: "D-Up",
    13: "D-Down",
    14: "D-Left",
    15: "D-Right",
    16: "Home",
    17: "Touchpad"
  };
  var BUTTON_LABELS_NINTENDO = {
    0: "B",
    1: "A",
    2: "Y",
    3: "X",
    4: "L",
    5: "R",
    6: "ZL",
    7: "ZR",
    8: "-",
    9: "+",
    10: "L3",
    11: "R3",
    12: "D-Up",
    13: "D-Down",
    14: "D-Left",
    15: "D-Right",
    16: "Home",
    17: "Capture"
  };
  function activeButtonLabelTable() {
    return hidDevice ? BUTTON_LABELS_NINTENDO : BUTTON_LABELS;
  }
  function btnLabel(idx) {
    return activeButtonLabelTable()[idx] || "Button " + idx;
  }
  function buttonToDisplay(idx) {
    if (idx === null || idx === void 0) return "Unbound";
    return btnLabel(idx);
  }
  var AXIS_CALIBRATION = /* @__PURE__ */ new Map();
  var AXIS_STABLE_FRAMES_NEEDED = 90;
  var AXIS_JITTER_EPS = 0.02;
  function getCalibratedAxes(pad) {
    let cal = AXIS_CALIBRATION.get(pad.id);
    if (!cal) {
      cal = {
        baseline: pad.axes.map(() => 0),
        lastRaw: pad.axes.slice(),
        stableFrames: pad.axes.map(() => 0)
      };
      AXIS_CALIBRATION.set(pad.id, cal);
    }
    pad.axes.forEach((v, i) => {
      const prev = cal.lastRaw[i] !== void 0 ? cal.lastRaw[i] : v;
      if (Math.abs(v - prev) < AXIS_JITTER_EPS) {
        cal.stableFrames[i] = (cal.stableFrames[i] || 0) + 1;
      } else {
        cal.stableFrames[i] = 0;
      }
      cal.lastRaw[i] = v;
      if (cal.stableFrames[i] === AXIS_STABLE_FRAMES_NEEDED && Math.abs(v - (cal.baseline[i] || 0)) > AXIS_JITTER_EPS) {
        cal.baseline[i] = v;
        console.log(`[Wizascript Controller] axis ${i} on "${pad.id}" recalibrated to neutral=${v.toFixed(3)} after holding steady for ~1.5s`);
      }
    });
    return pad.axes.map((v, i) => Math.max(-1, Math.min(1, v - (cal.baseline[i] || 0))));
  }
  var WEBHID_VENDOR_ID = 1406;
  var hidDevice = null;
  function isHidConnected() {
    return !!hidDevice;
  }
  var hidState = { axes: [0, 0, 0, 0], hat: 8, raw1: 0, raw2: 0 };
  var lastLoggedHidBits = { raw1: 0, raw2: 0 };
  function decodeHidReport(dataView) {
    if (dataView.byteLength < 11) return;
    const raw1 = dataView.getUint8(0);
    const raw2 = dataView.getUint8(1);
    const hat = dataView.getUint8(2);
    const lh = dataView.getUint16(3, true);
    const lv = dataView.getUint16(5, true);
    const rh = dataView.getUint16(7, true);
    const rv = dataView.getUint16(9, true);
    const norm = (v) => Math.max(-1, Math.min(1, (v - 32768) / 32768));
    hidState.axes = [norm(lh), norm(lv), norm(rh), norm(rv)];
    hidState.hat = hat;
    hidState.raw1 = raw1;
    hidState.raw2 = raw2;
    for (let bit = 0; bit < 8; bit++) {
      const mask = 1 << bit;
      const wasR1 = !!(lastLoggedHidBits.raw1 & mask), isR1 = !!(raw1 & mask);
      if (wasR1 !== isR1) {
        console.log(`[Wizascript Controller] WebHID raw bit B1.0x${mask.toString(16).padStart(2, "0")} -> ${isR1 ? "DOWN" : "UP"}`);
        if (isR1) showPressIndicator(`\u{1F3AE} WebHID B1.0x${mask.toString(16).padStart(2, "0")} pressed`);
      }
      const wasR2 = !!(lastLoggedHidBits.raw2 & mask), isR2 = !!(raw2 & mask);
      if (wasR2 !== isR2) {
        console.log(`[Wizascript Controller] WebHID raw bit B2.0x${mask.toString(16).padStart(2, "0")} -> ${isR2 ? "DOWN" : "UP"}`);
        if (isR2) showPressIndicator(`\u{1F3AE} WebHID B2.0x${mask.toString(16).padStart(2, "0")} pressed`);
      }
    }
    lastLoggedHidBits.raw1 = raw1;
    lastLoggedHidBits.raw2 = raw2;
  }
  function handleHidInputReport(event) {
    if (event.reportId !== 63) return;
    decodeHidReport(event.data);
  }
  async function openHidDevice(device) {
    if (hidDevice) {
      console.log("[Wizascript Controller] WebHID device already connected, ignoring duplicate open call.");
      return;
    }
    try {
      if (!device.opened) await device.open();
      device.addEventListener("inputreport", handleHidInputReport);
      hidDevice = device;
      console.log("[Wizascript Controller] WebHID device opened:", device.productName || device.vendorId + ":" + device.productId);
    } catch (e) {
      console.log("[Wizascript Controller] WebHID open failed:", e);
    }
  }
  async function connectWebHidController() {
    if (!navigator.hid) {
      console.log("[Wizascript Controller] navigator.hid is not available in this browser/context - WebHID cannot be used.");
      return;
    }
    try {
      const devices = await navigator.hid.requestDevice({ filters: [{ vendorId: WEBHID_VENDOR_ID }] });
      if (!devices.length) {
        console.log("[Wizascript Controller] WebHID device picker closed with no selection.");
        return;
      }
      await openHidDevice(devices[0]);
    } catch (e) {
      console.log("[Wizascript Controller] WebHID requestDevice failed:", e);
    }
  }
  (async function tryAutoReconnectWebHid() {
    if (!navigator.hid) return;
    try {
      const devices = await navigator.hid.getDevices();
      const match = devices.find((d) => d.vendorId === WEBHID_VENDOR_ID);
      if (match) await openHidDevice(match);
    } catch (e) {
      console.log("[Wizascript Controller] WebHID auto-reconnect check failed:", e);
    }
  })();
  function getMergedGamepad() {
    let rawPads = Array.from(navigator.getGamepads()).filter((p) => p);
    if (hidDevice) {
      const vidHex = hidDevice.vendorId.toString(16).padStart(4, "0");
      const pidHex = hidDevice.productId.toString(16).padStart(4, "0");
      rawPads = rawPads.filter((p) => {
        const id = (p.id || "").toLowerCase();
        const isSameDevice = id.includes(vidHex) && id.includes(pidHex);
        if (isSameDevice) console.log("[Wizascript Controller] excluding native Gamepad-API entry for the WebHID-connected device from the merge (buttons unreliable over Bluetooth):", p.id);
        return !isSameDevice;
      });
    }
    if (hidDevice) {
      const hidButtons = new Array(18).fill(null).map(() => ({ pressed: false, value: 0 }));
      const hat = hidState.hat;
      hidButtons[12] = { pressed: hat === 0 || hat === 1 || hat === 7, value: 0 };
      hidButtons[15] = { pressed: hat === 1 || hat === 2 || hat === 3, value: 0 };
      hidButtons[13] = { pressed: hat === 3 || hat === 4 || hat === 5, value: 0 };
      hidButtons[14] = { pressed: hat === 5 || hat === 6 || hat === 7, value: 0 };
      const r1 = hidState.raw1, r2 = hidState.raw2;
      hidButtons[0] = { pressed: !!(r1 & 1), value: 0 };
      hidButtons[1] = { pressed: !!(r1 & 2), value: 0 };
      hidButtons[2] = { pressed: !!(r1 & 4), value: 0 };
      hidButtons[3] = { pressed: !!(r1 & 8), value: 0 };
      hidButtons[4] = { pressed: !!(r1 & 16), value: r1 & 16 ? 1 : 0 };
      hidButtons[5] = { pressed: !!(r1 & 32), value: r1 & 32 ? 1 : 0 };
      hidButtons[6] = { pressed: !!(r1 & 64), value: r1 & 64 ? 1 : 0 };
      hidButtons[7] = { pressed: !!(r1 & 128), value: r1 & 128 ? 1 : 0 };
      hidButtons[8] = { pressed: !!(r2 & 1), value: 0 };
      hidButtons[9] = { pressed: !!(r2 & 2), value: 0 };
      hidButtons[10] = { pressed: !!(r2 & 4), value: 0 };
      hidButtons[11] = { pressed: !!(r2 & 8), value: 0 };
      hidButtons[16] = { pressed: !!(r2 & 16), value: 0 };
      hidButtons[17] = { pressed: !!(r2 & 32), value: 0 };
      rawPads.push({ id: "WebHID Switch Pro Controller", buttons: hidButtons, axes: hidState.axes.slice() });
    }
    if (!rawPads.length) return null;
    const pads = rawPads.map((p) => ({ id: p.id, buttons: p.buttons, axes: getCalibratedAxes(p) }));
    if (pads.length === 1) return pads[0];
    const buttonCount = Math.max(...pads.map((p) => p.buttons.length));
    const axesCount = Math.max(...pads.map((p) => p.axes.length));
    const buttons = [];
    for (let i = 0; i < buttonCount; i++) {
      let pressed = false, value = 0;
      for (const p of pads) {
        const b = p.buttons[i];
        if (!b) continue;
        if (b.pressed) pressed = true;
        if (b.value > value) value = b.value;
      }
      buttons.push({ pressed, value });
    }
    const axes = [];
    for (let i = 0; i < axesCount; i++) {
      let best = 0;
      for (const p of pads) {
        const v = p.axes[i];
        if (v === void 0) continue;
        if (Math.abs(v) > Math.abs(best)) best = v;
      }
      axes.push(best);
    }
    return { buttons, axes, _mergedFrom: pads.map((p) => p.id) };
  }
  pageWindow.addEventListener("gamepadconnected", (e) => {
    console.log("[Wizascript Controller] gamepadconnected:", {
      index: e.gamepad.index,
      id: e.gamepad.id,
      mapping: e.gamepad.mapping,
      buttons: e.gamepad.buttons.length,
      axes: e.gamepad.axes.length
    });
  });
  pageWindow.addEventListener("gamepaddisconnected", (e) => {
    console.log("[Wizascript Controller] gamepaddisconnected:", { index: e.gamepad.index, id: e.gamepad.id });
  });
  var lastLoggedRawSnapshot = /* @__PURE__ */ new Map();
  function rawSnapshotsEqual(a, b) {
    if (!a || !b) return false;
    if (a.pressedIdx.length !== b.pressedIdx.length) return false;
    for (let i = 0; i < a.pressedIdx.length; i++) if (a.pressedIdx[i] !== b.pressedIdx[i]) return false;
    if (a.axes.length !== b.axes.length) return false;
    for (let i = 0; i < a.axes.length; i++) if (Math.abs(a.axes[i] - b.axes[i]) > 0.03) return false;
    return true;
  }
  function logRawGamepadStateIfChanged() {
    const pads = Array.from(navigator.getGamepads()).filter((p) => p);
    if (!pads.length) return;
    pads.forEach((p) => {
      const pressedIdx = p.buttons.map((b, i) => b.pressed ? i : null).filter((i) => i !== null);
      const snapshot = { pressedIdx, axes: p.axes.slice() };
      const prev = lastLoggedRawSnapshot.get(p.id);
      if (rawSnapshotsEqual(prev, snapshot)) return;
      lastLoggedRawSnapshot.set(p.id, snapshot);
      console.log(`[Wizascript Controller] raw gamepad[${p.index}] "${p.id}" mapping="${p.mapping}" pressed=[${pressedIdx.join(",")}] axes=[${p.axes.map((v) => v.toFixed(2)).join(",")}]`);
    });
  }
  var lastMergedButtonState = [];
  var lastUsingControllerLogged = null;
  var lastAnyStickState = false;
  function logMergedInputEdges(gp, usingControllerNow, anyStickNow) {
    if (lastUsingControllerLogged !== usingControllerNow) {
      lastUsingControllerLogged = usingControllerNow;
      console.log(`[Wizascript Controller] usingController -> ${usingControllerNow}`);
    }
    gp.buttons.forEach((b, i) => {
      const was = !!lastMergedButtonState[i];
      const is = !!(b && b.pressed);
      if (was !== is) {
        console.log(`[Wizascript Controller] MERGED button ${i} (${buttonToDisplay(i)}) -> ${is ? "DOWN" : "UP"}`);
        if (is) showPressIndicator("\u{1F3AE} " + buttonToDisplay(i) + " pressed");
      }
      lastMergedButtonState[i] = is;
    });
    if (!!anyStickNow !== lastAnyStickState) {
      lastAnyStickState = !!anyStickNow;
      if (lastAnyStickState) showPressIndicator("\u{1F579} Stick moved");
    }
  }

  // packages/controller/storage.js
  var GM_PREFIX2 = "wizascript.controller.";
  function csGet(key, fallback) {
    try {
      const v = GM_getValue(GM_PREFIX2 + key, null);
      return v === null || v === void 0 ? fallback : v;
    } catch (e) {
      console.warn("[Wizascript Controller] GM_getValue failed, falling back to default:", e);
      return fallback;
    }
  }
  function csSet(key, value) {
    try {
      GM_setValue(GM_PREFIX2 + key, value);
    } catch (e) {
      console.warn("[Wizascript Controller] GM_setValue failed, binding will not persist:", e);
    }
  }
  function csDelete(key) {
    try {
      GM_deleteValue(GM_PREFIX2 + key);
    } catch (e) {
      console.warn("[Wizascript Controller] GM_deleteValue failed:", e);
    }
  }
  var PRESET_COUNT = 3;
  var DEFAULT_PRESET_NAME_PREFIX = "Preset ";
  function getActivePreset() {
    const raw = csGet("activePreset", "1");
    const n = parseInt(raw, 10);
    return Number.isNaN(n) || n < 1 || n > PRESET_COUNT ? 1 : n;
  }
  function setActivePreset(n) {
    csSet("activePreset", String(n));
  }
  function getPresetName(n) {
    return csGet("presetName." + n, DEFAULT_PRESET_NAME_PREFIX + n);
  }
  function setPresetName(n, name) {
    const trimmed = (name || "").trim();
    csSet("presetName." + n, trimmed === "" ? DEFAULT_PRESET_NAME_PREFIX + n : trimmed);
  }
  function presetKey(rawKey) {
    return "preset" + getActivePreset() + "." + rawKey;
  }
  function getHudPosition() {
    const raw = csGet("debugHudPosition", null);
    if (!raw) return null;
    try {
      const pos = JSON.parse(raw);
      if (pos && typeof pos.left === "number" && typeof pos.top === "number") return pos;
    } catch (e) {
      console.warn("[Wizascript Controller] stored debug HUD position was invalid JSON, ignoring:", e);
    }
    return null;
  }
  function setHudPosition(left, top) {
    csSet("debugHudPosition", JSON.stringify({ left, top }));
  }
  function migrateFlatBindingsToPresetOne(controllerActionKeys, hardwareShortcutKeys) {
    if (csGet("migratedToPresetsV056", null) !== null) return;
    const migrate = (rawKey) => {
      const oldVal = csGet(rawKey, null);
      if (oldVal === null) return;
      const newKey = "preset1." + rawKey;
      if (csGet(newKey, null) !== null) return;
      csSet(newKey, oldVal);
    };
    migrate("keybinds.__primary");
    controllerActionKeys.forEach((key) => migrate("keybinds." + key));
    hardwareShortcutKeys.forEach((key) => migrate("shortcuts." + key));
    csSet("migratedToPresetsV056", "true");
    console.log("[Wizascript Controller] migrated any pre-preset-system bindings into Preset 1.");
  }
  function resetPresetBindings(presetN, controllerActionKeys, hardwareShortcutKeys) {
    const prefix = "preset" + presetN + ".";
    csDelete(prefix + "keybinds.__primary");
    csDelete(prefix + "keybinds.__channelGuide");
    controllerActionKeys.forEach((key) => csDelete(prefix + "keybinds." + key));
    hardwareShortcutKeys.forEach((key) => csDelete(prefix + "shortcuts." + key));
    console.log("[Wizascript Controller] reset preset " + presetN + "'s keybinds/shortcuts to their defaults.");
  }

  // packages/controller/settings.js
  var CONTROLLER_ACTIONS = [
    { key: "previousChannel", name: "Previous Channel", packageLabel: "UC TV", context: "channelSwitch", defaultButton: 14, dispatch: { code: "ArrowLeft", key: "ArrowLeft" } },
    { key: "nextChannel", name: "Next Channel", packageLabel: "UC TV", context: "channelSwitch", defaultButton: 15, dispatch: { code: "ArrowRight", key: "ArrowRight" } },
    { key: "toggleNotepad", name: "Toggle Notepad", packageLabel: "Notepad", context: "always", defaultButton: 3, dispatch: { code: "KeyO", key: "o" } },
    { key: "resetNotepad", name: "Reset Notepad", packageLabel: "Notepad", context: "always", defaultButton: 2, dispatch: { code: "KeyN", key: "n" } },
    { key: "undoNotepad", name: "Undo Drawing", packageLabel: "Notepad", context: "default", defaultButton: 13, dispatch: { code: "KeyZ", key: "z" } },
    { key: "redoNotepad", name: "Redo Drawing", packageLabel: "Notepad", context: "default", defaultButton: 12, dispatch: { code: "KeyY", key: "y" } },
    { key: "moveEntryUp", name: "Move Entry Up", packageLabel: "Patch Maker", context: "patchMaker", defaultButton: 12, dispatch: { code: "ArrowUp", key: "ArrowUp" } },
    { key: "moveEntryDown", name: "Move Entry Down", packageLabel: "Patch Maker", context: "patchMaker", defaultButton: 13, dispatch: { code: "ArrowDown", key: "ArrowDown" } },
    // Shortened from "Move Balance Section Up/Down" - the "- Primary +
    // <button>" suffix registerControllerSettings() appends below already
    // pushed the combined row name wide enough to force a horizontal
    // scrollbar in the settings dialog. "Section" alone is unambiguous
    // here (Patch Maker only has one thing called a "section"), matching
    // "Entry"/"Card" already being bare nouns in the two actions above.
    { key: "moveSectionUp", name: "Move Section Up", packageLabel: "Patch Maker", context: "patchMaker", defaultButton: 12, dispatch: { code: "ArrowUp", key: "ArrowUp" } },
    { key: "moveSectionDown", name: "Move Section Down", packageLabel: "Patch Maker", context: "patchMaker", defaultButton: 13, dispatch: { code: "ArrowDown", key: "ArrowDown" } },
    { key: "moveCardUp", name: "Move Card Up", packageLabel: "Patch Maker", context: "patchMaker", defaultButton: 12, dispatch: { code: "ArrowUp", key: "ArrowUp" } },
    { key: "moveCardDown", name: "Move Card Down", packageLabel: "Patch Maker", context: "patchMaker", defaultButton: 13, dispatch: { code: "ArrowDown", key: "ArrowDown" } }
  ];
  var CONTROLLER_ACTIONS_BY_KEY = {};
  CONTROLLER_ACTIONS.forEach((a) => {
    CONTROLLER_ACTIONS_BY_KEY[a.key] = a;
  });
  var HARDWARE_SHORTCUT_ACTIONS = [
    { key: "openSettings", name: "Open Settings" },
    { key: "yourDustpile", name: "Check Your Dustpile" },
    { key: "opponentDustpile", name: "Check Opponent's Dustpile" },
    { key: "endTurn", name: "End Turn" },
    { key: "openWizascriptSettings", name: "Open Wizascript Settings" },
    { key: "concede", name: "Concede" },
    { key: "goHome", name: "Go to Home Page" },
    { key: "openDeckTrackerPresets", name: "Open Deck Tracker Presets" }
  ];
  var HARDWARE_SHORTCUT_DEFAULTS = {
    openSettings: 9,
    yourDustpile: 10,
    opponentDustpile: 11,
    endTurn: 17,
    openWizascriptSettings: 7,
    concede: 8,
    goHome: 16,
    openDeckTrackerPresets: 6
  };
  var HARDWARE_SHORTCUT_ACTIONS_BY_KEY = {};
  HARDWARE_SHORTCUT_ACTIONS.forEach((a) => {
    HARDWARE_SHORTCUT_ACTIONS_BY_KEY[a.key] = a;
  });
  var DEFAULT_PRIMARY_BUTTON = 4;
  function getControllerPrimaryButton() {
    const raw = csGet(presetKey("keybinds.__primary"), String(DEFAULT_PRIMARY_BUTTON));
    if (raw === "unbound") return null;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? DEFAULT_PRIMARY_BUTTON : n;
  }
  function setControllerPrimaryButton(idxOrNull) {
    csSet(presetKey("keybinds.__primary"), idxOrNull === null ? "unbound" : String(idxOrNull));
  }
  function getChannelGuideButton() {
    const raw = csGet(presetKey("keybinds.__channelGuide"), "unbound");
    if (raw === "unbound") return null;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? null : n;
  }
  function setChannelGuideButton(idxOrNull) {
    csSet(presetKey("keybinds.__channelGuide"), idxOrNull === null ? "unbound" : String(idxOrNull));
  }
  function getBoundButton(actionKey) {
    const action = CONTROLLER_ACTIONS_BY_KEY[actionKey];
    const raw = csGet(presetKey("keybinds." + actionKey), String(action.defaultButton));
    if (raw === "unbound") return null;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? action.defaultButton : n;
  }
  function setBoundButton(actionKey, idxOrNull) {
    csSet(presetKey("keybinds." + actionKey), idxOrNull === null ? "unbound" : String(idxOrNull));
  }
  function getBoundShortcutButton(actionKey) {
    const defaultButton = HARDWARE_SHORTCUT_DEFAULTS[actionKey];
    const raw = csGet(presetKey("shortcuts." + actionKey), String(defaultButton));
    if (raw === "unbound") return null;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? defaultButton : n;
  }
  function setBoundShortcutButton(actionKey, idxOrNull) {
    csSet(presetKey("shortcuts." + actionKey), idxOrNull === null ? "unbound" : String(idxOrNull));
  }
  var controllerEnabledSetting = null;
  function isControllerSupportEnabled() {
    if (!controllerEnabledSetting || typeof controllerEnabledSetting.value !== "function") return true;
    try {
      const v = controllerEnabledSetting.value();
      return v === void 0 || v === null ? true : !!v;
    } catch (e) {
      return true;
    }
  }
  var debugTextEnabledSetting = null;
  var debugTextCheckedLive = null;
  function observeDebugTextCheckbox(el) {
    el.setAttribute("data-wc-enhanced", "true");
    debugTextCheckedLive = !!el.checked;
    el.addEventListener("change", () => {
      debugTextCheckedLive = !!el.checked;
    });
  }
  function isDebugTextEnabled() {
    if (debugTextCheckedLive !== null) return debugTextCheckedLive;
    if (!debugTextEnabledSetting || typeof debugTextEnabledSetting.value !== "function") return false;
    try {
      return !!debugTextEnabledSetting.value();
    } catch (e) {
      return false;
    }
  }
  var HIGHLIGHT_COLOR_PRESETS = [
    ["Light Blue (default)", "#3ea6ff"],
    ["Yellow", "#ffff00"],
    // JUSTICE
    ["Red", "red"],
    // DETERMINATION
    ["Green", "#00c000"],
    // KINDNESS
    ["Orange", "#fca500"],
    // BRAVERY
    ["Blue", "#0064ff"],
    // INTEGRITY
    ["Cyan", "#41fcff"],
    // PATIENCE
    ["Magenta", "#d535d9"]
    // PERSEVERANCE
  ];
  var DEFAULT_HIGHLIGHT_COLOR = HIGHLIGHT_COLOR_PRESETS[0][1];
  var highlightColorSetting = null;
  var highlightColorLive = null;
  function observeHighlightColorSelect(el) {
    el.setAttribute("data-wc-enhanced", "true");
    highlightColorLive = el.value || null;
    el.addEventListener("change", () => {
      highlightColorLive = el.value || null;
    });
  }
  function getHighlightColor() {
    if (highlightColorLive) return highlightColorLive;
    if (!highlightColorSetting || typeof highlightColorSetting.value !== "function") return DEFAULT_HIGHLIGHT_COLOR;
    try {
      return highlightColorSetting.value() || DEFAULT_HIGHLIGHT_COLOR;
    } catch (e) {
      return DEFAULT_HIGHLIGHT_COLOR;
    }
  }
  var controllerCaptureActive = false;
  function isControllerCaptureActive() {
    return controllerCaptureActive;
  }
  var boundInputRefreshers = [];
  function enhanceControllerDivider(el) {
    el.setAttribute("data-wc-enhanced", "true");
    el.readOnly = true;
    el.tabIndex = -1;
    Object.assign(el.style, {
      backgroundColor: "transparent",
      border: "none",
      borderBottom: "1px solid #666",
      color: "#8ab4f8",
      fontWeight: "bold",
      cursor: "default",
      pointerEvents: "none",
      // A bit of breathing room above/below each section header - without
      // it every divider sat flush against the row before it, and with
      // "— In-Game Inputs —" no longer followed by its own info row (see
      // registerControllerSettings), that section in particular read as
      // visually cramped against "Move Section Down" right above it.
      marginTop: "14px",
      marginBottom: "2px",
      paddingTop: "4px"
    });
  }
  function enhanceControllerCaptureInput(el, readBound, writeBound) {
    el.setAttribute("data-wc-enhanced", "true");
    el.readOnly = true;
    Object.assign(el.style, {
      cursor: "pointer",
      backgroundColor: "black",
      color: "white",
      border: "1px solid #b4b4b4",
      borderRadius: "3px",
      textAlign: "center"
    });
    function refreshDisplay() {
      el.value = buttonToDisplay(readBound());
    }
    refreshDisplay();
    boundInputRefreshers.push(refreshDisplay);
    el.addEventListener("focus", () => {
      el.style.border = "1px solid #40E0D0";
      el.style.boxShadow = "0 0 4px #40E0D0";
      el.value = "Press a button...";
      controllerCaptureActive = true;
      let cancelled = false;
      let ignoreUntilReleased = /* @__PURE__ */ new Set();
      const gp0 = getMergedGamepad();
      if (gp0) gp0.buttons.forEach((b, i) => {
        if (b && b.pressed) ignoreUntilReleased.add(i);
      });
      function captureFrame() {
        if (cancelled) return;
        const gp = getMergedGamepad();
        if (gp) {
          gp.buttons.forEach((b, i) => {
            if (!b) return;
            if (!b.pressed) {
              ignoreUntilReleased.delete(i);
              return;
            }
            if (ignoreUntilReleased.has(i)) return;
            finishCapture(i);
          });
        }
        if (!cancelled) requestAnimationFrame(captureFrame);
      }
      function finishCapture(idx) {
        if (cancelled) return;
        cancelled = true;
        writeBound(idx);
        el.blur();
      }
      function onEscape(e) {
        if (e.key === "Escape") {
          cancelled = true;
          writeBound(null);
          document.removeEventListener("keydown", onEscape, true);
          el.blur();
        }
      }
      document.addEventListener("keydown", onEscape, true);
      requestAnimationFrame(captureFrame);
      el.addEventListener("blur", function onBlur() {
        cancelled = true;
        controllerCaptureActive = false;
        el.style.border = "1px solid #b4b4b4";
        el.style.boxShadow = "none";
        document.removeEventListener("keydown", onEscape, true);
        refreshDisplay();
        el.removeEventListener("blur", onBlur);
      });
    });
  }
  var presetMenuState = null;
  function getPresetMenuState() {
    return presetMenuState;
  }
  function enhancePresetSelector(el) {
    el.setAttribute("data-wc-enhanced", "true");
    el.readOnly = true;
    el.tabIndex = 0;
    Object.assign(el.style, {
      cursor: "pointer",
      backgroundColor: "black",
      color: "white",
      border: "1px solid #b4b4b4",
      borderRadius: "3px",
      textAlign: "center"
    });
    function refreshDisplay() {
      el.value = getPresetName(getActivePreset());
    }
    refreshDisplay();
    boundInputRefreshers.push(refreshDisplay);
    let menuEl = null;
    function onOutsideClick(e) {
      if (menuEl && !menuEl.contains(e.target) && e.target !== el) closeMenu();
    }
    function onEscape(e) {
      if (e.key === "Escape") closeMenu();
    }
    function closeMenu() {
      if (!menuEl) return;
      menuEl.remove();
      menuEl = null;
      presetMenuState = null;
      document.removeEventListener("mousedown", onOutsideClick, true);
      document.removeEventListener("keydown", onEscape, true);
    }
    function openMenu() {
      if (menuEl) {
        closeMenu();
        return;
      }
      const rect = el.getBoundingClientRect();
      menuEl = document.createElement("div");
      Object.assign(menuEl.style, {
        position: "fixed",
        left: rect.left + "px",
        top: rect.bottom + 2 + "px",
        width: Math.max(rect.width, 140) + "px",
        background: "#111",
        border: "1px solid #40E0D0",
        borderRadius: "3px",
        zIndex: 2147483647,
        overflow: "hidden",
        fontFamily: "inherit"
      });
      const rowEls = [];
      for (let n = 1; n <= PRESET_COUNT; n++) {
        const isActive = n === getActivePreset();
        const row = document.createElement("div");
        row.textContent = getPresetName(n) + (isActive ? "  \u2713" : "");
        Object.assign(row.style, {
          padding: "6px 10px",
          cursor: "pointer",
          color: "white",
          background: isActive ? "#333" : "transparent"
        });
        row.addEventListener("mouseenter", () => {
          row.style.background = "#40E0D0";
          row.style.color = "black";
        });
        row.addEventListener("mouseleave", () => {
          row.style.background = isActive ? "#333" : "transparent";
          row.style.color = "white";
        });
        row.addEventListener("click", () => {
          setActivePreset(n);
          closeMenu();
          boundInputRefreshers.forEach((fn) => fn());
          console.log("[Wizascript Controller] switched to preset", n, "(" + getPresetName(n) + ")");
        });
        menuEl.appendChild(row);
        rowEls.push(row);
      }
      document.body.appendChild(menuEl);
      document.addEventListener("mousedown", onOutsideClick, true);
      document.addEventListener("keydown", onEscape, true);
      presetMenuState = { rows: rowEls, activeIndex: Math.max(0, getActivePreset() - 1), close: closeMenu };
    }
    el.addEventListener("click", openMenu);
  }
  function enhancePresetNameInput(el) {
    el.setAttribute("data-wc-enhanced", "true");
    el.readOnly = false;
    Object.assign(el.style, {
      backgroundColor: "black",
      color: "white",
      border: "1px solid #b4b4b4",
      borderRadius: "3px",
      textAlign: "center"
    });
    function refreshDisplay() {
      if (document.activeElement !== el) el.value = getPresetName(getActivePreset());
    }
    refreshDisplay();
    boundInputRefreshers.push(refreshDisplay);
    function commit() {
      setPresetName(getActivePreset(), el.value);
      boundInputRefreshers.forEach((fn) => fn());
    }
    el.addEventListener("blur", commit);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") el.blur();
    });
  }
  function enhanceResetButton(el) {
    el.setAttribute("data-wc-enhanced", "true");
    el.readOnly = true;
    el.tabIndex = 0;
    Object.assign(el.style, {
      cursor: "pointer",
      backgroundColor: "black",
      color: "white",
      border: "1px solid #b4b4b4",
      borderRadius: "3px",
      textAlign: "center"
    });
    function refreshDisplay() {
      el.value = "Double Click to Reset";
    }
    refreshDisplay();
    boundInputRefreshers.push(refreshDisplay);
    el.addEventListener("dblclick", () => {
      resetPresetBindings(getActivePreset(), CONTROLLER_ACTIONS.map((a) => a.key), HARDWARE_SHORTCUT_ACTIONS.map((a) => a.key));
      boundInputRefreshers.forEach((fn) => fn());
      el.value = "\u2705 Reset to Defaults";
      setTimeout(refreshDisplay, 1500);
    });
  }
  function enhanceDetectControllerButton(el) {
    el.setAttribute("data-wc-enhanced", "true");
    el.readOnly = true;
    el.tabIndex = 0;
    Object.assign(el.style, {
      cursor: "pointer",
      backgroundColor: "black",
      color: "white",
      border: "1px solid #b4b4b4",
      borderRadius: "3px",
      textAlign: "center"
    });
    function refreshDisplay() {
      el.value = isHidConnected() ? "\u2705 Controller Detected (WebHID)" : "\u{1F3AE} Click to Detect Controller (WebHID)";
    }
    refreshDisplay();
    boundInputRefreshers.push(refreshDisplay);
    el.addEventListener("click", async () => {
      if (isHidConnected()) return;
      el.value = "Check your browser's device picker\u2026";
      try {
        await connectWebHidController();
      } finally {
        refreshDisplay();
      }
    });
  }
  var controllerObserverStarted = false;
  function startControllerKeybindObserver(idPrefix) {
    if (controllerObserverStarted) return;
    controllerObserverStarted = true;
    let everFoundOne = false;
    const observer = new MutationObserver(() => {
      const matches = document.querySelectorAll(`input[id^="${idPrefix}"]:not([data-wc-enhanced]), select[id^="${idPrefix}"]:not([data-wc-enhanced])`);
      matches.forEach((el) => {
        everFoundOne = true;
        const bindingKey = el.id.slice(idPrefix.length);
        if (bindingKey.startsWith("__divider_") || bindingKey.startsWith("__info_")) {
          enhanceControllerDivider(el);
          return;
        }
        if (bindingKey === "detectController") {
          enhanceDetectControllerButton(el);
          return;
        }
        if (bindingKey === "presetSelector") {
          enhancePresetSelector(el);
          return;
        }
        if (bindingKey === "presetName") {
          enhancePresetNameInput(el);
          return;
        }
        if (bindingKey === "resetPreset") {
          enhanceResetButton(el);
          return;
        }
        if (bindingKey === "controllerPrimary") {
          enhanceControllerCaptureInput(el, () => getControllerPrimaryButton(), (v) => setControllerPrimaryButton(v));
          return;
        }
        if (bindingKey === "channelGuide") {
          enhanceControllerCaptureInput(el, () => getChannelGuideButton(), (v) => setChannelGuideButton(v));
          return;
        }
        if (CONTROLLER_ACTIONS_BY_KEY[bindingKey]) {
          enhanceControllerCaptureInput(el, () => getBoundButton(bindingKey), (v) => setBoundButton(bindingKey, v));
          return;
        }
        if (bindingKey.startsWith("shortcut_")) {
          const shortcutKey = bindingKey.slice("shortcut_".length);
          if (HARDWARE_SHORTCUT_ACTIONS_BY_KEY[shortcutKey]) {
            enhanceControllerCaptureInput(el, () => getBoundShortcutButton(shortcutKey), (v) => setBoundShortcutButton(shortcutKey, v));
            return;
          }
        }
        if (bindingKey === "debugTextEnabled") {
          observeDebugTextCheckbox(el);
          return;
        }
        if (bindingKey === "highlightColor") {
          observeHighlightColorSelect(el);
          return;
        }
        el.setAttribute("data-wc-enhanced", "true");
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      if (!everFoundOne) {
        console.warn('[Wizascript Controller] never found any "Keybinds - Controller" <input> elements to enhance after 15s - either the category never rendered, or the assumed id pattern (' + idPrefix + "<key>) is wrong.");
      }
    }, 15e3);
  }
  function registerControllerSettings(plugin, controllerEnabledSettingIn) {
    migrateFlatBindingsToPresetOne(
      CONTROLLER_ACTIONS.map((a) => a.key),
      HARDWARE_SHORTCUT_ACTIONS.map((a) => a.key)
    );
    controllerEnabledSetting = controllerEnabledSettingIn;
    if (!controllerEnabledSetting || typeof controllerEnabledSetting.value !== "function" || !controllerEnabledSetting.value()) {
      console.log('[Wizascript Controller] Enable Controller Support is off - "Keybinds - Controller" category not registered this load. Turn it on under Miscellaneous, then reload, to configure it.');
      return;
    }
    const CATEGORY2 = "Keybinds - Controller";
    const settings2 = createFeatureSettings(plugin, "controller", CATEGORY2);
    settings2.add("detectController", {
      name: "Detect Controller",
      note: "Click if your controller isn't responding.",
      type: "text",
      default: "Click to Detect Controller (WebHID)"
    });
    settings2.add("presetSelector", {
      name: "Settings Preset",
      note: "Click to switch presets.",
      type: "text",
      default: getPresetName(getActivePreset())
    });
    settings2.add("presetName", {
      name: "Preset Name",
      note: "Renames whichever preset is currently selected above.",
      type: "text",
      default: getPresetName(getActivePreset())
    });
    settings2.add("resetPreset", {
      name: "Restore Settings to Default",
      note: "Double Click to reset selected preset settings",
      type: "text",
      default: "Double Click to Reset"
    });
    settings2.add("__divider_top", { name: "\u2014 \u2014 \u2014", type: "text", default: "" });
    debugTextEnabledSetting = settings2.add("debugTextEnabled", {
      name: "Enable Debug Text",
      type: "boolean",
      default: false
    });
    highlightColorSetting = settings2.add("highlightColor", {
      name: "Selection Outline Color",
      type: "select",
      data: HIGHLIGHT_COLOR_PRESETS,
      default: DEFAULT_HIGHLIGHT_COLOR
    });
    settings2.add("controllerPrimary", {
      name: "Controller Primary",
      note: "Click to remap. Hold for combos below, same as Wizascript's own Primary Key.",
      type: "text",
      default: buttonToDisplay(DEFAULT_PRIMARY_BUTTON)
    });
    settings2.add("__divider_General", { name: "\u2014 General \u2014", type: "text", default: "" });
    settings2.add("__info_openSettings", { name: "Double Tap Primary \u2192 Open Wizascript Settings", type: "text", default: "" });
    const seenLabels = /* @__PURE__ */ new Set();
    CONTROLLER_ACTIONS.forEach((action) => {
      if (!seenLabels.has(action.packageLabel)) {
        seenLabels.add(action.packageLabel);
        settings2.add("__divider_" + action.packageLabel.replace(/\s+/g, "_"), {
          name: "\u2014 <b>" + action.packageLabel + "</b> \u2014",
          type: "text",
          default: ""
        });
        if (action.packageLabel === "UC TV") {
          settings2.add("channelGuide", {
            name: "Channel Guide (hold)",
            type: "text",
            default: buttonToDisplay(null)
          });
        }
      }
      settings2.add(action.key, {
        name: action.name + " - Primary + <btn>",
        type: "text",
        default: buttonToDisplay(action.defaultButton)
      });
    });
    settings2.add("__divider_HardwareShortcuts", { name: "\u2014 In-Game Inputs \u2014", type: "text", default: "" });
    HARDWARE_SHORTCUT_ACTIONS.forEach((action) => {
      settings2.add("shortcut_" + action.key, {
        name: action.name,
        type: "text",
        default: buttonToDisplay(HARDWARE_SHORTCUT_DEFAULTS[action.key])
      });
    });
    console.log('[Wizascript Controller] controller keybind settings registered under "Keybinds - Controller".');
    startControllerKeybindObserver("underscript.plugin.Wizascript.controller.");
  }

  // packages/controller/index.js
  function initController(plugin, controllerEnabledSetting2) {
    const pageWindow2 = getPageWindow();
    const DEFAULT_HIGHLIGHT_THICKNESS = 4;
    function getHighlightThickness() {
      return DEFAULT_HIGHLIGHT_THICKNESS;
    }
    function cursorRestingDisplay() {
      return "block";
    }
    const KEY_PAGES = {
      letters: [
        ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
        ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
        ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
        ["z", "x", "c", "v", "b", "n", "m", ",", "."],
        ["\u2423"]
      ],
      symbols: [
        ["!", "?", '"', "'", "#", "%", "(", ")", "/", "\\"],
        ["-", "_", ",", ".", ":", ";", "*", "+", "=", "&"],
        ["<", ">", "@", "[", "]", "{", "}", "^", "`", "|"],
        ["$", "\u20AC"],
        ["\u2423"]
      ]
    };
    function displayLabel(label, shift) {
      if (label === "\u2423") return "SPACE";
      return shift ? label.toUpperCase() : label;
    }
    function keyInfo(ch) {
      if (ch === " ") return { code: "Space", keyCode: 32 };
      if (ch === ",") return { code: "Comma", keyCode: 188 };
      if (ch === ".") return { code: "Period", keyCode: 190 };
      if (/[a-z]/i.test(ch)) return { code: "Key" + ch.toUpperCase(), keyCode: ch.toUpperCase().charCodeAt(0) };
      if (/[0-9]/.test(ch)) return { code: "Digit" + ch, keyCode: ch.charCodeAt(0) };
      return { code: "", keyCode: ch.charCodeAt(0) };
    }
    function positionPanelNear(panel, target) {
      const rect = target.getBoundingClientRect();
      const w = panel.offsetWidth, h = panel.offsetHeight;
      let left = rect.left;
      let top = rect.bottom + 8;
      if (left + w > pageWindow2.innerWidth - 8) left = pageWindow2.innerWidth - w - 8;
      if (left < 8) left = 8;
      if (top + h > pageWindow2.innerHeight - 8) {
        top = rect.top - h - 8;
        if (top < 8) top = 8;
      }
      panel.style.left = left + "px";
      panel.style.top = top + "px";
    }
    const cursor = document.createElement("div");
    Object.assign(cursor.style, {
      position: "fixed",
      width: "18px",
      height: "18px",
      borderRadius: "50%",
      background: "rgba(255,0,0,0.85)",
      border: "2px solid white",
      zIndex: 2147483647,
      pointerEvents: "none",
      left: "0px",
      top: "0px",
      transform: "translate(-50%,-50%)",
      display: "none"
    });
    const hud = document.createElement("div");
    Object.assign(hud.style, {
      position: "fixed",
      left: "8px",
      bottom: "8px",
      zIndex: 2147483647,
      background: "rgba(0,0,0,0.6)",
      color: "#0f0",
      font: "12px monospace",
      padding: "4px 8px",
      borderRadius: "4px",
      pointerEvents: "auto",
      whiteSpace: "pre",
      cursor: "move",
      userSelect: "none",
      display: "none"
    });
    const savedHudPos = getHudPosition();
    if (savedHudPos) {
      hud.style.left = savedHudPos.left + "px";
      hud.style.top = savedHudPos.top + "px";
      hud.style.bottom = "";
    }
    (function makeHudDraggable() {
      const DRAG_THRESHOLD_PX = 4;
      let dragging = false, dragMoved = false, offsetX = 0, offsetY = 0;
      hud.addEventListener("mousedown", (e) => {
        dragging = true;
        dragMoved = false;
        const rect = hud.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        e.preventDefault();
      });
      pageWindow2.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        const rect = hud.getBoundingClientRect();
        const newLeft = e.clientX - offsetX, newTop = e.clientY - offsetY;
        if (!dragMoved && (Math.abs(newLeft - rect.left) > DRAG_THRESHOLD_PX || Math.abs(newTop - rect.top) > DRAG_THRESHOLD_PX)) {
          dragMoved = true;
        }
        if (!dragMoved) return;
        hud.style.left = Math.max(0, Math.min(pageWindow2.innerWidth - 20, newLeft)) + "px";
        hud.style.top = Math.max(0, Math.min(pageWindow2.innerHeight - 20, newTop)) + "px";
        hud.style.bottom = "";
      });
      pageWindow2.addEventListener("mouseup", () => {
        if (!dragging) return;
        dragging = false;
        if (dragMoved) {
          const rect = hud.getBoundingClientRect();
          setHudPosition(rect.left, rect.top);
        }
      });
    })();
    const OSK_THEMES = {
      dark: { panelBg: "#1c1c1c", panelBorder: "1px solid rgba(255,255,255,0.15)", panelShadow: "0 4px 16px rgba(0,0,0,0.6)", hintColor: "#999", closeBg: "#3a3a3a" },
      light: { panelBg: "#f2f2f4", panelBorder: "none", panelShadow: "0 8px 24px rgba(0,0,0,0.35)", hintColor: "#666", closeBg: "#333" }
    };
    const OSK_THEME_NAME = "dark";
    const oskTheme = OSK_THEMES[OSK_THEME_NAME];
    const oskEl = document.createElement("div");
    Object.assign(oskEl.style, {
      position: "fixed",
      zIndex: 2147483647,
      background: oskTheme.panelBg,
      padding: "16px 14px 10px",
      borderRadius: "14px",
      display: "none",
      font: '15px -apple-system, "Segoe UI", sans-serif',
      pointerEvents: "none",
      border: oskTheme.panelBorder,
      boxShadow: oskTheme.panelShadow
    });
    const oskClose = document.createElement("div");
    Object.assign(oskClose.style, {
      position: "absolute",
      top: "8px",
      right: "8px",
      width: "20px",
      height: "20px",
      borderRadius: "50%",
      background: oskTheme.closeBg,
      color: "#fff",
      fontSize: "12px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    });
    oskClose.textContent = "\u2715";
    oskEl.appendChild(oskClose);
    const oskGrid = document.createElement("div");
    oskEl.appendChild(oskGrid);
    let oskRowEls = [];
    function buildGrid(rows) {
      oskGrid.innerHTML = "";
      oskRowEls = [];
      rows.forEach((row) => {
        const rowEl = document.createElement("div");
        Object.assign(rowEl.style, { display: "flex", justifyContent: "center", marginBottom: "5px" });
        const keyEls = [];
        row.forEach((label) => {
          const keyEl = document.createElement("div");
          keyEl.textContent = displayLabel(label, oskShift);
          const wide = label === "\u2423";
          Object.assign(keyEl.style, {
            minWidth: wide ? "220px" : "34px",
            height: "34px",
            margin: "3px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#232326",
            color: "#fff",
            borderRadius: "8px",
            border: "2px solid transparent",
            fontWeight: "600",
            fontSize: "14px"
          });
          rowEl.appendChild(keyEl);
          keyEls.push(keyEl);
        });
        oskGrid.appendChild(rowEl);
        oskRowEls.push(keyEls);
      });
    }
    const oskHint = document.createElement("div");
    Object.assign(oskHint.style, {
      marginTop: "4px",
      fontSize: "11px",
      color: oskTheme.hintColor,
      textAlign: "center"
    });
    oskHint.textContent = "\u25A1 backspace   L1 shift   L3 symbols   \u25B3 space   L2/R2 caret (\xD72=edge)   R3 send   R1 pause   \u25CB close   \u2715 type";
    oskEl.appendChild(oskHint);
    const selectEl = document.createElement("div");
    Object.assign(selectEl.style, {
      position: "fixed",
      zIndex: 2147483647,
      background: "#000",
      padding: "2px",
      borderRadius: "4px",
      display: "none",
      font: "inherit",
      fontSize: "14px",
      pointerEvents: "none",
      border: "1px solid #ccc",
      boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
      minWidth: "160px",
      maxHeight: "320px",
      overflowY: "auto",
      overflowX: "hidden"
    });
    let selectRowEls = [];
    function renderSelectOptions() {
      selectEl.innerHTML = "";
      selectRowEls = [];
      selectOptions.forEach((opt) => {
        const rowEl = document.createElement("div");
        rowEl.textContent = opt.text || opt.value;
        const optCs = getComputedStyle(opt);
        const bg = optCs.backgroundColor;
        Object.assign(rowEl.style, {
          padding: "6px 10px",
          margin: "0",
          borderRadius: "0",
          background: bg && bg !== "rgba(0, 0, 0, 0)" ? bg : "transparent",
          color: optCs.color || "#fff",
          border: "none",
          fontSize: "inherit",
          fontFamily: "inherit"
        });
        selectEl.appendChild(rowEl);
        selectRowEls.push(rowEl);
      });
      const hint = document.createElement("div");
      Object.assign(hint.style, {
        marginTop: "2px",
        padding: "4px 10px 2px",
        fontSize: "11px",
        color: "#888",
        textAlign: "center",
        borderTop: "1px solid rgba(255,255,255,0.12)"
      });
      hint.textContent = "\u2715 confirm   \u25CB cancel";
      selectEl.appendChild(hint);
    }
    function updateSelectHighlight() {
      selectRowEls.forEach((el, i) => {
        const active = i === selectIndex;
        el.style.boxShadow = active ? "inset 0 0 0 999px rgba(255,255,255,0.18)" : "none";
      });
    }
    function mount() {
      if (!document.body) {
        requestAnimationFrame(mount);
        return;
      }
      document.body.appendChild(hud);
      document.body.appendChild(pressIndicator);
      document.body.appendChild(oskEl);
      document.body.appendChild(selectEl);
      document.body.appendChild(cursor);
    }
    mount();
    registerControllerSettings(plugin, controllerEnabledSetting2);
    let navInputMethod = "stick";
    const GROUP_DEFS = [
      { name: "navbar", containerSelectors: ["nav", ".navbar", ".navbar-nav", "header nav"], itemSelector: "a" },
      { name: "footbar", containerSelectors: ["footer", ".footer", ".footer-nav"], itemSelector: "a" }
    ];
    function buildGroup(def) {
      for (const sel of def.containerSelectors) {
        const container = document.querySelector(sel);
        if (!container) continue;
        const items = Array.from(container.querySelectorAll(def.itemSelector)).filter((el) => el.offsetParent !== null);
        if (items.length) {
          console.log(`[Wizascript Controller] group "${def.name}" found via "${sel}": ${items.length} items`);
          return { name: def.name, container, items };
        }
      }
      console.log(`[Wizascript Controller] group "${def.name}" NOT found`);
      return null;
    }
    const navbarGroup = buildGroup(GROUP_DEFS[0]);
    const footbarGroup = buildGroup(GROUP_DEFS[1]);
    const chromeStates = [
      ...navbarGroup ? [{ type: "group", group: navbarGroup }] : [],
      { type: "neutral" },
      ...footbarGroup ? [{ type: "group", group: footbarGroup }] : []
    ];
    let chromeIndex = chromeStates.findIndex((s) => s.type === "neutral");
    const itemIndexByGroupName = {};
    let matchPhase = "hand";
    let matchSubState = "hand-nav";
    let pendingAttacker = null;
    let handItems = [];
    let handIndex = 0;
    let placingCard = null;
    let placingGrid = null;
    let placingRow = 0, placingCol = 0;
    let resolveGrid = null;
    let resolveRow = 0, resolveCol = 0;
    let resolveKind = null;
    let boardItems = [];
    let boardIndex = 0;
    let mulliganGrid = null;
    let mulliganRow = 0, mulliganCol = 0;
    function queryHandCards() {
      const host = document.getElementById("handCards");
      if (!host) return [];
      let els = Array.from(host.querySelectorAll(".card"));
      if (!els.length) els = Array.from(host.children);
      return els.filter((el) => el.offsetParent !== null);
    }
    function queryBoardMonsterCards() {
      const slots = Array.from(document.querySelectorAll(".droppableMonster.slot, .droppableMonster"));
      const cards = slots.map((s) => s.querySelector(".card")).filter((c) => c && c.offsetParent !== null);
      if (!cards.length) return [];
      const rows = buildRowGrid(cards);
      if (!rows.length) return [];
      let bestRow = rows[0], bestTop = -Infinity;
      for (const row of rows) {
        const avgTop = row.reduce((sum, el) => sum + el.getBoundingClientRect().top, 0) / row.length;
        if (avgTop > bestTop) {
          bestTop = avgTop;
          bestRow = row;
        }
      }
      return bestRow;
    }
    function elArraysEqual(a, b) {
      if (a.length !== b.length) return false;
      const setA = new Set(a);
      for (const el of b) if (!setA.has(el)) return false;
      return true;
    }
    function buildRowGrid(els, rowTolerance = 28) {
      const withRect = els.map((el) => ({ el, r: el.getBoundingClientRect() })).sort((a, b) => a.r.top - b.r.top);
      const rows = [];
      for (const item of withRect) {
        let row = rows.find((r) => Math.abs(r.top - item.r.top) <= rowTolerance);
        if (!row) {
          row = { top: item.r.top, items: [] };
          rows.push(row);
        }
        row.items.push(item);
      }
      rows.forEach((r) => r.items.sort((a, b) => a.r.left - b.r.left));
      return rows.map((r) => r.items.map((i) => i.el));
    }
    function gridFlat(grid) {
      return grid ? grid.flat() : [];
    }
    let placingOrigin = null;
    function beginCardDrag(card) {
      pendingAttacker = null;
      const r = card.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      placingOrigin = { x: cx, y: cy };
      fire(card, "pointerdown", PointerEvent, cx, cy, 0, 1);
      fire(card, "mousedown", MouseEvent, cx, cy, 0, 1);
      const liftY = cy - 40;
      fire(card, "pointermove", PointerEvent, cx, liftY, 0, 1);
      fire(card, "mousemove", MouseEvent, cx, liftY, 0, 1);
      placingCard = card;
      placingGrid = null;
      matchPhase = "placing";
      console.log("[Wizascript Controller] card drag started", card);
    }
    function cancelPlacingDrag(reason) {
      const card = placingCard;
      const origin = placingOrigin || { x: -9999, y: -9999 };
      fire(document.body, "pointermove", PointerEvent, origin.x, origin.y, 0, 1);
      fire(document.body, "mousemove", MouseEvent, origin.x, origin.y, 0, 1);
      fire(document.body, "pointerup", PointerEvent, origin.x, origin.y, 0, 0);
      fire(document.body, "mouseup", MouseEvent, origin.x, origin.y, 0, 0);
      if (pageWindow2.jQuery) {
        pageWindow2.jQuery(card).stop(true, true);
        pageWindow2.jQuery(".ui-draggable-dragging").stop(true, true);
      }
      console.log("[Wizascript Controller] card drag cancelled via", reason);
      placingCard = null;
      placingGrid = null;
      placingOrigin = null;
      matchPhase = "hand";
      refreshHighlight();
    }
    let modalGrid = null, modalRow = 0, modalCol = 0, modalKind = null;
    let modalPane = "categories";
    let categoryItems = [], categoryIndex = 0;
    let fieldGrid = null, fieldRow = 0, fieldCol = 0;
    let fieldNeedsReanchor = false;
    let fieldSubmenu = null;
    let lastKnownActiveCategoryIdx = -1;
    const MODAL_ITEM_SELECTOR = 'button, input:not([type="hidden"]):not(.tabButton), select, a[href], .card, li[role="button"], .tabLabel';
    function queryModalRoot() {
      const visibleDialogs = Array.from(document.querySelectorAll(".bootstrap-dialog")).filter((d) => getComputedStyle(d).display !== "none");
      const dialog = visibleDialogs[visibleDialogs.length - 1] || null;
      if (dialog && !document.querySelector(".mulligan")) {
        const tabbedRoot = dialog.querySelector(".tabbedView.left");
        return tabbedRoot ? { root: dialog, kind: "tabbed", tabbedRoot } : { root: dialog, kind: "plain" };
      }
      const menu = document.querySelector(".menu-backdrop");
      if (menu && getComputedStyle(menu).display !== "none") return { root: menu, kind: "menu" };
      return null;
    }
    function queryModalItems(root) {
      return Array.from(root.querySelectorAll(MODAL_ITEM_SELECTOR)).filter((el) => el.offsetParent !== null);
    }
    function queryScrollableListItems(root) {
      const scrollable = findScrollableDescendant(root);
      if (!scrollable) return [];
      const items = [];
      Array.from(scrollable.children).forEach((row) => {
        if (row.tagName !== "DIV") return;
        Array.from(row.children).filter((c) => c.tagName === "SPAN").forEach((s) => items.push(s));
      });
      return items.filter((el) => el.offsetParent !== null);
    }
    function queryCategoryItems(tabbedRoot) {
      return Array.from(tabbedRoot.querySelectorAll(":scope > .tabLabel")).filter((el) => el.offsetParent !== null).sort((a, b) => {
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        if (Math.abs(ra.top - rb.top) > 2) return ra.top - rb.top;
        return ra.left - rb.left;
      });
    }
    function queryActiveTabContent(tabbedRoot) {
      return Array.from(tabbedRoot.querySelectorAll(":scope > .tabContent")).find((el) => el.offsetParent !== null) || null;
    }
    function queryFieldRows(root) {
      const flexRows = Array.from(root.querySelectorAll(".flex-start")).filter((row) => row.offsetParent !== null).map((row) => Array.from(row.querySelectorAll(MODAL_ITEM_SELECTOR)).filter((el) => el.offsetParent !== null)).filter((items) => items.length);
      const bareLabels = Array.from(root.querySelectorAll(".tabLabel")).filter((el) => el.offsetParent !== null).map((el) => [el]);
      const rows = [...bareLabels, ...flexRows];
      if (rows.length) return rows;
      return buildRowGrid(queryModalItems(root));
    }
    function enterCategory() {
      const cat = categoryItems[categoryIndex];
      if (!cat) return;
      triggerElementClick(cat);
      modalPane = "fields";
      fieldGrid = null;
      fieldRow = 0;
      fieldCol = 0;
      if (fieldSubmenu) {
        fieldSubmenu.onCancel && fieldSubmenu.onCancel();
        fieldSubmenu = null;
      }
    }
    function findModalDismissButton(root) {
      const byAttr = root.querySelector('[data-dismiss="modal"], .close');
      if (byAttr) return byAttr;
      const buttons = Array.from(root.querySelectorAll("button"));
      return buttons.find((b) => /close|cancel|^no$/i.test((b.textContent || "").trim())) || null;
    }
    let activeSubmenu = null;
    let currentHighlightedEl = null;
    function findDropdownMenuNear(toggleEl) {
      const wrap = toggleEl.closest(".dropdown, .btn-group, li");
      if (!wrap) return [];
      return Array.from(wrap.querySelectorAll(".dropdown-menu a")).filter((a) => a.offsetParent !== null);
    }
    function currentFocusedEl() {
      if (mulliganGrid && mulliganGrid.length) {
        return (mulliganGrid[mulliganRow] || [])[mulliganCol] || null;
      }
      if (modalKind === "tabbed") {
        if (modalPane === "categories") return categoryItems[categoryIndex] || null;
        if (fieldSubmenu) return fieldSubmenu.items[fieldSubmenu.index] || null;
        return (fieldGrid && fieldGrid[fieldRow] || [])[fieldCol] || null;
      }
      if (modalGrid && modalGrid.length) {
        return (modalGrid[modalRow] || [])[modalCol] || null;
      }
      if (matchPhase === "placing" && placingGrid && placingGrid.length) {
        return (placingGrid[placingRow] || [])[placingCol] || null;
      }
      if (matchPhase === "resolve" && resolveGrid && resolveGrid.length) {
        return (resolveGrid[resolveRow] || [])[resolveCol] || null;
      }
      if (document.getElementById("handCards") && matchSubState === "board-nav" && boardItems.length) {
        return boardItems[boardIndex] || null;
      }
      if (document.getElementById("handCards") && matchSubState === "hand-nav" && handItems.length) {
        return handItems[handIndex] || null;
      }
      if (activeSubmenu) return activeSubmenu.items[activeSubmenu.index] || null;
      const state = chromeStates[chromeIndex];
      if (!state || state.type !== "group") return null;
      const g = state.group;
      const idx = itemIndexByGroupName[g.name] || 0;
      return g.items[idx] || null;
    }
    function setHighlight(el) {
      if (!el) return;
      el.style.outline = `${getHighlightThickness()}px solid ${getHighlightColor()}`;
      el.style.outlineOffset = "2px";
    }
    function clearHighlight(el) {
      if (!el) return;
      el.style.outline = "";
      el.style.outlineOffset = "";
    }
    function refreshHighlight() {
      if (navInputMethod !== "dpad") {
        if (currentHighlightedEl) {
          clearHighlight(currentHighlightedEl);
          currentHighlightedEl = null;
        }
        return;
      }
      const el = currentFocusedEl();
      if (el === currentHighlightedEl) return;
      if (currentHighlightedEl) clearHighlight(currentHighlightedEl);
      if (el) setHighlight(el);
      currentHighlightedEl = el;
    }
    function isTextInput(el) {
      if (!el) return false;
      if (el.readOnly) return false;
      if (el.tagName === "TEXTAREA") return true;
      if (el.tagName === "INPUT") {
        const type = (el.type || "text").toLowerCase();
        return ["text", "search", "email", "url", "tel", "password", "number"].includes(type);
      }
      return !!el.isContentEditable;
    }
    function isSlider(el) {
      return !!el && el.tagName === "INPUT" && (el.type || "").toLowerCase() === "range";
    }
    function isNativeSelect(el) {
      return !!el && el.tagName === "SELECT";
    }
    function placeCaretAtPoint(el, cx, cy) {
      if (!el || !el.isContentEditable) return;
      let range = null;
      if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(cx, cy);
      } else if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(cx, cy);
        if (pos) {
          range = document.createRange();
          range.setStart(pos.offsetNode, pos.offset);
          range.collapse(true);
        }
      }
      if (range && el.contains(range.startContainer)) {
        const sel = pageWindow2.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        console.log("[Wizascript Controller] caret repositioned in", el, "at", cx, cy);
      }
    }
    function firstTextNode(el) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      return walker.nextNode();
    }
    function lastTextNode(el) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let last = null, node;
      while (node = walker.nextNode()) last = node;
      return last;
    }
    function setOskCaretEdge(toStart) {
      if (!oskTarget) return;
      if (oskTarget.isContentEditable) {
        const node = toStart ? firstTextNode(oskTarget) : lastTextNode(oskTarget);
        const range = document.createRange();
        if (node) range.setStart(node, toStart ? 0 : node.textContent.length);
        else range.selectNodeContents(oskTarget);
        range.collapse(true);
        const sel = pageWindow2.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        const pos = toStart ? 0 : oskTarget.value.length;
        oskTarget.setSelectionRange(pos, pos);
        scrollFieldToCaret(oskTarget);
      }
    }
    function stepOskCaret(dir) {
      if (!oskTarget) return;
      if (oskTarget.isContentEditable) {
        const sel = pageWindow2.getSelection();
        if (!sel.rangeCount || !oskTarget.contains(sel.anchorNode)) {
          setOskCaretEdge(dir < 0);
          return;
        }
        sel.modify("move", dir < 0 ? "left" : "right", "character");
        if (!oskTarget.contains(sel.focusNode)) setOskCaretEdge(dir < 0);
      } else {
        const cur = oskTarget.selectionStart == null ? oskTarget.value.length : oskTarget.selectionStart;
        const next = Math.max(0, Math.min(oskTarget.value.length, cur + dir));
        oskTarget.setSelectionRange(next, next);
        scrollFieldToCaret(oskTarget);
      }
    }
    let oskOpen = false, oskTarget = null, oskRow = 0, oskCol = 0, oskShift = false, oskPage = "letters";
    let oskPaused = false;
    let lastL2TapTime = 0, lastR2TapTime = 0;
    const DOUBLE_TAP_WINDOW_MS2 = 400;
    let activeRows = KEY_PAGES.letters;
    buildGrid(activeRows);
    function renderOskLabels() {
      activeRows.forEach((row, r) => row.forEach((label, c) => {
        oskRowEls[r][c].textContent = displayLabel(label, oskShift);
      }));
    }
    function updateOskHighlight() {
      activeRows.forEach((row, r) => row.forEach((label, c) => {
        const active = r === oskRow && c === oskCol;
        oskRowEls[r][c].style.border = active ? "2px solid #0f0" : "2px solid transparent";
        oskRowEls[r][c].style.background = active ? "#0a4d0a" : "#232326";
      }));
    }
    function openOsk(target) {
      oskTarget = target;
      target.focus();
      oskOpen = true;
      oskPaused = false;
      oskRow = 0;
      oskCol = 0;
      oskShift = false;
      oskPage = "letters";
      activeRows = KEY_PAGES.letters;
      buildGrid(activeRows);
      oskEl.style.display = "block";
      positionPanelNear(oskEl, target);
      cursor.style.display = "block";
      updateOskHighlight();
      console.log("[Wizascript Controller] OSK opened for", target);
    }
    function closeOsk() {
      oskOpen = false;
      oskPaused = false;
      oskEl.style.display = "none";
      if (oskTarget) oskTarget.blur();
      oskTarget = null;
      console.log("[Wizascript Controller] OSK closed");
    }
    function dispatchEnterKey(el) {
      el.focus();
      const scope = el.closest("form") || el.closest(".chat-box") || el.parentElement;
      const submitEl = scope && scope.querySelector('input[type="submit"]');
      if (submitEl) {
        submitEl.click();
        return;
      }
      const opts = { bubbles: true, cancelable: true, key: "Enter", code: "Enter", keyCode: 13, which: 13, view: pageWindow2 };
      el.dispatchEvent(new KeyboardEvent("keydown", opts));
      el.dispatchEvent(new KeyboardEvent("keypress", opts));
      el.dispatchEvent(new KeyboardEvent("keyup", opts));
    }
    let scrollMirrorEl = null;
    function measureTextWidth(el, text) {
      if (!scrollMirrorEl) {
        scrollMirrorEl = document.createElement("span");
        Object.assign(scrollMirrorEl.style, {
          position: "absolute",
          visibility: "hidden",
          whiteSpace: "pre",
          top: "-9999px",
          left: "-9999px"
        });
        document.body.appendChild(scrollMirrorEl);
      }
      const cs = getComputedStyle(el);
      scrollMirrorEl.style.font = cs.font;
      scrollMirrorEl.style.letterSpacing = cs.letterSpacing;
      scrollMirrorEl.style.textTransform = cs.textTransform;
      scrollMirrorEl.textContent = text;
      return scrollMirrorEl.getBoundingClientRect().width;
    }
    function scrollFieldToCaret(el) {
      if (!el || el.isContentEditable) return;
      if (typeof el.selectionEnd !== "number") return;
      const pos = el.selectionEnd;
      const caretX = measureTextWidth(el, el.value.slice(0, pos));
      const visibleWidth = el.clientWidth;
      const margin = 12;
      if (caretX - el.scrollLeft > visibleWidth - margin) {
        el.scrollLeft = caretX - visibleWidth + margin;
      } else if (caretX - el.scrollLeft < margin) {
        el.scrollLeft = Math.max(0, caretX - margin);
      }
    }
    function typeChar(el, ch) {
      el.focus();
      const info = keyInfo(ch);
      const base = { bubbles: true, cancelable: true, key: ch, code: info.code, keyCode: info.keyCode, which: info.keyCode, view: pageWindow2 };
      el.dispatchEvent(new KeyboardEvent("keydown", base));
      el.dispatchEvent(new KeyboardEvent("keypress", base));
      document.execCommand("insertText", false, ch);
      el.dispatchEvent(new KeyboardEvent("keyup", base));
      scrollFieldToCaret(el);
    }
    function typeBackspace(el) {
      el.focus();
      const base = { bubbles: true, cancelable: true, key: "Backspace", code: "Backspace", keyCode: 8, which: 8, view: pageWindow2 };
      el.dispatchEvent(new KeyboardEvent("keydown", base));
      document.execCommand("delete");
      el.dispatchEvent(new KeyboardEvent("keyup", base));
      scrollFieldToCaret(el);
    }
    function pressKey(label) {
      if (!oskTarget) return;
      if (label === "\u2423") {
        typeChar(oskTarget, " ");
        return;
      }
      const ch = oskShift ? label.toUpperCase() : label;
      typeChar(oskTarget, ch);
    }
    let sliderTarget = null;
    const nativeValueSetter = Object.getOwnPropertyDescriptor(pageWindow2.HTMLInputElement.prototype, "value").set;
    function openSlider(el) {
      sliderTarget = el;
      setHighlight(el);
      cursor.style.display = "none";
      console.log("[Wizascript Controller] slider focused", el, "value=", el.value, "min=", el.min, "max=", el.max, "step=", el.step);
    }
    function closeSlider() {
      if (sliderTarget) clearHighlight(sliderTarget);
      sliderTarget = null;
    }
    function adjustSlider(dir) {
      if (!sliderTarget) return;
      const el = sliderTarget;
      const step = parseFloat(el.step) || 1;
      const min = el.min !== "" ? parseFloat(el.min) : -Infinity;
      const max = el.max !== "" ? parseFloat(el.max) : Infinity;
      let val = parseFloat(el.value) || 0;
      val = Math.max(min, Math.min(max, val + dir * step));
      nativeValueSetter.call(el, String(val));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    function setSliderValueFromPointer(el, clientX) {
      const rect = el.getBoundingClientRect();
      if (!rect.width) return;
      const min = el.min !== "" ? parseFloat(el.min) : 0;
      const max = el.max !== "" ? parseFloat(el.max) : 100;
      const step = parseFloat(el.step) || 1;
      let frac = (clientX - rect.left) / rect.width;
      frac = Math.max(0, Math.min(1, frac));
      let val = min + frac * (max - min);
      val = Math.round(val / step) * step;
      val = Math.max(min, Math.min(max, val));
      nativeValueSetter.call(el, String(val));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    let selectTarget = null, selectOptions = [], selectIndex = 0;
    function openSelectPicker(el) {
      selectTarget = el;
      selectOptions = Array.from(el.options);
      selectIndex = Math.max(0, selectOptions.findIndex((o) => o.selected));
      const selCs = getComputedStyle(el);
      const selBg = selCs.backgroundColor;
      selectEl.style.background = selBg && selBg !== "rgba(0, 0, 0, 0)" ? selBg : "#000";
      selectEl.style.border = `${selCs.borderTopWidth} ${selCs.borderTopStyle} ${selCs.borderTopColor}`;
      selectEl.style.borderRadius = selCs.borderRadius;
      selectEl.style.fontFamily = selCs.fontFamily;
      selectEl.style.fontSize = selCs.fontSize;
      renderSelectOptions();
      selectEl.style.display = "block";
      positionPanelNear(selectEl, el);
      updateSelectHighlight();
      cursor.style.display = "block";
      console.log("[Wizascript Controller] select picker opened", el, selectOptions.map((o) => o.text));
    }
    function closeSelectPicker() {
      selectEl.style.display = "none";
      selectTarget = null;
    }
    function confirmSelectPicker() {
      if (!selectTarget) return;
      const opt = selectOptions[selectIndex];
      if (opt) {
        selectTarget.value = opt.value;
        selectTarget.dispatchEvent(new Event("input", { bubbles: true }));
        selectTarget.dispatchEvent(new Event("change", { bubbles: true }));
      }
      closeSelectPicker();
    }
    function activateHighlighted(button) {
      const el = currentFocusedEl();
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      if (isPatchMakerResetButton(el)) {
        activatePatchMakerResetButton(el, cx, cy);
        return;
      }
      dispatchClick(el, cx, cy, button === 2 ? 2 : 0);
      const openPresetMenu = getPresetMenuState();
      if (openPresetMenu) {
        fieldSubmenu = {
          items: openPresetMenu.rows,
          index: openPresetMenu.activeIndex,
          onConfirm: (item) => {
            if (item) triggerElementClick(item);
          },
          onCancel: () => openPresetMenu.close(),
          isAlive: () => !!getPresetMenuState()
        };
        return;
      }
      if (isNativeSelect(el)) {
        openSelectPicker(el);
        return;
      }
      if (isSlider(el)) {
        openSlider(el);
        return;
      }
      if (el.matches && el.matches(".uc-section-label, .uc-card-item")) {
        el.focus();
        return;
      }
      if (el.readOnly && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
        el.focus();
        return;
      }
      if (isTextInput(el)) {
        openOsk(el);
        if (el.isContentEditable) placeCaretAtPoint(el, cx, cy);
        return;
      }
      if (!activeSubmenu && el.classList.contains("dropdown-toggle")) {
        const items = findDropdownMenuNear(el);
        if (items.length) {
          activeSubmenu = { toggle: el, items, index: 0 };
          refreshHighlight();
        }
      }
    }
    function closeSubmenu() {
      if (!activeSubmenu) return;
      const toggle = activeSubmenu.toggle;
      activeSubmenu = null;
      const rect = toggle.getBoundingClientRect();
      dispatchClick(toggle, rect.left + rect.width / 2, rect.top + rect.height / 2, 0);
      refreshHighlight();
    }
    let x = pageWindow2.innerWidth / 2, y = pageWindow2.innerHeight / 2;
    let usingController = false;
    const BASE_SPEED = 24;
    const WHEEL_DELTA = 100;
    function dz(v) {
      return Math.abs(v) < 0.15 ? 0 : v;
    }
    function findRealScrollable(el) {
      let node = el;
      while (node && node !== document.documentElement) {
        const cs = getComputedStyle(node);
        if (/(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight) return node;
        node = node.parentElement;
      }
      const root = document.scrollingElement || document.documentElement;
      if (root && root.scrollHeight > root.clientHeight) return root;
      return null;
    }
    function findScrollableDescendant(root) {
      if (!root) return null;
      const all = root.querySelectorAll("*");
      for (const node of all) {
        const cs = getComputedStyle(node);
        if (/(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight) return node;
      }
      return null;
    }
    function topVisibleRowIndex(rowEls, containerEl) {
      if (!rowEls.length) return 0;
      if (!containerEl) return 0;
      const containerTop = containerEl.getBoundingClientRect().top;
      for (let i = 0; i < rowEls.length; i++) {
        if (rowEls[i] && rowEls[i].getBoundingClientRect().bottom > containerTop + 1) return i;
      }
      return rowEls.length - 1;
    }
    function fire(el, type, ctor, clientX, clientY, button, buttons) {
      const opts = {
        bubbles: true,
        cancelable: true,
        view: pageWindow2,
        clientX,
        clientY,
        button: button || 0,
        buttons: buttons || 0
      };
      if (ctor === PointerEvent) {
        opts.pointerId = 1;
        opts.isPrimary = true;
        opts.pointerType = "mouse";
      }
      el.dispatchEvent(new ctor(type, opts));
    }
    function dispatchClick(el, cx, cy, button) {
      if (button === 2) {
        fire(el, "pointerdown", PointerEvent, cx, cy, 2, 2);
        fire(el, "mousedown", MouseEvent, cx, cy, 2, 2);
        fire(el, "pointerup", PointerEvent, cx, cy, 2, 0);
        fire(el, "mouseup", MouseEvent, cx, cy, 2, 0);
        fire(el, "contextmenu", MouseEvent, cx, cy, 2, 0);
        return;
      }
      fire(el, "pointerdown", PointerEvent, cx, cy, 0, 1);
      fire(el, "mousedown", MouseEvent, cx, cy, 0, 1);
      fire(el, "pointerup", PointerEvent, cx, cy, 0, 0);
      fire(el, "mouseup", MouseEvent, cx, cy, 0, 0);
      fire(el, "click", MouseEvent, cx, cy, 0, 0);
    }
    function isPatchMakerResetButton(el) {
      return !!el && el.tagName === "BUTTON" && el.textContent && el.textContent.trim() === "Reset Data";
    }
    let lastResetBtnPressTime = 0;
    function activatePatchMakerResetButton(el, cx, cy) {
      const now = performance.now();
      const isConfirmPress = now - lastResetBtnPressTime < DOUBLE_TAP_WINDOW_MS2;
      const detail = isConfirmPress ? 2 : 1;
      fire(el, "pointerdown", PointerEvent, cx, cy, 0, 1);
      fire(el, "mousedown", MouseEvent, cx, cy, 0, 1);
      fire(el, "pointerup", PointerEvent, cx, cy, 0, 0);
      fire(el, "mouseup", MouseEvent, cx, cy, 0, 0);
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: pageWindow2, clientX: cx, clientY: cy, button: 0, buttons: 0, detail }));
      lastResetBtnPressTime = isConfirmPress ? 0 : now;
      console.log("[Wizascript Controller] Reset Data pressed, detail =", detail, isConfirmPress ? "(confirmed - resetting)" : "(press again to confirm)");
    }
    function triggerElementClick(el) {
      if (!el) return;
      const r = el.getBoundingClientRect();
      dispatchClick(el, r.left + r.width / 2, r.top + r.height / 2, 0);
    }
    function triggerConcede() {
      const menu = document.querySelector(".menu-backdrop");
      const wasMenuOpen = !!(menu && getComputedStyle(menu).display !== "none");
      document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", code: "Escape", bubbles: true }));
      let attempts2 = 0;
      const MAX_ATTEMPTS = 30;
      (function poll() {
        const items = Array.from(document.querySelectorAll('.menu-body li[role="button"]'));
        const surrenderLi = items.find((li) => /surrender/i.test((li.textContent || "").trim()));
        if (surrenderLi) {
          triggerElementClick(surrenderLi);
          console.log("[Wizascript Controller] concede: used Underscript's own Surrender menu entry");
          return;
        }
        attempts2++;
        if (attempts2 < MAX_ATTEMPTS) {
          requestAnimationFrame(poll);
          return;
        }
        console.log("[Wizascript Controller] concede: no Surrender entry found in Underscript's menu, falling back to the native flow");
        if (!wasMenuOpen) document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", code: "Escape", bubbles: true }));
        triggerConcedeNative();
      })();
    }
    function triggerConcedeNative() {
      const existing = document.querySelector('.btn-danger[onclick*="askSurrender"]');
      if (existing) {
        triggerElementClick(existing);
        return;
      }
      const configBtn = document.getElementById("btn-config");
      if (!configBtn) {
        console.log("[Wizascript Controller] concede: settings button not found (not in a match?)");
        return;
      }
      triggerElementClick(configBtn);
      let attempts2 = 0;
      const MAX_ATTEMPTS = 30;
      (function poll() {
        const btn = document.querySelector('.btn-danger[onclick*="askSurrender"]');
        if (btn) {
          triggerElementClick(btn);
          return;
        }
        attempts2++;
        if (attempts2 < MAX_ATTEMPTS) requestAnimationFrame(poll);
        else console.log("[Wizascript Controller] concede: gave up waiting for the surrender button after opening settings");
      })();
    }
    const drag = { left: null, right: null };
    function beginPress(side, button) {
      cursor.style.display = "none";
      const hitEl = document.elementFromPoint(x, y);
      cursor.style.display = "block";
      if (!hitEl) return;
      drag[side] = { downEl: hitEl };
      if (button === 2) {
        fire(hitEl, "pointerdown", PointerEvent, x, y, 2, 2);
        fire(hitEl, "mousedown", MouseEvent, x, y, 2, 2);
      } else {
        fire(hitEl, "pointerdown", PointerEvent, x, y, 0, 1);
        fire(hitEl, "mousedown", MouseEvent, x, y, 0, 1);
      }
    }
    function continuePress(side, button) {
      if (!drag[side]) return;
      cursor.style.display = "none";
      const hitEl = document.elementFromPoint(x, y);
      cursor.style.display = "block";
      if (!hitEl) return;
      if (button === 2) {
        fire(hitEl, "pointermove", PointerEvent, x, y, 2, 2);
        fire(hitEl, "mousemove", MouseEvent, x, y, 2, 2);
      } else {
        fire(hitEl, "pointermove", PointerEvent, x, y, 0, 1);
        fire(hitEl, "mousemove", MouseEvent, x, y, 0, 1);
      }
    }
    function endPress(side, button) {
      const state = drag[side];
      drag[side] = null;
      if (!state) return;
      cursor.style.display = "none";
      const hitEl = document.elementFromPoint(x, y);
      cursor.style.display = "block";
      if (!hitEl) return;
      if (button === 2) {
        fire(hitEl, "pointerup", PointerEvent, x, y, 2, 0);
        fire(hitEl, "mouseup", MouseEvent, x, y, 2, 0);
        if (hitEl === state.downEl) fire(hitEl, "contextmenu", MouseEvent, x, y, 2, 0);
      } else {
        fire(hitEl, "pointerup", PointerEvent, x, y, 0, 0);
        fire(hitEl, "mouseup", MouseEvent, x, y, 0, 0);
        if (hitEl === state.downEl) fire(hitEl, "click", MouseEvent, x, y, 0, 0);
      }
    }
    function collectHoverRules() {
      const rules = [];
      for (const sheet of document.styleSheets) {
        let cssRules;
        try {
          cssRules = sheet.cssRules;
        } catch (e) {
          continue;
        }
        if (!cssRules) continue;
        for (const rule of cssRules) {
          if (!rule.selectorText || !rule.selectorText.includes(":hover")) continue;
          for (const part of rule.selectorText.split(",")) {
            const trimmed = part.trim();
            if (!trimmed.includes(":hover")) continue;
            const base = trimmed.replace(/:hover/g, "").trim();
            if (base) rules.push({ selector: base, style: rule.style });
          }
        }
      }
      return rules;
    }
    const hoverRules = collectHoverRules();
    const hoverStyleMap = /* @__PURE__ */ new Map();
    function resolveHoverStyle(el) {
      const finalProps = /* @__PURE__ */ new Map();
      for (const { selector, style } of hoverRules) {
        try {
          if (!el.matches(selector)) continue;
        } catch (e) {
          continue;
        }
        for (let i = 0; i < style.length; i++) {
          const prop = style[i];
          finalProps.set(prop, [style.getPropertyValue(prop), style.getPropertyPriority(prop)]);
        }
      }
      if (!finalProps.size) return;
      const originalProps = Array.from(finalProps.keys()).map((prop) => [prop, el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)]);
      hoverStyleMap.set(el, {
        finalProps: Array.from(finalProps.entries()).map(([p, [v, pr]]) => [p, v, pr]),
        originalProps
      });
    }
    [navbarGroup, footbarGroup].filter(Boolean).forEach((g) => {
      g.container.querySelectorAll("a").forEach((item) => {
        resolveHoverStyle(item);
        item.querySelectorAll("img").forEach(resolveHoverStyle);
      });
    });
    console.log(`[Wizascript Controller] resolved hover styles for ${hoverStyleMap.size} curated element(s)`);
    function findHoverTarget(el) {
      if (!el) return null;
      if (hoverStyleMap.has(el)) return el;
      const link = el.closest && el.closest("a");
      if (link && hoverStyleMap.has(link)) return link;
      return null;
    }
    function applyCuratedHover(el) {
      const entry = hoverStyleMap.get(el);
      if (!entry) return;
      for (const [prop, val, pr] of entry.finalProps) el.style.setProperty(prop, val, pr);
    }
    function revertCuratedHover(el) {
      const entry = hoverStyleMap.get(el);
      if (!entry) return;
      for (const [prop, val, pr] of entry.originalProps) {
        if (val) el.style.setProperty(prop, val, pr);
        else el.style.removeProperty(prop);
      }
    }
    let hoverActiveEl = null;
    function setHoverTarget(target) {
      if (target === hoverActiveEl) return;
      if (hoverActiveEl) revertCuratedHover(hoverActiveEl);
      if (target) applyCuratedHover(target);
      hoverActiveEl = target;
    }
    let lastHitEl = null;
    function updateHover(el, cx, cy) {
      if (el !== lastHitEl) {
        if (lastHitEl) {
          fire(lastHitEl, "pointerout", PointerEvent, cx, cy, 0, 0);
          fire(lastHitEl, "mouseout", MouseEvent, cx, cy, 0, 0);
          fire(lastHitEl, "pointerleave", PointerEvent, cx, cy, 0, 0);
          fire(lastHitEl, "mouseleave", MouseEvent, cx, cy, 0, 0);
        }
        if (el) {
          fire(el, "pointerover", PointerEvent, cx, cy, 0, 0);
          fire(el, "mouseover", MouseEvent, cx, cy, 0, 0);
          fire(el, "pointerenter", PointerEvent, cx, cy, 0, 0);
          fire(el, "mouseenter", MouseEvent, cx, cy, 0, 0);
        }
        lastHitEl = el;
      }
      if (el) {
        fire(el, "pointermove", PointerEvent, cx, cy, 0, 0);
        fire(el, "mousemove", MouseEvent, cx, cy, 0, 0);
      }
      const focused = currentFocusedEl();
      setHoverTarget(findHoverTarget(focused || el));
    }
    document.addEventListener("mousemove", (e) => {
      if (!e.isTrusted) return;
      if (usingController) {
        console.log("[Wizascript Controller] real mouse movement detected -> forcing usingController OFF");
      }
      usingController = false;
      document.documentElement.style.cursor = "";
      cursor.style.display = "none";
      if (currentHighlightedEl) {
        clearHighlight(currentHighlightedEl);
        currentHighlightedEl = null;
      }
    }, true);
    let dpadHeld = { up: false, down: false, left: false, right: false };
    let btnHeld = {};
    let shortcutBtnHeld = {};
    let shortcutHeldByAction = {};
    function shortcutJustPressed(btnFn, actionKey) {
      const boundBtn = getBoundShortcutButton(actionKey);
      const isDown = boundBtn !== null && !!btnFn(boundBtn);
      const wasDown = !!shortcutHeldByAction[actionKey];
      shortcutHeldByAction[actionKey] = isDown;
      return isDown && !wasDown;
    }
    let keybindRelayHeld = { primary: false, controlDown: false, actions: {} };
    let primaryHoldHadAction = false;
    let guideMatchIndex = -1, guidePlayerIndex = 0, guideSelectedEl = null;
    let guideDpadHeld = { up: false, down: false, left: false, right: false };
    let guideBtn0Held = false;
    let guideNeedsReanchor = false;
    let leftHeldSince = 0, rightHeldSince = 0, lastPageTurnTime = 0;
    let dpadText = "";
    function openWizascriptSettings() {
      const base = { key: "Control", code: "ControlLeft", keyCode: 17, which: 17, bubbles: true };
      document.dispatchEvent(new KeyboardEvent("keydown", base));
      requestAnimationFrame(() => {
        document.dispatchEvent(new KeyboardEvent("keyup", base));
        requestAnimationFrame(() => {
          document.dispatchEvent(new KeyboardEvent("keydown", base));
          requestAnimationFrame(() => {
            document.dispatchEvent(new KeyboardEvent("keyup", base));
          });
        });
      });
      console.log("[Wizascript Controller] relayed a real Primary (Control) double-tap for Wizascript settings");
    }
    function frame() {
      try {
        hud.style.display = isDebugTextEnabled() ? "block" : "none";
        if (!isControllerSupportEnabled()) {
          if (usingController) {
            usingController = false;
            document.documentElement.style.cursor = "";
            cursor.style.display = "none";
            if (oskOpen) closeOsk();
          }
          return;
        }
        logRawGamepadStateIfChanged();
        const gp = getMergedGamepad();
        if (!gp) return;
        const lx = dz(gp.axes[0]), ly = dz(gp.axes[1]);
        const rx = dz(gp.axes[2]), ry = dz(gp.axes[3]);
        const up = gp.buttons[12] && gp.buttons[12].pressed;
        const down = gp.buttons[13] && gp.buttons[13].pressed;
        const left = gp.buttons[14] && gp.buttons[14].pressed;
        const right = gp.buttons[15] && gp.buttons[15].pressed;
        const btn = (i) => gp.buttons[i] && gp.buttons[i].pressed;
        const anyStick = lx || ly || rx || ry;
        const anyButton = gp.buttons.some((b) => b.pressed);
        if (anyStick) navInputMethod = "stick";
        else if (up || down || left || right) navInputMethod = "dpad";
        if (anyStick || anyButton) {
          if (!usingController) {
            usingController = true;
            document.documentElement.style.cursor = "none";
            if (!oskOpen && !sliderTarget && !selectTarget) cursor.style.display = cursorRestingDisplay();
          }
        }
        logMergedInputEdges(gp, usingController, anyStick);
        if (!usingController) return;
        if (btn(5) && !shortcutBtnHeld[5]) {
          if (oskOpen) {
            oskPaused = !oskPaused;
            oskEl.style.display = oskPaused ? "none" : "block";
            if (!oskPaused && oskTarget) {
              positionPanelNear(oskEl, oskTarget);
              updateOskHighlight();
            }
            console.log("[Wizascript Controller] OSK", oskPaused ? "paused" : "resumed");
          } else {
            document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", code: "Escape", bubbles: true }));
          }
        }
        if (btn(1) && !shortcutBtnHeld[1] && oskOpen && oskPaused) closeOsk();
        if (shortcutJustPressed(btn, "openSettings")) triggerElementClick(document.getElementById("btn-config"));
        if (shortcutJustPressed(btn, "yourDustpile") && !oskOpen) triggerElementClick(document.querySelector('.btn-dustpile[onclick*="openDustpile(true)"]'));
        if (shortcutJustPressed(btn, "opponentDustpile") && !oskOpen) triggerElementClick(document.querySelector('.btn-dustpile[onclick*="openDustpile(false)"]'));
        if (shortcutJustPressed(btn, "endTurn")) triggerElementClick(document.getElementById("endTurnBtn"));
        if (shortcutJustPressed(btn, "openWizascriptSettings") && !oskOpen) openWizascriptSettings();
        if (shortcutJustPressed(btn, "concede")) triggerConcede();
        if (shortcutJustPressed(btn, "goHome")) pageWindow2.location.href = "https://undercards.net/";
        if (shortcutJustPressed(btn, "openDeckTrackerPresets") && !oskOpen) triggerElementClick(document.getElementById("dt-add-tracker-button"));
        shortcutBtnHeld = { 1: btn(1), 5: btn(5) };
        if (!oskOpen || oskPaused) {
          const primaryBtn = getControllerPrimaryButton();
          const l1Down = primaryBtn !== null && btn(primaryBtn) || oskOpen && oskPaused;
          const viaPause = oskOpen && oskPaused;
          const primaryBase = { key: "Control", code: "ControlLeft", keyCode: 17, which: 17, bubbles: true };
          const guideBtnForRelay = getChannelGuideButton();
          const guideDownForRelay = guideBtnForRelay !== null && btn(guideBtnForRelay);
          if (l1Down) {
            if (!keybindRelayHeld.primary) primaryHoldHadAction = false;
          } else if (keybindRelayHeld.primary) {
            if (!primaryHoldHadAction) {
              const tapFocusEl = document.activeElement;
              if (tapFocusEl && tapFocusEl.matches && tapFocusEl.matches(".uc-li-text")) {
                const li = tapFocusEl.closest("li");
                if (li) {
                  const PATCH_MAKER_CYCLE_ORDER = ["none", "other", "buff", "rework", "nerf"];
                  const curIdx = PATCH_MAKER_CYCLE_ORDER.findIndex((c) => li.classList.contains(c));
                  const nextCat = PATCH_MAKER_CYCLE_ORDER[((curIdx === -1 ? 0 : curIdx) + 1) % PATCH_MAKER_CYCLE_ORDER.length];
                  li.classList.remove(...PATCH_MAKER_CYCLE_ORDER);
                  li.classList.add(nextCat);
                  let savedRange = null;
                  const sel = pageWindow2.getSelection();
                  if (sel && sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
                  tapFocusEl.blur();
                  tapFocusEl.focus();
                  if (savedRange) {
                    try {
                      const sel2 = pageWindow2.getSelection();
                      sel2.removeAllRanges();
                      sel2.addRange(savedRange);
                    } catch (e) {
                    }
                  }
                  console.log('[Wizascript Controller] Patch Maker: bare Controller Primary tap - cycled entry category directly to "' + nextCat + '"');
                }
              }
            }
          }
          const controlShouldBeDown = l1Down || guideDownForRelay;
          if (controlShouldBeDown && !keybindRelayHeld.controlDown) {
            document.dispatchEvent(new KeyboardEvent("keydown", primaryBase));
            keybindRelayHeld.controlDown = true;
          } else if (!controlShouldBeDown && keybindRelayHeld.controlDown) {
            document.dispatchEvent(new KeyboardEvent("keyup", primaryBase));
            keybindRelayHeld.controlDown = false;
          }
          if (l1Down) {
            const relaySecondary = (code, key) => {
              const opts = { key, code, bubbles: true };
              document.dispatchEvent(new KeyboardEvent("keydown", opts));
              document.dispatchEvent(new KeyboardEvent("keyup", opts));
            };
            const pmFocusForContext = document.activeElement;
            const inPatchMakerFieldForContext = !!(pmFocusForContext && pmFocusForContext.matches && pmFocusForContext.matches(".uc-li-text, .uc-section-label, .uc-card-item"));
            const nextActionHeld = {};
            const codesFiredThisFrame = /* @__PURE__ */ new Set();
            CONTROLLER_ACTIONS.forEach((action) => {
              let applies;
              if (action.context === "always") applies = true;
              else if (action.context === "channelSwitch") applies = !inPatchMakerFieldForContext;
              else if (action.context === "patchMaker") applies = inPatchMakerFieldForContext;
              else applies = !inPatchMakerFieldForContext;
              const boundBtn = applies ? getBoundButton(action.key) : null;
              const isDown = boundBtn !== null && btn(boundBtn);
              nextActionHeld[action.key] = isDown;
              if (isDown && !keybindRelayHeld.actions[action.key]) {
                const sig = action.dispatch.code;
                if (!codesFiredThisFrame.has(sig)) {
                  codesFiredThisFrame.add(sig);
                  relaySecondary(action.dispatch.code, action.dispatch.key);
                  primaryHoldHadAction = true;
                }
              }
            });
            keybindRelayHeld.actions = nextActionHeld;
            hud.textContent = inPatchMakerFieldForContext ? `Patch Maker (${viaPause ? "OSK paused" : "Primary held"})
tap Primary alone = cycle category   move entry-section-card \u2014 see Settings > Keybinds - Controller${viaPause ? `
R1: resume typing   ${btnLabel(1)}: close` : ""}` : `Wizascript keybind relay (${viaPause ? "OSK paused" : "Primary held"})
channel / notepad redo-undo-toggle-reset \u2014 see Settings > Keybinds - Controller${viaPause ? `
R1: resume typing   ${btnLabel(1)}: close` : ""}`;
          } else {
            keybindRelayHeld.actions = {};
          }
          keybindRelayHeld.primary = l1Down;
          if (l1Down) return;
        }
        if (!oskOpen || oskPaused) {
          const guideBtn = getChannelGuideButton();
          const guideDown = guideBtn !== null && btn(guideBtn);
          if (guideDown) {
            const guideEl = document.getElementById("uctv-guide-overlay");
            if (!guideEl) {
              hud.textContent = `UC TV Guide loading\u2026
release ${buttonToDisplay(guideBtn)} to cancel`;
            } else {
              const playerSpans = Array.from(guideEl.querySelectorAll("span")).filter((el) => el.style.cursor === "pointer");
              const matches = [];
              const rows = [];
              const rowIndex = /* @__PURE__ */ new Map();
              playerSpans.forEach((el) => {
                const row = el.parentElement;
                if (!rowIndex.has(row)) {
                  rowIndex.set(row, matches.length);
                  matches.push([]);
                  rows.push(row);
                }
                matches[rowIndex.get(row)].push(el);
              });
              if (!matches.length) {
                guideMatchIndex = -1;
                guidePlayerIndex = 0;
                guideSelectedEl = null;
                guideNeedsReanchor = false;
                hud.textContent = `UC TV Guide
no matches shown
release ${buttonToDisplay(guideBtn)} to close`;
              } else {
                if (ry !== 0) {
                  guideEl.scrollTop += ry * 30;
                  if (guideSelectedEl) {
                    guideSelectedEl.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
                    guideSelectedEl = null;
                  }
                  guideMatchIndex = -1;
                  guideNeedsReanchor = true;
                }
                const dpadPressed = up && !guideDpadHeld.up || down && !guideDpadHeld.down || left && !guideDpadHeld.left || right && !guideDpadHeld.right;
                if (guideNeedsReanchor && !dpadPressed) {
                  guideDpadHeld = { up, down, left, right };
                  guideBtn0Held = btn(0);
                  hud.textContent = `UC TV Guide
(scrolled - press \u2191\u2193\u2190\u2192 to resume navigating)
release ${buttonToDisplay(guideBtn)} to close`;
                  return;
                }
                let justReanchored = false;
                if (guideNeedsReanchor && dpadPressed) {
                  guideMatchIndex = topVisibleRowIndex(rows, guideEl);
                  guidePlayerIndex = 0;
                  guideNeedsReanchor = false;
                  justReanchored = true;
                }
                if (guideMatchIndex < 0 || guideMatchIndex >= matches.length) {
                  guideMatchIndex = 0;
                  guidePlayerIndex = 0;
                }
                if (!justReanchored) {
                  if (up && !guideDpadHeld.up) {
                    guideMatchIndex = Math.max(0, guideMatchIndex - 1);
                    guidePlayerIndex = 0;
                  }
                  if (down && !guideDpadHeld.down) {
                    guideMatchIndex = Math.min(matches.length - 1, guideMatchIndex + 1);
                    guidePlayerIndex = 0;
                  }
                }
                const playersInMatch = matches[guideMatchIndex];
                guidePlayerIndex = Math.min(guidePlayerIndex, playersInMatch.length - 1);
                if (!justReanchored) {
                  if (left && !guideDpadHeld.left) guidePlayerIndex = Math.max(0, guidePlayerIndex - 1);
                  if (right && !guideDpadHeld.right) guidePlayerIndex = Math.min(playersInMatch.length - 1, guidePlayerIndex + 1);
                }
                const sel = playersInMatch[guidePlayerIndex];
                if (sel !== guideSelectedEl) {
                  if (guideSelectedEl) guideSelectedEl.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
                  sel.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
                  sel.scrollIntoView({ block: "nearest" });
                  guideSelectedEl = sel;
                }
                if (btn(0) && !guideBtn0Held) sel.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
                hud.textContent = `UC TV Guide
match ${guideMatchIndex + 1}/${matches.length}${playersInMatch.length > 1 ? `   player ${guidePlayerIndex + 1}/${playersInMatch.length}` : ""}
\u2191/\u2193 match   \u2190/\u2192 player   ${btnLabel(0)} jump   release ${buttonToDisplay(guideBtn)} to close`;
              }
            }
            guideDpadHeld = { up, down, left, right };
            guideBtn0Held = btn(0);
            return;
          } else {
            guideMatchIndex = -1;
            guidePlayerIndex = 0;
            guideSelectedEl = null;
            guideNeedsReanchor = false;
          }
        }
        if (!oskOpen && !sliderTarget && !selectTarget && btn(0)) {
          cursor.style.display = "none";
          const notepadHitEl = document.elementFromPoint(x, y);
          cursor.style.display = "block";
          if (notepadHitEl && isSlider(notepadHitEl) && notepadHitEl.closest(".wizascript-notepad")) {
            openSlider(notepadHitEl);
            return;
          }
        }
        if (oskOpen && !oskPaused) {
          const oskSpeedMult = Math.max(0.3, Math.min(3, 1 - rx * 2));
          x = Math.max(0, Math.min(pageWindow2.innerWidth, x + lx * BASE_SPEED * oskSpeedMult));
          y = Math.max(0, Math.min(pageWindow2.innerHeight, y + ly * BASE_SPEED * oskSpeedMult));
          cursor.style.left = x + "px";
          cursor.style.top = y + "px";
          cursor.style.display = "block";
          if (lx || ly) {
            hoverKey:
              for (let r = 0; r < oskRowEls.length; r++) {
                for (let c = 0; c < oskRowEls[r].length; c++) {
                  const kr = oskRowEls[r][c].getBoundingClientRect();
                  if (x >= kr.left && x <= kr.right && y >= kr.top && y <= kr.bottom) {
                    if (oskRow !== r || oskCol !== c) {
                      oskRow = r;
                      oskCol = c;
                      updateOskHighlight();
                    }
                    break hoverKey;
                  }
                }
              }
          }
          const row = activeRows[oskRow];
          if (up && !dpadHeld.up) {
            oskRow = Math.max(0, oskRow - 1);
            oskCol = Math.min(oskCol, activeRows[oskRow].length - 1);
            updateOskHighlight();
          }
          if (down && !dpadHeld.down) {
            oskRow = Math.min(activeRows.length - 1, oskRow + 1);
            oskCol = Math.min(oskCol, activeRows[oskRow].length - 1);
            updateOskHighlight();
          }
          if (left && !dpadHeld.left) {
            oskCol = (oskCol - 1 + row.length) % row.length;
            updateOskHighlight();
          }
          if (right && !dpadHeld.right) {
            oskCol = (oskCol + 1) % row.length;
            updateOskHighlight();
          }
          dpadHeld = { up, down, left, right };
          if (btn(0) && !btnHeld[0]) pressKey(activeRows[oskRow][oskCol]);
          if (btn(2) && !btnHeld[2] && oskTarget) typeBackspace(oskTarget);
          if (btn(3) && !btnHeld[3] && oskTarget) typeChar(oskTarget, " ");
          if (btn(4) && !btnHeld[4]) {
            oskShift = !oskShift;
            renderOskLabels();
          }
          if (btn(6) && !btnHeld[6]) {
            const now = performance.now();
            if (now - lastL2TapTime < DOUBLE_TAP_WINDOW_MS2) setOskCaretEdge(true);
            else stepOskCaret(-1);
            lastL2TapTime = now;
          }
          if (btn(7) && !btnHeld[7]) {
            const now = performance.now();
            if (now - lastR2TapTime < DOUBLE_TAP_WINDOW_MS2) setOskCaretEdge(false);
            else stepOskCaret(1);
            lastR2TapTime = now;
          }
          if (btn(10) && !btnHeld[10]) {
            oskPage = oskPage === "letters" ? "symbols" : "letters";
            activeRows = KEY_PAGES[oskPage];
            buildGrid(activeRows);
            oskRow = 0;
            oskCol = 0;
            if (oskTarget) positionPanelNear(oskEl, oskTarget);
            updateOskHighlight();
          }
          if (btn(11) && !btnHeld[11] && oskTarget) dispatchEnterKey(oskTarget);
          if (btn(1) && !btnHeld[1]) closeOsk();
          btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3), 4: btn(4), 6: btn(6), 7: btn(7), 10: btn(10), 11: btn(11) };
          hud.textContent = `on-screen keyboard [${oskPage}]
row ${oskRow + 1}/${activeRows.length} col ${oskCol + 1}/${row.length}${oskShift ? " [SHIFT]" : ""}`;
          return;
        }
        if (selectTarget) {
          const selSpeedMult = Math.max(0.3, Math.min(3, 1 - rx * 2));
          x = Math.max(0, Math.min(pageWindow2.innerWidth, x + lx * BASE_SPEED * selSpeedMult));
          y = Math.max(0, Math.min(pageWindow2.innerHeight, y + ly * BASE_SPEED * selSpeedMult));
          cursor.style.left = x + "px";
          cursor.style.top = y + "px";
          cursor.style.display = "block";
          if (lx || ly) {
            for (let i = 0; i < selectRowEls.length; i++) {
              const rr = selectRowEls[i].getBoundingClientRect();
              if (x >= rr.left && x <= rr.right && y >= rr.top && y <= rr.bottom) {
                if (selectIndex !== i) {
                  selectIndex = i;
                  updateSelectHighlight();
                }
                break;
              }
            }
          }
          if (ry !== 0) selectEl.scrollTop += ry * 20;
          if (up && !dpadHeld.up) {
            selectIndex = Math.max(0, selectIndex - 1);
            updateSelectHighlight();
            selectRowEls[selectIndex].scrollIntoView({ block: "nearest" });
          }
          if (down && !dpadHeld.down) {
            selectIndex = Math.min(selectOptions.length - 1, selectIndex + 1);
            updateSelectHighlight();
            selectRowEls[selectIndex].scrollIntoView({ block: "nearest" });
          }
          dpadHeld = { up, down, left, right };
          if (btn(0) && !btnHeld[0]) confirmSelectPicker();
          if (btn(1) && !btnHeld[1]) {
            closeSelectPicker();
            btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
            return;
          }
          btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
          hud.textContent = `select list
${selectOptions[selectIndex] ? selectOptions[selectIndex].text : ""}
D-Pad/cursor: browse   ${btnLabel(0)} confirm   ${btnLabel(1)} cancel`;
          return;
        }
        if (sliderTarget) {
          const speedMult2 = Math.max(0.3, Math.min(3, 1 - rx * 2));
          x = Math.max(0, Math.min(pageWindow2.innerWidth, x + lx * BASE_SPEED * speedMult2));
          y = Math.max(0, Math.min(pageWindow2.innerHeight, y + ly * BASE_SPEED * speedMult2));
          cursor.style.left = x + "px";
          cursor.style.top = y + "px";
          const now = performance.now();
          const REPEAT_INITIAL_DELAY = 400, REPEAT_INTERVAL = 120;
          if (left) {
            if (!dpadHeld.left) {
              leftHeldSince = now;
              adjustSlider(-1);
              lastPageTurnTime = now;
            } else if (now - leftHeldSince > REPEAT_INITIAL_DELAY && now - lastPageTurnTime > REPEAT_INTERVAL) {
              adjustSlider(-1);
              lastPageTurnTime = now;
            }
          } else leftHeldSince = 0;
          if (right) {
            if (!dpadHeld.right) {
              rightHeldSince = now;
              adjustSlider(1);
              lastPageTurnTime = now;
            } else if (now - rightHeldSince > REPEAT_INITIAL_DELAY && now - lastPageTurnTime > REPEAT_INTERVAL) {
              adjustSlider(1);
              lastPageTurnTime = now;
            }
          } else rightHeldSince = 0;
          dpadHeld = { up, down, left, right };
          if (btn(0)) {
            cursor.style.display = "block";
            setSliderValueFromPointer(sliderTarget, x);
          } else {
            cursor.style.display = "none";
          }
          if (btn(1) && !btnHeld[1]) {
            closeSlider();
            btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
            return;
          }
          btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
          hud.textContent = `slider focused
value: ${sliderTarget.value}
left/right = fine-tune   ${btnLabel(0)} hold = drag   ${btnLabel(1)} = done`;
          return;
        }
        const mulliganHost = document.querySelector(".mulligan");
        if (!mulliganHost && mulliganGrid) {
          mulliganGrid = null;
          refreshHighlight();
        }
        if (mulliganHost) {
          const mulSpeedMult = Math.max(0.3, Math.min(3, 1 - rx * 2));
          x = Math.max(0, Math.min(pageWindow2.innerWidth, x + lx * BASE_SPEED * mulSpeedMult));
          y = Math.max(0, Math.min(pageWindow2.innerHeight, y + ly * BASE_SPEED * mulSpeedMult));
          cursor.style.left = x + "px";
          cursor.style.top = y + "px";
          cursor.style.display = cursorRestingDisplay();
          const mulliganCards = Array.from(mulliganHost.querySelectorAll(":scope > .card")).filter((el) => el.offsetParent !== null);
          const confirmBtn = document.querySelector(".bootstrap-dialog-footer-buttons .btn-primary") || document.querySelector(".modal-footer .btn-primary");
          const mulliganItems = confirmBtn ? [...mulliganCards, confirmBtn] : mulliganCards;
          if (!mulliganItems.length) {
            hud.textContent = "mulligan (nothing navigable found)";
            return;
          }
          if (!mulliganGrid || !elArraysEqual(gridFlat(mulliganGrid), mulliganItems)) {
            mulliganGrid = buildRowGrid(mulliganItems);
            mulliganRow = 0;
            mulliganCol = 0;
          }
          mulliganRow = Math.min(mulliganRow, mulliganGrid.length - 1);
          mulliganCol = Math.min(mulliganCol, mulliganGrid[mulliganRow].length - 1);
          if (lx || ly) {
            hoverMulligan:
              for (let r = 0; r < mulliganGrid.length; r++) {
                for (let c = 0; c < mulliganGrid[r].length; c++) {
                  const rr = mulliganGrid[r][c].getBoundingClientRect();
                  if (x >= rr.left && x <= rr.right && y >= rr.top && y <= rr.bottom) {
                    mulliganRow = r;
                    mulliganCol = c;
                    break hoverMulligan;
                  }
                }
              }
          }
          if (ry !== 0) {
            const scrollable = findRealScrollable(mulliganGrid[mulliganRow][mulliganCol] || mulliganItems[0]);
            if (scrollable) scrollable.scrollTop += ry * 30;
          }
          if (up && !dpadHeld.up) mulliganRow = Math.max(0, mulliganRow - 1);
          if (down && !dpadHeld.down) mulliganRow = Math.min(mulliganGrid.length - 1, mulliganRow + 1);
          mulliganCol = Math.min(mulliganCol, mulliganGrid[mulliganRow].length - 1);
          if (left && !dpadHeld.left) mulliganCol = (mulliganCol - 1 + mulliganGrid[mulliganRow].length) % mulliganGrid[mulliganRow].length;
          if (right && !dpadHeld.right) mulliganCol = (mulliganCol + 1) % mulliganGrid[mulliganRow].length;
          if (up && !dpadHeld.up || down && !dpadHeld.down || left && !dpadHeld.left || right && !dpadHeld.right) {
            const selEl = mulliganGrid[mulliganRow][mulliganCol];
            if (selEl) selEl.scrollIntoView({ block: "nearest", inline: "nearest" });
          }
          dpadHeld = { up, down, left, right };
          refreshHighlight();
          if (navInputMethod !== "dpad") {
            updateHover(mulliganGrid[mulliganRow][mulliganCol], x, y);
          }
          if (btn(0) && !btnHeld[0]) {
            const el = mulliganGrid[mulliganRow][mulliganCol];
            const r = el.getBoundingClientRect();
            dispatchClick(el, r.left + r.width / 2, r.top + r.height / 2, 0);
            console.log("[Wizascript Controller] mulligan item clicked", el);
          }
          btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
          const focusedIsConfirm = mulliganGrid[mulliganRow][mulliganCol] === confirmBtn;
          hud.textContent = `mulligan
row ${mulliganRow + 1}/${mulliganGrid.length}, col ${mulliganCol + 1}/${mulliganGrid[mulliganRow].length}
${btnLabel(0)} ${focusedIsConfirm ? "confirm" : "toggle swap"}`;
          return;
        }
        const modalInfo = queryModalRoot();
        if (fieldSubmenu && fieldSubmenu.isAlive && !fieldSubmenu.isAlive()) fieldSubmenu = null;
        if (!modalInfo && modalKind) {
          modalGrid = null;
          modalKind = null;
          modalPane = "categories";
          categoryItems = [];
          categoryIndex = 0;
          fieldGrid = null;
          fieldRow = 0;
          fieldCol = 0;
          if (fieldSubmenu) {
            fieldSubmenu.onCancel && fieldSubmenu.onCancel();
            fieldSubmenu = null;
          }
          refreshHighlight();
        }
        if (modalInfo && modalInfo.kind !== "tabbed" && modalKind === "tabbed") {
          modalPane = "categories";
          categoryItems = [];
          categoryIndex = 0;
          fieldGrid = null;
          fieldRow = 0;
          fieldCol = 0;
          if (fieldSubmenu) {
            fieldSubmenu.onCancel && fieldSubmenu.onCancel();
            fieldSubmenu = null;
          }
        }
        if (modalInfo && modalInfo.kind === "tabbed" && modalKind !== "tabbed") {
          modalPane = "categories";
          fieldGrid = null;
          fieldRow = 0;
          fieldCol = 0;
          lastKnownActiveCategoryIdx = -1;
          if (fieldSubmenu) {
            fieldSubmenu.onCancel && fieldSubmenu.onCancel();
            fieldSubmenu = null;
          }
        }
        if (modalInfo) {
          const { root, kind } = modalInfo;
          modalKind = kind;
          const modSpeedMult = Math.max(0.3, Math.min(3, 1 - rx * 2));
          x = Math.max(0, Math.min(pageWindow2.innerWidth, x + lx * BASE_SPEED * modSpeedMult));
          y = Math.max(0, Math.min(pageWindow2.innerHeight, y + ly * BASE_SPEED * modSpeedMult));
          cursor.style.left = x + "px";
          cursor.style.top = y + "px";
          cursor.style.display = cursorRestingDisplay();
          if (kind === "tabbed") {
            const { tabbedRoot } = modalInfo;
            const liveCategories = queryCategoryItems(tabbedRoot);
            if (!elArraysEqual(categoryItems, liveCategories)) {
              const prevCat = categoryItems[categoryIndex];
              categoryItems = liveCategories;
              const keep = prevCat ? categoryItems.indexOf(prevCat) : -1;
              categoryIndex = keep >= 0 ? keep : Math.min(categoryIndex, Math.max(0, categoryItems.length - 1));
            }
            if (categoryItems.length) {
              const activeIdx = categoryItems.findIndex((label) => {
                const radio = label.previousElementSibling;
                return radio && radio.tagName === "INPUT" && radio.checked;
              });
              if (activeIdx >= 0) {
                if (activeIdx !== lastKnownActiveCategoryIdx) categoryIndex = activeIdx;
                lastKnownActiveCategoryIdx = activeIdx;
              }
            }
            const activeContent = queryActiveTabContent(tabbedRoot);
            const liveFieldRows = activeContent ? queryFieldRows(activeContent) : [];
            const liveFieldsFlat = liveFieldRows.flat();
            if (!fieldGrid || !elArraysEqual(gridFlat(fieldGrid), liveFieldsFlat)) {
              fieldGrid = liveFieldRows;
              fieldRow = 0;
              fieldCol = 0;
              fieldNeedsReanchor = false;
            }
            if (fieldGrid.length) {
              fieldRow = Math.min(fieldRow, fieldGrid.length - 1);
              fieldCol = Math.min(fieldCol, fieldGrid[fieldRow].length - 1);
            }
            if (lx || ly) {
              if (modalPane === "categories") {
                for (let i = 0; i < categoryItems.length; i++) {
                  const rr = categoryItems[i].getBoundingClientRect();
                  if (x >= rr.left && x <= rr.right && y >= rr.top && y <= rr.bottom) {
                    categoryIndex = i;
                    break;
                  }
                }
              } else {
                hoverField:
                  for (let r = 0; r < fieldGrid.length; r++) {
                    for (let c = 0; c < fieldGrid[r].length; c++) {
                      const rr = fieldGrid[r][c].getBoundingClientRect();
                      if (x >= rr.left && x <= rr.right && y >= rr.top && y <= rr.bottom) {
                        fieldRow = r;
                        fieldCol = c;
                        break hoverField;
                      }
                    }
                  }
              }
            }
            if (ry !== 0) {
              const scrollEl = modalPane === "categories" ? categoryItems[categoryIndex] : (fieldGrid[fieldRow] || [])[fieldCol];
              const scrollable = findRealScrollable(scrollEl || activeContent || root);
              if (scrollable) scrollable.scrollTop += ry * 30;
              if (modalPane === "fields") fieldNeedsReanchor = true;
            }
            if (modalPane === "categories") {
              if (up && !dpadHeld.up && categoryItems.length) categoryIndex = Math.max(0, categoryIndex - 1);
              if (down && !dpadHeld.down && categoryItems.length) categoryIndex = Math.min(categoryItems.length - 1, categoryIndex + 1);
              if (right && !dpadHeld.right) enterCategory();
              dpadHeld = { up, down, left, right };
              refreshHighlight();
              if (btn(0) && !btnHeld[0]) enterCategory();
              if (btn(1) && !btnHeld[1] && !isControllerCaptureActive()) {
                const dismiss = findModalDismissButton(root);
                if (dismiss) triggerElementClick(dismiss);
                else document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", code: "Escape", bubbles: true }));
              }
              btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
              hud.textContent = `settings: categories (${categoryItems.length ? categoryIndex + 1 : 0}/${categoryItems.length})
${btnLabel(0)}/\u2192 open category   ${btnLabel(1)} close dialog`;
            } else if (fieldSubmenu) {
              if (up && !dpadHeld.up) fieldSubmenu.index = (fieldSubmenu.index - 1 + fieldSubmenu.items.length) % fieldSubmenu.items.length;
              if (down && !dpadHeld.down) fieldSubmenu.index = (fieldSubmenu.index + 1) % fieldSubmenu.items.length;
              const wasLeftOrB1Held = dpadHeld.left || btnHeld[1];
              dpadHeld = { up, down, left, right };
              refreshHighlight();
              if (btn(0) && !btnHeld[0]) {
                const item = fieldSubmenu.items[fieldSubmenu.index];
                fieldSubmenu.onConfirm(item);
                fieldSubmenu = null;
              } else if ((btn(1) || left) && !wasLeftOrB1Held) {
                fieldSubmenu.onCancel();
                fieldSubmenu = null;
              }
              btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
              const idx = fieldSubmenu ? fieldSubmenu.index + 1 : 0;
              const total = fieldSubmenu ? fieldSubmenu.items.length : 0;
              hud.textContent = `settings: submenu (${idx}/${total})
${btnLabel(0)} select   \u2190/${btnLabel(1)} cancel`;
            } else {
              if (!isControllerCaptureActive()) {
                if (fieldGrid.length) {
                  const dpadPressed = up && !dpadHeld.up || down && !dpadHeld.down || left && !dpadHeld.left || right && !dpadHeld.right;
                  if (fieldNeedsReanchor) {
                    if (dpadPressed) {
                      const rowAnchors = fieldGrid.map((r) => r[0]);
                      const scrollableNow = findRealScrollable(rowAnchors[fieldRow] || activeContent || root) || activeContent || root;
                      fieldRow = topVisibleRowIndex(rowAnchors, scrollableNow);
                      fieldCol = 0;
                      fieldNeedsReanchor = false;
                    }
                  } else {
                    if (up && !dpadHeld.up) fieldRow = Math.max(0, fieldRow - 1);
                    if (down && !dpadHeld.down) fieldRow = Math.min(fieldGrid.length - 1, fieldRow + 1);
                    fieldCol = Math.min(fieldCol, fieldGrid[fieldRow].length - 1);
                    if (right && !dpadHeld.right) fieldCol = Math.min(fieldGrid[fieldRow].length - 1, fieldCol + 1);
                    if (left && !dpadHeld.left) {
                      if (fieldCol > 0) fieldCol -= 1;
                      else modalPane = "categories";
                    }
                    if (dpadPressed) {
                      const selEl = fieldGrid[fieldRow] && fieldGrid[fieldRow][fieldCol];
                      if (selEl) selEl.scrollIntoView({ block: "nearest", inline: "nearest" });
                    }
                  }
                } else if (left && !dpadHeld.left) {
                  modalPane = "categories";
                }
              }
              dpadHeld = { up, down, left, right };
              refreshHighlight();
              if (!isControllerCaptureActive()) {
                if (btn(0) && !btnHeld[0]) activateHighlighted(0);
                if (btn(3) && !btnHeld[3]) activateHighlighted(2);
                if (btn(1) && !btnHeld[1]) modalPane = "categories";
              }
              btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
              const fieldPos = fieldGrid.length ? `row ${fieldRow + 1}/${fieldGrid.length}, col ${fieldCol + 1}/${fieldGrid[fieldRow].length}` : "(empty)";
              hud.textContent = `settings: fields ${fieldPos}
${btnLabel(0)} activate   ${btnLabel(3)} alt-activate   \u2190/${btnLabel(1)} back to categories`;
            }
            return;
          }
          const modalItems = kind === "plain" ? [...queryModalItems(root), ...queryScrollableListItems(root)] : queryModalItems(root);
          if (!modalItems.length) {
            hud.textContent = `${kind === "menu" ? "underscript menu" : "dialog"} (nothing navigable found)`;
            return;
          }
          if (!modalGrid || !elArraysEqual(gridFlat(modalGrid), modalItems)) {
            modalGrid = kind === "menu" ? modalItems.map((el) => [el]) : buildRowGrid(modalItems);
            modalRow = 0;
            modalCol = 0;
          }
          modalRow = Math.min(modalRow, modalGrid.length - 1);
          modalCol = Math.min(modalCol, modalGrid[modalRow].length - 1);
          if (lx || ly) {
            hoverModal:
              for (let r = 0; r < modalGrid.length; r++) {
                for (let c = 0; c < modalGrid[r].length; c++) {
                  const rr = modalGrid[r][c].getBoundingClientRect();
                  if (x >= rr.left && x <= rr.right && y >= rr.top && y <= rr.bottom) {
                    modalRow = r;
                    modalCol = c;
                    break hoverModal;
                  }
                }
              }
          }
          if (ry !== 0) {
            const scrollable = findRealScrollable(modalGrid[modalRow][modalCol] || modalItems[0]) || findScrollableDescendant(root);
            if (scrollable) scrollable.scrollTop += ry * 30;
          }
          if (up && !dpadHeld.up) modalRow = Math.max(0, modalRow - 1);
          if (down && !dpadHeld.down) modalRow = Math.min(modalGrid.length - 1, modalRow + 1);
          modalCol = Math.min(modalCol, modalGrid[modalRow].length - 1);
          if (left && !dpadHeld.left) modalCol = (modalCol - 1 + modalGrid[modalRow].length) % modalGrid[modalRow].length;
          if (right && !dpadHeld.right) modalCol = (modalCol + 1) % modalGrid[modalRow].length;
          if (up && !dpadHeld.up || down && !dpadHeld.down || left && !dpadHeld.left || right && !dpadHeld.right) {
            const selEl = modalGrid[modalRow][modalCol];
            if (selEl) selEl.scrollIntoView({ block: "nearest", inline: "nearest" });
          }
          dpadHeld = { up, down, left, right };
          refreshHighlight();
          if (btn(0) && !btnHeld[0]) activateHighlighted(0);
          if (btn(3) && !btnHeld[3]) activateHighlighted(2);
          if (btn(1) && !btnHeld[1] && !isControllerCaptureActive()) {
            if (kind === "menu") {
              document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", code: "Escape", bubbles: true }));
            } else {
              const dismiss = findModalDismissButton(root);
              if (dismiss) triggerElementClick(dismiss);
              else document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", code: "Escape", bubbles: true }));
            }
          }
          btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
          hud.textContent = `${kind === "menu" ? "underscript menu" : "dialog"}
row ${modalRow + 1}/${modalGrid.length}, col ${modalCol + 1}/${modalGrid[modalRow].length}
${btnLabel(0)} activate   ${btnLabel(3)} alt-activate   ${btnLabel(1)} close`;
          return;
        }
        const handHost = document.getElementById("handCards");
        if (!handHost && matchPhase !== "hand") {
          matchPhase = "hand";
          placingGrid = null;
          placingCard = null;
          resolveGrid = null;
          matchSubState = "hand-nav";
          pendingAttacker = null;
        }
        if (handHost) {
          const mSpeedMult = Math.max(0.3, Math.min(3, 1 - rx * 2));
          x = Math.max(0, Math.min(pageWindow2.innerWidth, x + lx * BASE_SPEED * mSpeedMult));
          y = Math.max(0, Math.min(pageWindow2.innerHeight, y + ly * BASE_SPEED * mSpeedMult));
          cursor.style.left = x + "px";
          cursor.style.top = y + "px";
          cursor.style.display = cursorRestingDisplay();
          if (matchPhase === "placing" && anyStick) {
            cancelPlacingDrag("stick movement");
            matchSubState = "neutral";
            hud.textContent = "placement cancelled (stick moved)";
            return;
          }
          if (matchPhase === "placing") {
            const activeEls = Array.from(document.querySelectorAll(".ui-droppable-active"));
            if (!activeEls.length) {
              matchPhase = "hand";
              refreshHighlight();
            } else {
              if (!placingGrid || !elArraysEqual(gridFlat(placingGrid), activeEls)) {
                placingGrid = buildRowGrid(activeEls);
                placingRow = 0;
                placingCol = 0;
              }
              placingRow = Math.min(placingRow, placingGrid.length - 1);
              placingCol = Math.min(placingCol, placingGrid[placingRow].length - 1);
              if (lx || ly) {
                hoverSlot:
                  for (let r = 0; r < placingGrid.length; r++) {
                    for (let c = 0; c < placingGrid[r].length; c++) {
                      const rr = placingGrid[r][c].getBoundingClientRect();
                      if (x >= rr.left && x <= rr.right && y >= rr.top && y <= rr.bottom) {
                        placingRow = r;
                        placingCol = c;
                        break hoverSlot;
                      }
                    }
                  }
              }
              if (up && !dpadHeld.up) placingRow = Math.max(0, placingRow - 1);
              if (down && !dpadHeld.down) placingRow = Math.min(placingGrid.length - 1, placingRow + 1);
              placingCol = Math.min(placingCol, placingGrid[placingRow].length - 1);
              if (left && !dpadHeld.left) placingCol = (placingCol - 1 + placingGrid[placingRow].length) % placingGrid[placingRow].length;
              if (right && !dpadHeld.right) placingCol = (placingCol + 1) % placingGrid[placingRow].length;
              dpadHeld = { up, down, left, right };
              refreshHighlight();
              const targetSlot = placingGrid[placingRow][placingCol];
              const tr = targetSlot.getBoundingClientRect();
              const tcx = tr.left + tr.width / 2, tcy = tr.top + tr.height / 2;
              fire(targetSlot, "pointermove", PointerEvent, tcx, tcy, 0, 1);
              fire(targetSlot, "mousemove", MouseEvent, tcx, tcy, 0, 1);
              if (btn(0) && !btnHeld[0]) {
                fire(targetSlot, "pointerup", PointerEvent, tcx, tcy, 0, 0);
                fire(targetSlot, "mouseup", MouseEvent, tcx, tcy, 0, 0);
                console.log("[Wizascript Controller] card dropped on", targetSlot);
                placingCard = null;
                placingGrid = null;
                matchPhase = "hand";
                refreshHighlight();
              } else if (btn(1) && !btnHeld[1]) {
                cancelPlacingDrag("circle button");
              }
              btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
              hud.textContent = `placing card
slot row ${placingRow + 1}/${placingGrid.length}, col ${placingCol + 1}/${placingGrid[placingRow].length}
${btnLabel(0)} drop here   ${btnLabel(1)} cancel`;
              return;
            }
          }
          const choiceEls = Array.from(document.querySelectorAll(".select-card-option.target"));
          const targetEls = choiceEls.length ? [] : Array.from(document.querySelectorAll(".target:not(.select-card-option)"));
          const resolveEls = choiceEls.length ? choiceEls : targetEls;
          if (resolveEls.length) {
            matchPhase = "resolve";
            resolveKind = choiceEls.length ? "choice" : "target";
            if (!resolveGrid || !elArraysEqual(gridFlat(resolveGrid), resolveEls)) {
              resolveGrid = buildRowGrid(resolveEls);
              resolveRow = 0;
              resolveCol = 0;
            }
            resolveRow = Math.min(resolveRow, resolveGrid.length - 1);
            resolveCol = Math.min(resolveCol, resolveGrid[resolveRow].length - 1);
            if (lx || ly) {
              hoverTarget:
                for (let r = 0; r < resolveGrid.length; r++) {
                  for (let c = 0; c < resolveGrid[r].length; c++) {
                    const rr = resolveGrid[r][c].getBoundingClientRect();
                    if (x >= rr.left && x <= rr.right && y >= rr.top && y <= rr.bottom) {
                      resolveRow = r;
                      resolveCol = c;
                      break hoverTarget;
                    }
                  }
                }
            }
            if (ry !== 0) {
              const scrollable = findRealScrollable(resolveGrid[resolveRow][resolveCol] || resolveEls[0]);
              if (scrollable) scrollable.scrollTop += ry * 30;
            }
            if (up && !dpadHeld.up) resolveRow = Math.max(0, resolveRow - 1);
            if (down && !dpadHeld.down) resolveRow = Math.min(resolveGrid.length - 1, resolveRow + 1);
            resolveCol = Math.min(resolveCol, resolveGrid[resolveRow].length - 1);
            if (left && !dpadHeld.left) resolveCol = (resolveCol - 1 + resolveGrid[resolveRow].length) % resolveGrid[resolveRow].length;
            if (right && !dpadHeld.right) resolveCol = (resolveCol + 1) % resolveGrid[resolveRow].length;
            if (up && !dpadHeld.up || down && !dpadHeld.down || left && !dpadHeld.left || right && !dpadHeld.right) {
              const selEl = resolveGrid[resolveRow][resolveCol];
              if (selEl) selEl.scrollIntoView({ block: "nearest", inline: "nearest" });
            }
            dpadHeld = { up, down, left, right };
            refreshHighlight();
            if (navInputMethod !== "dpad") {
              updateHover(resolveGrid[resolveRow][resolveCol], x, y);
            }
            if (btn(0) && !btnHeld[0]) {
              if (navInputMethod === "dpad") {
                const el = resolveGrid[resolveRow][resolveCol];
                const r = el.getBoundingClientRect();
                dispatchClick(el, r.left + r.width / 2, r.top + r.height / 2, 0);
                console.log("[Wizascript Controller] resolve target confirmed (d-pad)", el);
              } else {
                cursor.style.display = "none";
                const hitEl2 = document.elementFromPoint(x, y);
                cursor.style.display = cursorRestingDisplay();
                if (hitEl2) {
                  dispatchClick(hitEl2, x, y, 0);
                  console.log("[Wizascript Controller] resolve target confirmed (cursor, real hit-test)", hitEl2);
                }
              }
            }
            if (resolveKind === "target" && btn(1) && !btnHeld[1]) {
              if (pendingAttacker) {
                const r = pendingAttacker.getBoundingClientRect();
                dispatchClick(pendingAttacker, r.left + r.width / 2, r.top + r.height / 2, 0);
                console.log("[Wizascript Controller] attack cancelled via Circle (re-clicked attacker)", pendingAttacker);
              } else {
                console.log("[Wizascript Controller] Circle pressed during target-resolve with no known attacker (likely a spell/effect target, not an attack) - no action taken");
              }
            }
            btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
            hud.textContent = `${resolveKind === "choice" ? "choose one" : "select target"}
row ${resolveRow + 1}/${resolveGrid.length}, col ${resolveCol + 1}/${resolveGrid[resolveRow].length}
${btnLabel(0)} confirm${resolveKind === "target" ? `   ${btnLabel(1)} cancel attack` : ""}`;
            return;
          } else if (matchPhase === "resolve") {
            matchPhase = "hand";
            resolveGrid = null;
            matchSubState = "hand-nav";
            pendingAttacker = null;
            refreshHighlight();
          }
          const liveHand = queryHandCards();
          if (!elArraysEqual(handItems, liveHand)) {
            const prevCard = handItems[handIndex];
            handItems = liveHand;
            const keep = prevCard ? handItems.indexOf(prevCard) : -1;
            handIndex = keep >= 0 ? keep : Math.min(handIndex, Math.max(0, handItems.length - 1));
          }
          if (anyStick && (matchSubState === "hand-nav" || matchSubState === "board-nav")) matchSubState = "neutral";
          if (matchSubState === "hand-nav" && handItems.length) {
            if (left && !dpadHeld.left) handIndex = (handIndex - 1 + handItems.length) % handItems.length;
            if (right && !dpadHeld.right) handIndex = (handIndex + 1) % handItems.length;
            if (up && !dpadHeld.up) matchSubState = "board-nav";
            dpadHeld = { up, down, left, right };
            refreshHighlight();
            if (btn(0) && !btnHeld[0]) {
              const card = handItems[handIndex];
              if (card && card.classList.contains("canPlay")) {
                beginCardDrag(card);
              } else {
                console.log("[Wizascript Controller] card not playable, ignoring", card);
              }
            }
            if (btn(1) && !btnHeld[1]) matchSubState = "neutral";
            btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
            hud.textContent = `hand (${handIndex + 1}/${handItems.length})
${btnLabel(0)} play   \u2191 board   ${btnLabel(1)} free cursor`;
          } else if (matchSubState === "board-nav") {
            const liveBoard = queryBoardMonsterCards();
            if (!elArraysEqual(boardItems, liveBoard)) {
              const prevMonster = boardItems[boardIndex];
              boardItems = liveBoard;
              const keep = prevMonster ? boardItems.indexOf(prevMonster) : -1;
              boardIndex = keep >= 0 ? keep : Math.min(boardIndex, Math.max(0, boardItems.length - 1));
            }
            if (left && !dpadHeld.left && boardItems.length) boardIndex = (boardIndex - 1 + boardItems.length) % boardItems.length;
            if (right && !dpadHeld.right && boardItems.length) boardIndex = (boardIndex + 1) % boardItems.length;
            if (down && !dpadHeld.down) matchSubState = "hand-nav";
            if (btn(1) && !btnHeld[1]) matchSubState = "hand-nav";
            dpadHeld = { up, down, left, right };
            refreshHighlight();
            if (btn(0) && !btnHeld[0]) {
              const monster = boardItems[boardIndex];
              if (monster) {
                const r = monster.getBoundingClientRect();
                dispatchClick(monster, r.left + r.width / 2, r.top + r.height / 2, 0);
                pendingAttacker = monster;
                console.log("[Wizascript Controller] monster clicked to select as attacker", monster);
              }
            }
            btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
            hud.textContent = `board (${boardItems.length ? boardIndex + 1 : 0}/${boardItems.length})
${btnLabel(0)} select attacker   \u2193/${btnLabel(1)} hand`;
          } else {
            refreshHighlight();
            if (up && !dpadHeld.up && handItems.length) matchSubState = "hand-nav";
            dpadHeld = { up, down, left, right };
            if (btn(0) && !btnHeld[0]) {
              cursor.style.display = "none";
              const hitEl2 = document.elementFromPoint(x, y);
              cursor.style.display = "block";
              if (hitEl2) beginPress("left", 0);
            } else if (btn(0) && drag.left) {
              continuePress("left", 0);
            } else if (!btn(0) && drag.left) {
              endPress("left", 0);
            }
            if (btn(3) && !btnHeld[3]) {
              cursor.style.display = "none";
              const hitEl2 = document.elementFromPoint(x, y);
              cursor.style.display = "block";
              if (hitEl2) beginPress("right", 2);
            } else if (btn(3) && drag.right) {
              continuePress("right", 2);
            } else if (!btn(3) && drag.right) {
              endPress("right", 2);
            }
            btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
            cursor.style.display = "none";
            const hoverEl = document.elementFromPoint(x, y);
            cursor.style.display = cursorRestingDisplay();
            updateHover(hoverEl, x, y);
            hud.textContent = `free cursor (in match)
\u2191 = hand nav (${handItems.length} cards)   ${btnLabel(3)} inspect`;
          }
          return;
        }
        const speedMult = Math.max(0.3, Math.min(3, 1 - rx * 2));
        x = Math.max(0, Math.min(pageWindow2.innerWidth, x + lx * BASE_SPEED * speedMult));
        y = Math.max(0, Math.min(pageWindow2.innerHeight, y + ly * BASE_SPEED * speedMult));
        cursor.style.left = x + "px";
        cursor.style.top = y + "px";
        if (ry !== 0) {
          cursor.style.display = "none";
          const under = document.elementFromPoint(x, y);
          cursor.style.display = "block";
          const scrollable = findRealScrollable(under || document.body);
          if (scrollable) scrollable.scrollTop += ry * 30;
        }
        if (anyStick) {
          if (activeSubmenu) closeSubmenu();
          if (chromeStates[chromeIndex] && chromeStates[chromeIndex].type === "group") {
            chromeIndex = chromeStates.findIndex((s) => s.type === "neutral");
            refreshHighlight();
          }
        }
        const state = chromeStates[chromeIndex];
        if (activeSubmenu) {
          if (up && !dpadHeld.up) {
            activeSubmenu.index = (activeSubmenu.index - 1 + activeSubmenu.items.length) % activeSubmenu.items.length;
            refreshHighlight();
          }
          if (down && !dpadHeld.down) {
            activeSubmenu.index = (activeSubmenu.index + 1) % activeSubmenu.items.length;
            refreshHighlight();
          }
          dpadText = `submenu (${activeSubmenu.index + 1}/${activeSubmenu.items.length})`;
        } else if (state && state.type === "group") {
          if (up && !dpadHeld.up) {
            chromeIndex = Math.max(0, chromeIndex - 1);
            refreshHighlight();
          }
          if (down && !dpadHeld.down) {
            chromeIndex = Math.min(chromeStates.length - 1, chromeIndex + 1);
            refreshHighlight();
          }
          const g = state.group;
          if (left && !dpadHeld.left) {
            itemIndexByGroupName[g.name] = ((itemIndexByGroupName[g.name] || 0) - 1 + g.items.length) % g.items.length;
            refreshHighlight();
          }
          if (right && !dpadHeld.right) {
            itemIndexByGroupName[g.name] = ((itemIndexByGroupName[g.name] || 0) + 1) % g.items.length;
            refreshHighlight();
          }
          dpadText = `${g.name} (${(itemIndexByGroupName[g.name] || 0) + 1}/${g.items.length})`;
        } else {
          let tryPageTurn = function(dir) {
            cursor.style.display = "none";
            const under = document.elementFromPoint(x, y);
            cursor.style.display = "block";
            if (under) {
              under.dispatchEvent(new WheelEvent("wheel", {
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y,
                deltaY: dir * WHEEL_DELTA,
                deltaMode: 0
              }));
            }
            lastPageTurnTime = now;
          };
          if (up && !dpadHeld.up) {
            chromeIndex = Math.max(0, chromeIndex - 1);
            refreshHighlight();
          }
          if (down && !dpadHeld.down) {
            chromeIndex = Math.min(chromeStates.length - 1, chromeIndex + 1);
            refreshHighlight();
          }
          const now = performance.now();
          const REPEAT_INITIAL_DELAY = 400, REPEAT_INTERVAL = 150;
          if (left) {
            if (!dpadHeld.left) {
              leftHeldSince = now;
              tryPageTurn(-1);
            } else if (now - leftHeldSince > REPEAT_INITIAL_DELAY && now - lastPageTurnTime > REPEAT_INTERVAL) tryPageTurn(-1);
          } else leftHeldSince = 0;
          if (right) {
            if (!dpadHeld.right) {
              rightHeldSince = now;
              tryPageTurn(1);
            } else if (now - rightHeldSince > REPEAT_INITIAL_DELAY && now - lastPageTurnTime > REPEAT_INTERVAL) tryPageTurn(1);
          } else rightHeldSince = 0;
          dpadText = "neutral (left/right = page turn, hold to repeat)";
        }
        dpadHeld = { up, down, left, right };
        if (btn(0) && !btnHeld[0]) {
          if (currentFocusedEl()) {
            activateHighlighted(0);
          } else {
            cursor.style.display = "none";
            const hitEl2 = document.elementFromPoint(x, y);
            cursor.style.display = "block";
            if (hitEl2) {
              if (isNativeSelect(hitEl2)) openSelectPicker(hitEl2);
              else if (isSlider(hitEl2)) openSlider(hitEl2);
              else if (isPatchMakerResetButton(hitEl2)) activatePatchMakerResetButton(hitEl2, x, y);
              else if (hitEl2.readOnly && (hitEl2.tagName === "INPUT" || hitEl2.tagName === "TEXTAREA")) {
                dispatchClick(hitEl2, x, y, 0);
                hitEl2.focus();
              } else if (isTextInput(hitEl2)) {
                dispatchClick(hitEl2, x, y, 0);
                openOsk(hitEl2);
                if (hitEl2.isContentEditable) placeCaretAtPoint(hitEl2, x, y);
              } else if (hitEl2.matches && hitEl2.matches(".uc-section-label, .uc-card-item")) {
                dispatchClick(hitEl2, x, y, 0);
                hitEl2.focus();
              } else beginPress("left", 0);
            }
          }
        } else if (btn(0) && drag.left) {
          continuePress("left", 0);
        } else if (!btn(0) && drag.left) {
          endPress("left", 0);
        }
        if (btn(3) && !btnHeld[3]) {
          if (currentFocusedEl()) {
            activateHighlighted(2);
          } else {
            cursor.style.display = "none";
            const hitEl2 = document.elementFromPoint(x, y);
            cursor.style.display = "block";
            if (hitEl2) beginPress("right", 2);
          }
        } else if (btn(3) && drag.right) {
          continuePress("right", 2);
        } else if (!btn(3) && drag.right) {
          endPress("right", 2);
        }
        if (btn(1) && !btnHeld[1]) closeSubmenu();
        btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
        cursor.style.display = "none";
        const hitEl = document.elementFromPoint(x, y);
        cursor.style.display = cursorRestingDisplay();
        updateHover(hitEl, x, y);
        hud.textContent = `controller active
${dpadText}
chrome: ${chromeStates[chromeIndex] ? chromeStates[chromeIndex].type : "?"}`;
      } catch (err) {
        console.error("[Wizascript Controller] frame() error, loop continues:", err);
      } finally {
        requestAnimationFrame(frame);
      }
    }
    refreshHighlight();
    requestAnimationFrame(frame);
  }

  // manifest.js
  bootstrap((plugin) => {
    initPatchMaker(plugin);
    initTrueHubBridge(plugin);
    initDeckTracker(plugin);
    initUcTv(plugin);
    const miscSettings = initMisc(plugin);
    initController(plugin, miscSettings.enableController);
    flushKeybindRegistrations();
  });
})();
