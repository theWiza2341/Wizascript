// packages/card-maker/gallery/contest.js
//
// Card Gallery contests (design: claude/card-gallery-contests.md).
// One contest runs at a time: players enter up to its limit (3 by default,
// per voter) before the deadline; organizers score each entry 1-5, blind;
// the owner publishes the results (archives it), and its entries then join
// the main gallery. There's no player voting on entries.
//
//   view()        the Contest tab: the running contest (theme, rules,
//                 deadline, your entries, everyone's approved entries), and
//                 the archive (places and average scores)
//   judgingView() Review -> Judging: score the running contest's entries
//                 (any review or judge key for it). The owner sees all scores
//                 after the deadline, and can pick the top 3 by hand.
//   manageView()  Review -> Contests (owner): start, edit, publish, delete.
//
// Entries' cards come from the gallery branch's contests.json (a few minutes
// behind, like index.json); statuses and deadlines from the Worker.

import { h, button } from "./dom.js";
import { tile } from "./render.js";
import { getContests, getContestsFile, reviewContest, reviewScore, manageContest, withArt } from "./api.js";
import { removeButton } from "./browse.js";
import { sampleData, loadSampleExtras } from "./mock.js";

const DT = `"DTM-Mono", "DTM Mono", "WZ DTM Mono", monospace`;
const PLACES = ["1st", "2nd", "3rd"];

