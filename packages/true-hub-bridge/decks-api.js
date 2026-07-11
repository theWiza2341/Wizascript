// Fetches the deck list JSON produced by bot/bot.js and
// bot/new-only-sync.js. Kept separate from overlay.js so the overlay
// module stays focused on DOM/rendering rather than owning network
// fetch too.
//
// NOTE: this URL points at bot/decks.json in THIS repo (Wizascript),
// not the original standalone UC-True-Hub-Integrator repo - decks.json
// now lives inside bot/ per the monorepo layout, not at repo root.

const DECKS_URL =
  "https://raw.githubusercontent.com/theWiza2341/Wizascript/refs/heads/main/bot/decks.json";

export function loadDecks() {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: "GET",
      url: DECKS_URL,
      onload(res) {
        try {
          const raw = JSON.parse(res.responseText);
          resolve(Array.isArray(raw) ? raw : (raw.decks || []));
        } catch (e) {
          reject(e);
        }
      },
      onerror(err) {
        reject(err);
      }
    });
  });
}
