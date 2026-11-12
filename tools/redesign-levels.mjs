// The 2026-11 room redesign of the thirteen older maps: less empty floor, loops instead of dead ends, two ways to
// every stash, real cover (wardrobes, market stalls, hanging laundry), adults with routines, a videoke at the
// fiesta, and two missions per level. Coins, quotas, boss phases and the story order are untouched, so the economy
// is exactly what it was. Idempotent: run it again and the files come out the same.
//   node tools/redesign-levels.mjs          (then npm test: the validator and the walkthrough bot check every map)
import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('../src/data/levels/', import.meta.url);
const load = (f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
const save = (f, L) => writeFileSync(new URL(f, dir), JSON.stringify(L, null, 1) + '\n');
const UP = -1.5708, DOWN = 1.5708, LEFT = 3.14159, RIGHT = 0;

// Put `missions` right after `hint` so the files read top-down: what it is, how to earn its stars, then the map.
function withMissions(L, missions) {
  const out = {};
  delete L.missions;
  for (const [k, v] of Object.entries(L)) { out[k] = v; if (k === 'hint') out.missions = missions; }
  if (!out.missions) out.missions = missions;
  return out;
}
// Stamp tiles onto a grid: [ch, x0, y0, x1 = x0, y1 = y0]
function stamp(tiles, list) {
  const g = tiles.map((r) => r.split(''));
  for (const [ch, x0, y0, x1 = x0, y1 = y0] of list) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = ch;
  return g.map((r) => r.join(''));
}
const setAt = (list, i, at) => { list[i].at = at; };

const LEVELS = {
  '01-sala.json': (L) => {
    L.tiles = [
      '###############',
      '#.....A....K..#',
      '#.............#',
      '#.TT......SSS.#',
      '#.TT..........#',
      '#.......RRR...#',
      '#.......RRR...#',
      '####..####..###',
      '#.............#',
      '#..H.......P..#',
      '#.TT..........#',
      '#.TT....SSS...#',
      '#..H..........#',
      '#......RRRR...#',
      '#.A....RRRR..K#',
      '#.............#',
      '#P............#',
      '#....SS....H..#',
      '#.............#',
      '#...........P.#',
      '#.............#',
      '###############',
    ];
    L.hide = [{ kind: 'curtain', at: [12, 1] }, { kind: 'box', at: [8, 9] }];
    L.alkansya.at = [13, 1];
    L.adults[0].route = [[1, 2, 1.5], [13, 2, 1.5], [13, 6, 1.5], [1, 6, 1.5]];
    return withMissions(L, ['fast', 'silent']);
  },
  '02-kusina.json': (L) => {
    L.tiles = [
      '###############',
      '#CCCCC..FF.CC.#',
      '#,,,,,,,,,,,,,#',
      '#,,,,,,,,,,,,,#',
      '#,,HTTTTH,,,,,#',
      '#,,,TTTT,,,,,W#',
      '#,,,,,,,,,,,,,#',
      '###..#####..###',
      '#.............#',
      '#..RRR....A...#',
      '#..RRR...SS...#',
      '#.........H..P#',
      '#......K......#',
      '####.####.#####',
      '#.............#',
      '#.BB...K...PP.#',
      '#.BB..........#',
      '#......H......#',
      '#..A..........#',
      '#.............#',
      '#.............#',
      '###############',
    ];
    // Mama cooks: at the stove her back is to the room
    L.adults[0].route = [[2, 2, 3.5, UP, 'luto'], [12, 3, 1], [12, 6, 1.5], [2, 6, 1]];
    return withMissions(L, ['silent', 'alkansya']);
  },
  '03-buong-bahay.json': (L) => {
    L.tiles = [
      '###############',
      '#.K.....#.....#',
      '#.......#.....#',
      '#.BB....D..TT.#',
      '#.BB..H.#..TT.#',
      '#.......#.H...#',
      '#A......#.....#',
      '#####D#####D###',
      '#.............#',
      '#.....K.......#',
      '#..SSS....RR..#',
      '#.........RR..#',
      '#..H.......A..#',
      '#.............#',
      '####D#######D##',
      '#......#......#',
      '#..CC..#.K....#',
      '#......#...PP.#',
      '#####G##......#',
      '#.....W#.H....#',
      '#......#......#',
      '###############',
    ];
    L.adults[0].route = [[1, 9, 1], [13, 9, 1.2], [13, 13, 3, DOWN, 'walis'], [1, 13, 1.2]];
    return withMissions(L, ['fast', 'noCatch']);
  },
  'boss1-lola.json': (L) => {
    L.tiles = [
      '###############',
      '#.....A.......#',
      '#.BB.......BB.#',
      '#.BB.......BB.#',
      '#.............#',
      '#...........K.#',
      '#.............#',
      '#..K..P.P.....#',
      '#.............#',
      '#.H...........#',
      '#..TT.....TT..#',
      '#.........H...#',
      '#.............#',
      '###D#######D###',
      '#.............#',
      '#.............#',
      '#..PP..SS..PP.#',
      '#......RR.....#',
      '#.............#',
      '#.A...........#',
      '#.............#',
      '###############',
    ];
    return withMissions(L, ['noWake', 'noTrap']);
  },
  '04-bakuran.json': (L) => {
    L.tiles = [
      '###############',
      '#...K#........#',
      '#....#..TT....#',
      '#....D......H.#',
      '#A...#..TT....#',
      '##D###D########',
      '#;;;;;;;;;;;;;#',
      '#;;;;;;;;LLL;;#',
      '#;;PP;;;;;;;;;#',
      '#;;;;;;;;;;;;;#',
      '#;;;LL;;;;;PP;#',
      '#;;;;;;;;W;;;;#',
      '######G########',
      '#;;;;;;;;;;;;;#',
      '#;;;;;;;;LL;;;#',
      '#;;;;;;;;;;;;;#',
      '#;W;;PP;;;;;;;#',
      '#;;;;;;;;;;;L;#',
      '#;;;;;;;;;PP;;#',
      '#;;;;;;;;;;;;;#',
      '#;;;;;;;;;;;;;#',
      '###############',
    ];
    L.hide = [{ kind: 'basket', at: [9, 9] }, { kind: 'box', at: [1, 8] }, { kind: 'curtain', at: [13, 2] }];
    L.adults[1].route = [[7, 1, 1.5, RIGHT], [13, 1, 1], [13, 4, 3.5, LEFT, 'idlip'], [7, 4, 1]]; // Tatay nods off in his chair
    L.hint = 'LAUNDRY HIDES YOU. PANDESAL KEEPS ASO BUSY';
    return withMissions(L, ['noBark', 'fast']);
  },
  'kwarto.json': (L) => {
    L.tiles = [
      '####################',
      '#BB..BB.P#.BB..K...#',
      '#BB..BB..#.BB......#',
      '#........#......H..#',
      '#.K......#.........#',
      '#........D....A....#',
      '#........#.....TT..#',
      '#..H.....#.........#',
      '#........#.........#',
      '####D#########D#####',
      '#..................#',
      '#.......RRRR...K...#',
      '#.....K.RRRR.......#',
      '#..................#',
      '####D#########D#####',
      '#,,,,,,,#..........#',
      '#C,,,,,,#.SSS......#',
      '#C,,,,,,#..........#',
      '#C,,,,,,#...RR..K..#',
      '#,,,TT,,#...RR.TT..#',
      '#,,,TT,,D..........#',
      '#,,,,,,,#.A........#',
      '#F,,,,,,#..........#',
      '#,,,,,,,#..H.......#',
      '#,,,,,,P#.........P#',
      '####################',
    ];
    L.traps = L.traps.map((t) => (t.at[0] === 4 && t.at[1] === 5 ? { ...t, at: [6, 6] } : t)); // (the lego was under Lola's chair)
    L.adults[0].route = [[2, 11, 3, LEFT, 'walis'], [17, 11, 1], [17, 12, 1], [2, 12, 1]];
    return withMissions(L, ['allCoins', 'noCatch']);
  },
  'boss2-mama.json': (L) => {
    L.tiles = [
      '###############',
      '#CCCC,,FF,CCC,#',
      '#,,,,,,,,,,,,,#',
      '#,,,,,,,,,,,,,#',
      '#,,TTTT,,,H,,,#',
      '#,,TTTT,,,,,,,#',
      '#,,,,,,,,,W,,,#',
      '#,,,,,,,,,,,,,#',
      '#,,,,CC,,,,,,,#',
      '#,,,,,,,,,,,,,#',
      '#,,,,,H,,,,,,,#',
      '####..###..####',
      '#.............#',
      '#.............#',
      '#...HTTH...A..#',
      '#.............#',
      '#.PP.......PP.#',
      '#......K......#',
      '#.............#',
      '#.............#',
      '#.............#',
      '###############',
    ];
    return withMissions(L, ['noCatch', 'noHide']);
  },
  '05-gabi.json': (L) => {
    L.tiles = [
      '###############',
      '#......#......#',
      '#.BB...#...BB.#',
      '#.BB...D...BB.#',
      '#K.....#......#',
      '###D#######D###',
      '#.............#',
      '#..........A..#',
      '#..TTT...SSS..#',
      '#..TTT........#',
      '#...K.........#',
      '#.............#',
      '######D####D###',
      '#,,,,,,#......#',
      '#,CCCC,#..H...#',
      '#,,,,,,D......#',
      '#,,,,,,#..PP..#',
      '#,,W,,,#......#',
      '#,CC,,,#.K....#',
      '#,,,,,,#......#',
      '#,,,,,,#......#',
      '###############',
    ];
    L.locks = [{ at: [7, 15], key: 'blue' }, { at: [11, 12], key: 'blue' }]; // the back way in from the sala takes the same key
    L.adults[0].route = [[2, 13, 4, UP, 'hugas'], [5, 16, 1], [2, 19, 2], [5, 13, 1]];
    return withMissions(L, ['noWake', 'alkansya']);
  },
  'sampayan.json': (L) => {
    L.tiles = stamp([
      '######################',
      '#;;;;;;;;;;;;;;#.....#',
      '#;;P;;;;;;;;;;;#.....#',
      '#;;;;;;;;;;;;;;#.....#',
      '#;;;;;;;;;;;;;;#.....#',
      '#;;;;;;;;;;;;;;#.....#',
      '#;;;;;;;;;;;;;;##D####',
      '#;;;;;;;;;;;;;;;;;;;;#',
      '#;;;;;;;;;;;;;;;;;;;;#',
      '#;;;P;;;;;;;;;;;;;P;;#',
      '#;;;;;;;;;;;;;;;;;;;;#',
      '#;;;;;;;;;;;;;;;;;;;;#',
      '##########G######G####',
      '#;;;;;;;;;;;;;;;;;;;;#',
      '#;;;;;P;;;;;;;;;;;;;;#',
      '#;;;;;;;;;;;;;;;P;;;;#',
      '#;;;;;;;;;;;;;;;;;;;;#',
      '#;;;;;;;;;;;;;;;;;;;;#',
      '#;;;;;;;;;;;;;;;;;;;;#',
      '#;;;;;;;;;;;;;;;;;;;;#',
      '#;;;;;;;;;;;;;;;;;;P;#',
      '#;;;;;;;;;;;;;;;;;;;;#',
      '#;;P;;;;;;;;P;;;;;;;;#',
      '#;;;;;;;;;;;;;;;;;;;;#',
      '#;;;;;;;;;;;;;;;;;;;;#',
      '######################',
    ], [['L', 5, 3, 8], ['L', 11, 8, 13], ['L', 2, 10, 4], ['L', 17, 10, 19], ['L', 8, 15, 11], ['L', 3, 18, 5], ['L', 16, 19, 18],
      ['W', 14, 5], ['W', 10, 20], ['K', 16, 2], ['A', 20, 4]]);
    // real washing hangs on the lines now, so the old "curtain" spots become baskets and boxes
    L.hide = [{ kind: 'basket', at: [4, 6] }, { kind: 'box', at: [10, 6] }, { kind: 'basket', at: [14, 10] }, { kind: 'box', at: [8, 17] },
      { kind: 'basket', at: [13, 17] }, { kind: 'basket', at: [1, 20] }, { kind: 'box', at: [20, 23] }];
    L.switches = [{ at: [2, 15], gates: [[10, 12]], time: 10 }, { at: [18, 16], gates: [[17, 12]], time: 10 }];
    L.adults[0].route = [[3, 4, 2], [12, 4, 2], [12, 10, 2], [5, 11, 2]];
    L.adults[2].route = [[3, 14, 1], [18, 14, 3.5, RIGHT, 'dilig'], [18, 21, 1], [3, 21, 1]]; // Tatay waters the plants
    L.hint = 'NOBODY SEES THROUGH LAUNDRY. LEVERS OPEN GATES FOR 10S';
    return withMissions(L, ['noBark', 'allCoins']);
  },
  'boss3-tatay.json': (L) => {
    L.tiles = [
      '###############',
      '#;;;;;;;;;;;;;#',
      '#;;P;;;;;;;P;;#',
      '#;;;;;;;;;;;;;#',
      '#;;;;;;;;;;;;;#',
      '#;;LL;;;;;LL;;#',
      '#;;;;;;W;;;;;;#',
      '#;;;;;;;;;;;;;#',
      '#;;;;;;;;;;;;;#',
      '#;P;;;LLL;;;P;#',
      '###D#######D###',
      '#.............#',
      '#.............#',
      '#..TT..K..SS..#',
      '#.............#',
      '#.............#',
      '#.PP.......PP.#',
      '#.............#',
      '#....H...A....#',
      '#.............#',
      '#.............#',
      '###############',
    ];
    return withMissions(L, ['noBark', 'noCatch']);
  },
  'palengke.json': (L) => {
    const base = Array.from({ length: 30 }, (_, y) => (y === 0 || y === 29 ? '#'.repeat(28) : '#' + ':'.repeat(26) + '#'));
    L.tiles = stamp(base, [
      ['T', 12, 1, 13],
      // tall stalls under awnings (nobody sees through them), with cross aisles cut through the long rows
      ['M', 3, 5, 6, 6], ['M', 8, 5, 10, 6], ['M', 14, 5, 17, 6], ['M', 19, 5, 24, 6],
      ['M', 3, 11, 8, 12], ['T', 12, 11, 16, 12], ['M', 20, 11, 25, 12],
      ['M', 3, 17, 5, 18], ['M', 7, 17, 10, 18], ['M', 14, 17, 19, 18], ['M', 21, 17, 24, 18],
      ['M', 3, 23, 8, 24], ['T', 12, 23, 16, 24], ['M', 20, 23, 25, 24],
      ['P', 2, 3], ['P', 26, 9], ['P', 1, 14], ['P', 11, 14], ['P', 12, 20], ['P', 26, 20], ['P', 11, 26], ['P', 26, 27],
      ['W', 11, 3], ['W', 24, 3], ['H', 9, 15], ['H', 16, 20], ['H', 5, 19], ['H', 22, 13], ['W', 18, 26],
    ]);
    // the tinderas mind their stalls: one counts the day's money, the other gossips, and neither is watching then
    L.adults[0] = { type: 'tindera', route: [[6, 7, 4, DOWN, 'bilang'], [9, 7, 2.5, DOWN]] };
    L.adults[1] = { type: 'tindera', route: [[19, 7, 2.5, DOWN], [16, 7, 4, LEFT, 'kwento']] };
    L.hint = 'STALLS BLOCK THE VIEW. TINDERAS SHOUT MAGNANAKAW!';
    return withMissions(L, ['noCatch', 'allCoins']);
  },
  'boss4-fiesta.json': (L) => {
    L.tiles = [
      '###############',
      '#.............#',
      '#.TTTT...TTTT.#',
      '#.............#',
      '#.............#',
      '#.............#',
      '#..SS.....SS..#',
      '#.............#',
      '#.............#',
      '#.TTTT...TTTT.#',
      '#.............#',
      '#.............#',
      '#.............#',
      '###..#####..###',
      '#.............#',
      '#.....HTTH....#',
      '#.............#',
      '#.P.........P.#',
      '#.............#',
      '#.............#',
      '#..A.......K..#',
      '###############',
    ];
    // the videoke: while a guest is singing, nobody in the hall can hear a thing
    L.devices = [{ kind: 'radio', at: [1, 7], dur: 10 }, { kind: 'videoke', at: [7, 9], r: 92, on: 9, off: 6 }];
    L.hint = 'WALK WITH A GUEST TO BLEND IN. VIDEOKE HIDES NOISE';
    return withMissions(L, ['noHide', 'noCatch']);
  },
  'barangay.json': (L) => {
    const t = L.tiles.map((r) => r.replace(/,/g, ':'));
    for (let y = 28; y <= 32; y++) t[y] = t[y].replace(/\./g, ':');
    L.tiles = stamp(t, [
      ['D', 4, 18], ['D', 21, 18],                                   // back doors between the middle and bottom rooms
      ['K', 7, 3], ['H', 2, 3], ['A', 6, 8], ['K', 17, 6], ['A', 24, 2],
      ['K', 7, 15], ['H', 4, 11], ['K', 18, 15], ['H', 22, 11],
      ['K', 7, 25], ['K', 18, 25], ['A', 1, 20], ['A', 24, 20],
      ['H', 11, 29], ['H', 14, 29], ['W', 23, 29], ['W', 2, 29],
    ]);
    L.adults[1].route = [[4, 30, 3, LEFT, 'walis'], [21, 30, 1], [21, 32, 1], [4, 32, 1]];
    return withMissions(L, ['noCatch', 'allCoins']);
  },
  // the story levels keep their rooms; they only gain missions
  'gatas.json': (L) => withMissions(L, ['noSpill', 'silent']),
  'ibalik.json': (L) => withMissions(L, ['silent', 'fast']),
  'bagyo.json': (L) => withMissions(L, ['thunder', 'noCatch']),
};

for (const [f, fn] of Object.entries(LEVELS)) {
  const L = fn(load(f));
  const w = L.tiles[0].length;
  L.tiles.forEach((r, i) => { if (r.length !== w) throw new Error(`${f}: row ${i} is ${r.length} wide, not ${w}`); });
  save(f, L);
  console.log('wrote', f);
}
