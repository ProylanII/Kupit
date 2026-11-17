// The mini-game batch (MG-1 TUMBANG PRESO, MG-7 HABOL!, MG-5 SI MINGMING, MG-4 BAGYO's leaks and flood), the
// campaign around them (order, save v6, rewards, the album), played headlessly with real inputs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Preso, LINE_Y, GUARD_R, WIN, SAFE_R } from '../src/game/preso.js';
import { Runner, botInput, GAP0, GAP_HIT, GAP_MAX } from '../src/game/runner.js';
import { World, CONT_CAP } from '../src/game/world.js';
import { TILE } from '../src/world/tilemap.js';
import { MISSIONS, missionIds } from '../src/game/missions.js';
import { migrate, fresh } from '../src/core/save.js';
import { grantRewards, OUTFITS, DECOR, MAX_STARS } from '../src/game/progression.js';
import { CHAPTERS, BEFORE } from '../src/data/story.js';
import { validateLevel } from '../src/game/validate.js';
import { playBot } from './bot.mjs';

const dir = new URL('../src/data/levels/', import.meta.url);
const order = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'));
const load = (f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
const levels = order.map(load);
const byId = Object.fromEntries(levels.map((L) => [L.id, L]));
const STEP = 1 / 60;
const none = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false };
const walk = (x, y, run = false) => ({ ...none, mv: { x, y, mag: 1, run } });

// ---------------------------------------------------------------- TUMBANG PRESO
// A player who aims well: hold BATO, let go when the mark is on the can; after a TUMBA run for the slipper and back.
function presoBot(s) {
  const k = s.jun, c = s.can;
  if (s.aim) {
    const want = Math.hypot(c.x - k.x, c.y - (k.y - 6)), d = s.aimPoint().d;
    return { ...none, action: !(Math.abs(d - (want + 3)) < 3.5) };
  }
  const ctx = s.context();
  if (ctx?.kind === 'aim') return { ...none, action: true, actionPressed: true };
  if (ctx?.kind === 'pulot' && (c.state !== 'up' || s.taya.state !== 'chase')) return { ...none, action: true, actionPressed: true };
  const to = (x, y) => { const dx = x - k.x, dy = y - k.y, m = Math.hypot(dx, dy); return m < 2 ? none : walk(dx / m, dy / m); };
  if (k.slippers > 0) return s.inField(k) ? to(k.x, LINE_Y + 20) : none;
  const mine = s.slips.find((x) => x.owner === k && x.state === 'ground');
  if (!mine) return none;
  if (c.state !== 'up' || Math.hypot(mine.x - c.x, mine.y - c.y) > GUARD_R + 10 || s.onSlipper(k)) return to(mine.x, mine.y);
  return none; // wait behind the line for a friend's TUMBA
}
const playPreso = (L, maxT = 240) => {
  const s = new Preso(L);
  for (let i = 0; i < maxT * 60 && s.status === 'play'; i++) s.update(STEP, presoBot(s));
  return s;
};

test('preso: a player who aims well wins three TUMBA, and the result carries the missions', () => {
  const s = playPreso(byId.preso);
  assert.equal(s.status, 'clear', `status ${s.status} after ${s.time.toFixed(0)}s, score ${s.jun.score}, tagged ${s.tagged}`);
  assert.equal(s.jun.score, WIN);
  assert.ok(s.firstHit, 'the first throw, aimed true, knocked it over');
  assert.deepEqual(s.result.missions.length, 3);
  assert.ok(s.time < byId.preso.par, `took ${s.time.toFixed(0)}s`);
});

