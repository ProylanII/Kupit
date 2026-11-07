import { Input, VIEW_W, VIEW_H } from './core/input.js';
import { loadSave, writeSave } from './core/save.js';
import { sfx, setMuted, isMuted } from './core/audio.js';
import { Play } from './scenes/play.js';
import { drawText } from './ui/font.js';
import { drawActor, drawStar, drawTarget, drawCoin } from './render/sprites.js';
import { CHARACTERS, CHAR_ORDER } from './game/progression.js';
import { generateHouse, dailySeed, dailyId } from './game/house.js';
import { C } from './render/palette.js';
import { shopScreen, charScreen } from './scenes/shop.js';
import { dev, initDev, setDev, SPEEDS } from './core/dev.js';
import { music } from './core/music.js';
import { loadAtlas } from './render/atlas.js';
import { setHaptics, hapticsOn, vibrate } from './core/haptics.js';
import { drawMenu, drawButton, buttonRect, menuHit, hit } from './ui/menu.js';

const canvas = document.getElementById('game');
const g = canvas.getContext('2d');
g.imageSmoothingEnabled = false;
const input = new Input(canvas);
const save = loadSave();
setMuted(save.muted);
initDev();
setHaptics(save.haptics !== false);

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
let cur = null;   // the level being played (handmade or generated)
let run = null;   // null for campaign, { seed, diff, daily } for Random House
let mode = 'loading'; // loading | title | levels | help | house | dev | store | chars | play | paused | caught | clear
let play = null;
let age = 0;
let sel = 0;       // highlighted menu item
let scroll = 0;    // level-select scroll offset
let prevMode = 'title'; // where BACK goes from levels/help
let newBest = false;
let earned = 0;
let bossBonus = 0;

const FADE = 0.25;
let fadeT = 0, chaseHold = 0, audioReady = false;
const setMode = (m) => {
  const quiet = (x) => x === 'paused' || x === 'dev';
  fadeT = quiet(m) || quiet(mode) ? 0 : FADE; // quick fade-in between screens (not for pause)
  mode = m; age = 0; sel = 0;
};
const unlockedMax = () => Math.min(save.unlocked, levels.length - 1);

function launch() {
  play = new Play(cur, input, { char: save.char, upgrades: save.upgrades });
  input.reset();
  setMode('play');
}

function start(i) { idx = i; run = null; cur = levels[i]; launch(); }

function startHouse(seed, diff, daily = false) {
  run = { seed, diff, daily };
  cur = generateHouse(seed, diff);
  launch();
}

const restart = () => launch();
const newSeed = () => 1000 + Math.floor(Math.random() * 9000);

function toggleSound() {
  setMuted(!isMuted());
  save.muted = isMuted();
  writeSave(save);
  music.refresh();
  sfx.click();
}

function toggleHaptics() {
  save.haptics = !hapticsOn();
  setHaptics(save.haptics);
  writeSave(save);
  vibrate(40);
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
const TITLE_Y = 184, TITLE_GAP = 19;
function titleItems() {
  return [save.unlocked > 0 ? `CONTINUE: LEVEL ${unlockedMax() + 1}` : 'PLAY', 'LEVELS', 'RANDOM HOUSE', 'STORE', 'CHARACTERS', 'HOW TO PLAY', soundLabel()];
}

function drawTitle() {
  g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let x = 0; x < VIEW_W; x += 16) { g.fillStyle = (x / 16) % 2 ? C.wood : C.wood2; g.fillRect(x, 166, 16, 16); }
  const t = performance.now() / 1000;
  const kx = 40 + ((t * 18) % 120);
  drawActor(g, CHARACTERS[save.char].look, kx, 174, 2, Math.floor(t * 6) % 4);
  drawTarget(g, 'purse', 190, 174, false);
  drawActor(g, 'mama', 215, 180, 1, 0);
  drawText(g, 'KUPIT', VIEW_W / 2, 50, C.gold, { scale: 9, align: 'center', shadow: C.gold2 });
  drawText(g, 'SNEAK. KUPIT. ESCAPE.', VIEW_W / 2, 112, C.white, { align: 'center' });
  drawMenu(g, titleItems(), sel, TITLE_Y, TITLE_GAP);
  drawCoin(g, 8, 8); drawText(g, String(save.bank), 16, 9, C.white);
  drawText(g, 'A PIXEL STEALTH GAME', VIEW_W / 2, 336, C.dgray, { align: 'center' });
  drawText(g, 'M: SOUND', VIEW_W / 2, 348, C.dgray, { align: 'center' });
}

