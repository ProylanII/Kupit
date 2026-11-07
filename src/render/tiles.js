// Static level background, drawn once per level into an offscreen canvas.
// Pass order: floors -> contact shadows -> furniture -> walls (with wall decor) -> window light.
import { TILE } from '../world/tilemap.js';
import { C } from './palette.js';

const r = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const shade = (g, a, x, y, w, h, c = C.ink) => { g.globalAlpha = a; r(g, c, x, y, w, h); g.globalAlpha = 1; };
const hash = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

const FURN = new Set('TSBPCF');
const isWall = (c) => c === '#';
const isFloorish = (c) => !isWall(c) && !FURN.has(c);

// ---------------------------------------------------------------- floors
function floor(g, ch, tx, ty, x, y) {
  if (ch === ';') { // grass with tufts and the odd flower
    r(g, C.leaf, x, y, TILE, TILE);
    for (let i = 0; i < 5; i++) {
      const h = hash(tx, ty, i);
      r(g, i < 2 ? '#4a9a52' : C.leaf2, x + (h % 15), y + ((h >>> 8) % 14), 1, 2 + (i & 1));
    }
    const f = hash(tx, ty, 9);
    if (f % 9 === 0) { r(g, f & 32 ? C.yellow : C.white, x + (f >>> 4) % 12 + 2, y + (f >>> 9) % 11 + 2, 2, 2); }
  } else if (ch === ',') { // kitchen tiles with grout
    r(g, C.tile, x, y, TILE, TILE);
    r(g, C.tile2, x, y, 8, 8); r(g, C.tile2, x + 8, y + 8, 8, 8);
    r(g, C.grout, x, y + 7, TILE, 1); r(g, C.grout, x + 7, y, 1, TILE);
    r(g, C.white, x + 1, y + 1, 2, 1); r(g, C.white, x + 9, y + 9, 2, 1);
  } else { // wood planks: 4px boards, seams staggered across the whole map
    for (let b = 0; b < 4; b++) {
      const row = ty * 4 + b, py = y + b * 4;
      r(g, row % 3 === 0 ? C.wood2 : row % 3 === 1 ? C.wood : C.woodHi, x, py, TILE, 4);
      r(g, C.woodLine, x, py + 3, TILE, 1);
      for (let sx = 0; sx < TILE; sx++) if ((tx * TILE + sx + row * 11) % 24 === 0) r(g, C.woodLine, x + sx, py, 1, 3);
      const k = hash(tx, row, 3);
      if (k % 5 === 0) r(g, C.woodLine, x + k % 13 + 1, py + 1, 2, 1); // grain / knot
    }
  }
}

function rug(g, map, tx, ty, x, y) {
  const n = map.ch(tx, ty - 1) === 'R', s = map.ch(tx, ty + 1) === 'R', w = map.ch(tx - 1, ty) === 'R', e = map.ch(tx + 1, ty) === 'R';
  r(g, C.rug, x, y, TILE, TILE);
  // diamond pattern, continuous across tiles
  for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
    const gx = tx * TILE + px, gy = ty * TILE + py;
    const d = Math.abs(((gx + 4) % 8) - 4) + Math.abs(((gy + 4) % 8) - 4);
    if (d === 3) r(g, C.rug2, x + px, y + py, 1, 1);
    else if (d === 0) r(g, C.rugEdge, x + px, y + py, 1, 1);
  }
  if (!n) { r(g, C.rugEdge, x, y + 1, TILE, 2); for (let i = 1; i < TILE; i += 2) r(g, C.white, x + i, y, 1, 1); }
  if (!s) { r(g, C.rugEdge, x, y + 13, TILE, 2); for (let i = 1; i < TILE; i += 2) r(g, C.white, x + i, y + 15, 1, 1); }
  if (!w) r(g, C.rugEdge, x + 1, y, 2, TILE);
  if (!e) r(g, C.rugEdge, x + 13, y, 2, TILE);
}

