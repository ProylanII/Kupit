import { TILE } from '../world/tilemap.js';
import { C } from './palette.js';

const r = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

function floor(g, ch, tx, ty, x, y) {
  if (ch === ';') { // grass (yard)
    r(g, (tx * 7 + ty * 3) % 3 ? C.leaf : '#4a9a52', x, y, TILE, TILE);
    r(g, C.leaf2, x + ((tx * 5 + ty) % 12) + 1, y + ((ty * 7 + tx) % 10) + 2, 1, 3);
    r(g, C.leaf2, x + ((tx * 3 + ty * 11) % 12) + 2, y + ((tx * 9) % 9) + 3, 1, 2);
  } else if (ch === ',') { // kitchen tile
    r(g, C.tile, x, y, TILE, TILE);
    r(g, C.tile2, x, y, 8, 8);
    r(g, C.tile2, x + 8, y + 8, 8, 8);
  } else { // wood planks
    r(g, (tx + ty) % 2 ? C.wood2 : C.wood, x, y, TILE, TILE);
    r(g, C.woodLine, x, y + 7 + ((tx * 3 + ty) % 2), TILE, 1);
    r(g, C.woodLine, x + ((ty * 5 + tx * 7) % TILE), y, 1, 7);
  }
}

function wall(g, map, tx, ty, x, y) {
  if (map.ch(tx, ty + 1) !== '#') {
    r(g, C.wallT, x, y, TILE, 10);
    r(g, C.wallL, x, y + 10, TILE, 2);
    r(g, C.wallD, x, y + 12, TILE, 4);
    r(g, C.wallL, x + ((tx * 5) % 12), y + 13, 3, 1);
  } else {
    r(g, C.wallT, x, y, TILE, TILE);
    r(g, C.wallL, x + ((tx * 7 + ty * 3) % 13), y + ((tx + ty * 5) % 13), 2, 1);
  }
}

function furniture(g, map, ch, tx, ty, x, y) {
  floor(g, map.ch(tx, ty + 1) === ';' || map.ch(tx - 1, ty) === ';' ? ';' : '.', tx, ty, x, y);
  switch (ch) {
    case 'T':
      r(g, C.table2, x, y, TILE, 12); r(g, C.table, x, y + 12, TILE, 4);
      r(g, C.white, x + 1, y + 1, TILE - 2, 1);
      break;
    case 'S':
      r(g, C.sofa, x, y + 1, TILE, 7); r(g, C.sofa2, x, y + 8, TILE, 6); r(g, C.sofa, x, y + 14, TILE, 2);
      if (map.ch(tx - 1, ty) !== 'S') r(g, C.sofa, x, y + 1, 3, 15);
      if (map.ch(tx + 1, ty) !== 'S') r(g, C.sofa, x + 13, y + 1, 3, 15);
      break;
    case 'B':
      r(g, C.bed2, x, y, TILE, TILE);
      if (map.ch(tx, ty - 1) !== 'B') { r(g, C.white, x + 2, y + 2, TILE - 4, 5); r(g, C.bed, x, y + 9, TILE, 7); }
      else r(g, C.bed, x, y + 4, TILE, 12);
      if (map.ch(tx - 1, ty) !== 'B') r(g, C.table, x, y, 1, TILE);
      if (map.ch(tx + 1, ty) !== 'B') r(g, C.table, x + 15, y, 1, TILE);
      break;
    case 'P':
      r(g, C.pot, x + 4, y + 9, 8, 6); r(g, C.table, x + 4, y + 14, 8, 1);
      r(g, C.leaf, x + 2, y + 2, 12, 8); r(g, C.leaf2, x + 5, y + 1, 4, 4); r(g, C.leaf2, x + 9, y + 5, 3, 3);
      break;
    case 'C':
      r(g, C.counter2, x, y, TILE, TILE); r(g, C.counter, x, y, TILE, 11);
      r(g, C.white, x, y, TILE, 1); r(g, C.counter2, x + 7, y + 12, 2, 3);
      break;
    case 'F':
      r(g, C.fridge2, x, y, TILE, TILE); r(g, C.fridge, x + 1, y + 1, TILE - 2, 7);
      r(g, C.fridge, x + 1, y + 9, TILE - 2, 6); r(g, C.dgray, x + 11, y + 4, 1, 3); r(g, C.dgray, x + 11, y + 11, 1, 3);
      break;
  }
}

export function buildBackground(map) {
  const cv = document.createElement('canvas');
  cv.width = map.w * TILE; cv.height = map.h * TILE;
  const g = cv.getContext('2d');
  for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) {
    const ch = map.ch(tx, ty), x = tx * TILE, y = ty * TILE;
    if (ch === '#') wall(g, map, tx, ty, x, y);
    else if ('TSBPCF'.includes(ch)) furniture(g, map, ch, tx, ty, x, y);
    else if (ch === 'R') {
      floor(g, '.', tx, ty, x, y);
      r(g, C.rugEdge, x, y, TILE, TILE); r(g, C.rug, x + 1, y + 1, TILE - 2, TILE - 2);
      r(g, C.rug2, x + 4, y + 4, 8, 8);
    } else floor(g, ch, tx, ty, x, y);
  }
  return cv;
}
