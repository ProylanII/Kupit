// TUMBANG PRESO (mini-game MG-1): the street game, played the way kids in the barangay play it. DOM-free
// (tests/minigames.test.mjs drives it).
//
// - Everyone has a pair of tsinelas. From behind the chalk line you throw one at the can (the "preso") in its circle.
// - Knock it over (TUMBA!) and the taya has to fetch it and stand it back up before he may tag anyone: that is the
//   moment everybody runs for their slippers and back behind the line.
// - While the can stands, the taya tags anyone out in the street near it. Standing ON your own slipper is safe.
// - A friend who is tagged becomes the new taya. Jun tagged: one of his three chances goes, and the round restarts.
// - Jun wins with three TUMBA of his own.
//
// Aiming: hold BATO. A mark slides out along your aim and back; let go when it sits on the can. The stick (or A/D)
// turns the aim a little left or right.
import { MiniSim } from './minigame.js';
import { mulberry32, hashStr } from '../core/rng.js';

export const FIELD = { x0: 20, x1: 220, y0: 66, y1: 342 }; // (the top edge stays below the banderitas)
export const LINE_Y = 288;              // throw from behind this line
export const CAN_HOME = { x: 120, y: 110 };
export const GUARD_R = 104;             // the taya only chases kids this close to the can
export const RUN = 66;                  // Jun (and a friend at 0.85 of it)
export const TAYA = { guard: 30, chase: 50, fetch: 62, carry: 48 };
export const SAFE_R = 7;                // standing on your own slipper: nobody can tag you
export const TAG_R = 8;
export const THROW_SPEED = 215;
export const AIM_SWING = 0.55;          // how far the aim turns, either way
export const POWER_PERIOD = 1.5;        // the landing mark goes out and back in this time
export const MIN_D = 46, MAX_D = 262;
export const HIT_R = 8.5;
export const WIN = 3;
const HOLD_MIN = 0.12;                  // a tap is not a throw
const LINE_SPOT = LINE_Y + 22;          // where throwers stand
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const tri = (u) => { const f = u % 1; return f < 0.5 ? f * 2 : 2 - f * 2; }; // 0 -> 1 -> 0

const KIDS = [ // id, look, name, x on the line, role
  ['jun', 'jun', 'JUN', 120, 'thrower'],
  ['toto', 'toto', 'TOTO', 68, 'thrower'],
  ['lina', 'lina', 'LINA', 172, 'thrower'],
  ['buboy', 'buboy', 'BUBOY', CAN_HOME.x, 'taya'],
];

export class Preso extends MiniSim {
  constructor(level, opts = {}) {
    super(level, opts);
    this.rng = mulberry32(level.seed ?? hashStr(level.id || 'preso'));
    this.kids = KIDS.map(([id, look, name, x, role]) => ({
      id, look: id === 'jun' ? opts.look || 'jun' : look, name, homeX: x, role, x, y: role === 'taya' ? CAN_HOME.y - 16 : LINE_SPOT,
      slippers: role === 'taya' ? 0 : 2, dir: 3, moving: false, stepT: 0, state: role === 'taya' ? 'guard' : 'line',
      t: 0, waitT: 0, throwT: 1.6 + this.rng() * 2, say: null, score: 0, throws: 0, ai: id !== 'jun', pose: null, poseT: 0,
    }));
    this.jun = this.kids[0];
    this.can = { x: CAN_HOME.x, y: CAN_HOME.y, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, state: 'up' };
    this.slips = [];       // tsinelas out on the street: { owner, x, y, z, vx, vy, t, T, h, state: fly | skid | ground }
    this.aim = null;       // Jun holding BATO: { a, a0, t }
    this.beat = null;      // a moment everything stops for: { kind: 'tag' | 'swap' | 'win', t, who }
    this.introT = level.intro === false ? 0 : 2.4;
    this.tagged = 0;       // times Jun was tagged (mission presoClean)
    this.firstHit = false; // his very first throw knocked it down (mission presoFirst)
    this.firstDone = false;
    this.knocks = 0;
    this.prompt = null;
  }

