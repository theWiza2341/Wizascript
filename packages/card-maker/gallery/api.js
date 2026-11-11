// packages/card-maker/gallery/api.js
//
// Talking to the Card Gallery's server (the wizascript-gallery Cloudflare
// Worker; its code and design are in the wizascript-gallery-worker repo and
// claude/card-gallery-backend.md) and reading approved posts from the
// `gallery` branch.
//
// This install's credentials ({ install, secret }) are made on first use and
// kept in GM storage "wizascript.cardMaker.galleryAuth". They identify this
// copy of Wizascript, not the player: the player proves their Undercards
// account once by sending a line in void (Link my account).

// The server, this install's credentials and account linking live in
// core/account.js (any plugin can use them); re-exported here for the gallery.
import { workerUrl, ApiError, request, call, authed, getMe, linkStart, linkCheck } from "../../core/account.js";
export { workerUrl, ApiError, getMe, linkStart, linkCheck };
export const GALLERY_RAW = "https://raw.githubusercontent.com/theWiza2341/Wizascript/gallery/";

// Upload limits (the Worker's, from Cloudflare's free plan): bigger
// submissions are split into several uploads.
export const UPLOAD_MAX_ENTRIES = 10;
export const UPLOAD_MAX_PICTURES = 40;
export const UPLOAD_MAX_BYTES = 1.4 * 1024 * 1024;
export const PICTURE_MAX_BYTES = 150 * 1024;

export const sendVotes = (votes) => authed("POST", "/v1/votes", { votes });
export const deleteOwnPost = (id) => authed("POST", "/v1/posts/delete", { id });
export const getTotals = () => call("GET", "/v1/totals");
// The server's status, incl. how many days the GitHub key has left.
export const getHealth = () => call("GET", "/v1/health");

// ---- review (the owner's key, ADMIN_KEY, or a reviewer's key; turned on with
// the console command, kept in GM "wizascript.cardMaker.galleryReview") ----
const admin = (method, path, key, body) => call(method, path, { body, adminKey: key });
export const reviewWhoami = (key) => admin("GET", "/v1/admin/whoami", key);
// only: "scores" | "decisions" (the owner's filter; the owner also gets each entry's undo state)
export const reviewLog = (key, only) => admin("GET", "/v1/admin/log" + (only ? `?only=${encodeURIComponent(only)}` : ""), key);
export const reviewUndo = (key, n) => admin("POST", "/v1/admin/undo", key, { n });
// The uploader's other posts (their voter group's; a contest entry: that contest's).
export const reviewContext = (key, id) => admin("GET", `/v1/admin/context?id=${encodeURIComponent(id)}`, key);
// owner only
export const reviewersList = (key) => admin("GET", "/v1/admin/reviewers", key);
export const reviewerAdd = (key, name) => admin("POST", "/v1/admin/reviewers/add", key, { name });
export const reviewerRevoke = (key, id) => admin("POST", "/v1/admin/reviewers/revoke", key, { id });
export const reviewerAddJudge = (key, name) => admin("POST", "/v1/admin/reviewers/add", key, { name, role: "judge" });
// contests: judging (any key for that contest) and running them (owner)
export const reviewContest = (key, id) => admin("GET", `/v1/admin/contest?id=${encodeURIComponent(id)}`, key);
export const reviewScore = (key, contest, post, score) => admin("POST", "/v1/admin/score", key, { contest, post, score });
export const manageContest = (key, body) => admin("POST", "/v1/admin/contests", key, body);
// The contests, as the Worker has them now (status, deadline, entry counts).
export const getContests = () => call("GET", "/v1/contests");
export const reviewPending = (key) => admin("GET", "/v1/admin/pending", key);
export const reviewPost = (key, id) => admin("GET", `/v1/admin/post?id=${encodeURIComponent(id)}`, key);
export const reviewDecide = (key, id, approve, reason) => admin("POST", "/v1/admin/decide", key, { id, approve: !!approve, reason: reason || "" });
export const reviewRemove = (key, id) => admin("POST", "/v1/admin/remove", key, { id });
// 1.9 post notes (Worker 1.9): staff side ...
export const notesList = (key, closed) => admin("GET", "/v1/admin/threads" + (closed ? "?status=closed" : ""), key);
export const noteGet = (key, id) => admin("GET", `/v1/admin/thread?id=${encodeURIComponent(id)}`, key);
export const noteOpen = (key, post, text) => admin("POST", "/v1/admin/thread/open", key, { post, text });
export const noteReply = (key, id, text) => admin("POST", "/v1/admin/thread/reply", key, { id, text });
export const noteClose = (key, id) => admin("POST", "/v1/admin/thread/close", key, { id });
// ... and the author's side.
export const myNotes = () => authed("GET", "/v1/threads");
export const myNote = (id) => authed("GET", `/v1/thread?id=${encodeURIComponent(id)}`);
export const myNoteReply = (id, text) => authed("POST", "/v1/thread/reply", { id, text });
export const myNoteClose = (id) => authed("POST", "/v1/thread/close", { id });
export const NOTE_MAX = 500;

