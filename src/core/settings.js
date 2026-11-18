// Player options (saved in save.opts) applied to the audio, haptics and button layout.
import { DEFAULT_OPTS } from './save.js';
import { setSfxVolume } from './audio.js';
import { music } from './music.js';
import { setHaptics } from './haptics.js';
import { setLeftHanded } from './input.js';

// Live copy read by the renderer (shake, flash, pulse, ghost...). Mutated in place, never replaced.
export const settings = { ...DEFAULT_OPTS };

export function applySettings(save) {
  Object.assign(settings, DEFAULT_OPTS, save.opts || {});
  setSfxVolume(settings.sfx);
  music.setVolume(settings.music);
  setHaptics(save.haptics !== false);
  setLeftHanded(!!settings.left);
}

// CALM SCREEN (one switch in Options): no screen shake, no colour flash, no pulsing edge
export const isCalm = (o) => !(o.shake > 0) && !o.flash && !o.pulse;
export function setCalm(o, on) { o.shake = on ? 0 : 1; o.flash = !on; o.pulse = !on; }

export const SHAKE_LEVELS = [1, 0.4, 0];
export const shakeLabel = (v) => (v >= 1 ? 'FULL' : v > 0 ? 'LOW' : 'OFF');
export const VOLUME_STEPS = [0, 0.25, 0.5, 0.75, 1];
