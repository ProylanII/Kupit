// Tile grid. DOM-free so it can be unit-tested in Node.
export const TILE = 16;

// '#' wall | '.' wood floor | ',' tile floor | 'R' rug (walkable)
// solid furniture: T table, S sofa, B bed, P plant, C counter, F fridge
// dynamic: D closed door (solid, blocks sight) / d open door,
//          G closed gate (solid, see-through bars) / g open gate
const SOLID = new Set('#TSBPCFDG');
const OPAQUE = new Set('#D');

export class TileMap {
  constructor(rows) {
    this.grid = rows.map((r) => r.split(''));
    this.h = this.grid.length;
    this.w = this.grid[0].length;
    this.version = 0; // bumps on every tile change (path caches use it)
  }
  ch(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return '#';
    return this.grid[ty][tx];
  }
  set(tx, ty, c) {
    if (this.ch(tx, ty) === c) return;
    this.grid[ty][tx] = c;
    this.version++;
  }
  tileSolid(tx, ty) { return SOLID.has(this.ch(tx, ty)); }
  isSolidAt(px, py) { return this.tileSolid(Math.floor(px / TILE), Math.floor(py / TILE)); }
  // Walls and closed doors stop sight; furniture and gate bars do not.
  blocksLosAt(px, py) { return OPAQUE.has(this.ch(Math.floor(px / TILE), Math.floor(py / TILE))); }
  // Axis-aligned box of half-size r centred on (x,y) overlaps something solid?
  blocked(x, y, r) {
    return this.isSolidAt(x - r, y - r) || this.isSolidAt(x + r, y - r) ||
           this.isSolidAt(x - r, y + r) || this.isSolidAt(x + r, y + r);
  }
}

export const tileCenter = (t) => t * TILE + TILE / 2;
export const toTile = (p) => Math.floor(p / TILE);
