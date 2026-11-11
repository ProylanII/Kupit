// Suggests (or writes) a secret alkansya spot for each handmade level: the reachable plain-floor tile
// farthest from the main route (spawn -> every target -> exit), so finding it is a real detour.
//   node tools/place-alkansya.mjs            print suggestions
//   node tools/place-alkansya.mjs --write    add "alkansya" to levels that don't have one yet
import { readFileSync, writeFileSync } from 'node:fs';
import { TileMap } from '../src/world/tilemap.js';
import { solve, validateLevel } from '../src/game/validate.js';

const dir = new URL('../src/data/levels/', import.meta.url);
const files = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'));
const write = process.argv.includes('--write');
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function suggestAlkansya(L) {
  const map = new TileMap(L.tiles);
  const reach = solve(L, map);
  const key = (x, y) => `${x},${y}`;
  // BFS inside the reachable set from one tile; returns parent map
  const bfs = (from) => {
    const par = new Map([[key(...from), null]]), q = [from];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of N4) {
        const k = key(x + dx, y + dy);
        if (reach.has(k) && !par.has(k)) { par.set(k, key(x, y)); q.push([x + dx, y + dy]); }
      }
    }
    return par;
  };
  const route = new Set();
  const addPath = (a, b) => { const par = bfs(a); for (let k = key(...b); k; k = par.get(k)) route.add(k); };
  let prev = L.spawn;
  for (const t of L.targets) { addPath(prev, t.at); prev = t.at; }
  addPath(prev, L.exit);
  // multi-source BFS: distance of every reachable tile from the route
  const d = new Map([...route].map((k) => [k, 0])), q = [...route].map((k) => k.split(',').map(Number));
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of N4) {
      const k = key(x + dx, y + dy);
      if (reach.has(k) && !d.has(k)) { d.set(k, d.get(key(x, y)) + 1); q.push([x + dx, y + dy]); }
    }
  }
  const used = new Set([key(...L.spawn), key(...L.exit)]);
  const mark = (p, r = 0) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) used.add(key(p[0] + dx, p[1] + dy)); };
  for (const t of L.targets) mark(t.at, 1);
  for (const list of ['items', 'hide', 'devices', 'traps', 'switches']) for (const o of L[list] || []) mark(o.at);
  for (const a of L.adults) for (const p of a.route || [a.at]) mark(p);
  let best = null, bs = -1;
  for (const [k, v] of d) {
    const [x, y] = k.split(',').map(Number);
    if (used.has(k) || '.,;R'.indexOf(map.ch(x, y)) < 0) continue;
    const s = v * 100 + Math.abs(x - L.spawn[0]) + Math.abs(y - L.spawn[1]);
    if (s > bs) { bs = s; best = [x, y]; }
  }
  return best && { at: best, detour: d.get(key(...best)) };
}

if (process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  for (const f of files) {
    const url = new URL(f, dir), L = JSON.parse(readFileSync(url, 'utf8'));
    const s = suggestAlkansya({ ...L, alkansya: undefined });
    console.log(`${f.padEnd(24)} ${L.alkansya ? `has ${L.alkansya.at}` : `suggest ${s?.at} (detour ${s?.detour} tiles)`}`);
    if (write && !L.alkansya && s) {
      L.alkansya = { at: s.at, coins: L.boss ? 8 : 5 };
      const errs = validateLevel(L);
      if (errs.length) { console.log('  not written:', errs); continue; }
      const txt = readFileSync(url, 'utf8');
      // keep the file's own formatting: insert the new key before "adults"
      const out = txt.replace(/\n(\s*)"adults":/, (m, ind) => `\n${ind}"alkansya": { "at": [${s.at.join(', ')}], "coins": ${L.alkansya.coins} },${m}`);
      writeFileSync(url, out);
    }
  }
}
