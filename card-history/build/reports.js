#!/usr/bin/env node
// card-history/build/reports.js
//
// Pulls Wizascript's reports from the UC Report Hub (reports/WZ/ in the hub
// repo, set in card-history/hub.json) and writes:
//
//   card-history/reports.json  versions to mark with a ⚠ for every player:
//                              reported by at least `minPlayers` different
//                              players, or listed in `confirmed`; never the ones
//                              in `ignored` (fixed, or not a bug)
//   card-history/reports.md    the catalogue: every reported version, and every
//                              written bug report (Report a Bug), newest first
//
// Run by the "Card History reports" workflow every 6 hours, after the hub's
// run. By hand:  node card-history/build/reports.js [--from <folder with index.json>]
//
// Hub payloads (after "#WZ1 "):
//   CH 261008 161@28.0 20@PA Apowerband@-2.0   Card History versions
//   v1.6.0: <text>                             a written bug report

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return fallback; } };
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };

const CH_RE = /^CH (\d{6})((?: (?:A[a-z0-9]+|\d+)@[A-Za-z0-9.?-]+)+)\s*$/;
const PROMPT = "<describe the bug here>";

async function getText(base, file) {
  if (!/^https?:/.test(base)) { const f = path.join(base, file); return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null; }
  const res = await fetch(base + file, { headers: { "Cache-Control": "no-cache" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${base}${file}: HTTP ${res.status}`);
  return res.text();
}

// "161@28.0" -> { key: "c:161:28.0", kind, id, label }
function item(token) {
  const at = token.lastIndexOf("@");
  const who = token.slice(0, at);
  let label = token.slice(at + 1);
  label = label === "now" ? "today" : label.replace(/^-/, "<");
  const kind = who[0] === "A" ? "a" : "c";
  const id = kind === "a" ? who.slice(1) : who;
  return { key: `${kind}:${id}:${label}`, kind, id, label };
}

function nameOf(kind, id) {
  const f = path.join(ROOT, "data", kind === "a" ? "artifacts" : "cards", `${id}.json`);
  const d = readJson(f, null);
  return (d && d.name) || (kind === "a" ? id : `card ${id}`);
}

const cell = (s) => String(s == null ? "" : s).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

async function main() {
  const cfg = readJson(path.join(ROOT, "hub.json"), {});
  const from = arg("from");
  if (!from && !cfg.repo) { console.log("hub.json has no \"repo\" yet: nothing to pull."); return; }
  const tag = cfg.tag || "WZ";
  const base = from ? path.resolve(from) : `https://raw.githubusercontent.com/${cfg.repo}/${cfg.branch || "main"}/reports/${tag}/`;
  const minPlayers = cfg.minPlayers || 2;
  const confirmed = new Set(cfg.confirmed || []);
  const ignored = new Set(cfg.ignored || []);

  const index = JSON.parse((await getText(base, "index.json")) || '{"files":[]}');
  const versions = new Map();
  const bugs = [];
  let read = 0;
  for (const { file } of index.files || []) {
    const text = (await getText(base, file)) || "";
    text.split("\n").filter(Boolean).forEach((line) => {
      let r;
      try { r = JSON.parse(line); } catch (e) { return; }
      read++;
      const payload = String(r.payload || "");
      const ch = payload.match(CH_RE);
      if (ch) {
        ch[2].trim().split(" ").forEach((t) => {
          const it = item(t);
          let e = versions.get(it.key);
          if (!e) { e = { ...it, players: new Set(), names: new Map(), builds: new Set(), first: r.at, last: r.at }; versions.set(it.key, e); }
          e.players.add(String(r.from).toLowerCase());
          if (!e.names.has(String(r.from).toLowerCase())) e.names.set(String(r.from).toLowerCase(), r.from);
          e.builds.add(ch[1]);
          if (r.at < e.first) e.first = r.at;
          if (r.at > e.last) e.last = r.at;
        });
        return;
      }
      // A written bug report: skip the untouched prompt and near-empty ones.
      const m = payload.match(/^v([\d.]+[a-z0-9.-]*):\s*(.*)$/i);
      const body = (m ? m[2] : payload).trim();
      if (body.includes(PROMPT) || body.replace(/[^A-Za-z]/g, "").length < 6) return;
      bugs.push({ at: r.at, from: r.from, version: m ? m[1] : "", text: body, id: r.id });
    });
  }

  // reports.json: what players see as ⚠
  const items = {};
  [...versions.values()].forEach((e) => {
    if (ignored.has(e.key)) return;
    if (e.players.size >= minPlayers || confirmed.has(e.key)) items[e.key] = { n: e.players.size, first: e.first.slice(0, 10), last: e.last.slice(0, 10) };
  });
  confirmed.forEach((k) => { if (!items[k] && !ignored.has(k)) items[k] = { n: 0 }; });
  fs.writeFileSync(path.join(ROOT, "reports.json"), `${JSON.stringify({ items }, null, 1)}\n`);

  // reports.md: the catalogue
  const rows = [...versions.values()].sort((a, b) => b.players.size - a.players.size || b.last.localeCompare(a.last));
  const md = [
    "# Card History reports",
    "",
    `Built from the UC Report Hub (\`${from ? "local" : cfg.repo}\`, tag ${tag}) by \`build/reports.js\`. Don't edit by hand: settings are in \`hub.json\`.`,
    "",
    `A version gets a ⚠ for every player once ${minPlayers} different players report it, or when its key is in \`confirmed\`. Put a key in \`ignored\` once it's fixed or isn't a bug.`,
    "",
    `${read} reports read: ${rows.length} versions reported, ${bugs.length} written bug reports.`,
    "",
    "## Card History",
    ""
  ];
  if (rows.length) {
    md.push("| Card / artifact | Version | Players | ⚠ | Last | Data builds | Reported by | Key |", "|---|---|---|---|---|---|---|---|");
    rows.forEach((e) => {
      const flag = ignored.has(e.key) ? "ignored" : items[e.key] ? "⚠" : "";
      md.push(`| ${cell(nameOf(e.kind, e.id))} | ${cell(e.label)} | ${e.players.size} | ${flag} | ${e.last.slice(0, 10)} | ${cell([...e.builds].sort().join(", "))} | ${cell([...e.names.values()].slice(0, 5).join(", "))}${e.names.size > 5 ? " …" : ""} | \`${cell(e.key)}\` |`);
    });
  } else md.push("None yet.");
  md.push("", "## Bug reports (Report a Bug)", "");
  if (bugs.length) {
    md.push("| When | From | Version | Report |", "|---|---|---|---|");
    bugs.sort((a, b) => b.at.localeCompare(a.at)).forEach((b) => md.push(`| ${b.at.slice(0, 16).replace("T", " ")} | ${cell(b.from)} | ${cell(b.version)} | ${cell(b.text)} |`));
  } else md.push("None yet.");
  fs.writeFileSync(path.join(ROOT, "reports.md"), `${md.join("\n")}\n`);
  console.log(`${read} reports read: ${rows.length} versions (${Object.keys(items).length} with ⚠), ${bugs.length} bug reports.`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
