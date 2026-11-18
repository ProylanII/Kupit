// HABOL! (mini-game MG-7): Tigre has slipped out through the fence after a butiki, and Jun runs after him down the
// eskinita. A side view: Jun runs by himself; you jump (TALON) and slide (DAUSDOS). DOM-free (tests/minigames.test.mjs).
//
// Units: px. x runs along the street, y is up from the street (feet at 0, negative = in the air).
// - Jump: a tap is a hop, holding goes higher (the jump is cut when you let go). Coyote time and a jump buffer make
//   it forgiving: a press just before you land, or just after you run off an edge, still jumps.
// - Slide: ducks under washing lines and wires. Pressed in the air it dives, and you land sliding.
// - Crates, benches and a parked tricycle can be stood on. Buckets, pots, a chicken and a sleeping dog trip you up;
//   an open kanal drops you in. A puddle only slows you (and splashes).
// - Every stumble lets Tigre get further ahead; running clean closes the gap again. If he gets too far, he is gone.
// - Coins on the way are real coins (the sukli somebody dropped).
import { MiniSim } from './minigame.js';

export const G_UP = 960, G_DOWN = 1380, JUMP_V = 318, CUT_V = 125, COYOTE = 0.09, BUFFER = 0.14;
export const SLIDE_T = 0.5, SLIDE_MAX = 1.0, DIVE_V = 440;
export const STAND_H = 18, SLIDE_H = 8, HALF_W = 4;
export const SPEED0 = 96, SPEED1 = 122, ACCEL = 120, STUN_SPEED = 34, STUN_T = 0.45, INV_T = 1.3;
export const GAP0 = 96, GAP_HIT = 42, GAP_MIN = 66, GAP_MAX = 222, GAP_HEAL = 6;
export const SCOOP_T = 2.8; // the end: Jun scoops Tigre up and hugs him (the scene plays the hug and the cut-ins)
const FALL_DEPTH = 18;

// what each kind of thing on the street is: w/h = body (h above the street); top = can be stood on;
// hang = hangs over the street (low = the gap under it); gap = a hole; soft = only slows you
export const KINDS = {
  balde:    { w: 10, h: 12 },
  paso:     { w: 12, h: 14 },
  manok:    { w: 11, h: 11, move: true },
  aso:      { w: 22, h: 9 },
  kahon:    { w: 16, h: 16, top: true },
  bangko:   { w: 36, h: 10, top: true },
  kariton:  { w: 30, h: 20, top: true },
  trike:    { w: 46, h: 24, top: true },
  sampayan: { w: 40, hang: true, low: 11 },
  kable:    { w: 28, hang: true, low: 11 },
  kanal:    { w: 30, gap: true },
  lusak:    { w: 26, soft: true },
};

// Height of the feet dx px after taking off on a full jump at that speed (coins are laid along it: they teach the jump).
export function jumpY(dx, speed) {
  const t = Math.max(0, dx) / speed, up = JUMP_V / G_UP, peak = (JUMP_V * JUMP_V) / (2 * G_UP);
  if (t < up) return -JUMP_V * t + (G_UP * t * t) / 2;
  const tf = t - up;
  return Math.min(0, -peak + (G_DOWN * tf * tf) / 2);
}

