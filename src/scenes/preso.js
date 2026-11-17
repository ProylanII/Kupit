// TUMBANG PRESO, drawn: the street in front of Aling Nena's sari-sari store, chalk on the concrete, the kids, the
// slippers in flight and the can. All rules live in game/preso.js.
import { Preso, FIELD, LINE_Y, CAN_HOME, HIT_R, MAX_D, WIN, POWER_PERIOD, tri } from '../game/preso.js';
import { ModeScene, disc, ring, bubble } from './mode.js';
import { drawActor, drawObj, objSprite } from '../render/sprites.js';
import { drawText } from '../ui/font.js';
import { C } from '../render/palette.js';
import { sfx } from '../core/audio.js';
import { VIEW_W, VIEW_H, MAP_H, BUTTON } from '../core/input.js';
import { tileHash as hash } from '../world/light.js';

const SLIP_COL = { jun: 'blue', toto: 'green', lina: 'pink', buboy: 'red' };
const r = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

function buildStreet() {
  const cv = document.createElement('canvas'); cv.width = VIEW_W; cv.height = MAP_H;
  const g = cv.getContext('2d');
  // concrete street: big slabs, seams, stains and cracks
  r(g, '#b4b0b8', 0, 0, VIEW_W, MAP_H);
  for (let y = 0; y < MAP_H; y += 16) for (let x = 0; x < VIEW_W; x += 16) {
    const tx = x >> 4, ty = y >> 4;
    if (ty % 2 === 0) r(g, '#9b97a3', x, y, 16, 1);
    if ((tx + (ty >> 1)) % 3 === 0) r(g, '#9b97a3', x, y, 1, 16);
    for (let i = 0; i < 3; i++) { const h = hash(tx, ty, 20 + i); r(g, i ? '#a6a2ae' : '#c2bec6', x + 1 + (h % 13), y + 1 + ((h >>> 6) % 13), 1 + (h >>> 12) % 2, 1); }
    const k = hash(tx, ty, 24);
    if (k % 9 === 0) { r(g, '#8d8996', x + 3 + (k >>> 4) % 7, y + 4, 1, 4); r(g, '#8d8996', x + 4 + (k >>> 4) % 7, y + 7, 2, 1); }
  }
  // the gutter along both sides
  r(g, '#8d8996', FIELD.x0 - 2, 0, 2, MAP_H); r(g, '#8d8996', FIELD.x1, 0, 2, MAP_H);
  // left: a block wall with a capiz window and potted plants; right: a wooden fence with a gumamela bush
  r(g, C.block2, 0, 0, FIELD.x0 - 2, MAP_H);
  for (let y = 0; y < MAP_H; y += 8) for (let x = (y / 8) % 2 ? -4 : 0; x < FIELD.x0 - 2; x += 8) { r(g, C.block, x + 1, y + 1, 6, 6); }
  r(g, '#3b2a1c', 2, 150, 14, 22); r(g, C.capiz, 3, 151, 12, 20); r(g, C.capiz2, 3, 160, 12, 1); r(g, C.capiz2, 8, 151, 1, 20);
  for (const y of [230, 300]) { r(g, C.pot, 4, y, 10, 8); r(g, C.leaf, 3, y - 8, 12, 8); r(g, C.leaf2, 5, y - 10, 6, 4); }
  r(g, C.wood2, FIELD.x1 + 2, 0, VIEW_W - FIELD.x1 - 2, MAP_H);
  for (let x = FIELD.x1 + 3; x < VIEW_W; x += 5) r(g, C.woodLine, x, 0, 1, MAP_H);
  for (let y = 60; y < MAP_H; y += 60) r(g, C.table, FIELD.x1 + 2, y, VIEW_W - FIELD.x1 - 2, 3);
  for (const y of [120, 250]) { r(g, C.leaf, FIELD.x1 + 4, y, 14, 14); r(g, C.leaf2, FIELD.x1 + 6, y + 2, 9, 6); r(g, C.red, FIELD.x1 + 8, y + 3, 3, 3); r(g, C.red, FIELD.x1 + 13, y + 8, 3, 3); }
  // the sari-sari store along the top: a sign, a window full of snacks, a counter
  r(g, C.plaster2, 0, 0, VIEW_W, 50); r(g, C.plaster, 0, 0, VIEW_W, 46);
  r(g, '#227a43', 46, 14, 148, 12); r(g, '#2fa55b', 46, 14, 148, 2); r(g, C.ink, 46, 26, 148, 1);
  drawText(g, "SARI-SARI NI ALING NENA", VIEW_W / 2, 18, C.white, { align: 'center' });
  r(g, '#3b2a1c', 58, 28, 124, 18); r(g, '#2a1d14', 60, 30, 120, 14);
  const snack = [C.red, C.gold, '#4f8fff', C.orange, C.pink, C.green];
  for (let i = 0; i < 14; i++) { const x = 63 + i * 8, l = 4 + (i * 3) % 4; r(g, '#9a94a8', x + 2, 30, 1, 2); r(g, snack[i % snack.length], x, 32, 5, l); r(g, C.white, x + 1, 33, 1, 1); }
  for (const x of [66, 170]) { r(g, '#cfe9f2', x, 38, 8, 7); r(g, C.red, x + 1, 39, 6, 2); r(g, C.gold, x + 1, 42, 6, 2); }
  r(g, C.table2, 56, 44, 128, 4); r(g, C.table, 56, 47, 128, 2);
  for (const x of [8, 200]) { r(g, '#3b2a1c', x, 24, 26, 22); r(g, '#6e4424', x + 2, 26, 22, 20); r(g, C.gold, x + 19, 36, 2, 2); } // doors either side
  r(g, C.ink, 0, 49, VIEW_W, 1);
  // a bench in front of the store (Bing sits there)
  r(g, C.table, 24, 66, 30, 4); r(g, C.table2, 24, 66, 30, 1); r(g, C.table, 26, 70, 2, 5); r(g, C.table, 50, 70, 2, 5);
  // chalk: the circle, the line, LINYA, and somebody's piko squares
  g.fillStyle = 'rgba(246,241,231,0.85)';
  for (let a = 0; a < 40; a++) { if (a % 3 === 2) continue; const an = (a / 40) * Math.PI * 2; g.fillRect(Math.round(CAN_HOME.x + Math.cos(an) * 12), Math.round(CAN_HOME.y + Math.sin(an) * 7), 1, 1); }
  for (let x = FIELD.x0 + 4; x < FIELD.x1 - 4; x += 6) g.fillRect(x, LINE_Y, 4, 1);
  for (let x = FIELD.x0 + 4; x < FIELD.x1 - 4; x += 6) if (hash(x, 1, 7) % 3) g.fillRect(x + 1, LINE_Y + 1, 2, 1);
  drawText(g, 'LINYA', FIELD.x0 + 6, LINE_Y + 4, 'rgba(246,241,231,0.7)');
  g.globalAlpha = 0.5; g.fillStyle = C.white;
  for (const [x, y, w, h] of [[184, 312, 12, 10], [184, 322, 12, 10], [178, 332, 12, 9], [190, 332, 12, 9]]) { g.fillRect(x, y, w, 1); g.fillRect(x, y + h, w, 1); g.fillRect(x, y, 1, h); g.fillRect(x + w, y, 1, h + 1); }
  g.globalAlpha = 1;
  return cv;
}

