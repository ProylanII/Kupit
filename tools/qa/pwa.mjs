// Offline + install check in headless Chrome: register the service worker (?sw=1 makes it run on localhost),
// wait for the whole version to download, navigate again through the worker, go OFFLINE, reload, boot the
// game and play a level and the Daily House from the cache. Then check the manifest for installability.
//   node tools/qa/pwa.mjs http://localhost:8080
import { launch, openPage, sleep, state } from './browser.mjs';

const base = process.argv[2] || 'http://localhost:8080';
const browser = await launch();
const { page, errors } = await openPage(browser);
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

await page.goto(`${base}/?sw=1`, { waitUntil: 'networkidle0' });
const ready = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return r.active?.state; });
check(ready === 'activated' || ready === 'activating', `service worker ${ready}`);
const cached = await page.evaluate(async () => {
  const want = await (await fetch('precache.json')).json();
  for (let i = 0; i < 150; i++) {
    for (const k of (await caches.keys()).filter((k) => k.startsWith('kupit-'))) {
      const n = (await (await caches.open(k)).keys()).length;
      if (n >= want.files.length + 1) return { cache: k, entries: n, files: want.files.length, version: want.version };
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
});
check(!!cached, `whole version cached: ${JSON.stringify(cached)}`);
await sleep(500);
await page.goto(`${base}/?sw=1&level=3`, { waitUntil: 'networkidle0' }); await sleep(1200);
check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'page is controlled by the worker');
check((await state(page)).level === '03-buong-bahay', 'navigation through the worker boots the game (?level=3)');

await page.setOfflineMode(true);
await page.goto(`${base}/`, { waitUntil: 'load' }).catch((e) => console.log('   offline navigation:', e.message));
await sleep(1500);
const off = await state(page);
check(off.mode === 'title', `offline: title screen boots from the cache (${JSON.stringify(off)})`);
await page.evaluate(() => window.__kupit.start(4)); await sleep(1500);
check((await state(page)).status === 'play', 'offline: a level plays');
await page.evaluate(() => window.__kupit.startDaily()); await sleep(1500);
check((await state(page)).status === 'play', 'offline: the Daily House plays');
await page.setOfflineMode(false);

const man = await page.evaluate(async () => {
  const m = await (await fetch('manifest.webmanifest')).json();
  const icons = await Promise.all(m.icons.map(async (i) => ({ sizes: i.sizes, purpose: i.purpose, ok: (await fetch(i.src)).ok })));
  return { name: m.name, start_url: m.start_url, display: m.display, icons };
});
check(!!man.name && !!man.start_url && ['standalone', 'fullscreen', 'minimal-ui'].includes(man.display), `manifest: name, start_url, display=${man.display}`);
check(man.icons.some((i) => i.ok && /192/.test(i.sizes)) && man.icons.some((i) => i.ok && /512/.test(i.sizes)) && man.icons.some((i) => i.ok && i.purpose === 'maskable'), 'manifest: 192, 512 and maskable icons load');
const real = errors.filter((e) => !/sw\.js|precache\.json/.test(e)); // the update check is allowed to fail offline
check(real.length === 0, `no console/page errors${real.length ? '\n  ' + real.join('\n  ') : ''}`);
await browser.close();
console.log(failed ? `\n${failed} CHECKS FAILED` : '\ninstallable and works offline');
process.exit(failed ? 1 : 0);
