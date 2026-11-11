// Tests for the November 2026 roadmap: failure state, sound propagation, kupit profiles, throw aim,
// boss signatures + archetypes, daily/mutators, save schema, economy, ghosts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, SCOLD_TIME, GRACE_TIME } from '../src/game/world.js';
import { TILE, TileMap } from '../src/world/tilemap.js';
import { soundField, heardDistance } from '../src/world/sound.js';
import { findPath } from '../src/world/pathfind.js';
import { generateHouse, dailyId, dailySeed, dailyDiff, prevDailyId, isPasko, mutatorMult } from '../src/game/house.js';
import { validateLevel, idleSafe } from '../src/game/validate.js';
import { migrate, saveCode, readSaveCode, fresh, SAVE_VERSION } from '../src/core/save.js';
import { computeMods, FLOORS, campaignPayout, housePayout, grantUnlocks, totalStars, upgradeStat, buyCosmetic } from '../src/game/progression.js';
import { encodeGhost, decodeGhost, ghostAt } from '../src/game/ghost.js';

const c = (t) => t * TILE + TILE / 2;
const idle = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false, throwPressed: false, abilityPressed: false };
const step = (w, n = 1, inp = idle) => { for (let i = 0; i < n; i++) w.update(1 / 60, inp); };
const room = (o = {}) => ({
  id: 'r', name: 'R', quota: 1, par: 60,
  tiles: ['############', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '############'],
  spawn: [1, 3], exit: [10, 5], targets: [{ kind: 'purse', at: [5, 3], coins: 3, time: 1 }], adults: [], ...o,
});

// ---------------------------------------------------------------- R1 failure state
test('caught with lives left: scolding beat, a third of the coins go back, respawn at the last safe spot', () => {
  const w = new World(room({
    targets: [{ kind: 'purse', at: [2, 2], coins: 3, time: 0.5 }, { kind: 'wallet', at: [3, 2], coins: 3, time: 0.5 }], quota: 6,
    hide: [{ kind: 'box', at: [1, 5] }],
  }), { lives: 3 });
  // hide in the box (checkpoint), then take both stashes
  w.player.x = c(1); w.player.y = c(5);
  w.update(1 / 60, { ...idle, actionPressed: true, action: true });
  assert.ok(w.player.hidden);
  w.update(1 / 60, { ...idle, mv: { x: 0, y: -1, mag: 1, run: false } }); // come out
  w.targets[0].done = true; w.coins = 3; w.stolen.push({ t: w.targets[0], n: 3 });
  w.targets[1].done = true; w.coins = 6; w.stolen.push({ t: w.targets[1], n: 3 });
  // an adult catches you
  const a = w.makeAdult({ type: 'mama', at: [8, 3], face: Math.PI });
  w.adults.push(a);
  w.player.x = c(8) - 4; w.player.y = c(3);
  a.caught = true;
  step(w);
  assert.equal(w.status, 'play', 'not the end yet');
  assert.ok(w.scold, 'scolding beat');
  assert.equal(w.coins, 4, 'lost ceil(6/3) = 2');
  assert.equal(w.targets[1].done, false, 'the newest stash got its coins back');
  assert.equal(w.targets[1].coins, 2);
  step(w, Math.ceil(SCOLD_TIME * 60) + 1);
  assert.equal(w.scold, null);
  assert.equal(w.player.x, c(1)); assert.equal(w.player.y, c(5));
  assert.ok(w.player.hidden, 'respawned inside the hiding spot');
  assert.ok(w.player.graceT > 0 && w.player.graceT <= GRACE_TIME);
  assert.equal(a.caught, false);
  assert.equal(w.livesLeft, 2);
});

test('the last chance ends the level; one life = classic instant fail', () => {
  const mk = (lives) => {
    const w = new World(room({ adults: [{ type: 'mama', at: [3, 3], face: Math.PI }] }), { lives });
    w.player.x = c(2); w.player.y = c(3);
    for (let i = 0; i < 1200 && w.status === 'play'; i++) {
      if (!w.scold) { w.player.x = w.adults[0].x - 6; w.player.y = w.adults[0].y; w.player.graceT = 0; }
      step(w);
    }
    return w;
  };
  const one = mk(1);
  assert.equal(one.status, 'caught'); assert.equal(one.catches, 1);
  const three = mk(3);
  assert.equal(three.status, 'caught'); assert.equal(three.catches, 3);
});

