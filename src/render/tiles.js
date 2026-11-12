// Static level background, drawn once per level into an offscreen canvas.
// Pass order: floors -> contact shadows -> furniture -> walls (with wall decor) -> window light.
import { TILE, FURNITURE } from '../world/tilemap.js';
import { C } from './palette.js';

const r = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const shade = (g, a, x, y, w, h, c = C.ink) => { g.globalAlpha = a; r(g, c, x, y, w, h); g.globalAlpha = 1; };
const hash = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

const FURN = new Set(FURNITURE);
const LOW_SHADOW = new Set('PHW'); // small round things: no long contact shadow
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
  } else if (ch === ':') { // poured concrete: big slabs, a few cracks and stains
    r(g, '#b4b0b8', x, y, TILE, TILE);
    if (ty % 2 === 0) r(g, '#9b97a3', x, y, TILE, 1);
    if ((tx + (ty >> 1)) % 3 === 0) r(g, '#9b97a3', x, y, 1, TILE);
    for (let i = 0; i < 3; i++) {
      const h = hash(tx, ty, 20 + i);
      r(g, i ? '#a6a2ae' : '#c2bec6', x + 1 + (h % 13), y + 1 + ((h >>> 6) % 13), 1 + (h >>> 12) % 2, 1);
    }
    const k = hash(tx, ty, 24);
    if (k % 11 === 0) { r(g, '#8d8996', x + 3 + (k >>> 4) % 7, y + 4, 1, 4); r(g, '#8d8996', x + 4 + (k >>> 4) % 7, y + 7, 2, 1); } // crack
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

// bangko: a wooden stool, or the white plastic monobloc chair every house has
function bangko(g, tx, ty, x, y) {
  shade(g, 0.25, x + 3, y + 13, 11, 2);
  if (hash(tx, ty, 11) % 2) {
    r(g, C.table, x + 3, y + 5, 10, 6); r(g, C.table2, x + 3, y + 5, 10, 2); r(g, C.wood, x + 4, y + 5, 8, 1);
    r(g, C.table, x + 3, y + 11, 2, 3); r(g, C.table, x + 11, y + 11, 2, 3);
  } else {
    r(g, C.counter, x + 4, y + 1, 8, 6); r(g, C.white, x + 4, y + 1, 8, 1); r(g, C.counter2, x + 6, y + 3, 1, 3); r(g, C.counter2, x + 9, y + 3, 1, 3);
    r(g, C.white, x + 3, y + 7, 10, 4); r(g, C.counter2, x + 3, y + 10, 10, 1);
    r(g, C.counter, x + 3, y + 11, 2, 3); r(g, C.counter, x + 11, y + 11, 2, 3);
  }
}

// a blue plastic water drum with a tabo floating in it
function drum(g, tx, ty, x, y) {
  shade(g, 0.25, x + 2, y + 13, 13, 2);
  r(g, '#24488f', x + 3, y + 4, 10, 11); r(g, C.blue, x + 3, y + 4, 8, 11); r(g, '#5f8fe0', x + 4, y + 5, 2, 9);
  r(g, '#24488f', x + 3, y + 9, 10, 1);
  r(g, C.blue, x + 2, y + 2, 12, 3); r(g, '#5f8fe0', x + 2, y + 2, 12, 1);
  r(g, '#9fd8e8', x + 4, y + 3, 8, 1);
  if (hash(tx, ty, 12) % 2) { r(g, C.red, x + 8, y + 2, 3, 2); r(g, C.red, x + 11, y + 1, 2, 1); } // tabo
}

// estante: a low shelf with the things a family keeps on it
function estante(g, map, tx, ty, x, y) {
  const lf = map.ch(tx - 1, ty) === 'A', rt = map.ch(tx + 1, ty) === 'A';
  r(g, C.table2, x, y + 4, TILE, 5); r(g, C.wood, x, y + 4, TILE, 1);       // top
  r(g, C.table, x, y + 9, TILE, 6); r(g, C.woodLine, x, y + 9, TILE, 1);    // front
  r(g, '#5c3620', x + 2, y + 11, 5, 3); r(g, '#5c3620', x + 9, y + 11, 5, 3); // open shelves
  r(g, C.red, x + 3, y + 12, 1, 2); r(g, C.gold, x + 4, y + 12, 1, 2); r(g, C.teal, x + 10, y + 12, 2, 2); // books
  shade(g, 0.3, x, y + 15, TILE, 1);
  if (!lf) r(g, C.table, x, y + 4, 1, 11);
  if (!rt) r(g, '#5c3620', x + 15, y + 4, 1, 11);
  const h = hash(tx, ty, 13) % 5;
  if (h === 0) { // little altar: santo, two candles
    r(g, C.red, x + 6, y, 4, 6); r(g, C.gold, x + 6, y, 4, 1); r(g, C.skin, x + 7, y + 1, 2, 2);
    r(g, C.white, x + 3, y + 3, 1, 3); r(g, C.white, x + 12, y + 3, 1, 3); r(g, C.yellow, x + 3, y + 2, 1, 1); r(g, C.yellow, x + 12, y + 2, 1, 1);
  } else if (h === 1) { // electric fan
    r(g, C.dgray, x + 7, y + 4, 2, 3); r(g, C.gray, x + 4, y - 1, 8, 6); r(g, C.fridge, x + 5, y, 6, 4); r(g, C.dgray, x + 7, y + 1, 2, 2);
  } else if (h === 2) { // framed photos
    r(g, C.gold2, x + 2, y + 1, 5, 5); r(g, '#9fd8e8', x + 3, y + 2, 3, 3); r(g, C.table, x + 9, y + 2, 5, 4); r(g, C.capiz, x + 10, y + 3, 3, 2);
  } else if (h === 3) { // trophy and a jar
    r(g, C.gold, x + 4, y, 4, 3); r(g, C.gold2, x + 5, y + 3, 2, 2); r(g, C.table, x + 4, y + 5, 4, 1);
    r(g, '#9fd8e8', x + 10, y + 2, 3, 4); r(g, C.red, x + 10, y + 1, 3, 1);
  } else { // folded clothes
    r(g, C.pink, x + 3, y + 3, 6, 2); r(g, C.white, x + 3, y + 2, 6, 1); r(g, C.sofa2, x + 10, y + 2, 4, 3);
  }
}

// aparador: a wardrobe taller than anyone in the house. Nobody sees past it.
function aparador(g, map, tx, ty, x, y) {
  const lf = map.ch(tx - 1, ty) === 'K', rt = map.ch(tx + 1, ty) === 'K', up = map.ch(tx, ty - 1) === 'K', dn = map.ch(tx, ty + 1) === 'K';
  r(g, '#5c3620', x, y, TILE, TILE);
  if (!dn) {
    r(g, C.table2, x, y, TILE, up ? 2 : 4); r(g, C.wood, x, y, TILE, 1);        // the top, catching the light
    r(g, C.table, x, y + (up ? 2 : 4), TILE, up ? 13 : 11);                      // doors
    r(g, '#5c3620', x + 7, y + (up ? 2 : 4), 1, 11); r(g, C.table2, x + 1, y + 5, 5, 8); r(g, C.table2, x + 9, y + 5, 5, 8);
    r(g, C.table, x + 2, y + 6, 3, 6); r(g, C.table, x + 10, y + 6, 3, 6);
    r(g, C.gold, x + 6, y + 9, 1, 2); r(g, C.gold, x + 8, y + 9, 1, 2);
    if (hash(tx, ty, 14) % 3 === 0) { r(g, '#9fd8e8', x + 10, y + 6, 3, 6); r(g, C.white, x + 10, y + 6, 1, 3); } // mirror door
    shade(g, 0.4, x, y + 15, TILE, 1);
  } else { r(g, C.table2, x, y, TILE, TILE); r(g, C.wood, x, y, TILE, 1); r(g, C.table, x + 7, y, 1, TILE); }
  if (!lf) r(g, C.table2, x, y, 1, TILE);
  if (!rt) r(g, C.ink, x + 15, y, 1, TILE);
  if (!up) r(g, C.wood, x, y, TILE, 1);
}

// tindahan: a market stall under a striped awning, goods piled in front
const AWNINGS = [[C.red, C.white], ['#2f5fbf', C.white], ['#2fa55b', C.yellow], [C.orange, C.white]];
function stall(g, map, tx, ty, x, y) {
  const up = map.ch(tx, ty - 1) === 'M', dn = map.ch(tx, ty + 1) === 'M', lf = map.ch(tx - 1, ty) === 'M', rt = map.ch(tx + 1, ty) === 'M';
  let sx = tx; while (map.ch(sx - 1, ty) === 'M') sx--;
  let sy = ty; while (map.ch(sx, sy - 1) === 'M') sy--;
  const [a, b] = AWNINGS[hash(sx, sy, 15) % AWNINGS.length];
  if (!dn) { // the front of the stall: crates of goods under the awning's edge
    for (let px = 0; px < TILE; px++) r(g, ((tx * TILE + px) >> 2) & 1 ? a : b, x + px, y, 1, up ? TILE - 9 : 7);
    r(g, C.ink, x, y + (up ? 6 : 6), TILE, 1);
    for (let px = 0; px < TILE; px += 4) r(g, ((tx * TILE + px) >> 2) & 1 ? a : b, x + px + 1, y + 7, 2, 1); // scalloped hem
    r(g, C.table, x, y + 9, TILE, 6); r(g, C.table2, x, y + 9, TILE, 1); r(g, '#5c3620', x + 7, y + 10, 1, 5);
    const h = hash(tx, ty, 16) % 4, goods = [[C.orange, C.yellow], [C.leaf2, C.leaf], [C.red, '#ffb0a0'], ['#9fb0bf', C.fridge]][h];
    for (let i = 0; i < 6; i++) { const k = hash(tx * 7 + i, ty, 17); r(g, goods[k & 1], x + 1 + (i % 3) * 5 + (k >>> 3) % 2, y + 8 + (i > 2 ? 2 : 0), 3, 2); }
    shade(g, 0.35, x, y + 15, TILE, 1);
  } else for (let px = 0; px < TILE; px++) r(g, ((tx * TILE + px) >> 2) & 1 ? a : b, x + px, y, 1, TILE); // the awning's roof
  if (!up) { r(g, C.white, x, y, TILE, 1); }
  if (!lf) r(g, C.ink, x, y, 1, TILE);
  if (!rt) r(g, C.ink, x + 15, y, 1, TILE);
}

// The top half of a wardrobe rises over the tile behind it: drawn OVER anyone standing there, so it reads as tall.
export function drawTallTop(g, map, tx, ty) {
  if (map.ch(tx, ty - 1) === 'K') return;
  const x = tx * TILE, y = ty * TILE - 9, lf = map.ch(tx - 1, ty) === 'K', rt = map.ch(tx + 1, ty) === 'K';
  r(g, C.ink, x, y - 1, TILE, 1);
  r(g, C.table2, x, y, TILE, 3); r(g, C.wood, x, y, TILE, 1);          // the top, catching the light
  r(g, C.table, x, y + 3, TILE, 6); r(g, '#5c3620', x + 7, y + 3, 1, 6); // the upper doors
  r(g, C.table2, x + 1, y + 4, 5, 5); r(g, C.table2, x + 9, y + 4, 5, 5);
  if (!lf) r(g, C.ink, x, y, 1, 9);
  if (!rt) r(g, C.ink, x + 15, y, 1, 9);
}

// Hanging laundry: drawn every frame OVER whoever is standing in it (see Play.drawOverlayTiles).
const CLOTHES = [[C.white, C.counter2], [C.pink, C.bed], ['#7fd7ff', C.blue], [C.yellow, C.gold2], [C.red, '#a83a3a'], [C.leaf2, C.leaf]];
export function drawLaundry(g, map, tx, ty, t) {
  const x = tx * TILE, y = ty * TILE;
  const vert = (map.ch(tx, ty - 1) === 'L' || map.ch(tx, ty + 1) === 'L') && map.ch(tx - 1, ty) !== 'L' && map.ch(tx + 1, ty) !== 'L';
  const sway = Math.round(Math.sin(t * 1.4 + tx * 0.9 + ty * 0.5));
  if (vert) { // a line running away from you: clothes seen edge-on, overlapping down the tile
    r(g, C.counter2, x + 7, y - 6, 1, TILE + 6);
    for (let i = 0; i < 2; i++) {
      const [c1, c2] = CLOTHES[hash(tx, ty, 30 + i) % CLOTHES.length], yy = y - 5 + i * 8;
      r(g, C.ink, x + 2 + sway, yy - 1, 12, 11);
      r(g, c1, x + 3 + sway, yy, 10, 9); r(g, c2, x + 3 + sway, yy + 7, 10, 2); r(g, c2, x + 11 + sway, yy, 2, 9);
    }
    return;
  }
  r(g, C.counter2, x, y - 5, TILE, 1); // the line
  const kind = hash(tx, ty, 31) % 3, [c1, c2] = CLOTHES[hash(tx, ty, 32) % CLOTHES.length];
  if (kind === 0) { // a bedsheet: the whole width of the tile
    r(g, C.ink, x, y - 5, TILE, 19);
    r(g, c1, x + 1, y - 4, 14, 8); r(g, c1, x + 1 + sway, y + 4, 14, 8); r(g, c2, x + 1 + sway, y + 11, 14, 1);
    for (let i = 3; i < 14; i += 4) r(g, c2, x + i + sway, y - 1, 1, 10);
  } else if (kind === 1) { // two shirts
    for (const ox of [0, 8]) {
      const [s1, s2] = CLOTHES[hash(tx + ox, ty, 33) % CLOTHES.length];
      r(g, C.ink, x + ox, y - 5, 8, 15);
      r(g, s1, x + ox + 1, y - 4, 6, 3); r(g, s1, x + ox + 2 + sway, y - 1, 4, 9); r(g, s2, x + ox + 2 + sway, y + 7, 4, 1);
      r(g, C.counter2, x + ox + 3, y - 4, 2, 1);
    }
  } else { // towel and shorts
    r(g, C.ink, x, y - 5, 9, 17); r(g, c1, x + 1, y - 4, 7, 8); r(g, c1, x + 1 + sway, y + 4, 7, 6); r(g, c2, x + 1 + sway, y + 6, 7, 2);
    r(g, C.ink, x + 9, y - 5, 7, 11); r(g, C.blue, x + 10, y - 4, 5, 5); r(g, C.blue, x + 10 + sway, y + 1, 2, 3); r(g, C.blue, x + 13 + sway, y + 1, 2, 3);
  }
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
    const outside = below === ';' || below === ':' || below === 'L';
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

// A small parol (star lantern) centred on (cx, cy).
export function parol(g, cx, cy, s = 1) {
  const P = ['..y..', '.yry.', 'yrrry', '.yry.', 'y.r.y'];
  P.forEach((row, j) => [...row].forEach((c, i) => { if (c !== '.') r(g, c === 'y' ? C.gold : C.red, cx - 2 * s + i * s, cy - 2 * s + j * s, s, s); }));
  r(g, C.gold2, cx, cy + 3 * s, s, 2 * s);
}

// ---------------------------------------------------------------- build
export function buildBackground(map, { night = false, pasko = false } = {}) {
  const cv = document.createElement('canvas');
  cv.width = map.w * TILE; cv.height = map.h * TILE;
  const g = cv.getContext('2d');
  const each = (fn) => { for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) fn(map.ch(tx, ty), tx, ty, tx * TILE, ty * TILE); };
  // 1. floors (furniture stands on the floor of its room)
  each((ch, tx, ty, x, y) => {
    if (isWall(ch)) return;
    if (ch === 'R') return rug(g, map, tx, ty, x, y);
    let f = ch;
    if (FURN.has(ch) || ch === 'L' || ch === 'D' || ch === 'd' || ch === 'G' || ch === 'g') {
      const nb = [map.ch(tx, ty + 1), map.ch(tx - 1, ty), map.ch(tx + 1, ty), map.ch(tx, ty - 1)].find((c) => c === '.' || c === ',' || c === ';' || c === ':');
      f = nb || '.';
    }
    floor(g, f, tx, ty, x, y);
    if (ch === 'L') shade(g, 0.18, x + 1, y + 11, TILE - 2, 4); // the shadow of the washing on the ground
  });
  // 2. contact shadows: under walls and furniture, along walls
  each((ch, tx, ty, x, y) => {
    if (!isFloorish(ch)) return;
    const up = map.ch(tx, ty - 1), lf = map.ch(tx - 1, ty);
    if (isWall(up)) { shade(g, 0.28, x, y, TILE, 2); shade(g, 0.14, x, y + 2, TILE, 2); }
    else if (FURN.has(up) && !LOW_SHADOW.has(up)) shade(g, up === 'K' || up === 'M' ? 0.34 : 0.22, x + 1, y, TILE - 1, up === 'K' || up === 'M' ? 4 : 2);
    if (isWall(lf)) shade(g, 0.16, x, y, 2, TILE);
    else if (FURN.has(lf) && !LOW_SHADOW.has(lf)) shade(g, 0.14, x, y + 2, lf === 'K' || lf === 'M' ? 4 : 2, TILE - 2);
  });
  // 3. furniture
  each((ch, tx, ty, x, y) => {
    if (ch === 'T') table(g, map, tx, ty, x, y);
    else if (ch === 'S') sofa(g, map, tx, ty, x, y);
    else if (ch === 'B') bed(g, map, tx, ty, x, y);
    else if (ch === 'P') plant(g, tx, ty, x, y);
    else if (ch === 'C') counter(g, map, tx, ty, x, y);
    else if (ch === 'F') fridge(g, x, y);
    else if (ch === 'H') bangko(g, tx, ty, x, y);
    else if (ch === 'W') drum(g, tx, ty, x, y);
    else if (ch === 'A') estante(g, map, tx, ty, x, y);
    else if (ch === 'K') aparador(g, map, tx, ty, x, y);
    else if (ch === 'M') stall(g, map, tx, ty, x, y);
  });
  // 4. walls
  const lights = [];
  each((ch, tx, ty, x, y) => { if (isWall(ch)) wall(g, map, tx, ty, x, y, night, lights); });
  // 5. sunlight falling through windows onto the floor (daytime only)
  if (!night) {
    g.globalAlpha = 0.13; g.fillStyle = C.yellow;
    for (const l of lights) for (let i = 0; i < 18; i++) {
      const w = 12 - Math.floor(i / 3), px = l.x - 6 + Math.floor(i / 2);
      if (!isFloorish(map.ch(Math.floor(px / TILE), Math.floor((l.y + i) / TILE))) || l.outside) break;
      g.fillRect(px, l.y + i, w, 1);
    }
    g.globalAlpha = 1;
  }
  // 6. Pasko: Christmas lights strung along the walls and a parol in every window
  if (pasko) {
    const bulbs = [C.red, C.green, C.gold, '#4f8fff', C.pink];
    each((ch, tx, ty, x, y) => {
      if (!isWall(ch) || isWall(map.ch(tx, ty + 1))) return;
      for (let i = 0; i < 4; i++) {
        const bx = x + 2 + i * 4, by = y + 5 + ((i + tx) % 2);
        r(g, C.ink, bx, by - 1, 1, 1);
        r(g, bulbs[(tx * 4 + i) % bulbs.length], bx, by, 2, 2);
      }
    });
    for (const l of lights) parol(g, l.x, l.y - 9);
  }
  cv.windows = lights; // used by the night lighting (moonlight pools)
  cv.pasko = pasko;
  return cv;
}
