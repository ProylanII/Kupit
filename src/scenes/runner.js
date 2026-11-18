// HABOL!, drawn: a side view of the eskinita at the end of the afternoon, in layers that slide past at their own
// speed (sky, rooftops, house fronts, posts and wires, the street, plants in front). All rules live in game/runner.js.
import { Runner, KINDS, GAP_MIN, GAP_MAX, STAND_H } from '../game/runner.js';
import { ModeScene, disc, ring, bubble } from './mode.js';
import { getSprite, drawCoin, drawObj } from '../render/sprites.js';
import { drawText } from '../ui/font.js';
import { C } from '../render/palette.js';
import { sfx } from '../core/audio.js';
import { VIEW_W, BASE_H as VIEW_H, BASE_MAP_H as MAP_H, EXTRA, BUTTON } from '../core/input.js';
import { tileHash as hash } from '../world/light.js';

export const GY = 286;           // the street line on screen (feet)
const CAM_X = 54;                // Jun's place on screen
export const SLIDE_BTN = { x: 40, y: 372, r: 18 };
const r = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const HOUSE = [['#e6d3ae', '#cdb88f'], ['#a8d8b0', '#7fb58a'], ['#9fc0ff', '#7f9fd8'], ['#f3b8b0', '#d99a90'], ['#f0e0a0', '#d0bc78'], ['#c9b8e8', '#a898c8']];
const CLOTH = [[C.white, '#cfc7b8'], [C.pink, '#d9578f'], ['#7fd7ff', C.blue], [C.yellow, C.gold2], [C.red, '#a83a3a'], [C.leaf2, C.leaf]];

export class RunnerScene extends ModeScene {
  constructor(level, input, loadout = {}, opts = {}) {
    super(level, input, opts);
    this.look = opts.outfit && opts.outfit !== 'basic' ? `jun~${opts.outfit}` : 'jun';
    this.sim = new Runner(level, { lives: 1 });
    this.zones = (level.zones || [{ x: 0, theme: 'bakuran' }]).slice().sort((a, b) => a.x - b.x);
    this.dust = [];
    this.lines = [];
    this.dustT = 0;
    this.seen = new WeakSet();   // touches already turned into a jump / slide
    this.prevJump = false; this.prevSlide = false;
    this.coinStreak = 0; this.coinT = 0;
    this.signs = [];             // tips standing in the street ahead: { x, text, icon }
    this.tigreSay = null;
  }

  music() { return 'takbo'; }
  zoneAt(wx) { let z = this.zones[0]; for (const q of this.zones) if (q.x <= wx) z = q; return z.theme; }

  // TALON: the big button, Space/W/Up, or a tap on the street. DAUSDOS: the left button, S/Down, or a swipe down.
  readInput() {
    const inp = this.input, k = inp.keys;
    let jump = k.has(' ') || k.has('w') || k.has('ArrowUp') || k.has('e') || k.has('j');
    let slide = k.has('s') || k.has('ArrowDown') || k.has('k');
    for (const q of inp.pointers.values()) {
      if (q.role === 'btn') { jump = true; continue; }
      const qy = q.sy - EXTRA, inStrip = qy >= MAP_H; // (the scene is shifted down by EXTRA on a tall phone)
      if (inStrip && Math.hypot(q.sx - SLIDE_BTN.x, qy - SLIDE_BTN.y) <= SLIDE_BTN.r + 8) { slide = true; continue; }
      if (inStrip) continue;
      if (!this.seen.has(q)) { this.seen.add(q); q.kind = 'tap'; }
      if (q.kind === 'tap' && q.y - q.sy > 14) q.kind = 'swipe';
      if (q.kind === 'swipe') slide = true; else jump = true;
    }
    const out = { jump, slide, jumpPressed: jump && !this.prevJump, slidePressed: slide && !this.prevSlide };
    this.prevJump = jump; this.prevSlide = slide;
    return out;
  }

  update(dt) {
    const s = this.sim, inp = this.input;
    inp.button2Enabled = false; inp.abilityEnabled = false; inp.itemEnabled = false; inp.swapEnabled = false;
    s.update(dt, this.readInput());
    for (const e of s.events) this.onEvent(e);
    s.events.length = 0;
    this.updateShared(dt);
    if ((this.coinT -= dt) <= 0) this.coinStreak = 0;
    // dust behind running feet, a trail while sliding
    if (s.status === 'play' && !s.introT && s.onGround && !s.fell && (this.dustT -= dt) <= 0) {
      this.dustT = s.sliding ? 0.03 : 0.11;
      this.dust.push({ x: s.x - 5, y: s.y, vx: -20 - Math.random() * 20, vy: -8 - Math.random() * 10, l: s.sliding ? 0.35 : 0.45, s: s.sliding ? 1 : 2 });
    }
    for (const d of this.dust) { d.x += d.vx * dt; d.y += d.vy * dt; d.l -= dt; }
    this.dust = this.dust.filter((d) => d.l > 0);
    if (s.speed > 112 && s.onGround && Math.random() < dt * 14) this.lines.push({ x: s.x + 140, y: -6 - Math.random() * 40, l: 0.3 });
    for (const q of this.lines) q.l -= dt;
    this.lines = this.lines.filter((q) => q.l > 0);
    if (this.tigreSay && (this.tigreSay.t -= dt) <= 0) this.tigreSay = null;
    this.signs = this.signs.filter((t) => t.x > s.x - 40);
  }

