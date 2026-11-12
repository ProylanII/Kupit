// The hideout under the house (the game's home screen) and the street map (level select).
// Everything here is drawn in code: Mingming, her kittens, and what the coins have bought them so far.
import { drawText } from '../ui/font.js';
import { drawActor, drawStar, drawObj, getSprite } from '../render/sprites.js';
import { atlasSprite } from '../render/atlas.js';
import { missionIds, missionLabel } from '../game/missions.js';
import { C } from '../render/palette.js';
import { VIEW_W } from '../core/input.js';
import { CHARACTERS, CHAR_ORDER, hasNeed, catStage, NEED_ORDER } from '../game/progression.js';
import { CHAPTERS } from '../data/story.js';

const px = (g, c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };

// A cat, feet at (x, y), facing right (flip = facing left). big = Mingming, otherwise a kitten.
// With the sprite sheet loaded this draws the real cats (look: 'pusa' | 'tigre' | 'puti' | 'muning'; moving = walking);
// the rectangles below are only the fallback for ?noatlas.
export function drawCat(g, x, y, { fur = '#d8d0c0', patch = null, big = false, eyes = true, flip = false, t = 0, sleep = false, look = null, moving = false } = {}) {
  const d = flip ? -1 : 1, X = (o, w) => (flip ? x - o - w + 1 : x + o);
  if (atlasSprite('pusa|0|sit')) {
    const kind = big ? 'pusa' : look || 'tigre';
    const s = sleep || !eyes ? getSprite(kind, flip ? 1 : 2, 'sleep') : moving ? getSprite(kind, flip ? 1 : 2, Math.floor(t * 7) % 4) : getSprite(kind, 0, 'sit');
    g.drawImage(s, Math.round(x + (big ? 6 : 2) - s.width / 2), Math.round(y) + 1 - s.height);
    return d;
  }
  if (big) {
    px(g, fur, X(0, 11), y - 6, 11, 6);                 // body
    px(g, fur, X(8, 6), y - 10, 6, 6);                  // head
    px(g, fur, X(8, 2), y - 12, 2, 2); px(g, fur, X(12, 2), y - 12, 2, 2); // ears
    if (patch) { px(g, patch, X(2, 4), y - 6, 4, 3); px(g, patch, X(12, 2), y - 12, 2, 3); }
    const sw = Math.floor(t * 2) % 2;
    px(g, fur, X(-2, 2), y - 7 - sw, 2, 5 + sw);        // tail
    if (sleep) { px(g, C.ink, X(9, 2), y - 7, 2, 1); px(g, C.ink, X(12, 2), y - 7, 2, 1); } else if (Math.floor(t * 0.7) % 5) { px(g, '#e8c040', X(9, 1), y - 8, 1, 2); px(g, '#e8c040', X(12, 1), y - 8, 1, 2); }
    px(g, C.pink, X(11, 1), y - 6, 1, 1);               // nose
  } else {
    px(g, fur, X(0, 5), y - 3, 5, 3);
    px(g, fur, X(3, 4), y - 6, 4, 4);
    px(g, fur, X(3, 1), y - 7, 1, 1); px(g, fur, X(6, 1), y - 7, 1, 1);
    if (patch) { px(g, patch, X(1, 1), y - 3, 1, 3); px(g, patch, X(3, 1), y - 3, 1, 2); }
    px(g, fur, X(-1, 1), y - 4 - (Math.floor(t * 3) % 2), 1, 2);
    if (eyes) { px(g, C.ink, X(4, 1), y - 4, 1, 1); px(g, C.ink, X(6, 1), y - 4, 1, 1); }
  }
  return d;
}

export const KITTENS = [
  { name: 'PUTI', fur: '#f3ead2', look: 'puti' }, { name: 'MUNING', fur: '#8a8a96', look: 'muning' }, { name: 'TIGRE', fur: '#e8a04a', patch: '#a8642a', look: 'tigre' },
];

const MOODS = ['MINGMING IS THIN AND HUNGRY', 'MINGMING HAS MILK NOW', 'THE KITTENS OPENED THEIR EYES', 'WARM AND SAFE AT NIGHT', 'THE KITTENS HAVE ROOM TO PLAY', 'ALL FOUR ARE HEALTHY AND LOUD'];
export const catMood = (save) => (save.story?.ending ? 'MINGMING LIVES IN THE HOUSE NOW' : MOODS[catStage(save)]);

