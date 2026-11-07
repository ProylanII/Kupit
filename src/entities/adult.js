import { TILE } from '../world/tilemap.js';
import { angDiff, hasLos, castCone } from '../world/los.js';

// cycle = awake/"off" phases. Lola sleeps in her off phase (noise wakes her),
// Tita looks at her phone (cone disabled, but she can't be woken).
export const ADULT_TYPES = {
  mama: { name: 'MAMA', speed: 26, range: 72, fov: 0.85, rate: 1.7 },
  lola: { name: 'LOLA', speed: 14, range: 56, fov: 1.15, rate: 1.1, cycle: { on: 9, off: 9 }, sleepy: true },
  tita: { name: 'TITA', speed: 22, range: 80, fov: 0.7, rate: 2.0, cycle: { on: 7, off: 3 }, phone: true },
};

const RAYS = 32;

export class Adult {
  constructor(def, map) {
    this.map = map;
    this.type = def.type;
    this.cfg = { ...ADULT_TYPES[def.type] };
    if (def.cycle) this.cfg.cycle = def.cycle;
    const pts = (def.route || [def.at]).map(([x, y]) => ({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 }));
    this.pts = pts;
    this.x = pts[0].x;
    this.y = pts[0].y;
    this.i = 1 % pts.length;
    this.wait = 0;
    this.baseA = def.face ?? (pts.length > 1 ? Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) : Math.PI / 2);
    this.a = this.baseA;
    this.sweep = def.sweep ?? 0;
    this.sweepT = 0;
    this.t = def.phase ?? 0;
    this.alert = 0;
    this.hearT = 0;
    this.faceTo = this.a;
    this.awake = true;
    this.seen = false;
    this.caught = false;
    this.rays = new Float32Array(RAYS + 1);
    this.moving = false;
    this.stepT = 0;
  }

  update(dt, player, noise) {
    const c = this.cfg;
    this.moving = false;
    let awake = true;
    if (c.cycle) {
      this.t += dt;
      const per = c.cycle.on + c.cycle.off;
      awake = this.t % per < c.cycle.on;
      if (!awake && c.sleepy && noise && Math.hypot(noise.x - this.x, noise.y - this.y) < noise.r * 0.7) {
        this.t = Math.floor(this.t / per) * per; // noise wakes her
        awake = true;
        this.hearT = 1.5;
        this.faceTo = Math.atan2(noise.y - this.y, noise.x - this.x);
      }
    }
    this.awake = awake;
    if (!awake) {
      this.seen = false;
      this.alert = Math.max(0, this.alert - dt * 1.5);
      return;
    }

    if (noise) {
      const dn = Math.hypot(noise.x - this.x, noise.y - this.y);
      if (dn < noise.r) {
        this.hearT = 1.2;
        this.faceTo = Math.atan2(noise.y - this.y, noise.x - this.x);
      }
    }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    const toP = Math.atan2(dy, dx);
    this.seen = dist < c.range && Math.abs(angDiff(toP - this.a)) < c.fov && hasLos(this.map, this, player);

    if (this.seen) {
      this.alert += dt * c.rate * (dist < 32 ? 2.5 : 1);
      this.a += angDiff(toP - this.a) * Math.min(1, dt * 8);
    } else if (this.hearT > 0) {
      this.hearT -= dt;
      this.a += angDiff(this.faceTo - this.a) * Math.min(1, dt * 6);
      this.alert = Math.max(0, this.alert - dt * 0.4);
    } else {
      this.alert = Math.max(0, this.alert - dt * 0.9);
      this.patrol(dt);
    }
    if (this.alert >= 1) this.caught = true;
    castCone(this.map, this.x, this.y, this.a, c.fov, c.range, RAYS, this.rays);
  }

  patrol(dt) {
    const c = this.cfg;
    if (this.pts.length < 2) {
      this.sweepT += dt;
      const want = this.baseA + Math.sin(this.sweepT * 0.9) * this.sweep;
      this.a += angDiff(want - this.a) * Math.min(1, dt * 4);
      return;
    }
    if (this.wait > 0) { this.wait -= dt; return; }
    const tg = this.pts[this.i];
    const d = Math.hypot(tg.x - this.x, tg.y - this.y);
    if (d < 2) { this.wait = 0.8; this.i = (this.i + 1) % this.pts.length; return; }
    const ta = Math.atan2(tg.y - this.y, tg.x - this.x);
    this.a += angDiff(ta - this.a) * Math.min(1, dt * 6);
    if (Math.abs(angDiff(ta - this.a)) < 0.5) {
      this.x += ((tg.x - this.x) / d) * c.speed * dt;
      this.y += ((tg.y - this.y) / d) * c.speed * dt;
      this.moving = true;
      this.stepT += dt;
    }
  }
}
