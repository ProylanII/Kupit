// HINALA (design overhaul Phase 2B): the household's suspicion. Moves on first clears only, never below the
// chapter's floor, four tiers that change the house, and every tier of every level must still be valid and
// finishable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tierOf, FLOORS, floorFor, effective, delta, next, applyHinala, hinalaProblems, TIERS, INPUTS, CLEAN, RETURNED, TIER_BASE } from '../src/game/hinala.js';
import { validateLevel } from '../src/game/validate.js';
import { World } from '../src/game/world.js';
import { fresh, migrate } from '../src/core/save.js';
import { ENDING, BEFORE } from '../src/data/story.js';
import { hasBigGlyph } from '../src/ui/font.js';
import { playBot } from './bot.mjs';

const dir = new URL('../src/data/levels/', import.meta.url);
const levels = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8')).map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
const byId = Object.fromEntries(levels.map((L) => [L.id, L]));

test('hinala: four tiers at 25/50/75, chapter floors that only ever rise', () => {
  assert.deepEqual([0, 24, 25, 49, 50, 74, 75, 100].map(tierOf), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(TIERS.length, 4);
  for (let i = 1; i < FLOORS.length; i++) assert.ok(FLOORS[i] > FLOORS[i - 1]);
  assert.equal(tierOf(floorFor(4)), 3, 'by the storm the whole house is on guard');
  assert.equal(effective(10, 2), floorFor(2));
  assert.equal(effective(60, 2), 60);
});

test('hinala: what raises it (capped per level), a clean run lowers it, IBALIK lowers it a lot', () => {
  const greedy = delta({ sobra: 9, emptied: 5, catches: 3, spotted: 9, spills: 0, tattles: 1, coins: 12 });
  const by = Object.fromEntries(greedy.parts.map((p) => [p.id, p.n]));
  assert.equal(by.sobra, INPUTS.sobra.cap); assert.equal(by.emptied, INPUTS.emptied.cap);
  assert.equal(by.catches, INPUTS.catches.cap); assert.equal(by.spotted, INPUTS.spotted.cap);
  assert.equal(by.tattles, 2); assert.equal(by.clean, undefined);
  const clean = delta({ sobra: 0, emptied: 1, catches: 0, spotted: 0, coins: 4 });
  assert.equal(clean.parts.find((p) => p.id === 'clean').n, CLEAN);
  assert.equal(clean.total, INPUTS.emptied.each + CLEAN);
  const back = delta({ coins: 7, catches: 0 }, { giveBack: true });
  assert.equal(back.total, RETURNED * 7);
  assert.equal(delta({ sobra: 5 }, { hingi: true }).total, 0, 'the epilogue changes nothing');
});

test('hinala: next value is clamped and never drops under the chapter floor', () => {
  assert.equal(next(20, { total: -50 }, 2), floorFor(2));
  assert.equal(next(95, { total: 30 }, 0), 100);
  assert.equal(next(30, { total: 7 }, 1), 37);
});

test('hinala: the house changes cumulatively by tier, and the level file is never touched', () => {
  const L = byId['03-buong-bahay'];
  const copy = JSON.stringify(L);
  assert.equal(applyHinala(L, 0), L, 'tier 0: the house as built');
  const t2 = applyHinala(L, 2);
  assert.equal(JSON.stringify(L), copy, 'input untouched');
  assert.deepEqual(t2.targets[0].at, L.hinala['2'].do[0].to, 'tier 2: the purse moved');
  assert.equal(t2.adults[0].route.length, L.adults[0].route.length + 1, 'tier 1 still applies: the counting stop');
  assert.deepEqual(t2.news, [L.hinala['2'].news, L.hinala['1'].news], 'newest news first');
  for (const a of t2.adults) assert.equal(a.cfg?.searchMul, TIER_BASE[2].searchMul);
  const t3 = applyHinala(L, 3);
  assert.ok(t3.adults[0].cfg.checksHides, 'tier 3: Mama checks the hiding spots');
  assert.ok(t3.adults.filter((a) => a.type === 'lola').every((a) => a.cfg.lightSleeper), 'and sleepers sleep lightly');
});

test('hinala: a suspicious house searches longer before giving up', () => {
  const L = applyHinala(byId['03-buong-bahay'], 2);
  const w = new World(L), plain = new World(byId['03-buong-bahay']);
  assert.ok(w.adults[0].searchTime > plain.adults[0].searchTime);
});

test('hinala: every tier of every level is valid and can be finished', () => {
  const withBlocks = levels.filter((L) => L.hinala);
  assert.ok(withBlocks.length >= 1, 'at least one level changes with suspicion');
  for (const L of levels) {
    assert.deepEqual(hinalaProblems(L), [], L.id);
    for (const tier of [1, 2, 3]) {
      const V = applyHinala(L, tier);
      assert.deepEqual(validateLevel(V), [], `${L.id} tier ${tier}`);
      if (L.hinala) { const r = playBot(V); assert.ok(r.ok, `${L.id} tier ${tier}: ${r.why || r.status}`); }
    }
  }
});

test('hinala: news lines fit, and the validator refuses more than two changes per tier', () => {
  const L = { ...byId['03-buong-bahay'], hinala: { 1: { news: 'X', do: [{ adult: 0, cfg: {} }, { adult: 0, cfg: {} }, { adult: 0, cfg: {} }] } } };
  assert.ok(hinalaProblems(L).length);
  assert.ok(validateLevel(L).some((m) => /at most two/.test(m)));
});

test('hinala: the save carries it, clamped, and old saves start at zero', () => {
  const s = fresh();
  assert.equal(s.hinala, 0); assert.equal(s.hinalaPlay, 0); assert.deepEqual(s.hinalaAt, {}); assert.deepEqual(s.ledger, {});
  const m = migrate({ ...fresh(), hinala: 140, hinalaPlay: -3, hinalaAt: { '01-sala': 0 } });
  assert.equal(m.hinala, 100); assert.equal(m.hinalaPlay, 0); assert.equal(m.hinalaAt['01-sala'], 0);
  const old = migrate({ v: 3, unlocked: 4, stars: {}, best: {} });
  assert.equal(old.hinala, 0);
});

test('hinala: story lines that depend on it fit the dialogue box', () => {
  const panels = [...ENDING, ...Object.values(BEFORE).flat()];
  assert.ok(ENDING[0].low, 'the ending opens differently when Jun took only what he needed');
  for (const p of panels) {
    for (const l of p.low || []) {
      assert.ok(l.length <= 37, `"${l}"`);
      for (const ch of l) assert.ok(hasBigGlyph(ch), `no glyph "${ch}"`);
    }
    if (p.minTier !== undefined) assert.ok(p.minTier >= 1 && p.minTier <= 3);
  }
});
