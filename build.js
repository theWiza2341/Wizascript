const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const pkg = require("./package.json");
const STRESS_TABS = Number(process.env.WIZASCRIPT_STRESS_TABS) || 0;

// Version comes from package.json - the only place a release needs editing.
const HEADER = `// ==UserScript==
// @name         Wizascript
// @namespace    https://github.com/theWiza2341/Wizascript
// @version      ${pkg.version}
// @description  All-in-one UnderScript plugin suite for Undercards.
// @author       TheWiza2341
// @match        https://undercards.net/*
// @match        https://*.undercards.net/*
// @icon         https://i.imgur.com/FOIUHej.png
// @updateURL    https://raw.githubusercontent.com/theWiza2341/Wizascript/refs/heads/main/wizascript.user.js
// @downloadURL  https://raw.githubusercontent.com/theWiza2341/Wizascript/refs/heads/main/wizascript.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// ==/UserScript==

`;

async function build() {
  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, "manifest.js")],
    bundle: true,
    format: "iife",
    target: "es2019",
    write: false,
    logLevel: "info",
    // CHANGELOG.md is imported as a plain string (packages/core/about.js).
    loader: { ".md": "text" },
    define: {
      __WIZASCRIPT_VERSION__: JSON.stringify(pkg.version),
      // Dev-only: WIZASCRIPT_STRESS_TABS=12 node build.js adds 12 dummy
      // plugin tabs for testing the tab row (packages/core/stress-test.js).
      __WIZASCRIPT_STRESS_TABS__: String(STRESS_TABS)
    }
  });

  const bundled = result.outputFiles[0].text;
  // A stress-test build must never overwrite the real script.
  const outPath = path.join(__dirname, STRESS_TABS ? "wizascript-stress-test.user.js" : "wizascript.user.js");
  // Stress-test builds drop the auto-update URLs so Tampermonkey never
  // swaps them for the published script mid-test.
  const header = STRESS_TABS
    ? HEADER.replace(/^\/\/ @(updateURL|downloadURL).*\n/gm, "")
    : HEADER;
  fs.writeFileSync(outPath, header + bundled, "utf-8");
  console.log(`Built ${outPath} (${(header + bundled).length} bytes)`);
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
