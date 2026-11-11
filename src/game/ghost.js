// Ghost of your best run: the player's position sampled 10 times a second, packed as text.
// Stored apart from the save (localStorage "kupit.ghosts.v1") so save codes stay short.
// The sim runs at a fixed 60 Hz step, so a recording lines up with a replay frame for frame.
export const GHOST_EVERY = 6; // sim steps between samples (0.1 s)
const KEY = 'kupit.ghosts.v1';
const MAX = 3000;             // 5 minutes of samples per level

const enc = (n) => Math.max(0, Math.min(1295, Math.round(n))).toString(36).padStart(2, '0');

// samples: [[x, y, hidden], ...] -> "xxyyh..." (2 + 2 + 1 chars per sample)
export function encodeGhost(samples) {
  let s = '';
  for (const [x, y, h] of samples.slice(0, MAX)) s += enc(x) + enc(y) + (h ? '1' : '0');
  return s;
}

export function decodeGhost(str) {
  const out = [];
  if (typeof str !== 'string') return out;
  for (let i = 0; i + 5 <= str.length; i += 5) {
    const x = parseInt(str.slice(i, i + 2), 36), y = parseInt(str.slice(i + 2, i + 4), 36);
    if (Number.isNaN(x) || Number.isNaN(y)) return [];
    out.push([x, y, str[i + 4] === '1']);
  }
  return out;
}

// Where the ghost is at sim time t (seconds): interpolated between samples, or null once it has finished.
export function ghostAt(samples, t) {
  if (!samples || !samples.length) return null;
  const f = (t * 60) / GHOST_EVERY, i = Math.floor(f);
  if (i >= samples.length - 1) return null;
  const a = samples[i], b = samples[i + 1], k = f - i;
  return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, hidden: a[2] };
}

function all() {
  try { const o = JSON.parse(localStorage.getItem(KEY)); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
}
export function loadGhost(id) { return decodeGhost(all()[id]); }
export function storeGhost(id, samples) {
  const o = all();
  o[id] = encodeGhost(samples);
  try { localStorage.setItem(KEY, JSON.stringify(o)); return true; } catch { return false; }
}
