import { TILE, toTile } from '../world/tilemap.js';
import { angDiff, hasLos, castCone } from '../world/los.js';
import { findPath } from '../world/pathfind.js';

// cycle = awake/"off" phases while patrolling. sleepy: off = asleep, noise wakes.
// phone: off = on her phone (cone off, ignores noise). dog: barks instead of chasing, goes for food.
// tattle: shouts for everyone in earshot (after a short wind-up) when he spots you.
// harmless: never sees or catches (party guests, vehicles). cover: blocks other adults' sight.
// scan: the cone sweeps side to side while walking (tanod's flashlight). leash: gives up a chase this far from home.
export const ADULT_TYPES = {
  mama:  { name: 'MAMA',  speed: 26, range: 72, fov: 0.85, rate: 1.7, shout: "ANO 'YAN?!", scold: 'IKAW TALAGA! BALIK DOON!' },
  lola:  { name: 'LOLA',  speed: 14, range: 56, fov: 1.15, rate: 1.1, cycle: { on: 9, off: 9 }, sleepy: true, shout: 'APO!?', scold: 'APO, BAWAL YAN HA!' },
  tita:  { name: 'TITA',  speed: 22, range: 80, fov: 0.7,  rate: 2.0, cycle: { on: 7, off: 3 }, phone: true, shout: 'HOY!', scold: 'ISUSUMBONG KITA!' },
  tatay: { name: 'TATAY', speed: 34, range: 60, fov: 0.75, rate: 2.2, shout: 'HOY BATA!', scold: 'LAGOT KA SA AKIN!' },
  kuya:  { name: 'KUYA',  speed: 30, range: 68, fov: 0.8,  rate: 1.6, tattle: { r: 170, windup: 0.5, say: 'MAAA! KUMUKUPIT SIYA!' }, shout: 'SUSUMBONG KITA!', scold: 'HULI! AKIN NA YAN!' },
  nena:  { name: 'ALING NENA', speed: 22, range: 76, fov: 0.9, rate: 1.8, shout: 'BAYAD MUNA!', scold: 'BAYAD MUNA, IJO!' },
  ninang: { name: 'NINANG', speed: 18, range: 70, fov: 0.9, rate: 1.6, shout: 'IJO! ANO YAN?!', scold: 'WALANG PAMASKO SAYO!' },
  aso:   { name: 'ASO',   speed: 40, range: 44, fov: 1.4,  rate: 2.5, dog: true, shout: 'AW AW!', scold: 'GRRR... AW!' },
  // late-game community archetypes (built from the behaviours above)
  tanod: { name: 'TANOD', speed: 24, range: 92, fov: 0.42, rate: 1.9, scan: { amp: 0.85, speed: 1.4 }, tattle: { r: 190, windup: 0.3, say: 'PRRRT!' }, shout: 'TIGIL!', scold: 'SA BARANGAY KA!' },
  tindera: { name: 'TINDERA', speed: 22, range: 72, fov: 0.95, rate: 1.8, tattle: { r: 130, windup: 0.4, say: 'MAGNANAKAW!' }, leash: 64, shout: 'MAGNANAKAW!', scold: 'HINDI LIBRE YAN!' },
  bisita: { name: 'BISITA', speed: 15, range: 0, fov: 0, rate: 0, harmless: true, cover: true, shout: '' },
  trike: { name: 'TRICYCLE', speed: 52, range: 0, fov: 0, rate: 0, harmless: true, cover: true, vehicle: true, shout: 'BEEP BEEP!' },
};

