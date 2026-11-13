// Level simulation. DOM-free: renderer reads state + events, tests drive it directly.
// Runs at a fixed 60 Hz step (see main.js), so speeds, timers and the Daily House are the same on every screen.
import { TileMap, TILE } from '../world/tilemap.js';
import { Player } from '../entities/player.js';
import { Adult } from '../entities/adult.js';
import { Target } from '../entities/target.js';
import { computeMods } from './progression.js';
import { soundField, heardDistance } from '../world/sound.js';
import { mulberry32, hashStr } from '../core/rng.js';
import { MISSIONS, missionIds } from './missions.js';

export const REACH = 18;          // interact distance (px)
export const THROW_SPEED = 140, THROW_MAX = 72;
const DEVICE_PULSE = 1.5;
const SMELL = 140;                // dogs smell food from this far
const PROGRESS_DECAY = 0.12;      // an interrupted kupit keeps most of its progress for a while
export const EMPTY_NOISE = 44;    // taking a stash's last coin: the hollow "klak" of an empty purse
export const clinkR = (k) => 20 + 8 * k; // the k-th extra coin in one visit (k >= 1): louder each time
export const MARBLE_ROLL = 200, MARBLE_TICK = 16, MARBLE_R = 46; // HOLEN: how far it rolls, how often it ticks, how loud
export const SCOLD_TIME = 1.8;    // the "caught!" beat before you respawn
export const GRACE_TIME = 2;      // after respawning, nobody can see you for this long
export const CATCH_PENALTY = 1 / 3; // share of your coins Mama takes back each time you're caught
export const STEALTH_ALERT = 0.3;   // the SILENT star is lost once any adult's suspicion meter reaches this (or you're caught)
export const SPAWN_GRACE = 1.2;     // an adult who joins mid-level (boss phase) stands blind for a moment: never spawned onto you
export const BLEND_R = 20;          // walk (don't run) this close to a party guest and you are one more kid in the crowd

const at = (p) => ({ x: p[0] * TILE + TILE / 2, y: p[1] * TILE + TILE / 2, tx: p[0], ty: p[1] });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// Horizontal runs of hanging laundry ('L'), top of the map first: the order the washing is taken in.
function laundryRuns(map) {
  const runs = [];
  for (let y = 0; y < map.h; y++) {
    let run = null;
    for (let x = 0; x <= map.w; x++) {
      if (map.ch(x, y) === 'L') (run ||= []).push([x, y]);
      else if (run) { runs.push(run); run = null; }
    }
  }
  return runs;
}

// Action-button priority when several things are in reach (first match wins):
//   come out of hiding > kupit > hide > door > switch > device. Within a kind, the nearest one wins.
export const ACT_PRIORITY = ['unhide', 'steal', 'hide', 'door', 'switch', 'device'];

