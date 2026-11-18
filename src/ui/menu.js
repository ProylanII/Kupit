// Tiny menu helpers: stacked buttons, drawn and hit-tested in game pixels.
import { drawText, drawBig, bigWidth, hasBigGlyph } from './font.js';
import { C } from '../render/palette.js';
import { VIEW_W } from '../core/input.js';

const BW = 148, BH = 17;

export const buttonRect = (i, y0, gap = 22, w = BW) => ({ x: Math.round((VIEW_W - w) / 2), y: y0 + i * gap, w, h: BH });

export function drawButton(g, r, label, selected, { dim = false } = {}) {
  g.fillStyle = C.ink; g.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
  g.fillStyle = selected ? C.gold : C.wallD; g.fillRect(r.x, r.y, r.w, r.h);
  g.fillStyle = selected ? C.gold2 : C.ink; g.fillRect(r.x, r.y + r.h - 2, r.w, 2);
  const col = dim ? C.dgray : selected ? C.ink : C.white;
  // the 5x7 font, readable on a phone, whenever the label fits it; else the 3x5 one
  if (r.h >= 15 && [...label].every(hasBigGlyph) && bigWidth(label) <= r.w - 6) drawBig(g, label, r.x + r.w / 2, r.y + Math.floor((r.h - 7) / 2), col, { align: 'center' });
  else drawText(g, label, r.x + r.w / 2, r.y + 6, col, { align: 'center' });
}

export function drawMenu(g, labels, sel, y0, gap = 22) {
  labels.forEach((l, i) => drawButton(g, buttonRect(i, y0, gap), l, i === sel));
}

export function hit(pos, r, pad = 2) {
  return !!pos && pos.x >= r.x - pad && pos.x <= r.x + r.w + pad && pos.y >= r.y - pad && pos.y <= r.y + r.h + pad;
}

export function menuHit(pos, n, y0, gap = 22) {
  for (let i = 0; i < n; i++) if (hit(pos, buttonRect(i, y0, gap), 3)) return i;
  return -1;
}
