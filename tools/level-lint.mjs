// Level design lint: the three things the room redesign was for, as numbers.   node tools/level-lint.mjs
//   open     share of walkable tiles that sit in the middle of a bare 5x5 patch of floor (big empty rooms)
//   islands  blocks of furniture/walls you can walk all the way around (loops to break a line of sight on)
//   ways     for every stash, how many of the four tiles beside it you can stand on (two or more = two approaches)
// Also runs the validator and the walkthrough bot (sneaking and running) and prints the time against par.
import { readFileSync } from 'node:fs';
import { TileMap } from '../src/world/tilemap.js';
import { validateLevel, idleSafe } from '../src/game/validate.js';
import { playBot } from '../tests/bot.mjs';

const dir = new URL('../src/data/levels/', import.meta.url);
const files = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'));
let bad = 0;

export function lint(L) {
  const map = new TileMap(L.tiles);
  const walk = (x, y) => !map.tileSolid(x, y);
  let floor = 0, open = 0;
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    if (!walk(x, y)) continue;
    floor++;
    let bare = true;
    for (let dy = -2; dy <= 2 && bare; dy++) for (let dx = -2; dx <= 2; dx++) if (!walk(x + dx, y + dy) || map.ch(x + dx, y + dy) === 'L') { bare = false; break; }
    if (bare) open++;
  }
  // islands: connected groups of solid tiles (8-way) that do not touch the map border
  const seen = new Set(); let islands = 0;
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    if (walk(x, y) || seen.has(x + ',' + y)) continue;
    let border = false; const q = [[x, y]]; seen.add(x + ',' + y);
    while (q.length) {
      const [cx, cy] = q.pop();
      if (cx === 0 || cy === 0 || cx === map.w - 1 || cy === map.h - 1) border = true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy, k = nx + ',' + ny;
        if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h || walk(nx, ny) || seen.has(k)) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    if (!border) islands++;
  }
  const ways = L.targets.map((t) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => walk(t.at[0] + dx, t.at[1] + dy)).length);
  return { open: open / floor, islands, ways };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  console.log('level                 open  islands  ways        sneak/run/par   notes');
  for (const f of files) {
    const L = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    const { open, islands, ways } = lint(L);
    const errs = validateLevel(L);
    if (!idleSafe(L, 4)) errs.push('caught standing at spawn');
    const s = playBot(L), r = playBot(L, { run: true });
    if (!s.ok) errs.push(`sneak bot: ${s.why || s.status}`);
    if (!r.ok) errs.push(`run bot: ${r.why || r.status}`);
    if (s.ok && s.time >= L.par) errs.push(`sneak ${s.time}s >= par ${L.par}s`);
    if (L.boss && s.ok && s.phase !== L.boss.phases.length) errs.push('not every boss phase fired');
    const warn = [];
    if (!L.epilogue && !L.boss?.title?.startsWith('BAGYO')) {
      if (open > 0.25) warn.push('open floor > 25%');
      if (islands < 3) warn.push('fewer than 3 islands');
      if (ways.some((n) => n < 2)) warn.push('a stash with one approach');
    }
    if (errs.length) bad++;
    console.log(`${L.id.padEnd(20)} ${(open * 100).toFixed(0).padStart(4)}%  ${String(islands).padStart(5)}    ${ways.join(',').padEnd(10)}  ${String(s.time).padStart(5)}/${String(r.time).padStart(5)}/${String(L.par).padStart(3)}   ${[...errs.map((e) => 'ERROR ' + e), ...warn].join('; ')}`);
  }
  process.exit(bad ? 1 : 0);
}
