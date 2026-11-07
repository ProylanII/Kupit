import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TileMap, TILE } from '../src/world/tilemap.js';
import { hasLos, castCone, angDiff } from '../src/world/los.js';
import { Adult } from '../src/entities/adult.js';

const map = new TileMap([
  '#########',
  '#.......#',
  '#...#...#',
  '#.......#',
  '#########',
]);
const c = (t) => t * TILE + TILE / 2;

test('wall blocks line of sight, furniture does not', () => {
  assert.equal(hasLos(map, { x: c(1), y: c(1) }, { x: c(7), y: c(1) }), true);
  const m2 = new TileMap(['#####', '#.#.#', '#####']);
  assert.equal(hasLos(m2, { x: c(1), y: c(1) }, { x: c(3), y: c(1) }), false);
  const m3 = new TileMap(['#####', '#.T.#', '#####']);
  assert.equal(hasLos(m3, { x: c(1), y: c(1) }, { x: c(3), y: c(1) }), true);
});

test('cone rays are clipped by walls and capped at range', () => {
  const rays = castCone(map, c(1), c(1), 0, 0.5, 200, 8);
  assert.equal(rays.length, 9);
  for (const r of rays) assert.ok(r <= 200);
  assert.ok(rays[4] > 100 && rays[4] < 200); // straight ahead stops at far wall
});

test('angDiff wraps', () => {
  assert.ok(Math.abs(angDiff(Math.PI * 1.5) + Math.PI / 2) < 1e-9);
});

test('adult catches player in cone, not when facing away', () => {
  const p = { x: c(4), y: c(1) };
  const a = new Adult({ type: 'mama', at: [1, 1], face: 0 }, map);
  for (let i = 0; i < 120 && !a.caught; i++) a.update(1 / 60, p, null);
  assert.equal(a.caught, true);
  const b = new Adult({ type: 'mama', at: [1, 1], face: Math.PI }, map);
  for (let i = 0; i < 20; i++) b.update(1 / 60, p, null);
  assert.equal(b.caught, false);
});

test('sleeping lola is woken by running noise', () => {
  const lola = new Adult({ type: 'lola', at: [1, 1], face: 0, phase: 10 }, map); // off phase
  lola.update(1 / 60, { x: c(7), y: c(3) }, null);
  assert.equal(lola.awake, false);
  lola.update(1 / 60, { x: c(7), y: c(3) }, { x: c(2), y: c(1), r: 48 });
  assert.equal(lola.awake, true);
});
