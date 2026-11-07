// Tiny square-wave chiptune sfx via WebAudio. Created lazily on first gesture.
let ctx = null;
let muted = false;

function ac() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function beep(freq, dur, { type = 'square', vol = 0.06, at = 0, slide = 0 } = {}) {
  const a = ac();
  if (!a || muted) return;
  const t = a.currentTime + at;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

export const sfx = {
  steal: () => beep(660, 0.05, { vol: 0.03 }),
  coin: () => { beep(880, 0.08); beep(1320, 0.12, { at: 0.07 }); },
  alert: () => beep(300, 0.2, { slide: 300, type: 'sawtooth', vol: 0.05 }),
  caught: () => { beep(400, 0.15, { type: 'sawtooth' }); beep(250, 0.3, { at: 0.15, type: 'sawtooth' }); },
  clear: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.14, { at: i * 0.1 })),
  unlock: () => ac(),
};

export const toggleMute = () => (muted = !muted);
