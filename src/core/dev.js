// Dev mode: unlocks every level and adds testing tools. Not part of the normal game.
// Turn on with ?dev=1 (remembered), off with ?dev=0, or toggle with the ` (backquote) key.
const KEY = 'kupit.dev';

export const dev = { on: false, god: false, info: false, speed: 1, fps: 60 };

export function initDev() {
  const q = new URLSearchParams(location.search).get('dev');
  try {
    if (q === '1') localStorage.setItem(KEY, '1');
    else if (q === '0') localStorage.removeItem(KEY);
    dev.on = localStorage.getItem(KEY) === '1';
  } catch { dev.on = q === '1'; }
}

export function setDev(on) {
  dev.on = on;
  if (!on) { dev.god = false; dev.info = false; dev.speed = 1; }
  try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export const SPEEDS = [1, 2, 4, 0.5];
