import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TileMap, TILE } from '../src/world/tilemap.js';

const dir = new URL('../src/data/levels/', import.meta.url);
const files = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'));

function reachable(map, from) {
  const seen = new Set([from.join()]);
  const q = [from];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = [x + dx, y + dy];
      if (!map.tileSolid(...n) && !seen.has(n.join())) { seen.add(n.join()); q.push(n); }
    }
  }
  return seen;
}

for (const f of files) {
  test(`level ${f} is valid and solvable`, () => {
    const L = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    const w = L.tiles[0].length;
    L.tiles.forEach((r, i) => assert.equal(r.length, w, `row ${i} width`));
    const map = new TileMap(L.tiles);
    const free = (p, what) => assert.ok(!map.tileSolid(p[0], p[1]), `${what} ${p} is on a solid tile`);
    free(L.spawn, 'spawn');
    free(L.exit, 'exit');
    const reach = reachable(map, L.spawn);
    assert.ok(reach.has(L.exit.join()), 'exit reachable');
    let total = 0;
    for (const t of L.targets) {
      free(t.at, 'target');
      assert.ok(reach.has(t.at.join()), `target ${t.at} reachable`);
      total += t.coins;
    }
    assert.ok(L.quota <= total, 'quota <= available coins');
    for (const a of L.adults) {
      const pts = a.route || [a.at];
      for (const p of pts) free(p, 'adult point');
      for (let i = 0; i < pts.length; i++) { // straight segments must be clear
        const p = pts[i], q = pts[(i + 1) % pts.length];
        for (let k = 0; k <= 40; k++) {
          const x = (p[0] + ((q[0] - p[0]) * k) / 40) * TILE + TILE / 2;
          const y = (p[1] + ((q[1] - p[1]) * k) / 40) * TILE + TILE / 2;
          assert.ok(!map.isSolidAt(x, y), `route ${p}->${q} crosses a solid tile`);
        }
      }
    }
  });
}
