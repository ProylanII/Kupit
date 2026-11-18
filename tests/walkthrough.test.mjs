// Every level must be finishable with real inputs (see tests/bot.mjs): the static validator proves reachability,
// this proves the actions line up too (doors open from where you stand, timed gates can be reached in time,
// boss phases and the escape finale resolve, keys unlock the right doors).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playBot } from './bot.mjs';

const dir = new URL('../src/data/levels/', import.meta.url);
const files = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'));
const levels = files.map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8'))).filter((L) => !L.mode); // (mini-games: tests/minigames.test.mjs)

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

