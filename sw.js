// Service worker: makes Kupit installable and playable offline.
// Strategy: precache the files listed in precache.json (built by `npm run build`), then network-first
// for everything else on this origin (so updates show up right away when online), falling back to the cache.
const CACHE = 'kupit';

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      const list = await (await fetch('precache.json', { cache: 'no-cache' })).json();
      await Promise.all(list.files.map((f) => cache.add(new Request(f, { cache: 'no-cache' })).catch(() => {})));
    } catch { /* offline install: nothing to precache */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return (await cache.match('index.html')) || (await cache.match('./')) || Response.error();
      return Response.error();
    }
  })());
});