  onEvent(e) {
    const s = this.sim;
    if (this.sharedEvent(e)) return;
    switch (e.type) {
      case 'go': sfx.meow(); this.pop('HABOL!', C.gold, 150, 1, 5); this.tigreSay = { text: 'MEW!', t: 1.2 }; this.showTip('habol-jump', this.touch ? 'TAP TO JUMP. HOLD FOR A BIGGER JUMP' : 'SPACE TO JUMP. HOLD FOR A BIGGER JUMP'); break;
      case 'jump': sfx.jump(); this.burst(e.x, e.y, 4, ['#d8d4dc'], { speed: 30, up: 10, g: 60, l: 0.35, s: 1 }); break;
      case 'land': if (e.hard) { sfx.thud(); this.kick(1); } this.burst(e.x, e.y, e.hard ? 8 : 4, ['#d8d4dc', C.white], { speed: 34, up: 6, g: 40, l: 0.35, s: 1 }); break;
      case 'slide': sfx.whoosh(); break;
      case 'dive': sfx.whoosh(); break;
      case 'splash': sfx.splash(); this.burst(e.x, -1, 10, ['#9fc0ff', '#5a7fb5', C.white], { speed: 50, up: 60, g: 260, l: 0.5, s: 1 }); break;
      case 'coin':
        this.coinStreak++; this.coinT = 0.6; sfx.coin(this.coinStreak);
        this.burst(e.x, e.y, 5, [C.gold, C.white], { speed: 30, up: 30, g: 40, l: 0.4, s: 1 });
        break;
      case 'stumble': {
        sfx.ouch(); this.kick(3); this.buzz(60); this.flash = 0.35; this.flashCol = C.orange;
        const what = { balde: 'BALDE!', paso: 'PASO!', manok: 'PUTAK!', aso: 'AW AW!', kahon: 'ARAY!', bangko: 'ARAY!', kariton: 'ARAY!', trike: 'BEEP!', sampayan: 'SAMPAYAN!', kable: 'ARAY!', kanal: 'NAHULOG!' }[e.kind] || 'ARAY!';
        this.say(`${what} TIGRE GETS AWAY!`, C.orange, 1.6);
        if (e.kind === 'manok') { sfx.alert(); this.burst(e.x + 6, e.y - 8, 12, [C.white, '#e8e0d0', C.red], { speed: 60, up: 40, g: 60, l: 1, s: 1 }); }
        if (e.kind === 'aso') sfx.bark();
        if (e.kind === 'balde' || e.kind === 'paso') sfx.clank();
        this.showTip('habol-stumble', 'EVERY STUMBLE LETS TIGRE RUN FURTHER AHEAD');
        break;
      }
      case 'fall': sfx.splash(); this.burst(e.x, 6, 12, ['#9fc0ff', '#5a7fb5', C.white], { speed: 60, up: 90, g: 280, l: 0.6, s: 1 }); break;
      case 'climb': sfx.hide(); break;
      case 'tip': {
        const t = e.tip;
        this.signs.push({ x: t.x, text: t.text, icon: t.icon });
        if (t.id) this.showTip(`habol-${t.id}`, t.say || t.text);
        break;
      }
      case 'gone': sfx.meow(); this.pop('NAWALA!', C.orange, 150, 1.3, 5); break;
      case 'scoop': sfx.meow(); sfx.cheer(); this.pop('AYAN KA, TIGRE!', C.gold, 140, 1.6, 3); this.burst(s.end - 4, -14, 14, [C.pink, C.white, C.gold], { speed: 40, up: 60, g: 30, l: 1.4, s: 2 }); break;
    }
  }

  // ---------------------------------------------------------------- drawing
  draw(g) {
    this.beginField(g, '#6fa3d8'); // (the sky goes on up)
    this.drawField(g);
    this.endField(g);
  }

  drawField(g) {
    const s = this.sim;
    this.frameDt();
    const now = performance.now() / 1000, [ox, oy] = this.shakeOffset();
    const camX = Math.round(s.x - CAM_X);
    g.save(); g.translate(ox, oy);
    this.drawSky(g, camX, now);
    this.drawFar(g, camX);
    this.drawMid(g, camX);
    this.drawNear(g, camX, now);
    this.drawStreet(g, camX, now);
    // the street's furniture, Tigre and Jun
    const sx = (wx) => Math.round(wx - camX);
    for (const o of s.obs) { const x = sx(s.obsX(o)); if (x > -60 && x < VIEW_W + 20) this.drawObstacle(g, o, x, now); }
    for (const c of s.coinList) { const x = sx(c.x); if (!c.got && x > -8 && x < VIEW_W + 8) this.drawCoinAt(g, x, GY + c.y, now, c.x); }
    for (const t of this.signs) this.drawSign(g, sx(t.x), t, now);
    this.drawTigre(g, sx, now);
    for (const d of this.dust) { g.globalAlpha = Math.min(1, d.l * 3); r(g, '#e6e2ea', sx(d.x), GY + d.y - 2, d.s, d.s); }
    g.globalAlpha = 1;
    this.drawJun(g, CAM_X + (s.x - camX - CAM_X), now);
    g.globalAlpha = 0.6; for (const q of this.lines) r(g, C.white, sx(q.x) - (0.3 - q.l) * 600, GY + q.y, 14, 1); g.globalAlpha = 1;
    this.drawParts(g, camX, -GY);
    if (this.tigreSay && s.status === 'play') bubble(g, this.tigreSay.text, sx(s.tigreX) + 2, GY - 26);
    this.drawFront(g, camX, now);
    g.restore();
    if (this.flash > 0) { g.globalAlpha = this.flash * 0.45; r(g, this.flashCol, 0, 0, VIEW_W, MAP_H); g.globalAlpha = 1; }
    this.drawHud(g, now);
  }

