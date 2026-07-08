const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const HEADER = `// ==UserScript==
// @name         Wizascript
// @namespace    https://github.com/theWiza2341/Wizascript
// @version      0.1.0
// @description  All-in-one UnderScript plugin suite for Undercards.
// @author       TheWiza2341
// @match        https://undercards.net/*
// @match        https://*.undercards.net/*
// @icon         https://i.imgur.com/qKHDfnB.png
// @updateURL    https://raw.githubusercontent.com/theWiza2341/Wizascript/refs/heads/main/wizascript.user.js
// @downloadURL  https://raw.githubusercontent.com/theWiza2341/Wizascript/refs/heads/main/wizascript.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// ==/UserScript==

`;

async function build() {
  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, "manifest.js")],
    bundle: true,
    format: "iife",
    target: "es2019",
    write: false,
    logLevel: "info"
  });

  const bundled = result.outputFiles[0].text;
  const outPath = path.join(__dirname, "wizascript.user.js");
  fs.writeFileSync(outPath, HEADER + bundled, "utf-8");
  console.log(`Built ${outPath} (${(HEADER + bundled).length} bytes)`);
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
