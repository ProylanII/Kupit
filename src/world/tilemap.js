// Tile grid. DOM-free so it can be unit-tested in Node.
export const TILE = 16;

// '#' wall | '.' wood floor | ',' tile floor | 'R' rug (walkable)
// solid furniture: T table, S sofa, B bed, P plant, C counter, F fridge
const SOLID = new Set('#TSBPCF');

export class TileMap {
  constructor(rows) {
    this.rows = rows;
    this.h = rows.length;
    this.w = rows[0].length;
  }
  ch(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return '#';
    return this.rows[ty][tx];
  }
  tileSolid(tx, ty) { return SOLID.has(this.ch(tx, ty)); }
  isSolidAt(px, py) { return this.tileSolid(Math.floor(px / TILE), Math.floor(py / TILE)); }
  // Only walls stop sight; low furniture does not.
  blocksLosAt(px, py) { return this.ch(Math.floor(px / TILE), Math.floor(py / TILE)) === '#'; }
  // Axis-aligned box of half-size r centred on (x,y) overlaps something solid?
  blocked(x, y, r) {
    return this.isSolidAt(x - r, y - r) || this.isSolidAt(x + r, y - r) ||
           this.isSolidAt(x - r, y + r) || this.isSolidAt(x + r, y + r);
  }
}

export const tileCenter = (t) => t * TILE + TILE / 2;
