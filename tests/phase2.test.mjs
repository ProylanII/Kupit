import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TileMap, TILE } from '../src/world/tilemap.js';
import { findPath } from '../src/world/pathfind.js';
import { hasLos } from '../src/world/los.js';
import { World } from '../src/game/world.js';

const c = (t) => t * TILE + TILE / 2;
const idle = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false, throwPressed: false };
const step = (w, n = 1, inp = idle) => { for (let i = 0; i < n; i++) w.update(1 / 60, inp); };
const press = (w) => { w.update(1 / 60, { ...idle, action: true, actionPressed: true }); };

const room = (extra = {}) => ({
  id: 't', name: 'T', quota: 1, par: 60,
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

test('A* finds a path around walls and respects passable()', () => {
  const m = new TileMap(['#####', '#...#', '#.#.#', '#...#', '#####']);
  const p = findPath(m, 1, 1, 3, 3);
  assert.ok(p && p.length === 5);
  assert.equal(findPath(m, 1, 1, 2, 2), null); // goal is a wall
});

test('closed door blocks sight and movement; open door does not', () => {
  const w = new World(room());
  assert.equal(w.map.tileSolid(5, 3), true);
  assert.equal(hasLos(w.map, { x: c(5), y: c(1) }, { x: c(5), y: c(5) }), false);
  w.map.set(5, 3, 'd');
  assert.equal(w.map.tileSolid(5, 3), false);
  assert.equal(hasLos(w.map, { x: c(5), y: c(1) }, { x: c(5), y: c(5) }), true);
});

test('player opens a door with the action button; locked door needs the key', () => {
  const w = new World(room({ spawn: [5, 4], locks: [{ at: [5, 3], key: 'red' }], items: [{ kind: 'key', color: 'red', at: [7, 4] }] }));
  assert.equal(w.context().kind, 'locked');
  press(w);
  assert.equal(w.map.ch(5, 3), 'D');
  w.player.x = c(7); step(w); // walk onto key
  assert.ok(w.player.keys.has('red'));
  w.player.x = c(5); step(w);
  assert.equal(w.context().kind, 'door');
  press(w);
  assert.equal(w.map.ch(5, 3), 'd');
});

test('adult paths through a closed door (opening it) to investigate a noise', () => {
  const w = new World(room({ adults: [{ type: 'mama', at: [5, 1], face: 0 }] }));
  const mama = w.adults[0];
  w.noise({ x: c(5), y: c(5), r: 200, lure: true });
  for (const nz of w.noises) mama.hear(nz);
  assert.equal(mama.state, 'investigate');
  step(w, 60 * 4);
  assert.equal(w.map.ch(5, 3), 'd');
  assert.ok(mama.y > c(3), 'mama walked through the doorway');
});

test('thrown tsinelas lures an adult to where it lands', () => {
  const w = new World(room({ spawn: [1, 1], items: [{ kind: 'tsinelas', at: [1, 1] }], adults: [{ type: 'mama', at: [8, 2], face: 3.14 }] }));
  step(w);
  assert.deepEqual(w.player.items, ['tsinelas']);
  w.player.dir = 2; // face right
  w.update(1 / 60, { ...idle, throwPressed: true });
  step(w, 60);
  assert.equal(w.projectiles.length, 0);
  assert.ok(['investigate', 'search'].includes(w.adults[0].state));
});

test('hiding unseen makes the player invisible; hiding in view does not', () => {
  const lvl = room({ spawn: [2, 1], hide: [{ at: [2, 1], kind: 'box' }], adults: [{ type: 'mama', at: [8, 1], face: 0 }] });
  const w = new World(lvl);
  press(w);
  assert.ok(w.player.hidden);
  w.adults[0].a = Math.PI; // she turns toward the box
  step(w, 120);
  assert.equal(w.status, 'play');

  const w2 = new World({ ...lvl, adults: [{ type: 'mama', at: [6, 1], face: Math.PI }] });
  step(w2, 10);
  press(w2); // hides while she is watching
  assert.ok(w2.adults[0].sawHide);
});

test('chase: spotted adult runs over and catches the player', () => {
  const w = new World(room({ spawn: [2, 4], adults: [{ type: 'mama', at: [6, 5], face: Math.PI }] }));
  step(w, 60 * 5);
  assert.equal(w.status, 'caught');
  assert.equal(w.reason, 'seen');
});

test('lego trap stuns and makes noise; switch opens a gate', () => {
  const w = new World(room({
    tiles: ['#######', '#..G..#', '#######'], spawn: [1, 1], exit: [5, 1],
    traps: [{ kind: 'lego', at: [2, 1] }], switches: [{ at: [1, 1], gates: [[3, 1]] }], targets: [],
  }));
  press(w);
  assert.equal(w.map.ch(3, 1), 'g');
  w.player.x = c(2); step(w);
  assert.ok(w.player.stunT > 0);
});

test('patience runs out -> caught by time', () => {
  const w = new World(room({ patience: 1, adults: [{ type: 'mama', at: [1, 1], face: -1.57 }] }));
  step(w, 70);
  assert.equal(w.status, 'caught');
  assert.equal(w.reason, 'time');
});

test('dog goes for thrown pandesal and eats it', () => {
  const w = new World(room({ spawn: [1, 5], items: [{ kind: 'pandesal', at: [1, 5] }], adults: [{ type: 'aso', at: [8, 5], face: 0 }] }));
  step(w);
  w.player.dir = 2;
  w.update(1 / 60, { ...idle, throwPressed: true });
  step(w, 60 * 4);
  assert.equal(w.adults[0].state, 'eat');
  assert.equal(w.foods.length, 0);
});
