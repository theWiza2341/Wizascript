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
const daysAgo = (t) => Math.max(0, Math.floor((Date.now() - (t || Date.now())) / 864e5));

// ctx: { say, render, errText, hoverable, acct, draft, reviewerKey, who(),
//        startEntry(contestId), deleteMine(entry), visible() }
export function createContests(ctx) {
  const cs = { list: null, file: null, at: 0, loading: false, error: "", pick: null, sort: "rank" };
  const js = { id: null, data: null, at: 0, loading: false, error: "", top: null };
  const cf = { title: "", rules: "", closes: "", max: 3, busy: false, editFor: null };

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
  const active = () => (cs.list || []).find((c) => c.status !== "archived") || null;
  const fileFor = (id) => (cs.file || []).find((c) => c.id === id) || null;
  // The player's slots in the open contest (from /v1/me: counts every account
  // that shares their voter group).
  function slots() {
    const c = active();
    if (!c || c.status !== "open") return null;
    const mine = ctx.acct.contest && ctx.acct.contest.id === c.id ? ctx.acct.contest : null;
    const used = mine ? mine.used : 0;
    return { contest: c, used, max: c.maxEntries, left: Math.max(0, c.maxEntries - used) };
  }

  // ---- shared: one entry, drawn like Browse's items ----
  function entryItem(e, { place, cls, below } = {}) {
    const isSet = e.kind === "set";
    const info = { author: e.author, days: daysAgo(e.approvedAt || e.postedAt), status: e.status || "approved", reason: e.reason };
    return h("div", { class: `wz-gl-item${isSet ? " set" : ""}${cls ? " " + cls : ""}`, "data-key": e.id },
      isSet ? h("div", { class: "wz-gl-sethead" }, h("div", { class: "wz-gl-setname", text: e.title || "(no name)", title: e.title || "" })) : null,
      h("div", { class: "wz-gl-row" }, e.parts.map((p) => ctx.hoverable(h("div", { class: "wz-gl-zoom" }, tile(p)), p, info))),
      place || below ? h("div", { class: "wz-gl-votes" }, place || null, below || null) : null);
  }

  // ---- the Contest tab ----
  function view() {
    if (!cs.list) return h("p", { class: "wz-gl-note", text: cs.error ? `Couldn't load the contests: ${cs.error}` : "Loading the contests…" });
    if (!cs.list.length) {
      return h("div", {},
        h("p", { class: "wz-gl-note", text: "No contests yet." }),
        h("p", { class: "wz-gl-note", text: "Contests have a theme and a deadline. Enter your designs; the organizers judge them, and the results are kept here." }));
    }
    const cur = active();
    if (!cs.pick || !cs.list.some((c) => c.id === cs.pick)) cs.pick = cur ? cur.id : cs.list[0].id;
    const archived = cs.list.filter((c) => c.status === "archived");
    const bar = h("div", { class: "wz-gl-cbar" },
      cur ? button(`★ ${cur.title}`, () => { cs.pick = cur.id; ctx.render(); }, { primary: cs.pick === cur.id, title: "The contest running now" }) : null,
      archived.length ? h("span", { class: "dim", text: cur ? "Past:" : "Past contests:" }) : null,
      archived.map((c) => button(c.title, () => { cs.pick = c.id; ctx.render(); }, { primary: cs.pick === c.id, title: `Ended ${when(c.closesAt)}` })),
      h("span", { class: "wz-gl-grow" }),
      h("button", { type: "button", class: "wz-gl-refresh", title: "Load the latest", text: "↻", onclick: () => { refresh(true); ctx.refreshMe(true); } }));
    const c = cs.list.find((x) => x.id === cs.pick);
    return h("div", {}, bar, c.status === "archived" ? archiveView(c) : runningView(c));
  }

  function head(c, lines) {
    return h("div", { class: "wz-gl-chead" },
      h("div", { class: "wz-gl-ctitle", text: c.title }),
      c.rules ? h("div", { class: "wz-gl-crules", text: c.rules }) : null,
      lines.map((l) => h("div", { class: "wz-gl-cmeta" }, l)));
  }

  function runningView(c) {
    const open = c.status === "open";
    const s = slots();
    const lines = [open
      ? ["Entries close ", h("b", { text: when(c.closesAt) }), ` (${inTime(c.closesAt)}). Up to ${c.maxEntries} per player; a set counts as one.`]
      : ["Entries closed ", h("b", { text: when(c.closesAt) }), ". The organizers are judging; results show here when they're done."]];
    if (open) {
      const enter = button(!ctx.acct.account ? "Link your account to enter" : s && !s.left ? "No entries left" : "Enter cards", () => ctx.startEntry(c.id), { primary: true, title: "Pick cards in Submit and upload them to this contest" });
      enter.disabled = !ctx.acct.account || !s || !s.left;
      lines.push([h("span", { text: s ? `Your entries: ${s.used} of ${s.max}. ` : "" }), enter]);
    }
    // the player's own entries, with their status (copies kept from upload)
    const own = ctx.acct.posts.filter((p) => p.contest === c.id && ctx.draft.uploads[p.id]).map((p) => ({ ...ctx.draft.uploads[p.id], id: p.id, status: p.status, reason: p.reason, author: ctx.acct.account, postedAt: p.postedAt }));
    const entriesFile = fileFor(c.id);
    const all = entriesFile ? entriesFile.entries : [];
    const others = all.filter((e) => !own.some((o) => o.id === e.id));
    const ownItems = own.map((e) => {
      const tagText = e.status === "approved" ? "entered" : e.status === "pending" ? "awaiting approval" : "not approved";
      const tag = h("span", { class: `wz-gl-mine${e.status === "pending" ? " pending" : e.status === "rejected" || e.status === "removed" ? " rejected" : ""}`, text: tagText });
      const canWithdraw = open && (e.status === "pending" || e.status === "approved");
      const del = canWithdraw
        ? removeButton({ rerender: ctx.render }, e, { label: "Withdraw", confirm: "Withdraw it?", title: "Take this entry back, to free its slot", run: ctx.deleteMine })
        : e.status === "rejected" || e.status === "removed" ? removeButton({ rerender: ctx.render }, e, { label: "Delete", confirm: "Delete for good?", title: "Delete this entry: it wasn't approved", run: ctx.deleteMine }) : null;
      return entryItem(e, { below: [tag, del] });
    });
    return h("div", {},
      head(c, lines),
      ownItems.length ? [h("div", { class: "wz-gl-csub", text: "Your entries" }), h("div", { class: "wz-gl-grid" }, ownItems)] : null,
      h("div", { class: "wz-gl-csub", text: `Entries so far (${c.entries})` }),
      others.length ? h("div", { class: "wz-gl-grid" }, others.map((e) => entryItem(e)))
        : h("p", { class: "wz-gl-note", text: c.entries ? "They'll show here in a few minutes." : "None yet. Be the first!" }),
      h("p", { class: "wz-gl-note", text: "There's no voting on contest entries: the organizers judge them. They join the gallery once the results are out." }));
  }

  function archiveView(c) {
    const f = fileFor(c.id);
    if (!f) return h("div", {}, head(c, [`Ended ${when(c.closesAt)}.`]), h("p", { class: "wz-gl-note", text: "Loading the results…" }));
    const res = f.results || { order: [], scores: {} };
    const byId = new Map(f.entries.map((e) => [e.id, e]));
    const ranked = res.order.map((id) => byId.get(id)).filter(Boolean);
    f.entries.forEach((e) => { if (!res.order.includes(e.id)) ranked.push(e); });
    const list = cs.sort === "new" ? ranked.slice().sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0)) : ranked;
    const sortBar = h("div", { class: "wz-gl-cbar" },
      h("span", { class: "dim", text: "Sort:" }),
      button("Ranking", () => { cs.sort = "rank"; ctx.render(); }, { primary: cs.sort !== "new" }),
      button("Newest", () => { cs.sort = "new"; ctx.render(); }, { primary: cs.sort === "new" }));
    const items = list.map((e) => {
      const i = ranked.indexOf(e);
      const sc = res.scores[e.id];
      const placeCls = i < 3 ? ` p${i + 1}` : "";
      const place = h("span", { class: `wz-gl-place${placeCls}`, text: i < 3 ? PLACES[i] : `# ${i + 1}` });
      const avg = h("span", { class: "wz-gl-avg", text: sc && sc.n ? `${sc.avg.toFixed(2)} (${sc.n} judge${sc.n === 1 ? "" : "s"})` : "not scored" });
      return entryItem(e, { place, below: avg, cls: i < 3 && cs.sort !== "new" ? `p${i + 1}` : "" });
    });
    return h("div", {},
      head(c, [`Ended ${when(c.closesAt)} · ${f.entries.length} entr${f.entries.length === 1 ? "y" : "ies"}. ${res.manualTop ? "The organizers picked the top places; the rest are" : "Places are"} by average score (1 to 5).`]),
      f.entries.length ? sortBar : null,
      f.entries.length ? h("div", { class: "wz-gl-grid" }, items) : h("p", { class: "wz-gl-note", text: "No entries." }));
  }

  // ---- Review -> Judging ----
  const judgeContestId = () => {
    const who = ctx.who();
    if (who && who.role === "judge") return who.contest;
    const c = active();
    return c ? c.id : null;
  };
  async function loadJudging(force) {
    const id = judgeContestId();
    if (!id || !ctx.reviewerKey()) { js.data = null; return; }
    if (js.loading || (!force && js.id === id && js.at && Date.now() - js.at < 30e3)) return;
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
  async function score(e, n) {
    const mine = js.data.myScores[e.id] || 0;
    const value = mine === n ? 0 : n; // the same score again takes it back
    try {
      await reviewScore(ctx.reviewerKey(), js.id, e.id, value);
      if (value) js.data.myScores[e.id] = value; else delete js.data.myScores[e.id];
      ctx.changed();
    } catch (err) { ctx.say(`Couldn't save the score: ${ctx.errText(err)}`); }
    ctx.render();
  }
  async function saveTop(list) {
    try {
      await manageContest(ctx.reviewerKey(), { action: "top3", id: js.id, posts: list });
      js.top = list.slice();
      js.data.contest.top3 = list.slice();
      ctx.say(list.length ? "Top places saved." : "Top places cleared: places come from the scores.");
    } catch (err) { ctx.say(`Couldn't save the top places: ${ctx.errText(err)}`); }
    ctx.render();
  }
  function judgingView() {
    const id = judgeContestId();
    if (!id) return h("p", { class: "wz-gl-note", text: "No contest is running." });
    if (js.error) return h("div", { class: "wz-gl-issues", text: js.error });
    if (!js.data || js.id !== id) return h("p", { class: "wz-gl-note", text: "Loading the entries…" });
    const d = js.data, c = d.contest;
    const owner = ctx.who() && ctx.who().role === "owner";
    const n = d.entries.length;
    const done = n - unscored();
    const headBar = h("div", { class: "wz-gl-bar" },
      h("b", { text: `Judging: ${c.title}` }),
      h("span", { class: "dim", text: c.status === "open" ? ` · entries close ${when(c.closesAt)}` : " · entries closed" }),
      h("span", { class: "wz-gl-grow" }),
      h("span", { text: `You've scored ${done} of ${n}` }),
      button("↻ Refresh", () => loadJudging(true)));
    const notes = [h("p", { class: "wz-gl-note", text: "Score each entry 1 (extremely poor) to 5 (extremely good); 3 is average. Click your score again to take it back. Other judges' scores stay hidden." })];
    if (owner && d.scores) notes.push(h("p", { class: "wz-gl-note", text: "The deadline has passed, so you see everyone's scores. Places go by average score, unless you pick the top 3 below. Publish the results in Contests." }));
    let topBar = null;
    if (owner && d.scores) {
      const changedTop = JSON.stringify(js.top) !== JSON.stringify(c.top3 || []);
      topBar = h("div", { class: "wz-gl-bar" },
        h("span", { text: js.top.length ? `Top places by hand: ${js.top.map((pid, i) => `${PLACES[i]} #${pid}`).join(", ")}` : "Top places: by score" }),
        button("Save top places", () => saveTop(js.top.filter(Boolean)), { primary: changedTop }),
        js.top.length ? button("Use scores instead", () => saveTop([])) : null);
    }
    const sorted = d.scores ? d.entries.slice().sort((a, b) => ((d.scores[b.id] || {}).avg || 0) - ((d.scores[a.id] || {}).avg || 0)) : d.entries;
    const items = sorted.map((e) => {
      const mine = d.myScores[e.id] || 0;
      const btns = h("div", { class: "wz-gl-scores", title: "Your score" },
        [1, 2, 3, 4, 5].map((k) => h("button", { type: "button", class: `wz-gl-scorebtn${mine === k ? " on" : ""}`, text: String(k), title: ["", "Extremely poor", "Poor", "Average", "Good", "Extremely good"][k], onclick: () => score(e, k) })));
      const parts = [btns];
      if (d.scores) {
        const s = d.scores[e.id];
        parts.push(h("span", { class: "wz-gl-avg", text: s ? `avg ${s.avg.toFixed(2)} · ${s.n} judge${s.n === 1 ? "" : "s"}` : "no scores yet" }));
        if (s) parts.push(h("span", { class: "by", text: s.by.map((b) => `${b.name} ${b.score}`).join(", ") }));
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
      return entryItem({ ...e, status: "approved" }, { below: h("div", { class: "wz-gl-judge" }, parts) });
    });
    return h("div", {}, headBar, notes, topBar,
      n ? h("div", { class: "wz-gl-grid" }, items) : h("p", { class: "wz-gl-note", text: "No approved entries yet. Approve them in Uploads." }));
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

  return { state: cs, refresh, active, slots, view, judgingView, manageView, loadJudging, unscored, judgeContestId };
}
