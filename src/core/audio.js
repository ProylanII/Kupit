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
  click: () => beep(180, 0.05, { vol: 0.05 }),
  creak: () => beep(140, 0.25, { slide: 60, type: 'sawtooth', vol: 0.04 }),
  ouch: () => { beep(700, 0.08, { type: 'sawtooth' }); beep(500, 0.15, { at: 0.08, type: 'sawtooth' }); },
  pickup: () => { beep(520, 0.06); beep(780, 0.08, { at: 0.06 }); },
  whoosh: () => beep(900, 0.12, { slide: -600, type: 'triangle', vol: 0.05 }),
  thud: () => beep(90, 0.12, { type: 'triangle', vol: 0.12 }),
  hide: () => beep(300, 0.08, { slide: -120, type: 'triangle', vol: 0.06 }),
  music: () => [392, 494, 587, 494].forEach((f, i) => beep(f, 0.12, { at: i * 0.13, type: 'triangle' })),
  skill: () => { beep(440, 0.1, { slide: 440, type: 'triangle', vol: 0.07 }); beep(880, 0.12, { at: 0.08, type: 'triangle', vol: 0.05 }); },
  buy: () => { beep(660, 0.07); beep(990, 0.07, { at: 0.07 }); beep(1320, 0.14, { at: 0.14 }); },
  unlock: () => ac(),
};

export const isMuted = () => muted;
export const setMuted = (v) => { muted = !!v; };
export const toggleMute = () => (muted = !muted);
