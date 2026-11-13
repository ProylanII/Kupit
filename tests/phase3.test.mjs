import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE } from '../src/world/tilemap.js';
import { World } from '../src/game/world.js';
import {
  computeMods, buyUpgrade, upgradeCost, pickChar, grantSiblings, UPGRADES, UPGRADE_ORDER, CHARACTERS, CHAR_ORDER,
} from '../src/game/progression.js';

const c = (t) => t * TILE + TILE / 2;
const idle = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false, throwPressed: false, abilityPressed: false };
const step = (w, n = 1, inp = idle) => { for (let i = 0; i < n; i++) w.update(1 / 60, inp); };
const skill = (w) => w.update(1 / 60, { ...idle, abilityPressed: true });
const fresh = () => ({ bank: 0, upgrades: {}, chars: ['jun'], char: 'jun' });

const room = (extra = {}) => ({
  id: 't', name: 'T', quota: 1, par: 60,
  tiles: [
    '###########',
    '#.........#',
    '#.........#',
    '#.........#',
    '#.........#',
    '###########',
  ],
  spawn: [1, 2], exit: [9, 3],
  targets: [{ at: [9, 1], coins: 1, time: 1 }],
  adults: [],
  ...extra,
});

test('default mods are Jun with no gear', () => {
  const m = computeMods();
  assert.equal(m.charId, 'jun');
  assert.equal(m.runNoise, 48);
  assert.equal(m.itemCap, 3);
  assert.deepEqual(m.startItems, []);
  assert.equal(m.stealTime, 1);
  assert.equal(m.medyas, false); assert.equal(m.panyo, 0);
  assert.equal(computeMods('nope').charId, 'jun');
});

test('kid traits set the numbers; gear adds tricks, never percentages (old upgrade ids do nothing)', () => {
  const m = computeMods('ramil', { bulsa: 1, baon: 1, holen: 1, medyas: 1, panyo: 1 });
  assert.ok(Math.abs(m.runNoise - 48 * 1.25) < 1e-9);
  assert.equal(m.stealTime, 1);
  assert.equal(m.itemCap, 4);
  assert.deepEqual(m.startItems, ['tsinelas', 'pandesal', 'holen', 'holen']);
  assert.ok(m.medyas && m.panyo === 1);
  assert.equal(m.patienceBonus, 0);
  assert.equal(m.throwRange, 1.6);
  assert.deepEqual(computeMods('jun', { quiet: 3, hands: 3, shadow: 3, pockets: 3, stash: 3, pasensya: 3 }), computeMods('jun'));
  assert.ok(computeMods('bing').alertRate < 1 && computeMods('bing').speed < 1);
  assert.ok(computeMods('nene').stealTime < 1);
});

test('buying gear: once each, spends coins, refuses when poor', () => {
  const s = fresh();
  assert.equal(buyUpgrade(s, 'medyas'), false); // 0 coins
  s.bank = 100;
  assert.equal(upgradeCost(s, 'medyas'), UPGRADES.medyas.costs[0]);
  assert.ok(buyUpgrade(s, 'medyas'));
  assert.equal(s.bank, 100 - UPGRADES.medyas.costs[0]);
  assert.equal(upgradeCost(s, 'medyas'), null);
  assert.equal(buyUpgrade(s, 'medyas'), false);
  assert.deepEqual(UPGRADE_ORDER, ['medyas', 'panyo', 'holen', 'baon', 'bulsa']);
  for (const id of UPGRADE_ORDER) assert.equal(UPGRADES[id].costs.length, 1, `${id} is bought once`);
});