export class Runner extends MiniSim {
  constructor(level, opts = {}) {
    super(level, opts);
    this.end = level.end ?? 3400;
    this.obs = [];
    this.coinList = [];
    this.tips = [];
    for (const it of level.course || []) {
      if (it.t === 'coins') {
        const n = it.n ?? 1, gap = it.gap ?? 14, y0 = it.y ?? -8;
        for (let i = 0; i < n; i++) {
          const u = n > 1 ? i / (n - 1) : 0.5, arc = it.arc ? -Math.sin(u * Math.PI) * it.arc : 0, x = it.x + i * gap;
          const sp = SPEED0 + (SPEED1 - SPEED0) * Math.min(1, x / this.end); // (jumpFrom: on the path of a full jump from there, chest high)
          this.coinList.push({ x, y: it.jumpFrom !== undefined ? Math.min(-6, jumpY(x - it.jumpFrom, sp) - 9) : y0 + arc, got: false });
        }
      } else if (it.t === 'tip') this.tips.push({ x: it.x, id: it.id, text: it.text, icon: it.icon, shown: false });
      else {
        const k = KINDS[it.t];
        if (!k) continue;
        const stack = it.stack ?? 1;
        this.obs.push({ kind: it.t, x: it.x, w: it.w ?? k.w, h: (it.h ?? k.h ?? 0) * stack, stack, top: !!k.top, hang: !!k.hang, low: it.low ?? k.low ?? 0,
          gap: !!k.gap, soft: !!k.soft, move: !!k.move, range: it.range ?? 14, x0: it.x, hit: false, t: 0 });
      }
    }
    this.obs.sort((a, b) => a.x - b.x);
    this.coinsTotal = this.coinList.length;
    this.coinsGot = 0;
    this.stumbles = 0;
    // Jun
    this.x = level.startX ?? 40; this.y = 0; this.vy = 0;
    this.speed = 0; this.onGround = true; this.coyoteT = 0; this.bufferT = 0;
    this.slideT = 0; this.slideAll = 0; this.diveQueued = false;
    this.stunT = 0; this.invT = 0; this.slowT = 0; this.fallT = 0; this.fell = null;
    this.landT = 0; this.jumpT = 0; this.dist = 0;
    this.standOn = null;
    this.gap = GAP0;
    this.introT = level.intro === false ? 0 : 2.2;
    this.beat = null; // { kind: 'gone' | 'scoop', t }
  }

  get player() { return { tx: Math.floor(this.x / 16), ty: 0 }; }
  get sliding() { return this.slideT > 0; }
  get scoreText() { return `COINS ${this.coinsGot}/${this.coinsTotal}`; }
  get height() { return this.sliding ? SLIDE_H : STAND_H; }
  get progress() { return Math.max(0, Math.min(1, this.x / this.end)); }
  get tigreX() { return Math.min(this.x + this.gap, this.end); }
  obsX(o) { return o.move ? o.x0 + Math.sin(this.time * 2.2 + o.x0) * o.range : o.x; }

  // the street (or a crate top) right under the feet: its y, or null over a hole / off an edge
  supportAt(x, y) {
    for (const o of this.obs) {
      const ox = this.obsX(o);
      if (o.top && x > ox - 2 && x < ox + o.w + 2 && Math.abs(y + o.h) < 0.6) return o;
    }
    if (Math.abs(y) < 0.6 && !this.gapAt(x)) return 'street';
    return null;
  }
  gapAt(x) { return this.obs.find((o) => o.gap && x > o.x + 3 && x < o.x + o.w - 3) || null; }

  stumble(o, why = 'trip') {
    if (this.invT > 0 || this.god) return;
    this.stumbles++;
    this.invT = INV_T; this.stunT = STUN_T; this.speed = Math.min(this.speed, STUN_SPEED);
    this.slideT = 0;
    this.gap += GAP_HIT;
    if (o && o !== 'street') o.hit = true;
    this.emit({ type: 'stumble', kind: o?.kind || why, x: this.x, y: this.y });
    this.checkMissions();
  }

