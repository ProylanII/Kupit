import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TileMap } from '../src/world/tilemap.js';
import { findPath } from '../src/world/pathfind.js';
import { ADULT_TYPES } from '../src/entities/adult.js';

const dir = new URL('../src/data/levels/', import.meta.url);
const files = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'));
const KINDS = {
  items: ['tsinelas', 'pandesal', 'key'], hide: ['box', 'curtain', 'basket'],
  devices: ['tv', 'radio'], traps: ['creak', 'lego'], targets: ['purse', 'bayong', 'wallet', 'piggy'],
};

// Player reachability with keys and switch-operated gates, iterated to a fixpoint.
function solve(L, map) {
  const locks = new Map((L.locks || []).map((l) => [l.at.join(), l.key]));
  const keys = new Set();
  const gates = new Set();
  const pass = (x, y) => {
    const c = map.ch(x, y);
    if (c === 'D') { const k = locks.get(`${x},${y}`); return !k || keys.has(k); }
    if (c === 'G') return gates.has(`${x},${y}`);
    return !map.tileSolid(x, y);
  };
  let reach, before = -1;
  while (true) {
    reach = new Set([L.spawn.join()]);
    const q = [L.spawn];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = [x + dx, y + dy];
        if (pass(...n) && !reach.has(n.join())) { reach.add(n.join()); q.push(n); }
      }
    }
    for (const it of L.items || []) if (it.kind === 'key' && reach.has(it.at.join())) keys.add(it.color);
    for (const s of L.switches || []) if (reach.has(s.at.join())) s.gates.forEach((g) => gates.add(g.join()));
    if (reach.size === before) return reach;
    before = reach.size;
  }
}

for (const f of files) {
  test(`level ${f} is valid and solvable`, () => {
    const L = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    for (const k of ['id', 'name', 'tiles', 'spawn', 'exit', 'quota', 'par', 'targets', 'adults']) assert.ok(k in L, `missing ${k}`);
    const w = L.tiles[0].length;
    L.tiles.forEach((r, i) => assert.equal(r.length, w, `row ${i} width`));
    const map = new TileMap(L.tiles);
    const floor = (p, what) => {
      const c = map.ch(p[0], p[1]);
      assert.ok(!map.tileSolid(p[0], p[1]) && !'dgDG'.includes(c), `${what} ${p} must be on plain floor (got '${c}')`);
    };
    floor(L.spawn, 'spawn');
    floor(L.exit, 'exit');
    const used = new Map();
    const place = (p, what) => {
      floor(p, what);
      assert.ok(!used.has(p.join()), `${what} ${p} overlaps ${used.get(p.join())}`);
      used.set(p.join(), what);
    };
    for (const [list, kinds] of Object.entries(KINDS)) {
      for (const o of L[list] || []) {
        assert.ok(kinds.includes(o.kind || kinds[0]), `${list}: unknown kind ${o.kind}`);
        place(o.at, `${list}:${o.kind}`);
      }
    }
    for (const s of L.switches || []) {
      place(s.at, 'switch');
      for (const g of s.gates) assert.equal(map.ch(g[0], g[1]), 'G', `switch gate ${g} is not a 'G' tile`);
    }
    for (const l of L.locks || []) {
      assert.equal(map.ch(l.at[0], l.at[1]), 'D', `lock ${l.at} is not on a door`);
      assert.ok((L.items || []).some((i) => i.kind === 'key' && i.color === l.key), `no ${l.key} key for lock ${l.at}`);
    }

    const reach = solve(L, map);
    assert.ok(reach.has(L.exit.join()), 'exit reachable');
    let total = 0;
    for (const t of L.targets) { assert.ok(reach.has(t.at.join()), `target ${t.at} reachable`); total += t.coins; }
    assert.ok(L.quota <= total, 'quota <= available coins');
    for (const it of L.items || []) assert.ok(reach.has(it.at.join()), `item ${it.kind} ${it.at} reachable`);

    for (const a of L.adults) {
      assert.ok(ADULT_TYPES[a.type], `unknown adult type ${a.type}`);
      const pts = a.route || [a.at];
      for (const p of pts) floor(p, `${a.type} point`);
      const pass = (x, y) => map.ch(x, y) === 'D' || !map.tileSolid(x, y);
      for (let i = 0; i < pts.length && pts.length > 1; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        assert.ok(findPath(map, p[0], p[1], q[0], q[1], pass), `${a.type} route ${p}->${q} has no path`);
      }
      assert.notEqual(L.spawn.join(), pts[0].slice(0, 2).join(), `${a.type} starts on the spawn`);
    }
  });
}
