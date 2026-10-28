// packages/card-maker/gallery/panel.js
//
// The Card Gallery inside the Card Maker's window: a panel over the
// editor (which stays loaded underneath), opened by the Gallery button in
// the title bar. Two tabs:
//   Submit  - Read from this editor (lists every group and card made in
//             the editor that's open, to tick what to add), or add files
//             (.uceditor, PNG). Added parts go in a tray: click to select,
//             link them into sets (A, B, C...), rename, remove, preview
//             the request.
//   Browse  - a PREVIEW of how the parts will look in the gallery: a
//             compact grid (sets as one row of cards with only the set
//             name), votes underneath, and the details in a hover card.
//             All Time / This Month / This Week. Until the gallery is live
//             its dates and scores are made up, and nothing is sent.
// A size control (S / M / L / Fill) zooms the cards on both tabs.

import { h, button } from "./dom.js";
import { tile, fitText, checkFrameImages, TILE_CSS } from "./render.js";
import { partFromRaw, readUcEditorFile, picturesFromPng, readFile } from "./parts.js";
import { getDraft, saveDraft, nextId, makeSet, tidySets, entries } from "./draft.js";
import { browseView, allEntries, BROWSE_CSS } from "./browse.js";

const STYLE_ID = "wizascript-cardgallery-style";
const TYPES = ["Monster", "Spell", "Enchantment", "Artifact"];
const COLORS = ["#e6b422", "#4aa3df", "#e05a5a", "#5cc46a", "#b07de0", "#e08a3c", "#3cc8c0", "#d65ca8"];
const TYPE_COLOR = { Monster: "#f0003c", Spell: "#41fcff", Enchantment: "#fca500", Artifact: "gold" };
const SOURCE_LABEL = { feildmaster: "feildmaster's editor", sernon: "UC Editor", picture: "picture" };
// Card sizes. Fill picks how many cards fit at full size, then stretches
// them so each row reaches the panel's edge.
const SIZES = [["small", "S", .55, "Small cards"], ["medium", "M", .75, "Medium cards"], ["large", "L", 1, "Full-size cards"], ["fill", "Fill", 0, "Zoom cards to fill the width"]];
const GAP = 10;

