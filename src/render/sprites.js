// Placeholder pixel sprites built from character maps. Everything goes through
// getSprite()/drawActor() so Blender-rendered sheets can replace this file's
// internals later without touching gameplay code.
import { C } from './palette.js';
import { atlasSprite } from './atlas.js';
import { OUTFITS } from '../game/progression.js';

const cache = new Map();

// Turn a char-map into a canvas with an automatic 1px ink outline.
function build(rows, pal) {
  const w = rows[0].length, h = rows.length;
  const cv = document.createElement('canvas');
  cv.width = w + 2; cv.height = h + 2;
  const g = cv.getContext('2d');
  g.fillStyle = C.ink;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (rows[y][x] === '.') continue;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || rows[ny][nx] === '.') g.fillRect(nx + 1, ny + 1, 1, 1);
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = rows[y][x];
    if (c === '.') continue;
    g.fillStyle = pal[c] || C.ink;
    g.fillRect(x + 1, y + 1, 1, 1);
  }
  return cv;
}

const FRONT = [
  '..HHHHHH..', '.HHHHHHHH.', '.HSSSSSSH.', '.HSESSESH.', '..SSSSSS..',
  '.TTTTTTTT.', 'STTTTTTTTS', 'STTTTTTTTS', '.TTTTTTTT.',
];
const BACK = [
  '..HHHHHH..', '.HHHHHHHH.', '.HHHHHHHH.', '.HHHHHHHH.', '..HHHHHH..',
  '.TTTTTTTT.', 'STTTTTTTTS', 'STTTTTTTTS', '.TTTTTTTT.',
];
const SIDE = [ // facing right
  '..HHHHHH..', '.HHHHHHHH.', '.HHHHSSSH.', '.HHHHSESH.', '..HHHSSS..',
  '..TTTTTT..', '..TTTTTT..', '..TTTTTSS.', '..TTTTTT..',
];

function legs(view, frame, n, skirt) {
  const rows = [];
  for (let y = 0; y < n; y++) {
    let r = '';
    for (let x = 0; x < 10; x++) {
      let on = false;
      if (skirt && y < 2) on = x >= 1 && x <= 8;
      else if (view === 'side') {
        const back = frame === 1 ? [2, 3] : frame === 3 ? [4, 5] : [3, 4];
        const front = frame === 1 ? [6, 7] : frame === 3 ? [4, 5] : [5, 6];
        on = (x >= back[0] && x <= back[1]) || (x >= front[0] && x <= front[1]);
      } else {
        const la = n - (frame === 1 ? 1 : 0), lb = n - (frame === 3 ? 1 : 0);
        on = (x >= 2 && x <= 3 && y < la) || (x >= 6 && x <= 7 && y < lb);
      }
      r += on ? (y === n - 1 ? 'F' : skirt && y < 2 ? 'B' : skirt ? 'F' : 'B') : '.';
    }
    rows.push(r);
  }
  return rows;
}

export const LOOKS = {
  kid:  { H: C.ink,    S: C.skin, T: C.gold,   B: C.blue,   F: C.skin2, E: C.ink, legsN: 2 },
  jun:  { H: C.ink,    S: C.skin, T: C.gold,   B: C.blue,   F: C.skin2, E: C.ink, legsN: 2 },
  bing: { H: C.ink,    S: C.skin, T: C.pink,   B: C.purple, F: C.skin2, E: C.ink, legsN: 2, longHair: true },
  ramil: { H: '#3a2418', S: C.skin2, T: C.green, B: C.dgray, F: C.skin2, E: C.ink, legsN: 3 },
  nene: { H: '#3a2418', S: C.skin, T: C.orange, B: C.white, F: C.skin2, E: C.ink, legsN: 2, longHair: true },
  mama: { H: '#3a2418', S: C.skin, T: C.red,   B: C.dgray,  F: C.skin2, E: C.ink, legsN: 4, longHair: true },
  lola: { H: C.white,  S: C.skin, T: C.purple, B: '#6b4a8c', F: C.skin2, E: C.ink, legsN: 4, skirt: true },
  tita: { H: C.pink,   S: C.skin, T: C.teal,   B: C.white,  F: C.skin2, E: C.ink, legsN: 4, longHair: true },
  tatay: { H: C.ink,   S: C.skin2, T: C.white, B: '#3a4f8a', F: C.skin2, E: C.ink, legsN: 4 },
  nena: { H: C.gray,   S: C.skin, T: C.blue,   B: '#3a4f8a', F: C.skin2, E: C.ink, legsN: 4, longHair: true },
  ninang: { H: '#6b4a8c', S: C.skin, T: '#c0306a', B: '#8a2050', F: C.skin2, E: C.ink, legsN: 4, skirt: true },
  kuya: { H: '#3a2418', S: C.skin, T: '#46a0e0', B: C.dgray, F: C.skin2, E: C.ink, legsN: 3 },
};

