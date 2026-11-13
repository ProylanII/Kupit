import { TILE, toTile } from '../world/tilemap.js';
import { angDiff, hasLos, castCone } from '../world/los.js';
import { findPath } from '../world/pathfind.js';

// cycle = awake/"off" phases while patrolling. sleepy: off = asleep, noise wakes.
// phone: off = on her phone (cone off, ignores noise). dog: barks instead of chasing, goes for food.
// tattle: shouts for everyone in earshot (after a short wind-up) when he spots you.
// harmless: never sees or catches (party guests, vehicles). cover: blocks other adults' sight.
// scan: the cone sweeps side to side while walking (tanod's flashlight). leash: gives up a chase this far from home.
export const ADULT_TYPES = {
  // Lines: shout = when they spot you, scold = when they reach you. The family must never accuse Jun of taking
  // anything: they find him somewhere odd, not with coins (the one real "HULI KA!" is the story's ending).
  mama:  { name: 'MAMA',  speed: 26, range: 72, fov: 0.85, rate: 1.7, shout: "SINO 'YAN?!", scold: "JUN! ANO'NG GINAGAWA MO DITO?" },
  lola:  { name: 'LOLA',  speed: 14, range: 56, fov: 1.15, rate: 1.1, cycle: { on: 9, off: 9 }, sleepy: true, shout: 'APO?', scold: 'APO, MAY KAILANGAN KA?' },
  tita:  { name: 'TITA',  speed: 22, range: 80, fov: 0.7,  rate: 2.0, cycle: { on: 7, off: 3 }, phone: true, shout: 'HOY!', scold: 'LABAS DITO, BATA!' },
  tatay: { name: 'TATAY', speed: 34, range: 60, fov: 0.75, rate: 2.2, shout: 'HOY BATA!', scold: 'DOON KA MAGLARO SA LABAS!' },
  // kuya = Pinsan Jomar, the cousin staying with the family who loves to tell on people (not Kuya Ramil)
  kuya:  { name: 'JOMAR', speed: 30, range: 68, fov: 0.8,  rate: 1.6, tattle: { r: 170, windup: 0.5, say: 'TITAAA! SI JUN!' }, shout: 'TITA! SI JUN!', scold: 'NANDITO SI JUN SA KWARTO NIYO!' },
  nena:  { name: 'ALING NENA', speed: 22, range: 76, fov: 0.9, rate: 1.8, shout: 'BAYAD MUNA!', scold: 'BAYAD MUNA, IJO!' },
  ninang: { name: 'NINANG', speed: 18, range: 70, fov: 0.9, rate: 1.6, shout: 'IJO! ANO YAN?!', scold: 'MAMAYA PA ANG REGALO!' },
  aso:   { name: 'ASO',   speed: 40, range: 44, fov: 1.4,  rate: 2.5, dog: true, shout: 'AW AW!', scold: 'GRRR... AW!' },
  // late-game community archetypes (built from the behaviours above)
  tanod: { name: 'TANOD', speed: 24, range: 92, fov: 0.42, rate: 1.9, scan: { amp: 0.85, speed: 1.4 }, tattle: { r: 190, windup: 0.3, say: 'PRRRT!' }, shout: 'TIGIL!', scold: 'CURFEW NA! UWI!' },
  tindera: { name: 'TINDERA', speed: 22, range: 72, fov: 0.95, rate: 1.8, tattle: { r: 130, windup: 0.4, say: 'MARE! ANAK MO!' }, leash: 64, shout: 'MARE! ANAK MO!', scold: 'BATA, HUWAG DIYAN!' },
  // a neighbour out in the barangay (Chapter 4: no family out here); a recoloured adult, see render/sprites.js
  kapitbahay: { name: 'KAPITBAHAY', speed: 18, range: 64, fov: 0.8, rate: 1.5, shout: 'UY, BATA!', scold: 'GABI NA, IJO! UWI NA!' },
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
  ligo:   { name: 'SHOWERING', range: 0,    fov: 1,    pose: null,    say: 'LIGO MUNA!', deaf: true }, // (the water drowns out everything)
};

