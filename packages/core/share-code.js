// packages/core/share-code.js
//
// Shared plumbing for "copy this code / paste a code" features - the
// full settings backup (core/backup.js) and Card Tags sharing
// (misc/card-tags/share.js).
//
// Code format:  WZ-<KIND>-<v>.<base64>
//   v = 1 -> base64 of gzip'd UTF-8 JSON (CompressionStream)
//   v = 0 -> base64 of plain UTF-8 JSON (fallback where gzip is missing)
// The kind tag means a Card Tags code pasted into the backup importer
// (or vice versa) gets a clear error instead of doing something odd.
// Whitespace/newlines anywhere in a pasted code are ignored, so codes
// survive being wrapped by chat apps.

import { getPageWindow } from "./page-window.js";

function bytesToBase64(bytes) {
  let bin = "";
  const CHUNK = 0x8000;
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
  return typeof CompressionStream === "function" && typeof DecompressionStream === "function"
    && typeof Response === "function" && typeof Blob === "function";
}

export async function encodeCode(kind, payload) {
  const raw = new TextEncoder().encode(JSON.stringify(payload));
  if (hasGzip()) {
    try {
      const gz = await pipeThrough(raw, new CompressionStream("gzip"));
      return `WZ-${kind}-1.${bytesToBase64(gz)}`;
    } catch (e) { /* fall through to plain */ }
  }
  return `WZ-${kind}-0.${bytesToBase64(raw)}`;
}

// Throws an Error whose message is safe to show the player.
export async function decodeCode(text, kind) {
  const clean = String(text || "").replace(/\s+/g, "");
  if (!clean) throw new Error("Paste a code first.");
  const m = /^WZ-([A-Z]+)-(\d+)\.(.+)$/.exec(clean);
  if (!m) throw new Error("That doesn't look like a Wizascript code.");
  if (m[1] !== kind) {
    const names = { BACKUP: "a settings backup", TAGS: "a Card Tags code", TIER: "a tier list code" };
    throw new Error(`That's ${names[m[1]] || `a "${m[1]}" code`}, not ${names[kind] || kind}.`);
  }
  let bytes;
  try { bytes = base64ToBytes(m[3]); } catch (e) { throw new Error("The code is damaged or incomplete (make sure you copied all of it)."); }
  if (m[2] === "1") {
    if (!hasGzip()) throw new Error("This browser can't read compressed codes. Try a newer browser.");
    try { bytes = await pipeThrough(bytes, new DecompressionStream("gzip")); } catch (e) { throw new Error("The code is damaged or incomplete (make sure you copied all of it)."); }
  } else if (m[2] !== "0") {
    throw new Error("This code was made by a newer Wizascript. Update Wizascript and try again.");
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) {
    throw new Error("The code is damaged or incomplete (make sure you copied all of it).");
  }
}

/* ---------- dialogs ---------- */

function el(tag, props = {}, style = {}) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  Object.assign(node.style, style);
  return node;
}

const TEXTAREA_STYLE = {
  width: "100%", height: "140px", boxSizing: "border-box", resize: "vertical",
  fontFamily: "monospace", fontSize: "11px", wordBreak: "break-all",
  backgroundColor: "#111", color: "#ddd", border: "1px solid #666"
};

function getDialog() {
  const BootstrapDialog = getPageWindow().BootstrapDialog;
  if (!BootstrapDialog || typeof BootstrapDialog.show !== "function") {
    console.warn("[Wizascript] BootstrapDialog unavailable - cannot open this dialog here.");
    return null;
  }
  return BootstrapDialog;
}

async function copyText(text, textarea) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* fall back */ }
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
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Shows a finished code with Copy / Save buttons.
export function showExportDialog({ title, intro, code, fileName }) {
  const BootstrapDialog = getDialog();
  if (!BootstrapDialog) return;
  const wrapper = el("div");
  wrapper.appendChild(el("p", { textContent: intro }));
  const box = el("textarea", { readOnly: true, value: code, spellcheck: false }, TEXTAREA_STYLE);
  box.addEventListener("focus", () => box.select());
  wrapper.appendChild(box);
  const status = el("div", { textContent: `${code.length.toLocaleString()} characters` }, { marginTop: "4px", opacity: "0.7", fontSize: "0.9em" });
  wrapper.appendChild(status);
  BootstrapDialog.show({
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
      { label: "Save as file", action: () => { saveFile(code, fileName); status.textContent = `Saved as ${fileName}.`; } },
      { label: "Close", action: (d) => d.close() }
    ]
  });
}

// Paste box + "Load file…" + an action button. onSubmit(text) returns a
// promise; resolve with nothing to close the dialog, or throw an Error to
// show its message and keep the dialog open.
export function showImportDialog({ title, intro, actionLabel, onSubmit }) {
  const BootstrapDialog = getDialog();
  if (!BootstrapDialog) return;
  const wrapper = el("div");
  wrapper.appendChild(el("p", { textContent: intro }));
  const box = el("textarea", { placeholder: "Paste the code here…", spellcheck: false }, TEXTAREA_STYLE);
  wrapper.appendChild(box);
  const file = el("input", { type: "file", accept: ".txt,text/plain" }, { display: "none" });
  file.addEventListener("change", () => {
    const f = file.files && file.files[0];
    if (!f) return;
    f.text().then((t) => { box.value = t.trim(); status.textContent = `Loaded ${f.name}.`; status.style.color = ""; });
  });
  wrapper.appendChild(file);
  const status = el("div", {}, { marginTop: "4px", minHeight: "1.2em" });
  wrapper.appendChild(status);
  let busy = false;
  BootstrapDialog.show({
    title,
    message: wrapper,
    buttons: [
      { label: "Load file…", action: () => file.click() },
      {
        label: actionLabel,
        cssClass: "btn-primary",
        action: async (d) => {
          if (busy) return;
          busy = true;
          status.style.color = "";
          status.textContent = "Reading code…";
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

// A simple two-button confirm built on BootstrapDialog (never confirm()).
export function showConfirmDialog({ title, message, confirmLabel, onConfirm, cancelLabel = "Cancel", danger = true }) {
  const BootstrapDialog = getDialog();
  if (!BootstrapDialog) return;
  const wrapper = el("div");
  (Array.isArray(message) ? message : [message]).forEach((line) => wrapper.appendChild(el("p", { textContent: line })));
  BootstrapDialog.show({
    title,
    message: wrapper,
    buttons: [
      { label: confirmLabel, cssClass: danger ? "btn-danger" : "btn-primary", action: (d) => { d.close(); onConfirm(); } },
      { label: cancelLabel, action: (d) => d.close() }
    ]
  });
}

export function showInfoDialog({ title, message }) {
  const BootstrapDialog = getDialog();
  if (!BootstrapDialog) return;
  const wrapper = el("div");
  (Array.isArray(message) ? message : [message]).forEach((line) => wrapper.appendChild(el("p", { textContent: line })));
  BootstrapDialog.show({ title, message: wrapper, buttons: [{ label: "OK", cssClass: "btn-primary", action: (d) => d.close() }] });
}
