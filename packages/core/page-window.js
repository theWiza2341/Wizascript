// Resolves unsafeWindow vs window. Needed once GM_xmlhttpRequest (for
// True Hub Bridge) forces the whole bundle into a sandboxed context.

export function getPageWindow() {
  return typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
}

export function getPageGlobal(name) {
  return getPageWindow()[name];
}
