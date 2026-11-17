// Screenshots of the L1 tutorial coach, step by step, plus the title and the shop stop after a level.
//   node tools/qa/tutorial-shots.mjs http://localhost:8137 outDir [phone]
import { mkdirSync } from 'node:fs';
import { launch, openPage, sleep } from './browser.mjs';

const [base = 'http://localhost:8080', out = 'tools/qa/out/tutorial', phone] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await launch();
const { page, errors } = await openPage(browser, { phone: !!phone });
if (!phone) await page.setViewport({ width: 480, height: 784 });
await page.goto(`${base}/?dev=1`, { waitUntil: 'networkidle0' });
await sleep(800);
const shot = async (name) => { await page.screenshot({ path: `${out}/${name}.png` }); console.log(name, await page.evaluate(() => { const p = window.__kupit.play; const v = p?.coach?.view({ touch: p.touch }); return JSON.stringify({ mode: window.__kupit.mode, step: p?.coach?.step?.id, lines: v?.lines }); })); };
const w = (fn, arg) => page.evaluate(fn, arg);

await w(() => window.__kupit.go('title')); await sleep(500); await shot('00-title');
await w(() => window.__kupit.start(0)); await sleep(1500); await shot('01-move');
const at = (tx, ty) => w(([x, y]) => { const p = window.__kupit.play.world.player; p.x = x * 16 + 8; p.y = y * 16 + 8; }, [tx, ty]);
await at(11, 13); await sleep(700); await shot('02-door');
await w(() => window.__kupit.play.world.map.set(11, 12, 'd')); await at(9, 11); await sleep(700); await shot('03-pickup');
await w(() => window.__kupit.play.world.player.items.push('tsinelas')); await at(3, 10); await sleep(700); await shot('04-lever');
await w(() => { const W = window.__kupit.play.world; W.toggleSwitch(W.switches[0], true); }); await at(5, 8); await sleep(700); await shot('05-cone');
await at(10, 5); await sleep(700); await shot('06-kupit');
await w(() => { window.__kupit.play.world.coins = 1; }); await sleep(1800); await shot('07-tago');
await w(() => { const W = window.__kupit.play.world; W.player.hidden = W.hides[1]; }); await sleep(600); await shot('08-hidden');
await w(() => { const W = window.__kupit.play.world; W.player.hidden = null; W.coins = 3; W.adults[0].staged = false; }); await sleep(700); await shot('09-sapat');
await sleep(4500); await page.keyboard.down('ArrowDown'); await sleep(120); await page.keyboard.up('ArrowDown'); await page.keyboard.down('q'); await sleep(500); await shot('10-throw-aim');
await page.keyboard.up('q'); await sleep(1800); await shot('11-exit');
await w(() => { const s = window.__kupit.save; s.bank = 120; s.story.intro = true; }); await page.keyboard.press('c'); await sleep(2600); await shot('12-clear');
await page.keyboard.press('Enter'); await sleep(900); await shot('13-shop-stop');
if (errors.length) console.log('ERRORS\n' + errors.join('\n'));
await browser.close();
