import { Input, VIEW_W, VIEW_H } from './core/input.js';
import { loadSave, writeSave } from './core/save.js';
import { sfx, setMuted, isMuted } from './core/audio.js';
import { Play } from './scenes/play.js';
import { drawText } from './ui/font.js';
import { drawActor, drawStar, drawTarget } from './render/sprites.js';
import { C } from './render/palette.js';
import { drawMenu, drawButton, buttonRect, menuHit, hit } from './ui/menu.js';

const canvas = document.getElementById('game');
const g = canvas.getContext('2d');
g.imageSmoothingEnabled = false;
const input = new Input(canvas);
const save = loadSave();
setMuted(save.muted);

// ---- integer-ish pixel scaling ------------------------------------------
function resize() {
  const de = document.documentElement;
  const s0 = Math.min(de.clientWidth / VIEW_W, de.clientHeight / VIEW_H);
  const s = s0 >= 2 ? Math.floor(s0) : s0;
  canvas.style.width = `${VIEW_W * s}px`;
  canvas.style.height = `${VIEW_H * s}px`;
}
addEventListener('resize', resize);
resize();

// ---- levels ---------------------------------------------------------------
async function loadLevels() {
  const base = new URL('./data/levels/', import.meta.url);
  const files = await (await fetch(new URL('index.json', base))).json();
  return Promise.all(files.map(async (f) => (await fetch(new URL(f, base))).json()));
}

let levels = [];
let idx = 0;
let mode = 'loading'; // loading | title | levels | help | play | paused | caught | clear
let play = null;
let age = 0;
let sel = 0;       // highlighted menu item
let scroll = 0;    // level-select scroll offset
let prevMode = 'title'; // where BACK goes from levels/help
let newBest = false;

const setMode = (m) => { mode = m; age = 0; sel = 0; };
const unlockedMax = () => Math.min(save.unlocked, levels.length - 1);

function start(i) {
  idx = i;
  play = new Play(levels[idx], input);
  input.reset();
  setMode('play');
}

function toggleSound() {
  setMuted(!isMuted());
  save.muted = isMuted();
  writeSave(save);
  sfx.click();
}

function pause() { if (mode === 'play') setMode('paused'); }

function dim(a = 0.6) {
  g.globalAlpha = a; g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H); g.globalAlpha = 1;
}

// Returns the activated item index (or -1). Handles keyboard up/down/enter and taps.
// `ready` blocks input briefly so a stray tap doesn't skip a screen.
function menuPick(n, y0, gap = 22, ready = true) {
  if (!ready) return -1;
  if (input.pressed('ArrowUp') || input.pressed('w')) sel = (sel + n - 1) % n;
  if (input.pressed('ArrowDown') || input.pressed('s')) sel = (sel + 1) % n;
  const h = menuHit(input.tapPos, n, y0, gap);
  if (h >= 0) { sel = h; sfx.unlock(); return h; }
  if (input.pressed('Enter') || input.pressed(' ') || input.pressed('e')) { sfx.unlock(); return sel; }
  return -1;
}

const soundLabel = () => `SOUND: ${isMuted() ? 'OFF' : 'ON'}`;

// ---- title ------------------------------------------------------------------
const TITLE_Y = 196;
function titleItems() {
  return [save.unlocked > 0 ? `CONTINUE: LEVEL ${unlockedMax() + 1}` : 'PLAY', 'LEVELS', 'HOW TO PLAY', soundLabel()];
}

function drawTitle() {
  g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let x = 0; x < VIEW_W; x += 16) { g.fillStyle = (x / 16) % 2 ? C.wood : C.wood2; g.fillRect(x, 166, 16, 16); }
  const t = performance.now() / 1000;
  const kx = 40 + ((t * 18) % 120);
  drawActor(g, 'kid', kx, 174, 2, Math.floor(t * 6) % 4);
  drawTarget(g, 'purse', 190, 174, false);
  drawActor(g, 'mama', 215, 180, 1, 0);
  drawText(g, 'KUPIT', VIEW_W / 2, 50, C.gold, { scale: 9, align: 'center', shadow: C.gold2 });
  drawText(g, 'SNEAK. KUPIT. ESCAPE.', VIEW_W / 2, 112, C.white, { align: 'center' });
  drawMenu(g, titleItems(), sel, TITLE_Y);
  drawText(g, 'A PIXEL STEALTH GAME', VIEW_W / 2, 336, C.dgray, { align: 'center' });
  drawText(g, 'M: SOUND', VIEW_W / 2, 348, C.dgray, { align: 'center' });
}

