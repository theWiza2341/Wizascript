// packages/card-maker/editors.js
//
// The community card editors the Card Maker can show. Both are other
// people's sites, loaded as they are (from their own servers) inside the
// Card Maker's window, with their authors' permission.

export const EDITORS = {
  feildmaster: {
    label: "feildmaster's Template Editor",
    url: "https://undercard.feildmaster.com/",
    origin: "https://undercard.feildmaster.com"
  },
  sernon: {
    label: "UC Editor (sernon158)",
    url: "https://sernon158.github.io/uc-editor/",
    origin: "https://sernon158.github.io"
  }
};

export const DEFAULT_EDITOR = "feildmaster";

// The setting stores the label players see; these map between the two.
export const EDITOR_LABELS = Object.values(EDITORS).map((e) => e.label);

export function editorForLabel(label) {
  return Object.keys(EDITORS).find((k) => EDITORS[k].label === label) || DEFAULT_EDITOR;
}

// Messages from the small part of Wizascript that runs inside
// feildmaster's editor (frame.js) carry this tag.
export const FRAME_MESSAGE = "wizascript-card-maker";
