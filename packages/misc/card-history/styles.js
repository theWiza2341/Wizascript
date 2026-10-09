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
/* Reports: badge on a version, its right-click menu, the My Reports dialog. */
.wz-ch-reportable { position: relative; }
.wz-ch-badge { position: absolute; top: 32px; left: 6px; z-index: 6; width: 24px; height: 24px; line-height: 22px; text-align: center;
  font-size: 15px; border-radius: 50%; background: #000; color: #f5c542; border: 2px solid #f5c542; cursor: help; }
.wz-ch-badge.wz-ch-badge-mine { color: #ff6b6b; border-color: #ff6b6b; }
.wz-ch-art-list td.wz-ch-art-ver { position: relative; }
.wz-ch-art-list td.wz-ch-art-ver .wz-ch-badge { top: 2px; left: auto; right: 2px; width: 20px; height: 20px; line-height: 18px; font-size: 12px; }
.wz-ch-menu { position: fixed; z-index: 2000; list-style: none; margin: 0; padding: 4px 0; min-width: 220px; background: #000; color: #fff;
  border: 2px solid #fff; font-size: 14px; }
.wz-ch-menu header { padding: 4px 10px 6px; border-bottom: 1px solid #555; opacity: .85; }
.wz-ch-menu li { padding: 6px 10px; cursor: pointer; }
.wz-ch-menu li:hover { background: #333; }
.wz-ch-menu li.wz-ch-menu-off { cursor: default; opacity: .7; }
.wz-ch-menu li.wz-ch-menu-off:hover { background: none; }
.wz-ch-myreports-list { width: 100%; margin: 6px 0 10px; }
.wz-ch-myreports-list td { padding: 3px 6px; border-bottom: 1px solid #444; }
.wz-ch-myreports-opt { display: block; font-weight: normal; margin: 4px 0 8px; }
.wz-ch-myreports-btns { display: flex; gap: 8px; margin-bottom: 8px; }
.wz-ch-myreports-code { width: 100%; height: 70px; font-family: monospace; font-size: 11px; background: #111; color: #ddd; }
.wz-ch-codelines { margin: 8px 0; }
.wz-ch-codeline { display: flex; gap: 6px; margin-bottom: 4px; }
.wz-ch-codeline .wz-ch-code { flex: 1; font-family: monospace; font-size: 12px; background: #111; color: #ddd; border: 1px solid #555; padding: 2px 6px; }
.wz-ch-collect { margin-top: 12px; border-top: 1px solid #444; padding-top: 8px; }
.wz-ch-collect summary { cursor: pointer; opacity: .85; }
.wz-ch-chatcode { opacity: .75; font-style: italic; cursor: pointer; }
.wz-ch-chatcode.wz-ch-chatcode-open { font-style: normal; font-family: monospace; cursor: text; word-break: break-all; }
.wz-ch-dim { opacity: .7; font-size: 12px; }
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
