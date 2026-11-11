// Rules that the help text promises (Phase 2 review): the exact SILENT star, dinner time, spawn fairness.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, STEALTH_ALERT, SPAWN_GRACE } from '../src/game/world.js';
import { TILE } from '../src/world/tilemap.js';

const c = (t) => t * TILE + TILE / 2;
const idle = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false, throwPressed: false, abilityPressed: false };
const step = (w, n = 1, inp = idle) => { for (let i = 0; i < n; i++) w.update(1 / 60, inp); };
const room = (o = {}) => ({
  id: 'r', name: 'R', quota: 1, par: 60,
  tiles: ['############', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '############'],
  spawn: [1, 3], exit: [10, 5], targets: [{ kind: 'purse', at: [5, 3], coins: 3, time: 1 }], adults: [], ...o,
});

test('SILENT star: a glance (meter under a third) keeps it, a third loses it, a catch loses it', () => {
  const w = new World(room({ adults: [{ type: 'mama', at: [8, 3], face: Math.PI }] }), { lives: 3 });
  w.adults[0].alert = STEALTH_ALERT - 0.01; step(w);
  assert.ok(w.stealthOk, 'a quick ? is fine');
  w.adults[0].alert = STEALTH_ALERT + 0.02; step(w); // (the meter decays 0.015 per step on patrol)
  assert.ok(!w.stealthOk, 'a third of the meter loses it');
  const w2 = new World(room({ adults: [{ type: 'mama', at: [8, 3], face: Math.PI }] }), { lives: 3 });
  w2.caught(w2.adults[0]);
  assert.ok(!w2.stealthOk, 'a catch loses it');
  w2.coins = 9; w2.devGoToExit(); w2.finish();
  assert.equal(w2.result.stealth, false);
  assert.equal(w2.result.stars, 1 + 1 + 0);
});

test('KAIN NA: when the dinner bar runs out the level is over, chances or not', () => {
  const w = new World(room({ patience: 2, adults: [{ type: 'mama', at: [8, 1], face: 0 }] }), { lives: 3 });
  step(w, 2 * 60 + 2);
  assert.equal(w.status, 'caught');
  assert.equal(w.reason, 'time');
  assert.equal(w.catches, 0, 'no chance was used: dinner ends it outright');
  assert.equal(w.catcher.type, 'mama');
});

test('an adult who joins in a boss phase cannot see for a moment, even if she appears next to you', () => {
  const L = room({
    quota: 3, adults: [{ type: 'lola', at: [9, 5], face: 0 }],
    boss: { title: 'B', index: 0, bonus: 1, phases: [{ at: 3, banner: 'MAMA!', spawn: [{ type: 'mama', at: [2, 3], face: 0 }] }] },
  });
  const w = new World(L, { lives: 3 });
  w.player.x = c(2); w.player.y = c(3);
  w.targets[0].done = true; w.coins = 3;
  step(w);
  assert.equal(w.adults.length, 2);
  const mama = w.adults[1];
  assert.ok(mama.freezeT > 0 && mama.freezeT <= SPAWN_GRACE);
  step(w, Math.floor(SPAWN_GRACE * 60) - 2);
  assert.equal(w.status, 'play');
  assert.equal(mama.alert, 0, 'blind while arriving');
  step(w, 60);
  assert.ok(mama.alert > 0 || mama.state === 'chase', 'then she sees you');
});
