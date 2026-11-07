import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World } from '../src/game/world.js';
import { generateHouse } from '../src/game/house.js';

const dir = new URL('../src/data/levels/', import.meta.url);
const files = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'));
const idle = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false, throwPressed: false, abilityPressed: false };

for (const f of files) {
  test(`dev helpers can finish ${f}: quota, exit, boss phases`, () => {
    const L = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    const w = new World(L);
    w.god = true;
    let phases = 0;
    while (w.devNextPhase()) { w.update(1 / 60, idle); phases++; }
    assert.equal(phases, L.boss ? L.boss.phases.length : 0);
    w.devFillQuota();
    assert.ok(w.open);
    w.devGoToExit();
    for (let i = 0; i < 180 && w.status === 'play'; i++) { // walk the last step
      const dx = w.exit.x - w.player.x, dy = w.exit.y - w.player.y, m = Math.hypot(dx, dy) || 1;
      w.update(1 / 60, { ...idle, mv: { x: dx / m, y: dy / m, mag: 1, run: false } });
    }
    assert.equal(w.status, 'clear');
    assert.ok(w.result.stars >= 1);
  });
}

test('god mode: a chasing adult cannot catch you; without it you are caught', () => {
  const L = generateHouse(1500, 2);
  const mk = (god) => {
    const w = new World(L);
    w.god = god;
    const a = w.adults[0];
    a.x = w.player.x + 6; a.y = w.player.y; a.a = Math.PI;
    a.startChase(w, w.player);
    for (let i = 0; i < 240; i++) w.update(1 / 60, idle);
    return w;
  };
  assert.equal(mk(false).status, 'caught');
  assert.equal(mk(true).status, 'play');
});

test('devClear finishes a level at any time', () => {
  const w = new World(generateHouse(1600, 1));
  w.devClear();
  assert.equal(w.status, 'clear');
});
