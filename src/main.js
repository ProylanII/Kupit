import { Input, VIEW_W, VIEW_H } from './core/input.js';
import { loadSave, writeSave, requestPersist, saveCode, readSaveCode } from './core/save.js';
import { sfx, setMuted, isMuted, suspendAudio } from './core/audio.js';
import { Play } from './scenes/play.js';
import { drawText } from './ui/font.js';
import { drawActor, drawStar, drawTarget, drawCoin, drawPortrait, drawObj } from './render/sprites.js';
import { parol } from './render/tiles.js';
import {
  CHARACTERS, CHAR_ORDER, STAR_MILESTONES, totalStars, grantUnlocks, campaignPayout, housePayout,
} from './game/progression.js';
import {
  generateHouse, dailySeed, dailyId, dailyDiff, isPasko, prevDailyId, MUTATORS, MUTATOR_ORDER, mutatorMult,
} from './game/house.js';
import { C } from './render/palette.js';
import { shopScreen, charScreen, cosmeticsScreen } from './scenes/shop.js';
import { dev, initDev, setDev, SPEEDS } from './core/dev.js';
import { music } from './core/music.js';
import { loadAtlas } from './render/atlas.js';
import { hapticsOn, vibrate, canVibrate } from './core/haptics.js';
import { settings, applySettings, SHAKE_LEVELS, shakeLabel, VOLUME_STEPS } from './core/settings.js';
import { loadGhost, storeGhost } from './game/ghost.js';
import { INTRO, ENDING } from './data/story.js';
import { drawMenu, drawButton, buttonRect, menuHit, hit } from './ui/menu.js';

const canvas = document.getElementById('game');
const g = canvas.getContext('2d');
g.imageSmoothingEnabled = false;
const input = new Input(canvas);
let save = loadSave();
setMuted(save.muted);
initDev();
applySettings(save);
const persist = () => writeSave(save);
let unlocked = grantUnlocks(save, { pasko: isPasko() }); // e.g. the Pasko outfit when the season starts
if (unlocked.length) persist();

// ---- integer-ish pixel scaling, inside the safe area (notches, home bar) --------------
function resize() {
  const de = document.documentElement, cs = getComputedStyle(document.body);
  const px = (k) => parseFloat(cs[k]) || 0;
  const w = de.clientWidth - px('paddingLeft') - px('paddingRight'), h = de.clientHeight - px('paddingTop') - px('paddingBottom');
  const s0 = Math.min(w / VIEW_W, h / VIEW_H);
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
let run = null;   // null for campaign, { seed, diff, daily, mutators } for Random House
let mode = 'loading'; // loading | title | levels | help | options | story | house | dev | store | cosmetics | chars | play | paused | caught | clear
let play = null;
let age = 0;
let sel = 0;       // highlighted menu item
let scroll = 0;    // level-select scroll offset
let prevMode = 'title'; // where BACK goes from levels/help/options
let newBest = false;
let earned = 0;
let bossBonus = 0;
let msg = null;    // { text, color, t } short message on menus
let shareText = null;

const FADE = 0.25;
const STEP = 1 / 60; // the simulation always advances in fixed 60 Hz steps (same game on 60/120/144 Hz screens)
let acc = 0;
let fadeT = 0, chaseHold = 0, chaseT = 0, audioReady = false;
const setMode = (m) => {
  const quiet = (x) => x === 'paused' || x === 'dev' || x === 'options';
  fadeT = quiet(m) || quiet(mode) ? 0 : FADE; // quick fade-in between screens (not for pause)
  mode = m; age = 0; sel = 0;
};
const unlockedMax = () => Math.min(save.unlocked, levels.length - 1);
const say = (text, color = C.yellow, t = 2) => { msg = { text, color, t }; };
const tips = { get seen() { return save.seen; }, mark(id) { save.seen[id] = true; persist(); } };

function launch() {
  const campaign = !run;
  const ghost = campaign && settings.ghost ? loadGhost(cur.id) : null;
  play = new Play(cur, input, { char: save.char, upgrades: save.upgrades, lives: 3, alkansyaFound: !!save.alkansya[cur.id] },
    { tips, ghost, outfit: save.outfit, record: campaign, log: playtest ? ptEvent : null });
  ptLog('start');
  input.reset();
  acc = 0;
  setMode('play');
}

function start(i) { idx = i; run = null; cur = levels[i]; launch(); }

function startHouse(seed, diff, daily = false) {
  const mutators = daily ? [] : save.mutators.slice();
  run = { seed, diff, daily, mutators };
  cur = generateHouse(seed, diff, { mutators, pasko: daily && isPasko() });
  launch();
}
const startDaily = () => startHouse(dailySeed(), dailyDiff(), true);

const restart = () => launch();
const newSeed = () => 1000 + Math.floor(Math.random() * 9000);

function toggleSound() {
  setMuted(!isMuted());
  save.muted = isMuted();
  persist();
  music.refresh();
  sfx.click();
}

function pause() { if (mode === 'play') { ptLog('pause', { time: +play.world.time.toFixed(1) }); setMode('paused'); } }

// ---- playtest log (?playtest=1): deaths, pauses, idle moments and clears, kept on this device only ----
const playtest = new URLSearchParams(location.search).has('playtest');
const PT_KEY = 'kupit.playtest';
const ptRead = () => { try { return JSON.parse(localStorage.getItem(PT_KEY)) || []; } catch { return []; } };
function ptLog(type, data = {}) {
  if (!playtest) return;
  const L = ptRead();
  L.push({ at: new Date().toISOString(), type, level: cur?.id, ...data });
  try { localStorage.setItem(PT_KEY, JSON.stringify(L.slice(-3000))); } catch { /* full */ }
}
const PT_TYPES = new Set(['caught', 'respawn', 'checkpoint', 'spotted', 'phase', 'clear', 'idle', 'alkansya']);
function ptEvent(e, w) {
  if (!PT_TYPES.has(e.type)) return;
  ptLog(e.type, { time: +w.time.toFixed(1), tile: [w.player.tx, w.player.ty], who: e.who?.type || (e.type === 'caught' ? w.catcher?.type : undefined), coins: w.coins, final: e.final });
}

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

function drawMsg(y = 318) {
  if (msg) drawText(g, msg.text, VIEW_W / 2, y, msg.color, { align: 'center' });
}

// ---- story panels -------------------------------------------------------------
let story = null; // { panels, i, then }
function startStory(panels, then) { story = { panels, i: 0, then }; setMode('story'); }

function updateStory() {
  const skip = { x: VIEW_W - 58, y: 8, w: 50, h: 15 };
  if (hit(input.tapPos, skip) || input.pressed('Escape')) { sfx.unlock(); story.then(); return; }
  if (age > 0.3 && (input.tapPos || input.pressed('Enter') || input.pressed(' ') || input.pressed('e'))) {
    sfx.click();
    if (++story.i >= story.panels.length) story.then(); else age = 0;
  }
}

function drawStory() {
  g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H);
  if (!titleBg) titleBg = buildTitleBg();
  g.globalAlpha = 0.35; g.drawImage(titleBg, 0, 100); g.globalAlpha = 1;
  const p = story.panels[story.i];
  drawButton(g, { x: VIEW_W - 58, y: 8, w: 50, h: 15 }, 'SKIP', false);
  g.fillStyle = C.gold; g.fillRect(VIEW_W / 2 - 31, 60, 62, 62);
  g.fillStyle = C.ink; g.fillRect(VIEW_W / 2 - 29, 62, 58, 58);
  const look = p.who === 'jun' ? (save.outfit !== 'basic' ? `jun~${save.outfit}` : 'jun') : p.who;
  if (!drawPortrait(g, look, VIEW_W / 2 - 28, 63, 2)) drawActor(g, look, VIEW_W / 2, 110, 0, 0);
  drawText(g, p.who === 'nena' ? 'ALING NENA' : p.who.toUpperCase(), VIEW_W / 2, 130, C.gold, { align: 'center', scale: 2 });
  g.fillStyle = C.wallD; g.fillRect(12, 160, VIEW_W - 24, 20 + p.lines.length * 12);
  const shown = Math.floor(age * 40); // typewriter
  let used = 0;
  p.lines.forEach((l, i) => { const n = Math.max(0, Math.min(l.length, shown - used)); used += l.length; drawText(g, l.slice(0, n), VIEW_W / 2, 170 + i * 12, C.white, { align: 'center' }); });
  for (let i = 0; i < story.panels.length; i++) { g.fillStyle = i === story.i ? C.gold : C.dgray; g.fillRect(VIEW_W / 2 - story.panels.length * 4 + i * 8, 236, 5, 5); }
  if (Math.floor(age * 2) % 2) drawText(g, 'TAP TO CONTINUE', VIEW_W / 2, 300, C.gray, { align: 'center' });
}