  drawSky(g, camX, t) {
    const bands = ['#6fa3d8', '#7fb0dc', '#92bde0', '#a8c9e2', '#c3d4dc', '#e2d8c4', '#f2d6a6', '#f6c88a'];
    bands.forEach((c, i) => r(g, c, 0, i * 26, VIEW_W, 26));
    for (let i = 1; i < bands.length; i++) for (let x = i & 1; x < VIEW_W; x += 2) { r(g, bands[i], x, i * 26 - 1, 1, 1); }
    // the sun going down behind the rooftops
    g.globalAlpha = 0.25; disc(g, 178, 172, 22, '#ffe7a8'); g.globalAlpha = 1;
    disc(g, 178, 172, 13, '#ffe08a'); disc(g, 176, 170, 9, '#fff0c0');
    // clouds
    for (let i = 0; i < 5; i++) {
      const w = 26 + (i * 13) % 20, x = ((i * 97 - camX * 0.05 - t * 3) % (VIEW_W + 80) + VIEW_W + 80) % (VIEW_W + 80) - 40, y = 40 + i * 19;
      r(g, '#f6f1e7', x, y, w, 4); r(g, '#f6f1e7', x + 5, y - 3, w - 12, 3); r(g, '#e2d8c4', x + 2, y + 4, w - 4, 1);
    }
  }

  // hazy rooftops far away: water tanks, antennas, a bell tower now and then
  drawFar(g, camX) {
    const p = 0.18, W = 36, off = camX * p, i0 = Math.floor(off / W) - 1;
    for (let i = i0; i < i0 + VIEW_W / W + 3; i++) {
      const h = hash(i, 3, 1), x = i * W - off, top = 196 + (h % 30), w = W - (h >>> 5) % 8;
      r(g, '#a9b4cf', x, top, w, GY - top);
      if (h % 3 === 0) { for (let k = 0; k < w / 2; k++) r(g, '#a9b4cf', x + k, top - Math.floor(k / 2) - 1, w - k * 2, 1); } // a peaked roof
      if (h % 5 === 1) { r(g, '#97a3c2', x + 6, top - 10, 8, 8); r(g, '#97a3c2', x + 7, top - 12, 6, 2); r(g, '#97a3c2', x + 7, top - 2, 1, 2); r(g, '#97a3c2', x + 12, top - 2, 1, 2); } // water tank
      if (h % 7 === 3) { r(g, '#97a3c2', x + w - 6, top - 14, 1, 14); r(g, '#97a3c2', x + w - 9, top - 12, 7, 1); } // antenna
      if (h % 23 === 5) { r(g, '#97a3c2', x + 8, top - 26, 12, 26); for (let k = 0; k < 7; k++) r(g, '#97a3c2', x + 8 + k, top - 26 - k, 12 - k * 2, 1); r(g, '#c3cde0', x + 13, top - 18, 2, 4); } // a church bell tower
      for (let wy = top + 6; wy < GY - 30; wy += 9) for (let wx = x + 4; wx < x + w - 4; wx += 8) if (hash(wx | 0, wy, 2) % 3 === 0) r(g, '#c3cde0', wx, wy, 3, 3);
    }
  }

