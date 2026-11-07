import { TileMap, TILE } from '../world/tilemap.js';
import { angDiff } from '../world/los.js';
import { Player } from '../entities/player.js';
import { Adult } from '../entities/adult.js';
import { Target } from '../entities/target.js';
import { buildBackground } from '../render/tiles.js';
import { drawActor, drawTarget, drawCoin } from '../render/sprites.js';
import { C, hexToRgb } from '../render/palette.js';
import { drawText } from '../ui/font.js';
import { sfx } from '../core/audio.js';
import { VIEW_W, VIEW_H, BUTTON } from '../core/input.js';

const REACH = 18;
const YELLOW = hexToRgb(C.yellow), RED = hexToRgb(C.red);

function disc(g, cx, cy, r, color) {
  g.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(r * r - dy * dy));
    g.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

export class Play {
  constructor(level, input) {
    this.level = level;
    this.input = input;
    this.map = new TileMap(level.tiles);
    this.bg = buildBackground(this.map);
    this.player = new Player(level.spawn[0], level.spawn[1]);
    this.adults = level.adults.map((d) => new Adult(d, this.map));
    this.targets = level.targets.map((t) => new Target(t));
    this.exit = { x: level.exit[0] * TILE + TILE / 2, y: level.exit[1] * TILE + TILE / 2 };
    this.coins = 0;
    this.time = 0;
    this.maxAlert = 0;
    this.parts = [];
    this.status = 'play';
    this.catcher = null;
    this.result = null;
    this.tickT = 0;
    this.coneData = new ImageData(VIEW_W, VIEW_H);
    this.coneCv = document.createElement('canvas');
    this.coneCv.width = VIEW_W; this.coneCv.height = VIEW_H;
    this.coneG = this.coneCv.getContext('2d');
    input.buttonEnabled = true;
  }

  get open() { return this.coins >= this.level.quota; }

  update(dt) {
    if (this.status !== 'play') return;
    const { input, player, map } = this;
    this.time += dt;

    const near = this.targets.find((t) => !t.done && Math.hypot(t.x - player.x, t.y - player.y) <= REACH);
    const frozen = input.action() && !!near;
    const noise = player.update(dt, map, input.move(), frozen);

    for (const t of this.targets) {
      if (t === near && frozen) {
        t.progress += dt / t.time;
        this.tickT -= dt;
        if (this.tickT <= 0) { sfx.steal(); this.tickT = 0.22; }
        if (t.progress >= 1) this.collect(t);
      } else if (!t.done) t.progress = Math.max(0, t.progress - dt * 0.8);
    }

    for (const a of this.adults) {
      const before = a.alert;
      a.update(dt, player, noise);
      this.maxAlert = Math.max(this.maxAlert, a.alert);
      if (before < 0.5 && a.alert >= 0.5) sfx.alert();
      if (a.caught && this.status === 'play') {
        this.status = 'caught';
        this.catcher = a;
        sfx.caught();
      }
    }

    for (const p of this.parts) { p.y += p.vy * dt; p.vy += 90 * dt; p.l -= dt * 1.6; }
    this.parts = this.parts.filter((p) => p.l > 0);

    if (this.status === 'play' && this.open && Math.hypot(player.x - this.exit.x, player.y - this.exit.y) < 10) {
      this.status = 'clear';
      const stars = 1 + (this.time <= this.level.par ? 1 : 0) + (this.maxAlert < 0.3 ? 1 : 0);
      this.result = { coins: this.coins, time: this.time, stars, stealth: this.maxAlert < 0.3, fast: this.time <= this.level.par };
      sfx.clear();
    }
  }

  collect(t) {
    t.done = true;
    t.progress = 1;
    this.coins += t.coins;
    sfx.coin();
    for (let i = 0; i < t.coins * 2; i++) {
      this.parts.push({ x: t.x + (Math.random() * 14 - 7), y: t.y - 4, vy: -50 - Math.random() * 40, l: 1 });
    }
  }

