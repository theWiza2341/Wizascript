// packages/core/assets.js
//
// Binary assets (GIFs, sounds, images) live in the repo under /assets and
// are fetched at runtime from raw.githubusercontent.com - never inlined
// into the bundle, so a feature most players never trigger doesn't make
// every install megabytes bigger.
//
// The base URL follows the build channel (injected by build.js): stable
// builds read from main, dev builds from dev. So an asset has to be
// committed on the branch the build points at before it can load there.
//
// Fetched through GM_xmlhttpRequest (raw.githubusercontent.com is already
// in @connect for True Hub Bridge) and returned as a Blob, cached per
// path for the page's lifetime. Callers turn it into a fresh object URL
// per use - handy for GIFs, where a new URL is the reliable way to make
// the animation start from frame one again.

const ASSET_BASE = __WIZASCRIPT_ASSET_BASE__;

const cache = new Map(); // path -> Promise<Blob>

export function assetUrl(path) {
  return ASSET_BASE + path.replace(/^\/+/, "");
}

export function loadAssetBlob(path) {
  if (cache.has(path)) return cache.get(path);
  const promise = new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: "GET",
      url: assetUrl(path),
      responseType: "blob",
      onload(res) {
        if (res.status !== 200 || !res.response) {
          reject(new Error(`Asset ${path}: HTTP ${res.status}`));
          return;
        }
        resolve(res.response);
      },
      onerror: () => reject(new Error(`Asset ${path}: network error`)),
      ontimeout: () => reject(new Error(`Asset ${path}: timed out`)),
      timeout: 15000
    });
  });
  // A failed fetch shouldn't be cached forever - allow a retry later.
  promise.catch(() => cache.delete(path));
  cache.set(path, promise);
  return promise;
}
