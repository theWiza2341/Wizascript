// packages/core/page-match.js
//
// Small shared helper for "should this feature even be doing
// anything on the current page" checks. Each feature previously wrote
// its own ad hoc `pathname.includes(...)` check, which is how Deck
// Tracker ended up silently also matching the Patch Notes page:
// /gameUpdates.jsp contains the substring "game", so
// `path.includes("game")` treated it as a game page too - meaning
// Deck Tracker's avatar-polling loop, "+" button, and event listeners
// were all running on a page that never has any of that DOM. The
// avatar poll in particular has no give-up condition, so that ran
// forever on every visit to the Patch Notes page.
//
// Two rule kinds:
//  - a plain string: exact match against the path (case-insensitive,
//    ignoring a trailing slash). Use this for any fixed page.
//  - { prefix }: the path must start with this. Only use prefix
//    matching when the real URL has a variable suffix glued directly
//    onto a fixed word with no separator (e.g. Spectate<sessionId>) -
//    anything else should be exact, since prefix matching on "game"
//    is exactly what let /game accidentally swallow /gameupdates.jsp.

function normalizePath(pathname) {
  const lower = pathname.toLowerCase();
  return lower.length > 1 && lower.endsWith("/") ? lower.slice(0, -1) : lower;
}

// rules: string | { prefix: string } | Array<string | { prefix: string }>
export function matchesPage(rules, pathname = location.pathname) {
  const path = normalizePath(pathname);
  const list = Array.isArray(rules) ? rules : [rules];
  return list.some((rule) =>
    typeof rule === "string"
      ? path === normalizePath(rule)
      : path.startsWith(rule.prefix.toLowerCase())
  );
}
