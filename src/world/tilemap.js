// Tile grid. DOM-free so it can be unit-tested in Node.
export const TILE = 16;

// '#' wall | '.' wood floor | ',' tile floor | ';' grass | ':' concrete | 'R' rug (walkable)
// low furniture (solid, you can see over it): T table, S sofa, B bed, P plant, C counter, F fridge,
//                                             H bangko (stool/bench), W water drum, A estante (low shelf)
// tall furniture (solid AND blocks sight):    K aparador (wardrobe), M market stall with an awning
// 'L' hanging laundry: walkable, but nobody sees through it (or into it)
// dynamic: D closed door (solid, blocks sight) / d open door,
//          G closed gate (solid, see-through bars) / g open gate
const SOLID = new Set('#TSBPCFHWAKMDG');
const OPAQUE = new Set('#DKML');
export const FURNITURE = 'TSBPCFHWAKM';
export const FLOORS = '.,;:';

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
  // Walls, closed doors, wardrobes, stalls and hanging laundry stop sight; low furniture and gate bars do not.
  blocksLosAt(px, py) { return OPAQUE.has(this.ch(Math.floor(px / TILE), Math.floor(py / TILE))); }
  // Axis-aligned box of half-size r centred on (x,y) overlaps something solid?
  blocked(x, y, r) {
    return this.isSolidAt(x - r, y - r) || this.isSolidAt(x + r, y - r) ||
           this.isSolidAt(x - r, y + r) || this.isSolidAt(x + r, y + r);
  }
}

export const tileCenter = (t) => t * TILE + TILE / 2;
export const toTile = (p) => Math.floor(p / TILE);
