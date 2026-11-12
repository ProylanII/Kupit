// Screenshots for looking at the game by eye (art, levels, story panels):
//   node tools/qa/shot.mjs http://localhost:8080 outDir level:3 level:14@6 story:ENDING:0 story:ENDING:3 title map clear:3 paused:2
// level:N[@seconds] = level N (1-based) after that many seconds; story:NAME:panel = a story scene (INTRO, ENDING,
// EPILOGUE or a level id from BEFORE); clear:N = level N's clear screen; paused:N; title; map.
import { mkdirSync } from 'node:fs';
import { launch, openPage, sleep, state } from './browser.mjs';

const [base = 'http://localhost:8080', out = 'tools/qa/out', ...shots] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await launch();
const { page, errors } = await openPage(browser, { phone: false });
await page.setViewport({ width: 480, height: 784 }); // exactly 2x the game's 240x392
await page.goto(`${base}/?dev=1`, { waitUntil: 'networkidle0' });
await sleep(800);
const key = async (k, ms = 150) => { await page.keyboard.press(k); await sleep(ms); };
for (const s of shots) {
  const [kind, a, b] = s.split(':');
  const name = s.replace(/[:@]/g, '-');
  if (kind === 'level' || kind === 'clear' || kind === 'paused') {
    const [n, secs] = String(a).split('@');
    await page.evaluate((i) => window.__kupit.start(i), Number(n) - 1);
    await sleep((Number(secs) || 2) * 1000);
    if (kind === 'clear') { await key('c', 2600); }
    if (kind === 'paused') { await key('Escape', 400); }
  } else if (kind === 'story') {
    await page.evaluate(async (nm, i) => {
      const m = await import('./src/data/story.js');
      const panels = m[nm] || m.BEFORE[nm];
      window.__kupit.story(panels, Number(i) || 0);
    }, a, b);
    await sleep(1600);
  } else if (kind === 'title') { await page.evaluate(() => window.__kupit.go('title')); await sleep(500); }
  else if (kind === 'map') { await page.evaluate(() => window.__kupit.go('levels')); await sleep(500); }
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(name, JSON.stringify(await state(page)));
}
if (errors.length) console.log('ERRORS\n' + errors.join('\n'));
await browser.close();
process.exit(errors.length ? 1 : 0);