test('preso: the taya tags you out near the can, not on your slipper, not while the can is down', () => {
  const s = new Preso({ ...byId.preso, intro: false });
  const t = s.taya, j = s.jun;
  j.x = s.can.x + 30; j.y = s.can.y + 10; // out in the street, nothing of yours under you
  assert.ok(s.vulnerable(j));
  s.slips.push({ owner: j, x: j.x, y: j.y, state: 'ground' }); // ...now standing on your own slipper
  assert.ok(!s.vulnerable(j), 'standing on your slipper is safe');
  s.slips.length = 0;
  s.can.state = 'down';
  assert.ok(!s.vulnerable(j), 'nobody can be tagged while the can is down');
  s.can.state = 'up';
  t.x = j.x + 4; t.y = j.y;
  for (let i = 0; i < 30 && !s.beat; i++) s.update(STEP, none);
  assert.equal(s.beat?.kind, 'tag');
  for (let i = 0; i < 200 && s.beat; i++) s.update(STEP, none);
  assert.equal(s.livesLeft, 2, 'a tag costs one chance');
  assert.equal(s.tagged, 1);
  assert.equal(MISSIONS.presoClean.ok(s), false);
  assert.equal(j.slippers, 2, 'the round starts over, both slippers in hand');
});

test('preso: a friend who is tagged becomes the taya, and the old taya joins the line', () => {
  const s = new Preso({ ...byId.preso, intro: false });
  const old = s.taya, toto = s.kids.find((k) => k.id === 'toto');
  toto.x = s.can.x - 20; toto.y = s.can.y + 20; toto.state = 'fetch';
  old.x = toto.x + 3; old.y = toto.y;
  for (let i = 0; i < 200 && s.taya === old; i++) s.update(STEP, none);
  assert.equal(s.taya, toto);
  assert.equal(old.role, 'thrower');
  assert.equal(old.slippers, 2);
});

test('preso: three tags and you are out; a tap is not a throw', () => {
  const s = new Preso({ ...byId.preso, intro: false });
  s.update(STEP, { ...none, action: true, actionPressed: true });
  assert.ok(s.aim);
  s.update(STEP, none); // let go at once
  assert.equal(s.jun.slippers, 2, 'nothing thrown');
  for (let n = 0; n < 3; n++) { s.tag(s.jun); for (let i = 0; i < 200 && s.beat; i++) s.update(STEP, none); }
  assert.equal(s.status, 'caught');
});

// ---------------------------------------------------------------- HABOL!
const playRunner = (L, inputFn = botInput, maxT = 120) => {
  const r = new Runner(L);
  for (let i = 0; i < maxT * 60 && r.status === 'play'; i++) r.update(STEP, inputFn(r));
  return r;
};

test('habol: a clean run catches Tigre, under par, with every coin', () => {
  const r = playRunner(byId.habol);
  assert.equal(r.status, 'clear', `status ${r.status} at ${r.x.toFixed(0)}/${r.end}, stumbles ${r.stumbles}`);
  assert.equal(r.stumbles, 0, 'the course can be run without a stumble');
  assert.equal(r.coinsGot, r.coinsTotal, `coins ${r.coinsGot}/${r.coinsTotal}`);
  assert.ok(r.time < byId.habol.par, `took ${r.time.toFixed(1)}s`);
  assert.deepEqual(r.result.missions, [true, true, true]);
});

test('habol: doing nothing trips you up until Tigre is gone', () => {
  const r = playRunner(byId.habol, () => ({}));
  assert.equal(r.status, 'caught');
  assert.equal(r.reason, 'gone');
  assert.ok(r.stumbles >= Math.ceil((GAP_MAX - GAP0) / GAP_HIT) - 1);
});

