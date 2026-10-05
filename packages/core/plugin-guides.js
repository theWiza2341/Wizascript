// packages/core/plugin-guides.js
//
// Short "How to use" guides, so a player who found Wizascript through
// UnderScript's plugin list can discover the parts that aren't obvious
// from the settings alone (right-clicking cards for Card Tags, holding
// Primary for UC TV's channel guide, ...). Each guide says which pages
// the plugin works on, what it does, and its inputs - kept to a few
// lines on purpose.
//
// Shown in two places:
//  - a box at the very bottom of the plugin's own settings tab;
//  - a small "?" next to each toggle in the Plugins / Miscellaneous
//    lists, which opens the same guide in a popup. That's the only way
//    in for Notepad and Card Tags (they have no tab of their own), and
//    it lets players read what a plugin does BEFORE turning it on.
//
// Keyboard shortcuts are shown with the player's CURRENT keys (read
// when the settings screen renders), so a remap is reflected next time
// settings are opened.

import { PLUGINS, isPluginEnabled } from "./plugins.js";
import { createFeatureSettings } from "./settings.js";
import { registerSettingWidget } from "./setting-widgets.js";
import { describeKeybind, getPrimaryKeyDisplay } from "./keybinds.js";
import { bindingToDisplay } from "../controller/gamepad.js";
import { getPageWindow } from "./page-window.js";

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// Current key for a shortcut, e.g. "Ctrl + O" (or a note if unbound).
function key(bindingKey, defaultCode) {
  const d = describeKeybind(bindingKey, defaultCode);
  return d ? `<b>${esc(d)}</b>` : "<i>(unbound - set it on the Keybinds tab)</i>";
}
const primary = () => `<b>${esc(getPrimaryKeyDisplay())}</b>`;
const pad = (i) => `<b>${esc(bindingToDisplay(i))}</b>`;

// tab: the plugin's settings tab, or null if it has none.
const GUIDES = {
  patchMaker: {
    tab: "Patch Maker",
    pages: "the Patch Notes page",
    summary: "Write your own patch notes, formatted like the real ones.",
    points: () => [
      'Click <b>Show Custom Patch Notes</b> at the top of the page, then add balance changes, sections and New Cards (with your own card images).',
      '<b>Switch to Viewer Mode</b> shows the result formatted like an official patch. The <b>Help</b> button lists the formatting codes (e.g. {card names}, [[switch effects]]).',
      `While editing an entry: ${key("cycleCategoryUp", "Comma")} / ${key("cycleCategoryDown", "Period")} changes its balance category, and ${key("moveEntryUp", "ArrowUp")} / ${key("moveEntryDown", "ArrowDown")} moves the selected entry, section or card.`,
      'Everything saves automatically. Double-click <b>Reset Data</b> to start over.'
    ]
  },
  trueHub: {
    tab: "True Hub Bridge",
    pages: "the Hub page",
    summary: "Browse a much bigger library of community decks, collected from the True Hub Discord.",
    points: () => [
      'Use <b>Switch to True Hub</b> / <b>Switch to Classic Hub</b> to swap between deck lists (True Hub opens by itself unless Auto Open is off).',
      'Filter by Soul, or open <b>Card Filter</b> to require (<b>+ Inc</b>) or exclude (<b>− Exc</b>) specific cards.',
      '<b>Info</b> shows the author\'s notes. The preview button opens the deck like any other Hub deck.',
      'Change pages with the arrows, or scroll the mouse wheel over the list (Scroll Paging).'
    ]
  },
  cardTracker: {
    tab: "Card Tracker",
    pages: "your matches and while spectating",
    summary: "On-screen counters you update yourself. Nothing is counted automatically.",
    points: () => [
      'Click the <b>+</b> next to your avatar to add a tracker: a built-in one, or your own with <b>Custom Tracker</b>. The picker\'s <b>Help</b> button explains the icons.',
      'On a tracker: <b>left-click</b> +1, <b>right-click</b> −1, <b>middle-click</b> resets to 0. Drag it to move it, drag its corner to resize, <b>×</b> closes it.',
      '<b>♥</b> a tracker in the picker to have it load automatically every match.',
      'Drag the <b>+</b> itself to move it; middle-click it to put it back.'
    ]
  },
  ucTv: {
    tab: "UC TV",
    pages: "spectate pages",
    summary: "Channel-surf between live matches while you spectate.",
    points: () => [
      `${key("previousChannel", "ArrowLeft")} / ${key("nextChannel", "ArrowRight")} jumps to the previous / next live match.`,
      `<b>Hold</b> ${primary()} to open the Channel Guide, then click a player to watch them. Let go to close it.`,
      `Auto-mode (above) moves on to another match by itself when the current one ends. Tap ${primary()} to cancel the countdown.`,
      'Match Filtering (above) limits which matches you surf to, by game mode, player level and rank.'
    ]
  },
  controller: {
    tab: "Controller Support",
    pages: "every page",
    summary: "Play and navigate Undercards with a gamepad.",
    points: () => [
      `Left stick moves a cursor. ${pad(0)} clicks, ${pad(3)} right-clicks, ${pad(1)} goes back. Right stick: left/right changes cursor speed, up/down scrolls.`,
      'The d-pad steps through menus, dialogs, settings and your hand/board. Text boxes open an on-screen keyboard.',
      `Hold Controller Primary for the combos listed above; In-Game Inputs need just one press. In Settings, ${pad(4)} / ${pad(5)} switch tabs.`,
      'To change a binding, click it and press a button (or a key); Esc unbinds. Up to 3 presets. Controller not responding? Try <b>Detect Controller</b> at the top.'
    ]
  },
  notepad: {
    tab: null,
    pages: "every page",
    summary: "A drawing notepad you can keep on screen.",
    points: () => [
      '<b>Draw</b>, <b>Erase</b> or <b>Fill</b>; pick colours on the wheel and apply them to the pen or the paper. Up to 6 layers (the dashed <b>+</b> adds one; double-click the top layer\'s number to remove it).',
      'Drag the title bar to move it. Click the name to rename it. <b>Save PNG</b> uses the name as the filename.',
      `${key("toggleNotepad", "KeyO")} shows/hides it, ${key("undoNotepad", "KeyZ")} / ${key("redoNotepad", "KeyY")} undo/redo, ${key("resetNotepad", "KeyN")} resets it (including its position).`,
      'Your drawing, colours, name and position are saved between visits.'
    ]
  },
  cardTags: {
    tab: null,
    pages: "the Crafting and Decks pages",
    summary: "Your own labels for cards, like \"Wincon\" or \"Draw\".",
    points: () => [
      '<b>Right-click a card</b> to create a tag or switch one on/off for that card.',
      'Tagged cards show coloured dots. Type a tag\'s name into the search bar to show only cards with that tag.',
      '<b>Manage Tags…</b> (in the right-click menu) renames, recolours and deletes tags, and can <b>Share…</b> / <b>Import…</b> tags with friends.'
    ]
  },
  tierList: {
    tab: "Tier List",
    pages: "every page, including matches",
    summary: "Rank cards, souls and artifacts in your own tier lists.",
    points: () => [
      `${key("toggleTierList", "KeyL")} shows/hides the window. Drag its title bar to move it, its edges to resize it; <b>□</b> fills the screen.`,
      'Pick <b>Cards</b>, <b>Souls</b>, <b>Artifacts</b> or <b>Text</b> in the bottom panel, then drag items into a tier. With Card Tags on, the card search also finds your tags. On Crafting/Decks you can drag cards straight from the page.',
      'Click a tier\'s label (or <b>⚙</b>) to edit it. Drag an item back to the panel to unrank it. Rest the mouse on a card to see it in full.',
      '<b>Lists ▾</b> switches or adds lists, and <b>Share…</b> / <b>Import…</b> swaps them with friends as codes. Saves automatically; <b>↶</b> undoes.'
    ]
  }
};

