import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TILE } from '../src/world/tilemap.js';
import { World } from '../src/game/world.js';

const c = (t) => t * TILE + TILE / 2;
const idle = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false, throwPressed: false, abilityPressed: false };
const step = (w, n = 1, inp = idle) => { for (let i = 0; i < n && w.status === 'play'; i++) w.update(1 / 60, inp); };
const hideIn = (w, h) => { w.player.x = h.x; w.player.y = h.y; w.interact({ kind: 'hide', obj: h }); };

const room = (extra = {}) => ({
  id: 't', name: 'T', quota: 1, par: 60,
  tiles: [
    '###############',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '###############',
  ],
  spawn: [1, 5], exit: [13, 5],
  targets: [{ at: [13, 1], coins: 1 }],
  adults: [],
  ...extra,
});

test('a boss checks the hiding spots near a noise and finds you; a normal adult does not', () => {
  for (const checks of [true, false]) {
    const w = new World(room({
      hide: [{ kind: 'box', at: [10, 3] }],
      adults: [{ type: 'mama', at: [2, 1], face: Math.PI, cfg: checks ? { checksHides: true } : {} }],
    }));
    hideIn(w, w.hides[0]);
    w.adults[0].investigate(c(10), c(2)); // heard something next to the box
    step(w, 60 * 12);
    assert.equal(w.status, checks ? 'caught' : 'play', `checksHides=${checks}`);
  }
});

test('a boss that loses you mid-chase searches the nearby hiding spots', () => {
  const w = new World(room({
    hide: [{ kind: 'basket', at: [7, 3] }],
    adults: [{ type: 'mama', at: [2, 1], face: 0, cfg: { checksHides: true } }],
  }));
  const m = w.adults[0];
  hideIn(w, w.hides[0]);
  m.state = 'chase'; m.alert = 1; m.last = { x: c(7), y: c(2) }; m.lostT = 6; // lost you right by the basket
  step(w, 60 * 12);
  assert.equal(w.status, 'caught');
  assert.equal(w.catcher, m);
});

test('hunting boss tracks down a player hiding across the room', () => {
  const lvl = (hunt) => room({
    hide: [{ kind: 'box', at: [12, 4] }],
    adults: [{ type: 'mama', at: [2, 1], face: Math.PI, cfg: { checksHides: true, ...(hunt ? { hunt: { every: 3, spread: 20 } } : {}) } }],
  });
  const w = new World(lvl(true));
  hideIn(w, w.hides[0]);
  step(w, 60 * 25);
  assert.equal(w.status, 'caught');
  const calm = new World(lvl(false));
  hideIn(calm, calm.hides[0]);
  step(calm, 60 * 25);
  assert.equal(calm.status, 'play');
});

test('escape timer: reach the exit in time or get caught (god mode ignores it)', () => {
  const lvl = room({
    targets: [{ at: [2, 5], coins: 1 }],
    adults: [{ type: 'mama', at: [13, 1], face: 0 }],
    boss: { title: 'X', index: 0, bonus: 5, phases: [{ at: 1, banner: 'TAKBO!', escape: 10 }] },
  });
  const w = new World(lvl);
  w.coins = 1; step(w);
  assert.ok(w.escapeT > 9);
  step(w, 60 * 11);
  assert.equal(w.status, 'caught');
  assert.equal(w.reason, 'escape');
  const g = new World(lvl);
  g.god = true; g.coins = 1;
  step(g, 60 * 11);
  assert.equal(g.status, 'play');
});

test('a light sleeper wakes much sooner if you rummage next to her', () => {
  const wakeAfter = (steal) => {
    const w = new World(room({
      spawn: [6, 3], targets: [{ at: [6, 3], coins: 1, time: 99 }],
      adults: [{ type: 'lola', at: [8, 3], face: Math.PI, phase: 5, cfg: { cycle: { on: 5, off: 8 }, lightSleeper: true } }],
    }));
    step(w);
    let t = 0;
    while (!w.adults[0].awake && t < 20) { w.update(1 / 60, { ...idle, action: steal }); t += 1 / 60; }
    return t;
  };
  const idleT = wakeAfter(false), stealT = wakeAfter(true);
  assert.ok(stealT < idleT * 0.6, `steal ${stealT.toFixed(1)}s vs idle ${idleT.toFixed(1)}s`);
});

test('tracker dog follows the scent trail you leave', () => {
  const w = new World(room({
    spawn: [3, 1],
    adults: [{ type: 'aso', at: [3, 4], face: Math.PI, cfg: { tracker: true, range: 1 } }], // nearly blind: nose only
  }));
  const dog = w.adults[0];
  // walk down past the dog, then far to the right
  for (let i = 0; i < 70; i++) w.update(1 / 60, { ...idle, mv: { x: 0, y: 1, mag: 1, run: false } });
  for (let i = 0; i < 60 * 6; i++) w.update(1 / 60, { ...idle, mv: { x: 1, y: 0, mag: 1, run: false } });
  step(w, 60 * 4);
  const fromHome = Math.hypot(dog.x - c(3), dog.y - c(4));
  assert.ok(fromHome > 100 && dog.x > c(8), `dog followed the trail to the right (moved ${fromHome.toFixed(0)}px, x=${dog.x.toFixed(0)})`);
});

test('a final phase can drop a shutter (an open gate closes); the lever opens it again', () => {
  const tiles = ['###############', ...Array(17).fill('#.............#'), '#######g#######', '#.............#', '#.............#', '###############'];
  const L = { id: 'shutter', name: 'X', tiles, spawn: [2, 2], exit: [12, 20], quota: 2, par: 60,
    targets: [{ kind: 'purse', at: [5, 5], coins: 2 }], switches: [{ at: [1, 13], gates: [[7, 18]], time: 8 }],
    boss: { title: 'X', index: 0, bonus: 5, phases: [{ at: 2, banner: 'SHUTTER!', escape: 30, close: [[7, 18]] }] },
    adults: [{ type: 'nena', at: [12, 2], face: 0 }] };
  const w = new World(L);
  w.god = true;
  assert.equal(w.map.ch(7, 18), 'g');
  w.coins = L.quota; step(w);
  assert.equal(w.map.ch(7, 18), 'G', 'shutter closed');
  assert.ok(w.escapeT > 0);
  w.toggleSwitch(w.switches[0], true);
  assert.equal(w.map.ch(7, 18), 'g', 'lever opens it');
});

test('every boss level ends with an escape phase and a boss that checks hiding spots', () => {
  const dir = new URL('../src/data/levels/', import.meta.url);
  const files = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'));
  let bosses = 0;
  for (const f of files) {
    const L = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    if (!L.boss) continue;
    bosses++;
    const last = L.boss.phases[L.boss.phases.length - 1];
    assert.ok(last.escape >= 20, `${f} final phase has an escape timer`);
    assert.equal(last.at, L.quota, `${f} escape starts when the quota is met`);
    const boss = L.adults[L.boss.index ?? 0];
    assert.ok(boss.cfg?.checksHides || L.adults.some((a) => a.cfg?.tracker), `${f} boss checks hides (or tracks)`);
  }
  assert.equal(bosses, 5);
});
