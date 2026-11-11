// Keyboard + touch/mouse. Pointer positions are converted to game pixels.
export const VIEW_W = 240;
export const MAP_H = 352;  // 22 tiles; below it is the control strip
export const VIEW_H = 392;
// On-screen buttons. Right-handed positions; setLeftHanded() mirrors them (the objects are mutated in place,
// so every module that imported them sees the new layout).
export const BUTTON = { x: 214, y: 372, r: 18 };  // action
export const BUTTON2 = { x: 176, y: 372, r: 14 }; // throw item (hold to aim, release to throw)
export const ABILITY_BTN = { x: 100, y: 372, r: 11 }; // character skill
export const PAUSE_BTN = { x: 138, y: 372, r: 10 }; // pause
export const ITEM_BTN = { x: 156, y: 357, r: 8 };  // cycle which item you throw next
const RIGHT = { BUTTON: 214, BUTTON2: 176, ABILITY_BTN: 100, PAUSE_BTN: 138, ITEM_BTN: 156 };
export const layout = { left: false };
export function setLeftHanded(on) {
  layout.left = !!on;
  const m = (x) => (on ? VIEW_W - x : x);
  BUTTON.x = m(RIGHT.BUTTON); BUTTON2.x = m(RIGHT.BUTTON2); ABILITY_BTN.x = m(RIGHT.ABILITY_BTN);
  PAUSE_BTN.x = m(RIGHT.PAUSE_BTN); ITEM_BTN.x = m(RIGHT.ITEM_BTN);
}
const STICK_R = 22;

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
    this.prevT = false;
    this.touchUsed = false;
    this.hits = new Set();  // keys pressed this frame (no auto-repeat)
    this.hitsUsed = false;  // the world already consumed this frame's key presses (fixed-step substeps)
    this.tapPos = null;     // pointer-down position this frame, game pixels
    this.pauseTap = false;

    addEventListener('keydown', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!e.repeat) this.hits.add(k);
      if (!this.keys.has(k) && (k === 'Enter' || k === ' ' || k === 'e')) this.tapped = true;
      this.keys.add(k);
      if (k.startsWith('Arrow') || k === ' ' || k === 'Tab') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
    addEventListener('blur', () => { this.keys.clear(); this.pointers.clear(); });

    canvas.addEventListener('pointerdown', (e) => {
      const p = this.pos(e);
      if (e.pointerType !== 'mouse') this.touchUsed = true;
      this.tapped = true;
      this.tapPos = p;
      const near = (b, pad) => Math.hypot(p.x - b.x, p.y - b.y) <= b.r + pad;
      if (this.buttonEnabled && near(PAUSE_BTN, 6)) { this.pauseTap = true; return; }
      if (this.buttonEnabled && this.itemEnabled && near(ITEM_BTN, 5)) { this.cycleTap = true; return; }
      const onBtn = this.buttonEnabled && near(BUTTON, 6);
      const onBtn2 = !onBtn && this.button2Enabled && near(BUTTON2, 5);
      const onBtn3 = !onBtn && !onBtn2 && this.abilityEnabled && near(ABILITY_BTN, 5);
      if (onBtn3) this.abilityTap = true;
      const role = onBtn ? 'btn' : onBtn2 ? 'btn2' : onBtn3 ? 'btn3' : 'stick';
      this.pointers.set(e.pointerId, { role, sx: p.x, sy: p.y, x: p.x, y: p.y });
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });
    canvas.addEventListener('pointermove', (e) => {
      const q = this.pointers.get(e.pointerId);
      if (q) { const p = this.pos(e); q.x = p.x; q.y = p.y; }
    });
    const up = (e) => this.pointers.delete(e.pointerId);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
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

  throwHeld() {
    if (this.keys.has('q') || this.keys.has('k')) return true;
    for (const q of this.pointers.values()) if (q.role === 'btn2') return true;
    return false;
  }

  abilityHeld() {
    if (this.keys.has('f') || this.keys.has('x')) return true;
    for (const q of this.pointers.values()) if (q.role === 'btn3') return true;
    return false;
  }

  // One snapshot per simulation step with press edges, for the game world.
  // Throwing: holding the button aims (shows where it lands), letting go throws.
  // Several steps can run in one frame (fixed timestep): key presses only count on the first.
  poll() {
    const a = this.action(), t = this.throwHeld(), b = this.abilityHeld();
    const hits = this.hitsUsed ? new Set() : this.hits;
    const r = {
      mv: this.move(), action: a, actionPressed: a && !this.prevA,
      throwAim: t, throwPressed: !t && this.prevT,
      cyclePressed: this.cycleTap || hits.has('r') || hits.has('Tab'),
      abilityPressed: (b && !this.prevAb) || this.abilityTap || hits.has('f') || hits.has('x'),
    };
    this.abilityTap = false; this.cycleTap = false;
    this.hitsUsed = true;
    this.prevA = a; this.prevT = t; this.prevAb = b;
    return r;
  }

  pressed(k) { return this.hits.has(k); }
  // Drop held pointers/keys so a menu tap doesn't turn into a stick drag when play starts.
  reset() { this.pointers.clear(); this.keys.clear(); this.prevA = this.prevT = this.prevAb = false; this.cycleTap = this.abilityTap = false; }
  consumeTap() { const t = this.tapped; this.tapped = false; return t; }
  endFrame() { this.tapped = false; this.hits.clear(); this.hitsUsed = false; this.tapPos = null; this.pauseTap = false; }
}
