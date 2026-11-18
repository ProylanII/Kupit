// Draws a World and turns its events into sound/particles. All rules live in game/world.js.
import { TILE } from '../world/tilemap.js';
import { angDiff } from '../world/los.js';
import { DARK_MUL, BROWNOUT_MUL, inLight } from '../world/light.js';
import { World } from '../game/world.js';
import { buildBackground, drawLaundry, drawTallTop } from '../render/tiles.js';
import { drawActor, drawTarget, drawCoin, drawObj, drawPortrait, getSprite, drawStar, KEY_COLORS } from '../render/sprites.js';
import { MISSIONS, missionLabel } from '../game/missions.js';
import { C, hexToRgb } from '../render/palette.js';
import { drawText, textWidth, drawBig, bigWidth, wrapBig, drawBigBand } from '../ui/font.js';
import { sfx } from '../core/audio.js';
import { dev } from '../core/dev.js';
import { vibrate, canVibrate, hapticsOn } from '../core/haptics.js';
import { settings } from '../core/settings.js';
import { GHOST_EVERY, ghostAt } from '../game/ghost.js';
import { VIEW_W, VIEW_H, MAP_H as STRIP_Y, EXTRA, BASE_H, MAX_EXTRA, BUTTON, BUTTON2, PAUSE_BTN, ABILITY_BTN, ITEM_BTN, SWAP_BTN, layout } from '../core/input.js';
import { CHARACTERS } from '../game/progression.js';
import { Coach, COACHED_TIPS } from '../game/tutorial.js';

// The map window: the play area above the control strip (which starts at STRIP_Y). MAP_H is the window's height and
// TOP its distance from the top of the screen; both follow the screen and the level (Play.syncView). A map that fits
// sits right on the control strip, and the room above it (a tall phone) holds the top bar, so nothing covers the
// map; a scrolling map gets everything below the top bar's band. On a desktop TOP is 0 and MAP_H 352, as designed.
let MAP_H = 352, TOP = 0;
const HUD_BAND = 30;  // the top bar, the KAIN NA / boss bars and a one-line tip
const HUD_FULL = 44;  // ...and a two-line tip

const YELLOW = hexToRgb(C.yellow), RED = hexToRgb(C.red);
const SUSPICIOUS = new Set(['investigate', 'inspect', 'search']);

function disc(g, cx, cy, r, color) {
  g.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(r * r - dy * dy));
    g.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

// Midpoint circle outline, dashed for pixel-art "sound ring". step: draw every n-th point.
function ring(g, cx, cy, r, color, step = 2) {
  g.fillStyle = color;
  let x = r, y = 0, err = 1 - r, i = 0;
  while (x >= y) {
    if ((i++ % step) === 0) {
      for (const [px, py] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) g.fillRect(cx + px, cy + py, 1, 1);
    }
    y++;
    if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
  }
}

function bubble(g, text, cx, y, camX, fg = C.ink, bg = C.white) {
  const w = textWidth(text) + 4;
  const x = Math.max(camX + 1, Math.min(camX + VIEW_W - w - 1, Math.round(cx - w / 2)));
  g.fillStyle = C.ink; g.fillRect(x - 1, y - 1, w + 2, 9);
  g.fillStyle = bg; g.fillRect(x, y, w, 7);
  drawText(g, text, x + 2, y + 1, fg);
}

// Drop dead entries in place (no new arrays every frame).
function keep(list, alive) {
  let k = 0;
  for (const e of list) if (alive(e)) list[k++] = e;
  list.length = k;
}

// Point on the map-view edge in the direction of (sx, sy) (screen coords), inset by m pixels.
function edgePoint(sx, sy, m) {
  const cx = VIEW_W / 2, cy = MAP_H / 2, dx = sx - cx, dy = sy - cy;
  const k = Math.min((VIEW_W / 2 - m) / Math.abs(dx || 1e-6), (MAP_H / 2 - m) / Math.abs(dy || 1e-6));
  return { x: Math.round(cx + dx * k), y: Math.round(cy + dy * k), dx, dy };
}

// One-time tips, shown at the top of the screen (never under your thumbs). id -> text or (play) => text.
const TIPS = {
  hide: 'A HIDING SPOT! PRESS ACT TO HIDE. MOVE TO COME OUT',
  throw: (p) => (p.touch ? 'TSINELAS! HOLD THE BLUE BUTTON, SLIDE TO A SPOT, LET GO' : 'TSINELAS! PRESS Q, POINT WITH THE MOUSE, CLICK'),
  pandesal: 'PANDESAL! THROW IT NEAR ASO TO KEEP HIM BUSY',
  cycle: (p) => (p.touch ? 'TWO KINDS OF ITEMS: TAP THE SMALL DOT TO SWITCH' : 'TWO KINDS OF ITEMS: R SWITCHES WHICH ONE'),
  skill: (p) => `SKILL READY: ${p.world.mods.skill.label}! ${p.touch ? 'GREEN BUTTON' : 'PRESS F'}`,
  door: 'DOORS BLOCK SIGHT. ACT OPENS AND CLOSES THEM',
  creaky: 'CREAKY DOOR! HOLD ACT TO OPEN IT SLOWLY AND QUIETLY',
  locked: 'LOCKED! FIND THE KEY OF THE SAME COLOR',
  switch: 'LEVERS OPEN GATES. SOME SHUT AGAIN SOON',
  device: 'TV OR RADIO: TURN IT ON TO PULL ADULTS AWAY',
  thunder: 'THUNDER COVERS YOUR NOISE. RUN WHILE IT ROLLS!',
  videoke: 'VIDEOKE! WHILE THEY SING, NOBODY HEARS YOU',
  blend: 'WALK BESIDE A GUEST: YOU BLEND INTO THE CROWD',
  laundry: 'LAUNDRY HIDES YOU. NOBODY SEES THROUGH IT',
  routine: 'BUSY ADULTS SEE LESS. WATCH WHAT THEY ARE DOING',
  kain: 'KAIN NA BAR: GET OUT BEFORE DINNER TIME!',
  caught: 'CLOSE CALL: DROPPED COINS GO BACK TO THEIR STASH',
  dog: 'ASO BARKS WHEN HE SEES YOU. PANDESAL BRIBES HIM',
  tanod: "TANOD'S FLASHLIGHT SWEEPS. HIS WHISTLE CALLS ALL",
  tindera: 'TINDERA SHOUTS, BUT NEVER LEAVES HER STALL',
  bisita: 'GUESTS BLOCK THE VIEW. WALK WITH ONE TO BLEND IN',
  trike: 'TRICYCLE! IT KNOCKS YOU DOWN. TIME YOUR CROSSING',
  seenHide: 'THEY SAW YOU HIDE! THE EYE MEANS: NOT SAFE HERE',
  sapat: 'THAT IS ENOUGH. EXTRA COINS (SOBRA) CLINK LOUDER',
  emptied: 'EMPTY! THE LAST COIN MAKES A LOUD KLAK',
  holen: 'HOLEN! IT ROLLS ON, TICKING. DOGS IGNORE IT',
  panyo: 'PANYO: THE HANDKERCHIEF MUFFLED IT. ONCE A LEVEL',
  medyas: 'MEDYAS: IN SOCKS THE CREAKY BOARD STAYS QUIET',
  maliit: 'UNDER HERE ONLY SOMEONE RIGHT NEXT TO YOU SEES YOU',
  palusot: 'KUYA RAMIL TALKED YOU OUT OF IT. ONCE A LEVEL',
  team: 'TWO OF YOU: Z (OR THE PURPLE BUTTON) SWITCHES KIDS',
  dark: 'IN THE DARK THEY ONLY SEE YOU UP CLOSE. AVOID LIGHT',
  cat: 'UP ON A TABLE OR SOFA THEY SEE YOU FROM HALF AS FAR',
  tabig: (p) => (p.touch ? 'SWAT: THE GREEN BUTTON KNOCKS A CUP OFF. IT PULLS THEM AWAY' : 'SWAT: F KNOCKS A CUP OFF. IT PULLS THEM AWAY'),
  tulo: 'LIFT A CONTAINER, CATCH A DRIP WITH IT, DUMP IT WHEN FULL',
  tapon: 'EMPTY IT DOWN THE DRAIN. DO IT IN THE THUNDER: NOBODY HEARS',
  baha: 'WALK INTO A SANDBAG TO PUSH IT. PUSH IT INTO THE BROKEN KANAL',
  mingming: 'MINGMING ONLY COMES WHEN IT IS QUIET. WAIT FOR THE THUNDER TO PASS',
};

// Tips about a button ring that button while they show: [button, hold?]
const TIP_BUTTONS = { tulo: ['act'], tabig: ['skill'], hide: ['act'], door: ['act'], creaky: ['act', true], switch: ['act'], device: ['act'], throw: ['throw', true], pandesal: ['throw', true], skill: ['skill'] };

export class Play {
  // opts: { tips: { seen, mark(id) }, ghost: samples | null, outfit: 'pula', record: true }
  constructor(level, input, loadout, opts = {}) {
    this.input = input;
    this.world = new World(level, loadout);
    this.level = level;
    this.opts = opts;
    this.look = opts.outfit && opts.outfit !== 'basic' && !this.world.mods.cat ? `${this.world.mods.look}~${opts.outfit}` : this.world.mods.look;
    this.drops = [];   // BAGYO: water drops falling from the floor above, splashes
    this.bg = buildBackground(this.world.map, { night: !!level.night, pasko: !!level.pasko });
    this.parts = [];
    this.rings = [];
    this.pings = [];   // off-screen noises
    this.windups = []; // tattle shouts charging up
    this.tickT = 0;
    this.banner = level.boss ? { kind: 'boss', text: level.boss.title || level.name, t: 3 } : null;
    this.coneData = new ImageData(VIEW_W, BASE_H + MAX_EXTRA);
    this.coneCv = document.createElement('canvas');
    this.coneCv.width = VIEW_W; this.coneCv.height = BASE_H + MAX_EXTRA;
    this.coneG = this.coneCv.getContext('2d');
    input.buttonEnabled = true;
    this.cam = { x: 0, y: 0 };
    this.shake = 0; this.flash = 0; this.pulse = 0; this.pulseCol = C.red;
    this.dust = []; this.dustT = 0; this.lastDraw = 0;
    this.toast = null; // short centred message (coins lost, alkansya found)
    this.tip = null;
    this.tipQ = [];
    this.steps = 0;
    this.rec = opts.record ? [] : null; // ghost recording
    this.ghost = opts.ghost && opts.ghost.length ? opts.ghost : null;
    this.actors = [];
    this.castT = 0;          // kid's skill pose
    this.barks = new Map();  // adult -> seconds left of the bark pose
    this.notes = [];         // music notes floating up from a videoke
    // kittens trotting after you (the epilogue, and Tigre once the story is over): they follow your footsteps
    this.crumbs = [];
    this.kittens = Array.from({ length: opts.kitten | 0 }, (_, i) => ({ x: this.world.player.x, y: this.world.player.y, look: ['tigre', 'puti', 'muning'][i % 3], dir: 0, stepT: 0, moving: false }));
    // the tutorial coach (L1): one step at a time, an arrow on the thing to use, a ring on the button to press
    this.coach = level.tutorial ? new Coach(this.world) : null;
    this.coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches; // a phone, before the first touch
    this.cardT = level.tutorial || level.hingi || opts.noCard ? 0 : 5; // the mission card (campaign: shown before the level instead)
    // cats that simply live in this room (the epilogue: Mingming asleep on the rug)
    this.cats = (level.cats || []).map((c) => ({ look: c.kind || 'pusa', x: c.at[0] * TILE + TILE / 2, y: c.at[1] * TILE + TILE / 2, dir: c.dir ?? 2, pose: c.pose || 'sit' }));
    this.syncView();
    this.updateCamera(1);
  }

  // Where the map window sits this frame (see MAP_H / TOP at the top of this file), and the top bar (hudY, screen y).
  syncView() {
    const mh = this.world.map.h * TILE;
    if (mh + HUD_BAND <= STRIP_Y) { TOP = STRIP_Y - mh; MAP_H = mh; }
    else { TOP = Math.min(EXTRA, HUD_BAND); MAP_H = STRIP_Y - TOP; }
    this.hudY = TOP >= HUD_FULL ? TOP - HUD_FULL : TOP >= HUD_BAND ? TOP - HUD_BAND : 0;
  }

  // Follow the player; maps bigger than the 240x352 view scroll, smaller ones stay put.
  updateCamera(k) {
    const p = this.world.player, m = this.world.map;
    const tx = Math.max(0, Math.min(m.w * TILE - VIEW_W, p.x - VIEW_W / 2));
    const ty = Math.max(0, Math.min(m.h * TILE - MAP_H, p.y - MAP_H / 2));
    this.cam.x += (tx - this.cam.x) * Math.min(1, k);
    this.cam.y += (ty - this.cam.y) * Math.min(1, k);
  }

  get scrolls() { const m = this.world.map; return m.w * TILE > VIEW_W || m.h * TILE > MAP_H; }

  get status() { return this.world.status; }
  get result() { return this.world.result; }
  get catcher() { return this.world.catcher; }
  get reason() { return this.world.reason; }

  // Phone buzz, or a coloured screen-edge pulse where vibration isn't available (or is turned off).
  buzz(pattern, col = C.red) {
    const did = vibrate(pattern);
    if (!did && settings.pulse) { this.pulse = 0.35; this.pulseCol = col; }
  }
  kick(n) { this.shake = Math.max(this.shake, n * settings.shake); }

