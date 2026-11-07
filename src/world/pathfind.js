// 4-way A* on the tile grid. DOM-free.
// passable(tx,ty) defaults to "not solid"; adults pass closed doors (they open them).

export function findPath(map, sx, sy, gx, gy, passable = (x, y) => !map.tileSolid(x, y), maxNodes = 4000) {
  if (sx === gx && sy === gy) return [[gx, gy]];
  if (!passable(gx, gy)) return null;
  const W = map.w, key = (x, y) => y * W + x;
  const open = [[sx, sy]];
  const g = new Map([[key(sx, sy), 0]]);
  const f = new Map([[key(sx, sy), Math.abs(gx - sx) + Math.abs(gy - sy)]]);
  const from = new Map();
  const closed = new Set();
  let n = 0;
  while (open.length && n++ < maxNodes) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (f.get(key(...open[i])) < f.get(key(...open[bi]))) bi = i;
    const [x, y] = open.splice(bi, 1)[0];
    const k = key(x, y);
    if (x === gx && y === gy) {
      const path = [[x, y]];
      let c = k;
      while (from.has(c)) { c = from.get(c); path.push([c % W, Math.floor(c / W)]); }
      return path.reverse();
    }
    closed.add(k);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, nk = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= W || ny >= map.h || closed.has(nk) || !passable(nx, ny)) continue;
      const ng = g.get(k) + 1;
      if (ng < (g.get(nk) ?? Infinity)) {
        from.set(nk, k);
        g.set(nk, ng);
        f.set(nk, ng + Math.abs(gx - nx) + Math.abs(gy - ny));
        if (!open.some((o) => o[0] === nx && o[1] === ny)) open.push([nx, ny]);
      }
    }
  }
  return null;
}