test('boss phases never roll back when coins are lost', () => {
  const L = room({
    targets: [{ kind: 'purse', at: [2, 2], coins: 4, time: 0.5 }, { kind: 'purse', at: [8, 2], coins: 4, time: 0.5 }], quota: 8,
    adults: [{ type: 'mama', at: [9, 5], face: 0 }],
    boss: { title: 'B', index: 0, bonus: 1, phases: [{ at: 4, banner: 'ONE', adult: { index: 0, speed: 40 } }] },
  });
  const w = new World(L, { lives: 3 });
  w.targets[0].done = true; w.coins = 4; w.stolen.push({ t: w.targets[0], n: 4 });
  step(w);
  assert.equal(w.phase, 1);
  w.caught(w.adults[0]);
  assert.ok(w.coins < 4);
  step(w, Math.ceil(SCOLD_TIME * 60) + 5);
  assert.equal(w.phase, 1, 'phase stays');
  assert.equal(w.adults[0].cfg.speed, 40);
});

// ---------------------------------------------------------------- R5 sound
const twoRooms = (door) => new TileMap([
  '###########',
  '#....#....#',
  '#....' + door + '....#',
  '#....#....#',
  '###########',
]);

test('sound: a wall blocks it, a closed door muffles it, an open door lets it through', () => {
  const n = { x: c(2), y: c(2), r: 100 };
  const far = (map) => heardDistance(soundField(map, n.x, n.y, 200), map, n, c(8), c(2));
  const wall = far(twoRooms('#')), shut = far(twoRooms('D')), open = far(twoRooms('d'));
  assert.equal(wall, Infinity);
  assert.ok(Math.abs(open - 6 * TILE) < 1, `open door: ${open}`);
  assert.ok(shut > open + 30, 'closed door adds distance');
});

test('an adult behind a wall does not hear a throw that is close as the crow flies', () => {
  const L = room({
    tiles: ['############', '#....#.....#', '#....#.....#', '#....#.....#', '#....#.....#', '#....#.....#', '############'],
    spawn: [1, 3], exit: [4, 5], targets: [{ at: [2, 1], coins: 1 }],
    adults: [{ type: 'mama', at: [7, 3], face: 0 }],
  });
  const w = new World(L);
  w.noise({ x: c(4), y: c(3), r: 90, lure: true }); // 3 tiles away, through a wall
  w.hearNoises(1 / 60);
  step(w, 30);
  assert.equal(w.adults[0].state, 'patrol');
});

test("Kuya's tattle winds up for half a second, then everyone in earshot heads to where he saw you", () => {
  const w = new World(room({ adults: [{ type: 'kuya', at: [9, 3], face: Math.PI }, { type: 'mama', at: [10, 5], face: 0 }] }));
  w.player.x = c(4); w.player.y = c(3);
  w.player.graceT = 99; // only the shout is under test here
  const k = w.adults[0];
  k.startChase(w, w.player);
  assert.ok(k.tattleT > 0.4);
  assert.equal(w.noises.length, 0, 'no instant alert');
  let shout = null;
  for (let i = 0; i < 40 && !shout; i++) { step(w); shout = w.noises.find((nz) => nz.tattle); }
  assert.ok(shout, 'the shout goes out');
  assert.ok(w.time >= 0.45, `after the wind-up (${w.time})`);
  assert.deepEqual([Math.round(shout.goal.x), Math.round(shout.goal.y)], [c(4), c(3)]);
  step(w, 30);
  assert.equal(w.adults[1].state, 'investigate');
});