function updateTitle() {
  const pick = menuPick(7, TITLE_Y, TITLE_GAP);
  if (pick === 0) start(unlockedMax());
  else if (pick === 1) { prevMode = 'title'; setMode('levels'); sel = unlockedMax(); }
  else if (pick === 2) setMode('house');
  else if (pick === 3) { shopScreen.sel = 0; setMode('store'); }
  else if (pick === 4) { charScreen.sel = CHAR_ORDER.indexOf(save.char); setMode('chars'); }
  else if (pick === 5) { prevMode = 'title'; setMode('help'); }
  else if (pick === 6) toggleSound();
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
  else if (pick <= save.unlocked || dev.on) start(pick);
  else sfx.creak();
}

function drawLevels() {
  g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H);
  drawText(g, 'CHOOSE A LEVEL', VIEW_W / 2, 14, C.gold, { scale: 2, align: 'center', shadow: C.gold2 });
  if (dev.on) drawText(g, 'DEV: ALL UNLOCKED', VIEW_W / 2, 28, C.red, { align: 'center' });
  const n = levels.length;
  for (let i = scroll; i < Math.min(n, scroll + VISIBLE); i++) {
    const r = rowRect(i), lock = i > save.unlocked && !dev.on, on = sel === i;
    g.fillStyle = on ? C.gold : C.ink; g.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
    g.fillStyle = lock ? C.dgray : C.wallD; g.fillRect(r.x, r.y, r.w, r.h);
    drawText(g, String(i + 1), r.x + 6, r.y + 6, lock ? C.gray : C.gold, { scale: 3 });
    drawText(g, lock ? 'LOCKED' : levels[i].name, r.x + 28, r.y + 6, lock ? C.gray : C.white);
    if (levels[i].boss) drawText(g, 'BOSS', r.x + 28 + (lock ? 28 : levels[i].name.length * 4) + 5, r.y + 6, lock ? C.dgray : C.red);
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
  ['SKILL', 'EACH KID HAS A SKILL: TAP THE GREEN BUTTON OR PRESS F.'],
  ['STORE', 'COINS BUY PERMANENT UPGRADES AND NEW KIDS.'],
  ['HOUSE', 'RANDOM HOUSE MAKES A NEW HOUSE EVERY TIME.'],
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
    const lines = wrap(body, 56);
    lines.forEach((l, i) => drawText(g, l, 12, y + 9 + i * 8, C.white));
    y += 9 + lines.length * 8 + 6;
  }
  drawButton(g, backRect(), 'BACK', true);
}

function updateHelp() {
  if (input.pressed('Escape') || input.pressed('Enter') || input.pressed(' ') || input.pressed('e') || hit(input.tapPos, backRect())) {
    sfx.unlock(); setMode(prevMode);
  }
}

// ---- random house -----------------------------------------------------------------
const HOUSE_Y = 130;
const houseItems = () => ['NEW HOUSE', 'DAILY HOUSE', `DIFFICULTY: ${save.houseDiff}`, 'BACK'];
const dailyStars = () => (save.daily && save.daily.id === dailyId() ? save.daily.stars : 0);

function drawHouse() {
  g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H);
  drawText(g, 'RANDOM HOUSE', VIEW_W / 2, 24, C.gold, { scale: 3, align: 'center', shadow: C.gold2 });
  drawText(g, 'A NEW HOUSE EVERY TIME.', VIEW_W / 2, 62, C.white, { align: 'center' });
  drawText(g, 'BIGGER HOUSES, MORE ADULTS, LOCKED DOORS.', VIEW_W / 2, 72, C.gray, { align: 'center' });
  drawText(g, `HOUSES CLEARED: ${save.houses}`, VIEW_W / 2, 96, C.yellow, { align: 'center' });
  drawMenu(g, houseItems(), sel, HOUSE_Y);
  const d = dailyStars();
  drawText(g, 'DAILY HOUSE: SAME FOR EVERYONE TODAY', VIEW_W / 2, 236, C.gray, { align: 'center' });
  if (d) for (let i = 0; i < 3; i++) drawStar(g, VIEW_W / 2 - 22 + i * 15, 250, i < d);
  else drawText(g, 'NOT PLAYED YET TODAY', VIEW_W / 2, 252, C.dgray, { align: 'center' });
  drawText(g, 'LEVEL 1 EASY ... LEVEL 5 HARD', VIEW_W / 2, 300, C.dgray, { align: 'center' });
}