export class World {
  // loadout: { char, upgrades } from the save; defaults = Jun with no upgrades.
  //   lives: catches allowed before the level is lost (1 = classic, the game uses 3)
  //   alkansyaFound: this level's secret alkansya was already emptied on an earlier run
  constructor(level, loadout = {}) {
    this.level = level;
    this.mods = computeMods(loadout.char, loadout.upgrades);
    this.map = new TileMap(level.tiles);
    this.rng = mulberry32(level.seed ?? hashStr(level.id || 'level')); // gameplay randomness, separate from generation
    this.noThrow = !!level.noThrow;
    this.player = new Player(level.spawn[0], level.spawn[1], this.mods);
    this.player.items = this.noThrow ? [] : this.mods.startItems.slice(); // gear: BAON, HOLEN
    this.panyo = this.mods.panyo; // PANYO: stash openings it can still muffle this level
    this.palusot = this.mods.palusot; // PALUSOT: close calls Kuya Ramil can still talk away this level
    this.rollers = [];            // HOLEN: marbles rolling across the floor
    // KASABWAT (tag-team levels: "team": ["bing", "ramil"], "spawn2"): two kids, one controlled at a time. The other
    // stays where you left them (safe only if hidden), a catch of either uses the shared chances, coins are pooled,
    // and the exit needs both: the first one through waits outside while you bring the other.
    this.kids = null;
    if (level.team) {
      const sp = [level.spawn, level.spawn2 || level.spawn];
      this.kidMods = level.team.map((id) => computeMods(id, loadout.upgrades));
      this.kids = this.kidMods.map((m, i) => {
        const k = new Player(sp[i][0], sp[i][1], m);
        k.items = this.noThrow ? [] : m.startItems.slice();
        k.look = m.look;
        return k;
      });
      this.player = this.kids[0]; this.mods = this.kidMods[0];
      this.palusot = this.kidMods.reduce((n, m) => n + m.palusot, 0); // Kuya Ramil's excuse covers the team
      this.panyo = this.kidMods.reduce((n, m) => Math.max(n, m.panyo), 0);
      this.swapT = 0;
    }
    // Laundry taken in over time ("laundryDown": { "every": 25 }): one line of washing at a time, top first.
    this.laundryRuns = level.laundryDown ? laundryRuns(this.map) : [];
    this.laundryT = level.laundryDown?.every || 0;
    this.abilityCd = 0;
    this.god = false; // dev mode: nobody can catch you
    this.lives = Math.max(1, loadout.lives ?? 1);
    this.catches = 0;
    this.scold = null;  // { t, who, lost } while the "caught!" beat plays
    this.checkpoints = [{ x: this.player.x, y: this.player.y, hide: null }];
    this.stolen = [];   // [{ t, n }] coins taken, newest last (caught -> some go back)
    this.locks = new Map((level.locks || []).map((l) => [l.at.join(), l.key]));
    this.pendingGates = new Map(); // gates that should close but someone is standing in them ("x,y" -> [x, y])
    this.adults = []; // filled in place: every adult keeps a reference to this list (guests in it block sight)
    for (const d of level.adults) this.adults.push(this.makeAdult(d));
    this.targets = level.targets.map((t) => new Target(t));
    this.alkansya = null;
    if (level.alkansya && !loadout.alkansyaFound) {
      this.alkansya = new Target({ kind: 'alkansya', at: level.alkansya.at, coins: level.alkansya.coins ?? 5, time: level.alkansya.time ?? 2, bonus: true });
      this.targets.push(this.alkansya);
    }
    this.bonus = 0;     // alkansya coins (go straight to the bank)
    this.exit = at(level.exit);
    this.items = (level.items || []).filter((i) => !this.noThrow || i.kind === 'key').map((i) => ({ ...at(i.at), kind: i.kind, color: i.color, noPickT: 0 }));
    this.hides = (level.hide || []).map((h) => ({ ...at(h.at), kind: h.kind || 'box' }));
    this.devices = (level.devices || []).filter((d) => d.kind !== 'videoke').map((d) => ({ ...at(d.at), kind: d.kind || 'tv', dur: d.dur ?? 8, r: d.r ?? 110, on: false, t: 0, pulse: 0 }));
    // Videoke: it plays by itself, a song then a break. While someone is singing, nothing you do near it can be heard.
    this.videokes = (level.devices || []).filter((d) => d.kind === 'videoke').map((d) => ({ ...at(d.at), kind: 'videoke', r: d.r ?? 76, on: d.on ?? 9, off: d.off ?? 6, t: d.phase ?? 0, singing: false }));
    this.cover = null;  // what is drowning out your noise right now: 'thunder' | 'videoke' | null
    this.stats = { throws: 0, hides: 0, runT: 0, loudRunT: 0, skills: 0, traps: 0, barks: 0, devices: 0, spills: 0, tattles: 0, palusot: 0 }; // for the missions (and HINALA)
    this.alkansyaWasFound = !!loadout.alkansyaFound;
    this.missionIds = missionIds(level);
    this.missionLost = this.missionIds.map(() => false); // strict missions already failed this run
    this.traps = (level.traps || []).map((t) => ({ ...at(t.at), kind: t.kind }));
    this.switches = (level.switches || []).map((s) => ({ ...at(s.at), gates: s.gates, time: s.time || 0, timer: 0, on: false }));
    this.projectiles = [];
    this.hostiles = []; // things thrown at the player (sandok)
    this.phase = 0;     // boss phases triggered so far (never goes back down)
    this.escapeT = 0;   // final boss phase: seconds left to reach the exit
    this.trail = [];    // player scent trail (tracker dogs follow it)
    this.trailT = 0;
    this.foods = [];
    this.events = [];
    this.noises = [];
    this.field = null;  // scratch buffer for sound propagation
    this.coins = 0;
    this.time = 0;
    this.maxAlert = 0;
    this.spotted = 0;   // how many times someone started a chase (for the share card)
    this.status = 'play'; // play | caught | clear
    this.reason = null;   // 'seen' | 'time' | 'escape'
    this.catcher = null;
    this.result = null;
    this.prompt = null;
    this.say = null;      // player speech bubble
    this.aim = null;      // throw preview while the throw button is held
    this.lastTile = this.player.tx + ',' + this.player.ty;
    this.runRingT = 0;
  }

  makeAdult(d) {
    // HINGI (the epilogue): nobody is watching for you any more, they are just family in their house
    if (this.level.hingi) d = { ...d, cfg: { ...d.cfg, harmless: true, cover: false } };
    const a = new Adult(d, this.map, this.locks);
    a.covers = this.adults; // guests and vehicles in this list block sight
    return a;
  }

  get patience() { return this.level.patience ? this.level.patience + this.mods.patienceBonus : 0; }
  get bossPhases() { return this.level.boss?.phases || []; }
  // a boss's last phase has fired (no excuses work any more)
  get finalPhase() { return !!this.level.boss && this.phase >= this.bossPhases.length && this.bossPhases.length > 0; }
  get open() { return this.coins >= this.level.quota && !this.missing; }
  // a must-have (the milk) that is not in your hands yet
  get missing() { return this.targets.find((t) => t.must && !t.done) || null; }
  get livesLeft() { return this.lives - this.catches; }
  emit(e) { if (e.type === 'bark') this.stats.barks++; else if (e.type === 'tattle') this.stats.tattles++; this.events.push(e); }
  // Is a sound made at (x, y) drowned out? Thunder covers the whole map, a videoke only what is near it.
  masked(x, y) {
    if (this.thunder) return 'thunder';
    for (const v of this.videokes) if (v.singing && Math.hypot(v.x - x, v.y - y) < v.r) return 'videoke';
    return null;
  }
  // Mission state right now: [{ id, ok, lost }]. ok is final only when the level is cleared.
  missionState() { return this.missionIds.map((id, i) => ({ id, ok: !this.missionLost[i] && MISSIONS[id].ok(this), lost: this.missionLost[i] })); }
  noise(n) { this.noises.push(n); this.emit({ type: 'ring', x: n.x, y: n.y, r: n.r, lure: !!n.lure, tattle: !!n.tattle }); }
  talk(text, t = 1.2) { this.say = { text, t }; }