// a little label over someone's head
function tag(g, text, x, y, bg, fg = C.white) {
  const w = text.length * 4 + 3;
  r(g, C.ink, Math.round(x - w / 2) - 1, y - 1, w + 2, 9); r(g, bg, Math.round(x - w / 2), y, w, 7);
  drawText(g, text, Math.round(x - w / 2) + 2, y + 1, fg);
}

export class PresoScene extends ModeScene {
  constructor(level, input, loadout = {}, opts = {}) {
    super(level, input, opts);
    this.look = opts.outfit && opts.outfit !== 'basic' ? `jun~${opts.outfit}` : 'jun';
    this.sim = new Preso(level, { lives: loadout.lives ?? 3, look: this.look });
    this.bg = buildStreet();
    this.dust = [];
    this.cheerT = 0;
    this.bingSay = null;
    this.nenaSay = null;
  }

  music() { return this.sim.kids.some((k) => k.role === 'taya' && k.state === 'chase' && k.target === this.sim.jun) ? 'chase' : 'laro'; }

  update(dt) {
    const s = this.sim, inp = this.input;
    inp.button2Enabled = false; inp.abilityEnabled = false; inp.itemEnabled = false; inp.swapEnabled = false;
    s.update(dt, inp.poll());
    for (const e of s.events) this.onEvent(e);
    s.events.length = 0;
    this.updateShared(dt);
    for (const k of s.kids) if (k.moving && Math.random() < dt * 10) this.dust.push({ x: k.x + Math.random() * 6 - 3, y: k.y + 4, l: 0.4 });
    for (const d of this.dust) { d.y -= 5 * dt; d.l -= dt; }
    this.dust = this.dust.filter((d) => d.l > 0);
    if (this.bingSay && (this.bingSay.t -= dt) <= 0) this.bingSay = null;
    if (this.nenaSay && (this.nenaSay.t -= dt) <= 0) this.nenaSay = null;
    // teach as it comes up
    const j = s.jun;
    if (s.status === 'play' && !s.introT && !s.beat) {
      if (s.inField(j) && s.can.state === 'up' && s.slips.some((x) => x.owner === j && x.state === 'ground')) this.showTip('preso-safe', 'STAND ON YOUR OWN TSINELAS: THE TAYA CANNOT TAG YOU');
      if (s.inField(j) && j.slippers > 0) this.showTip('preso-back', 'GOT IT! NOW BACK BEHIND THE LINE');
    }
  }