const CSS = `
.wz-gl-panel { --wz-gl-z: .6; position: absolute; inset: 0; z-index: 7; overflow: auto; background: #0d0d0d; padding: 10px; display: none; user-select: text; font: 12px Arial, sans-serif; color: #fff; }
.wz-gl-panel.on { display: block; }
.wz-gl-toggle.on, .wz-cm-btn.wz-gl-on { background: #4464bd; border-color: #8ea6e8; }
.wz-cm-btn.wz-gl-primary { background: #2f6b3a; border-color: #6fbf7e; }
.wz-cm-btn:disabled { opacity: .4; cursor: default; }
.wz-gl-panel input[type="text"], .wz-gl-panel select { color: #fff !important; background: #222 !important; border: 1px solid #666 !important; border-radius: 3px; font: 11px Arial, sans-serif; height: 22px; padding: 0 4px; box-shadow: none; }
.wz-gl-panel input[type="text"]::placeholder { color: #999; opacity: 1; }
.wz-gl-panel input[type="text"]:focus, .wz-gl-panel select:focus { border-color: #8ea6e8 !important; outline: none; }
.wz-gl-bar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 8px; }
.wz-gl-tabs { border-bottom: 1px solid #444; padding-bottom: 8px; margin-bottom: 10px; }
.wz-gl-status { opacity: .85; margin-left: 6px; }
.wz-gl-sizes { display: inline-flex; gap: 2px; align-items: center; }
.wz-gl-sizes .wz-cm-btn { min-width: 0; padding: 0 6px; }
.wz-gl-note { opacity: .7; margin: 0 0 8px; }
.wz-gl-grow { flex: 1 1 auto; }
.wz-gl-picker { border: 1px solid #444; background: #151515; padding: 6px 8px; margin: 8px 0; }
.wz-gl-picker label { cursor: pointer; font-weight: normal; }
.wz-gl-pgroup { margin: 5px 0; }
.wz-gl-pparts { display: flex; flex-wrap: wrap; gap: 2px 14px; margin: 2px 0 0 18px; }
.wz-gl-pparts .done { opacity: .5; }
.wz-gl-type { font-size: 10px; text-transform: uppercase; }
.wz-gl-sets { margin: 4px 0; }
.wz-gl-set { display: inline-flex; align-items: center; gap: 4px; margin: 2px 8px 2px 0; padding: 2px 6px; border-left: 6px solid; }
.wz-gl-tray { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.wz-gl-part { width: calc(176px * var(--wz-gl-z) + 14px); border: 2px solid #444; padding: 4px; position: relative; background: #111; }
.wz-gl-part.sel { border-color: #fff; background: #223; }
.wz-gl-part input, .wz-gl-part select { width: 100%; margin-bottom: 2px; }
.wz-gl-zoom { zoom: var(--wz-gl-z); cursor: pointer; margin: 0 auto 4px; width: max-content; }
.wz-gl-badge { position: absolute; top: -8px; left: -8px; width: 22px; height: 22px; border-radius: 11px; color: #000; font-weight: bold; text-align: center; line-height: 22px; z-index: 9; }
.wz-gl-x { position: absolute; top: 2px; right: 2px; z-index: 9; min-width: 0 !important; padding: 0 5px !important; height: 18px !important; line-height: 16px !important; }
.wz-gl-from { display: block; opacity: .55; font-size: 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.wz-gl-preview { white-space: pre-wrap; max-height: 260px; overflow: auto; background: #151515 !important; color: #ddd !important; border: 1px solid #444 !important; border-radius: 3px; padding: 6px; margin-top: 10px; font: 12px monospace; }
.wz-gl-grid { display: flex; flex-wrap: wrap; gap: 12px 10px; align-items: flex-end; }
.wz-gl-item { max-width: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.wz-gl-item.set { padding: 3px 4px 2px; border: 1px solid #444; border-radius: 4px; background: #141414; }
.wz-gl-setname { font-size: 11px; max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.wz-gl-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 3px; align-items: flex-end; }
.wz-gl-row > .wz-gl-zoom { margin: 0; cursor: default; }
.wz-gl-votes { display: flex; gap: 4px; align-items: center; }
.wz-gl-votes .wz-cm-btn { height: 18px; min-width: 20px; padding: 0 4px; font-size: 10px; line-height: 16px; }
.wz-gl-score { display: inline-block; min-width: 24px; text-align: center; font-weight: bold; }
.wz-gl-hover { position: fixed; z-index: 50; pointer-events: none; background: #000; border: 2px solid #fff; border-radius: 4px; padding: 6px; display: none; box-shadow: 0 6px 24px rgba(0,0,0,.8); color: #fff; font: 12px Arial, sans-serif; }
.wz-gl-hover.on { display: block; }
.wz-gl-hcard { zoom: 1.1; }
.wz-gl-hinfo { margin-top: 5px; line-height: 1.45; max-width: 200px; }
.wz-gl-hinfo b { font-size: 13px; }
.wz-gl-hinfo .dim { opacity: .7; }
${TILE_CSS}
${BROWSE_CSS}
`;

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = CSS;
  (document.head || document.documentElement).appendChild(s);
}

const setColor = (set) => COLORS[(set.letter.charCodeAt(0) - 65) % COLORS.length];
const sameCard = (p, source, group, raw) => p.source === source && p.editorGroup === group && p.name === (raw.name || "") && p.type === raw.type;

