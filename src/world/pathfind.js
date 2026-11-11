// 4-way A* on the tile grid. DOM-free.
// passable(tx,ty) defaults to "not solid"; adults pass closed doors (they open them).
// Binary heap + flat typed arrays: no per-node allocations, so a burst of adults replanning at once
// (Kuya's tattle, a boss phase) stays cheap even on the biggest maps.

let gS = new Float64Array(0), from = new Int32Array(0), mark = new Uint32Array(0), stamp = 0;
let hI = new Int32Array(0), hF = new Float64Array(0);

export function findPath(map, sx, sy, gx, gy, passable = (x, y) => !map.tileSolid(x, y), maxNodes = 4000) {
  if (sx === gx && sy === gy) return [[gx, gy]];
  if (!passable(gx, gy)) return null;
  const W = map.w, H = map.h, N = W * H;
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return null;
  if (gS.length < N) { gS = new Float64Array(N); from = new Int32Array(N); mark = new Uint32Array(N); hI = new Int32Array(N * 4 + 8); hF = new Float64Array(N * 4 + 8); stamp = 0; }
  // mark[i] === stamp: seen this search; stamp + 1 (odd/even trick) is avoided by bumping by 2
  stamp += 2;
  if (stamp > 0xfffffff0) { mark.fill(0); stamp = 2; }
  const SEEN = stamp, CLOSED = stamp + 1;
  const h = (x, y) => Math.abs(gx - x) + Math.abs(gy - y);
  let n = 0;
  const push = (i, f) => {
    let k = n++;
    while (k > 0) { const p = (k - 1) >> 1; if (hF[p] <= f) break; hI[k] = hI[p]; hF[k] = hF[p]; k = p; }
    hI[k] = i; hF[k] = f;
  };
  const pop = () => {
    const top = hI[0], li = hI[--n], lf = hF[n];
    let k = 0;
    while (true) {
      let c = 2 * k + 1;
      if (c >= n) break;
      if (c + 1 < n && hF[c + 1] < hF[c]) c++;
      if (hF[c] >= lf) break;
      hI[k] = hI[c]; hF[k] = hF[c]; k = c;
    }
    hI[k] = li; hF[k] = lf;
    return top;
  };
  const s = sy * W + sx, goal = gy * W + gx;
  gS[s] = 0; from[s] = -1; mark[s] = SEEN;
  push(s, h(sx, sy));
  let expanded = 0;
  while (n > 0 && expanded++ < maxNodes) {
    const k = pop();
    if (mark[k] === CLOSED) continue; // stale heap entry
    if (k === goal) {
      const path = [];
      for (let c = k; c !== -1; c = from[c]) path.push([c % W, (c - (c % W)) / W]);
      return path.reverse();
    }
    mark[k] = CLOSED;
    const x = k % W, y = (k - x) / W, g0 = gS[k];
    for (let d = 0; d < 4; d++) {
      const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nk = ny * W + nx;
      if (mark[nk] === CLOSED || !passable(nx, ny)) continue;
      const ng = g0 + 1;
      if (mark[nk] !== SEEN || ng < gS[nk]) {
        mark[nk] = SEEN; gS[nk] = ng; from[nk] = k;
        // tie-break toward the goal so equal-cost routes look straight
        push(nk, ng + h(nx, ny) * 1.0001);
      }
    }
  }
  return null;
}
