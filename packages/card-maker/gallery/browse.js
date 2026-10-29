// packages/card-maker/gallery/browse.js
//
// The Browse tab: four lists (Newest, This Week, This Month, All Time) in a
// segmented bar with a sliding highlight, shown a page at a time. Each item
// is a card, or a set's cards in one row with only its name; likes and
// dislikes sit underneath, with a #rank on the ranked lists. A page holds
// as many items as fit in the window, worked out from the items' real
// sizes, so it never needs the scroll bar; ‹ › at the bottom right (or the
// scroll wheel, a setting) turns the page.

import { h } from "./dom.js";
import { tile, fitCard } from "./render.js";

export const LISTS = [["new", "Newest"], ["week", "This Week"], ["month", "This Month"], ["all", "All Time"]];
const DT = `"DTM-Mono", "DTM Mono", "WZ DTM Mono", monospace`;

export const BROWSE_CSS = `
.wz-gl-browse { --wz-gl-accent: #ffd84a; display: flex; flex-direction: column; height: 100%; min-height: 0; }
.wz-gl-dt { font-family: ${DT}; }
.wz-gl-empty { opacity: .7; padding: 20px 0; text-align: center; }
.wz-gl-pagearea { flex: 1 1 auto; min-height: 0; overflow: hidden; position: relative; }
.wz-gl-pagearea .wz-gl-grid { align-content: flex-start; padding-top: 4px; }
.wz-gl-foot { display: flex; align-items: center; gap: 8px; padding-top: 6px; border-top: 1px solid #2a2a2a; min-height: 30px; }
.wz-gl-foot .note { opacity: .5; font-size: 11px; }
.wz-gl-foot .grow { flex: 1; }
.wz-gl-refresh { background: #000; border: 2px solid #777; color: #ccc; width: 26px; height: 24px; padding: 0; cursor: pointer; font-size: 14px; line-height: 18px; }
.wz-gl-refresh:hover { border-color: #fff; color: #fff; }
.wz-gl-pager { display: flex; align-items: center; gap: 6px; }
.wz-gl-pager button { background: #000; border: 2px solid #fff; color: #fff; width: 28px; height: 26px; padding: 0; font: 15px/20px ${DT}; cursor: pointer; }
.wz-gl-pager button:hover:not(:disabled) { color: var(--wz-gl-accent); border-color: var(--wz-gl-accent); }
.wz-gl-pager button:disabled { opacity: .3; cursor: default; }
.wz-gl-pager .n { font: 13px ${DT}; min-width: 54px; text-align: center; }

/* item + votes */
.wz-gl-item { position: relative; transition: transform .12s; }
.wz-gl-item:hover { transform: translateY(-2px); }
.wz-gl-item.set { border: 2px solid #555; background: #0a0a0a; padding: 4px 6px 3px; }
.wz-gl-item.set:hover { border-color: #fff; }
.wz-gl-setname { font-family: ${DT}; font-size: 12px; color: var(--wz-gl-accent); letter-spacing: .5px; }
.wz-gl-votes { gap: 6px; }
.wz-gl-vote { background: none; border: 0; padding: 0 3px; cursor: pointer; font-size: 13px; line-height: 16px; color: #777; }
.wz-gl-vote:hover { color: #fff; }
.wz-gl-vote.up.on { color: #3ee05a; }
.wz-gl-vote.down.on { color: #ff4d4d; }
.wz-gl-score { font-family: ${DT}; font-size: 13px; min-width: 28px; }
.wz-gl-score.pos { color: #b9f5c3; } .wz-gl-score.neg { color: #f5b9b9; }
.wz-gl-rank { color: var(--wz-gl-accent); font: 12px/16px ${DT}; margin-right: 4px; }
.wz-gl-sethead { display: flex; align-items: center; gap: 8px; align-self: stretch; min-width: 0; }
.wz-gl-sethead .wz-gl-setname { flex: 1 1 auto; min-width: 0; text-align: center; }
.wz-gl-mine { flex: none; background: #4464bd; border: 1px solid #8ea6e8; color: #fff; font: 9px/13px Arial, sans-serif; padding: 0 4px; white-space: nowrap; }
.wz-gl-votes .wz-gl-mine { order: 9; margin-left: 2px; }

/* slide-in */
@keyframes wz-gl-in-r { from { transform: translateX(60px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes wz-gl-in-l { from { transform: translateX(-60px); opacity: 0; } to { transform: none; opacity: 1; } }
.wz-gl-in-r { animation: wz-gl-in-r .25s ease-out; }
.wz-gl-in-l { animation: wz-gl-in-l .25s ease-out; }

/* list bar */
.wz-gl-listbar { display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; flex: none; }
.wz-gl-filters { display: flex; gap: 6px; }
.wz-gl-filter { display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; background: #000; border: 2px solid #777; color: #bbb; font: 13px ${DT}; cursor: pointer; }
.wz-gl-filter:hover { border-color: #fff; color: #fff; }
.wz-gl-filter .box { display: inline-block; width: 12px; height: 12px; border: 2px solid currentColor; font-size: 10px; line-height: 9px; text-align: center; }
.wz-gl-filter.on { border-color: var(--wz-gl-accent); color: var(--wz-gl-accent); }
.wz-gl-mine.pending { background: #6b5a14; border-color: #ffd84a; }
.wz-gl-remove { background: none; border: 1px solid #553; color: #a88; font-size: 10px; line-height: 14px; padding: 0 4px; margin-left: 4px; cursor: pointer; }
.wz-gl-remove:hover, .wz-gl-remove.armed { border-color: #e07a7a; color: #ffb4b4; }
.wz-gl-mine.rejected { background: #5a1f1f; border-color: #e07a7a; }
.wz-gl-seg { position: relative; display: flex; margin: 0; width: 100%; max-width: 560px; flex: 1 1 360px; border: 2px solid #fff; background: #000; }
.wz-gl-seg button { flex: 1 1 0; position: relative; z-index: 1; background: none; border: 0; color: #bbb; padding: 6px 0 5px; font-size: 14px; cursor: pointer; font-family: ${DT}; }
.wz-gl-seg button:hover { color: #fff; }
.wz-gl-seg button.on { color: #000; }
.wz-gl-seg .pill { position: absolute; top: 0; bottom: 0; width: 25%; background: var(--wz-gl-accent); transition: left .25s ease; }
`;

