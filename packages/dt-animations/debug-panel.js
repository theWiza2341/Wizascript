// packages/dt-animations/debug-panel.js
//
// Small floating test panel, shown in matches only while "Debug mode" is
// on. Replaces the old Q/E/R test keybinds: DT Animations no longer
// registers anything in Wizascript's shared Keybinds category, so it
// stays fully self-contained on its own settings page (and Ctrl+R no
// longer doubles as "reload the page").

const PANEL_ID = "wiza-dt-debug-panel";

export function createDebugPanel({ animations, debugApi, openSettings }) {
  let panel = null;
  let statusTimer = null;

  function build() {
    panel = document.createElement("div");
    panel.id = PANEL_ID;
    Object.assign(panel.style, {
      position: "fixed",
      left: "8px",
      bottom: "8px",
      zIndex: "1000010", // above every animation layer
      background: "rgba(0,0,0,0.85)",
      border: "1px solid #666",
      borderRadius: "4px",
      padding: "6px 8px",
      color: "#ddd",
      font: "12px sans-serif",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      userSelect: "none"
    });

    const title = document.createElement("div");
    title.textContent = "DT Animations - debug";
    title.style.color = "#8ab4f8";
    title.style.fontWeight = "bold";

    const select = document.createElement("select");
    animations.forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.name;
      select.appendChild(opt);
    });

    // Optional second picker: the selected animation's variants (styles,
    // individual clips...). Hidden when the animation offers none.
    const variantRow = document.createElement("div");
    Object.assign(variantRow.style, { display: "flex", gap: "4px" });
    const variantSelect = document.createElement("select");
    variantSelect.style.maxWidth = "220px";
    variantSelect.title = "What Play should show (defaults to the current settings)";
    const reloadBtn = document.createElement("button");
    reloadBtn.type = "button";
    reloadBtn.textContent = "\u21bb";
    reloadBtn.title = "Reload the list (e.g. after pushing new clips)";
    Object.assign(reloadBtn.style, { font: "12px sans-serif", padding: "1px 6px", cursor: "pointer" });
    variantRow.append(variantSelect, reloadBtn);
    variantRow.hidden = true;

    let loadSeq = 0;
    async function loadVariants(refresh) {
      const seq = ++loadSeq;
      const id = select.value;
      const list = await debugApi.variants(id, { refresh });
      if (seq !== loadSeq) return; // a newer load won
      const keep = variantSelect.value;
      variantSelect.innerHTML = "";
      const def = document.createElement("option");
      def.value = "";
      def.textContent = "(use settings)";
      variantSelect.appendChild(def);
      list.forEach(({ label, value }) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        variantSelect.appendChild(opt);
      });
      if ([...variantSelect.options].some((o) => o.value === keep)) variantSelect.value = keep;
      variantRow.hidden = list.length === 0;
    }
    select.addEventListener("change", () => loadVariants(false));
    reloadBtn.addEventListener("click", () => loadVariants(true));
    loadVariants(false);

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "4px";
    const button = (label, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      Object.assign(b.style, { font: "12px sans-serif", padding: "1px 6px", cursor: "pointer" });
      b.addEventListener("click", fn);
      row.appendChild(b);
    };
    button("Play", () => debugApi.play(select.value, variantSelect.value));
    button("React", () => debugApi.react(select.value));
    button("End", () => debugApi.reset(select.value));
    button("Stop all", () => debugApi.forceStop());
    button("⚙", () => openSettings());

    const status = document.createElement("div");
    status.style.color = "#aaa";

    panel.append(title, select, variantRow, row, status);
    document.body.appendChild(panel);

    const refresh = () => {
      const cur = debugApi.current();
      status.textContent = cur
        ? `now: ${cur.id} (owner ${cur.ownerId})${cur.ending ? " - ending" : ""}`
        : "now: idle";
    };
    refresh();
    statusTimer = setInterval(refresh, 250);
  }

  return {
    show() {
      if (panel && panel.isConnected) return;
      if (!document.body) return;
      build();
    },
    hide() {
      if (statusTimer) clearInterval(statusTimer);
      statusTimer = null;
      if (panel) panel.remove();
      panel = null;
    }
  };
}
