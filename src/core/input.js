// Keyboard + touch/mouse. Pointer positions are converted to game pixels.
export const VIEW_W = 240;
export const VIEW_H = 352;
export const BUTTON = { x: 200, y: 318, r: 20 }; // on-screen KUPIT button
const STICK_R = 22;

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pointers = new Map(); // id -> {role, sx, sy, x, y}
    this.tapped = false;
    this.buttonEnabled = false;
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
      this.pointers.set(e.pointerId, { role: onBtn ? 'btn' : 'stick', sx: p.x, sy: p.y, x: p.x, y: p.y });
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

  consumeTap() { const t = this.tapped; this.tapped = false; return t; }
  endFrame() { this.tapped = false; }
}