function updateHouse() {
  if (input.pressed('Escape')) { setMode('title'); return; }
  const pick = menuPick(4, HOUSE_Y);
  if (pick === 0) startHouse(newSeed(), save.houseDiff);
  else if (pick === 1) startHouse(dailySeed(), 3, true);
  else if (pick === 2) { save.houseDiff = (save.houseDiff % 5) + 1; writeSave(save); sfx.click(); }
  else if (pick === 3) setMode('title');
}

// ---- dev tools (opened from the pause menu while dev mode is on) ---------------------
const DEV_Y = 62, DEV_GAP = 20;
const devItems = () => [
  `GOD MODE: ${dev.god ? 'ON' : 'OFF'}`, 'FILL QUOTA (OPEN EXIT)', 'GO TO EXIT', 'CLEAR LEVEL', 'NEXT BOSS PHASE',
  'PREVIOUS LEVEL', 'NEXT LEVEL', `INFO OVERLAY: ${dev.info ? 'ON' : 'OFF'}`, `GAME SPEED: ${dev.speed}X`, '+50 COINS', 'DEV MODE OFF', 'BACK',
];

function drawDevMenu() {
  play.draw(g);
  dim(0.82);
  drawText(g, 'DEV TOOLS', VIEW_W / 2, 18, C.red, { scale: 3, align: 'center', shadow: C.ink });
  drawText(g, `${cur.name}  (${run ? 'HOUSE' : `${idx + 1}/${levels.length}`})`, VIEW_W / 2, 46, C.white, { align: 'center' });
  drawMenu(g, devItems(), sel, DEV_Y, DEV_GAP);
  drawText(g, 'N NEXT B PREV C CLEAR G GOD K QUOTA X EXIT I INFO', VIEW_W / 2, 336, C.dgray, { align: 'center' });
}

const goLevel = (i) => { if (levels.length) start(((i % levels.length) + levels.length) % levels.length); };

function updateDevMenu() {
  if (input.pressed('Escape')) { setMode('paused'); return; }
  const pick = menuPick(devItems().length, DEV_Y, DEV_GAP);
  const w = play.world;
  if (pick === 0) dev.god = !dev.god;
  else if (pick === 1) { w.devFillQuota(); setMode('play'); input.reset(); }
  else if (pick === 2) { w.devGoToExit(); setMode('play'); input.reset(); }
  else if (pick === 3) { w.devClear(); setMode('play'); input.reset(); }
  else if (pick === 4) { if (w.devNextPhase()) { setMode('play'); input.reset(); } else sfx.creak(); }
  else if (pick === 5) { if (!run) goLevel(idx - 1); else sfx.creak(); }
  else if (pick === 6) { if (!run) goLevel(idx + 1); else sfx.creak(); }
  else if (pick === 7) dev.info = !dev.info;
  else if (pick === 8) dev.speed = SPEEDS[(SPEEDS.indexOf(dev.speed) + 1) % SPEEDS.length];
  else if (pick === 9) { save.bank += 50; writeSave(save); sfx.coin(); }
  else if (pick === 10) { setDev(false); setMode('paused'); }
  else if (pick === 11) setMode('paused');
  if (pick >= 0 && pick <= 8) sfx.click();
}

// Hotkeys while playing in dev mode.
function devKeys() {
  const w = play.world;
  if (input.pressed('g')) dev.god = !dev.god;
  if (input.pressed('i')) dev.info = !dev.info;
  if (input.pressed('k')) w.devFillQuota();
  if (input.pressed('x')) w.devGoToExit();
  if (input.pressed('c')) w.devClear();
  if (input.pressed('n') && !run) goLevel(idx + 1);
  if (input.pressed('b') && !run) goLevel(idx - 1);
}

// ---- pause ------------------------------------------------------------------------
const PAUSE_Y = 150;
const pauseItems = () => ['RESUME', 'RESTART', 'LEVELS', soundLabel(), `VIBRATE: ${hapticsOn() ? 'ON' : 'OFF'}`, 'TITLE', ...(dev.on ? ['DEV TOOLS'] : [])];
function drawPaused() {
  play.draw(g);
  dim(0.75);
  drawText(g, 'PAUSED', VIEW_W / 2, 100, C.gold, { scale: 5, align: 'center', shadow: C.gold2 });
  drawMenu(g, pauseItems(), sel, PAUSE_Y);
}

