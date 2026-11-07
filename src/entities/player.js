import { TILE } from '../world/tilemap.js';

export const SNEAK_SPEED = 30;
export const RUN_SPEED = 58;
export const RUN_NOISE = 48; // px radius adults can hear running (default; see computeMods)
export const DASH_SPEED = 84;

const DIRS = [[0, 1], [-1, 0], [1, 0], [0, -1]]; // down, left, right, up

export class Player {
  constructor(tx, ty, mods = {}) {
    this.x = tx * TILE + TILE / 2;
    this.y = ty * TILE + TILE / 2;
    this.r = mods.radius ?? 4;
    this.speedMul = mods.speed ?? 1;
    this.runNoise = mods.runNoise ?? RUN_NOISE;
    this.dashT = 0;  // silent dash time left
    this.hideT = 0;  // auto-unhide timer for "hide anywhere"
    this.dir = 0; // 0 down, 1 left, 2 right, 3 up
    this.fx = 0; this.fy = 1; // last move direction (for throwing)
    this.moving = false;
    this.running = false;
    this.stepT = 0;
    this.hidden = null; // hide spot while hiding
    this.stunT = 0;
    this.items = []; // throwables, last picked is thrown first
    this.keys = new Set();
  }

  get tx() { return Math.floor(this.x / TILE); }
  get ty() { return Math.floor(this.y / TILE); }
  facing() { return this.moving ? [this.fx, this.fy] : DIRS[this.dir]; }

  // mv: {x,y,mag,run}. frozen = stealing / hiding. Returns a noise event or null.
  update(dt, map, mv, frozen) {
    this.moving = false;
    this.running = false;
    if (this.stunT > 0) { this.stunT -= dt; return null; }
    const dash = this.dashT > 0;
    if (dash) this.dashT -= dt;
    if (frozen || (mv.mag === 0 && !dash)) return null;
    const run = mv.run && !dash;
    const mx = mv.mag === 0 ? this.fx : mv.x, my = mv.mag === 0 ? this.fy : mv.y;
    const speed = dash ? DASH_SPEED : this.speedMul * (run ? RUN_SPEED : SNEAK_SPEED * (0.5 + 0.5 * Math.min(1, mv.mag / 0.9)));
    const dx = mx * speed * dt, dy = my * speed * dt;
    if (!map.blocked(this.x + dx, this.y, this.r)) this.x += dx;
    if (!map.blocked(this.x, this.y + dy, this.r)) this.y += dy;
    this.moving = true;
    this.running = run;
    this.fx = mx; this.fy = my;
    this.stepT += dt * (run || dash ? 1.7 : 1);
    this.dir = Math.abs(mx) > Math.abs(my) ? (mx < 0 ? 1 : 2) : (my < 0 ? 3 : 0);
    return run ? { x: this.x, y: this.y, r: this.runNoise } : null;
  }
}
