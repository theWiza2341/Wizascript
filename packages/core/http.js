// packages/core/http.js
//
// One way to make a web request, for every plugin (1.7.4).
//
// With Tampermonkey's GM_xmlhttpRequest (or GM.xmlHttpRequest), the request
// can go to any host listed in @connect and no CORS check applies. Without it,
// the page's own fetch is used, and then the other site has to allow the
// request (CORS). So requests are kept "simple" unless they can't be:
//  - no Content-Type unless there's a body (a labelled GET needs a CORS
//    preflight, which raw.githubusercontent.com never answers);
//  - no other extra headers, except to the Wizascript server, which allows
//    its own (x-wz-install, x-wz-secret, x-wz-admin, content-type).
// (feildmaster pointed both out, 2026-11-11: loadDecks had no fallback at all,
// and the fallbacks sent headers that made raw.githubusercontent refuse them.)
//
// http(method, url, { headers, body, timeout }) resolves to { status, text }
// for any answer (404 included) and rejects with an Error whose .kind is
// "network" or "timeout".

function gmRequest() {
  if (typeof GM_xmlhttpRequest === "function") return GM_xmlhttpRequest;
  // eslint-disable-next-line no-undef
  if (typeof GM !== "undefined" && GM && typeof GM.xmlHttpRequest === "function") return GM.xmlHttpRequest.bind(GM);
  return null;
}
const failure = (kind, message) => Object.assign(new Error(message), { kind });

export function http(method, url, { headers = {}, body, timeout = 20000 } = {}) {
  const h = { ...headers };
  if (body === undefined || body === null) Object.keys(h).forEach((k) => { if (k.toLowerCase() === "content-type") delete h[k]; });
  const gm = gmRequest();
  if (gm) {
    return new Promise((resolve, reject) => {
      try {
        gm({
          method, url, headers: h, data: body, timeout,
          onload: (r) => resolve({ status: r.status, text: r.responseText || "" }),
          onerror: () => reject(failure("network", "network error")),
          ontimeout: () => reject(failure("timeout", "timed out"))
        });
      } catch (e) { reject(failure("network", (e && e.message) || "network error")); }
    });
  }
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  let timedOut = false;
  const timer = ctl && timeout ? setTimeout(() => { timedOut = true; ctl.abort(); }, timeout) : null;
  return fetch(url, { method, headers: h, body: body === null ? undefined : body, signal: ctl ? ctl.signal : undefined, credentials: "omit" })
    .then(async (r) => ({ status: r.status, text: await r.text() }))
    .catch(() => { throw timedOut ? failure("timeout", "timed out") : failure("network", "network error"); })
    .finally(() => clearTimeout(timer));
}

// A JSON file: resolves to the parsed value, null for a 404, and rejects for
// anything else (or text that isn't JSON).
export async function getJson(url, { timeout } = {}) {
  const r = await http("GET", url, { timeout });
  if (r.status === 404) return null;
  if (r.status !== 200) throw failure("http", `HTTP ${r.status}`);
  try { return JSON.parse(r.text); } catch (e) { throw failure("json", "bad JSON"); }
}
