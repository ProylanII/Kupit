// Tiny menu helpers: stacked buttons, drawn and hit-tested in game pixels.
import { drawText } from './font.js';
import { C } from '../render/palette.js';
import { VIEW_W } from '../core/input.js';

const BW = 148, BH = 17;

export const buttonRect = (i, y0, gap = 22, w = BW) => ({ x: Math.round((VIEW_W - w) / 2), y: y0 + i * gap, w, h: BH });

export function drawButton(g, r, label, selected, { dim = false } = {}) {
  g.fillStyle = C.ink; g.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
  g.fillStyle = selected ? C.gold : C.wallD; g.fillRect(r.x, r.y, r.w, r.h);
  g.fillStyle = selected ? C.gold2 : C.ink; g.fillRect(r.x, r.y + r.h - 2, r.w, 2);
  drawText(g, label, r.x + r.w / 2, r.y + 6, dim ? C.dgray : selected ? C.ink : C.white, { align: 'center' });
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