// Aso (askal dog): own maps, H fur, D dark fur, E eye, N nose
const DOG_PAL = { H: '#c98a4a', D: '#8a5a2b', E: C.ink, N: C.ink };
const DOG_SIDE = [
  '.........DD.', '........HHHN', 'D.......HEHH', '.DHHHHHHHHH.', '..HHHHHHHH..', '..HHHHHHHH..',
];
const DOG_LEGS = [['..H.H..H.H..', '..D.D..D.D..'], ['.H...H.H...H', '.D...D.D...D']];
const DOG_FRONT = ['.DD..DD.', '.HHHHHH.', '.HEHHEH.', '.HHNNHH.', '..HHHH..', '.HHHHHH.', '.HHHHHH.'];
const DOG_BACK = ['.DD..DD.', '.HHHHHH.', '.HHHHHH.', '.HHHHHH.', '..HHHH..', '.HHHHHH.', '.HHDDHH.'];
const DOG_FB_LEGS = [['.H.HH.H.', '.D.DD.D.'], ['.H.HH.H.', '.D....D.']];

function dogRows(dir, frame) {
  const f = frame % 2;
  if (dir === 0) return DOG_FRONT.concat(DOG_FB_LEGS[f]);
  if (dir === 3) return DOG_BACK.concat(DOG_FB_LEGS[f]);
  return DOG_SIDE.concat(DOG_LEGS[f]);
}

function mirror(cv) {
  const f = document.createElement('canvas');
  f.width = cv.width; f.height = cv.height;
  const g = f.getContext('2d');
  g.translate(cv.width, 0); g.scale(-1, 1); g.drawImage(cv, 0, 0);
  return f;
}

// ---- palette swaps -----------------------------------------------------------------
// The sheet uses exact palette colours (tools/art/make_art.py), so swapping a few hex values recolours a
// character cleanly. Kids: 'jun~pula' = Jun in the PULA outfit (outfits live in game/progression.js).
// Adults: a few extra characters are recoloured versions of existing ones (no new art needed).
export const KID_SLOTS = { // the top / bottom colours (base, shade) of each kid in the sheet
  jun:   { top: ['#ffd84d', '#e0a92e'], bottom: ['#2f5fbf', '#24488f'] },
  bing:  { top: ['#ff7eb6', '#d9578f'], bottom: null }, // one-piece dress
  ramil: { top: ['#2fa55b', '#227a43'], bottom: ['#3a3550', '#2a2640'] },
  nene:  { top: ['#ff9a3c', '#d9762a'], bottom: null }, // white skirt shares the eye-white colour
  kid:   { top: ['#ffd84d', '#e0a92e'], bottom: ['#2f5fbf', '#24488f'] },
};
export const VARIANTS = {
  bisita:  { base: 'tita', map: { '#2fa59b': '#ff9a3c', '#22807a': '#d9762a', '#7fe0d4': '#ffe36b', '#ff7eb6': '#2a1f33', '#d9578f': '#1b1424', '#ffb0d4': '#4a3d5c' } },
  tanod:   { base: 'kuya', map: { '#46a0e0': '#c9a46a', '#3580b8': '#a6824a', '#2f5fbf': '#3a3550', '#24488f': '#2a2640', '#5a5468': '#3a3550', '#46415a': '#2a2640' } },
  tindera: { base: 'nena', map: { '#4f7fd0': '#46e08a', '#3a62a8': '#2fa55b', '#6b3a5a': '#a8433f', '#4f2a44': '#7a2a2a', '#9a94a8': '#2a1f33', '#7a7488': '#1b1424', '#c4bfd0': '#4a3d5c' } },
  // the three kittens are one sprite in three coats
  tigre:   { base: 'kuting', map: {} },
  puti:    { base: 'kuting', map: { '#ff9a3c': '#f6f1e7', '#d9762a': '#cfc7b8', '#a8433f': '#9a94a8' } },
  muning:  { base: 'kuting', map: { '#ff9a3c': '#9a94a8', '#d9762a': '#7a7488', '#a8433f': '#5a5468' } },
};
export const KITTEN_LOOKS = ['tigre', 'puti', 'muning'];