  // the house fronts along the street (what they look like depends on which part of the barangay you are in)
  drawMid(g, camX) {
    const p = 0.5, off = camX * p, base = GY - 22;
    let x = -((off % 64) + 64), i = Math.floor(off / 64) - 1;
    while (x < VIEW_W + 64) {
      const h = hash(i, 7, 3), w = 64, theme = this.zoneAt((i * 64) / p);
      const [wall, wall2] = HOUSE[h % HOUSE.length], hgt = 66 + (h >>> 4) % 34, top = base - hgt;
      if (theme === 'court') this.drawCourt(g, x, base, h);
      else if (theme === 'bakuran' && h % 2) { // a yard: a low block wall, a gate, a mango tree behind
        r(g, C.leaf, x + 10, base - 70, 34, 30); r(g, C.leaf2, x + 14, base - 66, 22, 10); r(g, '#6e4424', x + 25, base - 40, 4, 40);
        r(g, C.block2, x, base - 22, w, 22); for (let bx = 0; bx < w; bx += 8) r(g, C.block, x + bx + 1, base - 21 + ((bx / 8) % 2) * 6, 6, 5);
        r(g, '#3a4f8a', x + 40, base - 26, 16, 26); for (let gx = 0; gx < 16; gx += 3) r(g, '#2b3b6a', x + 41 + gx, base - 25, 1, 24);
      } else {
        // walls, a galvanised iron roof with ridges, capiz windows
        r(g, wall2, x, top, w - 2, hgt); r(g, wall, x + 1, top + 1, w - 4, hgt - 1);
        r(g, '#8a94a8', x - 3, top - 6, w + 3, 7); for (let k = 0; k < w + 3; k += 4) r(g, '#a7b0c2', x - 3 + k, top - 6, 2, 7);
        r(g, '#5a6478', x - 3, top, w + 3, 1);
        const win = (wx, wy) => { r(g, '#3b2a1c', wx - 1, wy - 1, 16, 14); r(g, C.capiz, wx, wy, 14, 12); r(g, C.capiz2, wx, wy + 6, 14, 1); r(g, C.capiz2, wx + 7, wy, 1, 12); };
        if (hgt > 80) { win(x + 8, top + 8); win(x + 36, top + 8); }
        if (theme === 'tindahan' && h % 3 !== 2) { // a sari-sari window with snacks, a sign over it
          const sc = [C.red, C.gold, '#4f8fff', C.orange, C.pink];
          r(g, '#2a1d14', x + 6, base - 34, 46, 20); for (let k = 0; k < 8; k++) r(g, sc[(k + h) % sc.length], x + 8 + k * 5, base - 32, 4, 4 + (k % 3));
          r(g, C.table2, x + 4, base - 15, 50, 3);
          r(g, ['#227a43', '#a83a3a', '#2f5fbf'][h % 3], x + 4, base - 44, 50, 9); drawText(g, ['SARI-SARI', 'TINDAHAN', 'LOAD DITO'][h % 3], x + 29, base - 42, C.white, { align: 'center' });
        } else {
          r(g, '#6e4424', x + 40, base - 30, 14, 30); r(g, C.gold, x + 51, base - 15, 2, 2); // a door
          win(x + 8, base - 30);
          if (theme === 'sampayan') { // washing hung from the windows
            r(g, '#6a6488', x - 2, base - 40, w + 2, 1);
            for (let k = 0; k < 5; k++) { const [c, c2] = CLOTH[(k + h) % CLOTH.length]; r(g, c, x + 2 + k * 12, base - 39, 8, 9); r(g, c2, x + 2 + k * 12, base - 31, 8, 1); }
          }
        }
        if (h % 4 === 1) { r(g, C.pot, x + 2, base - 7, 8, 7); r(g, C.leaf, x + 1, base - 14, 10, 7); r(g, C.leaf2, x + 3, base - 16, 5, 3); }
      }
      x += w; i++;
    }
    r(g, '#9b97a3', 0, base, VIEW_W, 2); // the sidewalk edge
    r(g, '#c2bec6', 0, base + 2, VIEW_W, GY - 18 - base - 2);
  }
  drawCourt(g, x, base, h) { // the basketball court: a chain fence, a ring on a post
    r(g, '#3a7f5a', x, base - 12, 64, 12);
    for (let k = 0; k < 64; k += 4) for (let y = base - 50; y < base; y += 4) r(g, '#8a94a8', x + k + ((y / 4) % 2) * 2, y, 1, 1);
    r(g, '#6a7488', x, base - 52, 64, 2);
    if (h % 3 === 0) { r(g, '#6a7488', x + 30, base - 90, 3, 90); r(g, C.white, x + 18, base - 92, 22, 14); r(g, C.red, x + 26, base - 84, 7, 5); r(g, C.orange, x + 23, base - 77, 12, 2); }
  }

  // electric posts with their tangle of wires, and a string of banderitas in the busy parts
  drawNear(g, camX, t) {
    const p = 0.85, W = 150, off = camX * p, base = GY - 20;
    const i0 = Math.floor(off / W) - 1;
    const posts = [];
    for (let i = i0; i < i0 + VIEW_W / W + 3; i++) posts.push({ i, x: i * W - off + 30 });
    for (let k = 0; k + 1 < posts.length; k++) {
      const a = posts[k], b = posts[k + 1];
      for (let wi = 0; wi < 3; wi++) {
        const ya = base - 150 + wi * 5, sag = 10 + wi * 4 + (hash(a.i, wi, 5) % 6);
        for (let x = a.x; x <= b.x; x += 1) { const u = (x - a.x) / (b.x - a.x); r(g, '#3a3550', x, ya + Math.sin(u * Math.PI) * sag, 1, 1); }
      }
      const theme = this.zoneAt((a.i * W + W / 2) / p);
      if (theme === 'tindahan' || theme === 'court') { // banderitas
        const cols = [C.red, C.gold, '#4f8fff', C.green, C.pink];
        for (let x = a.x; x < b.x; x += 6) {
          const u = (x - a.x) / (b.x - a.x), y = Math.round(base - 120 + Math.sin(u * Math.PI) * 18 + Math.sin(t * 3 + x * 0.1));
          r(g, '#6a6488', x, y, 6, 1); const c = cols[(Math.round(x + off) / 6 | 0) % cols.length]; r(g, c, x + 1, y + 1, 4, 2); r(g, c, x + 2, y + 3, 2, 1);
        }
      }
    }
    for (const q of posts) {
      r(g, '#5a5468', q.x, base - 160, 4, 160); r(g, '#7a7488', q.x, base - 160, 1, 160);
      r(g, '#5a5468', q.x - 8, base - 152, 20, 2); r(g, '#46415a', q.x - 6, base - 150, 2, 3); r(g, '#46415a', q.x + 8, base - 150, 2, 3);
      if (hash(q.i, 1, 9) % 3 === 0) { r(g, '#46415a', q.x + 4, base - 130, 8, 10); r(g, '#7a7488', q.x + 5, base - 129, 6, 1); } // a transformer
    }
  }

