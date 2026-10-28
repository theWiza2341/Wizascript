// packages/card-maker/gallery/panel.js
//
// The Card Gallery inside the Card Maker's window: a panel over the
// editor (which stays loaded underneath), opened with Browse / Submit in
// the title bar (nav.js). Two views:
//   Submit  - Read from this editor (lists every group and card made in
//             the editor that's open, to tick what to add), or add files
//             (.uceditor, PNG). Added parts go in a tray: click to select,
//             link them into sets (A, B, C...), rename, remove, then
//             Review upload -> Upload to Gallery (needs the Card Gallery
//             Username setting). Uploads leave the draft as posts.
//   Browse  - the gallery's lists, a page at a time (browse.js), with My
//             posts / Liked filters. Until the gallery is live it shows your
//             uploads (awaiting approval) and sample entries, and nothing
//             is sent anywhere.
// A size control (Small / Medium / Large) zooms the cards on both views.

import { h, button } from "./dom.js";
import { tile, fitText, checkFrameImages, whenFontsReady, onFontsChange, TILE_CSS } from "./render.js";
import { partFromRaw, readUcEditorFile, picturesFromPng, readFile } from "./parts.js";
import { getDraft, saveDraft, nextId, makeSet, tidySets, entries, markUploaded, pruneUploads, SET_CAP } from "./draft.js";
import { getMe, linkStart, linkCheck, getIndex, getTotals, uploadEntries, uploadProblems, createVoteQueue, ApiError } from "./api.js";
import { openVoid, canOpenVoid } from "../../core/uc-report.js";
import { browseView, allEntries, BROWSE_CSS } from "./browse.js";
import { loadSampleExtras } from "./mock.js";

const STYLE_ID = "wizascript-cardgallery-style";
const TYPES = ["Monster", "Spell", "Enchantment", "Artifact"];
const COLORS = ["#e6b422", "#4aa3df", "#e05a5a", "#5cc46a", "#b07de0", "#e08a3c", "#3cc8c0", "#d65ca8"];
const TYPE_COLOR = { Monster: "#f0003c", Spell: "#41fcff", Enchantment: "#fca500", Artifact: "gold" };
const SOURCE_LABEL = { feildmaster: "feildmaster's editor", sernon: "UC Editor", picture: "picture" };
// Card sizes. Large picks how many cards fit at full size, then stretches
// them so each row reaches the panel's edge.
const SIZES = [["small", "Small", .75, "Small cards"], ["medium", "Medium", 1, "Full-size cards"], ["large", "Large", 0, "Zoom cards to fill the width"]];

const GAP = 10;