// ---------------------------------------------------------------- R7 kupit profiles
test('stashes: wallet zips at the start, purse clicks at the end, progress decays slowly', () => {
  const w = new World(room({ targets: [{ kind: 'wallet', at: [2, 3], coins: 2, time: 1 }], spawn: [2, 3], adults: [{ type: 'mama', at: [5, 3], face: 0 }] }));
  w.update(1 / 60, { ...idle, action: true });
  assert.ok(w.noises.some((n) => n.r === 60), 'zipper');
  assert.ok(w.adults[0].hearT > 0, 'she turns to look');
  step(w, 30, { ...idle, action: true });
  const p = w.targets[0].progress;
  step(w, 60); // let go for a second
  assert.ok(w.targets[0].progress > p - 0.2 && w.targets[0].progress > 0, 'kept most of it');

  const w2 = new World(room({ spawn: [5, 3], targets: [{ kind: 'purse', at: [5, 3], coins: 3, time: 1 }] }));
  let click = false;
  for (let i = 0; i < 120 && !w2.targets[0].done; i++) { w2.update(1 / 60, { ...idle, action: true }); click ||= w2.noises.some((n) => n.r === 44); }
  assert.ok(w2.targets[0].done && click, 'purse clasp at the end');
  assert.ok(w2.targets[0].time < 1, 'purse is quick');
});

test('the alkansya is optional bonus money and is skipped once found', () => {
  const L = room({ alkansya: { at: [8, 1], coins: 5 } });
  assert.deepEqual(validateLevel(L), []);
  const w = new World(L);
  const alk = w.targets.find((t) => t.bonus);
  w.player.x = alk.x; w.player.y = alk.y;
  for (let i = 0; i < 400 && !alk.done; i++) w.update(1 / 60, { ...idle, action: true });
  assert.ok(alk.done);
  assert.equal(w.bonus, 5);
  assert.equal(w.coins, 0, 'does not count toward the quota');
  assert.equal(new World(L, { alkansyaFound: true }).targets.some((t) => t.bonus), false);
  assert.ok(validateLevel({ ...L, alkansya: { at: [0, 0], coins: 5 } }).length > 0, 'must be on reachable floor');
});

// ---------------------------------------------------------------- R4 actions
test('aim preview stops at walls and reaches farther for Ramil; item selector cycles kinds', () => {
  const w = new World(room({ spawn: [5, 3] }), { upgrades: { stash: 1 } });
  w.player.dir = 2;
  const a = w.aimPreview();
  assert.ok(a && Math.abs(a.x - w.player.x - a.max) < 3, 'lands at max range in the open');
  const r = new World(room({ spawn: [5, 3] }), { char: 'ramil', upgrades: { stash: 1 } });
  assert.ok(r.aimPreview().max > a.max);
  w.player.dir = 1; w.player.x = c(2);
  assert.ok(w.aimPreview().hitWall, 'stops at the wall');
  w.player.items = ['pandesal', 'tsinelas', 'tsinelas'];
  assert.ok(w.cycleItem());
  assert.equal(w.player.items.at(-1), 'pandesal');
  assert.equal(w.player.items.length, 3);
  w.player.items = ['tsinelas', 'tsinelas'];
  assert.equal(w.cycleItem(), false, 'one kind: nothing to cycle');
});

test('seen going into a hiding spot: the adult knows (and the kid says so)', () => {
  const w = new World(room({ spawn: [3, 3], hide: [{ kind: 'box', at: [3, 3] }], adults: [{ type: 'mama', at: [6, 3], face: Math.PI }] }));
  w.update(1 / 60, { ...idle, action: true, actionPressed: true });
  assert.ok(w.player.hidden);
  assert.ok(w.adults[0].sawHide);
  assert.equal(w.say?.text, 'NAKITA AKO!');
});

// ---------------------------------------------------------------- R8 bosses + archetypes
test("Lola's sleep depth: noise drains it, she only wakes at zero; finale hears everything", () => {
  const w = new World(room({ adults: [{ type: 'lola', at: [6, 3], face: 0, cfg: { cycle: { on: 0.01, off: 99 }, depth: true } }] }));
  step(w, 5);
  const l = w.adults[0];
  assert.equal(l.awake, false);
  l.hear({ x: c(5), y: c(3), r: 90, lure: true }, 16);
  assert.equal(l.awake, false, 'one noise is not enough');
  assert.ok(l.depth < 1 && l.depth > 0);
  for (let i = 0; i < 4 && !l.awake; i++) l.hear({ x: c(5), y: c(3), r: 90, lure: true }, 16);
  assert.ok(l.awake, 'woke once her sleep ran out');

  const f = new World(room({ adults: [{ type: 'lola', at: [9, 3], face: 0, cfg: { hairTrigger: true } }] }));
  f.adults[0].hear({ x: c(2), y: c(2), r: 48, cont: true }, 30);
  assert.equal(f.adults[0].state, 'chase');
});