  onEvent(e) {
    const s = this.sim;
    if (this.sharedEvent(e)) return;
    switch (e.type) {
      case 'go': sfx.whistle(); this.pop('LARO!', C.green, 160, 0.9, 5); this.showTip('preso-aim', this.touch ? 'HOLD BATO TO AIM. LET GO WHEN THE X IS ON THE CAN' : 'HOLD E TO AIM. LET GO WHEN THE X IS ON THE CAN'); break;
      case 'throw': sfx.whoosh(); break;
      case 'land': sfx.thud(); this.burst(e.x, e.y, 4, ['#d8d4dc', C.white], { speed: 20, up: 10, g: 40, l: 0.4, s: 1 }); break;
      case 'tumba':
        sfx.clank(); this.kick(e.who === s.jun ? 4 : 2); this.buzz(e.who === s.jun ? [30, 20, 50] : 20);
        this.burst(e.x, e.y - 4, e.who === s.jun ? 18 : 8, [C.gold, C.white, C.orange], { speed: 90, up: 50, g: 180 });
        if (e.who === s.jun) { this.pop(e.score >= WIN ? 'PANALO!' : 'TUMBA!', C.gold, 150, 1.1, 5); sfx.cheer(); this.bingSay = { text: e.score >= WIN ? 'ANG GALING, KUYA!' : 'GALING, KUYA!', t: 1.6 }; }
        else this.pop('TUMBA!', C.white, 150, 0.7, 3);
        this.showTip('preso-run', 'TUMBA! GRAB YOUR TSINELAS AND GET BACK BEHIND THE LINE');
        break;
      case 'clank': sfx.clasp(); break;
      case 'setup': sfx.click(); break;
      case 'pickup': if (e.who === s.jun) sfx.pickup(); break;
      case 'safe': sfx.hide(); break;
      case 'chase': if (e.at === s.jun) { sfx.alert(); this.kick(1); this.showTip('preso-chase', 'THE TAYA TAGS ONLY WHILE THE CAN IS STANDING'); } break;
      case 'tag':
        if (e.who === s.jun) { sfx.muntik(); this.buzz([60, 30, 60]); this.kick(4); this.flash = 0.5; this.flashCol = C.orange; this.pop('TAYA KA!', C.orange, 150, 1.5, 5); this.bingSay = { text: 'AY! ULIT, KUYA!', t: 1.6 }; }
        else { sfx.ouch(); this.pop(`TAYA SI ${e.who.name}!`, C.white, 150, 1.3, 3); }
        break;
      case 'swap': this.nenaSay = { text: `IKAW NA, ${e.who.name}!`, t: 1.6 }; break;
      case 'reset': sfx.click(); break;
      case 'tapTooShort': this.say(this.touch ? 'HOLD BATO, THEN LET GO' : 'HOLD E, THEN LET GO', C.yellow, 1.6); break;
    }
  }

