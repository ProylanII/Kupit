const KEY = 'kupit.save.v1';
const fresh = () => ({ unlocked: 0, stars: {}, best: {}, bank: 0, muted: false });

export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    return s && typeof s === 'object' ? { ...fresh(), ...s } : fresh();
  } catch { return fresh(); }
}

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode etc. */ }
}
