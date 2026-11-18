// Cut-ins: a character's portrait slides in across a band with a short line, holds, and slides out. Used for a close
// call (who found you, angry), a boss's entrance and phase changes, the end of a level, and the mini-games' big
// moments. While one is showing a scene may hold its game still (freezing); a tap or a key cuts it short (skip).
import { VIEW_W } from '../core/input.js';
import { drawPortrait } from '../render/sprites.js';
import { drawText, drawBig, wrapBig } from './font.js';
import { C } from '../render/palette.js';

const IN = 0.18, OUT = 0.14; // slide in, slide out (seconds)
export const BAND_H = 46;

export class CutIns {
  constructor() { this.q = []; this.cur = null; }

  // who: a portrait id ('mama', 'jun', 'cat', ...); mood: '' | happy | sad | angry | shock; name: the tag over the
  // line; line: what they say; sub: a second line under the band (e.g. chances left); side: where it comes from;
  // dur: seconds on screen, slides included; col: the accent; freeze: hold the game still while it shows.
  push(c) { this.q.push({ side: 'left', dur: 1.3, col: C.gold, freeze: true, mood: '', name: '', line: '', sub: '', ...c, t: 0 }); }
  get showing() { return !!this.cur || this.q.length > 0; }
  get freezing() { const c = this.cur || this.q[0]; return !!c?.freeze && (!this.cur || this.cur.t < this.cur.dur - OUT); }
  skip() { if (this.cur && this.cur.t < this.cur.dur - OUT) this.cur.t = this.cur.dur - OUT; }
  clear() { this.q.length = 0; this.cur = null; }

  update(dt) {
    if (!this.cur && this.q.length) this.cur = this.q.shift();
    if (this.cur && (this.cur.t += dt) >= this.cur.dur) this.cur = null;
  }

  // y: the band's top edge (in whatever coordinates the scene is drawing in)
  draw(g, y = 98) {
    const c = this.cur;
    if (!c) return;
    const t = c.t, left = c.side !== 'right';
    const k = t < IN ? 1 - Math.pow(1 - t / IN, 3) : t > c.dur - OUT ? Math.max(0, (c.dur - t) / OUT) : 1; // ease out, then away
    const H = BAND_H, w = Math.round(VIEW_W * k);
    // the band: dark, edged in the accent colour, with streaks rushing the way the portrait came in
    g.globalAlpha = 0.9; g.fillStyle = C.ink; g.fillRect(left ? 0 : VIEW_W - w, y, w, H); g.globalAlpha = 1;
    g.fillStyle = c.col; g.fillRect(left ? 0 : VIEW_W - w, y, w, 2); g.fillRect(left ? VIEW_W - w : 0, y + H - 2, w, 2);
    for (let i = 0; i < 10; i++) {
      const ly = y + 5 + ((i * 13) % (H - 10)), len = 10 + ((i * 29) % 26), run = (t * 520 + i * 67) % (VIEW_W + 40);
      g.globalAlpha = 0.22 * k; g.fillStyle = c.col;
      g.fillRect(Math.round(left ? run - 40 : VIEW_W - run), ly, len, 1);
    }
    g.globalAlpha = 1;
    // the portrait in a frame, sliding in from its side
    const fx = left ? Math.round(-40 + 46 * k) : Math.round(VIEW_W - 40 + 46 * (1 - k)), fy = y + 6; // ends 6 px from its edge
    g.fillStyle = c.col; g.fillRect(fx - 2, fy - 2, 38, 36);
    g.fillStyle = '#2a2440'; g.fillRect(fx, fy, 34, 32);
    const bob = t > IN && t < IN + 0.12 ? -1 : 0; // a little jolt as it lands
    drawPortrait(g, c.who, fx + 2, fy + 1 + bob, 1, c.mood);
    // the name tag and the line, beside it
    g.globalAlpha = Math.min(1, k * 1.4);
    const tw = VIEW_W - 56, tx = left ? 48 : VIEW_W - 48; // the text beside the portrait (left edge, or right edge)
    const al = { align: left ? 'left' : 'right' };
    if (c.name) drawText(g, c.name, tx, y + 6, c.col, al);
    const L = wrapBig(c.line, tw).slice(0, 2);
    L.forEach((l, i) => drawBig(g, l, tx, y + (c.name ? 15 : 12) + i * 10 + (L.length === 1 ? 4 : 0), C.white, al));
    if (c.sub) {
      g.globalAlpha = 0.85 * Math.min(1, k * 1.4); g.fillStyle = C.ink; g.fillRect(0, y + H, VIEW_W, 12); g.globalAlpha = Math.min(1, k * 1.4);
      drawBig(g, c.sub, VIEW_W / 2, y + H + 2, c.subCol || C.orange, { align: 'center' });
    }
    g.globalAlpha = 1;
  }
}
