// Placeholder pixel sprites built from character maps. Everything goes through
// getSprite()/drawActor() so Blender-rendered sheets can replace this file's
// internals later without touching gameplay code.
import { C } from './palette.js';

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
  mama: { H: '#3a2418', S: C.skin, T: C.red,   B: C.dgray,  F: C.skin2, E: C.ink, legsN: 4, longHair: true },
  lola: { H: C.white,  S: C.skin, T: C.purple, B: '#6b4a8c', F: C.skin2, E: C.ink, legsN: 4, skirt: true },
  tita: { H: C.pink,   S: C.skin, T: C.teal,   B: C.white,  F: C.skin2, E: C.ink, legsN: 4, longHair: true },
};

export function getSprite(kind, dir, frame) {
  const key = `${kind}|${dir}|${frame}`;
  let s = cache.get(key);
  if (s) return s;
  const look = LOOKS[kind];
  const view = dir === 3 ? 'back' : dir === 0 ? 'front' : 'side';
  let body = (view === 'back' ? BACK : view === 'front' ? FRONT : SIDE).slice();
  if (look.longHair) {
    body = body.map((r, y) => (y >= 4 && y <= 7 && view !== 'side')
      ? 'H' + r.slice(1, 9) + 'H'
      : (y >= 4 && y <= 7 && view === 'side') ? r.slice(0, 2).replace(/\./g, 'H') + r.slice(2) : r);
  }
  const rows = body.concat(legs(view, frame, look.legsN, look.skirt));
  let cv = build(rows, look);
  if (dir === 1) { // left = mirrored right
    const f = document.createElement('canvas');
    f.width = cv.width; f.height = cv.height;
    const g = f.getContext('2d');
    g.translate(cv.width, 0); g.scale(-1, 1); g.drawImage(cv, 0, 0);
    cv = f;
  }
  cache.set(key, cv);
  return cv;
}

// (x,y) is the entity's ground-centre; sprite feet sit just below it.
export function drawActor(g, kind, x, y, dir, frame, { dim = false } = {}) {
  const s = getSprite(kind, dir, frame);
  const px = Math.round(x) - Math.floor(s.width / 2), py = Math.round(y) + 6 - s.height;
  g.globalAlpha = 0.25; g.fillStyle = C.ink;
  g.fillRect(Math.round(x) - 5, Math.round(y) + 4, 10, 3);
  g.globalAlpha = 1;
  g.drawImage(s, px, py);
  if (dim) { g.globalAlpha = 0.35; g.fillStyle = C.ink; g.fillRect(px + 1, py + 1, s.width - 2, s.height - 2); g.globalAlpha = 1; }
  return py; // top of sprite, for placing icons
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

export function drawTarget(g, kind, x, y, done) {
  const pal = done
    ? { g: C.dgray, p: C.dgray, P: C.gray, c: C.gray, w: C.gray, W: C.dgray, i: C.gray, e: C.dgray }
    : { g: C.purse, p: C.purse, P: C.purse2, c: C.gold, w: '#d9c27a', W: '#b99a4a', i: C.pink, e: C.ink };
  const rows = { purse: PURSE, bayong: BAYONG, wallet: WALLET, piggy: PIGGY }[kind] || PURSE;
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
