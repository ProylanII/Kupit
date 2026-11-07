// Random House mode: builds a level (same JSON format as the handmade ones) from a seed.
// A grid of rooms joined by doors/archways, furnished from small templates, with targets, adults,
// hiding spots and (from difficulty 3) a locked door whose key lies on the near side.
// Every result is checked with validateLevel + idleSafe, otherwise the next derived seed is tried.
import { TileMap } from '../world/tilemap.js';
import { validateLevel, idleSafe, solve } from './validate.js';

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// "2026-11-07" -> stable number, so everyone gets the same Daily House.
export function dailySeed(date = new Date()) {
  const s = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return 1000 + ((h >>> 0) % 9000);
}
export const dailyId = (date = new Date()) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

const TYPES = ['sala', 'kusina', 'kwarto', 'bakuran', 'hall'];
const FLOOR = { sala: '.', kusina: ',', kwarto: '.', bakuran: ';', hall: '.' };
const STATIONARY = ['lola', 'tita', 'ninang'];

function build(seed, diff) {
  const R = mulberry32(seed);
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (a) => a[Math.floor(R() * a.length)];
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---- room grid
  const C = ri(2, 3), RR = ri(3, 4);
  const iw = Array.from({ length: C }, () => ri(6, 8)), ih = Array.from({ length: RR }, () => ri(5, 7));
  const xs = [], ys = [];
  let W = 1, H = 1;
  for (const w of iw) { xs.push(W); W += w + 1; }
  for (const h of ih) { ys.push(H); H += h + 1; }
  const g = Array.from({ length: H }, () => Array(W).fill('#'));
  const rooms = [];
  for (let r = 0; r < RR; r++) for (let c = 0; c < C; c++) {
    const type = pick(TYPES);
    const room = { c, r, type, floor: FLOOR[type], x0: xs[c], y0: ys[r], x1: xs[c] + iw[c] - 1, y1: ys[r] + ih[r] - 1, doors: [], nb: [] };
    for (let y = room.y0; y <= room.y1; y++) for (let x = room.x0; x <= room.x1; x++) g[y][x] = room.floor;
    rooms.push(room);
  }

  // ---- doors: random spanning tree + a few extra loops
  const edges = [];
  for (let r = 0; r < RR; r++) for (let c = 0; c < C; c++) {
    if (c + 1 < C) edges.push([r * C + c, r * C + c + 1, 'h']);
    if (r + 1 < RR) edges.push([r * C + c, (r + 1) * C + c, 'v']);
  }
  const uf = rooms.map((_, i) => i);
  const find = (i) => (uf[i] === i ? i : (uf[i] = find(uf[i])));
  const doors = [];
  for (const [a, b, o] of shuffle(edges)) {
    const joins = find(a) !== find(b);
    if (!joins && R() > 0.25) continue;
    uf[find(a)] = find(b);
    const ra = rooms[a];
    const dx = o === 'h' ? ra.x1 + 1 : ri(ra.x0 + 1, ra.x1 - 1);
    const dy = o === 'v' ? ra.y1 + 1 : ri(ra.y0 + 1, ra.y1 - 1);
    const arch = R() < 0.3;
    g[dy][dx] = arch ? '.' : 'D';
    doors.push({ x: dx, y: dy, a, b, arch });
    rooms[a].doors.push([dx, dy]); rooms[b].doors.push([dx, dy]);
    rooms[a].nb.push(b); rooms[b].nb.push(a);
  }

  // ---- furniture (kept away from doorways so rooms stay connected)
  const occ = new Set();
  const key = (x, y) => `${x},${y}`;
  const protectedCell = (room, x, y) => room.doors.some(([dx, dy]) => Math.abs(dx - x) + Math.abs(dy - y) <= 2);
  const inRoom = (room, x, y) => x >= room.x0 && x <= room.x1 && y >= room.y0 && y <= room.y1;
  const free = (room) => {
    const out = [];
    for (let y = room.y0; y <= room.y1; y++) for (let x = room.x0; x <= room.x1; x++) {
      if (g[y][x] === room.floor && !occ.has(key(x, y))) out.push([x, y]);
    }
    return out;
  };
  const chunk = (room, w, h, ch) => {
    for (let t = 0; t < 25; t++) {
      const ax = ri(room.x0, room.x1 - w + 1), ay = ri(room.y0, room.y1 - h + 1);
      let ok = true;
      for (let y = ay; y < ay + h && ok; y++) for (let x = ax; x < ax + w; x++) {
        if (!inRoom(room, x, y) || g[y][x] !== room.floor || occ.has(key(x, y)) || protectedCell(room, x, y)) { ok = false; break; }
      }
      if (!ok) continue;
      for (let y = ay; y < ay + h; y++) for (let x = ax; x < ax + w; x++) { g[y][x] = ch; occ.add(key(x, y)); }
      return true;
    }
    return false;
  };
  for (const room of rooms) {
    switch (room.type) {
      case 'sala':
        chunk(room, 3, 1, 'S'); if (R() < 0.6) chunk(room, 3, 1, 'S'); chunk(room, 2, 1, 'T');
        for (let t = 0; t < 12; t++) { // a rug (walkable)
          const ax = ri(room.x0, room.x1 - 2), ay = ri(room.y0, room.y1 - 2);
          let ok = true;
          for (let y = ay; y < ay + 3; y++) for (let x = ax; x < ax + 3; x++) if (g[y][x] !== room.floor) ok = false;
          if (ok) { for (let y = ay; y < ay + 3; y++) for (let x = ax; x < ax + 3; x++) g[y][x] = 'R'; break; }
        }
        break;
      case 'kusina': {
        for (let x = room.x0; x <= room.x1; x++) if (!protectedCell(room, x, room.y0) && R() < 0.8) { g[room.y0][x] = R() < 0.15 ? 'F' : 'C'; occ.add(key(x, room.y0)); }
        chunk(room, 2, 1, 'T');
        break;
      }
      case 'kwarto':
        chunk(room, 2, 2, 'B'); if (R() < 0.5) chunk(room, 2, 2, 'B'); chunk(room, 1, 1, 'P');
        break;
      case 'bakuran':
        for (let i = ri(3, 5); i > 0; i--) chunk(room, 1, 1, 'P');
        break;
      default:
        for (let i = ri(1, 2); i > 0; i--) chunk(room, 1, 1, 'P');
    }
  }

  // ---- start and exit rooms (graph distance)
  const startRoom = rooms[(RR - 1) * C];
  const dist = new Map([[startRoom, 0]]);
  const q = [startRoom];
  while (q.length) { const a = q.shift(); for (const bi of a.nb) { const b = rooms[bi]; if (!dist.has(b)) { dist.set(b, dist.get(a) + 1); q.push(b); } } }
  const far = Math.max(...dist.values());
  const exitRoom = pick(rooms.filter((r) => dist.get(r) === far));
  const startCells = free(startRoom).sort((p, q2) => (Math.abs(p[0] - startRoom.x0) + Math.abs(p[1] - startRoom.y1)) - (Math.abs(q2[0] - startRoom.x0) + Math.abs(q2[1] - startRoom.y1)));
  const spawn = startCells[0];
  occ.add(key(...spawn));
  const exit = pick(free(exitRoom));
  occ.add(key(...exit));
  const take = (cells) => { const c = pick(cells); occ.add(key(...c)); return c; };

  // ---- targets
  const n = 2 + (diff >= 3 ? 1 : 0) + (diff >= 5 ? 1 : 0);
  const pool = shuffle(rooms.filter((r) => r !== startRoom));
  const targets = [];
  for (let i = 0; i < n; i++) {
    const room = pool[i % pool.length];
    const cells = free(room);
    if (!cells.length) continue;
    const coins = ri(1, 3);
    targets.push({ kind: pick(['purse', 'wallet', 'piggy', 'bayong']), at: take(cells), coins, time: Math.round((1 + coins * 0.2) * 10) / 10 });
  }
  const total = targets.reduce((s, t) => s + t.coins, 0);
  const quota = targets.length >= 3 ? total - Math.min(...targets.map((t) => t.coins)) : total;

  // ---- adults
  const bag = ['mama', 'mama', 'lola', 'tita'];
  if (diff >= 2) bag.push('aso');
  if (diff >= 3) bag.push('tatay', 'kuya');
  if (diff >= 4) bag.push('ninang', 'mama');
  const count = Math.min(6, 1 + diff);
  const homes = shuffle(rooms.filter((r) => r !== startRoom));
  const used = {};
  const adults = [];
  for (let i = 0; i < count; i++) {
    let type = pick(bag);
    for (let t = 0; t < 6 && (used[type] || 0) >= 2; t++) type = pick(bag);
    used[type] = (used[type] || 0) + 1;
    const room = homes[i % homes.length];
    const cells = free(room);
    if (!cells.length) continue;
    const p = pick(cells);
    if (STATIONARY.includes(type)) {
      adults.push({ type, at: p, face: pick([0, 1.5708, 3.14159, -1.5708]), sweep: Math.round((0.3 + R() * 0.7) * 100) / 100, phase: ri(0, 8) });
      continue;
    }
    const route = [[p[0], p[1], ri(1, 2)]];
    for (let k = ri(1, 3); k > 0; k--) {
      const r2 = rooms[pick([rooms.indexOf(room), ...room.nb])];
      const c2 = free(r2);
      if (!c2.length) continue;
      const q2 = pick(c2);
      if (!route.some((pt) => pt[0] === q2[0] && pt[1] === q2[1])) route.push([q2[0], q2[1], ri(0, 2)]);
    }
    adults.push(route.length > 1 ? { type, route } : { type, at: p, face: pick([0, 1.5708, 3.14159, -1.5708]), sweep: 0.5 });
    if (type === 'aso') adults[adults.length - 1].cfg = { range: 44 };
  }

  // ---- items, hiding spots, devices, traps
  const all = shuffle(rooms.flatMap((r) => free(r).map((c) => ({ c, room: r }))));
  const grab = (accept = () => true) => {
    const i = all.findIndex((e) => !occ.has(key(...e.c)) && accept(e));
    if (i < 0) return null;
    const e = all.splice(i, 1)[0];
    occ.add(key(...e.c));
    return e.c;
  };
  const items = [];
  for (let i = 0; i < 2; i++) { const c = grab(); if (c) items.push({ kind: 'tsinelas', at: c }); }
  if (adults.some((a) => a.type === 'aso')) for (let i = 0; i < 2; i++) { const c = grab(); if (c) items.push({ kind: 'pandesal', at: c }); }
  const hide = [];
  for (let i = 0; i < 4 + ri(0, 2); i++) { const c = grab(); if (c) hide.push({ kind: pick(['box', 'curtain', 'basket']), at: c }); }
  const devices = [];
  for (let i = 0; i < (diff >= 4 ? 2 : 1); i++) { const c = grab(); if (c) devices.push({ kind: pick(['tv', 'radio']), at: c, dur: 9 }); }
  const traps = [];
  for (let i = 0; i < 2 + Math.min(3, diff); i++) { const c = grab((e) => e.room !== startRoom); if (c) traps.push({ kind: i % 3 === 2 ? 'lego' : 'creak', at: c }); }

  const rows = g.map((r) => r.join(''));
  const par = Math.round((40 + 18 * targets.length + 4 * rooms.length) / 5) * 5;
  const L = {
    id: `house-${seed}`, name: `HOUSE ${seed}`, hint: 'RANDOM HOUSE. NO TWO ALIKE!', seed, diff,
    night: diff >= 4 && R() < 0.5, tiles: rows, spawn, exit, quota, par,
    targets, items, devices, hide, traps, adults,
  };
  if (diff >= 3) L.patience = Math.round((par * 1.8) / 5) * 5;

  // ---- one locked door (diff >= 3): the key must be on the near side
  if (diff >= 3) {
    const map = new TileMap(rows);
    for (const d of shuffle(doors.filter((dd) => !dd.arch))) {
      const reach = solve({ spawn, items: [], switches: [], locks: [] }, map, new Set([key(d.x, d.y)]));
      const cutOff = targets.some((t) => !reach.has(t.at.join())) || !reach.has(exit.join());
      if (!cutOff) continue;
      const c = grab((e) => reach.has(e.c.join()) && e.room !== startRoom) || grab((e) => reach.has(e.c.join()));
      if (!c) continue;
      const color = pick(['red', 'blue', 'green']);
      L.locks = [{ at: [d.x, d.y], key: color }];
      items.push({ kind: 'key', color, at: c });
      break;
    }
  }
  return L;
}

// Always returns a valid level; tries derived seeds if a layout fails validation.
export function generateHouse(seed, diff = 2) {
  for (let k = 0; k < 80; k++) {
    const s = seed + k * 7919;
    const L = build(s, diff);
    if (validateLevel(L).length === 0 && idleSafe(L, 4)) return L;
  }
  throw new Error(`could not generate a valid house for seed ${seed}`);
}
