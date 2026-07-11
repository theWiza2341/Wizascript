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
        if (res.status !== 200) {
          // A non-200 response here almost always means either the
          // repo is private (raw.githubusercontent.com 404s rather
          // than 403s for private repos when unauthenticated) or
          // bot/decks.json doesn't exist on main yet. Fails loudly
          // here instead of letting JSON.parse choke on an HTML/plain-
          // text error page and produce a confusing parse error.
          reject(new Error(
            `Failed to fetch decks.json (HTTP ${res.status}). ` +
            `Check that the repo is public and bot/decks.json exists on main.`
          ));
          return;
        }
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
