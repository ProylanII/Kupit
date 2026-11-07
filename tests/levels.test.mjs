import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateLevel, idleSafe } from '../src/game/validate.js';

const dir = new URL('../src/data/levels/', import.meta.url);
const files = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'));
const load = (f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));

test('there are at least 12 levels and ids are unique', () => {
  assert.ok(files.length >= 12);
  const ids = files.map((f) => load(f).id);
  assert.equal(new Set(ids).size, ids.length);
});

for (const f of files) {
  test(`level ${f} is valid, solvable and safe at spawn`, () => {
    const L = load(f);
    assert.deepEqual(validateLevel(L), []);
    assert.ok(idleSafe(L, 4), 'caught while standing still at spawn');
  });
}
