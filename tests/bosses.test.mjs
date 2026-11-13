// Design overhaul Phase 5: the boss redesigns (Blueprint 8). Each boss ends its own way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TILE } from '../src/world/tilemap.js';
import { World } from '../src/game/world.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/levels/${f}.json`, import.meta.url), 'utf8'));
const c = (t) => t * TILE + TILE / 2;
const idle = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false, throwPressed: false };
const step = (w, n = 1, inp = idle) => { for (let i = 0; i < n; i++) w.update(1 / 60, inp); };
const atFinale = (L) => { const w = new World(L); w.coins = L.quota; step(w); return w; };

// ---- 8.1 LOLA'S SIESTA
test('LOLA: a loud snore every 4 s masks every sound near her', () => {
  const w = new World(load('boss1-lola')), lola = w.adults[0];
  w.player.hidden = { kind: 'box', x: 0, y: 0 };
  let masked = 0, open = 0;
  for (let i = 0; i < 60 * 30; i++) {
    step(w);
    if (lola.awake) continue;
    if (w.masked(lola.x + 20, lola.y) === 'snore') masked++; else open++;
  }
  assert.ok(masked > 60 && open > 60, `masked ${masked} / open ${open} frames while she sleeps`);
  lola.awake = false; lola.snoreT = 0.5;
  assert.equal(w.masked(lola.x + 20, lola.y), 'snore');
  assert.equal(w.masked(lola.x + 90, lola.y), null, 'only near her');
});

test('LOLA: the creaky door opens silently if you hold ACT 1.5 s, and creaks if you let go early', () => {
  const L = load('boss1-lola');
  const door = (hold) => {
    const w = new World(L), p = w.player;
    w.adults.length = 0; // (nobody to react; just the door)
    p.x = c(11); p.y = c(12);
    const press = { ...idle, action: true, actionPressed: true };
    w.update(1 / 60, press);
    assert.ok(w.doorHold, 'holding the creaky door');
    let creaks = 0;
    for (let i = 0; i < hold; i++) { w.update(1 / 60, { ...idle, action: true }); creaks += w.events.filter((e) => e.type === 'creak').length; w.events.length = 0; }
    w.update(1 / 60, idle); creaks += w.events.filter((e) => e.type === 'creak').length;
    return { open: w.map.ch(11, 13) === 'd', creaks };
  };
  assert.deepEqual(door(100), { open: true, creaks: 0 });
  assert.deepEqual(door(20), { open: true, creaks: 1 });
});

test('LOLA finale: silentExit with no escape timer; one sound is a close call', () => {
  const w = atFinale(load('boss1-lola')), lola = w.adults[0];
  assert.equal(w.finale?.type, 'silentExit');
  assert.equal(w.escapeT, 0);
  assert.ok(lola.awake && !lola.snoring);
  w.player.x = c(2); w.player.y = c(12);
  w.noise({ x: lola.x + 40, y: lola.y + 40, r: 120, lure: true });
  w.hearNoises(1 / 60);
  assert.equal(lola.caught, true);
  assert.equal(lola.say?.text, "APO? IKAW BA 'YAN?");
});

test('LOLA finale: wait 25 s and she gets up and shuffles to the door', () => {
  const w = atFinale(load('boss1-lola')), lola = w.adults[0];
  w.player.hidden = { kind: 'box', x: 0, y: 0 };
  const home = [lola.x, lola.y];
  step(w, 60 * 24);
  assert.deepEqual([lola.x, lola.y], home, 'she stays put for 25 s');
  step(w, 60 * 6);
  assert.ok(Math.hypot(lola.x - home[0], lola.y - home[1]) > 8, 'then she gets up');
});