const seed = (s) => { let x = 7; for (const c of s) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x; };

// Everything Browse lists, each with a score and the player's vote.
//   approved: the gallery's posts (index.json), totals { id: [up, down] }
//   own:      the player's posts still waiting or rejected (with cards
//             kept from their upload)
//   myVotes:  votes the server has, at the time totals were read (base)
//   current:  the player's votes now, incl. ones still queued
export function allEntries({ approved, own, totals, baseVotes, current, account }) {
  const now = Date.now();
  const days = (t) => Math.max(0, Math.floor((now - (t || now)) / 864e5));
  const server = approved.map((p) => {
    const t = totals[p.id] || [0, 0];
    const vote = current[p.id] || 0;
    return { key: p.id, id: p.id, kind: p.kind, title: p.title, parts: p.parts, author: p.author, status: "approved",
      mine: !!account && p.author === account, days: days(p.approvedAt || p.postedAt), vote, score: t[0] - t[1] - (baseVotes[p.id] || 0) + vote };
  });
  const waiting = own.map((p) => ({ key: p.id, id: p.id, kind: p.kind, title: p.title, parts: p.parts, author: account, status: p.status, reason: p.reason,
    mine: true, days: days(p.postedAt), vote: 0, score: 0 }));
  return server.concat(waiting);
}

// My posts / Liked: narrow any list, separately or together.
export function filtered(entries, { mineOnly, likedOnly }) {
  return entries.filter((e) => (!mineOnly || e.mine) && (!likedOnly || e.vote === 1));
}

export function listFor(entries, key) {
  if (key === "new") return entries.slice().sort((a, b) => a.days - b.days || b.score - a.score);
  const max = key === "week" ? 7 : key === "month" ? 30 : Infinity;
  return entries.filter((e) => e.days < max).sort((a, b) => b.score - a.score);
}