function updateTitle() {
  const pick = menuPick(4, TITLE_Y);
  if (pick === 0) start(unlockedMax());
  else if (pick === 1) { prevMode = 'title'; setMode('levels'); sel = unlockedMax(); }
  else if (pick === 2) { prevMode = 'title'; setMode('help'); }
  else if (pick === 3) toggleSound();
}

// ---- level select -------------------------------------------------------------
const ROW_H = 38, ROWS_Y = 36, VISIBLE = 7;
const rowRect = (i) => ({ x: 14, y: ROWS_Y + (i - scroll) * ROW_H, w: VIEW_W - 28, h: ROW_H - 4 });
const backRect = () => buttonRect(0, 332, 22, 100);

function updateLevels() {
  const n = levels.length;
  if (input.pressed('ArrowUp') || input.pressed('w')) sel = (sel + n) % (n + 1);
  if (input.pressed('ArrowDown') || input.pressed('s')) sel = (sel + 1) % (n + 1);
  if (input.pressed('Escape')) { setMode(prevMode); return; }
  scroll = Math.max(0, Math.min(Math.max(0, n - VISIBLE), sel - 3));
  let pick = -1;
  const tp = input.tapPos;
  if (tp) {
    if (hit(tp, backRect())) pick = n;
    else for (let i = scroll; i < Math.min(n, scroll + VISIBLE); i++) if (hit(tp, rowRect(i))) pick = i;
    if (pick >= 0) sel = pick;
  }
  if (pick < 0 && (input.pressed('Enter') || input.pressed(' ') || input.pressed('e'))) pick = sel;
  if (pick < 0) return;
  sfx.unlock();
  if (pick === n) setMode(prevMode);
  else if (pick <= save.unlocked) start(pick);
  else sfx.creak();
}

function drawLevels() {
  g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H);
  drawText(g, 'CHOOSE A LEVEL', VIEW_W / 2, 14, C.gold, { scale: 2, align: 'center', shadow: C.gold2 });
  const n = levels.length;
  for (let i = scroll; i < Math.min(n, scroll + VISIBLE); i++) {
    const r = rowRect(i), lock = i > save.unlocked, on = sel === i;
    g.fillStyle = on ? C.gold : C.ink; g.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
    g.fillStyle = lock ? C.dgray : C.wallD; g.fillRect(r.x, r.y, r.w, r.h);
    drawText(g, String(i + 1), r.x + 6, r.y + 6, lock ? C.gray : C.gold, { scale: 3 });
    drawText(g, lock ? 'LOCKED' : levels[i].name, r.x + 28, r.y + 6, lock ? C.gray : C.white);
    const best = save.best[levels[i].id];
    if (!lock) drawText(g, best ? `BEST ${Math.floor(best)}S  PAR ${levels[i].par}S` : `PAR ${levels[i].par}S`, r.x + 28, r.y + 18, C.gray);
    if (!lock) for (let k = 0; k < 3; k++) drawStar(g, r.x + r.w - 50 + k * 15, r.y + 6, k < (save.stars[levels[i].id] || 0));
  }
  if (scroll > 0) drawText(g, '^', VIEW_W / 2, 26, C.gray, { align: 'center' });
  if (scroll + VISIBLE < n) drawText(g, 'V', VIEW_W / 2, 322, C.gray, { align: 'center' });
  drawButton(g, backRect(), 'BACK', sel === n);
}

