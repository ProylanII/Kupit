import { TILE, toTile } from '../world/tilemap.js';
import { angDiff, hasLos, castCone } from '../world/los.js';
import { findPath } from '../world/pathfind.js';

// cycle = awake/"off" phases while patrolling. sleepy: off = asleep, noise wakes.
// phone: off = on her phone (cone off, ignores noise). dog: barks instead of chasing,
// goes for food. tattle: shouts for everyone when he spots you.
export const ADULT_TYPES = {
  mama:  { name: 'MAMA',  speed: 26, range: 72, fov: 0.85, rate: 1.7, shout: "ANO 'YAN?!" },
  lola:  { name: 'LOLA',  speed: 14, range: 56, fov: 1.15, rate: 1.1, cycle: { on: 9, off: 9 }, sleepy: true, shout: 'APO!?' },
  tita:  { name: 'TITA',  speed: 22, range: 80, fov: 0.7,  rate: 2.0, cycle: { on: 7, off: 3 }, phone: true, shout: 'HOY!' },
  tatay: { name: 'TATAY', speed: 34, range: 60, fov: 0.75, rate: 2.2, shout: 'HOY BATA!' },
  kuya:  { name: 'KUYA',  speed: 30, range: 68, fov: 0.8,  rate: 1.6, tattle: true, shout: 'SUSUMBONG KITA!' },
  aso:   { name: 'ASO',   speed: 40, range: 44, fov: 1.4,  rate: 2.5, dog: true, shout: 'AW AW!' },
};

const RAYS = 32;
const SEARCH_TIME = 2.5;
const CHASE_MULT = 1.5;
const CATCH_DIST = 10;

export class Adult {
  constructor(def, map) {
    this.map = map;
    this.type = def.type;
    this.cfg = { ...ADULT_TYPES[def.type] };
    if (def.cycle) this.cfg.cycle = def.cycle;
    if (def.sleepy) this.cfg.sleepy = true;
    // route points: [x, y, waitSeconds?, faceRadians?]
    this.pts = (def.route || [def.at]).map((p) => ({
      x: p[0] * TILE + TILE / 2, y: p[1] * TILE + TILE / 2, tx: p[0], ty: p[1],
      wait: p[2], face: p[3],
    }));
    this.x = this.pts[0].x;
    this.y = this.pts[0].y;
    this.i = 1 % this.pts.length;
    this.wait = 0;
    this.baseA = def.face ?? (this.pts.length > 1 ? Math.atan2(this.pts[1].y - this.y, this.pts[1].x - this.x) : Math.PI / 2);
    this.a = this.baseA;
    this.sweep = def.sweep ?? 0;
    this.sweepT = 0;
    this.t = def.phase ?? 0;
    this.state = 'patrol'; // patrol | investigate | chase | search | return | eat
    this.alert = 0;
    this.hearT = 0;
    this.faceTo = this.a;
    this.awake = true;
    this.seen = false;
    this.sawHide = false;
    this.caught = false;
    this.rays = new Float32Array(RAYS + 1);
    this.moving = false;
    this.stepT = 0;
    this.path = [];
    this.pathFor = null;
    this.repathT = 0;
    this.lostT = 0;
    this.searchT = 0;
    this.eatT = 0;
    this.barkT = 0;
    this.last = { x: this.x, y: this.y };
    this.say = null;
    this.food = null;
    this.freezeT = 0; // charmed: sees nothing, forgets the player
  }

  // Adults walk through closed doors (they open them), never through gates.
  passable = (x, y) => this.map.ch(x, y) === 'D' || !this.map.tileSolid(x, y);

  talk(text, t = 1.6) { this.say = { text, t }; }