// ---- title ------------------------------------------------------------------
const TITLE_Y = 184, TITLE_GAP = 19;
function titleItems() {
  return [save.unlocked > 0 ? `CONTINUE: LEVEL ${unlockedMax() + 1}` : 'PLAY', 'LEVELS', 'RANDOM HOUSE', 'STORE', 'CHARACTERS', 'HOW TO PLAY', 'OPTIONS'];
}

// Title backdrop: night sky, moon and a row of houses with lit capiz windows. Drawn once, stars twinkle on top.
let titleBg = null;
const HOUSES = [[-6, 50, 30, 'peak'], [40, 40, 22, 'flat'], [76, 56, 36, 'peak'], [128, 34, 24, 'flat'], [158, 52, 32, 'peak'], [206, 44, 26, 'flat']];
const GROUND = 166;
function buildTitleBg() {
  const cv = document.createElement('canvas'); cv.width = VIEW_W; cv.height = 184;
  const b = cv.getContext('2d');
  const f = (c, x, y, w, h) => { b.fillStyle = c; b.fillRect(x, y, w, h); };
  const sky = ['#0c1230', '#111a3e', '#18224c', '#20295a', '#2b3066', '#3a3570'];
  sky.forEach((c, i) => f(c, 0, i * 26, VIEW_W, 26));
  for (let i = 1; i < sky.length; i++) for (let x = i & 1; x < VIEW_W; x += 2) { f(sky[i], x, i * 26 - 1, 1, 1); f(sky[i - 1], x + 1, i * 26, 1, 1); }
  // moon with craters and a soft halo
  b.globalAlpha = 0.12; for (let r = 18; r > 11; r -= 3) disc(b, 204, 28, r, C.capiz); b.globalAlpha = 1;
  disc(b, 204, 28, 11, '#f3ead2'); disc(b, 208, 24, 9, '#fff8e6');
  f('#d9cba6', 199, 29, 3, 2); f('#d9cba6', 205, 34, 2, 2); f('#d9cba6', 209, 27, 2, 1);
  for (const [x, w, h, roof] of HOUSES) {
    const top = GROUND - h;
    f('#1d1838', x, top, w, h);
    f('#262046', x, top, 2, h);
    if (roof === 'peak') for (let i = 0; i <= w / 2 + 3; i++) f('#151130', x - 3 + i, top - Math.floor(i / 2), w + 6 - i * 2, 1);
    else { f('#151130', x - 2, top - 3, w + 4, 3); f('#2b2552', x - 2, top - 3, w + 4, 1); }
    for (let wx = x + 6; wx + 10 < x + w; wx += 16) { // lit capiz windows
      const lit = (wx * 7 + h) % 3 !== 0;
      f('#3b2a1c', wx - 1, top + 6, 12, 10);
      f(lit ? '#ffd27a' : '#2a3560', wx, top + 7, 10, 8);
      if (lit) { f('#f0a848', wx, top + 11, 10, 1); f('#f0a848', wx + 4, top + 7, 1, 8); f('#fff0b8', wx + 1, top + 8, 2, 2); }
    }
  }
  // fence + ground strip
  for (let x = 0; x < VIEW_W; x += 6) f('#2a2448', x, GROUND - 8, 4, 8);
  f('#2a2448', 0, GROUND - 6, VIEW_W, 1);
  for (let x = 0; x < VIEW_W; x += 16) { f((x / 16) % 2 ? C.wood : C.wood2, x, GROUND, 16, 16); f(C.woodLine, x, GROUND + 7, 16, 1); f(C.woodLine, x + ((x * 3) % 16), GROUND, 1, 7); }
  f(C.ink, 0, GROUND + 16, VIEW_W, 2);
  return cv;
}

function disc(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) { const h = Math.round(Math.sqrt(r * r - dy * dy)); c.fillRect(cx - h, cy + dy, h * 2 + 1, 1); }
}