  drawCones(g) {
    const d = this.coneData.data;
    d.fill(0);
    for (const a of this.adults) {
      if (!a.awake) continue;
      const { range, fov } = a.cfg;
      const N = a.rays.length - 1;
      const t = Math.min(1, a.alert * 1.4);
      const col = [0, 1, 2].map((i) => Math.round(YELLOW[i] + (RED[i] - YELLOW[i]) * t));
      const x0 = Math.max(0, Math.floor(a.x - range)), x1 = Math.min(VIEW_W - 1, Math.ceil(a.x + range));
      const y0 = Math.max(0, Math.floor(a.y - range)), y1 = Math.min(VIEW_H - 1, Math.ceil(a.y + range));
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          if (a.alert < 0.35 ? (px + py) & 1 : a.alert < 0.7 ? (px & 1) && (py & 1) : 0) continue;
          const dx = px + 0.5 - a.x, dy = py + 0.5 - a.y;
          const dist = Math.hypot(dx, dy);
          if (dist > range) continue;
          const rel = angDiff(Math.atan2(dy, dx) - a.a);
          if (rel < -fov || rel > fov) continue;
          if (dist > a.rays[Math.round(((rel + fov) / (2 * fov)) * N)]) continue;
          const o = (py * VIEW_W + px) * 4;
          d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
        }
      }
    }
    this.coneG.putImageData(this.coneData, 0, 0);
    g.drawImage(this.coneCv, 0, 0);
  }

  drawExit(g) {
    const x = this.exit.x - 8, y = this.exit.y - 8;
    const pulse = this.open && Math.floor(performance.now() / 250) % 2;
    g.fillStyle = C.table; g.fillRect(x + 1, y, 14, 16);
    g.fillStyle = this.open ? (pulse ? C.green : '#2fb56b') : C.dgray; g.fillRect(x + 3, y + 2, 10, 14);
    g.fillStyle = C.gold; g.fillRect(x + 10, y + 9, 2, 2);
    drawText(g, this.open ? 'EXIT' : 'LOCKED', this.exit.x, y - 7, this.open ? C.green : C.gray, { align: 'center', shadow: C.ink });
  }

  draw(g) {
    g.drawImage(this.bg, 0, 0);
    this.drawExit(g);
    for (const t of this.targets) drawTarget(g, t.kind, t.x, t.y, t.done);
    this.drawCones(g);

    // actors, back to front
    const actors = [{ k: 'p', y: this.player.y }, ...this.adults.map((a) => ({ k: 'a', a, y: a.y }))];
    actors.sort((u, v) => u.y - v.y);
    for (const e of actors) {
      if (e.k === 'p') {
        const p = this.player;
        drawActor(g, 'kid', p.x, p.y, p.dir, p.moving ? Math.floor(p.stepT * 8) % 4 : 0);
      } else this.drawAdult(g, e.a);
    }

    // steal bar
    const hot = this.targets.find((t) => t.progress > 0 && !t.done);
    if (hot) {
      const px = Math.round(this.player.x) - 9, py = Math.round(this.player.y) - 20;
      g.fillStyle = C.ink; g.fillRect(px - 1, py - 1, 20, 5);
      g.fillStyle = C.dgray; g.fillRect(px, py, 18, 3);
      g.fillStyle = C.gold; g.fillRect(px, py, Math.round(18 * Math.min(1, hot.progress)), 3);
    }
    for (const p of this.parts) { g.globalAlpha = Math.min(1, p.l * 2); drawCoin(g, p.x, p.y); }
    g.globalAlpha = 1;
    this.drawHud(g);
  }

  drawAdult(g, a) {
    const dir = Math.abs(Math.cos(a.a)) > Math.abs(Math.sin(a.a)) ? (Math.cos(a.a) < 0 ? 1 : 2) : (Math.sin(a.a) < 0 ? 3 : 0);
    const frame = a.moving ? Math.floor(a.stepT * 6) % 4 : 0;
    const top = drawActor(g, a.type, a.x, a.y, dir, frame, { dim: !a.awake && a.cfg.sleepy });
    const cx = Math.round(a.x);
    if (!a.awake && a.cfg.sleepy) {
      const b = Math.floor(performance.now() / 500) % 2;
      drawText(g, 'ZZ', cx + 4, top - 6 - b, C.white, { shadow: C.ink });
    } else if (!a.awake && a.cfg.phone) {
      g.fillStyle = C.ink; g.fillRect(cx + (dir === 1 ? -7 : 5), Math.round(a.y) - 4, 4, 6);
      g.fillStyle = C.pink; g.fillRect(cx + (dir === 1 ? -6 : 6), Math.round(a.y) - 3, 2, 4);
    }
    if (a.alert > 0.12 && a.awake) {
      const danger = a.alert >= 0.6;
      drawText(g, danger ? '!' : '?', cx - 1, top - 8, danger ? C.red : C.yellow, { scale: 2, shadow: C.ink });
      g.fillStyle = C.ink; g.fillRect(cx - 7, top - 11, 14, 3);
      g.fillStyle = danger ? C.red : C.yellow; g.fillRect(cx - 6, top - 10, Math.round(12 * Math.min(1, a.alert)), 1);
    }
  }

  drawHud(g) {
    const sh = { shadow: C.ink };
    drawCoin(g, 5, 5);
    drawText(g, `${this.coins}/${this.level.quota}`, 13, 6, C.white, sh);
    drawText(g, this.level.name, VIEW_W / 2, 6, C.white, { ...sh, align: 'center' });
    drawText(g, `${Math.floor(this.time)}S`, VIEW_W - 5, 6, this.time > this.level.par ? C.orange : C.white, { ...sh, align: 'right' });

    if (this.time < 7) {
      drawText(g, 'DRAG OR WASD TO MOVE. PUSH FAR OR SHIFT TO RUN', VIEW_W / 2, 20, C.white, { ...sh, align: 'center' });
      drawText(g, 'HOLD KUPIT OR SPACE BY A BAG. RUNNING IS LOUD!', VIEW_W / 2, 29, C.yellow, { ...sh, align: 'center' });
    }
    // touch controls
    const down = this.input.action();
    disc(g, BUTTON.x, BUTTON.y, BUTTON.r, C.ink);
    disc(g, BUTTON.x, BUTTON.y, BUTTON.r - 2, down ? C.gold : C.gold2);
    drawText(g, 'KUPIT', BUTTON.x, BUTTON.y - 2, C.ink, { align: 'center' });
    const s = this.input.stick();
    if (s) {
      g.globalAlpha = 0.35; disc(g, Math.round(s.sx), Math.round(s.sy), 22, C.white);
      g.globalAlpha = 0.7; disc(g, Math.round(s.x), Math.round(s.y), 8, C.white); g.globalAlpha = 1;
    }
  }
}