// ---- 8.2 MAMA SA KUSINA
test('MAMA: from 5 coins the pot boils over every 12 s (the stove glows a second first) and she is blind at it', () => {
  const L = load('boss2-mama');
  const w = new World(L), mama = w.adults[0];
  w.player.hidden = { kind: 'box', x: 0, y: 0 };
  w.coins = 5; step(w);
  const ev = [];
  let blind = 0;
  for (let i = 0; i < 60 * 24; i++) { step(w); ev.push(...w.events.map((e) => [e.type, +w.time.toFixed(1)])); w.events.length = 0; if (mama.state === 'boil') { blind++; assert.equal(mama.seen, false); } }
  const warn = ev.find((e) => e[0] === 'boilWarn'), boil = ev.find((e) => e[0] === 'boil');
  assert.ok(warn && boil && Math.abs(boil[1] - warn[1] - 1) < 0.1, JSON.stringify([warn, boil]));
  assert.ok(blind > 60 * 3, 'a long window');
});

test('MAMA finale: seat, no exit; sit unseen and she says "ABA, NAUNA KA PA?"', () => {
  const L = load('boss2-mama');
  const w = atFinale(L), mama = w.adults[0], f = w.finale;
  assert.equal(f.type, 'seat');
  assert.equal(w.escapeT, 0);
  w.player.x = w.exit.x; w.player.y = w.exit.y; step(w);
  assert.equal(w.status, 'play', 'the exit is not the way out');
  mama.cfg.range = 0; // looking away
  w.player.x = f.seatPt.x; w.player.y = f.seatPt.y - 4;
  assert.equal(w.context().kind, 'seat');
  w.update(1 / 60, { ...idle, action: true, actionPressed: true });
  step(w, 40);
  assert.equal(w.status, 'clear');
  assert.equal(mama.say?.text, 'ABA, NAUNA KA PA?');
});

test('MAMA finale: seen in the last second before you sit is a close call; so is the sixth plate', () => {
  const L = load('boss2-mama');
  const w = atFinale(L), mama = w.adults[0], f = w.finale;
  w.player.x = f.seatPt.x; w.player.y = f.seatPt.y - 4;
  w.update(1 / 60, { ...idle, action: true, actionPressed: true });
  f.lastSeen = w.time; // she just saw you
  step(w, 40);
  assert.notEqual(w.status, 'clear');
  assert.ok(w.catches === 1 || w.scold, 'a close call');
  const w2 = atFinale(L);
  w2.player.hidden = { kind: 'box', x: 0, y: 0 };
  let plates = 0;
  for (let i = 0; i < 60 * 40 && !w2.scold && !w2.catches; i++) { step(w2); plates += w2.events.filter((e) => e.type === 'plate').length; w2.events.length = 0; }
  assert.equal(plates, 6);
  assert.ok(w2.scold || w2.catches === 1, '"JUN! KAIN NA!"');
});

// ---- 8.3 TATAY + ASO
const fishOf = (w) => w.targets.find((t) => t.kind === 'isda');
test('TATAY: only the fish leaves a scent trail, twice as dense when you run; it never spills', () => {
  const L = load('boss3-tatay');
  const trail = (carry, run) => {
    const w = new World(L); w.adults.length = 0;
    if (carry) { const f = fishOf(w); f.done = true; w.player.carry = f; }
    for (let i = 0; i < 60 * 3; i++) w.update(1 / 60, { ...idle, mv: { x: i % 120 < 60 ? 1 : -1, y: 0, mag: 1, run } });
    return { n: w.trail.length, carry: !!w.player.carry };
  };
  assert.equal(trail(false, false).n, 0);
  const walk = trail(true, false), run = trail(true, true);
  assert.ok(run.n >= walk.n * 1.7, `walk ${walk.n} run ${run.n}`);
  assert.ok(run.carry, 'running did not spill the fish');
});

test('TATAY: the dog on the fish grabs it; Tatay laughs, the fish goes back, a close call', () => {
  const w = new World(load('boss3-tatay'), { lives: 3 }), dog = w.adults[1], fish = fishOf(w);
  fish.done = true; w.player.carry = fish;
  w.player.x = dog.x + 6; w.player.y = dog.y; w.player.graceT = 0;
  step(w);
  assert.equal(w.player.carry, null);
  assert.equal(fish.done, false, 'back on its plate');
  assert.ok(w.scold || w.catches === 1);
  assert.equal(w.adults[0].say?.text, 'HAHA! IKAW PALA, ASO!');
});