  // ---------------------------------------------------------------- one-time tips
  showTip(id) {
    const seen = this.opts.tips?.seen;
    if (!seen || seen[id] || this.tipQ.includes(id) || this.tip?.id === id) return;
    if (this.coach) { if (COACHED_TIPS.has(id)) this.opts.tips.mark(id); return; } // the coach teaches these itself; the rest wait for later levels
    this.tipQ.push(id);
  }

  updateTips(dt) {
    const w = this.world, p = w.player, pr = w.prompt;
    if (this.opts.tips) {
      if (pr) {
        if (pr.kind === 'hide') this.showTip('hide');
        else if (pr.kind === 'door') this.showTip(w.creaky.has(pr.obj.tx + ',' + pr.obj.ty) && w.map.ch(pr.obj.tx, pr.obj.ty) === 'D' ? 'creaky' : 'door');
        else if (pr.kind === 'locked') this.showTip('locked');
        else if (pr.kind === 'switch') this.showTip('switch');
        else if (pr.kind === 'device') this.showTip('device');
        else if (pr.kind === 'steal') this.showTip(`kind:${pr.obj.kind}`);
      }
      if (new Set(p.items).size > 1) this.showTip('cycle');
      if (w.time > 2 && !this.level.tutorial && w.abilityCd <= 0) this.showTip('skill');
      if (w.patience && w.time > 1) this.showTip('kain');
      if (this.level.night && w.time > 1.5 && !w.mods.cat) this.showTip('dark');
      if (w.mods.cat && w.time > 0.5) { this.showTip('cat'); if (w.time > 5) this.showTip('tabig'); }
      if (pr?.kind === 'steal' && pr.obj.kind === 'mingming') this.showTip('mingming');
      if (pr?.kind === 'buhat' || pr?.kind === 'sahod') this.showTip('tulo');
      if (pr?.kind === 'tapon') this.showTip('tapon');
      if (w.flood?.active) this.showTip('baha');
      if (w.time > 0.5) for (const a of w.adults) {
        if (a.type === 'aso') this.showTip('dog');
        else if (['tanod', 'tindera', 'bisita', 'trike'].includes(a.type)) this.showTip(a.type);
      }
      if (p.hidden && w.adults.some((a) => a.sawHide)) this.showTip('seenHide');
    }
    if (this.tip && (this.tip.t -= dt) <= 0) this.tip = null;
    if (!this.tip && this.tipQ.length) {
      const id = this.tipQ.shift();
      const t = id.startsWith('kind:') ? w.targets.find((x) => x.kind === id.slice(5))?.profile.tip : TIPS[id];
      const text = typeof t === 'function' ? t(this) : t;
      if (text) { this.tip = { id, text, t: 4 }; this.opts.tips.mark(id); }
    }
  }

  update(dt) {
    const w = this.world;
    this.syncView();
    this.input.button2Enabled = w.player.items.length > 0 && !w.noThrow;
    this.input.abilityEnabled = true;
    this.input.swapEnabled = !!w.kids && w.kids.every((k) => !k.out); // KASABWAT
    this.input.itemEnabled = new Set(w.player.items).size > 1;
    const inp = this.input.poll();
    if (inp.aimAt) inp.aimAt = { x: inp.aimAt.x + this.cam.x, y: inp.aimAt.y - TOP + this.cam.y }; // (the aim is a point on screen)
    w.update(dt, inp);
    if (this.coach?.update(dt)) sfx.pickup(); // a tutorial step done
    this.steps++;
    this.cardT = Math.max(0, this.cardT - dt);
    this.updateKittens(dt);
    if (w.cover === 'videoke') this.showTip('videoke');
    if (w.player.blend) this.showTip('blend');
    if (w.player.under) this.showTip('maliit');
    if (w.kids && w.time > 1) this.showTip('team');
    if (w.map.ch(w.player.tx, w.player.ty) === 'L') this.showTip('laundry');
    if (w.time > 1 && w.adults.some((a) => a.busy && this.onScreen(a.x, a.y))) this.showTip('routine');
    for (const v of w.videokes) if (v.singing && this.onScreen(v.x, v.y, 20) && Math.random() < dt * 4) this.notes.push({ x: v.x + Math.random() * 16 - 8, y: v.y - 10, l: 1.2, k: Math.random() < 0.5 });
    for (const n of this.notes) { n.y -= 14 * dt; n.x += Math.sin(n.l * 6) * 10 * dt; n.l -= dt; }
    keep(this.notes, (n) => n.l > 0);
    if (this.rec && this.steps % GHOST_EVERY === 0 && w.status === 'play') this.rec.push([w.player.x, w.player.y, !!w.player.hidden]);
    this.updateCamera(dt * 9);
    for (const e of w.events) this.onEvent(e, dt);
    w.events.length = 0;
    this.updateTips(dt);
    // playtest log: standing still for a while usually means a puzzled player
    const pp = w.player;
    if (this.opts.log && w.status === 'play' && !w.scold) {
      if (pp.moving || pp.stealing || pp.hidden) this.stillT = 0;
      else if ((this.stillT = (this.stillT || 0) + dt) > 6) { this.stillT = -30; this.opts.log({ type: 'idle' }, w); }
    }
    const pl = w.player;
    if ((pl.running || pl.dashT > 0) && !pl.hidden && (this.dustT -= dt) <= 0) {
      this.dust.push({ x: pl.x + Math.random() * 6 - 3, y: pl.y + 4, vx: Math.random() * 10 - 5, l: 0.45 });
      this.dustT = 0.06;
    }
    for (const d of this.dust) { d.x += d.vx * dt; d.y -= 6 * dt; d.l -= dt; }
    keep(this.dust, (d) => d.l > 0);
    for (const p of this.parts) { p.y += p.vy * dt; p.vy += 90 * dt; p.l -= dt * 1.6; }
    for (const d of this.drops) { d.x += (d.vx || 0) * dt; d.y += d.vy * dt; d.vy += 300 * dt; d.l -= dt; }
    keep(this.drops, (d) => d.l > 0);
    if (this.cup && (this.cup.t -= dt) <= 0) this.cup = null;
    keep(this.parts, (p) => p.l > 0);
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
    if (this.toast && (this.toast.t -= dt) <= 0) this.toast = null;
    this.castT = Math.max(0, this.castT - dt);
    for (const [a, t] of this.barks) { if (t - dt <= 0) this.barks.delete(a); else this.barks.set(a, t - dt); }
    for (const r of this.rings) r.age += dt;
    keep(this.rings, (r) => r.age < (r.tattle ? 0.8 : 0.5));
    for (const r of this.pings) r.age += dt;
    keep(this.pings, (r) => r.age < 0.8);
    for (const u of this.windups) u.age += dt;
    keep(this.windups, (u) => u.age < u.t);
  }

  onScreen(x, y, pad = 0) {
    const sx = x - this.cam.x, sy = y - this.cam.y;
    return sx > -pad && sx < VIEW_W + pad && sy > -pad && sy < MAP_H + pad;
  }

  onEvent(e, dt) {
    const w = this.world;
    switch (e.type) {
      case 'ring':
        this.rings.push({ ...e, age: 0 });
        if ((e.lure || e.tattle) && !this.onScreen(e.x, e.y)) this.pings.push({ x: e.x, y: e.y, age: 0, tattle: e.tattle });
        break;
      case 'windup': this.windups.push({ who: e.who, r: e.r, t: e.t, age: 0 }); if (e.who.type === 'tanod') sfx.whistle(); break;
      case 'tattle': this.kick(2); break;
      case 'stealTick':
        if ((this.tickT -= dt) <= 0) { sfx.steal(); this.tickT = 0.22; }
        break;
      case 'stealNoise': ({ wallet: sfx.zipper, bayong: sfx.rustle, piggy: sfx.jingle, candy: sfx.jingle, alkansya: sfx.jingle, kuting: sfx.meow }[e.kind] || sfx.clasp)(); break;
      case 'coin':
        if (e.kind === 'purse' && e.first !== false) sfx.clasp();
        sfx.coin(e.k || 1); this.buzz(15, C.gold);
        for (let i = 0; i < e.n * 2; i++) this.parts.push({ x: e.x + (Math.random() * 14 - 7), y: e.y - 4, vy: -50 - Math.random() * 40, l: 1 });
        break;
      case 'lightning': if (settings.flash) this.bolt = 0.3; break;
      case 'videoke': if (this.onScreen(e.x, e.y, 40)) sfx.music(); break;
      case 'missionLost': // once per mission, so the stars are never a surprise on the clear screen
        if (!w.scold && w.status === 'play' && !this.level.hingi) this.toast = { text: `STAR LOST: ${missionLabel(this.level, e.id)}`, col: C.orange, t: 2.4 };
        break;
      case 'thunder': sfx.thunder(); this.kick(2); this.showTip('thunder'); break;
      case 'spill': sfx.ouch(); this.buzz(50); this.toast = { text: 'THE MILK SPILLED! GET IT AGAIN', col: C.orange, t: 2.4 }; break;
      case 'alkansya': this.toast = { text: `ALKANSYA! +${e.n} BONUS`, col: C.green, t: 2.2 }; break;
      case 'spotted': case 'bark':
        sfx.alert(); this.buzz(40); this.kick(2);
        if (e.type === 'bark') this.barks.set(e.who, 0.6);
        break;
      case 'caught':
        // In play a catch is a close call ("muntik na!"): an amber flash, never the red catch of the story ending.
        if (e.final) { sfx.sentBack(); this.buzz([80, 40, 140]); this.kick(6); if (settings.flash) this.flash = 0.6; }
        else {
          sfx.muntik(); this.buzz([60, 30, 60]); this.kick(4); if (settings.flash) this.flash = 0.45;
          this.toast = { text: e.lost ? `YOU DROPPED ${e.lost} ${e.lost === 1 ? 'COIN' : 'COINS'}` : 'NOTHING DROPPED', col: C.orange, t: 2.4 };
          this.showTip('caught');
        }
        break;
      case 'respawn': sfx.hide(); for (let i = 0; i < 10; i++) this.dust.push({ x: e.x + Math.random() * 12 - 6, y: e.y + Math.random() * 6, vx: Math.random() * 20 - 10, l: 0.6 }); break;
      case 'sapat': // the quota is met: that's enough
        sfx.sapat(); this.toast = { text: 'SAPAT NA! THAT IS ENOUGH', col: C.green, t: 2.2 }; this.showTip('sapat'); break;
      case 'emptied': sfx.klak(); this.showTip('emptied'); break;
      case 'roll': sfx.tick(); this.showTip('holen'); break;
      case 'panyo': sfx.hide(); this.showTip('panyo'); break;
      case 'swap': sfx.click(); this.showTip('team'); break;
      case 'teamOut': {
        const out = CHARACTERS[e.who]?.name || 'ONE', next = CHARACTERS[w.mods.charId]?.name || 'THE OTHER';
        sfx.pickup(); this.toast = { text: `${out} IS OUT! NOW ${next}`, col: C.green, t: 2.6 }; break;
      }
      case 'laundry': sfx.whoosh(); this.toast = { text: e.left ? 'TITA TAKES IN A LINE OF WASHING' : 'THE LAST OF THE WASHING IS IN', col: C.orange, t: 2.2 }; break;
      case 'palusot': sfx.skill(); this.toast = { text: 'PALUSOT! KUYA RAMIL TALKED YOU OUT', col: C.green, t: 2.4 }; this.showTip('palusot'); break;
      case 'medyas': this.showTip('medyas'); break;
      case 'clear': if (!this.opts.quietClear) sfx.clear(); this.buzz([30, 30, 30], C.green); break;
      case 'door': case 'switch': sfx.click(); break;
      case 'tune': if (this.onScreen(e.who.x, e.who.y, 60)) sfx.tune(); break;
      case 'jingle': sfx.jingle(); break;
      case 'fanRaise': sfx.click(); break;
      case 'nameCall': if (e.jun) { sfx.alert(); this.toast = { text: 'NINANG CALLS YOU! GO TO HER OR BLEND IN', col: C.orange, t: 3 }; } break;
      case 'glance': sfx.alert(); this.kick(1); break;
      case 'countdown': sfx.tick(); break;
      case 'flash': sfx.clasp(); this.photoFlash = settings.flash ? 0.35 : 0.1; break;
      case 'boilWarn': this.boilGlow = { x: e.x, y: e.y, t: 1.2 }; break;
      case 'boil': sfx.whoosh(); this.kick(1); break;
      case 'plate': sfx.clasp(); break;
      case 'sit': sfx.hide(); break;
      case 'getUp': sfx.creak(); this.toast = { text: 'LOLA IS GETTING UP!', col: C.orange, t: 2 }; break;
      case 'sleepTalk': if (this.onScreen(e.who.x, e.who.y, 30)) sfx.hide(); break;
      case 'meow': if (this.onScreen(e.x, e.y, 40)) sfx.meow(); break;
      case 'catSeen': sfx.alert(); this.toast = { text: 'THEY SAW MINGMING! SHE RUNS TO YOU', col: C.orange, t: 2 }; break;
      case 'ringtone': if (this.onScreen(e.x, e.y, 40)) sfx.ringtone(); break;
      case 'honk': if (this.onScreen(e.who.x, e.who.y, 40)) sfx.horn(); break;
      case 'callout': this.kick(1); break;
      case 'evidence': this.toast = { text: { door: 'MAMA FOUND A DOOR LEFT OPEN', puddle: 'SOMEONE FOUND THE PUDDLE', tsinelas: 'THEY FOUND YOUR TSINELAS' }[e.what], col: C.orange, t: 2.2 }; break;
      case 'creak': case 'locked': sfx.creak(); break;
      case 'ouch': sfx.ouch(); this.buzz(60); this.kick(3); if (w.adults.some((a) => a.cfg.vehicle && a.say)) sfx.horn(); break;
      case 'pickup': case 'unlock':
        sfx.pickup();
        if (e.kind === 'tsinelas') this.showTip('throw');
        if (e.kind === 'pandesal') this.showTip('pandesal');
        break;
      case 'cycle': sfx.click(); break;
      case 'throw': sfx.whoosh(); break;
      case 'ability': {
        sfx.skill(); this.buzz(20, C.teal);
        this.castT = 0.35; // skill pose, plus a flash ring at the raised hand
        const p = w.player;
        this.rings.push({ x: p.x + 4, y: p.y - 14, r: 12, age: 0, lure: false, tattle: false });
        break;
      }
      case 'phase': sfx.phase(); this.buzz([40, 30, 40]); this.kick(3); this.banner = { kind: 'phase', text: e.text, t: 3 }; break;
      case 'land': sfx.thud(); break;
      case 'hide': case 'unhide': sfx.hide(); if (e.seen) this.showTip('seenHide'); break;
      case 'device': sfx.music(); break;
      // ---- SI MINGMING
      case 'tabig': sfx.clank(); this.kick(1); this.cup = { x: e.x, y: e.y, t: 0.5 }; for (let i = 0; i < 8; i++) this.parts.push({ x: e.x + Math.random() * 8 - 4, y: e.y - 2, vy: -40 - Math.random() * 30, l: 0.5, shard: true }); break;
      // ---- BAGYO: the leaks
      case 'kittensIn': sfx.meow(); this.toast = { text: 'IN THE BOX! NOW KEEP IT DRY', col: C.green, t: 2.4 }; break;
      case 'dripOn': sfx.drip(); this.toast = { text: 'ANOTHER LEAK!', col: C.orange, t: 1.4 }; break;
      case 'drip': if (this.onScreen(e.x, e.y, 20)) { if (Math.random() < 0.4) sfx.drip(); for (let i = 0; i < 3; i++) this.drops.push({ x: e.x + Math.random() * 6 - 3, y: e.y + 4, vx: Math.random() * 30 - 15, vy: -20 - Math.random() * 20, l: 0.3, splash: true }); } break;
      case 'full': sfx.pickup(); break;
      case 'overflow': if (Math.random() < 0.5) sfx.splash(); break;
      case 'wet': if (e.wet >= 1 && !this.soaked) { this.soaked = true; this.toast = { text: 'THE BOX IS SOAKED! THE KITTENS CRY', col: C.orange, t: 2.4 }; } break;
      case 'cry': sfx.meow(); break;
      case 'lift': sfx.hide(); break;
      case 'place': sfx.thud(); break;
      case 'dump': sfx.splash(); if (e.loud) this.kick(1); for (let i = 0; i < 10; i++) this.drops.push({ x: e.x + Math.random() * 10 - 5, y: e.y, vx: Math.random() * 50 - 25, vy: -40 - Math.random() * 40, l: 0.5, splash: true }); break;
      case 'slosh': sfx.splash(); this.toast = { text: 'NATAPON! DO NOT RUN WITH IT FULL', col: C.orange, t: 2 }; break;
      // ---- BAGYO: the flood
      case 'flood': sfx.thunder(); this.kick(4); this.buzz([60, 40, 60]); break;
      case 'floodStopped': sfx.cheer(); break;
      case 'seal': sfx.thud(); sfx.clear(); this.kick(2); this.toast = { text: e.left ? `SEALED! ${e.left} MORE TO GO` : 'ALL SEALED!', col: C.green, t: 2 }; break;
      case 'push': sfx.push(); break;
      case 'pushBlocked': if (!this.blockedT || this.blockedT < performance.now()) { sfx.creak(); this.blockedT = performance.now() + 600; } break;
      case 'wade': if (this.onScreen(e.x, e.y)) { sfx.splash(); for (let i = 0; i < (e.deep ? 6 : 3); i++) this.drops.push({ x: e.x + Math.random() * 8 - 4, y: e.y + 4, vx: Math.random() * 40 - 20, vy: -30 - Math.random() * 30, l: 0.35, splash: true }); } break;
    }
    this.opts.log?.(e, w);
  }