// Routines: a route point can name what the adult does while waiting there: [x, y, waitSeconds, faceRadians, 'luto'].
// Busy people watch less: range/fov are multipliers on their normal cone (0 = sees nothing at all), deaf = hears
// nothing. Any noise makes them look up for a moment, and the routine ends the second they are suspicious.
// pose: sprite pose while busy. say: the bubble when they start.
export const ACTIVITIES = {
  luto:   { name: 'COOKING',   range: 0,    fov: 1,    pose: 'reach', say: 'LUTO MUNA...',     prop: 'pot' },
  hugas:  { name: 'WASHING UP', range: 0,   fov: 1,    pose: 'reach', say: 'HUGAS PINGGAN...' },
  sampay: { name: 'HANGING LAUNDRY', range: 0, fov: 1, pose: 'reach', say: 'SAMPAY MUNA...' },
  walis:  { name: 'SWEEPING',  range: 0.5,  fov: 1,    pose: null,    say: 'WALIS, WALIS...' },
  dilig:  { name: 'WATERING',  range: 0.5,  fov: 0.8,  pose: 'reach', say: 'DILIG MUNA...' },
  tv:     { name: 'WATCHING TV', range: 1.1, fov: 0.4, pose: null,    say: 'TELESERYE NA!' },
  kwento: { name: 'CHATTING',  range: 0.8,  fov: 0.45, pose: null,    say: 'ALAM MO BA, MARE...' },
  bilang: { name: 'COUNTING',  range: 0.4,  fov: 1,    pose: 'reach', say: 'ISA, DALAWA, TATLO...' },
  phone:  { name: 'ON THE PHONE', range: 0, fov: 1,    pose: 'phone', say: 'HELLO? MARE!', deaf: true },
  idlip:  { name: 'DOZING',    range: 0,    fov: 1,    pose: 'sleep', say: 'IDLIP LANG...' },
  kanta:  { name: 'SINGING',   range: 0,    fov: 1,    pose: 'alert', say: 'MY WAAAY!', deaf: true },
};

const mapPts = (route) => route.map((p) => ({
  x: p[0] * TILE + TILE / 2, y: p[1] * TILE + TILE / 2, tx: p[0], ty: p[1], wait: p[2], face: p[3], act: p[4],
}));

const RAYS = 32;
const SEARCH_TIME = 2.5;
const CHASE_MULT = 1.5;
const CATCH_DIST = 10;
const COVER_R = 6; // half-width of a person standing in the way
export const BLEND_SEE = 30; // a kid walking with a guest is only noticed from this close

const RETRY = 0.5; // seconds a blocked adult waits before planning its route again

export class Adult {
  // locks: the level's live lock map ("x,y" -> key colour); adults have no keys, so locked doors are walls to them
  constructor(def, map, locks = new Map()) {
    this.map = map;
    this.locks = locks;
    this.type = def.type;
    this.cfg = { ...ADULT_TYPES[def.type] };
    if (def.cycle) this.cfg.cycle = def.cycle;
    if (def.sleepy) this.cfg.sleepy = true;
    Object.assign(this.cfg, def.cfg || {}); // per-adult overrides: range, ranged, cook, ...
    // route points: [x, y, waitSeconds?, faceRadians?]
    this.pts = mapPts(def.route || [def.at]);
    this.x = this.pts[0].x;
    this.y = this.pts[0].y;
    this.i = 1 % this.pts.length;
    this.wait = 0;
    this.baseA = def.face ?? (this.pts.length > 1 ? Math.atan2(this.pts[1].y - this.y, this.pts[1].x - this.x) : Math.PI / 2);
    this.a = this.baseA;
    this.lookOff = 0;      // flashlight sweep on top of the walking direction
    this.scanT = 0;
    this.sweep = def.sweep ?? 0;
    this.sweepT = def.sweepPhase ?? 0;
    this.t = def.phase ?? 0;
    this.state = 'patrol'; // patrol | investigate | inspect | chase | search | return | eat
    this.alert = 0;
    this.hearT = 0;
    this.faceTo = this.a;
    this.awake = true;
    this.depth = 1;        // sleep depth (cfg.depth): noise drains it, at 0 she wakes
    this.seen = false;
    this.sawHide = false;
    this.caught = false;
    this.rays = new Float32Array(RAYS + 1);
    this.moving = false;
    this.stepT = 0;
    this.path = [];
    this.pathFor = null;
    this.repathT = 0;
    this.stuck = false;    // the last goTo found no path (a gate shut, a door is locked)
    this.blockedT = 0;     // patrol: wait this long before trying a blocked route again
    this.lostT = 0;
    this.searchT = 0;
    this.eatT = 0;
    this.barkT = 0;
    this.last = { x: this.x, y: this.y };
    this.say = null;
    this.food = null;
    this.freezeT = 0; // charmed: sees nothing, forgets the player
    this.rangedT = 1; // ladle cooldown
    this.inspectList = []; // hiding spots a boss is about to check
    this.huntT = 0;        // countdown to the next hunt (final boss phase)
    this.sniffT = -1;      // newest scent-trail point already followed (tracker dog)
    this.pendingLure = null; // heard a lure: reacts after a short, distance-based delay
    this.tattleT = 0;      // wind-up before the tattle shout goes out
    this.tattleGoal = null;
    this.barkAt = null;    // sound-tracking dog: bark toward a noise it heard
    this.alarm = false;    // hair-trigger alert raised inside hear(); announced on the next update
    this.covers = null;    // the level's adult list (set by World): guests in it block sight
    this.busy = null;      // the routine being done right now (an ACTIVITIES entry), or null
    this.woken = 0;        // times a noise woke this sleeper
  }

