// The shared half of a mini-game scene (TUMBANG PRESO, HABOL!): main.js treats it exactly like scenes/play.js
// (update, draw, status, result, world, drawMissions). This holds what every mini-game draws the same way: toasts,
// big banners, one-time tips, particles, screen shake, the mission card, the pause button and the control strip.
import { drawText, textWidth, drawBig, bigWidth, wrapBig, drawBigBand } from '../ui/font.js';
import { drawStar, drawCoin } from '../render/sprites.js';
import { missionLabel } from '../game/missions.js';
import { C } from '../render/palette.js';
import { sfx } from '../core/audio.js';
import { vibrate } from '../core/haptics.js';
import { settings } from '../core/settings.js';
// Mini-games are drawn at the design size (240x392). On a tall phone the whole scene is shifted down by EXTRA, so the
// field sits right on the control strip at the bottom of the screen (beginField / endField), and the buttons, whose
// screen positions moved down with it, are drawn EXTRA higher inside that shift.
import { VIEW_W, BASE_H as VIEW_H, BASE_MAP_H as MAP_H, EXTRA, PAUSE_BTN } from '../core/input.js';

export function disc(g, cx, cy, r, color) {
  g.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) { const h = Math.round(Math.sqrt(r * r - dy * dy)); g.fillRect(Math.round(cx) - h, Math.round(cy) + dy, h * 2 + 1, 1); }
}
export function ring(g, cx, cy, r, color, step = 2) {
  g.fillStyle = color;
  let x = r, y = 0, err = 1 - r, i = 0;
  cx = Math.round(cx); cy = Math.round(cy);
  while (x >= y) {
    if ((i++ % step) === 0) for (const [px, py] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) g.fillRect(cx + px, cy + py, 1, 1);
    y++;
    if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
  }
}
export function bubble(g, text, cx, y, fg = C.ink, bg = C.white) {
  const w = textWidth(text) + 4;
  const x = Math.max(1, Math.min(VIEW_W - w - 1, Math.round(cx - w / 2)));
  g.fillStyle = C.ink; g.fillRect(x - 1, y - 1, w + 2, 9);
  g.fillStyle = bg; g.fillRect(x, y, w, 7);
  g.fillRect(Math.round(cx) - 1, y + 7, 3, 1); g.fillStyle = C.ink; g.fillRect(Math.round(cx) - 1, y + 8, 3, 1); // the tail
  drawText(g, text, x + 2, y + 1, fg);
}

export class ModeScene {
  constructor(level, input, opts = {}) {
    this.level = level;
    this.input = input;
    this.opts = opts;
    this.banner = null;   // main.js clears it on leaving the level
    this.rec = null;      // (no ghost for the mini-games)
    this.toast = null;    // { text, col, t }
    this.big = null;      // a word that pops in the middle: { text, col, t, life, y }
    this.tip = null; this.tipQ = [];
    this.parts = [];      // { x, y, vx, vy, l, col, g, s }
    this.shake = 0; this.flash = 0; this.flashCol = C.white;
    this.lastDraw = 0;
    this.cardT = opts.noCard ? 0 : 4.5; // the missions, shown for the first seconds (the campaign shows them on the card before)
    this.coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  }

  get status() { return this.sim.status; }
  get result() { return this.sim.result; }
  get world() { return this.sim; }
  get reason() { return this.sim.reason; }
  get catcher() { return null; }
  get touch() { return this.input.touchUsed || this.coarse; }