// requestRead(): asks the editor in the Card Maker for its cards, or
// returns a message saying why it can't. The answer comes back through
// receiveCards().
export function buildGalleryPanel({ requestRead, editorLabel }) {
  injectStyle();
  const draft = getDraft();
  let tab = draft.parts.length ? "browse" : "submit";
  const proto = draft.browseProto || {};
  const browse = { list: "new", layout: proto.layout || "slides", samples: proto.samples !== false, dir: null, shelfOpen: null };
  const sampleVotes = {};
  let read = null; // { source, label, groups: [{ name, parts: [raw + pick] }] }
  let readTimer = null;
  let preview = "";

  const status = h("span", { class: "wz-gl-status" });
  const say = (t) => { status.textContent = t; };
  const tabs = h("div", { class: "wz-gl-bar wz-gl-tabs" });
  const content = h("div");
  const hover = h("div", { class: "wz-gl-hover" });
  const panel = h("div", { class: "wz-gl-panel" }, tabs, content, hover);
  const fileInput = h("input", { type: "file", accept: ".uceditor,image/png", multiple: true, style: { display: "none" } });
  panel.appendChild(fileInput);

  // ---- Card size ----
  const sizeOf = () => SIZES.find((x) => x[0] === draft.size) || SIZES[1];
  function applyZoom() {
    let z = sizeOf()[2];
    if (!z) {
      const w = content.clientWidth || panel.clientWidth - 20;
      const pad = tab === "submit" ? 14 + 4 : 0; // a tray part's border and padding
      const cols = Math.max(1, Math.floor((w + GAP) / (176 + pad + GAP)));
      z = Math.max(.5, Math.min(2.5, ((w + GAP) / cols - GAP - pad) / 176));
    }
    z = Math.round(z * 100) / 100;
    if (panel.style.getPropertyValue("--wz-gl-z") === String(z)) return false;
    panel.style.setProperty("--wz-gl-z", String(z));
    return true;
  }
  let fitTimer = null;
  new ResizeObserver(() => {
    if (sizeOf()[2] || !panel.classList.contains("on")) return;
    if (applyZoom()) { clearTimeout(fitTimer); fitTimer = setTimeout(() => refit(), 120); }
  }).observe(panel);
  function sizeButtons() {
    return h("span", { class: "wz-gl-sizes", title: "Card size" },
      h("small", { text: "Size ", style: { opacity: ".7" } }),
      SIZES.map(([key, label, , title]) => button(label, () => { draft.size = key; saveDraft(); render(); }, { title, cls: sizeOf()[0] === key ? "wz-gl-on" : "" })));
  }
  // Names and text shrink to fit at 100%; redo it when the frame art or size changes.
  function refit() {
    content.querySelectorAll(".wz-gl-name, .wz-gl-text > div, .wz-gl-arttext").forEach((el) => { el.style.fontSize = ""; });
    fitText(content);
  }

  // ---- Hover card: the card bigger, with its details ----
  let hoverFor = null;
  function showHover(anchor, p, e) {
    hoverFor = anchor;
    const info = e ? h("div", { class: "wz-gl-hinfo" },
      h("span", { class: "dim", text: "By " }), h("b", { text: e.author || "you" }), e.mine ? h("span", { class: "dim", text: " (not posted yet)" }) : null,
      h("br"), h("span", { class: "dim", text: e.days ? `Posted ${e.days} day${e.days === 1 ? "" : "s"} ago` : "Posted today" })) : null;
    const card = h("div", { class: "wz-gl-hcard" }, tile(p));
    hover.replaceChildren(card, info);
    hover.classList.add("on");
    requestAnimationFrame(() => {
      if (hoverFor !== anchor) return;
      fitText(hover);
      const r = anchor.getBoundingClientRect(), box = panel.getBoundingClientRect(), hr = hover.getBoundingClientRect();
      let x = r.right + 8;
      if (x + hr.width > box.right - 4) x = r.left - hr.width - 8;
      if (x < box.left + 4) x = Math.max(box.left + 4, Math.min(box.right - hr.width - 4, r.left));
      const y = Math.max(box.top + 4, Math.min(box.bottom - hr.height - 4, r.top + r.height / 2 - hr.height / 2));
      hover.style.left = x + "px"; hover.style.top = y + "px";
    });
  }
  function hideHover() { hoverFor = null; hover.classList.remove("on"); }
  const hoverable = (el, p, e) => {
    el.addEventListener("mouseenter", () => showHover(el, p, e));
    el.addEventListener("mouseleave", () => { if (hoverFor === el) hideHover(); });
    return el;
  };
  panel.addEventListener("scroll", hideHover, { passive: true });

  function render() {
    hideHover();
    tabs.replaceChildren(
      button("Browse", () => { tab = "browse"; render(); }, { cls: tab === "browse" ? "wz-gl-on" : "" }),
      button("Submit", () => { tab = "submit"; render(); }, { cls: tab === "submit" ? "wz-gl-on" : "" }),
      status, h("span", { class: "wz-gl-grow" }), sizeButtons());
    content.replaceChildren(tab === "browse" ? browseTab() : submitView());
    applyZoom();
    requestAnimationFrame(refit);
  }
  checkFrameImages().then(() => { if (panel.classList.contains("on")) render(); });
  const changed = () => { tidySets(); saveDraft(); render(); };

  // ---- Submit ----
  function submitView() {
    const sel = draft.parts.filter((p) => p.sel);
    const bar = h("div", { class: "wz-gl-bar" },
      button("Read from this editor", () => {
        const problem = requestRead();
        if (problem) return say(problem);
        clearTimeout(readTimer);
        readTimer = setTimeout(() => say("No answer from the editor. Wait for it to finish loading, then try again."), 4000);
        say(`Reading ${editorLabel()}…`);
      }, { primary: true, title: "List the cards you've made in the editor open here" }),
      button("Add files…", () => fileInput.click(), { title: "A UC Editor group file (.uceditor) or PNG downloads" }),
      button("Link selected", () => { makeSet(draft.parts.filter((p) => p.sel)); changed(); }, { title: "Make the selected parts one set" }),
      button("Unlink selected", () => { draft.parts.filter((p) => p.sel).forEach((p) => { p.group = null; p.sel = false; }); changed(); }),
      h("span", { class: "wz-gl-grow" }),
      button("Preview request", () => { preview = requestText(); render(); }),
      removeAllButton());
    bar.children[2].disabled = sel.length < 2;
    bar.children[3].disabled = !sel.some((p) => p.group);
    const note = h("p", { class: "wz-gl-note", text: draft.parts.length
      ? "Click parts to select them, then Link selected to make a set. Anything not in a set is submitted on its own."
      : "Make cards in the editor, then Read from this editor and tick the ones to add. Files work too." });
    return h("div", {}, bar, note, read ? picker() : null, setsRow(), tray(), preview ? h("pre", { class: "wz-gl-preview", text: preview }) : null);
  }

  // Asks once more on the button itself instead of a browser pop-up.
  let removeArmed = false;
  function removeAllButton() {
    const b = button(removeArmed ? "Click again to remove all" : "Remove all", () => {
      if (!draft.parts.length) return;
      if (!removeArmed) { removeArmed = true; render(); setTimeout(() => { if (removeArmed) { removeArmed = false; render(); } }, 3000); return; }
      removeArmed = false;
      draft.parts.length = 0; draft.groups.length = 0; preview = ""; changed();
    }, { title: "Empty your gallery draft" });
    b.disabled = !draft.parts.length;
    return b;
  }

  function picker() {
    const n = read.groups.reduce((s, g) => s + g.parts.length, 0);
    const added = (g, raw) => draft.parts.some((p) => sameCard(p, read.source, g.name, raw));
    const free = (g) => g.parts.filter((raw) => !added(g, raw));
    const box = h("div", { class: "wz-gl-picker" },
      h("div", { class: "wz-gl-bar" },
        h("b", { text: `In ${read.label}: ${n} card${n === 1 ? "" : "s"} in ${read.groups.length} group${read.groups.length === 1 ? "" : "s"}` }),
        button("Add ticked", () => addTicked(false), { primary: true }),
        button("Add ticked as one set", () => addTicked(true)),
        h("span", { class: "wz-gl-grow" }),
        button("Close list", () => { read = null; render(); })));
    if (!n) box.appendChild(h("p", { class: "wz-gl-note", text: "Nothing saved in this editor yet." }));
    read.groups.forEach((g) => {
      const open = free(g);
      const all = h("input", { type: "checkbox", checked: open.length > 0 && open.every((r) => r.pick), disabled: !open.length,
        onchange: (e) => { open.forEach((r) => { r.pick = e.target.checked; }); render(); } });
      box.appendChild(h("div", { class: "wz-gl-pgroup" },
        h("label", {}, all, " ", h("b", { text: g.name }), h("small", { text: ` (${g.parts.length})` })),
        open.length > 1 ? [" ", button("Add this group as a set", () => {
          read.groups.forEach((x) => x.parts.forEach((r) => { r.pick = x === g && !added(g, r); }));
          addTicked(g.name);
        })] : null,
        h("div", { class: "wz-gl-pparts" }, g.parts.map((raw) => {
          const done = added(g, raw);
          return h("label", { class: done ? "done" : "" },
            h("input", { type: "checkbox", checked: !!raw.pick && !done, disabled: done, onchange: (e) => { raw.pick = e.target.checked; render(); } }),
            " ", h("span", { class: "wz-gl-type", text: raw.type, style: { color: TYPE_COLOR[raw.type] || "#fff" } }),
            " ", raw.name || "(no name)", done ? h("i", { text: " added" }) : null);
        }))));
    });
    return box;
  }

  async function addTicked(asSet) {
    const picked = [];
    read.groups.forEach((g) => g.parts.forEach((raw) => {
      if (raw.pick && !draft.parts.some((p) => sameCard(p, read.source, g.name, raw))) picked.push({ raw, group: g.name });
    }));
    if (!picked.length) return say("Tick some cards first.");
    say(`Adding ${picked.length}…`);
    const added = [];
    for (const { raw, group } of picked) {
      const part = await partFromRaw(raw, { source: read.source, from: read.label, editorGroup: group });
      part.id = nextId();
      draft.parts.push(part);
      added.push(part);
    }
    if (asSet && added.length > 1) makeSet(added, typeof asSet === "string" ? asSet : "");
    read.groups.forEach((g) => g.parts.forEach((r) => { r.pick = false; }));
    say(`Added ${added.length} part${added.length === 1 ? "" : "s"}${asSet && added.length > 1 ? " as a set" : ""}.`);
    changed();
  }

  function setsRow() {
    if (!draft.groups.length) return null;
    return h("div", { class: "wz-gl-sets" }, draft.groups.map((set) => h("span", { class: "wz-gl-set", style: { borderColor: setColor(set) } },
      h("b", { text: set.letter }),
      h("input", { type: "text", placeholder: "Set name", maxLength: 40, value: set.name, oninput: (e) => { set.name = e.target.value; saveDraft(); } }),
      `${draft.parts.filter((p) => p.group === set.id).length} parts`)));
  }

  function tray() {
    return h("div", { class: "wz-gl-tray" }, draft.parts.map((p) => {
      const set = draft.groups.find((g) => g.id === p.group);
      const zoom = h("div", { class: "wz-gl-zoom", title: "Click to select", onclick: () => { p.sel = !p.sel; render(); } }, tile(p));
      const name = h("input", { type: "text", placeholder: "Name", maxLength: 40, value: p.name, oninput: (e) => {
        p.name = e.target.value; saveDraft();
        if (!p.picture) { zoom.replaceChildren(tile(p)); requestAnimationFrame(() => fitText(zoom)); }
      } });
      const type = p.source === "picture"
        ? h("select", { onchange: (e) => { p.type = e.target.value; changed(); } }, TYPES.map((t) => h("option", { selected: t === p.type }, t)))
        : h("div", { style: { fontSize: "11px" }, text: p.type });
      return h("div", { class: `wz-gl-part${p.sel ? " sel" : ""}` },
        set ? h("span", { class: "wz-gl-badge", text: set.letter, style: { background: setColor(set) } }) : null,
        button("×", () => { draft.parts.splice(draft.parts.indexOf(p), 1); changed(); }, { title: "Remove this part", cls: "wz-gl-x" }),
        zoom, type, name,
        h("small", { class: "wz-gl-from", text: `${SOURCE_LABEL[p.source] || p.source} · ${p.editorGroup}${p.note ? " · " + p.note : ""}`, title: `${p.from} · ${p.editorGroup}${p.artFrom ? " · art from " + p.artFrom : ""}${p.note ? " · " + p.note : ""}` }));
    }));
  }

  function requestText() {
    const list = entries();
    const kb = Math.round(draft.parts.reduce((s, p) => s + ((p.art || "").length + (p.picture || "").length) * 0.75, 0) / 1024);
    const lines = [`${list.length} entr${list.length === 1 ? "y" : "ies"}, ${draft.parts.length} parts, about ${kb} KB of pictures. (Nothing is sent yet.)`, ""];
    list.forEach((e) => {
      lines.push(`${e.kind === "set" ? `Set ${e.label}` : "Single"}: ${e.title || "(no name)"}`);
      e.parts.forEach((p) => lines.push(`   - ${p.type}: ${p.name || "(no name)"}${p.type === "Monster" ? `  ${p.cost}/${p.atk}/${p.hp}` : p.cost !== null && p.cost !== undefined ? `  cost ${p.cost}` : ""}  [${SOURCE_LABEL[p.source] || p.source}]`));
    });
    const missing = draft.parts.filter((p) => !p.name).length + draft.groups.filter((g) => !g.name).length;
    if (missing) lines.push("", `${missing} name(s) still empty.`);
    return lines.join("\n");
  }

  fileInput.addEventListener("change", async () => {
    const files = [...fileInput.files];
    fileInput.value = "";
    for (const f of files) {
      try {
        if (/\.uceditor$/i.test(f.name)) {
          const g = readUcEditorFile(await readFile(f, "readAsText"));
          const fresh = g.parts.filter((r) => !draft.parts.some((p) => sameCard(p, "sernon", g.name, r)));
          read = { source: "sernon", label: `${f.name} (UC Editor file)`, groups: [{ name: g.name, parts: g.parts.map((r) => ({ ...r, pick: fresh.includes(r) })) }] };
          say(fresh.length
            ? `${f.name}: ${fresh.length} new card(s), ticked. Untick any you don't want, then Add ticked.`
            : `${f.name}: all ${g.parts.length} card(s) are in your draft already.`);
        } else {
          const stem = f.name.replace(/\.[^.]+$/, "").replace(/\s*\(\d+\)$/, "").trim();
          const pics = await picturesFromPng(await readFile(f, "readAsDataURL"), { from: f.name, editorGroup: stem });
          pics.forEach((p) => { p.id = nextId(); draft.parts.push(p); });
          say(`${f.name}: ${pics.length} picture part(s) added. Pictures need their names typed.`);
        }
      } catch (e) {
        say(`Couldn't read ${f.name}.`);
      }
    }
    changed();
  });

  // ---- Browse (preview) ----
  function browseTab() {
    draft.browseProto = { layout: browse.layout, samples: browse.samples };
    saveDraft();
    return browseView({
      state: browse,
      entries: allEntries(entries(), { samples: browse.samples, votes: draft.votes, sampleVotes }),
      hoverable,
      rerender: render,
      vote(e, dir) {
        const store = e.sample ? sampleVotes : draft.votes;
        store[e.key] = (store[e.key] || 0) === dir ? 0 : dir;
        if (!e.sample) saveDraft();
        render();
      }
    });
  }

  return {
    el: panel,
    isOpen: () => panel.classList.contains("on"),
    setOpen(on) { panel.classList.toggle("on", on); if (on) render(); },
    receiveCards(data) {
      clearTimeout(readTimer);
      read = { source: data.source, label: editorLabel(data.source), groups: (data.groups || []).map((g) => ({ name: g.name, parts: (g.parts || []).map((p) => ({ ...p, pick: false })) })) };
      const n = read.groups.reduce((s, g) => s + g.parts.length, 0);
      say(`Found ${n} card${n === 1 ? "" : "s"}. Tick what to add.`);
      tab = "submit";
      if (panel.classList.contains("on")) render();
    }
  };
}
