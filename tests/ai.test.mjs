// Design overhaul Phase 4A: the adult AI items A1-A5 from docs/VISUAL_UI_AI_AUDIT.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE } from '../src/world/tilemap.js';
import { World } from '../src/game/world.js';

const c = (t) => t * TILE + TILE / 2;
const idle = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false, throwPressed: false };
const step = (w, n = 1, inp = idle) => { for (let i = 0; i < n; i++) w.update(1 / 60, inp); };

const open = (extra = {}) => ({
  id: 'ai', name: 'AI', quota: 1, par: 60,
  tiles: [
    '###############',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '###############',
  ],
  spawn: [1, 1], exit: [13, 5],
  targets: [{ at: [13, 1], coins: 1 }],
  adults: [],
  ...extra,
});
const twoRooms = (extra = {}) => ({
  id: 'ai2', name: 'AI2', quota: 1, par: 60,
  tiles: [
    '###########',
    '#.........#',
    '#.........#',
    '#####D#####',
    '#.........#',
    '#.........#',
    '###########',
  ],
  spawn: [1, 5], exit: [9, 5],
  targets: [{ at: [9, 1], coins: 1 }],
  adults: [],
  ...extra,
});

test('A1: the adult who comes to look at a thrown tsinelas takes it away (evidence)', () => {
  const w = new World(open({ adults: [{ type: 'mama', at: [9, 1], face: 0 }] }));
  w.player.items.push('tsinelas');
  w.player.dir = 2; // facing right, toward Mama's back
  w.update(1 / 60, { ...idle, throwPressed: true });
  step(w, 60 * 6);
  assert.equal(w.items.filter((i) => i.kind === 'tsinelas').length, 0, 'the slipper is gone');
  assert.equal(w.stats.evidence, 1);
});

test('A1: a thrown slipper nobody comes for can still be picked up', () => {
  const w = new World(open());
  w.player.items.push('tsinelas');
  w.player.dir = 2;
  w.update(1 / 60, { ...idle, throwPressed: true });
  step(w, 60 * 2);
  assert.equal(w.items.filter((i) => i.kind === 'tsinelas').length, 1);
});

test('A3: a search walks to spots in the same room, then the adult stays wary', () => {
  const w = new World(open({ adults: [{ type: 'mama', at: [7, 3], face: 0 }] }));
  const m = w.adults[0];
  w.player.x = c(1); w.player.y = c(1);
  m.beginSearch(w, m.x, m.y);
  assert.equal(m.state, 'search');
  assert.equal(m.searchPts.length, 3, 'Mama is thorough: 3 spots');
  for (const p of m.searchPts) assert.ok(Math.abs(p.tx - 7) <= 3 && Math.abs(p.ty - 3) <= 3);
  assert.ok(m.wary > 0);
  const tatay = new World(open({ adults: [{ type: 'tatay', at: [7, 3], face: 0 }] })).adults[0];
  tatay.beginSearch({ rng: Math.random, player: {} }, tatay.x, tatay.y);
  assert.equal(tatay.searchPts.length, 2, 'Tatay is quick: 2 spots');
});

test('A3: search spots never lie through a doorway', () => {
  const w = new World(twoRooms({ adults: [{ type: 'mama', at: [5, 5], face: 0 }] }));
  const m = w.adults[0];
  for (let i = 0; i < 20; i++) {
    m.beginSearch(w, c(5), c(4));
    for (const p of m.searchPts) assert.ok(p.ty >= 4, `spot ${p.tx},${p.ty} is in the bottom room`);
  }
});

test('A2: an ordinary adult sometimes checks the hiding spot right where she lost you', () => {
  const lvl = open({ hide: [{ at: [5, 3] }], adults: [{ type: 'mama', at: [9, 3], face: 3.14 }] });
  let checked = 0;
  for (let s = 0; s < 40; s++) {
    const w = new World({ ...lvl, seed: s });
    const m = w.adults[0];
    if (m.lightInspect(w, c(5), c(3))) { checked++; assert.equal(m.state, 'inspect'); }
  }
  assert.ok(checked > 5 && checked < 30, `checked ${checked}/40 (about 40%)`);
});