  // ---- drawing
  draw(g) {
    const s = this.sim;
    this.frameDt();
    const [ox, oy] = this.shakeOffset(), now = performance.now() / 1000;
    g.save(); g.translate(ox, oy);
    g.drawImage(this.bg, 0, 0);
    this.drawBanderitas(g, now);
    for (const d of this.dust) { g.globalAlpha = Math.min(1, d.l * 2.5); r(g, '#e6e2ea', Math.round(d.x), Math.round(d.y), 2, 2); }
    g.globalAlpha = 1;
    // things on the ground, then people, sorted by y
    const list = [];
    for (const sl of s.slips) if (sl.state !== 'fly') list.push({ y: sl.y - 3, draw: () => this.drawSlip(g, sl, 0) });
    if (s.can.state !== 'fly' && s.can.state !== 'carried') list.push({ y: s.can.y, draw: () => this.drawCan(g) });
    for (const k of s.kids) list.push({ y: k.y, draw: () => this.drawKid(g, k, now) });
    list.push({ y: 74, draw: () => this.drawBing(g, now) });
    list.push({ y: 40, draw: () => { g.save(); g.beginPath(); g.rect(60, 27, 120, 17); g.clip(); drawActor(g, 'nena', 120, 56, 0, Math.floor(now * 1.2) % 5 === 0 ? 'alert' : 0); g.restore(); } }); // in her store window
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.draw();
    if (s.can.state === 'fly' || s.can.state === 'carried') this.drawCan(g);
    for (const sl of s.slips) if (sl.state === 'fly') this.drawSlip(g, sl, now);
    if (s.aim) this.drawAim(g, now);
    this.drawParts(g);
    for (const k of s.kids) if (k.say) bubble(g, k.say.text, k.x, Math.round(k.y) - (k.role === 'taya' ? 44 : 38), C.ink, k.role === 'taya' && k.state === 'chase' ? C.orange : C.white);
    if (this.bingSay) bubble(g, this.bingSay.text, 40, 44);
    if (this.nenaSay) bubble(g, this.nenaSay.text, 120, 6);
    g.restore();
    if (this.flash > 0) { g.globalAlpha = this.flash * 0.5; r(g, this.flashCol, 0, 0, VIEW_W, MAP_H); g.globalAlpha = 1; }
    this.drawHud(g, now);
  }

  drawBanderitas(g, t) {
    const cols = [C.red, C.gold, '#4f8fff', C.green, C.pink];
    for (let x = 0; x < VIEW_W; x += 6) {
      const y = 54 + Math.round(Math.sin((x / VIEW_W) * Math.PI) * 6 + Math.sin(t * 2 + x * 0.05));
      r(g, '#6a6488', x, y, 6, 1);
      const c = cols[(x / 6) % cols.length]; r(g, c, x + 1, y + 1, 4, 2); r(g, c, x + 2, y + 3, 2, 1);
    }
  }

  drawSlip(g, sl, now) {
    const col = SLIP_COL[sl.owner.id] || 'blue';
    if (sl.state === 'fly') {
      const k = Math.max(0.4, 1 - sl.z / 60); // the shadow shrinks as it rises
      g.globalAlpha = 0.3; r(g, C.ink, Math.round(sl.x - 3 * k), Math.round(sl.y), Math.max(2, Math.round(6 * k)), 2); g.globalAlpha = 1;
      const spr = objSprite('tsinela', col), q = Math.floor(now * 16) % 4;
      g.save(); g.translate(Math.round(sl.x), Math.round(sl.y - sl.z)); g.rotate(q * Math.PI / 2);
      g.drawImage(spr, -Math.floor(spr.width / 2), -Math.floor(spr.height / 2)); g.restore();
      return;
    }
    drawObj(g, 'tsinela', sl.x, sl.y, col);
  }

  drawCan(g) {
    const c = this.sim.can;
    if (c.state === 'carried') { const t = this.sim.taya; drawObj(g, 'lata', t.x + 6, t.y - 12); return; }
    g.globalAlpha = 0.3; r(g, C.ink, Math.round(c.x) - 4, Math.round(c.y) + 3, 9, 2); g.globalAlpha = 1;
    if (c.state === 'up') {
      const aimed = this.sim.aim && this.hitPreview();
      if (aimed) { g.globalAlpha = 0.5; disc(g, c.x, c.y, 8, C.green); g.globalAlpha = 1; }
      drawObj(g, 'lata', c.x, c.y - 2);
    } else if (c.state === 'down') drawObj(g, 'lataDown', c.x, c.y + 1);
    else {
      const spr = objSprite('lata'), q = Math.floor(c.spin) % 4;
      g.save(); g.translate(Math.round(c.x), Math.round(c.y - 2 - c.z)); g.rotate(q * Math.PI / 2); g.drawImage(spr, -2, -3); g.restore();
    }
  }

