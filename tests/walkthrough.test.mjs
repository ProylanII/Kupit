// Every level must be finishable with real inputs (see tests/bot.mjs): the static validator proves reachability,
// this proves the actions line up too (doors open from where you stand, timed gates can be reached in time,
// boss phases and the escape finale resolve, keys unlock the right doors).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playBot } from './bot.mjs';
import { generateHouse, dailySeed, dailyDiff, isPasko, MUTATOR_ORDER } from '../src/game/house.js';

const dir = new URL('../src/data/levels/', import.meta.url);
const files = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'));
const levels = files.map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));

const why = (r) => `${r.why || r.status} after ${r.time}s; ${r.log.slice(-3).join(' ; ')}`;

for (const L of levels) {
  test(`walkthrough: ${L.id} is finishable sneaking and running, well under par`, () => {
    const sneak = playBot(L), run = playBot(L, { run: true });
    assert.ok(sneak.ok, `sneak: ${why(sneak)}`);
    assert.ok(run.ok, `run: ${why(run)}`);
    assert.ok(sneak.time < L.par, `direct sneak route takes ${sneak.time}s, par is ${L.par}s`);
    if (L.boss) assert.equal(sneak.phase, L.boss.phases.length, 'every boss phase fired');
  });
}

test('walkthrough: generated houses at every difficulty, each mutator, and the next two weeks of Daily Houses', () => {
  const bad = [];
  const check = (name, L) => { const r = playBot(L, { run: true }); if (!r.ok) bad.push(`${name}: ${why(r)}`); };
  for (let d = 1; d <= 5; d++) for (let s = 1000; s < 1008; s++) check(`house ${s} diff ${d}`, generateHouse(s, d));
  for (const m of [...MUTATOR_ORDER.map((k) => [k]), MUTATOR_ORDER]) for (let s = 1000; s < 1003; s++) check(`house ${s} ${m}`, generateHouse(s, 3, { mutators: m }));
  for (let i = 0; i < 14; i++) {
    const date = new Date(Date.now() + i * 86400e3);
    check(`daily ${date.toISOString().slice(0, 10)}`, generateHouse(dailySeed(date), dailyDiff(date), { pasko: isPasko(date) }));
  }
  assert.deepEqual(bad, []);
});
