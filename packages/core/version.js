// Single source of truth for the suite version at runtime. build.js
// injects package.json's "version" field here via esbuild's `define`,
// so bumping package.json is the only place a release needs editing
// (the userscript header in build.js reads the same field).

/* global __WIZASCRIPT_VERSION__ */
export const SUITE_VERSION = __WIZASCRIPT_VERSION__;