test('characters: siblings join through the story, never for coins', () => {
  const s = fresh();
  s.bank = 40;
  assert.equal(pickChar(s, 'bing'), 'locked');
  assert.equal(s.char, 'jun');
  s.story = { seen: { '04-bakuran': true } }; // the scene where Bing finds the kittens has played
  assert.deepEqual(grantSiblings(s, []), ['bing']);
  assert.equal(pickChar(s, 'bing'), 'selected');
  assert.equal(s.char, 'bing');
  assert.equal(pickChar(s, 'jun'), 'selected');
  assert.equal(s.bank, 40, 'no coins spent on family');
  const old = fresh(); old.unlocked = 9; // a save from before the story, already past two of the scenes
  assert.deepEqual(grantSiblings(old, ['01-sala', 'x', 'x', 'x', '04-bakuran', 'x', 'x', 'x', '05-gabi', 'x', 'x', 'x', '08-palengke']), ['bing', 'ramil']);
  for (const id of CHAR_ORDER) assert.ok(CHARACTERS[id].skill.cd > 0);
});

test('BAON and BULSA: start holding a tsinelas and a pandesal, and carry one more', () => {
  const w = new World(room(), { upgrades: { baon: 1, bulsa: 1 } });
  assert.deepEqual(w.player.items, ['tsinelas', 'pandesal']);
  assert.equal(w.mods.itemCap, 4);
});

test('Jun dash goes the way you face, is silent, then cools down', () => {
  const w = new World(room({ spawn: [2, 2] }));
  step(w, 1, { ...idle, mv: { x: 1, y: 0, mag: 1, run: false } });
  const x0 = w.player.x;
  skill(w); step(w, 20);
  assert.ok(w.player.x - x0 > 20);
  assert.equal(w.noises.length, 0);
  skill(w); // on cooldown
  assert.ok(w.abilityCd > 4);
});

test('Bing can hide anywhere and pops out after 3s', () => {
  const w = new World(room(), { char: 'bing' });
  skill(w);
  assert.ok(w.player.hidden);
  step(w, 60 * 3 + 5);
  assert.equal(w.player.hidden, null);
});

test('Bing hiding in the open fools an adult that was not watching', () => {
  // Mama faces away, Bing hides, then Mama turns: cannot see a hidden player.
  const w = new World(room({ spawn: [3, 2], adults: [{ type: 'mama', at: [7, 2], face: Math.PI }] }), { char: 'bing' });
  skill(w);
  const mama = w.adults[0];
  mama.a = 0; // looking at the hidden spot's direction after turning around
  assert.equal(mama.canSee(w.player), false);
});

test('Ramil yell lures an adult toward the sound', () => {
  const w = new World(room({ spawn: [3, 2], adults: [{ type: 'mama', at: [9, 4], face: 0 }] }), { char: 'ramil' });
  step(w, 1, { ...idle, mv: { x: 1, y: 0, mag: 1, run: false } });
  step(w, 1);
  skill(w);
  step(w, 5);
  assert.equal(w.adults[0].state, 'investigate');
});

test('Nene charm calms a chasing adult; does nothing when nobody watches', () => {
  const w = new World(room({ spawn: [3, 2], adults: [{ type: 'mama', at: [6, 2], face: 0 }] }), { char: 'nene' });
  skill(w);
  assert.equal(w.abilityCd, 0); // nobody to charm: no cooldown spent
  w.adults[0].a = w.adults[0].baseA = Math.PI; // mama turns around and sees Nene
  step(w, 40);
  assert.ok(w.adults[0].alert > 0);
  skill(w);
  assert.ok(w.abilityCd > 0);
  assert.equal(w.adults[0].alert, 0);
  step(w, 60);
  assert.equal(w.status, 'play');
  assert.equal(w.adults[0].caught, false);
});

test('Ramil throws farther than Jun', () => {
  const far = (char) => {
    const w = new World(room({ spawn: [1, 2], items: [{ kind: 'tsinelas', at: [1, 2] }] }), { char });
    step(w, 1);
    w.player.items = ['tsinelas'];
    w.player.dir = 2;
    w.update(1 / 60, { ...idle, throwPressed: true });
    step(w, 200);
    const it = w.items[w.items.length - 1];
    return it.x - w.player.x;
  };
  assert.ok(far('ramil') > far('jun') * 1.3);
});
