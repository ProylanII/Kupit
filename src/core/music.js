// Music player. Each track is rendered ONCE into an AudioBuffer (OfflineAudioContext) and then loops as a
// single buffer source: no timers, no per-note oscillators, so it costs next to nothing on low-end phones.
// Until a track has rendered (or where OfflineAudioContext is missing) a small look-ahead sequencer plays it.
// Switching tracks crossfades, so the chase music never clicks or flickers.
import { TRACKS, stepNotes } from '../data/tracks.js';
import { getCtx, isMuted } from './audio.js';

const LOOKAHEAD = 0.25; // seconds scheduled ahead (sequencer fallback)
const VOL = 0.5, DUCK = 0.25, FADE = 0.45;

let master = null, name = null, ducked = false, vol = 1;
let cur = null; // { name, bus, src?, timer?, step, next }
const buffers = new Map(); // track name -> AudioBuffer | Promise

function ensure() {
  const a = getCtx();
  if (!a) return null;
  if (!master) { master = a.createGain(); master.gain.value = level(); master.connect(a.destination); }
  return a;
}

const level = () => (isMuted() ? 0 : VOL * vol * (ducked ? DUCK : 1));

function applyLevel(smooth = 0.25) {
  const a = getCtx();
  if (!a || !master) return;
  master.gain.cancelScheduledValues(a.currentTime);
  master.gain.setTargetAtTime(level(), a.currentTime, smooth / 3);
}

function playNote(a, n, t, stepLen, dest) {
  const o = a.createOscillator(), g = a.createGain();
  const dur = stepLen * n.len;
  o.type = n.wave;
  o.frequency.value = n.hz;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(n.vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}

// Render one loop of a track. Notes ringing past the loop end are folded back onto its start,
// so the buffer loops seamlessly.
function render(track) {
  const a = getCtx();
  const OAC = typeof window !== 'undefined' && (window.OfflineAudioContext || window.webkitOfflineAudioContext);
  if (!a || !OAC) return null;
  const sr = Math.min(a.sampleRate || 44100, 32000);
  const stepLen = 60 / track.bpm / 4, loop = stepLen * track.steps, tail = 1;
  const off = new OAC(1, Math.ceil((loop + tail) * sr), sr);
  for (let s = 0; s < track.steps; s++) for (const n of stepNotes(track, s)) playNote(off, n, 0.001 + s * stepLen, stepLen, off.destination);
  return off.startRendering().then((buf) => {
    const len = Math.round(loop * sr), src = buf.getChannelData(0);
    const out = a.createBuffer(1, len, sr), dst = out.getChannelData(0);
    for (let i = 0; i < src.length; i++) dst[i % len] += src[i];
    return out;
  });
}

function bufferFor(n) {
  if (buffers.has(n)) return buffers.get(n);
  let p = null;
  try { p = render(TRACKS[n]); } catch { p = null; }
  if (!p) { buffers.set(n, null); return null; }
  buffers.set(n, p.then((b) => { buffers.set(n, b); return b; }, () => { buffers.set(n, null); return null; }));
  return buffers.get(n);
}

function stopVoice(v, fade = FADE) {
  if (!v) return;
  const a = getCtx();
  if (v.timer) { clearInterval(v.timer); v.timer = null; }
  if (!a) return;
  const t = a.currentTime;
  try { v.bus.gain.cancelScheduledValues(t); v.bus.gain.setValueAtTime(v.bus.gain.value, t); v.bus.gain.linearRampToValueAtTime(0, t + fade); } catch { /* ignore */ }
  setTimeout(() => { try { v.src?.stop(); v.bus.disconnect(); } catch { /* ignore */ } }, (fade + 0.2) * 1000);
}

function startVoice(n) {
  const a = ensure();
  if (!a) return null;
  const track = TRACKS[n];
  const bus = a.createGain();
  bus.gain.setValueAtTime(0, a.currentTime);
  bus.gain.linearRampToValueAtTime(1, a.currentTime + FADE);
  bus.connect(master);
  const v = { name: n, bus, step: 0, next: a.currentTime + 0.05, src: null, timer: null };
  const b = bufferFor(n);
  const useBuffer = (buf) => {
    if (!buf || cur !== v) return;
    if (v.timer) { clearInterval(v.timer); v.timer = null; }
    const src = a.createBufferSource();
    src.buffer = buf; src.loop = true;
    src.connect(bus);
    // start in step with where the sequencer had got to, so the hand-over is seamless
    const stepLen = 60 / track.bpm / 4, offset = (v.step * stepLen) % buf.duration;
    src.start(Math.max(a.currentTime, v.next), offset);
    v.src = src;
  };
  if (b && !(b instanceof Promise)) { v.src = null; cur = v; useBuffer(b); return v; }
  // sequencer until the buffer is ready
  const pump = () => {
    const stepLen = 60 / track.bpm / 4;
    while (v.next < a.currentTime + LOOKAHEAD) {
      for (const note of stepNotes(track, v.step)) playNote(a, note, v.next, stepLen, bus);
      v.next += stepLen;
      v.step = (v.step + 1) % track.steps;
    }
  };
  pump();
  v.timer = setInterval(pump, 60);
  if (b instanceof Promise) b.then(useBuffer);
  return v;
}

export const music = {
  get name() { return name; },
  // play('menu' | 'sneak' | 'chase' | 'boss') or play(null) to fade out.
  play(n) {
    if (n === name) return;
    name = n;
    if (!ensure()) return;
    stopVoice(cur);
    cur = null;
    if (n && TRACKS[n]) cur = startVoice(n);
    applyLevel();
  },
  // Render every track in the background (call once audio is unlocked) so later switches are instant.
  warm() { if (!ensure()) return; for (const n of Object.keys(TRACKS)) bufferFor(n); },
  duck(on) { if (ducked === on) return; ducked = on; applyLevel(0.15); },
  setVolume(v) { vol = Math.max(0, Math.min(1, +v || 0)); applyLevel(0.1); },
  get volume() { return vol; },
  refresh() { applyLevel(0.1); }, // call after mute changes
};
