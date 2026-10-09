// packages/core/uc-report.js
//
// Wizascript's copy of the UC Report Hub helper (client/uc-report.js in the
// hub repo, format 1). Reports are ordinary chat messages in room 0, the
// "void" room, which feildmaster's chat-log Discord logs; the hub's bot files
// every "#WZ1 ..." message under reports/WZ/.
//
// Nothing here sends a message: openVoid() opens room 0 with the text typed
// in, and the player presses Enter (agreed with the mods, 2026-10-08).
//
// Wizascript's payloads (tag WZ, version 1):
//   #WZ1 CH 261008 161@28.0 20@PA   Card History: versions reported as wrong
//   #WZ1 v1.6.0: <text>             Report a Bug (General tab): the player's own words

import { getPageWindow } from "./page-window.js";

export const MAX_MESSAGE = 250;
export const TAG = "WZ";
export const VERSION = 1;
export const HEADER = `#${TAG}${VERSION} `;
const LINK_RE = /:\/\/|\bwww\.|\b[a-z0-9-]+\.(?:com|net|org|gg|io|me|ly|co|xyz|tv|app|dev)\b/i;

export function check(message) {
  const t = String(message || "").trim();
  if (t.length > MAX_MESSAGE) return { ok: false, error: `${t.length} characters; the chat keeps ${MAX_MESSAGE}` };
  if (!t.startsWith(HEADER)) return { ok: false, error: `must start with ${HEADER.trim()}` };
  if (LINK_RE.test(t)) return { ok: false, error: "looks like a link (the chat drops those)" };
  return { ok: true };
}

// Chat is on most pages, but not all.
export const canOpenVoid = () => typeof getPageWindow().openRoom === "function";

// Closes every open dialog (Wizascript's settings, Card History's windows),
// so the chat box is free to type in.
function closeDialogs() {
  const BD = getPageWindow().BootstrapDialog;
  if (!BD) return false;
  let any = false;
  try {
    if (BD.dialogs) Object.values(BD.dialogs).forEach((d) => { if (d && typeof d.close === "function" && (!d.isOpened || d.isOpened())) { d.close(); any = true; } });
    else if (typeof BD.closeAll === "function") { BD.closeAll(); any = true; }
  } catch (e) { /* nothing open */ }
  return any;
}

// Opens room 0 with `message` typed in. `select`: a part of it to select (a
// prompt the player types over). -> false if this page has no chat.
export function openVoid(message, select) {
  const w = getPageWindow();
  if (!canOpenVoid()) return false;
  const go = () => {
    if (!document.querySelector("#chat-public-0")) w.openRoom(0);
    let tries = 0;
    const fill = () => {
      const input = document.querySelector("#chat-public-0 .chat-text");
      if (!input) { if (++tries < 40) setTimeout(fill, 100); return; }
      input.value = message;
      input.focus();
      const at = select ? message.indexOf(select) : -1;
      if (at >= 0) input.setSelectionRange(at, at + select.length);
      else input.setSelectionRange(message.length, message.length);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    fill();
  };
  // Let a closing dialog finish its fade before the chat box takes focus.
  if (closeDialogs()) setTimeout(go, 350); else go();
  return true;
}
