// packages/misc/card-history/styles.js

const STYLE_ID = "wizascript-card-history-style";

const CSS = `
.wz-ch-loading { min-height: 140px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
.wz-ch-loading-title { font-size: 20px; }
.wz-ch-step { font-size: 13px; opacity: .75; }
.wz-ch-foot { clear: both; margin-top: 10px; font-size: 12px; opacity: .85; }

.wz-ch-art-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.wz-ch-art-head img { max-height: 48px; image-rendering: pixelated; }
.wz-ch-art-title { font-size: 18px; }
.wz-ch-art-list { width: 100%; border-collapse: collapse; }
.wz-ch-art-list td { border: 2px solid #fff; padding: 6px 10px; vertical-align: middle; background: #000; color: #fff; }
.wz-ch-art-list td.wz-ch-art-ver { width: 90px; text-align: center; font-size: 18px; white-space: nowrap; cursor: default; }
.wz-ch-art-list td.wz-ch-art-rar { width: 120px; text-align: center; white-space: nowrap; }
.wz-ch-art-list td.wz-ch-art-txt { font-size: 14px; line-height: 1.35; text-align: left; }
.wz-ch-art-oldname { opacity: .75; margin-right: 6px; }
/* A .cardDesc (for the game's card-text colours) laid out as plain text. */
.wz-ch-art-list .cardDesc.wz-ch-art-desc { position: static !important; width: auto !important; height: auto !important; top: auto !important;
  left: auto !important; margin: 0 !important; padding: 0 !important; display: block !important; text-align: left !important;
  font-size: 14px !important; line-height: 1.35; }
.wz-ch-art-list .cardDesc.wz-ch-art-desc > div { font-size: 14px !important; }
`;

export function injectCardHistoryStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement("style");
  st.id = STYLE_ID;
  st.textContent = CSS;
  (document.head || document.documentElement).appendChild(st);
}
