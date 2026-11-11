// Regression tests for bugs found in the November 2026 review (adult AI, gates, locks, font, generator).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World } from '../src/game/world.js';
import { TILE } from '../src/world/tilemap.js';
import { generateHouse } from '../src/game/house.js';
import { validateLevel } from '../src/game/validate.js';
import { hasGlyph } from '../src/ui/font.js';

const idle = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false, throwPressed: false, abilityPressed: false };
const step = (w, n = 1) => { for (let i = 0; i < n; i++) w.update(1 / 60, idle); };
const tileOf = (e) => [Math.floor(e.x / TILE), Math.floor(e.y / TILE)];

// Two corridors joined by an open gate; Mama patrols from the top corridor to the bottom one through it.
const gateLevel = () => ({
  id: 't', name: 'T', quota: 1, par: 60,
  tiles: [
    '###########',
    '#.........#',
    '#####g#####',
    '#.........#',
    '###########',
  ],
  spawn: [9, 3], exit: [8, 3],
  targets: [{ at: [1, 3], coins: 1 }],
  switches: [{ at: [9, 1], gates: [[5, 2]] }],
  adults: [{ type: 'mama', route: [[3, 1, 0], [5, 3, 0]] }],
});

test('an adult never walks through a gate that shut after it planned its route', () => {
  const w = new World(gateLevel());
  const a = w.adults[0];
  step(w, 40); // on her way to the gate
  w.toggleSwitch(w.switches[0], true);
  assert.equal(w.map.ch(5, 2), 'G');
  for (let i = 0; i < 600; i++) {
    step(w);
    const [tx, ty] = tileOf(a);
    assert.ok(!(tx === 5 && ty === 2), `inside the closed gate at frame ${i}`);
    assert.ok(ty < 2, `got to the other side of the closed gate at frame ${i}`);
  }
});

test('an adult whose waypoint becomes unreachable does not teleport', () => {
  const w = new World(gateLevel());
  const a = w.adults[0];
  w.toggleSwitch(w.switches[0], true); // gate shut before she even starts
  let last = { x: a.x, y: a.y };
  for (let i = 0; i < 900; i++) {
    step(w);
    const jump = Math.hypot(a.x - last.x, a.y - last.y);
    assert.ok(jump < 2, `moved ${jump.toFixed(1)}px in one frame at ${i}`);
    last = { x: a.x, y: a.y };
  }
  assert.ok(tileOf(a)[1] < 2, 'stays on her side of the gate');
});

test('a reopened gate lets the blocked adult carry on with her patrol', () => {
  const w = new World(gateLevel());
  const a = w.adults[0];
  w.toggleSwitch(w.switches[0], true);
  step(w, 120);
  w.toggleSwitch(w.switches[0], true); // open again
  let reached = false;
  for (let i = 0; i < 900 && !reached; i++) { step(w); reached = tileOf(a)[1] === 3; }
  assert.ok(reached, 'never made it to the bottom corridor once the gate was open');
});

// Room above, locked room below. Mama's patrol would love to use the locked door.
const lockLevel = (route) => ({
  id: 'l', name: 'L', quota: 1, par: 60,
  tiles: [
    '#########',
    '#.......#',
    '#.......#',
    '####D####',
    '#.......#',
    '#########',
  ],
  spawn: [1, 1], exit: [7, 1],
  targets: [{ at: [7, 4], coins: 1 }],
  items: [{ kind: 'key', color: 'red', at: [1, 2] }],
  locks: [{ at: [4, 3], key: 'red' }],
  adults: [{ type: 'mama', route }],
});

test('adults have no keys: a lure behind a locked door does not unlock it for you', () => {
  const w = new World(lockLevel([[6, 2, 1], [2, 2, 1]]));
  w.god = true;
  for (let i = 0; i < 60 * 20; i++) {
    if (i % 60 === 0) for (const a of w.adults) a.hear({ x: 4 * TILE + 8, y: 4 * TILE + 8, r: 400, lure: true });
    step(w);
    assert.equal(w.map.ch(4, 3), 'D', `the locked door was opened at frame ${i}`);
  }
  assert.ok(w.locks.has('4,3'));
});

test('once the player unlocks the door, adults may use it again', () => {
  const w = new World(lockLevel([[6, 2, 1], [2, 2, 1]]));
  w.locks.delete('4,3');
  const a = w.adults[0];
  assert.ok(a.passable(4, 3));
});

test('the validator rejects a patrol that needs a locked door', () => {
  const L = lockLevel([[6, 2, 1], [6, 4, 1]]);
  assert.ok(validateLevel(L).some((e) => /route .* has no path/.test(e)));
});