  goTo(px, py) {
    let tx = toTile(px), ty = toTile(py);
    if (!this.passable(tx, ty)) { // aim for a free neighbour of the noise
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [tx + dx, ty + dy]).find(([x, y]) => this.passable(x, y));
      if (!n) { this.path = []; return false; }
      [tx, ty] = n;
    }
    const p = findPath(this.map, toTile(this.x), toTile(this.y), tx, ty, this.passable);
    this.path = p ? p.slice(1).map(([x, y]) => ({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, tx: x, ty: y })) : [];
    return !!p;
  }

  // Walk along this.path. Returns true when it is used up.
  follow(dt, speed, world, turnFirst = true) {
    const n = this.path[0];
    if (!n) return true;
    if (this.map.ch(n.tx, n.ty) === 'D') world.openDoor(n.tx, n.ty, this);
    const dx = n.x - this.x, dy = n.y - this.y, d = Math.hypot(dx, dy);
    if (d < 1.5) { this.x = n.x; this.y = n.y; this.path.shift(); return this.path.length === 0; }
    const ta = Math.atan2(dy, dx);
    this.a += angDiff(ta - this.a) * Math.min(1, dt * 8);
    if (!turnFirst || Math.abs(angDiff(ta - this.a)) < 0.6) {
      const step = Math.min(d, speed * dt);
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
      this.moving = true;
      this.stepT += dt * (speed / 26);
    }
    return false;
  }

  wake() {
    const c = this.cfg.cycle;
    if (c) this.t = Math.floor(this.t / (c.on + c.off)) * (c.on + c.off);
    this.awake = true;
  }

  // Called by the level for every noise in earshot.
  hear(n) {
    if (this.state === 'chase' || this.state === 'eat') return;
    const dist = Math.hypot(n.x - this.x, n.y - this.y);
    if (!this.awake) {
      if (!this.cfg.sleepy || dist > n.r * 0.7) return;
      this.wake();
      this.talk('HM?!', 1);
    }
    if (n.food && !this.cfg.dog) return;
    if (n.lure) this.investigate(n.x, n.y);
    else { this.hearT = 1.2; this.faceTo = Math.atan2(n.y - this.y, n.x - this.x); }
  }

  investigate(x, y) {
    if (this.state === 'chase') return;
    if (this.goTo(x, y)) {
      this.state = 'investigate';
      this.target = { x, y };
      if (this.alert < 0.3) this.talk('?', 1);
    }
  }

  smellFood(food) {
    if (!this.cfg.dog || this.state === 'chase' || this.state === 'eat' || this.food) return;
    if (this.goTo(food.x, food.y)) { this.state = 'investigate'; this.food = food; this.target = food; this.awake = true; }
  }

  startChase(world, player) {
    this.state = 'chase';
    this.alert = 1;
    this.lostT = 0;
    this.repathT = 0;
    this.last = { x: player.x, y: player.y };
    this.talk(this.cfg.shout, 2);
    world.emit({ type: 'spotted', who: this });
    if (this.cfg.tattle) world.noise({ x: player.x, y: player.y, r: 200, lure: true, from: this });
  }

  canSee(player) {
    if (player.hidden && !this.sawHide) return false;
    const dx = player.x - this.x, dy = player.y - this.y, dist = Math.hypot(dx, dy);
    return dist < this.cfg.range && Math.abs(angDiff(Math.atan2(dy, dx) - this.a)) < this.cfg.fov && hasLos(this.map, this, player);
  }

  update(dt, world) {
    const c = this.cfg, player = world.player;
    this.moving = false;
    if (this.say && (this.say.t -= dt) <= 0) this.say = null;
    this.barkT = Math.max(0, this.barkT - dt);

    // eating: busy, blind
    if (this.state === 'eat') {
      this.awake = false;
      if ((this.eatT -= dt) <= 0) { this.state = 'return'; this.awake = true; this.goTo(this.pts[this.i].x, this.pts[this.i].y); }
      return;
    }

    // charmed (Nene's Pa-cute): blind and calm for a few seconds
    if (this.freezeT > 0) {
      this.freezeT -= dt;
      this.alert = 0;
      this.seen = false;
      this.awake = true;
      if (this.state === 'chase') { this.state = 'search'; this.searchT = SEARCH_TIME; this.sawHide = false; }
      return;
    }

    // sleep / phone cycle only runs during a calm patrol
    if (c.cycle && this.state === 'patrol' && this.hearT <= 0 && this.alert < 0.3) {
      this.t += dt;
      this.awake = this.t % (c.cycle.on + c.cycle.off) < c.cycle.on;
    } else this.awake = true;
    if (!this.awake) {
      this.seen = false;
      this.alert = Math.max(0, this.alert - dt * 1.5);
      return;
    }

    // --- eyes
    this.seen = this.canSee(player);
    if (this.seen) {
      const dist = Math.hypot(player.x - this.x, player.y - this.y);
      if (this.state !== 'chase') this.alert += dt * c.rate * (world.mods?.alertRate ?? 1) * (dist < 32 ? 2.5 : 1);
      if (this.state !== 'chase' || dist < 24) this.a += angDiff(Math.atan2(player.y - this.y, player.x - this.x) - this.a) * Math.min(1, dt * 8);
      if (this.alert >= 1 && this.state !== 'chase') {
        if (c.dog) {
          if (this.barkT <= 0) {
            this.talk(c.shout, 1.5);
            world.noise({ x: player.x, y: player.y, r: 150, lure: true, from: this });
            world.emit({ type: 'bark', who: this });
            this.barkT = 2.5;
          }
          this.alert = 0.55;
        } else this.startChase(world, player);
      }
    } else if (this.state !== 'chase') {
      this.alert = Math.max(0, this.alert - dt * (this.state === 'patrol' ? 0.9 : 0.4));
    }

    // --- behaviour
    switch (this.state) {
      case 'chase': {
        if (this.seen) { this.last = { x: player.x, y: player.y }; this.lostT = 0; } else this.lostT += dt;
        this.repathT -= dt;
        if (this.repathT <= 0) { this.goTo(this.last.x, this.last.y); this.repathT = 0.35; }
        const done = this.follow(dt, c.speed * CHASE_MULT, world, false);
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        if (dist < CATCH_DIST && (!player.hidden || this.sawHide)) { this.caught = true; return; }
        if ((done && !this.seen) || this.lostT > 5) {
          this.state = 'search';
          this.searchT = SEARCH_TIME;
          this.alert = 0.6;
          this.sawHide = false;
          this.talk('NASAAN NA?', 1.5);
        }
        break;
      }
      case 'investigate': {
        if (this.follow(dt, c.speed * 1.15, world)) {
          world.arrived(this);
          if (this.food && c.dog) {
            if (world.eatFood(this.food)) { this.state = 'eat'; this.eatT = 8; this.talk('NOM NOM', 2); }
            else this.state = 'search', this.searchT = 1;
            this.food = null;
          } else { this.state = 'search'; this.searchT = SEARCH_TIME; }
        }
        break;
      }
      case 'search':
        this.a += Math.sin(this.searchT * 3) * dt * 3;
        if ((this.searchT -= dt) <= 0) { this.state = 'return'; this.goTo(this.pts[this.i].x, this.pts[this.i].y); }
        break;
      case 'return':
        if (this.follow(dt, c.speed, world)) { this.state = 'patrol'; this.wait = 0; }
        break;
      default:
        if (this.hearT > 0) {
          this.hearT -= dt;
          this.a += angDiff(this.faceTo - this.a) * Math.min(1, dt * 6);
        } else this.patrol(dt, world);
    }
    if (this.state === 'chase') this.alert = 1;
    castCone(this.map, this.x, this.y, this.a, c.fov, c.range, RAYS, this.rays);
  }

  patrol(dt, world) {
    if (this.pts.length < 2) {
      const home = this.pts[0];
      if (Math.hypot(home.x - this.x, home.y - this.y) > 2) { this.state = 'return'; this.goTo(home.x, home.y); return; }
      this.sweepT += dt;
      const want = this.baseA + Math.sin(this.sweepT * 0.9) * this.sweep;
      this.a += angDiff(want - this.a) * Math.min(1, dt * 4);
      return;
    }
    if (this.wait > 0) {
      this.wait -= dt;
      const p = this.pts[(this.i + this.pts.length - 1) % this.pts.length];
      if (p.face !== undefined) this.a += angDiff(p.face - this.a) * Math.min(1, dt * 5);
      return;
    }
    const tg = this.pts[this.i];
    if (this.pathFor !== tg || (this.path.length === 0 && Math.hypot(tg.x - this.x, tg.y - this.y) > 1.5)) {
      this.pathFor = tg;
      this.goTo(tg.x, tg.y);
    }
    if (this.follow(dt, this.cfg.speed, world) || Math.hypot(tg.x - this.x, tg.y - this.y) < 1.5) {
      this.x = tg.x; this.y = tg.y;
      this.wait = tg.wait ?? 0.8;
      this.i = (this.i + 1) % this.pts.length;
      this.pathFor = null;
    }
  }
}
