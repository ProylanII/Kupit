import { TILE } from '../world/tilemap.js';

export const SNEAK_SPEED = 30;
export const RUN_SPEED = 58;
export const RUN_NOISE = 48; // px radius adults can hear running

export class Player {
  constructor(tx, ty) {
    this.x = tx * TILE + TILE / 2;
    this.y = ty * TILE + TILE / 2;
    this.r = 4;
    this.dir = 0; // 0 down, 1 left, 2 right, 3 up
    this.moving = false;
    this.running = false;
    this.stepT = 0;
  }

  // mv: {x,y,mag,run}. frozen = holding the steal button (can't move).
  // Returns a noise event or null.
  update(dt, map, mv, frozen) {
    this.moving = false;
    this.running = false;
    if (frozen || mv.mag === 0) return null;
    const run = mv.run;
    const speed = run ? RUN_SPEED : SNEAK_SPEED * (0.5 + 0.5 * Math.min(1, mv.mag / 0.9));
    const dx = mv.x * speed * dt, dy = mv.y * speed * dt;
    if (!map.blocked(this.x + dx, this.y, this.r)) this.x += dx;
    if (!map.blocked(this.x, this.y + dy, this.r)) this.y += dy;
    this.moving = true;
    this.running = run;
    this.stepT += dt * (run ? 1.7 : 1);
    this.dir = Math.abs(mv.x) > Math.abs(mv.y) ? (mv.x < 0 ? 1 : 2) : (mv.y < 0 ? 3 : 0);
    return run ? { x: this.x, y: this.y, r: RUN_NOISE } : null;
  }
}