test('Tatay follows his dog\'s barks from anywhere; a busy (bribed) dog leaves him guessing', () => {
  const L = room({ adults: [{ type: 'tatay', at: [10, 5], face: 0, cfg: { followsDog: 1 } }, { type: 'aso', at: [2, 1], face: 0 }] });
  assert.deepEqual(validateLevel(L), []);
  const w = new World(L);
  w.noise({ x: c(2), y: c(2), r: 60, lure: true, from: w.adults[1] });
  w.hearNoises(1 / 60);
  step(w, 30);
  assert.equal(w.adults[0].state, 'investigate');
  assert.ok(validateLevel({ ...L, adults: [{ type: 'tatay', at: [10, 5], cfg: { followsDog: 0 } }] }).length > 0);
});

test('party guests block sight; the cone is cut short behind them', () => {
  const L = room({ spawn: [4, 3], targets: [{ at: [1, 1], coins: 1 }], adults: [{ type: 'mama', at: [8, 3], face: Math.PI }, { type: 'bisita', at: [6, 3] }] });
  const w = new World(L);
  step(w, 2);
  assert.equal(w.adults[0].canSee(w.player), false);
  assert.ok(w.adults[0].rays[16] < 2 * TILE + 2, 'ray stops at the guest');
  w.adults[1].x = c(6); w.adults[1].y = c(1);
  step(w);
  assert.equal(w.adults[0].canSee(w.player), true);
  assert.equal(w.adults[1].canSee(w.player), false, 'guests are harmless');
});

test('tanod sweeps his flashlight while walking; tindera gives up the chase away from her stall', () => {
  const w = new World(room({ spawn: [1, 5], adults: [{ type: 'tanod', route: [[2, 1], [9, 1]] }, { type: 'tindera', at: [9, 4], face: Math.PI }] }));
  const offs = new Set();
  for (let i = 0; i < 120; i++) { step(w); offs.add(Math.round(w.adults[0].lookOff * 10)); }
  assert.ok(offs.size > 4, 'flashlight moves');
  const t = w.adults[1];
  t.state = 'chase'; t.alert = 1; t.last = { x: c(1), y: c(4) }; t.x = c(4); t.y = c(4);
  w.player.x = c(1); w.player.y = c(1); w.player.graceT = 99;
  step(w);
  assert.notEqual(t.state, 'chase');
});

test('a tricycle knocks you down (stun + horn noise) but never catches you', () => {
  const w = new World(room({ spawn: [5, 3], adults: [{ type: 'trike', route: [[1, 3, 0], [10, 3, 0]] }] }));
  let stunned = false;
  for (let i = 0; i < 300 && !stunned; i++) { step(w); stunned = w.player.stunT > 0; }
  assert.ok(stunned);
  assert.equal(w.status, 'play');
  assert.equal(w.adults[0].caught, false);
});

// ---------------------------------------------------------------- T2 generator + daily
test('daily house rolls over at midnight Manila time, harder on weekends', () => {
  assert.equal(dailyId(new Date(Date.UTC(2026, 10, 8, 16, 30))), '2026-11-9', '00:30 in Manila is already the 9th');
  assert.equal(dailyId(new Date(Date.UTC(2026, 10, 8, 15, 30))), '2026-11-8');
  assert.equal(dailySeed(new Date(Date.UTC(2026, 10, 8, 16, 30))), dailySeed(new Date(Date.UTC(2026, 10, 9, 10))));
  assert.equal(prevDailyId('2026-3-1'), '2026-2-28');
  assert.equal(prevDailyId('2027-1-1'), '2026-12-31');
  assert.equal(dailyDiff(new Date(Date.UTC(2026, 10, 8, 4))), 5, 'Sunday');
  assert.equal(dailyDiff(new Date(Date.UTC(2026, 10, 9, 4))), 2, 'Monday');
  assert.ok(isPasko(new Date(Date.UTC(2026, 11, 24))) && isPasko(new Date(Date.UTC(2027, 0, 5))) && !isPasko(new Date(Date.UTC(2027, 1, 1))));
});

