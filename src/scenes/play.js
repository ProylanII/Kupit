// Draws a World and turns its events into sound/particles. All rules live in game/world.js.
import { TILE } from '../world/tilemap.js';
import { angDiff } from '../world/los.js';
import { World } from '../game/world.js';
import { buildBackground } from '../render/tiles.js';
import { drawActor, drawTarget, drawCoin, drawObj, drawPortrait, getSprite, KEY_COLORS } from '../render/sprites.js';
import { C, hexToRgb } from '../render/palette.js';
import { drawText, textWidth } from '../ui/font.js';
import { sfx } from '../core/audio.js';
import { dev } from '../core/dev.js';
import { vibrate, canVibrate, hapticsOn } from '../core/haptics.js';
import { settings } from '../core/settings.js';
import { GHOST_EVERY, ghostAt } from '../game/ghost.js';
import { VIEW_W, VIEW_H, MAP_H, BUTTON, BUTTON2, PAUSE_BTN, ABILITY_BTN, ITEM_BTN, layout } from '../core/input.js';

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
  hide: 'TAGO! PRESS ACT TO HIDE. MOVE TO COME OUT',
  throw: (p) => (p.input.touchUsed ? 'TSINELAS! HOLD THE BLUE BUTTON TO AIM, LET GO' : 'TSINELAS! HOLD Q TO AIM, LET GO TO THROW'),
  pandesal: 'PANDESAL! THROW IT NEAR ASO TO KEEP HIM BUSY',
  cycle: (p) => (p.input.touchUsed ? 'TWO KINDS OF ITEMS: TAP THE SMALL DOT TO SWITCH' : 'TWO KINDS OF ITEMS: R SWITCHES WHICH ONE'),
  skill: (p) => `SKILL READY: ${p.world.mods.skill.label}! ${p.input.touchUsed ? 'GREEN BUTTON' : 'PRESS F'}`,
  door: 'DOORS BLOCK SIGHT. ACT OPENS AND CLOSES THEM',
  locked: 'LOCKED! FIND THE KEY OF THE SAME COLOR',
  switch: 'LEVERS OPEN GATES. SOME SHUT AGAIN SOON',
  device: 'TV OR RADIO: TURN IT ON TO PULL ADULTS AWAY',
  kain: 'KAIN NA BAR: GET OUT BEFORE DINNER TIME!',
  caught: (p) => `CAUGHT! SOME COINS WENT BACK. ${p.world.livesLeft} CHANCES LEFT`,
  dog: 'ASO BARKS WHEN HE SEES YOU. PANDESAL BRIBES HIM',
  tanod: "TANOD'S FLASHLIGHT SWEEPS. HIS WHISTLE CALLS ALL",
  tindera: 'TINDERA SHOUTS, BUT NEVER LEAVES HER STALL',
  bisita: 'GUESTS BLOCK THE VIEW. HIDE BEHIND THEM',
  trike: 'TRICYCLE! IT KNOCKS YOU DOWN. TIME YOUR CROSSING',
  seenHide: 'THEY SAW YOU HIDE! THE EYE MEANS: NOT SAFE HERE',
};

export class Play {
  // opts: { tips: { seen, mark(id) }, ghost: samples | null, outfit: 'pula', record: true }
  constructor(level, input, loadout, opts = {}) {
    this.input = input;
    this.world = new World(level, loadout);
    this.level = level;
    this.opts = opts;
    this.look = opts.outfit && opts.outfit !== 'basic' ? `${this.world.mods.look}~${opts.outfit}` : this.world.mods.look;
    this.bg = buildBackground(this.world.map, { night: !!level.night, pasko: !!level.pasko });
    this.parts = [];
    this.rings = [];
    this.pings = [];   // off-screen noises
    this.windups = []; // tattle shouts charging up
    this.tickT = 0;
    this.banner = level.boss ? { kind: 'boss', text: level.boss.title || level.name, t: 3 } : null;
    this.coneData = new ImageData(VIEW_W, VIEW_H);
    this.coneCv = document.createElement('canvas');
    this.coneCv.width = VIEW_W; this.coneCv.height = VIEW_H;
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
    this.updateCamera(1);
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
    this.tipQ.push(id);
  }

