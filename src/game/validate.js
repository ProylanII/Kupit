// Level validation shared by the tests and the random-house generator. DOM-free.
// validateLevel(L) -> array of error strings (empty = valid and solvable).
import { TileMap } from '../world/tilemap.js';
import { findPath } from '../world/pathfind.js';
import { ADULT_TYPES, ACTIVITIES } from '../entities/adult.js';
import { MISSIONS } from './missions.js';
import { World } from './world.js';

export const KINDS = {
  items: ['tsinelas', 'pandesal', 'key'], hide: ['box', 'curtain', 'basket'],
  devices: ['tv', 'radio', 'videoke'], traps: ['creak', 'lego'], targets: ['purse', 'bayong', 'wallet', 'piggy', 'candy', 'gatas', 'kuting', 'ibalik', 'regalo'],
};

// Player reachability with keys and switch-operated gates, iterated to a fixpoint.
export function solve(L, map, blockedDoors = new Set()) {
  const locks = new Map((L.locks || []).map((l) => [l.at.join(), l.key]));
  const keys = new Set();
  const gates = new Set();
  const pass = (x, y) => {
    const c = map.ch(x, y);
    if (c === 'D') { if (blockedDoors.has(`${x},${y}`)) return false; const k = locks.get(`${x},${y}`); return !k || keys.has(k); }
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

// The walkable squares next to every closed door, as [x, y, doorX, doorY].
export function doorApproaches(map) {
  const out = [];
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    if (map.ch(x, y) !== 'D') continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!map.tileSolid(x + dx, y + dy)) out.push([x + dx, y + dy, x, y]);
  }
  return out;
}
// A hiding spot or stash within one tile of a door's approach square is in reach from where you open the door,
// and TAGO/KUPIT outrank BUKAS on the action button: the door would look stuck. Returns the offending door or null.
export function besideDoor(appr, p) {
  return appr.find(([ax, ay]) => Math.max(Math.abs(p[0] - ax), Math.abs(p[1] - ay)) <= 1) || null;
}