// ---- how to play ----------------------------------------------------------------
const HELP = [
  ['GOAL', 'TAKE THE COINS, THEN REACH THE EXIT.'],
  ['MOVE', 'DRAG ANYWHERE OR WASD. DRAG FAR / SHIFT RUNS, BUT RUNNING IS LOUD.'],
  ['KUPIT', 'STAND AT A PURSE AND HOLD THE BIG BUTTON: E OR SPACE.'],
  ['SEEN?', 'YELLOW CONE: THEY SEE YOU. IF IT TURNS RED THEY CHASE!'],
  ['HIDE', 'PRESS TAGO AT A BOX, CURTAIN OR BASKET. MOVE TO COME OUT.'],
  ['THROW', 'SMALL BUTTON OR Q THROWS ITEMS. NOISE LURES ADULTS AWAY.'],
  ['DOORS', 'DOORS BLOCK SIGHT. KEYS OPEN LOCKS. LEVERS OPEN GATES.'],
  ['STARS', 'CLEAR IT, BEAT PAR TIME, AND NEVER GET REALLY SPOTTED.'],
];

function wrap(text, cols) {
  const out = []; let line = '';
  for (const w of text.split(' ')) {
    if ((line + ' ' + w).trim().length > cols) { out.push(line); line = w; } else line = (line + ' ' + w).trim();
  }
  if (line) out.push(line);
  return out;
}

function drawHelp() {
  g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H);
  drawText(g, 'HOW TO PLAY', VIEW_W / 2, 14, C.gold, { scale: 2, align: 'center', shadow: C.gold2 });
  let y = 38;
  for (const [h, body] of HELP) {
    drawText(g, h, 12, y, C.yellow);
    const lines = wrap(body, 52);
    lines.forEach((l, i) => drawText(g, l, 12, y + 9 + i * 8, C.white));
    y += 9 + lines.length * 8 + 12;
  }
  drawButton(g, backRect(), 'BACK', true);
}

function updateHelp() {
  if (input.pressed('Escape') || input.pressed('Enter') || input.pressed(' ') || input.pressed('e') || hit(input.tapPos, backRect())) {
    sfx.unlock(); setMode(prevMode);
  }
}

// ---- pause ------------------------------------------------------------------------
const PAUSE_Y = 150;
function drawPaused() {
  play.draw(g);
  dim(0.75);
  drawText(g, 'PAUSED', VIEW_W / 2, 100, C.gold, { scale: 5, align: 'center', shadow: C.gold2 });
  drawMenu(g, ['RESUME', 'RESTART', 'LEVELS', soundLabel(), 'TITLE'], sel, PAUSE_Y);
}

function updatePaused() {
  if (input.pressed('Escape') || input.pressed('p')) { input.reset(); setMode('play'); return; }
  const pick = menuPick(5, PAUSE_Y);
  if (pick === 0) { input.reset(); setMode('play'); }
  else if (pick === 1) start(idx);
  else if (pick === 2) { prevMode = 'paused'; setMode('levels'); sel = idx; }
  else if (pick === 3) toggleSound();
  else if (pick === 4) setMode('title');
}

// ---- caught / clear -----------------------------------------------------------------
const END_Y = 236;
function drawCaught() {
  play.draw(g);
  dim();
  const a = play.catcher;
  if (play.reason === 'time') {
    drawText(g, 'KAIN NA!', VIEW_W / 2, 100, C.orange, { scale: 5, align: 'center', shadow: C.ink });
    drawText(g, `${a ? a.cfg.name : 'MAMA'}: "DINNER TIME! COME HERE!"`, VIEW_W / 2, 155, C.white, { align: 'center' });
  } else {
    drawText(g, 'CAUGHT!', VIEW_W / 2, 100, C.red, { scale: 6, align: 'center', shadow: C.ink });
    drawText(g, `${a.cfg.name}: "${a.cfg.shout}"`, VIEW_W / 2, 155, C.white, { align: 'center' });
  }
  drawText(g, `COINS ${play.world.coins}/${levels[idx].quota}   TIME ${Math.floor(play.world.time)}S`, VIEW_W / 2, 175, C.gray, { align: 'center' });
  if (age > 0.5) drawMenu(g, ['TRY AGAIN', 'LEVELS', 'TITLE'], sel, END_Y);
}

