// The level-pass rules (design overhaul Blueprint 7.0) as checks.   node tools/level-rules.mjs
//   R1  total coins ~ 1.4x quota (1.2..1.6), and the most coins in the riskiest stash (the one nearest an adult)
//   R2  spawn and exit in different rooms (the exit can't be seen from the spawn and is 8+ tiles' walk away; many
//       rooms here are joined by open gaps, not doors); the way out shares at most 70% of its tiles with the way in
//   R4  at least one of the two missions is specific to the level (sakto, silent, noCatch, fast are generic)
//   R6  every stash sits beside furniture that explains it, and has an owner
// R3 (a designed near-miss) and R5 (one new mechanic per level) are review items: see docs/LEVEL_PASS.md.
// Boss levels, the storm and the epilogue are Phase 5/6 and are listed but not judged.
import { readFileSync } from 'node:fs';
import { TileMap, FURNITURE } from '../src/world/tilemap.js';
import { findPath } from '../src/world/pathfind.js';
import { hasLos } from '../src/world/los.js';
import { validateLevel } from '../src/game/validate.js';
import { OWNERS } from '../src/entities/target.js';

export const GENERIC = new Set(['sakto', 'silent', 'noCatch', 'fast']);
const FURN = new Set(FURNITURE);
const RATIO = [1.2, 1.6], OVERLAP = 0.7;
// exceptions written into the blueprint
const R2_EXEMPT = new Set(['boss1-lola', 'bagyo']);

const judged = (L) => !L.boss && !L.epilogue && !L.hingi && !L.storm;

export function rules(L) {
  const map = new TileMap(L.tiles), out = {};
  const pass = (x, y) => !map.tileSolid(x, y) || 'DdGg'.includes(map.ch(x, y));
  const coinT = L.targets.filter((t) => (t.coins | 0) > 0 && !t.carry);
  const total = coinT.reduce((s, t) => s + t.coins, 0);
  // R1
  const ratio = L.quota ? total / L.quota : 0;
  const near = (t) => Math.min(99, ...L.adults.filter((a) => !['bisita', 'trike'].includes(a.type)).flatMap((a) => (a.route || [a.at]).map((p) => Math.hypot(p[0] - t.at[0], p[1] - t.at[1]))));
  const richest = coinT.slice().sort((a, b) => b.coins - a.coins)[0];
  const riskiest = coinT.slice().sort((a, b) => near(a) - near(b))[0];
  out.R1 = { ratio: +ratio.toFixed(2), ok: !L.quota || L.giveBack || L.hingi || L.targets.every((t) => t.kind === 'kuting' || t.kind === 'mingming') || (ratio >= RATIO[0] && ratio <= RATIO[1] && (!richest || richest.coins === riskiest.coins)), note: richest && richest !== riskiest && richest.coins !== riskiest.coins ? `richest ${richest.at} is not the riskiest ${riskiest.at}` : '' };
  // R2: the way in = spawn -> richest stash; the way out = richest stash -> exit
  const goal = (richest || L.targets[0])?.at || L.exit; // (no stash at all: an escort level)
  const pin = findPath(map, L.spawn[0], L.spawn[1], goal[0], goal[1], pass) || [];
  const pout = findPath(map, goal[0], goal[1], L.exit[0], L.exit[1], pass) || [];
  const inSet = new Set(pin.map((p) => (p.tx ?? p[0]) + ',' + (p.ty ?? p[1])));
  const shared = pout.filter((p) => inSet.has((p.tx ?? p[0]) + ',' + (p.ty ?? p[1]))).length;
  const overlap = !richest ? 0 : pout.length ? shared / pout.length : 1; // (no stash: there is no way back to compare)
  const px = (p) => ({ x: p[0] * 16 + 8, y: p[1] * 16 + 8 });
  const walk = findPath(map, L.spawn[0], L.spawn[1], L.exit[0], L.exit[1], pass) || [];
  const sameRoom = hasLos(map, px(L.spawn), px(L.exit)) || walk.length < 8;
  out.R2 = { sameRoom, overlap: +overlap.toFixed(2), ok: R2_EXEMPT.has(L.id) || (!sameRoom && overlap <= OVERLAP) };
  // R4
  const ms = L.missions || [];
  out.R4 = { missions: ms.join(','), ok: ms.some((m) => !GENERIC.has(m)) };
  // R6
  const bare = [];
  for (const t of L.targets) {
    if (t.carry || t.kind === 'kuting' || t.kind === 'mingming') continue; // (rescues are not stashes)
    let furn = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (FURN.has(map.ch(t.at[0] + dx, t.at[1] + dy))) furn = true;
    const owner = t.owner || OWNERS[t.kind || 'purse'];
    if (!furn || !owner) bare.push(`${t.kind || 'purse'}@${t.at}${furn ? '' : ' no furniture'}${owner ? '' : ' no owner'}`);
  }
  out.R6 = { ok: !bare.length, note: bare.join(' ') };
  out.judged = judged(L);
  return out;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const dir = new URL('../src/data/levels/', import.meta.url);
  const files = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'));
  const mark = (r) => (r.ok ? ' ok ' : 'FAIL');
  console.log('level             R1 coins/quota   R2 rooms/overlap   R4 missions                R6    notes');
  let fails = 0;
  for (const f of files) {
    const L = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    if (L.mode) continue; // (a mini-game: no rooms to lint, its own simulation)
    const r = rules(L);
    const notes = [r.R1.note, r.R6.note].filter(Boolean).join(' | ');
    if (r.judged) fails += ['R1', 'R2', 'R4', 'R6'].filter((k) => !r[k].ok).length;
    console.log(`${L.id.padEnd(17)} ${mark(r.R1)} ${String(r.R1.ratio).padEnd(9)}  ${mark(r.R2)} ${r.R2.sameRoom ? 'same' : 'diff'} ${String(r.R2.overlap).padEnd(5)}  ${mark(r.R4)} ${r.R4.missions.padEnd(20)}  ${mark(r.R6)}  ${r.judged ? '' : '(phase 5/6) '}${notes}`);
  }
  console.log(`\n${fails} rule failures in the levels this pass judges`);
}
