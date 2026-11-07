// Music player: a tiny look-ahead step sequencer on WebAudio (no audio files).
import { TRACKS, stepNotes } from '../data/tracks.js';
import { getCtx, isMuted } from './audio.js';

const LOOKAHEAD = 0.25; // seconds scheduled ahead
const VOL = 0.5, DUCK = 0.12;

let gain = null, timer = null, track = null, name = null, step = 0, next = 0, ducked = false;

function ensure() {
  const a = getCtx();
  if (!a) return null;
  if (!gain) { gain = a.createGain(); gain.gain.value = 0; gain.connect(a.destination); }
  return a;
}

const level = () => (isMuted() ? 0 : ducked ? DUCK : VOL);

function applyLevel(smooth = 0.25) {
  const a = getCtx();
  if (!a || !gain) return;
  gain.gain.cancelScheduledValues(a.currentTime);
  gain.gain.setTargetAtTime(track ? level() : 0, a.currentTime, smooth / 3);
}

function playNote(a, n, t, stepLen) {
  const o = a.createOscillator(), g = a.createGain();
  const dur = stepLen * n.len;
  o.type = n.wave;
  o.frequency.value = n.hz;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(n.vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(gain);
  o.start(t); o.stop(t + dur + 0.05);
}

function pump() {
  const a = getCtx();
  if (!a || !track) return;
  const stepLen = 60 / track.bpm / 4;
  while (next < a.currentTime + LOOKAHEAD) {
    for (const n of stepNotes(track, step)) playNote(a, n, next, stepLen);
    next += stepLen;
    step = (step + 1) % track.steps;
  }
}

export const music = {
  get name() { return name; },
  // play('menu' | 'sneak' | 'chase' | 'boss') or play(null) to fade out.
  play(n) {
    if (n === name) return;
    name = n;
    track = n ? TRACKS[n] : null;
    const a = ensure();
    if (!a) return;
    step = 0; next = a.currentTime + 0.05;
    if (track && !timer) timer = setInterval(pump, 60);
    if (!track && timer) { clearInterval(timer); timer = null; }
    applyLevel(track ? 0.25 : 0.5);
  },
  duck(on) { if (ducked === on) return; ducked = on; applyLevel(0.15); },
  refresh() { applyLevel(0.1); }, // call after mute changes
};