// ctx: { state: { list, page, dir }, entries, vote(e, dir), rerender(),
//        hoverable(el, part, entry), wheelPages() }
// Returns { el, layout() }: call layout() once el is on screen, and again
// when the window is resized.
export function browseView(ctx) {
  const { state } = ctx;
  const list = listFor(filtered(ctx.entries, state), state.list);
  const dir = state.dir; state.dir = null;
  const area = h("div", { class: "wz-gl-pagearea" });
  const count = h("span", { class: "n" });
  const prev = h("button", { title: "Previous page", text: "‹", onclick: () => turn(-1) });
  const next = h("button", { title: "Next page", text: "›", onclick: () => turn(1) });
  const foot = h("div", { class: "wz-gl-foot" },
    ctx.onRefresh ? h("button", { type: "button", class: "wz-gl-refresh", title: "Load the latest posts and votes", text: "↻", onclick: () => ctx.onRefresh() }) : null,
    h("span", { class: "note", text: ctx.note || "" }),
    h("span", { class: "grow" }),
    h("div", { class: "wz-gl-pager" }, prev, count, next));
  const el = h("div", { class: "wz-gl-browse" }, h("div", { class: "wz-gl-listbar" }, segBar(ctx, dir), filterButtons(ctx)), area, foot);

  const items = list.map((e, i) => item(ctx, e, i + 1, state.list));
  let pages = [[]];
  let animate = dir;

  function layout() {
    // Lay every item out once in the real width, read the rows, then cut
    // the rows into pages that fit the height.
    const H = area.clientHeight;
    const grid = h("div", { class: "wz-gl-grid" });
    area.replaceChildren(grid);
    if (!items.length) {
      area.replaceChildren(h("div", { class: "wz-gl-empty wz-gl-dt", text: ctx.emptyText ? ctx.emptyText : state.mineOnly && !ctx.entries.some((e) => e.mine) ? "* You haven't uploaded anything yet." : state.likedOnly ? "* Nothing you've liked here yet." : "* Nothing here yet." }));
      pages = [[]];
      return show();
    }
    items.forEach((it) => { it.style.display = ""; grid.appendChild(it); });
    items.forEach((it) => it.querySelectorAll(".wz-gl-card:not(.wz-gl-pic), .wz-gl-artifact").forEach(fitCard));
    // A new row starts when an item sits left of the one before it (items
    // in one row line up at the bottom, so their tops differ).
    const rows = [];
    let lastLeft = Infinity;
    items.forEach((it, i) => {
      const t = it.offsetTop, l = it.offsetLeft;
      if (!rows.length || l <= lastLeft) rows.push({ start: i, top: t, bottom: t + it.offsetHeight });
      lastLeft = l;
      const r = rows[rows.length - 1];
      r.end = i;
      r.top = Math.min(r.top, t);
      r.bottom = Math.max(r.bottom, t + it.offsetHeight);
    });
    pages = [];
    let page = null, pageTop = 0;
    rows.forEach((r) => {
      if (!page || r.bottom - pageTop > H) { page = []; pages.push(page); pageTop = r.top; }
      for (let i = r.start; i <= r.end; i++) page.push(i);
    });
    state.page = Math.max(0, Math.min(state.page || 0, pages.length - 1));
    show();
  }

  function show() {
    const grid = area.querySelector(".wz-gl-grid");
    if (grid) {
      const on = new Set(pages[state.page] || []);
      items.forEach((it, i) => { it.style.display = on.has(i) ? "" : "none"; });
      grid.classList.remove("wz-gl-in-r", "wz-gl-in-l");
      if (animate) { void grid.offsetWidth; grid.classList.add("wz-gl-in-" + animate); animate = null; }
    }
    count.textContent = `${pages.length ? state.page + 1 : 0} / ${pages.length}`;
    prev.disabled = state.page <= 0;
    next.disabled = state.page >= pages.length - 1;
  }

  function turn(d) {
    const to = state.page + d;
    if (to < 0 || to >= pages.length) return false;
    state.page = to;
    animate = d > 0 ? "r" : "l";
    ctx.onPage && ctx.onPage();
    show();
    return true;
  }

  // One page per wheel gesture (trackpads send many small events).
  let wheelLock = 0;
  area.addEventListener("wheel", (e) => {
    if (!ctx.wheelPages()) return;
    e.preventDefault();
    const now = Date.now();
    if (now < wheelLock || Math.abs(e.deltaY) < 4) return;
    if (turn(e.deltaY > 0 ? 1 : -1)) wheelLock = now + 280;
  }, { passive: false });

  return { el, layout };
}