// Skyline decorations bought in the store (or earned with stars).
const decorOn = (id) => save.decor.includes(id) && !save.decorOff.includes(id);
function drawDecor(t) {
  const f = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  if (decorOn('banderitas')) { // fiesta flags strung between the roofs
    const cols = [C.red, C.gold, C.blue, C.green, C.pink];
    for (let x = 0; x < VIEW_W; x += 6) {
      const y = 122 + Math.round(Math.sin((x / VIEW_W) * Math.PI * 3) * 4);
      f('#6a6488', x, y, 6, 1);
      f(cols[(x / 6) % cols.length], x + 1, y + 1, 4, 2); f(cols[(x / 6) % cols.length], x + 2, y + 3, 2, 1);
    }
  }
  if (decorOn('parol') || isPasko()) for (const [x, w, h] of HOUSES) parol(g, x + Math.round(w / 2), GROUND - h + 2, 1);
  if (decorOn('pusa')) { // a cat on the tallest roof, tail swishing
    const x = 102, y = GROUND - 36 - 14;
    f(C.ink, x, y, 6, 4); f(C.ink, x + 4, y - 3, 4, 4); f(C.ink, x + 4, y - 4, 1, 1); f(C.ink, x + 7, y - 4, 1, 1);
    f(C.yellow, x + 5, y - 2, 1, 1); f(C.yellow, x + 7, y - 2, 1, 1);
    const sw = Math.floor(t * 2) % 2; f(C.ink, x - 2, y - 2 + sw, 2, 1); f(C.ink, x - 1, y - 1, 1, 2);
  }
  if (decorOn('alitaptap')) for (let i = 0; i < 9; i++) { // fireflies
    const x = (i * 53 + Math.sin(t * 0.7 + i) * 14 + 400) % VIEW_W, y = 140 + Math.sin(t * 1.3 + i * 2) * 10;
    if ((Math.floor(t * 3) + i) % 4) f('#d8ff6b', Math.round(x), Math.round(y), 1, 1);
  }
  if (decorOn('jeep')) { // a jeepney driving past on the road
    const x = Math.round(((t * 30) % (VIEW_W + 80)) - 40), y = GROUND + 3;
    f(C.ink, x - 1, y - 1, 34, 12); f('#c0c8d0', x, y, 32, 8); f(C.red, x, y + 3, 32, 2); f(C.gold, x + 2, y - 2, 28, 2);
    for (let i = 0; i < 4; i++) f('#3a4a6a', x + 4 + i * 6, y + 1, 4, 2);
    f(C.ink, x + 4, y + 8, 5, 3); f(C.ink, x + 23, y + 8, 5, 3);
  }
  if (decorOn('paputok')) { // fireworks
    const k = Math.floor(t / 2.2), ph = (t % 2.2) / 2.2, cx = 30 + ((k * 97) % 160), cy = 30 + ((k * 41) % 50);
    if (ph < 0.6) {
      const r = Math.round(ph * 30), col = [C.pink, C.gold, C.green, '#7fd7ff'][k % 4];
      for (let a = 0; a < 12; a++) f(col, Math.round(cx + Math.cos(a / 12 * Math.PI * 2) * r), Math.round(cy + Math.sin(a / 12 * Math.PI * 2) * r), 1, 1);
    }
  }
}

function drawTitle() {
  g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H);
  if (!titleBg) titleBg = buildTitleBg();
  g.drawImage(titleBg, 0, 0);
  const t = performance.now() / 1000;
  for (let i = 0; i < 46; i++) { // twinkling stars
    const h = Math.imul(i + 1, 2654435761) >>> 0, x = h % VIEW_W, y = (h >>> 12) % 118;
    if (Math.hypot(x - 204, y - 28) < 16 || (Math.floor(t * 3) + i) % 11 === 0) continue;
    g.fillStyle = i % 4 ? '#8a86b0' : C.white; g.fillRect(x, y, 1, 1);
  }
  drawDecor(t);
  const kx = 40 + ((t * 18) % 120);
  const look = save.outfit !== 'basic' ? `${CHARACTERS[save.char].look}~${save.outfit}` : CHARACTERS[save.char].look;
  drawActor(g, look, kx, 174, 2, Math.floor(t * 6) % 4);
  drawTarget(g, 'purse', 190, 174, false);
  drawActor(g, 'mama', 215, 180, 1, 0);
  drawText(g, 'KUPIT', VIEW_W / 2, 50, C.gold, { scale: 9, align: 'center', shadow: C.gold2 });
  drawText(g, 'SNEAK. KUPIT. ESCAPE.', VIEW_W / 2, 112, C.white, { align: 'center' });
  drawMenu(g, titleItems(), sel, TITLE_Y, TITLE_GAP);
  drawCoin(g, 8, 8); drawText(g, String(save.bank), 16, 9, C.white);
  const stars = totalStars(save), next = STAR_MILESTONES.find((m) => m.stars > stars);
  drawStar(g, 7, 16, true); drawText(g, `${stars}/42`, 16, 17, C.white);
  if (next) drawText(g, `NEXT GIFT AT ${next.stars}`, 8, 26, C.gray);
  if (updateReady) {
    const r = updateRect();
    g.fillStyle = C.ink; g.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    g.fillStyle = Math.floor(t * 2) % 2 ? C.green : '#2fb56b'; g.fillRect(r.x, r.y, r.w, r.h);
    drawText(g, 'UPDATE READY! TAP TO RESTART', VIEW_W / 2, r.y + 4, C.ink, { align: 'center' });
  }
  drawMsg(322);
  drawText(g, 'A PIXEL STEALTH GAME', VIEW_W / 2, 336, C.dgray, { align: 'center' });
  drawText(g, 'M: SOUND', VIEW_W / 2, 348, C.dgray, { align: 'center' });
}
const updateRect = () => ({ x: 30, y: 126, w: VIEW_W - 60, h: 13 });