export const CONTEST_CSS = `
.wz-gl-cbar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 10px; }
.wz-gl-chead { border: 2px solid #fff; background: #000; padding: 8px 12px; margin-bottom: 10px; }
.wz-gl-ctitle { font: 18px ${DT}; color: #ffd84a; margin-bottom: 4px; }
.wz-gl-crules { white-space: pre-wrap; margin: 4px 0 6px; line-height: 1.4; }
.wz-gl-cmeta { opacity: .85; }
.wz-gl-cmeta b { color: #fff; }
.wz-gl-csub { font: 13px ${DT}; margin: 12px 0 6px; color: #ddd; }
.wz-gl-place { font: 12px/16px ${DT}; color: #ffd84a; }
.wz-gl-place.p1 { color: #ffd84a; } .wz-gl-place.p2 { color: #d8d8d8; } .wz-gl-place.p3 { color: #e09a5a; }
.wz-gl-item.p1 { border: 2px solid #ffd84a; } .wz-gl-item.p2 { border: 2px solid #d8d8d8; } .wz-gl-item.p3 { border: 2px solid #e09a5a; }
.wz-gl-avg { font-size: 11px; opacity: .8; }
.wz-gl-scores { display: flex; gap: 2px; align-items: center; }
.wz-gl-scorebtn { background: #000; border: 1px solid #777; color: #ccc; width: 20px; height: 18px; padding: 0; font: 11px/16px ${DT}; cursor: pointer; }
.wz-gl-scorebtn:hover { border-color: #fff; color: #fff; }
.wz-gl-scorebtn.on { background: #ffd84a; border-color: #ffd84a; color: #000; }
.wz-gl-judge { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.wz-gl-judge .by { font-size: 10px; opacity: .7; max-width: 200px; text-align: center; }
.wz-gl-form { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 6px 10px; align-items: center; max-width: 620px; margin: 6px 0 10px; }
.wz-gl-form label { margin: 0; font-weight: normal; opacity: .85; }
.wz-gl-panel textarea { color: #fff !important; background: #222 !important; border: 1px solid #666 !important; border-radius: 3px; font: 12px Arial, sans-serif; padding: 4px; min-height: 70px; resize: vertical; width: 100%; box-sizing: border-box; }
.wz-gl-panel input[type="datetime-local"], .wz-gl-panel input[type="number"] { color: #fff !important; background: #222 !important; border: 1px solid #666 !important; border-radius: 3px; font: 11px Arial, sans-serif; height: 22px; padding: 0 4px; color-scheme: dark; }
.wz-gl-cbox { border: 1px solid #444; background: #111; padding: 8px 10px; margin-bottom: 10px; }

/* roomier Contest tab (dev16 prototypes A/B/C) */
.wz-gl-cv { font-size: 14px; line-height: 1.45; }
.wz-gl-cv .wz-cm-btn { height: 28px; font-size: 13px; padding: 0 12px; }
.wz-gl-cnav { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #333; position: relative; flex-wrap: wrap; }
.wz-gl-cnow { background: #17150c; border: 2px solid #ffd84a; color: #ffd84a; padding: 4px 14px; font: 15px ${DT}; cursor: pointer; display: flex; flex-direction: column; align-items: flex-start; line-height: 1.25; }
.wz-gl-cnow small { font: 11px Arial, sans-serif; opacity: .85; }
.wz-gl-cnow.on { background: #ffd84a; color: #000; }
.wz-gl-carch { background: #000; border: 2px solid #666; color: #bbb; padding: 0 10px; height: 32px; font: 13px ${DT}; cursor: pointer; max-width: 190px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.wz-gl-carch:hover { border-color: #fff; color: #fff; }
.wz-gl-carch.on { border-color: #fff; color: #000; background: #ddd; }
.wz-gl-cnav .lbl { opacity: .6; font-size: 12px; }
.wz-gl-cdropwrap { position: relative; }
.wz-gl-cdrop { position: absolute; right: 0; top: calc(100% + 4px); z-index: 30; background: #000; border: 2px solid #fff; min-width: 260px; max-height: 300px; overflow: auto; padding: 4px 0; box-shadow: 0 8px 24px rgba(0,0,0,.8); }
.wz-gl-cdrop button { display: flex; justify-content: space-between; gap: 12px; width: 100%; background: none; border: 0; color: #ddd; padding: 6px 12px; text-align: left; font: 13px ${DT}; cursor: pointer; }
.wz-gl-cdrop button:hover, .wz-gl-cdrop button.on { background: #222; color: #ffd84a; }
.wz-gl-cdrop button small { font: 11px Arial, sans-serif; opacity: .6; }
.wz-gl-chero { border: 2px solid #fff; background: #000; padding: 14px 18px; margin-bottom: 14px; }
.wz-gl-chero .t { font: 28px ${DT}; color: #ffd84a; margin-bottom: 6px; }
.wz-gl-chero .r { white-space: pre-wrap; font-size: 15px; margin-bottom: 10px; }
.wz-gl-chero .m { font-size: 14px; opacity: .9; }
.wz-gl-cact { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 10px; }
.wz-gl-big { height: 38px !important; padding: 0 20px !important; font: 16px ${DT} !important; }
.wz-gl-pips { display: inline-flex; gap: 4px; align-items: center; }
.wz-gl-pips i { width: 12px; height: 12px; border: 2px solid #ffd84a; border-radius: 50%; display: inline-block; }
.wz-gl-pips i.on { background: #ffd84a; }
.wz-gl-chip { display: inline-block; border: 1px solid #ffd84a; color: #ffd84a; padding: 1px 8px; font: 12px ${DT}; }
.wz-gl-csec { font: 16px ${DT}; color: #fff; margin: 16px 0 8px; display: flex; align-items: center; gap: 10px; }
.wz-gl-csec .n { opacity: .6; font-size: 13px; }
.wz-gl-cv .wz-gl-note { font-size: 13px; }
.wz-gl-cv .wz-gl-grid { gap: 16px 14px; }
.wz-gl-cv .wz-gl-avg { font-size: 12px; }
.wz-gl-cv .wz-gl-place { font-size: 14px; }
/* B: sidebar */
.wz-gl-cside { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 18px; align-items: start; }
.wz-gl-cside > .side { position: sticky; top: 0; border: 2px solid #fff; background: #000; padding: 12px 14px; }
.wz-gl-cside > .side .t { font: 22px ${DT}; color: #ffd84a; margin-bottom: 6px; }
.wz-gl-cside > .side .r { white-space: pre-wrap; margin-bottom: 10px; }
.wz-gl-cside > .side .wz-gl-big { width: 100%; margin-top: 8px; }
.wz-gl-cmine { margin-top: 12px; border-top: 1px solid #333; padding-top: 8px; display: flex; flex-direction: column; gap: 5px; }
.wz-gl-cmine div { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
.wz-gl-podlist { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
.wz-gl-podlist div { display: flex; gap: 8px; align-items: baseline; }
/* C: showcase */
.wz-gl-cstrip { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; border: 2px solid #fff; background: #000; padding: 10px 16px; margin-bottom: 10px; }
.wz-gl-cstrip .t { font: 22px ${DT}; color: #ffd84a; }
.wz-gl-ctabs { display: flex; border: 2px solid #fff; background: #000; margin-bottom: 12px; max-width: 560px; }
.wz-gl-ctabs button { flex: 1; background: none; border: 0; color: #bbb; padding: 7px 0; font: 14px ${DT}; cursor: pointer; }
.wz-gl-ctabs button + button { border-left: 2px solid #fff; }
.wz-gl-ctabs button.on { background: #ffd84a; color: #000; }
.wz-gl-podium { display: flex; justify-content: center; align-items: flex-end; gap: 22px; margin: 6px 0 18px; flex-wrap: wrap; }
.wz-gl-podium > div { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.wz-gl-podium .medal { font: 20px ${DT}; }
.wz-gl-podium .p1 .medal { color: #ffd84a; } .wz-gl-podium .p2 .medal { color: #d8d8d8; } .wz-gl-podium .p3 .medal { color: #e09a5a; }
.wz-gl-podium .first { --wz-gl-z: 1.2; }
.wz-gl-sample { display: inline-block; background: #333; border: 1px solid #777; color: #ddd; font: 10px/14px Arial, sans-serif; padding: 0 5px; margin-left: 8px; vertical-align: middle; }
/* judging, one at a time */
.wz-gl-focus { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 8px 0; }
.wz-gl-focus .cards { --wz-gl-z: 1.3; }
.wz-gl-focus .nav { display: flex; align-items: center; gap: 12px; font: 14px ${DT}; }
.wz-gl-scorebig { display: flex; gap: 8px; }
.wz-gl-scorebig button { width: 64px; height: 50px; background: #000; border: 2px solid #777; color: #ddd; font: 20px ${DT}; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; }
.wz-gl-scorebig button small { font: 9px Arial, sans-serif; opacity: .7; }
.wz-gl-scorebig button:hover { border-color: #fff; color: #fff; }
.wz-gl-scorebig button.on { background: #ffd84a; border-color: #ffd84a; color: #000; }
`;

const pad = (n) => String(n).padStart(2, "0");
const toLocalInput = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fromLocalInput = (v) => { const t = new Date(v).getTime(); return Number.isFinite(t) ? t : null; };
const when = (ms) => new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
function inTime(ms) {
  const m = Math.round((ms - Date.now()) / 60000);
  if (m <= 0) return "now";
  if (m < 60) return `in ${m} min`;
  const hrs = Math.floor(m / 60);
  if (hrs < 48) return `in ${hrs} h${m % 60 ? ` ${m % 60} min` : ""}`;
  return `in ${Math.floor(hrs / 24)} days`;
}
const plural = (n) => `${n} entr${n === 1 ? "y" : "ies"}`;
const daysAgo = (t) => Math.max(0, Math.floor((Date.now() - (t || Date.now())) / 864e5));

