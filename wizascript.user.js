// ==UserScript==
// @name         Wizascript
// @namespace    https://github.com/theWiza2341/Wizascript
// @version      1.5.0
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
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// ==/UserScript==

(() => {
  // packages/core/page-window.js
  function getPageWindow() {
    return typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  }

  // packages/core/version.js
  var SUITE_VERSION = "1.5.0";

  // packages/core/bootstrap.js
  var SUITE_NAME = "Wizascript";
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
  function resolve(v) {
    return typeof v === "function" ? v() : v;
  }
  function createFeatureSettings(plugin, featureName, { tab, visible, categories = false } = {}) {
    const settingsApi = tab ? plugin.settings().page(tab) : plugin.settings();
    const registered = {};
    function add(key2, config) {
      const { category, page, hidden, ...rest } = config;
      const isHidden = () => (visible ? !visible() : false) || resolve(hidden) === true;
      const dynamicCategory = categories && category ? { toString: () => isHidden() ? "N/A" : String(category), valueOf: () => isHidden() ? "N/A" : String(category) } : null;
      const setting2 = settingsApi.add({
        ...rest,
        ...dynamicCategory ? { category: dynamicCategory } : {},
        key: `${featureName}.${key2}`,
        hidden: isHidden
      });
      registered[key2] = setting2;
      return setting2;
    }
    function value(key2) {
      return registered[key2].value();
    }
    return { add, value };
  }

  // packages/core/setting-widgets.js
  var ID_PREFIX = "underscript.plugin.Wizascript.";
  var ENHANCED_ATTR = "data-wizascript-widget";
  var enhancers = /* @__PURE__ */ new Map();
  var observer = null;
  function scan() {
    enhancers.forEach((enhance, key2) => {
      const el2 = document.getElementById(ID_PREFIX + key2);
      if (!el2 || el2.hasAttribute(ENHANCED_ATTR)) return;
      el2.setAttribute(ENHANCED_ATTR, "true");
      enhance(el2);
    });
  }
  function ensureObserver() {
    if (observer || !document.body) return;
    observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
  }
  function registerSettingWidget(fullKey, enhance) {
    enhancers.set(fullKey, enhance);
    if (document.body) ensureObserver();
    else document.addEventListener("DOMContentLoaded", ensureObserver, { once: true });
  }
  function asButton(label, onClick) {
    return (el2) => {
      el2.readOnly = true;
      el2.value = typeof label === "function" ? label() : label;
      Object.assign(el2.style, {
        cursor: "pointer",
        backgroundColor: "black",
        color: "white",
        border: "1px solid #b4b4b4",
        borderRadius: "3px",
        textAlign: "center"
      });
      el2.addEventListener("click", (e) => {
        e.preventDefault();
        onClick(el2);
      });
      el2.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(el2);
        }
      });
    };
  }
  function asInfo(text) {
    return (el2) => {
      el2.readOnly = true;
      el2.tabIndex = -1;
      el2.value = typeof text === "function" ? text() : text;
      Object.assign(el2.style, {
        backgroundColor: "transparent",
        border: "none",
        color: "#ccc",
        cursor: "default",
        pointerEvents: "none"
      });
    };
  }

  // packages/core/plugins.js
  var PLUGINS = [
    {
      id: "patchMaker",
      category: "Plugins",
      name: "Patch Maker",
      key: "patchmaker.enabled",
      note: "Write your own patch notes on the Patch Notes page.",
      usesKeybinds: true,
      legacyDefaultOn: true
    },
    {
      id: "trueHub",
      category: "Plugins",
      name: "True Hub Bridge",
      key: "truehubbridge.enabled",
      note: "Browse a larger library of community decks on the Hub page.",
      legacyDefaultOn: true
    },
    {
      id: "cardTracker",
      category: "Plugins",
      name: "Card Tracker",
      key: "decktracker.enabled",
      note: "Add click-to-count card counters to your screen during matches.",
      legacyDefaultOn: true
    },
    {
      id: "ucTv",
      category: "Plugins",
      name: "UC TV",
      key: "ucTv.enabled",
      note: "Channel-surf other players' live matches while spectating.",
      usesKeybinds: true,
      legacyDefaultOn: true
    },
    {
      id: "controller",
      category: "Plugins",
      name: "Controller Support",
      key: "misc.enableController",
      note: "Play and navigate Undercards with a gamepad."
    },
    {
      id: "notepad",
      category: "Miscellaneous",
      name: "Notepad",
      key: "misc.enableNotepad",
      note: "A small drawing notepad you can keep on screen anywhere.",
      usesKeybinds: true
    },
    {
      id: "cardTags",
      category: "Miscellaneous",
      name: "Card Tags",
      key: "misc.enableCardTags",
      note: "Right-click cards in Crafting/Decks to tag and search them."
    },
    {
      id: "tierList",
      category: "Miscellaneous",
      name: "Tier List Maker",
      key: "misc.enableTierList",
      note: "Rank cards in your own drag-and-drop tier lists, on any page.",
      usesKeybinds: true
    }
  ];
  var LS_PREFIX = "underscript.plugin.Wizascript.";
  var MIGRATION_FLAG = "wizascript.migration.v150";
  var toggles = {};
  var notepadOpenOnLoad = null;
  var SUB_SETTINGS = {
    notepad: ["misc.notepadOpenOnLoad"]
  };
  function applySubSettingVisibility(pluginId, forceEnabled) {
    const enabled = forceEnabled !== void 0 ? forceEnabled : isPluginEnabled(pluginId);
    (SUB_SETTINGS[pluginId] || []).forEach((key2) => {
      const el2 = document.getElementById(LS_PREFIX + key2);
      const row = el2 && el2.closest(".flex-start");
      if (row) row.style.display = enabled ? "" : "none";
    });
  }
  function injectSubSettingStyle() {
    if (document.getElementById("wizascript-subsetting-style")) return;
    const style = document.createElement("style");
    style.id = "wizascript-subsetting-style";
    style.textContent = ".underscript-dialog .wizascript-subsetting { margin-left: 22px; }";
    (document.head || document.documentElement).appendChild(style);
  }
  function registerPluginToggles(plugin) {
    const settingsApi = plugin.settings();
    injectSubSettingStyle();
    PLUGINS.forEach((p) => {
      toggles[p.id] = settingsApi.add({
        key: p.key,
        name: p.name,
        note: p.note,
        type: "boolean",
        default: false,
        // Appends UnderScript's own "requires a page refresh" note.
        refresh: true,
        category: p.category,
        onChange: (value) => applySubSettingVisibility(p.id, !!value)
      });
      if (p.id === "notepad") {
        notepadOpenOnLoad = settingsApi.add({
          key: "misc.notepadOpenOnLoad",
          name: "Open Notepad on Page Load",
          note: "Show the notepad automatically whenever a page loads.",
          type: "boolean",
          default: true,
          category: p.category
        });
      }
    });
    Object.entries(SUB_SETTINGS).forEach(([pluginId, keys]) => {
      keys.forEach((key2) => registerSettingWidget(key2, (el2) => {
        const row = el2.closest(".flex-start");
        if (row) row.classList.add("wizascript-subsetting");
        applySubSettingVisibility(pluginId);
      }));
    });
  }
  function getNotepadOpenOnLoadSetting() {
    return notepadOpenOnLoad;
  }
  function getPluginToggle(id) {
    return toggles[id];
  }
  function isPluginEnabled(id) {
    const toggle = toggles[id];
    if (toggle) return !!toggle.value();
    const p = PLUGINS.find((x) => x.id === id);
    if (!p) return false;
    const raw = localStorage.getItem(LS_PREFIX + p.key);
    return raw === "1" || raw === "true";
  }
  function anyKeybindPluginEnabled() {
    return PLUGINS.some((p) => p.usesKeybinds && isPluginEnabled(p.id));
  }
  var LABEL_TO_PLUGIN = {
    "Patch Maker": "patchMaker",
    "UC TV": "ucTv",
    "Notepad": "notepad",
    "Card Tracker": "cardTracker",
    "Tier List": "tierList"
  };
  function pluginIdForLabel(label) {
    return LABEL_TO_PLUGIN[label] || null;
  }
  function runMigrations() {
    if (GM_getValue(MIGRATION_FLAG, false)) return "done";
    let existing = false;
    try {
      existing = Object.keys(localStorage).some((k) => k.startsWith(LS_PREFIX));
    } catch (e) {
    }
    if (!existing && typeof GM_listValues === "function") {
      try {
        existing = GM_listValues().some((k) => k.startsWith("wizascript.") && k !== MIGRATION_FLAG);
      } catch (e) {
      }
    }
    if (existing) {
      PLUGINS.forEach((p) => {
        if (!p.legacyDefaultOn) return;
        if (localStorage.getItem(LS_PREFIX + p.key) === null) {
          localStorage.setItem(LS_PREFIX + p.key, "1");
        }
      });
    }
    GM_setValue(MIGRATION_FLAG, true);
    return existing ? "upgrade" : "fresh";
  }

  // packages/core/keybinds.js
  var TAB = "Keybinds";
  var HOLD_DELAY_MS = 250;
  var NATIVE_MODIFIERS = /* @__PURE__ */ new Set(["Control", "Shift", "Alt"]);
  var DEFAULT_PRIMARY_CODE = "Control";
  var PRIMARY_KEY = "primaryKey";
  var GM_PREFIX = "wizascript.keybinds.";
  var ID_PREFIX2 = "underscript.plugin.Wizascript.keybinds.";
  function storageKey(bindingKey) {
    return `${GM_PREFIX}${bindingKey}`;
  }
  function readCode(bindingKey, defaultCode) {
    return GM_getValue(storageKey(bindingKey), defaultCode);
  }
  function getBoundKeybindCode(bindingKey, defaultCode) {
    return readCode(bindingKey, defaultCode);
  }
  function writeCode(bindingKey, code) {
    GM_setValue(storageKey(bindingKey), code);
  }
  var DISPLAY_OVERRIDES = {
    Control: "Ctrl",
    Shift: "Shift",
    Alt: "Alt",
    Meta: "Meta",
    ControlLeft: "Left Ctrl",
    ControlRight: "Right Ctrl",
    ShiftLeft: "Left Shift",
    ShiftRight: "Right Shift",
    AltLeft: "Left Alt",
    AltRight: "Right Alt",
    MetaLeft: "Left Meta",
    MetaRight: "Right Meta",
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
  var infoKeys = /* @__PURE__ */ new Set();
  var GENERAL_CATEGORY = "General";
  var observerStarted = false;
  function isBindingActive(b) {
    return !b.pluginId || isPluginEnabled(b.pluginId);
  }
  function isTypingContext() {
    const el2 = document.activeElement;
    if (!el2) return false;
    const tag = el2.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || el2.isContentEditable;
  }
  function enhanceInput(el2, bindingKey, defaultCode) {
    el2.setAttribute("data-wizascript-keybind-enhanced", "true");
    el2.readOnly = true;
    Object.assign(el2.style, {
      cursor: "pointer",
      backgroundColor: "black",
      color: "white",
      border: "1px solid #b4b4b4",
      borderRadius: "3px",
      textAlign: "center"
    });
    function refreshDisplay() {
      el2.value = codeToDisplay(readCode(bindingKey, defaultCode));
    }
    refreshDisplay();
    el2.addEventListener("focus", () => {
      el2.style.border = "1px solid #40E0D0";
      el2.style.boxShadow = "0 0 4px #40E0D0";
      el2.value = "...?";
      function capture(e) {
        e.preventDefault();
        const code = e.key === "Escape" ? "unbound" : e.code;
        writeCode(bindingKey, code);
        document.removeEventListener("keydown", capture, true);
        el2.blur();
      }
      document.addEventListener("keydown", capture, true);
      el2.addEventListener("blur", function onBlur() {
        el2.style.border = "1px solid #b4b4b4";
        el2.style.boxShadow = "none";
        document.removeEventListener("keydown", capture, true);
        refreshDisplay();
        scheduleConflictRefresh();
        el2.removeEventListener("blur", onBlur);
      });
    });
  }
  function enhanceInfoRow(el2) {
    el2.setAttribute("data-wizascript-keybind-enhanced", "true");
    el2.readOnly = true;
    el2.tabIndex = -1;
    el2.style.display = "none";
  }
  function startObserver() {
    if (observerStarted) return;
    observerStarted = true;
    const observer2 = new MutationObserver(() => {
      if (!bindingDefaults.size && !infoKeys.size) return;
      document.querySelectorAll(`input[id^="${ID_PREFIX2}"]:not([data-wizascript-keybind-enhanced])`).forEach((el2) => {
        const bindingKey = el2.id.slice(ID_PREFIX2.length);
        if (infoKeys.has(bindingKey)) {
          enhanceInfoRow(el2);
          return;
        }
        if (!bindingDefaults.has(bindingKey)) return;
        enhanceInput(el2, bindingKey, bindingDefaults.get(bindingKey));
        scheduleConflictRefresh();
      });
    });
    observer2.observe(document.body, { childList: true, subtree: true });
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
            if (!isBindingActive(b)) return;
            if (b.guardTypingContext && isTypingContext()) return;
            b.onPrimaryDoubleTap(e);
          });
        }
        registry.forEach((b) => {
          if (!b.onPrimaryPress) return;
          if (!isBindingActive(b)) return;
          if (b.guardTypingContext && isTypingContext()) return;
          b.onPrimaryPress(e);
        });
        clearTimeout(holdTimer);
        holdTimer = setTimeout(() => {
          if (comboFired) return;
          registry.forEach((b) => {
            if (b.scope !== "global" || !b.onPrimaryAlone) return;
            if (!isBindingActive(b)) return;
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
        if (!isBindingActive(b)) continue;
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
          if (!isBindingActive(b)) return;
          if (b.guardTypingContext && isTypingContext()) return;
          b.onPrimaryRelease(e);
        });
      }
    });
  }
  var primaryKeySetting = null;
  var generalHidden = () => !anyKeybindPluginEnabled();
  function initKeybinds(plugin) {
    ensureCore(plugin);
  }
  function ensureCore(plugin) {
    if (settings) return;
    settings = createFeatureSettings(plugin, "keybinds", { tab: TAB, categories: true });
    startObserver();
    bindGlobalListeners();
    primaryKeySetting = settings.add(PRIMARY_KEY, {
      name: "Primary Key",
      note: "Click to remap. Hold for combos below, or tap alone.",
      type: "text",
      default: DEFAULT_PRIMARY_CODE,
      category: GENERAL_CATEGORY,
      hidden: generalHidden
    });
    bindingDefaults.set(PRIMARY_KEY, DEFAULT_PRIMARY_CODE);
    const openSettingsInfoKey = "__info_openSettings";
    settings.add(openSettingsInfoKey, {
      name: "Double Tap Primary \u2192 Open Wizascript Settings",
      type: "text",
      default: "",
      category: GENERAL_CATEGORY,
      hidden: generalHidden
    });
    infoKeys.add(openSettingsInfoKey);
    registry.push({
      key: "openWizascriptSettings",
      scope: "global",
      guardTypingContext: true,
      // Opens the main Wizascript tab (the Plugins list), rather than
      // Primary Key's own row. Active while any keybind plugin is on, or
      // while Controller Support is on (its controller Primary relays a
      // real Primary double-tap).
      onPrimaryDoubleTap: () => {
        if (!anyKeybindPluginEnabled() && !isPluginEnabled("controller")) return;
        plugin.settings().open();
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
      key: key2,
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
    const pluginId = pluginIdForLabel(packageLabel);
    const pluginHidden = () => pluginId ? !isPluginEnabled(pluginId) : false;
    if (onMatch) {
      settings.add(key2, {
        name: `${name} - Primary + <key>`,
        type: "text",
        default: defaultCode,
        // Each plugin's shortcuts get their own category on the tab.
        category: packageLabel || GENERAL_CATEGORY,
        hidden: pluginHidden
      });
      bindingDefaults.set(key2, defaultCode);
    }
    registry.push({ key: key2, name, packageLabel, pluginId, defaultCode, scope, selector, guardTypingContext, onMatch, onPrimaryAlone, onPrimaryPress, onPrimaryRelease, onPrimaryDoubleTap });
    scheduleConflictRefresh();
  }
  var WARNING_CLASS = "wizascript-keybind-warning";
  function underscriptClash(code, isPrimary) {
    if (code !== "Space") return null;
    const v = (k) => {
      const x = localStorage.getItem(k);
      return x === "1" || x === "true";
    };
    if (v("underscript.disable.endTurn") || v("underscript.disable.endTurn.space")) return null;
    return isPrimary ? "In matches, Space also ends your turn (UnderScript hotkey), so every Primary tap would end it. You can turn that off in UnderScript's Game settings." : "In matches, Space also ends your turn (UnderScript hotkey). You can turn that off in UnderScript's Game settings.";
  }
  function sameKey(a, b) {
    const base = (c) => String(c).replace(/^(Control|Shift|Alt|Meta)(Left|Right)$/, "$1");
    return base(a) === base(b);
  }
  function canOverlap(a, b) {
    if (a.scope === "global" && b.scope === "global") return true;
    if (a.scope === "scoped" && b.scope === "scoped") return a.selector === b.selector;
    const global = a.scope === "global" ? a : b;
    return !global.guardTypingContext;
  }
  function describe(b) {
    return b.packageLabel ? `${b.name} (${b.packageLabel})` : b.name;
  }
  function computeKeybindConflicts() {
    const out = /* @__PURE__ */ new Map();
    const add = (key2, msg) => {
      if (!out.has(key2)) out.set(key2, []);
      out.get(key2).push(msg);
    };
    const primary2 = getPrimaryCode();
    const combos = registry.filter((b) => b.onMatch && isBindingActive(b)).map((b) => ({ b, code: readCode(b.key, b.defaultCode) })).filter(({ code }) => code && code !== "unbound");
    const primaryClash = underscriptClash(primary2, true);
    if (primaryClash && anyKeybindPluginEnabled()) add(PRIMARY_KEY, primaryClash);
    combos.forEach(({ b, code }, i) => {
      if (sameKey(code, primary2)) add(b.key, `Same key as your Primary key (${codeToDisplay(primary2)}), so this shortcut can't be used.`);
      combos.forEach(({ b: other, code: otherCode }, j) => {
        if (i === j || !sameKey(code, otherCode) || !canOverlap(b, other)) return;
        add(b.key, j < i ? `Same key as ${describe(other)}, which takes priority - this one won't fire.` : `Same key as ${describe(other)} - this one takes priority, so that one won't fire.`);
      });
      const clash = underscriptClash(code, false);
      if (clash) add(b.key, clash);
    });
    return out;
  }
  function refreshConflictWarnings() {
    if (!document.querySelector(`input[id^="${ID_PREFIX2}"]`)) return;
    const conflicts = computeKeybindConflicts();
    bindingDefaults.forEach((_, key2) => {
      const input = document.getElementById(ID_PREFIX2 + key2);
      const row = input && input.closest(".flex-start");
      if (!row) return;
      const messages = conflicts.get(key2) || [];
      let warn = row.querySelector(`:scope > .${WARNING_CLASS}`);
      const text = messages.map((m) => `\u26A0 ${m}`).join("\n");
      if (!messages.length) {
        if (warn) warn.remove();
        return;
      }
      if (!warn) {
        warn = document.createElement("div");
        warn.className = `setting-description ${WARNING_CLASS}`;
        Object.assign(warn.style, { color: "#ffb347", opacity: "1", whiteSpace: "pre-line" });
        row.appendChild(warn);
      }
      if (warn.textContent !== text) warn.textContent = text;
    });
  }
  var conflictRefreshQueued = false;
  function scheduleConflictRefresh() {
    if (conflictRefreshQueued) return;
    conflictRefreshQueued = true;
    setTimeout(() => {
      conflictRefreshQueued = false;
      refreshConflictWarnings();
    }, 0);
  }
  function getPrimaryKeyDisplay() {
    return codeToDisplay(getPrimaryCode());
  }
  function isRegisteredKeybindEvent(e) {
    const primaryCode = getPrimaryCode();
    if (matchesCode(e, primaryCode, DEFAULT_PRIMARY_CODE)) return true;
    if (!primaryHeld) return false;
    return registry.some((b) => b.onMatch && isBindingActive(b) && matchesSetting(e, b));
  }
  function describeKeybind(bindingKey, defaultCode) {
    const code = readCode(bindingKey, bindingDefaults.get(bindingKey) || defaultCode);
    if (!code || code === "unbound") return null;
    return `${getPrimaryKeyDisplay()} + ${codeToDisplay(code)}`;
  }

  // CHANGELOG.md
  var CHANGELOG_default = `# Changelog

All notable changes to Wizascript are recorded here, newest first. The Changelog button in Wizascript's settings shows this file.

## 1.5.0

Wizascript is now listed in UnderScript's plugin directory, so this update is all about making it easy to understand without a readme.

### Settings overhaul
- New **General** tab (the first tab in Wizascript's settings) with a **Plugins** list and a **Miscellaneous** list. Every feature now has its own on/off switch, with a short description when you hover it.
- Each enabled plugin gets its **own settings tab**. Plugins you haven't turned on don't show any settings at all.
- **Keybinds** only appear once you enable a plugin that uses them, and only list the shortcuts for plugins you actually have on, in a section per plugin.
- **Controller Support** has its own tab for controller bindings, split into Setup, General, a section per plugin, and In-Game Inputs, and likewise only lists actions for plugins you have on.
- Notepad and Card Tags are listed under Miscellaneous; Controller Support is now listed with the other plugins.
- Tab names are never cut off. When there are more tabs than fit, they're split into pages, and **\u25C0 \u25B6 arrows** at the right end of the tab row flip between them.
- New **Changelog** button (you're reading it), and a one-time popup after each update.

### New
- **How-to guides**: every plugin now explains itself: which pages it works on, what it does, and its inputs (like right-clicking cards for Card Tags). Find it at the bottom of the plugin's settings tab, or click the **?** next to any plugin in the Plugins / Miscellaneous lists, even before turning it on. Keyboard shortcuts are shown with your current keys.
- **Back up & restore settings**: save all your Wizascript settings and data (toggles, keybinds, controller bindings, Card Tracker presets, Card Tags, Notepad) as one code or file from the General tab, and restore it on another browser or after reinstalling.
- **Share Card Tags**: in Manage Tags, share some or all of your tags (with the cards they're on) as a code, or import a friend's. Imported tags merge into yours by name and never remove anything.
- **Keybind warnings**: the Keybinds tab warns when a shortcut clashes with another shortcut, with your Primary key, or with UnderScript's Space-to-end-turn hotkey. The Controller Support tab does the same for controller bindings: two actions on one button, an In-Game Input on a combo's button or on a button that already clicks/goes back/navigates, and Controller Primary or the Channel Guide on a button they'd block.
- **Controller: L1/R1 switch tabs in Settings**: sidebar categories, or the open plugin's own tabs.
- Added Logo to main settings tab.

### Changes
- **Deck Tracker is now called Card Tracker**, to better describe what it does. Your trackers, presets and settings carry over.
- New installs start with every plugin switched off. If you were already using Wizascript, the plugins you had on stay on.
- Notepad has a new **Open Notepad on Page Load** setting, shown right under Notepad once it's enabled. The Toggle Notepad shortcut now opens/closes the notepad for the current page without switching the plugin off.
- UC TV's filter settings are disabled (greyed out) while match filtering is turned off.
- UC TV no longer prints its settings to the browser console on every page load unless debug logging is on.
- The separate "Enable debug logging" options on Patch Maker, True Hub Bridge, Card Tracker and UC TV are now one **Debug logging** option at the bottom of the General tab. If you had any of them on, it stays on.

### Fixes
- Controller Support: the d-pad works in the settings' **Plugins** section again (UnderScript 0.64 changed how plugin settings are laid out). A plugin's tabs are now one row you move along with left/right, including the \u25C0 \u25B6 arrows. Moving up from a setting returns to the tab you're on.
- Controller Support: binding \u2715 or the d-pad now works when you clicked the binding box with the mouse or cursor (before, the press moved the settings sidebar instead of being recorded).
`;

  // assets/logo.png
  var logo_default = "data:image/png;base64,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";

  // packages/core/about.js
  var LAST_SEEN_KEY = "wizascript.lastSeenVersion";
  var CATEGORY = "Wizascript";
  var LOGO_SIZE_PX = 96;
  function addLogo(anyRowInput) {
    const set = anyRowInput.closest("fieldset");
    if (!set || set.querySelector(".wizascript-logo")) return;
    set.style.position = "relative";
    set.style.minHeight = `${LOGO_SIZE_PX + 24}px`;
    const img = document.createElement("img");
    img.className = "wizascript-logo";
    img.src = logo_default;
    img.alt = "Wizascript";
    img.draggable = false;
    Object.assign(img.style, {
      position: "absolute",
      right: "24px",
      top: "50%",
      transform: "translateY(-50%)",
      width: `${LOGO_SIZE_PX}px`,
      height: `${LOGO_SIZE_PX}px`,
      objectFit: "contain",
      pointerEvents: "none"
    });
    set.appendChild(img);
  }
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function markdownToHtml(md) {
    const lib = getPageWindow().underscript && getPageWindow().underscript.lib;
    if (lib && lib.showdown && lib.showdown.Converter) {
      return new lib.showdown.Converter({ noHeaderId: true, strikethrough: true }).makeHtml(md);
    }
    return `<pre style="white-space:pre-wrap">${escapeHtml(md)}</pre>`;
  }
  function openChangelog() {
    const BootstrapDialog2 = getPageWindow().BootstrapDialog;
    const html = markdownToHtml(CHANGELOG_default);
    if (!BootstrapDialog2 || typeof BootstrapDialog2.show !== "function") {
      console.warn("[Wizascript] BootstrapDialog unavailable - cannot show the changelog here.");
      return;
    }
    BootstrapDialog2.show({
      title: "Wizascript Changelog",
      message: `<div class="wizascript-changelog" style="white-space:normal">${html}</div>`,
      cssClass: "mono",
      buttons: [{ label: "Close", cssClass: "btn-primary", action: (d) => d.close() }]
    });
  }
  function registerAboutSection(plugin) {
    const settingsApi = plugin.settings();
    settingsApi.add({
      key: "about.version",
      name: "Version",
      type: "text",
      default: SUITE_VERSION,
      category: CATEGORY
    });
    const asVersionInfo = asInfo(SUITE_VERSION);
    registerSettingWidget("about.version", (el2) => {
      asVersionInfo(el2);
      addLogo(el2);
    });
    settingsApi.add({
      key: "about.changelog",
      name: "Changelog",
      note: "See what's changed in each Wizascript update.",
      type: "text",
      default: "View",
      category: CATEGORY
    });
    registerSettingWidget("about.changelog", asButton("View", () => openChangelog()));
  }
  function showWhatsNew(plugin, installState) {
    const lastSeen = GM_getValue(LAST_SEEN_KEY, null);
    if (lastSeen === SUITE_VERSION) return;
    const markSeen = () => GM_setValue(LAST_SEEN_KEY, SUITE_VERSION);
    const isFresh = installState === "fresh";
    const toast = isFresh ? {
      title: "Welcome to Wizascript!",
      text: "Wizascript's features start switched off. Turn on the ones you want in the Plugins list.",
      buttons: [{ text: "Open Wizascript settings", className: "dismiss", onclick: () => plugin.settings().open() }]
    } : {
      title: `Wizascript updated to v${SUITE_VERSION}`,
      text: "See what's new in this version.",
      buttons: [{ text: "View changelog", className: "dismiss", onclick: () => openChangelog() }]
    };
    plugin.toast({
      ...toast,
      className: "dismissable",
      onClose: () => {
        markSeen();
      }
    });
  }

  // packages/core/share-code.js
  function bytesToBase64(bytes) {
    let bin = "";
    const CHUNK = 32768;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }
  function base64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function pipeThrough(bytes, stream) {
    const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await res.arrayBuffer());
  }
  function hasGzip() {
    return typeof CompressionStream === "function" && typeof DecompressionStream === "function" && typeof Response === "function" && typeof Blob === "function";
  }
  async function encodeCode(kind, payload) {
    const raw = new TextEncoder().encode(JSON.stringify(payload));
    if (hasGzip()) {
      try {
        const gz = await pipeThrough(raw, new CompressionStream("gzip"));
        return `WZ-${kind}-1.${bytesToBase64(gz)}`;
      } catch (e) {
      }
    }
    return `WZ-${kind}-0.${bytesToBase64(raw)}`;
  }
  async function decodeCode(text, kind) {
    const clean = String(text || "").replace(/\s+/g, "");
    if (!clean) throw new Error("Paste a code first.");
    const m = /^WZ-([A-Z]+)-(\d+)\.(.+)$/.exec(clean);
    if (!m) throw new Error("That doesn't look like a Wizascript code.");
    if (m[1] !== kind) {
      const names = { BACKUP: "a settings backup", TAGS: "a Card Tags code" };
      throw new Error(`That's ${names[m[1]] || `a "${m[1]}" code`}, not ${names[kind] || kind}.`);
    }
    let bytes;
    try {
      bytes = base64ToBytes(m[3]);
    } catch (e) {
      throw new Error("The code is damaged or incomplete (make sure you copied all of it).");
    }
    if (m[2] === "1") {
      if (!hasGzip()) throw new Error("This browser can't read compressed codes. Try a newer browser.");
      try {
        bytes = await pipeThrough(bytes, new DecompressionStream("gzip"));
      } catch (e) {
        throw new Error("The code is damaged or incomplete (make sure you copied all of it).");
      }
    } else if (m[2] !== "0") {
      throw new Error("This code was made by a newer Wizascript. Update Wizascript and try again.");
    }
    try {
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) {
      throw new Error("The code is damaged or incomplete (make sure you copied all of it).");
    }
  }
  function el(tag, props = {}, style = {}) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    Object.assign(node.style, style);
    return node;
  }
  var TEXTAREA_STYLE = {
    width: "100%",
    height: "140px",
    boxSizing: "border-box",
    resize: "vertical",
    fontFamily: "monospace",
    fontSize: "11px",
    wordBreak: "break-all",
    backgroundColor: "#111",
    color: "#ddd",
    border: "1px solid #666"
  };
  function getDialog() {
    const BootstrapDialog2 = getPageWindow().BootstrapDialog;
    if (!BootstrapDialog2 || typeof BootstrapDialog2.show !== "function") {
      console.warn("[Wizascript] BootstrapDialog unavailable - cannot open this dialog here.");
      return null;
    }
    return BootstrapDialog2;
  }
  async function copyText(text, textarea) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {
    }
    try {
      textarea.focus();
      textarea.select();
      return document.execCommand("copy");
    } catch (e) {
      return false;
    }
  }
  function saveFile(text, fileName) {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: fileName });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  function showExportDialog({ title, intro, code, fileName }) {
    const BootstrapDialog2 = getDialog();
    if (!BootstrapDialog2) return;
    const wrapper = el("div");
    wrapper.appendChild(el("p", { textContent: intro }));
    const box = el("textarea", { readOnly: true, value: code, spellcheck: false }, TEXTAREA_STYLE);
    box.addEventListener("focus", () => box.select());
    wrapper.appendChild(box);
    const status = el("div", { textContent: `${code.length.toLocaleString()} characters` }, { marginTop: "4px", opacity: "0.7", fontSize: "0.9em" });
    wrapper.appendChild(status);
    BootstrapDialog2.show({
      title,
      message: wrapper,
      buttons: [
        {
          label: "Copy",
          cssClass: "btn-primary",
          action: async () => {
            const ok = await copyText(code, box);
            status.textContent = ok ? "Copied to your clipboard." : "Couldn't copy automatically - select the text and copy it yourself.";
          }
        },
        { label: "Save as file", action: () => {
          saveFile(code, fileName);
          status.textContent = `Saved as ${fileName}.`;
        } },
        { label: "Close", action: (d) => d.close() }
      ]
    });
  }
  function showImportDialog({ title, intro, actionLabel, onSubmit }) {
    const BootstrapDialog2 = getDialog();
    if (!BootstrapDialog2) return;
    const wrapper = el("div");
    wrapper.appendChild(el("p", { textContent: intro }));
    const box = el("textarea", { placeholder: "Paste the code here\u2026", spellcheck: false }, TEXTAREA_STYLE);
    wrapper.appendChild(box);
    const file = el("input", { type: "file", accept: ".txt,text/plain" }, { display: "none" });
    file.addEventListener("change", () => {
      const f = file.files && file.files[0];
      if (!f) return;
      f.text().then((t) => {
        box.value = t.trim();
        status.textContent = `Loaded ${f.name}.`;
        status.style.color = "";
      });
    });
    wrapper.appendChild(file);
    const status = el("div", {}, { marginTop: "4px", minHeight: "1.2em" });
    wrapper.appendChild(status);
    let busy = false;
    BootstrapDialog2.show({
      title,
      message: wrapper,
      buttons: [
        { label: "Load file\u2026", action: () => file.click() },
        {
          label: actionLabel,
          cssClass: "btn-primary",
          action: async (d) => {
            if (busy) return;
            busy = true;
            status.style.color = "";
            status.textContent = "Reading code\u2026";
            try {
              await onSubmit(box.value);
              d.close();
            } catch (e) {
              status.style.color = "#f66";
              status.textContent = e && e.message ? e.message : String(e);
            } finally {
              busy = false;
            }
          }
        },
        { label: "Cancel", action: (d) => d.close() }
      ]
    });
  }
  function showConfirmDialog({ title, message, confirmLabel, onConfirm, cancelLabel = "Cancel", danger = true }) {
    const BootstrapDialog2 = getDialog();
    if (!BootstrapDialog2) return;
    const wrapper = el("div");
    (Array.isArray(message) ? message : [message]).forEach((line) => wrapper.appendChild(el("p", { textContent: line })));
    BootstrapDialog2.show({
      title,
      message: wrapper,
      buttons: [
        { label: confirmLabel, cssClass: danger ? "btn-danger" : "btn-primary", action: (d) => {
          d.close();
          onConfirm();
        } },
        { label: cancelLabel, action: (d) => d.close() }
      ]
    });
  }
  function showInfoDialog({ title, message }) {
    const BootstrapDialog2 = getDialog();
    if (!BootstrapDialog2) return;
    const wrapper = el("div");
    (Array.isArray(message) ? message : [message]).forEach((line) => wrapper.appendChild(el("p", { textContent: line })));
    BootstrapDialog2.show({ title, message: wrapper, buttons: [{ label: "OK", cssClass: "btn-primary", action: (d) => d.close() }] });
  }

  // packages/core/backup.js
  var LS_PREFIX2 = "underscript.plugin.Wizascript.";
  var GM_PREFIX2 = "wizascript.";
  var KIND = "BACKUP";
  var CATEGORY2 = "Wizascript";
  var SKIP_GM = /* @__PURE__ */ new Set(["wizascript.migration.v150", "wizascript.lastSeenVersion"]);
  var SKIP_LS_PREFIXES = ["about.", "backup."];
  function isBackedUpLsKey(key2) {
    if (!key2.startsWith(LS_PREFIX2)) return false;
    const rest = key2.slice(LS_PREFIX2.length);
    return !SKIP_LS_PREFIXES.some((p) => rest.startsWith(p));
  }
  function isBackedUpGmKey(key2) {
    return key2.startsWith(GM_PREFIX2) && !SKIP_GM.has(key2);
  }
  function listGmKeys() {
    try {
      return (typeof GM_listValues === "function" ? GM_listValues() : []).filter(isBackedUpGmKey);
    } catch (e) {
      return [];
    }
  }
  function collectBackup() {
    const ls = {};
    Object.keys(localStorage).filter(isBackedUpLsKey).forEach((k) => {
      ls[k.slice(LS_PREFIX2.length)] = localStorage.getItem(k);
    });
    const gm = {};
    listGmKeys().forEach((k) => {
      gm[k.slice(GM_PREFIX2.length)] = GM_getValue(k);
    });
    return { format: 1, version: SUITE_VERSION, created: (/* @__PURE__ */ new Date()).toISOString(), ls, gm };
  }
  var FEATURE_LABELS = [
    ["keybinds.", "Keybinds"],
    ["controller.", "Controller bindings"],
    ["decktracker.", "Card Tracker"],
    ["deckTracker.", "Card Tracker"],
    ["misc.cardTags.", "Card Tags"],
    ["misc.notepad.", "Notepad"],
    ["patchmaker.", "Patch Maker"]
  ];
  function describe2(backup) {
    const found = /* @__PURE__ */ new Set();
    Object.keys(backup.gm || {}).forEach((k) => {
      const hit = FEATURE_LABELS.find(([p]) => (GM_PREFIX2 + k).startsWith(GM_PREFIX2 + p));
      if (hit) found.add(hit[1]);
    });
    const settings3 = Object.keys(backup.ls || {}).length;
    const parts = [`${settings3} setting${settings3 === 1 ? "" : "s"}`];
    if (found.size) parts.push(`saved data for ${Array.from(found).join(", ")}`);
    return parts.join(", plus ");
  }
  function validate(backup) {
    if (!backup || typeof backup !== "object" || backup.format !== 1 || typeof backup.ls !== "object" || typeof backup.gm !== "object") {
      throw new Error("That code isn't a Wizascript backup this version understands.");
    }
    const badLs = Object.entries(backup.ls).find(([, v]) => typeof v !== "string");
    if (badLs) throw new Error("The backup is damaged (a setting has an unexpected value).");
  }
  function restoreBackup(backup) {
    validate(backup);
    Object.keys(localStorage).filter(isBackedUpLsKey).forEach((k) => localStorage.removeItem(k));
    listGmKeys().forEach((k) => GM_deleteValue(k));
    Object.entries(backup.ls).forEach(([k, v]) => localStorage.setItem(LS_PREFIX2 + k, v));
    Object.entries(backup.gm).forEach(([k, v]) => GM_setValue(GM_PREFIX2 + k, v));
    GM_setValue("wizascript.migration.v150", true);
  }
  function formatDate(iso) {
    const d = new Date(iso);
    return isNaN(d) ? "an unknown date" : d.toLocaleString();
  }
  async function exportBackup() {
    const backup = collectBackup();
    const code = await encodeCode(KIND, backup);
    const day = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    showExportDialog({
      title: "Back Up Wizascript Settings",
      intro: `This code holds all your Wizascript settings and saved data (${describe2(backup)}). Keep it somewhere safe, then use "Restore" on another browser or after reinstalling.`,
      code,
      fileName: `wizascript-backup-${day}.txt`
    });
  }
  function importBackup() {
    showImportDialog({
      title: "Restore Wizascript Settings",
      intro: "Paste a Wizascript backup code, or load a saved backup file.",
      actionLabel: "Next",
      onSubmit: async (text) => {
        const backup = await decodeCode(text, KIND);
        validate(backup);
        setTimeout(() => showConfirmDialog({
          title: "Replace your Wizascript settings?",
          message: [
            `This backup was made with Wizascript v${backup.version || "?"} on ${formatDate(backup.created)} and contains ${describe2(backup)}.`,
            "Restoring replaces ALL of your current Wizascript settings and saved data with it. This can't be undone, so back up your current settings first if you might want them."
          ],
          confirmLabel: "Replace settings",
          onConfirm: () => {
            restoreBackup(backup);
            showConfirmDialog({
              title: "Settings restored",
              message: "Reload the page to finish applying them.",
              confirmLabel: "Reload now",
              cancelLabel: "Later",
              danger: false,
              onConfirm: () => getPageWindow().location.reload()
            });
          }
        }), 0);
      }
    });
  }
  function registerBackupSection(plugin) {
    const settingsApi = plugin.settings();
    settingsApi.add({
      key: "backup.export",
      name: "Back up settings",
      note: "Save all your Wizascript settings and data as a code or file.",
      type: "text",
      default: "Back up\u2026",
      category: CATEGORY2
    });
    registerSettingWidget("backup.export", asButton("Back up\u2026", () => exportBackup().catch((e) => console.error("[Wizascript] backup failed", e))));
    settingsApi.add({
      key: "backup.import",
      name: "Restore settings",
      note: "Replace your Wizascript settings with a saved backup.",
      type: "text",
      default: "Restore\u2026",
      category: CATEGORY2
    });
    registerSettingWidget("backup.import", asButton("Restore\u2026", () => importBackup()));
  }

  // packages/core/debug.js
  var LS_PREFIX3 = "underscript.plugin.Wizascript.";
  var KEY = "debugLogging";
  var OLD_KEYS = ["patchmaker.debugLogging", "truehubbridge.debugLogging", "decktracker.debugLogging", "ucTv.debugLogs"];
  var setting = null;
  var isOn = (v) => v === "1" || v === "true";
  function carryOverOldToggles() {
    const hadOne = OLD_KEYS.some((k) => isOn(localStorage.getItem(LS_PREFIX3 + k)));
    if (hadOne && localStorage.getItem(LS_PREFIX3 + KEY) === null) localStorage.setItem(LS_PREFIX3 + KEY, "1");
    OLD_KEYS.forEach((k) => localStorage.removeItem(LS_PREFIX3 + k));
  }
  function registerDebugSetting(plugin) {
    carryOverOldToggles();
    setting = plugin.settings().add({
      key: KEY,
      name: "Debug logging",
      note: "Print extra details to the browser console, for bug reports.",
      type: "boolean",
      default: false,
      category: "Wizascript"
    });
  }
  function isDebugLogging() {
    if (setting) return !!setting.value();
    return isOn(localStorage.getItem(LS_PREFIX3 + KEY));
  }
  var debugLoggingSetting = { value: () => isDebugLogging() };

  // packages/controller/gamepad.js
  var pageWindow = getPageWindow();
  var debugLoggingEnabled = false;
  function setDebugLoggingEnabled(v) {
    debugLoggingEnabled = !!v;
  }
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
    if (!debugLoggingEnabled) return;
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
  function prettifyKeyCode(code) {
    if (code.startsWith("Key") && code.length === 4) return code.slice(3);
    if (code.startsWith("Digit") && code.length === 6) return code.slice(5);
    return code;
  }
  function bindingToDisplay(value) {
    if (value === null || value === void 0) return "Unbound";
    if (typeof value === "number") return btnLabel(value);
    if (value && value.type === "key") return "Key: " + prettifyKeyCode(value.code);
    return "Unbound";
  }
  var AXIS_CALIBRATION = /* @__PURE__ */ new Map();
  var AXIS_STABLE_FRAMES_NEEDED = 90;
  var AXIS_JITTER_EPS = 0.02;
  var AXIS_CALIBRATION_WINDOW_MS = 4e3;
  function getCalibratedAxes(pad2) {
    let cal = AXIS_CALIBRATION.get(pad2.id);
    if (!cal) {
      cal = {
        baseline: pad2.axes.map(() => 0),
        lastRaw: pad2.axes.slice(),
        stableFrames: pad2.axes.map(() => 0),
        calibrateUntil: Date.now() + AXIS_CALIBRATION_WINDOW_MS
      };
      AXIS_CALIBRATION.set(pad2.id, cal);
    }
    if (Date.now() < cal.calibrateUntil) {
      pad2.axes.forEach((v, i) => {
        const prev = cal.lastRaw[i] !== void 0 ? cal.lastRaw[i] : v;
        if (Math.abs(v - prev) < AXIS_JITTER_EPS) {
          cal.stableFrames[i] = (cal.stableFrames[i] || 0) + 1;
        } else {
          cal.stableFrames[i] = 0;
        }
        cal.lastRaw[i] = v;
        if (cal.stableFrames[i] === AXIS_STABLE_FRAMES_NEEDED && Math.abs(v - (cal.baseline[i] || 0)) > AXIS_JITTER_EPS) {
          cal.baseline[i] = v;
          if (debugLoggingEnabled) console.log(`[Wizascript Controller] axis ${i} on "${pad2.id}" recalibrated to neutral=${v.toFixed(3)} after holding steady for ~1.5s (calibration window closes ${((cal.calibrateUntil - Date.now()) / 1e3).toFixed(1)}s from now)`);
        }
      });
    }
    return pad2.axes.map((v, i) => Math.max(-1, Math.min(1, v - (cal.baseline[i] || 0))));
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
        if (debugLoggingEnabled) console.log(`[Wizascript Controller] WebHID raw bit B1.0x${mask.toString(16).padStart(2, "0")} -> ${isR1 ? "DOWN" : "UP"}`);
        if (isR1) showPressIndicator(`\u{1F3AE} WebHID B1.0x${mask.toString(16).padStart(2, "0")} pressed`);
      }
      const wasR2 = !!(lastLoggedHidBits.raw2 & mask), isR2 = !!(raw2 & mask);
      if (wasR2 !== isR2) {
        if (debugLoggingEnabled) console.log(`[Wizascript Controller] WebHID raw bit B2.0x${mask.toString(16).padStart(2, "0")} -> ${isR2 ? "DOWN" : "UP"}`);
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
      if (debugLoggingEnabled) console.log("[Wizascript Controller] WebHID device already connected, ignoring duplicate open call.");
      return;
    }
    try {
      if (!device.opened) await device.open();
      device.addEventListener("inputreport", handleHidInputReport);
      hidDevice = device;
      if (debugLoggingEnabled) console.log("[Wizascript Controller] WebHID device opened:", device.productName || device.vendorId + ":" + device.productId);
    } catch (e) {
      if (debugLoggingEnabled) console.log("[Wizascript Controller] WebHID open failed:", e);
    }
  }
  async function connectWebHidController() {
    if (!navigator.hid) {
      if (debugLoggingEnabled) console.log("[Wizascript Controller] navigator.hid is not available in this browser/context - WebHID cannot be used.");
      return;
    }
    try {
      const devices = await navigator.hid.requestDevice({ filters: [{ vendorId: WEBHID_VENDOR_ID }] });
      if (!devices.length) {
        if (debugLoggingEnabled) console.log("[Wizascript Controller] WebHID device picker closed with no selection.");
        return;
      }
      await openHidDevice(devices[0]);
    } catch (e) {
      if (debugLoggingEnabled) console.log("[Wizascript Controller] WebHID requestDevice failed:", e);
    }
  }
  (async function tryAutoReconnectWebHid() {
    if (!navigator.hid) return;
    try {
      const devices = await navigator.hid.getDevices();
      const match = devices.find((d) => d.vendorId === WEBHID_VENDOR_ID);
      if (match) await openHidDevice(match);
    } catch (e) {
      if (debugLoggingEnabled) console.log("[Wizascript Controller] WebHID auto-reconnect check failed:", e);
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
        if (isSameDevice && debugLoggingEnabled) console.log("[Wizascript Controller] excluding native Gamepad-API entry for the WebHID-connected device from the merge (buttons unreliable over Bluetooth):", p.id);
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
    if (!debugLoggingEnabled) return;
    console.log("[Wizascript Controller] gamepadconnected:", {
      index: e.gamepad.index,
      id: e.gamepad.id,
      mapping: e.gamepad.mapping,
      buttons: e.gamepad.buttons.length,
      axes: e.gamepad.axes.length
    });
  });
  pageWindow.addEventListener("gamepaddisconnected", (e) => {
    if (!debugLoggingEnabled) return;
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
    if (!debugLoggingEnabled) return;
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
    if (!debugLoggingEnabled) return;
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

  // packages/core/plugin-guides.js
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function key(bindingKey, defaultCode) {
    const d = describeKeybind(bindingKey, defaultCode);
    return d ? `<b>${esc(d)}</b>` : "<i>(unbound - set it on the Keybinds tab)</i>";
  }
  var primary = () => `<b>${esc(getPrimaryKeyDisplay())}</b>`;
  var pad = (i) => `<b>${esc(bindingToDisplay(i))}</b>`;
  var GUIDES = {
    patchMaker: {
      tab: "Patch Maker",
      pages: "the Patch Notes page",
      summary: "Write your own patch notes, formatted like the real ones.",
      points: () => [
        "Click <b>Show Custom Patch Notes</b> at the top of the page, then add balance changes, sections and New Cards (with your own card images).",
        "<b>Switch to Viewer Mode</b> shows the result formatted like an official patch. The <b>Help</b> button lists the formatting codes (e.g. {card names}, [[switch effects]]).",
        `While editing an entry: ${key("cycleCategoryUp", "Comma")} / ${key("cycleCategoryDown", "Period")} changes its balance category, and ${key("moveEntryUp", "ArrowUp")} / ${key("moveEntryDown", "ArrowDown")} moves the selected entry, section or card.`,
        "Everything saves automatically. Double-click <b>Reset Data</b> to start over."
      ]
    },
    trueHub: {
      tab: "True Hub Bridge",
      pages: "the Hub page",
      summary: "Browse a much bigger library of community decks, collected from the True Hub Discord.",
      points: () => [
        "Use <b>Switch to True Hub</b> / <b>Switch to Classic Hub</b> to swap between deck lists (True Hub opens by itself unless Auto Open is off).",
        "Filter by Soul, or open <b>Card Filter</b> to require (<b>+ Inc</b>) or exclude (<b>\u2212 Exc</b>) specific cards.",
        "<b>Info</b> shows the author's notes. The preview button opens the deck like any other Hub deck.",
        "Change pages with the arrows, or scroll the mouse wheel over the list (Scroll Paging)."
      ]
    },
    cardTracker: {
      tab: "Card Tracker",
      pages: "your matches and while spectating",
      summary: "On-screen counters you update yourself. Nothing is counted automatically.",
      points: () => [
        "Click the <b>+</b> next to your avatar to add a tracker: a built-in one, or your own with <b>Custom Tracker</b>. The picker's <b>Help</b> button explains the icons.",
        "On a tracker: <b>left-click</b> +1, <b>right-click</b> \u22121, <b>middle-click</b> resets to 0. Drag it to move it, drag its corner to resize, <b>\xD7</b> closes it.",
        "<b>\u2665</b> a tracker in the picker to have it load automatically every match.",
        "Drag the <b>+</b> itself to move it; middle-click it to put it back."
      ]
    },
    ucTv: {
      tab: "UC TV",
      pages: "spectate pages",
      summary: "Channel-surf between live matches while you spectate.",
      points: () => [
        `${key("previousChannel", "ArrowLeft")} / ${key("nextChannel", "ArrowRight")} jumps to the previous / next live match.`,
        `<b>Hold</b> ${primary()} to open the Channel Guide, then click a player to watch them. Let go to close it.`,
        `Auto-mode (above) moves on to another match by itself when the current one ends. Tap ${primary()} to cancel the countdown.`,
        "Match Filtering (above) limits which matches you surf to, by game mode, player level and rank."
      ]
    },
    controller: {
      tab: "Controller Support",
      pages: "every page",
      summary: "Play and navigate Undercards with a gamepad.",
      points: () => [
        `Left stick moves a cursor. ${pad(0)} clicks, ${pad(3)} right-clicks, ${pad(1)} goes back. Right stick: left/right changes cursor speed, up/down scrolls.`,
        "The d-pad steps through menus, dialogs, settings and your hand/board. Text boxes open an on-screen keyboard.",
        `Hold Controller Primary for the combos listed above; In-Game Inputs need just one press. In Settings, ${pad(4)} / ${pad(5)} switch tabs.`,
        "To change a binding, click it and press a button (or a key); Esc unbinds. Up to 3 presets. Controller not responding? Try <b>Detect Controller</b> at the top."
      ]
    },
    notepad: {
      tab: null,
      pages: "every page",
      summary: "A drawing notepad you can keep on screen.",
      points: () => [
        "<b>Draw</b>, <b>Erase</b> or <b>Fill</b>; pick colours on the wheel and apply them to the pen or the paper. Up to 6 layers (the dashed <b>+</b> adds one; double-click the top layer's number to remove it).",
        "Drag the title bar to move it. Click the name to rename it. <b>Save PNG</b> uses the name as the filename.",
        `${key("toggleNotepad", "KeyO")} shows/hides it, ${key("undoNotepad", "KeyZ")} / ${key("redoNotepad", "KeyY")} undo/redo, ${key("resetNotepad", "KeyN")} resets it (including its position).`,
        "Your drawing, colours, name and position are saved between visits."
      ]
    },
    cardTags: {
      tab: null,
      pages: "the Crafting and Decks pages",
      summary: 'Your own labels for cards, like "Wincon" or "Draw".',
      points: () => [
        "<b>Right-click a card</b> to create a tag or switch one on/off for that card.",
        "Tagged cards show coloured dots. Type a tag's name into the search bar to show only cards with that tag.",
        "<b>Manage Tags\u2026</b> (in the right-click menu) renames, recolours and deletes tags, and can <b>Share\u2026</b> / <b>Import\u2026</b> tags with friends."
      ]
    },
    tierList: {
      tab: "Tier List",
      pages: "every page, including matches",
      summary: "Rank cards, souls and artifacts in your own tier lists.",
      points: () => [
        `${key("toggleTierList", "KeyL")} shows/hides the window. Drag its title bar to move it, its edges to resize it; <b>\u25A1</b> fills the screen.`,
        "Pick <b>Cards</b>, <b>Souls</b>, <b>Artifacts</b> or <b>Text</b> in the bottom panel, then drag items into a tier. On Crafting/Decks you can also drag cards straight from the page.",
        "Click a tier's label (or <b>\u2699</b>) to edit it. Drag an item back to the panel to unrank it. Rest the mouse on a card for 3s to see it in full.",
        "<b>Lists \u25BE</b> switches between lists or adds one. Saves automatically; <b>\u21B6</b> undoes."
      ]
    }
  };
  function pluginName(id) {
    const p = PLUGINS.find((x) => x.id === id);
    return p ? p.name : id;
  }
  function guideHtml(id) {
    const g = GUIDES[id];
    if (!g) return "";
    return `<div style="opacity:.8;margin-bottom:4px">Works on ${esc(g.pages)}.</div><div style="margin-bottom:4px">${g.summary}</div><ul style="margin:0;padding-left:18px">${g.points().map((p) => `<li style="margin:2px 0">${p}</li>`).join("")}</ul>`;
  }
  var BOX_STYLE = "flex-basis:100%;margin-top:6px;padding:8px 10px;border:1px solid #555;border-radius:4px;background:rgba(255,255,255,0.04);font-size:0.95em;line-height:1.4;white-space:normal;";
  function openGuideDialog(id) {
    const BootstrapDialog2 = getPageWindow().BootstrapDialog;
    if (!BootstrapDialog2 || typeof BootstrapDialog2.show !== "function") return;
    const note = isPluginEnabled(id) ? "" : `<div style="margin-top:8px;opacity:.7">Turn it on in the list, then reload the page, to use it.</div>`;
    BootstrapDialog2.show({
      title: `How to use ${pluginName(id)}`,
      message: `<div style="white-space:normal">${guideHtml(id)}${note}</div>`,
      buttons: [{ label: "Close", cssClass: "btn-primary", action: (d) => d.close() }]
    });
  }
  function registerPluginGuides(plugin) {
    Object.entries(GUIDES).forEach(([id, g]) => {
      if (g.tab) {
        const categorised = g.tab === "Controller Support";
        const settings3 = createFeatureSettings(plugin, "guide", {
          tab: g.tab,
          visible: () => isPluginEnabled(id),
          categories: categorised
        });
        settings3.add(id, {
          name: `How to use ${pluginName(id)}`,
          type: "text",
          default: "",
          category: "About"
        });
        registerSettingWidget(`guide.${id}`, (el2) => {
          el2.readOnly = true;
          el2.tabIndex = -1;
          el2.style.display = "none";
          const row = el2.closest(".flex-start");
          if (!row) return;
          const label = row.querySelector("label");
          if (label) label.style.fontWeight = "bold";
          const box = document.createElement("div");
          box.className = "wizascript-guide";
          box.style.cssText = BOX_STYLE;
          box.innerHTML = guideHtml(id);
          row.appendChild(box);
        });
      }
      const toggle = PLUGINS.find((p) => p.id === id);
      if (!toggle) return;
      registerSettingWidget(toggle.key, (el2) => {
        const row = el2.closest(".flex-start");
        const label = row && row.querySelector("label");
        if (!label || row.querySelector(".wizascript-guide-link")) return;
        const link = document.createElement("a");
        link.href = "#";
        link.className = "wizascript-guide-link";
        link.textContent = "?";
        link.title = `How to use ${pluginName(id)}`;
        link.setAttribute("role", "button");
        link.style.cssText = "margin-left:6px;display:inline-block;width:16px;height:16px;line-height:14px;text-align:center;border:1px solid #888;border-radius:50%;font-size:11px;color:#ccc;text-decoration:none;";
        link.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openGuideDialog(id);
        });
        label.insertAdjacentElement("afterend", link);
      });
    });
  }

  // packages/core/tab-bar.js
  var MAIN_TAB_LABEL = "General";
  var MAIN_TAB_MARKER_ID = "underscript.plugin.Wizascript.about.version";
  var VIEW_CLASS = "wizascript-tabs";
  var ARROW_CLASS = "wizascript-tab-arrow";
  var HIDDEN_CLASS = "wizascript-tab-offscreen";
  var GAP_PX = 5;
  var currentPage = 0;
  var observedView = null;
  var mutationObserver = null;
  var resizeObserver = null;
  var lastWidth = 0;
  var applying = false;
  function injectStyle() {
    if (document.getElementById("wizascript-tab-bar-style")) return;
    const style = document.createElement("style");
    style.id = "wizascript-tab-bar-style";
    style.textContent = `
.tabbedView.${VIEW_CLASS} > .tabLabel { overflow: visible; text-overflow: clip; max-width: none; }
.tabbedView.${VIEW_CLASS} > .tabLabel.${HIDDEN_CLASS} { display: none; }
.tabbedView.${VIEW_CLASS} > .tabLabel.${ARROW_CLASS} { grid-row: 1; cursor: pointer; user-select: none; text-align: center; min-width: 26px; }
.tabbedView.${VIEW_CLASS} > .tabLabel.${ARROW_CLASS}[data-dir="-1"] { grid-column: -3 / -2; }
.tabbedView.${VIEW_CLASS} > .tabLabel.${ARROW_CLASS}[data-dir="1"] { grid-column: -2 / -1; }
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
    const el2 = document.createElement("div");
    el2.className = `tabLabel ${ARROW_CLASS}`;
    el2.dataset.dir = String(dir);
    el2.textContent = text;
    el2.title = dir < 0 ? "Previous tabs" : "More tabs";
    el2.addEventListener("click", (e) => {
      e.preventDefault();
      if (el2.classList.contains("disabled")) return;
      currentPage += dir;
      layout(view);
    });
    return el2;
  }
  function ensureArrows(view) {
    let left = view.querySelector(`:scope > .${ARROW_CLASS}[data-dir="-1"]`);
    let right = view.querySelector(`:scope > .${ARROW_CLASS}[data-dir="1"]`);
    if (!left) left = makeArrow(view, "\u25C0", -1);
    if (!right) right = makeArrow(view, "\u25B6", 1);
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
  function paginate(widths, room) {
    const pages = [];
    let start = 0;
    while (start < widths.length) {
      let used = 0;
      let end = start;
      while (end < widths.length) {
        const next = used + widths[end] + (end > start ? GAP_PX : 0);
        if (next > room && end > start) break;
        used = next;
        end++;
      }
      pages.push({ start, end });
      start = end;
    }
    return pages;
  }
  function layout(view, { revealActive = false } = {}) {
    const available = view.clientWidth;
    if (!available) return;
    lastWidth = available;
    applying = true;
    try {
      view.classList.add(VIEW_CLASS);
      const labels = realLabels(view);
      labels.forEach((l) => l.classList.remove(HIDDEN_CLASS));
      removeArrows(view);
      if (!labels.length) return;
      view.style.gridTemplateColumns = `repeat(${labels.length}, max-content) 1fr`;
      const widths = labels.map((l) => l.getBoundingClientRect().width);
      const total = widths.reduce((a, b) => a + b, 0) + GAP_PX * (labels.length - 1);
      if (total <= available) {
        currentPage = 0;
        return;
      }
      const { left, right } = ensureArrows(view);
      view.style.gridTemplateColumns = `repeat(${labels.length}, max-content) 1fr max-content max-content`;
      const arrowsWidth = left.getBoundingClientRect().width + right.getBoundingClientRect().width + GAP_PX * 2;
      const pages = paginate(widths, available - arrowsWidth);
      currentPage = Math.max(0, Math.min(currentPage, pages.length - 1));
      if (revealActive) {
        const active = activeIndex(labels);
        const page = pages.findIndex((p) => active >= p.start && active < p.end);
        if (page >= 0) currentPage = page;
      }
      const { start, end } = pages[currentPage];
      labels.forEach((l, i) => l.classList.toggle(HIDDEN_CLASS, i < start || i >= end));
      left.classList.toggle("disabled", currentPage === 0);
      right.classList.toggle("disabled", currentPage === pages.length - 1);
      left.title = `Previous tabs (page ${currentPage + 1} of ${pages.length})`;
      right.title = `More tabs (page ${currentPage + 1} of ${pages.length})`;
      view.style.gridTemplateColumns = `repeat(${end - start}, max-content) 1fr max-content max-content`;
    } finally {
      setTimeout(() => {
        applying = false;
      }, 0);
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
    mutationObserver.observe(view, { childList: true });
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
  function initTabBar(plugin) {
    injectStyle();
    plugin.events.on("Settings:open", () => setTimeout(apply, 0));
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

  // packages/patch-maker/settings.js
  function registerPatchMakerSettings(plugin) {
    const settings3 = createFeatureSettings(plugin, "patchmaker", {
      tab: "Patch Maker",
      visible: () => isPluginEnabled("patchMaker")
    });
    return {
      settings: settings3,
      // The on/off switch itself now lives in the Plugins list (core/plugins.js).
      enabled: getPluginToggle("patchMaker"),
      // One suite-wide switch on the General tab since 1.5.0 (core/debug.js).
      debugLogging: debugLoggingSetting,
      hideControls: settings3.add("hideControls", { name: "Hide Patch Maker controls", type: "boolean", default: false }),
      cardHovers: settings3.add("enableCardHovers", { name: "Enable card hovers", type: "boolean", default: true }),
      language: settings3.add("patchLanguage", {
        name: "Select Language",
        type: "select",
        options: ["Auto / Default", "English", "French", "Spanish", "Portuguese", "Chinese", "Italian", "Polish", "German", "Russian"],
        default: "Auto / Default",
        onChange: () => location.reload()
      }),
      openOnLoad: settings3.add("openPatchNotesOnPageLoad", { name: "Auto-Load Patch Maker", type: "boolean", default: false })
    };
  }

  // packages/patch-maker/new-cards.js
  var TARGET_W = 176;
  var TARGET_H = 246;
  var FIELDMARKER_WATERMARK_CROP_PX = 14;
  function readFileAsDataURL(file) {
    return new Promise((resolve2, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve2(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
  function loadImageFromDataURL(dataUrl) {
    return new Promise((resolve2, reject) => {
      const img = new Image();
      img.onload = () => resolve2(img);
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
  function escapeHtml2(str) {
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
      return `<span class="uc-card-ref" style="color:${cardColor};">${escapeHtml2(cleaned)}</span>`;
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
        return `<span style="text-decoration:underline;">${escapeHtml2(seg.trim())}</span>`;
      }
      seg = insertUnderlineMarkers(seg, underlineTokens);
      seg = escapeHtml2(seg);
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
    formatted = formatted.replace(/UCSK(\d+)Z/g, (m, idx) => escapeHtml2(skipData.skipped[Number(idx)] || ""));
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
    const i18n2 = getI18n();
    if (!i18n2) return;
    const version = getTranslateVersion();
    const path = `/translation/${lang}.json${version ? "?v=" + version : ""}`;
    await new Promise((resolve2, reject) => {
      const deferred = i18n2().load({ [lang]: path });
      if (deferred && typeof deferred.done === "function") {
        deferred.done(resolve2);
        if (typeof deferred.fail === "function") deferred.fail(reject);
      } else {
        resolve2();
      }
    });
    loadedLanguages.add(lang);
  }
  function getLocalizedString(key2, ...args) {
    const i18n2 = getI18n();
    if (!i18n2) return "";
    try {
      const value = i18n2.apply(i18n2, [key2, ...args]);
      return !value || value === key2 ? "" : String(value).trim();
    } catch {
      return "";
    }
  }
  async function buildLocalizedFormattingData(selectedLanguageLabel, baseWordColors) {
    const lang = getResolvedLanguage(selectedLanguageLabel);
    const i18n2 = getI18n();
    const tokens = FALLBACK_KEYWORDS.concat(FALLBACK_TRIBES);
    const localizedColors = {};
    if (!i18n2) {
      return { tokens: [...new Set(tokens)].filter(Boolean).sort((a, b) => b.length - a.length), localizedColors };
    }
    const originalLocale = i18n2().locale;
    try {
      await ensureLanguageLoaded(lang);
      i18n2().locale = lang;
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
        i18n2().locale = originalLocale;
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
    const i18n2 = getI18n();
    const cards2 = getAllCards();
    if (!cards2.length && attempt < 40) {
      await new Promise((r) => setTimeout(r, 250));
      return buildLocalizedCardNameMap(selectedLanguageLabel, attempt + 1);
    }
    const map = /* @__PURE__ */ new Map();
    if (!cards2.length) return map;
    const originalLocale = i18n2 ? i18n2().locale : null;
    try {
      if (i18n2) {
        await ensureLanguageLoaded(lang);
        i18n2().locale = lang;
      }
      cards2.forEach((card) => {
        if (!card || !card.id) return;
        if (card.name) {
          addNameMapping(map, card.name, card.id);
          const englishPlural = getLocalizedString(`card-name-${card.id}`, 2);
          if (englishPlural) addNameMapping(map, englishPlural, card.id);
        }
        if (i18n2) {
          const singular = getLocalizedString(`card-name-${card.id}`, 1);
          const plural = getLocalizedString(`card-name-${card.id}`, 2);
          if (singular) addNameMapping(map, singular, card.id);
          if (plural) addNameMapping(map, plural, card.id);
        }
      });
    } finally {
      if (i18n2 && originalLocale) {
        try {
          i18n2().locale = originalLocale;
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
  function attachCardHover(el2, cardId) {
    const pageWindow2 = getPageWindow();
    const displayCardHelp = pageWindow2.displayCardHelp;
    const removeCardHover = pageWindow2.removeCardHover;
    if (typeof displayCardHelp !== "function" || typeof removeCardHover !== "function") {
      return false;
    }
    el2.dataset.ucHoverBound = "true";
    el2.style.cursor = "pointer";
    el2.addEventListener("mouseover", function() {
      displayCardHelp(this, cardId);
    });
    el2.addEventListener("mouseleave", function() {
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
    logger: logger4,
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
        const state2 = collectState();
        if (state2) {
          GM_setValue(STATE_KEY, JSON.stringify(state2));
          logger4.log("save", "State saved.", { sections: state2.sections.length });
        }
      } catch (e) {
        logger4.error("save", "Failed to save state", e);
      }
    }
    function loadState() {
      const text = GM_getValue(STATE_KEY, "");
      if (!text) {
        logger4.log("load", "No saved state found.");
        return;
      }
      try {
        const saved = JSON.parse(text);
        if (saved && saved.sections) {
          restoreState(saved);
          logger4.log("load", "State restored.", { sections: saved.sections.length });
        }
      } catch (e) {
        logger4.error("load", "Failed to parse saved state", e);
      }
    }
    function resetState() {
      GM_deleteValue(STATE_KEY);
    }
    function makeEditable(el2, placeholder) {
      el2.setAttribute("contenteditable", "true");
      el2.spellcheck = false;
      el2.addEventListener("focus", () => {
        el2.dataset.prevText = el2.textContent.trim();
        enableInputBlocker();
      });
      el2.addEventListener("blur", () => {
        let t = sanitizeText(el2.textContent);
        if (!t) t = placeholder;
        el2.textContent = t;
        saveState();
        disableInputBlocker();
      });
      el2.addEventListener("keydown", (e) => {
        if (overlay.classList.contains("viewer-mode")) return;
        if (e.key === "Enter") {
          e.preventDefault();
          el2.blur();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          el2.textContent = el2.dataset.prevText;
          el2.blur();
        }
      });
      el2.addEventListener("paste", (e) => {
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
      container.querySelectorAll(".uc-card-ref").forEach((el2) => {
        if (el2.dataset.ucHoverBound === "true") return;
        const name = el2.textContent.trim();
        const cardId = getCardIdByExactGameLookup(name) || resolveCardId(name, cardNameMap);
        if (!cardId) {
          logger4.warn("hover", "Card not found for hover", name);
          return;
        }
        attachCardHover(el2, cardId);
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
      const state2 = { title: "", sections: [], newCards: newCards.collectState(container) };
      const h2 = container.querySelector("h2");
      if (h2) state2.title = h2.textContent.trim();
      container.querySelectorAll("p.uc-section-header").forEach((p) => {
        const labelEl = p.querySelector(".uc-section-label");
        const ul = p.nextElementSibling;
        if (!ul) return;
        state2.sections.push({
          label: labelEl ? labelEl.textContent.trim() : "",
          custom: p.dataset.custom === "true",
          collapsed: ul.style.display === "none",
          items: [...ul.querySelectorAll(":scope > li")].map((li) => ({
            raw: li.dataset.raw || "",
            category: cycleOrder.find((c) => li.classList.contains(c)) || "other"
          }))
        });
      });
      return state2;
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
        logger4.warn("init", "Overlay already exists; aborting duplicate init.");
        return;
      }
      injectPatchMakerStyle();
      const navbars = mainEl.querySelectorAll(".navbar.navbar-default");
      const headerNav = navbars[0];
      if (!headerNav) {
        logger4.error("init", "Could not find header navbar.");
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
      for (const el2 of originalPatchNotesNodes) {
        if (!h3 && el2.tagName === "H3") {
          h3 = el2.cloneNode(true);
          continue;
        }
        if (!hr1 && el2.tagName === "HR") {
          hr1 = el2.cloneNode(true);
          continue;
        }
        if (!h2 && el2.tagName === "H2") {
          h2 = el2.cloneNode(true);
          continue;
        }
        if (!hr2 && el2.tagName === "HR") {
          hr2 = el2.cloneNode(true);
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
      logger4.log("init", "Overlay initialized.");
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
          logger4.log("mode", "Switched to viewer mode.");
        } else {
          container.querySelectorAll("p").forEach((p) => {
            p.style.display = "";
          });
          clearFormattingOverlay();
          setEditingEnabled(true);
          logger4.log("mode", "Switched to editor mode.");
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
    const settings3 = registerPatchMakerSettings(plugin);
    const logger4 = createLogger("PatchMaker");
    const originalWarn = logger4.warn.bind(logger4);
    const originalLog = logger4.log.bind(logger4);
    logger4.log = (...args) => {
      if (settings3.debugLogging.value()) originalLog(...args);
    };
    logger4.warn = (...args) => {
      if (settings3.debugLogging.value()) originalWarn(...args);
    };
    let wordColors = { ...BASE_WORD_COLORS };
    let underlineTokens = [];
    let cardNameMap = /* @__PURE__ */ new Map();
    const overlay = createPatchMakerOverlay({
      plugin,
      logger: logger4,
      version: FEATURE_VERSION,
      getWordColors: () => wordColors,
      getUnderlineTokens: () => underlineTokens,
      getCardHoversEnabled: () => settings3.cardHovers.value(),
      getCardNameMap: () => cardNameMap,
      getHideControlsEnabled: () => settings3.hideControls.value(),
      getOpenOnLoad: () => settings3.openOnLoad.value()
    });
    settings3.hideControls.on((value) => overlay.setControlsHidden(value));
    if (!settings3.enabled.value()) return;
    if (!isPatchNotesPage()) return;
    async function refreshLocalizedData() {
      const languageLabel = settings3.language.value();
      const { tokens, localizedColors } = await buildLocalizedFormattingData(languageLabel, BASE_WORD_COLORS);
      underlineTokens = tokens;
      wordColors = { ...BASE_WORD_COLORS, ...localizedColors };
      cardNameMap = await buildLocalizedCardNameMap(languageLabel);
    }
    waitForMainContent((mainEl) => {
      overlay.init(mainEl);
      refreshLocalizedData().catch((e) => logger4.error("init", "Failed to load localized data", e));
    });
  }

  // packages/true-hub-bridge/settings.js
  function registerTrueHubBridgeSettings(plugin) {
    const settings3 = createFeatureSettings(plugin, "truehubbridge", {
      tab: "True Hub Bridge",
      visible: () => isPluginEnabled("trueHub")
    });
    return {
      settings: settings3,
      // The on/off switch itself now lives in the Plugins list (core/plugins.js).
      enabled: getPluginToggle("trueHub"),
      // One suite-wide switch on the General tab since 1.5.0 (core/debug.js).
      debugLogging: debugLoggingSetting,
      autoOpen: settings3.add("autoOpenTrueHub", {
        name: "Auto Open True Hub",
        type: "boolean",
        default: true
      }),
      scrollPaging: settings3.add("enableScrollPaging", {
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
    const getCard2 = getPageWindow().getCard;
    if (typeof getCard2 !== "function") return null;
    try {
      return getCard2(id);
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
  function seasonNumber(season) {
    const match = /^s(\d+)/i.exec(season || "");
    return match ? Number(match[1]) : -1;
  }
  var SOUL_COLORS = {
    DETERMINATION: "red",
    PATIENCE: "#41fcff",
    BRAVERY: "#fca500",
    INTEGRITY: "#0064ff",
    PERSEVERANCE: "#d535d9",
    KINDNESS: "#00c000",
    JUSTICE: "#ffff00"
  };
  function createTrueHubOverlay({ logger: logger4, getAutoOpen, getScrollPaging }) {
    let allDecks = [];
    let filteredDecks = [];
    let currentPage2 = 1;
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
      allDecks.sort((a, b) => {
        const seasonDiff = seasonNumber(b.season) - seasonNumber(a.season);
        if (seasonDiff !== 0) return seasonDiff;
        return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
      });
      filteredDecks = [...allDecks];
      logger4.log("data", "Decks loaded.", { count: allDecks.length });
    }
    function applyFilters2() {
      filteredDecks = filterDecks(allDecks, { activeSoulFilter, activeSearch, includeCards, excludeCards });
      currentPage2 = 1;
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
          const artifacts2 = ((decoded == null ? void 0 : decoded.artifactIds) || []).map((id) => getArtifactById(id)).filter(Boolean);
          artifacts2.forEach((artifact, index) => {
            const img = document.createElement("img");
            img.src = `images/artifacts/${artifact.image}.png`;
            img.title = artifact.name;
            artifactContainer.appendChild(img);
            if (index < artifacts2.length - 1) artifactContainer.append(" ");
          });
        } catch (err) {
          logger4.error("card", "Artifact decode failed", err, deck);
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
      const start = (currentPage2 - 1) * DECKS_PER_PAGE;
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
        if (currentPage2 <= 1) return;
        currentPage2--;
        renderPage();
      };
      btnNext2.onclick = () => {
        const total = Math.ceil(filteredDecks.length / DECKS_PER_PAGE);
        if (currentPage2 >= total) return;
        currentPage2++;
        renderPage();
      };
      pageSelect.onchange = (e) => {
        currentPage2 = Number(e.target.value) + 1;
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
        if (i === currentPage2) opt.selected = true;
        thSelect.appendChild(opt);
      }
      thMax.textContent = total;
      thPrev.disabled = currentPage2 <= 1;
      thNext.disabled = currentPage2 >= total;
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
          currentPage2 = 1;
          enableTrueHubNav();
          renderPage();
          btn.textContent = "Switch to Classic Hub";
          mode = "true";
          logger4.log("mode", "Switched to True Hub view.");
        } else {
          trueHubWrapper.style.display = "none";
          originalDecks.style.display = "";
          restoreClassicNav();
          btn.textContent = "Switch to True Hub";
          mode = "classic";
          logger4.log("mode", "Switched to Classic Hub view.");
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
          logger4.error("init", "Could not find nav elements.");
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
            if (currentPage2 < totalPages) {
              currentPage2++;
              renderPage();
            }
          } else if (e.deltaY < 0) {
            if (currentPage2 > 1) {
              currentPage2--;
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
          logger4.log("init", "Auto-opening True Hub view.");
          if (toggleBtn) toggleBtn.click();
        }
        logger4.log("init", "Ready.", { decksLoaded: allDecks.length });
      });
    }
    return { init, setDecks };
  }

  // packages/true-hub-bridge/decks-api.js
  var DECKS_URL = "https://raw.githubusercontent.com/theWiza2341/Wizascript/refs/heads/main/bot/decks.json";
  function loadDecks() {
    return new Promise((resolve2, reject) => {
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
            resolve2(Array.isArray(raw) ? raw : raw.decks || []);
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
    const settings3 = registerTrueHubBridgeSettings(plugin);
    if (!settings3.enabled.value()) return;
    if (!isHubPage()) return;
    const logger4 = createLogger("TrueHubBridge");
    const originalWarn = logger4.warn.bind(logger4);
    const originalLog = logger4.log.bind(logger4);
    logger4.log = (...args) => {
      if (settings3.debugLogging.value()) originalLog(...args);
    };
    logger4.warn = (...args) => {
      if (settings3.debugLogging.value()) originalWarn(...args);
    };
    const overlay = createTrueHubOverlay({
      logger: logger4,
      getAutoOpen: () => settings3.autoOpen.value(),
      getScrollPaging: () => settings3.scrollPaging.value()
    });
    loadDecks().then((decks) => {
      overlay.setDecks(decks);
      overlay.init();
    }).catch((e) => logger4.error("data", "Failed to load decks.json", e));
  }

  // packages/deck-tracker/settings.js
  function registerDeckTrackerSettings(plugin) {
    const settings3 = createFeatureSettings(plugin, "decktracker", {
      tab: "Card Tracker",
      visible: () => isPluginEnabled("cardTracker")
    });
    const enabled = getPluginToggle("cardTracker");
    const debugLogging = debugLoggingSetting;
    const retainUnclosedPresets = settings3.add("retainUnclosedPresets", {
      name: "Retain Unclosed Presets Between Matches",
      type: "boolean",
      default: false
    });
    const allowFavoritedRetainedWhileSpectating = settings3.add("allowFavoritedRetainedWhileSpectating", {
      name: "Auto-load Presets While Spectating",
      note: "Applies to your own favorited/retained tracker presets specifically.",
      type: "boolean",
      default: false
    });
    const dimOpacity = settings3.add("dimOpacity", {
      name: "Tracker Dim Opacity",
      type: "slider",
      default: 0.4,
      min: 0,
      max: 1,
      step: 0.05
    });
    return {
      settings: settings3,
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
  function setSavedPosition(id, layout2) {
    const positions = loadPositions();
    positions[id] = layout2;
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
        const layout2 = { left: rect.left, top: rect.top, width: getWidth() };
        if (trackRetain) {
          setSavedPosition(id, layout2);
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
      const layout2 = { left: rect.left, top: rect.top, width: getWidth() };
      if (trackRetain) {
        setSavedPosition(id, layout2);
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
  function trashIconSVG() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
    <path d="M10 11v6"></path>
    <path d="M14 11v6"></path>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
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
      starBtn.attr("title", active ? "Remove from screen" : "Add to screen");
    }
    renderStar();
    starBtn.on("click", (e) => {
      e.stopPropagation();
      if (active) {
        onCloseWidget(preset.id);
      } else {
        onAdd(preset.id);
      }
      active = !active;
      renderStar();
    });
    row.append(heart, info, starBtn);
    if (preset.custom) {
      const trashBtn = $("<span>").css({
        width: "20px",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer"
      }).html(trashIconSVG()).attr("title", "Double-click to permanently delete this custom tracker").on("click", (e) => {
        e.stopPropagation();
        if (e.detail !== 2) return;
        onDelete(preset.id);
        row.remove();
      });
      row.append(trashBtn);
    }
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
      "Adds the preset to your screen. Once active, the star fills in - click it again to remove it from screen. Same behavior for every preset, built-in or custom."
    );
    section(
      "The trash icon (custom presets only)",
      "Permanently deletes one of your own custom trackers - double-click to confirm, no popup. Shown next to every custom preset in this list whether or not it's currently on screen, so you can clean up an old one without adding it back first."
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
      title: "Card Tracker Help",
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
    const settings3 = registerDeckTrackerSettings(plugin);
    if (!settings3.enabled.value()) return;
    if (!isGamePage()) return;
    const logger4 = createLogger("DeckTracker");
    const originalWarn = logger4.warn.bind(logger4);
    const originalLog = logger4.log.bind(logger4);
    logger4.log = (...args) => {
      if (settings3.debugLogging.value()) originalLog(...args);
    };
    logger4.warn = (...args) => {
      if (settings3.debugLogging.value()) originalWarn(...args);
    };
    setRetainEnabledGetter(() => settings3.retainUnclosedPresets.value());
    registerBuiltInPresets();
    function handleAddPreset(id) {
      spawnPreset(id);
      logger4.log("hud", "Spawned preset from picker:", id);
    }
    function handleCloseWidget(id) {
      closeWidget(id);
      logger4.log("hud", "Closed preset from picker:", id);
    }
    function handleDeletePreset(id) {
      closeWidget(id);
      deleteCustomPreset(id);
      logger4.log("hud", "Deleted custom preset:", id);
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
                logger4.log("hud", "Saved custom tracker as preset:", savedName);
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
          btn.style.opacity = shouldDim ? String(settings3.dimOpacity.value()) : "1";
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
          logger4.log("hud", "Add-tracker button repositioned by drag.", { left: rect.left, top: rect.top });
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
        logger4.log("hud", "Add-tracker button position reset to the default (avatar-relative) spot.");
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
      if (isSpectating() && !settings3.allowFavoritedRetainedWhileSpectating.value()) return;
      const favoritedIds = getFavoritedPresetIds();
      const spawnedFavorites = favoritedIds.filter((id) => spawnPreset(id) !== null);
      if (spawnedFavorites.length) {
        logger4.log("autoload", "Spawned favorited presets.", spawnedFavorites);
      }
      if (spawnedFavorites.length < favoritedIds.length) {
        logger4.warn(
          "autoload",
          "Some favorited presets could not be spawned (missing definition).",
          favoritedIds.filter((id) => !spawnedFavorites.includes(id))
        );
      }
      if (settings3.retainUnclosedPresets.value()) {
        const retainedIds = getRetainedPresetIds().filter((id) => !favoritedIds.includes(id));
        retainedIds.forEach((id) => spawnPreset(id));
        if (retainedIds.length) {
          logger4.log("autoload", "Restored retained (unclosed) presets.", retainedIds);
        }
      }
    }
    plugin.events.on("GameStart", () => {
      if (trackerButton == null ? void 0 : trackerButton.style) trackerButton.style.display = "";
      restoreFavoritedAndRetained();
    });
    plugin.events.on("connect", (data2) => {
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
    const settings3 = createFeatureSettings(plugin, "ucTv", {
      tab: "UC TV",
      visible: () => isPluginEnabled("ucTv")
    });
    const enabled = getPluginToggle("ucTv");
    const debugLogs = debugLoggingSetting;
    const autoMode = settings3.add("autoMode", {
      name: "Enable auto-mode when spectating",
      type: "boolean",
      default: false
    });
    const countdownSeconds = settings3.add("countdownSeconds", {
      name: "Auto-continue delay (seconds)",
      type: "select",
      data: Array.from({ length: 15 }, (_, i) => i + 1).map((n) => [`${n}`, n]),
      default: 5
    });
    const filterDisabled = () => !filteringEnabled.value();
    const filterDependents = [];
    const addFilter = (key2, config) => {
      const setting2 = settings3.add(key2, { ...config, disabled: filterDisabled });
      filterDependents.push(setting2);
      return setting2;
    };
    const filteringEnabled = settings3.add("filteringEnabled", {
      name: "Enable Match Filtering",
      type: "boolean",
      default: true,
      onChange: () => filterDependents.forEach((d) => d.refresh())
    });
    const modeToggles = {};
    KNOWN_MODES.forEach((mode) => {
      modeToggles[mode] = addFilter(`ignoreMode${mode}`, {
        name: `Ignore ${titleCase(mode)} Matches?`,
        type: "select",
        data: [["Yes", "yes"], ["No", "no"]],
        default: "no"
      });
    });
    const minLevel = addFilter("minLevel", {
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
      default: 0
    });
    const levelFilterMode = addFilter("levelFilterMode", {
      name: "Minimum Level Applies To",
      type: "select",
      data: [["Either player", "either"], ["Both players", "both"]],
      default: "either"
    });
    const minRankTier = addFilter("minRankTier", {
      name: "Minimum Ranked Mode Level",
      type: "select",
      data: divisionTiers.map((t) => [titleCase(t.name), t.name]),
      default: "COPPER"
    });
    const rankFilterMode = addFilter("rankFilterMode", {
      name: "Minimum Rank Applies To",
      type: "select",
      data: [["Either player", "either"], ["Both players", "both"]],
      default: "either"
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
    const settings3 = registerUcTvSettings(plugin, DIVISION_TIERS);
    setSettingsRef(settings3);
    if (CONFIG.debugLogs) dumpSettingsState();
    window.__ucTVScope = scopeActiveGames;
    window.__ucTVSettings = dumpSettingsState;
    bindChannelKeybinds(plugin);
    bindChannelGuideKeybinds(plugin);
    logDebug("Channel switching and channel guide keybinds registered (see the Keybinds settings category).");
    if (!isSpectatePage3()) return;
    let handled = false;
    plugin.events.on("getResult", (data2) => {
      logDebug("getResult fired - match ended.", data2);
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
  function registerMiscSettings() {
    return {
      enableNotepad: getPluginToggle("notepad"),
      enableController: getPluginToggle("controller"),
      enableCardTags: getPluginToggle("cardTags"),
      notepadOpenOnLoad: getNotepadOpenOnLoadSetting()
    };
  }

  // packages/misc/notepad/storage.js
  var POSITION_KEY = "wizascript.misc.notepad.position";
  var DRAWING_KEY = "wizascript.misc.notepad.drawing";
  var PEN_COLOR_KEY = "wizascript.misc.notepad.penColor";
  var RECENT_COLORS_KEY = "wizascript.misc.notepad.recentColors";
  var TITLE_KEY = "wizascript.misc.notepad.title";
  function readJSON(key2, fallback) {
    try {
      const raw = GM_getValue(key2, null);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn("[Notepad] Failed to read storage key", key2, e);
      return fallback;
    }
  }
  function writeJSON(key2, value) {
    try {
      GM_setValue(key2, JSON.stringify(value));
    } catch (e) {
      console.warn("[Notepad] Failed to write storage key", key2, e);
    }
  }
  function getSavedPosition2() {
    return readJSON(POSITION_KEY, null);
  }
  function setSavedPosition2(layout2) {
    writeJSON(POSITION_KEY, layout2);
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
  function setSavedPenColor(state2) {
    writeJSON(PEN_COLOR_KEY, state2);
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
  function floodFillPixels(data2, width, height, startX, startY, fillRgb, tolerance = 24) {
    const x0 = Math.floor(startX);
    const y0 = Math.floor(startY);
    if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return false;
    const idx = (x, y) => (y * width + x) * 4;
    const startI = idx(x0, y0);
    const startR = data2[startI], startG = data2[startI + 1], startB = data2[startI + 2], startA = data2[startI + 3];
    const [fr, fg, fb] = fillRgb;
    const fa = 255;
    if (startR === fr && startG === fg && startB === fb && startA === fa) return false;
    function matchesStart(i) {
      return Math.abs(data2[i] - startR) <= tolerance && Math.abs(data2[i + 1] - startG) <= tolerance && Math.abs(data2[i + 2] - startB) <= tolerance && Math.abs(data2[i + 3] - startA) <= tolerance;
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
      data2[i] = fr;
      data2[i + 1] = fg;
      data2[i + 2] = fb;
      data2[i + 3] = fa;
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
      const alpha = data2[i + 3];
      if (alpha <= 0 || alpha >= 255) return;
      data2[i] = fr;
      data2[i + 1] = fg;
      data2[i + 2] = fb;
      data2[i + 3] = fa;
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
    let saveTimer2 = null;
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
      scheduleSave2();
      notifyLayersChange();
      return true;
    }
    function removeLayer() {
      if (layers.length <= 1) return false;
      const removed = layers.pop();
      removed.canvas.remove();
      if (activeLayerIndex > layers.length) activeLayerIndex = layers.length;
      scheduleSave2();
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
    function scheduleSave2() {
      clearTimeout(saveTimer2);
      saveTimer2 = setTimeout(() => {
        setSavedDrawing(snapshotState());
      }, SAVE_DEBOUNCE_MS);
    }
    function loadLayerContent(ctx, dataUrl) {
      return new Promise((resolve2) => {
        if (!dataUrl) {
          resolve2();
          return;
        }
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          resolve2();
        };
        img.onerror = () => {
          console.warn("[Notepad] A saved layer failed to load - leaving it blank.");
          resolve2();
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
    let undoStack2 = [];
    let redoStack = [];
    let onHistoryChange = null;
    let restoreGeneration = 0;
    function notifyHistoryChange() {
      if (onHistoryChange) onHistoryChange(undoStack2.length > 0, redoStack.length > 0);
    }
    async function restoreState(state2) {
      const myGeneration = ++restoreGeneration;
      paintBackground(state2.backgroundColor);
      while (layers.length < state2.layers.length) addLayerInternal();
      while (layers.length > state2.layers.length) {
        const removed = layers.pop();
        removed.canvas.remove();
      }
      if (activeLayerIndex > layers.length) activeLayerIndex = layers.length || 1;
      layers.forEach((l) => l.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT));
      await Promise.all(layers.map((l, i) => loadLayerContent(l.ctx, state2.layers[i])));
      if (myGeneration !== restoreGeneration) return;
      scheduleSave2();
      notifyLayersChange();
    }
    function pushUndoSnapshot() {
      undoStack2.push(snapshotState());
      if (undoStack2.length > MAX_HISTORY) undoStack2.shift();
      redoStack = [];
      notifyHistoryChange();
    }
    function undo2() {
      if (!undoStack2.length) return false;
      const current = snapshotState();
      const previous = undoStack2.pop();
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
      undoStack2.push(current);
      if (undoStack2.length > MAX_HISTORY) undoStack2.shift();
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
      undoStack2 = [];
      redoStack = [];
      clearTimeout(saveTimer2);
      clearSavedDrawing();
      notifyLayersChange();
      notifyHistoryChange();
    }
    function clear() {
      pushUndoSnapshot();
      activeCtx().clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      scheduleSave2();
    }
    function setBackgroundColor(color) {
      if (color === backgroundColor) return;
      pushUndoSnapshot();
      paintBackground(color);
      scheduleSave2();
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
      scheduleSave2();
    }
    function fill(x, y) {
      pushUndoSnapshot();
      const ctx = activeCtx();
      const fillRgb = resolveColorToRgb(strokeColor);
      const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      const changed = floodFillPixels(imageData.data, CANVAS_WIDTH, CANVAS_HEIGHT, x, y, fillRgb);
      if (!changed) {
        undoStack2.pop();
        notifyHistoryChange();
        return;
      }
      ctx.putImageData(imageData, 0, 0);
      scheduleSave2();
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
      undo: undo2,
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
    const data2 = imageData.data;
    for (let y = 0; y < WHEEL_SIZE; y++) {
      for (let x = 0; x < WHEEL_SIZE; x++) {
        const dx = x - WHEEL_RADIUS;
        const dy = y - WHEEL_RADIUS;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const idx = (y * WHEEL_SIZE + x) * 4;
        if (dist > WHEEL_RADIUS) {
          data2[idx + 3] = 0;
          continue;
        }
        let angle = Math.atan2(dy, dx) * 180 / Math.PI;
        if (angle < 0) angle += 360;
        const saturation = Math.min(1, dist / WHEEL_RADIUS);
        const [r, g, b] = hslToRgbString(angle, saturation, WHEEL_FIXED_LIGHTNESS).match(/\d+/g).map(Number);
        data2[idx] = r;
        data2[idx + 1] = g;
        data2[idx + 2] = b;
        data2[idx + 3] = 255;
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
      notify2();
    }
    function notify2() {
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
      notify2();
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
      notify2();
    }, { signal });
    updateIndicatorPosition();
    notify2();
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
    injectStyle2();
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
    surface.setOnHistoryChange((canUndo2, canRedo) => {
      undoBtn.classList.toggle("wizascript-notepad-history-btn-disabled", !canUndo2);
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
  function isNotepadOpen() {
    return !!mounted;
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
  function injectStyle2() {
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

  // packages/misc/card-tags/constants.js
  var CARD_LIST_SELECTOR = ".cardsList, .cardSkinList, #loadDeckCards";

  // packages/misc/card-tags/storage.js
  var DATA_KEY = "wizascript.misc.cardTags.data";
  var DEFAULT_COLORS = ["#4dabf7", "#51cf66", "#ffa94d", "#ff6b6b", "#cc5de8", "#20c997", "#ffd43b"];
  function genTagId() {
    return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function emptyData() {
    return { tags: [], cardTags: {} };
  }
  function readData() {
    let raw;
    try {
      raw = GM_getValue(DATA_KEY, null);
    } catch (e) {
      console.warn("[CardTags] Failed to read storage key", DATA_KEY, e);
      return emptyData();
    }
    if (!raw) return emptyData();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.warn("[CardTags] Failed to parse stored data, starting fresh.", e);
      return emptyData();
    }
    if (Array.isArray(parsed.tags) && parsed.tags.length && typeof parsed.tags[0] === "string") {
      const nameToId = {};
      const upgradedTags = parsed.tags.map((name, i) => {
        const id = genTagId();
        nameToId[name] = id;
        return { id, name, color: DEFAULT_COLORS[i % DEFAULT_COLORS.length] };
      });
      const upgradedCardTags = {};
      Object.keys(parsed.cardTags || {}).forEach((cardId) => {
        const ids = (parsed.cardTags[cardId] || []).map((name) => nameToId[name]).filter(Boolean);
        if (ids.length) upgradedCardTags[cardId] = ids;
      });
      const upgraded = { tags: upgradedTags, cardTags: upgradedCardTags };
      writeData(upgraded);
      return upgraded;
    }
    return {
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      cardTags: parsed.cardTags && typeof parsed.cardTags === "object" ? parsed.cardTags : {}
    };
  }
  function writeData(value) {
    try {
      GM_setValue(DATA_KEY, JSON.stringify(value));
    } catch (e) {
      console.warn("[CardTags] Failed to write storage key", DATA_KEY, e);
    }
  }
  var data = readData();
  function allTags() {
    return data.tags;
  }
  function findTag(id) {
    return data.tags.find((t) => t.id === id) || null;
  }
  function createTag(name, color) {
    const tag = {
      id: genTagId(),
      name: name.trim(),
      color: color || DEFAULT_COLORS[data.tags.length % DEFAULT_COLORS.length]
    };
    data.tags.push(tag);
    writeData(data);
    return tag;
  }
  function updateTag(id, patch) {
    const tag = findTag(id);
    if (!tag) return;
    Object.assign(tag, patch);
    writeData(data);
  }
  function deleteTag(id) {
    data.tags = data.tags.filter((t) => t.id !== id);
    Object.keys(data.cardTags).forEach((cardId) => {
      data.cardTags[cardId] = data.cardTags[cardId].filter((tagId) => tagId !== id);
      if (!data.cardTags[cardId].length) delete data.cardTags[cardId];
    });
    writeData(data);
  }
  function tagIdsForCard(cardId) {
    return data.cardTags[cardId] || [];
  }
  function tagObjectsForCard(cardId) {
    return tagIdsForCard(cardId).map(findTag).filter(Boolean);
  }
  function cardHasTag(cardId, tagId) {
    return tagIdsForCard(cardId).includes(tagId);
  }
  function toggleCardTag(cardId, tagId) {
    const current = data.cardTags[cardId] || [];
    const has = current.includes(tagId);
    const next = has ? current.filter((t) => t !== tagId) : [...current, tagId];
    if (next.length) {
      data.cardTags[cardId] = next;
    } else {
      delete data.cardTags[cardId];
    }
    writeData(data);
  }
  function taggedCardIds() {
    return Object.keys(data.cardTags);
  }
  function exportTags(tagIds) {
    const wanted = new Set(tagIds);
    return {
      format: 1,
      tags: data.tags.filter((t) => wanted.has(t.id)).map((t) => ({
        name: t.name,
        color: t.color,
        cards: Object.keys(data.cardTags).filter((cardId) => data.cardTags[cardId].includes(t.id))
      }))
    };
  }
  function importTags(shared) {
    if (!shared || shared.format !== 1 || !Array.isArray(shared.tags)) {
      throw new Error("That code isn't a Card Tags code this version understands.");
    }
    const summary = { created: [], merged: [], cardsTagged: 0 };
    shared.tags.forEach((st) => {
      const name = String(st && st.name || "").trim();
      if (!name) return;
      let tag = data.tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
      if (tag) {
        summary.merged.push(tag.name);
      } else {
        const color = /^#[0-9a-f]{3,8}$/i.test(st.color || "") ? st.color : DEFAULT_COLORS[data.tags.length % DEFAULT_COLORS.length];
        tag = { id: genTagId(), name, color };
        data.tags.push(tag);
        summary.created.push(name);
      }
      (Array.isArray(st.cards) ? st.cards : []).forEach((rawId) => {
        const cardId = String(rawId);
        if (!/^[\w-]{1,32}$/.test(cardId)) return;
        const current = data.cardTags[cardId] || [];
        if (current.includes(tag.id)) return;
        data.cardTags[cardId] = [...current, tag.id];
        summary.cardsTagged++;
      });
    });
    writeData(data);
    return summary;
  }

  // packages/misc/card-tags/indicators.js
  var INDICATOR_ATTR = "data-wiza-tag-dot";
  var rarityAnchorWarned = false;
  var logger = null;
  function findRarityAnchor(cardEl) {
    return cardEl.querySelector(".cardRarity");
  }
  function fillDots(holder, tags) {
    holder.innerHTML = "";
    holder.title = tags.map((t) => t.name).join(", ");
    tags.forEach((t) => {
      const dot = document.createElement("span");
      dot.style.cssText = "width:8px;height:8px;border-radius:50%;background:" + (t.color || DEFAULT_COLORS[0]) + ";border:1px solid rgba(0,0,0,0.4);";
      holder.appendChild(dot);
    });
  }
  function makeFlankHolder(side) {
    const holder = document.createElement("div");
    holder.setAttribute(INDICATOR_ATTR, side);
    Object.assign(holder.style, { position: "absolute", zIndex: "50", display: "flex", gap: "2px", pointerEvents: "none" });
    return holder;
  }
  function positionFlank(cardEl, anchorEl, holder, side) {
    const cardRect = cardEl.getBoundingClientRect();
    const anchorRect = anchorEl.getBoundingClientRect();
    const gap = 3;
    holder.style.top = anchorRect.top - cardRect.top + anchorRect.height / 2 + "px";
    if (side === "left") {
      holder.style.left = anchorRect.left - cardRect.left - gap + "px";
      holder.style.transform = "translate(-100%, -50%)";
    } else {
      holder.style.left = anchorRect.right - cardRect.left + gap + "px";
      holder.style.transform = "translate(0, -50%)";
    }
  }
  function decorateCorner(el2, tags) {
    const existing = el2.querySelector(":scope > [" + INDICATOR_ATTR + '="corner"]');
    if (getComputedStyle(el2).position === "static") el2.style.position = "relative";
    const holder = existing || document.createElement("div");
    if (!existing) {
      holder.setAttribute(INDICATOR_ATTR, "corner");
      Object.assign(holder.style, { position: "absolute", top: "2px", right: "2px", zIndex: "50", display: "flex", gap: "2px", pointerEvents: "none" });
      el2.appendChild(holder);
    }
    fillDots(holder, tags.slice(0, 4));
  }
  function decorateOneCardElement(el2, tags) {
    const leftExisting = el2.querySelector(":scope > [" + INDICATOR_ATTR + '="left"]');
    const rightExisting = el2.querySelector(":scope > [" + INDICATOR_ATTR + '="right"]');
    const cornerExisting = el2.querySelector(":scope > [" + INDICATOR_ATTR + '="corner"]');
    if (!tags.length) {
      [leftExisting, rightExisting, cornerExisting].forEach((h) => h && h.remove());
      return;
    }
    const anchor = findRarityAnchor(el2);
    if (!anchor) {
      if (!rarityAnchorWarned) {
        rarityAnchorWarned = true;
        logger == null ? void 0 : logger.warn(null, "A card element has no .cardRarity element - falling back to a corner dot for it.");
      }
      if (leftExisting) leftExisting.remove();
      if (rightExisting) rightExisting.remove();
      decorateCorner(el2, tags);
      return;
    }
    if (cornerExisting) cornerExisting.remove();
    if (getComputedStyle(el2).position === "static") el2.style.position = "relative";
    const leftTags = tags.slice(0, 2);
    const rightTags = tags.slice(2, 4);
    const leftHolder = leftExisting || makeFlankHolder("left");
    const rightHolder = rightExisting || makeFlankHolder("right");
    if (!leftExisting) el2.appendChild(leftHolder);
    if (!rightExisting) el2.appendChild(rightHolder);
    fillDots(leftHolder, leftTags);
    fillDots(rightHolder, rightTags);
    leftHolder.style.display = leftTags.length ? "flex" : "none";
    rightHolder.style.display = rightTags.length ? "flex" : "none";
    positionFlank(el2, anchor, leftHolder, "left");
    positionFlank(el2, anchor, rightHolder, "right");
  }
  function decorateCard(cardId) {
    const els = Array.from(document.getElementsByClassName("card-" + cardId));
    if (!els.length) return;
    const tags = tagObjectsForCard(cardId);
    els.forEach((el2) => decorateOneCardElement(el2, tags));
  }
  function decorateAllCards() {
    taggedCardIds().forEach(decorateCard);
  }
  function initIndicators(loggerInstance) {
    logger = loggerInstance;
    let scheduled = false;
    function schedule() {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        decorateAllCards();
      }, 100);
    }
    const containers = document.querySelectorAll(CARD_LIST_SELECTOR);
    const observer2 = new MutationObserver(schedule);
    if (containers.length) {
      containers.forEach((c) => observer2.observe(c, { childList: true, subtree: true, attributes: true, attributeFilter: ["id"] }));
    } else {
      observer2.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["id"] });
    }
    schedule();
  }

  // packages/misc/card-tags/share.js
  var KIND2 = "TAGS";
  function countCards(tagId) {
    return exportTags([tagId]).tags[0].cards.length;
  }
  function openShareTagsDialog() {
    const BootstrapDialog2 = getPageWindow().BootstrapDialog;
    if (!BootstrapDialog2 || typeof BootstrapDialog2.show !== "function") return;
    const tags = allTags();
    if (!tags.length) {
      showInfoDialog({ title: "Share Tags", message: "You don't have any tags to share yet." });
      return;
    }
    const wrapper = document.createElement("div");
    const intro = document.createElement("p");
    intro.textContent = "Pick the tags to share. The code includes which cards each tag is on.";
    wrapper.appendChild(intro);
    const list = document.createElement("div");
    list.style.cssText = "max-height:260px;overflow-y:auto;";
    const boxes = tags.map((tag) => {
      const row = document.createElement("label");
      row.style.cssText = "display:flex;align-items:center;gap:8px;padding:4px 0;font-weight:normal;cursor:pointer;";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = true;
      const dot = document.createElement("span");
      dot.style.cssText = `width:10px;height:10px;border-radius:50%;flex-shrink:0;background:${tag.color};`;
      const text = document.createElement("span");
      const n = countCards(tag.id);
      text.textContent = `${tag.name} (${n} card${n === 1 ? "" : "s"})`;
      row.append(box, dot, text);
      list.appendChild(row);
      return { tag, box };
    });
    wrapper.appendChild(list);
    const status = document.createElement("div");
    status.style.cssText = "margin-top:4px;min-height:1.2em;color:#f66;";
    wrapper.appendChild(status);
    BootstrapDialog2.show({
      title: "Share Tags",
      message: wrapper,
      cssClass: "mono",
      buttons: [
        {
          label: "Create code",
          cssClass: "btn-primary",
          action: async (d) => {
            const ids = boxes.filter((b) => b.box.checked).map((b) => b.tag.id);
            if (!ids.length) {
              status.textContent = "Tick at least one tag.";
              return;
            }
            const payload = exportTags(ids);
            const code = await encodeCode(KIND2, payload);
            d.close();
            const names = payload.tags.map((t) => t.name).join(", ");
            showExportDialog({
              title: "Share Tags",
              intro: `Send this code to anyone with Wizascript. They can add these tags (${names}) with "Import\u2026" in their own Manage Tags.`,
              code,
              fileName: "wizascript-card-tags.txt"
            });
          }
        },
        { label: "Cancel", action: (d) => d.close() }
      ]
    });
  }
  function listNames(names) {
    return names.length > 4 ? `${names.slice(0, 4).join(", ")} and ${names.length - 4} more` : names.join(", ");
  }
  function openImportTagsDialog(onImported) {
    showImportDialog({
      title: "Import Tags",
      intro: "Paste a Card Tags code from a friend. Tags with the same name as one of yours are combined (keeping your colour); nothing of yours is removed.",
      actionLabel: "Import",
      onSubmit: async (text) => {
        const shared = await decodeCode(text, KIND2);
        const result = importTags(shared);
        if (onImported) onImported();
        const lines = [];
        if (result.created.length) lines.push(`New tags: ${listNames(result.created)}.`);
        if (result.merged.length) lines.push(`Added to your existing tags: ${listNames(result.merged)}.`);
        lines.push(result.cardsTagged ? `${result.cardsTagged} card tag${result.cardsTagged === 1 ? "" : "s"} added.` : "You already had every card in this code tagged.");
        setTimeout(() => showInfoDialog({ title: "Tags imported", message: lines }), 0);
      }
    });
  }

  // packages/misc/card-tags/menu.js
  var logger2 = null;
  function setMenuLogger(instance) {
    logger2 = instance;
  }
  var openMenuEl = null;
  var outsideClick = null;
  var outsideContext = null;
  function maybeRefreshSearch() {
    const searchEl = document.getElementById("searchInput");
    if (searchEl && searchEl.value.trim()) refreshSearch();
  }
  function refreshSearch() {
    const pageWindow2 = getPageWindow();
    try {
      if (typeof pageWindow2.applyFilters === "function") pageWindow2.applyFilters();
      if (typeof pageWindow2.showPage === "function") pageWindow2.showPage(pageWindow2.currentPage);
      decorateAllCards();
    } catch (e) {
      logger2 == null ? void 0 : logger2.warn(null, "applyFilters()/showPage() call failed.", e);
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
  function openTagMenu(card, cards2, x, y) {
    closeTagMenu();
    const menu = document.createElement("div");
    menu.className = "wiza-tag-menu";
    Object.assign(menu.style, {
      position: "fixed",
      left: x + "px",
      top: y + "px",
      zIndex: 999999,
      background: "#1b1b1f",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: "8px",
      minWidth: "200px",
      maxWidth: "260px",
      boxShadow: "0 4px 18px rgba(0,0,0,0.5)",
      overflow: "hidden",
      fontFamily: "inherit",
      fontSize: "13px",
      color: "#eee"
    });
    const filterInput = document.createElement("input");
    filterInput.type = "text";
    filterInput.placeholder = "Filter tags\u2026";
    Object.assign(filterInput.style, {
      width: "100%",
      boxSizing: "border-box",
      padding: "7px 10px",
      border: "none",
      borderBottom: "1px solid rgba(255,255,255,0.15)",
      background: "transparent",
      color: "#eee",
      outline: "none",
      fontSize: "13px"
    });
    menu.appendChild(filterInput);
    const rowsWrap = document.createElement("div");
    Object.assign(rowsWrap.style, { maxHeight: "220px", overflowY: "auto" });
    function makeRow({ label, onClick, active, secondary, swatch }) {
      const row = document.createElement("div");
      Object.assign(row.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        cursor: "pointer",
        gap: "8px",
        background: active ? "rgba(120,170,255,0.18)" : "transparent",
        borderBottom: "1px solid rgba(255,255,255,0.08)"
      });
      row.addEventListener("mouseenter", () => {
        if (!active) row.style.background = "rgba(255,255,255,0.08)";
      });
      row.addEventListener("mouseleave", () => {
        row.style.background = active ? "rgba(120,170,255,0.18)" : "transparent";
      });
      const left = document.createElement("span");
      left.style.cssText = "display:flex;align-items:center;gap:8px;overflow:hidden;flex:1;";
      if (swatch) {
        const dot = document.createElement("span");
        dot.style.cssText = "width:10px;height:10px;border-radius:50%;background:" + swatch + ";flex-shrink:0;";
        left.appendChild(dot);
      }
      const text = document.createElement("span");
      text.textContent = (active ? "\u2713 " : "") + label;
      text.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
      left.appendChild(text);
      row.appendChild(left);
      if (secondary) {
        const secBtn = document.createElement("span");
        secBtn.textContent = secondary.label;
        secBtn.title = secondary.title || "";
        secBtn.style.cssText = "color:#9ab;flex-shrink:0;padding:2px 4px;";
        secBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          secondary.onClick();
        });
        row.appendChild(secBtn);
      }
      row.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onClick();
      });
      return row;
    }
    function renderRows(filterTerm) {
      rowsWrap.innerHTML = "";
      const term = (filterTerm || "").trim().toLowerCase();
      const tags = allTags().filter((t) => !term || t.name.toLowerCase().includes(term));
      if (!tags.length) {
        const empty = document.createElement("div");
        empty.style.cssText = "padding:10px 12px;color:#999;";
        empty.textContent = allTags().length ? "No matching tags." : "No tags yet.";
        rowsWrap.appendChild(empty);
        return;
      }
      tags.forEach((tag) => {
        rowsWrap.appendChild(makeRow({
          label: tag.name,
          swatch: tag.color,
          active: cardHasTag(card.id, tag.id),
          onClick: () => {
            toggleCardTag(card.id, tag.id);
            decorateCard(card.id);
            renderRows(filterInput.value);
          },
          secondary: {
            label: "\u{1F441}",
            title: 'See cards tagged "' + tag.name + '"',
            onClick: () => showCardsForTag(tag, cards2)
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
    const newTagRow = makeRow({ label: "+ New Tag", onClick: () => {
      closeTagMenu();
      promptNewTag(card, cards2, x, y);
    } });
    newTagRow.style.color = "#8f8";
    menu.appendChild(newTagRow);
    const manageRow = makeRow({ label: "Manage Tags\u2026", onClick: () => {
      closeTagMenu();
      openManageTagsDialog();
    } });
    manageRow.style.color = "#9ab";
    menu.appendChild(manageRow);
    menu.addEventListener("click", (ev) => ev.stopPropagation());
    document.body.appendChild(menu);
    openMenuEl = menu;
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = Math.max(0, window.innerWidth - rect.width - 8) + "px";
    if (rect.bottom > window.innerHeight) menu.style.top = Math.max(0, window.innerHeight - rect.height - 8) + "px";
    filterInput.focus();
    const openedAt = performance.now();
    function outsideCloser(e) {
      if (performance.now() - openedAt < 200) return;
      if (menu.contains(e.target)) return;
      closeTagMenu();
    }
    outsideClick = outsideCloser;
    outsideContext = outsideCloser;
    document.addEventListener("click", outsideClick);
    document.addEventListener("contextmenu", outsideContext);
  }
  function promptNewTag(card, cards2, reopenX, reopenY) {
    const pageWindow2 = getPageWindow();
    const BootstrapDialog2 = pageWindow2.BootstrapDialog;
    if (typeof BootstrapDialog2 === "undefined" || typeof BootstrapDialog2.show !== "function") {
      logger2 == null ? void 0 : logger2.warn(null, "BootstrapDialog is not available - cannot open the new-tag dialog.");
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
    input.placeholder = "Tag name\u2026";
    input.className = "form-control";
    input.style.cssText = "flex:1;padding:6px 8px;font-size:13px;";
    wrapper.appendChild(input);
    BootstrapDialog2.show({
      title: "New tag",
      message: wrapper,
      cssClass: "mono",
      buttons: [
        { label: "Cancel", action: (d) => d.close() },
        {
          label: "Create",
          cssClass: "btn-success",
          action: (d) => {
            const name = input.value.trim();
            if (!name) return;
            const tag = createTag(name, colorInput.value);
            toggleCardTag(card.id, tag.id);
            decorateCard(card.id);
            d.close();
            openTagMenu(card, cards2, reopenX, reopenY);
          }
        }
      ]
    });
    setTimeout(() => input.focus(), 100);
  }
  function openManageTagsDialog() {
    const pageWindow2 = getPageWindow();
    const BootstrapDialog2 = pageWindow2.BootstrapDialog;
    if (typeof BootstrapDialog2 === "undefined" || typeof BootstrapDialog2.show !== "function") {
      logger2 == null ? void 0 : logger2.warn(null, "BootstrapDialog is not available - cannot open tag management.");
      return;
    }
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "min-width:280px;max-height:320px;overflow-y:auto;";
    function renderList2() {
      wrapper.innerHTML = "";
      if (!allTags().length) {
        const empty = document.createElement("div");
        empty.style.cssText = "color:#999;padding:6px 0;";
        empty.textContent = "No tags yet.";
        wrapper.appendChild(empty);
        return;
      }
      allTags().forEach((tag) => {
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
          if (v) updateTag(tag.id, { name: v });
          else nameInput.value = tag.name;
          decorateAllCards();
        });
        row.appendChild(nameInput);
        const delBtn = document.createElement("div");
        delBtn.textContent = "-";
        delBtn.title = "Double-click to delete (removes from every tagged card)";
        delBtn.style.cssText = "width:26px;height:26px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:rgba(220,53,69,0.15);color:#e05260;border:1px solid rgba(220,53,69,0.5);border-radius:4px;font-weight:700;font-size:16px;line-height:1;cursor:pointer;user-select:none;";
        delBtn.addEventListener("mouseenter", () => {
          delBtn.style.background = "rgba(220,53,69,0.3)";
        });
        delBtn.addEventListener("mouseleave", () => {
          delBtn.style.background = "rgba(220,53,69,0.15)";
        });
        delBtn.addEventListener("click", (e) => {
          if (e.detail !== 2) return;
          deleteTag(tag.id);
          decorateAllCards();
          renderList2();
        });
        row.appendChild(delBtn);
        wrapper.appendChild(row);
      });
    }
    renderList2();
    BootstrapDialog2.show({
      title: "Manage Tags",
      message: wrapper,
      cssClass: "mono",
      buttons: [
        { label: "Share\u2026", action: () => openShareTagsDialog() },
        { label: "Import\u2026", action: () => openImportTagsDialog(() => {
          decorateAllCards();
          renderList2();
        }) },
        { label: "Close", action: (d) => {
          d.close();
          maybeRefreshSearch();
        } }
      ]
    });
  }
  function showCardsForTag(tag, cards2) {
    const pageWindow2 = getPageWindow();
    const BootstrapDialog2 = pageWindow2.BootstrapDialog;
    const matches = cards2.filter((c) => c && c.id != null && cardHasTag(c.id, tag.id));
    const listText = matches.length ? matches.map((c) => c.name).join(", ") : '(nothing tagged "' + tag.name + '" yet)';
    if (typeof BootstrapDialog2 === "undefined" || typeof BootstrapDialog2.show !== "function") {
      alert('Cards tagged "' + tag.name + '": ' + listText);
      return;
    }
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "max-height:260px;overflow-y:auto;";
    wrapper.textContent = listText;
    BootstrapDialog2.show({
      title: 'Tagged "' + tag.name + '" (' + matches.length + ")",
      message: wrapper,
      cssClass: "mono",
      buttons: [{ label: "Close", action: (d) => d.close() }]
    });
  }

  // packages/misc/card-tags/right-click.js
  function getCardById2(cards2, id) {
    return cards2.find((c) => c && String(c.id) === String(id)) || null;
  }
  function wireRightClick(cards2) {
    document.addEventListener("contextmenu", function(e) {
      const container = e.target.closest(CARD_LIST_SELECTOR);
      if (!container) return;
      if (e.defaultPrevented) return;
      const cardEl = e.target.closest(".card");
      const card = cardEl && cardEl.id ? getCardById2(cards2, cardEl.id) : null;
      if (!card) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      openTagMenu(card, cards2, e.clientX, e.clientY);
    });
  }

  // packages/misc/card-tags/search-filter.js
  function wireSearchFilter(plugin, logger4) {
    if (typeof plugin.addFilter !== "function") {
      logger4.warn(null, "plugin.addFilter is not available - Card Tags search integration disabled.");
      return;
    }
    plugin.addFilter(function cardTagsFilter(card, removed, results) {
      if (!removed || !results || !results.search) return removed;
      if (!card || card.id == null) return removed;
      const searchEl = document.getElementById("searchInput");
      const term = searchEl ? searchEl.value.trim().toLowerCase() : "";
      if (!term) return removed;
      const tags = tagObjectsForCard(card.id);
      if (!tags.length) return removed;
      const matched = tags.some((t) => t.name.toLowerCase().includes(term));
      return matched ? false : removed;
    });
  }

  // packages/misc/card-tags/index.js
  var logger3 = createLogger("CardTags");
  function isCardTagsPage() {
    return matchesPage(["/Crafting", "/Decks"]);
  }
  function waitForCards(callback, attempt = 0) {
    const cards2 = getAllCards();
    if (cards2.length) {
      callback(cards2);
      return;
    }
    if (attempt > 80) {
      logger3.warn(null, "Never found a populated card list after ~20s - Card Tags will not activate on this page load.");
      return;
    }
    setTimeout(() => waitForCards(callback, attempt + 1), 250);
  }
  function initCardTags(plugin, enableCardTagsSetting) {
    if (!enableCardTagsSetting.value()) return;
    if (!isCardTagsPage()) return;
    setMenuLogger(logger3);
    waitForCards((cards2) => {
      wireSearchFilter(plugin, logger3);
      wireRightClick(cards2);
      initIndicators(logger3);
      decorateAllCards();
    });
  }

  // packages/misc/tier-list/styles.js
  var STYLE_ID = "wizascript-tierlist-style";
  var Z_WINDOW = 2147482e3;
  var Z_FLOATING = 2147483100;
  function injectTierListStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }
  var CSS = `
.wz-tl {
  --wz-tl-tile: 72px;
  --wz-tl-tile-h: calc(var(--wz-tl-tile) * 0.8);
  --wz-tl-label: max(56px, var(--wz-tl-tile));
  position: fixed;
  z-index: ${Z_WINDOW};
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: #0d0d0d;
  color: #fff;
  border: 2px solid #fff;
  border-radius: 4px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.7);
  font-family: Arial, sans-serif;
  font-size: 12px;
  user-select: none;
}
.wz-tl *, .wz-tl *::before, .wz-tl *::after { box-sizing: border-box; }
.wz-tl.wz-tl-max { left: 0 !important; top: 0 !important; width: 100vw !important; height: 100vh !important; border-radius: 0; }
.wz-tl.wz-tl-max .wz-tl-resize { display: none; }

.wz-tl-header {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  background: #222;
  border-bottom: 1px solid #555;
  cursor: grab;
  touch-action: none;
}
.wz-tl.wz-tl-max .wz-tl-header { cursor: default; }
.wz-tl-grip { flex: 1 1 auto; min-width: 16px; align-self: stretch; }
.wz-tl-title {
  flex: 0 1 220px;
  min-width: 60px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  color: #fff;
  font: bold 13px Arial, sans-serif;
  padding: 2px 4px;
  outline: none;
  text-overflow: ellipsis;
}
.wz-tl-title:hover, .wz-tl-title:focus { border-color: #666; background: rgba(255,255,255,0.06); }
.wz-tl-btn {
  flex: none;
  padding: 2px 7px;
  border: 1px solid #777;
  border-radius: 3px;
  background: #333;
  color: #fff;
  font: 12px Arial, sans-serif;
  line-height: 16px;
  cursor: pointer;
  white-space: nowrap;
}
.wz-tl-btn:hover { background: #444; border-color: #aaa; }
.wz-tl-btn:disabled { opacity: 0.35; cursor: default; background: #333; border-color: #777; }
.wz-tl-btn.wz-tl-active { background: #4464bd; border-color: #8ea6e8; }
.wz-tl-btn.wz-tl-danger { background: #8b1e1e; border-color: #e05555; }

.wz-tl-body { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; position: relative; overflow: hidden; }

.wz-tl-tiers { flex: 1 1 0; min-height: 0; overflow-y: auto; overflow-x: hidden; }
.wz-tl-row { display: flex; align-items: stretch; border-bottom: 1px solid #000; background: #1a1a1a; }
.wz-tl-row-label {
  flex: none;
  width: var(--wz-tl-label);
  min-height: calc(var(--wz-tl-tile-h) + 6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  color: #000;
  font-weight: bold;
  font-size: max(12px, calc(var(--wz-tl-tile) * 0.22));
  text-align: center;
  word-break: break-word;
  cursor: pointer;
}
.wz-tl-row-items {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 3px;
  padding: 3px;
  min-height: calc(var(--wz-tl-tile-h) + 6px);
}
.wz-tl-row-tools {
  flex: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  padding: 1px 3px;
  background: #000;
}
.wz-tl-row-tools button {
  width: 20px;
  height: 15px;
  padding: 0;
  border: 1px solid #555;
  border-radius: 3px;
  background: #222;
  color: #ddd;
  font-size: 9px;
  line-height: 13px;
  cursor: pointer;
}
.wz-tl-row-tools button:hover { background: #3a3a3a; color: #fff; }
.wz-tl-add-row { display: block; margin: 6px auto; }

.wz-tl-tile {
  position: relative;
  flex: none;
  width: var(--wz-tl-tile);
  height: var(--wz-tl-tile-h);
  border: 2px solid var(--wz-tl-rarity, #888);
  border-radius: 3px;
  background: #000 center / contain no-repeat;
  image-rendering: pixelated;
  cursor: grab;
  touch-action: none;
  overflow: hidden;
}
.wz-tl-tile-name {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  padding: 1px 2px;
  background: rgba(0,0,0,0.72);
  color: #fff;
  font-size: max(9px, calc(var(--wz-tl-tile) * 0.12));
  line-height: 1.15;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}
.wz-tl-tile.wz-tl-noimg .wz-tl-tile-name { top: 0; display: flex; align-items: center; justify-content: center; white-space: normal; }
.wz-tl-tile.wz-tl-placed { opacity: 0.35; }
.wz-tl-tile.wz-tl-placed::after {
  content: "\\2713";
  position: absolute;
  top: 1px; right: 3px;
  color: #7fff7f;
  font-weight: bold;
  font-size: 12px;
  text-shadow: 0 0 2px #000;
}
.wz-tl-tile.wz-tl-dragging { opacity: 0.25; }
.wz-tl-marker {
  flex: none;
  width: 4px;
  height: var(--wz-tl-tile-h);
  border-radius: 2px;
  background: #fff;
  box-shadow: 0 0 6px #8ea6e8;
}
.wz-tl-ghost {
  position: fixed;
  z-index: ${Z_FLOATING};
  pointer-events: none;
  opacity: 0.9;
  transform: rotate(-3deg);
  box-shadow: 0 6px 16px rgba(0,0,0,0.7);
}
.wz-tl-ghost.wz-tl-ghost-remove { opacity: 0.55; filter: grayscale(1); }
.wz-tl-ghost.wz-tl-ghost-remove::before {
  content: "\\00D7";
  position: absolute;
  z-index: 1;
  top: 1px; right: 3px;
  color: #ff6b6b;
  font: bold 16px Arial, sans-serif;
  text-shadow: 0 0 3px #000;
}
.wz-tl-picker.wz-tl-drop-in { background: #1b2238; }

.wz-tl-picker {
  flex: 0 1 auto;
  max-height: 60%;
  transition: background 0.1s;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-top: 2px solid #555;
  background: #141414;
}
.wz-tl-picker.wz-tl-hidden { display: none; }
.wz-tl-filters { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; padding: 5px 6px; }
.wz-tl-search-row { flex: none; display: flex; gap: 4px; }
.wz-tl-search-row input {
  flex: none;
  width: 150px;
  height: 26px;
  padding: 2px 6px;
  border: 1px solid #666;
  border-radius: 3px;
  background: #000;
  color: #fff;
  font: 12px Arial, sans-serif;
}
.wz-tl-card-toggles { display: contents; }
.wz-tl-type-tabs { flex: none; display: flex; border: 1px solid #555; border-radius: 4px; overflow: hidden; }
.wz-tl-type-tab {
  height: 26px;
  padding: 0 7px;
  border: none;
  border-right: 1px solid #555;
  background: #1c1c1c;
  color: #bbb;
  font: 12px Arial, sans-serif;
  cursor: pointer;
}
.wz-tl-type-tab:last-child { border-right: none; }
.wz-tl-type-tab:hover { background: #2a2a2a; color: #fff; }
.wz-tl-type-tab.wz-tl-active { background: #4464bd; color: #fff; }
.wz-tl-tile-del {
  position: absolute;
  z-index: 2;
  top: 1px; left: 1px;
  width: 16px; height: 16px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: rgba(0,0,0,0.75);
  color: #ff8080;
  font: bold 13px/16px Arial, sans-serif;
  cursor: pointer;
}
.wz-tl-tile-del:hover { background: #8b1e1e; color: #fff; }
.wz-tl-tile.wz-tl-text { background: #262626; }
.wz-tl-tile.wz-tl-text .wz-tl-tile-name { background: transparent; font-weight: bold; padding: 2px; line-height: 1.1; word-break: break-word; }
.wz-tl-tile.wz-tl-text .wz-tl-tile-name input {
  width: 100%;
  border: 1px solid #8ea6e8;
  background: #000;
  color: #fff;
  font: inherit;
  text-align: center;
  pointer-events: auto;
}
.wz-tl-toggle-group { flex: none; display: flex; gap: 2px; padding: 1px; border-radius: 4px; background: rgba(255,255,255,0.05); }
.wz-tl-toggle {
  height: 26px;
  min-width: 26px;
  padding: 2px 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
  opacity: 0.45;
  filter: grayscale(0.7);
}
.wz-tl-toggle img { max-height: 20px; max-width: 32px; image-rendering: pixelated; pointer-events: none; }
.wz-tl-toggle:hover { opacity: 0.8; filter: none; }
.wz-tl-toggle.wz-tl-on { opacity: 1; filter: none; border-color: #fff; background: rgba(68,100,189,0.55); }
.wz-tl-toggle-text { color: #fff; font: bold 10px Arial, sans-serif; }
.wz-tl-results { flex: 0 1 auto; height: calc(var(--wz-tl-tile-h) * 2 + 9px); min-height: min(calc(var(--wz-tl-tile-h) + 6px), 40px); overflow-y: auto; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 3px; padding: 0 6px 6px; }
.wz-tl-hint { flex: none; padding: 0 8px 4px; color: #aaa; font-size: 12px; line-height: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.wz-tl-resize { position: absolute; z-index: 2; touch-action: none; }
.wz-tl-resize-n, .wz-tl-resize-s { left: 8px; right: 8px; height: 7px; cursor: ns-resize; }
.wz-tl-resize-n { top: -4px; }
.wz-tl-resize-s { bottom: -4px; }
.wz-tl-resize-e, .wz-tl-resize-w { top: 8px; bottom: 8px; width: 7px; cursor: ew-resize; }
.wz-tl-resize-e { right: -4px; }
.wz-tl-resize-w { left: -4px; }
.wz-tl-resize-ne, .wz-tl-resize-nw, .wz-tl-resize-se, .wz-tl-resize-sw { width: 14px; height: 14px; }
.wz-tl-resize-ne { top: -5px; right: -5px; cursor: nesw-resize; }
.wz-tl-resize-sw { bottom: -5px; left: -5px; cursor: nesw-resize; }
.wz-tl-resize-nw { top: -5px; left: -5px; cursor: nwse-resize; }
.wz-tl-resize-se { bottom: -5px; right: -5px; cursor: nwse-resize; }

.wz-tl-editor {
  position: absolute;
  z-index: 5;
  width: 230px;
  max-width: calc(100% - 12px);
  padding: 8px;
  border: 1px solid #aaa;
  border-radius: 4px;
  background: #1c1c1c;
  box-shadow: 0 4px 14px rgba(0,0,0,0.7);
}
.wz-tl-editor input[type="text"] {
  width: 100%;
  margin-bottom: 6px;
  padding: 3px 5px;
  border: 1px solid #666;
  border-radius: 3px;
  background: #000;
  color: #fff;
  font: 13px Arial, sans-serif;
}
.wz-tl-swatches { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; align-items: center; }
.wz-tl-swatch { width: 20px; height: 20px; border: 1px solid #000; border-radius: 3px; cursor: pointer; }
.wz-tl-swatch.wz-tl-active { box-shadow: 0 0 0 2px #fff; }
.wz-tl-swatches input[type="color"] { width: 24px; height: 22px; padding: 0; border: none; background: none; cursor: pointer; }
.wz-tl-editor-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.wz-tl-editor-buttons .wz-tl-btn { width: 100%; }

.wz-tl-menu {
  position: absolute;
  z-index: 6;
  min-width: 200px;
  max-width: calc(100% - 8px);
  max-height: 60%;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid #aaa;
  border-radius: 4px;
  background: #1c1c1c;
  box-shadow: 0 4px 14px rgba(0,0,0,0.7);
}
.wz-tl-menu-item {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 4px 6px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: #ddd;
  font: 12px Arial, sans-serif;
  text-align: left;
  cursor: pointer;
}
.wz-tl-menu-item span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wz-tl-menu-item:hover { background: #2e2e2e; color: #fff; }
.wz-tl-menu-item.wz-tl-active { background: #4464bd; color: #fff; }
.wz-tl-menu-count { flex: none; opacity: 0.6; }
.wz-tl-menu-actions { display: flex; gap: 4px; margin-top: 4px; padding-top: 4px; border-top: 1px solid #444; }
.wz-tl-preview {
  position: fixed;
  z-index: ${Z_FLOATING};
  pointer-events: none;
}
.wz-tl-preview-fallback {
  width: 200px;
  padding: 4px;
  border: 2px solid #fff;
  border-radius: 4px;
  background: #000;
  color: #fff;
  font: bold 13px Arial, sans-serif;
  text-align: center;
}
.wz-tl-preview-fallback div {
  height: 120px;
  margin-bottom: 4px;
  background: center / contain no-repeat;
  image-rendering: pixelated;
}
`;

  // packages/misc/tier-list/storage.js
  var LISTS_KEY = "wizascript.tierlist.lists";
  var WINDOW_KEY = "wizascript.tierlist.window";
  function readJSON2(key2, fallback) {
    try {
      const raw = GM_getValue(key2, null);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn("[Tier List] Failed to read storage key", key2, e);
      return fallback;
    }
  }
  function writeJSON2(key2, value) {
    try {
      GM_setValue(key2, JSON.stringify(value));
    } catch (e) {
      console.warn("[Tier List] Failed to write storage key", key2, e);
    }
  }
  function loadLists() {
    return readJSON2(LISTS_KEY, null);
  }
  function saveLists(data2) {
    writeJSON2(LISTS_KEY, data2);
  }
  function loadWindowState() {
    return readJSON2(WINDOW_KEY, null);
  }
  function saveWindowState(state2) {
    writeJSON2(WINDOW_KEY, state2);
  }

  // packages/misc/tier-list/model.js
  var DEFAULT_TIERS = [
    ["S", "#ff7f7f"],
    ["A", "#ffbf7f"],
    ["B", "#ffdf7f"],
    ["C", "#ffff7f"],
    ["D", "#bfff7f"]
  ];
  var TIER_COLORS = [
    "#ff7f7f",
    "#ffbf7f",
    "#ffdf7f",
    "#ffff7f",
    "#bfff7f",
    "#7fff7f",
    "#7fffff",
    "#7fbfff",
    "#7f7fff",
    "#ff7fff",
    "#bf7fbf",
    "#cfcfcf"
  ];
  var MAX_UNDO = 50;
  var SAVE_DELAY_MS = 300;
  var MAX_LABEL = 40;
  var MAX_TITLE = 60;
  var MAX_TEXT = 40;
  var MAX_LISTS = 50;
  var DEFAULT_TITLE2 = "My Tier List";
  var state = null;
  var undoStack = [];
  var listeners = /* @__PURE__ */ new Set();
  var saveTimer = null;
  function uid(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function makeTier(label, color) {
    return { id: uid("t"), label, color, items: [] };
  }
  function makeList(title = DEFAULT_TITLE2) {
    return { id: uid("l"), title, texts: {}, tiers: DEFAULT_TIERS.map(([l, c]) => makeTier(l, c)) };
  }
  function sanitize(raw) {
    if (!raw || !Array.isArray(raw.lists) || !raw.lists.length) {
      const list = makeList();
      return { version: 1, active: list.id, lists: [list] };
    }
    const lists = raw.lists.map((l) => ({
      id: typeof l.id === "string" ? l.id : uid("l"),
      title: typeof l.title === "string" ? l.title.slice(0, MAX_TITLE) : DEFAULT_TITLE2,
      texts: Object.fromEntries(Object.entries(l.texts && typeof l.texts === "object" ? l.texts : {}).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, v.slice(0, MAX_TEXT)])),
      tiers: (Array.isArray(l.tiers) ? l.tiers : []).map((t) => ({
        id: typeof t.id === "string" ? t.id : uid("t"),
        label: typeof t.label === "string" ? t.label.slice(0, MAX_LABEL) : "?",
        color: /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : "#cfcfcf",
        items: (Array.isArray(t.items) ? t.items : []).filter((k) => typeof k === "string")
      }))
    }));
    lists.forEach((l) => {
      const seen = /* @__PURE__ */ new Set();
      l.tiers.forEach((t) => {
        t.items = t.items.filter((k) => seen.has(k) ? false : (seen.add(k), true));
      });
    });
    const active = lists.some((l) => l.id === raw.active) ? raw.active : lists[0].id;
    return { version: 1, active, lists };
  }
  function ensureLoaded() {
    if (!state) state = sanitize(loadLists());
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveLists(state), SAVE_DELAY_MS);
  }
  function flushSave() {
    if (!state) return;
    clearTimeout(saveTimer);
    saveLists(state);
  }
  function notify() {
    listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error("[Tier List] listener failed", e);
      }
    });
  }
  function change(mutator) {
    ensureLoaded();
    const before = JSON.stringify(state);
    const result = mutator(activeList());
    if (result === false) return false;
    if (JSON.stringify(state) === before) return false;
    undoStack.push(before);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    scheduleSave();
    notify();
    return true;
  }
  function activeList() {
    return state.lists.find((l) => l.id === state.active) || state.lists[0];
  }
  function findTier(list, tierId) {
    return list.tiers.find((t) => t.id === tierId) || null;
  }
  function removeEverywhere(list, key2) {
    list.tiers.forEach((t) => {
      const i = t.items.indexOf(key2);
      if (i !== -1) t.items.splice(i, 1);
    });
  }
  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
  function getActiveList() {
    ensureLoaded();
    return activeList();
  }
  function isPlaced(key2) {
    return getActiveList().tiers.some((t) => t.items.includes(key2));
  }
  function canUndo() {
    return undoStack.length > 0;
  }
  function getLists() {
    ensureLoaded();
    return state.lists.map((l) => ({
      id: l.id,
      title: l.title,
      count: l.tiers.reduce((n, t) => n + t.items.length, 0),
      active: l.id === state.active
    }));
  }
  function getTextLabel(textId) {
    const t = getActiveList().texts[textId];
    return typeof t === "string" ? t : null;
  }
  function getTextIds() {
    return Object.keys(getActiveList().texts);
  }
  function placeItem(key2, tierId, index) {
    return change((list) => {
      const tier = findTier(list, tierId);
      if (!tier || typeof key2 !== "string") return false;
      removeEverywhere(list, key2);
      const at = Math.max(0, Math.min(typeof index === "number" ? index : tier.items.length, tier.items.length));
      tier.items.splice(at, 0, key2);
    });
  }
  function removeItem(key2) {
    return change((list) => removeEverywhere(list, key2));
  }
  function addTier(atIndex) {
    return change((list) => {
      const used = new Set(list.tiers.map((t) => t.color));
      const color = TIER_COLORS.find((c) => !used.has(c)) || "#cfcfcf";
      const at = typeof atIndex === "number" ? Math.max(0, Math.min(atIndex, list.tiers.length)) : list.tiers.length;
      list.tiers.splice(at, 0, makeTier("New", color));
    });
  }
  function deleteTier(tierId) {
    return change((list) => {
      const i = list.tiers.findIndex((t) => t.id === tierId);
      if (i === -1) return false;
      list.tiers.splice(i, 1);
    });
  }
  function renameTier(tierId, label) {
    return change((list) => {
      const tier = findTier(list, tierId);
      if (!tier) return false;
      tier.label = String(label).slice(0, MAX_LABEL);
    });
  }
  function recolorTier(tierId, color) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return false;
    return change((list) => {
      const tier = findTier(list, tierId);
      if (!tier) return false;
      tier.color = color.toLowerCase();
    });
  }
  function moveTier(tierId, delta) {
    return change((list) => {
      const i = list.tiers.findIndex((t) => t.id === tierId);
      const j = i + delta;
      if (i === -1 || j < 0 || j >= list.tiers.length) return false;
      const [tier] = list.tiers.splice(i, 1);
      list.tiers.splice(j, 0, tier);
    });
  }
  function clearTier(tierId) {
    return change((list) => {
      const tier = findTier(list, tierId);
      if (!tier) return false;
      tier.items = [];
    });
  }
  function setTitle(title) {
    return change((list) => {
      list.title = String(title).trim().slice(0, MAX_TITLE) || DEFAULT_TITLE2;
    });
  }
  function resetList() {
    return change((list) => {
      list.tiers = DEFAULT_TIERS.map(([l, c]) => makeTier(l, c));
    });
  }
  function addText(label) {
    const clean = String(label || "").trim().slice(0, MAX_TEXT);
    if (!clean) return null;
    const id = uid("x");
    const ok = change((list) => {
      list.texts[id] = clean;
    });
    return ok ? `text:${id}` : null;
  }
  function renameText(textId, label) {
    const clean = String(label || "").trim().slice(0, MAX_TEXT);
    if (!clean) return false;
    return change((list) => {
      if (!(textId in list.texts)) return false;
      list.texts[textId] = clean;
    });
  }
  function deleteText(textId) {
    return change((list) => {
      if (!(textId in list.texts)) return false;
      delete list.texts[textId];
      removeEverywhere(list, `text:${textId}`);
    });
  }
  function setActiveList(listId) {
    ensureLoaded();
    if (state.active === listId || !state.lists.some((l) => l.id === listId)) return false;
    state.active = listId;
    undoStack.length = 0;
    scheduleSave();
    notify();
    return true;
  }
  function createList() {
    ensureLoaded();
    if (state.lists.length >= MAX_LISTS) return false;
    const list = makeList(`Tier List ${state.lists.length + 1}`);
    state.lists.push(list);
    return setActiveList(list.id);
  }
  function duplicateList() {
    ensureLoaded();
    if (state.lists.length >= MAX_LISTS) return false;
    const copy = JSON.parse(JSON.stringify(activeList()));
    copy.id = uid("l");
    copy.title = `${copy.title} (copy)`.slice(0, MAX_TITLE);
    copy.tiers.forEach((t) => {
      t.id = uid("t");
    });
    state.lists.push(copy);
    return setActiveList(copy.id);
  }
  function deleteActiveList() {
    ensureLoaded();
    const before = JSON.stringify(state);
    const i = state.lists.findIndex((l) => l.id === state.active);
    state.lists.splice(i, 1);
    if (!state.lists.length) state.lists.push(makeList());
    state.active = state.lists[Math.max(0, i - 1)].id;
    undoStack.length = 0;
    undoStack.push(before);
    scheduleSave();
    notify();
    return true;
  }
  function undo() {
    ensureLoaded();
    const prev = undoStack.pop();
    if (!prev) return false;
    state = sanitize(JSON.parse(prev));
    scheduleSave();
    notify();
    return true;
  }

  // packages/misc/tier-list/items.js
  var cards = [];
  var byId = /* @__PURE__ */ new Map();
  var nameCache = /* @__PURE__ */ new Map();
  var readyListeners = /* @__PURE__ */ new Set();
  var HIDDEN_BY_DEFAULT = /* @__PURE__ */ new Set(["TOKEN", "GENERATED", "STORY"]);
  var RARITY_COLORS = {
    BASE: "#9a9a9a",
    COMMON: "#e8e8e8",
    RARE: "#58b4ff",
    EPIC: "#c86bff",
    LEGENDARY: "#ffcc00",
    DETERMINATION: "#ff3030",
    TOKEN: "#6b6b6b",
    GENERATED: "#6b6b6b",
    STORY: "#6b6b6b"
  };
  function setCards(list) {
    if (!Array.isArray(list) || !list.length) return false;
    cards = list.filter((c) => c && c.id !== void 0 && c.id !== null);
    byId = new Map(cards.map((c) => [String(c.id), c]));
    nameCache.clear();
    readyListeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
      }
    });
    return true;
  }
  function readCachedCards() {
    try {
      const raw = getPageWindow().localStorage.getItem("allCards");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function initItemData(plugin) {
    if (!setCards(getAllCards())) setCards(readCachedCards());
    if (plugin && plugin.events) {
      plugin.events.on("allCardsReady", (list) => setCards(list));
    }
  }
  function onCardsReady(fn) {
    readyListeners.add(fn);
    return () => readyListeners.delete(fn);
  }
  function hasCards() {
    return cards.length > 0;
  }
  function getCard(id) {
    return byId.get(String(id)) || null;
  }
  function stripHtml(text) {
    const el2 = document.createElement("div");
    el2.innerHTML = String(text);
    return el2.textContent.trim();
  }
  function cardName(card) {
    const cached = nameCache.get(card.id);
    if (cached) return cached;
    let name = "";
    try {
      const $2 = getPageWindow().$;
      if ($2 && $2.i18n) {
        const key2 = `card-name-${card.fixedId || card.id}`;
        const value = $2.i18n(key2, 1);
        if (value && value !== key2) name = stripHtml(value);
      }
    } catch (e) {
    }
    if (!name) name = stripHtml(card.name || `Card ${card.id}`);
    nameCache.set(card.id, name);
    return name;
  }
  function cardImage(card) {
    return card && card.image ? `/images/cards/${card.image}.png` : "";
  }
  function cardKey(card) {
    return `card:${card.id}`;
  }
  var SOULS = ["DETERMINATION", "PATIENCE", "BRAVERY", "INTEGRITY", "PERSEVERANCE", "KINDNESS", "JUSTICE"];
  var SOUL_COLORS3 = {
    DETERMINATION: "#ff0000",
    PATIENCE: "#41fcff",
    BRAVERY: "#fca500",
    INTEGRITY: "#0064ff",
    PERSEVERANCE: "#d535d9",
    KINDNESS: "#00c000",
    JUSTICE: "#ffff00"
  };
  function i18n(key2, ...args) {
    try {
      const $2 = getPageWindow().$;
      if ($2 && $2.i18n) {
        const value = $2.i18n(key2, ...args);
        if (value && value !== key2) return stripHtml(value);
      }
    } catch (e) {
    }
    return "";
  }
  function soulName(soul) {
    return i18n(`soul-${soul.toLowerCase()}`, 1) || soul.charAt(0) + soul.slice(1).toLowerCase();
  }
  var ARTIFACT_CACHE_KEY = "wizascript.tierlist.artifacts";
  var ARTIFACT_CACHE_MS = 24 * 60 * 60 * 1e3;
  var artifacts = [];
  var artifactsById = /* @__PURE__ */ new Map();
  var artifactLoad = null;
  function setArtifacts(list) {
    if (!Array.isArray(list) || !list.length) return false;
    artifacts = list.filter((a) => a && a.id !== void 0 && a.id !== null).map((a) => ({ id: a.id, name: a.name, image: a.image, rarity: a.rarity }));
    artifactsById = new Map(artifacts.map((a) => [String(a.id), a]));
    return true;
  }
  function readArtifactCache() {
    try {
      const raw = GM_getValue(ARTIFACT_CACHE_KEY, null);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function loadArtifacts() {
    if (artifactLoad) return artifactLoad;
    const cached = readArtifactCache();
    if (cached && setArtifacts(cached.list) && Date.now() - cached.time < ARTIFACT_CACHE_MS) {
      artifactLoad = Promise.resolve(true);
      return artifactLoad;
    }
    artifactLoad = fetch("/DecksConfig", { credentials: "same-origin" }).then((r) => r.json()).then((data2) => {
      const raw = data2 && data2.allArtifacts;
      const list = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!setArtifacts(list)) return artifacts.length > 0;
      try {
        GM_setValue(ARTIFACT_CACHE_KEY, JSON.stringify({ time: Date.now(), list: artifacts }));
      } catch (e) {
      }
      return true;
    }).catch(() => artifacts.length > 0).then((ok) => {
      if (!ok) artifactLoad = null;
      return ok;
    });
    return artifactLoad;
  }
  function hasArtifacts() {
    return artifacts.length > 0;
  }
  function artifactName(a) {
    return i18n(`artifact-name-${a.id}`, 1) || stripHtml(a.name || `Artifact ${a.id}`);
  }
  function resolveItem(key2) {
    const str = String(key2);
    const at = str.indexOf(":");
    const kind = str.slice(0, at);
    const id = str.slice(at + 1);
    if (kind === "card") {
      const card = getCard(id);
      if (card) {
        return { key: key2, kind, card, label: cardName(card), image: cardImage(card), rarity: card.rarity };
      }
      return { key: key2, kind, card: null, label: "Unknown card", image: "", rarity: null };
    }
    if (kind === "soul" && SOULS.includes(id)) {
      return { key: key2, kind, card: null, label: soulName(id), image: `/images/souls/${id}.png`, rarity: null, color: SOUL_COLORS3[id] };
    }
    if (kind === "artifact") {
      const a = artifactsById.get(id);
      if (a) return { key: key2, kind, card: null, label: artifactName(a), image: a.image ? `/images/artifacts/${a.image}.png` : "", rarity: a.rarity };
      return { key: key2, kind, card: null, label: "Artifact", image: "", rarity: null };
    }
    if (kind === "text") {
      const label = getTextLabel(id);
      return { key: key2, kind, card: null, label: label === null ? "(deleted text)" : label, image: "", rarity: null, text: true };
    }
    return { key: key2, kind, card: null, label: "Unknown item", image: "", rarity: null };
  }
  function searchSouls(text) {
    const q = String(text || "").trim().toLowerCase();
    return SOULS.filter((s) => !q || soulName(s).toLowerCase().includes(q) || s.toLowerCase().includes(q)).map((s) => `soul:${s}`);
  }
  function searchArtifacts(text) {
    const q = String(text || "").trim().toLowerCase();
    return artifacts.filter((a) => !q || artifactName(a).toLowerCase().includes(q) || String(a.name || "").toLowerCase().includes(q)).sort((a, b) => artifactName(a).localeCompare(artifactName(b))).map((a) => `artifact:${a.id}`);
  }
  function isFilterActive(f) {
    return !!(String(f.text || "").trim() || f.rarities.size || f.tribes || f.monster || f.spell || f.sets.size);
  }
  function searchCards(f, limit = 150) {
    if (!isFilterActive(f)) return { results: [], total: 0 };
    const text = String(f.text || "").trim().toLowerCase();
    const matches = cards.filter((c) => {
      if (f.rarities.size) {
        if (!f.rarities.has(c.rarity)) return false;
      } else if (HIDDEN_BY_DEFAULT.has(c.rarity)) {
        return false;
      }
      if (f.monster || f.spell) {
        const isSpell = Number(c.typeCard) === 1;
        if (!(f.monster && !isSpell || f.spell && isSpell)) return false;
      }
      if (f.tribes && !(Number(c.typeCard) !== 1 && Array.isArray(c.tribes) && c.tribes.length)) return false;
      if (f.sets.size && !f.sets.has(c.extension)) return false;
      if (text) {
        const local = cardName(c).toLowerCase();
        const english = stripHtml(c.name || "").toLowerCase();
        if (!local.includes(text) && !english.includes(text)) return false;
      }
      return true;
    });
    matches.sort((a, b) => Number(a.cost) - Number(b.cost) || cardName(a).localeCompare(cardName(b)));
    return { results: matches.slice(0, limit), total: matches.length };
  }

  // packages/misc/tier-list/window.js
  var MIN_W = 400;
  var MIN_H = 340;
  var DEFAULT_W = 680;
  var DEFAULT_H = 500;
  var MIN_TILE = 52;
  var EDGES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
  function viewport() {
    return { w: document.documentElement.clientWidth || window.innerWidth, h: document.documentElement.clientHeight || window.innerHeight };
  }
  function clampGeometry(g) {
    const vp = viewport();
    const width = Math.max(Math.min(MIN_W, vp.w), Math.min(g.width, vp.w));
    const height = Math.max(Math.min(MIN_H, vp.h), Math.min(g.height, vp.h));
    const left = Math.max(0, Math.min(g.left, vp.w - width));
    const top = Math.max(0, Math.min(g.top, vp.h - height));
    return { left, top, width, height };
  }
  function defaultGeometry() {
    const vp = viewport();
    const width = Math.min(DEFAULT_W, vp.w);
    const height = Math.min(DEFAULT_H, vp.h);
    return { left: Math.round((vp.w - width) / 2), top: Math.round((vp.h - height) / 2), width, height };
  }
  function buildWindow({ signal, getPreferredTile, onTitleChange }) {
    const saved = loadWindowState() || {};
    const ui = {
      geometry: clampGeometry(saved.geometry || defaultGeometry()),
      maximised: !!saved.maximised,
      pickerOpen: saved.pickerOpen !== false
    };
    const root = document.createElement("div");
    root.className = "wz-tl";
    const header = document.createElement("div");
    header.className = "wz-tl-header";
    const title = document.createElement("input");
    title.type = "text";
    title.className = "wz-tl-title";
    title.maxLength = 60;
    title.spellcheck = false;
    title.title = "Click to rename this list";
    title.addEventListener("change", () => onTitleChange(title.value), { signal });
    title.addEventListener("keydown", (e) => {
      if (e.key === "Enter") title.blur();
    }, { signal });
    const buttons = document.createElement("span");
    buttons.style.cssText = "display:flex;gap:4px;flex:none;";
    const body = document.createElement("div");
    body.className = "wz-tl-body";
    const grip = document.createElement("div");
    grip.className = "wz-tl-grip";
    grip.title = "Drag to move, double-click to fill the screen";
    header.append(title, grip, buttons);
    root.append(header, body);
    EDGES.forEach((edge) => {
      const h = document.createElement("div");
      h.className = `wz-tl-resize wz-tl-resize-${edge}`;
      h.dataset.edge = edge;
      root.appendChild(h);
    });
    function persist() {
      saveWindowState({ geometry: ui.geometry, maximised: ui.maximised, pickerOpen: ui.pickerOpen });
    }
    function updateTileSize() {
      const width = ui.maximised ? viewport().w : ui.geometry.width;
      const preferred = getPreferredTile();
      const tile = Math.round(Math.max(MIN_TILE, Math.min(preferred, (width - 120) / 9)));
      root.style.setProperty("--wz-tl-tile", tile + "px");
    }
    function apply2() {
      const g = ui.geometry;
      root.style.left = g.left + "px";
      root.style.top = g.top + "px";
      root.style.width = g.width + "px";
      root.style.height = g.height + "px";
      root.classList.toggle("wz-tl-max", ui.maximised);
      updateTileSize();
    }
    function setMaximised(value) {
      ui.maximised = !!value;
      apply2();
      persist();
      onMaximiseChange.forEach((fn) => fn(ui.maximised));
    }
    const onMaximiseChange = /* @__PURE__ */ new Set();
    header.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || ui.maximised) return;
      if (e.target.closest("input, button, select")) return;
      e.preventDefault();
      const start = { x: e.clientX, y: e.clientY, left: ui.geometry.left, top: ui.geometry.top };
      header.setPointerCapture(e.pointerId);
      header.style.cursor = "grabbing";
      const move = (ev) => {
        ui.geometry = clampGeometry({ ...ui.geometry, left: start.left + ev.clientX - start.x, top: start.top + ev.clientY - start.y });
        apply2();
      };
      const end = () => {
        header.style.cursor = "";
        header.removeEventListener("pointermove", move);
        header.removeEventListener("pointerup", end);
        header.removeEventListener("pointercancel", end);
        persist();
      };
      header.addEventListener("pointermove", move, { signal });
      header.addEventListener("pointerup", end, { signal });
      header.addEventListener("pointercancel", end, { signal });
    }, { signal });
    header.addEventListener("dblclick", (e) => {
      if (e.target.closest("input, button, select")) return;
      setMaximised(!ui.maximised);
    }, { signal });
    root.addEventListener("pointerdown", (e) => {
      const handle = e.target.closest(".wz-tl-resize");
      if (!handle || e.button !== 0 || ui.maximised) return;
      e.preventDefault();
      e.stopPropagation();
      const edge = handle.dataset.edge;
      const start = { x: e.clientX, y: e.clientY, ...ui.geometry };
      const vp = viewport();
      handle.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const dx = ev.clientX - start.x;
        const dy = ev.clientY - start.y;
        let { left, top, width, height } = start;
        if (edge.includes("e")) width = Math.min(start.width + dx, vp.w - start.left);
        if (edge.includes("s")) height = Math.min(start.height + dy, vp.h - start.top);
        if (edge.includes("w")) {
          width = Math.min(start.width - dx, start.left + start.width);
          width = Math.max(width, MIN_W);
          left = start.left + start.width - width;
        }
        if (edge.includes("n")) {
          height = Math.min(start.height - dy, start.top + start.height);
          height = Math.max(height, MIN_H);
          top = start.top + start.height - height;
        }
        ui.geometry = clampGeometry({ left, top, width: Math.max(MIN_W, width), height: Math.max(MIN_H, height) });
        apply2();
      };
      const end = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", end);
        handle.removeEventListener("pointercancel", end);
        persist();
      };
      handle.addEventListener("pointermove", move, { signal });
      handle.addEventListener("pointerup", end, { signal });
      handle.addEventListener("pointercancel", end, { signal });
    }, { signal });
    window.addEventListener("resize", () => {
      ui.geometry = clampGeometry(ui.geometry);
      apply2();
    }, { signal });
    apply2();
    return {
      root,
      header,
      body,
      buttons,
      title,
      isMaximised: () => ui.maximised,
      setMaximised,
      onMaximiseChange: (fn) => onMaximiseChange.add(fn),
      isPickerOpen: () => ui.pickerOpen,
      setPickerOpen(value) {
        ui.pickerOpen = !!value;
        persist();
      },
      refreshTileSize: updateTileSize
    };
  }

  // packages/misc/tier-list/tiers-view.js
  function buildTile(key2, { placed = false } = {}) {
    const item = resolveItem(key2);
    const tile = document.createElement("div");
    tile.className = "wz-tl-tile";
    tile.dataset.key = key2;
    tile.tabIndex = -1;
    if (item.image) tile.style.backgroundImage = `url("${item.image}")`;
    else tile.classList.add("wz-tl-noimg");
    if (item.color) tile.style.setProperty("--wz-tl-rarity", item.color);
    else if (item.rarity && RARITY_COLORS[item.rarity]) tile.style.setProperty("--wz-tl-rarity", RARITY_COLORS[item.rarity]);
    if (item.text) {
      tile.classList.add("wz-tl-text");
      tile.title = "Double-click to edit";
    }
    if (placed) tile.classList.add("wz-tl-placed");
    const name = document.createElement("div");
    name.className = "wz-tl-tile-name";
    name.textContent = item.label;
    tile.appendChild(name);
    return tile;
  }
  function createTiersView({ body, signal }) {
    const container = document.createElement("div");
    container.className = "wz-tl-tiers";
    body.appendChild(container);
    let editor = null;
    function closeEditor() {
      if (editor) editor.el.remove();
      editor = null;
    }
    function openEditor(tierId, anchor) {
      closeEditor();
      const list = getActiveList();
      const index = list.tiers.findIndex((t) => t.id === tierId);
      const tier = list.tiers[index];
      if (!tier) return;
      const el2 = document.createElement("div");
      el2.className = "wz-tl-editor";
      el2.dataset.tierId = tierId;
      const name = document.createElement("input");
      name.type = "text";
      name.maxLength = 40;
      name.value = tier.label;
      name.placeholder = "Tier name";
      const commitName = () => renameTier(tierId, name.value);
      name.addEventListener("change", commitName);
      name.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          commitName();
          closeEditor();
        }
        if (e.key === "Escape") closeEditor();
      });
      const swatches = document.createElement("div");
      swatches.className = "wz-tl-swatches";
      TIER_COLORS.forEach((color) => {
        const s = document.createElement("div");
        s.className = "wz-tl-swatch" + (color === tier.color ? " wz-tl-active" : "");
        s.style.background = color;
        s.title = color;
        s.addEventListener("click", () => {
          recolorTier(tierId, color);
          swatches.querySelectorAll(".wz-tl-swatch").forEach((n) => n.classList.toggle("wz-tl-active", n === s));
          custom.value = color;
        });
        swatches.appendChild(s);
      });
      const custom = document.createElement("input");
      custom.type = "color";
      custom.value = tier.color;
      custom.title = "Custom colour";
      custom.addEventListener("change", () => recolorTier(tierId, custom.value));
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
      btn("\u25B2 Move up", () => moveTier(tierId, -1), { disabled: index === 0 });
      btn("\u25BC Move down", () => moveTier(tierId, 1), { disabled: index === list.tiers.length - 1 });
      btn("+ Row above", () => addTier(index), { close: true });
      btn("+ Row below", () => addTier(index + 1), { close: true });
      btn("Clear row", () => clearTier(tierId), { disabled: !tier.items.length });
      const del = btn("Delete row", () => deleteTier(tierId), { close: true });
      del.classList.add("wz-tl-danger");
      btn("Done", () => {
      }, { close: true }).style.gridColumn = "1 / -1";
      el2.append(name, swatches, grid);
      body.appendChild(el2);
      const bodyRect = body.getBoundingClientRect();
      const aRect = anchor.getBoundingClientRect();
      let top = aRect.bottom - bodyRect.top + 2;
      if (top + el2.offsetHeight > body.clientHeight) top = Math.max(2, aRect.top - bodyRect.top - el2.offsetHeight - 2);
      el2.style.top = Math.max(2, top) + "px";
      el2.style.left = "6px";
      editor = { el: el2, tierId };
      name.focus();
      name.select();
    }
    function render() {
      const list = getActiveList();
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
        tier.items.forEach((key2) => items.appendChild(buildTile(key2)));
        const tools = document.createElement("div");
        tools.className = "wz-tl-row-tools";
        const gear = document.createElement("button");
        gear.type = "button";
        gear.textContent = "\u2699";
        gear.title = "Edit this tier";
        gear.addEventListener("click", () => openEditor(tier.id, row));
        const up = document.createElement("button");
        up.type = "button";
        up.textContent = "\u25B2";
        up.title = "Move tier up";
        up.addEventListener("click", () => moveTier(tier.id, -1));
        const down = document.createElement("button");
        down.type = "button";
        down.textContent = "\u25BC";
        down.title = "Move tier down";
        down.addEventListener("click", () => moveTier(tier.id, 1));
        tools.append(up, gear, down);
        row.append(label, items, tools);
        container.appendChild(row);
      });
      const add = document.createElement("button");
      add.type = "button";
      add.className = "wz-tl-btn wz-tl-add-row";
      add.textContent = "+ Add tier";
      add.addEventListener("click", () => addTier());
      container.appendChild(add);
      container.scrollTop = scroll;
      if (editor && !list.tiers.some((t) => t.id === editor.tierId)) closeEditor();
    }
    document.addEventListener("pointerdown", (e) => {
      if (!editor) return;
      if (editor.el.contains(e.target)) return;
      if (e.target.closest(".wz-tl-row-label, .wz-tl-row-tools")) return;
      closeEditor();
    }, { signal, capture: true });
    return { render, closeEditor, element: container };
  }

  // packages/misc/tier-list/picker.js
  var RESULT_LIMIT = 150;
  var SEARCH_DELAY_MS = 150;
  var RARITY_TOGGLES = [
    ["BASE", "images/rarity/BASE_BASE.png", "Base"],
    ["TOKEN", "images/rarity/BASE_TOKEN.png", "Token"],
    ["COMMON", "images/rarity/BASE_COMMON.png", "Common"],
    ["RARE", "images/rarity/BASE_RARE.png", "Rare"],
    ["EPIC", "images/rarity/BASE_EPIC.png", "Epic"],
    ["LEGENDARY", "images/rarity/BASE_LEGENDARY.png", "Legendary"],
    ["DETERMINATION", "images/rarity/BASE_DETERMINATION.png", "Determination"],
    ["STORY", "images/rarity/BASE_STORY.png", "Story"]
  ];
  var KIND_TOGGLES = [
    ["tribes", "images/tribes/ALL.png", "Monsters with tribes"],
    ["monster", "images/souls/MONSTER.png", "Monsters"],
    ["spell", "images/artifacts/Arcane_Scepter.png", "Spells"]
  ];
  var SET_TOGGLES = [
    ["BASE", "images/rarity/BASE.png", "Undertale cards"],
    ["DELTARUNE", "images/rarity/DELTARUNE.png", "Deltarune cards"],
    ["UTY", "images/rarity/UTY.png", "Undertale Yellow cards"]
  ];
  var TYPES = [
    ["cards", "Cards"],
    ["souls", "Souls"],
    ["artifacts", "Artifacts"],
    ["text", "Text"]
  ];
  function createPicker({ body, signal }) {
    const panel = document.createElement("div");
    panel.className = "wz-tl-picker";
    let type = "cards";
    const state2 = { rarities: /* @__PURE__ */ new Set(), sets: /* @__PURE__ */ new Set(), tribes: false, monster: false, spell: false };
    const toggles2 = [];
    const searchText = { cards: "", souls: "", artifacts: "", text: "" };
    const filters = document.createElement("div");
    filters.className = "wz-tl-filters";
    const tabs = document.createElement("div");
    tabs.className = "wz-tl-type-tabs";
    const tabButtons = TYPES.map(([value, label]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wz-tl-type-tab";
      b.dataset.type = value;
      b.textContent = label;
      b.addEventListener("click", () => setType(value), { signal });
      tabs.appendChild(b);
      return b;
    });
    const search = document.createElement("input");
    search.type = "text";
    search.spellcheck = false;
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "wz-tl-btn";
    const searchRow = document.createElement("div");
    searchRow.className = "wz-tl-search-row";
    searchRow.append(search, clear);
    function makeToggle([value, src, title], isOn2, flip) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wz-tl-toggle";
      b.title = title;
      b.dataset.filter = value;
      const img = document.createElement("img");
      img.src = "/" + src;
      img.alt = title;
      img.draggable = false;
      img.addEventListener("error", () => {
        img.remove();
        b.textContent = title;
        b.classList.add("wz-tl-toggle-text");
      }, { once: true });
      b.appendChild(img);
      b.addEventListener("click", () => {
        flip(value);
        render();
      }, { signal });
      toggles2.push({ el: b, isOn: () => isOn2(value) });
      return b;
    }
    function group(defs, isOn2, flip) {
      const g = document.createElement("div");
      g.className = "wz-tl-toggle-group";
      defs.forEach((d) => g.appendChild(makeToggle(d, isOn2, flip)));
      return g;
    }
    const flipSet = (set) => (v) => set.has(v) ? set.delete(v) : set.add(v);
    const cardToggles = document.createElement("div");
    cardToggles.className = "wz-tl-card-toggles";
    cardToggles.append(
      group(RARITY_TOGGLES, (v) => state2.rarities.has(v), flipSet(state2.rarities)),
      group(KIND_TOGGLES, (v) => state2[v], (v) => {
        state2[v] = !state2[v];
      }),
      group(SET_TOGGLES, (v) => state2.sets.has(v), flipSet(state2.sets))
    );
    filters.append(tabs, searchRow, cardToggles);
    const hint = document.createElement("div");
    hint.className = "wz-tl-hint";
    const results = document.createElement("div");
    results.className = "wz-tl-results";
    panel.append(filters, hint, results);
    body.appendChild(panel);
    function cardFilters() {
      return { text: search.value, ...state2 };
    }
    function setType(value) {
      searchText[type] = search.value;
      type = value;
      search.value = searchText[type];
      if (type === "artifacts" && !hasArtifacts()) {
        loadArtifacts().then(() => {
          if (type === "artifacts") render();
        });
      }
      render();
      search.focus();
    }
    function syncControls() {
      tabButtons.forEach((b) => b.classList.toggle("wz-tl-active", b.dataset.type === type));
      cardToggles.style.visibility = type === "cards" ? "" : "hidden";
      toggles2.forEach((t) => t.el.classList.toggle("wz-tl-on", t.isOn()));
      if (type === "text") {
        search.placeholder = "New text item\u2026";
        search.maxLength = MAX_TEXT;
        clear.textContent = "Add";
        clear.title = "Add this text as an item you can rank";
        clear.disabled = !search.value.trim();
      } else {
        search.placeholder = type === "cards" ? "Search cards\u2026" : type === "souls" ? "Search souls\u2026" : "Search artifacts\u2026";
        search.removeAttribute("maxLength");
        clear.textContent = "Clear";
        clear.title = "Clear the search and filters";
        clear.disabled = type === "cards" ? !isFilterActive(cardFilters()) : !search.value;
      }
    }
    function showKeys(keys, { deletable = false } = {}) {
      const frag = document.createDocumentFragment();
      keys.forEach((key2) => {
        const tile = buildTile(key2, { placed: isPlaced(key2) });
        if (deletable) {
          const del = document.createElement("button");
          del.type = "button";
          del.className = "wz-tl-tile-del";
          del.textContent = "\xD7";
          del.title = "Delete this text item";
          del.addEventListener("click", (e) => {
            e.stopPropagation();
            deleteText(key2.slice(5));
          });
          tile.appendChild(del);
        }
        frag.appendChild(tile);
      });
      results.appendChild(frag);
    }
    function renderCards() {
      if (!hasCards()) {
        hint.textContent = "No card data yet. Open the Decks or Crafting page once, then come back.";
        return;
      }
      const f = cardFilters();
      if (!isFilterActive(f)) {
        hint.textContent = "Search or tick a filter to list cards, then drag them into a tier.";
        return;
      }
      const { results: cards2, total } = searchCards(f, RESULT_LIMIT);
      if (!total) {
        hint.textContent = "No cards match.";
        return;
      }
      hint.textContent = total > cards2.length ? `Showing ${cards2.length} of ${total} cards. Narrow the search to see the rest.` : `${total} card${total === 1 ? "" : "s"}. Drag one into a tier.`;
      showKeys(cards2.map(cardKey));
    }
    function renderSouls() {
      const keys = searchSouls(search.value);
      hint.textContent = keys.length ? "Drag a soul into a tier." : "No souls match.";
      showKeys(keys);
    }
    function renderArtifacts() {
      if (!hasArtifacts()) {
        hint.textContent = "Loading artifacts\u2026 (if this stays, open the Decks page once, then try again)";
        return;
      }
      const keys = searchArtifacts(search.value);
      hint.textContent = keys.length ? `${keys.length} artifact${keys.length === 1 ? "" : "s"}. Drag one into a tier.` : "No artifacts match.";
      showKeys(keys);
    }
    function renderText() {
      const keys = getTextIds().map((id) => `text:${id}`);
      hint.textContent = keys.length ? "Drag a text item into a tier. Double-click one to edit it." : "Type a label (e.g. an archetype) and press Add to make a text item.";
      showKeys(keys, { deletable: true });
    }
    function render() {
      results.innerHTML = "";
      syncControls();
      if (type === "cards") renderCards();
      else if (type === "souls") renderSouls();
      else if (type === "artifacts") renderArtifacts();
      else renderText();
    }
    function addTextItem() {
      if (addText(search.value)) {
        search.value = "";
        render();
      }
    }
    let searchTimer = null;
    search.addEventListener("input", () => {
      if (type === "text") {
        syncControls();
        return;
      }
      clearTimeout(searchTimer);
      searchTimer = setTimeout(render, SEARCH_DELAY_MS);
    }, { signal });
    search.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && type === "text") {
        addTextItem();
        return;
      }
      if (e.key === "Escape" && search.value) {
        search.value = "";
        render();
      }
    }, { signal });
    clear.addEventListener("click", () => {
      if (type === "text") {
        addTextItem();
        return;
      }
      search.value = "";
      if (type === "cards") {
        state2.rarities.clear();
        state2.sets.clear();
        state2.tribes = state2.monster = state2.spell = false;
      }
      render();
    }, { signal });
    const stopListening = onCardsReady(() => {
      if (type === "cards") render();
    });
    signal.addEventListener("abort", stopListening);
    render();
    return {
      element: panel,
      render,
      setOpen(open) {
        panel.classList.toggle("wz-tl-hidden", !open);
      },
      focusSearch() {
        search.focus();
      }
    };
  }

  // packages/misc/tier-list/drag.js
  var DRAG_THRESHOLD = 6;
  function insertionIndex(tiles, x, y) {
    for (let i = 0; i < tiles.length; i++) {
      const r = tiles[i].getBoundingClientRect();
      if (y < r.top) return i;
      if (y <= r.bottom && x < r.left + r.width / 2) return i;
    }
    return tiles.length;
  }
  function attachDrag({ root, signal, onDrop, onDragStart, pageItemKey: pageItemKey2, buildGhost }) {
    let pending = null;
    let active = null;
    let suppressClick = false;
    function targetAt(x, y) {
      const el2 = document.elementFromPoint(x, y);
      if (!el2 || !root.contains(el2)) return { type: "outside" };
      const row = el2.closest(".wz-tl-row");
      if (row) return { type: "tier", tierId: row.dataset.tierId, rowItems: row.querySelector(".wz-tl-row-items") };
      if (el2.closest(".wz-tl-picker")) return { type: "picker" };
      return { type: "none" };
    }
    function clearHighlights() {
      if (!active) return;
      if (active.marker) active.marker.remove();
      active.marker = null;
      root.querySelectorAll(".wz-tl-drop-in").forEach((n) => n.classList.remove("wz-tl-drop-in"));
      active.ghost.classList.remove("wz-tl-ghost-remove");
    }
    function update(x, y) {
      active.ghost.style.left = x - active.offsetX + "px";
      active.ghost.style.top = y - active.offsetY + "px";
      const t = targetAt(x, y);
      clearHighlights();
      active.target = t;
      if (t.type === "tier") {
        const tiles = [...t.rowItems.querySelectorAll(".wz-tl-tile")].filter((n) => n !== active.tile);
        t.index = insertionIndex(tiles, x, y);
        const marker = document.createElement("div");
        marker.className = "wz-tl-marker";
        if (t.index < tiles.length) t.rowItems.insertBefore(marker, tiles[t.index]);
        else t.rowItems.appendChild(marker);
        active.marker = marker;
      } else if ((t.type === "picker" || t.type === "outside") && active.from.type === "tier") {
        active.ghost.classList.add("wz-tl-ghost-remove");
        if (t.type === "picker") {
          const picker = root.querySelector(".wz-tl-picker");
          if (picker) picker.classList.add("wz-tl-drop-in");
        }
      }
    }
    function begin(x, y) {
      const { tile, key: key2, from, offsetX, offsetY } = pending;
      const fromPage = from.type === "page";
      const ghost = fromPage ? buildGhost(key2) : tile.cloneNode(true);
      ghost.classList.add("wz-tl-ghost");
      ghost.classList.remove("wz-tl-placed");
      const size = getComputedStyle(root).getPropertyValue("--wz-tl-tile");
      ghost.style.setProperty("--wz-tl-tile", size);
      if (fromPage) {
        ghost.style.width = size;
        ghost.style.height = `calc(${size} * 0.8)`;
      } else {
        const rect = tile.getBoundingClientRect();
        ghost.style.width = rect.width + "px";
        ghost.style.height = rect.height + "px";
      }
      ghost.style.zIndex = String(Z_FLOATING);
      document.body.appendChild(ghost);
      if (tile) tile.classList.add("wz-tl-dragging");
      active = { tile, key: key2, from, ghost, offsetX, offsetY, target: null, marker: null };
      pending = null;
      if (onDragStart) onDragStart();
      update(x, y);
    }
    function finish(cancelled) {
      if (!active) return;
      const { key: key2, from, target, tile, ghost } = active;
      clearHighlights();
      ghost.remove();
      if (tile) tile.classList.remove("wz-tl-dragging");
      active = null;
      suppressClick = true;
      setTimeout(() => {
        suppressClick = false;
      }, 0);
      if (cancelled || !target) return;
      const clean = target.type === "tier" ? { type: "tier", tierId: target.tierId, index: target.index } : { type: target.type };
      onDrop({ key: key2, from, target: clean });
    }
    document.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !pageItemKey2 || root.contains(e.target)) return;
      const key2 = pageItemKey2(e.target);
      if (!key2) return;
      pending = {
        tile: null,
        key: key2,
        from: { type: "page" },
        startX: e.clientX,
        startY: e.clientY,
        offsetX: 20,
        offsetY: 20
      };
    }, { signal, capture: true });
    ["dragstart", "selectstart"].forEach((type) => {
      document.addEventListener(type, (e) => {
        if (active || pending && pending.from.type === "page") e.preventDefault();
      }, { signal, capture: true });
    });
    root.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest(".wz-tl-tile-del, input")) return;
      const tile = e.target.closest(".wz-tl-tile");
      if (!tile || !root.contains(tile) || !tile.dataset.key) return;
      e.preventDefault();
      const row = tile.closest(".wz-tl-row");
      const rect = tile.getBoundingClientRect();
      pending = {
        tile,
        key: tile.dataset.key,
        from: row ? { type: "tier", tierId: row.dataset.tierId } : { type: "picker" },
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top
      };
    }, { signal });
    document.addEventListener("pointermove", (e) => {
      if (pending) {
        if (Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY) < DRAG_THRESHOLD) return;
        begin(e.clientX, e.clientY);
      }
      if (active) {
        e.preventDefault();
        update(e.clientX, e.clientY);
      }
    }, { signal });
    document.addEventListener("pointerup", (e) => {
      pending = null;
      if (active) {
        update(e.clientX, e.clientY);
        finish(false);
      }
    }, { signal });
    document.addEventListener("pointercancel", () => {
      pending = null;
      finish(true);
    }, { signal });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && active) finish(true);
    }, { signal });
    document.addEventListener("click", (e) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    }, { signal, capture: true });
    return {
      isDragging: () => !!active,
      cancel: () => {
        pending = null;
        finish(true);
      }
    };
  }

  // packages/misc/tier-list/preview.js
  var HOLD_MS = 3e3;
  function attachPreview({ root, signal, isDragging }) {
    let timer = null;
    let box = null;
    let lastX = 0;
    let lastY = 0;
    function hide() {
      clearTimeout(timer);
      timer = null;
      if (box) box.remove();
      box = null;
    }
    function position() {
      if (!box) return;
      const r = box.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = lastX + 18;
      let top = lastY + 12;
      if (left + r.width > vw - 4) left = Math.max(4, lastX - r.width - 18);
      if (top + r.height > vh - 4) top = Math.max(4, vh - r.height - 4);
      box.style.left = left + "px";
      box.style.top = top + "px";
    }
    function render(item) {
      const el2 = document.createElement("div");
      el2.className = "wz-tl-preview";
      const pageWindow2 = getPageWindow();
      const $2 = pageWindow2.$;
      if (item.card && typeof pageWindow2.appendCard === "function" && $2) {
        try {
          const holder = $2("<div>");
          pageWindow2.appendCard(JSON.parse(JSON.stringify(item.card)), holder);
          if (holder.children().length) {
            el2.appendChild(holder[0]);
            return el2;
          }
        } catch (e) {
        }
      }
      const fallback = document.createElement("div");
      fallback.className = "wz-tl-preview-fallback";
      const pic = document.createElement("div");
      if (item.image) pic.style.backgroundImage = `url("${item.image}")`;
      else pic.style.display = "none";
      fallback.append(pic, item.label);
      el2.appendChild(fallback);
      return el2;
    }
    let overTile = null;
    let pressed = false;
    function arm() {
      clearTimeout(timer);
      timer = null;
      const tile = overTile;
      if (!tile || pressed || isDragging() || box) return;
      if (tile.classList.contains("wz-tl-text")) return;
      timer = setTimeout(() => {
        if (pressed || isDragging() || !tile.isConnected || overTile !== tile) return;
        const item = resolveItem(tile.dataset.key);
        box = render(item);
        box.dataset.key = tile.dataset.key;
        document.body.appendChild(box);
        position();
      }, HOLD_MS);
    }
    root.addEventListener("pointerover", (e) => {
      const tile = e.target.closest(".wz-tl-tile");
      if (!tile || !tile.dataset.key || tile === overTile) return;
      hide();
      overTile = tile;
      arm();
    }, { signal });
    root.addEventListener("pointerout", (e) => {
      const tile = e.target.closest(".wz-tl-tile");
      if (!tile || tile !== overTile) return;
      if (e.relatedTarget && tile.contains(e.relatedTarget)) return;
      overTile = null;
      hide();
    }, { signal });
    root.addEventListener("pointermove", (e) => {
      lastX = e.clientX;
      lastY = e.clientY;
      position();
    }, { signal });
    document.addEventListener("pointerdown", () => {
      pressed = true;
      hide();
    }, { signal, capture: true });
    document.addEventListener("pointerup", () => {
      pressed = false;
      if (overTile && overTile.isConnected) arm();
      else overTile = null;
    }, { signal, capture: true });
    signal.addEventListener("abort", hide);
    return { hide };
  }

  // packages/misc/tier-list/index.js
  var CARD_PAGES = ["/Crafting", "/Decks"];
  function pageItemKey(target) {
    if (!matchesPage(CARD_PAGES)) return null;
    const el2 = target.closest && target.closest(".card[id]");
    if (!el2 || !getCard(el2.id)) return null;
    return `card:${el2.id}`;
  }
  var CARD_SIZES = { Small: 64, Medium: 88, Large: 120 };
  var settings2 = null;
  var mounted2 = null;
  function preferredTile() {
    const v = settings2 ? settings2.value("cardSize") : "Medium";
    return CARD_SIZES[v] || CARD_SIZES.Medium;
  }
  function headerButton(label, title) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "wz-tl-btn";
    b.textContent = label;
    b.title = title;
    return b;
  }
  function showTierList() {
    if (mounted2) return;
    injectTierListStyle();
    const controller = new AbortController();
    const { signal } = controller;
    const win = buildWindow({
      signal,
      getPreferredTile: preferredTile,
      onTitleChange: (value) => setTitle(value)
    });
    const listsBtn = headerButton("Lists \u25BE", "Switch, add, copy or delete tier lists");
    win.title.after(listsBtn);
    const undoBtn = headerButton("\u21B6", "Undo");
    const resetBtn = headerButton("Reset", "Clear every tier back to S\u2013D (click twice)");
    const pickerBtn = headerButton("Items", "Show or hide the item panel");
    const maxBtn = headerButton("\u25A1", "Fill the screen");
    const closeBtn = headerButton("\xD7", "Close");
    win.buttons.append(undoBtn, resetBtn, pickerBtn, maxBtn, closeBtn);
    const tiers = createTiersView({ body: win.body, signal });
    const picker = createPicker({ body: win.body, signal });
    function syncHeader() {
      const list = getActiveList();
      if (document.activeElement !== win.title) win.title.value = list.title;
      undoBtn.disabled = !canUndo();
      pickerBtn.classList.toggle("wz-tl-active", win.isPickerOpen());
      maxBtn.textContent = win.isMaximised() ? "\u2750" : "\u25A1";
      maxBtn.title = win.isMaximised() ? "Restore the window size" : "Fill the screen";
    }
    function renderAll() {
      tiers.render();
      picker.render();
      syncHeader();
    }
    undoBtn.addEventListener("click", () => undo(), { signal });
    let listsMenu = null;
    function closeListsMenu() {
      if (listsMenu) listsMenu.remove();
      listsMenu = null;
      listsBtn.classList.remove("wz-tl-active");
    }
    function openListsMenu() {
      closeListsMenu();
      const menu = document.createElement("div");
      menu.className = "wz-tl-menu";
      getLists().forEach((l) => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "wz-tl-menu-item" + (l.active ? " wz-tl-active" : "");
        row.dataset.listId = l.id;
        const name = document.createElement("span");
        name.textContent = l.title;
        const count = document.createElement("span");
        count.className = "wz-tl-menu-count";
        count.textContent = String(l.count);
        row.append(name, count);
        row.addEventListener("click", () => {
          setActiveList(l.id);
          closeListsMenu();
        });
        menu.appendChild(row);
      });
      const actions = document.createElement("div");
      actions.className = "wz-tl-menu-actions";
      const act = (label, title, fn) => {
        const b = headerButton(label, title);
        b.addEventListener("click", fn);
        actions.appendChild(b);
        return b;
      };
      act("+ New", "Start a new, empty tier list", () => {
        createList();
        closeListsMenu();
      });
      act("Copy", "Make a copy of this list", () => {
        duplicateList();
        closeListsMenu();
      });
      const del = act("Delete", "Delete this list (click twice; \u21B6 brings it back)", () => {
        if (!del.classList.contains("wz-tl-danger")) {
          del.classList.add("wz-tl-danger");
          del.textContent = "Sure?";
          return;
        }
        deleteActiveList();
        closeListsMenu();
      });
      menu.appendChild(actions);
      win.root.appendChild(menu);
      const r = listsBtn.getBoundingClientRect();
      const rr = win.root.getBoundingClientRect();
      menu.style.left = Math.max(4, r.left - rr.left) + "px";
      menu.style.top = r.bottom - rr.top + 4 + "px";
      listsMenu = menu;
      listsBtn.classList.add("wz-tl-active");
    }
    listsBtn.addEventListener("click", () => listsMenu ? closeListsMenu() : openListsMenu(), { signal });
    document.addEventListener("pointerdown", (e) => {
      if (listsMenu && !listsMenu.contains(e.target) && e.target !== listsBtn) closeListsMenu();
    }, { signal, capture: true });
    win.root.addEventListener("dblclick", (e) => {
      const tile = e.target.closest(".wz-tl-tile.wz-tl-text");
      if (!tile || e.target.closest("input, .wz-tl-tile-del")) return;
      const textId = tile.dataset.key.slice(5);
      const current = getTextLabel(textId);
      if (current === null) return;
      const label = tile.querySelector(".wz-tl-tile-name");
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = MAX_TEXT;
      input.value = current;
      label.textContent = "";
      label.appendChild(input);
      input.focus();
      input.select();
      let done = false;
      const commit = (save) => {
        if (done) return;
        done = true;
        if (save && input.value.trim() && input.value.trim() !== current) renameText(textId, input.value);
        else renderAll();
      };
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") commit(true);
        if (ev.key === "Escape") commit(false);
      });
      input.addEventListener("blur", () => commit(true));
    }, { signal });
    let resetArmed = null;
    resetBtn.addEventListener("click", () => {
      if (resetArmed) {
        clearTimeout(resetArmed);
        resetArmed = null;
        resetBtn.textContent = "Reset";
        resetBtn.classList.remove("wz-tl-danger");
        tiers.closeEditor();
        resetList();
        return;
      }
      resetBtn.textContent = "Sure?";
      resetBtn.classList.add("wz-tl-danger");
      resetArmed = setTimeout(() => {
        resetArmed = null;
        resetBtn.textContent = "Reset";
        resetBtn.classList.remove("wz-tl-danger");
      }, 3e3);
    }, { signal });
    pickerBtn.addEventListener("click", () => {
      const open = !win.isPickerOpen();
      win.setPickerOpen(open);
      picker.setOpen(open);
      syncHeader();
      if (open) picker.focusSearch();
    }, { signal });
    picker.setOpen(win.isPickerOpen());
    maxBtn.addEventListener("click", () => win.setMaximised(!win.isMaximised()), { signal });
    win.onMaximiseChange(syncHeader);
    closeBtn.addEventListener("click", () => hideTierList(), { signal });
    ["keydown", "keyup", "keypress"].forEach((type) => {
      win.root.addEventListener(type, (e) => {
        if (e.target.closest("input, select, textarea")) e.stopPropagation();
      }, { signal });
    });
    let preview = null;
    const drag = attachDrag({
      root: win.root,
      signal,
      pageItemKey,
      buildGhost: (key2) => buildTile(key2),
      onDragStart: () => {
        if (preview) preview.hide();
        tiers.closeEditor();
        closeListsMenu();
      },
      onDrop: ({ key: key2, from, target }) => {
        if (target.type === "tier") {
          placeItem(key2, target.tierId, target.index);
        } else if ((target.type === "picker" || target.type === "outside") && from.type === "tier") {
          removeItem(key2);
        }
      }
    });
    preview = attachPreview({ root: win.root, signal, isDragging: drag.isDragging });
    const unsubscribe = subscribe(renderAll);
    signal.addEventListener("abort", unsubscribe);
    window.addEventListener("beforeunload", () => flushSave(), { signal });
    document.body.appendChild(win.root);
    renderAll();
    mounted2 = { controller, win };
  }
  function hideTierList() {
    if (!mounted2) return;
    flushSave();
    mounted2.controller.abort();
    mounted2.win.root.remove();
    mounted2 = null;
  }
  function initTierList(plugin) {
    settings2 = createFeatureSettings(plugin, "tierlist", {
      tab: "Tier List",
      visible: () => isPluginEnabled("tierList")
    });
    settings2.add("cardSize", {
      name: "Card Size",
      note: "How big cards get in a large window. They shrink in a small one.",
      type: "select",
      options: Object.keys(CARD_SIZES),
      default: "Medium",
      onChange: () => {
        if (mounted2) mounted2.win.refreshTileSize();
      }
    });
    registerKeybind(plugin, {
      key: "toggleTierList",
      name: "Toggle Tier List",
      defaultCode: "KeyL",
      packageLabel: "Tier List",
      onMatch: () => {
        if (!isPluginEnabled("tierList")) return;
        if (mounted2) hideTierList();
        else showTierList();
      }
    });
    if (!isPluginEnabled("tierList")) return;
    initItemData(plugin);
  }

  // packages/misc/index.js
  function initMisc(plugin) {
    const settings3 = registerMiscSettings(plugin);
    initCardTags(plugin, settings3.enableCardTags);
    initTierList(plugin);
    let shownThisPage = null;
    function syncNotepadVisibility() {
      const wanted = shownThisPage !== null ? shownThisPage : settings3.notepadOpenOnLoad.value();
      if (settings3.enableNotepad.value() && wanted) {
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
        shownThisPage = !isNotepadOpen();
        syncNotepadVisibility();
      }
    });
    registerKeybind(plugin, {
      key: "resetNotepad",
      name: "Reset Notepad",
      defaultCode: "KeyN",
      packageLabel: "Notepad",
      onMatch: () => {
        const wasOpen = isNotepadOpen();
        forceResetNotepad();
        if (wasOpen) showNotepad();
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
    return settings3;
  }

  // packages/controller/storage.js
  var GM_PREFIX3 = "wizascript.controller.";
  function csGet(key2, fallback) {
    try {
      const v = GM_getValue(GM_PREFIX3 + key2, null);
      return v === null || v === void 0 ? fallback : v;
    } catch (e) {
      console.warn("[Wizascript Controller] GM_getValue failed, falling back to default:", e);
      return fallback;
    }
  }
  function csSet(key2, value) {
    try {
      GM_setValue(GM_PREFIX3 + key2, value);
    } catch (e) {
      console.warn("[Wizascript Controller] GM_setValue failed, binding will not persist:", e);
    }
  }
  function csDelete(key2) {
    try {
      GM_deleteValue(GM_PREFIX3 + key2);
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
  function getCursorSensitivity() {
    const raw = csGet("cursorSensitivity", null);
    if (raw === null) return 0;
    const n = parseFloat(raw);
    return Number.isNaN(n) ? 0 : Math.max(-1, Math.min(1, n));
  }
  function setCursorSensitivity(v) {
    csSet("cursorSensitivity", String(Math.max(-1, Math.min(1, v))));
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
    controllerActionKeys.forEach((key2) => migrate("keybinds." + key2));
    hardwareShortcutKeys.forEach((key2) => migrate("shortcuts." + key2));
    csSet("migratedToPresetsV056", "true");
    console.log("[Wizascript Controller] migrated any pre-preset-system bindings into Preset 1.");
  }
  function resetPresetBindings(presetN, controllerActionKeys, hardwareShortcutKeys) {
    const prefix = "preset" + presetN + ".";
    csDelete(prefix + "keybinds.__primary");
    csDelete(prefix + "keybinds.__channelGuide");
    controllerActionKeys.forEach((key2) => csDelete(prefix + "keybinds." + key2));
    hardwareShortcutKeys.forEach((key2) => csDelete(prefix + "shortcuts." + key2));
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
    { key: "moveCardDown", name: "Move Card Down", packageLabel: "Patch Maker", context: "patchMaker", defaultButton: 13, dispatch: { code: "ArrowDown", key: "ArrowDown" } },
    // Relays Patch Maker's own real "Cycle Category Up/Down" keybind
    // (packages/patch-maker/overlay.js - Comma/Period by default,
    // scope:'scoped'/selector:'.uc-li-text', same registry Move Entry/
    // Section/Card Up/Down above already relay into successfully) exactly
    // the same way those do: dispatch the real e.code Wizascript's own
    // registry is listening for while Primary is synthetically held, and
    // let that registry's own document.activeElement/selector check
    // decide whether it actually applies. defaultButton is D-pad Left/
    // Right (14/15) rather than Up/Down (12/13, already claimed by Move
    // Entry/Section/Card in this same 'patchMaker' context) specifically
    // to avoid a same-frame double-fire - Up/Down and Left/Right dispatch
    // different e.codes, so sharing a button between two 'patchMaker'
    // actions would relay BOTH every time it's pressed. Left/Right is
    // free here: previousChannel/nextChannel above claim the same two
    // buttons, but only under 'channelSwitch' context, which is mutually
    // exclusive with 'patchMaker' by construction (see the `applies`
    // check in index.js's relay). This is very likely the actual
    // technical snag from the earlier, abandoned attempt at this exact
    // feature - reusing Up/Down here would produce confusing dual
    // behavior (moving the entry AND cycling its category on the same
    // press) that could easily read as "wiring it was a pain," even
    // though the underlying relay mechanism itself works correctly in
    // isolation (proven by Move Entry/Section/Card already using it).
    { key: "cycleCategoryUp", name: "Cycle Category Up", packageLabel: "Patch Maker", context: "patchMaker", defaultButton: 14, dispatch: { code: "Comma", key: "," } },
    { key: "cycleCategoryDown", name: "Cycle Category Down", packageLabel: "Patch Maker", context: "patchMaker", defaultButton: 15, dispatch: { code: "Period", key: "." } }
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
    // Key kept as-is (stored bindings use it); shown as Card Tracker since 1.5.0.
    { key: "openDeckTrackerPresets", name: "Open Card Tracker Presets", pluginId: "cardTracker" }
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
  function encodeBoundInput(value) {
    if (value === null || value === void 0) return "unbound";
    if (typeof value === "number") return String(value);
    if (value && value.type === "key") return "kb:" + value.code;
    return "unbound";
  }
  function decodeBoundInput(raw, defaultValue) {
    if (raw === "unbound") return null;
    if (typeof raw === "string" && raw.indexOf("kb:") === 0) return { type: "key", code: raw.slice(3) };
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? defaultValue : n;
  }
  function getControllerPrimaryButton() {
    return decodeBoundInput(csGet(presetKey("keybinds.__primary"), String(DEFAULT_PRIMARY_BUTTON)), DEFAULT_PRIMARY_BUTTON);
  }
  function setControllerPrimaryButton(value) {
    csSet(presetKey("keybinds.__primary"), encodeBoundInput(value));
  }
  function getChannelGuideButton() {
    return decodeBoundInput(csGet(presetKey("keybinds.__channelGuide"), "unbound"), null);
  }
  function setChannelGuideButton(value) {
    csSet(presetKey("keybinds.__channelGuide"), encodeBoundInput(value));
  }
  function getBoundButton(actionKey) {
    const action = CONTROLLER_ACTIONS_BY_KEY[actionKey];
    return decodeBoundInput(csGet(presetKey("keybinds." + actionKey), String(action.defaultButton)), action.defaultButton);
  }
  function setBoundButton(actionKey, value) {
    csSet(presetKey("keybinds." + actionKey), encodeBoundInput(value));
  }
  function getBoundShortcutButton(actionKey) {
    const defaultButton = HARDWARE_SHORTCUT_DEFAULTS[actionKey];
    return decodeBoundInput(csGet(presetKey("shortcuts." + actionKey), String(defaultButton)), defaultButton);
  }
  function setBoundShortcutButton(actionKey, value) {
    csSet(presetKey("shortcuts." + actionKey), encodeBoundInput(value));
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
  function observeDebugTextCheckbox(el2) {
    el2.setAttribute("data-wc-enhanced", "true");
    debugTextCheckedLive = !!el2.checked;
    el2.addEventListener("change", () => {
      debugTextCheckedLive = !!el2.checked;
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
  function observeHighlightColorSelect(el2) {
    el2.setAttribute("data-wc-enhanced", "true");
    highlightColorLive = el2.value || null;
    el2.addEventListener("change", () => {
      highlightColorLive = el2.value || null;
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
  function enhanceControllerInfoRow(el2) {
    el2.setAttribute("data-wc-enhanced", "true");
    el2.readOnly = true;
    el2.tabIndex = -1;
    el2.style.display = "none";
  }
  function enhanceControllerCaptureInput(el2, readBound, writeBound) {
    el2.setAttribute("data-wc-enhanced", "true");
    el2.readOnly = true;
    Object.assign(el2.style, {
      cursor: "pointer",
      backgroundColor: "black",
      color: "white",
      border: "1px solid #b4b4b4",
      borderRadius: "3px",
      textAlign: "center"
    });
    function refreshDisplay() {
      el2.value = bindingToDisplay(readBound());
    }
    refreshDisplay();
    boundInputRefreshers.push(refreshDisplay);
    el2.addEventListener("focus", () => {
      el2.style.border = "1px solid #40E0D0";
      el2.style.boxShadow = "0 0 4px #40E0D0";
      el2.value = "Press a button or key...";
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
      function finishCapture(value) {
        if (cancelled) return;
        cancelled = true;
        writeBound(value);
        cleanup();
        el2.blur();
      }
      function onKeydown(e) {
        if (cancelled) return;
        if (e.key === "Escape") {
          e.preventDefault();
          cancelled = true;
          writeBound(null);
          cleanup();
          el2.blur();
          return;
        }
        if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return;
        const gpNow = getMergedGamepad();
        if (gpNow && gpNow.buttons.some((b) => b && b.pressed)) return;
        e.preventDefault();
        finishCapture({ type: "key", code: e.code });
      }
      function cleanup() {
        document.removeEventListener("keydown", onKeydown, true);
      }
      document.addEventListener("keydown", onKeydown, true);
      requestAnimationFrame(captureFrame);
      el2.addEventListener("blur", function onBlur() {
        cancelled = true;
        controllerCaptureActive = false;
        el2.style.border = "1px solid #b4b4b4";
        el2.style.boxShadow = "none";
        cleanup();
        refreshDisplay();
        scheduleControllerConflictRefresh();
        el2.removeEventListener("blur", onBlur);
      });
    });
  }
  var presetMenuState = null;
  function getPresetMenuState() {
    return presetMenuState;
  }
  function enhancePresetSelector(el2) {
    el2.setAttribute("data-wc-enhanced", "true");
    el2.readOnly = true;
    el2.tabIndex = 0;
    Object.assign(el2.style, {
      cursor: "pointer",
      backgroundColor: "black",
      color: "white",
      border: "1px solid #b4b4b4",
      borderRadius: "3px",
      textAlign: "center"
    });
    function refreshDisplay() {
      el2.value = getPresetName(getActivePreset());
    }
    refreshDisplay();
    boundInputRefreshers.push(refreshDisplay);
    let menuEl = null;
    function onOutsideClick(e) {
      if (menuEl && !menuEl.contains(e.target) && e.target !== el2) closeMenu();
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
      const rect = el2.getBoundingClientRect();
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
          if (isDebugTextEnabled()) console.log("[Wizascript Controller] switched to preset", n, "(" + getPresetName(n) + ")");
        });
        menuEl.appendChild(row);
        rowEls.push(row);
      }
      document.body.appendChild(menuEl);
      document.addEventListener("mousedown", onOutsideClick, true);
      document.addEventListener("keydown", onEscape, true);
      presetMenuState = { rows: rowEls, activeIndex: Math.max(0, getActivePreset() - 1), close: closeMenu };
    }
    el2.addEventListener("click", openMenu);
  }
  function enhancePresetNameInput(el2) {
    el2.setAttribute("data-wc-enhanced", "true");
    el2.readOnly = false;
    Object.assign(el2.style, {
      backgroundColor: "black",
      color: "white",
      border: "1px solid #b4b4b4",
      borderRadius: "3px",
      textAlign: "center"
    });
    function refreshDisplay() {
      if (document.activeElement !== el2) el2.value = getPresetName(getActivePreset());
    }
    refreshDisplay();
    boundInputRefreshers.push(refreshDisplay);
    function commit() {
      setPresetName(getActivePreset(), el2.value);
      boundInputRefreshers.forEach((fn) => fn());
    }
    el2.addEventListener("blur", commit);
    el2.addEventListener("keydown", (e) => {
      if (e.key === "Enter") el2.blur();
    });
  }
  function enhanceResetButton(el2) {
    el2.setAttribute("data-wc-enhanced", "true");
    el2.readOnly = true;
    el2.tabIndex = 0;
    Object.assign(el2.style, {
      cursor: "pointer",
      backgroundColor: "black",
      color: "white",
      border: "1px solid #b4b4b4",
      borderRadius: "3px",
      textAlign: "center"
    });
    function refreshDisplay() {
      el2.value = "Double Click to Reset";
    }
    refreshDisplay();
    boundInputRefreshers.push(refreshDisplay);
    el2.addEventListener("dblclick", () => {
      resetPresetBindings(getActivePreset(), CONTROLLER_ACTIONS.map((a) => a.key), HARDWARE_SHORTCUT_ACTIONS.map((a) => a.key));
      boundInputRefreshers.forEach((fn) => fn());
      el2.value = "\u2705 Reset to Defaults";
      setTimeout(refreshDisplay, 1500);
    });
  }
  function enhanceDetectControllerButton(el2) {
    el2.setAttribute("data-wc-enhanced", "true");
    el2.readOnly = true;
    el2.tabIndex = 0;
    Object.assign(el2.style, {
      cursor: "pointer",
      backgroundColor: "black",
      color: "white",
      border: "1px solid #b4b4b4",
      borderRadius: "3px",
      textAlign: "center"
    });
    function refreshDisplay() {
      el2.value = isHidConnected() ? "\u2705 Controller Detected (WebHID)" : "\u{1F3AE} Click to Detect Controller (WebHID)";
    }
    refreshDisplay();
    boundInputRefreshers.push(refreshDisplay);
    el2.addEventListener("click", async () => {
      if (isHidConnected()) return;
      el2.value = "Check your browser's device picker\u2026";
      try {
        await connectWebHidController();
      } finally {
        refreshDisplay();
      }
    });
  }
  var CONFLICT_CLASS = "wizascript-controller-warning";
  var BUILT_IN_BUTTON_USES = {
    0: "clicks / selects",
    1: "goes back / cancels",
    3: "right-clicks",
    12: "navigates up",
    13: "navigates down",
    14: "navigates left",
    15: "navigates right",
    5: "opens UnderScript's menu (and switches tabs in Settings)"
  };
  var GUIDE_BUTTONS = /* @__PURE__ */ new Set([0, 12, 13, 14, 15]);
  function sameInput(a, b) {
    if (a === null || a === void 0 || b === null || b === void 0) return false;
    if (typeof a === "number" || typeof b === "number") return a === b;
    return a.type === "key" && b.type === "key" && a.code === b.code;
  }
  function contextsOverlap(a, b) {
    if (a === "always" || b === "always") return true;
    const outside = (c) => c === "channelSwitch" || c === "default";
    if (outside(a) && outside(b)) return true;
    return a === "patchMaker" && b === "patchMaker";
  }
  function computeControllerConflicts() {
    const out = /* @__PURE__ */ new Map();
    const add = (key2, msg) => {
      if (!out.has(key2)) out.set(key2, []);
      out.get(key2).push(msg);
    };
    const primary2 = getControllerPrimaryButton();
    const guide = isPluginEnabled("ucTv") ? getChannelGuideButton() : null;
    const combos = CONTROLLER_ACTIONS.filter((a) => {
      const id = pluginIdForLabel(a.packageLabel);
      return !id || isPluginEnabled(id);
    }).map((a) => ({ a, input: getBoundButton(a.key), code: getBoundKeybindCode(a.key, a.dispatch.code) })).filter((c) => c.input !== null);
    const shortcuts = HARDWARE_SHORTCUT_ACTIONS.filter((a) => !a.pluginId || isPluginEnabled(a.pluginId)).map((a) => ({ a, row: "shortcut_" + a.key, input: getBoundShortcutButton(a.key) })).filter((c) => c.input !== null);
    const comboName = (a) => `${a.name} (Primary + ${bindingToDisplay(getBoundButton(a.key))})`;
    if (primary2 !== null && typeof primary2 === "number" && BUILT_IN_BUTTON_USES[primary2]) {
      add("controllerPrimary", `This button also ${BUILT_IN_BUTTON_USES[primary2]}, which stops working while it's your Primary.`);
    }
    if (guide !== null) {
      if (sameInput(guide, primary2)) {
        add("channelGuide", "Same button as Controller Primary.");
        add("controllerPrimary", "Same button as Channel Guide.");
      }
      if (typeof guide === "number" && GUIDE_BUTTONS.has(guide)) {
        add("channelGuide", "The channel guide uses the d-pad and " + bindingToDisplay(0) + " to pick a channel, so this button would clash with it.");
      }
    }
    shortcuts.forEach(({ a, row, input }, i) => {
      if (sameInput(input, primary2)) {
        add(row, "Same button as Controller Primary - pressing Primary will also do this.");
        add("controllerPrimary", `Same button as ${a.name} - pressing Primary will also do that.`);
      }
      if (sameInput(input, guide)) {
        add(row, "Same button as Channel Guide - both will happen.");
        add("channelGuide", `Same button as ${a.name} - both will happen.`);
      }
      shortcuts.forEach(({ a: other, input: otherInput }, j) => {
        if (i !== j && sameInput(input, otherInput)) add(row, `Same button as ${other.name} - both will happen.`);
      });
      if (typeof input === "number" && BUILT_IN_BUTTON_USES[input]) {
        add(row, `This button also ${BUILT_IN_BUTTON_USES[input]}, so pressing it will do both.`);
      }
      combos.forEach(({ a: combo, input: comboInput }) => {
        if (!sameInput(input, comboInput)) return;
        add(row, `Also used by ${comboName(combo)} - that combo will trigger this too.`);
        add(combo.key, `This button is also ${a.name} (In-Game Inputs), which will trigger too.`);
      });
    });
    combos.forEach(({ a, input, code }, i) => {
      if (sameInput(input, primary2)) add(a.key, "Same button as Controller Primary, so this combo can't be pressed.");
      if (sameInput(input, guide)) add(a.key, "Same button as Channel Guide - both will happen.");
      combos.forEach(({ a: other, input: otherInput, code: otherCode }, j) => {
        if (i === j || !sameInput(input, otherInput) || code === otherCode) return;
        if (!contextsOverlap(a.context, other.context)) return;
        add(a.key, `Same button as ${other.name} - both will happen.`);
      });
    });
    return out;
  }
  function refreshControllerConflictWarnings() {
    const prefix = "underscript.plugin.Wizascript.controller.";
    if (!document.querySelector(`[id^="${prefix}"]`)) return;
    const conflicts = computeControllerConflicts();
    const rowKeys = ["controllerPrimary", "channelGuide"].concat(CONTROLLER_ACTIONS.map((a) => a.key)).concat(HARDWARE_SHORTCUT_ACTIONS.map((a) => "shortcut_" + a.key));
    rowKeys.forEach((key2) => {
      const input = document.getElementById(prefix + key2);
      const row = input && input.closest(".flex-start");
      if (!row) return;
      const messages = conflicts.get(key2) || [];
      let warn = row.querySelector(`:scope > .${CONFLICT_CLASS}`);
      if (!messages.length) {
        if (warn) warn.remove();
        return;
      }
      const text = messages.map((m) => "\u26A0 " + m).join("\n");
      if (!warn) {
        warn = document.createElement("div");
        warn.className = `setting-description ${CONFLICT_CLASS}`;
        Object.assign(warn.style, { color: "#ffb347", opacity: "1", whiteSpace: "pre-line" });
        row.appendChild(warn);
      }
      if (warn.textContent !== text) warn.textContent = text;
    });
  }
  var controllerConflictRefreshQueued = false;
  function scheduleControllerConflictRefresh() {
    if (controllerConflictRefreshQueued) return;
    controllerConflictRefreshQueued = true;
    setTimeout(() => {
      controllerConflictRefreshQueued = false;
      refreshControllerConflictWarnings();
    }, 0);
  }
  boundInputRefreshers.push(scheduleControllerConflictRefresh);
  var controllerObserverStarted = false;
  function startControllerKeybindObserver(idPrefix) {
    if (controllerObserverStarted) return;
    controllerObserverStarted = true;
    let everFoundOne = false;
    const observer2 = new MutationObserver(() => {
      const matches = document.querySelectorAll(`input[id^="${idPrefix}"]:not([data-wc-enhanced]), select[id^="${idPrefix}"]:not([data-wc-enhanced])`);
      if (matches.length) scheduleControllerConflictRefresh();
      matches.forEach((el2) => {
        everFoundOne = true;
        const bindingKey = el2.id.slice(idPrefix.length);
        if (bindingKey.startsWith("__info_")) {
          enhanceControllerInfoRow(el2);
          return;
        }
        if (bindingKey === "detectController") {
          enhanceDetectControllerButton(el2);
          return;
        }
        if (bindingKey === "presetSelector") {
          enhancePresetSelector(el2);
          return;
        }
        if (bindingKey === "presetName") {
          enhancePresetNameInput(el2);
          return;
        }
        if (bindingKey === "resetPreset") {
          enhanceResetButton(el2);
          return;
        }
        if (bindingKey === "controllerPrimary") {
          enhanceControllerCaptureInput(el2, () => getControllerPrimaryButton(), (v) => setControllerPrimaryButton(v));
          return;
        }
        if (bindingKey === "channelGuide") {
          enhanceControllerCaptureInput(el2, () => getChannelGuideButton(), (v) => setChannelGuideButton(v));
          return;
        }
        if (CONTROLLER_ACTIONS_BY_KEY[bindingKey]) {
          enhanceControllerCaptureInput(el2, () => getBoundButton(bindingKey), (v) => setBoundButton(bindingKey, v));
          return;
        }
        if (bindingKey.startsWith("shortcut_")) {
          const shortcutKey = bindingKey.slice("shortcut_".length);
          if (HARDWARE_SHORTCUT_ACTIONS_BY_KEY[shortcutKey]) {
            enhanceControllerCaptureInput(el2, () => getBoundShortcutButton(shortcutKey), (v) => setBoundShortcutButton(shortcutKey, v));
            return;
          }
        }
        if (bindingKey === "debugTextEnabled") {
          observeDebugTextCheckbox(el2);
          return;
        }
        if (bindingKey === "highlightColor") {
          observeHighlightColorSelect(el2);
          return;
        }
        el2.setAttribute("data-wc-enhanced", "true");
      });
    });
    observer2.observe(document.body, { childList: true, subtree: true });
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
    const settings3 = createFeatureSettings(plugin, "controller", {
      tab: "Controller Support",
      visible: () => isPluginEnabled("controller"),
      categories: true
    });
    const SETUP = "Setup";
    const GENERAL = "General";
    const IN_GAME = "In-Game Inputs";
    const hiddenUnless = (pluginId) => () => pluginId ? !isPluginEnabled(pluginId) : false;
    settings3.add("detectController", {
      name: "Detect Controller",
      note: "Click if your controller isn't responding.",
      type: "text",
      default: "Click to Detect Controller (WebHID)",
      category: SETUP
    });
    settings3.add("presetSelector", {
      name: "Settings Preset",
      note: "Click to switch presets.",
      type: "text",
      default: getPresetName(getActivePreset()),
      category: SETUP
    });
    settings3.add("presetName", {
      name: "Preset Name",
      note: "Renames whichever preset is currently selected above.",
      type: "text",
      default: getPresetName(getActivePreset()),
      category: SETUP
    });
    settings3.add("resetPreset", {
      name: "Restore Settings to Default",
      note: "Double Click to reset selected preset settings",
      type: "text",
      default: "Double Click to Reset",
      category: SETUP
    });
    debugTextEnabledSetting = settings3.add("debugTextEnabled", {
      name: "Enable Debug Text",
      type: "boolean",
      default: false,
      category: GENERAL
    });
    highlightColorSetting = settings3.add("highlightColor", {
      name: "Selection Outline Color",
      type: "select",
      data: HIGHLIGHT_COLOR_PRESETS,
      default: DEFAULT_HIGHLIGHT_COLOR,
      category: GENERAL
    });
    settings3.add("controllerPrimary", {
      name: "Controller Primary",
      note: "Click to remap. Hold for combos below, same as Wizascript's own Primary Key.",
      type: "text",
      default: buttonToDisplay(DEFAULT_PRIMARY_BUTTON),
      category: GENERAL
    });
    settings3.add("__info_openSettings", { name: "Double Tap Primary \u2192 Open Wizascript Settings", type: "text", default: "", category: GENERAL });
    const seenLabels = /* @__PURE__ */ new Set();
    CONTROLLER_ACTIONS.forEach((action) => {
      if (!seenLabels.has(action.packageLabel)) {
        seenLabels.add(action.packageLabel);
        if (action.packageLabel === "UC TV") {
          settings3.add("channelGuide", {
            name: "Channel Guide (hold)",
            type: "text",
            default: buttonToDisplay(null),
            category: "UC TV",
            hidden: hiddenUnless("ucTv")
          });
        }
      }
      settings3.add(action.key, {
        name: action.name + " - Primary + <btn>",
        type: "text",
        default: buttonToDisplay(action.defaultButton),
        category: action.packageLabel,
        hidden: hiddenUnless(pluginIdForLabel(action.packageLabel))
      });
    });
    HARDWARE_SHORTCUT_ACTIONS.forEach((action) => {
      settings3.add("shortcut_" + action.key, {
        name: action.name,
        type: "text",
        default: buttonToDisplay(HARDWARE_SHORTCUT_DEFAULTS[action.key]),
        category: IN_GAME,
        hidden: hiddenUnless(action.pluginId)
      });
    });
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
    const SENSITIVITY_BAR_HEIGHT = 120;
    const sensitivityBar = document.createElement("div");
    Object.assign(sensitivityBar.style, {
      position: "fixed",
      top: "50%",
      right: "18px",
      transform: "translateY(-50%)",
      width: "14px",
      height: SENSITIVITY_BAR_HEIGHT + "px",
      background: "rgba(0,0,0,0.55)",
      border: "1px solid rgba(255,255,255,0.4)",
      borderRadius: "7px",
      zIndex: 2147483647,
      pointerEvents: "none",
      display: "none"
    });
    const sensitivityBarCenterTick = document.createElement("div");
    Object.assign(sensitivityBarCenterTick.style, {
      position: "absolute",
      left: "-4px",
      right: "-4px",
      top: "50%",
      height: "2px",
      background: "rgba(255,255,255,0.6)",
      transform: "translateY(-1px)"
    });
    sensitivityBar.appendChild(sensitivityBarCenterTick);
    const sensitivityBarFill = document.createElement("div");
    Object.assign(sensitivityBarFill.style, {
      position: "absolute",
      left: "2px",
      right: "2px",
      background: "#40E0D0",
      borderRadius: "2px"
    });
    sensitivityBar.appendChild(sensitivityBarFill);
    const sensitivityBarLabel = document.createElement("div");
    Object.assign(sensitivityBarLabel.style, {
      position: "absolute",
      right: "20px",
      top: "50%",
      transform: "translateY(-50%)",
      background: "rgba(0,0,0,0.75)",
      color: "white",
      font: "11px monospace",
      padding: "2px 6px",
      borderRadius: "3px",
      whiteSpace: "nowrap"
    });
    sensitivityBar.appendChild(sensitivityBarLabel);
    let sensitivityBarHideTimer = null;
    function showSensitivityBar(sensitivity) {
      const mult = Math.max(0.3, Math.min(3, 1 - sensitivity * 2));
      const halfTrack = SENSITIVITY_BAR_HEIGHT / 2 - 2;
      const fillLen = Math.abs(sensitivity) * halfTrack;
      if (sensitivity <= 0) {
        sensitivityBarFill.style.top = halfTrack - fillLen + "px";
        sensitivityBarFill.style.height = fillLen + "px";
      } else {
        sensitivityBarFill.style.top = halfTrack + 2 + "px";
        sensitivityBarFill.style.height = fillLen + "px";
      }
      sensitivityBarLabel.textContent = mult.toFixed(1) + "x";
      sensitivityBar.style.display = "block";
      if (sensitivityBarHideTimer) clearTimeout(sensitivityBarHideTimer);
      sensitivityBarHideTimer = setTimeout(() => {
        sensitivityBar.style.display = "none";
      }, 700);
    }
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
      justifyContent: "center",
      // FIXED: oskEl itself is deliberately pointerEvents:'none' (so a
      // real mouse click passes straight through the OSK panel to
      // whatever's underneath, since the panel's own key grid is
      // controller-hover-driven, not mouse-clickable) - but pointer-events
      // is an inherited CSS property, so without its own explicit 'auto'
      // override, this close badge silently inherited 'none' from its
      // parent too and was never clickable by anything, mouse OR
      // controller (the physical Circle button closes the OSK through its
      // own separate keybind path entirely, unrelated to this element's
      // screen position - this badge had no click handler wired to it at
      // all before now). cursor:'pointer' is just a visual affordance
      // matching the new real behavior.
      pointerEvents: "auto",
      cursor: "pointer"
    });
    oskClose.textContent = "\u2715";
    oskClose.title = "Close";
    oskClose.addEventListener("click", () => closeOsk());
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
      selectRowEls.forEach((el2, i) => {
        const active = i === selectIndex;
        el2.style.boxShadow = active ? "inset 0 0 0 999px rgba(255,255,255,0.18)" : "none";
      });
    }
    function mount() {
      if (!document.body) {
        requestAnimationFrame(mount);
        return;
      }
      document.body.appendChild(hud);
      document.body.appendChild(pressIndicator);
      document.body.appendChild(sensitivityBar);
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
        const items = Array.from(container.querySelectorAll(def.itemSelector)).filter((el2) => el2.offsetParent !== null);
        if (items.length) {
          if (isDebugTextEnabled()) console.log(`[Wizascript Controller] group "${def.name}" found via "${sel}": ${items.length} items`);
          return { name: def.name, container, items };
        }
      }
      if (isDebugTextEnabled()) console.log(`[Wizascript Controller] group "${def.name}" NOT found`);
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
      return els.filter((el2) => el2.offsetParent !== null);
    }
    function queryBoardMonsterCards() {
      const slots = Array.from(document.querySelectorAll(".droppableMonster.slot, .droppableMonster"));
      const cards2 = slots.map((s) => s.querySelector(".card")).filter((c) => c && c.offsetParent !== null);
      if (!cards2.length) return [];
      const rows = buildRowGrid(cards2);
      if (!rows.length) return [];
      let bestRow = rows[0], bestTop = -Infinity;
      for (const row of rows) {
        const avgTop = row.reduce((sum, el2) => sum + el2.getBoundingClientRect().top, 0) / row.length;
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
      for (const el2 of b) if (!setA.has(el2)) return false;
      return true;
    }
    function buildRowGrid(els, rowTolerance = 28) {
      const withRect = els.map((el2) => ({ el: el2, r: el2.getBoundingClientRect() })).sort((a, b) => a.r.top - b.r.top);
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
      if (isDebugTextEnabled()) console.log("[Wizascript Controller] card drag started", card);
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
      if (isDebugTextEnabled()) console.log("[Wizascript Controller] card drag cancelled via", reason);
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
      return Array.from(root.querySelectorAll(MODAL_ITEM_SELECTOR)).filter((el2) => el2.offsetParent !== null);
    }
    function queryScrollableListItems(root) {
      const scrollable = findScrollableDescendant(root);
      if (!scrollable) return [];
      const items = [];
      Array.from(scrollable.children).forEach((row) => {
        if (row.tagName !== "DIV") return;
        Array.from(row.children).filter((c) => c.tagName === "SPAN").forEach((s) => items.push(s));
      });
      return items.filter((el2) => el2.offsetParent !== null);
    }
    function sidebarLabels(view) {
      const out = [];
      Array.from(view.children).forEach((el2) => {
        if (el2.classList.contains("tabLabel")) out.push(el2);
        else if (el2.classList.contains("tabContent") && el2.classList.contains("nested")) {
          const inner = el2.querySelector(":scope > .tabbedView");
          if (inner) out.push(...sidebarLabels(inner));
        }
      });
      return out;
    }
    function queryCategoryItems(tabbedRoot) {
      return sidebarLabels(tabbedRoot).filter((el2) => el2.offsetParent !== null).sort((a, b) => {
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        if (Math.abs(ra.top - rb.top) > 2) return ra.top - rb.top;
        return ra.left - rb.left;
      });
    }
    function isTabLabelChecked(label) {
      const radio = label && label.previousElementSibling;
      return !!(radio && radio.tagName === "INPUT" && radio.checked);
    }
    function isFoldLabel(label) {
      const content = label && label.nextElementSibling;
      return !!(content && content.classList.contains("tabContent") && content.classList.contains("nested"));
    }
    function queryActiveTabContent(tabbedRoot) {
      let view = tabbedRoot;
      for (let depth = 0; view && depth < 5; depth++) {
        const label = Array.from(view.querySelectorAll(":scope > .tabLabel")).find(isTabLabelChecked);
        const content = label && label.nextElementSibling;
        if (!content || !content.classList.contains("tabContent")) return null;
        if (!content.classList.contains("nested")) return content;
        view = content.querySelector(":scope > .tabbedView");
      }
      return null;
    }
    function queryFieldRows(root) {
      const flexRows = Array.from(root.querySelectorAll(".flex-start")).filter((row) => row.offsetParent !== null).map((row) => Array.from(row.querySelectorAll(MODAL_ITEM_SELECTOR)).filter((el2) => el2.offsetParent !== null)).filter((items) => items.length);
      const labelRows = /* @__PURE__ */ new Map();
      Array.from(root.querySelectorAll(".tabLabel")).filter((el2) => el2.offsetParent !== null && !(el2.classList.contains("wizascript-tab-arrow") && el2.classList.contains("disabled"))).forEach((el2) => {
        const key2 = el2.parentElement;
        if (!labelRows.has(key2)) labelRows.set(key2, []);
        labelRows.get(key2).push(el2);
      });
      const bareLabels = Array.from(labelRows.values()).map((row) => row.sort((a, b) => {
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        if (Math.abs(ra.top - rb.top) > 2) return ra.top - rb.top;
        return ra.left - rb.left;
      }));
      const rows = [...bareLabels, ...flexRows];
      if (rows.length) return rows;
      return buildRowGrid(queryModalItems(root));
    }
    function enterCategory() {
      const cat = categoryItems[categoryIndex];
      if (!cat) return;
      triggerElementClick(cat);
      if (isFoldLabel(cat)) {
        const modalInfo = queryModalRoot();
        if (modalInfo && modalInfo.tabbedRoot) {
          categoryItems = queryCategoryItems(modalInfo.tabbedRoot);
          const inner = cat.nextElementSibling.querySelector(":scope > .tabbedView");
          const firstChild = categoryItems.findIndex((l) => inner && l.parentElement === inner);
          if (firstChild >= 0) categoryIndex = firstChild;
          if (isDebugTextEnabled()) console.log("[Wizascript Controller] settings: unfolded", JSON.stringify(cat.textContent), "->", categoryItems.map((l) => l.textContent));
        }
        return;
      }
      modalPane = "fields";
      fieldGrid = null;
      fieldRow = 0;
      fieldCol = 0;
      if (fieldSubmenu) {
        fieldSubmenu.onCancel && fieldSubmenu.onCancel();
        fieldSubmenu = null;
      }
    }
    const SETTINGS_TAB_PREV_BUTTON = 4;
    const SETTINGS_TAB_NEXT_BUTTON = 5;
    let shoulderHeld = { 4: false, 5: false };
    function pluginTabRow(content) {
      const view = content && content.querySelector(".tabbedView:not(.single)");
      if (!view) return null;
      const labels = Array.from(view.querySelectorAll(":scope > .tabLabel")).filter((l) => !l.classList.contains("wizascript-tab-arrow"));
      return labels.length > 1 ? labels : null;
    }
    function cycleSettingsTab(dir, tabbedRoot) {
      const row = modalPane === "fields" ? pluginTabRow(queryActiveTabContent(tabbedRoot)) : null;
      if (row) {
        const cur2 = Math.max(0, row.findIndex(isTabLabelChecked));
        const target2 = row[(cur2 + dir + row.length) % row.length];
        triggerElementClick(target2);
        if (isDebugTextEnabled()) console.log("[Wizascript Controller] settings: tab", dir > 0 ? "next" : "previous", "->", target2.textContent);
        return target2;
      }
      const cats = categoryItems.filter((l) => !isFoldLabel(l) || !isTabLabelChecked(l));
      if (!cats.length) return null;
      const curLabel = categoryItems.find((l) => isTabLabelChecked(l) && !isFoldLabel(l));
      const cur = Math.max(0, cats.indexOf(curLabel));
      const target = cats[(cur + dir + cats.length) % cats.length];
      triggerElementClick(target);
      if (isFoldLabel(target)) {
        const modalInfo = queryModalRoot();
        if (modalInfo && modalInfo.tabbedRoot) categoryItems = queryCategoryItems(modalInfo.tabbedRoot);
        const shown = categoryItems.find((l) => isTabLabelChecked(l) && !isFoldLabel(l));
        categoryIndex = shown ? categoryItems.indexOf(shown) : categoryItems.indexOf(target);
      } else {
        categoryIndex = categoryItems.indexOf(target);
      }
      if (isDebugTextEnabled()) console.log("[Wizascript Controller] settings: category", dir > 0 ? "next" : "previous", "->", target.textContent);
      return null;
    }
    function selectedColInTabRow(row) {
      if (!row || !row.length || !row.every((el2) => el2.classList && el2.classList.contains("tabLabel"))) return -1;
      return row.findIndex(isTabLabelChecked);
    }
    function findModalDismissButton(root) {
      const byAttr = root.querySelector('[data-dismiss="modal"], .close');
      if (byAttr) return byAttr;
      const buttons = Array.from(root.querySelectorAll("button"));
      return buttons.find((b) => /close|cancel|^no$/i.test((b.textContent || "").trim())) || null;
    }
    function isWizascriptSettingsOpen() {
      const m = queryModalRoot();
      return !!(m && m.kind === "tabbed");
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
      const state2 = chromeStates[chromeIndex];
      if (!state2 || state2.type !== "group") return null;
      const g = state2.group;
      const idx = itemIndexByGroupName[g.name] || 0;
      return g.items[idx] || null;
    }
    function setHighlight(el2) {
      if (!el2) return;
      el2.style.outline = `${getHighlightThickness()}px solid ${getHighlightColor()}`;
      el2.style.outlineOffset = "2px";
    }
    function clearHighlight(el2) {
      if (!el2) return;
      el2.style.outline = "";
      el2.style.outlineOffset = "";
    }
    function refreshHighlight() {
      if (navInputMethod !== "dpad") {
        if (currentHighlightedEl) {
          clearHighlight(currentHighlightedEl);
          currentHighlightedEl = null;
        }
        return;
      }
      const el2 = currentFocusedEl();
      if (el2 === currentHighlightedEl) return;
      if (currentHighlightedEl) clearHighlight(currentHighlightedEl);
      if (el2) setHighlight(el2);
      currentHighlightedEl = el2;
    }
    function isTextInput(el2) {
      if (!el2) return false;
      if (el2.readOnly) return false;
      if (el2.tagName === "TEXTAREA") return true;
      if (el2.tagName === "INPUT") {
        const type = (el2.type || "text").toLowerCase();
        return ["text", "search", "email", "url", "tel", "password", "number"].includes(type);
      }
      return !!el2.isContentEditable;
    }
    function isSlider(el2) {
      return !!el2 && el2.tagName === "INPUT" && (el2.type || "").toLowerCase() === "range";
    }
    function isNativeSelect(el2) {
      return !!el2 && el2.tagName === "SELECT";
    }
    function placeCaretAtPoint(el2, cx, cy) {
      if (!el2 || !el2.isContentEditable) return;
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
      if (range && el2.contains(range.startContainer)) {
        const sel = pageWindow2.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        if (isDebugTextEnabled()) console.log("[Wizascript Controller] caret repositioned in", el2, "at", cx, cy);
      }
    }
    function firstTextNode(el2) {
      const walker = document.createTreeWalker(el2, NodeFilter.SHOW_TEXT);
      return walker.nextNode();
    }
    function lastTextNode(el2) {
      const walker = document.createTreeWalker(el2, NodeFilter.SHOW_TEXT);
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
      if (isDebugTextEnabled()) console.log("[Wizascript Controller] OSK opened for", target);
    }
    function closeOsk() {
      oskOpen = false;
      oskPaused = false;
      oskEl.style.display = "none";
      if (oskTarget) oskTarget.blur();
      oskTarget = null;
      if (isDebugTextEnabled()) console.log("[Wizascript Controller] OSK closed");
    }
    function dispatchEnterKey(el2) {
      el2.focus();
      const scope = el2.closest("form") || el2.closest(".chat-box") || el2.parentElement;
      const submitEl = scope && scope.querySelector('input[type="submit"]');
      if (submitEl) {
        submitEl.click();
        return;
      }
      const opts = { bubbles: true, cancelable: true, key: "Enter", code: "Enter", keyCode: 13, which: 13, view: pageWindow2 };
      el2.dispatchEvent(new KeyboardEvent("keydown", opts));
      el2.dispatchEvent(new KeyboardEvent("keypress", opts));
      el2.dispatchEvent(new KeyboardEvent("keyup", opts));
    }
    let scrollMirrorEl = null;
    function measureTextWidth(el2, text) {
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
      const cs = getComputedStyle(el2);
      scrollMirrorEl.style.font = cs.font;
      scrollMirrorEl.style.letterSpacing = cs.letterSpacing;
      scrollMirrorEl.style.textTransform = cs.textTransform;
      scrollMirrorEl.textContent = text;
      return scrollMirrorEl.getBoundingClientRect().width;
    }
    function scrollFieldToCaret(el2) {
      if (!el2 || el2.isContentEditable) return;
      if (typeof el2.selectionEnd !== "number") return;
      const pos = el2.selectionEnd;
      const caretX = measureTextWidth(el2, el2.value.slice(0, pos));
      const visibleWidth = el2.clientWidth;
      const margin = 12;
      if (caretX - el2.scrollLeft > visibleWidth - margin) {
        el2.scrollLeft = caretX - visibleWidth + margin;
      } else if (caretX - el2.scrollLeft < margin) {
        el2.scrollLeft = Math.max(0, caretX - margin);
      }
    }
    function typeChar(el2, ch) {
      el2.focus();
      const info = keyInfo(ch);
      const base = { bubbles: true, cancelable: true, key: ch, code: info.code, keyCode: info.keyCode, which: info.keyCode, view: pageWindow2 };
      el2.dispatchEvent(new KeyboardEvent("keydown", base));
      el2.dispatchEvent(new KeyboardEvent("keypress", base));
      document.execCommand("insertText", false, ch);
      el2.dispatchEvent(new KeyboardEvent("keyup", base));
      scrollFieldToCaret(el2);
    }
    function typeBackspace(el2) {
      el2.focus();
      const base = { bubbles: true, cancelable: true, key: "Backspace", code: "Backspace", keyCode: 8, which: 8, view: pageWindow2 };
      el2.dispatchEvent(new KeyboardEvent("keydown", base));
      document.execCommand("delete");
      el2.dispatchEvent(new KeyboardEvent("keyup", base));
      scrollFieldToCaret(el2);
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
    function openSlider(el2) {
      sliderTarget = el2;
      setHighlight(el2);
      cursor.style.display = "none";
      if (isDebugTextEnabled()) console.log("[Wizascript Controller] slider focused", el2, "value=", el2.value, "min=", el2.min, "max=", el2.max, "step=", el2.step);
    }
    function closeSlider() {
      if (sliderTarget) clearHighlight(sliderTarget);
      sliderTarget = null;
    }
    function adjustSlider(dir) {
      if (!sliderTarget) return;
      const el2 = sliderTarget;
      const step = parseFloat(el2.step) || 1;
      const min = el2.min !== "" ? parseFloat(el2.min) : -Infinity;
      const max = el2.max !== "" ? parseFloat(el2.max) : Infinity;
      let val = parseFloat(el2.value) || 0;
      val = Math.max(min, Math.min(max, val + dir * step));
      nativeValueSetter.call(el2, String(val));
      el2.dispatchEvent(new Event("input", { bubbles: true }));
      el2.dispatchEvent(new Event("change", { bubbles: true }));
    }
    function setSliderValueFromPointer(el2, clientX) {
      const rect = el2.getBoundingClientRect();
      if (!rect.width) return;
      const min = el2.min !== "" ? parseFloat(el2.min) : 0;
      const max = el2.max !== "" ? parseFloat(el2.max) : 100;
      const step = parseFloat(el2.step) || 1;
      let frac = (clientX - rect.left) / rect.width;
      frac = Math.max(0, Math.min(1, frac));
      let val = min + frac * (max - min);
      val = Math.round(val / step) * step;
      val = Math.max(min, Math.min(max, val));
      nativeValueSetter.call(el2, String(val));
      el2.dispatchEvent(new Event("input", { bubbles: true }));
      el2.dispatchEvent(new Event("change", { bubbles: true }));
    }
    let selectTarget = null, selectOptions = [], selectIndex = 0;
    function openSelectPicker(el2) {
      selectTarget = el2;
      selectOptions = Array.from(el2.options);
      selectIndex = Math.max(0, selectOptions.findIndex((o) => o.selected));
      const selCs = getComputedStyle(el2);
      const selBg = selCs.backgroundColor;
      selectEl.style.background = selBg && selBg !== "rgba(0, 0, 0, 0)" ? selBg : "#000";
      selectEl.style.border = `${selCs.borderTopWidth} ${selCs.borderTopStyle} ${selCs.borderTopColor}`;
      selectEl.style.borderRadius = selCs.borderRadius;
      selectEl.style.fontFamily = selCs.fontFamily;
      selectEl.style.fontSize = selCs.fontSize;
      renderSelectOptions();
      selectEl.style.display = "block";
      positionPanelNear(selectEl, el2);
      updateSelectHighlight();
      cursor.style.display = "block";
      if (isDebugTextEnabled()) console.log("[Wizascript Controller] select picker opened", el2, selectOptions.map((o) => o.text));
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
      const el2 = currentFocusedEl();
      if (!el2) return;
      const rect = el2.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      if (isPatchMakerResetButton(el2)) {
        activatePatchMakerResetButton(el2, cx, cy);
        return;
      }
      dispatchClick(el2, cx, cy, button === 2 ? 2 : 0);
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
      if (isNativeSelect(el2)) {
        openSelectPicker(el2);
        return;
      }
      if (isSlider(el2)) {
        openSlider(el2);
        return;
      }
      if (el2.matches && el2.matches(".uc-section-label, .uc-card-item")) {
        el2.focus();
        return;
      }
      if (el2.readOnly && (el2.tagName === "INPUT" || el2.tagName === "TEXTAREA")) {
        el2.focus();
        return;
      }
      if (isTextInput(el2)) {
        openOsk(el2);
        if (el2.isContentEditable) placeCaretAtPoint(el2, cx, cy);
        return;
      }
      if (!activeSubmenu && el2.classList.contains("dropdown-toggle")) {
        const items = findDropdownMenuNear(el2);
        if (items.length) {
          activeSubmenu = { toggle: el2, items, index: 0 };
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
    const STICK_DEADZONE = 0.15;
    function dz(v) {
      const mag = Math.abs(v);
      if (mag < STICK_DEADZONE) return 0;
      const rescaled = (mag - STICK_DEADZONE) / (1 - STICK_DEADZONE);
      return v < 0 ? -rescaled : rescaled;
    }
    const heldKeyCodes = /* @__PURE__ */ new Set();
    document.addEventListener("keydown", (e) => {
      heldKeyCodes.add(e.code);
    });
    document.addEventListener("keyup", (e) => {
      heldKeyCodes.delete(e.code);
    });
    function isBoundInputDown(value, btnFn) {
      if (value === null || value === void 0) return false;
      if (typeof value === "number") return !!btnFn(value);
      if (value.type === "key") return heldKeyCodes.has(value.code);
      return false;
    }
    let cursorSensitivity = getCursorSensitivity();
    let sensitivityAdjusting = false;
    const SENSITIVITY_ADJUST_RATE = 0.02;
    function currentCursorSpeedMult() {
      return Math.max(0.3, Math.min(3, 1 - cursorSensitivity * 2));
    }
    function findRealScrollable(el2) {
      let node = el2;
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
    function fire(el2, type, ctor, clientX, clientY, button, buttons) {
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
      el2.dispatchEvent(new ctor(type, opts));
    }
    function dispatchClick(el2, cx, cy, button) {
      if (button === 2) {
        fire(el2, "pointerdown", PointerEvent, cx, cy, 2, 2);
        fire(el2, "mousedown", MouseEvent, cx, cy, 2, 2);
        fire(el2, "pointerup", PointerEvent, cx, cy, 2, 0);
        fire(el2, "mouseup", MouseEvent, cx, cy, 2, 0);
        fire(el2, "contextmenu", MouseEvent, cx, cy, 2, 0);
        return;
      }
      fire(el2, "pointerdown", PointerEvent, cx, cy, 0, 1);
      fire(el2, "mousedown", MouseEvent, cx, cy, 0, 1);
      fire(el2, "pointerup", PointerEvent, cx, cy, 0, 0);
      fire(el2, "mouseup", MouseEvent, cx, cy, 0, 0);
      fire(el2, "click", MouseEvent, cx, cy, 0, 0);
    }
    function isPatchMakerResetButton(el2) {
      return !!el2 && el2.tagName === "BUTTON" && el2.textContent && el2.textContent.trim() === "Reset Data";
    }
    let lastResetBtnPressTime = 0;
    function activatePatchMakerResetButton(el2, cx, cy) {
      const now = performance.now();
      const isConfirmPress = now - lastResetBtnPressTime < DOUBLE_TAP_WINDOW_MS2;
      const detail = isConfirmPress ? 2 : 1;
      fire(el2, "pointerdown", PointerEvent, cx, cy, 0, 1);
      fire(el2, "mousedown", MouseEvent, cx, cy, 0, 1);
      fire(el2, "pointerup", PointerEvent, cx, cy, 0, 0);
      fire(el2, "mouseup", MouseEvent, cx, cy, 0, 0);
      el2.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: pageWindow2, clientX: cx, clientY: cy, button: 0, buttons: 0, detail }));
      lastResetBtnPressTime = isConfirmPress ? 0 : now;
      if (isDebugTextEnabled()) console.log("[Wizascript Controller] Reset Data pressed, detail =", detail, isConfirmPress ? "(confirmed - resetting)" : "(press again to confirm)");
    }
    function triggerElementClick(el2) {
      if (!el2) return;
      const r = el2.getBoundingClientRect();
      dispatchClick(el2, r.left + r.width / 2, r.top + r.height / 2, 0);
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
          if (isDebugTextEnabled()) console.log("[Wizascript Controller] concede: used Underscript's own Surrender menu entry");
          return;
        }
        attempts2++;
        if (attempts2 < MAX_ATTEMPTS) {
          requestAnimationFrame(poll);
          return;
        }
        if (isDebugTextEnabled()) console.log("[Wizascript Controller] concede: no Surrender entry found in Underscript's menu, falling back to the native flow");
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
        if (isDebugTextEnabled()) console.log("[Wizascript Controller] concede: settings button not found (not in a match?)");
        return;
      }
      if (!isWizascriptSettingsOpen()) {
        triggerElementClick(configBtn);
      } else if (isDebugTextEnabled()) {
        console.log("[Wizascript Controller] concede: Settings already open - skipped opening a duplicate, going straight to polling for the surrender button");
      }
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
        else if (isDebugTextEnabled()) console.log("[Wizascript Controller] concede: gave up waiting for the surrender button after opening settings");
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
      const state2 = drag[side];
      drag[side] = null;
      if (!state2) return;
      cursor.style.display = "none";
      const hitEl = document.elementFromPoint(x, y);
      cursor.style.display = "block";
      if (!hitEl) return;
      if (button === 2) {
        fire(hitEl, "pointerup", PointerEvent, x, y, 2, 0);
        fire(hitEl, "mouseup", MouseEvent, x, y, 2, 0);
        if (hitEl === state2.downEl) fire(hitEl, "contextmenu", MouseEvent, x, y, 2, 0);
      } else {
        fire(hitEl, "pointerup", PointerEvent, x, y, 0, 0);
        fire(hitEl, "mouseup", MouseEvent, x, y, 0, 0);
        if (hitEl === state2.downEl) fire(hitEl, "click", MouseEvent, x, y, 0, 0);
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
    function resolveHoverStyle(el2) {
      const finalProps = /* @__PURE__ */ new Map();
      for (const { selector, style } of hoverRules) {
        try {
          if (!el2.matches(selector)) continue;
        } catch (e) {
          continue;
        }
        for (let i = 0; i < style.length; i++) {
          const prop = style[i];
          finalProps.set(prop, [style.getPropertyValue(prop), style.getPropertyPriority(prop)]);
        }
      }
      if (!finalProps.size) return;
      const originalProps = Array.from(finalProps.keys()).map((prop) => [prop, el2.style.getPropertyValue(prop), el2.style.getPropertyPriority(prop)]);
      hoverStyleMap.set(el2, {
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
    if (isDebugTextEnabled()) console.log(`[Wizascript Controller] resolved hover styles for ${hoverStyleMap.size} curated element(s)`);
    function findHoverTarget(el2) {
      if (!el2) return null;
      if (hoverStyleMap.has(el2)) return el2;
      const link = el2.closest && el2.closest("a");
      if (link && hoverStyleMap.has(link)) return link;
      return null;
    }
    function applyCuratedHover(el2) {
      const entry = hoverStyleMap.get(el2);
      if (!entry) return;
      for (const [prop, val, pr] of entry.finalProps) el2.style.setProperty(prop, val, pr);
    }
    function revertCuratedHover(el2) {
      const entry = hoverStyleMap.get(el2);
      if (!entry) return;
      for (const [prop, val, pr] of entry.originalProps) {
        if (val) el2.style.setProperty(prop, val, pr);
        else el2.style.removeProperty(prop);
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
    function updateHover(el2, cx, cy) {
      if (el2 !== lastHitEl) {
        if (lastHitEl) {
          fire(lastHitEl, "pointerout", PointerEvent, cx, cy, 0, 0);
          fire(lastHitEl, "mouseout", MouseEvent, cx, cy, 0, 0);
          fire(lastHitEl, "pointerleave", PointerEvent, cx, cy, 0, 0);
          fire(lastHitEl, "mouseleave", MouseEvent, cx, cy, 0, 0);
        }
        if (el2) {
          fire(el2, "pointerover", PointerEvent, cx, cy, 0, 0);
          fire(el2, "mouseover", MouseEvent, cx, cy, 0, 0);
          fire(el2, "pointerenter", PointerEvent, cx, cy, 0, 0);
          fire(el2, "mouseenter", MouseEvent, cx, cy, 0, 0);
        }
        lastHitEl = el2;
      }
      if (el2) {
        fire(el2, "pointermove", PointerEvent, cx, cy, 0, 0);
        fire(el2, "mousemove", MouseEvent, cx, cy, 0, 0);
      }
      const focused = currentFocusedEl();
      setHoverTarget(findHoverTarget(focused || el2));
    }
    document.addEventListener("mousemove", (e) => {
      if (!e.isTrusted) return;
      if (usingController) {
        if (isDebugTextEnabled()) console.log("[Wizascript Controller] real mouse movement detected -> forcing usingController OFF");
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
      const bound = getBoundShortcutButton(actionKey);
      const isDown = isBoundInputDown(bound, btnFn);
      const wasDown = !!shortcutHeldByAction[actionKey];
      shortcutHeldByAction[actionKey] = isDown;
      return isDown && !wasDown;
    }
    let keybindRelayHeld = { primary: false, controlDown: false, actions: {} };
    let wasCaptureActiveLastFrame = false;
    let guideMatchIndex = -1, guidePlayerIndex = 0, guideSelectedEl = null;
    let guideDpadHeld = { up: false, down: false, left: false, right: false };
    let guideBtn0Held = false;
    let guideNeedsReanchor = false;
    let leftHeldSince = 0, rightHeldSince = 0, lastPageTurnTime = 0;
    let dpadText = "";
    function openWizascriptSettings() {
      plugin.settings().open();
      if (isDebugTextEnabled()) console.log("[Wizascript Controller] opened Wizascript settings");
    }
    function frame() {
      try {
        const debugTextOn = isDebugTextEnabled();
        hud.style.display = debugTextOn ? "block" : "none";
        setDebugLoggingEnabled(debugTextOn);
        if (!isControllerSupportEnabled()) {
          if (usingController) {
            usingController = false;
            document.documentElement.style.cursor = "";
            cursor.style.display = "none";
            if (oskOpen) closeOsk();
          }
          if (sensitivityAdjusting) {
            setCursorSensitivity(cursorSensitivity);
            sensitivityAdjusting = false;
          }
          sensitivityBar.style.display = "none";
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
        if (rx !== 0) {
          cursorSensitivity = Math.max(-1, Math.min(1, cursorSensitivity + rx * SENSITIVITY_ADJUST_RATE));
          showSensitivityBar(cursorSensitivity);
          sensitivityAdjusting = true;
        } else if (sensitivityAdjusting) {
          setCursorSensitivity(cursorSensitivity);
          sensitivityAdjusting = false;
        }
        const captureActiveNow = isControllerCaptureActive();
        if (!wasCaptureActiveLastFrame && captureActiveNow) {
          if (keybindRelayHeld.controlDown) {
            document.dispatchEvent(new KeyboardEvent("keyup", { key: "Control", code: "ControlLeft", keyCode: 17, which: 17, bubbles: true }));
            keybindRelayHeld.controlDown = false;
          }
        } else if (wasCaptureActiveLastFrame && !captureActiveNow) {
          Object.keys(HARDWARE_SHORTCUT_ACTIONS_BY_KEY).forEach((key2) => {
            shortcutHeldByAction[key2] = isBoundInputDown(getBoundShortcutButton(key2), btn);
          });
          shortcutBtnHeld = { 1: btn(1), 5: btn(5) };
          keybindRelayHeld.primary = isBoundInputDown(getControllerPrimaryButton(), btn) || oskOpen && oskPaused;
          const resyncedActions = {};
          CONTROLLER_ACTIONS.forEach((action) => {
            resyncedActions[action.key] = isBoundInputDown(getBoundButton(action.key), btn);
          });
          keybindRelayHeld.actions = resyncedActions;
          guideDpadHeld = { up, down, left, right };
          guideBtn0Held = btn(0);
        }
        wasCaptureActiveLastFrame = captureActiveNow;
        const settingsTabsActive = !oskOpen && isWizascriptSettingsOpen();
        if (!isControllerCaptureActive()) {
          if (btn(5) && !shortcutBtnHeld[5]) {
            if (oskOpen) {
              oskPaused = !oskPaused;
              oskEl.style.display = oskPaused ? "none" : "block";
              if (!oskPaused && oskTarget) {
                positionPanelNear(oskEl, oskTarget);
                updateOskHighlight();
              }
              if (isDebugTextEnabled()) console.log("[Wizascript Controller] OSK", oskPaused ? "paused" : "resumed");
            } else if (!settingsTabsActive) {
              document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", code: "Escape", bubbles: true }));
            }
          }
          if (btn(1) && !shortcutBtnHeld[1] && oskOpen && oskPaused) closeOsk();
          if (shortcutJustPressed(btn, "openSettings")) {
            const openModal = queryModalRoot();
            if (openModal && openModal.kind === "tabbed") {
              if (debugTextOn) console.log("[Wizascript Controller] openSettings: Settings already open - closing instead of stacking another copy");
              const dismiss = findModalDismissButton(openModal.root);
              if (dismiss) triggerElementClick(dismiss);
              else document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", code: "Escape", bubbles: true }));
            } else {
              triggerElementClick(document.getElementById("btn-config"));
            }
          }
          if (shortcutJustPressed(btn, "yourDustpile") && !oskOpen) triggerElementClick(document.querySelector('.btn-dustpile[onclick*="openDustpile(true)"]'));
          if (shortcutJustPressed(btn, "opponentDustpile") && !oskOpen) triggerElementClick(document.querySelector('.btn-dustpile[onclick*="openDustpile(false)"]'));
          if (shortcutJustPressed(btn, "endTurn")) triggerElementClick(document.getElementById("endTurnBtn"));
          if (shortcutJustPressed(btn, "openWizascriptSettings") && !oskOpen) openWizascriptSettings();
          if (shortcutJustPressed(btn, "concede")) triggerConcede();
          if (shortcutJustPressed(btn, "goHome")) pageWindow2.location.href = "https://undercards.net/";
          if (shortcutJustPressed(btn, "openDeckTrackerPresets") && !oskOpen) triggerElementClick(document.getElementById("dt-add-tracker-button"));
          shortcutBtnHeld = { 1: btn(1), 5: btn(5) };
        }
        if ((!oskOpen || oskPaused) && !isControllerCaptureActive()) {
          const primaryBtn = getControllerPrimaryButton();
          const primaryIsShoulder = primaryBtn === SETTINGS_TAB_PREV_BUTTON || primaryBtn === SETTINGS_TAB_NEXT_BUTTON;
          const l1Down = isBoundInputDown(primaryBtn, btn) && !(settingsTabsActive && primaryIsShoulder) || oskOpen && oskPaused;
          const viaPause = oskOpen && oskPaused;
          const primaryBase = { key: "Control", code: "ControlLeft", keyCode: 17, which: 17, bubbles: true };
          const guideBtnForRelay = getChannelGuideButton();
          const guideDownForRelay = isBoundInputDown(guideBtnForRelay, btn);
          const controlShouldBeDown = l1Down || guideDownForRelay;
          if (controlShouldBeDown && !keybindRelayHeld.controlDown) {
            document.dispatchEvent(new KeyboardEvent("keydown", primaryBase));
            keybindRelayHeld.controlDown = true;
          } else if (!controlShouldBeDown && keybindRelayHeld.controlDown) {
            document.dispatchEvent(new KeyboardEvent("keyup", primaryBase));
            keybindRelayHeld.controlDown = false;
          }
          if (l1Down) {
            const relaySecondary = (code, key2) => {
              const opts = { key: key2, code, bubbles: true };
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
              const boundInput = applies ? getBoundButton(action.key) : null;
              const isDown = isBoundInputDown(boundInput, btn);
              nextActionHeld[action.key] = isDown;
              if (isDown && !keybindRelayHeld.actions[action.key]) {
                const liveCode = getBoundKeybindCode(action.key, action.dispatch.code);
                if (!codesFiredThisFrame.has(liveCode)) {
                  codesFiredThisFrame.add(liveCode);
                  relaySecondary(liveCode, action.dispatch.key);
                }
              }
            });
            keybindRelayHeld.actions = nextActionHeld;
            hud.textContent = inPatchMakerFieldForContext ? `Patch Maker (${viaPause ? "OSK paused" : "Primary held"})
move entry/section/card, cycle category \u2014 see Settings > Controller Support${viaPause ? `
R1: resume typing   ${btnLabel(1)}: close` : ""}` : `Wizascript keybind relay (${viaPause ? "OSK paused" : "Primary held"})
channel / notepad redo-undo-toggle-reset \u2014 see Settings > Controller Support${viaPause ? `
R1: resume typing   ${btnLabel(1)}: close` : ""}`;
          } else {
            keybindRelayHeld.actions = {};
          }
          keybindRelayHeld.primary = l1Down;
          if (l1Down) return;
        }
        if ((!oskOpen || oskPaused) && !isControllerCaptureActive()) {
          const guideBtn = getChannelGuideButton();
          const guideDown = isBoundInputDown(guideBtn, btn);
          if (guideDown) {
            const guideEl = document.getElementById("uctv-guide-overlay");
            if (!guideEl) {
              hud.textContent = `UC TV Guide loading\u2026
release ${bindingToDisplay(guideBtn)} to cancel`;
            } else {
              const playerSpans = Array.from(guideEl.querySelectorAll("span")).filter((el2) => el2.style.cursor === "pointer");
              const matches = [];
              const rows = [];
              const rowIndex = /* @__PURE__ */ new Map();
              playerSpans.forEach((el2) => {
                const row = el2.parentElement;
                if (!rowIndex.has(row)) {
                  rowIndex.set(row, matches.length);
                  matches.push([]);
                  rows.push(row);
                }
                matches[rowIndex.get(row)].push(el2);
              });
              if (!matches.length) {
                guideMatchIndex = -1;
                guidePlayerIndex = 0;
                guideSelectedEl = null;
                guideNeedsReanchor = false;
                hud.textContent = `UC TV Guide
no matches shown
release ${bindingToDisplay(guideBtn)} to close`;
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
release ${bindingToDisplay(guideBtn)} to close`;
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
\u2191/\u2193 match   \u2190/\u2192 player   ${btnLabel(0)} jump   release ${bindingToDisplay(guideBtn)} to close`;
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
          const oskSpeedMult = currentCursorSpeedMult();
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
          const selSpeedMult = currentCursorSpeedMult();
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
          const speedMult2 = currentCursorSpeedMult();
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
          const mulSpeedMult = currentCursorSpeedMult();
          x = Math.max(0, Math.min(pageWindow2.innerWidth, x + lx * BASE_SPEED * mulSpeedMult));
          y = Math.max(0, Math.min(pageWindow2.innerHeight, y + ly * BASE_SPEED * mulSpeedMult));
          cursor.style.left = x + "px";
          cursor.style.top = y + "px";
          cursor.style.display = cursorRestingDisplay();
          const mulliganCards = Array.from(mulliganHost.querySelectorAll(":scope > .card")).filter((el2) => el2.offsetParent !== null);
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
            const el2 = mulliganGrid[mulliganRow][mulliganCol];
            const r = el2.getBoundingClientRect();
            dispatchClick(el2, r.left + r.width / 2, r.top + r.height / 2, 0);
            if (isDebugTextEnabled()) console.log("[Wizascript Controller] mulligan item clicked", el2);
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
          const modSpeedMult = currentCursorSpeedMult();
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
              let activeIdx = categoryItems.findIndex((label) => isTabLabelChecked(label) && !isFoldLabel(label));
              if (activeIdx < 0) activeIdx = categoryItems.findIndex(isTabLabelChecked);
              if (activeIdx >= 0) {
                if (activeIdx !== lastKnownActiveCategoryIdx) categoryIndex = activeIdx;
                lastKnownActiveCategoryIdx = activeIdx;
              }
            }
            const activeContent = queryActiveTabContent(tabbedRoot);
            const liveFieldRows = activeContent ? queryFieldRows(activeContent) : [];
            const liveFieldsFlat = liveFieldRows.flat();
            if (!fieldGrid || !elArraysEqual(gridFlat(fieldGrid), liveFieldsFlat)) {
              const prevEl = fieldGrid && (fieldGrid[fieldRow] || [])[fieldCol];
              const prevArrowDir = prevEl && prevEl.classList && prevEl.classList.contains("wizascript-tab-arrow") ? prevEl.dataset.dir : null;
              fieldGrid = liveFieldRows;
              fieldRow = 0;
              fieldCol = 0;
              fieldNeedsReanchor = false;
              findPrev:
                for (let r = 0; r < fieldGrid.length; r++) {
                  for (let c = 0; c < fieldGrid[r].length; c++) {
                    const el2 = fieldGrid[r][c];
                    if (el2 === prevEl || prevArrowDir && el2.classList.contains("wizascript-tab-arrow") && el2.dataset.dir === prevArrowDir) {
                      fieldRow = r;
                      fieldCol = c;
                      break findPrev;
                    }
                  }
                }
              if (prevArrowDir && fieldRow === 0 && fieldCol === 0) {
                findArrow:
                  for (let r = 0; r < fieldGrid.length; r++) {
                    for (let c = 0; c < fieldGrid[r].length; c++) {
                      if (fieldGrid[r][c].classList.contains("wizascript-tab-arrow")) {
                        fieldRow = r;
                        fieldCol = c;
                        break findArrow;
                      }
                    }
                  }
              }
              if (isDebugTextEnabled()) {
                const path = [];
                for (let el2 = activeContent; el2 && el2 !== tabbedRoot; el2 = el2.parentElement) {
                  if (el2.classList.contains("tabContent") && el2.previousElementSibling) path.unshift(el2.previousElementSibling.textContent.trim());
                }
                console.log(
                  "[Wizascript Controller] settings: categories =",
                  categoryItems.map((l) => l.textContent.trim()),
                  "| showing =",
                  path.join(" > ") || "(none found)",
                  "| field rows =",
                  fieldGrid.length,
                  fieldGrid.map((row) => row.length),
                  "| selected =",
                  `${fieldRow},${fieldCol}`
                );
              }
            }
            if (fieldGrid.length) {
              fieldRow = Math.min(fieldRow, fieldGrid.length - 1);
              fieldCol = Math.min(fieldCol, fieldGrid[fieldRow].length - 1);
            }
            const l1Now = btn(SETTINGS_TAB_PREV_BUTTON), r1Now = btn(SETTINGS_TAB_NEXT_BUTTON);
            if (!isControllerCaptureActive() && !fieldSubmenu) {
              const dir = r1Now && !shoulderHeld[5] ? 1 : l1Now && !shoulderHeld[4] ? -1 : 0;
              if (dir) {
                navInputMethod = "dpad";
                const switchedTo = cycleSettingsTab(dir, tabbedRoot);
                if (switchedTo && modalPane === "fields") {
                  fieldGrid = [[switchedTo]];
                  fieldRow = 0;
                  fieldCol = 0;
                }
              }
            }
            shoulderHeld = { 4: l1Now, 5: r1Now };
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
              const capturing = isControllerCaptureActive();
              if (!capturing) {
                if (up && !dpadHeld.up && categoryItems.length) categoryIndex = Math.max(0, categoryIndex - 1);
                if (down && !dpadHeld.down && categoryItems.length) categoryIndex = Math.min(categoryItems.length - 1, categoryIndex + 1);
                if (right && !dpadHeld.right) enterCategory();
              }
              dpadHeld = { up, down, left, right };
              refreshHighlight();
              if (btn(0) && !btnHeld[0] && !capturing) enterCategory();
              if (btn(1) && !btnHeld[1] && !capturing) {
                const dismiss = findModalDismissButton(root);
                if (dismiss) triggerElementClick(dismiss);
                else document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", code: "Escape", bubbles: true }));
              }
              btnHeld = { 0: btn(0), 1: btn(1), 2: btn(2), 3: btn(3) };
              hud.textContent = `settings: categories (${categoryItems.length ? categoryIndex + 1 : 0}/${categoryItems.length})
${btnLabel(0)}/\u2192 open category   ${btnLabel(1)} close dialog   ${btnLabel(4)}/${btnLabel(5)} switch tab`;
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
                    const rowBefore = fieldRow;
                    if (up && !dpadHeld.up) fieldRow = Math.max(0, fieldRow - 1);
                    if (down && !dpadHeld.down) fieldRow = Math.min(fieldGrid.length - 1, fieldRow + 1);
                    fieldCol = Math.min(fieldCol, fieldGrid[fieldRow].length - 1);
                    if (fieldRow !== rowBefore) {
                      const sel = selectedColInTabRow(fieldGrid[fieldRow]);
                      if (sel >= 0) fieldCol = sel;
                    }
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
${btnLabel(0)} activate   ${btnLabel(3)} alt-activate   \u2190/${btnLabel(1)} back to categories   ${btnLabel(4)}/${btnLabel(5)} switch tab`;
            }
            return;
          }
          const modalItems = kind === "plain" ? [...queryModalItems(root), ...queryScrollableListItems(root)] : queryModalItems(root);
          if (!modalItems.length) {
            hud.textContent = `${kind === "menu" ? "underscript menu" : "dialog"} (nothing navigable found)`;
            return;
          }
          if (!modalGrid || !elArraysEqual(gridFlat(modalGrid), modalItems)) {
            modalGrid = kind === "menu" ? modalItems.map((el2) => [el2]) : buildRowGrid(modalItems);
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
          const mSpeedMult = currentCursorSpeedMult();
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
                if (isDebugTextEnabled()) console.log("[Wizascript Controller] card dropped on", targetSlot);
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
                const el2 = resolveGrid[resolveRow][resolveCol];
                const r = el2.getBoundingClientRect();
                dispatchClick(el2, r.left + r.width / 2, r.top + r.height / 2, 0);
                if (isDebugTextEnabled()) console.log("[Wizascript Controller] resolve target confirmed (d-pad)", el2);
              } else {
                cursor.style.display = "none";
                const hitEl2 = document.elementFromPoint(x, y);
                cursor.style.display = cursorRestingDisplay();
                if (hitEl2) {
                  dispatchClick(hitEl2, x, y, 0);
                  if (isDebugTextEnabled()) console.log("[Wizascript Controller] resolve target confirmed (cursor, real hit-test)", hitEl2);
                }
              }
            }
            if (resolveKind === "target" && btn(1) && !btnHeld[1]) {
              if (pendingAttacker) {
                const r = pendingAttacker.getBoundingClientRect();
                dispatchClick(pendingAttacker, r.left + r.width / 2, r.top + r.height / 2, 0);
                if (isDebugTextEnabled()) console.log("[Wizascript Controller] attack cancelled via Circle (re-clicked attacker)", pendingAttacker);
              } else {
                if (isDebugTextEnabled()) console.log("[Wizascript Controller] Circle pressed during target-resolve with no known attacker (likely a spell/effect target, not an attack) - no action taken");
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
                if (isDebugTextEnabled()) console.log("[Wizascript Controller] card not playable, ignoring", card);
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
                if (isDebugTextEnabled()) console.log("[Wizascript Controller] monster clicked to select as attacker", monster);
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
        const speedMult = currentCursorSpeedMult();
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
        const state2 = chromeStates[chromeIndex];
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
        } else if (state2 && state2.type === "group") {
          if (up && !dpadHeld.up) {
            chromeIndex = Math.max(0, chromeIndex - 1);
            refreshHighlight();
          }
          if (down && !dpadHeld.down) {
            chromeIndex = Math.min(chromeStates.length - 1, chromeIndex + 1);
            refreshHighlight();
          }
          const g = state2.group;
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
    const installState = runMigrations();
    registerPluginToggles(plugin);
    registerAboutSection(plugin);
    registerBackupSection(plugin);
    registerDebugSetting(plugin);
    initTabBar(plugin);
    initPatchMaker(plugin);
    initTrueHubBridge(plugin);
    initDeckTracker(plugin);
    initUcTv(plugin);
    const miscSettings = initMisc(plugin);
    initKeybinds(plugin);
    initController(plugin, miscSettings.enableController);
    registerPluginGuides(plugin);
    flushKeybindRegistrations();
    showWhatsNew(plugin, installState);
  });
})();
