// How far a sound really travels. DOM-free.
// Sound spreads through the house like water: walls stop it, a closed door muffles it (costs extra
// distance), furniture and gate bars let it through. soundField() floods outward from the source up to
// the noise radius and returns the path distance (px) to every tile it reached (Infinity elsewhere).
import { TILE } from './tilemap.js';

export const DOOR_MUFFLE = 40; // a closed door adds this many px of distance
const DIAG = Math.SQRT2 * TILE;
const NB = [[1, 0, TILE], [-1, 0, TILE], [0, 1, TILE], [0, -1, TILE], [1, 1, DIAG], [1, -1, DIAG], [-1, 1, DIAG], [-1, -1, DIAG]];

const blocks = (c) => c === '#';

// Reusable scratch buffers (one sim runs at a time).
let dist = new Float32Array(0), heapI = new Int32Array(0), heapD = new Float32Array(0);

export function soundField(map, x, y, r, out) {
  const W = map.w, H = map.h, N = W * H;
  if (dist.length < N) { dist = new Float32Array(N); heapI = new Int32Array(N * 8); heapD = new Float32Array(N * 8); }
  const res = out && out.length >= N ? out : new Float32Array(N);
  res.fill(Infinity, 0, N);
  let sx = Math.floor(x / TILE), sy = Math.floor(y / TILE);
  sx = Math.max(0, Math.min(W - 1, sx)); sy = Math.max(0, Math.min(H - 1, sy));
  // a noise made right against a wall starts in the nearest open tile
  if (blocks(map.ch(sx, sy))) {
    let best = null, bd = Infinity;
    for (const [dx, dy] of NB) {
      const nx = sx + dx, ny = sy + dy;
      if (blocks(map.ch(nx, ny))) continue;
      const d = Math.hypot(nx * TILE + 8 - x, ny * TILE + 8 - y);
      if (d < bd) { bd = d; best = [nx, ny]; }
    }
    if (!best) return res;
    [sx, sy] = best;
  }
  // tiny binary heap keyed by distance
  let n = 0;
  const push = (i, d) => {
    let k = n++;
    while (k > 0) { const p = (k - 1) >> 1; if (heapD[p] <= d) break; heapI[k] = heapI[p]; heapD[k] = heapD[p]; k = p; }
    heapI[k] = i; heapD[k] = d;
  };
  const pop = () => {
    const top = heapI[0];
    const li = heapI[--n], ld = heapD[n];
    let k = 0;
    while (true) {
      let c = 2 * k + 1;
      if (c >= n) break;
      if (c + 1 < n && heapD[c + 1] < heapD[c]) c++;
      if (heapD[c] >= ld) break;
      heapI[k] = heapI[c]; heapD[k] = heapD[c]; k = c;
    }
    heapI[k] = li; heapD[k] = ld;
    return top;
  };
  const s0 = sy * W + sx;
  res[s0] = 0;
  push(s0, 0);
  while (n > 0) {
    const i = pop(), cx = i % W, cy = (i - cx) / W, d0 = res[i];
    for (const [dx, dy, step] of NB) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const c = map.ch(nx, ny);
      if (blocks(c)) continue;
      if (dx && dy && (blocks(map.ch(cx + dx, cy)) || blocks(map.ch(cx, cy + dy)))) continue; // no squeezing past wall corners
      const nd = d0 + step + (c === 'D' ? DOOR_MUFFLE : 0);
      if (nd > r + TILE) continue;
      const j = ny * W + nx;
      if (nd < res[j]) { res[j] = nd; push(j, nd); }
    }
  }
  return res;
}

// Distance (px) a noise has to travel to reach (px, py): never shorter than the straight line.
export function heardDistance(field, map, n, px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return Infinity;
  const f = field[ty * map.w + tx];
  return Math.max(Math.hypot(px - n.x, py - n.y), f);
}
