// SOBRA (design overhaul Phase 2A): ordinary stashes give their coins one at a time, opening takes longest,
// every extra coin in one visit clinks louder, emptying one is a loud "klak", "sapat na" marks the quota, coins past
// it are sobra, and each stash knows whose it is (the ledger, IBALIK and the case file read that).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World, EMPTY_NOISE, clinkR } from '../src/game/world.js';
import { Target, FIRST_COIN, OWNERS } from '../src/entities/target.js';
import { MISSIONS } from '../src/game/missions.js';

const IDLE = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false, throwPressed: false, abilityPressed: false };
const HOLD = { ...IDLE, action: true };
const room = (o = {}) => ({
  id: 'sobra', name: 'X', tiles: ['############', ...Array(6).fill('#..........#'), '############'],
  spawn: [3, 3], exit: [10, 6], quota: 2, par: 60, adults: [], ...o,
});
const dir = new URL('../src/data/levels/', import.meta.url);
const levels = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8')).map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8'))).filter((L) => !L.mode); // (mini-games: tests/minigames.test.mjs)

// Hold KUPIT until the stash has given n coins (or is empty); returns the world.
function take(w, t, n = Infinity) {
  const start = t.taken;
  for (let i = 0; i < 60 * 20 && !t.done && t.taken - start < n; i++) w.update(1 / 60, HOLD);
  return w;
}

test('sobra: opening takes 45% of the time, the rest share it, so emptying takes as long as it always did', () => {
  const t = new Target({ kind: 'wallet', at: [1, 1], coins: 4, time: 2 });
  assert.ok(t.perCoin);
  const total = [0, 1, 2, 3].reduce((s, k) => s + t.coinTime(k), 0);
  assert.ok(Math.abs(total - t.time) < 1e-9, `sum ${total} vs ${t.time}`);
  assert.ok(Math.abs(t.coinTime(0) - t.time * FIRST_COIN) < 1e-9);
  assert.ok(t.coinTime(0) > t.coinTime(1), 'the first coin (opening it) is the slow one');
});

test('sobra: coins come out one at a time; the exit opens at the quota, and "sapat na" plays once', () => {
  const w = new World(room({ quota: 2, targets: [{ kind: 'wallet', at: [3, 3], coins: 4, time: 1 }] }));
  const t = w.targets[0];
  take(w, t, 1);
  assert.equal(w.coins, 1); assert.equal(t.coins, 3); assert.ok(!w.open && !t.done);
  take(w, t, 1);
  assert.equal(w.coins, 2); assert.ok(w.open, 'exit opens at the quota'); assert.ok(w.sapat, 'sapat na');
  take(w, t);
  assert.ok(t.done); assert.equal(w.coins, 4); assert.equal(w.sobra, 2);
});

test('sobra: greed is loud — each extra coin in one visit clinks louder, and the last one klaks', () => {
  const w = new World(room({ targets: [{ kind: 'piggy', at: [3, 3], coins: 4, time: 1.2 }] }));
  const t = w.targets[0], radii = [];
  for (let i = 0; i < 60 * 20 && !t.done; i++) {
    const before = t.taken;
    w.update(1 / 60, HOLD);
    if (t.taken > before) radii.push(w.noises.filter((n) => n.r === clinkR(1) || n.r === clinkR(2) || n.r === EMPTY_NOISE).map((n) => n.r));
  }
  assert.deepEqual(radii.map((r) => Math.max(0, ...r)), [0, clinkR(1), clinkR(2), EMPTY_NOISE]);
  assert.ok(clinkR(2) > clinkR(1));
});

test('sobra: letting go starts a new visit, so the clinks start quiet again', () => {
  const w = new World(room({ targets: [{ kind: 'wallet', at: [3, 3], coins: 4, time: 1 }] }));
  const t = w.targets[0];
  take(w, t, 2);
  assert.equal(t.visit, 2);
  for (let i = 0; i < 5; i++) w.update(1 / 60, IDLE);
  assert.equal(t.visit, 0, 'a fresh visit');
});

test('sobra: a close call puts coins back where they came from, and the stash refills', () => {
  const w = new World(room({ quota: 5, targets: [{ kind: 'wallet', at: [3, 3], coins: 3, time: 1 }, { kind: 'purse', at: [5, 3], coins: 3, time: 1 }] }), { lives: 3 });
  const [a, b] = w.targets;
  take(w, a);
  w.player.x = b.x; w.player.y = b.y; w.update(1 / 60, IDLE);
  take(w, b, 2);
  assert.equal(w.coins, 5);
  w.caught({ talk() {}, cfg: { scold: 'X' } });
  assert.equal(w.coins, 3, 'a third (rounded up) dropped');
  assert.equal(b.coins, 3, 'the purse got its two back first (newest first)');
  assert.equal(a.coins, 0, 'the wallet stays empty');
  assert.ok(!b.done && a.done);
});

test('sobra: each stash knows whose it is, and the result says what was taken from whom', () => {
  assert.equal(OWNERS.purse, 'mama'); assert.equal(OWNERS.bayong, 'lola'); assert.equal(OWNERS.wallet, 'tita');
  const w = new World(room({ quota: 1, targets: [{ kind: 'purse', at: [3, 3], coins: 2, time: 1 }, { kind: 'wallet', at: [6, 3], coins: 2, time: 1, owner: 'tatay' }] }));
  take(w, w.targets[0]);
  w.player.x = w.targets[1].x; w.player.y = w.targets[1].y; w.update(1 / 60, IDLE);
  take(w, w.targets[1], 1);
  assert.deepEqual(w.takenBy(), { mama: 2, tatay: 1 });
  assert.equal(w.sobra, 2);
});

test('sobra: story stashes stay whole (milk, kittens, putting back, gifts, the alkansya)', () => {
  for (const def of [{ kind: 'gatas', carry: true, coins: 0 }, { kind: 'kuting', coins: 1 }, { kind: 'ibalik', coins: 3 }, { kind: 'regalo', coins: 2 }, { kind: 'purse', coins: 5, bonus: true }]) {
    assert.equal(new Target({ at: [1, 1], ...def }).perCoin, false, def.kind);
  }
  assert.equal(new Target({ kind: 'purse', at: [1, 1], coins: 1 }).perCoin, false, 'a one-coin stash is just a stash');
});

test('sakto: "take only what you need" means ending on exactly the quota, and levels that ask for it have spare coins', () => {
  const w = new World(room({ quota: 2, targets: [{ kind: 'wallet', at: [3, 3], coins: 3, time: 1 }] }));
  take(w, w.targets[0], 2);
  assert.ok(MISSIONS.sakto.ok(w));
  take(w, w.targets[0], 1);
  assert.ok(!MISSIONS.sakto.ok(w));
  const asks = levels.filter((L) => (L.missions || []).includes('sakto'));
  assert.ok(asks.length >= 4);
  for (const L of asks) {
    const total = L.targets.filter((t) => !t.bonus).reduce((s, t) => s + (t.coins ?? 2), 0);
    assert.ok(total > L.quota, `${L.id}: ${total} coins for quota ${L.quota}`);
  }
  for (const L of levels) assert.ok(!(L.missions || []).includes('allCoins'), `${L.id} still rewards emptying everything`);
});