test('habol: a tap is a hop, holding goes higher; coyote time; sliding gets under the washing', () => {
  const L = { id: 't', mode: 'habol', intro: false, end: 2000, course: [] };
  const peak = (hold) => { const r = new Runner(L); let top = 0; r.update(STEP, { jump: true, jumpPressed: true }); for (let i = 0; i < 60; i++) { r.update(STEP, { jump: hold && i < 30 }); top = Math.min(top, r.y); } return -top; };
  const hop = peak(false), high = peak(true);
  assert.ok(high > hop * 1.6, `held ${high.toFixed(0)}px vs tapped ${hop.toFixed(0)}px`);
  assert.ok(high > 40 && high < 60);
  // run off a crate, press jump a moment later: still jumps
  const r = new Runner({ ...L, course: [{ t: 'kahon', x: 30 }] });
  r.x = 34; r.y = -16; r.onGround = true; r.speed = 100;
  let jumped = false;
  for (let i = 0; i < 40 && !jumped; i++) { const off = !r.onGround; r.update(STEP, off ? { jump: true, jumpPressed: true } : {}); if (r.vy < -200) jumped = true; }
  assert.ok(jumped, 'a jump just after running off an edge still counts');
  // washing over the street: standing you trip, sliding you pass
  const lineL = { ...L, course: [{ t: 'sampayan', x: 120 }] };
  const stand = new Runner(lineL); for (let i = 0; i < 180; i++) stand.update(STEP, {});
  assert.ok(stand.stumbles > 0);
  const slide = new Runner(lineL); for (let i = 0; i < 180; i++) slide.update(STEP, slide.x > 90 && slide.x < 175 ? { slide: true, slidePressed: !slide.sliding } : {});
  assert.equal(slide.stumbles, 0);
});

// ---------------------------------------------------------------- SI MINGMING
test('mingming: the cat walks on the furniture, has no hands for doors, and her TABIG pulls people away', () => {
  const L = byId.mingming;
  assert.deepEqual(validateLevel(L), []);
  const w = new World(L, { char: 'nene', upgrades: { baon: 1 } });
  assert.equal(w.mods.cat, true, 'whoever was picked, it is Mingming');
  assert.deepEqual(w.player.items, [], 'no gear in a cat\'s pockets');
  assert.equal(w.mods.skill.id, 'tabig');
  // up on the table: only someone right beside her sees her
  w.player.x = 5 * TILE + 8; w.player.y = 4 * TILE + 8;
  w.update(STEP, none);
  assert.ok(w.player.up && !w.player.under, 'on the table: up high, seen from half as far'); 
  // no hands: a closed door gives her nothing to do
  const d = { ...L, tiles: L.tiles.map((r, y) => (y === 7 ? r.slice(0, 4) + 'D' + r.slice(5) : r)) };
  const w2 = new World(d);
  w2.player.x = 4 * TILE + 8; w2.player.y = 8 * TILE + 8;
  assert.equal(w2.context(), null);
  // TABIG: a crash in front of her
  w.abilityCd = 0;
  assert.ok(w.useAbility());
  assert.ok(w.events.some((e) => e.type === 'tabig'));
  assert.ok(w.adults.filter((a) => a.type !== 'aso').every((a) => a.cfg.shout === 'UY, PUSA!'), 'they shoo a cat, they do not call Jun');
  const r = playBot(L);
  assert.ok(r.ok, `bot: ${r.why || r.status}`);
});

// ---------------------------------------------------------------- BAGYO: TULO and BAHA
function stormAtBox() {
  const w = new World(byId.bagyo, { lives: 3 });
  w.god = true;
  for (const t of w.targets) if (!t.bonus) t.done = true;
  w.coins = 4;
  w.update(STEP, none);
  assert.equal(w.finale?.type, 'tulo');
  assert.equal(w.finale.stage, 'gather');
  assert.ok(!w.open || w.finale.noExit, 'the exit waits');
  w.player.x = w.tulo.box.x; w.player.y = w.tulo.box.y;
  w.update(STEP, none);
  assert.equal(w.tulo.stage, 'leak');
  return w;
}

test('bagyo TULO: drips fill a container, an uncovered drip soaks the box, the soaked box cries', () => {
  const w = stormAtBox(), T = w.tulo, p = w.player;
  const pal = T.conts.find((k) => k.kind === 'palanggana'), d0 = T.drips[0];
  // carry the basin under the first drip
  p.x = pal.x; p.y = pal.y;
  w.update(STEP, { ...none, action: true, actionPressed: true });
  assert.equal(p.holding, pal);
  p.x = d0.x; p.y = d0.y + 6;
  w.update(STEP, none);
  assert.equal(w.context()?.kind, 'sahod');
  w.update(STEP, { ...none, action: true, actionPressed: true });
  assert.equal(pal.drip, d0);
  for (let i = 0; i < 60 * 2.6; i++) w.update(STEP, none);
  assert.ok(pal.fill > 0.2 && T.wet < 0.2, `fill ${pal.fill.toFixed(2)}, wet ${T.wet.toFixed(2)}`);
  for (let i = 0; i < 60 * 12; i++) w.update(STEP, none);
  assert.ok(pal.fill >= 1 && T.wet > 0.3, 'the other drips soak the box');
  assert.equal(MISSIONS.dryBox.ok(w), T.wet < 1);
  for (let i = 0; i < 60 * 8 && T.stage === 'leak'; i++) w.update(STEP, none);
  assert.ok(w.events.some((e) => e.type === 'cry') || T.wet < 1);
});