function updateCaught() {
  const pick = menuPick(3, END_Y, 22, age > 0.5);
  if (pick === 0) start(idx);
  else if (pick === 1) { prevMode = 'title'; setMode('levels'); sel = idx; }
  else if (pick === 2) setMode('title');
}

function drawClear() {
  play.draw(g);
  dim(0.75);
  const r = play.result;
  const last = idx === levels.length - 1;
  drawText(g, last ? 'ALL DONE!' : 'NICE KUPIT!', VIEW_W / 2, 80, C.gold, { scale: 5, align: 'center', shadow: C.gold2 });
  for (let i = 0; i < 3; i++) drawStar(g, VIEW_W / 2 - 22 + i * 15, 130, i < r.stars);
  drawText(g, `COINS ${r.coins}   TIME ${Math.floor(r.time)}S`, VIEW_W / 2, 155, C.white, { align: 'center' });
  drawText(g, newBest ? 'NEW BEST TIME!' : `BEST ${Math.floor(save.best[levels[idx].id] || r.time)}S`, VIEW_W / 2, 167, newBest ? C.green : C.gray, { align: 'center' });
  drawText(g, `${r.fast ? 'FAST + ' : `PAR ${levels[idx].par}S  `}${r.stealth ? 'SILENT' : 'SPOTTED A BIT'}`, VIEW_W / 2, 179, C.gray, { align: 'center' });
  if (age > 0.5) drawMenu(g, [last ? 'TITLE' : 'NEXT LEVEL', 'PLAY AGAIN', 'LEVELS'], sel, END_Y);
}

function updateClear() {
  const last = idx === levels.length - 1;
  const pick = menuPick(3, END_Y, 22, age > 0.5);
  if (pick === 0) { if (last) setMode('title'); else start(idx + 1); }
  else if (pick === 1) start(idx);
  else if (pick === 2) { prevMode = 'title'; setMode('levels'); sel = Math.min(idx + 1, levels.length - 1); }
}

function afterPlay() {
  if (play.status === 'caught') setMode('caught');
  else if (play.status === 'clear') {
    setMode('clear');
    const id = levels[idx].id, t = play.result.time;
    newBest = !save.best[id] || t < save.best[id];
    if (newBest) save.best[id] = t;
    save.stars[id] = Math.max(save.stars[id] || 0, play.result.stars);
    save.unlocked = Math.max(save.unlocked, Math.min(idx + 1, levels.length - 1));
    save.bank += play.result.coins;
    writeSave(save);
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  age += dt;
  input.buttonEnabled = mode === 'play';
  if (input.pressed('m')) toggleSound();

  const m = mode; // dispatch on the mode at frame start so one keypress can't act on two screens
  if (m === 'play') {
    if (input.pauseTap || input.pressed('Escape') || input.pressed('p')) pause();
    else { play.update(dt); if (play.status !== 'play') afterPlay(); }
    if (mode === 'play') play.draw(g);
  }
  const screens = { title: [updateTitle, drawTitle], levels: [updateLevels, drawLevels], help: [updateHelp, drawHelp],
    paused: [updatePaused, drawPaused], caught: [updateCaught, drawCaught], clear: [updateClear, drawClear] };
  if (screens[m]) { screens[m][0](); if (mode === m) screens[m][1](); } // skip the draw if the screen just changed
  else if (m === 'loading') { g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H); drawText(g, 'LOADING...', VIEW_W / 2, 170, C.white, { align: 'center' }); }

  input.endFrame();
  requestAnimationFrame(frame);
}

addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

loadLevels().then((l) => {
  levels = l;
  setMode('title');
  const jump = Number(new URLSearchParams(location.search).get('level')); // ?level=2 jumps to level 2
  if (jump >= 1 && jump <= levels.length) start(jump - 1);
}).catch((e) => {
  console.error(e);
  mode = 'loading';
});
requestAnimationFrame(frame);

// Debug hook for automated checks: window.__kupit
window.__kupit = { get play() { return play; }, get mode() { return mode; }, start, input, save };
