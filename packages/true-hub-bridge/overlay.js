import { getPageWindow } from "../core/page-window.js";
import { ORDERED_CHANNEL_OVERRIDES } from "./channel-overrides.js";
import {
  decodeDeck,
  determineImageFromDeck,
  getArtifactById,
  getPlayableCards,
  isCardInList,
  addCardToFilter,
  removeCardFromFilter,
  filterDecks
} from "./deck-filter.js";

const DECKS_PER_PAGE = 10;

const SOUL_COLORS = {
  DETERMINATION: "red",
  PATIENCE: "#41fcff",
  BRAVERY: "#fca500",
  INTEGRITY: "#0064ff",
  PERSEVERANCE: "#d535d9",
  KINDNESS: "#00c000",
  JUSTICE: "#ffff00"
};

export function createTrueHubOverlay({ logger, getAutoOpen, getScrollPaging }) {
  let allDecks = [];
  let filteredDecks = [];
  let currentPage = 1;
  let mode = "classic";
  let includeCards = [];
  let excludeCards = [];

  let originalDecks = null;
  let template = null;
  let trueHubWrapper = null;
  let trueHubList = null;
  let trueHubNavEl = null;

  let selectPage = null, currentPageEl = null, maxPageEl = null, btnPrevious = null, btnNext = null;
  let ucNavRow = null;

  let classicState = null;
  let activeSoulFilter = null;
  let activeSearch = "";

  let cardFilterPanel = null, cardSearchInput = null, cardDropdown = null, cardTagsContainer = null;

  function setDecks(decks) {
    allDecks = Array.isArray(decks) ? decks : [];
    allDecks.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
    filteredDecks = [...allDecks];
    logger.log("data", "Decks loaded.", { count: allDecks.length });
  }

  function applyFilters() {
    filteredDecks = filterDecks(allDecks, { activeSoulFilter, activeSearch, includeCards, excludeCards });
    currentPage = 1;
    renderPage();
  }

  function waitForHub(cb) {
    const check = () => {
      const hub = document.getElementById("hubDecks");
      const tmpl = hub?.querySelector(".hubDeck");
      if (hub && tmpl) cb(hub, tmpl);
      else setTimeout(check, 200);
    };
    check();
  }

  function buildCard(deck) {
    const clone = template.cloneNode(true);

    const nameEl = clone.querySelector(".hubDeckName div");
    if (nameEl) {
      const decoded = decodeDeck(deck.deckCode);
      nameEl.textContent = (deck.channel || "Unknown")
        .replace(/-/g, " ")
        .replace(/\b\w/g, l => l.toUpperCase());
      if (decoded?.soul && SOUL_COLORS[decoded.soul]) {
        nameEl.style.color = SOUL_COLORS[decoded.soul];
      }
    }

    const ownerEl = clone.querySelector(".hubDeckOwner");
    if (ownerEl) {
      const img = ownerEl.querySelector("img");
      if (img) img.remove();
      ownerEl.textContent = deck.author || "Unknown";
      ownerEl.style.textAlign = "center";
    }

    const imageEl = clone.querySelector(".hubDeckImage img");
    if (imageEl) {
      const channel = (deck.channel || "").toLowerCase();
      let imageName = null;
      for (const [term, card] of ORDERED_CHANNEL_OVERRIDES) {
        if (channel.includes(term.toLowerCase())) { imageName = card; break; }
      }
      if (!imageName) imageName = determineImageFromDeck(deck.deckCode);
      if (imageName) imageEl.src = `images/cards/${imageName}.png`;
    }

    const artifactContainer = clone.querySelector(".hubDeckArtifacts");
    if (artifactContainer) {
      artifactContainer.innerHTML = "";
      try {
        const decoded = decodeDeck(deck.deckCode);
        const artifacts = (decoded?.artifactIds || [])
          .map(id => getArtifactById(id))
          .filter(Boolean);

        artifacts.forEach((artifact, index) => {
          const img = document.createElement("img");
          img.src = `images/artifacts/${artifact.image}.png`;
          img.title = artifact.name;
          artifactContainer.appendChild(img);
          if (index < artifacts.length - 1) artifactContainer.append(" ");
        });
      } catch (err) {
        logger.error("card", "Artifact decode failed", err, deck);
      }
    }

    const archetypeEl = clone.querySelector(".hubDeckArchetype div");
    if (archetypeEl) archetypeEl.textContent = deck.season || "s??";

    const likesEl = clone.querySelector(".hubDeckLikes");
    if (likesEl) {
      const wins = deck.record?.wins ?? "-";
      likesEl.innerHTML = `<span style="color:#0dd000">${wins}</span>`;
    }

    const starEl = clone.querySelector(".hubDeckStar");
    if (starEl) {
      const losses = deck.record?.losses ?? "-";
      starEl.innerHTML = `<span style="color:#f0003c">${losses}</span>`;
    }

    const diffEl = clone.querySelector(".hubDeckDifficulty");
    if (diffEl) {
      diffEl.innerHTML = "";
      const btn = document.createElement("button");
      btn.textContent = "Info";
      Object.assign(btn.style, {
        background: "#7a0000",
        border: "1px solid #f0003c",
        color: "white",
        padding: "3px 8px",
        cursor: "pointer",
        opacity: "0.85"
      });
      btn.onclick = e => { e.stopPropagation(); showInfo(deck); };
      diffEl.appendChild(btn);
    }

    const previewButton = clone.querySelector(".show-button");
    if (previewButton) {
      previewButton.removeAttribute("onclick");
      previewButton.onclick = e => {
        e.preventDefault();
        e.stopPropagation();

        const code = deck.deckCode;
        const published = deck.publishedAt || new Date().toISOString();

        const script = document.createElement("script");
        script.textContent = `
          try {
            if (typeof showDeckLoadHub === "function") {
              showDeckLoadHub(${JSON.stringify(code)}, ${JSON.stringify(published)});
            } else {
              console.error("[TrueHub] showDeckLoadHub unavailable.");
            }
          } catch (err) {
            console.error("[TrueHub] Preview failed:", err);
          }
        `;
        document.documentElement.appendChild(script);
        script.remove();
      };
    }

    return clone;
  }

  function renderPage() {
    trueHubList.innerHTML = "";
    const start = (currentPage - 1) * DECKS_PER_PAGE;
    const visible = filteredDecks.slice(start, start + DECKS_PER_PAGE);
    visible.forEach(deck => trueHubList.appendChild(buildCard(deck)));
    syncNav();
  }

  // ---- card filter panel ----

  function buildCardFilterPanel() {
    cardFilterPanel = document.createElement("div");
    cardFilterPanel.id = "th-card-filter-panel";
    Object.assign(cardFilterPanel.style, {
      display: "none",
      width: "100%",
      boxSizing: "border-box",
      margin: "0 0 6px 0",
      padding: "10px 12px",
      background: "#1a1a1a",
      border: "1px solid #444",
      borderRadius: "4px"
    });

    const searchRow = document.createElement("div");
    Object.assign(searchRow.style, { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" });

    cardSearchInput = document.createElement("input");
    cardSearchInput.type = "text";
    cardSearchInput.placeholder = "Search cards to filter...";
    cardSearchInput.className = "form-control";
    Object.assign(cardSearchInput.style, { width: "100%", boxSizing: "border-box", fontSize: "13px" });

    searchRow.appendChild(cardSearchInput);
    cardFilterPanel.appendChild(searchRow);

    cardDropdown = document.createElement("div");
    cardDropdown.id = "th-card-dropdown";
    Object.assign(cardDropdown.style, {
      background: "#222",
      border: "1px solid #555",
      borderRadius: "4px",
      maxHeight: "150px",
      overflowY: "auto",
      marginBottom: "8px",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: "0"
    });
    cardDropdown.style.display = "none";
    cardFilterPanel.appendChild(cardDropdown);

    cardTagsContainer = document.createElement("div");
    cardTagsContainer.id = "th-card-tags";
    Object.assign(cardTagsContainer.style, { display: "flex", flexWrap: "wrap", gap: "6px", minHeight: "24px" });
    cardFilterPanel.appendChild(cardTagsContainer);

    cardSearchInput.addEventListener("input", () => {
      const term = cardSearchInput.value.trim().toLowerCase();
      if (!term) {
        cardDropdown.style.display = "none";
        cardDropdown.innerHTML = "";
        return;
      }

      const playable = getPlayableCards();
      const matches = playable.filter(c => c.name && c.name.toLowerCase().includes(term)).slice(0, 30);

      cardDropdown.innerHTML = "";
      if (matches.length === 0) { cardDropdown.style.display = "none"; return; }
      cardDropdown.style.display = "grid";

      matches.forEach(card => {
        const row = document.createElement("div");
        Object.assign(row.style, {
          display: "flex", alignItems: "center", gap: "5px", padding: "4px 8px",
          fontSize: "12px", color: "#eee", borderBottom: "1px solid #2a2a2a",
          borderRight: "1px solid #2a2a2a", overflow: "hidden"
        });

        const inInclude = isCardInList(includeCards, card.id);
        const inExclude = isCardInList(excludeCards, card.id);

        const nameSpan = document.createElement("span");
        nameSpan.textContent = card.name;
        Object.assign(nameSpan.style, {
          flex: "1", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap", color: inInclude ? "#4ade80" : inExclude ? "#f87171" : "#eee"
        });

        const btnGroup = document.createElement("div");
        Object.assign(btnGroup.style, { display: "flex", gap: "4px", flexShrink: "0" });

        const btnInclude = document.createElement("button");
        btnInclude.textContent = "+ Inc";
        Object.assign(btnInclude.style, {
          background: "#14532d", border: "1px solid #4ade80", color: "#4ade80",
          padding: "1px 5px", cursor: "pointer", fontSize: "10px", borderRadius: "3px", whiteSpace: "nowrap"
        });
        btnInclude.onclick = e => {
          e.stopPropagation();
          addCardToFilter(includeCards, excludeCards, card);
          applyFilters();
          renderCardFilterTags();
          cardSearchInput.value = "";
          cardDropdown.style.display = "none";
          cardDropdown.innerHTML = "";
        };

        const btnExclude = document.createElement("button");
        btnExclude.textContent = "− Exc";
        Object.assign(btnExclude.style, {
          background: "#450a0a", border: "1px solid #f87171", color: "#f87171",
          padding: "1px 5px", cursor: "pointer", fontSize: "10px", borderRadius: "3px", whiteSpace: "nowrap"
        });
        btnExclude.onclick = e => {
          e.stopPropagation();
          addCardToFilter(excludeCards, includeCards, card);
          applyFilters();
          renderCardFilterTags();
          cardSearchInput.value = "";
          cardDropdown.style.display = "none";
          cardDropdown.innerHTML = "";
        };

        btnGroup.appendChild(btnInclude);
        btnGroup.appendChild(btnExclude);
        row.appendChild(nameSpan);
        row.appendChild(btnGroup);
        cardDropdown.appendChild(row);
      });
    });

    document.addEventListener("click", e => {
      if (!cardFilterPanel.contains(e.target)) cardDropdown.style.display = "none";
    });

    return cardFilterPanel;
  }

  function renderCardFilterTags() {
    if (!cardTagsContainer) return;
    cardTagsContainer.innerHTML = "";

    const makeTag = (card, color, borderColor, list) => {
      const tag = document.createElement("span");
      Object.assign(tag.style, {
        display: "inline-flex", alignItems: "center", gap: "5px", padding: "2px 8px",
        background: color, border: `1px solid ${borderColor}`, borderRadius: "3px",
        fontSize: "12px", color: "#fff", whiteSpace: "nowrap"
      });
      tag.textContent = card.name;

      const x = document.createElement("span");
      x.textContent = "×";
      Object.assign(x.style, { cursor: "pointer", fontWeight: "bold", marginLeft: "2px", lineHeight: "1" });
      x.onclick = () => {
        removeCardFromFilter(list, card.id);
        applyFilters();
        renderCardFilterTags();
      };
      tag.appendChild(x);
      return tag;
    };

    includeCards.forEach(c => cardTagsContainer.appendChild(makeTag(c, "#14532d", "#4ade80", includeCards)));
    excludeCards.forEach(c => cardTagsContainer.appendChild(makeTag(c, "#450a0a", "#f87171", excludeCards)));

    if (includeCards.length === 0 && excludeCards.length === 0) {
      const hint = document.createElement("span");
      hint.textContent = "No card filters active.";
      hint.style.cssText = "font-size:12px; color:#777; font-style:italic;";
      cardTagsContainer.appendChild(hint);
    }
  }

  // ---- nav toolbar ----

  function buildTrueHubNav() {
    ucNavRow = btnPrevious?.closest("tr, nav, .row, thead") || btnPrevious?.parentElement;

    const nav = document.createElement("div");
    nav.id = "truehub-nav";
    Object.assign(nav.style, { display: "none", margin: "8px 0", fontFamily: "inherit", boxSizing: "border-box", width: "100%" });

    const toolbar = document.createElement("div");
    toolbar.id = "th-toolbar";
    Object.assign(toolbar.style, {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      width: "100%", boxSizing: "border-box", padding: "0", margin: "0 0 6px 0"
    });

    const leftControls = document.createElement("div");
    Object.assign(leftControls.style, { display: "flex", alignItems: "center", gap: "10px" });

    const searchBox = document.createElement("input");
    searchBox.id = "th-search";
    searchBox.type = "text";
    searchBox.placeholder = "Search decks...";
    searchBox.className = "form-control";
    Object.assign(searchBox.style, { width: "180px", padding: "4px 8px" });
    leftControls.appendChild(searchBox);

    const originalSoulSelect = document.getElementById("selectSouls");
    if (originalSoulSelect) {
      const soulSelect = originalSoulSelect.cloneNode(true);
      soulSelect.id = "th-select-souls";

      const noneOption = soulSelect.querySelector('option[value=""]');
      if (noneOption) { noneOption.textContent = "Filter: Soul"; noneOption.selected = true; }

      function updateSoulClass() {
        Object.keys(SOUL_COLORS).forEach(soul => soulSelect.classList.remove(soul));
        if (soulSelect.value) soulSelect.classList.add(soulSelect.value);
      }

      soulSelect.addEventListener("change", () => {
        updateSoulClass();
        activeSoulFilter = soulSelect.value || null;
        applyFilters();
      });

      leftControls.appendChild(soulSelect);
    }

    toolbar.appendChild(leftControls);

    const cardFilterBtn = document.createElement("button");
    cardFilterBtn.id = "th-card-filter-btn";
    cardFilterBtn.textContent = "Card Filter";
    cardFilterBtn.className = "btn btn-default";
    Object.assign(cardFilterBtn.style, {
      padding: "4px 16px", whiteSpace: "nowrap", background: "#0e1a30",
      border: "1px solid #1e3a60", color: "#4a7aaa"
    });
    cardFilterBtn.onclick = () => {
      const isOpen = cardFilterPanel.style.display !== "none";
      cardFilterPanel.style.display = isOpen ? "none" : "block";
      if (!isOpen) { cardSearchInput.focus(); renderCardFilterTags(); }
    };
    toolbar.appendChild(cardFilterBtn);

    const pagerGroup = document.createElement("div");
    Object.assign(pagerGroup.style, { display: "flex", alignItems: "center", gap: "6px" });

    const btnPrev = document.createElement("button");
    btnPrev.id = "th-btn-prev";
    btnPrev.className = "btn btn-primary";
    btnPrev.disabled = true;
    btnPrev.innerHTML = "&#10094;";

    const pageSelect = document.createElement("select");
    pageSelect.id = "th-select-page";

    const slash = document.createElement("span");
    slash.textContent = "/";

    const maxPage = document.createElement("span");
    maxPage.id = "th-max-page";
    maxPage.textContent = "1";

    const btnNext2 = document.createElement("button");
    btnNext2.id = "th-btn-next";
    btnNext2.className = "btn btn-primary";
    btnNext2.innerHTML = "&#10095;";

    pagerGroup.appendChild(btnPrev);
    pagerGroup.appendChild(pageSelect);
    pagerGroup.appendChild(slash);
    pagerGroup.appendChild(maxPage);
    pagerGroup.appendChild(btnNext2);

    toolbar.appendChild(pagerGroup);
    nav.appendChild(toolbar);

    nav.appendChild(buildCardFilterPanel());

    if (ucNavRow) ucNavRow.insertAdjacentElement("afterend", nav);
    else originalDecks.insertAdjacentElement("beforebegin", nav);

    searchBox.addEventListener("input", () => {
      activeSearch = searchBox.value;
      applyFilters();
    });

    btnPrev.onclick = () => {
      if (currentPage <= 1) return;
      currentPage--;
      renderPage();
    };

    btnNext2.onclick = () => {
      const total = Math.ceil(filteredDecks.length / DECKS_PER_PAGE);
      if (currentPage >= total) return;
      currentPage++;
      renderPage();
    };

    pageSelect.onchange = e => {
      currentPage = Number(e.target.value) + 1;
      renderPage();
    };

    trueHubNavEl = nav;
  }

  function syncNav() {
    const total = Math.max(1, Math.ceil(filteredDecks.length / DECKS_PER_PAGE));

    const thSelect = document.getElementById("th-select-page");
    const thMax = document.getElementById("th-max-page");
    const thPrev = document.getElementById("th-btn-prev");
    const thNext = document.getElementById("th-btn-next");

    if (!thSelect || !thMax || !thPrev || !thNext) return;

    thSelect.innerHTML = "";
    for (let i = 1; i <= total; i++) {
      const opt = document.createElement("option");
      opt.value = i - 1;
      opt.textContent = i;
      if (i === currentPage) opt.selected = true;
      thSelect.appendChild(opt);
    }

    thMax.textContent = total;
    thPrev.disabled = (currentPage <= 1);
    thNext.disabled = (currentPage >= total);
  }

  function enableTrueHubNav() {
    if (ucNavRow) ucNavRow.style.display = "none";
    if (trueHubNavEl) {
      const gridWidth = trueHubWrapper.offsetWidth || originalDecks.offsetWidth;
      if (gridWidth > 0) {
        trueHubNavEl.style.width = gridWidth + "px";
        trueHubNavEl.style.maxWidth = gridWidth + "px";
        if (cardFilterPanel) {
          cardFilterPanel.style.width = "100%";
          cardFilterPanel.style.maxWidth = "100%";
        }
      }
      trueHubNavEl.style.display = "";
    }
  }

  function restoreClassicNav() {
    if (trueHubNavEl) trueHubNavEl.style.display = "none";
    if (ucNavRow) ucNavRow.style.display = "";

    if (!classicState) return;

    const liveSelect = document.getElementById("selectPage");
    const livePrev = document.getElementById("btnPrevious");
    const liveNext = document.getElementById("btnNext");
    const liveCur = document.getElementById("currentPage");
    const liveMax = document.getElementById("maxPage");

    if (liveSelect) liveSelect.innerHTML = classicState.selectHTML;
    if (liveCur) liveCur.textContent = classicState.currentPage;
    if (liveMax) liveMax.textContent = classicState.maxPage;
    if (livePrev) livePrev.disabled = classicState.prevDisabled;
    if (liveNext) liveNext.disabled = classicState.nextDisabled;
  }

  // ---- info popup ----

  function cleanNotes(notes) {
    if (!notes) return "No description available.";
    return notes
      .replace(/\\n/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/ {2,}/g, " ")
      .split("\n")
      .filter(line => !line.trim().toLowerCase().startsWith("creator"))
      .filter(line => !/https?:\/\//i.test(line))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function showInfo(deck) {
    const msg = cleanNotes(deck.notes);

    // FIX: original checked bare `window.BootstrapDialog` first - same
    // sandboxing gap fixed in Patch Maker's help dialog. This script
    // grants GM_xmlhttpRequest, so it's sandboxed the same way.
    const BootstrapDialogRef = getPageWindow().BootstrapDialog;

    if (BootstrapDialogRef?.alert) {
      BootstrapDialogRef.alert({ title: deck.channel || "Deck Info", message: msg });
    } else {
      alert(msg);
    }
  }

  // ---- classic/true hub toggle ----

  function buildToggle() {
    const wrap = document.createElement("div");
    wrap.style.cssText = "text-align:center; margin:20px 0;";
    wrap.innerHTML = `<button id="truehub-switch" class="btn btn-primary">Switch to True Hub</button>`;

    trueHubWrapper.insertAdjacentElement("afterend", wrap);

    document.getElementById("truehub-switch").onclick = () => {
      const btn = document.getElementById("truehub-switch");

      if (mode === "classic") {
        if (!classicState) {
          classicState = {
            selectHTML: selectPage.innerHTML,
            currentPage: currentPageEl.textContent,
            maxPage: maxPageEl.textContent,
            prevDisabled: btnPrevious.disabled,
            nextDisabled: btnNext.disabled
          };
        }

        originalDecks.style.display = "none";
        trueHubWrapper.style.display = "";

        currentPage = 1;
        enableTrueHubNav();
        renderPage();

        btn.textContent = "Switch to Classic Hub";
        mode = "true";
        logger.log("mode", "Switched to True Hub view.");
      } else {
        trueHubWrapper.style.display = "none";
        originalDecks.style.display = "";

        restoreClassicNav();

        btn.textContent = "Switch to True Hub";
        mode = "classic";
        logger.log("mode", "Switched to Classic Hub view.");
      }
    };
  }

  // ---- init ----

  function init() {
    waitForHub((hub, tmpl) => {
      originalDecks = hub;
      template = tmpl;

      selectPage = document.getElementById("selectPage");
      currentPageEl = document.getElementById("currentPage");
      maxPageEl = document.getElementById("maxPage");
      btnPrevious = document.getElementById("btnPrevious");
      btnNext = document.getElementById("btnNext");

      if (!selectPage || !btnPrevious || !btnNext) {
        logger.error("init", "Could not find nav elements.");
        return;
      }

      const style = document.createElement("style");
      style.textContent = `
        #truehub-list .hubDeck { margin-right: 10px; margin-bottom: 10px; }
        #th-card-dropdown::-webkit-scrollbar { width: 6px; }
        #th-card-dropdown::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }
      `;
      document.head.appendChild(style);

      trueHubWrapper = document.createElement("div");
      trueHubWrapper.id = "truehub-wrapper";
      trueHubWrapper.style.display = "none";

      trueHubList = originalDecks.cloneNode(false);
      trueHubList.id = "truehub-list";

      trueHubList.addEventListener("wheel", e => {
        if (!getScrollPaging()) return;
        if (mode !== "true") return;
        e.preventDefault();

        const totalPages = Math.max(1, Math.ceil(filteredDecks.length / DECKS_PER_PAGE));

        if (e.deltaY > 0) {
          if (currentPage < totalPages) { currentPage++; renderPage(); }
        } else if (e.deltaY < 0) {
          if (currentPage > 1) { currentPage--; renderPage(); }
        }
      }, { passive: false });

      trueHubWrapper.appendChild(trueHubList);
      originalDecks.insertAdjacentElement("afterend", trueHubWrapper);

      buildTrueHubNav();
      buildToggle();

      if (getAutoOpen()) {
        const toggleBtn = document.getElementById("truehub-switch");
        logger.log("init", "Auto-opening True Hub view.");
        if (toggleBtn) toggleBtn.click();
      }

      logger.log("init", "Ready.", { decksLoaded: allDecks.length });
    });
  }

  return { init, setDecks };
}