function updateTitle() {
  if (updateReady && (hit(input.tapPos, updateRect()) || input.pressed('u'))) { applyUpdate(); return; }
  const pick = menuPick(7, TITLE_Y, TITLE_GAP);
  if (pick === 0) {
    if (save.unlocked === 0 && !save.story.intro) startStory(INTRO, () => { save.story.intro = true; persist(); start(0); });
    else start(unlockedMax());
  } else if (pick === 1) { prevMode = 'title'; setMode('levels'); sel = unlockedMax(); }
  else if (pick === 2) setMode('house');
  else if (pick === 3) { shopScreen.sel = 0; setMode('store'); }
  else if (pick === 4) { charScreen.sel = CHAR_ORDER.indexOf(save.char); setMode('chars'); }
  else if (pick === 5) { prevMode = 'title'; helpPage = 0; setMode('help'); }
  else if (pick === 6) { prevMode = 'title'; setMode('options'); }
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
    const r = rowRect(i), lock = i > save.unlocked && !dev.on, on = sel === i, L = levels[i];
    g.fillStyle = on ? C.gold : C.ink; g.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
    g.fillStyle = lock ? C.dgray : C.wallD; g.fillRect(r.x, r.y, r.w, r.h);
    drawText(g, String(i + 1), r.x + 6, r.y + 6, lock ? C.gray : C.gold, { scale: 3 });
    drawText(g, lock ? 'LOCKED' : L.name, r.x + 28, r.y + 6, lock ? C.gray : C.white);
    if (L.boss) drawText(g, 'BOSS', r.x + 28 + (lock ? 28 : L.name.length * 4) + 5, r.y + 6, lock ? C.dgray : C.red);
    const best = save.best[L.id];
    if (!lock) drawText(g, best ? `BEST ${Math.floor(best)}S  PAR ${L.par}S` : `PAR ${L.par}S`, r.x + 28, r.y + 18, C.gray);
    if (!lock) for (let k = 0; k < 3; k++) drawStar(g, r.x + r.w - 50 + k * 15, r.y + 6, k < (save.stars[L.id] || 0));
    if (!lock && L.alkansya) { // found the secret alkansya? (outline until you do)
      if (save.alkansya[L.id]) drawObj(g, 'alkansya', r.x + r.w - 10, r.y + 24);
      else { g.fillStyle = C.dgray; g.fillRect(r.x + r.w - 13, r.y + 20, 6, 8); drawText(g, '?', r.x + r.w - 11, r.y + 22, C.gray); }
    }
  }
  if (scroll > 0) drawText(g, '^', VIEW_W / 2, 26, C.gray, { align: 'center' });
  if (scroll + VISIBLE < n) drawText(g, 'V', VIEW_W / 2, 322, C.gray, { align: 'center' });
  drawButton(g, backRect(), 'BACK', sel === n);
}

// ---- how to play (two pages) ------------------------------------------------------
const HELP = [[
  ['GOAL', 'TAKE THE COINS, THEN REACH THE EXIT.'],
  ['MOVE', 'DRAG ANYWHERE OR WASD. DRAG FAR / SHIFT RUNS, BUT RUNNING IS LOUD.'],
  ['KUPIT', 'STAND AT A STASH AND HOLD THE BIG BUTTON: E OR SPACE. LET GO AND IT WAITS FOR YOU.'],
  ['SEEN?', 'YELLOW CONE: THEY SEE YOU. ? MEANS SUSPICIOUS, ! MEANS CHASE. ARROWS ON THE EDGE SHOW WHO IS COMING.'],
  ['HIDE', 'PRESS TAGO AT A BOX, CURTAIN OR BASKET. AN EYE ABOVE YOU MEANS THEY SAW YOU GO IN.'],
  ['THROW', 'HOLD Q OR THE BLUE BUTTON TO AIM, LET GO TO THROW. NOISE LURES ADULTS AWAY. R SWITCHES ITEMS.'],
  ['SKILL', 'EACH KID HAS A SKILL: TAP THE GREEN BUTTON OR PRESS F.'],
], [
  ['CAUGHT', 'YOU GET 3 CHANCES. EACH TIME, SOME COINS GO BACK AND YOU START AGAIN AT THE LAST SAFE SPOT.'],
  ['NOISE', 'SOUND TRAVELS THROUGH ROOMS. WALLS STOP IT, CLOSED DOORS MUFFLE IT.'],
  ['STASHES', 'PURSES ARE QUICK BUT CLICK. BAYONGS RUSTLE. WALLETS ZIP. RISKY SPOTS PAY MORE.'],
  ['DOORS', 'DOORS BLOCK SIGHT. KEYS OPEN LOCKS. LEVERS OPEN GATES.'],
  ['KAIN NA', 'THE ORANGE BAR IS DINNER TIME. THE GREEN NOTCH IS PAR TIME.'],
  ['SECRET', 'EVERY LEVEL HIDES ONE ALKANSYA FOR BONUS COINS.'],
  ['STARS', 'CLEAR IT, BEAT PAR TIME, AND NEVER GET CAUGHT OR REALLY SPOTTED. STARS UNLOCK GIFTS.'],
]];
let helpPage = 0;

function wrap(text, cols) {
  const out = []; let line = '';
  for (const w of text.split(' ')) {
    if ((line + ' ' + w).trim().length > cols) { out.push(line); line = w; } else line = (line + ' ' + w).trim();
  }
  if (line) out.push(line);
  return out;
}

const helpBack = () => ({ x: 16, y: 332, w: 100, h: 17 });
const helpNext = () => ({ x: 124, y: 332, w: 100, h: 17 });
function drawHelp() {
  g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H);
  drawText(g, 'HOW TO PLAY', VIEW_W / 2, 14, C.gold, { scale: 2, align: 'center', shadow: C.gold2 });
  drawText(g, `${helpPage + 1}/${HELP.length}`, VIEW_W - 8, 18, C.gray, { align: 'right' });
  let y = 38;
  for (const [h, body] of HELP[helpPage]) {
    drawText(g, h, 12, y, C.yellow);
    const lines = wrap(body, 56);
    lines.forEach((l, i) => drawText(g, l, 12, y + 9 + i * 8, C.white));
    y += 9 + lines.length * 8 + 6;
  }
  drawButton(g, helpBack(), 'BACK', false);
  drawButton(g, helpNext(), helpPage < HELP.length - 1 ? 'NEXT >' : '< FIRST', true);
}

function updateHelp() {
  const next = () => { helpPage = (helpPage + 1) % HELP.length; sfx.click(); };
  if (input.pressed('ArrowRight') || input.pressed('d') || hit(input.tapPos, helpNext()) || input.pressed('Enter') || input.pressed(' ') || input.pressed('e')) next();
  else if (input.pressed('ArrowLeft') || input.pressed('a')) { helpPage = (helpPage + HELP.length - 1) % HELP.length; sfx.click(); }
  else if (input.pressed('Escape') || hit(input.tapPos, helpBack())) { sfx.unlock(); setMode(prevMode); }
}

