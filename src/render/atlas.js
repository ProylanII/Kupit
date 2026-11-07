// Optional sprite sheet: assets/sprites/sheet.png + atlas.json (made from Blender renders by tools/pack_atlas.py).
// Frames are keyed "kind|dir|frame" (dir 0 = down, 2 = right, 3 = up; left is mirrored in code).
// If the files are missing, sprites.js keeps using its code-drawn placeholders. ?noatlas forces the placeholders.
const cache = new Map();
let sheet = null, frames = null;

export const atlasLoaded = () => !!sheet;

export async function loadAtlas(base = new URL('../../assets/sprites/', import.meta.url)) {
  sheet = null; frames = null; cache.clear();
  if (new URLSearchParams(location.search).has('noatlas')) return false;
  try {
    const res = await fetch(new URL('atlas.json', base));
    if (!res.ok) return false;
    const meta = await res.json();
    const img = new Image();
    img.src = new URL(meta.image || 'sheet.png', base).href;
    await img.decode();
    sheet = img; frames = meta.frames;
    return true;
  } catch { sheet = null; frames = null; return false; }
}

export function atlasSprite(key) {
  if (!sheet || !frames[key]) return null;
  let c = cache.get(key);
  if (c) return c;
  const f = frames[key];
  c = document.createElement('canvas');
  c.width = f.w; c.height = f.h;
  c.getContext('2d').drawImage(sheet, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  cache.set(key, c);
  return c;
}