  get taya() { return this.kids.find((k) => k.role === 'taya'); }
  get player() { return { tx: Math.floor(this.jun.x / 16), ty: Math.floor(this.jun.y / 16) }; }
  get score() { return this.jun.score; }
  get scoreText() { return `TUMBA ${this.jun.score}/${WIN}`; }
  inField(k) { return k.y < LINE_Y - 1; }
  onSlipper(k) { return this.slips.some((s) => s.owner === k && s.state === 'ground' && dist(s, k) < SAFE_R); }
  // out in the street, near nothing of yours, while the can stands: the taya may tag you
  vulnerable(k) { return k.role === 'thrower' && this.inField(k) && !this.onSlipper(k) && this.can.state === 'up' && !this.beat; }
  talk(k, text, t = 1.2) { k.say = { text, t }; }

  // What Jun's button does right now: { kind: 'aim' | 'pulot', label } or a hint { kind: null, label }
  context() {
    const k = this.jun;
    if (this.beat || this.introT > 0 || this.status !== 'play') return null;
    const mine = this.slips.find((s) => s.owner === k && s.state === 'ground' && dist(s, k) < SAFE_R + 4);
    if (mine) return { kind: 'pulot', label: 'PICK UP', obj: mine };
    if (!this.inField(k) && k.slippers > 0) return this.can.state === 'up' ? { kind: 'aim', label: 'THROW' } : { kind: null, label: 'WAIT' };
    if (this.inField(k) && k.slippers > 0) return { kind: null, label: 'GO BACK' };
    return null;
  }

  // ---- the throw
  aimPoint(k = this.jun, aim = this.aim) {
    const d = MIN_D + (MAX_D - MIN_D) * tri(aim.t / POWER_PERIOD);
    return { x: k.x + Math.cos(aim.a) * d, y: k.y - 6 + Math.sin(aim.a) * d, d };
  }
  throwSlipper(k, a, d) {
    const vx = Math.cos(a) * THROW_SPEED, vy = Math.sin(a) * THROW_SPEED;
    const first = k === this.jun && !this.firstDone;
    if (first) this.firstDone = true;
    this.slips.push({ owner: k, x: k.x, y: k.y - 6, vx, vy, t: 0, T: d / THROW_SPEED, h: 12 + d * 0.09, z: 8, state: 'fly', hit: false, first });
    k.slippers--; k.throws++;
    k.pose = 'reach'; k.poseT = 0.35; k.dir = 3;
    this.emit({ type: 'throw', who: k });
  }

  knock(s) {
    const c = this.can, r = this.rng;
    c.state = 'fly'; c.z = 2; c.vz = 85 + r() * 20;
    c.vx = s.vx * 0.42 + (r() * 50 - 25); c.vy = s.vy * 0.42 + (r() * 30 - 15); c.spin = 0;
    s.hit = true;
    this.knocks++;
    const by = s.owner;
    if (by === this.jun) {
      by.score++;
      if (s.first) this.firstHit = true;
    }
    this.emit({ type: 'tumba', who: by, x: c.x, y: c.y, score: this.jun.score });
    for (const k of this.kids) if (k.role === 'thrower' && k !== by && this.rng() < 0.5) this.talk(k, k.ai ? 'TAKBO!' : '', 1);
    this.talk(by, 'TUMBA!', 1.2);
    const t = this.taya; if (t) this.talk(t, 'HALA!', 1);
    if (by === this.jun && by.score >= WIN) this.beat = { kind: 'win', t: 1.8 };
  }

