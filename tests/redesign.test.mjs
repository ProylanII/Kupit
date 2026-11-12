// The 2026-11 redesign: missions instead of fixed stars, adult routines, cover that blocks sight (wardrobes, stalls,
// hanging laundry), videoke sound masking, crowd blending, the caught-then-forgiven ending, and the room lint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World, BLEND_R } from '../src/game/world.js';
import { TileMap, TILE } from '../src/world/tilemap.js';
import { hasLos } from '../src/world/los.js';
import { ACTIVITIES, BLEND_SEE } from '../src/entities/adult.js';
import { MISSIONS, missionIds, missionLabel, maskOf, starsOf, maskFromStars, DEFAULT_MISSIONS } from '../src/game/missions.js';
import { validateLevel } from '../src/game/validate.js';
import { migrate, fresh } from '../src/core/save.js';
import { INTRO, BEFORE, ENDING, EPILOGUE, NAMES } from '../src/data/story.js';
import { hasGlyph } from '../src/ui/font.js';
import { lint } from '../tools/level-lint.mjs';

const dir = new URL('../src/data/levels/', import.meta.url);
const levels = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8')).map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
const atlas = JSON.parse(readFileSync(new URL('../assets/sprites/atlas.json', import.meta.url), 'utf8'));
const style = JSON.parse(readFileSync(new URL('../tools/art/style.json', import.meta.url), 'utf8'));
const IDLE = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false, throwPressed: false, abilityPressed: false };
const step = (w, n, inp = IDLE) => { for (let i = 0; i < n; i++) w.update(1 / 60, inp); };
const c = (t) => t * TILE + TILE / 2;
// a 14x9 room: spawn in the bottom-left corner, one purse, whatever adults the test needs
const room = (extra = {}) => ({ id: 'room', name: 'X', tiles: ['##############', ...Array(7).fill('#............#'), '##############'], spawn: [1, 7], exit: [12, 7], quota: 1, par: 60,
  targets: [{ kind: 'purse', at: [12, 1], coins: 1, time: 0.6 }], adults: [], ...extra });

// ---------------------------------------------------------------- missions
test('missions: every level has three, the first is always CLEAR, and the labels fit the screen', () => {
  assert.deepEqual(missionIds({}), ['clear', ...DEFAULT_MISSIONS]);
  assert.deepEqual(missionIds({ missions: ['noHide', 'allCoins'] }), ['clear', 'noHide', 'allCoins']);
  for (const L of levels) {
    const ids = missionIds(L);
    assert.equal(ids.length, 3);
    assert.equal(new Set(ids).size, 3, `${L.id}: three different missions`);
    for (const id of ids) {
      const label = missionLabel(L, id);
      assert.ok(label.length <= 30, `${L.id}: "${label}" is too long for the mission card`);
      for (const ch of label) assert.ok(hasGlyph(ch), `no glyph for ${ch}`);
    }
    if (!L.epilogue) assert.ok(Array.isArray(L.missions) && L.missions.length === 2, `${L.id} names its two missions`);
  }
  const used = new Set(levels.flatMap((L) => L.missions || []));
  assert.ok(used.size >= 8, `the campaign uses a spread of missions (${[...used]})`);
});

test('missions: stars are the missions done in this run; a strict one is lost for good, and said so once', () => {
  const w = new World(room({ missions: ['noThrow', 'fast'] }), { lives: 3 });
  w.god = true;
  w.player.items.push('tsinelas');
  step(w, 2);
  assert.deepEqual(w.missionState().map((m) => m.ok), [true, true, true]);
  step(w, 1, { ...IDLE, throwPressed: true });
  step(w, 2);
  const lost = [];
  for (const e of w.events) if (e.type === 'missionLost') lost.push(e.id);
  assert.deepEqual(lost, ['noThrow']);
  w.events.length = 0;
  step(w, 30);
  assert.ok(!w.events.some((e) => e.type === 'missionLost'), 'announced once only');
  w.devFillQuota(); w.devGoToExit();
  for (let i = 0; i < 200 && w.status === 'play'; i++) { const dx = w.exit.x - w.player.x, dy = w.exit.y - w.player.y, m = Math.hypot(dx, dy) || 1; w.update(1 / 60, { ...IDLE, mv: { x: dx / m, y: dy / m, mag: 1, run: false } }); }
  assert.equal(w.status, 'clear');
  assert.deepEqual(w.result.missions, [true, false, true]);
  assert.equal(w.result.stars, 2);
});

