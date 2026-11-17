// Design overhaul Phase 4C: the level pass (Blueprint 7). Rules R1-R7 live in tools/level-rules.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TILE } from '../src/world/tilemap.js';
import { World } from '../src/game/world.js';
import { rules } from '../tools/level-rules.mjs';
import { MISSIONS } from '../src/game/missions.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/levels/${f}.json`, import.meta.url), 'utf8'));
const idle = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false, throwPressed: false };
const c = (t) => t * TILE + TILE / 2;
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

test('L1 SALA: after the first coin she hears something, checks the hall, shrugs and goes back', () => {
  const w = new World(load('01-sala')), m = w.adults[0];
  w.player.hidden = { kind: 'box', x: 0, y: 0 };
  w.toggleSwitch(w.switches[0], true); // (you came in through the hall gate)
  w.coins = 1;
  const said = new Set();
  let far = false;
  for (let i = 0; i < 60 * 40; i++) {
    w.update(1 / 60, idle);
    if (m.say) said.add(m.say.text);
    if (tile(m)[1] >= 10) far = true;
  }
  assert.ok(said.has('ANO YUN?') && said.has('WALA NAMAN...'), [...said].join(','));
  assert.ok(far, 'she went through the gate to the hall');
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

test('L6 SWELDO: payday wallet by the shower; the ligo mission counts coins taken while Tatay showers', () => {
  const L = load('kwarto');
  assert.equal(L.name, 'SWELDO');
  assert.equal(L.quota, 7);
  assert.equal(L.targets.reduce((n, t) => n + t.coins, 0), 10);
  assert.ok(L.switches?.[0]?.time > 0, 'a timed lever gate');
  const run = (stealWhenShowering) => {
    const w = new World(L), tatay = w.adults.find((a) => a.type === 'tatay'), wallet = w.targets.find((t) => t.owner === 'tatay');
    w.player.hidden = { kind: 'box', x: 0, y: 0 };
    for (let i = 0; i < 60 * 40 && wallet.coins > 0; i++) {
      w.update(1 / 60, idle);
      if ((tatay.busy?.name === 'SHOWERING') === stealWhenShowering) w.stealCoin(wallet, 5);
    }
    return MISSIONS.ligo.ok(w);
  };
  assert.equal(run(true), true);
  assert.equal(run(false), false);
});

test('L7 GATAS: the milk is the goal (quota 0); a spill leaves a puddle, and only a puddle someone sees is evidence', () => {
  const L = load('gatas');
  assert.equal(L.quota, 0);
  const w = new World(L), mama = w.adults[0];
  w.player.hidden = { kind: 'box', x: 0, y: 0 };
  w.player.carry = w.targets[0];
  w.player.x = mama.x + 200; w.player.y = mama.y + 200; // far away, out of sight
  w.spill();
  assert.equal(w.puddles.length, 1);
  w.update(1 / 60, idle);
  assert.equal(w.stats.evidence, 0, 'nobody has seen it yet');
  w.puddles[0].x = mama.x + Math.cos(mama.va) * 30; w.puddles[0].y = mama.y + Math.sin(mama.va) * 30; // now right in front of her
  w.update(1 / 60, idle);
  assert.equal(w.stats.evidence, 1);
  assert.equal(mama.say?.text, 'BAKIT BASA DITO?');
  assert.equal(MISSIONS.noPuddle.ok(w), false);
});

test('L9 GABI: Jomar walks the long hall; 30 s before dinner Mama calls HUGAS KAMAY and walks to the kids rooms', () => {
  const L = load('05-gabi');
  assert.equal(L.targets.reduce((n, t) => n + t.coins, 0), 9);
  const w = new World(L), mama = w.adults[0];
  w.player.hidden = { kind: 'box', x: 0, y: 0 };
  w.time = w.patience - 31;
  let said = false, near = false;
  for (let i = 0; i < 60 * 12; i++) { w.update(1 / 60, idle); if (mama.say?.text === 'HUGAS KAMAY!') said = true; if (tile(mama)[1] <= 7) near = true; }
  assert.ok(said, 'the warning call');
  assert.ok(near, 'she walked up to the hall by the kids rooms');
});

test('level pass: the rules hold for every level the pass has reached', () => {
  for (const id of ['01-sala', '02-kusina', '03-buong-bahay', '04-bakuran', 'kwarto', 'gatas', '05-gabi', 'sampayan', 'ibalik', 'barangay', 'palengke']) {
    const r = rules(load(id));
    for (const k of ['R1', 'R2', 'R6', 'R7']) assert.ok(r[k].ok, `${id} ${k} ${JSON.stringify(r[k])}`);
  }
});

test('L10 KASABWAT: HINALA 2 brings the washing in sooner (a level setting), 3 lets the dog loose', async () => {
  const { applyHinala } = await import('../src/game/hinala.js');
  const L = load('sampayan');
  assert.equal(applyHinala(L, 2).laundryDown.every, 18);
  assert.equal(applyHinala(L, 2).laundryDown.floor, ';', 'the rest of the setting is kept');
  assert.equal(L.laundryDown.every, 25, 'the level file is untouched');
  assert.equal(new World(applyHinala(L, 3)).adults[3].cfg.cycle, null);
});

test('L11 IBALIK: put back J = sobra clamped 5..12, from the bank first, split by the ledger, one coin each at least', async () => {
  const { returnPlan, applyReturn } = await import('../src/game/ibalik.js');
  const ledger = { a: { sobra: 4, by: { mama: 6, tatay: 2 } }, b: { sobra: 5, by: { lola: 3, bahay: 1 } }, later: { sobra: 50, by: { tita: 9 } } };
  const p = returnPlan(ledger, ['a', 'b'], 6);
  assert.equal(p.J, 9, 'only the levels before IBALIK count');
  assert.deepEqual([p.fromBank, p.fromAlkansya], [6, 3], 'the bank never goes negative: Jun breaks his alkansya for the rest');
  assert.equal(p.split.mama + p.split.lola + p.split.tita, 9);
  assert.ok(p.split.mama > p.split.lola && p.split.tita >= 1, JSON.stringify(p.split));
  assert.equal(returnPlan({}, [], 99).J, 5);
  assert.equal(returnPlan({ a: { sobra: 40 } }, ['a'], 99).J, 12);
  const L = applyReturn(load('ibalik'), p);
  assert.equal(L.quota, 9);
  assert.equal(L.targets.filter((t) => t.kind === 'ibalik').reduce((n, t) => n + t.coins, 0), 9);
  assert.ok(L.hint.includes('ALKANSYA'));
});

test('L11 IBALIK: running with coins still to put back jingles (louder running); underNose needs the owner close by', () => {
  const L = load('ibalik');
  const w = new World(L), p = w.player;
  w.player.hidden = null;
  const run = { mv: { x: 1, y: 0, mag: 1, run: true }, action: false, actionPressed: false, throwPressed: false };
  w.update(1 / 60, run);
  const loud = Math.max(...w.noises.map((n) => n.r), 0);
  assert.ok(loud >= p.runNoise + 36, `running noise ${loud}`);
  for (const t of w.targets) { t.done = true; t.ownerNear = true; }
  assert.equal(MISSIONS.underNose.ok(w), true);
  w.targets[0].ownerNear = false;
  assert.equal(MISSIONS.underNose.ok(w), false);
});

test('Chapter 4 order is PALENGKE -> BARANGAY -> PARTY; save v5 moves a player who had reached the barangay', async () => {
  const { migrate, fresh } = await import('../src/core/save.js');
  const order = JSON.parse(readFileSync(new URL('../src/data/levels/index.json', import.meta.url), 'utf8'));
  const at = (f) => order.indexOf(f);
  assert.ok(at('palengke.json') + 1 === at('barangay.json') && at('barangay.json') + 1 === at('boss4-fiesta.json'), 'PALENGKE -> BARANGAY -> PARTY');
  // (since v6 the mini-games sit in the list too: what matters is that the player lands on the same level)
  assert.equal(order[migrate({ ...fresh(), v: 4, unlocked: 14 }).unlocked], 'barangay.json', 'a player who had reached the barangay is still at it');
  assert.equal(order[migrate({ ...fresh(), v: 4, unlocked: 13 }).unlocked], 'barangay.json');
  assert.equal(order[migrate({ ...fresh(), v: 4, unlocked: 15 }).unlocked], 'bagyo.json', 'past both: unchanged');
});

const escortRoom = (extra = {}) => ({
  id: 'esc', name: 'ESC', quota: 0, par: 60, escort: {}, outside: true,
  tiles: ['####################', '#..................#', '#..................#', '#..................#', '####################'],
  spawn: [2, 2], exit: [17, 2], targets: [], adults: [], ...extra,
});
const walk = (x, y) => ({ mv: { x, y, mag: 1, run: false }, action: false, actionPressed: false, throwPressed: false });

test('L14 BARANGAY escort: Mingming follows a step behind, sits when you stop, and the exit waits for her', () => {
  const w = new World(escortRoom()), e = w.escort, p = w.player;
  for (let i = 0; i < 60; i++) w.update(1 / 60, walk(1, 0));
  const gap = Math.hypot(p.x - e.x, p.y - e.y);
  assert.ok(e.x < p.x && gap > 10 && gap < 40, `she is behind (gap ${gap.toFixed(1)})`);
  for (let i = 0; i < 60; i++) w.update(1 / 60, idle);
  assert.equal(e.moving, false, 'she sits when you stop');
  e.x = c(3); e.y = c(2); e.trail = []; // left far behind
  p.x = w.exit.x; p.y = w.exit.y;
  w.update(1 / 60, idle);
  assert.equal(w.status, 'play', 'the exit waits for Mingming');
  e.x = p.x - 20; e.y = p.y;
  w.update(1 / 60, idle);
  assert.equal(w.status, 'clear');
});

test('L14 BARANGAY escort: she meows every 10 s unless hushed; a grown-up who sees her comes to look', () => {
  const w = new World(escortRoom());
  let meows = 0;
  for (let i = 0; i < 60 * 21; i++) { w.update(1 / 60, i % 120 < 60 ? walk(1, 0) : walk(-1, 0)); meows += w.events.filter((e) => e.type === 'meow').length; w.events.length = 0; }
  assert.equal(meows, 2, 'twice in 21 s of walking');
  const h = new World(escortRoom());
  let hushed = 0;
  for (let i = 0; i < 60 * 21; i++) { h.update(1 / 60, idle); hushed += h.events.filter((e) => e.type === 'meow').length; h.events.length = 0; }
  assert.equal(hushed, 0, 'standing still beside her hushes her');
  const s = new World(escortRoom({ adults: [{ type: 'kapitbahay', at: [8, 2], face: Math.PI }] }));
  s.player.hidden = null; s.player.x = c(1); s.escort.x = c(5); s.escort.y = c(2);
  s.update(1 / 60, idle);
  assert.equal(s.stats.catSeen, 1);
  assert.equal(s.adults[0].say?.text, 'UY, PUSA!');
  assert.equal(MISSIONS.catUnseen.ok(s), false);
});

test('L14 BARANGAY: outside the house only tanod close calls reach HINALA (+2 each)', async () => {
  const { delta } = await import('../src/game/hinala.js');
  const L = load('barangay');
  assert.equal(delta({ catches: 2, spotted: 3, sobra: 4, tanod: 1 }, L).total, 2);
  assert.equal(delta({ catches: 1 }, L).total, 0);
  assert.ok(!L.adults.some((a) => ['mama', 'tatay', 'lola', 'tita', 'kuya'].includes(a.type)), 'no family out here');
  assert.equal(L.targets.length, 0, 'nothing to take from strangers');
});

test('L13 PALENGKE: an errand of three free things (no coins); the exit opens once all three are picked up', async () => {
  const { BEFORE, AFTER } = await import('../src/data/story.js');
  const L = load('palengke');
  assert.equal(L.quota, 0);
  assert.deepEqual(L.targets.map((t) => [t.kind, t.coins, t.must]), [['bilin', 0, true], ['bilin', 0, true], ['bilin', 0, true]]);
  const w = new World(L);
  assert.equal(w.open, false);
  for (const t of w.targets) t.done = true;
  assert.equal(w.open, true);
  assert.ok(BEFORE['08-palengke'].some((p) => p.join === 'nene'), 'Nene joins before the errand');
  assert.ok(AFTER['08-palengke'].some((p) => p.flag === 'nena'), "the Oops (and the discount) happens at Nena's stall, after");
});

test('L13 PALENGKE: a tindera gossip that Mama hears fails noGossip', () => {
  const w = new World(load('palengke'));
  const tindera = w.adults.find((a) => a.type === 'tindera'), mama = w.adults.find((a) => a.type === 'mama');
  w.player.hidden = { kind: 'box', x: 0, y: 0 };
  w.noise({ x: mama.x + 10, y: mama.y, r: 130, lure: true, from: tindera, tattle: true });
  w.hearNoises(1 / 60);
  assert.equal(w.stats.gossip, 1);
  assert.equal(MISSIONS.noGossip.ok(w), false);
});