// kind -> { base, map } for swapped kinds, else null
function swapOf(kind) {
  if (VARIANTS[kind]) return VARIANTS[kind];
  const i = kind.indexOf('~');
  if (i < 0) return null;
  const base = kind.slice(0, i), o = OUTFITS[kind.slice(i + 1)], slots = KID_SLOTS[base];
  const map = {};
  if (o && slots) {
    if (o.top) slots.top.forEach((c, k) => { map[c] = o.top[k]; });
    if (o.bottom && slots.bottom) slots.bottom.forEach((c, k) => { map[c] = o.bottom[k]; });
  }
  return { base, map };
}

const rgbKey = (r, g, b) => (r << 16) | (g << 8) | b;
export function recolor(src, map) {
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const g = cv.getContext('2d');
  g.drawImage(src, 0, 0);
  const m = new Map(Object.entries(map).map(([a, b]) => { const p = (h) => parseInt(h.slice(1), 16); return [p(a), [p(b) >> 16, (p(b) >> 8) & 255, p(b) & 255]]; }));
  if (!m.size || !cv.width) return cv;
  const img = g.getImageData(0, 0, cv.width, cv.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const to = m.get(rgbKey(d[i], d[i + 1], d[i + 2]));
    if (to) { d[i] = to[0]; d[i + 1] = to[1]; d[i + 2] = to[2]; }
  }
  g.putImageData(img, 0, 0);
  return cv;
}

// frame: 0..3 walk cycle, or a pose name from the sheet ('reach', 'alert', 'sleep', 'caught').
// Poses the sheet lacks (or the code placeholders) fall back to the idle frame.
export function getSprite(kind, dir, frame) {
  const key = `${kind}|${dir}|${frame}`;
  let s = cache.get(key);
  if (s) return s;
  const sw = swapOf(kind);
  if (sw) {
    s = recolor(getSprite(sw.base, dir, frame), sw.map);
    cache.set(key, s);
    return s;
  }
  if (kind === 'trike') {
    s = mapSprite('trike', OBJ.trike, OBJ_PAL.trike);
    if (dir === 1) s = mirror(s);
    cache.set(key, s);
    return s;
  }
  const art = atlasSprite(`${kind}|${dir === 1 ? 2 : dir}|${frame}`); // real art, if a sprite sheet is installed
  if (!art && typeof frame === 'string') { s = getSprite(kind, dir, 0); cache.set(key, s); return s; }
  if (art) {
    const cv = dir === 1 ? mirror(art) : art;
    cache.set(key, cv);
    return cv;
  }
  if (kind === 'aso') {
    let cv = build(dogRows(dir, frame), DOG_PAL);
    if (dir === 1) cv = mirror(cv);
    cache.set(key, cv);
    return cv;
  }
  const look = LOOKS[kind] || LOOKS.kid;
  const view = dir === 3 ? 'back' : dir === 0 ? 'front' : 'side';
  let body = (view === 'back' ? BACK : view === 'front' ? FRONT : SIDE).slice();
  if (look.longHair) {
    body = body.map((r, y) => (y >= 4 && y <= 7 && view !== 'side')
      ? 'H' + r.slice(1, 9) + 'H'
      : (y >= 4 && y <= 7 && view === 'side') ? r.slice(0, 2).replace(/\./g, 'H') + r.slice(2) : r);
  }
  const rows = body.concat(legs(view, frame, look.legsN, look.skirt));
  let cv = build(rows, look);
  if (dir === 1) cv = mirror(cv); // left = mirrored right
  cache.set(key, cv);
  return cv;
}

// (x,y) is the entity's ground-centre; sprite feet sit just below it.
export function drawActor(g, kind, x, y, dir, frame, { dim = false } = {}) {
  const s = getSprite(kind, dir, frame);
  const px = Math.round(x) - Math.floor(s.width / 2), py = Math.round(y) + 6 - s.height;
  const sw = Math.max(8, s.width - 4); // soft oval shadow under the feet
  g.globalAlpha = 0.25; g.fillStyle = C.ink;
  g.fillRect(Math.round(x) - (sw >> 1), Math.round(y) + 4, sw, 3);
  g.fillRect(Math.round(x) - (sw >> 1) + 1, Math.round(y) + 3, sw - 2, 1);
  g.globalAlpha = 1;
  g.drawImage(s, px, py);
  if (dim) { g.globalAlpha = 0.35; g.fillStyle = C.ink; g.fillRect(px + 1, py + 1, s.width - 2, s.height - 2); g.globalAlpha = 1; }
  return py; // top of sprite, for placing icons
}

