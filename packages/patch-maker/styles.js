// CSS for the Patch Maker overlay - buttons, section/li styling,
// editor/viewer mode tinting. This was present in the original
// standalone script (injectPatchMakerStyle) but was missed when the
// script got split into overlay.js/formatting.js during the port.

export const PATCH_MAKER_CSS = `
html, body { overflow-x: hidden !important; }

#uc-patch-overlay {
  min-height: 100vh;
  max-width: 100vw;
  overflow-y: visible !important;
  overflow-x: visible !important;
}
#uc-patch-overlay > div { overflow-x: visible !important; }

#uc-patch-overlay li.buff   { border-left: 3px solid #00c800; }
#uc-patch-overlay li.rework { border-left: 3px solid gold; }
#uc-patch-overlay li.nerf   { border-left: 3px solid red; }
#uc-patch-overlay li.other  { border-left: 3px solid gray; }
#uc-patch-overlay li.none   { border-left: none !important; }

#uc-patch-overlay.editor-mode p  { background-color: rgba(255, 255, 0, 0.10); }
#uc-patch-overlay.editor-mode li { background-color: rgba(173,216,230,0.12); }

#uc-patch-overlay li {
  padding-left: 5px;
  border-radius: 3px;
  position: relative;
  margin: 10px 0;
  list-style-type: disc;
  font-size: 14px;
}

#uc-patch-overlay ul {
  margin-top: 0;
  margin-bottom: 10px;
  padding-left: 40px;
  list-style-position: outside;
}

#uc-patch-overlay p { position: relative; font-size: 14px; }

#uc-patch-overlay .uc-li-text:focus { outline: none; }
#uc-patch-overlay li:focus-within {
  outline: 2px solid white;
  outline-offset: 3px;
  border-radius: 4px;
}

#uc-patch-overlay .uc-collapse-btn {
  position: absolute;
  right: -38px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  background-color: #0099cc;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  opacity: 0.9;
}

#uc-patch-overlay .uc-section-del {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 3px;
  color: white;
  cursor: pointer;
  opacity: 0.9;
  right: -64px;
  background-color: #e74c3c;
}

#uc-patch-overlay .uc-section-label:focus {
  outline: 2px solid white;
  outline-offset: 2px;
}

#uc-patch-overlay .uc-add-section-row {
  margin: 0 0 10px 0;
  background-color: rgba(255, 255, 0, 0.10);
  padding: 0 6px;
  border-radius: 3px;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 24px;
}

#uc-patch-overlay .uc-add-section-btn {
  width: 20px;
  height: 20px;
  line-height: 20px;
  padding: 0;
  background-color: #2ecc71;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  text-align: center;
  font-size: 14px;
  font-weight: bold;
}

#uc-patch-overlay .uc-card-section {
  margin: 8px 0 28px 0;
}

#uc-patch-overlay .uc-card-toolbar {
  display: none;
}

#uc-patch-overlay .uc-card-add-tile {
  width: 176px;
  height: 246px;
  background-color: rgba(255, 255, 0, 0.10);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 3px;
  display: flex;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
  flex: 0 0 auto;
}

#uc-patch-overlay .uc-card-add-btn {
  width: 20px;
  height: 20px;
  line-height: 20px;
  padding: 0;
  background-color: #2ecc71;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  text-align: center;
  font-size: 14px;
  font-weight: bold;
}

#uc-patch-overlay .uc-card-gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: flex-start;
  min-height: 246px;
}

#uc-patch-overlay .uc-card-item {
  position: relative;
  display: inline-block;
  outline: none;
}

#uc-patch-overlay .uc-card-item:focus {
  outline: 2px solid white;
  outline-offset: 3px;
}

#uc-patch-overlay .uc-card-frame {
  width: 176px;
  height: 246px;
  overflow: hidden;
  background: #000;
}

#uc-patch-overlay .uc-card-frame img {
  width: 176px;
  height: 246px;
  display: block;
  image-rendering: auto;
}

#uc-patch-overlay .uc-card-del {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  line-height: 20px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background-color: #e74c3c;
  color: white;
  cursor: pointer;
  text-align: center;
  opacity: 0.95;
}

#uc-patch-overlay .uc-li-add,
#uc-patch-overlay .uc-li-del {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 3px;
  color: white;
  cursor: pointer;
  text-align: center;
  opacity: 0.9;
}

#uc-patch-overlay .uc-li-add { right: -38px; background-color: #2ecc71; }
#uc-patch-overlay .uc-li-del { right: -64px; background-color: #e74c3c; }
#uc-patch-overlay .uc-li-del:disabled {
  background-color: #777;
  opacity: 0.4;
  cursor: not-allowed;
}

#uc-patch-overlay.viewer-mode .uc-li-add,
#uc-patch-overlay.viewer-mode .uc-li-del,
#uc-patch-overlay.viewer-mode .uc-collapse-btn,
#uc-patch-overlay.viewer-mode .uc-section-del,
#uc-patch-overlay.viewer-mode .uc-add-section-row,
#uc-patch-overlay.viewer-mode .uc-card-toolbar,
#uc-patch-overlay.viewer-mode .uc-card-del,
#uc-patch-overlay.viewer-mode .uc-card-add-tile,
#uc-patch-overlay.viewer-mode .uc-card-add-btn {
  display: none !important;
}
#uc-patch-overlay.viewer-mode p,
#uc-patch-overlay.viewer-mode li {
  background-color: transparent !important;
}

.uc-skip { all: unset; }
`;

export function injectPatchMakerStyle() {
  if (document.getElementById("uc-patch-maker-style")) return;
  const style = document.createElement("style");
  style.id = "uc-patch-maker-style";
  style.textContent = PATCH_MAKER_CSS;
  document.head.appendChild(style);
}
