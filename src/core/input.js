// Keyboard + touch/mouse. Pointer positions are converted to game pixels.
export const VIEW_W = 240;
export const MAP_H = 352;  // 22 tiles; below it is the control strip
export const VIEW_H = 392;
export const BUTTON = { x: 214, y: 372, r: 18 };  // on-screen action button
export const BUTTON2 = { x: 176, y: 372, r: 14 }; // throw item
const STICK_R = 22;

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pointers = new Map(); // id -> {role, sx, sy, x, y}
    this.tapped = false;
    this.buttonEnabled = false;
    this.button2Enabled = false;
    this.prevA = false;
    this.prevT = false;
    this.touchUsed = false;

    addEventListener('keydown', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!this.keys.has(k) && (k === 'Enter' || k === ' ' || k === 'e')) this.tapped = true;
      this.keys.add(k);
      if (k.startsWith('Arrow') || k === ' ') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
    addEventListener('blur', () => { this.keys.clear(); this.pointers.clear(); });

    canvas.addEventListener('pointerdown', (e) => {
      const p = this.pos(e);
      if (e.pointerType !== 'mouse') this.touchUsed = true;
      this.tapped = true;
      const onBtn = this.buttonEnabled && Math.hypot(p.x - BUTTON.x, p.y - BUTTON.y) <= BUTTON.r + 6;
      const onBtn2 = !onBtn && this.button2Enabled && Math.hypot(p.x - BUTTON2.x, p.y - BUTTON2.y) <= BUTTON2.r + 5;
      const role = onBtn ? 'btn' : onBtn2 ? 'btn2' : 'stick';
      this.pointers.set(e.pointerId, { role, sx: p.x, sy: p.y, x: p.x, y: p.y });
      canvas.setPointerCapture(e.pointerId);
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

  // One snapshot per frame with press edges, for the game world.
  poll() {
    const a = this.action(), t = this.throwHeld();
    const r = { mv: this.move(), action: a, actionPressed: a && !this.prevA, throwPressed: t && !this.prevT };
    this.prevA = a; this.prevT = t;
    return r;
  }

  consumeTap() { const t = this.tapped; this.tapped = false; return t; }
  endFrame() { this.tapped = false; }
}