  drawKid(g, k, now) {
    const s = this.sim, isJun = k === s.jun;
    // a soft ring under your own kid, green while you stand on your slipper (safe), red while the taya is on you
    if (isJun && s.status === 'play') {
      const safe = s.inField(k) && s.onSlipper(k), hunted = s.taya?.state === 'chase' && s.taya.target === k;
      const col = safe ? C.green : hunted ? C.red : C.gold;
      g.globalAlpha = safe || hunted ? 0.9 : 0.45;
      for (let a = 0; a < 16; a++) { const an = (a / 16) * Math.PI * 2 + now * (hunted ? 4 : 1); r(g, col, Math.round(k.x + Math.cos(an) * 7), Math.round(k.y + 4 + Math.sin(an) * 3), 1, 1); }
      g.globalAlpha = 1;
    }
    const frame = k.pose || (k.moving ? Math.floor(k.stepT * 8) % 4 : 0);
    const top = drawActor(g, k.look, k.x, k.y, k.dir, s.beat?.who === k ? 'caught' : frame);
    if (k.role === 'taya') tag(g, 'TAYA', k.x, top - 10, k.state === 'chase' ? C.red : '#a83a3a');
    else if (isJun && s.introT > 0) tag(g, 'IKAW', k.x, top - 10, C.gold2, C.ink);
    if (k.role !== 'taya' && k.slippers > 0 && !isJun) for (let i = 0; i < k.slippers; i++) drawObj(g, 'tsinela', k.x - 3 + i * 6, k.y + 9, SLIP_COL[k.id]);
    if (isJun && s.inField(k) && s.onSlipper(k)) tag(g, 'SAFE', k.x, top - 10, '#227a43');
  }

  drawBing(g, now) {
    const s = this.sim, cheer = this.bingSay || (s.beat?.kind === 'win');
    const hop = cheer ? Math.round(Math.abs(Math.sin(now * 12)) * 2) : 0;
    drawActor(g, 'bing', 40, 72 - hop, 0, cheer ? 'cast' : 0);
  }

  // where the slipper would come down now: is that a TUMBA?
  hitPreview() {
    const s = this.sim, p = s.aimPoint();
    const ux = Math.cos(s.aim.a), uy = Math.sin(s.aim.a);
    for (let d = -10; d <= 14; d += 2) if (Math.hypot(p.x + ux * d - s.can.x, p.y + uy * d - s.can.y) < HIT_R) return true;
    return false;
  }

  drawAim(g, now) {
    const s = this.sim, k = s.jun, a = s.aim, p = s.aimPoint();
    const ok = this.hitPreview(), col = ok ? C.green : C.white;
    // the full reach, faint
    g.globalAlpha = 0.35; g.fillStyle = C.white;
    for (let d = 14; d < MAX_D; d += 7) g.fillRect(Math.round(k.x + Math.cos(a.a) * d), Math.round(k.y - 6 + Math.sin(a.a) * d), 1, 1);
    g.globalAlpha = 1;
    // the arc the slipper will fly
    const h = 12 + p.d * 0.09;
    g.fillStyle = col;
    for (let u = 0.08; u < 0.97; u += 0.08) {
      const x = k.x + (p.x - k.x) * u, y = k.y - 6 + (p.y - k.y + 6) * u, z = 8 * (1 - u) + 4 * h * u * (1 - u);
      g.fillRect(Math.round(x), Math.round(y - z), 2, 2);
    }
    // the landing mark
    const x = Math.round(p.x), y = Math.round(p.y);
    r(g, C.ink, x - 4, y - 4, 9, 9);
    g.fillStyle = col; for (let i = -3; i <= 3; i++) { g.fillRect(x + i, y + i, 1, 1); g.fillRect(x + i, y - i, 1, 1); }
    if (ok) ring(g, x, y, 6 + (Math.floor(now * 8) % 2), C.green, 1);
    // the power: a small bar by your feet that fills as the mark goes out
    const pw = tri(a.t / POWER_PERIOD);
    r(g, C.ink, Math.round(k.x) + 9, Math.round(k.y) - 18, 4, 18);
    r(g, ok ? C.green : C.gold, Math.round(k.x) + 10, Math.round(k.y) - 1 - Math.round(16 * pw), 2, Math.round(16 * pw));
  }