  updateTips(dt) {
    const w = this.world, p = w.player, pr = w.prompt;
    if (this.opts.tips) {
      if (pr) {
        if (pr.kind === 'hide') this.showTip('hide');
        else if (pr.kind === 'door') this.showTip('door');
        else if (pr.kind === 'locked') this.showTip('locked');
        else if (pr.kind === 'switch') this.showTip('switch');
        else if (pr.kind === 'device') this.showTip('device');
        else if (pr.kind === 'steal') this.showTip(`kind:${pr.obj.kind}`);
      }
      if (new Set(p.items).size > 1) this.showTip('cycle');
      if (w.time > 2 && !this.level.tutorial && w.abilityCd <= 0) this.showTip('skill');
      if (w.patience && w.time > 1) this.showTip('kain');
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
    this.input.button2Enabled = w.player.items.length > 0 && !w.noThrow;
    this.input.abilityEnabled = true;
    this.input.itemEnabled = new Set(w.player.items).size > 1;
    w.update(dt, this.input.poll());
    this.steps++;
    if (!this.stealthLost && !w.stealthOk) { // once per run, so the star rule is never a surprise on the clear screen
      this.stealthLost = true;
      if (!w.scold && w.status === 'play') this.toast = { text: 'SPOTTED! NO SILENT STAR THIS RUN', col: C.orange, t: 2.2 };
    }
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
    keep(this.parts, (p) => p.l > 0);
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
    if (this.toast && (this.toast.t -= dt) <= 0) this.toast = null;
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
      case 'stealNoise': ({ wallet: sfx.zipper, bayong: sfx.rustle, piggy: sfx.jingle, candy: sfx.jingle, alkansya: sfx.jingle }[e.kind] || sfx.clasp)(); break;
      case 'coin':
        if (e.kind === 'purse') sfx.clasp();
        sfx.coin(); this.buzz(15, C.gold);
        for (let i = 0; i < e.n * 2; i++) this.parts.push({ x: e.x + (Math.random() * 14 - 7), y: e.y - 4, vy: -50 - Math.random() * 40, l: 1 });
        break;
      case 'alkansya': this.toast = { text: `ALKANSYA! +${e.n} BONUS`, col: C.green, t: 2.2 }; break;
      case 'spotted': case 'bark': sfx.alert(); this.buzz(40); this.kick(2); break;
      case 'caught':
        if (e.final) { sfx.caught(); this.buzz([80, 40, 140]); this.kick(6); if (settings.flash) this.flash = 0.6; }
        else {
          sfx.scold(); this.buzz([60, 30, 60]); this.kick(4); if (settings.flash) this.flash = 0.45;
          this.toast = { text: e.lost ? `-${e.lost} COINS WENT BACK` : 'CAUGHT!', col: C.orange, t: 2.4 };
          this.showTip('caught');
        }
        break;
      case 'respawn': sfx.hide(); for (let i = 0; i < 10; i++) this.dust.push({ x: e.x + Math.random() * 12 - 6, y: e.y + Math.random() * 6, vx: Math.random() * 20 - 10, l: 0.6 }); break;
      case 'clear': sfx.clear(); this.buzz([30, 30, 30], C.green); break;
      case 'door': case 'switch': sfx.click(); break;
      case 'creak': case 'locked': sfx.creak(); break;
      case 'ouch': sfx.ouch(); this.buzz(60); this.kick(3); if (w.adults.some((a) => a.cfg.vehicle && a.say)) sfx.horn(); break;
      case 'pickup': case 'unlock':
        sfx.pickup();
        if (e.kind === 'tsinelas') this.showTip('throw');
        if (e.kind === 'pandesal') this.showTip('pandesal');
        break;
      case 'cycle': sfx.click(); break;
      case 'throw': sfx.whoosh(); break;
      case 'ability': sfx.skill(); this.buzz(20, C.teal); break;
      case 'phase': sfx.phase(); this.buzz([40, 30, 40]); this.kick(3); this.banner = { kind: 'phase', text: e.text, t: 3 }; break;
      case 'land': sfx.thud(); break;
      case 'hide': case 'unhide': sfx.hide(); if (e.seen) this.showTip('seenHide'); break;
      case 'device': sfx.music(); break;
    }
    this.opts.log?.(e, w);
  }