function filterButtons(ctx) {
  const { state } = ctx;
  const toggle = (key, label, title) => h("button", { type: "button", class: `wz-gl-filter${state[key] ? " on" : ""}`, title, "aria-pressed": state[key] ? "true" : "false",
    onclick: () => { state[key] = !state[key]; state.page = 0; ctx.rerender(); } }, h("span", { class: "box", text: state[key] ? "✓" : "" }), label);
  return h("div", { class: "wz-gl-filters" },
    toggle("mineOnly", "My posts", "Only what you've uploaded"),
    toggle("likedOnly", "Liked", "Only what you've liked"));
}

function segBar(ctx, dir) {
  const { state } = ctx;
  const i = LISTS.findIndex((l) => l[0] === state.list);
  const pill = h("span", { class: "pill", style: { left: (dir ? (i + (dir === "r" ? -1 : 1)) * 25 : i * 25) + "%" } });
  if (dir) requestAnimationFrame(() => requestAnimationFrame(() => { pill.style.left = i * 25 + "%"; }));
  const go = (key) => {
    if (key === state.list) return;
    const to = LISTS.findIndex((l) => l[0] === key);
    state.dir = to > i ? "r" : "l";
    state.list = key;
    state.page = 0;
    ctx.rerender();
  };
  return h("div", { class: "wz-gl-seg" }, pill, LISTS.map(([k, l]) => h("button", { type: "button", class: k === state.list ? "on" : "", text: l, onclick: () => go(k) })));
}

// A two-click button: click once to arm, again within 3 s. Used by the
// reviewer to take a post down, and by authors to delete a rejected post.
export function removeButton(ctx, e, { label = "✕", confirm = "Remove?", title = "Remove from the gallery (reviewer)", run = ctx.onRemove } = {}) {
  const b = h("button", { type: "button", class: "wz-gl-remove", title, text: label });
  let armed = null;
  b.addEventListener("click", () => {
    if (!armed) { b.classList.add("armed"); b.textContent = confirm; armed = setTimeout(() => { armed = null; b.classList.remove("armed"); b.textContent = label; }, 3000); return; }
    clearTimeout(armed);
    b.disabled = true;
    b.textContent = "…";
    run(e);
  });
  return b;
}

function item(ctx, e, rank, listKey) {
  const isSet = e.kind === "set";
  const vote = (dir) => ctx.vote(e, dir);
  // Your own posts get a small tag, inside the item so it never covers
  // anything: a set's in its top row (right of the name), a single card's
  // in the votes row.
  const pending = e.status === "pending", rejected = e.status === "rejected";
  const tag = e.mine ? h("span", {
    class: `wz-gl-mine${pending ? " pending" : rejected ? " rejected" : ""}`,
    text: pending ? (isSet ? "awaiting approval" : "pending") : rejected ? "not approved" : "yours",
    title: pending ? "Awaiting approval: shows to everyone once approved" : rejected ? "This upload wasn't approved" : "Your post"
  }) : null;
  const canVote = e.status === "approved";
  return h("div", { class: `wz-gl-item${isSet ? " set" : ""}`, "data-key": e.key },
    isSet ? h("div", { class: "wz-gl-sethead" }, h("div", { class: "wz-gl-setname", text: e.title || "(no name)", title: e.title || "" }), tag) : null,
    h("div", { class: "wz-gl-row" }, e.parts.map((p) => ctx.hoverable(h("div", { class: "wz-gl-zoom" }, tile(p)), p, e))),
    h("div", { class: "wz-gl-votes" },
      listKey !== "new" ? h("span", { class: "wz-gl-rank", title: "Rank", text: "# " + rank }) : null,
      isSet ? null : tag,
      canVote ? [
        h("button", { type: "button", class: `wz-gl-vote up${e.vote === 1 ? " on" : ""}`, title: "Like", text: "▲", onclick: () => vote(1) }),
        h("span", { class: `wz-gl-score${e.score > 0 ? " pos" : e.score < 0 ? " neg" : ""}`, text: String(e.score) }),
        h("button", { type: "button", class: `wz-gl-vote down${e.vote === -1 ? " on" : ""}`, title: "Dislike", text: "▼", onclick: () => vote(-1) })
      ] : null,
      ctx.onRemove && e.status === "approved" ? removeButton(ctx, e) : null,
      ctx.onDelete && e.mine && e.status === "rejected" ? removeButton(ctx, e, { label: "Delete", confirm: "Delete for good?", title: "Delete this post: it wasn't approved, so it's only taking up space", run: ctx.onDelete }) : null));
}

