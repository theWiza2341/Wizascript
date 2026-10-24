// Resolves unsafeWindow vs window. Needed once GM_xmlhttpRequest (for
// True Hub Bridge) forces the whole bundle into a sandboxed context.
// Since 1.6.2 the header asks for @sandbox raw (run in the page), where
// unsafeWindow === window; this still covers Tampermonkey versions or
// managers that ignore that request and sandbox us anyway.

export function getPageWindow() {
  return typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
}

export function getPageGlobal(name) {
  return getPageWindow()[name];
}
