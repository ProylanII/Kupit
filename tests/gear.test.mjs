// Design overhaul Phase 2D: gear that adds tricks (MEDYAS, PANYO, HOLEN, BAON, BULSA) instead of percentages,
// cat needs that open with the story, and the v4 save migration that refunds the old upgrades.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, MARBLE_R } from '../src/game/world.js';
import { TILE } from '../src/world/tilemap.js';
import { NEEDS, NEED_ORDER, needOpen, oldUpgradeSpend, OLD_UPGRADES, UPGRADES } from '../src/game/progression.js';
import { migrate, fresh, SAVE_VERSION } from '../src/core/save.js';

const IDLE = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false, throwPressed: false, abilityPressed: false };
const c = (t) => t * TILE + TILE / 2;
const room = (o = {}) => ({
  id: 'gear', name: 'X', tiles: ['############', ...Array(6).fill('#..........#'), '############'],
  spawn: [2, 3], exit: [10, 6], quota: 1, par: 60, targets: [{ kind: 'piggy', at: [10, 1], coins: 1 }], adults: [], ...o,
});
const stepOn = (w, tx, ty) => { w.player.x = c(tx); w.player.y = c(ty); w.update(1 / 60, IDLE); };

test('MEDYAS: in socks a creaky board makes no sound (beside a sleeping boss it only halves it)', () => {
  const L = room({ traps: [{ kind: 'creak', at: [5, 3] }] });
  const plain = new World(L);
  stepOn(plain, 5, 3);
  assert.ok(plain.noises.some((n) => n.r === 64 && n.lure), 'barefoot: KREEK');
  const socks = new World(L, { upgrades: { medyas: 1 } });
  stepOn(socks, 5, 3);
  assert.ok(!socks.noises.some((n) => n.lure), 'socks: nothing');
  assert.equal(socks.stats.traps, 1, 'it still counts as stepping on it');
  const boss = new World({ ...L, adults: [{ type: 'lola', at: [9, 5], face: 0, cfg: { depth: true } }] }, { upgrades: { medyas: 1 } });
  stepOn(boss, 5, 3);
  assert.ok(boss.noises.some((n) => n.r === 32), "Lola's room: half");
});

test('PANYO: the handkerchief muffles the first clasp or zipper of a level, and only that one', () => {
  const L = room({ quota: 2, targets: [{ kind: 'wallet', at: [2, 3], coins: 2, time: 1 }, { kind: 'wallet', at: [6, 3], coins: 2, time: 1 }] });
  const w = new World(L, { upgrades: { panyo: 1 } });
  w.update(1 / 60, { ...IDLE, action: true });
  assert.ok(!w.noises.some((n) => n.r === 60), 'first zipper muffled');
  assert.equal(w.panyo, 0);
  w.player.x = w.targets[1].x; w.player.y = w.targets[1].y; w.update(1 / 60, IDLE);
  w.update(1 / 60, { ...IDLE, action: true });
  assert.ok(w.noises.some((n) => n.r === 60), 'the second one zips as usual');
  const none = new World(L);
  none.update(1 / 60, { ...IDLE, action: true });
  assert.ok(none.noises.some((n) => n.r === 60), 'without it: ZZZIP');
});

test('HOLEN: a marble rolls on after it lands, ticking lures; people go to look, the dog does not', () => {
  const L = room({ adults: [{ type: 'mama', at: [8, 1], face: -1.57 }, { type: 'aso', at: [8, 5], face: 1.57 }] });
  const w = new World(L, { upgrades: { holen: 1 } });
  assert.deepEqual(w.player.items, ['holen', 'holen']);
  w.player.dir = 2; // facing right
  w.update(1 / 60, { ...IDLE, throwPressed: true });
  let ticks = 0, rolled = false, went = false, dogMoved = false;
  for (let i = 0; i < 60 * 3; i++) {
    w.update(1 / 60, IDLE);
    if (w.rollers.length) rolled = true;
    went ||= w.adults[0].state === 'investigate';
    dogMoved ||= w.adults[1].state !== 'patrol';
    ticks += w.noises.filter((n) => n.marble && n.r === MARBLE_R).length;
  }
  assert.ok(rolled && ticks >= 3, `rolled and ticked (${ticks})`);
  assert.equal(w.rollers.length, 0, 'stopped at the wall and is gone');
  assert.equal(w.items.filter((i) => i.kind === 'holen').length, 0, 'a marble is not picked up again');
  assert.ok(went, 'Mama went to look');
  assert.ok(!dogMoved, 'the dog ignores it');
});

test('needs open with the story, and the fifth is now the medicine (GAMOT, 14)', () => {
  const s = fresh();
  for (const id of NEED_ORDER) assert.equal(needOpen(s, id), false, `${id} closed on a new save`);
  s.story.intro = true;
  assert.ok(needOpen(s, 'gatas') && !needOpen(s, 'sardinas'));
  s.story.seen['boss1-lola'] = true; s.story.seen['05-gabi'] = true; s.story.after.ibalik = true; s.story.nena = true;
  for (const id of NEED_ORDER) assert.ok(needOpen(s, id), id);
  assert.equal(NEEDS.vet.name, 'GAMOT'); assert.equal(NEEDS.vet.cost, 14);
  const old = fresh(); old.needs = { vet: true };
  assert.ok(needOpen(old, 'vet'), 'something already bought stays open');
});

test('save v4: every coin spent on the old upgrades comes back, the old ids are gone', () => {
  assert.ok(SAVE_VERSION >= 4);
  const spent = { quiet: 2, hands: 1, pasensya: 3, stash: 9 };
  const expect = 6 + 12 + 6 + (5 + 10 + 16) + (6 + 12 + 20);
  assert.equal(oldUpgradeSpend(spent), expect);
  const v3 = { ...fresh(), v: 3, bank: 7, upgrades: spent };
  const s = migrate(v3);
  assert.equal(s.v, SAVE_VERSION);
  assert.equal(s.bank, 7 + expect);
  assert.deepEqual(s.upgrades, {});
  assert.equal(migrate({ ...fresh(), bank: 5 }).bank, 5, 'a v4 save is not refunded twice');
  for (const id of Object.keys(OLD_UPGRADES)) assert.ok(!UPGRADES[id], `${id} is no longer sold`);
});