// ---- options -----------------------------------------------------------------------
const OPT_Y = 44, OPT_GAP = 20;
const pct = (v) => `${Math.round(v * 100)}%`;
function optionItems() {
  return [
    `MUSIC: ${pct(settings.music)}`, `SOUND FX: ${pct(settings.sfx)}`, `MUTE ALL: ${isMuted() ? 'ON' : 'OFF'}`,
    `SCREEN SHAKE: ${shakeLabel(settings.shake)}`, `RED FLASH: ${settings.flash ? 'ON' : 'OFF'}`,
    canVibrate() ? `VIBRATE: ${hapticsOn() ? 'ON' : 'OFF'}` : 'VIBRATE: NOT ON THIS DEVICE',
    `VISUAL PULSE: ${settings.pulse ? 'ON' : 'OFF'}`, `BUTTONS: ${settings.left ? 'LEFT' : 'RIGHT'}-HANDED`,
    `GHOST OF BEST RUN: ${settings.ghost ? 'ON' : 'OFF'}`, 'COPY SAVE CODE', 'LOAD SAVE CODE', 'BACK',
    ...(playtest ? [`COPY PLAYTEST LOG (${ptRead().length})`] : []),
  ];
}
const OPT_HELP = [
  'MUSIC VOLUME', 'BEEPS AND CREAKS', 'SILENCE EVERYTHING (M KEY)', 'HOW MUCH THE SCREEN SHAKES', 'RED SCREEN WHEN CAUGHT',
  'PHONE BUZZES ON ALERTS', 'COLOURED SCREEN EDGE INSTEAD OF A BUZZ', 'MIRROR THE BUTTONS FOR YOUR LEFT THUMB',
  'SEE-THROUGH KID REPLAYS YOUR BEST TIME', 'MOVE YOUR SAVE TO ANOTHER PHONE', 'PASTE A CODE FROM ANOTHER PHONE', '', 'ALL DEATHS, PAUSES AND IDLE MOMENTS (JSON)',
];

function drawOptions() {
  if (prevMode === 'paused' && play) { play.draw(g); dim(0.85); } else { g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H); }
  drawText(g, 'OPTIONS', VIEW_W / 2, 14, C.gold, { scale: 3, align: 'center', shadow: C.gold2 });
  const items = optionItems();
  items.forEach((l, i) => drawButton(g, { ...buttonRect(i, OPT_Y, OPT_GAP, 200) }, l, i === sel));
  drawText(g, OPT_HELP[sel] || '', VIEW_W / 2, 308, C.gray, { align: 'center' });
  drawMsg(318);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back to a prompt */ }
  try { prompt('COPY THIS:', text); return true; } catch { return false; }
}

function updateOptions() {
  const items = optionItems(), n = items.length;
  if (input.pressed('Escape')) { setMode(prevMode); return; }
  if (input.pressed('ArrowUp') || input.pressed('w')) sel = (sel + n - 1) % n;
  if (input.pressed('ArrowDown') || input.pressed('s')) sel = (sel + 1) % n;
  let pick = -1;
  for (let i = 0; i < n; i++) if (hit(input.tapPos, buttonRect(i, OPT_Y, OPT_GAP, 200), 1)) pick = i;
  if (pick >= 0) sel = pick;
  else if (input.pressed('Enter') || input.pressed(' ') || input.pressed('e')) pick = sel;
  if (pick < 0) return;
  sfx.unlock();
  const o = save.opts;
  const cycle = (list, v) => list[(list.indexOf(v) + 1) % list.length] ?? list[0];
  switch (pick) {
    case 0: o.music = cycle(VOLUME_STEPS, o.music); break;
    case 1: o.sfx = cycle(VOLUME_STEPS, o.sfx); break;
    case 2: toggleSound(); break;
    case 3: o.shake = cycle(SHAKE_LEVELS, o.shake); break;
    case 4: o.flash = !o.flash; break;
    case 5: if (canVibrate()) { save.haptics = !hapticsOn(); } break;
    case 6: o.pulse = !o.pulse; break;
    case 7: o.left = !o.left; break;
    case 8: o.ghost = !o.ghost; break;
    case 9: copyText(saveCode(save)).then((ok) => say(ok ? 'SAVE CODE COPIED!' : 'COULD NOT COPY', ok ? C.green : C.orange)); break;
    case 10: {
      let code = null;
      try { code = prompt('PASTE YOUR KUPIT SAVE CODE:'); } catch { /* no prompt */ }
      if (!code) break;
      const s = readSaveCode(code);
      if (!s) { say('THAT CODE IS DAMAGED', C.orange); sfx.creak(); break; }
      save = s; persist(); applySettings(save); setMuted(save.muted); music.refresh();
      say('SAVE LOADED!', C.green);
      break;
    }
    case 11: setMode(prevMode); return;
    case 12: copyText(JSON.stringify(ptRead(), null, 1)).then((ok) => say(ok ? 'PLAYTEST LOG COPIED' : 'COULD NOT COPY', ok ? C.green : C.orange)); break;
  }
  persist(); applySettings(save);
  if (pick === 5) vibrate(40);
  if (pick !== 2 && pick < 9) sfx.click();
}

// ---- random house -----------------------------------------------------------------
const HOUSE_Y = 100, HOUSE_GAP = 20;
const houseItems = () => [
  'NEW HOUSE', isPasko() ? 'DAILY: NOCHE BUENA' : 'DAILY HOUSE', `DIFFICULTY: ${save.houseDiff}`,
  ...MUTATOR_ORDER.map((k) => `${MUTATORS[k].name}: ${save.mutators.includes(k) ? 'ON' : 'OFF'}`), 'BACK',
];
const dailyStars = () => (save.daily && save.daily.id === dailyId() ? save.daily.stars : 0);
const housesToday = () => (save.houseDay.id === dailyId() ? save.houseDay.n : 0);
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function drawHouse() {
  g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H);
  drawText(g, 'RANDOM HOUSE', VIEW_W / 2, 18, C.gold, { scale: 3, align: 'center', shadow: C.gold2 });
  drawText(g, 'A NEW HOUSE EVERY TIME.', VIEW_W / 2, 46, C.white, { align: 'center' });
  const streak = save.streak.last === dailyId() || save.streak.last === prevDailyId(dailyId()) ? save.streak.n : 0;
  drawText(g, `HOUSES CLEARED: ${save.houses}   DAILY STREAK: ${streak}`, VIEW_W / 2, 60, C.yellow, { align: 'center' });
  const m = mutatorMult(save.mutators), day = Math.max(0.25, 1 - 0.15 * housesToday());
  drawText(g, `PAYOUT X${(m * day).toFixed(2)}${housesToday() ? `  (${housesToday()} CLEARED TODAY)` : ''}`, VIEW_W / 2, 74, m > 1 ? C.green : C.gray, { align: 'center' });
  drawText(g, 'MUTATORS: HARDER RULES, MORE COINS', VIEW_W / 2, 86, C.dgray, { align: 'center' });
  drawMenu(g, houseItems(), sel, HOUSE_Y, HOUSE_GAP);
  const d = dailyStars(), dd = dailyDiff(), wd = DAYS[new Date(Date.now() + 8 * 3600e3).getUTCDay()];
  drawText(g, `TODAY (${wd}): DAILY HOUSE IS LEVEL ${dd}`, VIEW_W / 2, 248, C.gray, { align: 'center' });
  drawText(g, 'SAME HOUSE FOR EVERYONE (MANILA TIME)', VIEW_W / 2, 258, C.dgray, { align: 'center' });
  if (d) for (let i = 0; i < 3; i++) drawStar(g, VIEW_W / 2 - 22 + i * 15, 270, i < d);
  else drawText(g, 'NOT PLAYED YET TODAY', VIEW_W / 2, 272, C.dgray, { align: 'center' });
  const k = MUTATOR_ORDER[sel - 3];
  if (k) drawText(g, `${MUTATORS[k].desc}  X${MUTATORS[k].mult}`, VIEW_W / 2, 292, C.yellow, { align: 'center' });
  drawText(g, 'LEVEL 1 EASY ... LEVEL 5 HARD', VIEW_W / 2, 306, C.dgray, { align: 'center' });
  drawMsg(320);
}