export function validateLevel(L) {
  const errs = [];
  const bad = (m) => errs.push(m);
  for (const k of ['id', 'name', 'tiles', 'spawn', 'exit', 'quota', 'par', 'targets', 'adults']) if (!(k in L)) bad(`missing ${k}`);
  if (errs.length) return errs;
  const w = L.tiles[0].length;
  L.tiles.forEach((r, i) => { if (r.length !== w) bad(`row ${i} width`); });
  if (errs.length) return errs;
  const map = new TileMap(L.tiles);
  const floor = (p, what) => {
    const c = map.ch(p[0], p[1]);
    if (map.tileSolid(p[0], p[1]) || 'dgDG'.includes(c)) bad(`${what} ${p} must be on plain floor (got '${c}')`);
  };
  if (L.hint && L.hint.length > 58) bad(`hint is ${L.hint.length} chars (max 58 fits the screen)`);
  if (L.missions) {
    if (!Array.isArray(L.missions) || L.missions.length !== 2 || L.missions[0] === L.missions[1]) bad('missions must be two different mission ids');
    else for (const id of L.missions) if (!MISSIONS[id] || id === 'clear') bad(`unknown mission ${id}`);
    const has = (id) => (L.missions || []).includes(id);
    if (has('alkansya') && !L.alkansya) bad('mission alkansya needs an alkansya');
    if (has('noSpill') && !L.targets.some((t) => t.carry)) bad('mission noSpill needs something to carry');
    if (has('thunder') && !L.storm) bad('mission thunder needs a storm');
    if (has('noBark') && !L.adults.some((a) => a.type === 'aso')) bad('mission noBark needs a dog');
    if (has('noWake') && !L.adults.some((a) => a.type === 'lola' || a.sleepy || a.cfg?.sleepy)) bad('mission noWake needs a sleeper');
    if (has('noDevice') && !(L.devices || []).some((d) => d.kind !== 'videoke')) bad('mission noDevice needs a tv or radio');
    if (has('noTrap') && !(L.traps || []).length) bad('mission noTrap needs traps');
    if (has('noHide') && !(L.hide || []).length) bad('mission noHide needs hiding spots');
  }
  floor(L.spawn, 'spawn');
  floor(L.exit, 'exit');
  const used = new Map();
  const place = (p, what) => {
    floor(p, what);
    if (used.has(p.join())) bad(`${what} ${p} overlaps ${used.get(p.join())}`);
    used.set(p.join(), what);
  };
  for (const [list, kinds] of Object.entries(KINDS)) {
    for (const o of L[list] || []) {
      if (!kinds.includes(o.kind || kinds[0])) bad(`${list}: unknown kind ${o.kind}`);
      place(o.at, `${list}:${o.kind}`);
    }
  }
  for (const s of L.switches || []) {
    place(s.at, 'switch');
    for (const g of s.gates) if (!'Gg'.includes(map.ch(g[0], g[1]))) bad(`switch gate ${g} is not a gate tile`);
  }
  for (const l of L.locks || []) {
    if (map.ch(l.at[0], l.at[1]) !== 'D') bad(`lock ${l.at} is not on a door`);
    if (!(L.items || []).some((i) => i.kind === 'key' && i.color === l.key)) bad(`no ${l.key} key for lock ${l.at}`);
  }

  for (const t of L.targets) if (t.time !== undefined && !(t.time >= 0.5 && t.time <= 4)) bad(`target ${t.at} hold time ${t.time} (0.5..4s)`);
  if (L.alkansya) {
    place(L.alkansya.at, 'alkansya');
    if (!(L.alkansya.coins > 0)) bad('alkansya needs coins');
  }
  const appr = doorApproaches(map);
  const doorCheck = (p, what) => { const d = besideDoor(appr, p); if (d) bad(`${what} ${p} is beside door ${d[2]},${d[3]}: ACT would say TAGO/KUPIT there, not BUKAS`); };
  for (const h of L.hide || []) doorCheck(h.at, `hide:${h.kind}`);
  for (const t of L.targets) doorCheck(t.at, `target:${t.kind}`);
  if (L.alkansya) doorCheck(L.alkansya.at, 'alkansya');

  // a wardrobe's top half is drawn over the tile behind it: nothing you need to see may sit there
  const behind = (p, what) => { if (map.ch(p[0], p[1] + 1) === 'K') bad(`${what} ${p} is hidden behind the wardrobe at ${p[0]},${p[1] + 1}`); };
  behind(L.spawn, 'spawn'); behind(L.exit, 'exit');
  for (const k of ['targets', 'hide', 'items', 'devices', 'switches', 'traps']) for (const o of L[k] || []) behind(o.at, k);
  if (L.alkansya) behind(L.alkansya.at, 'alkansya');
  for (const c of L.cats || []) { if (map.tileSolid(c.at[0], c.at[1])) bad(`cat ${c.at} must be on floor`); behind(c.at, 'cat'); }

  const reach = solve(L, map);
  if (!reach.has(L.exit.join())) bad('exit unreachable');
  if (L.alkansya && !reach.has(L.alkansya.at.join())) bad(`alkansya ${L.alkansya.at} unreachable`);
  let total = 0;
  for (const t of L.targets) { if (!reach.has(t.at.join())) bad(`target ${t.at} unreachable`); total += t.coins; }
  if (L.quota > total) bad('quota exceeds available coins');
  for (const it of L.items || []) if (!reach.has(it.at.join())) bad(`item ${it.kind} ${it.at} unreachable`);

  // adults open plain doors but have no keys: a patrol must not need a locked door
  const locked = new Set((L.locks || []).map((l) => l.at.join()));
  const pass = (x, y) => (map.ch(x, y) === 'D' ? !locked.has(`${x},${y}`) : !map.tileSolid(x, y));
  for (const a of L.adults) {
    if (!ADULT_TYPES[a.type]) { bad(`unknown adult type ${a.type}`); continue; }
    const pts = a.route || [a.at];
    for (const p of pts) { floor(p, `${a.type} point`); if (p[4] !== undefined && !ACTIVITIES[p[4]]) bad(`${a.type}: unknown routine ${p[4]}`); }
    for (let i = 0; i < pts.length && pts.length > 1; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      if (!findPath(map, p[0], p[1], q[0], q[1], pass)) bad(`${a.type} route ${p}->${q} has no path`);
    }
    if (L.spawn.join() === pts[0].slice(0, 2).join()) bad(`${a.type} starts on the spawn`);
    const f = a.cfg?.followsDog;
    if (f !== undefined && !(L.adults[f] && L.adults[f].type === 'aso')) bad(`${a.type} followsDog must point at an aso`);
  }

  if (L.boss) {
    let prev = 0;
    if (!L.boss.title || !(L.boss.bonus > 0) || !L.boss.phases?.length) bad('boss needs title, bonus and phases');
    if (!L.adults[L.boss.index ?? 0]) bad('boss.index must point at an adult');
    for (const ph of L.boss.phases || []) {
      if (!(ph.at > prev && ph.at <= total)) bad(`phase at ${ph.at} must rise and be reachable (max ${total})`);
      if (!ph.banner || ph.banner.length > 30) bad('phase banner text <= 30 chars');
      prev = ph.at;
      for (const m of [].concat(ph.adult || [])) {
        if (!L.adults[m.index]) bad(`phase adult index ${m.index}`);
        for (const p of m.route || []) if (map.tileSolid(p[0], p[1])) bad(`phase route point ${p} blocked`);
      }
      for (const a of ph.spawn || []) {
        if (!ADULT_TYPES[a.type]) bad(`unknown spawn type ${a.type}`);
        for (const p of a.route || [a.at]) if (map.tileSolid(p[0], p[1])) bad(`spawn point ${p} blocked`);
      }
      for (const [x, y] of [...(ph.open || []), ...(ph.close || [])]) if (!'Gg'.includes(map.ch(x, y))) bad(`phase gate ${x},${y} is not a gate`);
      if (ph.escape !== undefined && !(ph.escape >= 10)) bad('escape timer must be >= 10s');
    }
  }
  return errs;
}

const IDLE = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false, throwPressed: false, abilityPressed: false };

// Standing still at the spawn for `seconds` must not get you caught.
export function idleSafe(L, seconds = 4) {
  const w = new World(L);
  for (let i = 0; i < seconds * 60; i++) w.update(1 / 60, IDLE);
  return w.status === 'play';
}
