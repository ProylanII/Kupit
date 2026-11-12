// Walkthrough bot shared by the tests: plays a level with REAL inputs (walks tile to tile, opens doors, picks up
// keys, flips levers, holds KUPIT, runs for timed gates, walks into the exit). Nothing is teleported. God mode is
// on so adults cannot end the run: if the bot finishes, the level is mechanically completable by hand with the
// game's own movement, reach and timing rules. Not a test file itself (tests/*.test.mjs is the glob).
import { World, REACH } from '../src/game/world.js';
import { TILE } from '../src/world/tilemap.js';
import { findPath } from '../src/world/pathfind.js';

const IDLE = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false, throwPressed: false, abilityPressed: false };

// -> { ok, time, coins, phase, why?, log }
export function playBot(L, { run = false, maxT = 900, lives = 3, god = true } = {}) {
  const w = new World(L, { lives });
  w.god = god;
  const p = w.player, map = w.map, locks = w.locks;
  const pass = (x, y) => {
    const c = map.ch(x, y);
    if (c === 'D') { const k = locks.get(x + ',' + y); return !k || p.keys.has(k); }
    if (c === 'G') return false;
    return !map.tileSolid(x, y);
  };
  const tileOf = (o) => [Math.floor(o.x / TILE), Math.floor(o.y / TILE)];
  const route = (to) => findPath(map, p.tx, p.ty, to[0], to[1], pass, 20000);
  const near = (o) => Math.hypot(o.x - p.x, o.y - p.y) <= REACH;
  const dirTo = (o) => { const dx = o.x - p.x, dy = o.y - p.y, m = Math.hypot(dx, dy) || 1; return { x: dx / m, y: dy / m, mag: 1, run: false }; };
  const fail = (why, t) => ({ ok: false, status: w.status, why, time: +t.toFixed(1), coins: w.coins, phase: w.phase, log });
  const openGateSwitch = () => w.switches.find((s) => s.gates.some(([gx, gy]) => map.ch(gx, gy) === 'G') && route([s.tx, s.ty]));
  const keyItem = () => w.items.find((i) => i.kind === 'key' && route([i.tx, i.ty]));

  let goal = null, path = null, pressT = 0, lastPos = [p.x, p.y], stuckT = 0;
  const log = [];
  for (let step = 0; step < maxT * 60 && w.status === 'play'; step++) {
    const t = step / 60;
    // ---- what to go for
    let kind, obj;
    if (w.open) { kind = 'exit'; obj = w.exit; }
    else {
      let best = null, bl = Infinity;
      for (const x of w.targets) if (!x.done && !x.bonus) { const r = route(tileOf(x)); if (r && r.length < bl) { bl = r.length; best = x; } }
      if (best) { kind = 'steal'; obj = best; }
      else if ((obj = keyItem())) kind = 'key';
      else if ((obj = openGateSwitch())) kind = 'switch';
      else return fail(`no reachable stash, key or lever (coins ${w.coins}/${L.quota})`, t);
    }
    if (kind === 'exit' && !route(tileOf(obj))) {
      if ((obj = keyItem())) kind = 'key';
      else if ((obj = openGateSwitch())) kind = 'switch';
      else return fail('exit unreachable', t);
    }
    if (goal !== obj) { goal = obj; path = null; log.push(`t=${t.toFixed(1)} -> ${kind} @ ${tileOf(obj)}`); }

    // ---- act or move
    const inp = { ...IDLE, mv: { x: 0, y: 0, mag: 0, run: false } };
    const ctx = w.context();
    if (p.hidden) inp.mv = { x: 0, y: 1, mag: 1, run: false }; // never meant to hide: step out
    else if (kind === 'steal' && near(obj) && ctx?.kind === 'steal' && ctx.obj === obj) inp.action = true;
    else if (kind === 'switch' && near(obj) && ctx?.kind === 'switch' && ctx.obj === obj) {
      if (pressT <= 0) { inp.action = true; inp.actionPressed = true; pressT = 0.5; goal = null; }
    } else if (kind === 'exit' && near(obj)) inp.mv = dirTo(obj);
    else {
      if (!path || !path.length || map.version !== path.v) {
        const r = route(tileOf(obj));
        path = r ? r.slice(1).map(([x, y]) => ({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, tx: x, ty: y })) : null;
        if (path) path.v = map.version;
      }
      const n = path && path[0];
      if (n) {
        if (map.ch(n.tx, n.ty) === 'D') { // open it first
          if (ctx && (ctx.kind === 'door' || ctx.kind === 'locked') && pressT <= 0) { inp.actionPressed = true; inp.action = true; pressT = 0.3; }
          else if (ctx && ctx.kind !== 'door' && ctx.kind !== 'locked' && Math.hypot(n.x - p.x, n.y - p.y) < REACH) return fail(`door ${n.tx},${n.ty}: ACT says ${ctx.kind} (${ctx.obj?.kind || ''} at ${ctx.obj ? tileOf(ctx.obj) : ''})`, t);
          else if (!ctx || ctx.kind !== 'door') inp.mv = dirTo(n);
        } else {
          inp.mv = dirTo(n);
          inp.mv.run = (run || (w.switches.some((s) => s.timer > 0) && !near(obj))) && !p.carry; // nobody runs with a full bowl of milk // a timed gate: hurry
          if (Math.hypot(n.x - p.x, n.y - p.y) < 2) path.shift();
        }
      }
    }
    pressT -= 1 / 60;
    w.update(1 / 60, inp);
    if (Math.hypot(p.x - lastPos[0], p.y - lastPos[1]) < 0.5 && !inp.action) stuckT += 1 / 60; else stuckT = 0;
    lastPos = [p.x, p.y];
    if (stuckT > 12) return fail(`stuck at ${p.tx},${p.ty} going to ${kind} ${tileOf(obj)}`, t);
  }
  return { ok: w.status === 'clear', status: w.status, reason: w.reason, time: +w.time.toFixed(1), coins: w.coins, phase: w.phase, log };
}
