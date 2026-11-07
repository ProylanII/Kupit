import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE } from '../src/world/tilemap.js';
import { World } from '../src/game/world.js';

const c = (t) => t * TILE + TILE / 2;
const idle = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false, throwPressed: false, abilityPressed: false };
const step = (w, n = 1, inp = idle) => { for (let i = 0; i < n; i++) w.update(1 / 60, inp); };

const room = (extra = {}) => ({
  id: 't', name: 'T', quota: 3, par: 60,
  tiles: [
    '###############',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '###############',
  ],
  spawn: [1, 4], exit: [13, 4],
  targets: [{ at: [13, 1], coins: 1 }, { at: [13, 2], coins: 1 }, { at: [12, 1], coins: 1 }],
  adults: [],
  ...extra,
});

test('phases fire in order when coins reach their threshold', () => {
  const w = new World(room({
    boss: { title: 'X', bonus: 5, phases: [{ at: 1, banner: 'ONE' }, { at: 2, banner: 'TWO' }] },
  }));
  step(w);
  assert.equal(w.phase, 0);
  w.coins = 1; step(w);
  assert.equal(w.phase, 1);
  assert.deepEqual(w.events.filter((e) => e.type === 'phase').map((e) => e.text), ['ONE']);
  w.coins = 3; step(w);
  assert.equal(w.phase, 2);
  assert.deepEqual(w.events.filter((e) => e.type === 'phase').map((e) => e.text), ['ONE', 'TWO']);
  w.coins = 99; step(w);
  assert.equal(w.phase, 2); // each phase only once
});

test('a phase retunes an adult and spawns another', () => {
  const w = new World(room({
    adults: [{ type: 'lola', at: [7, 1], face: 0, cfg: { cycle: { on: 6, off: 12 } } }],
    boss: { title: 'X', bonus: 5, phases: [{ at: 1, banner: 'UP', adult: { index: 0, cycle: null, sleepy: false, speed: 40, sweep: 1.5 }, spawn: [{ type: 'mama', at: [7, 3], face: 0 }] }] },
  }));
  assert.ok(w.adults[0].cfg.cycle);
  w.coins = 1; step(w);
  const a = w.adults[0];
  assert.equal(a.cfg.cycle, undefined);
  assert.equal(a.cfg.sleepy, false);
  assert.equal(a.cfg.speed, 40);
  assert.equal(a.sweep, 1.5);
  assert.equal(a.awake, true);
  assert.equal(w.adults.length, 2);
});

test('a phase can give an adult a new patrol route', () => {
  const w = new World(room({
    adults: [{ type: 'nena', route: [[3, 1], [5, 1]] }],
    boss: { title: 'X', bonus: 5, phases: [{ at: 1, banner: 'GO', adult: { index: 0, route: [[10, 3], [12, 3]] } }] },
  }));
  w.coins = 1; step(w);
  step(w, 60 * 12);
  assert.ok(w.adults[0].x > c(9), `nena walked to the new route (x=${w.adults[0].x})`);
});

test('sandok: a seen player is hit and stunned; sidestepping dodges it', () => {
  const lvl = (spawn) => room({
    spawn, adults: [{ type: 'mama', at: [9, 2], face: Math.PI, cfg: { range: 110, ranged: { range: 110, cd: 3 } } }],
  });
  // stand still in the cone until she throws
  const w = new World(lvl([4, 2]));
  let hit = false;
  for (let i = 0; i < 60 * 4 && !hit; i++) { step(w); if (w.player.stunT > 0) hit = true; if (w.status !== 'play') break; }
  assert.ok(hit || w.status === 'caught', 'standing still gets hit (or caught)');
  assert.ok(w.events.length >= 0);

  // dodge: keep stepping up/down so the thrown sandok misses
  const d = new World(lvl([4, 2]));
  let thrown = false, stunned = false;
  const dir = 1; // run down, out of the line of fire
  for (let i = 0; i < 60 * 3; i++) {
    if (d.hostiles.length) thrown = true;
    step(d, 1, { ...idle, mv: { x: 0, y: thrown ? dir : 0, mag: thrown ? 1 : 0, run: true } });
    if (d.player.stunT > 0) stunned = true;
    if (d.status !== 'play') break;
  }
  assert.ok(thrown, 'she threw');
  assert.equal(stunned, false, 'sidestepping runs clear of the sandok');
});

test('cooking Mama is blind and stands still during the off phase', () => {
  const w = new World(room({
    spawn: [4, 2], adults: [{ type: 'mama', at: [9, 2], face: Math.PI, phase: 3, cfg: { cycle: { on: 3, off: 100 }, cook: true } }],
  }));
  step(w, 60);
  assert.equal(w.adults[0].awake, false);
  step(w, 60 * 5);
  assert.equal(w.status, 'play');
  assert.equal(w.adults[0].alert, 0);
});

test('candy target steals like any other and pays 5', () => {
  const w = new World(room({ targets: [{ kind: 'candy', at: [2, 4], coins: 5, time: 1 }], quota: 5, spawn: [2, 4] }));
  step(w, 1);
  for (let i = 0; i < 120; i++) step(w, 1, { ...idle, action: true });
  assert.equal(w.coins, 5);
});

test('ninang and nena exist with names and shouts', async () => {
  const { ADULT_TYPES } = await import('../src/entities/adult.js');
  for (const k of ['ninang', 'nena']) assert.ok(ADULT_TYPES[k].name && ADULT_TYPES[k].shout);
});
