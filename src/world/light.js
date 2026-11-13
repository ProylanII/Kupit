// Night light (design overhaul A6 + V33): on a night level the dark really hides you. Outside a pool of light an
// adult only sees you at DARK_MUL of their range (BROWNOUT_MUL in a brownout); inside one, at full range. A lightning
// flash lights everything for a moment. The world (the rule) and the renderer (the picture) both use this list, so
// what you see is what counts. DOM-free (tests/light.test.mjs).
import { TILE } from './tilemap.js';

export const DARK_MUL = 0.6;
export const BROWNOUT_MUL = 0.45;
export const LIT_K = 0.75; // a pool's bright core (the part drawn clearly lit) is what counts as "in the light"

// The same per-tile hash the background art uses to place windows and wall decor.
export const tileHash = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

// A wall tile the art draws a window on (capiz or jalousie): an indoor wall face with the decor roll 0-2.
export function isWindow(map, tx, ty) {
  if (map.ch(tx, ty) !== '#') return false;
  const b = map.ch(tx, ty + 1);
  if (b === '#' || b === ';' || b === ':' || b === 'L') return false;
  return tileHash(tx, ty, 7) % 13 < 3;
}

// Fixed moonlight pools, one under each window. Computed once per level.
export function windowLights(map) {
  const out = [];
  for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) {
    if (isWindow(map, tx, ty)) out.push({ x: tx * TILE + 8, y: ty * TILE + 20, r: 15, kind: 'window' });
  }
  return out;
}

// Every pool of light right now. r is the drawn radius; LIT_K * r counts.
//   world: { level, map, devices, adults, exit, open, windowPools }
export function lightSources(w) {
  const L = w.level || {}, brown = !!L.brownout, out = [];
  if (!brown) for (const p of w.windowPools || []) out.push(p);
  for (const l of L.lamps || []) out.push({ x: l[0] * TILE + 8, y: l[1] * TILE + 8, r: l[2] ?? 30, kind: 'lamp', off: brown });
  for (const d of w.devices || []) if (d.on) out.push({ x: d.x, y: d.y, r: 34, kind: 'device' });
  for (const a of w.adults || []) {
    if (!a.awake || a.cfg.harmless) continue;
    if (a.cfg.scan) out.push({ x: a.x + Math.cos(a.va) * 30, y: a.y + Math.sin(a.va) * 30, r: 22, kind: 'flashlight' });
    else if (brown && !a.cfg.dog) out.push({ x: a.x, y: a.y - 4, r: 20, kind: 'candle' }); // brownout: everyone carries a candle
  }
  if (w.open && w.exit) out.push({ x: w.exit.x, y: w.exit.y, r: 20, kind: 'exit' });
  return out.filter((s) => !s.off);
}

export const inLight = (sources, x, y) => sources.some((s) => Math.hypot(s.x - x, s.y - y) < s.r * LIT_K);

// How far an adult can see this kid, as a share of their range.
export function sightMul(w, sources, kid) {
  const L = w.level || {};
  if (!L.night || w.flashT > 0) return 1;
  return inLight(sources, kid.x, kid.y) ? 1 : L.brownout ? BROWNOUT_MUL : DARK_MUL;
}
