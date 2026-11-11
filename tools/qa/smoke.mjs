// Smoke run in headless Chrome: every screen and every level boots without console errors, on a phone-sized
// touch viewport and on a desktop one; the load-failure screen appears when a level file is missing.
//   node tools/qa/smoke.mjs http://localhost:8080 [outDir]
import { mkdirSync } from 'node:fs';
import { launch, openPage, sleep, state } from './browser.mjs';

const [base = 'http://localhost:8080', out = 'tools/qa/out'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await launch();
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

for (const phone of [true, false]) {
  const { page, errors } = await openPage(browser, { phone });
  const tag = phone ? 'phone' : 'desktop';
  const shot = (n) => page.screenshot({ path: `${out}/${tag}-${n}.png` });
  const key = async (k, ms = 120) => { await page.keyboard.press(k); await sleep(ms); };
  await page.goto(`${base}/?dev=1`, { waitUntil: 'networkidle0' });
  await sleep(1000);
  check((await state(page)).mode === 'title', `${tag}: title screen`);
  await shot('title');
  // menus by keyboard: LEVELS, RANDOM HOUSE, STORE, CHARACTERS, HOW TO PLAY (3 pages), OPTIONS
  const menus = [['levels', 1], ['house', 2], ['store', 3], ['chars', 4], ['help', 5], ['options', 6]];
  for (const [name, n] of menus) {
    for (let i = 0; i < n; i++) await key('ArrowDown');
    await key('Enter', 300);
    check((await state(page)).mode === name, `${tag}: ${name} screen opens`);
    if (name === 'help') { await shot('help-1'); await key('ArrowRight', 200); await shot('help-2'); await key('ArrowRight', 200); await shot('help-3'); }
    else await shot(name);
    await key('Escape', 300);
    check((await state(page)).mode === 'title', `${tag}: back to title from ${name}`);
  }
  // every level, a house and the daily: 3 s each
  const n = await page.evaluate(async () => (await (await fetch('src/data/levels/index.json')).json()).length);
  for (let i = 0; i < n; i++) {
    await page.evaluate((i) => window.__kupit.start(i), i); await sleep(3000);
    const s = await state(page);
    check(s.mode === 'play' && s.status === 'play' && s.time > 2, `${tag}: level ${i + 1} ${s.level} runs`);
    await shot(`level-${String(i + 1).padStart(2, '0')}`);
  }
  await page.evaluate(() => window.__kupit.startHouse(4242, 3)); await sleep(2000);
  check((await state(page)).status === 'play', `${tag}: random house runs`); await shot('house');
  await page.evaluate(() => window.__kupit.startDaily()); await sleep(2000);
  check((await state(page)).status === 'play', `${tag}: daily house runs`); await shot('daily');
  // pause, options from pause, resume
  await page.evaluate(() => window.__kupit.start(1)); await sleep(500);
  await key('Escape', 300); check((await state(page)).mode === 'paused', `${tag}: pause`); await shot('paused');
  await key('Escape', 300); check((await state(page)).mode === 'play', `${tag}: resume`);
  // dev regression: hotkeys U (quota) O (exit) then walk in = clear, C = clear, G = god
  await key('u', 100); await key('o', 100);
  check((await page.evaluate(() => window.__kupit.play.world.open)) === true, `${tag}: dev U fills the quota`);
  await page.evaluate(() => window.__kupit.start(2)); await sleep(300); await key('c', 900);
  check((await state(page)).mode === 'clear', `${tag}: dev C clears the level`); await shot('clear');
  await sleep(1500); await shot('clear-stars');
  check(errors.length === 0, `${tag}: no console errors, page errors or failed requests${errors.length ? '\n  ' + errors.join('\n  ') : ''}`);
  await page.close();
}

// load failure: a missing level file must show the error + retry screen instead of LOADING... forever
{
  const { page } = await openPage(browser);
  await page.setRequestInterception(true);
  page.on('request', (r) => (r.url().endsWith('/levels/index.json') ? r.abort() : r.continue()));
  await page.goto(`${base}/`, { waitUntil: 'networkidle0' }); await sleep(800);
  const s = await state(page);
  check(s.mode === 'loading' && !!s.loadError, `load failure shows the retry screen (${s.loadError})`);
  await page.screenshot({ path: `${out}/load-error.png` });
  await page.close();
}
await browser.close();
console.log(failed ? `\n${failed} CHECKS FAILED` : '\nall smoke checks passed');
process.exit(failed ? 1 : 0);
