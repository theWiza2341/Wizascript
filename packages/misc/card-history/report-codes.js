// packages/misc/card-history/report-codes.js
//
// Report codes: plain text, so players can paste them in Undercards chat
// (250 characters at most, no links) or a Discord channel.
//
//   WZR1 261008 161@28.0 20@PA Apowerband@108.0 40@now
//   |    |      |                |
//   |    |      card id@version  artifact: "A" + its file name@version
//   |    the data build the player saw (yymmdd)
//   format 1
//
// Version labels are the ones the window shows ("28.0", "A2.7", "PA", "?"),
// with "now" for today's card and "-" for "<" ("<1.6" -> "-1.6").
// Found by the 2026-10-08 chat probe: the chat cuts messages at 250
// characters without warning, keeps letters, digits and @ : . - ? unchanged,
// and drops messages with links.

export const CHAT_MAX = 250;
const HEAD = "WZR1";

const encLabel = (label) => (label === "today" ? "now" : String(label).replace(/^</, "-").replace(/[^A-Za-z0-9.?-]/g, ""));
const decLabel = (label) => (label === "now" ? "today" : label.replace(/^-/, "<"));

export const token = (r) => `${r.kind === "a" ? `A${r.id}` : r.id}@${encLabel(r.label)}`;

export function buildDate(builtAt) {
  const m = String(builtAt || "").match(/^\d{2}(\d{2})-(\d{2})-(\d{2})/);
  return m ? m[1] + m[2] + m[3] : "000000";
}

// Reports -> chat lines of at most 250 characters, grouped by data build.
//   [{ line, reports }]  (the reports each line holds)
export function encodeLines(reports) {
  const byDate = new Map();
  reports.forEach((r) => {
    const d = buildDate(r.built);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(r);
  });
  const out = [];
  byDate.forEach((list, d) => {
    let cur = { line: `${HEAD} ${d}`, reports: [] };
    list.forEach((r) => {
      const t = token(r);
      if (cur.reports.length && cur.line.length + 1 + t.length > CHAT_MAX) { out.push(cur); cur = { line: `${HEAD} ${d}`, reports: [] }; }
      cur.line += ` ${t}`;
      cur.reports.push(r);
    });
    out.push(cur);
  });
  return out;
}

const CODE_RE = /\bWZR1 (\d{6})((?: (?:A[a-z0-9]+|\d+)@[A-Za-z0-9.?-]+)+)/g;

// Any text (a chat message, a pasted Discord channel) -> the reports in it.
//   [{ line, date, items: [{ key, kind, id, label }] }]
export function parseCodes(text) {
  const out = [];
  String(text || "").replace(CODE_RE, (line, date, rest) => {
    const items = rest.trim().split(" ").map((t) => {
      const at = t.lastIndexOf("@");
      const who = t.slice(0, at);
      const label = decLabel(t.slice(at + 1));
      const kind = who[0] === "A" ? "a" : "c";
      const id = kind === "a" ? who.slice(1) : who;
      return { key: `${kind}:${id}:${label}`, kind, id, label };
    });
    out.push({ line, date, items });
    return line;
  });
  return out;
}

export const hasCode = (text) => { CODE_RE.lastIndex = 0; return CODE_RE.test(String(text || "")); };
export { CODE_RE };
