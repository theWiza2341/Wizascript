// packages/card-maker/gallery/notes.js
//
// Post notes (Wizascript 1.7.4 / Worker 1.9): a short, text-only conversation
// between the gallery's staff (owner and reviewers) and the author of one post.
// Shared by the Card Maker's gallery and the gallery website.
//
//  - Staff: Review → Notes (open notes, unread first; Archive = closed ones,
//    kept with every message). A note starts from an upload (Note…), from Browse
//    (✉ on a post) or from the Log (✉ on any post, e.g. an older rejected one).
//    A rejection with a reason starts one by itself.
//  - Authors: a Notes button in the gallery's top bar (with the unread count),
//    ✉ on their own posts in Browse, and a "New message" popup when they come
//    back (newNoteAlerts below).
//  - Either side can close a note; approving the post, or its author cancelling,
//    withdrawing or deleting it, closes it too. Opening and closing are logged.

import { h, button } from "./dom.js";
import { notesList, noteGet, noteOpen, noteReply, noteClose, myNotes, myNote, myNoteReply, myNoteClose, NOTE_MAX } from "./api.js";

export const NOTES_CSS = `
.wz-nt-list { display: flex; flex-direction: column; gap: 6px; }
.wz-nt-row { display: flex; align-items: center; gap: 8px; text-align: left; background: #111; border: 1px solid #444; border-radius: 3px; color: #ddd; padding: 8px 10px; font: 13px Arial, sans-serif; cursor: pointer; }
.wz-nt-row:hover { border-color: #aaa; color: #fff; }
.wz-nt-row.unread { border-color: #ffd84a; }
.wz-nt-row .t { font-weight: bold; color: #fff; }
.wz-nt-row .grow { flex: 1 1 auto; }
.wz-nt-dot { display: inline-block; width: 8px; height: 8px; border-radius: 4px; background: #ffd84a; flex: none; }
.wz-nt-thread { display: flex; flex-direction: column; gap: 8px; max-width: 760px; }
.wz-nt-msgs { display: flex; flex-direction: column; gap: 6px; }
.wz-nt-msg { max-width: 85%; padding: 6px 10px; border-radius: 6px; background: #1d1d1d; border: 1px solid #444; font: 13px/1.4 Arial, sans-serif; white-space: pre-wrap; overflow-wrap: anywhere; }
.wz-nt-msg.me { align-self: flex-end; background: #1d2a44; border-color: #4464bd; }
.wz-nt-msg .who { display: block; font-size: 11px; opacity: .7; margin-bottom: 2px; white-space: normal; }
.wz-nt-compose textarea { width: 100%; min-height: 64px; resize: vertical; box-sizing: border-box; background: #222; color: #fff; border: 1px solid #666; border-radius: 3px; padding: 6px 8px; font: 13px Arial, sans-serif; }
.wz-nt-compose textarea:focus { border-color: #8ea6e8; outline: none; }
.wz-nt-closed { padding: 6px 10px; border: 1px dashed #666; border-radius: 3px; color: #aaa; font-size: 12px; }
.wz-nt-btn { background: none; border: 1px solid #888; border-radius: 3px; color: #ddd; font: 11px Arial, sans-serif; padding: 0 5px; height: 18px; cursor: pointer; }
.wz-nt-btn:hover { color: #fff; border-color: #fff; }
.wz-nt-btn.unread { border-color: #ffd84a; color: #ffd84a; }
`;

const ago = (t) => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};
const WHY = { closed: "closed", approved: "the post was approved", cancelled: "the upload was cancelled", withdrawn: "the entry was withdrawn", deleted: "the post was deleted" };