test('TATAY: the bread bag gives one pandesal at a time, every 8 s; with the fish you cannot hide', () => {
  const w = new World(load('boss3-tatay')), bag = w.breadBag;
  w.adults.length = 0;
  w.player.x = bag.x; w.player.y = bag.y + 10;
  assert.equal(w.context().kind, 'bread');
  w.update(1 / 60, { ...idle, action: true, actionPressed: true });
  assert.deepEqual(w.player.items.filter((i) => i === 'pandesal'), ['pandesal']);
  w.player.items = [];
  step(w, 60 * 7);
  assert.notEqual(w.context()?.kind, 'bread', 'still refilling');
  step(w, 60 * 1.2);
  assert.equal(w.context().kind, 'bread');
  const h = w.hides[0]; w.player.x = h.x; w.player.y = h.y + 8;
  const f = fishOf(w); f.done = true; w.player.carry = f;
  assert.notEqual(w.context()?.kind, 'hide');
});

test('TATAY finale: carryOut; the 35 s timer starts once you have the quota and the fish', () => {
  const w = atFinale(load('boss3-tatay'));
  assert.equal(w.finale.type, 'carryOut');
  w.adults.length = 0;
  step(w);
  assert.equal(w.escapeT, 0, 'not yet: no fish');
  const f = fishOf(w); f.done = true; w.player.carry = f;
  step(w);
  assert.ok(w.escapeT > 34);
});

// ---- 8.4 NINANG'S PARTY
test('NINANG: a name every 15 s, fan up 2 s before; JUN about one in three and never twice in a row', () => {
  const w = new World(load('boss4-fiesta'));
  w.player.hidden = { kind: 'box', x: 0, y: 0 };
  const ev = [];
  for (let i = 0; i < 60 * 15 * 30; i++) {
    step(w);
    for (const e of w.events) if (e.type === 'fanRaise' || e.type === 'nameCall') ev.push([e.type, w.time, e.jun]);
    w.events.length = 0;
    if (w.call?.active) w.call.active = null; // (answer every call: this test is about timing)
  }
  const calls = ev.filter((e) => e[0] === 'nameCall'), fans = ev.filter((e) => e[0] === 'fanRaise');
  assert.ok(calls.length >= 28, `${calls.length} calls`);
  for (let i = 0; i < calls.length; i++) assert.ok(Math.abs(calls[i][1] - fans[i][1] - 2) < 0.05, 'the fan goes up 2 s before');
  for (let i = 1; i < calls.length; i++) assert.ok(!(calls[i][2] && calls[i - 1][2]), 'never JUN twice running');
  const juns = calls.filter((c) => c[2]).length;
  assert.ok(juns >= 5 && juns <= 14, `${juns} of ${calls.length}`);
});

test('NINANG: miss a JUN call (no blending, not near her) and the whole room turns to look', () => {
  const w = new World(load('boss4-fiesta'));
  const p = w.player; p.x = c(13); p.y = c(19);
  w.call = { t: 99, last: null, active: { t: 0.05 }, warned: false };
  step(w, 5);
  assert.ok(w.adults.filter((a) => !a.cfg.harmless).every((a) => a.alert >= 0.5), 'everyone glances');
});

test('NINANG finale: photo; in the zone blending = in the photo, out of every cone = not in it, else ISA PA', () => {
  const L = load('boss4-fiesta');
  const w = atFinale(L);
  assert.equal(w.finale.type, 'photo');
  assert.equal(w.escapeT, 0);
  const p = w.player;
  p.x = c(7); p.y = c(2); p.blend = true;
  assert.equal(w.photoOutcome(), 'in');
  p.blend = false;
  assert.equal(w.photoOutcome(), 'miss', 'in the zone but not blending');
  p.hidden = { kind: 'box', x: c(1), y: c(19) };
  assert.equal(w.photoOutcome(), 'out', 'hidden: out of every cone');
});
