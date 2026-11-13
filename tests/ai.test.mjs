// Design overhaul Phase 4A: the adult AI items A1-A5 from docs/VISUAL_UI_AI_AUDIT.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE } from '../src/world/tilemap.js';
import { World } from '../src/game/world.js';
import { delta } from '../src/game/hinala.js';

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

test('A5: evidence (spills and found things) feeds HINALA', () => {
  const d = delta({ evidence: 2 });
  assert.equal(d.parts.find((p) => p.id === 'evidence').n, 6);
});