function updateHouse() {
  if (input.pressed('Escape')) { setMode('title'); return; }
  const n = houseItems().length;
  const pick = menuPick(n, HOUSE_Y, HOUSE_GAP);
  if (pick === 0) startHouse(newSeed(), save.houseDiff);
  else if (pick === 1) startDaily();
  else if (pick === 2) { save.houseDiff = (save.houseDiff % 5) + 1; persist(); sfx.click(); }
  else if (pick >= 3 && pick < 3 + MUTATOR_ORDER.length) {
    const k = MUTATOR_ORDER[pick - 3];
    save.mutators = save.mutators.includes(k) ? save.mutators.filter((x) => x !== k) : [...save.mutators, k];
    persist(); sfx.click();
  } else if (pick === n - 1) setMode('title');
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
  drawText(g, 'N NEXT B PREV C CLEAR G GOD U QUOTA O EXIT I INFO', VIEW_W / 2, 336, C.dgray, { align: 'center' });
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
  else if (pick === 9) { save.bank += 50; persist(); sfx.coin(); }
  else if (pick === 10) { setDev(false); setMode('paused'); }
  else if (pick === 11) setMode('paused');
  if (pick >= 0 && pick <= 8) sfx.click();
}

// Hotkeys while playing in dev mode.
function devKeys() {
  const w = play.world;
  if (input.pressed('g')) dev.god = !dev.god;
  if (input.pressed('i')) dev.info = !dev.info;
  // U/O, not K/X: those are the throw and skill keys (pressing X used to teleport you AND fire your skill)
  if (input.pressed('u')) w.devFillQuota();
  if (input.pressed('o')) w.devGoToExit();
  if (input.pressed('c')) w.devClear();
  if (input.pressed('n') && !run) goLevel(idx + 1);
  if (input.pressed('b') && !run) goLevel(idx - 1);
}

// ---- pause ------------------------------------------------------------------------
const PAUSE_Y = 140;
const pauseItems = () => ['RESUME', 'RESTART', 'HOW TO PLAY', 'OPTIONS', 'LEVELS', 'TITLE', ...(dev.on ? ['DEV TOOLS'] : [])];
function drawPaused() {
  play.draw(g);
  dim(0.75);
  drawText(g, 'PAUSED', VIEW_W / 2, 90, C.gold, { scale: 5, align: 'center', shadow: C.gold2 });
  drawMenu(g, pauseItems(), sel, PAUSE_Y);
}

function updatePaused() {
  if (input.pressed('Escape') || input.pressed('p')) { input.reset(); setMode('play'); return; }
  const pick = menuPick(pauseItems().length, PAUSE_Y);
  if (pick === 0) { input.reset(); setMode('play'); }
  else if (pick === 1) restart();
  else if (pick === 2) { prevMode = 'paused'; helpPage = 0; setMode('help'); }
  else if (pick === 3) { prevMode = 'paused'; setMode('options'); }
  else if (pick === 4) { prevMode = 'paused'; setMode('levels'); sel = idx; }
  else if (pick === 5) setMode('title');
  else if (pick === 6) setMode('dev');
}

// ---- caught / clear -----------------------------------------------------------------
const END_Y = 236;
function drawCaught() {
  play.draw(g);
  dim();
  const a = play.catcher;
  if (a) { g.fillStyle = C.red; g.fillRect(VIEW_W / 2 - 30, 36, 60, 60); g.fillStyle = C.ink; g.fillRect(VIEW_W / 2 - 28, 38, 56, 56); drawPortrait(g, a.type, VIEW_W / 2 - 28, 38, 2); }
  if (play.reason === 'time') {
    drawText(g, 'KAIN NA!', VIEW_W / 2, 100, C.orange, { scale: 5, align: 'center', shadow: C.ink });
    drawText(g, `${a ? a.cfg.name : 'MAMA'}: "DINNER TIME! COME HERE!"`, VIEW_W / 2, 155, C.white, { align: 'center' });
  } else {
    drawText(g, play.reason === 'escape' ? 'HULI KA!' : 'CAUGHT!', VIEW_W / 2, 100, C.red, { scale: 6, align: 'center', shadow: C.ink });
    drawText(g, `${a.cfg.name}: "${a.cfg.shout}"`, VIEW_W / 2, 155, C.white, { align: 'center' });
    if (play.reason === 'escape') drawText(g, 'TOO SLOW! RUN FOR THE EXIT NEXT TIME', VIEW_W / 2, 165, C.orange, { align: 'center' });
    else if (play.world.lives > 1) drawText(g, `CAUGHT ${play.world.catches} TIMES. NO CHANCES LEFT!`, VIEW_W / 2, 165, C.orange, { align: 'center' });
  }
  drawText(g, `COINS ${play.world.coins}/${cur.quota}   TIME ${Math.floor(play.world.time)}S`, VIEW_W / 2, 177, C.gray, { align: 'center' });
  if (age > 0.5) drawMenu(g, run ? ['TRY AGAIN', 'NEW HOUSE', 'HOUSE MENU'] : ['TRY AGAIN', 'LEVELS', 'TITLE'], sel, END_Y);
}

function updateCaught() {
  const pick = menuPick(3, END_Y, 22, age > 0.5);
  if (pick === 0) restart();
  else if (pick === 1) { if (run) startHouse(newSeed(), run.daily ? save.houseDiff : run.diff); else { prevMode = 'title'; setMode('levels'); sel = idx; } }
  else if (pick === 2) setMode(run ? 'house' : 'title');
}

const clearItems = () => {
  const last = !run && idx === levels.length - 1;
  if (run?.daily) return ['COPY RESULT', 'PLAY AGAIN', 'HOUSE MENU', 'STORE'];
  return [run ? 'NEW HOUSE' : last ? 'TITLE' : 'NEXT LEVEL', 'PLAY AGAIN', run ? 'HOUSE MENU' : 'LEVELS', 'STORE'];
};