  // ---- tags and rounds
  tag(k) {
    const t = this.taya;
    this.emit({ type: 'tag', who: k, by: t });
    this.talk(t, 'TAYA KA!', 1.6);
    if (k === this.jun) {
      if (this.god) { k.x = k.homeX; k.y = LINE_SPOT; return; }
      this.tagged++; this.catches++;
      this.beat = { kind: 'tag', t: 1.8, who: k };
      this.checkMissions();
    } else this.beat = { kind: 'swap', t: 1.5, who: k };
  }
  resetRound() {
    this.slips.length = 0;
    Object.assign(this.can, { x: CAN_HOME.x, y: CAN_HOME.y, z: 0, vx: 0, vy: 0, vz: 0, state: 'up' });
    for (const k of this.kids) {
      k.slippers = k.role === 'taya' ? 0 : 2;
      k.state = k.role === 'taya' ? 'guard' : 'line';
      k.x = k.role === 'taya' ? CAN_HOME.x : k.homeX; k.y = k.role === 'taya' ? CAN_HOME.y - 16 : LINE_SPOT;
      k.waitT = 0; k.throwT = 1.4 + this.rng() * 2; k.dir = 3; k.pose = null;
    }
    this.aim = null;
    this.emit({ type: 'reset' });
  }
  endBeat() {
    const b = this.beat;
    this.beat = null;
    if (b.kind === 'win') { this.finish(); return; }
    if (b.kind === 'tag' && this.livesLeft <= 0) { this.fail('tagged'); return; }
    if (b.kind === 'swap') { // the tagged friend is "it" now; the old taya joins the line where they stood
      const old = this.taya, k = b.who;
      old.role = 'thrower'; old.homeX = k.homeX; old.ai = true;
      k.role = 'taya';
      this.emit({ type: 'swap', who: k, from: old });
    }
    this.resetRound();
  }

