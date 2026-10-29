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

export const WORKER = "https://wizascript-gallery.redstonewiza2341.workers.dev";
export const GALLERY_RAW = "https://raw.githubusercontent.com/theWiza2341/Wizascript/gallery/";
const AUTH_KEY = "wizascript.cardMaker.galleryAuth";

// Upload limits (the Worker's, from Cloudflare's free plan): bigger
// submissions are split into several uploads.
export const UPLOAD_MAX_ENTRIES = 10;
export const UPLOAD_MAX_PICTURES = 40;
export const UPLOAD_MAX_BYTES = 1.4 * 1024 * 1024;
export const PICTURE_MAX_BYTES = 150 * 1024;

export class ApiError extends Error {
  constructor(status, code, message, extra) { super(message); this.status = status; this.code = code; this.extra = extra || {}; }
}

function request(method, url, { body, auth, adminKey } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { "Content-Type": "application/json" };
    if (auth) { headers["X-WZ-Install"] = auth.install; headers["X-WZ-Secret"] = auth.secret; }
    if (adminKey) headers["X-WZ-Admin"] = adminKey;
    const done = (status, text) => {
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { /* not JSON */ }
      if (status >= 200 && status < 300) return resolve(data);
      if (status === 404 && !data) return resolve(null);
      reject(new ApiError(status, (data && data.error) || "http", (data && data.message) || `The gallery server answered ${status}.`, data));
    };
    if (typeof GM_xmlhttpRequest === "function") {
      GM_xmlhttpRequest({
        method, url, headers,
        data: body ? JSON.stringify(body) : undefined,
        timeout: 30000,
        onload: (r) => done(r.status, r.responseText),
        onerror: () => reject(new ApiError(0, "network", "Couldn't reach the gallery server.")),
        ontimeout: () => reject(new ApiError(0, "timeout", "The gallery server took too long to answer."))
      });
      return;
    }
    fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
      .then(async (r) => done(r.status, await r.text()), () => reject(new ApiError(0, "network", "Couldn't reach the gallery server.")));
  });
}

// ---- this install ---------------------------------------------------------------

function loadAuth() {
  try { const a = JSON.parse(GM_getValue(AUTH_KEY, "null")); return a && a.install && a.secret ? a : null; } catch (e) { return null; }
}
let auth = null;
let making = null;
async function getAuth() {
  if (auth) return auth;
  auth = loadAuth();
  if (auth) return auth;
  if (!making) {
    making = request("POST", `${WORKER}/v1/install`).then((a) => {
      GM_setValue(AUTH_KEY, JSON.stringify({ install: a.install, secret: a.secret }));
      auth = a;
      return a;
    }).finally(() => { making = null; });
  }
  return making;
}
// A server that no longer knows this install (e.g. its database was reset):
// start over with a new one.
async function authed(method, path, body) {
  const a = await getAuth();
  try {
    return await request(method, WORKER + path, { body, auth: a });
  } catch (e) {
    if (e.code === "bad_install" || e.code === "no_install") {
      GM_deleteValue(AUTH_KEY);
      auth = null;
      return request(method, WORKER + path, { body, auth: await getAuth() });
    }
    throw e;
  }
}

// ---- endpoints --------------------------------------------------------------------

export const getMe = () => authed("GET", "/v1/me");
export const linkStart = () => authed("POST", "/v1/link/start");
export const linkCheck = () => authed("POST", "/v1/link/check");
export const sendVotes = (votes) => authed("POST", "/v1/votes", { votes });
export const deleteOwnPost = (id) => authed("POST", "/v1/posts/delete", { id });
export const getTotals = () => request("GET", `${WORKER}/v1/totals`);

// ---- review (the owner's key, ADMIN_KEY, or a reviewer's key; turned on with
// the console command, kept in GM "wizascript.cardMaker.galleryReview") ----
const admin = (method, path, key, body) => request(method, WORKER + path, { body, adminKey: key });
export const reviewWhoami = (key) => admin("GET", "/v1/admin/whoami", key);
export const reviewLog = (key) => admin("GET", "/v1/admin/log", key);
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
export const getContests = () => request("GET", `${WORKER}/v1/contests`);
export const reviewPending = (key) => admin("GET", "/v1/admin/pending", key);
export const reviewPost = (key, id) => admin("GET", `/v1/admin/post?id=${encodeURIComponent(id)}`, key);
export const reviewDecide = (key, id, approve, reason) => admin("POST", "/v1/admin/decide", key, { id, approve: !!approve, reason: reason || "" });
export const reviewRemove = (key, id) => admin("POST", "/v1/admin/remove", key, { id });

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