function updatePaused() {
  if (input.pressed('Escape') || input.pressed('p')) { input.reset(); setMode('play'); return; }
  const pick = menuPick(pauseItems().length, PAUSE_Y);
  if (pick === 0) { input.reset(); setMode('play'); }
  else if (pick === 1) restart();
  else if (pick === 2) { prevMode = 'paused'; setMode('levels'); sel = idx; }
  else if (pick === 3) toggleSound();
  else if (pick === 4) toggleHaptics();
  else if (pick === 5) setMode('title');
  else if (pick === 6) setMode('dev');
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
  drawText(g, `COINS ${play.world.coins}/${cur.quota}   TIME ${Math.floor(play.world.time)}S`, VIEW_W / 2, 175, C.gray, { align: 'center' });
  if (age > 0.5) drawMenu(g, run ? ['TRY AGAIN', 'NEW HOUSE', 'HOUSE MENU'] : ['TRY AGAIN', 'LEVELS', 'TITLE'], sel, END_Y);
}

function updateCaught() {
  const pick = menuPick(3, END_Y, 22, age > 0.5);
  if (pick === 0) restart();
  else if (pick === 1) { if (run) startHouse(newSeed(), run.diff); else { prevMode = 'title'; setMode('levels'); sel = idx; } }
  else if (pick === 2) setMode(run ? 'house' : 'title');
}

function drawClear() {
  play.draw(g);
  dim(0.75);
  const r = play.result;
  const last = !run && idx === levels.length - 1;
  drawText(g, run ? 'HOUSE CLEARED!' : last ? 'ALL DONE!' : cur.boss ? 'BOSS BEATEN!' : 'NICE KUPIT!', VIEW_W / 2, 80, C.gold, { scale: (cur.boss && !last) || run ? 4 : 5, align: 'center', shadow: C.gold2 });
  for (let i = 0; i < 3; i++) drawStar(g, VIEW_W / 2 - 22 + i * 15, 130, i < r.stars);
  drawText(g, `COINS ${r.coins}   TIME ${Math.floor(r.time)}S`, VIEW_W / 2, 155, C.white, { align: 'center' });
  if (run) drawText(g, `HOUSE ${cur.seed}   LEVEL ${run.diff}${run.daily ? '   DAILY' : ''}`, VIEW_W / 2, 167, C.gray, { align: 'center' });
  else drawText(g, newBest ? 'NEW BEST TIME!' : `BEST ${Math.floor(save.best[cur.id] || r.time)}S`, VIEW_W / 2, 167, newBest ? C.green : C.gray, { align: 'center' });
  drawText(g, `${r.fast ? 'FAST + ' : `PAR ${cur.par}S  `}${r.stealth ? 'SILENT' : 'SPOTTED A BIT'}`, VIEW_W / 2, 179, C.gray, { align: 'center' });
  drawText(g, `+${earned} COINS   BANK ${save.bank}`, VIEW_W / 2, 195, C.gold, { align: 'center' });
  if (bossBonus) drawText(g, `BOSS BONUS +${bossBonus}`, VIEW_W / 2, 207, C.green, { align: 'center' });
  if (age > 0.5) drawMenu(g, [run ? (run.daily ? 'HOUSE MENU' : 'NEW HOUSE') : last ? 'TITLE' : 'NEXT LEVEL', 'PLAY AGAIN', run ? 'HOUSE MENU' : 'LEVELS', 'STORE'], sel, END_Y, 21);
}

function updateClear() {
  const last = !run && idx === levels.length - 1;
  const pick = menuPick(4, END_Y, 21, age > 0.5);
  if (pick === 3) { shopScreen.sel = 0; setMode('store'); return; }
  if (pick === 0) { if (run) { if (run.daily) setMode('house'); else startHouse(newSeed(), run.diff); } else if (last) setMode('title'); else start(idx + 1); }
  else if (pick === 1) restart();
  else if (pick === 2) { if (run) setMode('house'); else { prevMode = 'title'; setMode('levels'); sel = Math.min(idx + 1, levels.length - 1); } }
}

