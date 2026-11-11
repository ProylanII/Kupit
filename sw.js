// Service worker: makes Kupit installable and playable offline.
// Every build has its own cache ("kupit-<version>", the version is stamped below by `npm run build` from
// precache.json). A new version downloads in the background into a fresh cache and then WAITS: the page
// shows "UPDATE READY" and only switches when the player taps it, so old and new files never mix.
const VERSION = '508b0151'; // stamped by tools/build-precache.mjs
const CACHE = `kupit-${VERSION}`;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const list = await (await fetch('precache.json', { cache: 'no-cache' })).json();
    // all or nothing: a half-downloaded version must never be activated
    await cache.addAll(list.files.map((f) => new Request(f, { cache: 'no-cache' })));
    await cache.put('./', (await cache.match('index.html')).clone());
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
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { return await fetch(req); } catch {
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      return Response.error();
    }
  })());
});