// The hideout panel: y0 is its top edge, it is 76 px tall and the full screen width.
export function drawHideout(g, save, t, y0 = 186) {
  const H = 76, floor = y0 + H - 8, stage = catStage(save), has = (id) => hasNeed(save, id);
  px(g, '#15101f', 0, y0, VIEW_W, H);
  // the house floor above: joists and gaps with light leaking through
  px(g, '#3b2a1c', 0, y0, VIEW_W, 6); px(g, '#2a1d14', 0, y0 + 6, VIEW_W, 2);
  for (let x = 6; x < VIEW_W; x += 22) px(g, '#ffd27a', x, y0 + 2, 1, 2);
  for (const x of [14, VIEW_W - 22]) { px(g, '#2a1d14', x, y0 + 6, 8, H - 14); px(g, '#3b2a1c', x + 1, y0 + 6, 2, H - 14); } // posts
  px(g, '#3a2c24', 0, floor, VIEW_W, 8); px(g, '#4a3a2e', 0, floor, VIEW_W, 1);
  for (let x = 3; x < VIEW_W; x += 17) px(g, '#2c2019', x, floor + 3 + (x % 3), 2, 1);
  // a pool of candle light around the box
  g.globalAlpha = 0.07; for (const r of [54, 40, 26]) { g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(VIEW_W / 2, floor - 10, r, 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1;
  // old boxes stacked behind (the hiding place)
  px(g, '#4a3826', 34, floor - 20, 20, 20); px(g, '#5c4630', 34, floor - 20, 20, 2); px(g, '#4a3826', 40, floor - 32, 16, 12); px(g, '#5c4630', 40, floor - 32, 16, 2);
  px(g, '#4a3826', 182, floor - 16, 18, 16); px(g, '#5c4630', 182, floor - 16, 18, 2);
  // the cat box (a bigger one once it is bought)
  const bw = has('kahon') ? 58 : 44, bx = Math.round(VIEW_W / 2 - bw / 2), by = floor - 13;
  px(g, C.ink, bx - 1, by - 1, bw + 2, 15);
  px(g, '#8a6a42', bx, by, bw, 13); px(g, '#a8845a', bx, by, bw, 2); px(g, '#6e5334', bx, by + 11, bw, 2);
  if (has('kumot')) { px(g, '#d86a8a', bx + 2, by - 2, bw - 4, 4); for (let x = bx + 4; x < bx + bw - 4; x += 6) px(g, '#f0a0b8', x, by - 1, 2, 2); } // blanket over the edge
  // Mingming in the box, kittens beside her
  const home = !save.story?.ending; // after the ending they live upstairs: the box is empty but kept
  if (home) {
    drawCat(g, bx + 5, by + 1, { big: true, fur: stage ? '#d8d0c0' : '#b8b0a4', patch: '#e8a04a', t, sleep: stage >= 3 && Math.floor(t / 6) % 2 === 1 });
    KITTENS.forEach((k, i) => {
      const out = has('kahon') && i === 2 || has('vet') && i === 1; // room to play: some tumble out of the box
      if (out) {
        const hop = Math.abs(Math.sin(t * 2.2 + i * 2)) * 3, kx = (i === 2 ? bx - 22 : bx + bw + 10) + Math.sin(t * 0.8 + i) * 7;
        drawCat(g, kx, floor - hop, { ...k, t: t + i, flip: Math.cos(t * 0.8 + i) < 0, moving: true });
      } else drawCat(g, bx + 21 + i * 8, by + 1 - (i === 1 ? 1 : 0), { ...k, t: t + i, eyes: has('sardinas') });
    });
  } else drawText(g, 'EMPTY NOW. THEY LIVE UPSTAIRS!', VIEW_W / 2, by - 12, C.gray, { align: 'center' });
  if (has('gatas')) { px(g, C.ink, bx - 13, floor - 4, 10, 4); px(g, '#c8ccd4', bx - 12, floor - 3, 8, 3); px(g, C.white, bx - 11, floor - 3, 6, 1); } // milk bowl
  if (has('sardinas')) { px(g, C.ink, bx + bw + 3, floor - 5, 8, 5); px(g, C.red, bx + bw + 4, floor - 4, 6, 3); px(g, C.gold, bx + bw + 4, floor - 3, 6, 1); } // sardine can
  if (has('vet') && Math.floor(t * 1.5) % 3 === 0) { px(g, C.pink, bx + 12, by - 16, 2, 1); px(g, C.pink, bx + 15, by - 16, 2, 1); px(g, C.pink, bx + 12, by - 15, 5, 1); px(g, C.pink, bx + 13, by - 14, 3, 1); px(g, C.pink, bx + 14, by - 13, 1, 1); } // a little heart
  // the crew: Jun always, the siblings once they are in on the secret
  const spots = { jun: [bx + bw + 24, 1], bing: [bx - 30, 2], ramil: [bx + bw + 44, 1], nene: [bx - 48, 2] };
  for (const id of CHAR_ORDER) {
    if (!save.chars.includes(id)) continue;
    const [x, dir] = spots[id], look = CHARACTERS[id].look;
    drawActor(g, save.char === id && save.outfit !== 'basic' ? `${look}~${save.outfit}` : look, x, floor + 1, dir, 0);
    if (save.char === id) px(g, C.gold, x - 2, floor - 24 - (Math.floor(t * 2) % 2), 4, 2); // who you are playing
  }
  drawText(g, catMood(save), VIEW_W / 2, y0 + 11, stage >= 5 || save.story?.ending ? C.green : C.gray, { align: 'center' });
  // needs bought so far: five pips
  for (let i = 0; i < NEED_ORDER.length; i++) px(g, has(NEED_ORDER[i]) ? C.pink : '#3a3048', VIEW_W / 2 - 14 + i * 6, y0 + 19, 4, 3);
}

// ---- the street map ---------------------------------------------------------------------
// Levels are houses along a winding road, grouped into the story's chapters.
const NODE_H = 36, CH_H = 22, MAP_TOP = 30, MAP_BOTTOM = 326;

export function mapLayout(levels) {
  const rows = []; let y = 0, n = 0;
  levels.forEach((L, i) => {
    const ch = CHAPTERS.findIndex((c) => c.from === L.id);
    if (ch >= 0) { rows.push({ ch, y }); y += CH_H; }
    rows.push({ i, y, x: n++ % 2 ? 176 : 64 });
    y += NODE_H;
  });
  return { rows, height: y, nodes: rows.filter((r) => r.i !== undefined) };
}

export const mapScrollFor = (lay, sel) => {
  const node = lay.nodes[Math.min(sel, lay.nodes.length - 1)];
  return Math.max(0, Math.min(lay.height - (MAP_BOTTOM - MAP_TOP), node.y - 120));
};
export const mapNodeRect = (node, scroll) => ({ x: 8, y: MAP_TOP + node.y - scroll, w: VIEW_W - 16, h: NODE_H - 2 });
export const mapVisible = (r) => r.y >= MAP_TOP - 4 && r.y + r.h <= MAP_BOTTOM + 4;

function house(g, x, y, { boss, done, lock, heart, t }) {
  const w = boss ? 26 : 20, h = boss ? 16 : 13, x0 = Math.round(x - w / 2), top = y - h;
  const wall = lock ? '#3a3648' : '#5a4a6a', roof = lock ? '#2a2636' : boss ? '#a83a3a' : '#3b2a1c';
  px(g, C.ink, x0 - 1, top - 1, w + 2, h + 1);
  px(g, wall, x0, top, w, h);
  for (let i = 0; i <= w / 2 + 2; i++) px(g, roof, x0 - 2 + i, top - 1 - Math.floor(i / 2), w + 4 - i * 2, 1);
  const lit = done && !lock, win = lit ? '#ffd27a' : '#2a3560';
  px(g, win, x0 + 3, top + 4, 5, 5); px(g, win, x0 + w - 8, top + 4, 5, 5);
  px(g, lock ? '#2a2636' : '#3b2a1c', x0 + Math.floor(w / 2) - 2, y - 7, 4, 7);
  if (heart) { px(g, C.pink, x - 3, top - 12, 2, 1); px(g, C.pink, x + 1, top - 12, 2, 1); px(g, C.pink, x - 3, top - 11, 6, 1); px(g, C.pink, x - 2, top - 10, 4, 1); px(g, C.pink, x - 1, top - 9, 2, 1); }
  if (boss && !lock && Math.floor(t * 2) % 2) px(g, C.gold, x0 + w, top - 4, 2, 2);
}

// ctx: { save, sel, scroll, unlocked(i) -> bool, t }
export function drawMap(g, levels, lay, { save, sel, scroll, isOpen, t }) {
  g.fillStyle = '#14111f'; g.fillRect(0, 0, VIEW_W, 392);
  g.save();
  g.beginPath(); g.rect(0, MAP_TOP - 2, VIEW_W, MAP_BOTTOM - MAP_TOP + 4); g.clip();
  const sy = (y) => MAP_TOP + y - scroll;
  // the road: dots from house to house
  for (let k = 0; k + 1 < lay.nodes.length; k++) {
    const a = lay.nodes[k], b = lay.nodes[k + 1], open = isOpen(b.i);
    for (let s = 0; s <= 1; s += 1 / 14) px(g, open ? '#8a7a5a' : '#3a3648', a.x + (b.x - a.x) * s, sy(a.y + 22 + (b.y - a.y) * s), 2, 2);
  }
  for (const r of lay.rows) {
    const y = sy(r.y);
    if (y < MAP_TOP - 40 || y > MAP_BOTTOM + 8) continue;
    if (r.ch !== undefined) {
      const c = CHAPTERS[r.ch];
      px(g, '#2a2440', 0, y + 3, VIEW_W, 15);
      drawText(g, `CHAPTER ${r.ch + 1}: ${c.name}`, 10, y + 6, C.gold);
      drawText(g, c.sub, VIEW_W - 10, y + 6, C.gray, { align: 'right' });
      continue;
    }
    const L = levels[r.i], lock = !isOpen(r.i), on = sel === r.i, stars = save.stars[L.id], left = r.x < VIEW_W / 2;
    if (on) { px(g, C.gold, 6, y, VIEW_W - 12, NODE_H - 2); px(g, '#2a2440', 7, y + 1, VIEW_W - 14, NODE_H - 4); }
    house(g, r.x, y + 30, { boss: !!L.boss, done: stars !== undefined, lock, heart: !!L.epilogue && !lock, t });
    const tx = left ? r.x + 22 : r.x - 22, al = { align: left ? 'left' : 'right' };
    const best = save.best[L.id];
    const sub = L.epilogue ? 'NO SNEAKING. JUST ASK' : L.boss ? (best ? `BOSS  BEST ${Math.floor(best)}S` : 'BOSS') : best ? `BEST ${Math.floor(best)}S  PAR ${L.par}S` : `PAR ${L.par}S`;
    const tw = lock ? 22 : Math.max(L.name.length, sub.length, 14) * 4 + 3; // a plate behind the words, so the road never runs through them
    px(g, on ? '#2a2440' : '#14111f', left ? tx - 2 : tx - tw, y + 4, tw + 2, lock ? 9 : 28);
    drawText(g, lock ? '? ? ?' : L.name, tx, y + 6, lock ? C.dgray : C.white, al);
    if (lock) continue;
    drawText(g, L.epilogue ? 'NO SNEAKING. JUST ASK' : L.boss ? (best ? `BOSS  BEST ${Math.floor(best)}S` : 'BOSS') : best ? `BEST ${Math.floor(best)}S  PAR ${L.par}S` : `PAR ${L.par}S`, tx, y + 15, L.boss ? C.red : C.gray, al);
    if (!L.epilogue) for (let k = 0; k < 3; k++) drawStar(g, (left ? tx : tx - 38) + k * 8, y + 24, k < (stars || 0));
    if (L.alkansya) {
      const ax = left ? tx + 34 : tx - 48;
      if (save.alkansya[L.id]) drawObj(g, 'alkansya', ax, y + 27); else drawText(g, '?', ax - 1, y + 24, C.dgray);
    }
  }
  g.restore();
  px(g, '#14111f', 0, 0, VIEW_W, MAP_TOP - 2);
  drawText(g, 'BARANGAY MAP', VIEW_W / 2, 10, C.gold, { scale: 2, align: 'center', shadow: C.gold2 });
  if (scroll > 0) drawText(g, '^', VIEW_W / 2, 23, C.gray, { align: 'center' });
  if (scroll < lay.height - (MAP_BOTTOM - MAP_TOP)) drawText(g, 'V', VIEW_W / 2, 327, C.gray, { align: 'center' });
  // the selected level's next star: what to do for it
  const L = levels[sel];
  if (L && isOpen(sel) && !L.epilogue) {
    const mask = save.missions?.[L.id] | 0, ids = missionIds(L), k = ids.findIndex((_, i) => !((mask >> i) & 1));
    px(g, '#14111f', 0, 360, VIEW_W, 12);
    if (k >= 0) { drawStar(g, 8, 362, false); drawText(g, `NEXT STAR: ${missionLabel(L, ids[k])}`, 16, 363, C.yellow); }
    else { drawStar(g, 8, 362, true); drawText(g, 'ALL THREE STARS EARNED!', 16, 363, C.green); }
  }
}
