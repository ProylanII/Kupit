// Keyboard + touch/mouse. Pointer positions are converted to game pixels.
export const VIEW_W = 240;
// The game is designed at 240x392: a 352-px play area (22 tiles) over a 40-px control strip. A tall phone gets EXTRA
// rows (setExtra, from main.js resize) so the game fills the screen: VIEW_H and MAP_H grow with it, and the control
// strip and its buttons stay at the very bottom, under the thumbs. (Live bindings: importers always see the current.)
export const BASE_H = 392, BASE_MAP_H = 352, MAX_EXTRA = 170;
export let VIEW_H = BASE_H;    // the canvas height
export let MAP_H = BASE_MAP_H; // where the control strip starts
export let EXTRA = 0;          // VIEW_H - BASE_H
// On-screen buttons. Right-handed positions; setLeftHanded() mirrors them (the objects are mutated in place,
// so every module that imported them sees the new layout).
export const BUTTON = { x: 214, y: 372, r: 18 };  // action
export const BUTTON2 = { x: 176, y: 372, r: 14 }; // throw item (phone: hold, slide to the spot, let go)
export const ABILITY_BTN = { x: 100, y: 372, r: 11 }; // character skill
export const PAUSE_BTN = { x: 138, y: 372, r: 10 }; // pause
export const ITEM_BTN = { x: 156, y: 357, r: 8 };  // cycle which item you throw next
export const SWAP_BTN = { x: 70, y: 374, r: 10 };   // KASABWAT: switch kids (tag-team levels only)
const RIGHT = { BUTTON: 214, BUTTON2: 176, ABILITY_BTN: 100, PAUSE_BTN: 138, ITEM_BTN: 156, SWAP_BTN: 70 };
const BASE_Y = { BUTTON: 372, BUTTON2: 372, ABILITY_BTN: 372, PAUSE_BTN: 372, ITEM_BTN: 357, SWAP_BTN: 374 };
export function setExtra(n) {
  EXTRA = Math.max(0, Math.min(MAX_EXTRA, Math.round(n) || 0));
  VIEW_H = BASE_H + EXTRA; MAP_H = BASE_MAP_H + EXTRA;
  BUTTON.y = BASE_Y.BUTTON + EXTRA; BUTTON2.y = BASE_Y.BUTTON2 + EXTRA; ABILITY_BTN.y = BASE_Y.ABILITY_BTN + EXTRA;
  PAUSE_BTN.y = BASE_Y.PAUSE_BTN + EXTRA; ITEM_BTN.y = BASE_Y.ITEM_BTN + EXTRA; SWAP_BTN.y = BASE_Y.SWAP_BTN + EXTRA;
}
export const layout = { left: false };
export function setLeftHanded(on) {
  layout.left = !!on;
  const m = (x) => (on ? VIEW_W - x : x);
  BUTTON.x = m(RIGHT.BUTTON); BUTTON2.x = m(RIGHT.BUTTON2); ABILITY_BTN.x = m(RIGHT.ABILITY_BTN);
  PAUSE_BTN.x = m(RIGHT.PAUSE_BTN); ITEM_BTN.x = m(RIGHT.ITEM_BTN); SWAP_BTN.x = m(RIGHT.SWAP_BTN);
}
const STICK_R = 22;
// Throwing. Computer: Q starts aiming and the mouse points; a click (or Q again) throws there, Esc or a right click
// cancels. Holding Q and letting go also throws (straight ahead if the mouse never moved). Phone: hold the throw
// button and slide your finger to the spot; let go to throw. Let go without leaving the button: a quick throw straight
// ahead. Slide back onto the button: cancelled.
export const FINGER_UP = 14;  // the landing mark sits this far above the finger, so the finger doesn't hide it
const HOLD_THROW = 0.3;       // Q held at least this long: letting go throws; a quick tap keeps aiming

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pointers = new Map(); // id -> {role, sx, sy, x, y}
    this.tapped = false;
    this.buttonEnabled = false;
    this.button2Enabled = false;
    this.abilityEnabled = false;
    this.itemEnabled = false;
    this.prevAb = false;
    this.abilityTap = false; // latched so a very short tap still counts
    this.cycleTap = false;
    this.prevA = false;
    this.touchUsed = false;
    this.mouse = null;      // where the mouse is over the canvas (game pixels), for aiming
    this.aimKey = null;     // aiming with Q: { t0, sticky, m0, mouseAim }
    this.throwReq = null;   // a throw for the next step: { at } (at: a screen point, or null = straight ahead)
    this.hits = new Set();  // keys pressed this frame (no auto-repeat)
    this.hitsUsed = false;  // the world already consumed this frame's key presses (fixed-step substeps)
    this.tapPos = null;     // pointer-down position this frame, game pixels
    this.pauseTap = false;

    addEventListener('keydown', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === 'Escape' && this.aimKey) { this.aimKey = null; e.preventDefault(); return; } // Esc cancels the aim (no pause)
      if (!e.repeat && (k === 'q' || k === 'k') && this.buttonEnabled && this.button2Enabled) { // (only while playing)
        if (!this.aimKey) this.aimKey = { t0: performance.now(), sticky: false, m0: this.mouse ? { ...this.mouse } : null, mouseAim: false };
        else if (this.aimKey.sticky) this.fireKeyAim();
      }
      if (!e.repeat) this.hits.add(k);
      if (!this.keys.has(k) && (k === 'Enter' || k === ' ' || k === 'e')) this.tapped = true;
      this.keys.add(k);
      if (k.startsWith('Arrow') || k === ' ' || k === 'Tab') e.preventDefault();
    });
    addEventListener('keyup', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.delete(k);
      if ((k === 'q' || k === 'k') && this.aimKey && !this.aimKey.sticky) {
        if ((performance.now() - this.aimKey.t0) / 1000 >= HOLD_THROW) this.fireKeyAim(); // held: letting go throws
        else this.aimKey.sticky = true; // a tap: keep aiming; the mouse points, a click (or Q again) throws
      }
    });
    addEventListener('blur', () => { this.keys.clear(); this.pointers.clear(); this.aimKey = null; });

    canvas.addEventListener('pointerdown', (e) => {
      const p = this.pos(e);
      if (e.pointerType !== 'mouse') this.touchUsed = true;
      else this.mouse = p;
      this.tapped = true;
      this.tapPos = p;
      const near = (b, pad) => Math.hypot(p.x - b.x, p.y - b.y) <= b.r + pad;
      if (this.buttonEnabled && near(PAUSE_BTN, 6)) { this.pauseTap = true; return; }
      if (this.aimKey && e.pointerType === 'mouse') { // aiming with Q: a click throws right there, a right click cancels
        if (e.button === 2) this.aimKey = null;
        else { this.aimKey.mouseAim = true; this.fireKeyAim(); }
        return;
      }
      if (this.buttonEnabled && this.itemEnabled && near(ITEM_BTN, 5)) { this.cycleTap = true; return; }
      if (this.buttonEnabled && this.swapEnabled && near(SWAP_BTN, 5)) { this.swapTap = true; return; }
      const onBtn = this.buttonEnabled && near(BUTTON, 6);
      const onBtn2 = !onBtn && this.button2Enabled && near(BUTTON2, 5);
      const onBtn3 = !onBtn && !onBtn2 && this.abilityEnabled && near(ABILITY_BTN, 5);
      if (onBtn3) this.abilityTap = true;
      const role = onBtn ? 'btn' : onBtn2 ? 'btn2' : onBtn3 ? 'btn3' : 'stick';
      this.pointers.set(e.pointerId, { role, sx: p.x, sy: p.y, x: p.x, y: p.y, left: false, back: false });
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = this.pos(e);
      if (e.pointerType === 'mouse') {
        this.mouse = p;
        const a = this.aimKey;
        if (a && (!a.m0 || Math.hypot(p.x - a.m0.x, p.y - a.m0.y) > 3)) a.mouseAim = true; // the mouse is doing the aiming now
      }
      const q = this.pointers.get(e.pointerId);
      if (!q) return;
      q.x = p.x; q.y = p.y;
      if (q.role === 'btn2') { // dragging out of the throw button aims; coming back onto it cancels
        const d = Math.hypot(p.x - BUTTON2.x, p.y - BUTTON2.y);
        if (d > BUTTON2.r + 8) q.left = true;
        q.back = q.left && d <= BUTTON2.r + 3;
      }
    });
    canvas.addEventListener('pointerup', (e) => {
      const q = this.pointers.get(e.pointerId);
      if (q?.role === 'btn2' && this.button2Enabled && !q.back) this.throwReq = { at: q.left ? { x: q.x, y: q.y - FINGER_UP } : null };
      this.pointers.delete(e.pointerId);
    });
    canvas.addEventListener('pointercancel', (e) => this.pointers.delete(e.pointerId));
  }

  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * VIEW_W) / r.width, y: ((e.clientY - r.top) * VIEW_H) / r.height };
  }

  stick() {
    for (const q of this.pointers.values()) if (q.role === 'stick') return q;
    return null;
  }

  // -> {x,y,mag,run}; keyboard is full-strength, stick scales with drag distance.
  move() {
    const k = this.keys;
    let x = (k.has('ArrowRight') || k.has('d') ? 1 : 0) - (k.has('ArrowLeft') || k.has('a') ? 1 : 0);
    let y = (k.has('ArrowDown') || k.has('s') ? 1 : 0) - (k.has('ArrowUp') || k.has('w') ? 1 : 0);
    if (x || y) {
      const m = Math.hypot(x, y);
      return { x: x / m, y: y / m, mag: 1, run: k.has('Shift') };
    }
    const s = this.stick();
    if (s) {
      const vx = s.x - s.sx, vy = s.y - s.sy, len = Math.hypot(vx, vy);
      if (len > 4) {
        const mag = Math.min(1, len / STICK_R);
        return { x: vx / len, y: vy / len, mag, run: mag > 0.92 };
      }
    }
    return { x: 0, y: 0, mag: 0, run: false };
  }

  action() {
    if (this.keys.has(' ') || this.keys.has('e') || this.keys.has('j')) return true;
    for (const q of this.pointers.values()) if (q.role === 'btn') return true;
    return false;
  }

  // Aiming right now (Q, or a finger on the throw button that hasn't come back onto it to cancel).
  throwHeld() {
    for (const q of this.pointers.values()) if (q.role === 'btn2') return !q.back;
    return !!this.aimKey;
  }

  // Where the aim points, in screen (game) pixels, or null for straight ahead.
  aimPoint() {
    for (const q of this.pointers.values()) if (q.role === 'btn2') return q.left && !q.back ? { x: q.x, y: q.y - FINGER_UP } : null;
    const a = this.aimKey, m = this.mouse;
    return a && a.mouseAim && m ? { x: m.x, y: m.y } : null;
  }

  fireKeyAim() { this.throwReq = { at: this.aimPoint() }; this.aimKey = null; }

  abilityHeld() {
    if (this.keys.has('f') || this.keys.has('x')) return true;
    for (const q of this.pointers.values()) if (q.role === 'btn3') return true;
    return false;
  }

  // One snapshot per simulation step with press edges, for the game world.
  // Throwing: throwAim while aiming (with aimAt, the screen point it aims at, or null for straight ahead), and
  // throwPressed on the step a throw is let go (aimAt is then where it goes).
  // Several steps can run in one frame (fixed timestep): key presses only count on the first.
  poll() {
    const a = this.action(), t = this.throwHeld(), b = this.abilityHeld();
    const hits = this.hitsUsed ? new Set() : this.hits;
    const req = this.throwReq;
    this.throwReq = null;
    const r = {
      mv: this.move(), action: a, actionPressed: a && !this.prevA,
      throwAim: t, throwPressed: !!req, aimAt: req ? req.at : t ? this.aimPoint() : null,
      cyclePressed: this.cycleTap || hits.has('r') || hits.has('Tab'),
      abilityPressed: (b && !this.prevAb) || this.abilityTap || hits.has('f') || hits.has('x'),
      swapPressed: this.swapTap || hits.has('z'), // KASABWAT: switch kids
    };
    this.abilityTap = false; this.cycleTap = false; this.swapTap = false;
    this.hitsUsed = true;
    this.prevA = a; this.prevAb = b;
    return r;
  }

  pressed(k) { return this.hits.has(k); }
  // Drop held pointers/keys so a menu tap doesn't turn into a stick drag when play starts.
  reset() { this.pointers.clear(); this.keys.clear(); this.prevA = this.prevAb = false; this.cycleTap = this.abilityTap = this.swapTap = false; this.aimKey = null; this.throwReq = null; }
  consumeTap() { const t = this.tapped; this.tapped = false; return t; }
  endFrame() { this.tapped = false; this.hits.clear(); this.hitsUsed = false; this.tapPos = null; this.pauseTap = false; }
}
