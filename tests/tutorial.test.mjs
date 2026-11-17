// The L1 tutorial coach (src/game/tutorial.js): one step at a time, steps already done are skipped, reactive lines
// take over while they apply, and every line fits the 240 px screen in both wordings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World } from '../src/game/world.js';
import { TILE } from '../src/world/tilemap.js';
import { Coach, SALA_STEPS } from '../src/game/tutorial.js';
import { textWidth } from '../src/ui/font.js';
import { playBot } from './bot.mjs';

const L = JSON.parse(readFileSync(new URL('../src/data/levels/01-sala.json', import.meta.url), 'utf8'));
const put = (p, tx, ty) => { p.x = tx * TILE + TILE / 2; p.y = ty * TILE + TILE / 2; };

test('tutorial: SALA teaches move, door, pick up, lever, cone, kupit, sapat na, throw, exit, in that order', () => {
  assert.deepEqual(SALA_STEPS.map((s) => s.id), ['move', 'door', 'pickup', 'lever', 'cone', 'kupit', 'more', 'sapat', 'throw', 'exit']);
  const w = new World(L), c = new Coach(w), p = w.player, at = () => c.step.id;
  assert.equal(at(), 'move');
  assert.ok(c.view().focus && c.view().btn === 'move', 'the door is pointed at, with a ghost finger');
  put(p, 11, 13); c.update(0.016);
  assert.equal(at(), 'door');
  assert.equal(c.view().btn, 'act');
  w.map.set(11, 12, 'd'); c.update(0.016);
  assert.equal(at(), 'pickup');
  p.items.push('tsinelas'); c.update(0.016);
  assert.equal(at(), 'lever');
  w.toggleSwitch(w.switches[0], true); c.update(0.016);
  assert.equal(at(), 'cone');
  w.coins = 1; c.update(0.016);
  assert.equal(at(), 'more', 'kupit is skipped once a coin is in hand');
  put(p, 10, 5); w.coins = 3; c.update(0.016);
  assert.equal(at(), 'sapat');
  for (let i = 0; i < 300; i++) c.update(1 / 60);
  assert.equal(at(), 'throw');
  assert.equal(c.view().btn, 'throw');
  assert.deepEqual([c.view().focus.tx, c.view().focus.ty], [10, 8], 'the mark to throw at (level coach.throwAt)');
  w.stats.throws = 1; c.update(0.016);
  assert.equal(at(), 'exit');
  assert.deepEqual([c.view().focus.x, c.view().focus.y], [w.exit.x, w.exit.y]);
});

test('tutorial: no slipper in hand skips the throw lesson; out-of-order play is never stuck on an old step', () => {
  const w = new World(L), c = new Coach(w);
  w.map.set(11, 12, 'd'); w.toggleSwitch(w.switches[0], true); w.coins = 3; put(w.player, 9, 3);
  c.update(0.016);
  assert.equal(c.step.id, 'sapat');
  for (let i = 0; i < 300; i++) c.update(1 / 60);
  assert.equal(c.step.id, 'exit', 'never picked the tsinelas up: no throw step');
});

test('tutorial: reactive lines (hiding, the staged beat, being seen, a close call) take over, then the step returns', () => {
  const w = new World(L), c = new Coach(w), mama = w.adults[0];
  w.player.hidden = w.hides[1];
  mama.staged = true;
  assert.match(c.view().lines[0], /^SAFE/);
  w.player.hidden = null;
  assert.match(c.view().lines[0], /^TAGO/);
  assert.ok(c.view().focus, 'points at a hiding spot');
  mama.staged = false; mama.alert = 0.5;
  assert.match(c.view().lines[0], /SEES YOU/);
  mama.alert = 0;
  assert.equal(c.view().reactive, false);
});

test('tutorial: every line fits the screen, touch and keyboard wording', () => {
  const w = new World(L), c = new Coach(w);
  for (const s of SALA_STEPS) for (const touch of [true, false]) for (const line of s.say({ touch }, w, c.m)) {
    assert.ok(textWidth(line) <= 236, `${s.id}: "${line}" is ${textWidth(line)} px`);
  }
});

test('tutorial: SALA is still finishable by the walkthrough bot, sneaking and running', () => {
  assert.ok(playBot(L).ok);
  assert.ok(playBot(L, { run: true }).ok);
});

test('tutorial: an open door and a found tsinelas are not HINALA evidence on the tutorial', () => {
  const w = new World(L), mama = w.adults[0];
  w.items.push({ x: mama.x, y: mama.y, kind: 'tsinelas', noPickT: 1, thrown: true });
  w.arrived(mama);
  assert.equal(w.stats.evidence, 0);
});
