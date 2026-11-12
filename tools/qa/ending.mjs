// The ending, end to end in a real browser: clear the storm for the first time and the game must go straight into
// the "HULI KA!" scene (not the results), then the results, and the scene must not play a second time.
//   node tools/qa/ending.mjs http://localhost:8080 [outDir]
import { mkdirSync } from 'node:fs';
import { launch, openPage, sleep, state } from './browser.mjs';

const [base = 'http://localhost:8080', out = 'tools/qa/out'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await launch();
const { page, errors } = await openPage(browser, { phone: false });
await page.setViewport({ width: 480, height: 784 });
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };
const key = async (k, ms = 200) => { await page.keyboard.press(k); await sleep(ms); };

await page.goto(`${base}/?dev=1`, { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });
await sleep(800);
const storm = await page.evaluate(async () => {
  const files = await (await fetch('src/data/levels/index.json')).json();
  for (let i = 0; i < files.length; i++) if ((await (await fetch('src/data/levels/' + files[i])).json()).ending) return i;
  return -1;
});
check(storm >= 0, 'a level is flagged as the one the ending follows');
await page.evaluate((i) => window.__kupit.start(i), storm);
await sleep(600);
await key('c', 900); // dev: clear the level
let s = await state(page);
check(s.mode === 'story', `clearing the storm goes straight into the ending (mode ${s.mode})`);
await page.screenshot({ path: `${out}/ending-caught.png` });
const panels = await page.evaluate(async () => (await import('./src/data/story.js')).ENDING.length);
for (let i = 0; i < panels * 2 + 2 && (await state(page)).mode === 'story'; i++) await key('Enter', 420);
s = await state(page);
check(s.mode === 'clear', `after the last panel come the results (mode ${s.mode})`);
check(await page.evaluate(() => window.__kupit.save.story.ending) === true, 'the ending is marked as seen');
await sleep(1800);
await page.screenshot({ path: `${out}/ending-results.png` });
await page.evaluate((i) => window.__kupit.start(i), storm);
await sleep(600);
await key('c', 900);
check((await state(page)).mode === 'clear', 'a replay of the storm ends on the results, not the scene again');
check(errors.length === 0, `no console errors${errors.length ? '\n  ' + errors.join('\n  ') : ''}`);
await browser.close();
console.log(failed ? `\n${failed} CHECKS FAILED` : '\nending flow ok');
process.exit(failed ? 1 : 0);