function pluginName(id) {
  const p = PLUGINS.find((x) => x.id === id);
  return p ? p.name : id;
}

export function guideHtml(id) {
  const g = GUIDES[id];
  if (!g) return "";
  return `<div style="opacity:.8;margin-bottom:4px">Works on ${esc(g.pages)}.</div>`
    + `<div style="margin-bottom:4px">${g.summary}</div>`
    + `<ul style="margin:0;padding-left:18px">${g.points().map((p) => `<li style="margin:2px 0">${p}</li>`).join("")}</ul>`;
}

const BOX_STYLE = "flex-basis:100%;margin-top:6px;padding:8px 10px;border:1px solid #555;border-radius:4px;"
  + "background:rgba(255,255,255,0.04);font-size:0.95em;line-height:1.4;white-space:normal;";

function openGuideDialog(id) {
  const BootstrapDialog = getPageWindow().BootstrapDialog;
  if (!BootstrapDialog || typeof BootstrapDialog.show !== "function") return;
  const note = isPluginEnabled(id) ? "" : `<div style="margin-top:8px;opacity:.7">Turn it on in the list, then reload the page, to use it.</div>`;
  BootstrapDialog.show({
    title: `How to use ${pluginName(id)}`,
    message: `<div style="white-space:normal">${guideHtml(id)}${note}</div>`,
    buttons: [{ label: "Close", cssClass: "btn-primary", action: (d) => d.close() }]
  });
}

export function registerPluginGuides(plugin) {
  Object.entries(GUIDES).forEach(([id, g]) => {
    // Box at the bottom of the plugin's own tab. The Controller Support
    // tab uses categories, so its guide gets its own last category there.
    if (g.tab) {
      const categorised = g.tab === "Controller Support";
      const settings = createFeatureSettings(plugin, "guide", {
        tab: g.tab,
        visible: () => isPluginEnabled(id),
        categories: categorised
      });
      settings.add(id, {
        name: `How to use ${pluginName(id)}`,
        type: "text",
        default: "",
        category: "About"
      });
      registerSettingWidget(`guide.${id}`, (el) => {
        el.readOnly = true;
        el.tabIndex = -1;
        el.style.display = "none";
        const row = el.closest(".flex-start");
        if (!row) return;
        const label = row.querySelector("label");
        if (label) label.style.fontWeight = "bold";
        const box = document.createElement("div");
        box.className = "wizascript-guide";
        box.style.cssText = BOX_STYLE;
        box.innerHTML = guideHtml(id);
        row.appendChild(box);
      });
    }

    // "?" next to the plugin's toggle on the General tab.
    const toggle = PLUGINS.find((p) => p.id === id);
    if (!toggle) return;
    registerSettingWidget(toggle.key, (el) => {
      const row = el.closest(".flex-start");
      const label = row && row.querySelector("label");
      if (!label || row.querySelector(".wizascript-guide-link")) return;
      const link = document.createElement("a");
      link.href = "#";
      link.className = "wizascript-guide-link";
      link.textContent = "?";
      link.title = `How to use ${pluginName(id)}`;
      link.setAttribute("role", "button");
      link.style.cssText = "margin-left:6px;display:inline-block;width:16px;height:16px;line-height:14px;text-align:center;"
        + "border:1px solid #888;border-radius:50%;font-size:11px;color:#ccc;text-decoration:none;";
      link.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); openGuideDialog(id); });
      label.insertAdjacentElement("afterend", link);
    });
  });
}