test('mutators and Pasko keep houses valid; riskier stashes hold more', () => {
  for (const seed of [1100, 1200, 1300]) {
    const base = generateHouse(seed, 3);
    const t = generateHouse(seed, 3, { mutators: ['tsinelas'] });
    assert.ok(t.noThrow && !t.items.some((i) => i.kind === 'tsinelas' || i.kind === 'pandesal'));
    const b = generateHouse(seed, 3, { mutators: ['bisita'] });
    assert.ok(b.adults.length >= base.adults.length + 1);
    const n = generateHouse(seed, 3, { mutators: ['brownout'] });
    assert.ok(n.night && n.brownout);
    const p = generateHouse(seed, 4, { pasko: true });
    assert.ok(p.pasko && p.night && p.name === 'NOCHE BUENA');
    for (const L of [t, b, n, p]) { assert.deepEqual(validateLevel(L), []); assert.ok(idleSafe(L, 4)); }
  }
  assert.equal(mutatorMult(['brownout', 'bisita']), 1.875);
  // risk ordering: the target with the most adult waypoints near it never holds fewer coins than a quieter one
  for (let seed = 1000; seed < 1020; seed++) {
    const L = generateHouse(seed, 4);
    const risk = (t) => L.adults.reduce((s, a) => s + (a.route || [a.at]).filter((q) => Math.abs(q[0] - t.at[0]) + Math.abs(q[1] - t.at[1]) <= 4).length, 0);
    const ts = [...L.targets].sort((a, b) => risk(a) - risk(b));
    for (let i = 1; i < ts.length; i++) if (risk(ts[i]) > risk(ts[i - 1])) assert.ok(ts[i].coins >= ts[i - 1].coins, `seed ${seed}`);
  }
});

test('gameplay randomness is seeded: the same inputs replay identically', () => {
  const L = generateHouse(1234, 5);
  const run = () => {
    const w = new World(L);
    const moves = [[1, 0], [0, -1], [-1, 0], [0, 1]];
    for (let i = 0; i < 60 * 30 && w.status === 'play'; i++) { const [x, y] = moves[Math.floor(i / 90) % 4]; w.update(1 / 60, { ...idle, mv: { x, y, mag: 1, run: i % 300 < 60 } }); }
    return JSON.stringify([w.player.x, w.player.y, w.adults.map((a) => [a.x, a.y, a.state]), w.status]);
  };
  assert.equal(run(), run());
});

// ---------------------------------------------------------------- T3 save
test('save: old saves migrate, junk is repaired, save codes round-trip and reject damage', () => {
  const v1 = { unlocked: 4, stars: { a: 3 }, bank: 12, chars: ['bing'], char: 'nene', haptics: false };
  const s = migrate(v1);
  assert.equal(s.v, SAVE_VERSION);
  assert.equal(s.unlocked, 4); assert.equal(s.bank, 12);
  assert.deepEqual(s.chars, ['jun', 'bing']); assert.equal(s.char, 'jun', 'unowned char reset');
  assert.ok(s.opts && s.opts.music > 0 && Array.isArray(s.outfits));
  assert.deepEqual(migrate('garbage'), fresh());
  assert.equal(migrate({ bank: 'lots', stars: [], outfit: 'nope' }).bank, 0);
  const code = saveCode(s);
  assert.deepEqual(readSaveCode(code), s);
  assert.deepEqual(readSaveCode(`  ${code.slice(0, 20)}\n${code.slice(20)} `), s, 'whitespace from chat apps is fine');
  assert.equal(readSaveCode(code.replace(/.$/, (ch) => (ch === 'a' ? 'b' : 'a'))), null);
  assert.equal(readSaveCode('hello'), null);
});