test('missions: goal missions (empty every stash, find the alkansya) are only read at the exit', () => {
  const L = room({ missions: ['allCoins', 'alkansya'], alkansya: { at: [6, 1], coins: 3 }, targets: [{ kind: 'purse', at: [12, 1], coins: 1, time: 0.6 }, { kind: 'purse', at: [3, 1], coins: 1, time: 0.6 }] });
  assert.deepEqual(validateLevel(L), []);
  const w = new World(L);
  step(w, 60);
  assert.ok(!w.events.some((e) => e.type === 'missionLost'), 'not done yet is not lost');
  for (const t of w.targets) { t.done = true; if (t.bonus) w.bonus += t.coins; else w.coins += t.coins; }
  w.finish();
  assert.deepEqual(w.result.missions, [true, true, true]);
  assert.equal(new World(L, { alkansyaFound: true }).alkansyaWasFound, true, 'an alkansya found on an earlier run still counts');
});

test('missions: masks add up across runs, and an old save with only a star count is carried over', () => {
  assert.equal(maskOf([true, false, true]), 5);
  assert.equal(starsOf(5 | 2), 3);
  assert.equal(maskFromStars(2), 3);
  const s = migrate({ v: 3, stars: { '01-sala': 2, 'boss1-lola': 3 }, unlocked: 4 });
  assert.equal(s.missions['01-sala'], 3);
  assert.equal(s.stars['boss1-lola'], 3);
  const t = migrate({ v: 3, stars: { '01-sala': 1 }, missions: { '01-sala': 5 } });
  assert.equal(t.stars['01-sala'], 2, 'the star count always follows the missions');
  assert.deepEqual(fresh().missions, {});
});

test('missions: a level cannot ask for something it does not have', () => {
  assert.ok(validateLevel(room({ missions: ['noBark', 'fast'] })).some((e) => /needs a dog/.test(e)));
  assert.ok(validateLevel(room({ missions: ['fast', 'fast'] })).length > 0);
  assert.ok(validateLevel(room({ missions: ['nope', 'fast'] })).some((e) => /unknown mission/.test(e)));
  for (const id of Object.keys(MISSIONS)) assert.equal(typeof MISSIONS[id].ok, 'function');
});

// ---------------------------------------------------------------- routines
test('routines: a cook at the stove sees nothing, any noise makes her look up, and then she goes back to it', () => {
  const L = room({ adults: [{ type: 'mama', route: [[4, 2, 6, 0, 'luto'], [8, 2, 0.3]] }] });
  assert.deepEqual(validateLevel(L), []);
  const w = new World(L);
  const a = w.adults[0], p = w.player;
  step(w, 60 * 7);                       // there and back: now she is cooking at (4,2), facing right
  assert.equal(a.busy, ACTIVITIES.luto);
  assert.equal(a.range, 0);
  p.x = c(6); p.y = c(2);                // right in front of her
  step(w, 30);
  assert.equal(a.alert, 0, 'she does not notice someone standing in front of the stove');
  w.noises.push({ x: p.x, y: p.y, r: 60 }); w.hearNoises(1 / 60); // a clasp clicks
  step(w, 5);
  assert.equal(a.busy, null, 'she looks up');
  assert.ok(a.range > 0 && a.alert > 0, 'and now she sees you');
});

test('routines: watching TV narrows the cone instead of closing it; unknown routines are rejected', () => {
  const w = new World(room({ adults: [{ type: 'mama', route: [[4, 2, 9, 0, 'tv'], [6, 2, 0.2]] }] }));
  const a = w.adults[0];
  step(w, 60 * 4);
  assert.equal(a.busy, ACTIVITIES.tv);
  assert.ok(a.fov < a.cfg.fov * 0.5 && a.range >= a.cfg.range);
  assert.ok(validateLevel(room({ adults: [{ type: 'mama', route: [[4, 2, 3, 0, 'yoga'], [6, 2]] }] })).some((e) => /unknown routine/.test(e)));
  for (const [id, act] of Object.entries(ACTIVITIES)) {
    assert.ok(act.range >= 0 && act.fov > 0 && act.say, id);
    if (act.pose) assert.ok(style.poses.adult.includes(act.pose), `${id}: pose ${act.pose} is in the sheet`);
  }
  const used = new Set(levels.flatMap((L) => L.adults.flatMap((d) => (d.route || []).map((pt) => pt[4]).filter(Boolean))));
  assert.ok(used.size >= 6, `the campaign shows a spread of routines (${[...used]})`);
});

