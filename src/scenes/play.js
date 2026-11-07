// Draws a World and turns its events into sound/particles. All rules live in game/world.js.
import { TILE } from '../world/tilemap.js';
import { angDiff } from '../world/los.js';
import { World } from '../game/world.js';
import { buildBackground } from '../render/tiles.js';
import { drawActor, drawTarget, drawCoin, drawObj, KEY_COLORS } from '../render/sprites.js';
import { C, hexToRgb } from '../render/palette.js';
import { drawText, textWidth } from '../ui/font.js';
import { sfx } from '../core/audio.js';
import { dev } from '../core/dev.js';
import { vibrate } from '../core/haptics.js';
import { VIEW_W, VIEW_H, MAP_H, BUTTON, BUTTON2, PAUSE_BTN, ABILITY_BTN } from '../core/input.js';

const YELLOW = hexToRgb(C.yellow), RED = hexToRgb(C.red);

function disc(g, cx, cy, r, color) {
  g.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(r * r - dy * dy));
    g.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

// Midpoint circle outline, dashed for pixel-art "sound ring".
function ring(g, cx, cy, r, color) {
  g.fillStyle = color;
  let x = r, y = 0, err = 1 - r, i = 0;
  while (x >= y) {
    if ((i++ & 1) === 0) {
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

export class Play {
  constructor(level, input, loadout) {
    this.input = input;
    this.world = new World(level, loadout);
    this.level = level;
    this.bg = buildBackground(this.world.map);
    this.parts = [];
    this.rings = [];
    this.tickT = 0;
    this.banner = level.boss ? { kind: 'boss', text: level.boss.title || level.name, t: 3 } : null;
    this.coneData = new ImageData(VIEW_W, VIEW_H);
    this.coneCv = document.createElement('canvas');
    this.coneCv.width = VIEW_W; this.coneCv.height = VIEW_H;
    this.coneG = this.coneCv.getContext('2d');
    input.buttonEnabled = true;
    this.cam = { x: 0, y: 0 };
    this.shake = 0; this.flash = 0; this.dust = []; this.dustT = 0; this.lastDraw = 0;
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

  update(dt) {
    const w = this.world;
    this.input.button2Enabled = w.player.items.length > 0;
    this.input.abilityEnabled = true;
    w.update(dt, this.input.poll());
    this.updateCamera(dt * 9);
    for (const e of w.events) this.onEvent(e, dt);
    w.events.length = 0;
    const pl = w.player;
    if ((pl.running || pl.dashT > 0) && !pl.hidden && (this.dustT -= dt) <= 0) {
      this.dust.push({ x: pl.x + Math.random() * 6 - 3, y: pl.y + 4, vx: Math.random() * 10 - 5, l: 0.45 });
      this.dustT = 0.06;
    }
    for (const d of this.dust) { d.x += d.vx * dt; d.y -= 6 * dt; d.l -= dt; }
    this.dust = this.dust.filter((d) => d.l > 0);
    for (const p of this.parts) { p.y += p.vy * dt; p.vy += 90 * dt; p.l -= dt * 1.6; }
    this.parts = this.parts.filter((p) => p.l > 0);
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
    for (const r of this.rings) r.age += dt;
    this.rings = this.rings.filter((r) => r.age < 0.5);
  }

  onEvent(e, dt) {
    switch (e.type) {
      case 'ring': this.rings.push({ ...e, age: 0 }); break;
      case 'stealTick':
        if ((this.tickT -= dt) <= 0) { sfx.steal(); this.tickT = 0.22; }
        break;
      case 'coin':
        sfx.coin(); vibrate(15);
        for (let i = 0; i < e.n * 2; i++) this.parts.push({ x: e.x + (Math.random() * 14 - 7), y: e.y - 4, vy: -50 - Math.random() * 40, l: 1 });
        break;
      case 'spotted': case 'bark': sfx.alert(); vibrate(40); this.shake = Math.max(this.shake, 2); break;
      case 'caught': sfx.caught(); vibrate([80, 40, 140]); this.shake = 6; this.flash = 0.6; break;
      case 'clear': sfx.clear(); vibrate([30, 30, 30]); break;
      case 'door': case 'switch': sfx.click(); break;
      case 'creak': case 'locked': sfx.creak(); break;
      case 'ouch': sfx.ouch(); vibrate(60); this.shake = Math.max(this.shake, 3); break;
      case 'pickup': case 'unlock': sfx.pickup(); break;
      case 'throw': sfx.whoosh(); break;
      case 'ability': sfx.skill(); vibrate(20); break;
      case 'phase': sfx.phase(); vibrate([40, 30, 40]); this.shake = Math.max(this.shake, 3); this.banner = { kind: 'phase', text: e.text, t: 3 }; break;
      case 'land': sfx.thud(); break;
      case 'hide': case 'unhide': sfx.hide(); break;
      case 'device': sfx.music(); break;
    }
  }

  // ---------------------------------------------------------------- drawing
  drawCones(g) {
    const d = this.coneData.data, cx = this.cx, cy = this.cy;
    d.fill(0);
    for (const a of this.world.adults) {
      if (!a.awake) continue;
      const { range, fov } = a.cfg;
      const N = a.rays.length - 1;
      const t = Math.min(1, a.alert * 1.4);
      const col = [0, 1, 2].map((i) => Math.round(YELLOW[i] + (RED[i] - YELLOW[i]) * t));
      const x0 = Math.max(cx, Math.floor(a.x - range)), x1 = Math.min(cx + VIEW_W - 1, Math.ceil(a.x + range));
      const y0 = Math.max(cy, Math.floor(a.y - range)), y1 = Math.min(cy + VIEW_H - 1, Math.ceil(a.y + range));
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          if (a.alert < 0.35 ? (px + py) & 1 : a.alert < 0.7 ? (px & 1) && (py & 1) : 0) continue;
          const dx = px + 0.5 - a.x, dy = py + 0.5 - a.y;
          const dist = Math.hypot(dx, dy);
          if (dist > range) continue;
          const rel = angDiff(Math.atan2(dy, dx) - a.a);
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

  drawDynamicTiles(g) {
    const { map, locks } = this.world;
    for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) {
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

  draw(g) {
    const w = this.world, p = w.player;
    const now = performance.now(), fd = Math.min(0.05, (now - (this.lastDraw || now)) / 1000);
    this.lastDraw = now;
    this.shake = Math.max(0, this.shake - fd * 14); this.flash = Math.max(0, this.flash - fd * 1.6);
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
        if (d.kind === 'tv') g.fillRect(d.x - 5, d.y - 3, 8, 4);
        drawText(g, Math.floor(performance.now() / 300) % 2 ? '*' : '+', d.x + 6, d.y - 12, C.pink, { shadow: C.ink });
      }
    }
    for (const t of w.targets) drawTarget(g, t.kind, t.x, t.y, t.done);
    for (const it of w.items) drawObj(g, it.kind, it.x, it.y + (it.kind === 'key' ? Math.floor(performance.now() / 300) % 2 : 0), it.color);
    for (const f of w.foods) drawObj(g, 'pandesal', f.x, f.y);
    for (const h of w.hides) if (h.kind !== 'curtain') drawObj(g, h.kind, h.x, h.y + 2);

    if (this.level.night) { g.globalAlpha = 0.38; g.fillStyle = '#10183a'; g.fillRect(this.cx, this.cy, VIEW_W, VIEW_H); g.globalAlpha = 1; }
    this.drawCones(g);

    for (const d of this.dust) { g.globalAlpha = Math.min(1, d.l * 2.2); g.fillStyle = C.white; g.fillRect(Math.round(d.x), Math.round(d.y), 2, 2); }
    g.globalAlpha = 1;

    const actors = [...w.adults.map((a) => ({ a, y: a.y }))];
    if (!p.hidden) actors.push({ p: true, y: p.y });
    actors.sort((u, v) => u.y - v.y);
    for (const e of actors) {
      if (e.p) drawActor(g, w.mods.look, p.x, p.y, p.dir, p.moving ? Math.floor(p.stepT * 8) % 4 : 0);
      else this.drawAdult(g, e.a);
    }
    for (const h of w.hides) if (h.kind === 'curtain') drawObj(g, 'curtain', h.x, h.y - 1);
    if (p.hidden) { // peeking eyes
      const b = Math.floor(performance.now() / 700) % 4 === 0;
      if (!b) { g.fillStyle = C.white; g.fillRect(p.x - 3, p.y - 3, 2, 2); g.fillRect(p.x + 1, p.y - 3, 2, 2); g.fillStyle = C.ink; g.fillRect(p.x - 2, p.y - 2, 1, 1); g.fillRect(p.x + 2, p.y - 2, 1, 1); }
    }
    for (const pr of w.projectiles) drawObj(g, pr.kind, pr.x, pr.y);
    for (const h of w.hostiles) drawObj(g, h.kind, h.x, h.y);

    for (const r of this.rings) ring(g, Math.round(r.x), Math.round(r.y), Math.max(2, Math.round(r.r * (r.age / 0.5))), r.lure ? C.yellow : C.white);

    // steal bar
    const hot = w.targets.find((t) => t.progress > 0 && !t.done);
    if (hot) {
      const px = Math.round(p.x) - 9, py = Math.round(p.y) - 20;
      g.fillStyle = C.ink; g.fillRect(px - 1, py - 1, 20, 5);
      g.fillStyle = C.dgray; g.fillRect(px, py, 18, 3);
      g.fillStyle = C.gold; g.fillRect(px, py, Math.round(18 * Math.min(1, hot.progress)), 3);
    }
    for (const q of this.parts) { g.globalAlpha = Math.min(1, q.l * 2); drawCoin(g, q.x, q.y); }
    g.globalAlpha = 1;
    if (w.say) bubble(g, w.say.text, p.x, Math.round(p.y) - 30, this.cx);
    for (const a of w.adults) if (a.say) bubble(g, a.say.text, a.x, Math.round(a.y) - 34, this.cx, C.ink, a.state === 'chase' ? C.red : C.white);
    g.restore();
    if (this.flash > 0) { g.globalAlpha = this.flash * 0.5; g.fillStyle = C.red; g.fillRect(0, 0, VIEW_W, MAP_H); g.globalAlpha = 1; }
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
      `T ${Math.floor(w.time)}S  PAR ${this.level.par}S`,
      ...w.adults.map((a) => `${a.type.toUpperCase()} ${a.state} A${a.alert.toFixed(1)}${a.awake ? '' : ' ZZ'}`),
    ];
    g.globalAlpha = 0.65; g.fillStyle = C.ink; g.fillRect(2, 34, 126, rows.length * 8 + 3); g.globalAlpha = 1;
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
    const a = b.bar !== undefined ? w.adults[b.bar] : null, cy = a?.cfg.cycle;
    if (a && cy && a.state === 'patrol') {
      const len = cy.on + cy.off, t = a.t % len, awake = t < cy.on;
      const left = awake ? cy.on - t : len - t, full = awake ? cy.on : cy.off;
      drawText(g, awake ? 'WATCH' : 'SLEEP', VIEW_W - 62, 12, awake ? C.red : C.green, { align: 'right' });
      g.fillStyle = C.ink; g.fillRect(VIEW_W - 60, 12, 56, 5);
      g.fillStyle = awake ? C.red : C.green; g.fillRect(VIEW_W - 59, 13, Math.round(54 * left / full), 3);
    }
    const bn = this.banner;
    if (bn) {
      g.globalAlpha = 0.8; g.fillStyle = C.ink; g.fillRect(0, 96, VIEW_W, bn.kind === 'boss' ? 46 : 22); g.globalAlpha = 1;
      if (bn.kind === 'boss') {
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
    if (w.open) return 'EXIT IS OPEN! RUN FOR IT!';
    if (p.hidden) return 'SAFE! WAIT, THEN MOVE TO COME OUT';
    if (w.targets.some((t) => t.progress > 0 && !t.done)) return 'KEEP HOLDING THE BUTTON... WATCH THE CONE';
    if (w.adults.some((a) => a.awake && a.alert > 0.3)) return 'SEEN! GO TO A BOX OR CURTAIN AND PRESS TAGO';
    if (w.coins === 0 && w.time < 4) return 'DRAG OR WASD TO MOVE. FAR DRAG / SHIFT RUNS';
    if (w.coins === 0) return 'WALK TO THE PURSE, HOLD KUPIT. AVOID YELLOW';
    return 'GOOD! GET THE REST, THEN FIND THE EXIT';
  }

  drawAdult(g, a) {
    const dir = Math.abs(Math.cos(a.a)) > Math.abs(Math.sin(a.a)) ? (Math.cos(a.a) < 0 ? 1 : 2) : (Math.sin(a.a) < 0 ? 3 : 0);
    const frame = a.moving ? Math.floor(a.stepT * 6) % 4 : 0;
    const sleeping = !a.awake && (a.cfg.sleepy || a.state === 'eat');
    const top = drawActor(g, a.type, a.x, a.y, dir, frame, { dim: !a.awake && a.cfg.sleepy });
    const cx = Math.round(a.x);
    if (sleeping && a.state !== 'eat') {
      const b = Math.floor(performance.now() / 500) % 2;
      drawText(g, 'ZZ', cx + 4, top - 6 - b, C.white, { shadow: C.ink });
    } else if (!a.awake && a.cfg.cook) { // stirring the pot: back turned
      drawObj(g, 'pot', cx + (dir === 1 ? -9 : 9), Math.round(a.y) - 1);
      if (Math.floor(performance.now() / 400) % 2) drawText(g, '~', cx + (dir === 1 ? -10 : 8), Math.round(a.y) - 11, C.white);
    } else if (!a.awake && a.cfg.phone) {
      g.fillStyle = C.ink; g.fillRect(cx + (dir === 1 ? -7 : 5), Math.round(a.y) - 4, 4, 6);
      g.fillStyle = C.pink; g.fillRect(cx + (dir === 1 ? -6 : 6), Math.round(a.y) - 3, 2, 4);
    }
    if (a.alert > 0.12 && a.awake && !a.say) {
      const danger = a.alert >= 0.6;
      drawText(g, danger ? '!' : '?', cx - 1, top - 8, danger ? C.red : C.yellow, { scale: 2, shadow: C.ink });
    }
    if (a.alert > 0.05 && a.awake) {
      g.fillStyle = C.ink; g.fillRect(cx - 7, top - 3, 14, 3);
      g.fillStyle = a.alert >= 0.6 ? C.red : C.yellow; g.fillRect(cx - 6, top - 2, Math.round(12 * Math.min(1, a.alert)), 1);
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
      for (const t of w.targets) if (!t.done) { const d = Math.hypot(t.x - p.x, t.y - p.y); if (d < bd) { bd = d; goal = t; } }
    }
    if (!goal) return;
    const sx = goal.x - this.cx, sy = goal.y - this.cy;
    if (sx > 4 && sx < VIEW_W - 4 && sy > 4 && sy < MAP_H - 4) return;
    const cxs = VIEW_W / 2, cys = MAP_H / 2, dx = sx - cxs, dy = sy - cys;
    const k = Math.min((VIEW_W / 2 - 9) / Math.abs(dx || 1e-6), (MAP_H / 2 - 9) / Math.abs(dy || 1e-6));
    const mx = Math.round(cxs + dx * k), my = Math.round(cys + dy * k);
    const pulse = Math.floor(performance.now() / 300) % 2;
    disc(g, mx, my, 6, C.ink);
    disc(g, mx, my, 4, pulse ? col : C.white);
    // little pointer toward the goal
    const m = Math.hypot(dx, dy) || 1;
    disc(g, Math.round(mx + (dx / m) * 7), Math.round(my + (dy / m) * 7), 1, col);
  }

  drawHud(g) {
    const w = this.world, sh = { shadow: C.ink };
    drawCoin(g, 5, 5);
    drawText(g, `${w.coins}/${this.level.quota}`, 13, 6, C.white, sh);
    drawText(g, this.level.name, VIEW_W / 2, 6, C.white, { ...sh, align: 'center' });
    drawText(g, `${Math.floor(w.time)}S`, VIEW_W - 5, 6, w.time > this.level.par ? C.orange : C.white, { ...sh, align: 'right' });
    if (w.patience) { // "KAIN NA!" meter: Mama calls you for dinner when it runs out
      const left = Math.max(0, 1 - w.time / w.patience);
      g.fillStyle = C.ink; g.fillRect(4, 13, VIEW_W - 8, 3);
      g.fillStyle = left < 0.25 ? C.red : C.orange; g.fillRect(5, 14, Math.round((VIEW_W - 10) * left), 1);
    }
    this.drawBoss(g);
    if (dev.on) this.drawDev(g);
    // control strip
    g.fillStyle = C.ink; g.fillRect(0, MAP_H, VIEW_W, VIEW_H - MAP_H);
    g.fillStyle = C.wallD; g.fillRect(0, MAP_H, VIEW_W, 1);
    const pr = w.prompt;
    drawText(g, pr ? pr.label : w.open ? 'GO TO THE EXIT!' : `NEED ${this.level.quota - w.coins} MORE`, 6, MAP_H + 8, pr ? C.gold : w.open ? C.green : C.gray);
    let kx = 6;
    for (const k of w.player.keys) { drawObj(g, 'key', kx + 3, MAP_H + 24, k); kx += 10; }
    drawText(g, this.input.touchUsed ? 'DRAG: MOVE   DRAG FAR: RUN' : 'SHIFT RUN  E ACT  Q THROW  F SKILL', 6, MAP_H + 32, C.dgray);

    const th = this.tutorialHint();
    const hint = th || (this.level.hint && w.time < 8 ? this.level.hint : null);
    if (hint) {
      g.globalAlpha = 0.7; g.fillStyle = C.ink; g.fillRect(0, 18, VIEW_W, 11); g.globalAlpha = 1;
      drawText(g, hint, VIEW_W / 2, 21, th ? C.white : C.yellow, { align: 'center' });
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

    // action button with context label
    const down = this.input.action();
    disc(g, BUTTON.x, BUTTON.y, BUTTON.r, C.ink);
    disc(g, BUTTON.x, BUTTON.y, BUTTON.r - 2, pr ? (down ? C.gold : C.gold2) : C.dgray);
    const label = pr ? pr.label : 'KUPIT';
    drawText(g, label.length > 6 ? label.slice(0, 6) : label, BUTTON.x, BUTTON.y - 2, pr ? C.ink : C.gray, { align: 'center' });

    // throw button
    const items = w.player.items;
    if (items.length) {
      disc(g, BUTTON2.x, BUTTON2.y, BUTTON2.r, C.ink);
      disc(g, BUTTON2.x, BUTTON2.y, BUTTON2.r - 2, this.input.throwHeld() ? C.sofa2 : C.sofa);
      drawObj(g, items[items.length - 1], BUTTON2.x, BUTTON2.y - 2);
      drawText(g, `x${items.length}`, BUTTON2.x, BUTTON2.y + 5, C.white, { align: 'center' });
    }

    const s = this.input.stick();
    if (s) {
      g.globalAlpha = 0.35; disc(g, Math.round(s.sx), Math.round(s.sy), 22, C.white);
      g.globalAlpha = 0.7; disc(g, Math.round(s.x), Math.round(s.y), 8, C.white); g.globalAlpha = 1;
    }
  }
}
