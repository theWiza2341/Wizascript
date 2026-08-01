// packages/patch-maker/new-cards.js

const TARGET_W = 176;
const TARGET_H = 246;
const FIELDMARKER_WATERMARK_CROP_PX = 14;

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
function loadImageFromDataURL(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}
async function normalizeCardImage(dataUrl) {
  const img = await loadImageFromDataURL(dataUrl);
  if (img.naturalWidth === TARGET_W && img.naturalHeight === TARGET_H) {
    return dataUrl;
  }
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
  if (img.naturalWidth === 163 && img.naturalHeight >= 250) {
    sh = Math.max(1, img.naturalHeight - FIELDMARKER_WATERMARK_CROP_PX);
  }
  const canvas = document.createElement("canvas");
  canvas.width = TARGET_W;
  canvas.height = TARGET_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, TARGET_W, TARGET_H);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, TARGET_W, TARGET_H);
  return canvas.toDataURL("image/png");
}

export function createNewCardsFeature({ isViewerMode: isViewerMode2, saveState }) {
  function ensureCardAddTile(section) {
    const gallery = section.querySelector(".uc-card-gallery");
    if (!gallery) return null;
    let addTile = gallery.querySelector(":scope > .uc-card-add-tile");
    if (addTile) {
      gallery.appendChild(addTile);
      return addTile;
    }
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.multiple = true;
    fileInput.style.display = "none";
    addTile = document.createElement("div");
    addTile.className = "uc-card-add-tile";
    const addBtn = document.createElement("button");
    addBtn.className = "uc-card-add-btn";
    addBtn.textContent = "+";
    addBtn.title = "Add card image";
    addBtn.onclick = () => {
      if (isViewerMode2()) return;
      fileInput.click();
    };
    fileInput.addEventListener("change", async (e) => {
      const files = [...e.target.files || []];
      if (!files.length) return;
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const dataUrl = await readFileAsDataURL(file);
        const normalized = await normalizeCardImage(dataUrl);
        addCardImage(section, normalized, file.name || "Card image");
      }
      fileInput.value = "";
      ensureCardAddTile(section);
      saveState();
    });
    addTile.appendChild(addBtn);
    addTile.appendChild(fileInput);
    gallery.appendChild(addTile);
    return addTile;
  }
  function addCardImage(section, src, name = "Card image") {
    const gallery = section.querySelector(".uc-card-gallery");
    if (!gallery) return null;
    ensureCardAddTile(section);
    const item = document.createElement("div");
    item.className = "uc-card-item";
    item.tabIndex = 0;
    item.dataset.src = src;
    item.dataset.name = name;
    const frame = document.createElement("div");
    frame.className = "uc-card-frame";
    const img = document.createElement("img");
    img.src = src;
    img.alt = name;
    frame.appendChild(img);
    item.appendChild(frame);
    const delBtn = document.createElement("button");
    delBtn.className = "uc-card-del";
    delBtn.textContent = "\u2212";
    delBtn.title = "Remove card image";
    delBtn.onclick = (e) => {
      if (isViewerMode2()) return;
      e.stopPropagation();
      item.remove();
      ensureCardAddTile(section);
      saveState();
    };
    item.appendChild(delBtn);
    // The old hardcoded Shift+Arrow keydown listener that used to
    // live here has been removed - moving a card tile is now handled
    // by the shared keybind registry's "Move Card Up/Down" bindings
    // (scoped to .uc-card-item), registered once in overlay.js via
    // this feature's exposed moveCardItem, rather than a separate
    // fixed-key listener attached per tile.
    const addTile = gallery.querySelector(":scope > .uc-card-add-tile");
    if (addTile) gallery.insertBefore(item, addTile);
    else gallery.appendChild(item);
    ensureCardAddTile(section);
    return item;
  }
  function moveCardItem(item, dir) {
    const gallery = item.parentElement;
    if (!gallery) return;
    const items = [...gallery.querySelectorAll(":scope > .uc-card-item")];
    const idx = items.indexOf(item);
    if (idx < 0 || items.length <= 1) return;
    const newIdx = (idx + dir + items.length) % items.length;
    const target = items[newIdx];
    if (dir < 0) {
      if (idx === 0) gallery.appendChild(item);
      else gallery.insertBefore(item, target);
    } else {
      if (idx === items.length - 1) gallery.insertBefore(item, items[0]);
      else gallery.insertBefore(item, target.nextElementSibling);
    }
    ensureCardAddTile(gallery.parentElement);
    saveState();
    setTimeout(() => item.focus(), 0);
  }
  function createSection(container) {
    const p = document.createElement("p");
    p.className = "uc-new-cards-header";
    const label = document.createElement("span");
    label.textContent = "New cards";
    p.appendChild(label);
    const section = document.createElement("div");
    section.className = "uc-card-section";
    const gallery = document.createElement("div");
    gallery.className = "uc-card-gallery";
    section.appendChild(gallery);
    const collapseBtn = document.createElement("button");
    collapseBtn.className = "uc-collapse-btn";
    collapseBtn.textContent = "\u2212";
    collapseBtn.onclick = () => {
      if (isViewerMode2()) return;
      const collapsed = section.style.display === "none";
      section.style.display = collapsed ? "" : "none";
      collapseBtn.textContent = collapsed ? "\u2212" : "+";
      saveState();
    };
    p.appendChild(collapseBtn);
    container.appendChild(p);
    container.appendChild(section);
    ensureCardAddTile(section);
    return { p, section, gallery };
  }
  function collectState(container) {
    const header = container.querySelector("p.uc-new-cards-header");
    const section = header ? header.nextElementSibling : null;
    if (!header || !section) return { collapsed: false, cards: [] };
    return {
      collapsed: section.style.display === "none",
      cards: [...section.querySelectorAll(".uc-card-item")].map((item) => ({
        src: item.dataset.src || "",
        name: item.dataset.name || "Card image"
      })).filter((card) => card.src)
    };
  }
  function restoreState(container, newCards) {
    const header = container.querySelector("p.uc-new-cards-header");
    const section = header ? header.nextElementSibling : null;
    if (!header || !section) return;
    const btn = header.querySelector(".uc-collapse-btn");
    section.style.display = newCards && newCards.collapsed ? "none" : "";
    if (btn) btn.textContent = newCards && newCards.collapsed ? "+" : "\u2212";
    const gallery = section.querySelector(".uc-card-gallery");
    if (gallery) gallery.innerHTML = "";
    ensureCardAddTile(section);
    (newCards && newCards.cards || []).forEach((card) => {
      if (card && card.src) addCardImage(section, card.src, card.name || "Card image");
    });
    ensureCardAddTile(section);
  }
  // moveCardItem is now exposed - overlay.js registers the "Move Card
  // Up/Down" keybinds and calls this directly, since it's created
  // right here in this same closure and there's no reason to route
  // it through a separate cross-file import.
  return { createSection, collectState, restoreState, moveCardItem };
}