// Any list of items, a page at a time, like Browse: lays the items out in the
// real width, cuts the rows into pages that fit the area's height, and turns
// pages with ‹ › or (setting) the scroll wheel. Used by the Contest tab.
//   items: elements; state: { page } (kept by the caller, so a page survives
//   a redraw); wheelPages(): bool; onPage(); empty: text when there are none.
// Returns { area, pager, layout }: put area (it fills the height it's given)
// and pager on screen, then call layout() (and again after a resize).
export function pagedGrid(items, { state, wheelPages = () => true, onPage, empty = "* Nothing here yet." }) {
  const area = h("div", { class: "wz-gl-pagearea" });
  const count = h("span", { class: "n" });
  const prev = h("button", { type: "button", title: "Previous page", text: "‹", onclick: () => turn(-1) });
  const next = h("button", { type: "button", title: "Next page", text: "›", onclick: () => turn(1) });
  const pager = h("div", { class: "wz-gl-pager" }, prev, count, next);
  let pages = [[]];
  let animate = null;
  function layout() {
    const H = area.clientHeight;
    const grid = h("div", { class: "wz-gl-grid" });
    area.replaceChildren(grid);
    if (!items.length) {
      area.replaceChildren(h("div", { class: "wz-gl-empty wz-gl-dt", text: empty }));
      pages = [[]];
      return show();
    }
    items.forEach((it) => { it.style.display = ""; grid.appendChild(it); });
    items.forEach((it) => it.querySelectorAll(".wz-gl-card:not(.wz-gl-pic), .wz-gl-artifact").forEach(fitCard));
    const rows = [];
    let lastLeft = Infinity;
    items.forEach((it, i) => {
      const t = it.offsetTop, l = it.offsetLeft;
      if (!rows.length || l <= lastLeft) rows.push({ start: i, top: t, bottom: t + it.offsetHeight });
      lastLeft = l;
      const r = rows[rows.length - 1];
      r.end = i;
      r.top = Math.min(r.top, t);
      r.bottom = Math.max(r.bottom, t + it.offsetHeight);
    });
    pages = [];
    let page = null, pageTop = 0;
    rows.forEach((r) => {
      if (!page || r.bottom - pageTop > H) { page = []; pages.push(page); pageTop = r.top; }
      for (let i = r.start; i <= r.end; i++) page.push(i);
    });
    state.page = Math.max(0, Math.min(state.page || 0, pages.length - 1));
    show();
  }
  function show() {
    const grid = area.querySelector(".wz-gl-grid");
    if (grid) {
      const on = new Set(pages[state.page] || []);
      items.forEach((it, i) => { it.style.display = on.has(i) ? "" : "none"; });
      grid.classList.remove("wz-gl-in-r", "wz-gl-in-l");
      if (animate) { void grid.offsetWidth; grid.classList.add("wz-gl-in-" + animate); animate = null; }
    }
    count.textContent = `${pages.length ? (state.page || 0) + 1 : 0} / ${pages.length}`;
    prev.disabled = (state.page || 0) <= 0;
    next.disabled = (state.page || 0) >= pages.length - 1;
  }
  function turn(d) {
    const to = (state.page || 0) + d;
    if (to < 0 || to >= pages.length) return false;
    state.page = to;
    animate = d > 0 ? "r" : "l";
    if (onPage) onPage();
    show();
    return true;
  }
  let wheelLock = 0;
  area.addEventListener("wheel", (e) => {
    if (!wheelPages()) return;
    e.preventDefault();
    const now = Date.now();
    if (now < wheelLock || Math.abs(e.deltaY) < 4) return;
    if (turn(e.deltaY > 0 ? 1 : -1)) wheelLock = now + 280;
  }, { passive: false });
  return { area, pager, layout };
}
