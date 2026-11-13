// Design overhaul Phase 4B: A6 real light on night levels (src/world/light.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TILE, TileMap } from '../src/world/tilemap.js';
import { World } from '../src/game/world.js';
import { DARK_MUL, BROWNOUT_MUL, isWindow, windowLights, lightSources, sightMul, inLight } from '../src/world/light.js';

const c = (t) => t * TILE + TILE / 2;
const idle = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false, throwPressed: false };
const hall = (extra = {}) => ({
  id: 'dark', name: 'DARK', quota: 1, par: 60,
  tiles: ['##############', '#............#', '#............#', '##############'],
  spawn: [1, 1], exit: [12, 2], targets: [{ at: [12, 1], coins: 1 }], adults: [], ...extra,
});

test('A6: by day the range is unchanged', () => {
  const w = new World(hall({ adults: [{ type: 'mama', at: [8, 1], face: Math.PI }] }));
  const m = w.adults[0];
  w.player.x = m.x - m.range * 0.8; w.player.y = m.y;
  w.update(1 / 60, idle);
  assert.equal(w.player.darkMul ?? 1, 1);
  assert.ok(m.canSee(w.player));
});

test('A6: at night, in the dark, an adult only sees you from closer', () => {
  const w = new World(hall({ night: true, adults: [{ type: 'mama', at: [10, 1], face: Math.PI }] }));
  const m = w.adults[0];
  w.lights = []; w.windowPools = [];
  w.player.x = m.x - m.range * 0.8; w.player.y = m.y;
  w.player.darkMul = sightMul(w, [], w.player);
  assert.equal(w.player.darkMul, DARK_MUL);
  assert.equal(m.canSee(w.player), false, 'too far to see in the dark');
  w.player.x = m.x - m.range * 0.5;
  assert.ok(m.canSee(w.player), 'close enough');
});

test('A6: a pool of light shows you at full range; a TV that is on is one', () => {
  const w = new World(hall({ night: true, devices: [{ kind: 'tv', at: [4, 1] }], adults: [{ type: 'mama', at: [10, 1], face: Math.PI }] }));
  w.windowPools = [];
  const d = w.devices[0];
  d.on = true;
  const src = lightSources(w);
  assert.ok(src.some((s) => s.kind === 'device'));
  assert.equal(sightMul(w, src, { x: d.x + 8, y: d.y }), 1);
  assert.equal(sightMul(w, src, { x: d.x + 60, y: d.y }), DARK_MUL);
});

test('A6: brownout is darker, has no moonlight, and the adults carry candles', () => {
  const w = new World(hall({ night: true, brownout: true, adults: [{ type: 'mama', at: [10, 1], face: Math.PI }, { type: 'aso', at: [6, 2] }] }));
  w.windowPools = [{ x: c(2), y: c(1), r: 15, kind: 'window' }];
  const src = lightSources(w);
  assert.ok(!src.some((s) => s.kind === 'window'));
  assert.equal(src.filter((s) => s.kind === 'candle').length, 1, 'Mama has a candle; the dog does not');
  assert.equal(sightMul(w, src, { x: c(2), y: c(1) }), BROWNOUT_MUL);
});

test('A6: a lightning flash lights everything for a moment', () => {
  const w = new World(hall({ night: true, storm: { every: 6, dur: 1.5 } }));
  w.flashT = 0.2;
  assert.equal(sightMul(w, [], w.player), 1);
});

test('A6: window pools sit under the windows the background draws', () => {
  const lvl = JSON.parse(readFileSync(new URL('../src/data/levels/05-gabi.json', import.meta.url)));
  const map = new TileMap(lvl.tiles);
  const pools = windowLights(map);
  for (const p of pools) assert.ok(isWindow(map, Math.floor(p.x / TILE), Math.floor((p.y - 20) / TILE)));
  assert.ok(inLight(pools, pools[0]?.x ?? -999, pools[0]?.y ?? -999) || pools.length === 0);
});

test('A6: the world sets darkMul on the kid every frame of a night level', () => {
  const w = new World(hall({ night: true }));
  w.windowPools = [];
  w.update(1 / 60, idle);
  assert.equal(w.player.darkMul, DARK_MUL);
});
