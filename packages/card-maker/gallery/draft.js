// packages/card-maker/gallery/draft.js
//
// The player's Card Gallery draft: the parts they've added, the sets
// they've linked, and (until the gallery is live) their votes on the
// Browse preview. GM storage "wizascript.cardMaker.gallery", so it
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
  if (!draft || !Array.isArray(draft.parts)) draft = { parts: [], groups: [], nextId: 1, votes: {} };
  draft.groups = draft.groups || [];
  draft.votes = draft.votes || {};
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

export function makeSet(members, name = "") {
  const d = getDraft();
  if (members.length < 2) return null;
  const used = new Set(d.groups.map((g) => g.letter));
  let letter = "A";
  while (used.has(letter)) letter = String.fromCharCode(letter.charCodeAt(0) + 1);
  const set = { id: nextId(), letter, name };
  d.groups.push(set);
  members.forEach((p) => { p.group = set.id; p.sel = false; });
  tidySets();
  return set;
}

// What would be submitted: every set, then every part not in a set.
export function entries() {
  const d = getDraft();
  const out = d.groups.map((g) => ({ key: "g" + g.id, kind: "set", label: g.letter, title: g.name, parts: d.parts.filter((p) => p.group === g.id) }));
  d.parts.filter((p) => !p.group).forEach((p) => out.push({ key: "p" + p.id, kind: "single", title: p.name, parts: [p] }));
  return out;
}