// Only paths the Worker writes (art/<id>-<n>.png, art/tribe-<hash>.png) become
// addresses, so nothing in the gallery's files can point a card's art elsewhere.
const artUrl = (p) => (typeof p === "string" && /^art\/[a-z0-9-]{1,40}\.png$/.test(p) ? GALLERY_RAW + p : "");
const validId = (p) => p && /^[0-9a-z]{3,8}$/.test(p.id);
export function withArt(p) {
  return {
    ...p,
    parts: (p.parts || []).map((c) => ({
      ...c,
      art: artUrl(c.art),
      picture: c.picture ? artUrl(c.picture) || undefined : undefined,
      tribes: (c.tribes || []).map((t) => ({ ...t, icon: artUrl(t.icon) }))
    }))
  };
}

// The approved posts (gallery branch), with art paths made into URLs.
export async function getIndex() {
  const idx = await request("GET", `${GALLERY_RAW}index.json?t=${Math.floor(Date.now() / 60000)}`);
  return (idx && Array.isArray(idx.posts) ? idx.posts : []).filter(validId).map(withArt);
}

// contests.json (gallery branch): each contest's approved entries, and the
// results of archived ones.
export async function getContestsFile() {
  const f = await request("GET", `${GALLERY_RAW}contests.json?t=${Math.floor(Date.now() / 60000)}`);
  return (f && Array.isArray(f.contests) ? f.contests : []).filter((c) => c && /^c[0-9a-z]{1,8}$/.test(c.id)).map((c) => ({
    ...c,
    entries: (Array.isArray(c.entries) ? c.entries : []).filter(validId).map(withArt)
  }));
}

// ---- uploads ----------------------------------------------------------------------

const dataBytes = (s) => (typeof s === "string" && s.startsWith("data:") ? Math.floor((s.length - s.indexOf(",") - 1) * 3 / 4) : 0);

// What the server keeps of a card; pictures as PNG data URLs.
export function toUploadPart(p) {
  const out = { type: p.type, name: p.name, desc: p.desc || "" };
  ["cost", "atk", "hp"].forEach((k) => { if (Number.isInteger(p[k])) out[k] = p[k]; });
  if (p.rarity) out.rarity = p.rarity;
  if (p.soul) out.soul = p.soul;
  if (p.picture) out.picture = p.picture;
  else if (p.art) out.art = p.art;
  const tribes = (p.tribes || []).filter((t) => t && typeof t.icon === "string" && t.icon.startsWith("data:image/png"));
  if (tribes.length) out.tribes = tribes.map((t) => ({ name: t.name || "", icon: t.icon }));
  return out;
}
const pictures = (u) => [u.art, u.picture, ...(u.tribes || []).map((t) => t.icon)].filter(Boolean);

// Problems the server would refuse, per entry, so they show before sending.
export function uploadProblems(entries) {
  const out = [];
  entries.forEach((e) => e.parts.forEach((p) => {
    const u = toUploadPart(p);
    pictures(u).forEach((pic) => {
      if (!/^data:image\/png;base64,/.test(pic)) out.push(`${p.name || "A card"}: its art isn't a PNG.`);
      else if (dataBytes(pic) > PICTURE_MAX_BYTES) out.push(`${p.name || "A card"}: its art is too big (over 150 KB).`);
    });
    if (!u.art && !u.picture && p.type !== "Enchantment") out.push(`${p.name || "A card"}: no art.`);
  }));
  return [...new Set(out)];
}