test('bagyo TULO: TAPON empties a container down the drain, quietly only under the thunder', () => {
  const w = stormAtBox(), T = w.tulo, p = w.player, k = T.conts[1];
  k.fill = 1; k.held = true; p.holding = k;
  p.x = T.drain.x; p.y = T.drain.y - 8;
  w.thunder = false;
  w.noises.length = 0;
  w.interact(w.context());
  assert.equal(k.fill, 0);
  assert.ok(w.noises.some((n) => n.r >= 50), 'the splash is heard');
  k.fill = 1; w.noises.length = 0; w.thunder = true;
  w.interact(w.context());
  assert.equal(w.noises.length, 0, 'under the thunder: nobody hears it');
  assert.equal(CONT_CAP.timba > CONT_CAP.kaldero, true);
});

test('bagyo BAHA: the flood comes after the leaks, sandbags seal the breaches, and then it drains away', () => {
  const w = stormAtBox(), F = w.flood, W = w.map.w;
  for (let i = 0; i < 60 * 23 && !F.active; i++) w.update(STEP, none);
  assert.ok(F.active, 'the leaks stop and the water comes');
  assert.ok(w.open && w.escapeT > 0, 'the door is open, the clock is running');
  assert.ok(w.adults.every((a) => a.cfg.harmless), 'the family is inside');
  for (let i = 0; i < 60 * 4; i++) w.update(STEP, none);
  const wet = () => F.depth.reduce((n, d) => n + (d > 0), 0);
  assert.ok(wet() > 10, 'it spreads');
  // push the sandbag at (9,7) up one, then right three times into the breach at (12,6)
  const p = w.player;
  const lean = (tx, ty, dx, dy) => { p.x = tx * TILE + 8 - dx * 11; p.y = ty * TILE + 8 - dy * 11; for (let i = 0; i < 30 && w.map.ch(tx, ty) === 'Q'; i++) w.update(STEP, walk(dx, dy)); };
  lean(9, 7, 0, -1); assert.equal(w.map.ch(9, 6), 'Q');
  lean(9, 6, 1, 0); lean(10, 6, 1, 0); lean(11, 6, 1, 0);
  assert.equal(w.map.ch(12, 6), 'Q');
  assert.ok(F.sources[0].sealed);
  assert.ok(!F.stopped, 'one breach is still open');
  lean(10, 10, 0, -1); lean(10, 9, 1, 0); lean(11, 9, 1, 0);
  assert.ok(F.sources[1].sealed);
  for (let i = 0; i < 60 * 3; i++) w.update(STEP, none);
  assert.ok(F.stopped && MISSIONS.stopFlood.ok(w));
  for (let i = 0; i < 60 * 3; i++) w.update(STEP, none);
  assert.equal(wet(), 0, 'it drained away');
  assert.equal(F.depth[6 * W + 12], 0);
});