const CSS = `
.wz-gl-panel { --wz-gl-z: .6; position: absolute; inset: 0; z-index: 7; overflow: auto; background: #0d0d0d; padding: 10px; display: none; user-select: text; font: 12px Arial, sans-serif; color: #fff; }
.wz-gl-panel.on { display: block; }
.wz-gl-panel.on.browse { display: flex; flex-direction: column; overflow: hidden; }
.wz-gl-panel.browse > .wz-gl-content { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.wz-gl-panel.browse > .wz-gl-content > .wz-gl-browse { flex: 1 1 auto; height: auto; }
.wz-gl-proto { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; padding: 3px 6px; margin-bottom: 8px; border: 1px dashed #665; background: #17150c; font-size: 11px; flex: none; }
.wz-gl-proto b { color: #ffd84a; margin-right: 4px; }
.wz-gl-proto label { margin: 0 0 0 10px; font-weight: normal; cursor: pointer; }
.wz-gl-tabs { flex: none; }
.wz-gl-part:has(.wz-gl-wide) { width: calc(355px * var(--wz-gl-z) + 14px); }
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
.wz-gl-acct { display: inline-flex; align-items: center; gap: 4px; margin-right: 6px; white-space: nowrap; }
.wz-gl-acct b { color: #ffd84a; }
.wz-gl-acct-err { color: #ffb4b4; }
.wz-gl-panel .dim { opacity: .7; }
.wz-cm-btn.wz-gl-small { height: 18px; line-height: 16px; padding: 0 5px; font-size: 10px; }
.wz-gl-link { margin: 0 0 10px; padding: 8px 10px; border: 2px solid #ffd84a; background: #17150c; }
.wz-gl-link ol { margin: 6px 0; padding-left: 20px; }
.wz-gl-link li { margin: 4px 0; }
.wz-gl-line { background: #000 !important; color: #fff !important; border: 1px solid #666; padding: 1px 6px; font: 13px monospace; user-select: all; }
.wz-gl-done.failed { border-color: #e07a7a; background: #241010; }
.wz-gl-upload { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; padding: 8px 10px; border: 2px solid #2f6b3a; background: #0f1a11; }
.wz-gl-upload.open { display: block; }
.wz-gl-revlist { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0; max-height: 360px; overflow: auto; }
.wz-gl-rev { border: 1px solid #444; background: #111; padding: 4px 6px; }
.wz-gl-revhead { margin-bottom: 3px; }
.wz-gl-revcards { display: flex; gap: 3px; --wz-gl-z: .45; }
.wz-gl-revcards .wz-gl-zoom { margin: 0; cursor: default; }
.wz-gl-issues { color: #ffb4b4; margin: 4px 0; }
.wz-gl-revfoot { margin: 6px 0 0; }
.wz-gl-by { opacity: .8; }
.wz-gl-done { margin: 8px 0; padding: 8px 10px; border: 2px solid #6fbf7e; background: #102414; }
.wz-gl-done ul { margin: 4px 0 6px 18px; padding: 0; }
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
export function buildGalleryPanel({ requestRead, editorLabel, wheelPages }) {
  injectStyle();
  const draft = getDraft();
  let tab = draft.parts.length ? "browse" : "submit";
  let open = false;
  const proto = draft.browseProto || {};
  const browse = { list: "new", page: 0, samples: proto.samples === true, dir: null, mineOnly: false, likedOnly: false };
  const listeners = [];
  const notify = () => listeners.forEach((f) => f());
  let browseCtl = null;
  let extrasAsked = false;
  const sampleVotes = {};
  let read = null; // { source, label, groups: [{ name, parts: [raw + pick] }] }
  let readTimer = null;
  let reviewing = false;   // the Upload step is open
  let lastUpload = null;   // { posts, error } after an upload, until the draft changes
  let uploading = false;

  // ---- the gallery server: this player's account, the gallery, votes ----
  const acct = { loaded: false, loading: false, account: null, cooldownUntil: null, votes: {}, posts: [], error: "", at: 0 };
  let linking = null;      // { code, line, expiresAt } while linking
  const gal = { approved: [], totals: {}, base: {}, at: 0, loading: false, error: "" };
  const voteQueue = createVoteQueue({
    onSent(part) { Object.entries(part).forEach(([id, v]) => { if (v) acct.votes[id] = v; else delete acct.votes[id]; }); },
    onError(e) { say(`Your votes couldn't be sent yet (${e.message}). They'll be tried again.`); }
  });
  const author = () => acct.account || "";
  const currentVotes = () => {
    const cur = { ...acct.votes };
    Object.entries(voteQueue.pending()).forEach(([id, v]) => { if (v) cur[id] = v; else delete cur[id]; });
    return cur;
  };
  const errText = (e) => (e instanceof ApiError ? e.message : "Something went wrong.");

  async function refreshMe(force) {
    if (acct.loading || (!force && acct.loaded && Date.now() - acct.at < 30e3)) return;
    acct.loading = true;
    try {
      const me = await getMe();
      Object.assign(acct, { loaded: true, account: me.account || null, cooldownUntil: me.cooldownUntil || null, votes: me.votes || {}, posts: me.posts || [], error: "", at: Date.now() });
      pruneUploads(Object.fromEntries(acct.posts.map((p) => [p.id, p.status])), new Set(gal.approved.map((p) => p.id)));
    } catch (e) {
      acct.error = errText(e);
    } finally {
      acct.loading = false;
      if (open) render();
    }
  }
  async function refreshGallery(force) {
    if (gal.loading || (!force && gal.at && Date.now() - gal.at < 60e3)) return;
    gal.loading = true;
    if (open && tab === "browse") render();
    try {
      const [approved, totals] = await Promise.all([getIndex(), getTotals()]);
      gal.approved = approved;
      gal.totals = (totals && totals.totals) || {};
      gal.base = { ...acct.votes };
      gal.error = "";
      gal.at = Date.now();
    } catch (e) {
      gal.error = errText(e);
    } finally {
      gal.loading = false;
      if (open) render();
    }
  }

  // ---- linking: prove which Undercards account this is, once ----
  async function startLink() {
    say("Getting a link code…");
    try {
      linking = await linkStart();
      say("");
    } catch (e) { say(errText(e)); }
    render();
  }
  async function checkLink() {
    say("Looking for your line in void…");
    try {
      const r = await linkCheck();
      if (r.linked) {
        linking = null;
        acct.account = r.account;
        acct.cooldownUntil = r.cooldownUntil || null;
        say(`Linked as ${r.account}.`);
        refreshMe(true);
        refreshGallery(true);
      } else say(r.message || "Not seen yet. Send the line in void, then check again.");
    } catch (e) {
      if (e.code === "cooldown") say(`This install switched accounts less than 24 hours ago. You can switch again ${new Date(e.extra.cooldownUntil).toLocaleString()}.`);
      else if (e.code === "code_expired") { linking = null; say("That code expired. Press Link my account again."); }
      else say(errText(e));
    }
    render();
  }
  function accountBox() {
    if (acct.error && !acct.loaded) {
      return h("span", { class: "wz-gl-acct" }, h("span", { class: "wz-gl-acct-err", text: "Gallery server unreachable" }), " ", button("Retry", () => { acct.error = ""; refreshMe(true); }));
    }
    if (!acct.loaded) return h("span", { class: "wz-gl-acct dim", text: "Checking your account…" });
    if (acct.account) {
      return h("span", { class: "wz-gl-acct", title: "Your posts and votes count as this Undercards account" },
        "Linked as ", h("b", { text: acct.account }), " ",
        linking ? null : button("Switch", () => startLink(), { title: "Link this install to a different Undercards account (once a day at most)", cls: "wz-gl-small" }));
    }
    return h("span", { class: "wz-gl-acct" }, linking ? h("span", { class: "dim", text: "Linking…" }) : button("Link my account", () => startLink(), { primary: true, title: "Prove which Undercards account you are, once, to post and vote" }));
  }
  function linkBox() {
    if (!linking) return null;
    const mins = Math.max(0, Math.round((linking.expiresAt - Date.now()) / 60e3));
    const line = h("code", { class: "wz-gl-line", text: linking.line });
    const sendBtn = button("Open void with it typed in", () => {
      if (!openVoid(linking.line)) say("This page has no chat. Copy the line and send it in void from another page.");
    }, { primary: true, title: "Opens chat room 0 with the line filled in. You press Enter." });
    sendBtn.disabled = !canOpenVoid();
    return h("div", { class: "wz-gl-link" },
      h("b", { text: "Link your Undercards account" }),
      h("ol", {},
        h("li", {}, "Send this line in void (chat room 0) from the account you want to post and vote as: ", line, " ", sendBtn,
          canOpenVoid() ? null : h("span", { class: "dim", text: " (no chat on this page: send it from another page)" })),
        h("li", {}, "Then: ", button("Check link", () => checkLink(), { primary: true }), h("span", { class: "dim", text: ` The code works for ${mins} more minute${mins === 1 ? "" : "s"}.` }))),
      acct.account ? h("div", { class: "dim", text: `Switching from ${acct.account}: an install can switch accounts once a day, and accounts that share an install count as one voter.` }) : null,
      button("Cancel", () => { linking = null; say(""); render(); }, { cls: "wz-gl-small" }));
  }

  const status = h("span", { class: "wz-gl-status" });
  const say = (t) => { status.textContent = t; };
  const tabs = h("div", { class: "wz-gl-bar wz-gl-tabs" });
  const content = h("div", { class: "wz-gl-content" });
  const hover = h("div", { class: "wz-gl-hover" });
  const protoBar = h("div", { class: "wz-gl-proto" });
  const panel = h("div", { class: "wz-gl-panel" }, protoBar, tabs, content, hover);
  const fileInput = h("input", { type: "file", accept: ".uceditor,image/png", multiple: true, style: { display: "none" } });
  panel.appendChild(fileInput);

  // ---- Card size ----
  const sizeOf = () => SIZES.find((x) => x[0] === draft.cardSize) || SIZES[1];
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
  let fitTimer = null, lastBox = "";
  new ResizeObserver(() => {
    if (!open) return;
    const box = panel.clientWidth + "x" + panel.clientHeight;
    if (box === lastBox) return;
    lastBox = box;
    const zoomed = !sizeOf()[2] && applyZoom();
    if (!zoomed && tab !== "browse") return;
    clearTimeout(fitTimer);
    fitTimer = setTimeout(() => { if (tab === "browse" && browseCtl) browseCtl.layout(); else refit(); }, 120);
  }).observe(panel);
  function sizeButtons() {
    return h("span", { class: "wz-gl-sizes", title: "Card size" },
      h("small", { text: "Size ", style: { opacity: ".7" } }),
      SIZES.map(([key, label, , title]) => button(label, () => { draft.cardSize = key; browse.page = 0; saveDraft(); render(); }, { title, cls: sizeOf()[0] === key ? "wz-gl-on" : "" })));
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
      h("span", { class: "dim", text: "By " }), h("b", { text: e.author || "you" }),
      h("br"), h("span", { class: "dim", text: (e.status === "pending" ? "Uploaded " : "Posted ") + (e.days ? `${e.days} day${e.days === 1 ? "" : "s"} ago` : "today") }),
      e.status === "pending" ? [h("br"), h("span", { class: "dim", text: "Awaiting approval" })] : null) : null;
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

  function renderProto() {
    protoBar.replaceChildren(h("b", { text: "Preview" }),
      h("label", {}, h("input", { type: "checkbox", checked: browse.samples, onchange: (e) => { browse.samples = e.target.checked; browse.page = 0; saveProto(); render(); } }), " Sample entries"));
  }
  const saveProto = () => { draft.browseProto = { samples: browse.samples }; saveDraft(); };

  function render() {
    hideHover();
    browseCtl = null;
    if (!open) return;
    renderProto();
    tabs.replaceChildren(
      accountBox(), status, h("span", { class: "wz-gl-grow" }), sizeButtons());
    panel.classList.toggle("browse", tab === "browse");
    applyZoom();
    if (tab === "browse") {
      if (browse.samples && !extrasAsked) { extrasAsked = true; loadSampleExtras().then((more) => { if (more && open && tab === "browse") render(); }); }
      const ctl = browseCtl = browseTab();
      content.replaceChildren(...[linkBox(), ctl.el].filter(Boolean));
      ctl.layout();
      // Again once the window has settled (a nav style or size just changed).
      requestAnimationFrame(() => { if (browseCtl === ctl) ctl.layout(); });
    } else {
      content.replaceChildren(...[linkBox(), submitView()].filter(Boolean));
      requestAnimationFrame(refit);
    }
  }
  function setView(v) {
    if (tab === "browse" && v !== "browse") voteQueue.flush();
    if (v === "editor") { open = false; panel.classList.remove("on"); hideHover(); }
    else {
      tab = v; open = true; panel.classList.add("on"); render();
      refreshMe();
      if (v === "browse") refreshGallery();
    }
    notify();
  }
  checkFrameImages().then(() => { if (open) render(); });
  whenFontsReady().then(() => { if (open) render(); });
  let fontTimer = null;
  onFontsChange(() => { clearTimeout(fontTimer); fontTimer = setTimeout(() => { if (open) render(); }, 50); });
  const changed = () => { tidySets(); saveDraft(); lastUpload = null; render(); };

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
      removeAllButton());
    bar.children[2].disabled = sel.length < 2 || sel.length > SET_CAP;
    if (sel.length > SET_CAP) bar.children[2].title = `Sets can have up to ${SET_CAP} cards`;
    bar.children[3].disabled = !sel.some((p) => p.group);
    const note = h("p", { class: "wz-gl-note", text: draft.parts.length
      ? "Click parts to select them, then Link selected to make a set. Anything not in a set is submitted on its own."
      : "Make cards in the editor, then Read from this editor and tick the ones to add. Files work too." });
    return h("div", {}, bar, note, lastUpload ? uploadedBox() : null, draft.parts.length ? uploadBox() : null, read && !reviewing ? picker() : null, setsRow(), tray());
  }

  // Asks once more on the button itself instead of a browser pop-up.
  let removeArmed = false;
  function removeAllButton() {
    const b = button(removeArmed ? "Click again to remove all" : "Remove all", () => {
      if (!draft.parts.length) return;
      if (!removeArmed) { removeArmed = true; render(); setTimeout(() => { if (removeArmed) { removeArmed = false; render(); } }, 3000); return; }
      removeArmed = false;
      draft.parts.length = 0; draft.groups.length = 0; reviewing = false; changed();
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
        open.length > 1 ? [" ", ((b) => { if (open.length > SET_CAP) { b.disabled = true; b.title = `Sets can have up to ${SET_CAP} cards. Tick some and use Add ticked as one set.`; } return b; })(button("Add this group as a set", () => {
          read.groups.forEach((x) => x.parts.forEach((r) => { r.pick = x === g && !added(g, r); }));
          addTicked(g.name);
        }))] : null,
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
    if (asSet && picked.length > SET_CAP) return say(`Sets can have up to ${SET_CAP} cards. Untick some, or add them on their own.`);
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

  // ---- Upload ----
  // Step 1: "Review upload" lists exactly what will be sent (each set and
  // single, with its cards). Step 2: "Upload to Gallery" sends it and the
  // draft empties; a box says what went.
  function problems() {
    const out = [];
    if (!acct.loaded) out.push(acct.error ? `Unable to Submit: the gallery server can't be reached (${acct.error})` : "Checking your account…");
    else if (!author()) out.push("Unable to Submit: link your Undercards account first (Link my account, at the top).");
    const unnamed = draft.parts.filter((p) => !p.name).length;
    const unnamedSets = draft.groups.filter((g) => !g.name).length;
    if (unnamed) out.push(`${unnamed} card${unnamed === 1 ? " has" : "s have"} no name yet.`);
    if (unnamedSets) out.push(`${unnamedSets} set${unnamedSets === 1 ? " has" : "s have"} no name yet.`);
    return out.concat(uploadProblems(entries()));
  }
  function uploadBox() {
    const list = entries();
    const nCards = draft.parts.length;
    const summary = `${list.length} entr${list.length === 1 ? "y" : "ies"} (${nCards} card${nCards === 1 ? "" : "s"})`;
    if (!reviewing) {
      return h("div", { class: "wz-gl-upload" },
        h("span", { text: `Ready to upload: ${summary}.` }), h("span", { class: "wz-gl-grow" }),
        button("Review upload", () => { reviewing = true; render(); panel.scrollTop = 0; }, { primary: true, title: "See exactly what will be sent before uploading" }));
    }
    const issues = problems();
    const rows = list.map((e) => h("div", { class: "wz-gl-rev" },
      h("div", { class: "wz-gl-revhead" },
        h("b", { text: e.kind === "set" ? `Set ${e.label}: ${e.title || "(no name)"}` : e.title || "(no name)" }),
        h("small", { text: e.kind === "set" ? ` ${e.parts.length} cards` : ` ${e.parts[0].type}` })),
      h("div", { class: "wz-gl-revcards" }, e.parts.map((p) => h("div", { class: "wz-gl-zoom" }, tile(p))))));
    const go = button(uploading ? "Uploading…" : "Upload to Gallery", () => doUpload(), { primary: true, title: issues.length ? issues[0] : "Send these for approval" });
    go.disabled = issues.length > 0 || uploading;
    return h("div", { class: "wz-gl-upload open" },
      h("div", { class: "wz-gl-bar" }, h("b", { text: `Upload ${summary}` }), h("span", { class: "wz-gl-grow" }),
        h("span", { class: "wz-gl-by", text: author() ? `Posting as ${author()}` : "" })),
      h("div", { class: "wz-gl-revlist" }, rows),
      issues.length ? h("div", { class: "wz-gl-issues" }, issues.map((t) => h("div", { text: t }))) : null,
      h("div", { class: "wz-gl-bar wz-gl-revfoot" },
        h("span", { class: "wz-gl-note", style: { margin: 0 }, text: "Each set and single card is sent as its own entry, for approval. Approved ones show in Browse for everyone." }),
        h("span", { class: "wz-gl-grow" }),
        button("Back", () => { reviewing = false; render(); }), go));
  }
  async function doUpload() {
    if (problems().length || uploading) return render();
    uploading = true;
    render();
    let sent = [], error = "";
    try {
      sent = await uploadEntries(entries(), (i, n) => { if (n > 1 && i < n) say(`Uploading part ${i + 1} of ${n}…`); });
    } catch (e) {
      sent = (e.extra && e.extra.sent) || [];
      error = errText(e);
    }
    uploading = false;
    if (sent.length) markUploaded(sent);
    reviewing = !!error && !sent.length;
    read = null;
    lastUpload = sent.length || error ? { posts: sent, error } : null;
    say(error ? (sent.length ? `Uploaded ${sent.length}; the rest didn't go: ${error}` : `Upload failed: ${error}`) : `Uploaded ${sent.length} entr${sent.length === 1 ? "y" : "ies"}.`);
    if (sent.length) refreshMe(true);
    render();
  }
  function uploadedBox() {
    const posts = lastUpload.posts;
    if (!posts.length) {
      return h("div", { class: "wz-gl-done failed" }, h("b", { text: "Nothing was uploaded." }), " ", lastUpload.error, " ", button("Dismiss", () => { lastUpload = null; render(); }));
    }
    const cards = posts.reduce((n, e) => n + e.local.parts.length, 0);
    return h("div", { class: `wz-gl-done${lastUpload.error ? " failed" : ""}` },
      h("div", {}, h("b", { text: `✓ Sent for approval: ${posts.length} entr${posts.length === 1 ? "y" : "ies"} (${cards} card${cards === 1 ? "" : "s"})` })),
      h("ul", {}, posts.map((e) => h("li", { text: e.kind === "set" ? `${e.title} (set of ${e.local.parts.length})` : `${e.title} (${e.local.parts[0].type})` }))),
      lastUpload.error ? h("div", { class: "wz-gl-issues", text: `The rest weren't sent: ${lastUpload.error} They're still in your draft below.` }) : null,
      h("div", { class: "wz-gl-note", style: { margin: "0 0 6px" }, text: "They show under My posts as awaiting approval, and in Browse for everyone once approved." }),
      button("See my posts", () => { browse.mineOnly = true; browse.likedOnly = false; browse.list = "new"; browse.page = 0; lastUpload = null; setView("browse"); }, { primary: true }),
      " ", button("Dismiss", () => { lastUpload = null; render(); }));
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
    const own = acct.posts
      .filter((p) => (p.status === "pending" || p.status === "rejected") && draft.uploads[p.id])
      .map((p) => ({ id: p.id, status: p.status, postedAt: p.postedAt, kind: draft.uploads[p.id].kind, title: draft.uploads[p.id].title, parts: draft.uploads[p.id].parts }));
    // Just approved, but not in the gallery's index yet: still show its copy.
    acct.posts.filter((p) => p.status === "approved" && draft.uploads[p.id] && !gal.approved.some((a) => a.id === p.id))
      .forEach((p) => own.push({ id: p.id, status: "pending", postedAt: p.postedAt, kind: draft.uploads[p.id].kind, title: draft.uploads[p.id].title, parts: draft.uploads[p.id].parts }));
    const list = allEntries({ approved: gal.approved, own, totals: gal.totals, baseVotes: gal.base, current: currentVotes(), account: acct.account, samples: browse.samples, sampleVotes });
    return browseView({
      state: browse,
      wheelPages: () => !wheelPages || wheelPages(),
      onPage: hideHover,
      entries: list,
      note: gal.error ? `Couldn't load the gallery: ${gal.error}` : browse.samples ? "Sample entries (grey tag) are mixed in. They aren't real posts." : acct.account ? "" : "Link your account to vote.",
      emptyText: gal.loading && !gal.at ? "* Loading the gallery…" : gal.error && !gal.at ? "* Couldn't load the gallery. Try again in a moment." : "",
      hoverable,
      rerender: render,
      onRefresh: () => { voteQueue.flush(); refreshMe(true); refreshGallery(true); },
      vote(e, dir) {
        if (e.sample) { sampleVotes[e.key] = (sampleVotes[e.key] || 0) === dir ? 0 : dir; return render(); }
        if (!acct.account) { say("Link your Undercards account to vote: press Link my account at the top."); return; }
        const cur = currentVotes()[e.id] || 0;
        voteQueue.add(e.id, cur === dir ? 0 : dir);
        render();
      }
    });
  }

  return {
    el: panel,
    isOpen: () => open,
    setOpen(on) { setView(on ? tab : "editor"); },
    view: () => (open ? tab : "editor"),
    setView,
    onChange(f) { listeners.push(f); },
    // Send queued votes now (the Card Maker is closing or being minimised).
    flush: () => voteQueue.flush(),
    receiveCards(data) {
      clearTimeout(readTimer);
      read = { source: data.source, label: editorLabel(data.source), groups: (data.groups || []).map((g) => ({ name: g.name, parts: (g.parts || []).map((p) => ({ ...p, pick: false })) })) };
      const n = read.groups.reduce((s, g) => s + g.parts.length, 0);
      say(`Found ${n} card${n === 1 ? "" : "s"}. Tick what to add.`);
      tab = "submit";
      if (open) render();
    }
  };
}
