// The cat story and the rules it added: dialogue fits the screen, siblings join through scenes, coins buy what
// the kittens need, milk spills when you run, thunder masks noise, and the epilogue has nobody to hide from.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INTRO, BEFORE, ENDING, EPILOGUE, NAMES, CHAPTERS } from '../src/data/story.js';
import { hasBigGlyph } from '../src/ui/font.js';
import { CHARACTERS, NEEDS, NEED_ORDER, buyNeed, needCost, catStage, grantSiblings, MAX_STARS } from '../src/game/progression.js';
import { fresh, migrate } from '../src/core/save.js';
import { World } from '../src/game/world.js';

const dir = new URL('../src/data/levels/', import.meta.url);
const levels = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8')).map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
const byId = Object.fromEntries(levels.map((L) => [L.id, L]));
const scenes = { INTRO, ENDING, EPILOGUE, ...BEFORE };
const IDLE = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false, throwPressed: false, abilityPressed: false };
const step = (w, n, inp = IDLE) => { for (let i = 0; i < n; i++) w.update(1 / 60, inp); };

test('story: every line fits the dialogue box and every character has a glyph', () => {
  for (const [name, panels] of Object.entries(scenes)) {
    for (const p of panels) {
      assert.ok(NAMES[p.who], `${name}: unknown speaker ${p.who}`);
      assert.ok(p.lines.length >= 1 && p.lines.length <= 4, `${name}: 1-4 lines per panel`);
      for (const l of p.lines) {
        assert.ok(l.length <= 37, `${name}: "${l}" is ${l.length} chars (max 37)`);
        for (const ch of l) assert.ok(hasBigGlyph(ch), `${name}: no glyph for "${ch}" in "${l}"`);
      }
    }
  }
  for (const n of Object.values(NAMES)) for (const ch of n) assert.ok(hasBigGlyph(ch));
});

test('story: scenes and chapters point at real levels, and every sibling joins in one of them', () => {
  for (const id of Object.keys(BEFORE)) assert.ok(byId[id], `scene before unknown level ${id}`);
  for (const c of CHAPTERS) assert.ok(byId[c.from], `chapter starts at unknown level ${c.from}`);
  for (const [id, c] of Object.entries(CHARACTERS)) {
    if (id === 'jun') continue;
    assert.ok(BEFORE[c.joins]?.some((p) => p.join === id), `${id} joins in the scene before ${c.joins}`);
  }
  assert.equal(levels.filter((L) => !L.epilogue).length * 3, MAX_STARS);
  assert.ok(levels.at(-1).epilogue && levels.at(-1).hingi, 'the campaign ends on the HINGI epilogue');
});

test('kittens: needs are bought once, grow the litter, and Aling Nena gives a discount once she knows', () => {
  const s = fresh();
  assert.equal(catStage(s), 0);
  assert.equal(buyNeed(s, 'gatas'), 'poor');
  s.bank = 100;
  assert.equal(buyNeed(s, 'gatas'), 'bought');
  assert.equal(buyNeed(s, 'gatas'), 'owned');
  assert.equal(s.bank, 100 - NEEDS.gatas.cost);
  assert.equal(catStage(s), 1);
  const full = needCost(s, 'vet');
  s.story.nena = true;
  assert.ok(needCost(s, 'vet') < full, 'suki price');
  for (const id of NEED_ORDER) buyNeed(s, id);
  assert.equal(catStage(s), NEED_ORDER.length);
});

test('save v2 -> v3: progress lands on the same level, the old sari-sari boss is dropped, earned siblings join', () => {
  const old = { v: 2, unlocked: 13, stars: { '01-sala': 3, 'boss5-sarisari': 2 }, best: { 'boss5-sarisari': 90 }, bank: 12, chars: ['jun'], char: 'jun', story: { intro: true, ending: true } };
  const s = migrate(old);
  assert.equal(levels[s.unlocked].id, 'bagyo', 'the last level unlocked is now the storm');
  assert.equal(s.stars['boss5-sarisari'], undefined);
  assert.equal(s.stars['01-sala'], 3);
  assert.equal(s.story.ending, false, 'the new ending has not been seen');
  assert.deepEqual(grantSiblings(s, levels.map((L) => L.id)), ['bing', 'ramil', 'nene']);
  const mid = migrate({ v: 2, unlocked: 7 });
  assert.equal(levels[mid.unlocked].id, '05-gabi');
});

test('milk: the exit stays shut without it, running spills it, and it goes back to the ref', () => {
  const L = byId.gatas, w = new World(L);
  w.god = true;
  const milk = w.targets.find((t) => t.carry);
  w.coins = L.quota;
  assert.equal(w.open, false, 'coins alone do not open the exit');
  w.player.x = milk.x; w.player.y = milk.y + 14;
  step(w, 60 * 3, { ...IDLE, action: true });
  assert.ok(milk.done && w.player.carry === milk, 'carrying the milk');
  assert.ok(w.open);
  step(w, 5, { ...IDLE, mv: { x: 1, y: 0, mag: 1, run: false } });
  assert.ok(w.player.carry, 'walking is fine');
  step(w, 5, { ...IDLE, mv: { x: 1, y: 0, mag: 1, run: true } });
  assert.equal(w.player.carry, null, 'running spills it');
  assert.equal(milk.done, false);
  assert.equal(w.open, false);
});

test('storm: thunder hides the noise you make; between claps an adult hears you run', () => {
  const room = (storm) => ({ id: 'storm', name: 'X', storm, tiles: ['############', ...Array(6).fill('#..........#'), '############'], spawn: [2, 3], exit: [10, 6], quota: 1, par: 60,
    targets: [{ kind: 'purse', at: [10, 1], coins: 1 }], adults: [{ type: 'mama', at: [5, 3], face: 0 }] }); // facing away from the player
  const lure = (w) => { w.noises.push({ x: w.player.x, y: w.player.y, r: 90, lure: true }); w.hearNoises(1 / 60); step(w, 40); return w.adults[0].state; };
  const quiet = new World(room({ every: 100, dur: 99 }));
  step(quiet, 40);  // 0.5 s in: the thunder is rolling
  assert.ok(quiet.thunder);
  assert.equal(lure(quiet), 'patrol', 'nobody heard a thing');
  const loud = new World(room({ every: 100, dur: 0.01 }));
  step(loud, 40);
  assert.ok(!loud.thunder);
  assert.notEqual(lure(loud), 'patrol', 'between claps the same noise brings her over');
});

test('hingi: nobody can catch you, the button says HINGI, and the one you ask answers', () => {
  const L = byId.hingi, w = new World(L);
  assert.ok(w.adults.every((a) => a.cfg.harmless));
  const gift = w.targets[0];
  w.player.x = gift.x; w.player.y = gift.y + 12;
  step(w, 1);
  assert.equal(w.prompt.label, 'HINGI');
  step(w, 60 * 2, { ...IDLE, action: true });
  assert.ok(gift.done);
  assert.equal(w.adults[gift.from].say?.text, gift.say);
  assert.equal(w.catches, 0);
});

test('ibalik: coins you put back stay back when you are caught', () => {
  const w = new World(byId.ibalik, { lives: 3 });
  w.coins = 5;
  w.caught(w.adults[0]);
  assert.equal(w.coins, 5);
  assert.equal(w.scold.lost, 0);
});