// ---------------------------------------------------------------- cover
test('cover: wardrobes and stalls are solid and block sight, laundry blocks sight but you walk through it, stools do neither', () => {
  const map = new TileMap(['#########', '#.K.M.L.#', '#.H.W.A.#', '#########']);
  for (const [ch, x, y, solid, opaque] of [['K', 2, 1, true, true], ['M', 4, 1, true, true], ['L', 6, 1, false, true], ['H', 2, 2, true, false], ['W', 4, 2, true, false], ['A', 6, 2, true, false]]) {
    assert.equal(map.tileSolid(x, y), solid, `${ch} solid`);
    assert.equal(map.blocksLosAt(c(x), c(y)), opaque, `${ch} opaque`);
  }
  assert.equal(hasLos(map, { x: c(1), y: c(1) }, { x: c(3), y: c(1) }), false, 'not through a wardrobe');
  assert.equal(hasLos(map, { x: c(5), y: c(1) }, { x: c(7), y: c(1) }), false, 'not through the washing');
  assert.equal(hasLos(map, { x: c(1), y: c(2) }, { x: c(3), y: c(2) }), true, 'over a stool');
});

test('cover: an adult cannot see a kid standing in the laundry, and nothing important hides behind a wardrobe top', () => {
  const tiles = ['##############', '#............#', '#.....L......#', ...Array(5).fill('#............#'), '##############'];
  const w = new World(room({ tiles, adults: [{ type: 'mama', at: [3, 2], face: 0 }] }));
  w.player.x = c(6); w.player.y = c(2);
  step(w, 90);
  assert.equal(w.adults[0].alert, 0);
  w.player.x = c(5);                     // one step out of the washing
  step(w, 90);
  assert.ok(w.adults[0].alert > 0 || w.adults[0].state === 'chase');
  const bad = room({ tiles: ['##############', '#............#', '#...........K#', ...Array(5).fill('#............#'), '##############'] });
  assert.ok(validateLevel(bad).some((e) => /hidden behind the wardrobe/.test(e)), 'the purse at 12,1 would be under the wardrobe top');
});

// ---------------------------------------------------------------- videoke + crowd
test('videoke: during a song nothing near the machine is heard; between songs, and far from it, the same noise is', () => {
  const mk = (on, off, at = [3, 6]) => new World(room({ devices: [{ kind: 'videoke', at, r: 70, on, off }], adults: [{ type: 'mama', at: [6, 4], face: 0 }] }));
  const lure = (w) => { step(w, 5); w.noises.push({ x: w.player.x, y: w.player.y, r: 120, lure: true }); w.hearNoises(1 / 60); step(w, 40); return w.adults[0].state; };
  const singing = mk(100, 1);
  assert.equal(lure(singing), 'patrol');
  assert.equal(singing.cover, 'videoke');
  assert.notEqual(lure(mk(0.01, 100)), 'patrol', 'between songs she comes to look');
  assert.notEqual(lure(mk(100, 1, [11, 1])), 'patrol', 'the machine is too far away to cover you');
  assert.equal(singing.devices.length, 0, 'the videoke is not something you switch on');
  assert.equal(singing.context(), null);
  assert.deepEqual(validateLevel(room({ devices: [{ kind: 'videoke', at: [3, 6] }] })), []);
});