// ---------------------------------------------------------------- furniture
function table(g, map, tx, ty, x, y) {
  const up = map.ch(tx, ty - 1) === 'T', dn = map.ch(tx, ty + 1) === 'T', lf = map.ch(tx - 1, ty) === 'T', rt = map.ch(tx + 1, ty) === 'T';
  const top = dn ? TILE : 12;
  // gingham plastic tablecloth
  for (let py = 0; py < top; py++) for (let px = 0; px < TILE; px++) {
    const a = ((tx * TILE + px) >> 2) & 1, b = ((ty * TILE + py) >> 2) & 1;
    r(g, a && b ? C.check2 : a || b ? C.check : C.white, x + px, y + py, 1, 1);
  }
  if (!up) r(g, C.white, x, y, TILE, 1);
  if (!lf) r(g, C.check2, x, y, 1, top);
  if (!rt) r(g, C.check2, x + 15, y, 1, top);
  if (!dn) { // front: cloth hem then wooden legs
    r(g, C.check2, x, y + 12, TILE, 1);
    r(g, C.table, x, y + 13, TILE, 1);
    shade(g, 0.3, x, y + 14, TILE, 2);
    if (!lf) r(g, C.table, x + 1, y + 13, 2, 3);
    if (!rt) r(g, C.table, x + 13, y + 13, 2, 3);
  }
  const h = hash(tx, ty, 1) % 6; // something on the table
  if (h === 0) { r(g, C.gray, x + 4, y + 4, 7, 5); r(g, C.white, x + 5, y + 4, 5, 4); r(g, C.counter, x + 6, y + 5, 3, 2); }
  else if (h === 1) { r(g, '#9fd8e8', x + 6, y + 3, 3, 4); r(g, C.white, x + 6, y + 3, 1, 2); }
  else if (h === 2) { r(g, C.woodLine, x + 3, y + 5, 9, 4); r(g, C.gold, x + 4, y + 3, 3, 3); r(g, C.red, x + 7, y + 4, 3, 3); r(g, C.leaf2, x + 9, y + 3, 2, 2); }
}

function sofa(g, map, tx, ty, x, y) {
  const lf = map.ch(tx - 1, ty) === 'S', rt = map.ch(tx + 1, ty) === 'S';
  r(g, C.sofa, x, y + 1, TILE, 6);           // backrest
  r(g, C.sofa2, x, y + 2, TILE, 1);
  r(g, C.sofa2, x, y + 7, TILE, 6);          // seat cushion
  r(g, C.sofaHi, x, y + 7, TILE, 1);
  r(g, C.sofa, x, y + 13, TILE, 2);          // front
  shade(g, 0.35, x, y + 15, TILE, 1);
  if (lf) r(g, C.sofa, x, y + 7, 1, 6);      // seam between cushions
  if (!lf) { r(g, C.sofa, x, y + 3, 3, 12); r(g, C.sofaHi, x, y + 3, 3, 1); }
  if (!rt) { r(g, C.sofa, x + 13, y + 3, 3, 12); r(g, C.sofaHi, x + 13, y + 3, 3, 1); }
  const h = hash(tx, ty, 2) % 4; // throw pillow
  if (h === 0) { r(g, C.gold, x + 5, y + 4, 6, 5); r(g, C.gold2, x + 5, y + 8, 6, 1); r(g, C.white, x + 6, y + 5, 1, 1); }
  else if (h === 1) { r(g, C.pink, x + 6, y + 4, 6, 5); r(g, C.bed, x + 6, y + 8, 6, 1); }
}

function bed(g, map, tx, ty, x, y) {
  const up = map.ch(tx, ty - 1) === 'B', dn = map.ch(tx, ty + 1) === 'B', lf = map.ch(tx - 1, ty) === 'B', rt = map.ch(tx + 1, ty) === 'B';
  if (!up) { // headboard + pillow
    r(g, C.table, x, y, TILE, 4); r(g, C.table2, x, y + 1, TILE, 1);
    r(g, C.white, x, y + 4, TILE, 7);
    r(g, C.counter2, x, y + 10, TILE, 1);
    r(g, C.counter, x + (lf ? 0 : 2), y + 5, rt ? 16 : 12, 4); r(g, C.white, x + (lf ? 1 : 3), y + 5, 6, 2);
    r(g, C.bed2, x, y + 11, TILE, 5); r(g, C.white, x, y + 11, TILE, 1);
  } else { // blanket: banig-style woven stripes
    r(g, C.bed2, x, y, TILE, TILE);
    for (let py = 0; py < TILE; py++) {
      const gy = ty * TILE + py;
      if (gy % 6 === 0) r(g, C.bed, x, y + py, TILE, 1);
      if (gy % 6 === 3) for (let px = (gy >> 1) & 1; px < TILE; px += 2) r(g, C.rugEdge, x + px, y + py, 1, 1);
    }
  }
  if (!dn) { r(g, C.bed, x, y + 12, TILE, 2); r(g, C.table, x, y + 14, TILE, 2); }
  if (!lf) { r(g, C.table, x, y, 1, TILE); r(g, C.table2, x + 1, y + (up ? 0 : 4), 1, up ? TILE : 12); }
  if (!rt) { r(g, C.table, x + 15, y, 1, TILE); shade(g, 0.15, x + 12, y + (up ? 0 : 11), 3, up ? TILE : 5); }
}