// 28x28 bust from the sprite sheet (menus, boss banners, story panels). mood: happy | sad | angry | shock
// (falls back to the neutral face). Returns false when the sheet has none.
export function drawPortrait(g, kind, x, y, scale = 1, mood = '') {
  const key = `portrait|${kind}|${mood || ''}`;
  let s = cache.get(key);
  if (!s) {
    const sw = swapOf(kind), base = sw ? sw.base : kind;
    const art = (mood && atlasSprite(`portrait|${base}|${mood}`)) || atlasSprite(`portrait|${base}`);
    if (!art) return false;
    s = sw ? recolor(art, sw.map) : art;
    cache.set(key, s);
  }
  g.drawImage(s, Math.round(x), Math.round(y), s.width * scale, s.height * scale);
  return true;
}

function mapSprite(name, rows, pal) {
  const key = `m|${name}`;
  if (!cache.has(key)) cache.set(key, build(rows, pal));
  return cache.get(key);
}

const PURSE = [
  '..gggg..', '.g....g.', 'pppppppp', 'pPPPPPPp', 'pPPccPPp', 'pPPPPPPp', '.pppppp.',
];
const BAYONG = [
  '..g..g..', '.g....g.', 'wwwwwwww', 'wWwWwWww', 'wWwWwWww', 'wWwWwWww', '.wwwwww.',
];
const WALLET = [
  'pppppppp', 'pPPPPPPp', 'pPPPPccp', 'pPPPPPPp', 'pppppppp',
];
const PIGGY = [
  '..i..i....', '.iiiiiiii.', 'iiiiiiiiie', 'iiiiiiiiii', '.iiiiiiii.', '..i..i....',
];

const CANDY = [ // garapon of candy: the real prize
  '..llll..', '.gggggg.', 'gGrGyGbg', 'gyGbGrGg', 'gGgGgyGg', 'gbGrGyGg', '.gggggg.',
];
const ALKANSYA = [ // bamboo coin bank with a slot on top
  '..ss..', 'aAAAAa', 'aAAAAa', 'nnnnnn', 'aAAAAa', 'aAAAAa', 'nnnnnn', 'aAAAAa',
];

const GATAS = ['.bb.', '.ww.', 'wWWw', 'wWWw', 'wWWw', 'wwww']; // a bottle of fresh milk
const KUTING = ['o..o....', 'oooo....', 'oeoe..o.', 'ooooooo.', '.oooooo.', '.o.o.o..'];
const REGALO = ['.yy.yy.', '..yyy..', 'rrryrrr', 'rrryrrr', 'RRRyRRR', 'RRRyRRR'];
const STORY_TARGETS = {
  gatas: [GATAS, { b: '#4f8fff', w: '#cfd6e0', W: '#ffffff' }],
  kuting: [KUTING, { o: '#e8a04a', e: '#1a1626' }],
  regalo: [REGALO, { y: '#ffd84d', r: '#d94a4a', R: '#a83a3a' }],
};

