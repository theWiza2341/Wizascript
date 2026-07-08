// Shared by bot.js and new-only-sync.js: extractDeckCode, extractRecord,
// extractCreator, resolveUser, fetchAllMessages. Single source of truth
// so the two scripts can't drift apart on season-matching or author
// fallback logic the way the originals did.
