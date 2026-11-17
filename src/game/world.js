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
import { windowLights, lightSources, sightMul } from '../world/light.js';

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

const ESCORT_GAP = 22, ESCORT_MEOW = 10, ESCORT_MEOW_R = 30, ESCORT_HERE = 34;
const SIT_TIME = 0.5, SNEAK_IN = 1; // MAMA's finale: sitting down takes this long; seen this recently = she saw you
const CREAKY_HOLD = 1.5, CREAKY_R = 96; // a creaky door: hold this long to open it quietly; its creak carries this far
const JINGLE_R = 36; // IBALIK: what jingling pockets add to the sound of running
const FAMILY = new Set(['mama', 'tatay', 'lola', 'tita']);
// BAGYO, Act 2 TULO: drops fall every DROP_EVERY s; a container holds this many before it overflows
export const DROP_EVERY = 0.8;
export const CONT_CAP = { palanggana: 12, kaldero: 8, timba: 16 };
const BOX_R = 22;       // drips this close to the kittens' box soak it
const DUMP_R = 52;      // TAPON: the splash of a container emptied into the drain
const PUSH_T = 0.22;    // BAHA: lean on a sandbag this long and it slides one tile
const PUSH_R = 36;      // ... with a scrape this loud
const CHAT = [ // by HINALA tier: [first line, the reply]
  [['KUMAIN KA NA?', 'MAMAYA NA.'], ['ANG INIT NGAYON!', 'OO NGA...'], ['NAKITA MO ANG REMOTE?', 'WALA DITO.']],
  [['PARANG KULANG ANG BARYA KO.', 'BAKA NAIWAN MO?'], ['MAY DAGA YATA DITO.', 'BAKA PUSA.']],
  [['MAY NAWAWALA NA NAMAN!', 'SINO KAYA?'], ['BANTAYAN NATIN ANG PITAKA.', 'SIGE.']],
  [['MAY KUMUKUHA TALAGA!', 'HUHULIHIN NATIN.'], ['BILANGIN MO ULIT.', 'KULANG PA RIN!']],
];