const mapPts = (route) => route.map((p) => ({
  x: p[0] * TILE + TILE / 2, y: p[1] * TILE + TILE / 2, tx: p[0], ty: p[1], wait: p[2], face: p[3], act: p[4],
}));

const RAYS = 32;
const SEARCH_TIME = 2.5;
const CHASE_MULT = 1.5;
const CATCH_DIST = 10;
export const UNDER_SEE = 20; // Bing under a table or bed: only someone right next to it sees her (and can reach in)
const COVER_R = 6; // half-width of a person standing in the way
export const BLEND_SEE = 30; // a kid walking with a guest is only noticed from this close

const RETRY = 0.5; // seconds a blocked adult waits before planning its route again
// A real search (design overhaul A3): after losing you they walk a few nearby spots and look around at each, then
// stay wary for a while (their suspicion drains half as fast). How thorough depends on who it is.
const LOOK_TIME = 0.9, WARY_TIME = 15;
export const SEARCH_PTS = { mama: 3, tatay: 2, lola: 0, tita: 2, kuya: 2, tanod: 2, tindera: 1, ninang: 2, nena: 2, aso: 0 };
export const LIGHT_CHECK = 0.4; // A2: chance an ordinary adult checks the one hiding spot right by where they lost you
const BUMP_DIST = 9;           // A11: walking into an awake adult startles them
const YIELD_MAX = 0.8;          // A8: longest an adult waits for someone in the way before stepping through
const LURE_MEMORY = 20;         // A4: seconds a thrown lure is remembered (the same trick twice only gets a look)

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
    if (this.cfg.speedMul) this.cfg.speed *= this.cfg.speedMul; // (HINALA: Mama hurries as the house grows suspicious)
    this.uid = ++Adult.n; // (who yields when two meet in a doorway)
    this.yieldT = 0;
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
  // how long a search lasts (HINALA: a suspicious house looks longer before giving up)
  get searchTime() { return SEARCH_TIME * (this.cfg.searchMul || 1); }
  // where the eyes point: walking direction plus the flashlight sweep
  get va() { return this.a + this.lookOff; }

  // Start searching around (x, y): n spots to walk to (default by who it is), then a look round of t seconds.
  beginSearch(world, x, y, n = this.cfg.searchPts ?? SEARCH_PTS[this.type] ?? 2, t = this.searchTime) {
    this.state = 'search';
    this.searchPts = n > 0 ? this.pickSearchPts(world, x, y, n) : [];
    this.lookT = 0;
    this.searchT = t;
    if (n > 0) this.wary = WARY_TIME;
    if (this.searchPts.length) this.goTo(this.searchPts[0].x, this.searchPts[0].y);
  }
  // Up to n floor squares within three tiles of (x, y), a short walk away and not next to each other. They stay in
  // the room where they lost you: a spot that is only reached through a doorway is not part of this search.
  pickSearchPts(world, x, y, n) {
    const tx = toTile(x), ty = toTile(y), rnd = world.rng || Math.random, cands = [], out = [];
    const isDoor = (cx, cy) => { const ch = this.map.ch(cx, cy); return ch === 'D' || ch === 'd'; };
    const inRoom = (cx, cy) => this.passable(cx, cy) && !isDoor(cx, cy);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const cx = tx + dx, cy = ty + dy;
      if ((dx || dy) && inRoom(cx, cy)) cands.push([cx, cy]);
    }
    for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
    const sx = toTile(this.x), sy = toTile(this.y);
    if (!inRoom(sx, sy)) return out; // standing in a doorway: just look round
    for (const [cx, cy] of cands) {
      if (out.length >= n) break;
      if (out.some((q) => Math.abs(q.tx - cx) + Math.abs(q.ty - cy) < 2)) continue;
      const path = findPath(this.map, sx, sy, cx, cy, inRoom, 600);
      if (path && path.length <= 10) out.push({ x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2, tx: cx, ty: cy });
    }
    return out;
  }
  // A2: ordinary adults (not just bosses) sometimes check the one hiding spot right by where they lost you.
  lightInspect(world, x, y) {
    const c = this.cfg;
    if (c.checksHides || c.dog || c.harmless || (SEARCH_PTS[this.type] ?? 2) === 0) return false;
    const d = (h) => Math.hypot(h.x - x, h.y - y);
    const ph = world.player.hidden;
    const spot = ph && ph.kind === 'pocket' && d(ph) < 2 * TILE ? ph : world.hides.filter((h) => d(h) < 2 * TILE).sort((a, b) => d(a) - d(b))[0];
    if (!spot || (world.rng || Math.random)() >= LIGHT_CHECK) return false;
    this.inspectList = [spot];
    return this.nextInspect();
  }

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
    if (this.map.ch(n.tx, n.ty) === 'D' && world.openDoor(n.tx, n.ty, this)) this.openedDoor = { tx: n.tx, ty: n.ty };
    const dx = n.x - this.x, dy = n.y - this.y, d = Math.hypot(dx, dy);
    if (d < 1.5) { this.x = n.x; this.y = n.y; this.path.shift(); return this.path.length === 0; }
    const ta = Math.atan2(dy, dx);
    this.a += angDiff(ta - this.a) * Math.min(1, dt * 8);
    if (this.state !== 'chase' && this.blockedBy(world, dx / d, dy / d, dt)) return false; // A8: someone in the way
    if (!turnFirst || Math.abs(angDiff(ta - this.a)) < 0.6) {
      const step = Math.min(d, speed * dt);
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
      this.moving = true;
      this.stepT += dt * (speed / 26);
    }
    return false;
  }

  // A8: is someone standing just ahead? Then wait a moment (up to YIELD_MAX) instead of walking through them. In a
  // head-on meeting only one of the two waits. The tricycle stops for people and honks; it does not stop for kids
  // (crossing in front of it is the risk), it just honks.
  blockedBy(world, ux, uy, dt) {
    const veh = this.cfg.vehicle, reach = veh ? 22 : 9;
    let block = null;
    for (const o of world.adults || []) {
      if (o === this || o.cfg.vehicle || (o.cfg.dog && !veh)) continue;
      const ox = o.x - this.x, oy = o.y - this.y, ahead = ox * ux + oy * uy, side = Math.abs(ox * uy - oy * ux);
      if (ahead <= 0 || ahead > reach || side > (veh ? 9 : 6)) continue;
      const theyFaceMe = o.moving && Math.cos(o.a) * -ux + Math.sin(o.a) * -uy > 0.5;
      if (!veh && theyFaceMe && this.uid < o.uid) continue; // head-on: the other one waits
      block = o; break;
    }
    if (veh && !block && !this.say) {
      for (const k of world.kids || [world.player]) {
        if (!k || k.out || k.hidden) continue;
        const ox = k.x - this.x, oy = k.y - this.y, ahead = ox * ux + oy * uy;
        if (ahead > 0 && ahead < 30 && Math.abs(ox * uy - oy * ux) < 10) { this.talk(this.cfg.shout, 0.8); world.emit({ type: 'honk', who: this }); break; }
      }
    }
    if (!block) { this.yieldT = 0; return false; }
    if (veh && !this.say) { this.talk(this.cfg.shout, 0.8); world.emit({ type: 'honk', who: this }); }
    this.yieldT += dt;
    return this.yieldT <= (veh ? 4 : YIELD_MAX); // waited long enough: squeeze past
  }

  // The next sleep or phone cycle (A13, A16): the first one is exactly as the level wrote it, later ones vary a
  // little (seeded, so a replay is the same). Tita's calls are either a quick text or a long call.
  rollCycle(world) {
    const c = this.cfg.cycle, rnd = world?.rng || Math.random, j = () => 1 + (rnd() * 2 - 1) * 0.2;
    if (this.cfg.phone) return { on: c.on * j(), off: rnd() < 0.5 ? Math.max(2, c.off * 0.67) : c.off * 1.9 };
    return { on: c.on * j(), off: c.off * j() };
  }

  wake() {
    const c = this.cfg.cycle;
    if (c && (this.cfg.depth || this.cfg.checksHides)) this.t = Math.floor(this.t / (c.on + c.off)) * (c.on + c.off); // (boss Lola: unchanged)
    else if (c) { // A13: woken, she stays up half again as long, and sleeps lightly for the rest of the level
      const cy = this.cyc || c;
      this.t = 0;
      this.cyc = { on: c.on * 1.5, off: cy.off };
      if (this.cfg.sleepy) this.cfg.lightSleeper = true;
    }
    this.awake = true;
    this.woken++;
  }

  // Called by the level for every noise in earshot.
  // d = how far the sound travelled to get here (path distance), delay = seconds before reacting to a lure.
  hear(n, d = Math.hypot(n.x - this.x, n.y - this.y), delay = 0) {
    const c = this.cfg;
    if (c.harmless || this.state === 'chase' || this.state === 'eat') return;
    if (n.marble && c.dog) return; // a rolling holen means nothing to a dog
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
    if (n.lure && n.thrown) { // A4: the same trick in the same place: a look the second time, the thrower the third
      const now = this.clock || 0;
      this.lures = (this.lures || []).filter((l) => now - l.t < LURE_MEMORY);
      const same = this.lures.filter((l) => Math.hypot(l.x - goal.x, l.y - goal.y) < 2 * TILE).length;
      this.lures.push({ x: goal.x, y: goal.y, t: now });
      if (same === 1) { this.hearT = 1.2; this.faceTo = Math.atan2(goal.y - this.y, goal.x - this.x); this.talk('HMM?', 0.8); return; }
      if (same >= 2 && n.origin) { this.pendingLure = null; this.investigate(n.origin.x, n.origin.y); this.talk('SINO NAGHAHAGIS?', 1.6); this.wary = WARY_TIME; return; }
    }
    if (n.lure && n.again) { // A4: the radio they switched off is on again: straight there, and wary
      this.pendingLure = null;
      if (this.state !== 'investigate') this.talk('ANO BA YAN?!', 1.4);
      this.investigate(goal.x, goal.y);
      this.wary = WARY_TIME;
      return;
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
      if (this.alert < 0.3) this.talk(this.type === 'mama' ? 'ANAK?' : '?', 1);
    }
  }

  smellFood(food) {
    if (!this.cfg.dog || this.state === 'chase' || this.state === 'eat' || this.food) return;
    if (this.goTo(food.x, food.y)) { this.state = 'investigate'; this.food = food; this.target = food; this.awake = true; }
  }

  // A15: Lola doesn't run after anyone. She calls out ('Apo? Is that you?'), and whoever hears comes to her.
  callOut(world) {
    this.alert = 0.6;
    if (this.callT > 0) return;
    this.callT = 6;
    this.talk("APO? IKAW BA 'YAN?", 2);
    world.noise({ x: this.x, y: this.y, r: 150, lure: true, from: this });
    world.emit({ type: 'callout', who: this });
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
    if (player.under && dist > UNDER_SEE) return false; // MALIIT: under the table, out of sight
    return dist < this.range * (player.darkMul ?? 1) && Math.abs(angDiff(Math.atan2(dy, dx) - this.va)) < this.fov && // (A6: the dark hides you)
      hasLos(this.map, this, player) && !this.covered(player.x, player.y);
  }

  // A spot (not a kid) in plain view: in the cone, within reach (capped at maxD), nothing in the way.
  seesPoint(x, y, maxD = Infinity) {
    if (this.cfg.harmless || this.cfg.range <= 0 || !this.awake) return false;
    const dx = x - this.x, dy = y - this.y, d = Math.hypot(dx, dy);
    return d < Math.min(this.range, maxD) && (d < 8 || Math.abs(angDiff(Math.atan2(dy, dx) - this.va)) < this.fov) && hasLos(this.map, this, { x, y });
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
    const c = this.cfg, player = world.focusFor ? world.focusFor(this) : world.player; // (two kids in KASABWAT)
    this.moving = false;
    this.clock = (this.clock || 0) + dt;
    if (this.wary > 0) this.wary -= dt;
    if (this.callT > 0) this.callT -= dt;
    // A17: Tatay whistles while he walks about (you hear where he is)
    if (this.type === 'tatay' && this.moving && this.state === 'patrol' && (this.tuneT = (this.tuneT ?? 2) - dt) <= 0) {
      this.tuneT = 5;
      world.emit({ type: 'tune', who: this });
      if (!this.say) this.talk('FWIT FWIW~', 1);
    }
    // A5: a door they opened gets closed behind them once they are past it (habit)
    if (this.openedDoor && Math.max(Math.abs(toTile(this.x) - this.openedDoor.tx), Math.abs(toTile(this.y) - this.openedDoor.ty)) >= 2) {
      world.closeDoorBehind?.(this.openedDoor.tx, this.openedDoor.ty);
      this.openedDoor = null;
    }
    if (this.say && (this.say.t -= dt) <= 0) this.say = null;
    this.barkT = Math.max(0, this.barkT - dt);
    // in the middle of a routine? (only on a calm patrol, standing at the point that names it, with nothing heard)
    const at = this.pts.length > 1 ? this.pts[(this.i + this.pts.length - 1) % this.pts.length] : this.pts[0];
    const act = this.state === 'patrol' && this.hearT <= 0 && this.alert < 0.3 && (this.pts.length > 1 ? this.wait > 0 : Math.hypot(at.x - this.x, at.y - this.y) < 3) && !c.skipActs?.includes(at.act) ? ACTIVITIES[at.act] : null; // (skipActs: HINALA can take a habit away, e.g. Tatay stops dozing)
    if (act && this.busy !== act && act.say && !this.say) this.talk(act.say, 1.6);
    this.busy = act || null;
    // A5: Mama notices a door Jun left open on her way ('Why is this open?'), looks in the room beyond and closes it
    if ((c.noticesDoors ?? this.type === 'mama') && this.awake && (this.state === 'patrol' || this.state === 'return') && world.playerOpened?.size) {
      const look = world.noticeOpenDoor?.(this);
      if (look) {
        this.investigate(look.x, look.y);
        this.talk("BAKIT BUKAS 'TO?", 1.8);
        this.wary = WARY_TIME;
        this.openedDoor = { tx: look.tx, ty: look.ty }; // she shuts it once she is through
      }
    }

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
      if (this.state === 'chase') { this.beginSearch(world, this.x, this.y, 0); this.sawHide = false; }
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
      if (c.depth || c.checksHides || !(c.sleepy || c.phone)) this.awake = this.t % (c.cycle.on + c.cycle.off) < c.cycle.on; // bosses (and cooks): clockwork on purpose
      else {
        let cy = this.cyc || c.cycle;
        while (this.t >= cy.on + cy.off) { this.t -= cy.on + cy.off; cy = this.cyc = this.rollCycle(world); this.rang = false; }
        this.awake = this.t < cy.on;
        // A16: her phone rings a moment before she answers it
        if (c.phone && this.awake && cy.on - this.t < 0.7 && !this.rang) { this.rang = true; this.talk('KRING KRING!', 0.7); world.emit({ type: 'ringtone', x: this.x, y: this.y }); }
      }
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
      // close range fills fast; the outer 30% of the cone (far, or off to the side) fills at half rate (A9)
      const edge = dist > 0.7 * this.range * (player.darkMul ?? 1) || Math.abs(angDiff(Math.atan2(player.y - this.y, player.x - this.x) - this.va)) > 0.7 * this.fov;
      if (this.state !== 'chase') this.alert += dt * c.rate * (world.mods?.alertRate ?? 1) * (dist < 32 ? 2.5 : edge ? 0.5 : 1);
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
        } else if (this.type === 'lola' && !c.depth && !c.checksHides && !c.hunt) this.callOut(world);
        else this.startChase(world, player);
      }
    } else if (this.state !== 'chase') {
      this.alert = Math.max(0, this.alert - dt * (this.state === 'patrol' ? (this.wary > 0 ? 0.45 : 0.9) : 0.4)); // wary: drains slower
    }
    // A11: walking right into someone who is awake startles them, routine or not (bosses keep their own rules until Phase 5)
    if (this.state !== 'chase' && !c.dog && !c.checksHides && !player.hidden && !player.under && !(player.graceT > 0) && this.alert < 0.8 &&
        Math.hypot(player.x - this.x, player.y - this.y) < BUMP_DIST) {
      this.alert = 0.8;
      this.busy = null;
      this.a = Math.atan2(player.y - this.y, player.x - this.x);
      this.talk('UY!', 0.8);
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
        const reach = player.under ? UNDER_SEE : CATCH_DIST; // they can reach in under a table
        if (dist < reach && !(player.graceT > 0) && (!player.hidden || this.sawHide)) { this.caught = true; return; }
        // the tindera never strays far from her stall
        const leashed = c.leash && Math.hypot(this.x - this.home.x, this.y - this.home.y) > c.leash;
        if ((done && !this.seen) || this.lostT > 5 || leashed) {
          this.alert = 0.6;
          this.sawHide = false;
          if (leashed) { this.beginSearch(world, this.x, this.y, 0, 1); this.talk(c.shout, 1.5); break; }
          if (!this.startInspect(world, this.last.x, this.last.y) && !this.lightInspect(world, this.last.x, this.last.y)) {
            this.beginSearch(world, this.last.x, this.last.y);
            this.talk("NASAAN NA 'YON?", 1.5);
          }
        }
        break;
      }
      case 'investigate': {
        if (this.follow(dt, c.speed * 1.15, world)) {
          if (this.stuck) { this.food = null; this.beginSearch(world, this.x, this.y, 0); break; } // way got blocked
          world.arrived(this);
          if (this.food && c.dog) {
            if (world.eatFood(this.food)) { this.state = 'eat'; this.eatT = 8; this.talk('NOM NOM', 2); world.emit({ type: 'bribed', who: this }); }
            else this.beginSearch(world, this.x, this.y, 0, 1);
            this.food = null;
          } else if (!this.startInspect(world, this.target.x, this.target.y)) this.beginSearch(world, this.target.x, this.target.y, 1); // a lure: one look round
        }
        break;
      }
      case 'inspect':
        if (this.follow(dt, c.speed * 1.2, world)) {
          const h = this.inspectList.shift();
          if (this.stuck) { if (!this.nextInspect()) this.beginSearch(world, this.x, this.y, 0, 1.2); break; } // can't reach that spot
          if (player.hidden && player.hidden === h && !(player.graceT > 0)) { this.talk('NANDIYAN KA PALA!', 2); this.caught = true; return; }
          this.talk('WALA...', 1);
          if (!this.nextInspect()) this.beginSearch(world, this.x, this.y, 0, 1.2);
        }
        break;
      case 'search':
        if (this.searchPts?.length) { // walk to each spot, look round, next
          if (this.lookT > 0) {
            this.lookT -= dt;
            this.a += Math.sin(this.lookT * 5) * dt * 3;
            if (this.lookT <= 0) { this.searchPts.shift(); if (this.searchPts.length) this.goTo(this.searchPts[0].x, this.searchPts[0].y); }
          } else if (this.follow(dt, c.speed, world)) this.lookT = LOOK_TIME * (c.searchMul || 1);
          break;
        }
        this.a += Math.sin(this.searchT * 3) * dt * 3;
        if ((this.searchT -= dt) <= 0) {
          if (this.staged) { this.staged = false; this.talk('WALA NAMAN...', 1.4); } // (a staged beat: she shrugs)
          this.state = 'return'; this.goTo(this.pts[this.i].x, this.pts[this.i].y);
        }
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
    const done = this.follow(dt, this.cfg.speed * (this.wary > 0 ? 1.12 : 1), world, !this.cfg.vehicle); // (A7: brisker when wary)
    if (this.stuck && Math.hypot(tg.x - this.x, tg.y - this.y) >= 1.5) { // can't reach this waypoint right now: skip to the next one after a short look around
      this.i = (this.i + 1) % this.pts.length;
      this.pathFor = null;
      this.blockedT = RETRY;
      return;
    }
    if (done || Math.hypot(tg.x - this.x, tg.y - this.y) < 1.5) {
      this.x = tg.x; this.y = tg.y;
      this.wait = (tg.wait ?? 0.8) * (this.cfg.vehicle ? 1 : 1 + ((world.rng || Math.random)() * 2 - 1) * 0.15); // A7: never quite the same (seeded)
      this.i = (this.i + 1) % this.pts.length;
      this.pathFor = null;
    }
  }
}

Adult.n = 0;