export function drawTarget(g, kind, x, y, done) {
  if (STORY_TARGETS[kind]) { // taken = gone (the milk is in your hands, the kitten is in your shirt)
    if (done) return;
    if (kind === 'kuting' && atlasSprite('kuting|0|sit')) { // a real kitten, one of the three coats
      const k = getSprite(KITTEN_LOOKS[(Math.round(x / 16) + Math.round(y / 16)) % 3], 0, 'sit');
      g.drawImage(k, Math.round(x) - Math.floor(k.width / 2), Math.round(y) - Math.floor(k.height / 2) + 1);
      return;
    }
    const s = mapSprite(kind, ...STORY_TARGETS[kind]);
    g.drawImage(s, Math.round(x) - Math.floor(s.width / 2), Math.round(y) - Math.floor(s.height / 2) + 1);
    return;
  }
  if (kind === 'ibalik') { kind = 'purse'; done = !done; } // putting coins back: empty until you fill it
  const pal = done
    ? { g: C.dgray, p: C.dgray, P: C.gray, c: C.gray, w: C.gray, W: C.dgray, i: C.gray, e: C.dgray, l: C.dgray, G: C.gray, r: C.gray, y: C.gray, b: C.gray, a: C.dgray, A: C.gray, n: C.dgray, s: C.ink }
    : { g: C.purse, p: C.purse, P: C.purse2, c: C.gold, w: '#d9c27a', W: '#b99a4a', i: C.pink, e: C.ink, l: C.red, G: '#9fd8e8', r: C.red, y: C.gold, b: '#4f8fff', a: '#7fae4a', A: '#a7cf6a', n: '#d9c27a', s: C.ink };
  const rows = { purse: PURSE, bayong: BAYONG, wallet: WALLET, piggy: PIGGY, candy: CANDY, alkansya: ALKANSYA }[kind] || PURSE;
  if (kind === 'candy') pal.g = done ? C.dgray : '#cfe9f2';
  const s = mapSprite(`${kind}|${done}`, rows, pal);
  g.drawImage(s, Math.round(x) - Math.floor(s.width / 2), Math.round(y) - Math.floor(s.height / 2) + 1);
}

const COIN = ['.ooo.', 'oyyyo', 'oyyyo', 'oyyyo', '.ooo.'];
export function drawCoin(g, x, y) {
  g.drawImage(mapSprite('coin', COIN, { o: C.gold2, y: C.gold }), Math.round(x), Math.round(y));
}
const STAR = ['..y..', 'yyyyy', '.yyy.', '.y.y.', 'y...y'];
export function drawStar(g, x, y, on) {
  g.drawImage(mapSprite(`star${on}`, STAR, { y: on ? C.gold : C.dgray }), Math.round(x), Math.round(y));
}

// ---- Phase 2 objects -------------------------------------------------------
export const OBJ = {
  box: [ // karton box: lit top with tape, front with a FRAGILE label
    'LLLLLttLLLLL', 'LBBBBttBBBBL', 'LBBBBttBBBBL', 'dddddddddddd', 'bbbbbbbbbbbb',
    'bbwwwwbbbbbb', 'bbwrrwbbbbbb', 'bbwwwwbbbbbd', 'bbbbbbbbbbdd',
  ],
  curtain: [ // floral curtain on a rod
    'orrrrrrrrrro', 'cCCcCCcCCcCC', 'cCfcCCcfCcCf', 'cCCcCCcCCcCC', 'cfCcCfcCCcfC', 'cCCcCCcCCcCC',
    'cCCcfCcCfcCC', 'cCCcCCcCCcCC', 'cCfcCCcfCcCf', 'cCCcCCcCCcCC', 'hhhhhhhhhhhh', 'h.hh.hh.hh.h',
  ],
  basket: [ // labahan with clothes poking out
    '..pp.bb.yy..', '.pppbbbbyyy.', 'RRRRRRRRRRRR', 'sWsWsWsWsWsW', 'WsWsWsWsWsWs', 'sWsWsWsWsWsW', '.ssssssssss.',
  ],
  tsinelas: ['.ggg..ggg.', 'gGGGggGGGg', '.ggg..ggg.'],
  pandesal: ['.pppp.', 'pPPPPp', 'pPPPPp', '.pppp.'],
  key: ['kk.....', 'k.kkkkk', 'kk...k.'],
  tv: [ // CRT with rabbit ears in a wooden cabinet
    '..a....a....', '...a..a.....', '....mm......', 'WWWWWWWWWWWW', 'WmmmmmmmmWkW', 'WmssssssmWWW',
    'WmssssssmWkW', 'WmssssssmWWW', 'WmmmmmmmmWWW', 'wwwwwwwwwwww', '.w........w.',
  ],
  radio: ['...a......', 'mmmmmmmmmm', 'mggmmmmggm', 'mggmsssmgm', 'mggmmmmggm', 'mmmmmmmmmm'],
  leverOff: ['.h....', '..h...', '...h..', 'bbbbbb', 'bBBBBb', 'bbbbbb'],
  leverOn: ['....h.', '...h..', '..h...', 'bbbbbb', 'bBBBBb', 'bbbbbb'],
  sandok: ['..ss..', '.ssss.', '.ssss.', '..hh..', '..hh..', '..hh..'],
  pot: ['.s.s..', '..s.s.', 'pppppp', 'pBBBBp', '.pppp.'],
  lego: ['rr..bb', 'rr..bb', '..yy..', 'gg.yy.', 'gg....'],
  // tricycle (side view, facing right): roofed sidecar + motorbike with driver
  trike: [
    '..bbbbbbbbbb........', '..b........b....hh..', '.bbbbbbbbbbbb..hhhh.', '.bwwwwwwwwwwb...ss..',
    '.bwwwwwwwwwwbrrrssr.', '.bbbbbbbbbbbbrrrrrrr', '.BBBBBBBBBBBBrrrrrr.', '..kk......kk....kk..',
    '.kggk....kggk..kggk.', '..kk......kk....kk..',
  ],
  // videoke machine: a speaker tower with a little screen and a mic on top
  videoke: [
    '....mm....', '...mggm...', 'kkkkkkkkkk', 'kssssssssk', 'kspsssyssk', 'kssssssssk', 'kkkkkkkkkk',
    'kWWWkkWWWk', 'kWkWkkWkWk', 'kWWWkkWWWk', 'kkkkkkkkkk', '.k......k.',
  ],
  // action-button icons
  hand: ['..h.h..', '.hhhhh.', '.hhhhhh', 'hhhhhh.', '.hhhhh.', '..hhh..'],
  door: ['dddd', 'dDDd', 'dDDd', 'dDyd', 'dDDd', 'dDDd'],
  lock: ['.kkk.', 'k...k', 'yyyyy', 'yykyy', 'yyyyy'],
  out: ['..w..', '.www.', 'wwwww', '.www.', '.www.'],
  eye: ['..kkk..', '.kwwwk.', 'kwwkwwk', '.kwwwk.', '..kkk..'],
  alkansya: ALKANSYA,
  // parol: the Christmas star lantern
  parol: ['....y....', '...yry...', 'yyyyryyyy', '.yyrrryy.', '..yrrry..', '.yy.r.yy.', 'yy..r..yy', '....r....', '...r.r...'],
};