  drawStreet(g, camX, t) {
    const top = GY - 18;
    r(g, '#9b97a3', 0, top, VIEW_W, 1);
    r(g, '#b4b0b8', 0, top + 1, VIEW_W, GY + 14 - top);
    for (let x = -(camX % 32); x < VIEW_W; x += 32) { r(g, '#a6a2ae', x, top + 1, 1, GY + 14 - top); const k = hash(Math.round((x + camX) / 32), 2, 4); if (k % 4 === 0) { r(g, '#8d8996', x + 9, GY - 6, 1, 4); r(g, '#8d8996', x + 10, GY - 3, 3, 1); } }
    for (let x = -(camX % 24); x < VIEW_W; x += 24) r(g, '#cfcbd3', x + 4, GY - 9, 10, 1); // tyre-polished streaks
    r(g, '#8d8996', 0, GY + 14, VIEW_W, 2);
    r(g, '#5a5468', 0, GY + 16, VIEW_W, MAP_H - GY - 16);
    // the open kanal along the bottom edge
    r(g, '#3a3550', 0, GY + 22, VIEW_W, 10); for (let x = -((camX * 1.0 + t * 12) % 9); x < VIEW_W; x += 9) r(g, '#5a7fb5', x, GY + 26, 4, 1);
    r(g, '#46415a', 0, GY + 32, VIEW_W, MAP_H - GY - 32);
  }

  // plants and fence posts passing close in front (they move faster than the street)
  drawFront(g, camX) {
    const p = 1.3, W = 110, off = camX * p, i0 = Math.floor(off / W) - 1;
    for (let i = i0; i < i0 + VIEW_W / W + 3; i++) {
      const h = hash(i, 11, 2), x = i * W - off;
      if (h % 3 === 0) { // a gumamela bush in a big tin, close to the eye
        r(g, '#5a5468', x + 1, GY + 22, 22, 30); r(g, '#7a7488', x + 1, GY + 22, 22, 2); r(g, '#46415a', x + 18, GY + 24, 5, 28);
        for (const [bx, by, br] of [[6, 16, 9], [17, 14, 9], [11, 8, 9], [2, 10, 6], [21, 8, 6]]) disc(g, x + bx, GY + by, br, '#2f6b4a');
        for (const [bx, by, br] of [[8, 12, 5], [16, 10, 5], [12, 5, 4]]) disc(g, x + bx, GY + by, br, '#3a7f5a');
        for (const [bx, by] of [[5, 9], [14, 5], [20, 12], [9, 17]]) { r(g, C.red, x + bx, GY + by, 3, 3); r(g, C.gold, x + bx + 1, GY + by + 1, 1, 1); }
      }
      else if (h % 3 === 1) { r(g, '#2a2440', x, GY + 24, 4, 40); r(g, '#2a2440', x + 40, GY + 24, 4, 40); r(g, '#2a2440', x - 4, GY + 28, 52, 3); } // a low fence
    }
  }

