// Design overhaul Phase 4C: the level pass (Blueprint 7). Rules R1-R7 live in tools/level-rules.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TILE } from '../src/world/tilemap.js';
import { World } from '../src/game/world.js';
import { rules } from '../tools/level-rules.mjs';

const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/levels/${f}.json`, import.meta.url), 'utf8'));
const idle = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false, throwPressed: false };
const tile = (o) => [Math.floor(o.x / TILE), Math.floor(o.y / TILE)];

test('L1 SALA: quota 3 from a bag of 4 (SAPAT NA), Mama on the sofa, the ad break turns her toward the bag', () => {
  const L = load('01-sala');
  assert.equal(L.quota, 3);
  assert.equal(L.targets[0].coins, 4);
  const w = new World(L), m = w.adults[0];
  w.player.hidden = { kind: 'box', x: 0, y: 0 };
  let tv = 0, ad = 0;
  for (let i = 0; i < 60 * 30; i++) { w.update(1 / 60, idle); if (m.busy?.name === 'WATCHING TV') tv++; else if (Math.abs(m.a) < 0.3) ad++; }
  assert.deepEqual(tile(m), [7, 5], 'she stays on the sofa');
  assert.ok(tv > 60 * 15 && ad > 60 * 3, `tv ${tv} ad ${ad}`);
});

test('L1 SALA: after the first coin she hears something, checks the kids room, shrugs and goes back', () => {
  const w = new World(load('01-sala')), m = w.adults[0];
  w.player.hidden = { kind: 'box', x: 0, y: 0 };
  w.coins = 1;
  const said = new Set();
  let far = false;
  for (let i = 0; i < 60 * 40; i++) {
    w.update(1 / 60, idle);
    if (m.say) said.add(m.say.text);
    if (tile(m)[1] >= 13) far = true;
  }
  assert.ok(said.has('ANO YUN?') && said.has('WALA NAMAN...'), [...said].join(','));
  assert.ok(far, 'she went to the kids room');
  assert.deepEqual(tile(m), [7, 5], 'and back to the sofa');
});

test('L2 KUSINA: quota 5 of 7 (purse 3, the coin jar by the stove 2, piggy 2); radio and lego moved to L3', () => {
  const L = load('02-kusina');
  assert.equal(L.quota, 5);
  assert.deepEqual(L.targets.map((t) => [t.kind, t.coins]), [['purse', 3], ['candy', 2], ['piggy', 2]]);
  assert.equal(L.targets[1].owner, 'mama');
  assert.ok(!L.devices && !L.traps);
  assert.ok(!L.tiles.some((r) => r.includes('D')), 'no doors yet (L3 teaches them)');
});

test('L3 BUONG BAHAY: the purse moved to the bedroom; no lever yet; tier 2 locks the bedroom (Mama has that key)', async () => {
  const { applyHinala } = await import('../src/game/hinala.js');
  const L = load('03-buong-bahay');
  assert.deepEqual(L.missions, ['noWake', 'sakto']);
  assert.ok(!L.switches && !L.tiles.some((r) => r.includes('G')), 'the lever and gate moved to L6');
  assert.ok(L.devices.some((d) => d.kind === 'radio') && L.traps.some((t) => t.kind === 'lego'));
  assert.deepEqual(applyHinala(L, 0).news, ['MAMA MOVED HER PURSE TO THE BEDROOM']);
  const t2 = applyHinala(L, 2);
  assert.equal(t2.news[0], 'THE BEDROOM DOOR IS LOCKED NOW');
  const w = new World(t2);
  assert.ok(w.locks.has('4,14') && !w.adultLocks.has('4,14'), 'locked for the kids, not for Mama');
});

test('L5 BAKURAN: no lever yet, exit across the yard, a crawl table; HINALA takes away the nap and the dog sleep', async () => {
  const { applyHinala } = await import('../src/game/hinala.js');
  const L = load('04-bakuran');
  assert.ok(!L.switches && !L.tiles.some((r) => r.includes('G')));
  assert.equal(L.targets.reduce((n, t) => n + t.coins, 0), 6);
  assert.equal(L.items.filter((i) => i.kind === 'pandesal').length, 2);
  const naps = (lvl) => { const w = new World(lvl), t = w.adults[1]; w.player.hidden = { kind: 'box', x: 0, y: 0 }; let n = 0; for (let i = 0; i < 60 * 30; i++) { w.update(1 / 60, idle); if (t.busy?.name === 'DOZING') n++; } return n; };
  assert.ok(naps(L) > 60, 'Tatay dozes at tier 0');
  assert.equal(naps(applyHinala(L, 2)), 0, 'not at tier 2');
  const w3 = new World(applyHinala(L, 3)), aso = w3.adults[0];
  w3.player.hidden = { kind: 'box', x: 0, y: 0 };
  for (let i = 0; i < 60 * 30; i++) { w3.update(1 / 60, idle); assert.ok(aso.awake, 'the dog never sleeps at tier 3'); }
});

test('level pass: the rules hold for every level the pass has reached', () => {
  for (const id of ['01-sala', '02-kusina', '03-buong-bahay', '04-bakuran']) {
    const r = rules(load(id));
    for (const k of ['R1', 'R2', 'R6', 'R7']) assert.ok(r[k].ok, `${id} ${k} ${JSON.stringify(r[k])}`);
  }
});
