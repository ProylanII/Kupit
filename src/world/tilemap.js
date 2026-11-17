// Tile grid. DOM-free so it can be unit-tested in Node.
export const TILE = 16;

// '#' wall | '.' wood floor | ',' tile floor | ';' grass | ':' concrete | 'R' rug (walkable)
// low furniture (solid, you can see over it): T table, S sofa, B bed, P plant, C counter, F fridge,
//                                             H bangko (stool/bench), W water drum, A estante (low shelf)
// tall furniture (solid AND blocks sight):    K aparador (wardrobe), M market stall with an awning
// 'L' hanging laundry: walkable, but nobody sees through it (or into it)
// dynamic: D closed door (solid, blocks sight) / d open door,
//          G closed gate (solid, see-through bars) / g open gate
// BAGYO: '_' dirt under the house (walkable), 'I' a house post (solid, blocks sight), '~' the kanal (solid, see-through),
//        'Q' a sandbag (solid, see-through; pushed by walking into it)
const SOLID = new Set('#TSBPCFHWAKMDGI~Q');
const OPAQUE = new Set('#DKMLI');
export const FURNITURE = 'TSBPCFHWAKM';
export const FLOORS = '.,;:_';
export const CRAWL = new Set('TB'); // tables and beds: Bing (and only Bing) crawls under them
export const CAT_PASS = new Set('TBSCHAW'); // Mingming: up on tables, beds, sofas, counters, stools, shelves and drums

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
  tileSolid(tx, ty, pass = null) { const c = this.ch(tx, ty); return SOLID.has(c) && !(pass && pass.has(c)); }
  isSolidAt(px, py, pass = null) { return this.tileSolid(Math.floor(px / TILE), Math.floor(py / TILE), pass); }
  // Walls, closed doors, wardrobes, stalls and hanging laundry stop sight; low furniture and gate bars do not.
  blocksLosAt(px, py) { return OPAQUE.has(this.ch(Math.floor(px / TILE), Math.floor(py / TILE))); }
  // Axis-aligned box of half-size r centred on (x,y) overlaps something solid?
  // pass: tiles this mover may go through anyway (Bing's tables and beds)
  blocked(x, y, r, pass = null) {
    return this.isSolidAt(x - r, y - r, pass) || this.isSolidAt(x + r, y - r, pass) ||
           this.isSolidAt(x - r, y + r, pass) || this.isSolidAt(x + r, y + r, pass);
  }
}

export const tileCenter = (t) => t * TILE + TILE / 2;
export const toTile = (p) => Math.floor(p / TILE);