  // What the eyes can do right now: the normal cone, narrowed or switched off by a routine.
  get range() { return this.cfg.range * (this.busy ? this.busy.range : 1); }
  get fov() { return this.cfg.fov * (this.busy ? this.busy.fov : 1); }

  get home() { return this.pts[0]; }
  // where the eyes point: walking direction plus the flashlight sweep
  get va() { return this.a + this.lookOff; }

  // Bosses (cfg.checksHides) look inside the hiding spots near where they lost you or heard something.
  startInspect(world, x, y) {
    if (!this.cfg.checksHides) return false;
    const d = (h) => Math.hypot(h.x - x, h.y - y);
    const list = world.hides.filter((h) => d(h) < 96).sort((a, b) => d(a) - d(b)).slice(0, 2);
    const ph = world.player.hidden; // Bing's hide-anywhere spot counts too
    if (ph && !list.includes(ph) && d(ph) < 96) list.unshift(ph);
    this.inspectList = list;
    return this.nextInspect();
  }

  nextInspect() {
    while (this.inspectList.length) {
      const h = this.inspectList[0];
      if (this.goTo(h.x, h.y)) { this.state = 'inspect'; this.talk('SILIPIN KO...', 1.2); return true; }
      this.inspectList.shift();
    }
    return false;
  }

  // Boss phases change an adult mid-level: new stats, cycle, sweep or patrol route.
  // null removes a stat (e.g. cycle: null = never sleeps again).
  retune(m) {
    const { index, route, sweep, ...stats } = m;
    if (sweep !== undefined) this.sweep = sweep;
    for (const [k, v] of Object.entries(stats)) { if (v === null) delete this.cfg[k]; else this.cfg[k] = v; }
    if ('cycle' in stats && !this.cfg.cycle) this.awake = true;
    if (route) {
      this.pts = mapPts(route);
      this.i = 0; this.pathFor = null; this.path = []; this.wait = 0;
    }
  }

  // Back to a calm patrol (used when the player respawns after being caught).
  reset() {
    this.caught = false;
    this.alert = 0; this.seen = false; this.sawHide = false;
    this.pendingLure = null; this.tattleT = 0; this.barkAt = null; this.alarm = false;
    this.inspectList = []; this.food = null; this.hearT = 0; this.lostT = 0;
    if (this.state !== 'patrol' && this.state !== 'eat') {
      this.state = 'return';
      this.goTo(this.pts[this.i].x, this.pts[this.i].y);
    }
  }

