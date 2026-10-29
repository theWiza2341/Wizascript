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
//             posts / Liked filters, and your uploads awaiting approval.
//   Contest - the running contest and the archive (contest.js).
//   Review  - for keys the owner gave out: uploads, judging, the log, and
//             (owner) contests and reviewers.
// A size control (Small / Medium / Large) zooms the cards on both views.

import { h, button } from "./dom.js";
import { tile, fitText, checkFrameImages, whenFontsReady, onFontsChange, TILE_CSS } from "./render.js";
import { partFromRaw, readUcEditorFile, picturesFromPng, readFile } from "./parts.js";
import { getDraft, saveDraft, nextId, makeSet, tidySets, entries, markUploaded, pruneUploads, SET_CAP } from "./draft.js";
import { getMe, linkStart, linkCheck, getIndex, getTotals, uploadEntries, uploadProblems, createVoteQueue, ApiError, reviewPending, reviewPost, reviewDecide, reviewRemove, deleteOwnPost, reviewWhoami, reviewLog, reviewersList, reviewerAdd, reviewerRevoke, reviewerAddJudge } from "./api.js";
import { openVoid, canOpenVoid } from "../../core/uc-report.js";
import { accountChanged, onAccountChange } from "../../core/account.js";
import { browseView, allEntries, BROWSE_CSS, removeButton } from "./browse.js";
import { createContests, CONTEST_CSS } from "./contest.js";

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
.wz-gl-panel.browse > .wz-gl-content > .wz-gl-cv { flex: 1 1 auto; min-height: 0; }
.wz-gl-preview-as { background: #3a1f5a; border: 1px solid #b07de0; color: #e6d4ff; padding: 1px 4px 1px 8px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px; }
.wz-gl-viewas { margin: 0; font-weight: normal; display: flex; align-items: center; gap: 6px; }
.wz-gl-viewas select { height: 22px !important; flex: 1; }
/* Review: roomy, with a side menu (dev16) */
.wz-gl-rv { font-size: 14px; line-height: 1.45; }
.wz-gl-rv .wz-cm-btn { height: 28px; font-size: 13px; padding: 0 12px; }
.wz-gl-rv .wz-gl-note { font-size: 13px; }
.wz-gl-rv input[type="text"], .wz-gl-rv select { height: 28px !important; font-size: 13px !important; }
.wz-gl-rv .wz-gl-revpost { padding: 12px 14px; border-width: 2px; }
.wz-gl-rv .wz-gl-revmeta { font-size: 15px; margin-bottom: 10px; }
.wz-gl-rv .wz-gl-revactions .wz-cm-btn { height: 34px; padding: 0 22px; font-size: 14px; }
.wz-gl-rv .wz-gl-revlog { gap: 8px; font-size: 14px; }
.wz-gl-rv .wz-gl-scorebtn { width: 26px; height: 24px; font-size: 13px; }
.wz-gl-rside { display: grid; grid-template-columns: 190px minmax(0, 1fr); gap: 18px; align-items: start; }
.wz-gl-rmenu { position: sticky; top: 0; display: flex; flex-direction: column; border: 2px solid #fff; background: #000; }
.wz-gl-rmenu button { display: flex; justify-content: space-between; align-items: center; background: none; border: 0; color: #bbb; padding: 10px 12px; text-align: left; font: 15px "DTM-Mono", "DTM Mono", "WZ DTM Mono", monospace; cursor: pointer; }
.wz-gl-rmenu button + button { border-top: 1px solid #333; }
.wz-gl-rmenu button:hover { color: #fff; background: #151515; }
.wz-gl-rmenu button.on { background: #ffd84a; color: #000; }
.wz-gl-rmenu .n { background: #e05a5a; color: #fff; border-radius: 9px; padding: 0 6px; font: 11px/16px Arial, sans-serif; }
.wz-gl-rmenu .who { padding: 10px 12px; border-top: 2px solid #fff; font-size: 12px; opacity: .8; }
.wz-gl-ctag { display: inline-block; background: #3a2f0a; border: 1px solid #ffd84a; color: #ffd84a; font-size: 10px; padding: 0 4px; margin-left: 6px; }
.wz-gl-target { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 0 0 8px; }
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
.wz-gl-revposts { display: flex; flex-direction: column; gap: 12px; }
.wz-gl-revpost { border: 1px solid #444; background: #111; padding: 8px; }
.wz-gl-revmeta { margin-bottom: 6px; }
.wz-gl-revpost .wz-gl-item { align-items: flex-start; display: inline-flex; }
.wz-gl-revactions { margin: 8px 0 0; }
.wz-gl-revactions input { flex: 1 1 240px; }
.wz-gl-hreason { color: #ffb4b4; }
.wz-gl-done.failed { border-color: #e07a7a; background: #241010; }
.wz-gl-upload { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; padding: 8px 10px; border: 2px solid #2f6b3a; background: #0f1a11; }
.wz-gl-upload.open { display: block; }
.wz-gl-revlist { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0; max-height: 360px; overflow: auto; }
.wz-gl-rev { border: 1px solid #444; background: #111; padding: 4px 6px; }
.wz-gl-revtabs { margin-bottom: 8px; }
.wz-gl-revlog { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.wz-gl-newkey { margin: 8px 0; display: flex; flex-direction: column; gap: 6px; border-color: #ff0; }
.wz-gl-key { flex: 1; min-width: 0; font-family: monospace; }
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
${CONTEST_CSS}
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
export function buildGalleryPanel({ requestRead, editorLabel, wheelPages, reviewerKey = () => "", onKeyRejected = () => {} }) {
  injectStyle();
  const draft = getDraft();
  let tab = draft.parts.length ? "browse" : "submit";
  let open = false;
  if (draft.browseProto) { delete draft.browseProto; saveDraft(); } // the old sample-entries switch
  const browse = { list: "new", page: 0, dir: null, mineOnly: false, likedOnly: false };
  if (draft.proto) { delete draft.proto; saveDraft(); } // dev16/17's layout prototypes
  let viewAs = ""; // the owner's View as (Review's side menu); "" = themselves
  const listeners = [];
  const notify = () => listeners.forEach((f) => f());
  let browseCtl = null;
  let read = null; // { source, label, groups: [{ name, parts: [raw + pick] }] }
  let readTimer = null;
  let reviewing = false;   // the Upload step is open
  let lastUpload = null;   // { posts, error } after an upload, until the draft changes
  let uploading = false;
  let submitTo = null;     // a contest id: Submit uploads into that contest

  // ---- the gallery server: this player's account, the gallery, votes ----
  const acct = { loaded: false, loading: false, account: null, cooldownUntil: null, votes: {}, posts: [], contest: null, error: "", at: 0 };
  let linking = null;      // { code, line, expiresAt } while linking
  const gal = { approved: [], totals: {}, base: {}, at: 0, loading: false, error: "" };
  const voteQueue = createVoteQueue({
    onSent(part) { Object.entries(part).forEach(([id, v]) => { if (v) acct.votes[id] = v; else delete acct.votes[id]; }); },
    onError(e) { say(`Your votes couldn't be sent yet (${e.message}). They'll be tried again.`); }
  });
  const author = () => acct.account || "";

  // ---- review (turned on with the console command; the key is the owner's or a reviewer's) ----
  const blankRev = () => ({ list: [], posts: {}, at: 0, loading: false, error: "", busy: {}, reasons: {},
    who: null, section: "uploads", log: null, reviewers: null, newKey: null, newName: "", newRole: "reviewer", adding: false, sectionError: "" });
  let rev = blankRev();
  // View as (owner only, dev16): try the other roles' screens. Only what's
  // shown changes; the server still treats the key as the owner's.
  const realRole = () => (rev.who ? rev.who.role : null);
  const role = () => (realRole() === "owner" && viewAs ? viewAs : realRole());
  const isOwner = () => role() === "owner";
  const isJudge = () => role() === "judge";
  async function refreshReview(force) {
    const key = reviewerKey();
    if (!key || rev.loading || (!force && rev.at && Date.now() - rev.at < 30e3)) return;
    rev.loading = true;
    try {
      if (!rev.who) rev.who = await reviewWhoami(key);
      // A judge key only scores its contest.
      if (realRole() === "judge") { rev.at = Date.now(); rev.error = ""; contests.loadJudging(force); return; }
      contests.refresh();
      const r = await reviewPending(key);
      rev.list = (r && r.posts) || [];
      rev.error = "";
      rev.at = Date.now();
      for (const p of rev.list) {
        if (!rev.posts[p.id]) rev.posts[p.id] = await reviewPost(key, p.id).catch(() => null);
      }
    } catch (e) {
      // Revoked or expired: Wizascript forgets the key (Review disappears).
      if (e.code === "not_admin" || e.code === "key_expired") { rev.loading = false; onKeyRejected(e.code); return; }
      rev.error = errText(e);
    } finally {
      rev.loading = false;
      notify();
      if (open && tab === "review") render();
    }
  }
  async function decide(id, approve) {
    rev.busy[id] = approve ? "Approving…" : "Rejecting…";
    render();
    try {
      await reviewDecide(reviewerKey(), id, approve, rev.reasons[id]);
      rev.list = rev.list.filter((p) => p.id !== id);
      delete rev.posts[id];
      say(approve ? `Approved ${id}. It's in the gallery now.` : `Rejected ${id}.`);
      if (approve) gal.at = 0; // Browse loads it fresh
    } catch (e) {
      say(`Couldn't ${approve ? "approve" : "reject"} ${id}: ${errText(e)}`);
    }
    delete rev.busy[id];
    notify();
    render();
  }
  const uploadList = () => rev.list;
  const uploadPost = (p) => rev.posts[p.id];
  function uploadsView() {
    const list = uploadList();
    const head = h("div", { class: "wz-gl-bar" },
      h("b", { text: rev.loading && !rev.at ? "Loading uploads…" : `${list.length} upload${list.length === 1 ? "" : "s"} waiting` }),
      h("span", { class: "wz-gl-grow" }),
      button("↻ Refresh", () => refreshReview(true), { title: "Look for new uploads" }));
    if (rev.error) return h("div", {}, head, h("div", { class: "wz-gl-issues", text: rev.error }));
    if (!list.length && rev.at) return h("div", {}, head, h("p", { class: "wz-gl-note", text: "Nothing to review. New uploads appear here." }));
    const one = (p) => {
      const post = uploadPost(p);
      const reason = h("input", { type: "text", placeholder: "Reason (optional, shown to them if rejected)", maxLength: 300, value: rev.reasons[p.id] || "", oninput: (e) => { rev.reasons[p.id] = e.target.value; } });
      const approveBtn = button(rev.busy[p.id] || "Approve", () => decide(p.id, true), { primary: true, title: p.contest ? "Accept it into the contest" : "Add it to the gallery (one commit on the gallery branch)" });
      const rejectBtn = button("Reject", () => decide(p.id, false), { title: "Don't add it; the author sees it as not approved" });
      approveBtn.disabled = rejectBtn.disabled = !!rev.busy[p.id] || !post;
      return h("div", { class: "wz-gl-revpost" },
        h("div", { class: "wz-gl-revmeta" },
          h("b", { text: p.title || "(no name)" }),
          p.contest ? h("span", { class: "wz-gl-ctag", text: `Contest: ${p.contestTitle || p.contest}`, title: "Entered in this contest: check it follows the theme and rules" }) : null,
          h("span", { class: "dim", text: ` ${p.kind === "set" ? `set of ${post ? post.parts.length : "?"}` : post ? post.parts[0].type : ""} · by ` }), h("b", { text: p.author }),
          h("span", { class: "dim", text: ` · ${new Date(p.postedAt).toLocaleString()} · #${p.id}` })),
        post ? h("div", { class: `wz-gl-item${p.kind === "set" ? " set" : ""}` },
          p.kind === "set" ? h("div", { class: "wz-gl-sethead" }, h("div", { class: "wz-gl-setname", text: post.title })) : null,
          h("div", { class: "wz-gl-row" }, post.parts.map((c) => hoverable(h("div", { class: "wz-gl-zoom" }, tile(c)), c, null))))
          : h("p", { class: "wz-gl-note", text: "Loading its cards…" }),
        h("div", { class: "wz-gl-bar wz-gl-revactions" }, approveBtn, rejectBtn, reason));
    };
    const note = h("p", { class: "wz-gl-note", text: "Each upload is shown exactly as it will look in Browse. Approving adds it to the gallery for everyone (contest entries: to the contest)." });
    return h("div", {}, head, note, h("div", { class: "wz-gl-revposts" }, list.map(one)));
  }
  // Review's sections: Uploads, Judging, Log, and (owner) Contests and Reviewers.
  // Laid out with a side menu (chosen 2026-10-28 from three prototypes).
  function reviewView() {
    if (!reviewerKey()) return h("p", { class: "wz-gl-note", text: "Review is off." });
    const running = contests.active();
    const nUp = uploadList().length, nJudge = contests.unscored();
    const judging = ["judging", "Judging", nJudge];
    const sections = isJudge() ? [judging] : [["uploads", "Uploads", nUp]];
    if (!isJudge()) {
      if (running) sections.push(judging);
      sections.push(["log", "Log", 0]);
    }
    if (isOwner()) sections.push(["contests", "Contests", 0], ["reviewers", "Reviewers", 0]);
    if (!sections.some(([k]) => k === rev.section)) { rev.section = sections[0][0]; if (rev.section === "judging") contests.loadJudging(true); }
    const who = rev.who ? `${isJudge() ? "Judging" : "Reviewing"} as ${rev.who.name}${realRole() === "owner" ? " (owner)" : ""}${viewAs ? `, previewing ${viewAs}` : ""}` : "";
    const body = rev.section === "log" ? logView() : rev.section === "reviewers" ? reviewersView() : rev.section === "judging" ? contests.judgingView()
      : rev.section === "contests" ? contests.manageView() : uploadsView();
    const count = (n) => (n ? h("span", { class: "n", text: String(n) }) : null);
    const menu = h("div", { class: "wz-gl-rmenu wz-gl-revtabs" },
      sections.map(([k, label, n]) => h("button", { type: "button", class: rev.section === k ? "on" : "", onclick: () => openSection(k) }, h("span", { text: label }), count(n))),
      h("div", { class: "who wz-gl-rwho", text: who }),
      realRole() === "owner" ? h("div", { class: "who" }, viewAsControl()) : null);
    return h("div", { class: "wz-gl-rv" }, h("div", { class: "wz-gl-rside" }, menu, h("div", {}, body)));
  }
  function openSection(k) {
    rev.section = k;
    rev.sectionError = "";
    if (k !== "reviewers") rev.newKey = null; // a new key is shown once, then gone
    if (k === "log") loadLog();
    if (k === "reviewers") { loadReviewers(); contests.refresh(); }
    if (k === "judging") contests.loadJudging(true);
    if (k === "contests") contests.refresh(true);
    render();
  }
  const ago = (t) => {
    if (!t) return "never";
    const m = Math.max(0, Math.round((Date.now() - t) / 60000));
    return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
  };
  async function loadLog() {
    try { rev.log = (await reviewLog(reviewerKey())).log; rev.sectionError = ""; } catch (e) { rev.sectionError = errText(e); }
    if (open && tab === "review") render();
  }
  async function loadReviewers() {
    try { rev.reviewers = (await reviewersList(reviewerKey())).reviewers; rev.sectionError = ""; } catch (e) { rev.sectionError = errText(e); }
    if (open && tab === "review") render();
  }
  const ACTIONS = { approve: "approved", reject: "rejected", remove: "removed", add_reviewer: "added reviewer", add_judge: "added judge", revoke_reviewer: "revoked key of",
    contest_create: "started contest", contest_edit: "edited contest", contest_archive: "published the results of", contest_delete: "deleted contest" };
  function logView() {
    const head = h("div", { class: "wz-gl-bar" }, h("b", { text: "Recent review actions" }), h("span", { class: "wz-gl-grow" }), button("↻ Refresh", loadLog));
    if (rev.sectionError) return h("div", {}, head, h("div", { class: "wz-gl-issues", text: rev.sectionError }));
    if (!rev.log) return h("div", {}, head, h("p", { class: "wz-gl-note", text: "Loading…" }));
    if (!rev.log.length) return h("div", {}, head, h("p", { class: "wz-gl-note", text: "Nothing yet." }));
    return h("div", {}, head, h("div", { class: "wz-gl-revlog" }, rev.log.map((l) => h("div", {},
      h("b", { text: l.who }), ` ${ACTIONS[l.action] || l.action} `,
      l.post ? h("span", { text: `"${l.title || ""}" #${l.post}` }) : h("b", { text: l.detail || "" }),
      l.post && l.detail ? h("span", { class: "dim", text: ` (${l.detail})` }) : null,
      h("span", { class: "dim", text: ` · ${ago(l.at)}` })))));
  }
  async function addReviewer() {
    const name = rev.newName.trim();
    if (!name) return say("Type the reviewer's name first.");
    rev.adding = true; render();
    try {
      const judge = rev.newRole === "judge" && contests.active();
      const r = judge ? await reviewerAddJudge(reviewerKey(), name) : await reviewerAdd(reviewerKey(), name);
      rev.newKey = { name: r.name, key: r.key, role: r.role };
      rev.newName = "";
      await loadReviewers();
    } catch (e) { say(`Couldn't add ${name}: ${errText(e)}`); }
    rev.adding = false;
    render();
  }
  async function revokeReviewer(r) {
    try {
      await reviewerRevoke(reviewerKey(), r.id);
      say(`Revoked ${r.name}'s key. It stops working now.`);
      await loadReviewers();
    } catch (e) { say(`Couldn't revoke ${r.name}: ${errText(e)}`); render(); }
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(() => true, () => false);
    return Promise.resolve(false);
  }
  function reviewersView() {
    const nameBox = h("input", { type: "text", placeholder: "Their name", maxLength: 30, value: rev.newName, oninput: (e) => { rev.newName = e.target.value; }, onkeydown: (e) => { if (e.key === "Enter") addReviewer(); } });
    const running = contests.active();
    if (!running) rev.newRole = "reviewer";
    const judge = rev.newRole === "judge";
    const addBtn = button(rev.adding ? "Adding…" : judge ? "Add judge" : "Add reviewer", addReviewer, { primary: true, title: judge ? `Make a judge key for "${running.title}"` : "Make a new review key for them" });
    addBtn.disabled = rev.adding;
    const roleBtns = running ? [
      button("Reviewer", () => { rev.newRole = "reviewer"; render(); }, { cls: !judge ? "wz-gl-on" : "", title: "Reviews uploads and can remove posts. Can also score contests." }),
      button(`Judge: ${running.title}`, () => { rev.newRole = "judge"; render(); }, { cls: judge ? "wz-gl-on" : "", title: "Only scores this contest's entries; stops working when its results are published" })
    ] : null;
    const parts = [h("p", { class: "wz-gl-note", text: "Each person gets their own key. Reviewers approve, reject and remove posts, and score contests. Judges only score the running contest, and their key stops working when its results are published. Only your key can add or revoke keys." }),
      h("div", { class: "wz-gl-bar" }, roleBtns, nameBox, addBtn)];
    if (rev.newKey) {
      const keyBox = h("input", { type: "text", readOnly: true, value: rev.newKey.key, class: "wz-gl-key", onfocus: (e) => e.target.select() });
      parts.push(h("div", { class: "wz-gl-rev wz-gl-newkey" },
        h("div", {}, h("b", { text: `${rev.newKey.name}'s ${rev.newKey.role === "judge" ? "judge " : ""}key` }), h("span", { class: "dim", text: " (shown once: it isn't stored anywhere, so copy it now)" })),
        h("div", { class: "wz-gl-bar" }, keyBox,
          button("Copy", () => copyText(rev.newKey.key).then((ok) => { if (ok) say("Copied."); else { keyBox.focus(); say("Press Ctrl+C to copy."); } })),
          button("Done", () => { rev.newKey = null; render(); })),
        h("div", { class: "dim", text: "Send it to them privately (a DM, not a channel). They enter it with Redeem Key, on the Card Maker tab of Wizascript's settings." })));
    }
    if (rev.sectionError) parts.push(h("div", { class: "wz-gl-issues", text: rev.sectionError }));
    else if (!rev.reviewers) parts.push(h("p", { class: "wz-gl-note", text: "Loading…" }));
    else if (!rev.reviewers.length) parts.push(h("p", { class: "wz-gl-note", text: "No reviewers yet." }));
    else parts.push(h("div", { class: "wz-gl-revlog" }, rev.reviewers.map((r) => h("div", { class: "wz-gl-bar" },
      h("b", { text: r.name }),
      h("span", { class: "dim", text: `${r.role === "judge" ? `judge${running && running.id === r.contest ? ` (${running.title})` : ""}` : "reviewer"} · added ${ago(r.addedAt)} · last used ${ago(r.lastUsedAt)}` }),
      h("span", { class: "wz-gl-grow" }),
      removeButton({ rerender: render }, r, { label: "Revoke", confirm: "Revoke?", title: `Stop ${r.name}'s key working`, run: revokeReviewer })))));
    return h("div", {}, ...parts);
  }
  async function deleteMine(e) {
    try {
      await deleteOwnPost(e.id);
      const wasEntry = acct.posts.some((p) => p.id === e.id && p.contest && (p.status === "pending" || p.status === "approved"));
      delete draft.uploads[e.id];
      saveDraft();
      acct.posts = acct.posts.filter((p) => p.id !== e.id);
      say(wasEntry ? `Withdrew "${e.title}". Its slot is free again.` : `Deleted "${e.title}".`);
      if (wasEntry) { refreshMe(true); contests.refresh(true); }
      render();
    } catch (err) { say(`Couldn't delete it: ${errText(err)}`); render(); }
  }
  async function removePost(e) {
    try {
      await reviewRemove(reviewerKey(), e.id);
      say(`Removed ${e.id} from the gallery.`);
      gal.approved = gal.approved.filter((p) => p.id !== e.id);
      render();
      refreshGallery(true);
    } catch (err) { say(`Couldn't remove ${e.id}: ${errText(err)}`); }
  }
  const currentVotes = () => {
    const cur = { ...acct.votes };
    Object.entries(voteQueue.pending()).forEach(([id, v]) => { if (v) cur[id] = v; else delete cur[id]; });
    return cur;
  };
  const errText = (e) => (e instanceof ApiError ? e.message : "Something went wrong.");

  // Linked (or switched) on the Wizascript tab: show it here too.
  onAccountChange((name) => { if (name !== acct.account) { linking = null; refreshMe(true); } });

  // ---- contests (contest.js) ----
  const contests = createContests({
    say: (t) => say(t),
    render: () => render(),
    changed: () => { notify(); if (open && (tab === "contest" || tab === "review" || tab === "submit")) render(); },
    errText,
    hoverable: (el, p, e) => hoverable(el, p, e),
    acct,
    draft,
    reviewerKey,
    who: () => (rev.who ? { ...rev.who, role: role() } : null),
    wheelPages: () => !wheelPages || wheelPages(),
    hideHover: () => hideHover(),
    keyRejected: (code) => onKeyRejected(code),
    refreshMe: (f) => refreshMe(f),
    deleteMine: (e) => deleteMine(e),
    startEntry(id) { submitTo = id; setView("submit"); say("Add the cards to enter, then Review upload."); }
  });

  async function refreshMe(force) {
    if (acct.loading || (!force && acct.loaded && Date.now() - acct.at < 30e3)) return;
    acct.loading = true;
    try {
      const me = await getMe();
      Object.assign(acct, { loaded: true, account: me.account || null, cooldownUntil: me.cooldownUntil || null, votes: me.votes || {}, posts: me.posts || [], contest: me.contest || null, error: "", at: Date.now() });
      accountChanged(acct.account, acct.cooldownUntil);
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
        accountChanged(r.account, r.cooldownUntil);
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
  const panel = h("div", { class: "wz-gl-panel" }, tabs, content, hover);
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
    if (!zoomed && tab !== "browse" && tab !== "contest") return;
    clearTimeout(fitTimer);
    fitTimer = setTimeout(() => { if (tab === "browse" && browseCtl) browseCtl.layout(); else if (tab === "contest") contests.layout(); else refit(); }, 120);
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
      e.status === "pending" ? [h("br"), h("span", { class: "dim", text: "Awaiting approval" })] : null,
      e.status === "rejected" ? [h("br"), h("span", { class: "wz-gl-hreason", text: e.reason ? `Not approved: ${e.reason}` : "Not approved" })] : null) : null;
    const card = h("div", { class: "wz-gl-hcard" }, tile(p));
    hover.replaceChildren(...[card, info].filter(Boolean));
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

  // View as (owner only, for checking what each role sees): a small select
  // under Review's side menu, and a badge to stop it from anywhere.
  function setViewAs(v) { viewAs = v === "owner" ? "" : v; rev.section = ""; notify(); render(); }
  function viewAsControl() {
    if (realRole() !== "owner") return null;
    return h("label", { class: "wz-gl-viewas", title: "See the gallery as another role would. Only the screens change: the server still treats your key as the owner's." }, "View as ",
      h("select", { onchange: (e) => setViewAs(e.target.value) },
        [["owner", "Owner"], ["reviewer", "Reviewer"], ["judge", "Judge"], ["player", "Player"]].map(([v, l]) => h("option", { value: v, text: l, selected: (viewAs || "owner") === v }))));
  }
  const viewAsBadge = () => (viewAs ? h("span", { class: "wz-gl-preview-as" }, `Viewing as ${viewAs} `, button("Stop", () => setViewAs("owner"), { cls: "wz-gl-small", title: "Back to your own view" })) : null);
  function render() {
    hideHover();
    browseCtl = null;
    if (!open) return;
    if (tab === "review" && !(reviewerKey() && role() !== "player")) { tab = "browse"; notify(); }
    tabs.replaceChildren(...[accountBox(), viewAsBadge(), status, h("span", { class: "wz-gl-grow" }), sizeButtons()].filter(Boolean));
    // Browse and Contest fill the panel and turn pages instead of scrolling.
    panel.classList.toggle("browse", tab === "browse" || tab === "contest");
    applyZoom();
    if (tab === "browse") {
      const ctl = browseCtl = browseTab();
      content.replaceChildren(...[linkBox(), ctl.el].filter(Boolean));
      ctl.layout();
      // Again once the window has settled (a nav style or size just changed).
      requestAnimationFrame(() => { if (browseCtl === ctl) ctl.layout(); });
    } else if (tab === "review") {
      content.replaceChildren(reviewView());
      requestAnimationFrame(refit);
    } else if (tab === "contest") {
      content.replaceChildren(...[linkBox(), contests.view()].filter(Boolean));
      contests.layout();
      requestAnimationFrame(() => { if (open && tab === "contest") contests.layout(); });
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
      if (v === "review") refreshReview(true);
      if (v === "contest" || v === "submit") contests.refresh();
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
    const s = targetSlots();
    if (submitTo && !s) out.push("That contest isn't taking entries any more. Upload to the gallery instead.");
    if (s && entries().length > s.left) out.push(s.left ? `This contest takes ${s.left} more entr${s.left === 1 ? "y" : "ies"} from you (${s.used} of ${s.max} used). A set counts as one.` : `You've used all ${s.max} entries in this contest. Withdraw one in the Contest tab to free a slot.`);
    const unnamed = draft.parts.filter((p) => !p.name).length;
    const unnamedSets = draft.groups.filter((g) => !g.name).length;
    if (unnamed) out.push(`${unnamed} card${unnamed === 1 ? " has" : "s have"} no name yet.`);
    if (unnamedSets) out.push(`${unnamedSets} set${unnamedSets === 1 ? " has" : "s have"} no name yet.`);
    return out.concat(uploadProblems(entries()));
  }
  // Where Submit uploads to: the gallery, or the open contest.
  function targetSlots() {
    const s = contests.slots();
    if (!submitTo) return null;
    return s && s.contest.id === submitTo ? s : null;
  }
  function targetPicker() {
    const s = contests.slots();
    if (!s && !submitTo) return null;
    if (!s) { submitTo = null; return null; }
    return h("div", { class: "wz-gl-target" },
      h("span", { text: "Upload to:" }),
      button("Gallery", () => { submitTo = null; render(); }, { cls: !submitTo ? "wz-gl-on" : "", title: "The main gallery, voted on by everyone" }),
      button(`Contest: ${s.contest.title} (${s.left} of ${s.max} left)`, () => { submitTo = s.contest.id; render(); }, { cls: submitTo ? "wz-gl-on" : "", title: `Enter these in the contest. Entries close ${new Date(s.contest.closesAt).toLocaleString()}.` }));
  }
  function uploadBox() {
    const list = entries();
    const nCards = draft.parts.length;
    const summary = `${list.length} entr${list.length === 1 ? "y" : "ies"} (${nCards} card${nCards === 1 ? "" : "s"})`;
    if (!reviewing) {
      const s = targetSlots();
      return h("div", { class: "wz-gl-upload" },
        h("span", { text: `Ready to upload: ${summary}${s ? `, into ${s.contest.title}` : ""}.` }), h("span", { class: "wz-gl-grow" }),
        button("Review upload", () => { reviewing = true; render(); panel.scrollTop = 0; }, { primary: true, title: "See exactly what will be sent before uploading" }));
    }
    const issues = problems();
    const rows = list.map((e) => h("div", { class: "wz-gl-rev" },
      h("div", { class: "wz-gl-revhead" },
        h("b", { text: e.kind === "set" ? `Set ${e.label}: ${e.title || "(no name)"}` : e.title || "(no name)" }),
        h("small", { text: e.kind === "set" ? ` ${e.parts.length} cards` : ` ${e.parts[0].type}` })),
      h("div", { class: "wz-gl-revcards" }, e.parts.map((p) => h("div", { class: "wz-gl-zoom" }, tile(p))))));
    const into = targetSlots();
    const go = button(uploading ? "Uploading…" : into ? "Enter in Contest" : "Upload to Gallery", () => doUpload(), { primary: true, title: issues.length ? issues[0] : "Send these for approval" });
    go.disabled = issues.length > 0 || uploading;
    return h("div", { class: "wz-gl-upload open" },
      targetPicker(),
      h("div", { class: "wz-gl-bar" }, h("b", { text: into ? `Enter ${summary} in ${into.contest.title}` : `Upload ${summary}` }), h("span", { class: "wz-gl-grow" }),
        h("span", { class: "wz-gl-by", text: author() ? `Posting as ${author()}` : "" })),
      h("div", { class: "wz-gl-revlist" }, rows),
      issues.length ? h("div", { class: "wz-gl-issues" }, issues.map((t) => h("div", { text: t }))) : null,
      h("div", { class: "wz-gl-bar wz-gl-revfoot" },
        h("span", { class: "wz-gl-note", style: { margin: 0 }, text: into ? "Each set and single card is one entry, checked against the contest's rules. Approved entries show in the Contest tab, and join the gallery when the results are out." : "Each set and single card is sent as its own entry, for approval. Approved ones show in Browse for everyone." }),
        h("span", { class: "wz-gl-grow" }),
        button("Back", () => { reviewing = false; render(); }), go));
  }
  async function doUpload() {
    if (problems().length || uploading) return render();
    uploading = true;
    render();
    let sent = [], error = "";
    try {
      sent = await uploadEntries(entries(), (i, n) => { if (n > 1 && i < n) say(`Uploading part ${i + 1} of ${n}…`); }, targetSlots() ? submitTo : null);
    } catch (e) {
      sent = (e.extra && e.extra.sent) || [];
      error = errText(e);
    }
    uploading = false;
    if (sent.length) markUploaded(sent);
    reviewing = !!error && !sent.length;
    read = null;
    lastUpload = sent.length || error ? { posts: sent, error, contest: sent.length && sent[0].contest ? contests.active() : null } : null;
    say(error ? (sent.length ? `Uploaded ${sent.length}; the rest didn't go: ${error}` : `Upload failed: ${error}`) : `Uploaded ${sent.length} entr${sent.length === 1 ? "y" : "ies"}.`);
    if (sent.length) { refreshMe(true); if (lastUpload.contest) { submitTo = null; contests.refresh(true); } }
    render();
  }
  function uploadedBox() {
    const posts = lastUpload.posts;
    if (!posts.length) {
      return h("div", { class: "wz-gl-done failed" }, h("b", { text: "Nothing was uploaded." }), " ", lastUpload.error, " ", button("Dismiss", () => { lastUpload = null; render(); }));
    }
    const cards = posts.reduce((n, e) => n + e.local.parts.length, 0);
    return h("div", { class: `wz-gl-done${lastUpload.error ? " failed" : ""}` },
      h("div", {}, h("b", { text: `✓ ${lastUpload.contest ? `Entered in ${lastUpload.contest.title}` : "Sent for approval"}: ${posts.length} entr${posts.length === 1 ? "y" : "ies"} (${cards} card${cards === 1 ? "" : "s"})` })),
      h("ul", {}, posts.map((e) => h("li", { text: e.kind === "set" ? `${e.title} (set of ${e.local.parts.length})` : `${e.title} (${e.local.parts[0].type})` }))),
      lastUpload.error ? h("div", { class: "wz-gl-issues", text: `The rest weren't sent: ${lastUpload.error} They're still in your draft below.` }) : null,
      h("div", { class: "wz-gl-note", style: { margin: "0 0 6px" }, text: lastUpload.contest ? "They're checked against the contest's rules first. See them under Your entries in the Contest tab." : "They show under My posts as awaiting approval, and in Browse for everyone once approved." }),
      lastUpload.contest ? button("See the contest", () => { lastUpload = null; setView("contest"); }, { primary: true })
        : button("See my posts", () => { browse.mineOnly = true; browse.likedOnly = false; browse.list = "new"; browse.page = 0; lastUpload = null; setView("browse"); }, { primary: true }),
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
    // Contest entries show in the Contest tab, and join Browse with the results.
    const own = acct.posts
      .filter((p) => !p.contest && (p.status === "pending" || p.status === "rejected") && draft.uploads[p.id])
      .map((p) => ({ id: p.id, status: p.status, reason: p.reason, postedAt: p.postedAt, kind: draft.uploads[p.id].kind, title: draft.uploads[p.id].title, parts: draft.uploads[p.id].parts }));
    // Just approved, but not in the gallery's index yet: still show its copy.
    acct.posts.filter((p) => !p.contest && p.status === "approved" && draft.uploads[p.id] && !gal.approved.some((a) => a.id === p.id))
      .forEach((p) => own.push({ id: p.id, status: "pending", postedAt: p.postedAt, kind: draft.uploads[p.id].kind, title: draft.uploads[p.id].title, parts: draft.uploads[p.id].parts }));
    const list = allEntries({ approved: gal.approved, own, totals: gal.totals, baseVotes: gal.base, current: currentVotes(), account: acct.account });
    return browseView({
      state: browse,
      wheelPages: () => !wheelPages || wheelPages(),
      onPage: hideHover,
      entries: list,
      note: gal.error ? `Couldn't load the gallery: ${gal.error}` : acct.account ? "" : "Link your account to vote.",
      emptyText: gal.loading && !gal.at ? "* Loading the gallery…" : gal.error && !gal.at ? "* Couldn't load the gallery. Try again in a moment." : "",
      hoverable,
      rerender: render,
      onRefresh: () => { voteQueue.flush(); refreshMe(true); refreshGallery(true); },
      onRemove: reviewerKey() && (role() === "owner" || role() === "reviewer") ? removePost : null,
      onDelete: deleteMine,
      vote(e, dir) {
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
    isReviewer: () => !!reviewerKey() && role() !== "player",
    pendingCount: () => (!reviewerKey() ? 0 : isJudge() ? contests.unscored() : rev.list.length),
    // The Card Maker opened: the reviewer's count of uploads waiting.
    opened() { if (reviewerKey()) refreshReview(); },
    // ___ucReviewList turned review on or off.
    reviewerChanged() {
      rev = blankRev();
      if (reviewerKey()) refreshReview(true);
      else if (open && tab === "review") { setView("browse"); return; }
      notify();
      if (open) render();
    },
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