// ctx: { reviewerKey(), isStaff(), say(text), render(), errText(e), changed() }
export function createNotes(ctx) {
  const staff = { open: null, closed: null, archive: false, loading: false, error: "", at: 0 };
  const mine = { list: null, loading: false, error: "", at: 0 };
  let cur = null;      // { id, side, thread, messages, error, draft, sending }
  let compose = null;  // staff: { post, title, draft, sending, error }

  async function refreshStaff(force) {
    const key = ctx.reviewerKey();
    if (!key || !ctx.isStaff() || staff.loading || (!force && staff.at && Date.now() - staff.at < 30e3)) return;
    staff.loading = true;
    try {
      const [o, c] = await Promise.all([notesList(key, false), staff.archive ? notesList(key, true) : Promise.resolve(null)]);
      staff.open = o.threads;
      if (c) staff.closed = c.threads;
      staff.error = ""; staff.at = Date.now();
    } catch (e) { staff.error = ctx.errText(e); }
    staff.loading = false;
    ctx.changed();
  }
  async function refreshMine(force) {
    if (mine.loading || (!force && mine.at && Date.now() - mine.at < 30e3)) return;
    mine.loading = true;
    try { mine.list = (await myNotes()).threads; mine.error = ""; mine.at = Date.now(); }
    catch (e) { mine.list = e && e.code === "not_linked" ? [] : mine.list; mine.error = e && e.code === "not_linked" ? "" : ctx.errText(e); }
    mine.loading = false;
    ctx.changed();
  }
  const staffUnread = () => (staff.open || []).filter((t) => t.unread).length;
  const mineUnread = () => (mine.list || []).filter((t) => t.unread).length;
  const hasMine = () => !!(mine.list && mine.list.length);
  // The author's open note on a post (Browse's ✉ on their own posts).
  const mineFor = (postId) => (mine.list || []).find((t) => t.post === postId && t.status === "open") || null;

  async function openThread(id, side) {
    compose = null;
    cur = { id, side, thread: null, messages: [], error: "", draft: cur && cur.id === id ? cur.draft : "", sending: false };
    ctx.render();
    try {
      const r = side === "staff" ? await noteGet(ctx.reviewerKey(), id) : await myNote(id);
      if (!cur || cur.id !== id) return;
      cur.thread = r.thread; cur.messages = r.messages;
      // Reading it clears its unread marker in the lists too.
      const list = side === "staff" ? [...(staff.open || []), ...(staff.closed || [])] : mine.list || [];
      list.filter((t) => t.id === id).forEach((t) => { t.unread = false; });
    } catch (e) { if (cur && cur.id === id) cur.error = ctx.errText(e); }
    ctx.changed();
    ctx.render();
  }
  function closeThreadView() { cur = null; compose = null; ctx.render(); }
  // Staff: start a note on a post (or add to its open one).
  function startNote(post) { cur = null; compose = { post: post.id, title: post.title || "", draft: "", sending: false, error: "" }; ctx.render(); }

  async function send() {
    if (!cur || cur.sending) return;
    const text = cur.draft.trim();
    if (!text) return;
    cur.sending = true; cur.error = ""; ctx.render();
    try {
      if (cur.side === "staff") await noteReply(ctx.reviewerKey(), cur.id, text); else await myNoteReply(cur.id, text);
      cur.draft = "";
      cur.sending = false;
      await openThread(cur.id, cur.side);
      if (cur.side === "staff") refreshStaff(true); else refreshMine(true);
      return;
    } catch (e) { cur.error = ctx.errText(e); }
    cur.sending = false; ctx.render();
  }
  async function closeIt() {
    if (!cur) return;
    try {
      if (cur.side === "staff") await noteClose(ctx.reviewerKey(), cur.id); else await myNoteClose(cur.id);
      ctx.say("Note closed. It's kept in the log.");
      const { id, side } = cur;
      await openThread(id, side);
      if (side === "staff") refreshStaff(true); else refreshMine(true);
    } catch (e) { cur.error = ctx.errText(e); ctx.render(); }
  }
  async function sendNew() {
    if (!compose || compose.sending) return;
    const text = compose.draft.trim();
    if (!text) return;
    compose.sending = true; compose.error = ""; ctx.render();
    try {
      const r = await noteOpen(ctx.reviewerKey(), compose.post, text);
      compose = null;
      refreshStaff(true);
      await openThread(r.id, "staff");
    } catch (e) { compose.error = ctx.errText(e); compose.sending = false; ctx.render(); }
  }

  // ---- pieces ----
  const textBox = (state, onEnter) => {
    const counter = h("span", { class: "dim", text: `${state.draft.length}/${NOTE_MAX}` });
    const ta = h("textarea", { maxLength: NOTE_MAX, placeholder: "Write a note (text only, no links)",
      oninput: (e) => { state.draft = e.target.value; counter.textContent = `${state.draft.length}/${NOTE_MAX}`; },
      onkeydown: (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onEnter(); } e.stopPropagation(); } });
    ta.value = state.draft;
    return { ta, counter };
  };
  function closeButton() {
    const b = button("Close note", () => {}, { title: "End this conversation. It stays in the log." });
    let armed = null;
    b.onclick = () => {
      if (!armed) { b.textContent = "Close it?"; b.classList.add("wz-key-danger"); armed = setTimeout(() => { armed = null; b.textContent = "Close note"; b.classList.remove("wz-key-danger"); }, 3000); return; }
      clearTimeout(armed); b.disabled = true; closeIt();
    };
    return b;
  }
  function threadView() {
    const t = cur.thread;
    const back = button("← Back", closeThreadView);
    if (!t) return h("div", { class: "wz-nt-thread" }, h("div", { class: "wz-gl-bar" }, back), cur.error ? h("div", { class: "wz-gl-issues", text: cur.error }) : h("p", { class: "wz-gl-note", text: "Loading…" }));
    const meSide = cur.side;
    const head = h("div", { class: "wz-gl-bar" }, back, h("b", { text: ` "${t.title}"` }), h("span", { class: "dim", text: ` #${t.post}${meSide === "staff" ? ` · by ${t.author}` : ""}` }));
    const msgs = h("div", { class: "wz-nt-msgs" }, cur.messages.map((m) => h("div", { class: `wz-nt-msg${m.side === meSide ? " me" : ""}` },
      h("span", { class: "who", text: `${m.side === "staff" ? (meSide === "author" ? `${m.who} (gallery staff)` : m.who) : m.who} · ${ago(m.at)}` }), m.text)));
    const parts = [head, msgs];
    if (t.status === "open") {
      const { ta, counter } = textBox(cur, send);
      parts.push(h("div", { class: "wz-nt-compose" }, ta),
        h("div", { class: "wz-gl-bar" }, button(cur.sending ? "Sending…" : "Send", send, { primary: true, title: "Ctrl+Enter sends" }), counter, h("span", { class: "wz-gl-grow" }), closeButton()));
      setTimeout(() => { if (ta.isConnected && !cur.draft) ta.focus(); }, 30);
    } else {
      parts.push(h("div", { class: "wz-nt-closed", text: `Closed by ${t.closedBy}${t.closeWhy && t.closeWhy !== "closed" ? ` (${WHY[t.closeWhy] || t.closeWhy})` : ""} · ${ago(t.closedAt)}.${meSide === "author" ? " Kept for the gallery's records." : ""}` }));
    }
    if (cur.error) parts.push(h("div", { class: "wz-gl-issues", text: cur.error }));
    return h("div", { class: "wz-nt-thread" }, parts);
  }
  function row(t, side) {
    const other = side === "staff" ? t.author : "gallery staff";
    return h("button", { type: "button", class: `wz-nt-row${t.unread ? " unread" : ""}`, onclick: () => openThread(t.id, side) },
      t.unread ? h("span", { class: "wz-nt-dot", title: "New message" }) : null,
      h("span", { class: "t", text: t.title }),
      h("span", { class: "dim", text: `#${t.post} · ${other}` }),
      h("span", { class: "grow" }),
      h("span", { class: "dim", text: t.status === "open" ? `${t.msgs} message${t.msgs === 1 ? "" : "s"} · last from ${t.lastFrom === "staff" ? "staff" : side === "staff" ? t.author : "you"} ${ago(t.lastAt)}` : `closed ${ago(t.closedAt)}` }));
  }

  // Review → Notes (staff).
  function staffView() {
    if (compose) {
      const { ta, counter } = textBox(compose, sendNew);
      setTimeout(() => { if (ta.isConnected) ta.focus(); }, 30);
      return h("div", { class: "wz-nt-thread" },
        h("div", { class: "wz-gl-bar" }, button("← Back", closeThreadView), h("b", { text: ` New note on "${compose.title}"` }), h("span", { class: "dim", text: ` #${compose.post}` })),
        h("p", { class: "wz-gl-note", text: "The post's author sees it in the gallery and can answer. If the post already has an open note, this adds to it." }),
        h("div", { class: "wz-nt-compose" }, ta),
        h("div", { class: "wz-gl-bar" }, button(compose.sending ? "Sending…" : "Send", sendNew, { primary: true }), counter),
        compose.error ? h("div", { class: "wz-gl-issues", text: compose.error }) : null);
    }
    if (cur && cur.side === "staff") return threadView();
    const pick = (archive) => { staff.archive = archive; refreshStaff(true); ctx.render(); };
    const head = h("div", { class: "wz-gl-bar" },
      h("span", { class: "wz-gl-sizes" }, button("Open", () => pick(false), { cls: staff.archive ? "" : "wz-gl-on" }), button("Archive", () => pick(true), { cls: staff.archive ? "wz-gl-on" : "", title: "Closed notes, with every message" })),
      h("span", { class: "wz-gl-grow" }), button("↻ Refresh", () => refreshStaff(true)));
    if (staff.error) return h("div", {}, head, h("div", { class: "wz-gl-issues", text: staff.error }));
    const list = staff.archive ? staff.closed : staff.open;
    if (!list) return h("div", {}, head, h("p", { class: "wz-gl-note", text: "Loading…" }));
    const sorted = staff.archive ? list : list.slice().sort((a, b) => (b.unread - a.unread) || (b.lastAt - a.lastAt));
    const note = h("p", { class: "wz-gl-note", text: staff.archive ? "Closed notes, newest first." : "Notes with each post's author. Start one with Note… on an upload, ✉ on a post in Browse, or ✉ in the Log." });
    if (!sorted.length) return h("div", {}, head, note, h("p", { class: "wz-gl-note", text: staff.archive ? "Nothing closed yet." : "No open notes." }));
    return h("div", {}, head, note, h("div", { class: "wz-nt-list" }, sorted.map((t) => row(t, "staff"))));
  }
  // The Notes view (authors).
  function mineView() {
    if (cur && cur.side === "author") return threadView();
    const head = h("div", { class: "wz-gl-bar" }, h("b", { text: "Notes from the gallery staff" }), h("span", { class: "wz-gl-grow" }), button("↻ Refresh", () => refreshMine(true)));
    if (mine.error) return h("div", {}, head, h("div", { class: "wz-gl-issues", text: mine.error }));
    if (!mine.list) return h("div", {}, head, h("p", { class: "wz-gl-note", text: "Loading…" }));
    if (!mine.list.length) return h("div", {}, head, h("p", { class: "wz-gl-note", text: "No notes. When the gallery staff write about one of your posts, it shows here." }));
    return h("div", {}, head, h("p", { class: "wz-gl-note", text: "About your posts. Answer here; either side can close a note when it's settled." }),
      h("div", { class: "wz-nt-list" }, mine.list.map((t) => row(t, "author"))));
  }

  return { refreshStaff, refreshMine, staffUnread, mineUnread, hasMine, mineFor, openThread, startNote, staffView, mineView, inThread: () => !!(cur || compose), reset() { cur = null; compose = null; } };
}