test('bagyo: wading is slow and deep water slower; Mingming only comes in the quiet', () => {
  const w = new World(byId.bagyo);
  const m = w.targets.find((t) => t.kind === 'mingming');
  w.player.x = m.x; w.player.y = m.y + 10;
  w.thunder = true;
  // (thunder is set by the storm clock each frame: hold ACT through a roll and she does not budge)
  w.level = { ...w.level, storm: { every: 100, dur: 99 } };
  w.time = 1; // (a storm cycle opens with half a second of quiet)
  for (let i = 0; i < 60; i++) w.update(STEP, { ...none, action: true });
  assert.equal(m.progress, 0, 'she flinches away while it thunders');
  w.level = { ...w.level, storm: null }; w.thunder = false;
  for (let i = 0; i < 60 * 3; i++) w.update(STEP, { ...none, action: true });
  assert.ok(m.done, 'in the quiet she comes');
  w.flood.active = true;
  const sp = (d) => { w.flood.depth.fill(d); const x0 = w.player.x; w.player.y = 14 * TILE + 8; w.player.x = 6 * TILE + 8; const a = w.player.x; for (let i = 0; i < 30; i++) w.update(STEP, walk(1, 0)); void x0; return w.player.x - a; };
  const dry = sp(0), shallow = sp(1), deep = sp(2);
  assert.ok(dry > shallow && shallow > deep, `${dry.toFixed(1)} > ${shallow.toFixed(1)} > ${deep.toFixed(1)}`);
});

// ---------------------------------------------------------------- the campaign around them
test('campaign: each new mode sits in its chapter, has its story, and the stars add up', () => {
  const at = (id) => levels.findIndex((L) => L.id === id);
  assert.ok(at('04-bakuran') < at('preso') && at('preso') < at('06-kwarto'), 'PRESO is the breather before SWELDO');
  assert.ok(at('ibalik') < at('mingming') && at('mingming') < at('boss3-tatay'), "Mingming takes the fish before Tatay's boss");
  assert.equal(CHAPTERS.find((c) => c.name === 'SA LABAS').from, 'habol', 'chasing Tigre takes Jun out into the barangay');
  for (const id of ['preso', 'mingming', 'habol']) assert.ok(BEFORE[id], `${id} has a scene before it`);
  assert.equal(levels.filter((L) => !L.epilogue).length * 3, MAX_STARS);
  for (const L of levels.filter((x) => x.mode || x.cat || x.rewards)) {
    assert.equal(missionIds(L).length, 3);
    for (const id of missionIds(L)) assert.ok(MISSIONS[id], `${L.id}: ${id}`);
    for (const rw of L.rewards || []) if (rw.outfit) assert.equal(OUTFITS[rw.outfit].how.reward, L.id);
    for (const rw of L.rewards || []) if (rw.decor) assert.equal(DECOR[rw.decor].how.reward, L.id);
    for (const [, line] of L.howto || []) assert.ok(line.length <= 92, `${L.id}: how-to line too long`);
  }
});

test('save v6: progress stays on its level; a new level right before it comes next', () => {
  const v5 = ['01-sala', '02-kusina', '03-buong-bahay', 'boss1-lola', '04-bakuran', '06-kwarto', 'gatas', 'boss2-mama', '05-gabi', '07-sampayan', 'ibalik', 'boss3-tatay', '08-palengke', '09-barangay', 'boss4-fiesta', 'bagyo', 'hingi'];
  const ADDED_BEFORE = { '06-kwarto': 'preso', 'boss3-tatay': 'mingming', '08-palengke': 'habol' };
  v5.forEach((id, u) => {
    const s = migrate({ ...fresh(), v: 5, unlocked: u });
    assert.equal(levels[s.unlocked].id, ADDED_BEFORE[id] || id, `old ${u} (${id})`);
  });
  assert.deepEqual(migrate({ v: 5 }).album, []);
});

test('rewards: each star pays once; coins, photos and looks', () => {
  const s = fresh(), L = byId.preso;
  const got = grantRewards(s, L, 0b111);
  assert.deepEqual(got.map((g) => g.kind), ['coins', 'photo', 'outfit']);
  assert.equal(s.bank, 10);
  assert.ok(s.album.includes('preso') && s.outfits.includes('kalye'));
  assert.deepEqual(grantRewards(s, L, 0b110), [], 'the photo and the outfit are not given twice');
  assert.deepEqual(grantRewards(s, L, 0b001).map((g) => g.kind), ['coins'], '(the first-clear prize: campaign code only passes newly earned stars)');
});