  update(dt, inp = {}) {
    if (this.status !== 'play') return;
    this.time += dt;
    if (this.introT > 0) { if ((this.introT -= dt) <= 0) this.emit({ type: 'go' }); return; }
    if (this.beat) {
      if ((this.beat.t -= dt) <= 0) { const b = this.beat; this.beat = null; if (b.kind === 'scoop') this.finish(); else this.fail('gone'); }
      return;
    }
    this.invT = Math.max(0, this.invT - dt); this.stunT = Math.max(0, this.stunT - dt); this.slowT = Math.max(0, this.slowT - dt);
    this.landT = Math.max(0, this.landT - dt); this.jumpT = Math.max(0, this.jumpT - dt);
    // pace
    const want = (SPEED0 + (SPEED1 - SPEED0) * this.progress) * (this.slowT > 0 ? 0.72 : 1);
    if (this.stunT > 0) this.speed = Math.min(this.speed, STUN_SPEED);
    else this.speed = this.speed < want ? Math.min(want, this.speed + ACCEL * dt) : Math.max(want, this.speed - ACCEL * 2 * dt);
    // falling into the kanal: climb out on the far side
    if (this.fell) {
      this.fallT -= dt;
      this.y = Math.min(FALL_DEPTH, this.y + 120 * dt);
      if (this.fallT <= 0) { this.x = this.fell.x + this.fell.w + 4; this.y = 0; this.vy = 0; this.onGround = true; this.fell = null; this.emit({ type: 'climb', x: this.x }); }
      return;
    }
    const jumpHeld = !!inp.jump, slideHeld = !!inp.slide;
    if (inp.jumpPressed) this.bufferT = BUFFER; else this.bufferT = Math.max(0, this.bufferT - dt);
    const prevY = this.y;
    this.x += this.speed * dt;
    this.dist += this.speed * dt;
    // --- on the ground: still standing on something?
    if (this.onGround) {
      const s = this.supportAt(this.x, this.y);
      if (!s) { this.onGround = false; this.coyoteT = COYOTE; this.standOn = null; } else this.standOn = s;
    } else this.coyoteT = Math.max(0, this.coyoteT - dt);
    // --- jump (a jump cancels a slide)
    if (this.bufferT > 0 && (this.onGround || this.coyoteT > 0) && this.stunT <= 0) {
      this.vy = -JUMP_V; this.onGround = false; this.coyoteT = 0; this.bufferT = 0; this.slideT = 0; this.jumpT = 0.12; this.standOn = null;
      this.emit({ type: 'jump', x: this.x, y: this.y });
    }
    // --- slide / dive
    if (inp.slidePressed && this.stunT <= 0) {
      if (this.onGround) { if (this.slideT <= 0) { this.slideT = SLIDE_T; this.slideAll = 0; this.emit({ type: 'slide', x: this.x }); } }
      else { this.vy = Math.max(this.vy, DIVE_V); this.diveQueued = true; this.emit({ type: 'dive' }); }
    }
    if (this.slideT > 0) {
      this.slideAll += dt;
      const low = this.overhead();
      if (slideHeld && this.slideAll < SLIDE_MAX) this.slideT = Math.max(this.slideT, 0.05);
      this.slideT -= dt;
      if (this.slideT <= 0 && low) this.slideT = 0.05; // something low overhead: stay down until clear
      if (!this.onGround) this.slideT = 0;
    }
    // --- in the air
    if (!this.onGround) {
      if (!jumpHeld && this.vy < -CUT_V && this.jumpT <= 0.04) this.vy = -CUT_V; // let go early: a short hop (even a quick tap gets 0.08 s of lift)
      this.vy += (this.vy < 0 ? G_UP : G_DOWN) * dt;
      this.y += this.vy * dt;
      if (this.vy >= 0) { // landing: a crate top passed through this frame, or the street
        let land = null, on = null;
        for (const o of this.obs) {
          if (!o.top) continue;
          const ox = this.obsX(o), top = -o.h;
          if (this.x > ox - HALF_W + 1 && this.x < ox + o.w + HALF_W - 1 && prevY <= top + 0.5 && this.y >= top && (land === null || top < land)) { land = top; on = o; }
        }
        if (land === null && prevY <= 0.5 && this.y >= 0 && !this.gapAt(this.x)) { land = 0; on = 'street'; }
        if (land !== null) {
          const hard = this.vy > 300;
          this.y = land; this.vy = 0; this.onGround = true; this.standOn = on; this.landT = 0.12;
          this.emit({ type: 'land', x: this.x, y: land, hard });
          if (this.diveQueued) { this.diveQueued = false; this.slideT = SLIDE_T; this.slideAll = 0; this.emit({ type: 'slide', x: this.x }); }
        } else if (this.y > 2 && this.gapAt(this.x)) { // into the kanal
          const g = this.gapAt(this.x);
          this.fell = g; this.fallT = 0.7; this.diveQueued = false;
          this.stumble(g, 'kanal');
          this.emit({ type: 'fall', x: this.x });
          return;
        }
      }
    }
    // --- bumping into things
    const H = this.height, top = this.y - H;
    for (const o of this.obs) {
      const ox = this.obsX(o);
      if (ox > this.x + 30) break;
      if (ox + o.w < this.x - 30 || o.gap) continue;
      const over = this.x + HALF_W > ox + 1 && this.x - HALF_W < ox + o.w - 1;
      if (!over) continue;
      if (o.soft) { if (this.onGround && this.y === 0 && !o.splashed) { o.splashed = true; this.slowT = 0.45; this.emit({ type: 'splash', x: this.x }); } continue; }
      if (o.hang) { if (top < -o.low) this.stumble(o, o.kind); continue; }
      if (this.y > -o.h + 1.5 && top < 0 && o !== this.standOn) this.stumble(o, o.kind);
    }
    // --- coins
    for (const c of this.coinList) {
      if (c.got || Math.abs(c.x - this.x) > 10) continue;
      if (c.y > top - 5 && c.y < this.y + 4) { c.got = true; this.coinsGot++; this.coins++; this.emit({ type: 'coin', x: c.x, y: c.y, n: this.coinsGot }); }
    }
    // --- signs ahead (the scene teaches with them)
    for (const t of this.tips) if (!t.shown && t.x - this.x < 150) { t.shown = true; this.emit({ type: 'tip', tip: t }); }
    // --- Tigre: stumbles let him get away, clean running closes the gap
    if (this.stunT <= 0 && !this.fell) this.gap = Math.max(GAP_MIN, this.gap - GAP_HEAL * dt);
    if (this.gap >= GAP_MAX && !this.god) { this.beat = { kind: 'gone', t: 1.3 }; this.emit({ type: 'gone' }); return; }
    if (this.x >= this.end - 16) { this.beat = { kind: 'scoop', t: SCOOP_T }; this.speed = 0; this.emit({ type: 'scoop', x: this.x }); }
    this.checkMissions();
  }

