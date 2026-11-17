// The photo album: little pictures drawn in code, earned on the mini-game missions (and two from the story: Ninang's
// party photo and the family once the storm is over). Opened from the title screen.
import { drawText } from '../ui/font.js';
import { drawButton, hit } from '../ui/menu.js';
import { getSprite, drawObj, drawCoin } from '../render/sprites.js';
import { C } from '../render/palette.js';
import { VIEW_W } from '../core/input.js';
import { sfx } from '../core/audio.js';

const PW = 92, PH = 68; // a photo, before the white border
const r = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
const put = (g, kind, dir, frame, x, feet) => { const s = getSprite(kind, dir, frame); g.drawImage(s, Math.round(x - s.width / 2), Math.round(feet - s.height)); };

function street(g) {
  r(g, '#9fc0e0', 0, 0, PW, 24); r(g, '#c3d4dc', 0, 18, PW, 6);
  r(g, C.plaster, 0, 14, PW, 18); r(g, '#227a43', 18, 16, 56, 5); r(g, '#2a1d14', 22, 22, 48, 9);
  r(g, '#b4b0b8', 0, 32, PW, PH - 32); for (let x = 0; x < PW; x += 16) r(g, '#9b97a3', x, 32, 1, PH - 32);
}

export const PHOTOS = [
  { id: 'preso', title: 'TUMBA!', caption: 'MY FIRST TUMBA. BUBOY WAS SO MAD.', how: 'TUMBANG PRESO: NEVER GET TAGGED',
    draw(g) {
      street(g);
      g.fillStyle = 'rgba(246,241,231,0.8)'; for (let a = 0; a < 20; a++) if (a % 3) g.fillRect(Math.round(52 + Math.cos(a / 3.18) * 9), Math.round(40 + Math.sin(a / 3.18) * 4), 1, 1);
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; r(g, i % 2 ? C.gold : C.white, 58 + Math.cos(a) * 8, 26 + Math.sin(a) * 6, 1, 1); }
      g.save(); g.translate(58, 26); g.rotate(0.8); drawObj(g, 'lata', 0, 0); g.restore();
      drawObj(g, 'tsinela', 50, 34, 'blue');
      put(g, 'buboy', 0, 'alert', 74, 50);
      put(g, 'jun', 3, 'cast', 30, 64);
      put(g, 'bing', 0, 'cast', 12, 52);
      drawText(g, 'TUMBA!', 70, 4, C.gold, { shadow: C.ink });
    } },
  { id: 'habol', title: 'AYAN KA, TIGRE!', caption: 'TIGRE RAN ALL THE WAY TO THE COURT.', how: 'HABOL!: NO STUMBLES',
    draw(g) {
      const sky = ['#6fa3d8', '#92bde0', '#c3d4dc', '#f2d6a6', '#f6c88a'];
      sky.forEach((c, i) => r(g, c, 0, i * 9, PW, 9));
      r(g, '#ffe08a', 64, 30, 12, 12); r(g, '#fff0c0', 66, 32, 6, 6);
      for (let x = 0; x < PW; x += 18) { const h = 14 + (x * 7) % 12; r(g, '#a9b4cf', x, 46 - h, 16, h); }
      r(g, '#3a7f5a', 0, 40, PW, 6); for (let x = 0; x < PW; x += 3) for (let y = 30; y < 46; y += 3) if ((x + y) % 2) r(g, '#8a94a8', x, y, 1, 1);
      r(g, '#b4b0b8', 0, 46, PW, PH - 46);
      put(g, 'jun', 2, 'reach', 46, 62);
      put(g, 'tigre', 0, 'sit', 51, 52);
      r(g, C.pink, 44, 30, 2, 1); r(g, C.pink, 48, 30, 2, 1); r(g, C.pink, 44, 31, 6, 1); r(g, C.pink, 45, 32, 4, 1); r(g, C.pink, 46, 33, 2, 1);
    } },
  { id: 'mingming', title: 'NOM NOM NOM', caption: 'SHE WENT AND GOT THE FISH HERSELF.', how: 'SI MINGMING: CLEAR IT',
    draw(g) {
      r(g, '#15101f', 0, 0, PW, PH); r(g, '#3b2a1c', 0, 0, PW, 5); for (let x = 4; x < PW; x += 14) r(g, '#ffd27a', x, 2, 1, 2);
      g.globalAlpha = 0.12; for (const rr of [34, 24, 14]) { g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(46, 50, rr, 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1;
      r(g, '#3a2c24', 0, 56, PW, 12);
      r(g, '#8a6a42', 28, 46, 36, 11); r(g, '#a8845a', 28, 46, 36, 2); r(g, '#d86a8a', 30, 44, 32, 3);
      put(g, 'pusa', 2, 'sit', 22, 58);
      drawObj(g, 'isdaBit', 30, 50);
      put(g, 'puti', 0, 'sit', 40, 46); put(g, 'muning', 0, 'sit', 48, 46); put(g, 'tigre', 0, 'sit', 56, 46);
    } },
  { id: 'party', title: "NINANG'S PARTY", caption: '', how: "NINANG'S PARTY: CLEAR IT",
    draw(g, save) {
      r(g, '#5a3a5f', 0, 0, PW, PH); r(g, '#7d6794', 0, 0, PW, 40);
      const cols = [C.red, C.gold, '#4f8fff', C.green, C.pink]; for (let x = 0; x < PW; x += 5) { r(g, '#6a6488', x, 6 + Math.round(Math.sin(x / 15) * 2), 5, 1); r(g, cols[(x / 5) % 5], x + 1, 7 + Math.round(Math.sin(x / 15) * 2), 3, 2); }
      r(g, C.rug, 0, 52, PW, 16);
      const inPhoto = save?.story?.photo === 'in';
      const row = inPhoto ? ['lola', 'ninang', 'mama', 'jun', 'tatay', 'bing'] : ['lola', 'ninang', 'mama', 'tatay', 'bing'];
      row.forEach((k, i) => put(g, k, 0, k === 'jun' || k === 'bing' ? 'cast' : 0, 10 + i * (PW - 20) / (row.length - 1), 62));
      drawText(g, inPhoto ? 'CHEESE!' : 'NASAAN SI JUN?', PW / 2, 13, C.white, { align: 'center', shadow: C.ink });
    } },
  { id: 'pamilya', title: 'PAMILYA', caption: 'MINGMING SLEEPS ON THE SOFA NOW.', how: 'FINISH THE STORY',
    draw(g) {
      r(g, C.plaster, 0, 0, PW, 40); r(g, C.plaster2, 0, 38, PW, 2);
      r(g, '#3b2a1c', 8, 8, 18, 14); r(g, C.capiz, 9, 9, 16, 12); r(g, C.capiz2, 17, 9, 1, 12);
      for (let x = 0; x < PW; x += 4) r(g, x % 8 ? C.wood : C.wood2, x, 40, 4, 28);
      r(g, C.sofa, 28, 34, 44, 14); r(g, C.sofa2, 28, 34, 44, 3); r(g, C.sofa, 26, 30, 4, 18); r(g, C.sofa, 70, 30, 4, 18);
      put(g, 'pusa', 0, 'sleep', 50, 42);
      put(g, 'tigre', 0, 'sit', 36, 40); put(g, 'puti', 0, 'sit', 64, 40);
      put(g, 'mama', 0, 0, 16, 64); put(g, 'jun', 0, 'cast', 40, 64); put(g, 'muning', 0, 'sit', 44, 56); put(g, 'tatay', 0, 0, 82, 64); put(g, 'lola', 0, 0, 62, 64);
    } },
];

export const photoUnlocked = (save, id) => (id === 'party' ? !!save.story?.photo : id === 'pamilya' ? !!save.story?.ending : (save.album || []).includes(id));
const caption = (p, save) => (p.id === 'party' ? (save.story?.photo === 'in' ? 'THE WHOLE FAMILY. EVEN ME.' : 'THE FAMILY PHOTO. I HID.') : p.caption);

const cache = new Map();
function photoCanvas(p, save) {
  const key = p.id + (p.id === 'party' ? save.story?.photo : '');
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas'); cv.width = PW; cv.height = PH;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  p.draw(g, save);
  cache.set(key, cv);
  return cv;
}
export const clearPhotoCache = () => cache.clear();

// one polaroid: white frame, the picture (or a ? if not yet), the title under it
export function drawPolaroid(g, p, save, x, y, scale = 1, { on = false } = {}) {
  const w = PW * scale, h = PH * scale, have = photoUnlocked(save, p.id);
  r(g, C.ink, x - 1, y - 1, w + 8, h + 20 + 2);
  r(g, on ? C.gold : '#f6f1e7', x, y, w + 6, h + 20);
  r(g, '#2a2440', x + 3, y + 3, w, h);
  if (have) g.drawImage(photoCanvas(p, save), x + 3, y + 3, w, h);
  else { drawText(g, '?', x + 3 + w / 2, y + 3 + h / 2 - 5, '#5a5468', { scale: 3, align: 'center' }); }
  drawText(g, have ? p.title : '? ? ?', x + 3 + w / 2, y + h + 9, have ? C.ink : C.gray, { align: 'center' });
}

// ---- the album screen ----------------------------------------------------------------------------------------
export const album = { sel: 0, open: -1 };
const cell = (i) => ({ x: 14 + (i % 2) * 112, y: 40 + Math.floor(i / 2) * 96, w: 100, h: 90 });
const backRect = { x: 70, y: 340, w: 100, h: 17 };

export function updateAlbum(input, ctx) {
  const n = PHOTOS.length;
  const tp = input.tapPos;
  if (album.open >= 0) {
    if (tp || input.pressed('Escape') || input.pressed('Enter') || input.pressed(' ') || input.pressed('e')) { album.open = -1; sfx.click(); }
    return;
  }
  if (input.pressed('Escape') || hit(tp, backRect)) { sfx.unlock(); ctx.back(); return; }
  if (input.pressed('ArrowRight') || input.pressed('d')) album.sel = (album.sel + 1) % n;
  if (input.pressed('ArrowLeft') || input.pressed('a')) album.sel = (album.sel + n - 1) % n;
  if (input.pressed('ArrowDown') || input.pressed('s')) album.sel = Math.min(n - 1, album.sel + 2);
  if (input.pressed('ArrowUp') || input.pressed('w')) album.sel = Math.max(0, album.sel - 2);
  let pick = -1;
  if (tp) for (let i = 0; i < n; i++) if (hit(tp, cell(i), 0)) pick = i;
  if (pick < 0 && (input.pressed('Enter') || input.pressed(' ') || input.pressed('e'))) pick = album.sel;
  if (pick < 0) return;
  album.sel = pick;
  if (photoUnlocked(ctx.save, PHOTOS[pick].id)) { album.open = pick; sfx.pickup(); } else sfx.creak();
}

export function drawAlbum(g, ctx) {
  const save = ctx.save, n = PHOTOS.length;
  r(g, '#1d1830', 0, 0, VIEW_W, 392);
  for (let y = 0; y < 392; y += 12) r(g, '#211b36', 0, y, VIEW_W, 1); // a cork board's grain
  drawText(g, 'ALBUM', VIEW_W / 2, 10, C.gold, { scale: 3, align: 'center', shadow: C.gold2 });
  const got = PHOTOS.filter((p) => photoUnlocked(save, p.id)).length;
  drawText(g, `${got}/${n} PHOTOS`, VIEW_W / 2, 30, C.gray, { align: 'center' });
  PHOTOS.forEach((p, i) => {
    const c = cell(i), tilt = (i % 3) - 1;
    g.save(); g.translate(c.x + c.w / 2, c.y + c.h / 2); g.rotate(tilt * 0.025); g.translate(-(c.x + c.w / 2), -(c.y + c.h / 2));
    drawPolaroid(g, p, save, c.x, c.y, 1, { on: album.sel === i });
    g.restore();
    r(g, C.red, c.x + 48, c.y - 3, 4, 4); // a pin
  });
  const p = PHOTOS[album.sel];
  drawText(g, photoUnlocked(save, p.id) ? 'TAP A PHOTO TO LOOK CLOSER' : `HOW: ${p.how}`, VIEW_W / 2, 330, photoUnlocked(save, p.id) ? C.gray : C.yellow, { align: 'center' });
  drawButton(g, backRect, 'BACK', false);
  if (album.open >= 0) {
    const q = PHOTOS[album.open];
    g.globalAlpha = 0.85; r(g, C.ink, 0, 0, VIEW_W, 392); g.globalAlpha = 1;
    drawPolaroid(g, q, save, (VIEW_W - PW * 2 - 6) / 2, 70, 2);
    drawText(g, caption(q, save), VIEW_W / 2, 250, C.white, { align: 'center' });
    drawText(g, 'TAP TO CLOSE', VIEW_W / 2, 330, C.gray, { align: 'center' });
  }
}

// small icons used by the mini-game cards (what each mission pays)
export function drawRewardIcon(g, rw, x, y) {
  if (!rw) return;
  if (rw.coins) { drawCoin(g, x, y); drawText(g, String(rw.coins), x + 7, y + 1, C.gold); return; }
  if (rw.photo) { r(g, C.ink, x - 1, y - 1, 9, 8); r(g, C.white, x, y, 7, 6); r(g, '#4f8fff', x + 1, y + 1, 5, 3); return; }
  if (rw.outfit) { r(g, C.ink, x - 1, y - 1, 9, 8); r(g, C.pink, x, y, 7, 4); r(g, C.pink, x - 1, y, 1, 2); r(g, C.pink, x + 7, y, 1, 2); r(g, '#2f5fbf', x + 1, y + 4, 5, 2); return; }
  if (rw.decor) { drawText(g, '*', x, y, C.gold); }
}