  drawObstacle(g, o, x, t) {
    const b = GY;
    switch (o.kind) {
      case 'balde':
        if (o.hit) { r(g, C.ink, x - 3, b - 7, 14, 8); r(g, '#4f8fff', x - 2, b - 6, 12, 6); r(g, '#2f5fbf', x - 2, b - 2, 12, 2); break; }
        r(g, C.ink, x - 1, b - 13, 12, 13); r(g, '#4f8fff', x, b - 12, 10, 12); r(g, '#2f5fbf', x + 7, b - 12, 3, 12); r(g, '#9fc0ff', x + 1, b - 11, 2, 9);
        r(g, C.ink, x + 1, b - 16, 8, 1); r(g, C.ink, x, b - 15, 1, 2); r(g, C.ink, x + 9, b - 15, 1, 2);
        break;
      case 'paso':
        r(g, C.ink, x - 1, b - 9, 14, 9); r(g, C.pot, x, b - 8, 12, 8); r(g, '#8a4a2a', x + 9, b - 8, 3, 8); r(g, '#d4844f', x, b - 8, 12, 2);
        r(g, C.leaf, x - 1, b - 16, 14, 8); r(g, C.leaf2, x + 2, b - 18, 7, 4); r(g, C.red, x + 4, b - 15, 2, 2);
        break;
      case 'manok': { // a chicken pecking about (it faces the way it walks)
        const dir = Math.cos(this.sim.time * 2.2 + o.x0) > 0 ? 1 : -1, peck = Math.floor(t * 4 + o.x0) % 3 === 0;
        if (o.hit) { r(g, '#f6f1e7', x, b - 22 - ((t * 60) % 30), 10, 7); break; }
        const X = (dx, w) => (dir > 0 ? x + dx : x + 11 - dx - w);
        r(g, C.ink, X(0, 11), b - 10, 11, 8); r(g, '#f6f1e7', X(1, 9), b - 9, 9, 6); r(g, '#cfc7b8', X(1, 4), b - 5, 4, 2);
        r(g, '#f6f1e7', X(7, 4), b - (peck ? 9 : 13), 4, 5); r(g, C.red, X(8, 2), b - (peck ? 10 : 14), 2, 2); r(g, C.gold, X(11, 2), b - (peck ? 7 : 11), 2, 1);
        r(g, C.ink, X(9, 1), b - (peck ? 8 : 12), 1, 1); r(g, '#a8642c', X(-2, 3), b - 12, 3, 4);
        r(g, C.gold2, X(3, 1), b - 2, 1, 2); r(g, C.gold2, X(6, 1), b - 2, 1, 2);
        break;
      }
      case 'aso': {
        const spr = getSprite('aso', 2, o.hit ? 'alert' : 'sleep');
        g.drawImage(spr, x + Math.round(o.w / 2 - spr.width / 2), b + 1 - spr.height);
        if (!o.hit) drawText(g, Math.floor(t * 2) % 2 ? 'Z' : 'z', x + 18, b - 16 - (Math.floor(t * 2) % 2), C.white, { shadow: C.ink });
        break;
      }
      case 'kahon':
        for (let k = 0; k < o.stack; k++) {
          const y = b - 16 * (k + 1);
          r(g, C.ink, x - 1, y - 1, 18, 18); r(g, '#c48a4a', x, y, 16, 16); r(g, '#dca868', x, y, 16, 2);
          r(g, '#a8723a', x, y + 7, 16, 1); r(g, '#a8723a', x, y + 12, 16, 1); r(g, '#6e4424', x + 1, y + 2, 1, 13); r(g, '#6e4424', x + 14, y + 2, 1, 13);
          for (let d = 0; d < 12; d++) r(g, '#a8723a', x + 2 + d, y + 2 + d, 1, 1);
        }
        break;
      case 'bangko':
        r(g, C.ink, x - 1, b - 11, o.w + 2, 4); r(g, C.table2, x, b - 10, o.w, 3); r(g, '#c48a4a', x, b - 10, o.w, 1);
        r(g, C.table, x + 3, b - 7, 3, 7); r(g, C.table, x + o.w - 6, b - 7, 3, 7);
        break;
      case 'kariton':
        r(g, C.ink, x - 1, b - 21, o.w + 2, 15); r(g, '#8a6a42', x, b - 20, o.w, 13); r(g, '#a8845a', x, b - 20, o.w, 2);
        for (let k = 4; k < o.w; k += 6) r(g, '#6e5334', x + k, b - 18, 1, 11);
        disc(g, x + o.w / 2, b - 5, 5, C.ink); disc(g, x + o.w / 2, b - 5, 3, '#5a5468'); r(g, '#6e5334', x + o.w, b - 16, 10, 2);
        break;
      case 'trike': { // a parked tricycle, side view: the sidecar with its roof, the motorbike in front
        const y = b - o.h;
        r(g, C.ink, x - 1, y - 1, o.w + 2, 3); r(g, '#4f8fff', x, y, o.w - 8, 2); r(g, C.white, x + 4, y + 2, 3, 1); // roof
        r(g, '#2f5fbf', x + 1, y + 2, 2, 10); r(g, '#2f5fbf', x + o.w - 12, y + 2, 2, 10); // roof posts
        r(g, C.ink, x - 1, y + 11, o.w - 8, 10); r(g, '#4f8fff', x, y + 12, o.w - 10, 8); r(g, C.red, x, y + 15, o.w - 10, 2); r(g, '#9fd8e8', x + 4, y + 4, 22, 7);
        r(g, '#3a3550', x + o.w - 10, y + 12, 10, 6); r(g, C.red, x + o.w - 8, y + 9, 8, 4); r(g, C.gray, x + o.w - 4, y + 6, 1, 4);
        for (const wx of [x + 8, x + o.w - 4]) { disc(g, wx, b - 4, 4, C.ink); disc(g, wx, b - 4, 2, C.gray); }
        drawText(g, 'TODA', x + 13, y + 13, C.white);
        break;
      }
      case 'sampayan': case 'kable': {
        const lineY = b - (o.kind === 'sampayan' ? 52 : 44), sway = Math.sin(t * 2.4 + o.x) * 1.5;
        r(g, '#6e4424', x - 2, lineY - 4, 2, b - lineY + 4); r(g, '#6e4424', x + o.w, lineY - 4, 2, b - lineY + 4);
        r(g, '#3a3550', x, lineY, o.w, 1);
        if (o.kind === 'sampayan') {
          for (let k = 2; k < o.w - 6; k += 9) {
            const [c, c2] = CLOTH[(Math.round(o.x / 9) + k) % CLOTH.length], hang = b - o.low - lineY, sw = Math.round(sway * (k % 2 ? 1 : -1));
            r(g, C.ink, x + k - 1 + sw, lineY + 1, 9, hang); r(g, c, x + k + sw, lineY + 1, 7, hang - 1); r(g, c2, x + k + sw, lineY + hang - 3, 7, 2);
            r(g, '#c4bfd0', x + k + 2, lineY - 1, 1, 2);
          }
        } else {
          const cols = [C.red, C.gold, '#4f8fff', C.green, C.pink];
          for (let k = 0; k < o.w; k += 5) { const y = lineY + 1 + Math.round(Math.sin((k / o.w) * Math.PI) * (b - o.low - lineY - 6)); r(g, '#3a3550', x + k, y, 5, 1); r(g, cols[(k / 5) % 5], x + k + 1, y + 1, 3, 5); r(g, cols[(k / 5) % 5], x + k + 2, y + 6, 1, 1); }
        }
        // a dotted line where the danger stops: slide under it
        g.globalAlpha = 0.35; for (let k = 0; k < o.w; k += 3) r(g, C.white, x + k, b - o.low, 1, 1); g.globalAlpha = 1;
        break;
      }
      case 'kanal': { // an open drain cut right across the street: a trench, dark water at the bottom
        const top = GY - 18;
        r(g, '#1b1424', x, top, o.w, GY + 22 - top); r(g, '#2a2440', x + 2, top + 2, o.w - 4, GY + 18 - top);
        r(g, '#3a3550', x + 2, top + 2, 3, GY + 18 - top); // the far wall, catching a little light
        r(g, '#2a3a5a', x + 2, GY + 8, o.w - 4, 10); for (let k = 0; k < o.w - 8; k += 5) r(g, '#5a7fb5', x + 4 + ((k + Math.floor(t * 8)) % (o.w - 8)), GY + 11, 3, 1);
        r(g, '#8d8996', x - 2, top, 2, GY + 16 - top); r(g, '#cfcbd3', x - 2, top, 1, GY + 16 - top); r(g, '#8d8996', x + o.w, top, 2, GY + 16 - top); // broken concrete lips
        break;
      }
      case 'lusak':
        g.globalAlpha = 0.85; r(g, '#3a5a8a', x, b - 2, o.w, 4); r(g, '#5a7fb5', x + 2, b - 2, o.w - 4, 2); r(g, '#9fc0ff', x + 4 + Math.floor(t * 3) % 6, b - 2, 4, 1); g.globalAlpha = 1;
        break;
    }
  }