export class World {
  // loadout: { char, upgrades } from the save; defaults = Jun with no upgrades.
  //   lives: catches allowed before the level is lost (1 = classic, the game uses 3)
  //   alkansyaFound: this level's secret alkansya was already emptied on an earlier run
  constructor(level, loadout = {}) {
    this.level = level;
    // SI MINGMING NAMAN (level "cat"): you are the cat, whoever was picked (and no gear: she has no pockets)
    this.mods = level.cat ? computeMods('mingming') : computeMods(loadout.char, loadout.upgrades);
    this.map = new TileMap(level.tiles);
    this.rng = mulberry32(level.seed ?? hashStr(level.id || 'level')); // gameplay randomness, separate from generation
    this.noThrow = !!level.noThrow;
    this.player = new Player(level.spawn[0], level.spawn[1], this.mods);
    this.player.items = this.noThrow ? [] : this.mods.startItems.slice(); // gear: BAON, HOLEN
    this.panyo = this.mods.panyo; // PANYO: stash openings it can still muffle this level
    this.palusot = this.mods.palusot; // PALUSOT: close calls Kuya Ramil can still talk away this level
    this.rollers = [];            // HOLEN: marbles rolling across the floor
    // BARANGAY (level "escort"): Mingming follows a step behind you on your own path, stops when you stop, meows
    // every 10 s unless you stand still beside her for a second, and runs back to you if a grown-up spots her. She
    // cannot be caught. The exit only takes you once she is with you.
    this.escort = level.escort ? { look: 'pusa', x: this.player.x - 16, y: this.player.y, trail: [], meowT: ESCORT_MEOW, hushT: 0, runT: 0, seenCd: 0, dir: 0, stepT: 0, moving: false, hidden: false } : null;
    this.scentOnly = (level.targets || []).some((t) => t.scent); // TATAY's boss: the trail is the fish's, not yours
    this.breadBag = level.breadBag ? { ...at(level.breadBag.at), every: level.breadBag.every ?? 8, cd: 0 } : null; // one pandesal at a time
    this.creaky = new Set((level.creakyDoors || []).map((p) => p.join())); // doors that creak unless opened slowly (hold ACT)
    this.doorHold = null; // { obj, key, t } while ACT is held on a creaky door
    this.finale = null;   // the boss finale in progress (Blueprint 8): { type, t, ... }
    this.puddles = [];            // GATAS: spilled milk left on the floor ({ x, y, t, found })
    this.playerOpened = new Set(); // A5: doors Jun opened and left open ("x,y"): someone passing may notice
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
    // a door the family locked themselves (HINALA): they have the key, so it only stops the kids
    const family = new Set((level.locks || []).filter((l) => l.family).map((l) => l.at.join()));
    this.adultLocks = { has: (k) => this.locks.has(k) && !family.has(k) };
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
    // A6: night is real. Pools of light (windows, lamps, a TV that's on, a flashlight, brownout candles) show you at full
    // range; anywhere else an adult only sees you from closer. A lightning flash lights everything for a moment.
    this.windowPools = level.night ? windowLights(this.map) : [];
    this.lights = [];
    this.flashT = 0;
    this.items = (level.items || []).filter((i) => !this.noThrow || i.kind === 'key').map((i) => ({ ...at(i.at), kind: i.kind, color: i.color, noPickT: 0 }));
    this.hides = (level.hide || []).map((h) => ({ ...at(h.at), kind: h.kind || 'box' }));
    this.devices = (level.devices || []).filter((d) => d.kind !== 'videoke').map((d) => ({ ...at(d.at), kind: d.kind || 'tv', dur: d.dur ?? 8, r: d.r ?? 110, on: false, t: 0, pulse: 0 }));
    // Videoke: it plays by itself, a song then a break. While someone is singing, nothing you do near it can be heard.
    this.videokes = (level.devices || []).filter((d) => d.kind === 'videoke').map((d) => ({ ...at(d.at), kind: 'videoke', r: d.r ?? 76, on: d.on ?? 9, off: d.off ?? 6, t: d.phase ?? 0, singing: false }));
    this.cover = null;  // what is drowning out your noise right now: 'thunder' | 'videoke' | null
    this.stats = { throws: 0, hides: 0, runT: 0, loudRunT: 0, skills: 0, traps: 0, barks: 0, devices: 0, spills: 0, tattles: 0, palusot: 0, evidence: 0 }; // for the missions (and HINALA)
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
    // BAGYO (Blueprint 9.1 + mini-game MG-4): TULO, the floor leaking onto the kittens' box (catch the drips in
    // containers, empty them down the drain), then BAHA, the flood from the broken kanal (push sandbags into the
    // breaches to stop it) with the clock running to get the kittens inside.
    this.tulo = level.tulo ? this.makeTulo(level.tulo) : null;
    this.flood = level.flood ? this.makeFlood(level.flood) : null;
    this.underBag = new Map(); // "x,y" -> the floor under a sandbag ('Q')
    for (let y = 0; y < this.map.h; y++) for (let x = 0; x < this.map.w; x++) {
      if (this.map.ch(x, y) !== 'Q') continue;
      const nb = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => this.map.ch(x + dx, y + dy)).find((c) => ';:._,'.includes(c));
      this.underBag.set(x + ',' + y, nb || ';');
    }
    this.pushT = 0; this.pushAnim = null;
  }

  makeTulo(def) {
    const at2 = (p) => ({ x: p[0] * TILE + TILE / 2, y: p[1] * TILE + TILE / 2, tx: p[0], ty: p[1] });
    return {
      stage: 'idle', t: 0, dur: def.dur ?? 22, box: at2(def.box), drain: at2(def.drain), wet: 0, wetCap: def.wetCap ?? 16, cryT: 0, scooped: false,
      drips: def.drips.map((p, i) => ({ ...at2(p), on: false, startAt: def.starts?.[i] ?? i * 5, dropT: 0.3 + i * 0.17, fallT: 0 })),
      conts: def.containers.map((c) => ({ ...at2(c.at), kind: c.kind, cap: CONT_CAP[c.kind] ?? 10, fill: 0, drip: null, held: false })),
    };
  }
  makeFlood(def) {
    const n = this.map.w * this.map.h;
    return {
      active: false, stopped: false, t: 0, tick: 0, spread: def.spread ?? 0.85, deepAfter: def.deepAfter ?? 7, escape: def.escape ?? 34,
      adults: def.adults || [], banner: def.banner, depth: new Uint8Array(n), wetT: new Float32Array(n), wadeT: 0,
      sources: def.breaches.map(([tx, ty]) => ({ tx, ty, x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, sealed: false })),
    };
  }
  depthAt(tx, ty) { const F = this.flood; return F?.active ? F.depth[ty * this.map.w + tx] | 0 : 0; }

  makeAdult(d) {
    // HINGI (the epilogue): nobody is watching for you any more, they are just family in their house
    if (this.level.hingi) d = { ...d, cfg: { ...d.cfg, harmless: true, cover: false } };
    // SI MINGMING NAMAN: nobody is looking for Jun tonight, they just shoo the cat
    if (this.level.cat && d.type !== 'aso') d = { ...d, cfg: { shout: 'UY, PUSA!', scold: 'SHOO! LABAS, PUSA!', ...d.cfg } };
    const a = new Adult(d, this.map, this.adultLocks);
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
    for (const a of this.adults) if (a.snoring && Math.hypot(a.x - x, a.y - y) < a.cfg.snore.r) return 'snore'; // LOLA: a loud snore
    for (const v of this.videokes) if (v.singing && Math.hypot(v.x - x, v.y - y) < v.r) return 'videoke';
    return null;
  }
  // Mission state right now: [{ id, ok, lost }]. ok is final only when the level is cleared.
  missionState() { return this.missionIds.map((id, i) => ({ id, ok: !this.missionLost[i] && MISSIONS[id].ok(this), lost: this.missionLost[i] })); }
  noise(n) { this.noises.push(n); this.emit({ type: 'ring', x: n.x, y: n.y, r: n.r, lure: !!n.lure, tattle: !!n.tattle }); }
  talk(text, t = 1.2) { this.say = { text, t }; }

  // ---- callbacks used by adults ----
  openDoor(tx, ty) {
    if (this.map.ch(tx, ty) !== 'D' || this.adultLocks.has(tx + ',' + ty)) return false; // adults have no keys (except to their own doors)
    this.map.set(tx, ty, 'd');
    this.playerOpened.delete(tx + ',' + ty);
    this.emit({ type: 'door', x: tx * TILE + 8, y: ty * TILE + 8 });
    return true;
  }
  // A5: an adult closes a door they opened, once they are past it (unless someone is standing in it)
  closeDoorBehind(tx, ty) {
    if (this.map.ch(tx, ty) !== 'd') return;
    const inIt = (o) => Math.floor(o.x / TILE) === tx && Math.floor(o.y / TILE) === ty;
    const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2;
    if ((this.kids || [this.player]).some((k) => Math.hypot(k.x - cx, k.y - cy) < 1.5 * TILE) || this.adults.some(inIt)) return; // never in a kid's face
    this.map.set(tx, ty, 'D');
    this.emit({ type: 'door', x: tx * TILE + 8, y: ty * TILE + 8 });
  }
  get escortHere() { return !this.escort || dist(this.escort, this.player) < ESCORT_HERE; }
  escortUpdate(dt) {
    const e = this.escort, p = this.player;
    if (!e) return;
    const last = e.trail[e.trail.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 3) { e.trail.push({ x: p.x, y: p.y }); if (e.trail.length > 80) e.trail.shift(); }
    // where to be: the point on your trail ESCORT_GAP px behind you
    let tg = e.trail[0] || p, acc = 0;
    for (let i = e.trail.length - 1; i > 0; i--) { acc += dist(e.trail[i], e.trail[i - 1]); if (acc >= ESCORT_GAP) { tg = e.trail[i - 1]; break; } }
    if (dist(e, p) < ESCORT_GAP - 2 && !(e.runT > 0)) tg = e; // close enough: she sits
    const dx = tg.x - e.x, dy = tg.y - e.y, d = Math.hypot(dx, dy), sp = (e.runT > 0 ? 95 : Math.max(48, dist(e, p) > 48 ? 80 : 48)) * dt;
    e.moving = d > 1.5;
    if (e.moving) { const k = Math.min(1, sp / d); e.x += dx * k; e.y += dy * k; e.stepT += dt * 9; e.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0); }
    if (e.runT > 0) e.runT -= dt;
    if (e.seenCd > 0) e.seenCd -= dt;
    e.hidden = !!p.hidden && dist(e, p) < 26; // you hide, she tucks in beside you
    // a hush: stand still right beside her for a second
    e.hushT = !p.moving && dist(e, p) < 24 ? e.hushT + dt : 0;
    if (e.hushT >= 1) e.meowT = ESCORT_MEOW;
    if ((e.meowT -= dt) <= 0) {
      e.meowT = ESCORT_MEOW;
      if (!this.masked(e.x, e.y)) this.noise({ x: e.x, y: e.y, r: ESCORT_MEOW_R, lure: true });
      this.emit({ type: 'meow', x: e.x, y: e.y });
    }
    if (e.hidden || e.seenCd > 0) return;
    for (const a of this.adults) {
      if (a.cfg.harmless || a.cfg.dog || a.state === 'chase' || !a.seesPoint(e.x, e.y)) continue;
      a.investigate(e.x, e.y);
      a.talk('UY, PUSA!', 1.6);
      this.stats.catSeen = (this.stats.catSeen | 0) + 1;
      e.runT = 1.5; e.seenCd = 4;
      this.emit({ type: 'catSeen', who: a });
      break;
    }
  }

  // NINANG's finale: at the flash, are you in the photo (in the zone, blending beside a guest), or nowhere anyone
  // can see you? Anything else (in the zone but not blending, or seen anywhere) and she wants one more.
  photoOutcome() {
    const P = this.level.photo, p = this.player, [x0, y0, x1, y1] = P.zone;
    const inZone = !p.hidden && p.tx >= x0 && p.tx <= x1 && p.ty >= y0 && p.ty <= y1;
    if (inZone && p.blend) return 'in';
    const seen = this.adults.some((a) => !a.cfg.harmless && a.awake && a.canSee(p));
    return !inZone && !seen ? 'out' : 'miss';
  }

  // NINANG calls a kid by name every 15 s (her fan goes up 2 s before). One time in three, never twice running, it is
  // "JUN!": within 5 s you go to her ("MAMAYA NA!") or blend into the crowd, or the whole room turns to look.
  ninangCall(dt) {
    const c = this.level.calls;
    if (!c || this.finale || this.status !== 'play') return;
    const n = this.adults[this.level.boss?.index ?? 0], p = this.player;
    if (!n) return;
    const k = (this.call ??= { t: c.every, last: null, active: null, warned: false });
    if (k.active) {
      if (dist(n, p) < 2 * TILE) { n.talk('MAMAYA NA!', 1.6); k.active = null; this.emit({ type: 'callAnswered' }); return; }
      if ((k.active.t -= dt) <= 0) {
        k.active = null;
        if (p.blend) { this.emit({ type: 'callBlended' }); return; }
        n.talk('JUN? NASAAN KA?', 1.8);
        for (const a of this.adults) {
          if (a.cfg.harmless || !a.awake) continue;
          a.alert = Math.max(a.alert, 0.55); a.hearT = 1.4; a.faceTo = Math.atan2(p.y - a.y, p.x - a.x);
        }
        this.emit({ type: 'glance' });
      }
      return;
    }
    k.t -= dt;
    if (!k.warned && k.t <= (c.warn ?? 2)) { k.warned = true; n.talk('EHEM!', 1); this.emit({ type: 'fanRaise', who: n }); }
    if (k.t > 0) return;
    k.t = c.every; k.warned = false;
    const others = (c.names || ['BING', 'NENE', 'RAMIL']).filter((x) => x !== 'JUN');
    const jun = k.last !== 'JUN' && this.rng() < 1 / 3;
    const name = jun ? 'JUN' : others[Math.floor(this.rng() * others.length)];
    k.last = name;
    n.talk(name + '!', 2);
    this.emit({ type: 'nameCall', jun });
    if (jun) k.active = { t: c.window ?? 5 };
  }

  // TATAY's boss: the dog reached the fish. Tatay laughs, the fish goes back to its plate: a close call.
  dogGrab(dog) {
    if (this.god) { dog.state = 'eat'; dog.eatT = 3; this.player.graceT = 1; return; } // (bots and the dev mode: no close calls)
    const tatay = this.adults.find((a) => a.type === 'tatay');
    if (!this.mods.cat) tatay?.talk('HAHA! IKAW PALA, ASO!', 2.4); // (SI MINGMING: he snatches it from the cat, and Tatay sleeps on)
    dog.state = 'eat'; dog.eatT = 3; dog.talk(this.mods.cat ? 'GRRR! AKIN YAN!' : 'NOM NOM', 1.5);
    this.caught(dog);
  }

  // A creaky door: hold ACT for 1.5 s and it opens without a sound; let go early and it creaks open (MEDYAS halves it).
  holdDoor(dt, input, ctx) {
    const h = this.doorHold, { tx, ty } = h.obj;
    if (this.map.ch(tx, ty) !== 'D') { this.doorHold = null; return; }
    const still = input.action && ctx?.kind === 'door' && ctx.obj.tx === tx && ctx.obj.ty === ty;
    if (still) {
      h.t += dt;
      if (h.t < CREAKY_HOLD) return;
      this.map.set(tx, ty, 'd');
      this.playerOpened.add(h.key);
      this.emit({ type: 'door', x: h.obj.x, y: h.obj.y, quiet: true });
    } else {
      this.map.set(tx, ty, 'd');
      this.playerOpened.add(h.key);
      this.noise({ x: h.obj.x, y: h.obj.y, r: this.mods.medyas ? CREAKY_R / 2 : CREAKY_R, lure: true });
      this.talk('KREEEEK!', 1.2);
      this.emit({ type: 'creak' });
    }
    this.doorHold = null;
  }

  // Boss finales (Blueprint 8): each boss ends its own way. Started by the last boss phase ("finale": {...}).
  finaleUpdate(dt) {
    const f = this.finale;
    if (!f || this.status !== 'play') return;
    f.t += dt;
    const boss = this.adults[this.level.boss?.index ?? 0];
    if (f.type === 'photo') {
      if (!f.gathered) { // everyone to the photo: the boss to the tripod, the rest into the zone
        f.gathered = true;
        const P = this.level.photo, spots = P.spots.slice();
        for (const a of this.adults) {
          const s = a === boss ? P.tripod : spots.shift();
          if (!s) continue;
          a.retune({ route: [[s[0], s[1], 99, a === boss ? -Math.PI / 2 : Math.PI / 2]], hunt: null }); a.state = 'return'; a.goTo(s[0] * TILE + TILE / 2, s[1] * TILE + TILE / 2);
        }
      }
      const before = Math.ceil(f.count);
      f.count -= dt;
      if (Math.ceil(f.count) !== before && f.count > 0 && f.count <= 3) this.emit({ type: 'countdown', n: Math.ceil(f.count) });
      if (f.count <= 0) {
        const out = this.photoOutcome();
        this.emit({ type: 'flash' });
        if (out === 'miss') { f.count = f.countdown ?? 8; if (boss) { boss.talk('ISA PA!', 2); boss.caught = true; } return; }
        this.photo = out;
        boss?.talk(out === 'in' ? 'ANG CUTE! SMILE, JUN!' : 'NASAAN SI JUN? SIGE NA NGA.', 2.6);
        this.finish();
        return;
      }
    }
    if (f.type === 'tulo') { // bring the kittens back to their box, then keep it dry until the leaks stop
      const T = this.tulo;
      if (f.stage === 'gather' && dist(this.player, T.box) < 20 && !this.player.hidden) {
        f.stage = 'leak'; f.wait = true; T.stage = 'leak'; T.t = 0;
        this.emit({ type: 'kittensIn', x: T.box.x, y: T.box.y });
        this.emit({ type: 'phase', text: 'TULO! KEEP THE BOX DRY!', n: this.phase });
      }
      return;
    }
    if (f.type === 'carryOut' && !f.started && this.player.carry?.scent) { f.started = true; this.escapeT = f.escape ?? 35; this.emit({ type: 'phase', text: 'TAKBO! TO THE CRAWLSPACE!', n: this.phase }); }
    if (f.type === 'seat' && boss) {
      if (boss.seen) f.lastSeen = this.time;
      if (boss.i !== f.lastI) { f.lastI = boss.i; f.plateN++; this.emit({ type: 'plate', n: f.plateN, x: boss.x, y: boss.y }); } // a plate set: clink
      if (this.sitting && (this.sitting.t -= dt) <= 0) {
        this.sitting = null;
        if (this.time - f.lastSeen < SNEAK_IN) { boss.talk('HOY! SAAN KA GALING?', 2); boss.caught = true; } // she saw you sneak in
        else { boss.talk('ABA, NAUNA KA PA?', 3); this.finish(); }
        return;
      }
      if (!this.sitting && f.plateN >= (f.plates ?? 6)) { // the table is set and you are not at it
        f.plateN = 0;
        boss.talk('JUN! KAIN NA!', 2); boss.caught = true;
      }
    }
    if (f.type === 'silentExit' && f.getUp && !f.up && f.t >= f.getUp && boss) { // waiting it out is not free
      f.up = true;
      boss.cfg.speed = f.getUpSpeed ?? 14;
      boss.investigate(f.to[0] * TILE + TILE / 2, f.to[1] * TILE + TILE / 2);
      boss.talk('SINO BA YAN...?', 1.8);
      this.emit({ type: 'getUp', who: boss });
    }
  }

  // GATAS: a puddle dries in 45 s. An adult who sees one first comes to look ("Why is it wet here?"): evidence.
  checkPuddles(dt) {
    for (const pd of this.puddles) {
      pd.t += dt;
      if (pd.found) continue;
      for (const a of this.adults) {
        if (a.cfg.dog || a.cfg.harmless || !a.awake || a.state === 'chase' || !a.seesPoint(pd.x, pd.y, 4 * TILE)) continue;
        pd.found = true;
        a.investigate(pd.x, pd.y);
        a.talk('BAKIT BASA DITO?', 1.8);
        a.wary = 15;
        this.stats.evidence++;
        this.stats.puddles = (this.stats.puddles | 0) + 1;
        this.emit({ type: 'evidence', x: pd.x, y: pd.y, what: 'puddle' });
        break;
      }
    }
    if (this.puddles.length && this.puddles[0].t > 45) this.puddles.shift();
  }

  // Staged beats (level "staged": one beat or a list): { afterCoins | left, adult, to, delay, say }. When you have
  // that many coins (or KAIN NA has that many seconds left), that adult goes to a fixed spot, looks, shrugs and goes
  // back. The tutorial uses one to teach TAGO; GABI's dinner warning is one ("HUGAS KAMAY!").
  stagedBeat(dt) {
    const list = [].concat(this.level.staged || []);
    if (!list.length) return;
    this.beats ??= list.map(() => ({ t: undefined, done: false }));
    list.forEach((s, i) => {
      const b = this.beats[i];
      if (b.done) return;
      if (b.t === undefined) {
        const due = s.left !== undefined ? this.patience && this.patience - this.time <= s.left : this.coins >= (s.afterCoins ?? 1);
        if (due) b.t = s.delay ?? 1;
      } else if ((b.t -= dt) <= 0) { b.done = true; this.runBeat(s); }
      if (i === 0) { this.stagedT = b.t; this.stagedDone = b.done; } // (the tutorial coach reads the first one)
    });
  }
  runBeat(s) {
    const a = this.adults[s.adult | 0];
    if (!a || a.state === 'chase') return;
    a.busy = null; a.wait = 0; a.hearT = 0;
    a.investigate(s.to[0] * TILE + TILE / 2, s.to[1] * TILE + TILE / 2);
    a.talk(s.say || 'ANO YUN?', 1.4);
    a.staged = true;
    this.emit({ type: 'staged', who: a });
  }

  // A8: two of the family passing each other on a calm walk swap a line now and then. What they say follows the
  // house's mood (HINALA): small talk in a calm house, missing coins in a suspicious one (never Jun's name).
  chatter(dt) {
    if ((this.chatT = (this.chatT ?? 8) - dt) > 0) return;
    const fam = this.adults.filter((a) => FAMILY.has(a.type) && a.awake && a.state === 'patrol' && a.alert < 0.3 && !a.say);
    for (let i = 0; i < fam.length; i++) for (let j = i + 1; j < fam.length; j++) {
      const a = fam[i], b = fam[j];
      if (dist(a, b) > 22) continue;
      const tier = this.level.hinalaTier | 0, lines = CHAT[Math.min(tier, CHAT.length - 1)];
      const k = Math.floor(this.rng() * lines.length);
      a.talk(lines[k][0], 1.8);
      b.say = { text: lines[k][1], t: 1.8 };
      this.chatT = 25;
      this.emit({ type: 'chat', a, b });
      return;
    }
  }

  // A5: a door Jun opened and left open, close enough to this adult to notice. Returns where to look (the room on
  // the far side of the door) and counts it as evidence, or null.
  noticeOpenDoor(adult) {
    if (this.level.tutorial) return null; // (the tutorial has enough to teach: an open door goes unnoticed there)
    for (const key of this.playerOpened) {
      const [tx, ty] = key.split(',').map(Number);
      if (this.map.ch(tx, ty) !== 'd') { this.playerOpened.delete(key); continue; }
      const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2;
      if (!adult.seesPoint(cx, cy, 3 * TILE)) continue; // she has to actually see it, close by
      this.playerOpened.delete(key);
      let best = null;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (this.map.tileSolid(tx + dx, ty + dy)) continue;
        const far = !this.map.tileSolid(tx + 2 * dx, ty + 2 * dy) ? 2 : 1;
        const p = { x: (tx + far * dx) * TILE + TILE / 2, y: (ty + far * dy) * TILE + TILE / 2 };
        const dd = Math.hypot(p.x - adult.x, p.y - adult.y);
        if (!best || dd > best.dd) best = { ...p, dd };
      }
      this.stats.evidence++;
      this.emit({ type: 'evidence', x: cx, y: cy, what: 'door' });
      return best && { x: best.x, y: best.y, tx, ty };
    }
    return null;
  }
  arrived(adult) {
    for (const d of this.devices) {
      if (d.on && dist(d, adult) < 24) { d.on = false; d.caught = (d.caught || 0) + 1; adult.talk('SINO NAGBUKAS?', 1.6); this.emit({ type: 'deviceOff' }); }
    }
    // A1: a thrown slipper is picked up and taken away (and somebody wonders whose it is: HINALA evidence)
    if (adult.cfg.dog) return;
    const it = this.items.find((i) => i.thrown && dist(i, adult) < 24);
    if (it) {
      this.items.splice(this.items.indexOf(it), 1);
      adult.talk("KANINONG TSINELAS 'TO?", 1.8);
      adult.wary = 15;
      if (!this.level.tutorial) { // (the tutorial asks you to throw it: no HINALA for doing as you are told)
        this.stats.evidence++;
        this.emit({ type: 'evidence', x: it.x, y: it.y, what: 'tsinelas' });
      }
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
    const f = this.finale; // MAMA's finale: your place at the table
    if (f?.type === 'seat' && this.open && !this.sitting && Math.hypot(f.seatPt.x - p.x, f.seatPt.y - p.y) <= REACH) return { kind: 'seat', obj: f.seatPt, label: 'UPO' };
    const near = (list, f = () => true) => {
      let best = null, bd = REACH;
      for (const o of list) { const d = dist(o, p); if (d <= bd && f(o)) { best = o; bd = d; } }
      return best;
    };
    // TATAY's fish waits on the table until the finale ("NOW THE FISH!"): it is the last thing you take, not the first
    const fishLater = (t) => t.scent && this.level.boss?.finale === 'carryOut' && f?.type !== 'carryOut';
    let o = near(this.targets, (t) => !t.done && !fishLater(t));
    if (o) return { kind: 'steal', obj: o, label: o.verb || o.profile.verb || 'KUPIT', detail: o.profile.tip };
    // BAGYO, TULO: lift a container, set it under a drip, empty it down the drain, or put it down
    const T = this.tulo;
    if (T && T.stage === 'leak') {
      const h = p.holding;
      if (!h) { const c = near(T.conts, (k) => !k.held); if (c) return { kind: 'buhat', obj: c, label: 'BUHAT' }; }
      else {
        let d = null, bd = REACH + 2;
        for (const dd of T.drips) { const e = dist(dd, p); if (e <= bd && !T.conts.some((k) => k.drip === dd)) { d = dd; bd = e; } }
        if (d) return { kind: 'sahod', obj: d, label: 'SAHOD' };
        if (h.fill > 0 && dist(T.drain, p) <= REACH + 4) return { kind: 'tapon', obj: T.drain, label: 'TAPON' };
        return { kind: 'baba', obj: null, label: 'BABA' };
      }
    }
    o = p.carry?.scent || p.holding ? null : near(this.hides); // (carrying the fish you cannot hide: you smell of it)
    if (this.breadBag && this.breadBag.cd <= 0 && !p.items.includes('pandesal') && dist(this.breadBag, p) <= REACH) return { kind: 'bread', obj: this.breadBag, label: 'PANDESAL' };
    if (o) return { kind: 'hide', obj: o, label: 'TAGO' };
    if (this.mods.cat) return null; // a cat has no hands: no doors, levers or TVs
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
      case 'bread': p.items.push('pandesal'); this.breadBag.cd = this.breadBag.every; this.emit({ type: 'pickup' }); break;
      case 'buhat': { const k = c.obj; k.held = true; k.drip = null; p.holding = k; this.emit({ type: 'lift', kind: k.kind, x: k.x, y: k.y }); break; }
      case 'sahod': { const k = p.holding; p.holding = null; k.held = false; k.x = c.obj.x; k.y = c.obj.y; k.drip = c.obj; this.emit({ type: 'place', kind: k.kind, x: k.x, y: k.y }); break; }
      case 'tapon': {
        const k = p.holding, d = c.obj, loud = !this.masked(d.x, d.y);
        if (loud) this.noise({ x: d.x, y: d.y, r: DUMP_R, lure: true });
        k.fill = 0;
        this.stats.dumps = (this.stats.dumps | 0) + 1;
        this.emit({ type: 'dump', x: d.x, y: d.y, loud });
        break;
      }
      case 'baba': { const k = p.holding; p.holding = null; k.held = false; k.x = p.x; k.y = p.y + 3; k.drip = null; this.emit({ type: 'place', kind: k.kind, x: k.x, y: k.y }); break; }
      case 'seat': this.sitting = { t: SIT_TIME }; this.emit({ type: 'sit' }); break;
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
        if (this.map.ch(tx, ty) === 'd') { this.map.set(tx, ty, 'D'); this.playerOpened.delete(key); this.emit({ type: 'door', x: c.obj.x, y: c.obj.y }); break; }
        if (this.locks.has(key)) { this.locks.delete(key); this.emit({ type: 'unlock' }); }
        this.map.set(tx, ty, 'd');
        this.playerOpened.add(key); // A5: a door Jun leaves open can be noticed
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
      case 'tabig': { // Mingming swats a cup off the counter in front of her: a crash that pulls people over
        if (p.hidden) return false;
        const [fx, fy] = p.facing(), m = Math.hypot(fx, fy) || 1;
        let d = 40;
        while (d > 10 && this.map.tileSolid(Math.floor((p.x + (fx / m) * d) / TILE), Math.floor((p.y + (fy / m) * d) / TILE), p.crawl)) d -= 6;
        const x = p.x + (fx / m) * d, y = p.y + (fy / m) * d;
        this.noise({ x, y, r: 84, lure: true });
        this.emit({ type: 'tabig', x, y });
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
    if (ph.videoke) for (const v of this.videokes) Object.assign(v, ph.videoke); // (a song with a clear chorus)
    if (ph.finale) {
      this.finale = { ...ph.finale, t: 0 };
      const f = this.finale, boss = this.adults[this.level.boss?.index ?? 0];
      if (f.type === 'photo') { f.noExit = true; f.count = f.countdown ?? 8; f.gathered = false; }
      if (f.type === 'seat') { f.seatPt = { x: f.seat[0] * TILE + TILE / 2, y: f.seat[1] * TILE + TILE / 2 }; f.noExit = true; f.plateN = 0; f.lastI = boss?.i; f.lastSeen = -9; }
      if (f.type === 'tulo' && this.tulo) { f.noExit = true; f.stage = 'gather'; f.goal = this.tulo.box; }
    }
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
    this.projectiles.push({ kind, x: p.x, y: p.y - 2, vx: (fx / m) * THROW_SPEED, vy: (fy / m) * THROW_SPEED, d: 0, origin: { x: p.x, y: p.y } });
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
      this.noise({ x: pr.x, y: pr.y, r: 90, lure: true, thrown: true, origin: pr.origin }); // (the third time, they look where it came from)
      this.items.push({ x: pr.x, y: pr.y, kind: pr.kind, noPickT: 1, thrown: true }); // (an adult who comes to look takes it)
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
        if (nz.tattle && nz.from?.type === 'tindera' && a.type === 'mama') this.stats.gossip = (this.stats.gossip | 0) + 1; // (mission noGossip)
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
      if (ph < dt) { this.emit({ type: 'lightning' }); this.flashT = 0.3; }
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
    if (this.pushAnim && (this.pushAnim.t -= dt) <= 0) this.pushAnim = null;
    if (p.hidden && p.hideT > 0 && (p.hideT -= dt) <= 0) this.interact({ kind: 'unhide' });
    this.noises.length = 0;

    if (this.sitting) input = { ...input, mv: { x: 0, y: 0, mag: 0, run: false }, actionPressed: false };
    // --- actions
    let ctx = this.context();
    if (p.hidden && input.mv.mag > 0.6) { this.interact({ kind: 'unhide' }); ctx = this.context(); }
    else if (input.actionPressed && ctx && ctx.kind !== 'steal') {
      const key = ctx.kind === 'door' ? ctx.obj.tx + ',' + ctx.obj.ty : null;
      if (key && this.creaky.has(key) && map.ch(ctx.obj.tx, ctx.obj.ty) === 'D' && !this.locks.has(key)) this.doorHold = { obj: ctx.obj, key, t: 0 };
      else { this.interact(ctx); ctx = this.context(); }
    }
    if (this.doorHold) this.holdDoor(dt, input, ctx);
    this.prompt = ctx;
    const stealing = !p.hidden && input.action && ctx?.kind === 'steal';
    p.stealing = stealing; // drawn with the 'reach' pose
    if (input.cyclePressed) this.cycleItem();
    for (const k of this.kids || [p]) {
      const on = !!k.crawl && k.crawl.has(map.ch(k.tx, k.ty));
      if (this.mods.cat) { k.up = on; k.under = false; } // SI MINGMING: up on the furniture (seen from about half as far)
      else k.under = on;                                 // MALIIT: Bing under a table or bed
    }
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

    // --- player move (BAGYO: wading through the flood and carrying a container both slow you down)
    let slow = 1;
    if (p.holding) slow *= p.holding.fill >= 1 ? 0.7 : 0.82;
    p.wading = this.depthAt(p.tx, p.ty);
    if (p.wading) slow *= p.wading === 2 ? 0.45 : 0.7;
    p.slowMul = slow;
    const n = p.update(dt, map, input.mv, stealing || !!p.hidden);
    if (p.holding) { p.holding.x = p.x; p.holding.y = p.y; }
    if (this.tulo) this.tuloAfterMove(dt);
    if (this.flood && p.moving && p.wading && (this.flood.wadeT -= dt) <= 0) { // splash, splash
      this.flood.wadeT = 0.42;
      if (!this.masked(p.x, p.y)) this.noise({ x: p.x, y: p.y, r: p.wading === 2 ? 44 : 32 });
      this.emit({ type: 'wade', x: p.x, y: p.y, deep: p.wading === 2 });
    }
    this.pushBags(dt, input.mv);
    // crowd blending: walking right beside a party guest, you are just another kid at the fiesta
    p.blend = !p.hidden && !p.running && !(p.dashT > 0) && this.adults.some((a) => a.cfg.cover && !a.cfg.vehicle && dist(a, p) < BLEND_R);
    this.cover = this.masked(p.x, p.y);
    if (p.running) { this.stats.runT += dt; if (!this.cover) this.stats.loudRunT += dt; }
    // IBALIK: pockets full of coins still to put back jingle when you run
    if (n && this.level.giveBack && this.level.quota - this.coins > 0) {
      n.r += JINGLE_R;
      if ((this.jingleT = (this.jingleT ?? 0) - dt) <= 0) { this.jingleT = 0.4; this.emit({ type: 'jingle' }); }
    }
    if (n) {
      n.cont = true; // running: a sound every frame, so its effect is per second
      this.noises.push(n);
      if ((this.runRingT -= dt) <= 0) { this.emit({ type: 'ring', x: n.x, y: n.y, r: n.r, lure: false }); this.runRingT = 0.35; }
    }

    // --- carrying the milk: run, dash or get knocked over and it spills (and goes back where it came from)
    if (p.carry && !p.carry.noSpill && (p.running || p.dashT > 0 || p.stunT > 0)) this.spill();

    // --- scent trail
    // (TATAY's boss: before the finale the dog follows Jun himself; once the fish is in his hands, only the fish)
    const fishTrail = this.scentOnly && p.carry?.scent;
    if (!p.hidden && (this.trailT -= dt) <= 0 && (!this.scentOnly || fishTrail || this.finale?.type !== 'carryOut')) {
      this.trail.push({ x: p.x, y: p.y, t: this.time });
      if (this.trail.length > 40) this.trail.shift();
      this.trailT = fishTrail ? (p.running ? 0.25 : 0.5) : 0.4; // (the fish: running leaves twice the scent)
    }
    if (this.breadBag && this.breadBag.cd > 0) this.breadBag.cd -= dt;

    // --- stealing: every stash sounds different (see TARGET_KINDS); a light sleeper nearby stirs as you rummage
    if (stealing) {
      for (const a of this.adults) {
        if (!a.cfg.lightSleeper || a.awake || dist(a, p) >= 56) continue;
        if (a.cfg.depth) a.depth -= dt * 0.06; else a.t += dt * 1.5;
        if (a.cfg.depth && a.depth <= 0) a.hear({ x: p.x, y: p.y, r: 60 }, 0);
      }
    }
    for (const t of this.targets) {
      if (t.flinch > 0) t.flinch -= dt;
      if (stealing && t === ctx.obj && t.profile.calm && this.thunder) { t.flinch = 0.6; continue; } // BAGYO: Mingming will not come while it thunders
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
          if (t.then && !t.thenDone) { t.thenDone = true; this.applyPhase(t.then); } // e.g. "ASO SMELLS THE FISH!"
          if (t.kind === 'ibalik') { // put back: was its owner right there? (mission underNose)
            const o = this.adults.find((a) => a.type === t.owner);
            t.ownerNear = !!o && dist(o, t) < 6 * TILE;
            if (o && t.ownerNear && o.awake && !o.say) o.talk('SALAMAT...', 1.6); // she mumbles, half asleep (the near-miss)
          }
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
      if ((d.pulse -= dt) <= 0) { this.noise({ x: d.x, y: d.y, r: d.r, lure: true, again: d.caught > 0 }); d.pulse = DEVICE_PULSE; } // (A4: on again after someone switched it off)
      if (d.t >= d.dur) d.on = false;
    }
    for (const s of this.switches) if (s.timer > 0 && (s.timer -= dt) <= 0) this.toggleSwitch(s, false);
    for (const [key, [tx, ty]] of this.pendingGates) if (!this.occupied(tx, ty)) { this.map.set(tx, ty, 'G'); this.pendingGates.delete(key); }

    // --- light (night levels): how far each kid can be seen from this frame
    if (this.flashT > 0) this.flashT -= dt;
    if (this.level.night) {
      this.lights = lightSources(this);
      for (const k of this.kids || [p]) k.darkMul = sightMul(this, this.lights, k);
    }

    // --- adults
    let catcher = null;
    for (const a of this.adults) {
      const wasChasing = a.state === 'chase';
      a.update(dt, this);
      if (!wasChasing && a.state === 'chase') this.spotted++;
      this.maxAlert = Math.max(this.maxAlert, a.alert);
      if (a.cfg.vehicle) this.trikeHit(a);
      if (a.caught && this.god) { a.caught = false; a.state = 'search'; a.searchT = 1; a.alert = 0.5; this.player.graceT = Math.max(this.player.graceT || 0, 1); } // (god mode: the same moment of grace a real catch gives)
      if (a.caught && !catcher) catcher = a;
    }
    this.chatter(dt);
    this.stagedBeat(dt);
    this.finaleUpdate(dt);
    this.tuloUpdate(dt);
    this.floodUpdate(dt);
    this.ninangCall(dt);
    this.checkPuddles(dt);
    this.escortUpdate(dt);
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

    if (this.open && !p.hidden && dist(p, this.exit) < 10 && !this.escortHere && !this.waitedCat) { this.waitedCat = true; this.talk('MINGMING, DITO!', 1.4); }
    if (this.open && !p.hidden && dist(p, this.exit) < 10 && this.escortHere && !this.finale?.noExit) {
      if (this.kids && this.kids.some((k) => k !== p && !k.out)) { // one is out: now bring the other
        p.out = true;
        this.emit({ type: 'teamOut', who: this.mods.charId });
        this.swap(true);
      } else this.finish();
    }
  }

  // ---- BAGYO, Act 2: TULO ----------------------------------------------------------------------------------------
  // Drips start one by one over the box. A drop into a container fills it a little; into a full one it overflows
  // (a splash anyone near can hear); onto the floor by the box it soaks the box. A soaked box: the kittens cry.
  tuloUpdate(dt) {
    const T = this.tulo;
    if (!T || T.stage !== 'leak') return;
    T.t += dt;
    for (const d of T.drips) {
      if (!d.on && T.t >= d.startAt) { d.on = true; this.emit({ type: 'dripOn', x: d.x, y: d.y }); }
      if (!d.on) continue;
      d.fallT += dt;
      if ((d.dropT -= dt) > 0) continue;
      d.dropT = DROP_EVERY; d.fallT = 0;
      const k = T.conts.find((c) => c.drip === d);
      if (k && k.fill < 1) {
        k.fill = Math.min(1, k.fill + 1 / k.cap);
        if (k.fill >= 1) this.emit({ type: 'full', kind: k.kind, x: k.x, y: k.y });
        this.emit({ type: 'drip', x: d.x, y: d.y, into: k.kind });
        continue;
      }
      if (k) { // overflowing
        if (!this.masked(k.x, k.y)) this.noise({ x: k.x, y: k.y, r: 40 });
        this.emit({ type: 'overflow', x: k.x, y: k.y });
      }
      if (dist(d, T.box) <= BOX_R) {
        T.wet = Math.min(1, T.wet + 1 / T.wetCap);
        this.emit({ type: 'wet', x: T.box.x, y: T.box.y, wet: T.wet });
      }
      this.emit({ type: 'drip', x: d.x, y: d.y, into: null });
    }
    if (T.wet >= 1 && (T.cryT -= dt) <= 0) { // the kittens are soaked and crying
      T.cryT = 2.6;
      if (!this.masked(T.box.x, T.box.y)) this.noise({ x: T.box.x, y: T.box.y, r: 70, lure: true });
      this.emit({ type: 'cry', x: T.box.x, y: T.box.y });
    }
    if (T.t >= T.dur) { T.stage = 'done'; this.startFlood(); }
  }
  // Running with water in a container sloshes it out (and makes a noise).
  tuloAfterMove() {
    const k = this.player.holding;
    if (!k || !this.player.running || k.fill < 0.25) return;
    if (!this.masked(k.x, k.y)) this.noise({ x: k.x, y: k.y, r: 50, lure: true });
    k.fill = 0;
    this.talk('NATAPON!', 1.2);
    this.emit({ type: 'slosh', x: k.x, y: k.y });
  }

  // ---- BAGYO, Act 3: BAHA ------------------------------------------------------------------------------------------
  startFlood() {
    const F = this.flood, T = this.tulo, p = this.player;
    if (!F || F.active) { this.finale = null; return; }
    F.active = true; F.tick = 0;
    this.finale = { type: 'flood', t: 0 }; // the exit is open again: get them inside
    if (T) {
      T.scooped = true;
      for (const c of T.conts) { c.held = false; c.drip = null; }
      if (p.holding) { p.holding.x = p.x; p.holding.y = p.y + 3; p.holding = null; }
    }
    this.escapeT = F.escape;
    for (const m of F.adults) { const a = this.adults[m.index]; if (a) { a.retune(m); a.alert = 0; a.state = 'patrol'; } }
    this.emit({ type: 'flood' });
    this.emit({ type: 'phase', text: F.banner || 'BAHA! STOP THE WATER!', n: this.phase });
  }
  // The water comes in at every breach that is not sandbagged and spreads a tile a tick (closed doors hold it).
  // Water that has stood a while next to deep water gets deep. Once every breach is sealed, it all drains away.
  floodUpdate(dt) {
    const F = this.flood;
    if (!F?.active) return;
    const W = this.map.w, H = this.map.h, D = F.depth;
    F.t += dt;
    for (let i = 0; i < D.length; i++) if (D[i]) F.wetT[i] += dt;
    if ((F.tick -= dt) > 0) return;
    F.tick = F.spread;
    const live = F.sources.filter((s) => !s.sealed);
    if (!live.length) {
      if (!F.stopped) { F.stopped = true; this.emit({ type: 'floodStopped' }); this.emit({ type: 'phase', text: 'NATIGIL ANG BAHA!', n: this.phase }); }
      for (let i = 0; i < D.length; i++) if (D[i]) { D[i]--; if (!D[i]) F.wetT[i] = 0; }
      return;
    }
    for (const s of live) D[s.ty * W + s.tx] = 2;
    const add = [], deep = [];
    const open = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !this.map.tileSolid(x, y);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!D[i]) continue;
      if (this.map.tileSolid(x, y)) { D[i] = 0; continue; } // a sandbag landed on it
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, j = ny * W + nx;
        if (!open(nx, ny)) continue;
        if (!D[j]) add.push(j);
        else if (D[i] === 2 && D[j] === 1 && F.wetT[j] >= F.deepAfter) deep.push(j);
      }
    }
    for (const j of add) D[j] = 1;
    for (const j of deep) D[j] = 2;
  }

  // Lean into a sandbag (lined up with it, pushing along a row or column) and it slides one tile, if the tile beyond
  // is clear. Slid into a breach, it seals it.
  pushBags(dt, mv) {
    const p = this.player;
    if (p.hidden || p.holding || !mv || mv.mag < 0.5) { this.pushT = 0; return; }
    const horiz = Math.abs(mv.x) >= Math.abs(mv.y);
    if (Math.abs(horiz ? mv.x : mv.y) < 0.75) { this.pushT = 0; return; }
    const dx = horiz ? Math.sign(mv.x) : 0, dy = horiz ? 0 : Math.sign(mv.y);
    const tx = Math.floor((p.x + dx * (p.r + 2)) / TILE), ty = Math.floor((p.y + dy * (p.r + 2)) / TILE);
    if (this.map.ch(tx, ty) !== 'Q') { this.pushT = 0; return; }
    const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2;
    if (horiz ? Math.abs(p.y - cy) > 6 : Math.abs(p.x - cx) > 6) { this.pushT = 0; return; }
    if ((this.pushT += dt) < PUSH_T) return;
    this.pushT = 0;
    const nx = tx + dx, ny = ty + dy, c = this.map.ch(nx, ny);
    const busy = this.occupied(nx, ny) || 'dDgG'.includes(c) || (this.exit.tx === nx && this.exit.ty === ny)
      || [...this.targets, ...this.hides, ...this.items].some((o) => Math.floor(o.x / TILE) === nx && Math.floor(o.y / TILE) === ny && !o.done)
      || (this.tulo && [this.tulo.box, this.tulo.drain, ...this.tulo.drips].some((o) => o.tx === nx && o.ty === ny));
    if (this.map.tileSolid(nx, ny) || busy) { this.emit({ type: 'pushBlocked', x: cx, y: cy }); return; }
    this.map.set(tx, ty, this.underBag.get(tx + ',' + ty) || ';');
    this.underBag.delete(tx + ',' + ty);
    this.underBag.set(nx + ',' + ny, c);
    this.map.set(nx, ny, 'Q');
    this.pushAnim = { tx: nx, ty: ny, dx, dy, t: 0.16 };
    if (!this.masked(cx, cy)) this.noise({ x: cx, y: cy, r: PUSH_R });
    this.stats.pushes = (this.stats.pushes | 0) + 1;
    this.emit({ type: 'push', x: nx * TILE + 8, y: ny * TILE + 8 });
    const F = this.flood, src = F?.sources.find((s) => s.tx === nx && s.ty === ny && !s.sealed);
    if (src) {
      src.sealed = true; F.depth[ny * this.map.w + nx] = 0;
      this.emit({ type: 'seal', x: src.x, y: src.y, left: F.sources.filter((s) => !s.sealed).length });
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
    if (t.noSpill) { t.done = false; t.progress = 0; t.started = false; return; } // (the fish goes back to its plate)
    this.stats.spills++;
    this.puddles.push({ x: p.x, y: p.y, t: 0, found: false }); // it leaves a puddle someone may find
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
    if (a.type === 'tanod') this.stats.tanod = (this.stats.tanod | 0) + 1; // (outside: this is what gets back home)
    if (this.player.holding) { const k = this.player.holding; k.held = false; k.drip = null; this.player.holding = null; } // (TULO: you drop it)
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
    // a doorway checkpoint whose door someone has shut since (A5): you come back standing in it, so it is open again
    if (this.map.ch(p.tx, p.ty) === 'D') this.map.set(p.tx, p.ty, 'd');
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
    if (t.owner) { // was the owner busy elsewhere (in the shower) when this coin went? (mission ligo)
      const o = this.adults.find((a) => a.type === t.owner);
      if (o) { if (o.busy?.name === 'SHOWERING') t.whileAway = (t.whileAway | 0) + 1; else t.notAway = (t.notAway | 0) + 1; }
    }
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
      sobra: this.sobra, emptied, takenBy: this.takenBy(), spills: this.stats.spills, tattles: this.stats.tattles, palusot: this.stats.palusot,
      evidence: this.stats.evidence, tanod: this.stats.tanod | 0, photo: this.photo || null }; // things left behind that someone found (a slipper, an open door, a puddle)
    this.emit({ type: 'clear' });
  }

  // ---- dev helpers (used by the dev menu and tests)
  devFillQuota() { this.coins = Math.max(this.coins, this.level.quota); for (const t of this.targets) if (t.must) t.done = true; }
  // Drop the player on a free tile next to the exit (walk in to finish).
  devGoToExit() {
    if (this.finale?.type === 'tulo') { if (this.tulo) this.tulo.stage = 'done'; this.startFlood(); } // (BAGYO: past the leaks, the flood starts)
    const e = this.exit;
    const side = [[-1, 0], [1, 0], [0, -1], [0, 1]].find(([dx, dy]) => !this.map.tileSolid(e.tx + dx, e.ty + dy));
    const [dx, dy] = side || [0, 0];
    for (const p of this.kids || [this.player]) { // (tag-team: both kids)
      p.hidden = null; p.hideT = 0;
      p.x = e.x + dx * TILE; p.y = e.y + dy * TILE;
    }
    if (this.escort) { this.escort.x = this.player.x; this.escort.y = this.player.y; this.escort.trail = []; } // (Mingming comes too)
    if (this.finale?.type === 'photo' && this.hides.length) { const h = this.hides[0]; this.player.x = h.x; this.player.y = h.y; this.player.hidden = h; for (const a of this.adults) a.sawHide = false; this.finale.gathered = true; this.finale.count = 0.05; } // (the photo: out of sight at the flash)
    if (this.finale?.type === 'seat') { const s = this.finale.seatPt; this.player.x = s.x; this.player.y = s.y; this.finale.lastSeen = -9; this.sitting = { t: SIT_TIME }; } // (the seat finale: sit down)
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