function drawClear() {
  play.draw(g);
  dim(0.75);
  const r = play.result;
  const last = !run && idx === levels.length - 1;
  drawText(g, run ? 'HOUSE CLEARED!' : last ? 'ALL DONE!' : cur.boss ? 'BOSS BEATEN!' : 'NICE KUPIT!', VIEW_W / 2, 70, C.gold, { scale: (cur.boss && !last) || run ? 4 : 5, align: 'center', shadow: C.gold2 });
  for (let i = 0; i < 3; i++) drawStar(g, VIEW_W / 2 - 22 + i * 15, 118, i < r.stars);
  drawText(g, `COINS ${r.coins}   TIME ${Math.floor(r.time)}S${r.catches ? `   CAUGHT ${r.catches}X` : ''}`, VIEW_W / 2, 138, C.white, { align: 'center' });
  if (run) drawText(g, `HOUSE ${cur.seed}   LEVEL ${run.diff}${run.daily ? '   DAILY' : ''}${run.mutators.length ? `   X${mutatorMult(run.mutators)}` : ''}`, VIEW_W / 2, 150, C.gray, { align: 'center' });
  else drawText(g, newBest ? 'NEW BEST TIME! (GHOST SAVED)' : `BEST ${Math.floor(save.best[cur.id] || r.time)}S`, VIEW_W / 2, 150, newBest ? C.green : C.gray, { align: 'center' });
  drawText(g, `${r.fast ? 'FAST + ' : `PAR ${cur.par}S  `}${r.stealth ? 'SILENT' : r.catches ? 'GOT CAUGHT' : 'SPOTTED A BIT'}`, VIEW_W / 2, 162, C.gray, { align: 'center' });
  drawText(g, `+${earned} COINS   BANK ${save.bank}`, VIEW_W / 2, 178, C.gold, { align: 'center' });
  let y = 190;
  if (bossBonus) { drawText(g, `BOSS BONUS +${bossBonus}`, VIEW_W / 2, y, C.green, { align: 'center' }); y += 11; }
  if (r.bonus) { drawText(g, `SECRET ALKANSYA +${r.bonus}`, VIEW_W / 2, y, C.green, { align: 'center' }); y += 11; }
  if (run?.daily) { drawText(g, `DAILY STREAK: ${save.streak.n}`, VIEW_W / 2, y, C.orange, { align: 'center' }); y += 11; }
  for (const u of unlocked.slice(0, 2)) { drawText(g, `NEW ${u.kind === 'outfit' ? 'OUTFIT' : 'DECOR'}: ${u.name}!`, VIEW_W / 2, y, C.pink, { align: 'center' }); y += 11; }
  if (age > 0.5) drawMenu(g, clearItems(), sel, END_Y, 21);
  drawMsg(326);
}

function updateClear() {
  const last = !run && idx === levels.length - 1;
  const pick = menuPick(4, END_Y, 21, age > 0.5);
  if (pick < 0) return;
  if (pick === 3) { shopScreen.sel = 0; setMode('store'); return; }
  if (run?.daily) {
    if (pick === 0) copyText(shareText).then((ok) => say(ok ? 'RESULT COPIED! PASTE IT ANYWHERE' : 'COULD NOT COPY', ok ? C.green : C.orange));
    else if (pick === 1) restart();
    else if (pick === 2) setMode('house');
    return;
  }
  if (pick === 0) {
    if (run) startHouse(newSeed(), run.diff);
    else if (last) { if (!save.story.ending) startStory(ENDING, () => { save.story.ending = true; persist(); setMode('title'); }); else setMode('title'); }
    else start(idx + 1);
  } else if (pick === 1) restart();
  else if (pick === 2) { if (run) setMode('house'); else { prevMode = 'title'; setMode('levels'); sel = Math.min(idx + 1, levels.length - 1); } }
}

// The Daily House result as text anyone can paste into a chat.
function makeShare(r) {
  const stars = '⭐'.repeat(r.stars) + '▫️'.repeat(3 - r.stars);
  return [
    `KUPIT ${cur.pasko ? 'NOCHE BUENA' : 'DAILY'} ${dailyId()} (LEVEL ${run.diff})`,
    `${stars} ⏱️${Math.floor(r.time)}s 👀${r.spotted} 🫣${r.catches}`,
    `🔥 ${save.streak.n}-day streak`,
  ].join('\n');
}

function afterPlay() {
  play.banner = null;
  unlocked = [];
  if (play.status === 'caught') { setMode('caught'); return; }
  if (play.status !== 'clear') return;
  setMode('clear');
  const r = play.result, today = dailyId();
  if (run) { // Random House: pays coins (scaled), but no level unlocks or records (except the daily)
    bossBonus = 0;
    if (run.daily) {
      const prev = save.daily?.id === today ? save.daily.stars : 0;
      earned = housePayout({ coins: r.coins, stars: r.stars, diff: run.diff, daily: true, prevStars: prev });
      if (!prev) { // first clear today: the streak goes on (or starts over)
        const s = save.streak;
        s.n = s.last === prevDailyId(today) ? s.n + 1 : s.last === today ? s.n : 1;
        s.last = today; s.best = Math.max(s.best || 0, s.n);
      }
      save.daily = { id: today, stars: Math.max(prev, r.stars) };
      shareText = makeShare(r);
    } else {
      if (save.houseDay.id !== today) save.houseDay = { id: today, n: 0 };
      earned = housePayout({ coins: r.coins, stars: r.stars, diff: run.diff, housesToday: save.houseDay.n, mult: mutatorMult(run.mutators) });
      save.houseDay.n++;
      if (run.diff >= 3) for (const m of run.mutators) save.mutatorClears[m] = true;
    }
    save.houses++;
  } else {
    const id = cur.id, t = r.time, first = save.stars[id] === undefined, prevStars = save.stars[id] || 0;
    newBest = !save.best[id] || t < save.best[id];
    if (newBest) { save.best[id] = t; if (play.rec) storeGhost(id, play.rec); }
    save.stars[id] = Math.max(prevStars, r.stars);
    save.unlocked = Math.max(save.unlocked, Math.min(idx + 1, levels.length - 1));
    bossBonus = cur.boss && first ? cur.boss.bonus : 0; // first clear only
    const alk = r.bonus && !save.alkansya[id] ? r.bonus : 0;
    if (r.bonus) save.alkansya[id] = true;
    earned = campaignPayout({ coins: r.coins, stars: r.stars, prevStars, first, bossBonus, alkansya: alk });
  }
  save.bank += earned;
  unlocked = grantUnlocks(save, { pasko: isPasko() });
  persist();
}

