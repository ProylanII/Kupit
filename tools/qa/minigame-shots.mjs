// Screenshots of the mini-game batch at its interesting moments, for checking by eye:
//   node tools/qa/minigame-shots.mjs http://localhost:8137 outDir
// PRESO mid-aim and after a TUMBA, HABOL! jumping / sliding / on the tricycle, SI MINGMING up on the table,
// BAGYO in TULO and in the flood, the album, the map, and a clear screen with rewards.
import { mkdirSync } from 'node:fs';
import { launch, openPage, sleep } from './browser.mjs';

const [base = 'http://localhost:8080', out = 'tools/qa/out/minigames'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await launch();
const { page, errors } = await openPage(browser, { phone: false });
await page.setViewport({ width: 480, height: 784 });
await page.goto(`${base}/?dev=1`, { waitUntil: 'networkidle0' });
await sleep(800);
const idx = await page.evaluate(async () => (await (await fetch('src/data/levels/index.json')).json()));
const at = (f) => idx.indexOf(f);
const shot = async (n) => { await page.screenshot({ path: `${out}/${n}.png` }); console.log(n); };
const run = (fn, ...a) => page.evaluate(fn, ...a);

// ---- TUMBANG PRESO
await run((i) => window.__kupit.start(i), at('preso.json'));
await sleep(2800);
await page.keyboard.down('e'); await sleep(560); await shot('preso-aim'); await page.keyboard.up('e');
await run(() => { const s = window.__kupit.play.world; s.aim = null; s.throwSlipper(s.jun, Math.atan2(s.can.y - s.jun.y + 6, s.can.x - s.jun.x), Math.hypot(s.can.x - s.jun.x, s.can.y - s.jun.y + 6) + 3); });
await sleep(700); await shot('preso-flight');
await sleep(900); await shot('preso-tumba');
await sleep(1800); await shot('preso-scramble');

// ---- HABOL!
await run((i) => window.__kupit.start(i), at('habol.json'));
await sleep(2600);
await run(() => { const r = window.__kupit.play.world; r.x = 330; });
await page.keyboard.down(' '); await sleep(160); await shot('habol-jump'); await page.keyboard.up(' ');
await run(() => { const r = window.__kupit.play.world; r.x = 940; r.y = 0; r.vy = 0; r.onGround = true; });
await page.keyboard.down('s'); await sleep(180); await shot('habol-slide'); await page.keyboard.up('s');
await run(() => { const r = window.__kupit.play.world; r.x = 2215; r.y = -24; r.vy = 0; r.onGround = true; r.standOn = r.obs.find((o) => o.kind === 'trike'); });
await sleep(150); await shot('habol-trike');
await run(() => { const r = window.__kupit.play.world; r.x = 3500; r.y = 0; r.onGround = true; r.standOn = 'street'; });
await sleep(900); await shot('habol-scoop');

// ---- SI MINGMING
await run((i) => window.__kupit.start(i), at('mingming.json'));
await sleep(1500); await shot('mingming-start');
await run(() => { const w = window.__kupit.play.world; w.player.x = 5 * 16 + 8; w.player.y = 3 * 16 + 8; });
await sleep(400); await shot('mingming-table');

// ---- BAGYO
await run((i) => window.__kupit.start(i), at('bagyo.json'));
await sleep(1500); await shot('bagyo-start');
await run(() => { const w = window.__kupit.play.world; w.god = true; for (const t of w.targets) if (!t.bonus) t.done = true; w.coins = 4; });
await sleep(300);
await run(() => { const w = window.__kupit.play.world; w.player.x = w.tulo.box.x; w.player.y = w.tulo.box.y - 2; });
await sleep(400);
await run(() => { const w = window.__kupit.play.world, T = w.tulo; const k = T.conts[0]; k.drip = T.drips[0]; k.x = T.drips[0].x; k.y = T.drips[0].y; k.fill = 0.6; T.conts[1].held = true; w.player.holding = T.conts[1]; T.conts[1].fill = 0.4; w.player.x = T.drips[2].x + 10; });
await sleep(9000); await shot('bagyo-tulo');
await run(() => { const w = window.__kupit.play.world; w.tulo.t = w.tulo.dur; });
await sleep(6000); await shot('bagyo-flood');
await run(() => { const w = window.__kupit.play.world; w.player.x = 8 * 16 + 4; w.player.y = 7 * 16 + 8; });
await sleep(1500); await shot('bagyo-flood-yard');

// ---- the album, the map, a clear screen with rewards
await run(() => { const s = window.__kupit.save; s.album = ['preso', 'habol', 'mingming']; s.story.photo = 'in'; s.story.ending = true; window.__kupit.go('album'); });
await sleep(500); await shot('album');
await page.keyboard.press('Enter'); await sleep(400); await shot('album-open');
await page.keyboard.press('Escape'); await sleep(300);
await run(() => { window.__kupit.save.unlocked = 15; window.__kupit.go('levels'); });
await sleep(500); await shot('map');
await run((i) => { const s = window.__kupit.save; delete s.stars.preso; delete s.missions.preso; s.album = []; s.outfits = s.outfits.filter((o) => o !== 'kalye'); window.__kupit.start(i); }, at('preso.json'));
await sleep(500);
await run(() => { const s = window.__kupit.play.world; s.firstHit = true; s.devClear(); });
await sleep(2600); await shot('preso-clear');

if (errors.length) console.log('ERRORS\n' + errors.join('\n'));
await browser.close();
