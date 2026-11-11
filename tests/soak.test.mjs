// Headless soak run: every handmade level and a sample of generated houses, fast-forwarded with an idle
// player and with a wandering one. Catches stuck adults, patrols blocked forever, NaN positions and crashes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World } from '../src/game/world.js';
import { generateHouse } from '../src/game/house.js';
import { mulberry32 } from '../src/core/rng.js';
import { TILE } from '../src/world/tilemap.js';

const dir = new URL('../src/data/levels/', import.meta.url);
const files = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'));
const levels = files.map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
const houses = [];
for (let d = 1; d <= 5; d++) for (const seed of [4001, 4002]) houses.push(generateHouse(seed, d));
houses.push(generateHouse(4003, 4, { mutators: ['bisita', 'brownout'] }), generateHouse(4004, 3, { pasko: true }));

const finite = (...v) => v.every(Number.isFinite);

function soak(L, mode, seconds) {
  const w = new World(L, { lives: 99 });
  w.god = mode === 'idle'; // idle: just watch the house run
  const R = mulberry32(7);
  const moved = w.adults.map(() => 0);
  let last = w.adults.map((a) => [a.x, a.y]);
  let mv = { x: 0, y: 0, mag: 0, run: false };
  for (let i = 0; i < seconds * 60 && w.status === 'play'; i++) {
    if (mode === 'walk' && i % 45 === 0) { const a = R() * Math.PI * 2; mv = { x: Math.cos(a), y: Math.sin(a), mag: 1, run: R() < 0.3 }; }
    w.update(1 / 60, { mv, action: mode === 'walk' && R() < 0.3, actionPressed: mode === 'walk' && R() < 0.02, throwPressed: R() < 0.01, abilityPressed: R() < 0.005 });
    const p = w.player;
    assert.ok(finite(p.x, p.y), `${L.id} player NaN at ${i}`);
    w.adults.forEach((a, k) => {
      assert.ok(finite(a.x, a.y, a.a, a.alert), `${L.id} ${a.type} NaN at ${i}`);
      // a moving adult never stands inside a wall or a closed gate
      if (a.moving) assert.ok(!w.map.isSolidAt(a.x, a.y) || 'D'.includes(w.map.ch(Math.floor(a.x / TILE), Math.floor(a.y / TILE))), `${L.id} ${a.type} inside a solid tile`);
      moved[k] += Math.hypot(a.x - last[k][0], a.y - last[k][1]);
    });
    last = w.adults.map((a) => [a.x, a.y]);
  }
  return { w, moved };
}

test('soak: every level, idle 60s and wandering 40s', () => {
  for (const L of levels) {
    const { w, moved } = soak(L, 'idle', 60);
    // adults with a patrol route actually walk it (nobody is stuck in place for a minute)
    w.adults.forEach((a, k) => { if (a.pts.length > 1) assert.ok(moved[k] > 2 * TILE, `${L.id}: ${a.type} #${k} never moved`); });
    soak(L, 'walk', 40);
  }
});

test('soak: generated houses at every difficulty, with mutators and Pasko', () => {
  for (const L of houses) {
    const { w, moved } = soak(L, 'idle', 45);
    w.adults.forEach((a, k) => { if (a.pts.length > 1) assert.ok(moved[k] > TILE, `${L.id}: ${a.type} #${k} never moved`); });
    soak(L, 'walk', 30);
  }
});