test('crowd: walking beside a guest you are not noticed from across the room; alone, running or up close you are', () => {
  const mk = (guest) => new World(room({ adults: [{ type: 'mama', at: [3, 4], face: 0 }, ...(guest ? [{ type: 'bisita', at: [7, 5] }] : [])] }));
  const put = (w) => { w.player.x = c(7); w.player.y = c(4); };
  const a = mk(true); put(a); step(a, 120);
  assert.ok(a.player.blend, 'blending');
  assert.ok(Math.hypot(a.adults[1].x - a.player.x, a.adults[1].y - a.player.y) < BLEND_R);
  assert.equal(a.adults[0].alert, 0);
  const b = mk(false); put(b); step(b, 120);
  assert.ok(!b.player.blend && (b.adults[0].alert > 0 || b.adults[0].state === 'chase'), 'alone she sees you');
  const r = mk(true); put(r); step(r, 20, { ...IDLE, mv: { x: 0, y: -1, mag: 1, run: true } });
  assert.ok(!r.player.blend, 'running breaks it');
  const near = mk(true); near.player.x = c(3) + BLEND_SEE - 6; near.player.y = c(4); near.adults[1].x = near.player.x; near.adults[1].y = near.player.y + 12; step(near, 60);
  assert.ok(near.adults[0].alert > 0 || near.adults[0].state === 'chase', 'right under her nose it does not help');
  const fiesta = levels.find((L) => L.id === 'boss4-fiesta');
  assert.ok(fiesta.devices.some((d) => d.kind === 'videoke') && fiesta.adults.filter((d) => d.type === 'bisita').length >= 3);
});

// ---------------------------------------------------------------- the story
test('story: he is caught, they see what the coins were for, and nobody scolds him', () => {
  const first = ENDING[0];
  assert.ok(first.caught && first.who !== 'jun' && first.mood === 'angry', 'the ending opens with an adult catching him');
  assert.equal(ENDING.filter((p) => p.caught).length, 1);
  const text = (panels) => panels.map((p) => p.lines.join(' ')).join(' ');
  const cat = ENDING.findIndex((p) => p.who === 'cat');
  assert.ok(cat > 0, 'the kittens give him away');
  assert.ok(ENDING.slice(0, cat).every((p) => p.who === 'jun' || p.mood === 'angry'), 'until then they are angry');
  assert.ok(ENDING.slice(cat + 1).every((p) => p.mood !== 'angry'), 'after that nobody is');
  assert.match(text(ENDING), /Magsabi ka lang/);
  assert.doesNotMatch(text([...INTRO, ...Object.values(BEFORE).flat(), ...ENDING]), /We know|I was waiting for you to tell/i, 'the family did not know all along');
  assert.match(text(EPILOGUE), /caught/i);
  const i = levels.findIndex((L) => L.ending);
  assert.ok(i >= 0 && levels[i + 1]?.epilogue, 'the ending plays when the level before the epilogue is cleared');
  assert.equal(levels.filter((L) => L.ending).length, 1);
});

test('art: every speaker has a portrait in every mood, and the cats are in the sheet', () => {
  const moods = new Set(['', ...style.moods]);
  for (const panels of [INTRO, ENDING, EPILOGUE, ...Object.values(BEFORE)]) for (const p of panels) assert.ok(moods.has(p.mood || ''), `unknown mood ${p.mood}`);
  for (const who of Object.keys(NAMES)) {
    assert.ok(atlas.frames[`portrait|${who}`], `portrait of ${who}`);
    if (who !== 'cat') for (const m of style.moods) assert.ok(atlas.frames[`portrait|${who}|${m}`], `${who} ${m}`);
  }
  for (const kind of style.kinds.cat) for (const f of [0, 1, 2, 3, 'sit', 'sleep']) for (const d of [0, 2, 3]) assert.ok(atlas.frames[`${kind}|${d}|${f}`], `${kind}|${d}|${f}`);
});

// ---------------------------------------------------------------- the rooms
test('rooms: little bare floor, loops to walk around, and at least two sides to stand at for every stash', () => {
  for (const L of levels) {
    if (L.epilogue) continue;
    const { open, islands, ways } = lint(L);
    assert.ok(open <= 0.25, `${L.id}: ${(open * 100).toFixed(0)}% of the floor is bare`);
    assert.ok(islands >= 3, `${L.id}: only ${islands} things to walk around`);
    assert.ok(ways.every((n) => n >= 2), `${L.id}: a stash with a single approach (${ways})`);
  }
  const tiles = new Set(levels.flatMap((L) => L.tiles.join('').split('')));
  for (const ch of 'KMLHWA:') assert.ok(tiles.has(ch), `the campaign uses the ${ch} tile`);
});
