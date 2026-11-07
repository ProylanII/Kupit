// Line of sight + vision cone ray casting. DOM-free.

export const angDiff = (d) => ((d + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

export function hasLos(map, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const n = Math.ceil(Math.hypot(dx, dy) / 4);
  for (let i = 1; i < n; i++) {
    if (map.blocksLosAt(a.x + (dx * i) / n, a.y + (dy * i) / n)) return false;
  }
  return true;
}

// Returns N+1 ray lengths sweeping from angle-fov to angle+fov.
export function castCone(map, x, y, angle, fov, range, N = 32, out) {
  const rays = out || new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const a = angle - fov + (2 * fov * i) / N;
    const cx = Math.cos(a), sy = Math.sin(a);
    let d = 0;
    while (d < range && !map.blocksLosAt(x + cx * d, y + sy * d)) d += 2;
    rays[i] = Math.min(d, range);
  }
  return rays;
}