  // a washing line or wire right above a sliding Jun?
  overhead() {
    for (const o of this.obs) if (o.hang && this.x + HALF_W + 6 > o.x && this.x - HALF_W < o.x + o.w) return true;
    return false;
  }

  devClear() { this.coinsGot = this.coinsTotal; this.finish(); }
  devGoToExit() { this.x = this.end - 60; this.y = 0; this.vy = 0; this.onGround = true; this.fell = null; }
}

// What a perfect player would press, looking at the street ahead (tests, the playtest proxy).
export function botInput(r) {
  const ahead = (o) => r.obsX(o) - r.x;
  let jump = false, slide = false;
  for (const o of r.obs) {
    const d = ahead(o);
    if (d + o.w < -HALF_W || d > 60) continue;
    if (o.hang) { if (d < 22 + r.speed * 0.05) slide = true; continue; }
    if (o.soft) continue;
    const lead = o.gap ? 14 : o.top ? 26 : 22;
    if (d > -2 && d < lead + r.speed * 0.06 && r.onGround) { // jump onto (or over) it
      if (!(o.top && r.standOn === o)) jump = true;
    }
  }
  // standing on a crate or a bench: jump on to the next, taller one
  if (r.standOn && r.standOn !== 'street') {
    const next = r.obs.find((o) => o.top && o !== r.standOn && ahead(o) > 0 && ahead(o) < 24);
    if (next && next.h > r.standOn.h) jump = true;
  }
  if (!r.onGround && r.vy < 0) jump = true; // hold it all the way up: full height
  return { jump, slide, jumpPressed: jump && r.onGround, slidePressed: slide };
}
