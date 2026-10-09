// packages/misc/card-history/shell.js
//
// The history window opens straight away with "Loading..." and a step line,
// and the history replaces it when it's ready (the data can take a moment).

import { dialogApi } from "./game.js";
import { openMyReports, onReportsChanged, repaintAll, unsentCount, closeReportMenu } from "./reports.js";

const reportsLabel = () => { const n = unsentCount(); return n ? `My Reports (${n})` : "My Reports"; };

export function openShell(title, wikiUrl) {
  const box = document.createElement("div");
  box.className = "wz-ch-loading";
  box.innerHTML = '<div class="wz-ch-loading-title">Loading...</div><div class="wz-ch-step"></div>';
  const state = { url: wikiUrl, shown: false, onShown: null };
  const api = dialogApi();
  // Badges and the button follow reports made in this window or in My Reports.
  let off = null;
  if (api) {
    api.BD.show({
      title,
      size: api.BD.SIZE_WIDE,
      message: api.$(box),
      onshown: () => { state.shown = true; if (state.onShown) state.onShown(); },
      onhidden: () => { if (off) off(); closeReportMenu(); },
      buttons: [
        { id: "wz-ch-myreports-btn", label: reportsLabel(), action: () => openMyReports() },
        { label: "Open on the wiki", action: () => window.open(state.url, "_blank", "noopener") },
        { label: "Close", cssClass: "btn-primary", action: (d) => d.close() }
      ]
    });
  } else {
    document.body.appendChild(box);
    state.shown = true;
  }
  off = onReportsChanged(() => {
    repaintAll(box);
    const b = document.getElementById("wz-ch-myreports-btn");
    if (b) b.textContent = reportsLabel();
  });
  return {
    step(text) { const el = box.querySelector(".wz-ch-step"); if (el) el.textContent = text; },
    fill(node, fit, url) {
      if (url) state.url = url;
      box.className = "";
      box.replaceChildren(node);
      if (!fit) return;
      const run = () => { fit(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit); setTimeout(fit, 400); };
      if (state.shown) run(); else state.onShown = run;
    },
    fail(err) {
      const t = box.querySelector(".wz-ch-loading-title");
      if (t) t.textContent = "Couldn't load the history.";
      this.step(String(err && err.message ? err.message : err));
    }
  };
}
