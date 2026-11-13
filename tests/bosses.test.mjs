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