const OBJ_PAL = {
  box: { L: '#dca868', B: '#c48a4a', t: '#e8d9a8', d: '#6e4424', b: '#a8723a', w: C.white, r: C.red },
  curtain: { r: C.dgray, o: C.gold, c: '#4a7fb5', C: '#6a9fd5', f: C.white, h: '#3a62a8' },
  basket: { R: '#e0b070', W: '#d9b27c', s: '#a67a42', p: C.pink, b: '#4f8fff', y: C.yellow },
  tsinelas: { g: C.blue, G: '#5f8fe0' },
  pandesal: { p: '#a8642c', P: '#e0a35a' },
  tv: { m: C.ink, s: '#3a4a6a', a: C.gray, W: C.table2, w: C.table, k: C.gold },
  radio: { m: C.dgray, g: C.gray, s: C.gold, a: C.gray },
  videoke: { m: C.dgray, g: C.gray, k: '#3a3550', s: '#4f8fff', p: C.pink, y: C.yellow, W: C.gray },
  leverOff: { h: C.gray, b: C.dgray, B: C.red },
  leverOn: { h: C.gray, b: C.dgray, B: C.green },
  sandok: { s: C.gray, h: C.table2 },
  pot: { s: C.white, p: C.dgray, B: '#b8423a' },
  lego: { r: C.red, b: C.blue, y: C.gold, g: C.green },
  trike: { b: '#4f8fff', B: C.blue, w: '#9fd8e8', r: C.red, h: '#3a2418', s: C.skin2, k: C.ink, g: C.gray },
  hand: { h: C.skin },
  door: { d: C.table, D: C.table2, y: C.gold },
  lock: { k: C.ink, y: C.gold },
  out: { w: C.white },
  eye: { k: C.ink, w: C.white },
  alkansya: { a: '#7fae4a', A: '#a7cf6a', n: '#d9c27a', s: C.ink },
  parol: { y: C.gold, r: C.red },
};

export const KEY_COLORS = { red: C.red, blue: '#4f8fff', green: C.green, gold: C.gold };

export function objSprite(name, variant = '') {
  let pal = OBJ_PAL[name];
  if (name === 'key') pal = { k: KEY_COLORS[variant] || C.gold };
  return mapSprite(`o|${name}|${variant}`, OBJ[name], pal);
}

// centred on (x,y)
export function drawObj(g, name, x, y, variant) {
  const s = objSprite(name, variant);
  g.drawImage(s, Math.round(x) - Math.floor(s.width / 2), Math.round(y) - Math.floor(s.height / 2));
}
