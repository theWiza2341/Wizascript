// packages/card-maker/gallery/feild.js
//
// feildmaster's Template Editor: its saved elements -> the gallery's raw parts.
// Used two ways, so they always agree:
//  - reader.js, inside his editor (Read from this editor): elements from its
//    storage, relative paths on his site;
//  - parts.js, his editor's Export file (Add files…): elements and assets from
//    the file, absolute paths to his site.
// An element is what his editor saves (`toJSON()`): { id, type: "card" |
// "text" | "group" | …, name, description, cost, attack, health, image,
// rarity, soul, tribes, content (a group's element ids) }. Images are either
// his built-in art (an avatar name, see /resources/data/avatars.json) or the
// player's own upload (a UUID; IndexedDB in the editor, `assets` in a file).

export const FEILD_ORIGIN = "https://undercard.feildmaster.com";
export const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v || "");

// ctx: { image(id) -> Promise<dataUrl | null>, tribeIcon(name) -> Promise<dataUrl | null>, why(id)?: why an image is missing }
export async function feildPart(e, ctx) {
  if (!e) return null;
  const base = { name: e.name || "", desc: e.description || "", image: await ctx.image(e.image) };
  if (!base.image && ctx.why && ctx.why(e.image)) base.artNote = ctx.why(e.image); // shown on the part (partFromRaw)
  if (e.type === "text") return { type: "Artifact", ...base, rarity: e.rarity || "COMMON" };
  if (e.type !== "card") return null;
  const spell = e.health === undefined || e.health === null;
  return {
    type: spell ? "Spell" : "Monster",
    ...base,
    cost: e.cost ?? 0,
    atk: spell ? null : e.attack ?? 0,
    hp: spell ? null : e.health ?? 0,
    soul: e.soul || null,
    rarity: isUuid(e.rarity) ? null : e.rarity || "COMMON",
    rarityIcon: isUuid(e.rarity) ? await ctx.image(e.rarity) : null,
    tribes: await Promise.all((e.tribes || []).filter((t) => t && t !== "none").map(async (t) => ({
      name: isUuid(t) ? null : t,
      icon: isUuid(t) ? await ctx.image(t) : await ctx.tribeIcon(t)
    }))),
    imageType: "standard"
  };
}
export const tribePath = (t) => `/resources/tribes/${String(t).toUpperCase().replace(/ /g, "_")}.png`;

// The groups as the gallery lists them: each group with its cards (in order),
// then the elements that aren't in any group, as "Not in a group".
//   el(id): an element; groupIds: the groups to list, in order; allIds: every element id.
export async function feildGroups({ el, groupIds, allIds }, ctx, looseName = "Not in a group") {
  const groups = [];
  const seen = new Set();
  for (const gid of groupIds) {
    const g = el(gid);
    if (!g) continue;
    const parts = [];
    for (const cid of g.content || []) {
      seen.add(cid);
      const p = await feildPart(el(cid), ctx);
      if (p) parts.push(p);
    }
    groups.push({ name: g.name || "Group", parts });
  }
  const loose = [];
  for (const id of allIds) {
    const e = el(id);
    if (seen.has(id) || groupIds.includes(id) || !e || e.type === "group") continue;
    const p = await feildPart(e, ctx);
    if (p) loose.push(p);
  }
  if (loose.length) groups.push({ name: looseName, parts: loose });
  return groups;
}