// ctx: { say, render, changed, errText, hoverable, acct, draft, reviewerKey,
//        who(), keyRejected(code), refreshMe(force), startEntry(contestId),
//        deleteMine(entry), samples(), layout() -> "a" | "b" | "c",
//        reviewLayout() -> "a" | "b" | "c" }
export function createContests(ctx) {
  const cs = { list: null, file: null, at: 0, loading: false, error: "", pick: null, sort: "rank", drop: false, sub: "entries" };
  const js = { id: null, data: null, at: 0, loading: false, error: "", top: null, idx: 0, sampleMine: {} };
  const cf = { title: "", rules: "", closes: "", max: 3, busy: false, editFor: null };
  let sampleOwn = null; // sample "your entries", withdrawn locally

  async function refresh(force) {
    if (cs.loading || (!force && cs.at && Date.now() - cs.at < 30e3)) return;
    cs.loading = true;
    try {
      const [api, file] = await Promise.all([getContests(), getContestsFile().catch(() => null)]);
      cs.list = (api && api.contests) || [];
      if (file) cs.file = file;
      cs.error = "";
      cs.at = Date.now();
    } catch (e) {
      cs.error = ctx.errText(e);
    } finally {
      cs.loading = false;
      ctx.changed();
    }
  }
  // Real contests (entering, managing) vs. what the Contest tab and Judging
  // show (sample contests while Sample data is on).
  const sample = () => (ctx.samples() ? sampleData() : null);
  const shownList = () => (sample() ? sample().contests : cs.list);
  const shownFile = (id) => ((sample() ? sample().file : cs.file) || []).find((c) => c.id === id) || null;
  const active = () => (cs.list || []).find((c) => c.status !== "archived") || null;
  const shownActive = () => (shownList() || []).find((c) => c.status !== "archived") || null;
  if (ctx.samples()) loadSampleExtras().then((more) => { if (more) ctx.changed(); });
  // The player's slots in the open contest (from /v1/me: counts every account
  // that shares their voter group).
  function slots() {
    const c = active();
    if (!c || c.status !== "open") return null;
    const mine = ctx.acct.contest && ctx.acct.contest.id === c.id ? ctx.acct.contest : null;
    const used = mine ? mine.used : 0;
    return { contest: c, used, max: c.maxEntries, left: Math.max(0, c.maxEntries - used) };
  }
  function shownSlots(c) {
    if (c.sample) {
      const used = (sampleOwn || (sampleOwn = sample().own.slice())).filter((e) => e.status !== "rejected").length;
      return { contest: c, used, max: c.maxEntries, left: Math.max(0, c.maxEntries - used) };
    }
    const s = slots();
    return s && s.contest.id === c.id ? s : null;
  }
  function ownEntries(c) {
    if (c.sample) return sampleOwn || (sampleOwn = sample().own.slice());
    return ctx.acct.posts.filter((p) => p.contest === c.id && ctx.draft.uploads[p.id]).map((p) => ({ ...ctx.draft.uploads[p.id], id: p.id, status: p.status, reason: p.reason, author: ctx.acct.account, postedAt: p.postedAt }));
  }
  function ranked(f) {
    const res = f.results || { order: [], scores: {} };
    const byId = new Map(f.entries.map((e) => [e.id, e]));
    const out = res.order.map((id) => byId.get(id)).filter(Boolean);
    f.entries.forEach((e) => { if (!res.order.includes(e.id)) out.push(e); });
    return { res, list: out };
  }

  // ---- shared: one entry, drawn like Browse's items ----
  function entryItem(e, { place, cls, below, style } = {}) {
    const isSet = e.kind === "set";
    const info = { author: e.author, days: daysAgo(e.approvedAt || e.postedAt), status: e.status || "approved", reason: e.reason };
    return h("div", { class: `wz-gl-item${isSet ? " set" : ""}${cls ? " " + cls : ""}`, "data-key": e.id, style },
      isSet ? h("div", { class: "wz-gl-sethead" }, h("div", { class: "wz-gl-setname", text: e.title || "(no name)", title: e.title || "" })) : null,
      h("div", { class: "wz-gl-row" }, e.parts.map((p) => ctx.hoverable(h("div", { class: "wz-gl-zoom" }, tile(p)), p, info))),
      place || below ? h("div", { class: "wz-gl-votes" }, place || null, below || null) : null);
  }
  const placeTag = (i) => h("span", { class: `wz-gl-place${i < 3 ? ` p${i + 1}` : ""}`, text: i < 3 ? PLACES[i] : `# ${i + 1}` });
  const avgTag = (sc) => h("span", { class: "wz-gl-avg", text: sc && sc.n ? `${sc.avg.toFixed(2)} (${sc.n} judge${sc.n === 1 ? "" : "s"})` : "not scored" });
  const sampleTag = (c) => (c.sample ? h("span", { class: "wz-gl-sample", text: "sample" }) : null);

  // ---- the Contest tab ----
  // The bar: the running contest far left, the archive far right (the 3 most
  // recent as buttons, the rest under Archive ▾).
  function nav(cur, archived) {
    const pick = (id) => { cs.pick = id; cs.drop = false; cs.sub = "entries"; ctx.render(); };
    const recent = archived.slice(0, 3);
    const drop = cs.drop ? h("div", { class: "wz-gl-cdrop" }, archived.map((c) => h("button", { type: "button", class: cs.pick === c.id ? "on" : "", onclick: () => pick(c.id) },
      h("span", { text: c.title }), h("small", { text: `ended ${new Date(c.closesAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} · ${c.entries}` })))) : null;
    if (cs.drop) setTimeout(() => document.addEventListener("click", function off(ev) { if (!ev.target.closest(".wz-gl-cdropwrap")) { cs.drop = false; ctx.render(); } document.removeEventListener("click", off, true); }, true), 0);
    return h("div", { class: "wz-gl-cnav" },
      cur ? h("button", { type: "button", class: `wz-gl-cnow${cs.pick === cur.id ? " on" : ""}`, title: "The contest running now", onclick: () => pick(cur.id) },
        h("span", { text: `★ ${cur.title}` }), h("small", { text: cur.status === "open" ? `Open · closes ${inTime(cur.closesAt)}` : "Judging" }))
        : h("span", { class: "lbl", text: "No contest running right now." }),
      h("span", { class: "wz-gl-grow" }),
      archived.length ? h("span", { class: "lbl", text: "Past:" }) : null,
      recent.map((c) => h("button", { type: "button", class: `wz-gl-carch${cs.pick === c.id ? " on" : ""}`, text: c.title, title: `${c.title} (ended ${when(c.closesAt)})`, onclick: () => pick(c.id) })),
      archived.length ? h("span", { class: "wz-gl-cdropwrap" },
        h("button", { type: "button", class: `wz-gl-carch${cs.drop || (cs.pick && !recent.some((c) => c.id === cs.pick) && archived.some((c) => c.id === cs.pick)) ? " on" : ""}`, text: `Archive ▾`, title: `All ${archived.length} past contests`, onclick: () => { cs.drop = !cs.drop; ctx.render(); } }), drop) : null,
      h("button", { type: "button", class: "wz-gl-refresh", title: "Load the latest", text: "↻", onclick: () => { refresh(true); ctx.refreshMe(true); } }));
  }

  function view() {
    const list = shownList();
    if (!list) return h("p", { class: "wz-gl-note", text: cs.error ? `Couldn't load the contests: ${cs.error}` : "Loading the contests…" });
    if (!list.length) {
      return h("div", { class: "wz-gl-cv" },
        h("p", { class: "wz-gl-note", text: "No contests yet." }),
        h("p", { class: "wz-gl-note", text: "Contests have a theme and a deadline. Enter your designs; the organizers judge them, and the results are kept here." }));
    }
    const cur = shownActive();
    const archived = list.filter((c) => c.status === "archived").sort((a, b) => b.closesAt - a.closesAt);
    if (!cs.pick || !list.some((c) => c.id === cs.pick)) cs.pick = cur ? cur.id : archived[0].id;
    const c = list.find((x) => x.id === cs.pick);
    const L = ctx.layout();
    const body = c.status === "archived" ? archiveView(c, L) : runningView(c, L);
    return h("div", { class: `wz-gl-cv wz-gl-cv-${L}` }, nav(cur, archived), body);
  }

  // pieces of a running contest
  function enterButton(c, s, big) {
    const label = c.sample ? "Enter cards" : !ctx.acct.account ? "Link your account to enter" : s && !s.left ? "No entries left" : "Enter cards";
    const b = button(label, () => (c.sample ? ctx.say("This is a sample contest: entering is off. Turn off Sample data to enter real ones.") : ctx.startEntry(c.id)), { primary: true, cls: big ? "wz-gl-big" : "", title: "Pick cards in Submit and upload them to this contest" });
    b.disabled = !c.sample && (!ctx.acct.account || !s || !s.left);
    return b;
  }
  const pips = (s) => (s ? h("span", { class: "wz-gl-pips", title: `${s.used} of ${s.max} entries used` }, Array.from({ length: s.max }, (_, i) => h("i", { class: i < s.used ? "on" : "" })), h("span", { text: ` ${s.used} of ${s.max} used` })) : null);
  const deadline = (c) => (c.status === "open"
    ? ["Entries close ", h("b", { text: when(c.closesAt) }), ` (${inTime(c.closesAt)}). Up to ${c.maxEntries} per player; a set counts as one.`]
    : ["Entries closed ", h("b", { text: when(c.closesAt) }), ". The organizers are judging; results show here when they're done."]);
  function ownItems(c) {
    const open = c.status === "open";
    return ownEntries(c).map((e) => {
      const tagText = e.status === "approved" ? "entered" : e.status === "pending" ? "awaiting approval" : "not approved";
      const tag = h("span", { class: `wz-gl-mine${e.status === "pending" ? " pending" : e.status === "rejected" || e.status === "removed" ? " rejected" : ""}`, text: tagText });
      const run = c.sample ? (x) => { sampleOwn = sampleOwn.filter((o) => o.id !== x.id); ctx.say("Sample entry withdrawn (nothing was sent)."); ctx.render(); } : ctx.deleteMine;
      const canWithdraw = open && (e.status === "pending" || e.status === "approved");
      const del = canWithdraw
        ? removeButton({ rerender: ctx.render }, e, { label: "Withdraw", confirm: "Withdraw it?", title: "Take this entry back, to free its slot", run })
        : e.status === "rejected" || e.status === "removed" ? removeButton({ rerender: ctx.render }, e, { label: "Delete", confirm: "Delete for good?", title: "Delete this entry: it wasn't approved", run }) : null;
      return entryItem(e, { below: [tag, del] });
    });
  }
  function othersOf(c) {
    const own = ownEntries(c);
    const f = shownFile(c.id);
    return (f ? f.entries : []).filter((e) => !own.some((o) => o.id === e.id));
  }
  const noneYet = (c) => h("p", { class: "wz-gl-note", text: c.entries ? "They'll show here in a few minutes." : "None yet. Be the first!" });
  const noVotes = h("p", { class: "wz-gl-note", text: "There's no voting on contest entries: the organizers judge them. They join the gallery once the results are out." });

  function runningView(c, L) {
    const s = shownSlots(c);
    const open = c.status === "open";
    const mine = ownItems(c);
    const others = othersOf(c);
    const grid = (items) => h("div", { class: "wz-gl-grid" }, items);
    if (L === "b") {
      const side = h("div", { class: "side" },
        h("div", { class: "t" }, c.title, sampleTag(c)),
        c.rules ? h("div", { class: "r", text: c.rules }) : null,
        h("div", { class: "m" }, deadline(c)),
        open ? [h("div", { style: { marginTop: "10px" } }, h("span", { text: "Your entries: " }), pips(s)), enterButton(c, s, true)] : null,
        mine.length ? h("div", { class: "wz-gl-cmine" }, h("b", { text: "Your entries" }), ownEntries(c).map((e) => h("div", {}, h("span", { text: e.title || "(no name)" }), h("span", { class: "dim", text: e.status === "approved" ? "entered" : e.status === "pending" ? "waiting" : "not approved" })))) : null);
      return h("div", { class: "wz-gl-cside" }, side, h("div", {},
        mine.length ? [h("div", { class: "wz-gl-csec", style: { marginTop: 0 } }, "Your entries", h("span", { class: "n", text: String(mine.length) })), grid(mine)] : null,
        h("div", { class: "wz-gl-csec", style: mine.length ? null : { marginTop: 0 } }, "Entries so far", h("span", { class: "n", text: String(c.entries) })),
        others.length ? grid(others.map((e) => entryItem(e))) : noneYet(c), noVotes));
    }
    if (L === "c") {
      const strip = h("div", { class: "wz-gl-cstrip" },
        h("span", { class: "t" }, c.title, sampleTag(c)),
        h("span", { class: "wz-gl-chip", text: open ? `closes ${inTime(c.closesAt)}` : "judging" }),
        h("span", { class: "wz-gl-grow" }),
        open ? [pips(s), enterButton(c, s, true)] : null);
      const tabs = [["entries", `Entries (${c.entries})`], ["mine", `Your entries (${mine.length})`], ["rules", "Theme & rules"]];
      const sub = h("div", { class: "wz-gl-ctabs" }, tabs.map(([k, label]) => h("button", { type: "button", class: cs.sub === k ? "on" : "", text: label, onclick: () => { cs.sub = k; ctx.render(); } })));
      const body = cs.sub === "rules"
        ? h("div", { class: "wz-gl-chero" }, h("div", { class: "r", text: c.rules || "(no rules given)" }), h("div", { class: "m" }, deadline(c)))
        : cs.sub === "mine" ? (mine.length ? grid(mine) : h("p", { class: "wz-gl-note", text: "You haven't entered yet." }))
          : others.length ? grid(others.map((e) => entryItem(e))) : noneYet(c);
      return h("div", {}, strip, sub, body, noVotes);
    }
    // A: banner
    return h("div", {},
      h("div", { class: "wz-gl-chero" },
        h("div", { class: "t" }, c.title, sampleTag(c)),
        c.rules ? h("div", { class: "r", text: c.rules }) : null,
        h("div", { class: "m" }, deadline(c)),
        open ? h("div", { class: "wz-gl-cact" }, enterButton(c, s, true), h("span", { text: "Your entries:" }), pips(s)) : null),
      mine.length ? [h("div", { class: "wz-gl-csec" }, "Your entries", h("span", { class: "n", text: String(mine.length) })), grid(mine)] : null,
      h("div", { class: "wz-gl-csec" }, "Entries so far", h("span", { class: "n", text: String(c.entries) })),
      others.length ? grid(others.map((e) => entryItem(e))) : noneYet(c), noVotes);
  }

  function archiveView(c, L) {
    const f = shownFile(c.id);
    const ended = `Ended ${when(c.closesAt)}`;
    if (!f) return h("div", { class: "wz-gl-chero" }, h("div", { class: "t", text: c.title }), h("div", { class: "m", text: `${ended}. Loading the results…` }));
    const { res, list: rank } = ranked(f);
    const how = res.manualTop ? "The organizers picked the top places; the rest are by average score (1 to 5)." : "Places are by average score (1 to 5).";
    const sortBar = h("div", { class: "wz-gl-cbar" },
      h("span", { class: "dim", text: "Sort:" }),
      button("Ranking", () => { cs.sort = "rank"; ctx.render(); }, { primary: cs.sort !== "new" }),
      button("Newest", () => { cs.sort = "new"; ctx.render(); }, { primary: cs.sort === "new" }));
    const shown = cs.sort === "new" ? rank.slice().sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0)) : rank;
    const items = (list) => list.map((e) => {
      const i = rank.indexOf(e);
      return entryItem(e, { place: placeTag(i), below: avgTag(res.scores[e.id]), cls: i < 3 && cs.sort !== "new" ? `p${i + 1}` : "" });
    });
    if (!f.entries.length) return h("div", { class: "wz-gl-chero" }, h("div", { class: "t", text: c.title }), h("div", { class: "m", text: `${ended} · no entries.` }));
    if (L === "b") {
      const side = h("div", { class: "side" },
        h("div", { class: "t" }, c.title, sampleTag(c)),
        c.rules ? h("div", { class: "r", text: c.rules }) : null,
        h("div", { class: "m", text: `${ended} · ${plural(f.entries.length)}. ${how}` }),
        h("div", { class: "wz-gl-podlist" }, rank.slice(0, 3).map((e, i) => h("div", {}, placeTag(i), h("b", { text: e.title || "(no name)" }), h("span", { class: "dim", text: `by ${e.author} · ${(res.scores[e.id] || {}).avg != null ? res.scores[e.id].avg.toFixed(2) : "–"}` })))));
      return h("div", { class: "wz-gl-cside" }, side, h("div", {}, sortBar, h("div", { class: "wz-gl-grid" }, items(shown))));
    }
    if (L === "c") {
      const strip = h("div", { class: "wz-gl-cstrip" }, h("span", { class: "t" }, c.title, sampleTag(c)), h("span", { class: "wz-gl-chip", text: ended.toLowerCase() }), h("span", { class: "dim", text: plural(f.entries.length) }));
      const top = rank.slice(0, 3);
      const order = top.length === 3 ? [top[1], top[0], top[2]] : top; // 2nd, 1st, 3rd
      const podium = h("div", { class: "wz-gl-podium" }, order.map((e) => {
        const i = rank.indexOf(e);
        return h("div", { class: `p${i + 1}${i === 0 ? " first" : ""}` }, h("div", { class: "medal", text: PLACES[i] }),
          entryItem(e, { below: [h("span", { class: "dim", text: `by ${e.author} ` }), avgTag(res.scores[e.id])], cls: `p${i + 1}` }));
      }));
      const rest = rank.slice(3);
      return h("div", {}, strip, h("p", { class: "wz-gl-note", text: c.rules ? `${c.rules.split("\n")[0]} ${how}` : how }), podium,
        rest.length ? [h("div", { class: "wz-gl-csec" }, "Everyone else", h("span", { class: "n", text: String(rest.length) })), h("div", { class: "wz-gl-grid" }, items(rest))] : null);
    }
    return h("div", {},
      h("div", { class: "wz-gl-chero" }, h("div", { class: "t" }, c.title, sampleTag(c)), c.rules ? h("div", { class: "r", text: c.rules }) : null, h("div", { class: "m", text: `${ended} · ${plural(f.entries.length)}. ${how}` })),
      sortBar, h("div", { class: "wz-gl-grid" }, items(shown)));
  }

  // ---- Review -> Judging ----
  const judgeContestId = () => {
    const who = ctx.who();
    if (sample()) { const c = shownActive(); return c ? c.id : null; }
    if (who && who.role === "judge") return who.contest || (active() && active().id);
    const c = active();
    return c ? c.id : null;
  };
  async function loadJudging(force) {
    const id = judgeContestId();
    if (sample()) {
      const run = sample().file.find((c) => c.id === id);
      const keepTop = js.top && js.id === id && js.data && js.data.sample;
      js.data = run ? { contest: { ...run, top3: [] }, entries: run.entries, myScores: js.sampleMine, sample: true } : null;
      js.top = keepTop ? js.top : []; js.id = id; js.error = "";
      return ctx.changed();
    }
    if (!id || !ctx.reviewerKey()) { js.data = null; return; }
    if (js.loading || (!force && js.id === id && js.at && Date.now() - js.at < 30e3 && !(js.data && js.data.sample))) return;
    js.loading = true;
    try {
      const d = await reviewContest(ctx.reviewerKey(), id);
      // art paths -> gallery branch addresses (only the Worker's own paths)
      d.entries = (d.entries || []).filter((e) => e && /^[0-9a-z]{3,8}$/.test(e.id)).map(withArt);
      js.data = d;
      js.id = id;
      js.top = (js.data.contest.top3 || []).slice();
      js.error = "";
      js.at = Date.now();
    } catch (e) {
      if (e.code === "not_admin" || e.code === "key_expired") return ctx.keyRejected(e.code);
      js.error = ctx.errText(e);
    } finally {
      js.loading = false;
      ctx.changed();
    }
  }
  const unscored = () => (js.data ? js.data.entries.filter((e) => !js.data.myScores[e.id]).length : 0);
  async function score(e, n, advance) {
    const mine = js.data.myScores[e.id] || 0;
    const value = mine === n ? 0 : n; // the same score again takes it back
    try {
      if (!js.data.sample) await reviewScore(ctx.reviewerKey(), js.id, e.id, value);
      if (value) js.data.myScores[e.id] = value; else delete js.data.myScores[e.id];
      ctx.changed();
      if (advance && value) {
        const next = js.data.entries.findIndex((x, i) => i > js.idx && !js.data.myScores[x.id]);
        if (next >= 0) setTimeout(() => { js.idx = next; ctx.render(); }, 250);
      }
    } catch (err) { ctx.say(`Couldn't save the score: ${ctx.errText(err)}`); }
    ctx.render();
  }
  async function saveTop(list) {
    try {
      if (!js.data.sample) await manageContest(ctx.reviewerKey(), { action: "top3", id: js.id, posts: list });
      js.top = list.slice();
      js.data.contest.top3 = list.slice();
      ctx.say(js.data.sample ? "Sample: top places kept here only." : list.length ? "Top places saved." : "Top places cleared: places come from the scores.");
    } catch (err) { ctx.say(`Couldn't save the top places: ${ctx.errText(err)}`); }
    ctx.render();
  }
  const SCORE_NAMES = ["", "Extremely poor", "Poor", "Average", "Good", "Extremely good"];
  function judgingView() {
    const id = judgeContestId();
    if (!id) return h("p", { class: "wz-gl-note", text: "No contest is running." });
    if (js.error) return h("div", { class: "wz-gl-issues", text: js.error });
    if (!js.data || js.id !== id || (!!js.data.sample !== !!sample())) { loadJudging(true); return h("p", { class: "wz-gl-note", text: "Loading the entries…" }); }
    const d = js.data, c = d.contest;
    const owner = ctx.who() && ctx.who().role === "owner";
    // samples: the owner sees the made-up scores, as after a deadline
    const scores = d.sample ? (owner ? sample().runScores : null) : d.scores;
    const n = d.entries.length;
    const done = n - unscored();
    const focus = ctx.reviewLayout() === "c";
    const headBar = h("div", { class: "wz-gl-bar" },
      h("b", { text: `Judging: ${c.title}` }), d.sample ? h("span", { class: "wz-gl-sample", text: "sample" }) : null,
      h("span", { class: "dim", text: c.status === "open" ? ` · entries close ${when(c.closesAt)}` : " · entries closed" }),
      h("span", { class: "wz-gl-grow" }),
      h("span", { text: `You've scored ${done} of ${n}` }),
      button("↻ Refresh", () => loadJudging(true)));
    const notes = [h("p", { class: "wz-gl-note", text: "Score each entry 1 (extremely poor) to 5 (extremely good); 3 is average. Click your score again to take it back. Other judges' scores stay hidden." })];
    if (owner && scores) notes.push(h("p", { class: "wz-gl-note", text: d.sample ? "Sample: you see the other judges' made-up scores, as you would once the deadline has passed." : "The deadline has passed, so you see everyone's scores. Places go by average score, unless you pick the top 3 below. Publish the results in Contests." }));
    let topBar = null;
    if (owner && scores) {
      const changedTop = JSON.stringify(js.top) !== JSON.stringify(c.top3 || []);
      topBar = h("div", { class: "wz-gl-bar" },
        h("span", { text: js.top.length ? `Top places by hand: ${js.top.map((pid, i) => `${PLACES[i]} #${pid}`).join(", ")}` : "Top places: by score" }),
        button("Save top places", () => saveTop(js.top.filter(Boolean)), { primary: changedTop }),
        js.top.length ? button("Use scores instead", () => saveTop([])) : null);
    }
    const extra = (e) => {
      const parts = [];
      if (scores) {
        const s = scores[e.id];
        parts.push(h("span", { class: "wz-gl-avg", text: s ? `avg ${s.avg.toFixed(2)} · ${s.n} judge${s.n === 1 ? "" : "s"}` : "no scores yet" }));
        if (s && s.by) parts.push(h("span", { class: "by", text: s.by.map((b) => `${b.name} ${b.score}`).join(", ") }));
        if (owner) {
          const at = js.top.indexOf(e.id);
          parts.push(h("select", { title: "Place it by hand", onchange: (ev) => {
            const want = Number(ev.target.value);
            js.top = js.top.filter((x) => x !== e.id);
            if (want) { js.top.splice(want - 1, 0, e.id); js.top = js.top.slice(0, 3); }
            ctx.render();
          } }, h("option", { value: "0", text: "place: by score", selected: at < 0 }), PLACES.map((p, i) => h("option", { value: String(i + 1), text: p, selected: at === i }))));
        }
      }
      return parts;
    };
    if (!n) return h("div", {}, headBar, notes, h("p", { class: "wz-gl-note", text: "No approved entries yet. Approve them in Uploads." }));
    if (focus) {
      // C: one entry at a time, big, moving on to the next unscored one
      js.idx = Math.max(0, Math.min(js.idx, n - 1));
      const e = d.entries[js.idx];
      const mine = d.myScores[e.id] || 0;
      const go = (i) => { js.idx = (i + n) % n; ctx.render(); };
      const nextOpen = d.entries.findIndex((x, i) => i > js.idx && !d.myScores[x.id]);
      return h("div", {}, headBar, notes, topBar,
        h("div", { class: "wz-gl-focus" },
          h("div", { class: "nav" }, button("‹", () => go(js.idx - 1), { title: "Previous" }), h("span", { text: `${js.idx + 1} / ${n}` }), button("›", () => go(js.idx + 1), { title: "Next" }),
            nextOpen >= 0 ? button("Next unscored", () => go(nextOpen)) : null),
          h("div", { class: "cards" }, entryItem({ ...e, status: "approved" }, { below: h("span", { class: "dim", text: `by ${e.author}` }) })),
          h("div", { class: "wz-gl-scorebig" }, [1, 2, 3, 4, 5].map((k) => h("button", { type: "button", class: mine === k ? "on" : "", title: SCORE_NAMES[k], onclick: () => score(e, k, true) }, String(k), h("small", { text: SCORE_NAMES[k] })))),
          h("div", { class: "wz-gl-judge" }, extra(e))));
    }
    const sorted = scores ? d.entries.slice().sort((a, b) => ((scores[b.id] || {}).avg || 0) - ((scores[a.id] || {}).avg || 0)) : d.entries;
    const items = sorted.map((e) => {
      const mine = d.myScores[e.id] || 0;
      const btns = h("div", { class: "wz-gl-scores", title: "Your score" },
        [1, 2, 3, 4, 5].map((k) => h("button", { type: "button", class: `wz-gl-scorebtn${mine === k ? " on" : ""}`, text: String(k), title: SCORE_NAMES[k], onclick: () => score(e, k) })));
      return entryItem({ ...e, status: "approved" }, { below: h("div", { class: "wz-gl-judge" }, btns, extra(e)) });
    });
    return h("div", {}, headBar, notes, topBar, h("div", { class: "wz-gl-grid" }, items));
  }

  // ---- Review -> Contests (owner) ----
  async function run(body, ok) {
    cf.busy = true; ctx.render();
    try {
      const r = await manageContest(ctx.reviewerKey(), body);
      ctx.say(ok(r));
      js.at = 0;
      await refresh(true);
    } catch (e) { ctx.say(ctx.errText(e)); }
    cf.busy = false;
    ctx.render();
  }
  function form(c) {
    if (c && cf.editFor !== c.id) Object.assign(cf, { editFor: c.id, title: c.title, rules: c.rules || "", closes: toLocalInput(c.closesAt), max: c.maxEntries });
    if (!c && cf.editFor) Object.assign(cf, { editFor: null, title: "", rules: "", closes: "", max: 3 });
    const input = (key, props) => h("input", { ...props, value: String(cf[key]), oninput: (e) => { cf[key] = e.target.value; } });
    return h("div", { class: "wz-gl-form" },
      h("label", { text: "Title" }), input("title", { type: "text", maxLength: 60, placeholder: "e.g. Heart of the Underground" }),
      h("label", { text: "Theme and rules" }), h("textarea", { maxLength: 1500, placeholder: "What to make, and any rules", text: cf.rules, oninput: (e) => { cf.rules = e.target.value; } }),
      h("label", { text: "Deadline" }), input("closes", { type: "datetime-local" }),
      h("label", { text: "Entries per player" }), input("max", { type: "number", min: 1, max: 10, step: 1, style: { width: "60px" } }));
  }
  const fields = () => {
    const closesAt = fromLocalInput(cf.closes);
    return { title: cf.title.trim(), rules: cf.rules.trim(), closesAt, maxEntries: Math.round(Number(cf.max)) };
  };
  function manageView() {
    if (!cs.list) return h("p", { class: "wz-gl-note", text: "Loading the contests…" });
    const cur = active();
    const out = [];
    if (cur) {
      const save = button(cf.busy ? "Saving…" : "Save changes", () => {
        const f = fields();
        if (!f.title || !f.closesAt) return ctx.say("Fill in a title and a deadline.");
        run({ action: "edit", id: cur.id, ...f }, () => "Contest updated.");
      }, { primary: true });
      save.disabled = cf.busy;
      const publish = removeButton({ rerender: ctx.render }, cur, { label: "Publish results", confirm: "Publish? This is final.", title: "Archive the contest: places are frozen, entries join the gallery, judge keys stop working", run: () => run({ action: "archive", id: cur.id }, () => `Results of "${cur.title}" published.`) });
      publish.disabled = cur.status === "open";
      if (cur.status === "open") publish.title = "Available once the deadline has passed";
      out.push(h("div", { class: "wz-gl-cbox" },
        h("div", { class: "wz-gl-bar" }, h("b", { text: `Running: ${cur.title}` }), h("span", { class: "dim", text: ` · ${cur.status === "open" ? `entries close ${when(cur.closesAt)} (${inTime(cur.closesAt)})` : "judging"} · ${cur.entries} approved entr${cur.entries === 1 ? "y" : "ies"}` })),
        form(cur),
        h("div", { class: "wz-gl-bar" }, save, publish,
          h("span", { class: "wz-gl-grow" }),
          removeButton({ rerender: ctx.render }, cur, { label: "Delete contest", confirm: "Delete it and its entries?", title: "For mistakes and tests: removes the contest and everything entered in it", run: () => run({ action: "delete", id: cur.id }, () => "Contest deleted.") })),
        h("p", { class: "wz-gl-note", text: "Judge keys (in Reviewers) work for this contest until you publish the results. Score entries in Judging." })));
    } else {
      const start = button(cf.busy ? "Starting…" : "Start contest", () => {
        const f = fields();
        if (!f.title || !f.closesAt) return ctx.say("Fill in a title and a deadline.");
        if (f.closesAt <= Date.now()) return ctx.say("The deadline must be in the future.");
        run({ action: "create", ...f }, (r) => `Started "${r.contest.title}".`);
      }, { primary: true });
      start.disabled = cf.busy;
      out.push(h("div", { class: "wz-gl-cbox" }, h("b", { text: "Start a contest" }), form(null), h("div", { class: "wz-gl-bar" }, start)));
    }
    const past = cs.list.filter((c) => c.status === "archived");
    if (past.length) {
      out.push(h("div", { class: "wz-gl-csub", text: "Past contests" }), h("div", { class: "wz-gl-revlog" }, past.map((c) => h("div", { class: "wz-gl-bar" },
        h("b", { text: c.title }), h("span", { class: "dim", text: `ended ${when(c.closesAt)} · ${c.entries} entr${c.entries === 1 ? "y" : "ies"}` }),
        h("span", { class: "wz-gl-grow" }),
        removeButton({ rerender: ctx.render }, c, { label: "Delete", confirm: "Delete it and its entries?", title: "Remove this contest from the archive, with its entries", run: () => run({ action: "delete", id: c.id }, () => "Contest deleted.") })))));
    }
    return h("div", {}, out);
  }

  return { state: cs, refresh, active, shownActive, slots, view, judgingView, manageView, loadJudging, unscored, judgeContestId };
}
