// packages/card-maker/gallery/browse.js
//
// The Browse tab: four lists (Newest, This Week, This Month, All Time) and,
// for now, three layouts to compare (a TEMPORARY toggle):
//   Slides  - one list at a time, ◀ title ▶ with dots; lists slide in.
//   Tabs    - a segmented bar with a sliding highlight; lists slide in.
//   Shelves - every list as a scrolling row; "See all" opens one as a grid.
// Each item is a card, or a set's cards in one row with only its name;
// likes and dislikes sit underneath. Details are in the hover card.

import { h, button } from "./dom.js";
import { tile } from "./render.js";
import { sampleEntries } from "./mock.js";

export const LISTS = [["new", "Newest"], ["week", "This Week"], ["month", "This Month"], ["all", "All Time"]];
export const LAYOUTS = [["slides", "Slides"], ["tabs", "Tabs"], ["shelves", "Shelves"]];

export const BROWSE_CSS = `
.wz-gl-browse { --wz-gl-accent: #ffd84a; }
.wz-gl-proto { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; padding: 4px 6px; margin-bottom: 10px; border: 1px dashed #665; background: #17150c; font-size: 11px; }
.wz-gl-proto b { color: #ffd84a; margin-right: 4px; }
.wz-gl-proto label { margin: 0 0 0 10px; font-weight: normal; cursor: pointer; }
.wz-gl-dt { font-family: "DTM-Mono", "DTM Mono", "WZ DTM Mono", monospace; }
.wz-gl-empty { opacity: .7; padding: 20px 0; text-align: center; }
.wz-gl-note2 { opacity: .55; font-size: 11px; margin-top: 10px; text-align: center; }

/* item + votes */
.wz-gl-item { position: relative; transition: transform .12s; }
.wz-gl-item:hover { transform: translateY(-2px); }
.wz-gl-item.set { border: 2px solid #555; border-radius: 0; background: #0a0a0a; padding: 4px 6px 3px; }
.wz-gl-item.set:hover { border-color: #fff; }
.wz-gl-setname { font-family: "DTM-Mono", "DTM Mono", "WZ DTM Mono", monospace; font-size: 12px; color: var(--wz-gl-accent); letter-spacing: .5px; }
.wz-gl-votes { gap: 6px; }
.wz-gl-vote { background: none; border: 0; padding: 0 3px; cursor: pointer; font-size: 13px; line-height: 16px; color: #777; }
.wz-gl-vote:hover { color: #fff; }
.wz-gl-vote.up.on { color: #3ee05a; }
.wz-gl-vote.down.on { color: #ff4d4d; }
.wz-gl-score { font-family: "DTM-Mono", "DTM Mono", "WZ DTM Mono", monospace; font-size: 13px; min-width: 28px; }
.wz-gl-score.pos { color: #b9f5c3; } .wz-gl-score.neg { color: #f5b9b9; }
.wz-gl-rank { color: var(--wz-gl-accent); font: 12px/16px "DTM-Mono", "DTM Mono", "WZ DTM Mono", monospace; margin-right: 4px; }
.wz-gl-mine { position: absolute; top: -9px; right: -9px; z-index: 3; background: #4464bd; border: 2px solid #8ea6e8; color: #fff; font: 10px/14px Arial, sans-serif; padding: 0 4px; }

/* slide-in */
@keyframes wz-gl-in-r { from { transform: translateX(60px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes wz-gl-in-l { from { transform: translateX(-60px); opacity: 0; } to { transform: none; opacity: 1; } }
.wz-gl-in-r { animation: wz-gl-in-r .28s ease-out; }
.wz-gl-in-l { animation: wz-gl-in-l .28s ease-out; }

/* A: Slides */
.wz-gl-slides-nav { display: flex; align-items: center; justify-content: center; gap: 14px; margin: 2px 0 4px; }
.wz-gl-slides-nav .arrow { background: #000; border: 2px solid #fff; color: #fff; width: 30px; height: 30px; font: 16px/24px "DTM-Mono", "DTM Mono", "WZ DTM Mono", monospace; cursor: pointer; padding: 0; }
.wz-gl-slides-nav .arrow:hover { color: var(--wz-gl-accent); border-color: var(--wz-gl-accent); }
.wz-gl-slides-title { min-width: 220px; text-align: center; font-size: 22px; letter-spacing: 1px; }
.wz-gl-slides-sub { text-align: center; opacity: .6; font-size: 11px; margin-bottom: 4px; }
.wz-gl-dots { display: flex; justify-content: center; gap: 8px; margin-bottom: 12px; }
.wz-gl-dots button { width: 10px; height: 10px; padding: 0; border: 2px solid #fff; background: transparent; cursor: pointer; }
.wz-gl-dots button.on { background: var(--wz-gl-accent); border-color: var(--wz-gl-accent); }

/* B: Tabs */
.wz-gl-seg { position: relative; display: flex; margin: 0 auto 12px; max-width: 560px; border: 2px solid #fff; background: #000; }
.wz-gl-seg button { flex: 1 1 0; position: relative; z-index: 1; background: none; border: 0; color: #bbb; padding: 6px 0 5px; font-size: 14px; cursor: pointer; }
.wz-gl-seg button:hover { color: #fff; }
.wz-gl-seg button.on { color: #000; }
.wz-gl-seg .pill { position: absolute; top: 0; bottom: 0; width: 25%; background: var(--wz-gl-accent); transition: left .25s ease; }

/* C: Shelves */
.wz-gl-shelf { margin-bottom: 14px; }
.wz-gl-shelf-head { display: flex; align-items: baseline; gap: 10px; border-bottom: 2px solid #333; padding-bottom: 3px; margin-bottom: 8px; }
.wz-gl-shelf-head .t { font-size: 17px; letter-spacing: .5px; }
.wz-gl-shelf-head .c { opacity: .55; font-size: 11px; }
.wz-gl-shelf-head .grow { flex: 1; }
.wz-gl-linkbtn { background: none; border: 0; color: var(--wz-gl-accent); cursor: pointer; padding: 0 2px; font-size: 12px; }
.wz-gl-linkbtn:hover { text-decoration: underline; }
.wz-gl-shelf-body { position: relative; }
.wz-gl-shelf-row { display: flex; gap: 12px; align-items: flex-end; overflow-x: auto; scroll-behavior: smooth; padding: 10px 30px 6px; scrollbar-width: thin; }
.wz-gl-shelf-row > .wz-gl-item { flex: none; }
.wz-gl-shelf-arrow { position: absolute; top: 50%; transform: translateY(-50%); z-index: 4; width: 26px; height: 46px; background: rgba(0,0,0,.85); border: 2px solid #fff; color: #fff; cursor: pointer; padding: 0; font-size: 14px; }
.wz-gl-shelf-arrow.l { left: 0; } .wz-gl-shelf-arrow.r { right: 0; }
`;