  drawCoinAt(g, x, y, t, seed) {
    const f = Math.floor(t * 8 + seed * 0.1) % 4, bob = Math.round(Math.sin(t * 4 + seed) * 1);
    if (f === 0 || f === 2) drawCoin(g, x - 2, y - 6 + bob);
    else { r(g, C.gold2, x - (f === 1 ? 1 : 0), y - 6 + bob, f === 1 ? 3 : 1, 5); r(g, C.gold, x, y - 5 + bob, 1, 3); }
  }

  drawSign(g, x, t, now) { // a hint standing on the street ahead: TALON, DAUSDOS
    if (x < -20 || x > VIEW_W + 20) return;
    const up = t.icon !== 'down', p = Math.floor(now * 4) % 2, y = GY - 76 - p;
    r(g, C.ink, x - 1, y + 19, 3, GY - y - 19); r(g, '#8a94a8', x, y + 19, 1, GY - y - 19); // its post
    r(g, C.ink, x - 18, y - 1, 37, 21); r(g, up ? C.gold : '#4f8fff', x - 17, y, 35, 19);
    g.fillStyle = C.ink;
    for (let i = 0; i < 4; i++) g.fillRect(x - i, up ? y + 2 + i : y + 8 - i, 1 + i * 2, 1); // the arrow
    drawText(g, t.text, x, y + 12, C.ink, { align: 'center' });
  }

  drawTigre(g, sx, t) {
    const s = this.sim, tx = s.tigreX, x = sx(tx);
    if (x > VIEW_W + 20) return;
    let y = 0, pose = Math.floor(t * 14) % 4, leap = false;
    if (s.beat?.kind === 'scoop' || (tx >= s.end && s.status === 'play' && s.x < s.end - 16)) pose = 'sit';
    else if (s.introT > 0) pose = s.introT > 1.2 ? 'sit' : Math.floor(t * 14) % 4;
    else for (const o of s.obs) { // he hops what Jun has to jump, and walks under the washing
      const ox = s.obsX(o);
      if (o.hang || o.soft || tx < ox - 10 || tx > ox + o.w + 10) continue;
      const u = (tx - (ox - 10)) / (o.w + 20);
      y = -Math.sin(u * Math.PI) * ((o.gap ? 8 : o.h) + 6); leap = true; break;
    }
    if (s.beat?.kind === 'gone') { x += (1.3 - s.beat.t) * 120; }
    const spr = getSprite('tigre', 2, leap ? 'leap' : pose === 'sit' ? 'sit' : pose);
    g.globalAlpha = 0.3; r(g, C.ink, x - 4, GY - 1, 9, 2); g.globalAlpha = 1;
    if (s.beat?.kind === 'scoop') return; // (Jun has him in his arms)
    g.drawImage(spr, Math.round(x - spr.width / 2), Math.round(GY + y + 1 - spr.height));
  }

  drawJun(g, x, now) {
    const s = this.sim;
    let pose, sxk = 1, syk = 1;
    if (s.beat?.kind === 'scoop') pose = 'reach';
    else if (s.stunT > 0 || s.fell) pose = 'caught';
    else if (s.sliding) pose = 'slide';
    else if (!s.onGround) pose = s.vy < -40 ? 'jump' : 'fall';
    else if (s.introT > 0) pose = 0;
    else pose = `run${Math.floor(s.dist / 9) % 4}`;
    if (s.jumpT > 0) { sxk = 0.84; syk = 1.18; } else if (s.landT > 0 && !s.sliding) { sxk = 1.2; syk = 0.82; }
    const spr = getSprite(this.look, 2, pose), w = Math.round(spr.width * sxk), h = Math.round(spr.height * syk);
    const feet = GY + Math.round(s.y) + 1;
    // the shadow on whatever is under him, smaller the higher he is
    const ground = s.standOn && s.standOn !== 'street' ? -s.standOn.h : 0, air = ground - s.y;
    if (!s.fell) { const k = Math.max(0.35, 1 - (-air) / 70); g.globalAlpha = 0.3; r(g, C.ink, x - Math.round(5 * k), GY + ground - 1, Math.round(11 * k), 2); g.globalAlpha = 1; }
    if (s.invT > 0 && Math.floor(now * 14) % 2) g.globalAlpha = 0.45;
    if (s.fell) { g.save(); g.beginPath(); g.rect(0, 0, VIEW_W, GY + 2); g.clip(); }
    g.drawImage(spr, Math.round(x - w / 2 + (pose === 'slide' ? 3 : 0)), feet - h, w, h);
    if (s.fell) g.restore();
    g.globalAlpha = 1;
    if (s.beat?.kind === 'scoop') { // Tigre in his arms
      const k = getSprite('tigre', 0, 'sit');
      g.drawImage(k, Math.round(x + 2), feet - 16);
      if (Math.floor(now * 3) % 2) { r(g, C.pink, x + 1, feet - 30, 2, 1); r(g, C.pink, x + 4, feet - 30, 2, 1); r(g, C.pink, x + 1, feet - 29, 5, 1); r(g, C.pink, x + 2, feet - 28, 3, 1); r(g, C.pink, x + 3, feet - 27, 1, 1); }
    }
  }