  drawHud(g, now) {
    const s = this.sim, j = s.jun;
    g.globalAlpha = 0.78; r(g, C.ink, 0, 0, VIEW_W, 13); g.globalAlpha = 1;
    drawText(g, 'TUMBA', 4, 4, C.white, { shadow: C.ink });
    for (let i = 0; i < WIN; i++) { // a can per TUMBA you need
      const on = i < j.score;
      g.globalAlpha = on ? 1 : 0.35; drawObj(g, 'lata', 30 + i * 8, 6); g.globalAlpha = 1;
      if (on && Math.floor(now * 3) % 3 === i) r(g, C.white, 31 + i * 8, 3, 1, 1);
    }
    drawText(g, this.level.name, VIEW_W / 2 + 4, 4, C.gold, { align: 'center', shadow: C.ink });
    for (let i = 0; i < s.lives; i++) { // chances: little tsinelas, crossed out once used
      const x = VIEW_W - 6 - (s.lives - i) * 8, used = i >= s.livesLeft;
      r(g, C.ink, x, 3, 7, 6); r(g, used ? C.dgray : C.pink, x + 1, 4, 2, 4); r(g, used ? C.dgray : C.pink, x + 4, 4, 2, 4);
      if (used) r(g, C.red, x, 6, 7, 1);
    }
    this.drawTopTip(g, 246); // (in the empty middle of the street: the store, Bing and the taya stay in view)
    this.drawToast(g, 196);
    this.drawCard(g, 176);
    if (s.introT > 0) {
      g.globalAlpha = 0.78; r(g, C.ink, 0, 128, VIEW_W, 58); g.globalAlpha = 1;
      drawText(g, 'TUMBANG PRESO', VIEW_W / 2, 134, C.gold, { scale: 3, align: 'center', shadow: C.gold2 });
      drawText(g, `KNOCK THE CAN DOWN ${WIN} TIMES`, VIEW_W / 2, 158, C.white, { align: 'center' });
      drawText(g, s.introT > 1 ? 'HANDA...' : 'HANDA NA!', VIEW_W / 2, 172, C.yellow, { scale: 2, align: 'center', shadow: C.ink });
    }
    this.drawBig(g);
    // control strip
    const ctx = s.context(), aiming = !!s.aim;
    const line = aiming ? 'LET GO ON THE CAN!' : ctx?.kind === 'pulot' ? 'PULOT: PICK IT UP' : ctx?.label === 'BALIK!' ? 'BACK BEHIND THE LINE!' : ctx?.kind === 'aim' ? 'HOLD BATO TO AIM' : j.slippers === 0 ? 'GET YOUR TSINELAS' : s.can.state !== 'up' ? 'TAYA IS FIXING THE CAN' : '';
    this.drawStrip(g, line, aiming ? C.green : ctx?.kind ? C.gold : C.gray, s.time < 14 ? (this.touch ? 'DRAG: MOVE   HOLD BATO: AIM' : 'WASD MOVE  HOLD E AIM  A/D TURN') : null);
    drawText(g, 'IN HAND', 150, MAP_H + 8, C.dgray);
    for (let i = 0; i < 2; i++) { g.globalAlpha = i < j.slippers ? 1 : 0.25; drawObj(g, 'tsinela', 156 + i * 9, MAP_H + 21, 'blue'); g.globalAlpha = 1; }
    const label = aiming ? 'BATO!' : ctx?.kind ? ctx.label : ctx?.label || 'BATO';
    this.drawRoundButton(g, BUTTON, label.slice(0, 6), { on: !!ctx?.kind || aiming, down: this.input.action(), icon: (gg, x, y) => drawObj(gg, ctx?.kind === 'pulot' ? 'hand' : 'tsinela', x, y, 'blue'), hint: ctx?.kind === 'aim' && j.throws === 0 && !aiming });
    const st = this.input.stick();
    if (st) { g.globalAlpha = 0.35; disc(g, st.sx, st.sy, 22, C.white); g.globalAlpha = 0.7; disc(g, st.x, st.y, 8, C.white); g.globalAlpha = 1; }
  }

  // the caught screen: tagged out
  drawFail(g) {
    drawText(g, 'TAYA KA!', VIEW_W / 2, 70, C.orange, { scale: 5, align: 'center', shadow: C.ink });
    drawActor(g, 'buboy', VIEW_W / 2 - 20, 140, 0, 'alert');
    drawActor(g, this.look, VIEW_W / 2 + 20, 140, 0, 'caught');
    drawText(g, 'BUBOY: "IKAW NA ANG TAYA!"', VIEW_W / 2, 152, C.white, { align: 'center' });
    drawText(g, `TUMBA ${this.sim.jun.score}/${WIN}   TIME ${Math.floor(this.sim.time)}S`, VIEW_W / 2, 166, C.gray, { align: 'center' });
  }
}