  // ---------------------------------------------------------------- drawing
  // Vision cones: a soft wash of light that fades with distance and toward its edges, with a crisp rim so the
  // exact boundary is never in doubt. Calm = pale yellow, suspicious = stronger and dotted, about to chase = red
  // and solid: the state reads by brightness and texture as well as by colour.
  drawCones(g) {
    const d = this.coneData.data, cx = this.cx, cy = this.cy, W = this.world;
    d.fill(0);
    const night = !!this.level.night && !(W.flashT > 0), darkK = this.level.brownout ? BROWNOUT_MUL : DARK_MUL;
    for (const a of this.world.adults) {
      if (!a.awake || a.freezeT > 0 || a.cfg.harmless) continue; // charmed adults see nothing, so no cone
      const range = a.range, fov = a.fov, va = a.va;
      if (range <= 0 || fov <= 0) continue; // busy with a routine that takes their eyes off the room
      const N = a.rays.length - 1;
      const t = Math.min(1, a.alert * 1.4);
      const col = [0, 1, 2].map((i) => Math.round(YELLOW[i] + (RED[i] - YELLOW[i]) * t));
      const base = 62 + 110 * t; // calm cones stay out of the way of the room art
      const x0 = Math.max(cx, Math.floor(a.x - range)), x1 = Math.min(cx + VIEW_W - 1, Math.ceil(a.x + range));
      const y0 = Math.max(cy, Math.floor(a.y - range)), y1 = Math.min(cy + VIEW_H - 1, Math.ceil(a.y + range));
      // A6: at night the cone reaches its full range only inside a pool of light (the pools near this cone)
      const darkR = night ? range * darkK : range;
      const pools = night ? (W.lights || []).filter((s) => Math.hypot(s.x - a.x, s.y - a.y) < range + s.r) : [];
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          const dx = px + 0.5 - a.x, dy = py + 0.5 - a.y;
          const dist = Math.hypot(dx, dy);
          if (dist > range) continue;
          const rel = angDiff(Math.atan2(dy, dx) - va);
          if (rel < -fov || rel > fov) continue;
          let ray = a.rays[Math.round(((rel + fov) / (2 * fov)) * N)];
          if (dist > darkR && !inLight(pools, px + 0.5, py + 0.5)) { if (dist > ray) continue; ray = Math.min(ray, darkR); if (dist > ray) continue; }
          if (dist > ray) continue;
          const edge = Math.min(ray - dist, (fov - Math.abs(rel)) * dist); // px to the nearest boundary
          let al;
          if (edge < 1.2 && dist > 6) al = base + 70;                                  // the rim
          else {
            al = base * (1 - 0.55 * (dist / range)) * Math.min(1, 0.45 + edge / 14);   // soft falloff
            if (a.alert >= 0.3 && a.alert < 0.7 && ((px + py) & 3) === 0) al += 60;    // suspicious: dotted
          }
          const o = ((py - cy) * VIEW_W + (px - cx)) * 4;
          if (al <= d[o + 3]) continue; // overlapping cones: the stronger one wins
          d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = Math.min(255, al);
        }
      }
    }
    this.coneG.putImageData(this.coneData, 0, 0);
    g.drawImage(this.coneCv, cx, cy);
  }

  // Kittens follow the trail of your footsteps, each a little further behind, and sit when you stop.
  updateKittens(dt) {
    if (!this.kittens.length) return;
    const p = this.world.player, cr = this.crumbs, last = cr[cr.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 3) { cr.push({ x: p.x, y: p.y }); if (cr.length > 80) cr.shift(); }
    this.kittens.forEach((k, i) => {
      const tg = cr[Math.max(0, cr.length - 1 - (i + 1) * 5)] || p;
      const dx = tg.x - k.x, dy = tg.y - k.y, d = Math.hypot(dx, dy);
      k.moving = d > 2;
      if (!k.moving) return;
      const sp = Math.min(d, (d > 40 ? 90 : 46) * dt);
      k.x += (dx / d) * sp; k.y += (dy / d) * sp; k.stepT += dt * 9;
      k.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0);
    });
  }

  // Hanging laundry is drawn over anyone standing in it (only the tiles on screen).
  drawOverlayTiles(g) {
    const map = this.world.map, t = performance.now() / 1000;
    const tx0 = Math.max(0, Math.floor(this.cx / TILE)), ty0 = Math.max(0, Math.floor(this.cy / TILE));
    const tx1 = Math.min(map.w - 1, Math.ceil((this.cx + VIEW_W) / TILE)), ty1 = Math.min(map.h - 1, Math.ceil((this.cy + MAP_H) / TILE));
    for (let ty = ty0; ty <= Math.min(map.h - 1, ty1 + 1); ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const c = map.ch(tx, ty);
      if (c !== 'L' && c !== 'K') continue;
      if (c === 'L') drawLaundry(g, map, tx, ty, t); else drawTallTop(g, map, tx, ty);
      if (this.level.night) { // these are drawn after the darkness, so they get their own share of it
        g.globalAlpha = this.level.brownout ? 0.7 : 0.55; g.fillStyle = '#0c1230';
        if (c === 'L') g.fillRect(tx * TILE, ty * TILE - 5, TILE, 19); else if (map.ch(tx, ty - 1) !== 'K') g.fillRect(tx * TILE, ty * TILE - 10, TILE, 10);
        g.globalAlpha = 1;
      }
    }
  }

  // Night: a dark layer with pools of light cut out (the world's list: moonlight, lamps, a TV that's on, flashlights,
  // brownout candles, the open exit). The pools are the rule too (A6): inside one you're seen at full range. Jun
  // carries no light; the screen edges are just darker, like eyes adjusting.
  drawNight(g) {
    if (!this.nightCv) {
      this.nightCv = document.createElement('canvas');
      this.nightCv.width = VIEW_W; this.nightCv.height = BASE_H + MAX_EXTRA;
      this.nightG = this.nightCv.getContext('2d');
    }
    const n = this.nightG, cx = this.cx, cy = this.cy, w = this.world, now = performance.now() / 1000;
    const brown = !!this.level.brownout;
    n.globalCompositeOperation = 'source-over';
    n.clearRect(0, 0, VIEW_W, VIEW_H);
    n.globalAlpha = brown ? 0.78 : 0.62; n.fillStyle = '#0c1230'; n.fillRect(0, 0, VIEW_W, VIEW_H);
    if (!this.vignette) {
      const vg = n.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.62);
      vg.addColorStop(0, 'rgba(12,18,48,0)'); vg.addColorStop(1, 'rgba(12,18,48,1)');
      this.vignette = vg;
    }
    n.globalAlpha = 0.25; n.fillStyle = this.vignette; n.fillRect(0, 0, VIEW_W, VIEW_H);
    n.globalCompositeOperation = 'destination-out';
    const pools = [];
    const light = (x, y, rad, tint) => {
      const sx = Math.round(x - cx), sy = Math.round(y - cy);
      if (sx < -rad || sy < -rad || sx > VIEW_W + rad || sy > VIEW_H + rad) return;
      for (const [k, a] of [[1, 0.3], [0.72, 0.55], [0.45, 0.85]]) { n.globalAlpha = a; disc(n, sx, sy, Math.max(1, Math.round(rad * k)), '#000'); }
      if (tint) pools.push([x, y, Math.round(rad * 0.72), tint]);
    };
    const TINT = { window: this.level.pasko ? C.gold : '#9fc0ff', lamp: C.gold, device: '#7fd7ff', flashlight: C.yellow, candle: C.gold, exit: C.green };
    const flick = { device: Math.floor(now * 9) % 3, candle: Math.floor(now * 7 + 1) % 2 };
    for (const s of w.lights || []) light(s.x, s.y, s.r + (flick[s.kind] || 0), TINT[s.kind]);
    for (const t of w.targets) if (!t.done && t.kind === 'kuting') light(t.x, t.y, 9 + (Math.floor(now * 2) % 2), C.yellow); // a kitten's eyes catch the light (just a picture)
    n.globalCompositeOperation = 'source-over'; n.globalAlpha = 1;
    g.drawImage(this.nightCv, cx, cy);
    for (const [x, y, rad, tint] of pools) { g.globalAlpha = 0.09; disc(g, Math.round(x), Math.round(y), rad, tint); }
    g.globalAlpha = 1;
  }

  drawDynamicTiles(g) {
    const { map, locks } = this.world;
    // only the tiles on screen
    const tx0 = Math.max(0, Math.floor(this.cx / TILE)), ty0 = Math.max(0, Math.floor(this.cy / TILE));
    const tx1 = Math.min(map.w - 1, Math.ceil((this.cx + VIEW_W) / TILE)), ty1 = Math.min(map.h - 1, Math.ceil((this.cy + MAP_H) / TILE));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const c = map.ch(tx, ty), x = tx * TILE, y = ty * TILE;
      if (c === 'D') {
        g.fillStyle = C.table; g.fillRect(x, y, TILE, TILE);
        g.fillStyle = C.table2; g.fillRect(x + 2, y + 1, 12, 14);
        g.fillStyle = C.table; g.fillRect(x + 4, y + 3, 8, 4); g.fillRect(x + 4, y + 9, 8, 4);
        g.fillStyle = C.gold; g.fillRect(x + 11, y + 8, 2, 2);
        const lock = locks.get(tx + ',' + ty);
        if (lock) { g.fillStyle = C.ink; g.fillRect(x + 6, y + 6, 4, 5); g.fillStyle = KEY_COLORS[lock]; g.fillRect(x + 7, y + 7, 2, 3); }
      } else if (c === 'd') {
        g.fillStyle = C.table; g.fillRect(x, y, 3, TILE);
        g.fillStyle = C.table2; g.fillRect(x + 1, y + 1, 1, 14);
      } else if (c === 'Q') { // a sandbag (it slides when pushed)
        const pa = this.world.pushAnim, k = pa && pa.tx === tx && pa.ty === ty ? Math.max(0, pa.t) / 0.16 : 0;
        const ox = Math.round(-((pa?.dx) || 0) * 16 * k), oy = Math.round(-((pa?.dy) || 0) * 16 * k);
        const sx = x + ox, sy = y + oy;
        const sack = (ox2, oy2, w2) => { // a lumpy sack, rounded corners, burlap weave, a tie at the neck
          g.fillStyle = C.ink; g.fillRect(sx + ox2 + 1, sy + oy2, w2 - 2, 7); g.fillRect(sx + ox2, sy + oy2 + 1, w2, 5);
          g.fillStyle = '#a89a72'; g.fillRect(sx + ox2 + 1, sy + oy2 + 1, w2 - 2, 5);
          g.fillStyle = '#c4b88e'; g.fillRect(sx + ox2 + 2, sy + oy2 + 1, w2 - 5, 2);
          g.fillStyle = '#8a7e5a'; for (let i = 2; i < w2 - 2; i += 2) g.fillRect(sx + ox2 + i, sy + oy2 + 4, 1, 1);
          g.fillStyle = '#5a4e36'; g.fillRect(sx + ox2 + w2 - 3, sy + oy2 + 2, 2, 2);
        };
        g.globalAlpha = 0.3; g.fillStyle = C.ink; g.fillRect(sx + 1, sy + 13, 15, 3); g.globalAlpha = 1;
        sack(1, 8, 15); sack(2, 2, 12);
        g.fillStyle = C.white; if (this.world.flood?.active && Math.floor(performance.now() / 400) % 2) { g.fillRect(sx + 7, sy - 4, 2, 2); } // (in the flood: these are what you push)
      } else if (c === 'G' || c === 'g') {
        g.fillStyle = C.dgray; g.fillRect(x, y, TILE, 2);
        if (c === 'G') for (let i = 1; i < TILE; i += 3) { g.fillStyle = C.ink; g.fillRect(x + i, y + 2, 2, 14); g.fillStyle = C.gray; g.fillRect(x + i, y + 2, 1, 14); }
      }
    }
  }

  drawExit(g) {
    if (['seat', 'photo'].includes(this.level.boss?.finale)) return; // these finales do not end at a door
    const w = this.world, x = w.exit.x - 8, y = w.exit.y - 8;
    if (this.level.exitStyle === 'hole') { // SI MINGMING: the gap under the house where the kittens wait
      g.fillStyle = C.ink; g.fillRect(x + 1, y + 4, 14, 10); g.fillStyle = '#15101f'; g.fillRect(x + 2, y + 5, 12, 8);
      if (w.open && Math.floor(performance.now() / 300) % 2) { g.fillStyle = C.yellow; g.fillRect(x + 5, y + 8, 1, 1); g.fillRect(x + 8, y + 8, 1, 1); g.fillRect(x + 10, y + 9, 1, 1); g.fillRect(x + 12, y + 9, 1, 1); } // little eyes
      drawText(g, w.open ? 'UWI!' : 'BUTAS', w.exit.x, y - 4, w.open ? C.green : C.gray, { align: 'center', shadow: C.ink });
      return;
    }
    const pulse = w.open && Math.floor(performance.now() / 250) % 2;
    g.fillStyle = C.table; g.fillRect(x + 1, y, 14, 16);
    g.fillStyle = w.open ? (pulse ? C.green : '#2fb56b') : C.dgray; g.fillRect(x + 3, y + 2, 10, 14);
    g.fillStyle = C.gold; g.fillRect(x + 10, y + 9, 2, 2);
    drawText(g, w.open ? 'EXIT' : 'LOCKED', w.exit.x, y - 7, w.open ? C.green : C.gray, { align: 'center', shadow: C.ink });
  }

  // A stash that still has what you came for twinkles gold for a moment every 1.2 s (out of step with the others, so
  // the room doesn't blink at once): small enough to stay out of the way, enough to find it among the furniture.
  drawTwinkle(g, t, now) {
    const k = ((now + (t.x * 7 + t.y * 13) * 3) % 1200) / 1200;
    if (k > 0.3) return;
    const x = Math.round(t.x) + 5, y = Math.round(t.y) - 7, big = k > 0.08 && k < 0.22;
    g.fillStyle = C.gold;
    if (big) { g.fillRect(x - 2, y, 5, 1); g.fillRect(x, y - 2, 1, 5); g.fillStyle = C.white; g.fillRect(x, y, 1, 1); }
    else g.fillRect(x, y, 1, 1);
  }
  // TATAY's fish is not on offer until the finale (world.js context): no twinkle before then
  fishLater(t) { return t.scent && this.level.boss?.finale === 'carryOut' && this.world.finale?.type !== 'carryOut'; }

  // Hold-to-aim: a dotted ring shows how far you can throw (Ramil's is bigger), an X where it lands.
  drawAim(g) {
    const a = this.world.aim, p = this.world.player;
    if (!a) return;
    g.globalAlpha = 0.6; ring(g, Math.round(p.x), Math.round(p.y), Math.round(a.max), C.white, 3); g.globalAlpha = 1;
    const n = Math.floor(Math.hypot(a.x - p.x, a.y - p.y) / 6);
    g.fillStyle = C.white;
    for (let i = 1; i < n; i++) g.fillRect(Math.round(p.x + ((a.x - p.x) * i) / n), Math.round(p.y - 2 + ((a.y - p.y + 2) * i) / n), 1, 1);
    const x = Math.round(a.x), y = Math.round(a.y), col = this.world.player.items.at(-1) === 'pandesal' ? C.orange : C.yellow;
    g.fillStyle = C.ink; g.fillRect(x - 3, y - 3, 7, 7);
    g.fillStyle = col;
    for (let i = -2; i <= 2; i++) { g.fillRect(x + i, y + i, 1, 1); g.fillRect(x + i, y - i, 1, 1); }
    if (this.world.player.items.at(-1) !== 'pandesal') { g.globalAlpha = 0.45; ring(g, x, y, 12, col, 2); g.globalAlpha = 1; } // lure radius hint
  }

  draw(g) {
    this.syncView();
    if (TOP > 0) { g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, TOP); }
    g.save(); g.translate(0, TOP); // everything below is drawn in the map window's coordinates
    this.drawWindow(g);
    g.restore();
  }

  drawWindow(g) {
    const w = this.world, p = w.player;
    const now = performance.now(), fd = Math.min(0.05, (now - (this.lastDraw || now)) / 1000);
    this.lastDraw = now;
    this.shake = Math.max(0, this.shake - fd * 14); this.flash = Math.max(0, this.flash - fd * 1.6); this.pulse = Math.max(0, this.pulse - fd);
    const sx = this.shake > 0.3 ? Math.round((Math.random() - 0.5) * 2 * this.shake) : 0;
    const sy = this.shake > 0.3 ? Math.round((Math.random() - 0.5) * 2 * this.shake) : 0;
    this.cx = Math.round(this.cam.x); this.cy = Math.round(this.cam.y);
    g.save();
    g.translate(-this.cx + sx, -this.cy + sy);
    g.drawImage(this.bg, 0, 0);
    // floor-level stuff
    for (const t of w.traps) {
      if (t.kind === 'lego') drawObj(g, 'lego', t.x, t.y);
      else { // a loose board: a darker plank, its ends lifted (so a careful player can see the safe line)
        g.globalAlpha = 0.55; g.fillStyle = C.ink; g.fillRect(t.x - 7, t.y - 2, 14, 5); g.globalAlpha = 1;
        g.fillStyle = C.woodLine; g.fillRect(t.x - 7, t.y - 3, 14, 1); g.fillRect(t.x - 7, t.y + 3, 14, 1);
        g.fillStyle = C.white; g.fillRect(t.x - 6, t.y - 1, 1, 1); g.fillRect(t.x + 5, t.y - 1, 1, 1);
      }
    }
    this.drawDynamicTiles(g);
    for (const pd of this.world.puddles) { // spilled milk (it fades as it dries)
      g.globalAlpha = 0.75 * Math.max(0.2, 1 - pd.t / 45); g.fillStyle = '#f4f8ff';
      g.fillRect(Math.round(pd.x) - 5, Math.round(pd.y) + 2, 10, 3); g.fillRect(Math.round(pd.x) - 3, Math.round(pd.y) + 1, 6, 5);
      g.globalAlpha = 1;
    }
    this.drawFlood(g, now);
    this.drawTulo(g, now);
    this.drawExit(g);
    for (const s of w.switches) {
      drawObj(g, s.on ? 'leverOn' : 'leverOff', s.x, s.y + 2);
      if (s.timer > 0) drawText(g, String(Math.ceil(s.timer)), s.x, s.y - 12, C.yellow, { align: 'center', shadow: C.ink });
    }
    for (const d of w.devices) {
      drawObj(g, d.kind, d.x, d.y);
      if (d.on) {
        g.fillStyle = Math.floor(performance.now() / 150) % 2 ? '#7fd7ff' : C.white;
        if (d.kind === 'tv') g.fillRect(d.x - 4, d.y, 6, 3);
        drawText(g, Math.floor(performance.now() / 300) % 2 ? '*' : '+', d.x + 6, d.y - 12, C.pink, { shadow: C.ink });
      }
    }
    for (const v of w.videokes) {
      drawObj(g, 'videoke', v.x, v.y - 2);
      if (v.singing) { g.globalAlpha = 0.5; ring(g, Math.round(v.x), Math.round(v.y), v.r, Math.floor(now / 300) % 2 ? C.pink : C.teal, 4); g.globalAlpha = 1; }
    }
    for (const t of w.targets) {
      drawTarget(g, t.kind, t.x, t.y, t.done);
      if (t.kind === 'mingming' && !t.done && t.flinch > 0) drawText(g, '!', t.x, t.y - 18 - (Math.floor(now / 100) % 2), C.orange, { align: 'center', shadow: C.ink }); // she flinches at the thunder
      if (t.bonus && !t.done && Math.floor(now / 400) % 3 === 0) { g.fillStyle = C.white; g.fillRect(Math.round(t.x) + 3, Math.round(t.y) - 5, 1, 1); } // glint
      else if (!t.bonus && !t.done && !this.fishLater(t)) this.drawTwinkle(g, t, now); // what you came for: a gold twinkle
    }
    for (const it of w.items) drawObj(g, it.kind, it.x, it.y + (it.kind === 'key' ? Math.floor(performance.now() / 300) % 2 : 0), it.color);
    for (const f of w.foods) drawObj(g, 'pandesal', f.x, f.y);
    for (const h of w.hides) if (h.kind !== 'curtain') drawObj(g, h.kind, h.x, h.y + 2);

    if (this.level.night) this.drawNight(g);
    this.drawCones(g);

    for (const d of this.dust) { g.globalAlpha = Math.min(1, d.l * 2.2); g.fillStyle = C.white; g.fillRect(Math.round(d.x), Math.round(d.y), 2, 2); }
    g.globalAlpha = 1;

    // your best run, as a see-through kid
    const gh = this.ghost && settings.ghost ? ghostAt(this.ghost, w.time) : null;
    if (gh && !gh.hidden) { g.globalAlpha = 0.3; drawActor(g, this.look, gh.x, gh.y, 0, Math.floor(w.time * 8) % 4); g.globalAlpha = 1; }

    const actors = this.actors;
    actors.length = 0;
    for (const a of w.adults) actors.push(a);
    for (const c of this.cats) actors.push(c);
    if (!p.hidden) { actors.push(p); for (const k of this.kittens) actors.push(k); }
    if (w.escort && !w.escort.hidden) actors.push(w.escort); // Mingming, a step behind
    if (this.boilGlow && (this.boilGlow.t -= 1 / 60) > 0) { // the stove glows a second before the pot boils over
      g.globalAlpha = 0.35 + 0.25 * Math.sin(now / 60); disc(g, Math.round(this.boilGlow.x), Math.round(this.boilGlow.y), 12, C.orange); g.globalAlpha = 1;
    }
    const sf = w.finale?.type === 'seat' && w.open ? w.finale.seatPt : null;
    if (sf && Math.floor(now / 300) % 2) { g.fillStyle = C.green; g.fillRect(Math.round(sf.x) - 5, Math.round(sf.y) + 5, 10, 2); } // your place at the table
    if (w.breadBag) { drawTarget(g, 'bilin', w.breadBag.x, w.breadBag.y, false); if (w.breadBag.cd > 0) drawText(g, String(Math.ceil(w.breadBag.cd)), w.breadBag.x, w.breadBag.y - 14, C.gray, { align: 'center', shadow: C.ink }); }
    if (w.player.carry?.scent && Math.floor(now / 180) % 2) { g.fillStyle = C.white; g.globalAlpha = 0.6; g.fillRect(Math.round(w.player.x) - 3, Math.round(w.player.y) - 16, 1, 3); g.fillRect(Math.round(w.player.x) + 2, Math.round(w.player.y) - 18, 1, 3); g.globalAlpha = 1; } // the fish smells
    if (this.level.photo && w.finale?.type === 'photo') { // the photo zone (dotted) and the tripod
      const [x0, y0, x1, y1] = this.level.photo.zone, t = this.level.photo.tripod;
      g.fillStyle = C.gold;
      for (let x = x0 * TILE; x < (x1 + 1) * TILE; x += 4) { g.fillRect(x, y0 * TILE, 2, 1); g.fillRect(x, (y1 + 1) * TILE - 1, 2, 1); }
      for (let y = y0 * TILE; y < (y1 + 1) * TILE; y += 4) { g.fillRect(x0 * TILE, y, 1, 2); g.fillRect((x1 + 1) * TILE - 1, y, 1, 2); }
      g.fillStyle = C.ink; g.fillRect(t[0] * TILE + 4, t[1] * TILE + 2, 8, 5); g.fillRect(t[0] * TILE + 7, t[1] * TILE + 7, 2, 8);
      g.fillStyle = C.gray; g.fillRect(t[0] * TILE + 6, t[1] * TILE + 3, 3, 3);
    }
    this.holdRing = w.doorHold ? Math.min(1, w.doorHold.t / 1.5) : 0;
    if (this.holdRing > 0) { // opening a creaky door slowly: a ring of dots fills around your feet
      const n = 16, k = Math.floor(this.holdRing * n);
      for (let i = 0; i < n; i++) { const an = -Math.PI / 2 + (i / n) * Math.PI * 2; g.fillStyle = i < k ? C.green : C.ink; g.fillRect(Math.round(p.x + Math.cos(an) * 11), Math.round(p.y + 2 + Math.sin(an) * 7), 2, 2); }
    }
    // KASABWAT: the kid you left behind, crouched where you left them
    for (const k of w.kids || []) if (k !== p && !k.out && !k.hidden) actors.push({ look: k.look, x: k.x, y: k.y, dir: k.dir, pose: 'reach', partner: true });
    actors.sort((u, v) => u.y - v.y);
    const blink = p.graceT > 0 && Math.floor(now / 100) % 2;
    for (const e of actors) {
      if (e.look) drawActor(g, e.look, e.x, e.y, e.dir, e.pose || (e.moving ? Math.floor(e.stepT) % 4 : 'sit'));
      else if (e === p) {
        // kid poses: caught > skill cast > kupit (reach) > walk cycle (sneak 8 fps, run 13.6 fps) > idle
        if (!blink && w.mods.cat) this.drawCat(g, p, now);
        else if (!blink) {
          drawActor(g, this.look, p.x, p.y, p.dir, w.status === 'caught' || w.scold ? 'caught' : this.castT > 0 ? 'cast' : p.stealing ? 'reach' : p.moving ? Math.floor(p.stepT * 8) % 4 : 0);
          if (this.level.tulo && w.coins > 0 && !(w.tulo?.stage === 'leak')) this.drawShirtKittens(g, p, now);
        }
      } else this.drawAdult(g, e);
    }
    for (const k of w.kids || [p]) {
      if (k.under && !k.hidden && !k.out && !w.mods.cat) { // MALIIT: the table or bed drawn back over Bing, her eyes peeking out (the cat is ON top)
        const tx = k.tx * TILE, ty = k.ty * TILE;
        g.globalAlpha = 0.82; g.drawImage(this.bg, tx, ty - 4, TILE, TILE + 4, tx, ty - 4, TILE, TILE + 4); g.globalAlpha = 1;
        g.fillStyle = C.white; g.fillRect(Math.round(k.x) - 2, Math.round(k.y) - 1, 1, 1); g.fillRect(Math.round(k.x) + 1, Math.round(k.y) - 1, 1, 1);
      }
      if (k !== p && !k.out) drawText(g, 'Z', Math.round(k.x), Math.round(k.y) - 26, C.gray, { align: 'center', shadow: C.ink }); // switch to them
    }
    for (const h of w.hides) if (h.kind === 'curtain') drawObj(g, 'curtain', h.x, h.y - 1);
    this.drawOverlayTiles(g);
    for (const n of this.notes) drawText(g, '*', Math.round(n.x), Math.round(n.y), n.k ? C.pink : C.yellow, { shadow: C.ink });
    if (p.blend && !p.hidden) { // one more kid in the crowd: a little green "unseen" mark over your head
      const by = Math.round(p.y) - 24 - (Math.floor(now / 300) % 2);
      g.fillStyle = C.ink; g.fillRect(Math.round(p.x) - 4, by - 1, 9, 5);
      g.fillStyle = C.green; g.fillRect(Math.round(p.x) - 3, by, 3, 3); g.fillRect(Math.round(p.x) + 1, by, 3, 3);
    }
    if (p.hidden) { // peeking eyes
      const b = Math.floor(performance.now() / 700) % 4 === 0;
      if (!b) { g.fillStyle = C.white; g.fillRect(p.x - 3, p.y - 3, 2, 2); g.fillRect(p.x + 1, p.y - 3, 2, 2); g.fillStyle = C.ink; g.fillRect(p.x - 2, p.y - 2, 1, 1); g.fillRect(p.x + 2, p.y - 2, 1, 1); }
      if (w.adults.some((a) => a.sawHide)) { // someone saw you go in: this spot is not safe
        drawObj(g, 'eye', p.x, p.y - 15 - (Math.floor(now / 250) % 2));
      }
    }
    for (const pr of w.projectiles) drawObj(g, pr.kind, pr.x, pr.y);
    for (const r of w.rollers) drawObj(g, 'holen', r.x, r.y); // HOLEN: still rolling
    for (const h of w.hostiles) drawObj(g, h.kind, h.x, h.y);

    for (const r of this.rings) {
      const life = r.tattle ? 0.8 : 0.5;
      ring(g, Math.round(r.x), Math.round(r.y), Math.max(2, Math.round(r.r * (r.age / life))), r.tattle ? C.red : r.lure ? C.yellow : C.white);
    }
    for (const u of this.windups) { // tattle charging up: a ring closing in on him
      const k = 1 - u.age / u.t;
      ring(g, Math.round(u.who.x), Math.round(u.who.y), Math.max(3, Math.round(6 + 24 * k)), Math.floor(now / 80) % 2 ? C.red : C.white, 1);
    }
    this.drawAim(g);

    // SOBRA: how many coins are left in a stash you are standing at (gold) and how many you took (dark)
    for (const t of w.targets) {
      if (!t.perCoin || t.done || Math.hypot(t.x - p.x, t.y - p.y) > 40) continue;
      const n = t.full, x0 = Math.round(t.x) - n * 2, y0 = Math.round(t.y) - 12;
      g.fillStyle = C.ink; g.fillRect(x0 - 1, y0 - 1, n * 4 + 1, 5);
      for (let i = 0; i < n; i++) { g.fillStyle = i < t.coins ? C.gold : C.dgray; g.fillRect(x0 + i * 4, y0, 3, 3); }
    }
    // steal bar
    const hot = w.targets.find((t) => t.progress > 0 && !t.done);
    if (hot) {
      const px = Math.round(p.x) - 9, py = Math.round(p.y) - 20;
      g.fillStyle = C.ink; g.fillRect(px - 1, py - 1, 20, 5);
      g.fillStyle = C.dgray; g.fillRect(px, py, 18, 3);
      g.fillStyle = hot.bonus ? C.green : p.stealing ? C.gold : C.gold2; g.fillRect(px, py, Math.round(18 * Math.min(1, hot.progress)), 3);
    }
    for (const q of this.parts) { g.globalAlpha = Math.min(1, q.l * 2); drawCoin(g, q.x, q.y); }
    g.globalAlpha = 1;
    if (w.say) bubble(g, w.say.text, p.x, Math.round(p.y) - 30, this.cx);
    for (const a of w.adults) if (a.say) bubble(g, a.say.text, a.x, Math.round(a.y) - 34, this.cx, C.ink, w.scold?.who === a ? C.orange : a.state === 'chase' ? C.red : C.white);
    if (this.coach) this.drawCoachFocus(g);
    g.restore();
    if (p.carry && !w.mods.cat) drawTarget(g, p.carry.kind === 'isda' ? 'isda' : 'gatas', p.x - this.cx + sx, p.y - this.cy + sy - 21, false);
    if (p.holding) this.drawHeld(g, p, sx, sy);
    if (this.level.storm) this.drawStorm(g, fd);
    this.drawCover(g);
    if (w.finale?.type === 'photo' && w.finale.count > 0) drawText(g, String(Math.ceil(w.finale.count)), VIEW_W / 2, 52, C.gold, { scale: 3, align: 'center', shadow: C.ink }); // PICTURE! 3, 2, 1
    if (this.photoFlash > 0) { g.globalAlpha = Math.min(0.8, this.photoFlash * 3); g.fillStyle = C.white; g.fillRect(0, 0, VIEW_W, MAP_H); g.globalAlpha = 1; this.photoFlash -= 1 / 60; }
    if (this.flash > 0) { g.globalAlpha = this.flash * 0.5; g.fillStyle = C.orange; g.fillRect(0, 0, VIEW_W, MAP_H); g.globalAlpha = 1; }
    if (this.pulse > 0) { // visual stand-in for vibration
      g.globalAlpha = Math.min(1, this.pulse * 2.5); g.fillStyle = this.pulseCol;
      g.fillRect(0, 0, VIEW_W, 3); g.fillRect(0, MAP_H - 3, VIEW_W, 3); g.fillRect(0, 0, 3, MAP_H); g.fillRect(VIEW_W - 3, 0, 3, MAP_H);
      g.globalAlpha = 1;
    }
    this.drawThreats(g);
    this.drawCompass(g);
    this.drawHud(g);
  }

  // ---- SI MINGMING: the cat walks, sits, crouches to bite, and hops up onto the furniture
  drawCat(g, p, now) {
    const w = this.world, up = p.up ? 5 : 0;
    const pose = w.scold || w.status === 'caught' ? 'sleep' : p.stealing ? 'sit' : p.moving ? Math.floor(p.stepT * 10) % 4 : this.castT > 0 ? 1 : 'sit';
    if (up) { g.globalAlpha = 0.25; g.fillStyle = C.ink; g.fillRect(Math.round(p.x) - 5, Math.round(p.y) + 4, 11, 2); g.globalAlpha = 1; } // her shadow stays on the floor
    drawActor(g, 'pusa', p.x, p.y - up, p.dir, pose);
    if (p.carry) { // the fish in her mouth
      const [ox, oy] = [[0, -3], [-8, -6], [8, -6], [0, -10]][p.dir];
      drawObj(g, 'isdaBit', p.x + ox, p.y - up + oy);
    }
    if (up && Math.floor(now / 500) % 2) { g.fillStyle = C.green; g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - up - 16, 3, 1); } // up high: harder to see
    if (this.cup) { // the cup she swatted, falling and breaking
      const k = 1 - this.cup.t / 0.5;
      g.fillStyle = '#cfe9f2'; g.fillRect(Math.round(this.cup.x) - 2, Math.round(this.cup.y) - 8 + Math.round(k * 8), 4, 4);
    }
  }

  // ---- BAGYO: three kittens peeking out of Jun's shirt
  drawShirtKittens(g, p, now) {
    const n = Math.min(3, this.world.coins), looks = ['puti', 'muning', 'tigre'];
    for (let i = 0; i < n; i++) {
      const s = getSprite(looks[i], 0, 'sit'), bob = Math.floor(now / 260 + i) % 3 === 0 ? 1 : 0;
      g.drawImage(s, 0, 0, s.width, 5, Math.round(p.x) - 6 + i * 4, Math.round(p.y) - 9 - bob, s.width, 5);
    }
  }
  // the container you are carrying, held up in front, showing how full it is
  drawHeld(g, p, sx, sy) {
    const k = p.holding, x = Math.round(p.x - this.cx + sx), y = Math.round(p.y - this.cy + sy) - 22;
    drawObj(g, k.kind, x, y);
    if (k.fill > 0) { g.fillStyle = '#5a7fb5'; g.fillRect(x - 3, y - 1, 6, Math.max(1, Math.round(2 * k.fill))); }
    if (k.fill >= 1 && Math.floor(performance.now() / 200) % 2) drawText(g, 'PUNO', x, y - 12, C.orange, { align: 'center', shadow: C.ink });
  }

  // TULO: the drain, the box, the containers on the floor, and the drips (a drop falls from the floorboards)
  drawTulo(g, now) {
    const T = this.world.tulo;
    if (!T) return;
    drawObj(g, 'drain', T.drain.x, T.drain.y);
    if (T.stage === 'leak') drawText(g, 'DRAIN', T.drain.x, T.drain.y + 6, C.gray, { align: 'center' });
    // the box: empty until you bring them, full of kittens while it leaks, empty once they are in your shirt
    const bx = Math.round(T.box.x) - 11, by = Math.round(T.box.y) - 6;
    g.fillStyle = C.ink; g.fillRect(bx - 1, by - 1, 24, 13);
    g.fillStyle = '#8a6a42'; g.fillRect(bx, by, 22, 11); g.fillStyle = '#a8845a'; g.fillRect(bx, by, 22, 2);
    g.fillStyle = T.wet >= 1 ? '#7a5a8a' : '#d86a8a'; g.fillRect(bx + 2, by - 2, 18, 3);
    if (T.stage === 'leak') ['puti', 'muning', 'tigre'].forEach((k, i) => { const s = getSprite(k, 0, 'sit'); g.drawImage(s, 0, 0, s.width, 6, bx + 2 + i * 6, by - 4 - (T.wet >= 1 && Math.floor(now / 200 + i) % 2 ? 1 : 0), s.width, 6); });
    if (T.wet > 0) { g.globalAlpha = 0.25 + 0.35 * T.wet; g.fillStyle = '#5a7fb5'; g.fillRect(bx, by + 6, 22, 5); g.globalAlpha = 1; }
    if (T.stage === 'leak' && T.wet >= 1 && Math.floor(now / 400) % 2) drawText(g, 'MEW!', bx + 11, by - 14, C.white, { align: 'center', shadow: C.ink });
    if (T.stage === 'idle' && this.world.finale?.type === 'tulo' && Math.floor(now / 300) % 2) { g.fillStyle = C.green; g.fillRect(bx, by + 12, 22, 2); } // bring them here
    for (const d of T.drips) {
      if (!d.on) { if (T.stage === 'leak') { g.globalAlpha = 0.35; g.fillStyle = '#5a7fb5'; g.fillRect(d.x - 2, d.y - 9, 4, 1); g.globalAlpha = 1; } continue; } // a dark seam: it will leak here
      const cont = T.conts.find((k) => k.drip === d);
      if (!cont) { g.globalAlpha = 0.45; g.fillStyle = '#5a7fb5'; g.fillRect(d.x - 4, d.y + 2, 8, 3); g.fillRect(d.x - 2, d.y + 1, 4, 5); g.globalAlpha = 1; } // a puddle
      const k = Math.min(1, d.fallT / 0.5), y = Math.round(d.y - 14 + k * 16);
      g.fillStyle = '#9fc0ff'; g.fillRect(d.x, y, 1, 2); g.fillStyle = C.white; g.fillRect(d.x, y, 1, 1);
      g.fillStyle = '#3a5a8a'; g.fillRect(d.x - 2, d.y - 15, 5, 1); // the wet seam in the boards above
    }
    for (const k of T.conts) {
      if (k.held) continue;
      drawObj(g, k.kind, k.x, k.y);
      if (k.fill > 0) { g.fillStyle = k.fill >= 1 ? '#7f9fd8' : '#5a7fb5'; g.fillRect(Math.round(k.x) - 3, Math.round(k.y) - 1, 6, Math.max(1, Math.round(2 * k.fill))); }
      if (k.drip && T.stage === 'leak') { // a little gauge
        g.fillStyle = C.ink; g.fillRect(Math.round(k.x) - 6, Math.round(k.y) + 5, 12, 3);
        g.fillStyle = k.fill >= 1 ? (Math.floor(now / 150) % 2 ? C.red : C.orange) : k.fill > 0.7 ? C.yellow : '#4f8fff'; g.fillRect(Math.round(k.x) - 5, Math.round(k.y) + 6, Math.round(10 * k.fill), 1);
      }
    }
    for (const d of this.drops) { g.fillStyle = '#9fc0ff'; g.fillRect(Math.round(d.x), Math.round(d.y), 1, 1); }
  }

  // BAHA: shallow water lets the floor show through, deep water does not; ripples drift; the breaches gush
  drawFlood(g, now) {
    const F = this.world.flood, map = this.world.map;
    if (!F) return;
    const t = now / 1000;
    for (const s of F.sources) { // the broken lip of the kanal
      const x = s.tx * TILE, y = s.ty * TILE;
      if (s.sealed) continue;
      g.fillStyle = '#5a5468'; g.fillRect(x + 13, y + 2, 3, 3); g.fillRect(x + 14, y + 9, 2, 4);
      if (F.active) for (let i = 0; i < 3; i++) { const k = ((t * 3 + i / 3) % 1); g.fillStyle = C.white; g.fillRect(Math.round(x + 14 - k * 12), Math.round(y + 4 + i * 4 + Math.sin(k * 6) * 2), 2, 1); }
      else if (Math.floor(t * 2) % 2) { g.fillStyle = '#7f9fd8'; g.fillRect(x + 12, y + 7, 2, 2); } // a trickle: this is where it will break
    }
    if (!F.active) return;
    const W = map.w;
    for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < W; tx++) {
      const d = F.depth[ty * W + tx];
      if (!d) continue;
      const x = tx * TILE, y = ty * TILE;
      g.globalAlpha = d === 2 ? 0.8 : 0.5; g.fillStyle = d === 2 ? '#1d3466' : '#5a8ac8'; g.fillRect(x, y, TILE, TILE);
      if (d === 2) { g.globalAlpha = 0.5; g.fillStyle = '#9fc0ff'; if (F.depth[ty * W + tx - 1] === 1) for (let k = 0; k < TILE; k += 3) g.fillRect(x, y + k, 1, 1); if (F.depth[(ty - 1) * W + tx] === 1) for (let k = 0; k < TILE; k += 3) g.fillRect(x + k, y, 1, 1); }
      g.globalAlpha = 0.55; g.fillStyle = '#9fc0ff';
      const o = Math.floor((t * 6 + tx * 3 + ty * 5) % 12);
      g.fillRect(x + o, y + 4 + ((tx + ty) % 3) * 4, 3, 1);
      // the edge of the water: foam where it meets dry floor
      if (!F.depth[ty * W + tx + 1] && !map.tileSolid(tx + 1, ty)) g.fillRect(x + 15, y, 1, TILE);
      if (!F.depth[(ty + 1) * W + tx] && !map.tileSolid(tx, ty + 1)) g.fillRect(x, y + 15, TILE, 1);
      g.globalAlpha = 1;
    }
  }


  // Dev overlay: badges plus optional live stats.
  drawDev(g) {
    const w = this.world, p = w.player;
    drawText(g, `DEV${dev.god ? ' GOD' : ''}${dev.speed !== 1 ? ` ${dev.speed}X` : ''}`, VIEW_W - 5, 31, C.red, { align: 'right', shadow: C.ink });
    if (!dev.info) return;
    const rows = [
      `${this.level.id}`,
      `TILE ${p.tx},${p.ty}  FPS ${Math.round(dev.fps)}`,
      `COINS ${w.coins}/${this.level.quota}  PHASE ${w.phase}/${w.bossPhases.length}`,
      `T ${Math.floor(w.time)}S  PAR ${this.level.par}S  CAUGHT ${w.catches}/${w.lives}`,
      ...w.adults.map((a) => `${a.type.toUpperCase()} ${a.state} A${a.alert.toFixed(1)}${a.awake ? '' : ' ZZ'}${a.cfg.depth ? ` D${a.depth.toFixed(2)}` : ''}`),
    ];
    g.globalAlpha = 0.65; g.fillStyle = C.ink; g.fillRect(2, 34, 150, rows.length * 8 + 3); g.globalAlpha = 1;
    rows.forEach((r, i) => drawText(g, r, 4, 36 + i * 8, i < 4 ? C.yellow : C.white));
  }

  // Boss HUD: phase pips, the boss's sleep/watch bar, and big banners.
  drawBoss(g) {
    const b = this.level.boss, w = this.world;
    if (!b) return;
    const total = (b.phases || []).length + 1;
    for (let i = 0; i < total; i++) {
      g.fillStyle = C.ink; g.fillRect(4 + i * 8, 13, 7, 5);
      g.fillStyle = i <= w.phase ? C.red : C.dgray; g.fillRect(5 + i * 8, 14, 5, 3);
    }
    // the boss: name + sleep/cooking cycle bar, sleep depth, or her alert level
    const a = w.adults[b.index ?? 0];
    if (a) {
      const cy = a.cfg.cycle;
      let fill, col, label = a.cfg.name;
      if (a.cfg.depth && !a.awake) { // Lola's siesta: how deep she sleeps (noise drains it)
        fill = a.depth; col = a.depth < 0.3 ? C.orange : C.green; label += ' ZZ';
      } else if (cy && a.state === 'patrol') {
        const len = cy.on + cy.off, t = a.t % len, awake = t < cy.on;
        fill = (awake ? cy.on - t : len - t) / (awake ? cy.on : cy.off);
        col = awake ? C.red : C.green;
        label += awake ? ' !' : a.cfg.cook ? ' ~' : ' ZZ';
      } else {
        fill = a.state === 'chase' ? 1 : a.alert;
        col = a.state === 'chase' || a.cfg.hunt ? C.red : C.yellow;
        if (a.state === 'inspect') label += ' ?';
        if (a.cfg.hairTrigger) label += ' SHH';
      }
      drawText(g, label, VIEW_W - 62, 13, col, { align: 'right', shadow: C.ink });
      g.fillStyle = C.ink; g.fillRect(VIEW_W - 60, 13, 56, 5);
      g.fillStyle = col; g.fillRect(VIEW_W - 59, 14, Math.round(54 * Math.max(0, Math.min(1, fill))), 3);
    }
    if (w.escapeT > 0) { // escape countdown
      const blink = w.escapeT < 6 && Math.floor(performance.now() / 200) % 2;
      g.globalAlpha = 0.75; g.fillStyle = C.ink; g.fillRect(VIEW_W / 2 - 50, 31, 100, 20); g.globalAlpha = 1;
      drawText(g, `${w.flood?.active ? 'BAHA!' : 'TAKBO!'} ${Math.ceil(w.escapeT)}`, VIEW_W / 2, 34, blink ? C.white : C.red, { scale: 2, align: 'center', shadow: C.ink });
    }
    const T = w.tulo;
    if (T && T.stage === 'leak') { // TULO: how long the leaks last, and how wet the box is
      g.globalAlpha = 0.75; g.fillStyle = C.ink; g.fillRect(VIEW_W / 2 - 52, 31, 104, 22); g.globalAlpha = 1;
      drawText(g, `TULO ${Math.max(0, Math.ceil(T.dur - T.t))}`, VIEW_W / 2, 33, C.yellow, { scale: 2, align: 'center', shadow: C.ink });
      g.fillStyle = C.ink; g.fillRect(VIEW_W / 2 - 40, 47, 80, 4);
      g.fillStyle = T.wet >= 1 ? C.red : T.wet > 0.6 ? C.orange : '#4f8fff'; g.fillRect(VIEW_W / 2 - 39, 48, Math.round(78 * T.wet), 2);
      drawText(g, 'BASA', VIEW_W / 2 - 44, 46, C.gray, { align: 'right' });
    }
    const bn = this.banner;
    if (bn) {
      g.globalAlpha = 0.8; g.fillStyle = C.ink; g.fillRect(0, 96, VIEW_W, bn.kind === 'boss' ? 46 : 22); g.globalAlpha = 1;
      if (bn.kind === 'boss') {
        const boss = w.adults[b.index ?? 0];
        if (boss) { g.fillStyle = C.red; g.fillRect(5, 103, 32, 32); drawPortrait(g, boss.type, 7, 105); }
        drawText(g, 'BOSS', VIEW_W / 2, 101, C.red, { scale: 3, align: 'center', shadow: C.ink });
        drawText(g, bn.text, VIEW_W / 2, 125, C.gold, { scale: 2, align: 'center', shadow: C.gold2 });
      } else {
        drawText(g, '!', VIEW_W / 2, 100, C.red, { scale: 2, align: 'center' });
        drawText(g, bn.text, VIEW_W / 2, 114, C.white, { align: 'center' });
      }
    }
  }

  // Typhoon: slanting rain, a white flash for lightning, and a cue while the thunder covers your noise.
  drawStorm(g, fd) {
    const t = performance.now() / 1000;
    g.globalAlpha = 0.4; g.fillStyle = '#9fb8e8';
    for (let i = 0; i < 80; i++) {
      const x = (i * 37 + t * 90 + i * i) % VIEW_W, y = (i * 53 + t * 420) % MAP_H;
      g.fillRect(Math.round(x), Math.round(y), 1, 4);
    }
    g.globalAlpha = 1;
    if (this.bolt > 0) { g.globalAlpha = Math.min(0.7, this.bolt * 3); g.fillStyle = C.white; g.fillRect(0, 0, VIEW_W, MAP_H); g.globalAlpha = 1; this.bolt -= fd; }
  }

  // While thunder rolls or the videoke is belting out a chorus over you: nobody can hear a thing you do.
  drawCover(g) {
    const c = this.world.cover;
    if (!c) return;
    g.globalAlpha = 0.8; g.fillStyle = C.ink; g.fillRect(VIEW_W / 2 - 56, 32, 112, 11); g.globalAlpha = 1;
    drawText(g, c === 'thunder' ? 'KULOG! NOBODY CAN HEAR YOU' : c === 'snore' ? 'HILIK! NOBODY CAN HEAR YOU' : 'VIDEOKE! NOBODY CAN HEAR YOU', VIEW_W / 2, 35, C.green, { align: 'center' });
  }

  // The level's three missions, shown for the first seconds of a run (and on the pause screen).
  drawMissions(g, y, earned = 0) {
    const w = this.world, st = w.missionState();
    g.globalAlpha = 0.82; g.fillStyle = C.ink; g.fillRect(VIEW_W / 2 - 100, y, 200, 8 + st.length * 11); g.globalAlpha = 1;
    st.forEach((m, i) => {
      const had = (earned >> i) & 1, yy = y + 5 + i * 11, label = missionLabel(this.level, m.id);
      drawStar(g, VIEW_W / 2 - 94, yy, !!had);
      drawBig(g, label, VIEW_W / 2 - 84, yy, m.lost ? C.dgray : had ? C.gold : C.white);
      if (m.lost) { g.fillStyle = C.red; g.fillRect(VIEW_W / 2 - 85, yy + 3, bigWidth(label) + 2, 1); }
    });
  }

  get touch() { return this.input.touchUsed || this.coarse; }
  coachView() { return this.coach && this.world.status === 'play' ? this.coach.view({ touch: this.touch }) : null; }

  // Tutorial: a bouncing arrow and a pulsing ring on the thing the current step is about (world coordinates).
  drawCoachFocus(g) {
    const v = this.coachView(), f = v?.focus;
    if (!f) return;
    const now = performance.now(), b = Math.round(Math.abs(Math.sin(now / 220)) * 3);
    const a = v.aim && this.world.aim, onMark = a && Math.hypot(a.x - f.x, a.y - f.y) < 14; // throw lesson: aiming at the mark
    const x = Math.round(f.x), y = Math.round(f.y), col = onMark ? C.green : v.col === 'orange' ? C.orange : C.gold;
    g.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(now / 300)); ring(g, x, y, 10 + (Math.floor(now / 300) % 2), C.ink, 1); ring(g, x, y, 9 + (Math.floor(now / 300) % 2), col, 1); g.globalAlpha = 1;
    const ay = y - 19 - b; // a down arrow just above it
    g.fillStyle = C.ink; g.fillRect(x - 5, ay - 1, 11, 4); for (let i = 0; i < 5; i++) g.fillRect(x - 4 + i, ay + 3 + i, 9 - i * 2, 1);
    g.fillStyle = col; g.fillRect(x - 1, ay - 4, 3, 5); g.fillRect(x - 4, ay, 9, 2); for (let i = 0; i < 4; i++) g.fillRect(x - 3 + i, ay + 2 + i, 7 - i * 2, 1);
  }

  // Tutorial: the coach panel at the top, and a ring on the button to press (or a ghost finger for walking).
  drawCoachHud(g) {
    const v = this.coachView();
    if (!v) return;
    const c = this.coach, now = performance.now();
    const col = { white: C.white, green: C.green, orange: C.orange, red: C.red }[v.col] || C.white;
    // The panel sits at the top, and moves to the bottom of the room while you (or what it points at) are up there,
    // so it never covers the thing it is talking about (the sala's exit is on the top wall). A gap stops it flickering.
    const py = this.world.player.y - this.cy, fy = v.focus ? v.focus.y - this.cy : MAP_H;
    if (py < 150 || fy < 70) this.coachLow = true; else if (py > 200 && fy > 90) this.coachLow = false;
    const L0 = wrapBig(v.lines[0], 230), L1 = v.lines[1] ? wrapBig(v.lines[1], 230) : [], h = 9 + (L0.length + L1.length) * 10;
    const band = this.hudY - h - 2 >= 0; // a tall phone: the panel waits above the map, so it never covers it
    const low = !band && this.coachLow;
    const y0 = band ? this.hudY - TOP - h - 2 : low ? MAP_H - h - 2 : 17;
    g.globalAlpha = 0.85; g.fillStyle = C.ink; g.fillRect(0, y0, VIEW_W, h); g.globalAlpha = 1;
    g.fillStyle = c.okT > 0 ? C.green : v.reactive ? col : C.gold; g.fillRect(0, low ? y0 : y0 + h - 1, VIEW_W, 1);
    L0.forEach((l, i) => drawBig(g, l, VIEW_W / 2, y0 + 3 + i * 10, v.reactive ? col : C.yellow, { align: 'center' }));
    L1.forEach((l, i) => drawBig(g, l, VIEW_W / 2, y0 + 3 + (L0.length + i) * 10, C.white, { align: 'center' }));
    for (let i = 0; i < c.total; i++) { // how far through the lesson you are
      g.fillStyle = i < c.i ? C.green : i === c.i ? C.gold : C.dgray;
      g.fillRect(VIEW_W / 2 - c.total * 3 + i * 6, y0 + h - 5, 4, 2);
    }
    const pulse = Math.floor(now / 250) % 2, hold = v.btn === 'throw' || ['kupit', 'more'].includes(c.step?.id);
    const btn = v.btn === 'act' ? BUTTON : v.btn === 'throw' && this.world.player.items.length ? BUTTON2 : null;
    if (btn) this.drawButtonHint(g, btn, hold, v.btn);
    else if (v.btn === 'move' && this.touch && !this.input.stick()) { // a ghost finger dragging toward where to go
      const f = v.focus, p = this.world.player, k = (now / 1200) % 1;
      const dx = f ? f.x - p.x : 0, dy = f ? f.y - p.y : -1, m = Math.hypot(dx, dy) || 1;
      const ox = VIEW_W / 2, oy = this.coachLow ? MAP_H - 70 : MAP_H - 64;
      g.globalAlpha = 0.25; disc(g, ox, oy, 20, C.white);
      g.globalAlpha = 0.7 * (1 - k * 0.5); disc(g, Math.round(ox + (dx / m) * 14 * k), Math.round(oy + (dy / m) * 14 * k), 7, C.white);
      g.globalAlpha = 1;
    }
  }

  drawAdult(g, a) {
    if (a.cfg.vehicle) { this.drawTrike(g, a); return; }
    const dir = Math.abs(Math.cos(a.a)) > Math.abs(Math.sin(a.a)) ? (Math.cos(a.a) < 0 ? 1 : 2) : (Math.sin(a.a) < 0 ? 3 : 0);
    // Pose by state (all in the sheet, see docs/ART_SPEC.md): eat > sleep > phone > stirring > alert (shouting,
    // or a dog barking) > walk cycle > idle. Missing poses fall back to idle in getSprite.
    const eating = a.state === 'eat';
    const napping = !a.awake && a.cfg.sleepy && !eating;
    const barking = (this.barks.get(a) || 0) > 0;
    const shout = this.world.catcher === a || (a.awake && !a.moving && (a.state === 'chase' || a.alert >= 0.6));
    const busy = a.busy && !a.moving ? a.busy : null;
    const frame = eating ? 'eat' : napping ? 'sleep' : !a.awake && a.cfg.phone ? 'phone' : !a.awake && a.cfg.cook ? 'reach'
      : barking || shout ? 'alert' : busy && busy.pose ? busy.pose : a.moving ? Math.floor(a.stepT * 6) % 4 : 0;
    const top = drawActor(g, a.type, a.x, a.y, dir, frame, { dim: napping });
    const cx = Math.round(a.x);
    if (a.cfg.harmless) return;
    if (busy && a.alert <= 0.12) { // a routine: its prop, and a mark that says "eyes off the room"
      if (busy.prop) drawObj(g, busy.prop, cx + (dir === 1 ? -9 : 9), Math.round(a.y) - 1);
      const b = Math.floor(performance.now() / 450) % 2;
      drawText(g, busy.pose === 'sleep' ? 'Z' : busy === a.busy && busy.range === 0 ? '~' : '.', cx + 5, top - 6 - b, busy.range === 0 ? C.green : C.white, { shadow: C.ink });
    }
    if (napping) {
      const b = Math.floor(performance.now() / 500) % 2;
      if (a.snoring) drawText(g, 'ZZZ', cx + 3, top - 12 - b, C.white, { scale: 2, shadow: C.ink }); // a loud snore: move now
      else drawText(g, a.cfg.depth && a.depth < 0.35 ? 'Z' : 'ZZ', cx + 4, top - 6 - b, a.cfg.depth && a.depth < 0.35 ? C.orange : C.white, { shadow: C.ink });
    } else if (a.state === 'boil') { // the pot boiled over: steam
      const b = Math.floor(performance.now() / 200) % 3;
      drawText(g, '~', cx - 6 + b, top - 8, C.white, { shadow: C.ink }); drawText(g, '~', cx + 4 - b, top - 12, C.white, { shadow: C.ink });
    } else if (!a.awake && a.cfg.cook) { // stirring the pot
      drawObj(g, 'pot', cx + (dir === 1 ? -9 : 9), Math.round(a.y) - 1);
      if (Math.floor(performance.now() / 400) % 2) drawText(g, '~', cx + (dir === 1 ? -10 : 8), Math.round(a.y) - 11, C.white);
    }
    // '?' suspicious, '!' about to chase: shape AND colour, so it reads for colour-blind players too
    if (a.alert > 0.12 && a.awake && !a.say) {
      const danger = a.alert >= 0.6;
      drawText(g, danger ? '!' : '?', cx - 1, top - 8, danger ? C.red : C.yellow, { scale: 2, shadow: C.ink });
    }
    if (a.alert > 0.05 && a.awake) {
      g.fillStyle = C.ink; g.fillRect(cx - 7, top - 3, 14, 3);
      g.fillStyle = a.alert >= 0.6 ? C.red : C.yellow; g.fillRect(cx - 6, top - 2, Math.round(12 * Math.min(1, a.alert)), 1);
    }
  }

  // The tricycle's sprite is a side view; driving up or down the road it is turned on its side.
  drawTrike(g, a) {
    const horiz = Math.abs(Math.cos(a.a)) >= Math.abs(Math.sin(a.a));
    const s = getSprite('trike', Math.cos(a.a) < 0 ? 1 : 2, 0), x = Math.round(a.x), y = Math.round(a.y);
    g.globalAlpha = 0.25; g.fillStyle = C.ink; g.fillRect(x - 9, y + 3, 18, 3); g.globalAlpha = 1;
    if (horiz) { g.drawImage(s, x - (s.width >> 1), y + 5 - s.height); return; }
    g.save(); g.translate(x, y); g.rotate(Math.sin(a.a) > 0 ? Math.PI / 2 : -Math.PI / 2);
    g.drawImage(s, -(s.width >> 1), -(s.height >> 1)); g.restore();
  }

  // Big maps: adults who are onto you get an arrow on the screen edge (shape + colour by state),
  // and noises heard off screen ping where they came from.
  drawThreats(g) {
    if (!this.scrolls) return;
    const w = this.world, now = performance.now();
    const list = [];
    for (const a of w.adults) {
      if (a.cfg.harmless || !a.awake) continue;
      const chase = a.state === 'chase', sus = !chase && (a.alert >= 0.3 || SUSPICIOUS.has(a.state));
      if (!chase && !sus) continue;
      const sx = a.x - this.cx, sy = a.y - this.cy;
      if (sx > 0 && sx < VIEW_W && sy > 0 && sy < MAP_H) continue;
      list.push({ sx, sy, chase, d: Math.hypot(a.x - w.player.x, a.y - w.player.y) });
    }
    list.sort((u, v) => u.d - v.d);
    for (const t of list.slice(0, 4)) {
      const e = edgePoint(t.sx, t.sy, 8), m = Math.hypot(e.dx, e.dy) || 1, ux = e.dx / m, uy = e.dy / m;
      const col = t.chase ? C.red : C.yellow, big = t.chase && Math.floor(now / 150) % 2;
      disc(g, e.x, e.y, 6 + (big ? 1 : 0), C.ink);
      if (t.chase) { // triangle pointing at him
        g.fillStyle = col;
        for (let i = 0; i < 6; i++) { const cx = e.x + ux * (i - 2), cy = e.y + uy * (i - 2), hw = 5 - i; g.fillRect(Math.round(cx - Math.abs(uy) * hw), Math.round(cy - Math.abs(ux) * hw), Math.max(1, Math.round(Math.abs(uy) * hw * 2) + 1), Math.max(1, Math.round(Math.abs(ux) * hw * 2) + 1)); }
        drawText(g, '!', e.x - 1, e.y - 2, C.ink);
      } else { // diamond with a ?
        g.fillStyle = col;
        for (let i = -4; i <= 4; i++) g.fillRect(e.x - (4 - Math.abs(i)), e.y + i, (4 - Math.abs(i)) * 2 + 1, 1);
        drawText(g, '?', e.x - 1, e.y - 2, C.ink);
      }
    }
    for (const p of this.pings) {
      const e = edgePoint(p.x - this.cx, p.y - this.cy, 4), r = Math.round(3 + p.age * 12);
      g.globalAlpha = 1 - p.age / 0.8; ring(g, e.x, e.y, r, p.tattle ? C.red : C.yellow, 1); g.globalAlpha = 1;
    }
  }

  // Big maps: when the objective is off screen, show a marker on the screen edge pointing at it.
  drawCompass(g) {
    if (!this.scrolls) return;
    const w = this.world, p = w.player;
    let goal = null, col = C.gold;
    if (w.open) { goal = w.exit; col = C.green; }
    else {
      let bd = Infinity;
      for (const t of w.targets) if (!t.done && !t.bonus) { const d = Math.hypot(t.x - p.x, t.y - p.y); if (d < bd) { bd = d; goal = t; } }
    }
    if (!goal) return;
    const sx = goal.x - this.cx, sy = goal.y - this.cy;
    if (sx > 4 && sx < VIEW_W - 4 && sy > 4 && sy < MAP_H - 4) return;
    const e = edgePoint(sx, sy, 9);
    const pulse = Math.floor(performance.now() / 300) % 2;
    disc(g, e.x, e.y, 6, C.ink);
    disc(g, e.x, e.y, 4, pulse ? col : C.white);
    const m = Math.hypot(e.dx, e.dy) || 1;
    disc(g, Math.round(e.x + (e.dx / m) * 7), Math.round(e.y + (e.dy / m) * 7), 1, col);
  }

  // Small icon on the action button saying what it will do.
  actIcon(g, pr, x, y) {
    const icon = !pr ? 'hand' : { steal: 'hand', hide: 'box', unhide: 'out', door: 'door', locked: 'lock', switch: 'leverOff', device: 'radio', buhat: 'palanggana', sahod: 'palanggana', baba: 'palanggana', tapon: 'drain' }[pr.kind] || 'hand';
    drawObj(g, icon, x, y); // pixel art is never scaled by a fraction (it would drop pixels)
  }

  drawHud(g) {
    const w = this.world, sh = { shadow: C.ink }, now = performance.now();
    g.save(); g.translate(0, this.hudY - TOP); // the top bar: above the map when there is room, else over its top edge
    g.globalAlpha = 0.85; g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, 12); g.globalAlpha = 1;
    const sob = w.sobra, q = this.level.quota;
    const base = `${sob ? q : w.coins}/${q}`, catTxt = w.player.carry ? 'GOT IT!' : w.open ? 'HOME!' : '0/1';
    let x = 13;
    if (w.mods.cat) { // the cat has one job
      drawObj(g, 'isdaBit', 7, 6);
      drawBig(g, catTxt, x, 2, w.player.carry || w.open ? C.green : C.white); x += bigWidth(catTxt);
    } else {
      drawCoin(g, 3, 3);
      drawBig(g, base, x, 2, w.coins >= q && q > 0 && !sob ? C.green : C.white); x += bigWidth(base);
      if (sob) { drawBig(g, `+${sob}`, x + 4, 2, C.orange); x += 4 + bigWidth(`+${sob}`); } // SOBRA in orange
    }
    // chances left: little tsinelas, crossed out once used
    if (w.lives > 1 && !this.level.hingi) { // (nobody is counting chances in the epilogue)
      x += 6;
      for (let i = 0; i < w.lives; i++) {
        const used = i >= w.livesLeft;
        g.fillStyle = used ? C.dgray : C.pink; g.fillRect(x + 1, 3, 2, 6); g.fillRect(x + 4, 3, 2, 6);
        if (used) { g.fillStyle = C.red; g.fillRect(x, 6, 7, 1); }
        x += 9;
      }
      // PALUSOT: Kuya Ramil's one excuse this level (a little speech bubble: gold while he still has it)
      if (w.mods.palusot) {
        const col = w.palusot > 0 && !w.finalPhase ? C.gold : C.dgray;
        g.fillStyle = col; g.fillRect(x + 2, 3, 7, 5); g.fillRect(x + 3, 8, 1, 1);
      }
    }
    if (w.bonus) { drawObj(g, 'alkansya', VIEW_W - 52, 6); drawBig(g, `+${w.bonus}`, VIEW_W - 46, 2, C.green); }
    drawBig(g, `${Math.floor(w.time)}S`, VIEW_W - 4, 2, w.time > this.level.par ? C.orange : C.white, { align: 'right' });
    if (w.patience) { // "KAIN NA!" meter: Mama calls you for dinner when it runs out. The notch is par time.
      const left = Math.max(0, 1 - w.time / w.patience), bw = VIEW_W - 8;
      g.fillStyle = C.ink; g.fillRect(4, 13, bw, 3);
      g.fillStyle = left < 0.25 ? C.red : C.orange; g.fillRect(5, 14, Math.round((bw - 2) * left), 1);
      const par = 5 + Math.round((bw - 2) * Math.max(0, 1 - this.level.par / w.patience));
      g.fillStyle = C.green; g.fillRect(par, 12, 1, 5);
      if (left < 0.25 && Math.floor(now / 300) % 2) drawText(g, 'KAIN NA SOON!', VIEW_W / 2, 18, C.red, { ...sh, align: 'center' });
    }
    this.drawBoss(g);
    if (dev.on) this.drawDev(g);

    // tips / tutorial coach / level hint: one line at the top, away from your thumbs
    const th = this.coach ? 'coach' : null; // the tutorial draws its own panel (drawCoachHud)
    const line = this.tip ? this.tip.text : th || (this.level.hint && w.time < 8 ? this.level.hint : null);
    if (line && !this.coach && !(w.patience && w.time / w.patience > 0.75 && !this.tip)) {
      drawBigBand(g, line, 19, this.tip ? C.green : th ? C.white : C.yellow, { alpha: 0.8 });
    }
    g.restore();
    this.tipButton = this.tip && !this.coach ? TIP_BUTTONS[this.tip.id] || null : null; // drawn after the buttons
    if (this.toast) {
      const L = wrapBig(this.toast.text, 220), tw = Math.min(236, Math.max(140, ...L.map(bigWidth)) + 12);
      drawBigBand(g, null, 140, this.toast.col, { w: tw, x: Math.round((VIEW_W - tw) / 2), lines: L, alpha: 0.85 });
    }
    if (this.cardT > 0 && !this.banner && !w.scold && w.status === "play") { g.globalAlpha = Math.min(1, this.cardT * 2); this.drawMissions(g, 160, this.opts.earned | 0); g.globalAlpha = 1; }
    if (w.scold) { // the close-call beat: who found you, and what's left (amber: the red "HULI KA!" is the ending's)
      const a = w.scold.who;
      g.globalAlpha = 0.8; g.fillStyle = C.ink; g.fillRect(0, 96, VIEW_W, 38); g.globalAlpha = 1;
      g.fillStyle = C.orange; g.fillRect(5, 99, 32, 32);
      if (!drawPortrait(g, a.type, 7, 101)) drawActor(g, a.type, 21, 124, 0, 'alert');
      drawText(g, 'MUNTIK NA!', 44, 100, C.orange, { scale: 3, shadow: C.ink });
      drawText(g, `${w.livesLeft} ${w.livesLeft === 1 ? 'CHANCE' : 'CHANCES'} LEFT`, 44, 122, C.white);
    }

    // control strip (left-handed: buttons on the left, text on the right)
    const L = layout.left, tx = L ? VIEW_W - 6 : 6, al = { align: L ? 'right' : 'left' };
    g.fillStyle = C.ink; g.fillRect(0, MAP_H, VIEW_W, VIEW_H - MAP_H);
    g.fillStyle = C.wallD; g.fillRect(0, MAP_H, VIEW_W, 1);
    const pr = w.prompt;
    const left = this.level.quota - w.coins, need = left > 0 ? `${this.level.giveBack ? 'PUT BACK' : this.level.hingi ? 'ASK FOR' : this.level.tulo ? 'KITTENS: FIND' : 'NEED'} ${left} MORE` : w.escort ? 'BRING MINGMING TO THE DESK' : w.missing?.kind === 'bilin' ? `ERRAND: ${w.targets.filter((t) => t.must && !t.done).length} LEFT` : w.missing?.kind === 'isda' ? 'GET THE FISH' : 'GET THE MILK';
    const goal = w.finale?.type === 'tulo' ? (w.finale.stage === 'gather' ? 'BACK TO THE BOX!' : 'KEEP THE BOX DRY!') : w.flood?.active ? (w.flood.stopped ? 'GET THEM INSIDE!' : 'STOP THE WATER! GET INSIDE!') : w.mods.cat ? 'BRING IT HOME: THE BUTAS!' : null;
    drawText(g, pr ? pr.label : goal && (w.open || w.finale) ? goal : w.open ? (w.escort && !w.escortHere ? 'WAIT FOR MINGMING' : w.escort ? 'TO THE VET DESK!' : w.finale?.type === 'seat' ? 'UPO NA! TO YOUR SEAT' : w.finale?.type === 'photo' ? 'PICTURE! BLEND IN OR HIDE' : 'GO TO THE EXIT!') : need, tx, MAP_H + 8, pr ? C.gold : w.open || goal ? C.green : C.gray, al);
    if (w.player.blend) drawText(g, 'BLENDING IN', tx, MAP_H + 17, C.green, al);
    let kx = L ? VIEW_W - 9 : 9;
    for (const k of w.player.keys) { drawObj(g, 'key', kx, MAP_H + 24, k); kx += L ? -10 : 10; }
    const hints = this.level.tutorial || w.time < 12; // control reminders: the first level, and the first seconds of the rest
    if (!hints) { /* a clean strip */ }
    else if (!L) drawText(g, this.touch ? 'DRAG: MOVE   DRAG FAR: RUN' : w.mods.cat ? 'SHIFT RUN  E BITE / HIDE  F SWAT' : 'SHIFT RUN  E ACT  Q THROW  F SKILL', 6, MAP_H + 32, C.dgray);
    else drawText(g, this.touch ? 'DRAG: MOVE' : 'E ACT Q THROW', tx, MAP_H + 32, C.dgray, al);

    g.save(); g.translate(0, -TOP); // (buttons and the stick: screen coordinates, where the input finds them)
    // KASABWAT: switch to the other kid (their initial; grey while it cools down or once they are out)
    if (w.kids) {
      const other = w.kids.find((k) => k !== w.player), ok = other && !other.out && !(w.swapT > 0);
      disc(g, SWAP_BTN.x, SWAP_BTN.y, SWAP_BTN.r, C.ink);
      disc(g, SWAP_BTN.x, SWAP_BTN.y, SWAP_BTN.r - 2, ok ? C.purple : C.dgray);
      drawText(g, other && !other.out ? CHARACTERS[other.look]?.name.split(' ').pop() || 'SWAP' : 'OUT', SWAP_BTN.x, SWAP_BTN.y - 2, ok ? C.white : C.gray, { align: 'center' });
    }
    // character skill button
    const sk = w.mods.skill, cd = w.abilityCd, rdy = cd <= 0;
    disc(g, ABILITY_BTN.x, ABILITY_BTN.y, ABILITY_BTN.r, C.ink);
    disc(g, ABILITY_BTN.x, ABILITY_BTN.y, ABILITY_BTN.r - 2, rdy ? (this.input.abilityHeld() ? C.green : C.teal) : C.dgray);
    drawText(g, rdy ? sk.label : String(Math.ceil(cd)), ABILITY_BTN.x, ABILITY_BTN.y - 2, rdy ? C.ink : C.gray, { align: 'center' });

    // pause button
    disc(g, PAUSE_BTN.x, PAUSE_BTN.y, PAUSE_BTN.r, C.ink);
    disc(g, PAUSE_BTN.x, PAUSE_BTN.y, PAUSE_BTN.r - 2, C.wallD);
    g.fillStyle = C.white; g.fillRect(PAUSE_BTN.x - 3, PAUSE_BTN.y - 4, 2, 8); g.fillRect(PAUSE_BTN.x + 1, PAUSE_BTN.y - 4, 2, 8);

    // action button: icon + label for what it does right now
    const down = this.input.action();
    disc(g, BUTTON.x, BUTTON.y, BUTTON.r, C.ink);
    disc(g, BUTTON.x, BUTTON.y, BUTTON.r - 2, pr ? (down ? C.gold : C.gold2) : C.dgray);
    if (pr) this.actIcon(g, pr, BUTTON.x, BUTTON.y - 7);
    const label = pr ? pr.label : this.level.hingi ? 'ASK' : w.mods.cat ? 'BITE' : this.level.tulo ? 'SAVE' : 'TAKE';
    drawText(g, label.length > 7 ? label.slice(0, 7) : label, BUTTON.x, BUTTON.y + (pr ? 2 : -2), pr ? C.ink : C.gray, { align: 'center' });

    // throw button (hold to aim) + item selector
    const items = w.player.items;
    if (items.length && !w.noThrow) {
      disc(g, BUTTON2.x, BUTTON2.y, BUTTON2.r, C.ink);
      disc(g, BUTTON2.x, BUTTON2.y, BUTTON2.r - 2, this.input.throwHeld() ? C.sofa2 : C.sofa);
      drawObj(g, items[items.length - 1], BUTTON2.x, BUTTON2.y - 2);
      drawText(g, `x${items.filter((k) => k === items[items.length - 1]).length}`, BUTTON2.x, BUTTON2.y + 5, C.white, { align: 'center' });
      if (new Set(items).size > 1) {
        disc(g, ITEM_BTN.x, ITEM_BTN.y, ITEM_BTN.r, C.ink);
        disc(g, ITEM_BTN.x, ITEM_BTN.y, ITEM_BTN.r - 1, C.wallD);
        const other = items.find((k) => k !== items[items.length - 1]);
        drawObj(g, other, ITEM_BTN.x, ITEM_BTN.y);
      }
    }

    const s = this.input.stick();
    if (s) {
      g.globalAlpha = 0.35; disc(g, Math.round(s.sx), Math.round(s.sy), 22, C.white);
      g.globalAlpha = 0.7; disc(g, Math.round(s.x), Math.round(s.y), 8, C.white); g.globalAlpha = 1;
    }
    g.restore();
    if (this.coach) this.drawCoachHud(g);
    else if (this.tipButton) { const [b, hold] = this.tipButton; this.drawButtonHint(g, b === 'throw' ? (this.world.player.items.length ? BUTTON2 : null) : b === 'skill' ? ABILITY_BTN : BUTTON, hold, b); }
  }

  // A pulsing ring on an on-screen button, with TAP / HOLD (or the key) above it.
  drawButtonHint(g, btn, hold, kind = 'act') {
    if (!btn) return;
    g.save(); g.translate(0, -TOP); // (a button: screen coordinates)
    const pulse = Math.floor(performance.now() / 250) % 2;
    ring(g, btn.x, btn.y, btn.r + 3 + pulse, C.gold, 1); ring(g, btn.x, btn.y, btn.r + 5 + pulse, C.ink, 2);
    const keyName = kind === 'throw' ? 'Q' : kind === 'skill' ? 'F' : 'E';
    const label = this.touch ? (kind === 'throw' ? 'HOLD + SLIDE' : hold ? 'HOLD' : 'TAP') : kind === 'throw' ? 'Q + CLICK' : `${hold ? 'HOLD ' : ''}${keyName}`;
    const lw = textWidth(label) + 4, lx = Math.max(1, Math.min(VIEW_W - lw - 1, btn.x - lw / 2)), ly = btn.y - btn.r - 16 - pulse;
    g.fillStyle = C.gold; g.fillRect(lx, ly, lw, 9); drawText(g, label, lx + 2, ly + 2, C.ink);
    g.restore();
  }
}
