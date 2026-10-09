// packages/misc/card-history/chat-codes.js
//
// Card History report codes ("#WZ1 CH 261008 161@28.0 ...") are hard to read,
// so for every Card History user a code in chat is shown as one short line,
// "⚑ Card History report (3)"; a click shows the code. Players without
// Wizascript see the plain code. Written bug reports ("#WZ1 v1.6.0: ...") are
// left as they are.
//
// Collecting the codes is the UC Report Hub's job (it reads the chat log);
// nothing here stores or sends anything.

import { parseCodes, hasCode } from "./report-codes.js";

function compact(root) {
  const scan = (el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const hits = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.parentElement && n.parentElement.closest(".wz-ch-chatcode")) continue;
      if (hasCode(n.nodeValue)) hits.push(n);
    }
    hits.forEach((n) => {
      const count = parseCodes(n.nodeValue).reduce((k, f) => k + f.items.length, 0);
      const span = document.createElement("span");
      span.className = "wz-ch-chatcode";
      span.textContent = `⚑ Card History report (${count})`;
      span.title = n.nodeValue.trim();
      span.dataset.code = n.nodeValue;
      span.addEventListener("click", () => { span.textContent = span.dataset.code; span.classList.add("wz-ch-chatcode-open"); });
      n.replaceWith(span);
    });
  };
  if (root.closest && root.closest(".chat-messages")) scan(root);
  else if (root.querySelectorAll) root.querySelectorAll(".chat-messages").forEach(scan);
}

let wired = false;
export function initChatCodes() {
  if (wired) return;
  wired = true;
  const start = () => {
    compact(document.body);
    new MutationObserver((muts) => {
      muts.forEach((mu) => mu.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.closest(".chat-messages") || n.querySelector(".chat-messages")) compact(n);
      }));
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
}
