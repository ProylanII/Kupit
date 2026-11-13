// Design overhaul Phase 3: the crew in play. Bing crawls under tables and beds (MALIIT), Kuya Ramil talks his way
// out of one close call a level (PALUSOT), levels can suggest a kid, and the card before a level remembers the pick.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World } from '../src/game/world.js';
import { TILE } from '../src/world/tilemap.js';
import { UNDER_SEE } from '../src/entities/adult.js';
import { delta } from '../src/game/hinala.js';
import { validateLevel } from '../src/game/validate.js';
import { fresh } from '../src/core/save.js';

const IDLE = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false, throwPressed: false, abilityPressed: false };
const c = (t) => t * TILE + TILE / 2;
const room = (o = {}) => ({
  id: 'crew', name: 'X',
  tiles: ['############', '#..........#', '#..........#', '#....T.....#', '#..........#', '#..........#', '#..........#', '############'],
  spawn: [3, 3], exit: [10, 6], quota: 1, par: 60, targets: [{ kind: 'piggy', at: [10, 1], coins: 1 }], adults: [], ...o,
});
const walk = (w, x, n = 60) => { for (let i = 0; i < n; i++) w.update(1 / 60, { ...IDLE, mv: { x, y: 0, mag: 1, run: false } }); };
const dir = new URL('../src/data/levels/', import.meta.url);
const levels = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8')).map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));

test('MALIIT: Bing crawls under a table; Jun bumps into it', () => {
  const bing = new World(room(), { char: 'bing' }), jun = new World(room());
  walk(bing, 1); walk(jun, 1);
  assert.equal(bing.player.tx, 5, 'Bing is under the table');
  assert.ok(bing.player.under);
  assert.ok(jun.player.tx < 5 && !jun.player.under, 'Jun stops at it');
});

test('MALIIT: under the table only someone right next to it sees her, and she cannot throw from there', () => {
  const w = new World(room({ adults: [{ type: 'mama', at: [8, 3], face: Math.PI }] }), { char: 'bing' });
  w.player.x = c(5); w.player.y = c(3); w.player.items = ['tsinelas'];
  w.update(1 / 60, IDLE);
  assert.ok(w.player.under);
  assert.equal(w.adults[0].canSee(w.player), false, 'three tiles away, looking right at the table: nothing');
  w.adults[0].x = c(6); w.adults[0].y = c(3); w.adults[0].a = Math.PI;
  assert.ok(Math.hypot(w.adults[0].x - w.player.x, w.adults[0].y - w.player.y) <= UNDER_SEE);
  assert.equal(w.adults[0].canSee(w.player), true, 'right beside it: she is seen');
  w.update(1 / 60, { ...IDLE, throwPressed: true });
  assert.equal(w.player.items.length, 1, 'no throwing from under a table');
});

test('PALUSOT: Kuya Ramil talks away the first close call (nothing lost), the second one counts', () => {
  const w = new World(room({ adults: [{ type: 'mama', at: [8, 3], face: Math.PI }] }), { char: 'ramil', lives: 3 });
  w.coins = 3;
  w.caught(w.adults[0]);
  assert.equal(w.catches, 0, 'no chance used');
  assert.equal(w.coins, 3, 'no coins dropped');
  assert.ok(w.player.graceT > 0 && !w.scold, 'a moment to slip away, no scolding');
  assert.equal(w.palusot, 0);
  w.caught(w.adults[0]);
  assert.equal(w.catches, 1, 'only one excuse a level');
  const jun = new World(room(), { lives: 3 });
  assert.equal(jun.palusot, 0, 'only Ramil has it');
});

test('PALUSOT: no excuses once a boss is in its final phase', () => {
  const L = room({ quota: 2, adults: [{ type: 'mama', at: [8, 3], face: Math.PI }],
    boss: { title: 'X', index: 0, bonus: 1, phases: [{ at: 1, banner: 'GO', escape: 30 }] } });
  const w = new World(L, { char: 'ramil', lives: 3 });
  w.coins = 1; w.update(1 / 60, IDLE);
  assert.ok(w.finalPhase);
  w.caught(w.adults[0]);
  assert.equal(w.catches, 1);
});

test('PALUSOT costs a little suspicion: they wonder (HINALA +3)', () => {
  const d = delta({ palusot: 1, coins: 2 });
  assert.equal(d.parts.find((p) => p.id === 'palusot')?.n, 3);
});

test('levels suggest a kid on the card (a valid one, with a short reason), and the save remembers picks', () => {
  const sug = levels.filter((L) => L.suggest);
  assert.deepEqual(sug.map((L) => L.suggest).sort(), ['bing', 'nene', 'ramil']);
  for (const L of sug) assert.ok(L.suggestWhy && L.suggestWhy.length <= 56, L.id);
  assert.ok(validateLevel({ ...room(), suggest: 'tatay' }).some((m) => /suggest/.test(m)));
  assert.deepEqual(fresh().pick, {});
});