  // ---------------------------------------------------------------- drawing
  drawCones(g) {
    const d = this.coneData.data, cx = this.cx, cy = this.cy;
    d.fill(0);
    for (const a of this.world.adults) {
      if (!a.awake || a.freezeT > 0 || a.cfg.harmless) continue; // charmed adults see nothing, so no cone
      const { range, fov } = a.cfg, va = a.va;
      const N = a.rays.length - 1;
      const t = Math.min(1, a.alert * 1.4);
      const col = [0, 1, 2].map((i) => Math.round(YELLOW[i] + (RED[i] - YELLOW[i]) * t));
      const x0 = Math.max(cx, Math.floor(a.x - range)), x1 = Math.min(cx + VIEW_W - 1, Math.ceil(a.x + range));
      const y0 = Math.max(cy, Math.floor(a.y - range)), y1 = Math.min(cy + VIEW_H - 1, Math.ceil(a.y + range));
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          // the dither pattern changes with alert level too, so the state reads without colour
          if (a.alert < 0.35 ? (px + py) & 1 : a.alert < 0.7 ? (px & 1) && (py & 1) : 0) continue;
          const dx = px + 0.5 - a.x, dy = py + 0.5 - a.y;
          const dist = Math.hypot(dx, dy);
          if (dist > range) continue;
          const rel = angDiff(Math.atan2(dy, dx) - va);
          if (rel < -fov || rel > fov) continue;
          if (dist > a.rays[Math.round(((rel + fov) / (2 * fov)) * N)]) continue;
          const o = ((py - cy) * VIEW_W + (px - cx)) * 4;
          d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
        }
      }
    }
    this.coneG.putImageData(this.coneData, 0, 0);
    g.drawImage(this.coneCv, cx, cy);
  }

  // Night: a dark layer with pools of light cut out (kid's eyes adjusting, TV glow, moonlight, the open exit).
  // Brownout: darker, smaller pools, no moonlight through the windows.
  drawNight(g) {
    if (!this.nightCv) {
      this.nightCv = document.createElement('canvas');
      this.nightCv.width = VIEW_W; this.nightCv.height = VIEW_H;
      this.nightG = this.nightCv.getContext('2d');
    }
    const n = this.nightG, cx = this.cx, cy = this.cy, w = this.world, now = performance.now() / 1000;
    const brown = !!this.level.brownout;
    n.globalCompositeOperation = 'source-over';
    n.clearRect(0, 0, VIEW_W, VIEW_H);
    n.globalAlpha = brown ? 0.82 : 0.68; n.fillStyle = '#0c1230'; n.fillRect(0, 0, VIEW_W, VIEW_H);
    n.globalCompositeOperation = 'destination-out';
    const pools = [];
    const light = (x, y, rad, tint) => {
      const sx = Math.round(x - cx), sy = Math.round(y - cy);
      if (sx < -rad || sy < -rad || sx > VIEW_W + rad || sy > VIEW_H + rad) return;
      for (const [k, a] of [[1, 0.3], [0.72, 0.55], [0.45, 0.85]]) { n.globalAlpha = a; disc(n, sx, sy, Math.max(1, Math.round(rad * k)), '#000'); }
      if (tint) pools.push([x, y, Math.round(rad * 0.72), tint]);
    };
    const p = w.player;
    light(p.x, p.y, brown ? 18 : 24);
    if (!brown) for (const wi of this.bg.windows || []) light(wi.x, wi.y + 4, 15, this.level.pasko ? C.gold : '#9fc0ff');
    for (const d of w.devices) if (d.on) light(d.x, d.y, 34 + (Math.floor(now * 9) % 3), '#7fd7ff');
    for (const a of w.adults) if (a.type === 'tanod' && a.awake) light(a.x + Math.cos(a.va) * 30, a.y + Math.sin(a.va) * 30, 22, C.yellow); // flashlight
    if (w.open) light(w.exit.x, w.exit.y, 20, C.green);
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
      } else if (c === 'G' || c === 'g') {
        g.fillStyle = C.dgray; g.fillRect(x, y, TILE, 2);
        if (c === 'G') for (let i = 1; i < TILE; i += 3) { g.fillStyle = C.ink; g.fillRect(x + i, y + 2, 2, 14); g.fillStyle = C.gray; g.fillRect(x + i, y + 2, 1, 14); }
      }
    }
  }

  drawExit(g) {
    const w = this.world, x = w.exit.x - 8, y = w.exit.y - 8;
    const pulse = w.open && Math.floor(performance.now() / 250) % 2;
    g.fillStyle = C.table; g.fillRect(x + 1, y, 14, 16);
    g.fillStyle = w.open ? (pulse ? C.green : '#2fb56b') : C.dgray; g.fillRect(x + 3, y + 2, 10, 14);
    g.fillStyle = C.gold; g.fillRect(x + 10, y + 9, 2, 2);
    drawText(g, w.open ? 'EXIT' : 'LOCKED', w.exit.x, y - 7, w.open ? C.green : C.gray, { align: 'center', shadow: C.ink });
  }

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
      else { g.fillStyle = C.woodLine; g.fillRect(t.x - 6, t.y - 1, 12, 1); g.fillRect(t.x - 3, t.y + 3, 8, 1); }
    }
    this.drawDynamicTiles(g);
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
    for (const t of w.targets) {
      drawTarget(g, t.kind, t.x, t.y, t.done);
      if (t.bonus && !t.done && Math.floor(now / 400) % 3 === 0) { g.fillStyle = C.white; g.fillRect(Math.round(t.x) + 3, Math.round(t.y) - 5, 1, 1); } // glint
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
    if (!p.hidden) actors.push(p);
    actors.sort((u, v) => u.y - v.y);
    const blink = p.graceT > 0 && Math.floor(now / 100) % 2;
    for (const e of actors) {
      if (e === p) {
        if (!blink) drawActor(g, this.look, p.x, p.y, p.dir, w.status === 'caught' || w.scold ? 'caught' : p.stealing ? 'reach' : p.moving ? Math.floor(p.stepT * 8) % 4 : 0);
      } else this.drawAdult(g, e);
    }
    for (const h of w.hides) if (h.kind === 'curtain') drawObj(g, 'curtain', h.x, h.y - 1);
    if (p.hidden) { // peeking eyes
      const b = Math.floor(performance.now() / 700) % 4 === 0;
      if (!b) { g.fillStyle = C.white; g.fillRect(p.x - 3, p.y - 3, 2, 2); g.fillRect(p.x + 1, p.y - 3, 2, 2); g.fillStyle = C.ink; g.fillRect(p.x - 2, p.y - 2, 1, 1); g.fillRect(p.x + 2, p.y - 2, 1, 1); }
      if (w.adults.some((a) => a.sawHide)) { // someone saw you go in: this spot is not safe
        drawObj(g, 'eye', p.x, p.y - 15 - (Math.floor(now / 250) % 2));
      }
    }
    for (const pr of w.projectiles) drawObj(g, pr.kind, pr.x, pr.y);
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
    for (const a of w.adults) if (a.say) bubble(g, a.say.text, a.x, Math.round(a.y) - 34, this.cx, C.ink, a.state === 'chase' || w.scold?.who === a ? C.red : C.white);
    g.restore();
    if (this.flash > 0) { g.globalAlpha = this.flash * 0.5; g.fillStyle = C.red; g.fillRect(0, 0, VIEW_W, MAP_H); g.globalAlpha = 1; }
    if (this.pulse > 0) { // visual stand-in for vibration
      g.globalAlpha = Math.min(1, this.pulse * 2.5); g.fillStyle = this.pulseCol;
      g.fillRect(0, 0, VIEW_W, 3); g.fillRect(0, MAP_H - 3, VIEW_W, 3); g.fillRect(0, 0, 3, MAP_H); g.fillRect(VIEW_W - 3, 0, 3, MAP_H);
      g.globalAlpha = 1;
    }
    this.drawThreats(g);
    this.drawCompass(g);
    this.drawHud(g);
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
      g.fillStyle = C.ink; g.fillRect(4 + i * 8, 12, 7, 5);
      g.fillStyle = i <= w.phase ? C.red : C.dgray; g.fillRect(5 + i * 8, 13, 5, 3);
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
      drawText(g, label, VIEW_W - 62, 12, col, { align: 'right', shadow: C.ink });
      g.fillStyle = C.ink; g.fillRect(VIEW_W - 60, 12, 56, 5);
      g.fillStyle = col; g.fillRect(VIEW_W - 59, 13, Math.round(54 * Math.max(0, Math.min(1, fill))), 3);
    }
    if (w.escapeT > 0) { // escape countdown
      const blink = w.escapeT < 6 && Math.floor(performance.now() / 200) % 2;
      g.globalAlpha = 0.75; g.fillStyle = C.ink; g.fillRect(VIEW_W / 2 - 50, 31, 100, 20); g.globalAlpha = 1;
      drawText(g, `TAKBO! ${Math.ceil(w.escapeT)}`, VIEW_W / 2, 34, blink ? C.white : C.red, { scale: 2, align: 'center', shadow: C.ink });
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

  // Step-by-step coaching for the tutorial level, driven by what the player is doing.
  tutorialHint() {
    if (!this.level.tutorial) return null;
    const w = this.world, p = w.player;
    if (w.scold) return 'CAUGHT! MAMA TOOK SOME COINS BACK';
    if (w.open) return 'EXIT IS OPEN! WALK TO THE GREEN DOOR';
    if (p.hidden) return 'SAFE! WAIT, THEN MOVE TO COME OUT';
    if (w.targets.some((t) => t.progress > 0 && !t.done && !t.bonus)) return 'KEEP HOLDING THE BUTTON... WATCH THE CONE';
    if (w.adults.some((a) => a.awake && a.alert > 0.3)) return 'SHE SEES YOU! BACK OFF OUT OF THE YELLOW';
    if (w.coins === 0 && w.time < 5) return 'DRAG OR WASD TO MOVE. FAR DRAG / SHIFT RUNS';
    if (w.coins === 0) return 'WALK TO THE PURSE, HOLD KUPIT. AVOID YELLOW';
    return 'GOOD! NOW FIND THE EXIT';
  }

  drawAdult(g, a) {
    if (a.cfg.vehicle) { this.drawTrike(g, a); return; }
    const dir = Math.abs(Math.cos(a.a)) > Math.abs(Math.sin(a.a)) ? (Math.cos(a.a) < 0 ? 1 : 2) : (Math.sin(a.a) < 0 ? 3 : 0);
    const sleeping = !a.awake && (a.cfg.sleepy || a.state === 'eat');
    const shout = this.world.catcher === a || (a.awake && !a.moving && (a.state === 'chase' || a.alert >= 0.6));
    const frame = a.cfg.sleepy && !a.awake ? 'sleep' : shout ? 'alert' : a.moving ? Math.floor(a.stepT * 6) % 4 : 0;
    const top = drawActor(g, a.type, a.x, a.y, dir, frame, { dim: !a.awake && a.cfg.sleepy });
    const cx = Math.round(a.x);
    if (a.cfg.harmless) return;
    if (sleeping && a.state !== 'eat') {
      const b = Math.floor(performance.now() / 500) % 2;
      drawText(g, a.cfg.depth && a.depth < 0.35 ? 'Z' : 'ZZ', cx + 4, top - 6 - b, a.cfg.depth && a.depth < 0.35 ? C.orange : C.white, { shadow: C.ink });
    } else if (!a.awake && a.cfg.cook) { // stirring the pot: back turned
      drawObj(g, 'pot', cx + (dir === 1 ? -9 : 9), Math.round(a.y) - 1);
      if (Math.floor(performance.now() / 400) % 2) drawText(g, '~', cx + (dir === 1 ? -10 : 8), Math.round(a.y) - 11, C.white);
    } else if (!a.awake && a.cfg.phone) {
      g.fillStyle = C.ink; g.fillRect(cx + (dir === 1 ? -7 : 5), Math.round(a.y) - 4, 4, 6);
      g.fillStyle = C.pink; g.fillRect(cx + (dir === 1 ? -6 : 6), Math.round(a.y) - 3, 2, 4);
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
    const icon = !pr ? 'hand' : { steal: 'hand', hide: 'box', unhide: 'out', door: 'door', locked: 'lock', switch: 'leverOff', device: 'radio' }[pr.kind] || 'hand';
    drawObj(g, icon, x, y); // pixel art is never scaled by a fraction (it would drop pixels)
  }

  drawHud(g) {
    const w = this.world, sh = { shadow: C.ink }, now = performance.now();
    drawCoin(g, 5, 5);
    const coinTxt = `${w.coins}/${this.level.quota}`;
    drawText(g, coinTxt, 13, 6, C.white, sh);
    // chances left: little tsinelas, crossed out once used
    if (w.lives > 1) {
      let x = 16 + textWidth(coinTxt);
      for (let i = 0; i < w.lives; i++) {
        const used = i >= w.livesLeft;
        g.fillStyle = C.ink; g.fillRect(x, 5, 7, 6);
        g.fillStyle = used ? C.dgray : C.pink; g.fillRect(x + 1, 6, 2, 4); g.fillRect(x + 4, 6, 2, 4);
        if (used) { g.fillStyle = C.red; g.fillRect(x, 8, 7, 1); }
        x += 8;
      }
    }
    if (w.bonus) { drawObj(g, 'alkansya', VIEW_W - 30, 26); drawText(g, `+${w.bonus}`, VIEW_W - 25, 23, C.green, sh); }
    drawText(g, this.level.name, VIEW_W / 2, 6, C.white, { ...sh, align: 'center' });
    drawText(g, `${Math.floor(w.time)}S`, VIEW_W - 5, 6, w.time > this.level.par ? C.orange : C.white, { ...sh, align: 'right' });
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
    const th = this.tutorialHint();
    const line = this.tip ? this.tip.text : th || (this.level.hint && w.time < 8 ? this.level.hint : null);
    if (line && !(w.patience && w.time / w.patience > 0.75 && !this.tip)) {
      g.globalAlpha = 0.75; g.fillStyle = C.ink; g.fillRect(0, 18, VIEW_W, 11); g.globalAlpha = 1;
      drawText(g, line, VIEW_W / 2, 21, this.tip ? C.green : th ? C.white : C.yellow, { align: 'center' });
    }
    if (this.toast) {
      g.globalAlpha = 0.8; g.fillStyle = C.ink; g.fillRect(VIEW_W / 2 - 70, 140, 140, 15); g.globalAlpha = 1;
      drawText(g, this.toast.text, VIEW_W / 2, 145, this.toast.col, { align: 'center' });
    }
    if (w.scold) { // the caught beat: who caught you, and what's left
      const a = w.scold.who;
      g.globalAlpha = 0.8; g.fillStyle = C.ink; g.fillRect(0, 96, VIEW_W, 38); g.globalAlpha = 1;
      g.fillStyle = C.red; g.fillRect(5, 99, 32, 32);
      if (!drawPortrait(g, a.type, 7, 101)) drawActor(g, a.type, 21, 124, 0, 'alert');
      drawText(g, 'HULI!', 44, 100, C.red, { scale: 3, shadow: C.ink });
      drawText(g, `${w.livesLeft} ${w.livesLeft === 1 ? 'CHANCE' : 'CHANCES'} LEFT`, 44, 122, C.white);
    }

    // control strip (left-handed: buttons on the left, text on the right)
    const L = layout.left, tx = L ? VIEW_W - 6 : 6, al = { align: L ? 'right' : 'left' };
    g.fillStyle = C.ink; g.fillRect(0, MAP_H, VIEW_W, VIEW_H - MAP_H);
    g.fillStyle = C.wallD; g.fillRect(0, MAP_H, VIEW_W, 1);
    const pr = w.prompt;
    drawText(g, pr ? pr.label : w.open ? 'GO TO THE EXIT!' : `NEED ${this.level.quota - w.coins} MORE`, tx, MAP_H + 8, pr ? C.gold : w.open ? C.green : C.gray, al);
    let kx = L ? VIEW_W - 9 : 9;
    for (const k of w.player.keys) { drawObj(g, 'key', kx, MAP_H + 24, k); kx += L ? -10 : 10; }
    if (!L) drawText(g, this.input.touchUsed ? 'DRAG: MOVE   DRAG FAR: RUN' : 'SHIFT RUN  E ACT  Q THROW  F SKILL', 6, MAP_H + 32, C.dgray);
    else drawText(g, this.input.touchUsed ? 'DRAG: MOVE' : 'E ACT Q THROW', tx, MAP_H + 32, C.dgray, al);

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
    const label = pr ? pr.label : 'KUPIT';
    drawText(g, label.length > 6 ? label.slice(0, 6) : label, BUTTON.x, BUTTON.y + (pr ? 2 : -2), pr ? C.ink : C.gray, { align: 'center' });

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
  }
}
