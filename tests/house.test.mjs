import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateHouse, dailySeed, mulberry32 } from '../src/game/house.js';
import { validateLevel, idleSafe } from '../src/game/validate.js';

test('same seed + difficulty gives the identical house', () => {
  assert.deepEqual(generateHouse(1234, 3), generateHouse(1234, 3));
  assert.notDeepEqual(generateHouse(1234, 3).tiles, generateHouse(1235, 3).tiles);
});

test('every difficulty yields valid, solvable, spawn-safe houses (many seeds)', () => {
  let big = 0, locked = 0, total = 0;
  for (let diff = 1; diff <= 5; diff++) {
    for (let seed = 1000; seed < 1040; seed++) {
      const L = generateHouse(seed, diff);
      assert.deepEqual(validateLevel(L), [], `seed ${seed} diff ${diff}`);
      assert.ok(idleSafe(L, 4));
      assert.ok(L.targets.length >= 2 && L.quota > 0 && L.adults.length >= 1);
      assert.ok(L.tiles[0].length >= 15 && L.tiles.length >= 20);
      total++;
      if (L.tiles[0].length > 15 || L.tiles.length > 22) big++;
      if (L.locks) locked++;
    }
  }
  assert.ok(big / total > 0.9, 'houses are mostly bigger than one screen');
  assert.ok(locked > 0, 'some houses have a locked door');
});

test('difficulty scales adults, targets and adds patience', () => {
  const easy = generateHouse(2000, 1), hard = generateHouse(2000, 5);
  assert.ok(hard.adults.length > easy.adults.length);
  assert.ok(hard.targets.length >= easy.targets.length);
  assert.equal(easy.patience, undefined);
  assert.ok(hard.patience > 0);
});

test('daily seed is stable for a date and varies between dates', () => {
  const a = dailySeed(new Date(2026, 10, 7)), b = dailySeed(new Date(2026, 10, 7)), c = dailySeed(new Date(2026, 10, 8));
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.ok(a >= 1000 && a < 10000);
});

test('rng is deterministic', () => {
  const r1 = mulberry32(5), r2 = mulberry32(5);
  assert.equal(r1(), r2());
});