test('A2: sleepers, dogs and bosses with full inspection do not use the light check', () => {
  const w = new World(open({ hide: [{ at: [5, 3] }], adults: [{ type: 'lola', at: [9, 3] }, { type: 'aso', at: [9, 4] }] }));
  for (let i = 0; i < 20; i++) for (const a of w.adults) assert.equal(a.lightInspect(w, c(5), c(3)), false);
});

test('A4: the same slipper trick twice only gets a look; the third time they come for the thrower', () => {
  const w = new World(open({ adults: [{ type: 'mama', at: [12, 3], face: 3.14 }] }));
  const m = w.adults[0];
  const lure = { x: c(8), y: c(3), r: 200, lure: true, thrown: true, origin: { x: c(2), y: c(2) } };
  m.hear(lure, 10);
  assert.equal(m.state, 'investigate');
  m.state = 'patrol';
  m.hear(lure, 10);
  assert.equal(m.state, 'patrol', 'second time: a look only');
  m.hear(lure, 10);
  assert.equal(m.state, 'investigate');
  assert.equal(m.target.x, c(2), 'third time: she walks to where it came from');
  assert.ok(m.wary > 0);
});

test('A4: a radio someone switched off brings the next listener straight back, warier', () => {
  const w = new World(open({ spawn: [13, 5], hide: [{ at: [13, 5] }], devices: [{ kind: 'radio', at: [6, 3], dur: 30 }], adults: [{ type: 'mama', at: [10, 3], face: 3.14 }] }));
  w.player.hidden = w.hides[0]; // out of the way
  const m = w.adults[0], d = w.devices[0];
  d.on = true; d.pulse = 0;
  step(w, 60 * 5);
  assert.equal(d.on, false, 'she switched it off');
  assert.equal(d.caught, 1);
  m.state = 'patrol'; m.wary = 0;
  d.on = true; d.t = 0; d.pulse = 0;
  step(w, 2);
  assert.equal(m.state, 'investigate');
  assert.ok(m.wary > 0);
});

test('A5: Mama notices a door Jun left open, looks in the room beyond and shuts it (evidence)', () => {
  const w = new World(twoRooms({ spawn: [9, 5], hide: [{ at: [9, 5] }], adults: [{ type: 'mama', at: [1, 2], route: [[1, 2], [8, 2]], face: 0 }] }));
  w.player.hidden = w.hides[0];
  w.map.set(5, 3, 'd');
  w.playerOpened.add('5,3');
  step(w, 60 * 6);
  assert.equal(w.stats.evidence, 1);
  assert.equal(w.playerOpened.size, 0);
  assert.equal(w.map.ch(5, 3), 'D', 'closed again');
});

// ---- Phase 4B-2: A7, A8, A9, A11, A13, A14-A17

test('A7: waits at route points vary a little, the same way every run (seeded)', () => {
  const run = () => {
    const w = new World(open({ adults: [{ type: 'mama', at: [3, 3], route: [[3, 3, 2], [9, 3, 2]] }], seed: 7 }));
    w.player.hidden = { kind: 'box', x: 0, y: 0 };
    const waits = [];
    for (let i = 0; i < 60 * 30; i++) { const before = w.adults[0].wait; w.update(1 / 60, idle); const a = w.adults[0]; if (a.wait > before + 0.5) waits.push(+a.wait.toFixed(3)); }
    return waits;
  };
  const a = run(), b = run();
  assert.deepEqual(a, b);
  assert.ok(a.length >= 3 && a.every((x) => x >= 1.69 && x <= 2.31), JSON.stringify(a));
  assert.ok(new Set(a).size > 1, 'not all the same');
});

test('A8: two adults meeting in a corridor do not walk through each other forever; one waits', () => {
  const w = new World(open({ adults: [{ type: 'mama', at: [2, 3], route: [[2, 3], [12, 3]] }, { type: 'tita', at: [12, 3], route: [[12, 3], [2, 3]], cycle: { on: 99, off: 1 } }] }));
  w.player.hidden = { kind: 'box', x: 0, y: 0 };
  let yielded = false;
  for (let i = 0; i < 60 * 8; i++) { w.update(1 / 60, idle); if (w.adults.some((a) => a.yieldT > 0)) yielded = true; }
  assert.ok(yielded, 'someone stepped aside for a moment');
});

