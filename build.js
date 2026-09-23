const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------
// Release channel
// ---------------------------------------------------------------
// stable (default): version from package.json, updates from main.
// dev (`node build.js --dev`, or WIZA_CHANNEL=dev): updates from the dev
// branch, and gets a timestamped version so Tampermonkey sees every dev
// build as newer than the last one. Same @name/@namespace on purpose -
// a dev install REPLACES the stable one instead of running alongside it
// (two copies would double-register the plugin).
const pkg = require("./package.json");
const CHANNEL =
  process.argv.includes("--dev") || process.env.WIZA_CHANNEL === "dev" ? "dev" : "stable";
const BRANCH = CHANNEL === "dev" ? "dev" : "main";
const DEV_BASE_VERSION = "1.5.0"; // bump when dev starts targeting a new release

function devStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}

const VERSION = CHANNEL === "dev" ? `${DEV_BASE_VERSION}.${devStamp()}` : pkg.version;
const RAW_BASE = `https://raw.githubusercontent.com/theWiza2341/Wizascript/refs/heads/${BRANCH}/`;
const DOWNLOAD_URL = `${RAW_BASE}wizascript.user.js`;
// Runtime-fetched binary assets (see packages/core/assets.js) follow the
// same branch, so dev builds can use assets that only exist on dev yet.
const ASSET_BASE = `${RAW_BASE}assets/`;
const DESCRIPTION =
  CHANNEL === "dev"
    ? "All-in-one UnderScript plugin suite for Undercards. [DEV BUILD - unstable, from the dev branch]"
    : "All-in-one UnderScript plugin suite for Undercards.";

const HEADER = `// ==UserScript==
// @name         Wizascript
// @namespace    https://github.com/theWiza2341/Wizascript
// @version      ${VERSION}
// @description  ${DESCRIPTION}
// @author       TheWiza2341
// @match        https://undercards.net/*
// @match        https://*.undercards.net/*
// @icon         https://i.imgur.com/FOIUHej.png
// @updateURL    ${DOWNLOAD_URL}
// @downloadURL  ${DOWNLOAD_URL}
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// ==/UserScript==

`;

// ---------------------------------------------------------------
// DT Animations auto-discovery
// ---------------------------------------------------------------
// `import x from "virtual:dt-animations"` resolves to a generated module
// that imports every animation under packages/dt-animations/animations/:
//   animations/<name>.js          or
//   animations/<name>/index.js    (for animations that grow extra files)
// Files/folders starting with "_" are skipped (drafts, shared helpers).
// Adding a DT = drop the file in and rebuild. Sorted, so settings order
// is stable (alphabetical by file name).
const ANIMATIONS_DIR = path.join(__dirname, "packages", "dt-animations", "animations");

function discoverAnimations() {
  if (!fs.existsSync(ANIMATIONS_DIR)) return [];
  return fs.readdirSync(ANIMATIONS_DIR, { withFileTypes: true })
    .filter((e) => !e.name.startsWith("_") && !e.name.startsWith("."))
    .map((e) => {
      if (e.isFile() && e.name.endsWith(".js")) return e.name;
      if (e.isDirectory() && fs.existsSync(path.join(ANIMATIONS_DIR, e.name, "index.js"))) {
        return `${e.name}/index.js`;
      }
      return null;
    })
    .filter(Boolean)
    .sort();
}

const dtAnimationsPlugin = {
  name: "dt-animations-discovery",
  setup(build) {
    build.onResolve({ filter: /^virtual:dt-animations$/ }, () => ({
      path: "dt-animations",
      namespace: "dt-animations"
    }));
    build.onLoad({ filter: /.*/, namespace: "dt-animations" }, () => {
      const files = discoverAnimations();
      const imports = files.map((f, i) => `import m${i} from ${JSON.stringify("./" + f)};`).join("\n");
      const list = files.map((f, i) => `{ source: ${JSON.stringify(f)}, module: m${i} }`).join(",\n  ");
      console.log(`[build] DT animations: ${files.length ? files.join(", ") : "(none)"}`);
      return {
        contents: `${imports}\nexport default [\n  ${list}\n];\n`,
        resolveDir: ANIMATIONS_DIR,
        loader: "js",
        watchDirs: [ANIMATIONS_DIR]
      };
    });
  }
};

async function build() {
  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, "manifest.js")],
    bundle: true,
    format: "iife",
    target: "es2019",
    write: false,
    logLevel: "info",
    plugins: [dtAnimationsPlugin],
    define: {
      __WIZASCRIPT_VERSION__: JSON.stringify(VERSION),
      __WIZASCRIPT_DOWNLOAD_URL__: JSON.stringify(DOWNLOAD_URL),
      __WIZASCRIPT_ASSET_BASE__: JSON.stringify(ASSET_BASE)
    }
  });

  const bundled = result.outputFiles[0].text;
  const outPath = path.join(__dirname, "wizascript.user.js");
  fs.writeFileSync(outPath, HEADER + bundled, "utf-8");
  console.log(`Built ${outPath} [${CHANNEL} ${VERSION}] (${(HEADER + bundled).length} bytes)`);
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