  // Adults walk through closed doors (they open them), but not locked ones, and never through gates.
  passable = (x, y) => (this.map.ch(x, y) === 'D' ? !this.locks.has(x + ',' + y) : !this.map.tileSolid(x, y));

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
    this.stuck = !p;
    return !!p;
  }

  // Walk along this.path. Returns true when it is used up: either arrived, or the way got blocked
  // and there is no other route (then this.stuck is true and the adult has NOT reached the goal).
  follow(dt, speed, world, turnFirst = true) {
    let n = this.path[0];
    if (!n) return true;
    if (!this.passable(n.tx, n.ty)) { // a gate shut (or a door got locked) after the route was planned
      const goal = this.path[this.path.length - 1];
      if (!this.goTo(goal.x, goal.y)) return true;
      n = this.path[0];
      if (!n) return true;
    }
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
    this.woken++;
  }

  // Called by the level for every noise in earshot.
  // d = how far the sound travelled to get here (path distance), delay = seconds before reacting to a lure.
  hear(n, d = Math.hypot(n.x - this.x, n.y - this.y), delay = 0) {
    const c = this.cfg;
    if (c.harmless || this.state === 'chase' || this.state === 'eat') return;
    if (this.busy && this.busy.deaf && !n.tattle) return; // on the phone, or belting out a song
    const goal = n.goal || n;
    if (!this.awake) {
      if (!c.sleepy) return;
      if (c.depth) { // boss Lola: every noise drains her sleep; she only wakes when it runs out
        const close = Math.max(0, Math.min(1, 1 - d / n.r));
        this.depth -= close * (n.cont ? (n.dt || 1 / 60) * 1.6 : 0.4);
        if (this.depth > 0) return;
        this.depth = 0;
      } else if (d > n.r * 0.7) return;
      this.wake();
      this.talk('HM?!', 1);
    }
    if (n.food && !c.dog) return;
    if (c.hairTrigger && n.from !== this) { // final phase: any sound and she comes running
      this.state = 'chase'; this.alert = 1; this.lostT = 0; this.repathT = 0;
      this.last = { x: goal.x, y: goal.y };
      this.pendingLure = null;
      this.talk('NARINIG KITA!', 1.5);
      this.alarm = true;
      return;
    }
    if (c.dog && c.ears && n.lure && !n.dogBark && n.from !== this && this.state !== 'eat') {
      this.barkAt = { x: goal.x, y: goal.y, t: 0.5 }; // the dog points its master at whatever it heard
    }
    if (n.lure) {
      if (delay > 0) { if (!this.pendingLure || this.pendingLure.t > delay) this.pendingLure = { x: goal.x, y: goal.y, t: delay }; }
      else this.investigate(goal.x, goal.y);
    } else { this.hearT = 1.2; this.faceTo = Math.atan2(n.y - this.y, n.x - this.x); }
  }

  investigate(x, y) {
    if (this.state === 'chase' || this.cfg.harmless) return;
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
    this.pendingLure = null;
    this.last = { x: player.x, y: player.y };
    const t = this.cfg.tattle;
    if (t) { // wind-up, then a big shout that travels through the house (see update)
      this.tattleT = t.windup ?? 0.5;
      this.tattleGoal = { x: player.x, y: player.y };
      this.talk(t.say || this.cfg.shout, 2);
      world.emit({ type: 'windup', who: this, t: this.tattleT, r: t.r ?? 170 });
    } else this.talk(this.cfg.shout, 2);
    world.emit({ type: 'spotted', who: this });
  }

  // Someone in the way (a party guest, a tricycle) blocks sight like a wall.
  covered(px, py) {
    if (!this.covers) return false;
    const dx = px - this.x, dy = py - this.y, L2 = dx * dx + dy * dy;
    if (L2 < 1) return false;
    for (const o of this.covers) {
      if (o === this || !o.cfg.cover) continue;
      const t = ((o.x - this.x) * dx + (o.y - this.y) * dy) / L2;
      if (t <= 0.05 || t >= 0.95) continue;
      const cx = this.x + dx * t - o.x, cy = this.y + dy * t - o.y;
      if (cx * cx + cy * cy < COVER_R * COVER_R) return true;
    }
    return false;
  }

  canSee(player) {
    if (this.cfg.harmless || this.cfg.range <= 0) return false;
    if (player.graceT > 0) return false; // just respawned: a moment to get your bearings
    if (player.hidden && !this.sawHide) return false;
    const dx = player.x - this.x, dy = player.y - this.y, dist = Math.hypot(dx, dy);
    if (player.blend && this.state !== 'chase' && dist > BLEND_SEE) return false; // one more kid in the crowd
    return dist < this.range && Math.abs(angDiff(Math.atan2(dy, dx) - this.va)) < this.fov &&
      hasLos(this.map, this, player) && !this.covered(player.x, player.y);
  }

  // The drawn cone stops at guests too, so what you see is what they see.
  clipCone() {
    if (!this.covers) return;
    const fov = this.fov, va = this.va;
    if (fov <= 0 || this.range <= 0) return;
    for (const o of this.covers) {
      if (o === this || !o.cfg.cover) continue;
      const dx = o.x - this.x, dy = o.y - this.y, d = Math.hypot(dx, dy);
      if (d < 4 || d > this.range + COVER_R) continue;
      const rel = angDiff(Math.atan2(dy, dx) - va), half = Math.atan2(COVER_R, d);
      if (rel + half < -fov || rel - half > fov) continue;
      const i0 = Math.max(0, Math.ceil(((rel - half + fov) / (2 * fov)) * RAYS));
      const i1 = Math.min(RAYS, Math.floor(((rel + half + fov) / (2 * fov)) * RAYS));
      for (let i = i0; i <= i1; i++) this.rays[i] = Math.min(this.rays[i], Math.max(0, d - 3));
    }
  }

  update(dt, world) {
    const c = this.cfg, player = world.player;
    this.moving = false;
    if (this.say && (this.say.t -= dt) <= 0) this.say = null;
    this.barkT = Math.max(0, this.barkT - dt);
    // in the middle of a routine? (only on a calm patrol, standing at the point that names it, with nothing heard)
    const at = this.pts.length > 1 ? this.pts[(this.i + this.pts.length - 1) % this.pts.length] : this.pts[0];
    const act = this.state === 'patrol' && this.hearT <= 0 && this.alert < 0.3 && (this.pts.length > 1 ? this.wait > 0 : Math.hypot(at.x - this.x, at.y - this.y) < 3) ? ACTIVITIES[at.act] : null;
    if (act && this.busy !== act && act.say && !this.say) this.talk(act.say, 1.6);
    this.busy = act || null;

    // guests and vehicles just follow their route
    if (c.harmless) {
      this.awake = true; this.alert = 0; this.seen = false;
      this.patrol(dt, world);
      return;
    }

    if (this.alarm) { this.alarm = false; world.emit({ type: 'spotted', who: this }); }

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
      this.pendingLure = null;
      if (this.state === 'chase') { this.state = 'search'; this.searchT = SEARCH_TIME; this.sawHide = false; }
      return;
    }

    // the tattle shout goes out once the wind-up is over: everyone in earshot comes to where he saw you
    if (this.tattleT > 0 && (this.tattleT -= dt) <= 0) {
      const t = c.tattle;
      world.noise({ x: this.x, y: this.y, r: t.r ?? 170, lure: true, from: this, goal: this.tattleGoal, tattle: true });
      world.emit({ type: 'tattle', who: this });
    }
    // a sound-tracking dog barks toward what it heard (its master follows the bark)
    if (this.barkAt && (this.barkAt.t -= dt) <= 0) {
      const b = this.barkAt;
      this.barkAt = null;
      if (this.awake && this.barkT <= 0) {
        this.talk('AW?', 1);
        world.noise({ x: this.x, y: this.y, r: 120, lure: true, from: this, goal: { x: b.x, y: b.y }, dogBark: true });
        world.emit({ type: 'bark', who: this });
        this.barkT = 1.5;
      }
    }

    // sleep / phone cycle only runs during a calm patrol
    const wasAwake = this.awake;
    if (c.cycle && this.state === 'patrol' && this.hearT <= 0 && this.alert < 0.3) {
      this.t += dt;
      this.awake = this.t % (c.cycle.on + c.cycle.off) < c.cycle.on;
    } else this.awake = true;
    if (!this.awake) {
      if (wasAwake) this.depth = 1; // falls asleep: a fresh, deep sleep
      else if (c.depth) this.depth = Math.min(1, this.depth + dt * 0.04);
      this.seen = false;
      this.pendingLure = null;
      this.alert = Math.max(0, this.alert - dt * 1.5);
      return;
    }

    // a lure heard a moment ago: react now (the delay staggers a crowd instead of all at once)
    if (this.pendingLure && (this.pendingLure.t -= dt) <= 0) {
      const p = this.pendingLure;
      this.pendingLure = null;
      if (this.state !== 'chase') this.investigate(p.x, p.y);
    }

    // --- eyes
    this.seen = this.canSee(player);
    if (this.seen) {
      const dist = Math.hypot(player.x - this.x, player.y - this.y);
      if (this.state !== 'chase') this.alert += dt * c.rate * (world.mods?.alertRate ?? 1) * (dist < 32 ? 2.5 : 1);
      if (this.state !== 'chase' || dist < 24) this.a += angDiff(Math.atan2(player.y - this.y, player.x - this.x) - this.va) * Math.min(1, dt * 8);
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

    // --- ranged (Mama's sandok): throws at what she sees, dodgeable by moving sideways
    if (c.ranged) {
      this.rangedT = Math.max(0, this.rangedT - dt);
      const d = Math.hypot(player.x - this.x, player.y - this.y);
      if (this.seen && this.rangedT <= 0 && d > 20 && d < c.ranged.range && (this.alert > 0.3 || this.state === 'chase')) {
        world.throwAt(this, player);
        this.rangedT = c.ranged.cd;
      }
    }

    // --- final boss phase: keeps heading for roughly where you are
    const calm = this.state === 'patrol' || this.state === 'return' || this.state === 'search';
    if (c.hunt && calm && (this.huntT -= dt) <= 0) {
      this.huntT = c.hunt.every;
      const s = c.hunt.spread ?? 32, rnd = world.rng || Math.random;
      this.investigate(player.x + (rnd() * 2 - 1) * s, player.y + (rnd() * 2 - 1) * s);
      this.talk(c.dog ? 'SNIFF SNIFF' : 'NASAAN KA?!', 1.2);
    }
    // --- tracker dog: follows the player's scent trail when it crosses it
    if (c.tracker && calm && this.state !== 'investigate' && world.trail?.length) {
      const tr = world.trail;
      for (let i = tr.length - 1; i >= 0 && tr[i].t > this.sniffT; i--) {
        if (Math.hypot(tr[i].x - this.x, tr[i].y - this.y) < 28) {
          const q = tr[Math.min(tr.length - 1, i + 4)];
          this.sniffT = q.t;
          this.investigate(q.x, q.y);
          if (this.state === 'investigate') this.talk('SNIFF SNIFF', 1);
          break;
        }
      }
    }

    // --- behaviour
    switch (this.state) {
      case 'chase': {
        if (this.seen) { this.last = { x: player.x, y: player.y }; this.lostT = 0; } else this.lostT += dt;
        this.repathT -= dt;
        if (this.repathT <= 0) { this.goTo(this.last.x, this.last.y); this.repathT = 0.35; }
        const done = this.follow(dt, c.speed * CHASE_MULT, world, false);
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        if (dist < CATCH_DIST && !(player.graceT > 0) && (!player.hidden || this.sawHide)) { this.caught = true; return; }
        // the tindera never strays far from her stall
        const leashed = c.leash && Math.hypot(this.x - this.home.x, this.y - this.home.y) > c.leash;
        if ((done && !this.seen) || this.lostT > 5 || leashed) {
          this.alert = 0.6;
          this.sawHide = false;
          if (leashed) { this.state = 'search'; this.searchT = 1; this.talk(c.shout, 1.5); break; }
          if (!this.startInspect(world, this.last.x, this.last.y)) {
            this.state = 'search';
            this.searchT = SEARCH_TIME;
            this.talk('NASAAN NA?', 1.5);
          }
        }
        break;
      }
      case 'investigate': {
        if (this.follow(dt, c.speed * 1.15, world)) {
          if (this.stuck) { this.food = null; this.state = 'search'; this.searchT = SEARCH_TIME; break; } // way got blocked
          world.arrived(this);
          if (this.food && c.dog) {
            if (world.eatFood(this.food)) { this.state = 'eat'; this.eatT = 8; this.talk('NOM NOM', 2); world.emit({ type: 'bribed', who: this }); }
            else this.state = 'search', this.searchT = 1;
            this.food = null;
          } else if (!this.startInspect(world, this.target.x, this.target.y)) { this.state = 'search'; this.searchT = SEARCH_TIME; }
        }
        break;
      }
      case 'inspect':
        if (this.follow(dt, c.speed * 1.2, world)) {
          const h = this.inspectList.shift();
          if (this.stuck) { if (!this.nextInspect()) { this.state = 'search'; this.searchT = 1.2; } break; } // can't reach that spot
          if (player.hidden && player.hidden === h && !(player.graceT > 0)) { this.talk('HULI KA!', 2); this.caught = true; return; }
          this.talk('WALA...', 1);
          if (!this.nextInspect()) { this.state = 'search'; this.searchT = 1.2; }
        }
        break;
      case 'search':
        this.a += Math.sin(this.searchT * 3) * dt * 3;
        if ((this.searchT -= dt) <= 0) { this.state = 'return'; this.goTo(this.pts[this.i].x, this.pts[this.i].y); }
        break;
      case 'return':
        if (this.follow(dt, c.speed, world)) { this.state = 'patrol'; this.wait = 0; if (this.stuck) this.blockedT = RETRY; }
        break;
      default:
        if (this.hearT > 0) {
          this.hearT -= dt;
          this.a += angDiff(this.faceTo - this.a) * Math.min(1, dt * 6);
        } else this.patrol(dt, world);
    }
    if (this.state === 'chase') this.alert = 1;
    // tanod's flashlight: sweeps while he walks his beat, points straight when something is up
    if (c.scan && (this.state === 'patrol' || this.state === 'return')) {
      this.scanT += dt;
      this.lookOff = Math.sin(this.scanT * c.scan.speed) * c.scan.amp;
    } else this.lookOff *= Math.max(0, 1 - dt * 6);
    castCone(this.map, this.x, this.y, this.va, this.fov, this.range, RAYS, this.rays);
    this.clipCone();
  }

  patrol(dt, world) {
    if (this.blockedT > 0) { // the route is blocked: look around, then try again (never teleport past it)
      this.blockedT -= dt;
      this.a += Math.sin(this.blockedT * 4) * dt * 1.5;
      return;
    }
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
    const done = this.follow(dt, this.cfg.speed, world, !this.cfg.vehicle);
    if (this.stuck && Math.hypot(tg.x - this.x, tg.y - this.y) >= 1.5) { // can't reach this waypoint right now: skip to the next one after a short look around
      this.i = (this.i + 1) % this.pts.length;
      this.pathFor = null;
      this.blockedT = RETRY;
      return;
    }
    if (done || Math.hypot(tg.x - this.x, tg.y - this.y) < 1.5) {
      this.x = tg.x; this.y = tg.y;
      this.wait = tg.wait ?? 0.8;
      this.i = (this.i + 1) % this.pts.length;
      this.pathFor = null;
    }
  }
}