test('A8: the tricycle stops for a person in the road and honks', () => {
  const w = new World(open({ adults: [{ type: 'trike', at: [2, 3], route: [[2, 3], [12, 3]] }, { type: 'bisita', at: [4, 3] }] }));
  const t = w.adults[0], ev = [];
  w.on?.((e) => ev.push(e.type));
  for (let i = 0; i < 60; i++) w.update(1 / 60, idle);
  assert.ok(t.x < c(4) - 8, 'it did not drive through the guest');
  assert.ok(t.say?.text === 'BEEP BEEP!' || t.yieldT > 0);
});

test('A9: the outer edge of a cone fills at half rate', () => {
  const mk = (dx) => {
    const w = new World(open({ adults: [{ type: 'mama', at: [2, 3], face: 0 }] }));
    const m = w.adults[0];
    w.player.x = m.x + dx; w.player.y = m.y;
    m.alert = 0;
    w.update(1 / 60, idle);
    return m.alert;
  };
  const mid = mk(40), far = mk(64);
  assert.ok(far > 0 && far < mid * 0.6, `far ${far} vs mid ${mid}`);
});

test('A11: bumping into a busy adult startles her', () => {
  const w = new World(open({ adults: [{ type: 'mama', at: [6, 3], face: 0, route: [[6, 3, 99, 0, 'luto']] }] }));
  const m = w.adults[0];
  w.player.x = m.x - 6; w.player.y = m.y;
  w.update(1 / 60, idle);
  assert.ok(m.alert >= 0.8);
});

test('A13: a woken sleeper stays up half again as long and then sleeps lightly', () => {
  const w = new World(open({ adults: [{ type: 'lola', at: [10, 3], phase: 9.5 }] }));
  const l = w.adults[0];
  w.player.hidden = { kind: 'box', x: 0, y: 0 };
  w.update(1 / 60, idle);
  assert.equal(l.awake, false);
  l.hear({ x: l.x, y: l.y, r: 100 }, 5);
  assert.equal(l.awake, true);
  assert.equal(l.cyc.on, 9 * 1.5);
  assert.equal(l.cfg.lightSleeper, true);
});

test('A13/A16: later cycles vary; Tita takes quick texts and long calls, and the phone rings first', () => {
  const w = new World(open({ adults: [{ type: 'tita', at: [10, 3] }], seed: 3 }));
  const t = w.adults[0], offs = new Set();
  w.player.hidden = { kind: 'box', x: 0, y: 0 };
  let rings = 0;
  const say = () => t.say?.text === 'KRING KRING!';
  let was = false;
  for (let i = 0; i < 60 * 80; i++) { w.update(1 / 60, idle); if (t.cyc) offs.add(+t.cyc.off.toFixed(2)); const now = say(); if (now && !was) rings++; was = now; }
  assert.ok([...offs].some((o) => o <= 2.1) && [...offs].some((o) => o >= 5.5), [...offs].join(','));
  assert.ok(rings >= 4);
});

test('A15: Lola does not chase; she calls out and the others come to her', () => {
  const w = new World(open({ adults: [{ type: 'lola', at: [6, 3], face: Math.PI, cycle: { on: 99, off: 1 } }, { type: 'mama', at: [12, 1], face: 0 }] }));
  const l = w.adults[0], m = w.adults[1];
  w.player.x = l.x - 30; w.player.y = l.y;
  for (let i = 0; i < 60 * 2; i++) w.update(1 / 60, idle);
  assert.notEqual(l.state, 'chase');
  assert.equal(m.state, 'investigate');
  assert.ok(Math.hypot(m.target.x - l.x, m.target.y - l.y) < 20, 'Mama goes to where Lola called from');
});

test('A8: family members passing swap a line of small talk', () => {
  const lvl = open({ adults: [{ type: 'mama', at: [6, 3], face: 0 }, { type: 'tatay', at: [7, 3], face: Math.PI }] });
  const w = new World(lvl);
  w.player.hidden = { kind: 'box', x: 0, y: 0 };
  for (let i = 0; i < 60 * 9; i++) w.update(1 / 60, idle);
  assert.ok(['KUMAIN KA NA?', 'ANG INIT NGAYON!', 'NAKITA MO ANG REMOTE?'].includes(w.adults[0].say?.text) || w.chatT > 0 && w.chatT <= 25);
});