// ---------------------------------------------------------------- R6 economy
test('upgrades and kid traits can never remove the tension (floors)', () => {
  for (const ch of ['jun', 'bing', 'ramil', 'nene']) {
    const m = computeMods(ch, { quiet: 3, hands: 3, shadow: 3 });
    assert.ok(m.runNoise >= FLOORS.runNoise && m.stealTime >= FLOORS.stealTime && m.alertRate >= FLOORS.alertRate, ch);
  }
  const st = upgradeStat({ char: 'jun', upgrades: { quiet: 1 } }, 'quiet');
  assert.equal(st.label, 'NOISE');
  assert.ok(st.next !== null && st.frac > 0 && st.frac < 1);
});

test('payouts: replays pay less, houses pay less each time today, the daily pays once', () => {
  assert.equal(campaignPayout({ coins: 6, stars: 2, first: true, bossBonus: 10 }), 18);
  assert.equal(campaignPayout({ coins: 6, stars: 3, prevStars: 2, first: false }), 4, 'half coins + 1 new star');
  const h0 = housePayout({ coins: 6, stars: 3, diff: 3, housesToday: 0 }), h5 = housePayout({ coins: 6, stars: 3, diff: 3, housesToday: 5 });
  assert.ok(h0 > h5 && h5 >= 1);
  assert.ok(housePayout({ coins: 6, stars: 3, diff: 5 }) > housePayout({ coins: 6, stars: 3, diff: 1 }));
  assert.ok(housePayout({ coins: 6, stars: 3, diff: 3, mult: 1.5 }) > h0);
  assert.equal(housePayout({ coins: 6, stars: 3, diff: 3, daily: true, prevStars: 3 }), 0);
});

test('star milestones and mutator clears unlock cosmetics; cosmetics can be bought', () => {
  const s = fresh();
  s.stars = Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`l${i}`, 3]));
  assert.equal(totalStars(s), 12);
  const got = grantUnlocks(s);
  assert.ok(got.some((u) => u.id === 'jersey'));
  assert.equal(grantUnlocks(s).length, 0, 'only once');
  s.mutatorClears.bisita = true;
  assert.ok(grantUnlocks(s).some((u) => u.id === 'barong'));
  assert.ok(grantUnlocks(s, { pasko: true }).some((u) => u.id === 'pasko'));
  s.bank = 20;
  assert.equal(buyCosmetic(s, 'decor', 'pusa'), 'bought');
  assert.equal(s.bank, 14);
  assert.equal(buyCosmetic(s, 'decor', 'jeep'), 'locked');
});

// ---------------------------------------------------------------- N6 ghosts
test('ghost recordings pack small and replay smoothly', () => {
  const samples = Array.from({ length: 50 }, (_, i) => [i * 3, 100 + i, i % 7 === 0]);
  const str = encodeGhost(samples);
  assert.equal(str.length, 50 * 5);
  assert.deepEqual(decodeGhost(str), samples);
  const at = ghostAt(samples, 0.15); // halfway between sample 1 and 2
  assert.ok(Math.abs(at.x - 4.5) < 1e-9);
  assert.equal(ghostAt(samples, 100), null);
  assert.deepEqual(decodeGhost('zz!!0'), []);
});

// ---------------------------------------------------------------- T5 pathfinding
test('A* finds shortest paths and stays fast on a big map', () => {
  const rows = ['#'.repeat(40)];
  for (let y = 1; y < 39; y++) rows.push('#' + '.'.repeat(38) + '#');
  rows.push('#'.repeat(40));
  const map = new TileMap(rows);
  assert.equal(findPath(map, 1, 1, 38, 38).length, 38 + 38 - 1);
  const t0 = performance.now();
  for (let i = 0; i < 300; i++) findPath(map, 1 + (i % 30), 1, 38, 38 - (i % 30));
  assert.ok(performance.now() - t0 < 1500, 'fast enough');
  assert.equal(findPath(twoRooms('#'), 1, 1, 8, 1), null);
});