// ---- the "new message" popup when an author comes back -------------------------------
// Checked at most every `every` ms (GM), and only once this install has
// credentials (it never makes one just to ask). Returns the notes with a new
// staff message not shown before (each new message shows once).
const AUTH_KEY = "wizascript.cardMaker.galleryAuth";
export const NOTES_CHECK_KEY = "wizascript.cardMaker.notesCheck";   // { at, notLinked }
export const NOTES_SHOWN_KEY = "wizascript.cardMaker.notesShown";   // { threadId: lastAt }
export async function newNoteAlerts({ every = 5 * 60e3 } = {}) {
  let auth = null;
  try { auth = GM_getValue(AUTH_KEY, null); } catch (e) { return []; }
  if (!auth) return [];
  let check = {};
  try { check = JSON.parse(GM_getValue(NOTES_CHECK_KEY, "{}")) || {}; } catch (e) { check = {}; }
  const wait = check.notLinked ? 6 * 3600e3 : every;
  if (check.at && Date.now() - check.at < wait) return [];
  let threads;
  try { threads = (await myNotes()).threads || []; GM_setValue(NOTES_CHECK_KEY, JSON.stringify({ at: Date.now() })); }
  catch (e) { GM_setValue(NOTES_CHECK_KEY, JSON.stringify({ at: Date.now(), notLinked: e && e.code === "not_linked" })); return []; }
  let shown = {};
  try { shown = JSON.parse(GM_getValue(NOTES_SHOWN_KEY, "{}")) || {}; } catch (e) { shown = {}; }
  const fresh = threads.filter((t) => t.unread && t.status === "open" && shown[t.id] !== t.lastAt);
  const keep = {};
  threads.forEach((t) => { if (shown[t.id]) keep[t.id] = shown[t.id]; });
  fresh.forEach((t) => { keep[t.id] = t.lastAt; });
  GM_setValue(NOTES_SHOWN_KEY, JSON.stringify(keep));
  return fresh;
}
export const alertText = (fresh) => (fresh.length === 1 ? `New message on "${fresh[0].title}"` : `New messages on ${fresh.length} of your posts`);