const DAY = 864e5;

function seed(s) { let x = 7; for (const c of s) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x; }

// Own draft entries plus (optionally) the samples, with a score each.
export function allEntries(own, { samples, votes, sampleVotes }) {
  const mine = own.map((e) => {
    const n = seed(e.key + (e.title || ""));
    return { ...e, author: "you", mine: true, days: n % 45, base: ((n >> 8) % 60) - 10 };
  });
  const list = mine.concat(samples ? sampleEntries() : []);
  list.forEach((e) => { e.vote = (e.sample ? sampleVotes : votes)[e.key] || 0; e.score = e.base + e.vote; });
  return list;
}

export function listFor(entries, key) {
  if (key === "new") return entries.slice().sort((a, b) => a.days - b.days || b.score - a.score);
  const max = key === "week" ? 7 : key === "month" ? 30 : Infinity;
  return entries.filter((e) => e.days < max).sort((a, b) => b.score - a.score);
}

export const listCaption = (key) => ({ new: "Latest posts first", week: "Most liked in the last 7 days", month: "Most liked in the last 30 days", all: "Most liked ever" }[key]);

// ctx: { state, entries, vote(e, dir), rerender(), hoverable(el, part, entry) }
export function browseView(ctx) {
  const { state } = ctx;
  const root = h("div", { class: "wz-gl-browse" }, protoBar(ctx));
  const body = state.layout === "shelves" ? shelves(ctx) : state.layout === "tabs" ? tabsView(ctx) : slidesView(ctx);
  root.appendChild(body);
  root.appendChild(h("div", { class: "wz-gl-note2", text: state.samples
    ? "Sample entries use real cards with made-up authors, dates and scores. Nothing is sent."
    : "Preview of your own parts. Dates and scores are made up until the gallery is live." }));
  return root;
}

// TEMPORARY: compare layouts and turn the sample entries on or off.
function protoBar(ctx) {
  const { state } = ctx;
  return h("div", { class: "wz-gl-proto" },
    h("b", { text: "Prototype" }), "Layout:",
    LAYOUTS.map(([k, l]) => button(l, () => { state.layout = k; state.dir = null; state.shelfOpen = null; ctx.rerender(); }, { cls: state.layout === k ? "wz-gl-on" : "" })),
    h("label", {}, h("input", { type: "checkbox", checked: state.samples, onchange: (e) => { state.samples = e.target.checked; ctx.rerender(); } }), " Sample entries"));
}

function go(ctx, key) {
  const { state } = ctx;
  if (key === state.list) return;
  const from = LISTS.findIndex((l) => l[0] === state.list), to = LISTS.findIndex((l) => l[0] === key);
  state.dir = to > from ? "r" : "l";
  state.list = key;
  ctx.rerender();
}

function grid(ctx, list, animate) {
  const g = h("div", { class: `wz-gl-grid${animate ? " wz-gl-in-" + animate : ""}` });
  if (!list.length) return h("div", { class: "wz-gl-empty wz-gl-dt", text: "* Nothing here yet." });
  list.forEach((e, i) => g.appendChild(item(ctx, e, i + 1)));
  return g;
}

