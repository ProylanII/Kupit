// Level simulation. DOM-free: renderer reads state + events, tests drive it directly.
import { TileMap, TILE } from '../world/tilemap.js';
import { Player } from '../entities/player.js';
import { Adult } from '../entities/adult.js';
import { Target } from '../entities/target.js';
import { computeMods } from './progression.js';

export const REACH = 18;          // interact distance (px)
const THROW_SPEED = 140, THROW_MAX = 72;
const DEVICE_PULSE = 1.5;
const SMELL = 140;                // dogs smell food from this far

const at = (p) => ({ x: p[0] * TILE + TILE / 2, y: p[1] * TILE + TILE / 2, tx: p[0], ty: p[1] });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class World {
  // loadout: { char, upgrades } from the save; defaults = Jun with no upgrades
  constructor(level, loadout = {}) {
    this.level = level;
    this.mods = computeMods(loadout.char, loadout.upgrades);
    this.map = new TileMap(level.tiles);
    this.player = new Player(level.spawn[0], level.spawn[1], this.mods);
    this.player.items = Array(this.mods.startItems).fill('tsinelas');
    this.abilityCd = 0;
    this.adults = level.adults.map((d) => new Adult(d, this.map));
    this.targets = level.targets.map((t) => new Target(t));
    this.exit = at(level.exit);
    this.items = (level.items || []).map((i) => ({ ...at(i.at), kind: i.kind, color: i.color, noPickT: 0 }));
    this.hides = (level.hide || []).map((h) => ({ ...at(h.at), kind: h.kind || 'box' }));
    this.devices = (level.devices || []).map((d) => ({ ...at(d.at), kind: d.kind || 'tv', dur: d.dur ?? 8, r: d.r ?? 110, on: false, t: 0, pulse: 0 }));
    this.traps = (level.traps || []).map((t) => ({ ...at(t.at), kind: t.kind }));
    this.switches = (level.switches || []).map((s) => ({ ...at(s.at), gates: s.gates, time: s.time || 0, timer: 0, on: false }));
    this.locks = new Map((level.locks || []).map((l) => [l.at.join(), l.key]));
    this.projectiles = [];
    this.hostiles = []; // things thrown at the player (sandok)
    this.phase = 0;     // boss phases triggered so far
    this.foods = [];
    this.events = [];
    this.noises = [];
    this.coins = 0;
    this.time = 0;
    this.maxAlert = 0;
    this.status = 'play'; // play | caught | clear
    this.reason = null;   // 'seen' | 'time'
    this.catcher = null;
    this.result = null;
    this.prompt = null;
    this.say = null;      // player speech bubble
    this.lastTile = this.player.tx + ',' + this.player.ty;
    this.runRingT = 0;
  }

  get patience() { return this.level.patience ? this.level.patience + this.mods.patienceBonus : 0; }
  get bossPhases() { return this.level.boss?.phases || []; }
  get open() { return this.coins >= this.level.quota; }
  emit(e) { this.events.push(e); }
  noise(n) { this.noises.push(n); this.emit({ type: 'ring', x: n.x, y: n.y, r: n.r, lure: !!n.lure }); }
  talk(text, t = 1.2) { this.say = { text, t }; }

  // ---- callbacks used by adults ----
  openDoor(tx, ty) {
    if (this.map.ch(tx, ty) !== 'D') return;
    this.map.set(tx, ty, 'd');
    this.emit({ type: 'door', x: tx * TILE + 8, y: ty * TILE + 8 });
  }
  arrived(adult) {
    for (const d of this.devices) {
      if (d.on && dist(d, adult) < 24) { d.on = false; adult.talk('SINO NAGBUKAS?', 1.6); this.emit({ type: 'deviceOff' }); }
    }
  }
  eatFood(food) {
    const i = this.foods.indexOf(food);
    if (i < 0) return false;
    this.foods.splice(i, 1);
    return true;
  }

  // ---- what the action button would do right now ----
  context() {
    const p = this.player;
    if (p.hidden) return { kind: 'unhide', label: 'LABAS' };
    const near = (list, f = () => true) => {
      let best = null, bd = REACH;
      for (const o of list) { const d = dist(o, p); if (d <= bd && f(o)) { best = o; bd = d; } }
      return best;
    };
    let o = near(this.targets, (t) => !t.done);
    if (o) return { kind: 'steal', obj: o, label: 'KUPIT' };
    o = near(this.hides);
    if (o) return { kind: 'hide', obj: o, label: 'TAGO' };
    const doors = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const tx = p.tx + dx, ty = p.ty + dy, c = this.map.ch(tx, ty);
      if (c === 'D' || c === 'd') doors.push({ ...at([tx, ty]), c });
    }
    o = near(doors, (d) => d.c === 'D' || !this.occupied(d.tx, d.ty));
    if (o) {
      const lock = this.locks.get(o.tx + ',' + o.ty);
      if (o.c === 'd') return { kind: 'door', obj: o, label: 'SARA' };
      if (lock && !p.keys.has(lock)) return { kind: 'locked', obj: o, label: 'LOCKED' };
      return { kind: 'door', obj: o, label: 'BUKAS' };
    }
    o = near(this.switches);
    if (o) return { kind: 'switch', obj: o, label: 'PINDOT' };
    o = near(this.devices, (d) => !d.on);
    if (o) return { kind: 'device', obj: o, label: 'BUKSAN' };
    return null;
  }

  occupied(tx, ty) {
    const inTile = (e) => Math.floor(e.x / TILE) === tx && Math.floor(e.y / TILE) === ty;
    if (Math.abs(this.player.x - (tx * TILE + 8)) < 13 && Math.abs(this.player.y - (ty * TILE + 8)) < 13) return true;
    return this.adults.some(inTile);
  }

  interact(c) {
    const p = this.player;
    switch (c.kind) {
      case 'unhide':
        p.hidden = null;
        p.hideT = 0;
        for (const a of this.adults) a.sawHide = false;
        this.emit({ type: 'unhide' });
        break;
      case 'hide': {
        // anyone looking right now knows where you went
        for (const a of this.adults) if (a.awake && a.canSee(p)) a.sawHide = true;
        p.hidden = c.obj;
        p.hideT = 0;
        p.x = c.obj.x; p.y = c.obj.y;
        this.emit({ type: 'hide' });
        break;
      }
      case 'door': {
        const { tx, ty } = c.obj;
        const key = tx + ',' + ty;
        if (this.map.ch(tx, ty) === 'd') { this.map.set(tx, ty, 'D'); this.emit({ type: 'door', x: c.obj.x, y: c.obj.y }); break; }
        if (this.locks.has(key)) { this.locks.delete(key); this.emit({ type: 'unlock' }); }
        this.map.set(tx, ty, 'd');
        this.noise({ x: c.obj.x, y: c.obj.y, r: 32 });
        this.emit({ type: 'door', x: c.obj.x, y: c.obj.y });
        break;
      }
      case 'locked':
        this.talk('NAKA-LOCK!');
        this.emit({ type: 'locked' });
        break;
      case 'switch': this.toggleSwitch(c.obj, true); break;
      case 'device':
        c.obj.on = true; c.obj.t = 0; c.obj.pulse = 0;
        this.emit({ type: 'device' });
        break;
    }
  }

  // Character skill (button / F key). Returns true if it fired and starts the cooldown.
  useAbility() {
    const p = this.player, sk = this.mods.skill;
    if (this.status !== 'play' || this.abilityCd > 0 || p.stunT > 0) return false;
    switch (sk.id) {
      case 'dash':
        if (p.hidden) return false;
        p.dashT = 0.7;
        break;
      case 'hide':
        if (p.hidden) return false;
        this.interact({ kind: 'hide', obj: { x: p.x, y: p.y, kind: 'pocket' } });
        p.hideT = 3;
        break;
      case 'shout': {
        if (p.hidden) return false;
        const [fx, fy] = p.facing(), m = Math.hypot(fx, fy) || 1;
        let d = 56;
        while (d > 12 && this.map.isSolidAt(p.x + (fx / m) * d, p.y + (fy / m) * d)) d -= 8;
        this.noise({ x: p.x + (fx / m) * d, y: p.y + (fy / m) * d, r: 90, lure: true });
        this.talk('HOY!');
        break;
      }
      case 'charm': {
        let n = 0;
        for (const a of this.adults) {
          if (a.alert > 0.05 || a.state === 'chase' || (a.awake && a.canSee(p))) { a.freezeT = 3; a.talk('AWW!', 3); n++; }
        }
        if (!n) return false;
        break;
      }
      default: return false;
    }
    this.abilityCd = sk.cd;
    this.emit({ type: 'ability' });
    return true;
  }

  // A boss phase fires when enough coins are collected: retune/spawn adults, move gates, banner.
  applyPhase(ph) {
    for (const m of [].concat(ph.adult || [])) this.adults[m.index]?.retune(m);
    for (const d of ph.spawn || []) this.adults.push(new Adult(d, this.map));
    for (const [x, y] of ph.open || []) if (this.map.ch(x, y) === 'G') this.map.set(x, y, 'g');
    for (const [x, y] of ph.close || []) if (this.map.ch(x, y) === 'g' && !this.occupied(x, y)) this.map.set(x, y, 'G');
    this.emit({ type: 'phase', text: ph.banner || '', n: this.phase });
  }

  // Adult throws a sandok at the player's current position.
  throwAt(adult, target) {
    const dx = target.x - adult.x, dy = target.y - adult.y, m = Math.hypot(dx, dy) || 1;
    this.hostiles.push({ kind: 'sandok', x: adult.x, y: adult.y - 2, vx: (dx / m) * 110, vy: (dy / m) * 110, d: 0, max: adult.cfg.ranged.range + 14 });
    adult.talk('SANDOK!', 1);
    this.emit({ type: 'throw' });
  }

  toggleSwitch(s, byPlayer) {
    s.on = !s.on;
    s.timer = s.on && s.time ? s.time : 0;
    for (const [tx, ty] of s.gates) {
      const c = this.map.ch(tx, ty);
      if (c === 'g' && !this.occupied(tx, ty)) this.map.set(tx, ty, 'G');
      else if (c === 'G') this.map.set(tx, ty, 'g');
    }
    this.emit({ type: 'switch', byPlayer });
  }

  throwItem() {
    const p = this.player;
    const kind = p.items.pop();
    const [fx, fy] = p.facing();
    const m = Math.hypot(fx, fy) || 1;
    this.projectiles.push({ kind, x: p.x, y: p.y - 2, vx: (fx / m) * THROW_SPEED, vy: (fy / m) * THROW_SPEED, d: 0 });
    this.emit({ type: 'throw' });
  }

  land(pr) {
    if (pr.kind === 'pandesal') {
      const food = { x: pr.x, y: pr.y };
      this.foods.push(food);
      for (const a of this.adults) if (a.cfg.dog && dist(a, food) < SMELL) a.smellFood(food);
    } else {
      this.noise({ x: pr.x, y: pr.y, r: 90, lure: true });
      this.items.push({ x: pr.x, y: pr.y, kind: pr.kind, noPickT: 1 });
      this.emit({ type: 'land', x: pr.x, y: pr.y });
    }
  }

  // input: {mv, action, actionPressed, throwPressed}
  update(dt, input) {
    if (this.status !== 'play') return;
    const p = this.player, map = this.map;
    this.time += dt;
    this.abilityCd = Math.max(0, this.abilityCd - dt);
    if (p.hidden && p.hideT > 0 && (p.hideT -= dt) <= 0) this.interact({ kind: 'unhide' });
    this.noises = [];
    if (this.say && (this.say.t -= dt) <= 0) this.say = null;

    // --- actions
    let ctx = this.context();
    if (p.hidden && input.mv.mag > 0.6) { this.interact({ kind: 'unhide' }); ctx = this.context(); }
    else if (input.actionPressed && ctx && ctx.kind !== 'steal') { this.interact(ctx); ctx = this.context(); }
    this.prompt = ctx;
    const stealing = !p.hidden && input.action && ctx?.kind === 'steal';
    if (input.throwPressed && p.items.length && !p.hidden) this.throwItem();
    if (input.abilityPressed) this.useAbility();

    // --- player move
    const n = p.update(dt, map, input.mv, stealing || !!p.hidden);
    if (n) {
      this.noises.push(n);
      if ((this.runRingT -= dt) <= 0) { this.emit({ type: 'ring', x: n.x, y: n.y, r: n.r, lure: false }); this.runRingT = 0.35; }
    }

    // --- stealing
    for (const t of this.targets) {
      if (stealing && t === ctx.obj) {
        t.progress += dt / (t.time * this.mods.stealTime);
        this.emit({ type: 'stealTick' });
        if (t.progress >= 1) {
          t.done = true; t.progress = 1; this.coins += t.coins;
          this.emit({ type: 'coin', x: t.x, y: t.y, n: t.coins });
        }
      } else if (!t.done) t.progress = Math.max(0, t.progress - dt * 0.8);
    }

    // --- pickups
    for (const it of this.items) it.noPickT = Math.max(0, it.noPickT - dt);
    this.items = this.items.filter((it) => {
      if (p.hidden || it.noPickT > 0 || dist(it, p) > 9) return true;
      if (it.kind === 'key') { p.keys.add(it.color); this.talk('MAY SUSI!'); this.emit({ type: 'pickup' }); return false; }
      if (p.items.length >= this.mods.itemCap) return true;
      p.items.push(it.kind); this.emit({ type: 'pickup' });
      return false;
    });

    // --- traps (trigger on entering a tile)
    const tk = p.tx + ',' + p.ty;
    if (tk !== this.lastTile) {
      this.lastTile = tk;
      const tr = this.traps.find((t) => t.tx === p.tx && t.ty === p.ty);
      if (tr?.kind === 'creak') { this.noise({ x: p.x, y: p.y, r: 64, lure: true }); this.talk('KREEK...'); this.emit({ type: 'creak' }); }
      if (tr?.kind === 'lego') { this.noise({ x: p.x, y: p.y, r: 80, lure: true }); p.stunT = 0.8; this.talk('ARAY!'); this.emit({ type: 'ouch' }); }
    }

    // --- hostile projectiles (sandok)
    for (const h of this.hostiles) {
      const nx = h.x + h.vx * dt, ny = h.y + h.vy * dt;
      h.d += Math.hypot(h.vx, h.vy) * dt;
      if (!p.hidden && Math.hypot(nx - p.x, ny - p.y) < 6) {
        h.done = true; p.stunT = 1.3; this.talk('ARAY!');
        this.noise({ x: p.x, y: p.y, r: 70, lure: true });
        this.emit({ type: 'ouch' });
      } else if (map.isSolidAt(nx, ny) || h.d >= h.max) { h.done = true; this.emit({ type: 'land', x: h.x, y: h.y }); } else { h.x = nx; h.y = ny; }
    }
    this.hostiles = this.hostiles.filter((h) => !h.done);

    // --- projectiles
    for (const pr of this.projectiles) {
      const nx = pr.x + pr.vx * dt, ny = pr.y + pr.vy * dt;
      pr.d += Math.hypot(pr.vx, pr.vy) * dt;
      if (map.isSolidAt(nx, ny) || pr.d >= THROW_MAX * this.mods.throwRange) { pr.done = true; this.land(pr); } else { pr.x = nx; pr.y = ny; }
    }
    this.projectiles = this.projectiles.filter((pr) => !pr.done);

    // --- devices + timed switches
    for (const d of this.devices) {
      if (!d.on) continue;
      d.t += dt;
      if ((d.pulse -= dt) <= 0) { this.noise({ x: d.x, y: d.y, r: d.r, lure: true }); d.pulse = DEVICE_PULSE; }
      if (d.t >= d.dur) d.on = false;
    }
    for (const s of this.switches) if (s.timer > 0 && (s.timer -= dt) <= 0) this.toggleSwitch(s, false);

    // --- adults
    for (const a of this.adults) {
      a.update(dt, this);
      this.maxAlert = Math.max(this.maxAlert, a.alert);
      if (a.caught && this.status === 'play') { this.status = 'caught'; this.reason = 'seen'; this.catcher = a; this.emit({ type: 'caught' }); }
    }
    for (const nz of this.noises) {
      for (const a of this.adults) if (a !== nz.from && dist(a, nz) < nz.r) a.hear(nz);
    }
    // --- boss phases
    while (this.bossPhases[this.phase] && this.coins >= this.bossPhases[this.phase].at) this.applyPhase(this.bossPhases[this.phase++]);
    if (this.status !== 'play') return;

    if (this.patience && this.time >= this.patience) {
      this.status = 'caught'; this.reason = 'time';
      this.catcher = this.adults.find((a) => a.type === 'mama') || this.adults[0];
      this.emit({ type: 'caught' });
      return;
    }

    if (this.open && !p.hidden && dist(p, this.exit) < 10) {
      this.status = 'clear';
      const fast = this.time <= this.level.par, stealth = this.maxAlert < 0.3;
      this.result = { coins: this.coins, time: this.time, stars: 1 + fast + stealth, fast, stealth };
      this.emit({ type: 'clear' });
    }
  }
}
