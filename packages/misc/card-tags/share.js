// packages/misc/card-tags/share.js
//
// "Share…" / "Import…" in the Manage Tags dialog. Sharing turns some or
// all of your tags (with the cards they're on) into a code you can send
// to a friend; importing a code merges it into your own tags - see
// storage.js's importTags() for the merge rules. Codes use the same
// format as settings backups (core/share-code.js), tagged "TAGS".

import { allTags, exportTags, importTags } from "./storage.js";
import { encodeCode, decodeCode, showExportDialog, showImportDialog, showInfoDialog } from "../../core/share-code.js";
import { getPageWindow } from "../../core/page-window.js";

const KIND = "TAGS";

function countCards(tagId) {
  return exportTags([tagId]).tags[0].cards.length;
}

export function openShareTagsDialog() {
  const BootstrapDialog = getPageWindow().BootstrapDialog;
  if (!BootstrapDialog || typeof BootstrapDialog.show !== "function") return;
  const tags = allTags();
  if (!tags.length) {
    showInfoDialog({ title: "Share Tags", message: "You don't have any tags to share yet." });
    return;
  }

  const wrapper = document.createElement("div");
  const intro = document.createElement("p");
  intro.textContent = "Pick the tags to share. The code includes which cards each tag is on.";
  wrapper.appendChild(intro);
  const list = document.createElement("div");
  list.style.cssText = "max-height:260px;overflow-y:auto;";
  const boxes = tags.map(tag => {
    const row = document.createElement("label");
    row.style.cssText = "display:flex;align-items:center;gap:8px;padding:4px 0;font-weight:normal;cursor:pointer;";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = true;
    const dot = document.createElement("span");
    dot.style.cssText = `width:10px;height:10px;border-radius:50%;flex-shrink:0;background:${tag.color};`;
    const text = document.createElement("span");
    const n = countCards(tag.id);
    text.textContent = `${tag.name} (${n} card${n === 1 ? "" : "s"})`;
    row.append(box, dot, text);
    list.appendChild(row);
    return { tag, box };
  });
  wrapper.appendChild(list);
  const status = document.createElement("div");
  status.style.cssText = "margin-top:4px;min-height:1.2em;color:#f66;";
  wrapper.appendChild(status);

  BootstrapDialog.show({
    title: "Share Tags",
    message: wrapper,
    cssClass: "mono",
    buttons: [
      {
        label: "Create code",
        cssClass: "btn-primary",
        action: async d => {
          const ids = boxes.filter(b => b.box.checked).map(b => b.tag.id);
          if (!ids.length) { status.textContent = "Tick at least one tag."; return; }
          const payload = exportTags(ids);
          const code = await encodeCode(KIND, payload);
          d.close();
          const names = payload.tags.map(t => t.name).join(", ");
          showExportDialog({
            title: "Share Tags",
            intro: `Send this code to anyone with Wizascript. They can add these tags (${names}) with "Import…" in their own Manage Tags.`,
            code,
            fileName: "wizascript-card-tags.txt"
          });
        }
      },
      { label: "Cancel", action: d => d.close() }
    ]
  });
}

function listNames(names) {
  return names.length > 4 ? `${names.slice(0, 4).join(", ")} and ${names.length - 4} more` : names.join(", ");
}

// onImported() lets the caller redraw card dots / its own tag list.
export function openImportTagsDialog(onImported) {
  showImportDialog({
    title: "Import Tags",
    intro: "Paste a Card Tags code from a friend. Tags with the same name as one of yours are combined (keeping your colour); nothing of yours is removed.",
    actionLabel: "Import",
    onSubmit: async text => {
      const shared = await decodeCode(text, KIND);
      const result = importTags(shared);
      if (onImported) onImported();
      const lines = [];
      if (result.created.length) lines.push(`New tags: ${listNames(result.created)}.`);
      if (result.merged.length) lines.push(`Added to your existing tags: ${listNames(result.merged)}.`);
      lines.push(result.cardsTagged
        ? `${result.cardsTagged} card tag${result.cardsTagged === 1 ? "" : "s"} added.`
        : "You already had every card in this code tagged.");
      setTimeout(() => showInfoDialog({ title: "Tags imported", message: lines }), 0);
    }
  });
}
