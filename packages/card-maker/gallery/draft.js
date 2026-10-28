// packages/card-maker/gallery/draft.js
//
// The player's Card Gallery draft: the parts they've added and the sets
// they've linked, plus a copy of each upload still waiting for approval
// ("uploads", by post id), so My posts can show its cards before the
// gallery has them. GM storage "wizascript.cardMaker.gallery", so it
// survives a refresh and is in Back up / Restore. Art is stored as small
// data: URLs (a card part is roughly 15-30 KB).

const KEY = "wizascript.cardMaker.gallery";

let draft = null;
let saveTimer = null;

export function getDraft() {
  if (draft) return draft;
  try {
    const raw = GM_getValue(KEY, null);
    draft = raw ? JSON.parse(raw) : null;
  } catch (e) {
    draft = null;
  }
  if (!draft || !Array.isArray(draft.parts)) draft = { parts: [], groups: [], nextId: 1, uploads: {} };
  draft.groups = draft.groups || [];
  draft.uploads = draft.uploads || {};
  // dev8-dev9 kept local "posts" and votes as a preview; the server has them now.
  delete draft.posted;
  delete draft.votes;
  draft.parts.forEach((p) => { p.sel = false; });
  return draft;
}

export function saveDraft() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const clean = { ...draft, parts: draft.parts.map(({ sel, ...p }) => p) };
      GM_setValue(KEY, JSON.stringify(clean));
    } catch (e) {
      console.warn("[Card Gallery] Couldn't save the draft", e);
    }
  }, 300);
}

export function nextId() {
  const d = getDraft();
  return d.nextId++;
}

// A set needs two parts or more; smaller ones dissolve. Letters stay put.
export function tidySets() {
  const d = getDraft();
  for (let i = d.groups.length - 1; i >= 0; i--) {
    const members = d.parts.filter((p) => p.group === d.groups[i].id);
    if (members.length < 2) {
      members.forEach((p) => { p.group = null; });
      d.groups.splice(i, 1);
    }
  }
}

// Most cards a set can have: about one full page of Medium cards, so a set
// never needs more than a page in Browse.
export const SET_CAP = 15;

export function makeSet(members, name = "") {
  const d = getDraft();
  if (members.length < 2 || members.length > SET_CAP) return null;
  const used = new Set(d.groups.map((g) => g.letter));
  let letter = "A";
  while (used.has(letter)) letter = String.fromCharCode(letter.charCodeAt(0) + 1);
  const set = { id: nextId(), letter, name };
  d.groups.push(set);
  members.forEach((p) => { p.group = set.id; p.sel = false; });
  tidySets();
  return set;
}

// After an upload: these parts and their sets leave the draft, and a copy
// of each entry is kept under its new post id until it's decided.
export function markUploaded(sent) {
  const d = getDraft();
  const gone = new Set();
  sent.forEach(({ id, kind, title, local }) => {
    d.uploads[id] = { kind, title, postedAt: Date.now(), parts: local.parts.map(({ sel, group, id: _, ...p }) => p) };
    local.parts.forEach((p) => gone.add(p));
  });
  d.parts = d.parts.filter((p) => !gone.has(p));
  tidySets();
  saveDraft();
}

// Copies no longer needed: approved posts once the gallery's index has
// them, rejected ones after 14 days, and ones the server no longer lists.
export function pruneUploads(statusById, inIndex) {
  const d = getDraft();
  let changed = false;
  Object.keys(d.uploads).forEach((id) => {
    const st = statusById[id];
    const old = Date.now() - d.uploads[id].postedAt > 14 * 864e5;
    if ((st === "approved" && inIndex.has(id)) || ((st === "rejected" || st === "removed") && old) || (!st && old)) { delete d.uploads[id]; changed = true; }
  });
  if (changed) saveDraft();
}

// What would be submitted: every set, then every part not in a set.
export function entries() {
  const d = getDraft();
  const out = d.groups.map((g) => ({ key: "g" + g.id, kind: "set", label: g.letter, title: g.name, parts: d.parts.filter((p) => p.group === g.id) }));
  d.parts.filter((p) => !p.group).forEach((p) => out.push({ key: "p" + p.id, kind: "single", title: p.name, parts: [p] }));
  return out;
}