function item(ctx, e, rank, listKey) {
  const isSet = e.kind === "set";
  const vote = (dir) => ctx.vote(e, dir);
  const showRank = (listKey || ctx.state.list) !== "new";
  return h("div", { class: `wz-gl-item${isSet ? " set" : ""}`, "data-key": e.key },
    e.mine ? h("span", { class: "wz-gl-mine", text: "yours" }) : null,
    isSet ? h("div", { class: "wz-gl-setname", text: e.title || "(no name)", title: e.title || "" }) : null,
    h("div", { class: "wz-gl-row" }, e.parts.map((p) => ctx.hoverable(h("div", { class: "wz-gl-zoom" }, tile(p)), p, e))),
    h("div", { class: "wz-gl-votes" },
      rank && showRank ? h("span", { class: "wz-gl-rank", title: "Rank", text: "#" + rank }) : null,
      h("button", { class: `wz-gl-vote up${e.vote === 1 ? " on" : ""}`, title: "Like", text: "▲", onclick: () => vote(1) }),
      h("span", { class: `wz-gl-score${e.score > 0 ? " pos" : e.score < 0 ? " neg" : ""}`, text: String(e.score) }),
      h("button", { class: `wz-gl-vote down${e.vote === -1 ? " on" : ""}`, title: "Dislike", text: "▼", onclick: () => vote(-1) })));
}

function slidesView(ctx) {
  const { state } = ctx;
  const i = LISTS.findIndex((l) => l[0] === state.list);
  const step = (d) => go(ctx, LISTS[(i + d + LISTS.length) % LISTS.length][0]);
  const dir = state.dir; state.dir = null;
  return h("div", {},
    h("div", { class: "wz-gl-slides-nav" },
      h("button", { class: "arrow", title: "Previous list", text: "◀", onclick: () => step(-1) }),
      h("div", { class: "wz-gl-slides-title wz-gl-dt", text: LISTS[i][1] }),
      h("button", { class: "arrow", title: "Next list", text: "▶", onclick: () => step(1) })),
    h("div", { class: "wz-gl-slides-sub", text: listCaption(state.list) }),
    h("div", { class: "wz-gl-dots" }, LISTS.map(([k, l]) => h("button", { class: k === state.list ? "on" : "", title: l, onclick: () => go(ctx, k) }))),
    grid(ctx, listFor(ctx.entries, state.list), dir));
}

function tabsView(ctx) {
  const { state } = ctx;
  const i = LISTS.findIndex((l) => l[0] === state.list);
  const dir = state.dir; state.dir = null;
  const pill = h("span", { class: "pill", style: { left: (dir ? (i + (dir === "r" ? -1 : 1)) * 25 : i * 25) + "%" } });
  if (dir) requestAnimationFrame(() => requestAnimationFrame(() => { pill.style.left = i * 25 + "%"; }));
  return h("div", {},
    h("div", { class: "wz-gl-seg wz-gl-dt" }, pill, LISTS.map(([k, l]) => h("button", { class: k === state.list ? "on" : "", text: l, onclick: () => go(ctx, k) }))),
    grid(ctx, listFor(ctx.entries, state.list), dir));
}

function shelves(ctx) {
  const { state } = ctx;
  if (state.shelfOpen) {
    const [k, l] = LISTS.find((x) => x[0] === state.shelfOpen);
    const list = listFor(ctx.entries, k);
    return h("div", { class: "wz-gl-shelf" },
      h("div", { class: "wz-gl-shelf-head" },
        h("button", { class: "wz-gl-linkbtn", text: "‹ All lists", onclick: () => { state.shelfOpen = null; ctx.rerender(); } }),
        h("span", { class: "t wz-gl-dt", text: l }), h("span", { class: "c", text: `${list.length} · ${listCaption(k)}` })),
      grid(ctx, list, "r"));
  }
  return h("div", {}, LISTS.map(([k, l]) => {
    const list = listFor(ctx.entries, k);
    const row = h("div", { class: "wz-gl-shelf-row" }, list.slice(0, 14).map((e, i) => item(ctx, e, i + 1, k)));
    if (!list.length) row.appendChild(h("div", { class: "wz-gl-empty wz-gl-dt", text: "* Nothing here yet." }));
    const scroll = (d) => row.scrollBy({ left: d * row.clientWidth * 0.8 });
    return h("div", { class: "wz-gl-shelf" },
      h("div", { class: "wz-gl-shelf-head" },
        h("span", { class: "t wz-gl-dt", text: l }), h("span", { class: "c", text: listCaption(k) }), h("span", { class: "grow" }),
        list.length ? h("button", { class: "wz-gl-linkbtn", text: `See all ${list.length} ›`, onclick: () => { state.shelfOpen = k; ctx.rerender(); } }) : null),
      h("div", { class: "wz-gl-shelf-body" },
        list.length > 3 ? h("button", { class: "wz-gl-shelf-arrow l", text: "◀", title: "Scroll left", onclick: () => scroll(-1) }) : null,
        row,
        list.length > 3 ? h("button", { class: "wz-gl-shelf-arrow r", text: "▶", title: "Scroll right", onclick: () => scroll(1) }) : null));
  }));
}