// Entries -> batches that each fit one upload.
export function splitUploads(entries) {
  const batches = [];
  let cur = [], pics = 0, bytes = 0;
  for (const e of entries) {
    const parts = e.parts.map(toUploadPart);
    const ePics = parts.reduce((n, u) => n + pictures(u).length, 0);
    const eBytes = parts.reduce((n, u) => n + pictures(u).reduce((m, s) => m + dataBytes(s), 0), 0);
    if (cur.length && (cur.length >= UPLOAD_MAX_ENTRIES || pics + ePics > UPLOAD_MAX_PICTURES || bytes + eBytes > UPLOAD_MAX_BYTES)) {
      batches.push(cur); cur = []; pics = 0; bytes = 0;
    }
    cur.push({ kind: e.kind, title: e.title || "", parts, local: e });
    pics += ePics; bytes += eBytes;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

// Sends every batch in turn. onProgress(done, total). Returns the posts the
// server made, each with its `local` entry; stops at the first error, with
// what was sent so far in error.extra.sent.
export async function uploadEntries(entries, onProgress, contest) {
  const batches = splitUploads(entries);
  const sent = [];
  for (let i = 0; i < batches.length; i++) {
    if (onProgress) onProgress(i, batches.length);
    let res;
    try {
      res = await authed("POST", "/v1/posts", { entries: batches[i].map(({ local, ...e }) => e), ...(contest ? { contest } : {}) });
    } catch (e) {
      e.extra = { ...(e.extra || {}), sent };
      throw e;
    }
    res.posts.forEach((p, k) => sent.push({ ...p, local: batches[i][k].local }));
  }
  if (onProgress) onProgress(batches.length, batches.length);
  return sent;
}

// ---- votes ------------------------------------------------------------------------
// Votes wait in a queue and go in one request: 2 seconds after the last
// click, or at once when the player leaves Browse or closes/minimises the
// Card Maker (flush()). A vote clicked again before sending just replaces
// the queued one.

export function createVoteQueue({ onSent, onError }) {
  let queue = {};
  let timer = null;
  let sending = null;
  const flush = async () => {
    clearTimeout(timer);
    if (sending) await sending.catch(() => null);
    const batch = queue;
    if (!Object.keys(batch).length) return;
    queue = {};
    sending = (async () => {
      const ids = Object.keys(batch);
      for (let i = 0; i < ids.length; i += 100) {
        const part = Object.fromEntries(ids.slice(i, i + 100).map((id) => [id, batch[id]]));
        try {
          const r = await sendVotes(part);
          if (onSent) onSent(part, r);
        } catch (e) {
          // put back what didn't go, unless a newer vote replaced it
          Object.entries(part).forEach(([id, v]) => { if (!(id in queue)) queue[id] = v; });
          if (onError) onError(e);
          return;
        }
      }
    })();
    await sending;
    sending = null;
  };
  return {
    add(id, v) { queue[id] = v; clearTimeout(timer); timer = setTimeout(flush, 2000); },
    flush,
    pending: () => ({ ...queue })
  };
}

// ---- guidelines (Submit) ------------------------------------------------------------
// What's accepted, shown on Submit. The text lives in gallery-guidelines.md on
// the `sounds` branch (only the maintainer edits it), so it can change without
// an update; this copy is used until it loads, or if it can't be reached.
// Format: a "# title" line (optional), any intro lines, then one "- " line per
// rule; **bold** works.
export const GUIDELINES_URL = "https://raw.githubusercontent.com/theWiza2341/Wizascript/sounds/gallery-guidelines.md";
const GUIDE_KEY = "wizascript.cardMaker.guidelines"; // GM: { at, text }
const GUIDE_TTL = 60 * 60 * 1000;
export const DEFAULT_GUIDELINES = `# Gallery guidelines
- **Explain it.** Using a custom keyword? Upload it as a set that includes its description. Existing UC cards and artifacts can just be named.
- **Keep it codable.** Effects that would be very hard to build in UC (multi-selects, aura keywords) are usually turned down. Judged case by case.
- **New ideas, not number tweaks.** No +1/-1 buffs or nerfs of existing cards. Reworks and big effect changes are fine.
- **UT, UTY and Deltarune sprites only.** Art from other fangames gets rejected.
- **Cardifacts rules apply.** Don't post anything you couldn't post in the channel.`;

export function parseGuidelines(text) {
  const out = { title: "", intro: [], rules: [] };
  String(text || "").split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    if (/^#\s+/.test(line)) { if (!out.title) out.title = line.replace(/^#+\s+/, ""); return; }
    if (/^[-*]\s+/.test(line)) out.rules.push(line.replace(/^[-*]\s+/, ""));
    else if (out.rules.length) out.rules[out.rules.length - 1] += " " + line;
    else out.intro.push(line);
  });
  return out;
}

function cachedGuidelines() {
  try { const c = JSON.parse(GM_getValue(GUIDE_KEY, "null")); return c && typeof c.text === "string" ? c : null; } catch (e) { return null; }
}
// Resolves to the guidelines' text: the cached copy (refreshed hourly), else the built-in one.
export function getGuidelines() {
  const c = cachedGuidelines();
  if (c && Date.now() - c.at < GUIDE_TTL) return Promise.resolve(c.text);
  return new Promise((resolve) => {
    const fallback = () => resolve(c ? c.text : DEFAULT_GUIDELINES);
    try {
      GM_xmlhttpRequest({
        method: "GET",
        url: GUIDELINES_URL + "?t=" + Math.floor(Date.now() / 60000),
        timeout: 8000,
        onload: (r) => {
          const text = r.status === 200 ? String(r.responseText || "") : "";
          if (!parseGuidelines(text).rules.length) return fallback(); // missing or not a list: keep what we had
          try { GM_setValue(GUIDE_KEY, JSON.stringify({ at: Date.now(), text })); } catch (e) { /* not cached */ }
          resolve(text);
        },
        onerror: fallback,
        ontimeout: fallback
      });
    } catch (e) { fallback(); }
  });
}