  drawHud(g, now) {
    const s = this.sim;
    g.globalAlpha = 0.8; r(g, C.ink, 0, 0, VIEW_W, 24); g.globalAlpha = 1;
    this.coinCount(g, 4, 4, `${s.coinsGot}/${s.coinsTotal}`, s.coinsGot >= s.coinsTotal ? C.green : C.white);
    drawText(g, this.level.name, VIEW_W / 2, 4, C.gold, { align: 'center', shadow: C.ink });
    drawText(g, `${Math.floor(s.time)}S`, VIEW_W - 4, 4, C.white, { align: 'right' });
    // the chase: Jun on the left, Tigre further along the rope the more he gets away; past the red line he is gone
    const x0 = 58, x1 = 200, k = (s.gap - GAP_MIN) / (GAP_MAX - GAP_MIN), tx = Math.round(x0 + 18 + (x1 - x0 - 18) * Math.max(0, Math.min(1, k)));
    const danger = k > 0.6;
    drawText(g, 'TIGRE', 4, 15, danger && Math.floor(now * 4) % 2 ? C.red : C.orange);
    for (let x = x0 + 4; x < tx; x += 3) r(g, k > 0.6 ? C.red : k > 0.3 ? C.yellow : C.green, x, 17, 2, 1);
    for (let y = 12; y < 22; y += 2) r(g, C.red, x1 + 2, y, 1, 1);
    r(g, C.gold, x0 - 2, 14, 5, 6); r(g, C.ink, x0 - 1, 15, 3, 2); // Jun's marker
    const head = getSprite('tigre', 0, 'sit'); g.drawImage(head, tx - Math.floor(head.width / 2), 12);
    const pg = Math.round(s.progress * (VIEW_W - 8)); r(g, '#2a2440', 4, 22, VIEW_W - 8, 1); r(g, C.gold2, 4, 22, pg, 1); // how far down the street
    this.drawTopTip(g);
    this.drawToast(g, 196);
    this.drawCard(g, 168);
    if (s.introT > 0) {
      g.globalAlpha = 0.75; r(g, C.ink, 0, 112, VIEW_W, 56); g.globalAlpha = 1;
      drawText(g, 'HABOL!', VIEW_W / 2, 118, C.gold, { scale: 4, align: 'center', shadow: C.gold2 });
      drawText(g, 'TIGRE GOT OUT. CATCH HIM!', VIEW_W / 2, 142, C.white, { align: 'center' });
      drawText(g, s.introT > 1 ? 'HANDA...' : 'TAKBO!', VIEW_W / 2, 154, C.yellow, { scale: 2, align: 'center', shadow: C.ink });
    }
    this.drawBig(g);
    // controls: DAUSDOS on the left thumb, TALON on the right
    this.drawStrip(g, null, C.gray, null);
    if (s.time < 12 && s.status === 'play') drawText(g, this.touch ? 'TAP THE STREET: JUMP   SWIPE DOWN: SLIDE' : 'SPACE / W: JUMP    S / DOWN: SLIDE', VIEW_W / 2, MAP_H - 10, C.gray, { align: 'center' });
    const arrow = (up) => (gg, x, y) => { gg.fillStyle = C.ink; for (let i = 0; i < 4; i++) gg.fillRect(x - i, up ? y - 2 + i : y + 1 - i, 1 + i * 2, 1); };
    const hintJump = this.tip?.id === 'habol-jump' || this.signs.some((t) => t.icon !== 'down' && t.x - s.x < 90);
    const hintSlide = this.signs.some((t) => t.icon === 'down' && t.x - s.x < 90);
    this.drawRoundButton(g, SLIDE_BTN, 'SLIDE', { down: this.prevSlide, col: '#2f5fbf', colDown: '#4f8fff', icon: arrow(false), hint: hintSlide });
    this.drawRoundButton(g, BUTTON, 'JUMP', { down: this.prevJump, icon: arrow(true), hint: hintJump });
  }

  drawFail(g) {
    drawText(g, 'NAWALA SI', VIEW_W / 2, 50, C.orange, { scale: 3, align: 'center', shadow: C.ink });
    drawText(g, 'TIGRE!', VIEW_W / 2, 74, C.orange, { scale: 5, align: 'center', shadow: C.ink });
    const spr = getSprite(this.look, 0, 'caught');
    g.drawImage(spr, VIEW_W / 2 - Math.floor(spr.width / 2), 128 - spr.height);
    drawText(g, 'HE GOT TOO FAR AHEAD. RUN CLEAN TO KEEP UP', VIEW_W / 2, 140, C.white, { align: 'center' });
    drawText(g, `COINS ${this.sim.coinsGot}/${this.sim.coinsTotal}   ${Math.round(this.sim.progress * 100)}% OF THE WAY`, VIEW_W / 2, 154, C.gray, { align: 'center' });
  }
}