function afterPlay() {
  play.banner = null;
  if (play.status === 'caught') setMode('caught');
  else if (play.status === 'clear') {
    setMode('clear');
    if (run) { // Random House: pays coins, but no unlocks or records (except the daily)
      bossBonus = 0;
      earned = play.result.coins + play.result.stars + run.diff;
      save.houses++;
      if (run.daily) save.daily = { id: dailyId(), stars: Math.max(save.daily?.id === dailyId() ? save.daily.stars : 0, play.result.stars) };
    } else {
      const id = cur.id, t = play.result.time, first = save.stars[id] === undefined;
      newBest = !save.best[id] || t < save.best[id];
      if (newBest) save.best[id] = t;
      save.stars[id] = Math.max(save.stars[id] || 0, play.result.stars);
      save.unlocked = Math.max(save.unlocked, Math.min(idx + 1, levels.length - 1));
      bossBonus = cur.boss && first ? cur.boss.bonus : 0; // first clear only
      earned = play.result.coins + play.result.stars + bossBonus;
    }
    save.bank += earned;
    writeSave(save);
  }
}

const shopCtx = { save, persist: () => writeSave(save), back: () => setMode('title') };

// Pick the music for the current screen. Chase music sticks around a moment after the chase ends.
function syncMusic(dt) {
  if (input.tapPos || input.hits.size) audioReady = true; // browsers only allow audio after a gesture
  if (!audioReady) return;
  let want;
  if (mode === 'play') {
    if (play.world.adults.some((a) => a.state === 'chase')) chaseHold = 2.5; else chaseHold = Math.max(0, chaseHold - dt);
    want = chaseHold > 0 ? 'chase' : cur.boss ? 'boss' : 'sneak';
  } else if (mode === 'paused' || mode === 'dev') want = music.name;
  else if (mode === 'caught' || mode === 'clear' || mode === 'loading') want = null;
  else want = 'menu';
  music.duck(mode === 'paused' || mode === 'dev');
  music.play(want);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  age += dt;
  input.buttonEnabled = mode === 'play';
  if (input.pressed('m')) toggleSound();
  if (input.pressed('`')) { setDev(!dev.on); sfx.click(); }
  dev.fps += ((dt > 0 ? 1 / dt : 60) - dev.fps) * 0.1;

  const m = mode; // dispatch on the mode at frame start so one keypress can't act on two screens
  if (m === 'play') {
    if (input.pauseTap || input.pressed('Escape') || input.pressed('p')) pause();
    else {
      if (dev.on) devKeys();
      play.update(dt * dev.speed); if (play.status !== 'play') afterPlay();
    }
    if (mode === 'play') play.draw(g);
  }
  const screens = { title: [updateTitle, drawTitle], levels: [updateLevels, drawLevels], help: [updateHelp, drawHelp],
    store: [() => shopScreen.update(input, shopCtx, dt), () => shopScreen.draw(g, shopCtx)],
    chars: [() => charScreen.update(input, shopCtx, dt), () => charScreen.draw(g, shopCtx)],
    house: [updateHouse, drawHouse],
    dev: [updateDevMenu, drawDevMenu],
    paused: [updatePaused, drawPaused], caught: [updateCaught, drawCaught], clear: [updateClear, drawClear] };
  if (screens[m]) { screens[m][0](); if (mode === m) screens[m][1](); } // skip the draw if the screen just changed
  else if (m === 'loading') { g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H); drawText(g, 'LOADING...', VIEW_W / 2, 170, C.white, { align: 'center' }); }

  syncMusic(dt);
  if (fadeT > 0) { g.globalAlpha = Math.min(1, fadeT / FADE); g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H); g.globalAlpha = 1; fadeT -= dt; }

  input.endFrame();
  requestAnimationFrame(frame);
}

addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

Promise.all([loadLevels(), loadAtlas()]).then(([l]) => {
  levels = l;
  setMode('title');
  const jump = Number(new URLSearchParams(location.search).get('level')); // ?level=2 jumps to level 2
  if (jump >= 1 && jump <= levels.length) start(jump - 1);
  const hs = Number(new URLSearchParams(location.search).get('house')); // ?house=1234&diff=3
  if (hs) startHouse(hs, Number(new URLSearchParams(location.search).get('diff')) || 2);
}).catch((e) => {
  console.error(e);
  mode = 'loading';
});
requestAnimationFrame(frame);

// Debug hook for automated checks: window.__kupit
window.__kupit = { get play() { return play; }, get mode() { return mode; }, start, startHouse, input, save, get cur() { return cur; }, get run() { return run; } };

// Installable + offline (PWA). Network-first, so updates still show up right away when online.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