  // ---- movement helpers
  moveTo(k, x, y, speed, dt) {
    const dx = x - k.x, dy = y - k.y, d = Math.hypot(dx, dy);
    if (d < 0.8) { k.moving = false; return true; }
    const s = Math.min(d, speed * dt);
    k.x += (dx / d) * s; k.y += (dy / d) * s;
    k.moving = true; k.stepT += dt * (speed / 40);
    k.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0);
    return d <= speed * dt;
  }
  clampKid(k) { k.x = clamp(k.x, FIELD.x0 + 4, FIELD.x1 - 4); k.y = clamp(k.y, FIELD.y0 + 6, FIELD.y1 - 2); }
  pickUp(k) {
    let n = 0;
    for (const s of this.slips) if (s.owner === k && s.state === 'ground' && dist(s, k) < SAFE_R + 4) { s.state = 'gone'; n++; }
    this.slips = this.slips.filter((s) => s.state !== 'gone');
    k.slippers += n;
    if (n) { k.pose = 'reach'; k.poseT = 0.25; this.emit({ type: 'pickup', who: k }); }
    return n;
  }

  // ---- the people
  updateJun(dt, inp) {
    const k = this.jun;
    k.moving = false;
    if (this.aim) {
      if (inp.action) {
        this.aim.t += dt;
        this.aim.a = clamp(this.aim.a + (inp.mv.mag ? inp.mv.x * inp.mv.mag : 0) * 1.5 * dt, this.aim.a0 - AIM_SWING, this.aim.a0 + AIM_SWING);
      } else {
        const a = this.aim;
        this.aim = null;
        if (a.t >= HOLD_MIN && this.can.state === 'up' && k.slippers > 0) { const p = this.aimPoint(k, a); this.throwSlipper(k, a.a, p.d); }
        else this.emit({ type: 'tapTooShort' });
      }
      return;
    }
    const ctx = this.context();
    this.prompt = ctx;
    if (inp.actionPressed && ctx?.kind === 'aim') {
      const a0 = Math.atan2(this.can.y - (k.y - 6), this.can.x - k.x);
      this.aim = { a: a0, a0, t: 0 };
      k.dir = 3;
      return;
    }
    if (inp.actionPressed && ctx?.kind === 'pulot') { this.pickUp(k); return; }
    const mv = inp.mv;
    if (mv.mag > 0) {
      const sp = RUN * (0.45 + 0.55 * Math.min(1, mv.mag / 0.9));
      k.x += mv.x * sp * dt; k.y += mv.y * sp * dt;
      this.clampKid(k);
      k.moving = true; k.stepT += dt * (sp / 40);
      k.dir = Math.abs(mv.x) > Math.abs(mv.y) ? (mv.x < 0 ? 1 : 2) : (mv.y < 0 ? 3 : 0);
      if (this.onSlipper(k) && !this.wasSafe) this.emit({ type: 'safe' });
    }
    this.wasSafe = this.onSlipper(k);
  }

  updateTaya(k, dt) {
    const c = this.can;
    if (c.state === 'fly' || c.state === 'down') {
      if (k.state !== 'fetch') { k.state = 'fetch'; k.target = null; }
      if (this.moveTo(k, c.x, c.y + 3, TAYA.fetch, dt) && c.state === 'down') { c.state = 'carried'; k.state = 'carry'; }
      return;
    }
    if (k.state === 'carry') {
      c.x = k.x; c.y = k.y - 2;
      if (this.moveTo(k, CAN_HOME.x, CAN_HOME.y - 6, TAYA.carry, dt)) { k.state = 'setup'; k.t = 0.6; k.pose = 'reach'; k.poseT = 0.6; c.x = CAN_HOME.x; c.y = CAN_HOME.y; }
      return;
    }
    if (k.state === 'setup') {
      if ((k.t -= dt) <= 0) { c.state = 'up'; c.x = CAN_HOME.x; c.y = CAN_HOME.y; k.state = 'guard'; this.talk(k, 'AYOS!', 1); this.emit({ type: 'setup' }); }
      return;
    }
    // the can stands: guard it, and go after anyone careless out near it
    let best = null, bd = Infinity;
    for (const o of this.kids) {
      if (!this.vulnerable(o) || dist(o, c) > GUARD_R) continue;
      const d = dist(o, k);
      if (d < bd) { bd = d; best = o; }
    }
    if (k.state === 'chase') {
      const tg = k.target;
      if (!tg || !this.vulnerable(tg) || dist(tg, c) > GUARD_R + 24) { k.state = 'guard'; k.target = null; }
      else {
        this.moveTo(k, tg.x, tg.y, TAYA.chase, dt);
        if (dist(k, tg) < TAG_R) this.tag(tg);
        return;
      }
    }
    if (best) { k.state = 'chase'; k.target = best; this.talk(k, best === this.jun ? 'HUHULIHIN KITA!' : 'AKIN KA!', 1.2); this.emit({ type: 'chase', who: k, at: best }); return; }
    this.moveTo(k, CAN_HOME.x, CAN_HOME.y - 16, TAYA.guard, dt);
    if (!k.moving) { // face whoever is out in the street, else the line
      const o = this.kids.filter((x) => x.role === 'thrower').sort((a, b) => dist(a, c) - dist(b, c))[0];
      if (o) { const dx = o.x - k.x, dy = o.y - k.y; k.dir = Math.abs(dx) > Math.abs(dy) * 1.5 ? (dx < 0 ? 1 : 2) : 0; }
    }
  }

  updateFriend(k, dt) {
    const c = this.can, t = this.taya, up = c.state === 'up';
    const mine = this.slips.filter((s) => s.owner === k && s.state === 'ground');
    const near = (s) => dist(s, k) < SAFE_R + 3;
    switch (k.state) {
      case 'line':
        if (this.moveTo(k, k.homeX, LINE_SPOT, RUN * 0.6, dt)) k.dir = 3;
        if (k.slippers > 0 && up && t?.state === 'guard') {
          if ((k.throwT -= dt) <= 0) {
            const a = Math.atan2(c.y - (k.y - 6), c.x - k.x) + this.gauss() * 0.06;
            const d = clamp(Math.hypot(c.x - k.x, c.y - (k.y - 6)) + this.gauss() * 20 - 2, MIN_D, MAX_D);
            this.throwSlipper(k, a, d);
            k.throwT = 1.8 + this.rng() * 2.6;
          }
        } else if (k.slippers === 0 && mine.length) {
          const safeFar = mine.some((s) => dist(s, c) > GUARD_R + 8);
          if (!up || safeFar || (k.waitT += dt) > 5 + this.rng() * 3) { k.state = 'fetch'; k.waitT = 0; }
        }
        break;
      case 'fetch': {
        const s = mine.sort((a, b) => dist(a, k) - dist(b, k))[0];
        if (!s) { k.state = 'back'; break; }
        if (this.moveTo(k, s.x, s.y, RUN * 0.85, dt) || near(s)) { k.state = 'onslip'; k.waitT = 0; }
        break;
      }
      case 'onslip': {
        const calm = !up || (t && t.state !== 'chase' && dist(t, k) > 76);
        if (calm || (k.waitT += dt) > 6) {
          this.pickUp(k);
          const more = this.slips.some((s) => s.owner === k && s.state === 'ground');
          k.state = more && !up ? 'fetch' : 'back';
        }
        break;
      }
      case 'back':
        if (this.moveTo(k, k.homeX, LINE_SPOT, RUN * 0.85, dt)) k.state = 'line';
        break;
      default: k.state = 'line';
    }
  }
  gauss() { const u = this.rng() || 1e-9, v = this.rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  // ---- things that fly
  updateSlips(dt) {
    const c = this.can;
    for (const s of this.slips) {
      if (s.state === 'ground') continue;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.x < FIELD.x0 || s.x > FIELD.x1) { s.vx *= -0.3; s.x = clamp(s.x, FIELD.x0, FIELD.x1); }
      if (s.y < FIELD.y0) { s.vy *= -0.3; s.y = FIELD.y0; }
      if (s.state === 'fly') {
        s.t += dt;
        const u = Math.min(1, s.t / s.T);
        s.z = 8 * (1 - u) + 4 * s.h * u * (1 - u);
        if (u >= 1) { s.state = 'skid'; s.z = 0; s.skid = 0.2; this.emit({ type: 'land', x: s.x, y: s.y }); }
      } else if (s.state === 'skid') {
        s.vx *= Math.max(0, 1 - dt * 9); s.vy *= Math.max(0, 1 - dt * 9);
        if ((s.skid -= dt) <= 0) s.state = 'ground';
      }
      const low = s.state === 'skid' || (s.state === 'fly' && s.t / s.T > 0.68);
      if (low && !s.hit && c.state === 'up' && Math.hypot(s.x - c.x, s.y - c.y) < HIT_R) this.knock(s);
    }
    if (c.state === 'fly') {
      c.x += c.vx * dt; c.y += c.vy * dt; c.spin += dt * 14;
      c.z += c.vz * dt; c.vz -= 330 * dt;
      if (c.x < FIELD.x0 + 3 || c.x > FIELD.x1 - 3) { c.vx *= -0.5; c.x = clamp(c.x, FIELD.x0 + 3, FIELD.x1 - 3); }
      if (c.y < FIELD.y0 + 3 || c.y > LINE_Y - 10) { c.vy *= -0.5; c.y = clamp(c.y, FIELD.y0 + 3, LINE_Y - 10); }
      if (c.z <= 0) {
        c.z = 0;
        if (c.vz < -40) { c.vz = -c.vz * 0.35; c.vx *= 0.6; c.vy *= 0.6; this.emit({ type: 'clank', x: c.x, y: c.y }); }
        else {
          c.vz = 0; c.vx *= Math.max(0, 1 - dt * 4); c.vy *= Math.max(0, 1 - dt * 4);
          if (Math.hypot(c.vx, c.vy) < 5) { c.state = 'down'; c.vx = c.vy = 0; }
        }
      }
    }
  }

  update(dt, inp) {
    if (this.status !== 'play') return;
    this.time += dt;
    for (const k of this.kids) { if (k.say && (k.say.t -= dt) <= 0) k.say = null; if (k.poseT > 0 && (k.poseT -= dt) <= 0) k.pose = null; }
    if (this.introT > 0) { if ((this.introT -= dt) <= 0) this.emit({ type: 'go' }); return; }
    if (this.beat) { if ((this.beat.t -= dt) <= 0) this.endBeat(); return; }
    this.updateJun(dt, inp);
    for (const k of this.kids) {
      if (k === this.jun) continue;
      if (k.role === 'taya') this.updateTaya(k, dt); else this.updateFriend(k, dt);
      if (this.beat) break;
    }
    if (!this.beat) this.updateSlips(dt);
    this.checkMissions();
  }

  devClear() { this.jun.score = WIN; this.finish(); }
}
