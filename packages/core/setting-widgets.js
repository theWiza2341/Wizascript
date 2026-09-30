// packages/core/setting-widgets.js
//
// Small shared helper for turning an ordinary UnderScript `type: 'text'`
// setting input into something else once it renders (a button, a
// read-only info line, etc). Same technique keybinds.js and the
// controller package already use: register a plain text setting to get
// a real <input> with a predictable id (underscript.plugin.Wizascript.
// <key>), then decorate it the moment it appears in the DOM.
//
// Custom UnderScript SettingType subclasses would be the "proper" way to
// do this, but Wizascript runs in Tampermonkey's sandbox (it grants GM_*
// functions), and subclassing a class that lives in the page's realm
// from the sandbox is not something we want to depend on across
// browsers. This keeps every setting a stock UnderScript type.

const ID_PREFIX = "underscript.plugin.Wizascript.";
const ENHANCED_ATTR = "data-wizascript-widget";
const enhancers = new Map(); // full key (without ID_PREFIX) -> (inputEl) => void
let observer = null;

function scan() {
  enhancers.forEach((enhance, key) => {
    const el = document.getElementById(ID_PREFIX + key);
    if (!el || el.hasAttribute(ENHANCED_ATTR)) return;
    el.setAttribute(ENHANCED_ATTR, "true");
    enhance(el);
  });
}

function ensureObserver() {
  if (observer || !document.body) return;
  observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true });
}

export function registerSettingWidget(fullKey, enhance) {
  enhancers.set(fullKey, enhance);
  if (document.body) ensureObserver();
  else document.addEventListener("DOMContentLoaded", ensureObserver, { once: true });
}

// Styles an input as a clickable button. `label` may be a function so
// it's re-read every time the settings screen re-renders.
export function asButton(label, onClick) {
  return (el) => {
    el.readOnly = true;
    el.value = typeof label === "function" ? label() : label;
    Object.assign(el.style, {
      cursor: "pointer",
      backgroundColor: "black",
      color: "white",
      border: "1px solid #b4b4b4",
      borderRadius: "3px",
      textAlign: "center"
    });
    el.addEventListener("click", (e) => {
      e.preventDefault();
      onClick(el);
    });
    // Keyboard activation, since the input is focusable.
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick(el);
      }
    });
  };
}

// Styles an input as plain, non-interactive text.
export function asInfo(text) {
  return (el) => {
    el.readOnly = true;
    el.tabIndex = -1;
    el.value = typeof text === "function" ? text() : text;
    Object.assign(el.style, {
      backgroundColor: "transparent",
      border: "none",
      color: "#ccc",
      cursor: "default",
      pointerEvents: "none"
    });
  };
}
