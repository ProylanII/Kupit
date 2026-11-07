const KEY = 'kupit.save.v1';
const fresh = () => ({ unlocked: 0, stars: {}, best: {}, bank: 0, muted: false, upgrades: {}, chars: ['jun'], char: 'jun', houses: 0, houseDiff: 2, daily: null, haptics: true });

export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    const out = s && typeof s === 'object' ? { ...fresh(), ...s } : fresh();
    if (!Array.isArray(out.chars) || !out.chars.includes('jun')) out.chars = ['jun', ...(Array.isArray(out.chars) ? out.chars : [])];
    if (!out.chars.includes(out.char)) out.char = 'jun';
    return out;
  } catch { return fresh(); }
}

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode etc. */ }
}