  kick(n) { this.shake = Math.max(this.shake, n * settings.shake); }
  buzz(p) { vibrate(p); }
  say(text, col = C.white, t = 2.2) { this.toast = { text, col, t }; }
  pop(text, col = C.gold, y = 150, life = 1.1, scale = 4) { this.big = { text, col, t: life, life, y, scale }; }
  burst(x, y, n, cols, { speed = 70, up = 40, g = 160, l = 0.8, s = 2 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.6);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, l: l * (0.6 + Math.random() * 0.4), col: cols[i % cols.length], g, s });
    }
  }

  // one-time tips (marked as seen in the save), shown at the top of the screen
  showTip(id, text) {
    const seen = this.opts.tips?.seen;
    if (!seen || seen[id] || this.tipQ.some((q) => q.id === id) || this.tip?.id === id) return;
    this.tipQ.push({ id, text });
  }
  updateShared(dt) {
    if (this.tip && (this.tip.t -= dt) <= 0) this.tip = null;
    if (!this.tip && this.tipQ.length) { const q = this.tipQ.shift(); this.tip = { ...q, t: 4.2 }; this.opts.tips?.mark(q.id); }
    if (this.toast && (this.toast.t -= dt) <= 0) this.toast = null;
    if (this.big && (this.big.t -= dt) <= 0) this.big = null;
    this.cardT = Math.max(0, this.cardT - dt);
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.l -= dt; }
    this.parts = this.parts.filter((p) => p.l > 0);
  }
  // events every mini-game handles the same way
  sharedEvent(e) {
    if (e.type === 'missionLost') { this.say(`STAR LOST: ${missionLabel(this.level, e.id)}`, C.orange, 2.4); return true; }
    if (e.type === 'clear') { sfx.clear(); vibrate([30, 30, 30]); return true; }
    if (e.type === 'caught') { sfx.sentBack(); vibrate([80, 40, 140]); this.kick(5); return true; }
    return false;
  }

  frameDt() {
    const now = performance.now(), fd = Math.min(0.05, (now - (this.lastDraw || now)) / 1000);
    this.lastDraw = now;
    this.shake = Math.max(0, this.shake - fd * 14); this.flash = Math.max(0, this.flash - fd * 2);
    return fd;
  }
  shakeOffset() {
    if (this.shake <= 0.3) return [0, 0];
    return [Math.round((Math.random() - 0.5) * 2 * this.shake), Math.round((Math.random() - 0.5) * 2 * this.shake)];
  }

  drawParts(g, ox = 0, oy = 0) {
    for (const p of this.parts) {
      g.globalAlpha = Math.min(1, p.l * 2.5); g.fillStyle = p.col;
      g.fillRect(Math.round(p.x - ox), Math.round(p.y - oy), p.s, p.s);
    }
    g.globalAlpha = 1;
  }

  // the big word in the middle: overshoots, settles, fades
  drawBig(g) {
    const b = this.big;
    if (!b) return;
    const age = b.life - b.t, k = Math.min(1, age / 0.12), s = Math.max(1, Math.round(b.scale * (k < 1 ? 0.6 + k * 0.6 : 1 + Math.max(0, 0.18 - (age - 0.12)) )));
    g.globalAlpha = Math.min(1, b.t * 4);
    drawText(g, b.text, VIEW_W / 2, b.y - s * 2.5, b.col, { scale: s, align: 'center', shadow: C.ink });
    g.globalAlpha = 1;
  }

  // the field shifted down onto the control strip (a tall phone), with the band above it filled
  beginField(g, band = C.ink) {
    if (EXTRA > 0) { g.fillStyle = band; g.fillRect(0, 0, VIEW_W, EXTRA); }
    g.save(); g.translate(0, EXTRA);
  }
  endField(g) { g.restore(); }

  drawTopTip(g, y = 26) {
    const line = this.tip?.text;
    if (!line) return;
    drawBigBand(g, line, y, C.green, { alpha: 0.82 });
  }
  drawToast(g, y = 136) {
    if (!this.toast) return;
    const L = wrapBig(this.toast.text, 220), tw = Math.min(236, Math.max(140, ...L.map(bigWidth)) + 12);
    drawBigBand(g, null, y, this.toast.col, { w: tw, x: Math.round((VIEW_W - tw) / 2), lines: L, alpha: 0.85 });
  }

  drawMissions(g, y, earned = 0) {
    const st = this.sim.missionState();
    g.globalAlpha = 0.84; g.fillStyle = C.ink; g.fillRect(VIEW_W / 2 - 100, y, 200, 8 + st.length * 11); g.globalAlpha = 1;
    st.forEach((m, i) => {
      const had = (earned >> i) & 1, yy = y + 5 + i * 11, label = missionLabel(this.level, m.id);
      drawStar(g, VIEW_W / 2 - 94, yy, !!had);
      drawBig(g, label, VIEW_W / 2 - 84, yy, m.lost ? C.dgray : had ? C.gold : C.white);
      if (m.lost) { g.fillStyle = C.red; g.fillRect(VIEW_W / 2 - 85, yy + 3, bigWidth(label) + 2, 1); }
    });
  }
  drawCard(g, y = 168) {
    if (this.cardT <= 0 || this.sim.status !== 'play') return;
    g.globalAlpha = Math.min(1, this.cardT * 2); this.drawMissions(g, y, this.opts.earned | 0); g.globalAlpha = 1;
  }

  // the strip under the play area: a dark band, the pause button, a status line
  drawStrip(g, line, col = C.gray, sub = null) {
    g.fillStyle = C.ink; g.fillRect(0, MAP_H, VIEW_W, VIEW_H - MAP_H);
    g.fillStyle = C.wallD; g.fillRect(0, MAP_H, VIEW_W, 1);
    const py = PAUSE_BTN.y - EXTRA; // (inside the field's shift)
    disc(g, PAUSE_BTN.x, py, PAUSE_BTN.r, C.ink);
    disc(g, PAUSE_BTN.x, py, PAUSE_BTN.r - 2, C.wallD);
    g.fillStyle = C.white; g.fillRect(PAUSE_BTN.x - 3, py - 4, 2, 8); g.fillRect(PAUSE_BTN.x + 1, py - 4, 2, 8);
    if (line) drawText(g, line, 6, MAP_H + 8, col);
    if (sub) drawText(g, sub, 6, MAP_H + 32, C.dgray);
  }
  // a big round button: label, pressed look, optional ring hint
  drawRoundButton(g, b0, label, { on = true, down = false, col = C.gold2, colDown = C.gold, icon = null, hint = false } = {}) {
    const b = { x: b0.x, y: b0.y - EXTRA, r: b0.r }; // (inside the field's shift)
    disc(g, b.x, b.y, b.r, C.ink);
    disc(g, b.x, b.y + (down ? 1 : 0), b.r - 2, on ? (down ? colDown : col) : C.dgray);
    if (!down && on) { g.globalAlpha = 0.35; disc(g, b.x - 3, b.y - 4, Math.max(2, Math.round(b.r / 3)), C.white); g.globalAlpha = 1; }
    if (icon) icon(g, b.x, b.y - 5 + (down ? 1 : 0));
    drawText(g, label, b.x, b.y + (icon ? 3 : -2) + (down ? 1 : 0), on ? C.ink : C.gray, { align: 'center' });
    if (hint) { const p = Math.floor(performance.now() / 250) % 2; ring(g, b.x, b.y, b.r + 3 + p, C.gold, 1); }
  }
  coinCount(g, x, y, n, col = C.white) { drawCoin(g, x, y); drawText(g, String(n), x + 8, y + 1, col, { shadow: C.ink }); }
}