const shopCtx = { get save() { return save; }, persist, back: () => setMode('title'), go: (m) => { cosmeticsScreen.sel = 0; if (grantUnlocks(save, { pasko: isPasko() }).length) persist(); setMode(m); } };
const cosmeticsCtx = { get save() { return save; }, persist, back: () => setMode('store'), go: () => {} };

// Pick the music for the current screen. The chase track needs a real chase (not a flicker) to start,
// and sticks around a moment after it ends.
function syncMusic(dt) {
  if (input.tapPos || input.hits.size) {
    if (!audioReady) { audioReady = true; music.warm(); requestPersist(); }
  }
  if (!audioReady) return;
  let want;
  if (mode === 'play') {
    const chasing = play.world.adults.some((a) => a.state === 'chase');
    chaseT = chasing ? chaseT + dt : 0;
    if (chaseT > 0.25) chaseHold = 2.5; else chaseHold = Math.max(0, chaseHold - dt);
    want = chaseHold > 0 ? 'chase' : cur.boss ? 'boss' : 'sneak';
  } else if (mode === 'paused' || mode === 'dev' || (mode === 'options' && prevMode === 'paused') || (mode === 'help' && prevMode === 'paused')) want = music.name;
  else if (mode === 'caught' || mode === 'clear' || mode === 'loading') want = null;
  else want = 'menu';
  music.duck(mode === 'paused' || mode === 'dev' || (mode !== 'play' && prevMode === 'paused' && (mode === 'options' || mode === 'help')));
  music.play(want);
}

// Keep the screen awake while playing (where the browser supports it).
let wakeLock = null, wakeWanted = false;
async function syncWake(on) {
  if (on === wakeWanted) return;
  wakeWanted = on;
  try {
    if (on && navigator.wakeLock && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener?.('release', () => { wakeLock = null; }); }
    else if (!on && wakeLock) { const w = wakeLock; wakeLock = null; await w.release(); }
  } catch { wakeLock = null; }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  age += dt;
  if (msg && (msg.t -= dt) <= 0) msg = null;
  input.buttonEnabled = mode === 'play';
  if (input.pressed('m')) toggleSound();
  if (input.pressed('`')) { setDev(!dev.on); sfx.click(); }
  dev.fps += ((dt > 0 ? 1 / dt : 60) - dev.fps) * 0.1;

  const m = mode; // dispatch on the mode at frame start so one keypress can't act on two screens
  if (m === 'play') {
    if (input.pauseTap || input.pressed('Escape') || input.pressed('p')) pause();
    else {
      if (dev.on) devKeys();
      acc += dt * dev.speed;
      let n = 0;
      while (acc >= STEP && n < 10 && play.status === 'play') { play.update(STEP); acc -= STEP; n++; }
      if (n >= 10) acc = 0; // way behind (slow device, debugger): don't spiral
      if (play.status !== 'play') { acc = 0; afterPlay(); }
    }
    if (mode === 'play') play.draw(g);
  }
  const screens = { title: [updateTitle, drawTitle], levels: [updateLevels, drawLevels], help: [updateHelp, drawHelp],
    options: [updateOptions, drawOptions], story: [updateStory, drawStory],
    store: [() => shopScreen.update(input, shopCtx, dt), () => shopScreen.draw(g, shopCtx)],
    cosmetics: [() => cosmeticsScreen.update(input, cosmeticsCtx, dt), () => cosmeticsScreen.draw(g, cosmeticsCtx)],
    chars: [() => charScreen.update(input, shopCtx, dt), () => charScreen.draw(g, shopCtx)],
    house: [updateHouse, drawHouse],
    dev: [updateDevMenu, drawDevMenu],
    paused: [updatePaused, drawPaused], caught: [updateCaught, drawCaught], clear: [updateClear, drawClear] };
  if (screens[m]) { screens[m][0](); if (mode === m) screens[m][1](); } // skip the draw if the screen just changed
  else if (m === 'loading') { g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H); drawText(g, 'LOADING...', VIEW_W / 2, 170, C.white, { align: 'center' }); }

  syncMusic(dt);
  syncWake(mode === 'play');
  if (fadeT > 0) { g.globalAlpha = Math.min(1, fadeT / FADE); g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H); g.globalAlpha = 1; fadeT -= dt; }

  input.endFrame();
  requestAnimationFrame(frame);
}

addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
  suspendAudio(document.hidden); // no music while the app is in the background
  if (!document.hidden && wakeWanted) { wakeWanted = false; syncWake(mode === 'play'); } // the lock is dropped when hidden
});
// Browsers (iOS Safari especially) only start audio from inside a real input event, not from the game loop.
for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown']) addEventListener(ev, () => sfx.unlock(), { passive: true });
// No double-tap zoom, pinch zoom or long-press menus on the game.
for (const ev of ['dblclick', 'gesturestart', 'contextmenu']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });

Promise.all([loadLevels(), loadAtlas()]).then(([l]) => {
  levels = l;
  setMode('title');
  const q = new URLSearchParams(location.search);
  const jump = Number(q.get('level')); // ?level=2 jumps to level 2
  if (jump >= 1 && jump <= levels.length) start(jump - 1);
  const hs = Number(q.get('house')); // ?house=1234&diff=3
  if (hs) startHouse(hs, Number(q.get('diff')) || 2);
  if (q.has('daily')) startDaily();
}).catch((e) => {
  console.error(e);
  mode = 'loading';
});
requestAnimationFrame(frame);

// Debug hook for automated checks: window.__kupit
window.__kupit = { get play() { return play; }, get mode() { return mode; }, start, startHouse, startDaily, input, get save() { return save; }, get cur() { return cur; }, get run() { return run; } };

// ---- installable + offline (PWA) --------------------------------------------------------
// The service worker serves one consistent, versioned copy of the game. When a new version has downloaded
// it waits; the title screen offers "UPDATE READY" and switches over only when the player says so.
// (Skipped on localhost so edits show up immediately while developing; add ?sw=1 to test it there.)
let updateReady = null;
function applyUpdate() {
  if (!updateReady) return;
  sfx.click();
  updateReady.postMessage({ type: 'skipWaiting' });
}
const localDev = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && !new URLSearchParams(location.search).has('sw');
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !localDev) {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const watch = (w) => w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) updateReady = w; });
    if (reg.waiting && navigator.serviceWorker.controller) updateReady = reg.waiting;
    reg.addEventListener('updatefound', () => watch(reg.installing));
    setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
  }).catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading && updateReady) { reloading = true; location.reload(); } });
}