function plant(g, tx, ty, x, y) {
  shade(g, 0.25, x + 3, y + 14, 11, 2);
  r(g, C.pot, x + 4, y + 9, 8, 6); r(g, '#8f4a2a', x + 10, y + 9, 2, 6);
  r(g, '#d07a4a', x + 3, y + 8, 10, 2); r(g, '#8f4a2a', x + 3, y + 9, 10, 1);
  const v = hash(tx, ty, 4) % 3;
  if (v === 0) { // round bush (san francisco / malunggay vibes)
    r(g, C.leaf, x + 2, y + 2, 12, 7); r(g, C.leaf, x + 4, y, 8, 2);
    r(g, C.leaf2, x + 4, y + 2, 4, 3); r(g, C.leaf2, x + 9, y + 4, 3, 2); r(g, '#2f6f3a', x + 3, y + 7, 10, 1);
  } else if (v === 1) { // snake plant blades
    for (const [bx, h] of [[4, 7], [6, 9], [8, 8], [10, 6], [12, 5]]) {
      r(g, C.leaf, x + bx, y + 9 - h, 2, h); r(g, '#c8d860', x + bx, y + 9 - h, 1, 1); r(g, C.leaf2, x + bx, y + 10 - h, 1, h - 2);
    }
  } else { // big leaves
    r(g, C.leaf, x + 1, y + 3, 6, 4); r(g, C.leaf, x + 9, y + 2, 6, 4); r(g, C.leaf, x + 5, y, 6, 5);
    r(g, C.leaf2, x + 2, y + 3, 3, 1); r(g, C.leaf2, x + 10, y + 2, 3, 1); r(g, C.leaf2, x + 6, y, 3, 1);
    r(g, '#2f6f3a', x + 7, y + 5, 2, 4);
  }
}

function counter(g, map, tx, ty, x, y) {
  const lf = map.ch(tx - 1, ty) === 'C', rt = map.ch(tx + 1, ty) === 'C';
  r(g, C.counter, x, y, TILE, 10);
  r(g, C.white, x, y, TILE, 1);
  r(g, C.counter2, x + 7, y + 1, 1, 9); r(g, C.counter2, x, y + 5, TILE, 1); // tiled top
  r(g, C.counter2, x, y + 10, TILE, 6);   // cabinet front
  r(g, C.woodLine, x, y + 10, TILE, 1);
  r(g, C.grout, x + 7, y + 11, 1, 5);
  r(g, C.dgray, x + 5, y + 12, 1, 2); r(g, C.dgray, x + 9, y + 12, 1, 2);
  shade(g, 0.3, x, y + 15, TILE, 1);
  if (!lf) r(g, C.grout, x, y, 1, TILE);
  if (!rt) r(g, C.grout, x + 15, y, 1, TILE);
  const h = hash(tx, ty, 5) % 5;
  if (h === 0) { // two-burner stove
    r(g, C.dgray, x + 1, y + 1, 14, 8); r(g, C.ink, x + 3, y + 3, 4, 4); r(g, C.ink, x + 9, y + 3, 4, 4);
    r(g, C.gray, x + 4, y + 4, 2, 2); r(g, C.gray, x + 10, y + 4, 2, 2);
  } else if (h === 1) { // sink + faucet
    r(g, C.fridge2, x + 2, y + 2, 12, 7); r(g, '#7a8a9a', x + 3, y + 3, 10, 5); r(g, C.gray, x + 7, y + 1, 2, 3);
  } else if (h === 2) { // rice cooker
    r(g, C.white, x + 4, y + 1, 8, 8); r(g, C.counter, x + 4, y + 7, 8, 2); r(g, C.pink, x + 6, y + 2, 4, 2); r(g, C.red, x + 10, y + 6, 1, 1);
  } else if (h === 3) { // chopping board
    r(g, C.wood, x + 3, y + 3, 9, 5); r(g, C.woodLine, x + 3, y + 7, 9, 1); r(g, C.gray, x + 12, y + 4, 2, 1);
  }
}