test('random houses: no patrol ever opens the locked door', () => {
  let locked = 0;
  for (let s = 2000; s < 2030; s++) for (const d of [3, 4, 5]) {
    const L = generateHouse(s, d);
    if (!L.locks) continue;
    locked++;
    const w = new World(L);
    w.god = true;
    for (let i = 0; i < 60 * 60; i++) {
      step(w);
      for (const l of L.locks) assert.equal(w.map.ch(l.at[0], l.at[1]), 'D', `house ${s}/${d}: lock ${l.at} opened`);
    }
  }
  assert.ok(locked > 20, 'expected plenty of houses with a lock');
});

// One timed lever, one gate, nobody around.
const leverLevel = () => ({
  id: 'v', name: 'V', quota: 1, par: 60,
  tiles: [
    '#######',
    '#.....#',
    '###G###',
    '#.....#',
    '#######',
  ],
  spawn: [3, 1], exit: [5, 3],
  targets: [{ at: [1, 3], coins: 1 }],
  switches: [{ at: [1, 1], gates: [[3, 2]], time: 1 }],
  adults: [{ type: 'lola', at: [5, 1], face: 0 }],
});

test('a timed gate that runs out while you stand in it closes once you step out, and the lever stays in sync', () => {
  const w = new World(leverLevel());
  const p = w.player;
  w.toggleSwitch(w.switches[0], true);
  assert.equal(w.map.ch(3, 2), 'g');
  p.x = 3 * TILE + 8; p.y = 2 * TILE + 8; // stand in the gateway
  step(w, 90); // timer runs out: it must not shut on you
  assert.equal(w.map.ch(3, 2), 'g');
  assert.equal(w.switches[0].on, false);
  p.y = 1 * TILE + 8; // step out
  step(w, 2);
  assert.equal(w.map.ch(3, 2), 'G', 'gate should close as soon as the way is clear');
  w.toggleSwitch(w.switches[0], true);
  assert.equal(w.switches[0].on, true);
  assert.equal(w.map.ch(3, 2), 'g', 'lever ON must mean gate OPEN');
});

test('flipping the lever again while a close is pending keeps the gate open', () => {
  const w = new World(leverLevel());
  const p = w.player;
  w.toggleSwitch(w.switches[0], true); // open
  p.x = 3 * TILE + 8; p.y = 2 * TILE + 8;
  w.toggleSwitch(w.switches[0], true); // try to close on the player: pending
  assert.equal(w.map.ch(3, 2), 'g');
  w.toggleSwitch(w.switches[0], true); // open again: cancels the pending close
  p.y = 1 * TILE + 8;
  step(w, 2);
  assert.equal(w.map.ch(3, 2), 'g');
  assert.equal(w.switches[0].on, true);
});

test('a boss that cannot reach a hiding spot does not catch you in it from afar', () => {
  const L = gateLevel();
  L.hide = [{ kind: 'box', at: [2, 3] }];
  L.adults[0] = { type: 'mama', at: [3, 1], cfg: { checksHides: true } };
  const w = new World(L);
  const a = w.adults[0];
  w.interact({ kind: 'hide', obj: w.hides[0] });
  a.startInspect(w, w.hides[0].x, w.hides[0].y); // plans a route through the open gate
  w.toggleSwitch(w.switches[0], true); // ...which then shuts
  step(w, 600);
  assert.equal(w.status, 'play');
});

test('no throwing while stunned', () => {
  const w = new World(gateLevel());
  w.player.items = ['tsinelas'];
  w.player.stunT = 1;
  w.update(1 / 60, { ...idle, throwPressed: true });
  assert.equal(w.projectiles.length, 0);
  assert.equal(w.player.items.length, 1);
});

test('random houses never put a hiding spot right next to a purse', () => {
  for (let s = 1000; s < 1060; s++) for (let d = 1; d <= 5; d++) {
    const L = generateHouse(s, d);
    for (const h of L.hide) for (const t of L.targets) {
      assert.ok(Math.abs(h.at[0] - t.at[0]) + Math.abs(h.at[1] - t.at[1]) > 1, `house ${s}/${d}: hide ${h.at} next to target ${t.at}`);
    }
  }
});

test('the pixel font has a glyph for every character the game draws', () => {
  const dir = new URL('../src/data/levels/', import.meta.url);
  const texts = ['^', '~', '"DINNER TIME!"', '(HOUSE)', "ANO 'YAN?!", 'x3'];
  for (const f of JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'))) {
    const L = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    texts.push(L.name, L.hint || '', L.boss?.title || '', ...(L.boss?.phases || []).map((p) => p.banner));
  }
  for (const s of texts) for (const ch of s) assert.ok(hasGlyph(ch), `no glyph for ${JSON.stringify(ch)} in ${JSON.stringify(s)}`);
});
