// packages/card-maker/gallery/dom.js
//
// h("div", { class, text, html, style: {...}, onclick, ...attrs }, ...children)
// Children can be nodes, strings or (nested) arrays; null/false are skipped.

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  kids.flat(Infinity).forEach((c) => { if (c !== null && c !== undefined && c !== false) el.append(c); });
  return el;
}

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function button(label, onclick, { title, primary, cls } = {}) {
  return h("button", { type: "button", class: `wz-cm-btn${primary ? " wz-gl-primary" : ""}${cls ? " " + cls : ""}`, title, onclick }, label);
}
