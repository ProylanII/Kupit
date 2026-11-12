// Service worker: makes Kupit installable and playable offline.
// Every build has its own cache ("kupit-<version>", the version is stamped below by `npm run build` from
// precache.json). A new version downloads in the background into a fresh cache and then WAITS: the page
// shows "UPDATE READY" and only switches when the player taps it, so old and new files never mix.
const VERSION = '52e988ff'; // stamped by tools/build-precache.mjs
const CACHE = `kupit-${VERSION}`;
const ROOT = new URL('./', self.location).pathname; // the app's folder, e.g. "/" or "/kupit/"

// A response that went through a redirect may not answer a navigation (Chrome: net::ERR_FAILED). Hosts that
// canonicalise /index.html -> / (serve, Netlify, ...) hand us exactly that, so the start page is re-wrapped.
async function plain(res) {
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: 200, statusText: 'OK', headers: res.headers });
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const list = await (await fetch('precache.json', { cache: 'no-cache' })).json();
    // all or nothing: a half-downloaded version must never be activated
    await cache.addAll(list.files.map((f) => new Request(f, { cache: 'no-cache' })));
    await cache.put('./', await plain(await fetch('./', { cache: 'no-cache' })));
  })());
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k.startsWith('kupit')) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Cache first (this version's files only), network for anything not in the precache list.
// Navigations to the app (any query string) always get this version's start page.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === 'navigate' && (url.pathname === ROOT || url.pathname === ROOT + 'index.html')) {
      const page = await cache.match('./');
      if (page) return page;
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { return await fetch(req); } catch {
      if (req.mode === 'navigate') return (await cache.match('./')) || Response.error();
      return Response.error();
    }
  })());
});
