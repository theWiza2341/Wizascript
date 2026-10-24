const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const pkg = require("./package.json");

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
    // CHANGELOG.md is imported as a plain string, and assets/logo.png as
    // an embedded data: URL (both used by packages/core/about.js), so the
    // installed script needs no network request for either.
    loader: { ".md": "text", ".png": "dataurl" },
    define: {
      __WIZASCRIPT_VERSION__: JSON.stringify(pkg.version)
    }
  });

  const bundled = result.outputFiles[0].text;
  const outPath = path.join(__dirname, "wizascript.user.js");
  const header = HEADER;
  fs.writeFileSync(outPath, header + bundled, "utf-8");
  console.log(`Built ${outPath} (${(header + bundled).length} bytes)`);
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
