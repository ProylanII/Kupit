// Tiny square-wave chiptune sfx via WebAudio. Created lazily on first gesture.
// Music and sound effects have separate volumes (options screen); M mutes both.
let ctx = null;
let muted = false;
let sfxVol = 1;

let away = false; // page hidden: stay suspended until it comes back

function ac() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    // iOS "interrupted" (a call, Siri, another app's audio): try again on the next gesture / when we come back
    try { ctx.onstatechange = () => { if (ctx.state !== 'running' && ctx.state !== 'closed' && !away) resume(); }; } catch { /* ignore */ }
  }
  if (ctx.state !== 'running' && ctx.state !== 'closed' && !away) resume();
  return ctx;
}

function resume() {
  try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch { /* ignore */ }
}

// Pause all sound (music keeps its place) while the page is hidden.
export function suspendAudio(on) {
  away = !!on;
  if (!ctx) return;
  try { if (on) ctx.suspend(); else ctx.resume(); } catch { /* ignore */ }
}

function beep(freq, dur, { type = 'square', vol = 0.06, at = 0, slide = 0 } = {}) {
  const a = ac();
  if (!a || muted || sfxVol <= 0) return;
  const t = a.currentTime + at;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t + dur);
  g.gain.setValueAtTime(vol * sfxVol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

export const sfx = {
  steal: () => beep(660, 0.05, { vol: 0.03 }),
  coin: () => { beep(880, 0.08); beep(1320, 0.12, { at: 0.07 }); },
  alert: () => beep(300, 0.2, { slide: 300, type: 'sawtooth', vol: 0.05 }),
  caught: () => { beep(400, 0.15, { type: 'sawtooth' }); beep(250, 0.3, { at: 0.15, type: 'sawtooth' }); },
  scold: () => { beep(520, 0.1, { type: 'square', vol: 0.05 }); beep(390, 0.1, { at: 0.12, vol: 0.05 }); beep(520, 0.1, { at: 0.24, vol: 0.05 }); beep(260, 0.25, { at: 0.36, type: 'sawtooth', vol: 0.05 }); },
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
  phase: () => [196, 262, 330].forEach((f, i) => beep(f, 0.18, { at: i * 0.12, type: 'sawtooth', vol: 0.06 })),
  // kupit noises: each stash sounds different
  clasp: () => beep(1400, 0.03, { vol: 0.05 }),
  zipper: () => beep(500, 0.22, { slide: 900, type: 'sawtooth', vol: 0.03 }),
  rustle: () => beep(220 + Math.random() * 80, 0.06, { type: 'triangle', vol: 0.04 }),
  jingle: () => { beep(1500, 0.04, { vol: 0.03 }); beep(1800, 0.04, { at: 0.05, vol: 0.03 }); },
  whistle: () => beep(2100, 0.35, { slide: 300, type: 'square', vol: 0.04 }),
  horn: () => { beep(330, 0.12, { vol: 0.06 }); beep(330, 0.12, { at: 0.18, vol: 0.06 }); },
  unlock: () => ac(),
};

export const getCtx = ac;
export const isMuted = () => muted;
export const setMuted = (v) => { muted = !!v; };
export const toggleMute = () => (muted = !muted);
export const setSfxVolume = (v) => { sfxVol = Math.max(0, Math.min(1, +v || 0)); };
export const getSfxVolume = () => sfxVol;