  // ---- callbacks used by adults ----
  openDoor(tx, ty) {
    if (this.map.ch(tx, ty) !== 'D' || this.locks.has(tx + ',' + ty)) return; // adults have no keys
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

  // ---- what the action button would do right now (see ACT_PRIORITY) ----
  context() {
    const p = this.player;
    if (p.hidden) return { kind: 'unhide', label: 'LABAS' };
    const near = (list, f = () => true) => {
      let best = null, bd = REACH;
      for (const o of list) { const d = dist(o, p); if (d <= bd && f(o)) { best = o; bd = d; } }
      return best;
    };
    let o = near(this.targets, (t) => !t.done);
    if (o) return { kind: 'steal', obj: o, label: o.profile.verb || 'KUPIT', detail: o.profile.tip };
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
      if (lock && !p.keys.has(lock)) return { kind: 'locked', obj: o, label: 'LOCKED', lock };
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

  // The SILENT star, precisely: no adult's suspicion meter ever reached STEALTH_ALERT (a '?' shows from 0.12, so a
  // glance is fine; '!' at 0.6 and a dog's bark at 0.55 are not) and you were never caught.
  get stealthOk() { return this.maxAlert < STEALTH_ALERT && this.catches === 0; }

  // Nobody is chasing or about to: a safe moment to remember where you are.
  get calm() { return !this.adults.some((a) => a.state === 'chase' || a.alert >= 0.6); }

  addCheckpoint(x, y, hide = null) {
    const cps = this.checkpoints;
    const last = cps[cps.length - 1];
    if (last && Math.hypot(last.x - x, last.y - y) < 8) { last.hide = hide; return; }
    cps.push({ x, y, hide });
    if (cps.length > 8) cps.splice(1, 1); // the spawn always stays as the fallback
    this.emit({ type: 'checkpoint', x, y });
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
        let seen = false;
        for (const a of this.adults) if (a.awake && a.canSee(p)) { a.sawHide = true; seen = true; }
        p.hidden = c.obj;
        p.hideT = 0;
        p.x = c.obj.x; p.y = c.obj.y;
        if (this.hides.includes(c.obj)) this.stats.hides++;
        if (seen) this.talk('NAKITA AKO!', 1.4);
        else if (this.calm && this.hides.includes(c.obj)) this.addCheckpoint(c.obj.x, c.obj.y, c.obj);
        this.emit({ type: 'hide', seen });
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
        this.stats.devices++;
        this.emit({ type: 'device' });
        break;
    }
  }

  // Character skill (button / F key). Returns true if it fired and starts the cooldown.
  useAbility() {
    const p = this.player, sk = this.mods.skill;
    if (this.status !== 'play' || this.scold || this.abilityCd > 0 || p.stunT > 0) return false;
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
          if (a.cfg.harmless) continue;
          if (a.alert > 0.05 || a.state === 'chase' || (a.awake && a.canSee(p))) { a.freezeT = 3; a.talk('AWW!', 3); n++; }
        }
        if (!n) return false;
        break;
      }
      default: return false;
    }
    this.abilityCd = sk.cd;
    this.stats.skills++;
    this.emit({ type: 'ability' });
    return true;
  }

  // A boss phase fires when enough coins are collected: retune/spawn adults, move gates, banner.
  applyPhase(ph) {
    for (const m of [].concat(ph.adult || [])) this.adults[m.index]?.retune(m);
    for (const d of ph.spawn || []) { const a = this.makeAdult(d); a.freezeT = SPAWN_GRACE; this.adults.push(a); }
    for (const [x, y] of ph.open || []) { this.pendingGates.delete(x + ',' + y); if (this.map.ch(x, y) === 'G') this.map.set(x, y, 'g'); }
    for (const [x, y] of ph.close || []) this.closeGate(x, y);
    if (ph.escape) this.escapeT = ph.escape;
    this.emit({ type: 'phase', text: ph.banner || '', n: this.phase });
  }

  // Adult throws a sandok at the player's current position.
  throwAt(adult, target) {
    const dx = target.x - adult.x, dy = target.y - adult.y, m = Math.hypot(dx, dy) || 1;
    this.hostiles.push({ kind: 'sandok', x: adult.x, y: adult.y - 2, vx: (dx / m) * 110, vy: (dy / m) * 110, d: 0, max: adult.cfg.ranged.range + 14 });
    adult.talk('SANDOK!', 1);
    this.emit({ type: 'throw' });
  }

  // Close a gate now, or as soon as nobody is standing in it (a gate never shuts on someone).
  closeGate(tx, ty) {
    if (this.map.ch(tx, ty) !== 'g') return;
    if (this.occupied(tx, ty)) this.pendingGates.set(tx + ',' + ty, [tx, ty]);
    else this.map.set(tx, ty, 'G');
  }

  toggleSwitch(s, byPlayer) {
    s.on = !s.on;
    s.timer = s.on && s.time ? s.time : 0;
    for (const [tx, ty] of s.gates) {
      // A gate still waiting to close is logically shut: flipping it again means "open", which it already is.
      if (this.pendingGates.delete(tx + ',' + ty)) continue;
      const c = this.map.ch(tx, ty);
      if (c === 'g') this.closeGate(tx, ty);
      else if (c === 'G') this.map.set(tx, ty, 'g');
    }
    this.emit({ type: 'switch', byPlayer });
  }

  get throwMax() { return THROW_MAX * this.mods.throwRange; }

  // Where a throw would land right now: { x, y, max } (max = the range ring around the player).
  aimPreview() {
    const p = this.player;
    if (!p.items.length || p.hidden || this.noThrow) return null;
    const [fx, fy] = p.facing(), m = Math.hypot(fx, fy) || 1;
    const ux = fx / m, uy = fy / m, max = this.throwMax;
    let x = p.x, y = p.y - 2, d = 0;
    while (d < max) {
      const nx = x + ux * 2, ny = y + uy * 2;
      if (this.map.isSolidAt(nx, ny)) break;
      x = nx; y = ny; d += 2;
    }
    return { x, y, max, hitWall: d < max };
  }

  throwItem() {
    const p = this.player;
    const kind = p.items.pop();
    const [fx, fy] = p.facing();
    const m = Math.hypot(fx, fy) || 1;
    this.projectiles.push({ kind, x: p.x, y: p.y - 2, vx: (fx / m) * THROW_SPEED, vy: (fy / m) * THROW_SPEED, d: 0 });
    this.stats.throws++;
    this.emit({ type: 'throw' });
  }

  // Item selector: bring the next different kind of throwable to the top of the pile.
  cycleItem() {
    const it = this.player.items;
    if (new Set(it).size < 2) return false;
    const top = it[it.length - 1];
    while (it[it.length - 1] === top) it.unshift(it.pop());
    this.emit({ type: 'cycle', kind: it[it.length - 1] });
    return true;
  }

  land(pr) {
    if (pr.kind === 'holen') { // it keeps rolling the way it was thrown
      this.rollers.push({ x: pr.x, y: pr.y, vx: pr.vx * 0.6, vy: pr.vy * 0.6, d: 0, next: 0 });
      return;
    }
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

  // Deliver this frame's noises: each one floods through the rooms (walls stop it, closed doors muffle it).
  hearNoises(dt) {
    const map = this.map;
    for (const nz of this.noises) {
      if (!nz.tattle && !nz.from && this.masked(nz.x, nz.y)) continue; // thunder or a videoke chorus: nobody hears a thing you do
      let field = null;
      for (const a of this.adults) {
        if (a === nz.from || a.cfg.harmless) continue;
        // Tatay listens for his dog anywhere in the house
        const master = a.cfg.followsDog !== undefined && nz.from && nz.from === this.adults[a.cfg.followsDog] && nz.lure;
        if (master) {
          if (a.state !== 'chase') { a.hear(nz, 0, 0.3); if (a.state !== 'chase') a.talk('ASO? ANO YON?', 1.2); }
          continue;
        }
        const r = nz.r * (a.cfg.ears || 1);
        if (dist(a, nz) >= r) continue;
        if (!field) field = this.field = soundField(map, nz.x, nz.y, nz.r * 2, this.field);
        const d = heardDistance(field, map, nz, a.x, a.y) / (a.cfg.ears || 1);
        if (d >= nz.r) continue;
        // react a beat later the farther away the sound was (a crowd turns one by one, not all at once)
        const delay = nz.lure ? Math.min(0.35, d / (nz.tattle || nz.dogBark ? 500 : 900)) : 0;
        if (nz.cont) nz.dt = dt;
        a.hear(nz, d, delay);
      }
    }
  }

  // input: {mv, action, actionPressed, throwPressed, throwAim, cyclePressed, abilityPressed}
  update(dt, input) {
    if (this.status !== 'play') return;
    if (this.kids) { // KASABWAT: switch who you control (before anything else reads this.player this frame)
      if (this.swapT > 0) this.swapT -= dt;
      if (input.swapPressed) this.swap();
    }
    const p = this.player, map = this.map;
    this.time += dt; // par time keeps running through the "caught" beat
    // Storm: lightning flashes, and for a moment the thunder drowns out every sound you make.
    const st = this.level.storm;
    if (st) {
      const ph = this.time % st.every, was = this.thunder;
      if (ph < dt) this.emit({ type: 'lightning' });
      this.thunder = ph >= 0.5 && ph < 0.5 + st.dur;
      if (this.thunder && !was) this.emit({ type: 'thunder' });
    }
    for (const v of this.videokes) {
      const was = v.singing;
      v.t += dt;
      v.singing = v.t % (v.on + v.off) < v.on;
      if (v.singing && !was) this.emit({ type: 'videoke', x: v.x, y: v.y });
    }
    if (this.events.length > 512) this.events.length = 0; // nobody is reading them (headless runs)
    if (this.say && (this.say.t -= dt) <= 0) this.say = null;

    if (this.scold) { // the caught beat: everything holds still while you get told off
      for (const a of this.adults) if (a.say) a.say.t = Math.max(a.say.t, 0.1);
      if ((this.scold.t -= dt) <= 0) this.respawn();
      return;
    }

    this.abilityCd = Math.max(0, this.abilityCd - dt);
    p.graceT = Math.max(0, (p.graceT || 0) - dt);
    if (p.hidden && p.hideT > 0 && (p.hideT -= dt) <= 0) this.interact({ kind: 'unhide' });
    this.noises.length = 0;

    // --- actions
    let ctx = this.context();
    if (p.hidden && input.mv.mag > 0.6) { this.interact({ kind: 'unhide' }); ctx = this.context(); }
    else if (input.actionPressed && ctx && ctx.kind !== 'steal') { this.interact(ctx); ctx = this.context(); }
    this.prompt = ctx;
    const stealing = !p.hidden && input.action && ctx?.kind === 'steal';
    p.stealing = stealing; // drawn with the 'reach' pose
    if (input.cyclePressed) this.cycleItem();
    for (const k of this.kids || [p]) k.under = !!k.crawl && k.crawl.has(map.ch(k.tx, k.ty)); // MALIIT: Bing under a table or bed
    if (this.laundryRuns.length && (this.laundryT -= dt) <= 0) { // the washing comes in, line by line
      this.laundryT = this.level.laundryDown.every;
      const run = this.laundryRuns.shift();
      for (const [x, y] of run) map.set(x, y, this.level.laundryDown.floor || ';');
      const [mx, my] = run[run.length >> 1];
      this.emit({ type: 'laundry', x: mx * TILE + 8, y: my * TILE + 8, left: this.laundryRuns.length });
    }
    const canThrow = p.items.length && !p.hidden && !p.under && !stealing && p.stunT <= 0 && !this.noThrow;
    this.aim = input.throwAim && canThrow ? this.aimPreview() : null;
    if (input.throwPressed && canThrow) this.throwItem();
    if (input.abilityPressed) this.useAbility();

    // --- player move
    const n = p.update(dt, map, input.mv, stealing || !!p.hidden);
    // crowd blending: walking right beside a party guest, you are just another kid at the fiesta
    p.blend = !p.hidden && !p.running && !(p.dashT > 0) && this.adults.some((a) => a.cfg.cover && !a.cfg.vehicle && dist(a, p) < BLEND_R);
    this.cover = this.masked(p.x, p.y);
    if (p.running) { this.stats.runT += dt; if (!this.cover) this.stats.loudRunT += dt; }
    if (n) {
      n.cont = true; // running: a sound every frame, so its effect is per second
      this.noises.push(n);
      if ((this.runRingT -= dt) <= 0) { this.emit({ type: 'ring', x: n.x, y: n.y, r: n.r, lure: false }); this.runRingT = 0.35; }
    }

    // --- carrying the milk: run, dash or get knocked over and it spills (and goes back where it came from)
    if (p.carry && (p.running || p.dashT > 0 || p.stunT > 0)) this.spill();

    // --- scent trail
    if (!p.hidden && (this.trailT -= dt) <= 0) {
      this.trail.push({ x: p.x, y: p.y, t: this.time });
      if (this.trail.length > 40) this.trail.shift();
      this.trailT = 0.4;
    }

    // --- stealing: every stash sounds different (see TARGET_KINDS); a light sleeper nearby stirs as you rummage
    if (stealing) {
      for (const a of this.adults) {
        if (!a.cfg.lightSleeper || a.awake || dist(a, p) >= 56) continue;
        if (a.cfg.depth) a.depth -= dt * 0.06; else a.t += dt * 1.5;
        if (a.cfg.depth && a.depth <= 0) a.hear({ x: p.x, y: p.y, r: 60 }, 0);
      }
    }
    for (const t of this.targets) {
      if (stealing && t === ctx.obj) {
        const pf = t.profile;
        if (!t.started) {
          t.started = true; t.tickT = pf.tick ? pf.tick.every * 0.5 : 0;
          if (pf.start && !this.muffle(t)) { this.noise({ x: t.x, y: t.y, r: pf.start.r }); if (pf.start.say) this.talk(pf.start.say, 0.8); this.emit({ type: 'stealNoise', kind: t.kind }); }
        }
        if (pf.tick && (t.tickT -= dt) <= 0) { this.noise({ x: t.x, y: t.y, r: pf.tick.r }); t.tickT = pf.tick.every; this.emit({ type: 'stealNoise', kind: t.kind }); }
        if (t.perCoin) { this.stealCoin(t, dt); continue; }
        t.progress += dt / (t.time * this.mods.stealTime);
        this.emit({ type: 'stealTick' });
        if (t.progress >= 1) {
          t.done = true; t.progress = 1;
          if (pf.end) { this.noise({ x: t.x, y: t.y, r: pf.end.r }); if (pf.end.say) this.talk(pf.end.say, 0.8); }
          if (t.carry) p.carry = t;
          if (t.say) (this.adults[t.from] || this).talk(t.say, 2.6);
          if (t.label) { this.talk(`"${t.label}"... PARA SA AKIN 'TO?`, 3); this.emit({ type: 'label', text: t.label }); }
          if (t.bonus) { this.bonus += t.coins; this.emit({ type: 'alkansya', x: t.x, y: t.y, n: t.coins }); }
          else { this.coins += t.coins; this.stolen.push({ t, n: t.coins }); }
          this.emit({ type: 'coin', x: t.x, y: t.y, n: t.coins, kind: t.kind });
        }
      } else if (!t.done && t.progress > 0) {
        t.progress = Math.max(0, t.progress - dt * PROGRESS_DECAY);
        if (t.progress === 0) { t.started = false; t.visit = 0; }
      } else if (t.started && t.progress === 0) { t.started = false; t.visit = 0; } // let go right after a coin
    }

    // --- pickups
    for (const it of this.items) it.noPickT = Math.max(0, it.noPickT - dt);
    let k = 0;
    for (const it of this.items) {
      let keep = true;
      if (!p.hidden && it.noPickT <= 0 && dist(it, p) <= 9) {
        if (it.kind === 'key') { p.keys.add(it.color); this.talk('MAY SUSI!'); this.emit({ type: 'pickup', kind: 'key' }); keep = false; }
        else if (p.items.length < this.mods.itemCap) { p.items.push(it.kind); this.emit({ type: 'pickup', kind: it.kind }); keep = false; }
      }
      if (keep) this.items[k++] = it;
    }
    this.items.length = k;

    // --- traps (trigger on entering a tile) and doorway checkpoints
    const tk = p.tx + ',' + p.ty;
    if (tk !== this.lastTile) {
      this.lastTile = tk;
      const tr = this.traps.find((t) => t.tx === p.tx && t.ty === p.ty);
      if (tr) this.stats.traps++;
      if (tr?.kind === 'creak') {
        // MEDYAS: in socks a creaky board stays quiet (by a sleeping boss it only halves it: that room is her puzzle)
        const r = this.mods.medyas ? (this.adults.some((a) => a.cfg.depth) ? 32 : 0) : 64;
        if (r) { this.noise({ x: p.x, y: p.y, r, lure: true }); this.talk('KREEK...'); this.emit({ type: 'creak' }); }
        else this.emit({ type: 'medyas' });
      }
      if (tr?.kind === 'lego') { this.noise({ x: p.x, y: p.y, r: 80, lure: true }); p.stunT = 0.8; this.talk('ARAY!'); this.emit({ type: 'ouch' }); }
      if (map.ch(p.tx, p.ty) === 'd' && this.calm) this.addCheckpoint(p.tx * TILE + 8, p.ty * TILE + 8);
    }

    // --- hostile projectiles (sandok)
    for (const h of this.hostiles) {
      const nx = h.x + h.vx * dt, ny = h.y + h.vy * dt;
      h.d += Math.hypot(h.vx, h.vy) * dt;
      if (!p.hidden && !(p.graceT > 0) && Math.hypot(nx - p.x, ny - p.y) < 6) {
        h.done = true; p.stunT = 1.3; this.talk('ARAY!');
        this.noise({ x: p.x, y: p.y, r: 70, lure: true });
        this.emit({ type: 'ouch' });
      } else if (map.isSolidAt(nx, ny) || h.d >= h.max) { h.done = true; this.emit({ type: 'land', x: h.x, y: h.y }); } else { h.x = nx; h.y = ny; }
    }
    compact(this.hostiles);

    // --- projectiles
    for (const pr of this.projectiles) {
      const nx = pr.x + pr.vx * dt, ny = pr.y + pr.vy * dt;
      pr.d += Math.hypot(pr.vx, pr.vy) * dt;
      if (map.isSolidAt(nx, ny) || pr.d >= this.throwMax) { pr.done = true; this.land(pr); } else { pr.x = nx; pr.y = ny; }
    }
    compact(this.projectiles);
    // HOLEN: a marble keeps rolling, ticking little lures along its line until it hits something (then it is gone)
    for (const r of this.rollers) {
      const nx = r.x + r.vx * dt, ny = r.y + r.vy * dt, step = Math.hypot(r.vx, r.vy) * dt;
      r.d += step; r.next -= step;
      if (map.isSolidAt(nx, ny) || r.d > MARBLE_ROLL) { r.done = true; continue; }
      r.x = nx; r.y = ny;
      if (r.next <= 0) { r.next = MARBLE_TICK; this.noise({ x: r.x, y: r.y, r: MARBLE_R, lure: true, marble: true }); this.emit({ type: 'roll', x: r.x, y: r.y }); }
    }
    compact(this.rollers);

    // --- devices + timed switches
    for (const d of this.devices) {
      if (!d.on) continue;
      d.t += dt;
      if ((d.pulse -= dt) <= 0) { this.noise({ x: d.x, y: d.y, r: d.r, lure: true }); d.pulse = DEVICE_PULSE; }
      if (d.t >= d.dur) d.on = false;
    }
    for (const s of this.switches) if (s.timer > 0 && (s.timer -= dt) <= 0) this.toggleSwitch(s, false);
    for (const [key, [tx, ty]] of this.pendingGates) if (!this.occupied(tx, ty)) { this.map.set(tx, ty, 'G'); this.pendingGates.delete(key); }

    // --- adults
    let catcher = null;
    for (const a of this.adults) {
      const wasChasing = a.state === 'chase';
      a.update(dt, this);
      if (!wasChasing && a.state === 'chase') this.spotted++;
      this.maxAlert = Math.max(this.maxAlert, a.alert);
      if (a.cfg.vehicle) this.trikeHit(a);
      if (a.caught && this.god) { a.caught = false; a.state = 'search'; a.searchT = 1; a.alert = 0.5; }
      if (a.caught && !catcher) catcher = a;
    }
    this.hearNoises(dt);
    if (catcher) { this.caught(catcher); if (this.status !== 'play' || this.scold) return; }

    // --- boss phases (coins can drop when you're caught, but a phase never un-happens)
    while (this.bossPhases[this.phase] && this.coins >= this.bossPhases[this.phase].at) this.applyPhase(this.bossPhases[this.phase++]);
    if (this.status !== 'play') return;

    if (this.escapeT > 0 && (this.escapeT -= dt) <= 0 && !this.god) {
      this.escapeT = 0;
      this.fail('escape', this.adults[this.level.boss?.index ?? 0] || this.adults[0]);
      return;
    }

    if (this.patience && this.time >= this.patience && !this.god) {
      this.fail('time', this.adults.find((a) => a.type === 'mama') || this.adults.find((a) => !a.cfg.harmless) || this.adults[0]);
      return;
    }

    // a strict mission that can no longer be done this run: say so once (no surprises on the clear screen)
    for (let i = 1; i < this.missionIds.length; i++) {
      const m = MISSIONS[this.missionIds[i]];
      if (m.strict && !this.missionLost[i] && !m.ok(this)) { this.missionLost[i] = true; this.emit({ type: 'missionLost', id: this.missionIds[i], i }); }
    }

    if (this.open && !p.hidden && dist(p, this.exit) < 10) {
      if (this.kids && this.kids.some((k) => k !== p && !k.out)) { // one is out: now bring the other
        p.out = true;
        this.emit({ type: 'teamOut', who: this.mods.charId });
        this.swap(true);
      } else this.finish();
    }
  }

  // A tricycle doesn't catch you, but it does knock you over (and honks).
  trikeHit(a) {
    const p = this.player;
    if (!a.moving || p.hidden || p.stunT > 0 || p.graceT > 0 || dist(a, p) > 11) return;
    const dx = p.x - a.x, dy = p.y - a.y, m = Math.hypot(dx, dy) || 1;
    for (let i = 10; i > 0; i -= 2) {
      const nx = p.x + (dx / m) * i, ny = p.y + (dy / m) * i;
      if (!this.map.blocked(nx, ny, p.r)) { p.x = nx; p.y = ny; break; }
    }
    p.stunT = 1;
    a.talk('BEEP BEEP!', 1.2);
    this.talk('ARAY!');
    this.noise({ x: p.x, y: p.y, r: 100, lure: true });
    this.emit({ type: 'ouch' });
  }

  spill() {
    const p = this.player, t = p.carry;
    if (!t) return;
    p.carry = null;
    this.stats.spills++;
    t.done = false; t.progress = 0; t.started = false;
    this.noise({ x: p.x, y: p.y, r: 70, lure: true });
    this.talk('NATAPON!', 1.4);
    this.emit({ type: 'spill', x: p.x, y: p.y });
  }

  fail(reason, who) {
    this.status = 'caught'; this.reason = reason; this.catcher = who;
    this.emit({ type: 'caught', final: true });
  }

  // Caught by an adult: a scolding, some coins go back, and you try again from the last safe spot.
  // The last catch (lives used up) ends the level.
  caught(a) {
    // KASABWAT: if it was the kid you left behind, you are now that kid (the catch and the respawn are theirs)
    if (this.kids && a.focusKid && a.focusKid !== this.player && !a.focusKid.out) this.swap(true);
    // PALUSOT: Kuya Ramil talks his way out of the first close call (not in a boss's final phase)
    if (this.palusot > 0 && !this.finalPhase) {
      this.palusot--;
      this.stats.palusot++;
      const p = this.player;
      p.graceT = GRACE_TIME; p.stunT = 0;
      for (const b of this.adults) if (b.state === 'chase' || b === a) b.reset();
      this.talk('MA, TINUTULUNGAN KO LANG SIYA!', 2.2);
      a.talk('HAY NAKO. SIGE NA, ALIS.', 2.2);
      this.emit({ type: 'palusot', who: a });
      return;
    }
    this.catches++;
    if (this.catches >= this.lives) { this.fail('seen', a); return; }
    this.spill();
    // (putting coins back: what is back stays back)
    let lost = this.level.giveBack ? 0 : Math.min(this.coins, Math.ceil(this.coins * CATCH_PENALTY));
    this.coins -= lost;
    const back = lost;
    while (lost > 0 && this.stolen.length) { // coins go back where they came from, newest first
      const s = this.stolen[this.stolen.length - 1], n = Math.min(lost, s.n);
      if (s.t.done) { s.t.done = false; s.t.coins = 0; }
      s.t.coins += n; s.t.progress = 0; s.t.started = false; s.t.visit = 0;
      s.n -= n; lost -= n;
      if (s.n === 0) this.stolen.pop();
    }
    this.scold = { t: SCOLD_TIME, who: a, lost: back };
    this.catcher = a;
    a.talk(a.cfg.scold || a.cfg.shout, SCOLD_TIME);
    const p = this.player;
    p.stunT = 0; p.dashT = 0;
    this.emit({ type: 'caught', final: false, lost: back, left: this.livesLeft });
  }

  respawn() {
    const p = this.player;
    this.scold = null;
    this.catcher = null;
    const threat = (cp) => Math.min(Infinity, ...this.adults.filter((a) => !a.cfg.harmless && a.awake).map((a) => dist(a, cp)));
    let best = null;
    for (let i = this.checkpoints.length - 1; i >= 0 && !best; i--) if (threat(this.checkpoints[i]) > 56) best = this.checkpoints[i];
    if (!best) best = this.checkpoints.reduce((m, c) => (threat(c) > threat(m) ? c : m), this.checkpoints[0]);
    p.x = best.x; p.y = best.y;
    p.hidden = best.hide && this.hides.includes(best.hide) ? best.hide : null;
    p.hideT = 0; p.stunT = 0; p.dashT = 0; p.graceT = GRACE_TIME;
    for (const a of this.adults) a.reset();
    this.hostiles.length = 0;
    this.lastTile = p.tx + ',' + p.ty;
    this.trail.length = 0;
    this.emit({ type: 'respawn', x: p.x, y: p.y });
  }

  // SOBRA: one coin out of a stash (progress is toward the next coin; the first one, opening it, takes longest).
  stealCoin(t, dt) {
    const k = t.taken, pf = t.profile;
    t.progress += dt / (t.coinTime(k) * this.mods.stealTime);
    this.emit({ type: 'stealTick' });
    if (t.progress < 1) return;
    t.progress = 0;
    t.coins--;
    this.coins++;
    const last = this.stolen[this.stolen.length - 1];
    if (last && last.t === t) last.n++; else this.stolen.push({ t, n: 1 });
    if (k === 0) { // it opens: the purse clasp clicks, and Jun reads anything written on it
      if (pf.end && !this.muffle(t)) { this.noise({ x: t.x, y: t.y, r: pf.end.r }); if (pf.end.say) this.talk(pf.end.say, 0.8); }
      if (t.label) { this.talk(`"${t.label}"... PARA SA AKIN 'TO?`, 3); this.emit({ type: 'label', text: t.label }); }
    }
    if (t.coins === 0) { // emptied: a hollow klak, and someone is going to notice
      t.done = true;
      this.noise({ x: t.x, y: t.y, r: EMPTY_NOISE });
      this.emit({ type: 'emptied', x: t.x, y: t.y, kind: t.kind });
    } else if (t.visit > 0) this.noise({ x: t.x, y: t.y, r: clinkR(t.visit) }); // greed is loud
    t.visit++;
    this.emit({ type: 'coin', x: t.x, y: t.y, n: 1, kind: t.kind, first: k === 0, k: t.visit });
    if (!this.sapat && this.level.quota > 0 && this.coins >= this.level.quota && !this.level.giveBack && !this.level.hingi) {
      this.sapat = true; // "that's enough": everything past the quota is sobra
      this.emit({ type: 'sapat' });
    }
  }

  // KASABWAT: switch to the other kid (force: a catch or an exit does it, ignoring the 1 s cooldown)
  swap(force = false) {
    if (!this.kids || this.status !== 'play' || (this.scold && !force)) return false;
    if (!force && this.swapT > 0) return false;
    const i = this.kids.indexOf(this.player), other = this.kids[1 - i];
    if (!other || other.out) return false;
    this.player.graceT = 0; // the one left behind can be seen
    this.player.stealing = false;
    this.player = other; this.mods = this.kidMods[1 - i];
    this.swapT = 1;
    this.lastTile = other.tx + ',' + other.ty;
    this.emit({ type: 'swap', who: this.mods.charId });
    return true;
  }
  // Which kid this adult is dealing with: the one it is already after, else one it can see (yours first), else yours.
  focusFor(a) {
    if (!this.kids) return this.player;
    if (a.focusKid && !a.focusKid.out && (a.state === 'chase' || a.state === 'inspect')) return a.focusKid;
    for (const k of [this.player, ...this.kids.filter((k) => k !== this.player && !k.out)]) if (a.canSee(k)) return (a.focusKid = k);
    return (a.focusKid = this.player);
  }

  // PANYO: the handkerchief wrapped round a clasp or zipper, once a level (the first coin stash you open)
  muffle(t) {
    if (!t.perCoin || this.panyo <= 0) return false;
    this.panyo--;
    this.talk('SHH... (PANYO)', 1);
    this.emit({ type: 'panyo' });
    return true;
  }

  // What was taken, for the clear screen, the ledger (IBALIK, the case file) and HINALA.
  get sobra() { return this.level.giveBack || this.level.hingi ? 0 : Math.max(0, this.coins - this.level.quota); }
  takenBy() {
    const by = {};
    for (const t of this.targets) if (!t.bonus && t.owner && t.taken > 0 && !t.profile.verb) by[t.owner] = (by[t.owner] || 0) + t.taken;
    return by;
  }

  finish() {
    this.status = 'clear';
    const fast = this.time <= this.level.par, stealth = this.stealthOk;
    const missions = this.missionIds.map((id, i) => !this.missionLost[i] && !!MISSIONS[id].ok(this)); // [clear, mission 2, mission 3]
    const emptied = this.targets.filter((t) => t.perCoin && t.done).length;
    this.result = { coins: this.coins, time: this.time, stars: missions.filter(Boolean).length, missions, fast, stealth, catches: this.catches, spotted: this.spotted, bonus: this.bonus,
      sobra: this.sobra, emptied, takenBy: this.takenBy(), spills: this.stats.spills, tattles: this.stats.tattles, palusot: this.stats.palusot };
    this.emit({ type: 'clear' });
  }

  // ---- dev helpers (used by the dev menu and tests)
  devFillQuota() { this.coins = Math.max(this.coins, this.level.quota); for (const t of this.targets) if (t.must) t.done = true; }
  // Drop the player on a free tile next to the exit (walk in to finish).
  devGoToExit() {
    const e = this.exit;
    const side = [[-1, 0], [1, 0], [0, -1], [0, 1]].find(([dx, dy]) => !this.map.tileSolid(e.tx + dx, e.ty + dy));
    const [dx, dy] = side || [0, 0];
    for (const p of this.kids || [this.player]) { // (tag-team: both kids)
      p.hidden = null; p.hideT = 0;
      p.x = e.x + dx * TILE; p.y = e.y + dy * TILE;
    }
  }
  devNextPhase() { const ph = this.bossPhases[this.phase]; if (ph) this.coins = Math.max(this.coins, ph.at); return !!ph; }
  devClear() { if (this.status === 'play') this.finish(); }
}

// Drop finished entries in place (no new array every frame).
function compact(list) {
  let k = 0;
  for (const e of list) if (!e.done) list[k++] = e;
  list.length = k;
}