function fridge(g, x, y) {
  r(g, C.fridge2, x + 1, y, 14, TILE);
  r(g, C.fridge, x + 2, y + 1, 12, 5); r(g, C.fridge, x + 2, y + 7, 12, 8);
  r(g, C.white, x + 2, y + 1, 12, 1); r(g, C.white, x + 2, y + 7, 1, 8);
  r(g, C.dgray, x + 12, y + 2, 1, 3); r(g, C.dgray, x + 12, y + 9, 1, 4);
  r(g, C.red, x + 4, y + 3, 2, 2); r(g, C.gold, x + 7, y + 9, 2, 2); r(g, C.blue, x + 5, y + 11, 2, 1); // ref magnets
  shade(g, 0.3, x + 1, y + 15, 14, 1);
}

// ---------------------------------------------------------------- walls
function wallDecor(g, map, tx, ty, x, y, night) {
  const h = hash(tx, ty, 7);
  const k = h % 13;
  if (k === 0 || k === 1) { // capiz window
    r(g, C.table, x + 2, y + 3, 12, 10);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) r(g, night ? (i + j) % 2 ? '#3a4a7a' : '#2a3560' : (i + j) % 2 ? C.capiz2 : C.capiz, x + 3 + i * 2.5 | 0, y + 4 + j * 2, 2, 1);
    r(g, C.table2, x + 7, y + 3, 2, 10);
    return 'window';
  }
  if (k === 2) { // jalousie
    r(g, C.gray, x + 2, y + 3, 12, 10);
    for (let j = 0; j < 4; j++) { r(g, night ? '#3a4a7a' : '#bfe0ee', x + 3, y + 4 + j * 2, 10, 1); r(g, C.white, x + 3, y + 4 + j * 2, 3, 1); }
    return 'window';
  }
  if (k === 3 && map.ch(tx + 1, ty) === '#' && isFloorish(map.ch(tx + 1, ty + 1))) { // giant spoon + fork
    r(g, C.wood2, x + 7, y + 6, 2, 8); r(g, C.wood2, x + 6, y + 2, 4, 5); r(g, C.woodLine, x + 7, y + 3, 2, 3);
    r(g, C.wood2, x + 23, y + 6, 2, 8); r(g, C.wood2, x + 22, y + 4, 4, 3);
    for (let i = 0; i < 4; i++) r(g, C.wood2, x + 22 + i, y + 1, 1, 3);
    return 'art';
  }
  if (k === 4) { // wall clock
    r(g, C.ink, x + 4, y + 3, 8, 8); r(g, C.white, x + 5, y + 4, 6, 6); r(g, C.ink, x + 8, y + 5, 1, 3); r(g, C.ink, x + 8, y + 7, 2, 1);
    return 'art';
  }
  if (k === 5) { // calendar
    r(g, C.white, x + 4, y + 2, 8, 10); r(g, C.red, x + 4, y + 2, 8, 3);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) r(g, C.gray, x + 5 + i * 2, y + 6 + j * 2, 1, 1);
    return 'art';
  }
  if (k === 6) { // family photo
    r(g, C.gold2, x + 3, y + 3, 10, 8); r(g, '#9fd8e8', x + 4, y + 4, 8, 6);
    r(g, C.skin, x + 5, y + 6, 2, 2); r(g, C.skin, x + 9, y + 6, 2, 2); r(g, C.leaf, x + 4, y + 8, 8, 2);
    return 'art';
  }
  return null;
}

