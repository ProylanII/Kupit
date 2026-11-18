// The arcade pass (2026-11-18): aimed throws, and the parts of the game it cut staying cut.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World, THROW_MAX, AIM_MIN } from '../src/game/world.js';
import { fresh, migrate, SAVE_VERSION } from '../src/core/save.js';

const idle = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false, throwPressed: false, abilityPressed: false };
const step = (w, n = 1, inp = idle) => { for (let i = 0; i < n; i++) w.update(1 / 60, inp); };
const room = (o = {}) => ({
  id: 'r', name: 'R', quota: 1, par: 60,
  tiles: ['##############', '#............#', '#............#', '#............#', '#............#', '#............#', '##############'],
  spawn: [2, 3], exit: [12, 5], targets: [{ kind: 'purse', at: [11, 1], coins: 3, time: 1 }], adults: [], ...o,
});
const withSlipper = () => { const w = new World(room()); w.player.items = ['tsinelas']; w.player.dir = 2; return w; };
const landed = (w) => w.items.find((i) => i.thrown);

test('aimed throw: it lands where you point, not at full range', () => {
  const w = withSlipper(), p = w.player, at = { x: p.x + 30, y: p.y + 12 };
  const a = w.aimPreview(at);
  assert.ok(Math.hypot(a.x - at.x, a.y - at.y) < 3, 'the preview mark sits on the point');
  step(w, 1, { ...idle, throwPressed: true, aimAt: at });
  step(w, 60);
  const s = landed(w);
  assert.ok(s, 'the slipper landed');
  assert.ok(Math.hypot(s.x - at.x, s.y - at.y) < 4, `landed ${s.x.toFixed(0)},${s.y.toFixed(0)}, aimed ${at.x},${at.y}`);
});

test('aimed throw: a point past the range is cut to the range; a point on Jun is a short toss, not zero', () => {
  const w = withSlipper(), p = w.player;
  const far = w.aimPreview({ x: p.x + 500, y: p.y - 2 });
  assert.ok(Math.abs(far.x - p.x - THROW_MAX) < 3, 'never past the range');
  const near = w.aimPreview({ x: p.x + 3, y: p.y - 2 });
  assert.ok(Math.abs(near.x - p.x - AIM_MIN) < 3, 'at least a short toss');
  const wall = w.aimPreview({ x: p.x - 200, y: p.y - 2 });
  assert.ok(wall.hitWall && wall.x >= 16 && p.x - wall.x < THROW_MAX, 'walls still stop it');
});

test('no aim point: the old throw, straight ahead as far as it goes', () => {
  const w = withSlipper(), p = w.player, x0 = p.x;
  step(w, 1, { ...idle, throwPressed: true });
  step(w, 60);
  assert.ok(Math.abs(landed(w).x - x0 - THROW_MAX) < 4);
});

test('the cut systems stay cut: no HINALA blocks, no NEW IN THE HOUSE, no Random House in the save', () => {
  const dir = new URL('../src/data/levels/', import.meta.url);
  for (const f of JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'))) {
    const L = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    assert.ok(!L.hinala && !L.news, `${f} has no suspicion changes`);
  }
  const s = fresh();
  for (const k of ['hinala', 'hinalaAt', 'hinalaPlay', 'houses', 'houseDiff', 'daily', 'mutators', 'streak', 'houseDay']) assert.ok(!(k in s), k);
  assert.equal(SAVE_VERSION, 7);
  const old = migrate({ v: 6, bank: 12, hinala: 60, houses: 4, outfits: ['basic', 'jersey'], outfit: 'jersey' });
  assert.equal(old.bank, 12);
  assert.ok(!('hinala' in old) && !('houses' in old));
  assert.equal(old.outfit, 'jersey', 'a look earned the old way stays owned');
});