function wall(g, map, tx, ty, x, y, night, lights) {
  const below = map.ch(tx, ty + 1);
  if (!isWall(below)) {
    const outside = below === ';';
    r(g, C.wallD, x, y, TILE, 4);                 // top of the wall
    r(g, C.wallL, x, y, TILE, 1);
    if (outside) { // hollow-block fence
      r(g, C.block, x, y + 4, TILE, 12);
      for (let j = 0; j < 3; j++) {
        r(g, C.block2, x, y + 7 + j * 4, TILE, 1);
        const off = (j + tx) % 2 ? 0 : 8;
        r(g, C.block2, x + off, y + 4 + j * 4, 1, 3);
      }
      shade(g, 0.25, x, y + 14, TILE, 2);
    } else { // painted plaster with a wooden baseboard
      r(g, C.plaster, x, y + 4, TILE, 10);
      r(g, C.plaster2, x, y + 4, TILE, 1);
      r(g, C.table, x, y + 13, TILE, 3); r(g, C.table2, x, y + 13, TILE, 1);
      const d = wallDecor(g, map, tx, ty, x, y, night);
      if (d === 'window') lights.push({ x: x + 8, y: y + 16 });
    }
  } else {
    r(g, C.wallD, x, y, TILE, TILE);
    const k = hash(tx, ty, 8);
    r(g, C.wallT, x + (k % 12), y + ((k >>> 5) % 13), 3, 1);
  }
  // rims where the wall top meets the room
  if (!isWall(map.ch(tx - 1, ty))) r(g, C.wallL, x, y, 1, isWall(below) ? TILE : 4);
  if (!isWall(map.ch(tx + 1, ty))) r(g, C.ink, x + 15, y, 1, isWall(below) ? TILE : 4);
  if (!isWall(map.ch(tx, ty - 1)) && ty > 0) r(g, C.wallL, x, y, TILE, 1);
}

// ---------------------------------------------------------------- build
export function buildBackground(map, { night = false } = {}) {
  const cv = document.createElement('canvas');
  cv.width = map.w * TILE; cv.height = map.h * TILE;
  const g = cv.getContext('2d');
  const each = (fn) => { for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) fn(map.ch(tx, ty), tx, ty, tx * TILE, ty * TILE); };
  // 1. floors (furniture stands on the floor of its room)
  each((ch, tx, ty, x, y) => {
    if (isWall(ch)) return;
    if (ch === 'R') return rug(g, map, tx, ty, x, y);
    let f = ch;
    if (FURN.has(ch) || ch === 'D' || ch === 'd' || ch === 'G' || ch === 'g') {
      const nb = [map.ch(tx, ty + 1), map.ch(tx - 1, ty), map.ch(tx + 1, ty), map.ch(tx, ty - 1)].find((c) => c === '.' || c === ',' || c === ';');
      f = nb || '.';
    }
    floor(g, f, tx, ty, x, y);
  });
  // 2. contact shadows: under walls and furniture, along walls
  each((ch, tx, ty, x, y) => {
    if (!isFloorish(ch)) return;
    const up = map.ch(tx, ty - 1), lf = map.ch(tx - 1, ty);
    if (isWall(up)) { shade(g, 0.28, x, y, TILE, 2); shade(g, 0.14, x, y + 2, TILE, 2); }
    else if (FURN.has(up) && up !== 'P') shade(g, 0.22, x + 1, y, TILE - 1, 2);
    if (isWall(lf)) shade(g, 0.16, x, y, 2, TILE);
    else if (FURN.has(lf) && lf !== 'P') shade(g, 0.14, x, y + 2, 2, TILE - 2);
  });
  // 3. furniture
  each((ch, tx, ty, x, y) => {
    if (ch === 'T') table(g, map, tx, ty, x, y);
    else if (ch === 'S') sofa(g, map, tx, ty, x, y);
    else if (ch === 'B') bed(g, map, tx, ty, x, y);
    else if (ch === 'P') plant(g, tx, ty, x, y);
    else if (ch === 'C') counter(g, map, tx, ty, x, y);
    else if (ch === 'F') fridge(g, x, y);
  });
  // 4. walls
  const lights = [];
  each((ch, tx, ty, x, y) => { if (isWall(ch)) wall(g, map, tx, ty, x, y, night, lights); });
  // 5. sunlight falling through windows onto the floor (daytime only)
  if (!night) {
    g.globalAlpha = 0.13; g.fillStyle = C.yellow;
    for (const l of lights) for (let i = 0; i < 18; i++) {
      const w = 12 - Math.floor(i / 3), px = l.x - 6 + Math.floor(i / 2);
      if (!isFloorish(map.ch(Math.floor(px / TILE), Math.floor((l.y + i) / TILE)))) break;
      g.fillRect(px, l.y + i, w, 1);
    }
    g.globalAlpha = 1;
  }
  cv.windows = lights; // used by the night lighting (moonlight pools)
  return cv;
}
