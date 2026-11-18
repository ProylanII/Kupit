import { Input, VIEW_W, VIEW_H, BASE_H, EXTRA, MAX_EXTRA, setExtra } from './core/input.js';
import { VERSION } from './core/version.js';
import { loadSave, writeSave, requestPersist, saveCode, readSaveCode, newGameSave } from './core/save.js';
import { sfx, setMuted, isMuted, suspendAudio } from './core/audio.js';
import { Play } from './scenes/play.js';
import { PresoScene } from './scenes/preso.js';
import { RunnerScene } from './scenes/runner.js';
import { album, updateAlbum, drawAlbum, drawRewardIcon, PHOTOS, photoUnlocked } from './scenes/album.js';
import { drawText, drawBig } from './ui/font.js';
import { drawActor, drawStar, drawTarget, drawCoin, drawPortrait, drawObj, getSprite } from './render/sprites.js';
import { parol } from './render/tiles.js';
import {
  CHARACTERS, CHAR_ORDER, MAX_STARS, totalStars, grantUnlocks, campaignPayout, isPasko,
  grantSiblings, NEED_ORDER, hasNeed, needCost, needOpen, UPGRADE_ORDER, upgradeCost, grantRewards,
} from './game/progression.js';
import { C } from './render/palette.js';
import { shopScreen, upgradesScreen, cosmeticsScreen } from './scenes/shop.js';
import { drawHideout, drawCat, drawMap, mapLayout, mapScrollFor, mapNodeRect, mapVisible } from './scenes/hub.js';
import { dev, initDev, setDev, SPEEDS } from './core/dev.js';
import { music } from './core/music.js';
import { loadAtlas } from './render/atlas.js';
import { hapticsOn, vibrate, canVibrate } from './core/haptics.js';
import { settings, applySettings, SHAKE_LEVELS, shakeLabel, VOLUME_STEPS } from './core/settings.js';
import { loadGhost, storeGhost, clearGhosts } from './game/ghost.js';
import { INTRO, BEFORE, AFTER, ENDING, EPILOGUE, NAMES, CHAPTERS } from './data/story.js';
import { missionIds, missionLabel, maskOf, starsOf } from './game/missions.js';
import { returnPlan, applyReturn } from './game/ibalik.js';
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
// A tall phone (narrower than the game's 240x392 shape, below 2x) gets extra rows so the game fills the screen: the
// play scenes use them (input.js setExtra), menus are centred in them (OFF).
function resize() {
  const de = document.documentElement, cs = getComputedStyle(document.body);
  const px = (k) => parseFloat(cs[k]) || 0;
  const w = de.clientWidth - px('paddingLeft') - px('paddingRight'), h = de.clientHeight - px('paddingTop') - px('paddingBottom');
  setExtra(w > 0 && w / VIEW_W < 2 ? Math.min(MAX_EXTRA, Math.floor((VIEW_W * h) / w) - BASE_H) : 0);
  if (canvas.height !== VIEW_H) { canvas.height = VIEW_H; g.imageSmoothingEnabled = false; }
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
let cur = null;   // the level being played
let mode = 'loading'; // loading | title | levels | help | options | story | card | dev | store | upgrades | cosmetics | album | play | paused | caught | clear
let play = null;
let age = 0;
let sel = 0;       // highlighted menu item
let scroll = 0;    // level-select scroll offset
let prevMode = 'title'; // where BACK goes from levels/help/options
let newBest = false;
let earned = 0;
let bossBonus = 0;
let msg = null;    // { text, color, t } short message on menus
let starShown = [false, false, false]; // clear screen: which stars have popped in
let starsBefore = 0;                   // clear screen: the missions already done before this run (bit mask)
let rewardsShown = [];                 // clear screen: what this run's new stars paid (mini-game rewards)
const fails = {};                      // level id -> failed tries this session (a bonus level can be skipped after two)
// Mini-games (level "mode") have scenes of their own; everything else is the stealth game (scenes/play.js).
const SCENES = { preso: PresoScene, habol: RunnerScene };
const sceneFor = (L) => SCENES[L.mode] || Play;
const special = (L) => !!(L.mode || L.cat); // no crew to pick

const FADE = 0.25;
// Menus and story panels are designed at 240x392: on a tall phone they sit in the middle of the screen.
const OFF = () => Math.round(EXTRA / 2);
const OVERLAY = new Set(['paused', 'caught', 'clear', 'dev']); // drawn over the level (which fills the whole screen)
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
  const Scene = sceneFor(cur);
  const ghost = settings.ghost && Scene === Play ? loadGhost(cur.id) : null;
  const L = special(cur) ? cur : prepare(cur);
  play = new Scene(L, input, { char: save.char, upgrades: save.upgrades, lives: 3, alkansyaFound: !!save.alkansya[cur.id] },
    { tips, ghost, outfit: save.outfit, record: true, log: playtest ? ptEvent : null,
      earned: save.missions[cur.id] | 0, noCard: true, // the card came before the level
      quietClear: !!cur.ending && !save.story.ending, // the storm ends on "HULI KA!", not on a fanfare
      kitten: cur.storm ? 0 : cur.hingi ? 3 : save.story.epilogue ? 1 : 0 }); // the epilogue: all three trot after you; afterwards Tigre tags along
  ptLog('start');
  input.reset();
  acc = 0;
  setMode('play');
}

function start(i) { idx = i; cur = levels[i]; launch(); }

// IBALIK (game/ibalik.js): how much goes back, and from where, comes from the ledger of earlier first clears.
const ibalikPlan = () => {
  const at = levels.findIndex((l) => l.giveBack);
  return returnPlan(save.ledger, levels.slice(0, Math.max(0, at)).map((l) => l.id), save.bank);
};
const prepare = (L) => (L.giveBack ? applyReturn(L, ibalikPlan()) : L);
const storyFlags = () => ({ brokeAlkansya: ibalikPlan().fromAlkansya > 0 });

const restart = () => launch();

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
// A near-solid band behind results text, so the level showing through the dim (a kid standing right where the
// headline is) never reads as part of the words.
function panel(y0, y1, a = 0.88) {
  g.globalAlpha = a; g.fillStyle = C.ink; g.fillRect(0, y0, VIEW_W, y1 - y0); g.globalAlpha = 1;
  g.fillStyle = C.wallD; g.fillRect(0, y0, VIEW_W, 1); g.fillRect(0, y1 - 1, VIEW_W, 1);
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
let story = null; // { panels, i, then, flash }
function startStory(panels, then) {
  const flags = storyFlags();
  panels = panels.filter((p) => !p.when || flags[p.when]);
  story = { panels, i: 0, then, flash: 0 }; setMode('story'); enterPanel();
}
// A "caught" panel opens exactly like the game's own caught screen: the sting, a buzz and a red flash.
function enterPanel() {
  const p = story.panels[story.i];
  if (p && p.caught) { sfx.caught(); vibrate([80, 40, 140]); story.flash = settings.flash ? 0.7 : 0; }
}
const levelIds = () => levels.map((l) => l.id);

// Start a campaign level, playing whatever part of the story comes before it the first time.
let beganFrom = 'title'; // where the player chose to start a level (the card's BACK returns there)
function begin(i) {
  if (mode !== 'story' && mode !== 'card') beganFrom = mode;
  const L = levels[i];
  if (!L) return;
  const go = () => begin(i);
  if (i === 0 && !save.story.intro) { startStory(INTRO, () => { save.story.intro = true; persist(); go(); }); return; }
  // (the ending normally plays the moment the storm is cleared; this covers saves that got past it another way)
  if (L.epilogue && !save.story.ending) { startStory(ENDING, () => { save.story.ending = true; persist(); go(); }); return; }
  const scene = BEFORE[L.id];
  if (scene && !save.story.seen[L.id]) {
    startStory(scene, () => {
      save.story.seen[L.id] = true;
      for (const p of scene) if (p.flag) save.story[p.flag] = true; // e.g. Aling Nena's discount
      grantSiblings(save, levelIds());                               // a sibling who joined in this scene
      persist(); go();
    });
    return;
  }
  showCard(i);
}

// ---- before a level: SINO ANG PUPUNTA? (who's going?) -------------------------------------------------
// The level, its three stars and the crew: pick who goes. A level can
// suggest a kid ("suggest": "bing", "suggestWhy": "..."), but every level can be finished as Jun.
let card = null; // { i, sel: index into the crew row }
const CARD_GO = { x: 20, y: 318, w: 200, h: 22 }, CARD_BACK = { x: 70, y: 346, w: 100, h: 15 };
const cardSlot = (k) => ({ x: VIEW_W / 2 - 74 + k * 38, y: 190, w: 34, h: 34 });
function showCard(i) {
  const L = levels[i];
  if (!L || L.epilogue) { start(i); return; } // nobody sneaks in the epilogue
  const want = save.pick[L.id] && save.chars.includes(save.pick[L.id]) ? save.pick[L.id] : save.char;
  card = { i, sel: Math.max(0, CHAR_ORDER.indexOf(want)) };
  setMode('card');
}
function cardGo() {
  const L = levels[card.i], id = CHAR_ORDER[card.sel];
  if (!special(L)) { save.char = id; save.pick[L.id] = id; persist(); }
  sfx.unlock(); start(card.i);
}
function updateCard() {
  const owned = (k) => save.chars.includes(CHAR_ORDER[k]);
  const move = (d) => { let k = card.sel; for (let n = 0; n < CHAR_ORDER.length; n++) { k = (k + d + CHAR_ORDER.length) % CHAR_ORDER.length; if (owned(k)) break; } if (k !== card.sel) { card.sel = k; sfx.click(); } };
  const crew = !special(levels[card.i]);
  if (crew && (input.pressed('ArrowLeft') || input.pressed('a'))) move(-1);
  if (crew && (input.pressed('ArrowRight') || input.pressed('d'))) move(1);
  if (input.pressed('Escape') || hit(input.tapPos, CARD_BACK)) { sfx.unlock(); if (beganFrom === 'levels') { prevMode = 'title'; setMode('levels'); } else setMode('title'); return; }
  const tp = input.tapPos;
  if (tp && crew) for (let k = 0; k < CHAR_ORDER.length; k++) if (hit(tp, cardSlot(k))) { if (owned(k)) { card.sel = k; sfx.click(); } else sfx.creak(); return; }
  if (age > 0.25 && (hit(tp, CARD_GO) || input.pressed('Enter') || input.pressed(' ') || input.pressed('e'))) cardGo();
}
function drawCard() {
  const L = levels[card.i], cx = VIEW_W / 2;
  g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H);
  if (!titleBg) titleBg = buildTitleBg();
  g.globalAlpha = 0.18; g.drawImage(titleBg, 0, 0); g.globalAlpha = 1;
  const c = CHAPTERS[chapterOf(card.i)];
  drawText(g, `CHAPTER ${chapterOf(card.i) + 1}: ${c.name}`, cx, 14, C.gray, { align: 'center' });
  drawText(g, L.name, cx, 28, C.gold, { scale: L.name.length > 12 ? 2 : 3, align: 'center', shadow: C.gold2 });
  // the three stars (missions), earned ones lit
  const ids = missionIds(L), mask = save.missions[L.id] | 0;
  g.globalAlpha = 0.85; g.fillStyle = '#2a2440'; g.fillRect(cx - 100, 60, 200, 40); g.globalAlpha = 1;
  ids.forEach((m, k) => {
    const on = !!((mask >> k) & 1);
    drawStar(g, cx - 92, 65 + k * 11, on); drawText(g, missionLabel(L, m), cx - 82, 66 + k * 11, on ? C.gold : C.white);
    if (L.rewards?.[k]) { if (on) g.globalAlpha = 0.35; drawRewardIcon(g, L.rewards[k], cx + 80, 65 + k * 11); g.globalAlpha = 1; } // what this star pays
  });
  if (special(L)) { drawModeCard(L, cx); return; }
  let y = 110;
  if (L.howto) { for (const [, l] of L.howto.slice(0, 3)) { drawText(g, l, cx, y, C.gray, { align: 'center' }); y += 9; } }
  else if (L.hint) { for (const l of wrap(L.hint, 56).slice(0, 2)) { drawText(g, l, cx, y, C.gray, { align: 'center' }); y += 9; } }
  // the crew
  drawText(g, "WHO'S GOING?", cx, 164, C.gold, { align: 'center' });
  CHAR_ORDER.forEach((id, k) => {
    const r = cardSlot(k), have = save.chars.includes(id), on = card.sel === k;
    g.fillStyle = on ? C.gold : C.wallD; g.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    g.fillStyle = C.ink; g.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    if (have) drawPortrait(g, id, r.x + 2, r.y + 2, 1, on ? 'happy' : '');
    else drawText(g, '?', r.x + r.w / 2, r.y + 13, C.dgray, { align: 'center' });
    if (have && L.suggest === id) { g.fillStyle = C.green; g.fillRect(r.x + r.w - 7, r.y - 3, 8, 8); drawText(g, '!', r.x + r.w - 4, r.y - 1, C.ink); }
  });
  const ch = CHARACTERS[CHAR_ORDER[card.sel]];
  drawText(g, ch.name, cx, 232, C.white, { align: 'center' });
  ch.lines.forEach((l, k) => drawText(g, l, cx, 242 + k * 9, k ? C.gray : C.yellow, { align: 'center' }));
  if (L.suggest && save.chars.includes(L.suggest)) drawText(g, `! ${L.suggestWhy || `${CHARACTERS[L.suggest].name} FITS THIS ONE`}`, cx, 268, C.green, { align: 'center' });
  drawButton(g, CARD_GO, 'GO!', true);
  drawButton(g, CARD_BACK, 'BACK', false);
}

// The card of a mini-game or Mingming's night: no crew to pick, so the space shows how it plays.
function drawModeCard(L, cx) {
  drawText(g, L.bonus ? 'A BONUS GAME' : L.cat ? 'TONIGHT YOU ARE THE CAT' : 'SOMETHING DIFFERENT', cx, 108, C.orange, { align: 'center' });
  const n = (L.howto || []).length;
  g.globalAlpha = 0.85; g.fillStyle = '#2a2440'; g.fillRect(12, 120, VIEW_W - 24, 16 + n * 22); g.globalAlpha = 1;
  drawText(g, 'HOW TO PLAY', cx, 124, C.gold, { align: 'center' });
  (L.howto || []).forEach(([icon, text], k) => {
    const y = 138 + k * 22;
    drawHowIcon(icon, 26, y + 6);
    wrap(text, 46).slice(0, 2).forEach((l, j) => drawText(g, l, 40, y + j * 8, C.white));
  });
  const t = performance.now() / 1000, y0 = 256;
  if (L.mode === 'preso') {
    drawActor(g, 'buboy', cx + 44, y0 + 34, 0, 0);
    drawActor(g, save.outfit !== 'basic' ? `jun~${save.outfit}` : 'jun', cx - 44, y0 + 34, 3, Math.floor(t * 2) % 2 ? 'cast' : 'reach');
    drawObj(g, 'lata', cx + 22, y0 + 24);
    drawObj(g, 'tsinela', cx - 12 + ((t * 30) % 30), y0 + 14 - Math.sin(((t * 30) % 30) / 30 * Math.PI) * 14, 'blue');
  } else if (L.mode === 'habol') {
    const k = getSprite('tigre', 2, Math.floor(t * 12) % 4), j = getSprite(save.outfit !== 'basic' ? `jun~${save.outfit}` : 'jun', 2, `run${Math.floor(t * 12) % 4}`);
    g.globalAlpha = 0.3; g.fillStyle = C.ink; g.fillRect(cx - 50, y0 + 34, 100, 2); g.globalAlpha = 1;
    g.drawImage(j, cx - 36, y0 + 34 - j.height); g.drawImage(k, cx + 26, y0 + 34 - k.height);
  } else if (L.cat) { g.fillStyle = C.gold; g.fillRect(cx - 17, y0 - 1, 34, 34); g.fillStyle = C.ink; g.fillRect(cx - 15, y0 + 1, 30, 30); drawPortrait(g, 'cat', cx - 14, y0 + 2, 1); }
  drawButton(g, CARD_GO, 'GO!', true);
  drawButton(g, CARD_BACK, 'BACK', false);
}
// a small picture for each line of a mini-game's how-to
function drawHowIcon(kind, x, y) {
  const f = (c, a, b, w, h) => { g.fillStyle = c; g.fillRect(x + a, y + b, w, h); };
  switch (kind) {
    case 'aim': f(C.ink, -4, -4, 9, 9); for (let i = -3; i <= 3; i++) { f(C.green, i, i, 1, 1); f(C.green, i, -i, 1, 1); } break;
    case 'run': drawObj(g, 'tsinela', x, y, 'blue'); break;
    case 'taya': f(C.ink, -9, -4, 19, 9); f(C.red, -8, -3, 17, 7); drawText(g, 'TAYA', x - 7, y - 2, C.white); break;
    case 'safe': for (let a = 0; a < 12; a++) f(C.green, Math.round(Math.cos(a / 1.9) * 7), Math.round(Math.sin(a / 1.9) * 4), 1, 1); drawObj(g, 'tsinela', x, y, 'blue'); break;
    case 'up': case 'down': f(C.ink, -6, -6, 13, 13); f(kind === 'up' ? C.gold : '#4f8fff', -5, -5, 11, 11); g.fillStyle = C.ink; for (let i = 0; i < 4; i++) g.fillRect(x - i, kind === 'up' ? y - 2 + i : y + 1 - i, 1 + i * 2, 1); break;
    case 'crate': f(C.ink, -6, -6, 13, 13); f('#c48a4a', -5, -5, 11, 11); f('#a8723a', -5, 0, 11, 1); break;
    case 'tigre': case 'kuting': { const s = getSprite('tigre', 0, 'sit'); g.drawImage(s, x - (s.width >> 1), y - (s.height >> 1)); break; }
    case 'pusa': { const s = getSprite('pusa', 0, 'sit'); g.drawImage(s, x - (s.width >> 1), y - (s.height >> 1)); break; }
    case 'table': f(C.ink, -8, -4, 16, 8); f(C.table, -7, -3, 14, 6); f(C.table2, -7, -3, 14, 2); break;
    case 'tabig': f('#cfe9f2', -2, -5, 5, 6); f(C.white, -1, -4, 1, 4); for (let i = 0; i < 4; i++) f(C.gold, -6 + i * 4, 4, 1, 1); break;
    case 'hole': f(C.ink, -7, -3, 15, 8); f('#2a2440', -6, -2, 13, 6); break;
    case 'drip': f('#9fc0ff', 0, -7, 1, 2); f('#9fc0ff', 0, -3, 1, 2); drawObj(g, 'palanggana', x, y + 3); break;
    case 'bag': f(C.ink, -6, -5, 13, 11); f('#c8a46a', -5, -4, 11, 9); f('#a8844a', -5, 2, 11, 2); f('#6e5334', -1, -5, 3, 2); break;
    default: f(C.gold, -1, -1, 3, 3);
  }
}

const SKIP = { x: VIEW_W - 58, y: 8, w: 50, h: 15 };
function updateStory() {
  if (hit(input.tapPos, SKIP) || input.pressed('Escape')) { sfx.unlock(); story.then(); return; }
  if (age > 0.3 && (input.tapPos || input.pressed('Enter') || input.pressed(' ') || input.pressed('e'))) {
    const p = story.panels[story.i], all = p.lines.reduce((n, l) => n + l.length, 0);
    sfx.click();
    if (age * 45 < all) age = 99; // first tap finishes the line, the next one moves on
    else if (++story.i >= story.panels.length) story.then(); else { age = 0; enterPanel(); }
  }
}

function drawStory() {
  g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H);
  if (!titleBg) titleBg = buildTitleBg();
  g.globalAlpha = 0.3; g.drawImage(titleBg, 0, 0); g.globalAlpha = 1;
  const p = story.panels[story.i], cx = VIEW_W / 2, py = 150;
  drawButton(g, SKIP, 'SKIP', false);
  if (p.caught) drawText(g, 'HULI KA!', cx, 96, C.red, { scale: 6, align: 'center', shadow: C.ink });
  g.fillStyle = p.caught ? C.red : C.gold; g.fillRect(cx - 32, py - 1, 64, 64);
  g.fillStyle = '#2a2440'; g.fillRect(cx - 30, py + 1, 60, 60);
  const look = p.who === 'jun' && save.outfit !== 'basic' ? `jun~${save.outfit}` : p.who;
  if (!drawPortrait(g, look, cx - 30, py + 1, 2, p.mood)) {
    if (p.who === 'cat') { g.save(); g.translate(cx - 26, py + 52); g.scale(4, 4); drawCat(g, 0, 0, { big: true, patch: '#e8a04a', t: performance.now() / 1000 }); g.restore(); }
    else drawActor(g, look, cx, py + 50, 0, 0);
  }
  drawBig(g, NAMES[p.who] || p.who, cx, py + 70, C.gold, { align: 'center' });
  g.fillStyle = C.wallD; g.fillRect(6, 240, VIEW_W - 12, 16 + p.lines.length * 12);
  g.fillStyle = C.ink; g.fillRect(6, 240, VIEW_W - 12, 1);
  const shown = Math.floor(age * 45); // typewriter
  let used = 0;
  p.lines.forEach((l, i) => { const n = Math.max(0, Math.min(l.length, shown - used)); used += l.length; drawBig(g, l.slice(0, n), cx, 249 + i * 12, C.white, { align: 'center' }); });
  if (p.join && shown >= used) drawText(g, `${CHARACTERS[p.join].name} JOINS THE CREW! SKILL: ${CHARACTERS[p.join].skill.label}`, cx, 312, C.green, { align: 'center' });
  if (p.flag === 'nena' && shown >= used) drawText(g, "CAT THINGS COST LESS AT ALING NENA'S NOW", cx, 322, C.yellow, { align: 'center' });
  for (let i = 0; i < story.panels.length; i++) { g.fillStyle = i === story.i ? C.gold : C.dgray; g.fillRect(cx - story.panels.length * 4 + i * 8, 340, 5, 5); }
  if (Math.floor(age * 2) % 2) drawText(g, 'TAP TO CONTINUE', cx, 358, C.gray, { align: 'center' });
  if (story.flash > 0) { g.globalAlpha = Math.min(0.6, story.flash); g.fillStyle = C.red; g.fillRect(0, -OFF(), VIEW_W, VIEW_H); g.globalAlpha = 1; story.flash -= 1 / 40; }
}

// ---- title: the hideout under the house -------------------------------------------------
// One big button for the story, four small ones for everything else. (Keyboard order = the list order.)
const HUB_Y = 186;
const TITLE_RECTS = [
  { x: 20, y: 267, w: 200, h: 22 },
  { x: 20, y: 295, w: 98, h: 19 }, { x: 122, y: 295, w: 98, h: 19 },
  { x: 20, y: 319, w: 98, h: 19 }, { x: 122, y: 319, w: 98, h: 19 },
];
const T_SHOP = 2, T_ALBUM = 3; // (the buttons that get a "!" badge)
function titleItems() {
  const L = levels[unlockedMax()];
  const play = !save.story.intro && save.unlocked === 0 ? 'START THE STORY' : `${save.story.epilogue ? 'VISIT' : 'NEXT'}: ${L ? L.name : ''}`;
  return [play, 'MAP', "ALING NENA'S", 'ALBUM', 'OPTIONS'];
}
const canAffordNeed = () => NEED_ORDER.some((id) => !hasNeed(save, id) && needOpen(save, id) && save.bank >= needCost(save, id));
const chapterOf = (i) => { let c = 0; levels.slice(0, i + 1).forEach((L) => { const k = CHAPTERS.findIndex((x) => x.from === L.id); if (k >= 0) c = k; }); return c; };

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
  if (decorOn('kuting')) { // three kittens tumbling along the top of the fence (SI MINGMING's reward)
    ['tigre', 'puti', 'muning'].forEach((k, i) => {
      const x = Math.round(((t * 14 + i * 26) % (VIEW_W + 60)) - 30), hop = Math.round(Math.abs(Math.sin(t * 6 + i * 2)) * 3);
      const s = getSprite(k, 2, Math.floor(t * 8 + i) % 4);
      g.drawImage(s, x, GROUND - 8 - s.height - hop);
    });
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
  drawText(g, 'KUPIT', VIEW_W / 2, 44, C.gold, { scale: 8, align: 'center', shadow: C.gold2 });
  drawHideout(g, save, t, HUB_Y);
  const items = titleItems();
  TITLE_RECTS.forEach((r, i) => drawButton(g, r, items[i], i === sel));
  if (canAffordNeed() && Math.floor(t * 2) % 2) { const r = TITLE_RECTS[T_SHOP]; g.fillStyle = C.ink; g.fillRect(r.x + r.w - 9, r.y - 3, 8, 8); g.fillStyle = C.pink; g.fillRect(r.x + r.w - 8, r.y - 2, 6, 6); drawText(g, '!', r.x + r.w - 6, r.y - 1, C.ink); }
  drawCoin(g, 8, 8); drawText(g, String(save.bank), 16, 9, C.white);
  drawStar(g, 7, 16, true); drawText(g, `${totalStars(save)}/${MAX_STARS}`, 16, 17, C.white);
  if (levels.length) { const c = chapterOf(unlockedMax()); drawText(g, `CHAPTER ${c + 1}`, VIEW_W - 34, 9, C.gray, { align: 'right' }); }
  if (updateReady) {
    const r = updateRect();
    g.fillStyle = C.ink; g.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    g.fillStyle = Math.floor(t * 2) % 2 ? C.green : '#2fb56b'; g.fillRect(r.x, r.y, r.w, r.h);
    drawText(g, 'UPDATE READY! TAP TO RESTART', VIEW_W / 2, r.y + 4, C.ink, { align: 'center' });
  }
  const newPhoto = PHOTOS.some((p) => photoUnlocked(save, p.id) && !save.seen[`photo:${p.id}`]);
  if (newPhoto && Math.floor(t * 2) % 2) { const r = TITLE_RECTS[T_ALBUM]; g.fillStyle = C.ink; g.fillRect(r.x + r.w - 9, r.y - 3, 8, 8); g.fillStyle = C.green; g.fillRect(r.x + r.w - 8, r.y - 2, 6, 6); drawText(g, '!', r.x + r.w - 6, r.y - 1, C.ink); }
  drawText(g, `V${VERSION}`, VIEW_W - 4, BASE_H - 9, C.dgray, { align: 'right' }); // which build this is
  drawMsg(374);
}
const updateRect = () => ({ x: 30, y: 112, w: VIEW_W - 60, h: 13 });

function updateTitle() {
  if (updateReady && (hit(input.tapPos, updateRect()) || input.pressed('u'))) { applyUpdate(); return; }
  const n = TITLE_RECTS.length;
  if (input.pressed('ArrowUp') || input.pressed('w') || input.pressed('ArrowLeft') || input.pressed('a')) sel = (sel + n - 1) % n;
  if (input.pressed('ArrowDown') || input.pressed('s') || input.pressed('ArrowRight') || input.pressed('d')) sel = (sel + 1) % n;
  let pick = TITLE_RECTS.findIndex((r) => hit(input.tapPos, r, 1));
  if (pick >= 0) sel = pick;
  else if (input.pressed('Enter') || input.pressed(' ') || input.pressed('e')) pick = sel;
  if (pick < 0) return;
  sfx.unlock();
  if (pick === 0) begin(unlockedMax());
  else if (pick === 1) { prevMode = 'title'; setMode('levels'); sel = unlockedMax(); }
  else if (pick === T_SHOP) openShop(null);
  else if (pick === T_ALBUM) { album.open = -1; for (const p of PHOTOS) if (photoUnlocked(save, p.id)) save.seen[`photo:${p.id}`] = true; persist(); setMode('album'); }
  else if (pick === 4) { prevMode = 'title'; setMode('options'); }
}

// ---- level select: the barangay map -----------------------------------------------------
let mapLay = null;
const lay = () => (mapLay ||= mapLayout(levels));
const isOpen = (i) => i <= save.unlocked || dev.on;
const backRect = () => ({ x: 70, y: 340, w: 100, h: 17 });
const pageUp = () => ({ x: 16, y: 340, w: 44, h: 17 });
const pageDown = () => ({ x: 180, y: 340, w: 44, h: 17 });

function updateLevels() {
  const n = levels.length;
  if (input.pressed('ArrowUp') || input.pressed('w')) sel = (sel + n) % (n + 1);
  if (input.pressed('ArrowDown') || input.pressed('s')) sel = (sel + 1) % (n + 1);
  if (input.pressed('Escape')) { setMode(prevMode); return; }
  const want = mapScrollFor(lay(), Math.min(sel, n - 1));
  scroll = age < 0.05 ? want : scroll + (want - scroll) * 0.25;
  let pick = -1;
  const tp = input.tapPos;
  if (tp) {
    if (hit(tp, backRect())) pick = n;
    else if (hit(tp, pageUp())) { sel = Math.max(0, Math.min(sel, n - 1) - 3); sfx.click(); return; }
    else if (hit(tp, pageDown())) { sel = Math.min(n - 1, sel + 3); sfx.click(); return; }
    else for (const node of lay().nodes) { const r = mapNodeRect(node, scroll); if (mapVisible(r) && hit(tp, r, 0)) pick = node.i; }
    if (pick >= 0) sel = pick;
  }
  if (pick < 0 && (input.pressed('Enter') || input.pressed(' ') || input.pressed('e'))) pick = sel;
  if (pick < 0) return;
  sfx.unlock();
  if (pick === n) setMode(prevMode);
  else if (isOpen(pick)) begin(pick);
  else sfx.creak();
}

function drawLevels() {
  const n = levels.length;
  drawMap(g, levels, lay(), { save, sel, scroll, isOpen, t: performance.now() / 1000 });
  if (dev.on) drawText(g, 'DEV: ALL UNLOCKED', VIEW_W - 6, 4, C.red, { align: 'right' });
  drawButton(g, pageUp(), '^', false);
  drawButton(g, backRect(), 'BACK', sel === n);
  drawButton(g, pageDown(), 'V', false);
}

// ---- how to play (four pages) -----------------------------------------------------
const HELP = [[
  ['GOAL', 'TAKE THE COINS, THEN REACH THE EXIT.'],
  ['MOVE', 'DRAG ANYWHERE OR WASD. DRAG FAR / SHIFT RUNS, BUT RUNNING IS LOUD.'],
  ['TAKE', 'STAND AT A STASH AND HOLD THE BIG BUTTON: E OR SPACE. LET GO AND IT WAITS FOR YOU.'],
  ['SEEN?', 'YELLOW CONE: THEY SEE YOU. ? MEANS SUSPICIOUS, ! MEANS CHASE. ARROWS ON THE EDGE SHOW WHO IS COMING.'],
  ['HIDE', 'PRESS ACT AT A BOX, CURTAIN OR BASKET. AN EYE ABOVE YOU MEANS THEY SAW YOU GO IN.'],
  ['THROW', 'PRESS Q, POINT WITH THE MOUSE AND CLICK. ON A PHONE: HOLD THE BLUE BUTTON, SLIDE TO THE SPOT, LET GO. NOISE LURES ADULTS AWAY. R SWITCHES ITEMS.'],
  ['SKILL', 'EACH KID HAS A SKILL: TAP THE GREEN BUTTON OR PRESS F.'],
], [
  ['MUNTIK NA', 'IF SOMEONE REACHES YOU, THAT IS A CLOSE CALL: YOU DROP SOME COINS (THEY GO BACK) AND START AGAIN AT THE LAST SAFE SPOT. 3 CLOSE CALLS AND YOU ARE SENT BACK TO YOUR ROOM.'],
  ['NOISE', 'SOUND TRAVELS THROUGH ROOMS. WALLS STOP IT, CLOSED DOORS MUFFLE IT.'],
  ['STASHES', 'PURSES ARE QUICK BUT CLICK. BAYONGS RUSTLE. WALLETS ZIP. RISKY SPOTS PAY MORE.'],
  ['DOORS', 'DOORS BLOCK SIGHT. KEYS OPEN LOCKS. LEVERS OPEN GATES.'],
  ['KAIN NA', 'THE ORANGE BAR IS DINNER TIME. WHEN IT RUNS OUT MAMA CALLS YOU IN AND THE LEVEL IS OVER, CHANCES OR NOT. THE GREEN NOTCH IS PAR TIME.'],
  ['SECRET', 'EVERY LEVEL HIDES ONE ALKANSYA FOR BONUS COINS.'],
  ['STARS', 'EVERY LEVEL HAS THREE MISSIONS, ONE STAR EACH (PAUSE TO SEE THEM). A STAR STAYS EARNED, SO COME BACK FOR THE ONES YOU MISSED. NO ALARM MEANS NOBODY\'S METER FILLS PAST A THIRD: A QUICK ? IS FINE, A ! OR A BARK IS NOT.'],
], [
  ['COVER', 'WARDROBES, MARKET STALLS AND HANGING LAUNDRY BLOCK EVERY EYE. YOU CAN WALK RIGHT THROUGH LAUNDRY, AND NOBODY SEES YOU IN IT.'],
  ['BUSY', 'ADULTS HAVE CHORES. COOKING, WASHING UP, DOZING OR ON THE PHONE THEY SEE NOTHING: LOOK FOR THE GREEN MARK. SWEEPING OR WATCHING TV THEY SEE LESS. ANY NOISE MAKES THEM LOOK UP.'],
  ['CROWD', 'AT A PARTY, WALK BESIDE A GUEST AND YOU BLEND IN: NOBODY NOTICES YOU UNLESS THEY ARE VERY CLOSE. RUNNING BREAKS IT.'],
  ['VIDEOKE', 'WHILE SOMEONE IS SINGING, NOTHING YOU DO NEAR THE MACHINE CAN BE HEARD. THUNDER DOES THE SAME FOR THE WHOLE YARD.'],
  ['KUTING', 'FINISH THE STORY AND TIGRE FOLLOWS YOU ON EVERY KUPIT. HE IS ONLY HERE TO WATCH.'],
  ['MINI-GAMES', 'SOME LEVELS PLAY DIFFERENTLY: TUMBANG PRESO, HABOL! AND A NIGHT AS MINGMING. THEIR STARS PAY PRIZES, PHOTOS FOR THE ALBUM OR NEW LOOKS. A BONUS GAME CAN BE SKIPPED AFTER TWO TRIES.'],
], [ // the design overhaul's rules
  ['SAPAT NA', 'COINS COME OUT ONE AT A TIME (THE DOTS OVER A STASH). LET GO AT THE QUOTA: ANYTHING MORE IS SOBRA, AND EVERY EXTRA COIN CLINKS LOUDER.'],
  ['KASABWAT', 'IN SOME LEVELS TWO KIDS GO TOGETHER. Z (OR THE PURPLE BUTTON) SWITCHES WHO YOU CONTROL. THE OTHER WAITS WHERE YOU LEFT THEM: HIDE THEM FIRST. BOTH MUST REACH THE EXIT.'],
  ['CREW', 'BING, KUYA RAMIL AND NENE JOIN AS THE STORY GOES ON. BEFORE EACH LEVEL, PICK WHO GOES. BING CRAWLS UNDER TABLES AND BEDS. KUYA RAMIL TALKS AWAY ONE CLOSE CALL A LEVEL.'],
  ['GEAR', "ALING NENA'S SELLS FIVE TRICKS, EACH BOUGHT ONCE: MEDYAS (QUIET ON CREAKY BOARDS), PANYO (MUFFLES A CLASP), HOLEN (ROLLING MARBLES), BAON (START WITH A SLIPPER AND BREAD), BULSA (CARRY MORE)."],
], [
  ['KITTENS', "YOUR COINS BUY WHAT MINGMING AND HER KITTENS NEED AT ALING NENA'S. THE HIDEOUT CHANGES WITH EVERY ONE."],
  ['MILK', 'A FULL BOWL OF MILK SPILLS IF YOU RUN. IN A STORM, THUNDER COVERS YOUR NOISE.'],
  ['CREDITS', 'KUPIT IS A PIXEL STEALTH GAME MADE IN PLAIN JAVASCRIPT: NO ENGINE, NO DOWNLOADS. THE ART, THE MUSIC AND THE FONT ARE ALL DRAWN AND PLAYED IN CODE.'],
  ['WORDS', 'KUPIT: TO POCKET SOMETHING SNEAKILY. HINGI: TO ASK FOR IT. HULI KA: CAUGHT YOU. MUNTIK NA: THAT WAS CLOSE. SAPAT NA: THAT IS ENOUGH. KAIN NA: DINNER IS READY.'],
  ['MORE', 'TSINELAS: SLIPPERS. ALKANSYA: PIGGY BANK. BAYONG: WOVEN BAG. PANDESAL: BREAD ROLL. SARI-SARI: CORNER STORE. TANOD: VILLAGE WATCHMAN.'],
  ['SAVES', 'YOUR PROGRESS STAYS ON THIS DEVICE. OPTIONS > COPY SAVE CODE MOVES IT TO ANOTHER ONE.'],
  ['OFFLINE', 'INSTALL IT FROM THE BROWSER MENU AND IT PLAYS WITHOUT INTERNET.'],
  ['THANKS', 'SALAMAT SA PAGLALARO!'],
]];
let helpPage = 0;
let helpFrom = 'options'; // where the help's BACK goes: 'options' or 'paused'

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
  else if (input.pressed('Escape') || hit(input.tapPos, helpBack())) { sfx.unlock(); const to = helpFrom; setMode(to); if (to === 'options') sel = OPT_HELP_ITEM; }
}

// ---- options -----------------------------------------------------------------------
const OPT_Y = 44, OPT_GAP = 18;
const OPT_HELP_ITEM = 12; // HOW TO PLAY
let eraseArmed = 0; // NEW GAME: seconds left to tap it a second time
const pct = (v) => `${Math.round(v * 100)}%`;
function optionItems() {
  return [
    `MUSIC: ${pct(settings.music)}`, `SOUND FX: ${pct(settings.sfx)}`, `MUTE ALL: ${isMuted() ? 'ON' : 'OFF'}`,
    `SCREEN SHAKE: ${shakeLabel(settings.shake)}`, `SCREEN FLASH: ${settings.flash ? 'ON' : 'OFF'}`,
    canVibrate() ? `VIBRATE: ${hapticsOn() ? 'ON' : 'OFF'}` : 'VIBRATE: NOT ON THIS DEVICE',
    `VISUAL PULSE: ${settings.pulse ? 'ON' : 'OFF'}`, `BUTTONS: ${settings.left ? 'LEFT' : 'RIGHT'}-HANDED`,
    `GHOST OF BEST RUN: ${settings.ghost ? 'ON' : 'OFF'}`, 'COPY SAVE CODE', 'LOAD SAVE CODE',
    eraseArmed > 0 ? 'SURE? TAP AGAIN TO ERASE' : 'NEW GAME (ERASE SAVE)', 'HOW TO PLAY', 'BACK',
    ...(playtest ? [`COPY PLAYTEST LOG (${ptRead().length})`] : []),
  ];
}
const OPT_HELP = [
  'MUSIC VOLUME', 'BEEPS AND CREAKS', 'SILENCE EVERYTHING (M KEY)', 'HOW MUCH THE SCREEN SHAKES', 'COLOUR FLASH ON A CLOSE CALL',
  'PHONE BUZZES ON ALERTS', 'COLOURED SCREEN EDGE INSTEAD OF A BUZZ', 'MIRROR THE BUTTONS FOR YOUR LEFT THUMB',
  'SEE-THROUGH KID REPLAYS YOUR BEST TIME', 'MOVE YOUR SAVE TO ANOTHER PHONE', 'PASTE A CODE FROM ANOTHER PHONE',
  'START OVER: STORY, COINS, STARS AND CREW ARE ERASED', 'THE RULES, AND WHAT THE WORDS MEAN', '', 'ALL DEATHS, PAUSES AND IDLE MOMENTS (JSON)',
];

function drawOptions() {
  if (prevMode === 'paused' && play) { play.draw(g); dim(0.85); g.translate(0, OFF()); } else { g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H); }
  drawText(g, 'OPTIONS', VIEW_W / 2, 14, C.gold, { scale: 3, align: 'center', shadow: C.gold2 });
  const items = optionItems();
  items.forEach((l, i) => drawButton(g, { ...buttonRect(i, OPT_Y, OPT_GAP, 200) }, l, i === sel));
  drawText(g, eraseArmed > 0 && sel === 11 ? 'YOUR SETTINGS STAY. THIS CANNOT BE UNDONE' : OPT_HELP[sel] || '', VIEW_W / 2, 314, eraseArmed > 0 && sel === 11 ? C.orange : C.gray, { align: 'center' });
  drawMsg(326);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back to a prompt */ }
  try { prompt('COPY THIS:', text); return true; } catch { return false; }
}

function updateOptions() {
  if (eraseArmed > 0 && (eraseArmed -= 1 / 60) <= 0) eraseArmed = 0; // the confirm runs out after 3 s
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
    case 11: { // NEW GAME: the first tap asks, the second (within 3 s) erases
      if (prevMode === 'paused') { say('QUIT THE LEVEL FIRST, THEN START OVER', C.orange); sfx.creak(); return; }
      if (eraseArmed <= 0) { eraseArmed = 3; sfx.creak(); return; }
      eraseArmed = 0;
      save = newGameSave(save); clearGhosts(); persist(); applySettings(save); setMuted(save.muted);
      unlocked = grantUnlocks(save, { pasko: isPasko() }); persist();
      play = null; shopReturn = null;
      setMode('title'); say('NEW GAME! START THE STORY', C.green);
      return;
    }
    case 12: helpFrom = 'options'; helpPage = 0; setMode('help'); return;
    case 13: setMode(prevMode); return;
    case 14: copyText(JSON.stringify(ptRead(), null, 1)).then((ok) => say(ok ? 'PLAYTEST LOG COPIED' : 'COULD NOT COPY', ok ? C.green : C.orange)); break;
  }
  persist(); applySettings(save);
  if (pick === 5) vibrate(40);
  if (pick !== 2 && pick < 9) sfx.click();
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
  g.translate(0, OFF());
  drawText(g, 'DEV TOOLS', VIEW_W / 2, 18, C.red, { scale: 3, align: 'center', shadow: C.ink });
  drawText(g, `${cur.name}  (${idx + 1}/${levels.length})`, VIEW_W / 2, 46, C.white, { align: 'center' });
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
  else if (pick === 5) goLevel(idx - 1);
  else if (pick === 6) goLevel(idx + 1);
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
  if (input.pressed('n')) goLevel(idx + 1);
  if (input.pressed('b')) goLevel(idx - 1);
}

// ---- pause ------------------------------------------------------------------------
const PAUSE_Y = 140;
const pauseItems = () => ['RESUME', 'RESTART', 'HOW TO PLAY', 'OPTIONS', 'MAP', 'HIDEOUT', ...(dev.on ? ['DEV TOOLS'] : [])];
function drawPaused() {
  play.draw(g);
  dim(0.75);
  g.translate(0, OFF());
  drawText(g, 'PAUSED', VIEW_W / 2, 40, C.gold, { scale: 5, align: 'center', shadow: C.gold2 });
  if (!cur.hingi) play.drawMissions(g, 88, save.missions[cur.id] | 0);
  drawMenu(g, pauseItems(), sel, PAUSE_Y);
}

function updatePaused() {
  if (input.pressed('Escape') || input.pressed('p')) { input.reset(); setMode('play'); return; }
  const pick = menuPick(pauseItems().length, PAUSE_Y);
  if (pick === 0) { input.reset(); setMode('play'); }
  else if (pick === 1) restart();
  else if (pick === 2) { prevMode = 'paused'; helpFrom = 'paused'; helpPage = 0; setMode('help'); }
  else if (pick === 3) { prevMode = 'paused'; setMode('options'); }
  else if (pick === 4) { prevMode = 'paused'; setMode('levels'); sel = idx; }
  else if (pick === 5) setMode('title');
  else if (pick === 6) setMode('dev');
}

// ---- caught / clear -----------------------------------------------------------------
const END_Y = 236;
const skippable = () => cur.bonus && (fails[cur.id] | 0) >= 2 && idx < levels.length - 1;
const caughtItems = () => (skippable() ? ['TRY AGAIN', 'SKIP FOR NOW', 'MAP'] : ['TRY AGAIN', 'MAP', 'HIDEOUT']);
function drawCaught() {
  play.draw(g);
  dim();
  g.translate(0, OFF());
  panel(30, 186);
  if (play.drawFail) { // a mini-game says it its own way
    play.drawFail(g);
    if (skippable()) drawText(g, 'A BONUS GAME: YOU CAN COME BACK LATER', VIEW_W / 2, 176, C.gray, { align: 'center' });
    if (age > 0.5) drawMenu(g, caughtItems(), sel, END_Y);
    return;
  }
  const a = play.catcher;
  // Out of chances (or too slow): Jun is sent back to his room. Amber, not red, and never "HULI KA!": the family
  // only finds out what he has been doing in the story's ending.
  if (a) { g.fillStyle = C.orange; g.fillRect(VIEW_W / 2 - 30, 36, 60, 60); g.fillStyle = C.ink; g.fillRect(VIEW_W / 2 - 28, 38, 56, 56); drawPortrait(g, a.type, VIEW_W / 2 - 28, 38, 2); }
  if (play.reason === 'time') {
    drawText(g, 'KAIN NA!', VIEW_W / 2, 100, C.orange, { scale: 5, align: 'center', shadow: C.ink });
    drawText(g, `${a ? a.cfg.name : 'MAMA'}: "DINNER TIME! COME HERE!"`, VIEW_W / 2, 155, C.white, { align: 'center' });
  } else {
    drawText(g, cur.failTitle || 'BALIK SA KWARTO!', VIEW_W / 2, 104, C.orange, { scale: 3, align: 'center', shadow: C.ink });
    drawText(g, `${a.cfg.name}: "${a.cfg.scold || a.cfg.shout}"`, VIEW_W / 2, 155, C.white, { align: 'center' });
    if (play.reason === 'escape') drawText(g, 'TOO SLOW! RUN FOR THE EXIT NEXT TIME', VIEW_W / 2, 165, C.orange, { align: 'center' });
    else if (play.world.lives > 1) drawText(g, `${play.world.catches} CLOSE CALLS. NO CHANCES LEFT!`, VIEW_W / 2, 165, C.orange, { align: 'center' });
  }
  drawText(g, `COINS ${play.world.coins}/${cur.quota}   TIME ${Math.floor(play.world.time)}S`, VIEW_W / 2, 177, C.gray, { align: 'center' });
  if (age > 0.5) drawMenu(g, caughtItems(), sel, END_Y);
}

function updateCaught() {
  const pick = menuPick(3, END_Y, 22, age > 0.5);
  if (pick === 0) restart();
  else if (pick === 1 && skippable()) { save.unlocked = Math.max(save.unlocked, idx + 1); persist(); sfx.click(); begin(idx + 1); } // a bonus game never blocks the story
  else if (pick === 2 && skippable()) { prevMode = 'title'; setMode('levels'); sel = idx; }
  else if (pick === 1) { prevMode = 'title'; setMode('levels'); sel = idx; }
  else if (pick === 2) setMode('title');
}

const clearItems = () => [idx === levels.length - 1 ? 'HIDEOUT' : 'NEXT LEVEL', 'PLAY AGAIN', 'MAP', canBuyAnything() ? 'UPGRADES (NEW!)' : 'UPGRADES'];

// Something at Aling Nena's you can buy right now: a cat need the story has opened, or a piece of gear.
const canBuyAnything = () => canAffordNeed() || UPGRADE_ORDER.some((id) => { const c = upgradeCost(save, id); return c !== null && save.bank >= c; });

// Aling Nena's after a level: from the clear screen's UPGRADES button (BACK returns to the results), or on the way to
// the next level whenever there is something to buy (the bottom button then says NEXT LEVEL and goes on).
let shopReturn = null; // null: the title | 'clear' | { next: level index }
function openShop(ret) {
  shopReturn = ret; shopScreen.sel = 0; setMode('store');
  if (ret?.next !== undefined) shopScreen.say('SPEND YOUR COINS, THEN GO ON', C.green);
}
function shopBack() {
  const r = shopReturn;
  shopReturn = null;
  if (r === 'clear') setMode('clear');
  else if (r?.next !== undefined) begin(r.next);
  else setMode('title');
}

function drawClear() {
  play.draw(g);
  dim(0.75);
  g.translate(0, OFF());
  panel(50, 230);
  const r = play.result;
  const head = cur.clearText || (cur.boss ? 'BOSS BEATEN!' : 'NICE KUPIT!');
  drawText(g, head, VIEW_W / 2, 70, C.gold, { scale: head.length > 13 ? 3 : head.length > 9 ? 4 : 5, align: 'center', shadow: C.gold2 });
  const ids = missionIds(cur);
  for (let i = 0; i < 3 && !cur.epilogue; i++) { // the three missions: stars pop in one by one
    const at = 0.6 + i * 0.35, now = r.missions[i], had = !!((starsBefore >> i) & 1), on = (now || had) && age > at;
    const y = 102 + i * 11, x = VIEW_W / 2 - 80;
    if (on && !starShown[i]) { starShown[i] = true; if (now && !had) sfx.coin(); }
    if (on && now && !had && age < at + 0.12) { g.fillStyle = C.white; g.fillRect(x - 2, y - 2, 9, 9); }
    drawStar(g, x, y, on);
    drawText(g, missionLabel(cur, ids[i]), x + 10, y + 1, on ? (now && !had ? C.gold : C.white) : C.dgray);
    if (age > at && now && !had) drawText(g, 'NEW!', x + 160, y + 1, C.green, { align: 'right' });
  }
  const score = play.world.scoreText || `${cur.giveBack ? 'PUT BACK' : cur.hingi ? 'GIVEN' : 'COINS'} ${r.coins}`; // (a mini-game counts its own thing)
  drawText(g, `${score}   TIME ${Math.floor(r.time)}S`, VIEW_W / 2, 140, C.white, { align: 'center' });
  if (newBest) drawText(g, 'NEW BEST TIME!', VIEW_W / 2, 152, C.green, { align: 'center' });
  if (cur.epilogue) drawText(g, 'YOU ONLY HAD TO ASK.', VIEW_W / 2, 164, C.pink, { align: 'center' });
  drawText(g, `+${earned} COINS`, VIEW_W / 2, 178, C.gold, { align: 'center' });
  let y = 192;
  rewardsShown.slice(0, 2).forEach((w, k) => { // what the new stars paid: they pop in after the stars
    if (age < 1.7 + k * 0.3) return;
    const label = w.kind === 'coins' ? `PRIZE: ${w.name}` : w.kind === 'photo' ? 'NEW PHOTO FOR THE ALBUM!' : `NEW ${w.kind === 'outfit' ? 'OUTFIT' : 'DECOR'}: ${w.name}!`;
    const x = VIEW_W / 2 - (label.length * 4) / 2 + 5;
    if (w.kind === 'coins') drawCoin(g, x - 10, y - 1); else drawRewardIcon(g, { [w.kind]: w.id }, x - 12, y - 1);
    drawText(g, label, x, y, w.kind === 'coins' ? C.gold : C.green);
    y += 11;
  });
  if (age > 0.5) drawMenu(g, clearItems(), sel, END_Y, 21);
  drawMsg(326);
}

function updateClear() {
  const last = idx === levels.length - 1;
  const pick = menuPick(4, END_Y, 21, age > 0.5);
  if (pick < 0) return;
  if (pick === 3) { openShop('clear'); return; }
  if (pick === 0) {
    if (last) { if (!save.story.epilogue) startStory(EPILOGUE, () => { save.story.epilogue = true; persist(); setMode('title'); }); else setMode('title'); }
    else if (canBuyAnything()) openShop({ next: idx + 1 }); // upgrades between levels
    else begin(idx + 1);
  } else if (pick === 1) restart();
  else if (pick === 2) { prevMode = 'title'; setMode('levels'); sel = Math.min(idx + 1, levels.length - 1); }
}

function afterPlay() {
  play.banner = null;
  unlocked = [];
  if (play.status === 'caught') { fails[cur.id] = (fails[cur.id] | 0) + 1; setMode('caught'); return; }
  if (play.status !== 'clear') return;
  setMode('clear');
  starShown = [false, false, false];
  rewardsShown = [];
  const r = play.result;
  const id = cur.id, t = r.time, first = save.stars[id] === undefined, prevStars = save.stars[id] || 0;
  newBest = !save.best[id] || t < save.best[id];
  if (newBest) { save.best[id] = t; if (play.rec) storeGhost(id, play.rec); }
  // Stars are missions, and a mission done once stays done: this run's are added to the ones already earned.
  starsBefore = cur.epilogue ? 0 : save.missions[id] | 0;
  const mask = cur.epilogue ? 0 : starsBefore | maskOf(r.missions);
  save.missions[id] = mask;
  const stars = starsOf(mask), coins = cur.giveBack ? 0 : r.coins; // the epilogue has no stars; coins put back are not income
  save.stars[id] = stars;
  save.unlocked = Math.max(save.unlocked, Math.min(idx + 1, levels.length - 1));
  while (save.unlocked < levels.length - 1 && save.stars[levels[save.unlocked].id] !== undefined) save.unlocked++; // (past levels already cleared: the v5 reorder)
  bossBonus = cur.boss && first ? cur.boss.bonus : 0; // first clear only
  const alk = r.bonus && !save.alkansya[id] ? r.bonus : 0;
  if (r.bonus) save.alkansya[id] = true;
  if (r.photo && save.story.photo !== 'in') save.story.photo = r.photo; // NINANG's party: the family photo (with Jun, or without)
  earned = campaignPayout({ coins, stars, prevStars, first, bossBonus, alkansya: alk });
  rewardsShown = grantRewards(save, cur, mask & ~starsBefore); // a mini-game's stars pay prizes, photos and looks
  for (const w of rewardsShown) if (w.kind === 'coins') { earned += w.n; save.bank -= w.n; } // (paid with the rest, just below)
  if (first && !cur.hingi && !special(cur)) { // the first clear's take, for IBALIK (game/ibalik.js)
    save.ledger[id] = { by: r.takenBy || {}, sobra: r.sobra | 0, emptied: r.emptied | 0, catches: r.catches | 0, spills: r.spills | 0, coins: r.coins | 0 };
    if (cur.giveBack && play.level.returnPlan) save.bank = Math.max(0, save.bank - play.level.returnPlan.fromBank); // IBALIK: the coins put back come out of the bank
  }
  save.bank += earned;
  unlocked = grantUnlocks(save, { pasko: isPasko() });
  persist();
  // The storm: the moment Jun is through the door with the kittens, he is caught. The ending plays before the results.
  if (cur.ending && !save.story.ending) {
    startStory(ENDING, () => { save.story.ending = true; persist(); setMode('clear'); starShown = [false, false, false]; sfx.clear(); });
  } else if (AFTER[cur.id] && !save.story.after[cur.id]) { // a scene that closes this level's story beat
    startStory(AFTER[cur.id], () => { save.story.after[cur.id] = true; for (const p of AFTER[cur.id]) if (p.flag) save.story[p.flag] = true; persist(); setMode('clear'); starShown = [false, false, false]; });
  }
}

const shopCtx = { get save() { return save; }, persist, back: shopBack, get backLabel() { return shopReturn?.next !== undefined ? 'NEXT LEVEL >' : 'BACK'; }, go: (m) => { cosmeticsScreen.sel = 0; if (grantUnlocks(save, { pasko: isPasko() }).length) persist(); setMode(m); } };
const albumCtx = { get save() { return save; }, persist, back: () => setMode('title'), go: () => {} };
const upgradesCtx = { get save() { return save; }, persist, back: () => setMode('store'), go: () => {} };
const cosmeticsCtx = { get save() { return save; }, persist, back: () => setMode('store'), go: () => {} };

// Pick the music for the current screen. The chase track needs a real chase (not a flicker) to start,
// and sticks around a moment after it ends.
function syncMusic(dt) {
  if (input.tapPos || input.hits.size) {
    if (!audioReady) { audioReady = true; music.warm(); requestPersist(); }
  }
  if (!audioReady) return;
  let want;
  if (mode === 'play' && play.music) want = play.music(); // a mini-game picks its own
  else if (mode === 'play') {
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
  if (m !== 'play' && input.tapPos) input.tapPos = { x: input.tapPos.x, y: input.tapPos.y - OFF() }; // (menus sit OFF lower)
  const screens = { title: [updateTitle, drawTitle], levels: [updateLevels, drawLevels], help: [updateHelp, drawHelp],
    options: [updateOptions, drawOptions], story: [updateStory, drawStory],
    store: [() => shopScreen.update(input, shopCtx, dt), () => shopScreen.draw(g, shopCtx)],
    upgrades: [() => upgradesScreen.update(input, upgradesCtx, dt), () => upgradesScreen.draw(g, upgradesCtx)],
    cosmetics: [() => cosmeticsScreen.update(input, cosmeticsCtx, dt), () => cosmeticsScreen.draw(g, cosmeticsCtx)],
    album: [() => updateAlbum(input, albumCtx), () => drawAlbum(g, albumCtx)],
    dev: [updateDevMenu, drawDevMenu],
    paused: [updatePaused, drawPaused], caught: [updateCaught, drawCaught], clear: [updateClear, drawClear],
    card: [updateCard, drawCard] };
  if (screens[m]) { // (skip the draw if the screen just changed)
    screens[m][0]();
    if (mode === m) {
      g.save();
      if (!OVERLAY.has(m) && !(m === 'options' && prevMode === 'paused' && play)) { // a menu: clear the screen, centre it
        g.fillStyle = m === 'title' ? '#0c1230' : C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H);
        g.translate(0, OFF());
      }
      screens[m][1]();
      g.restore();
    }
  }
  else if (m === 'loading') {
    g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H);
    if (!loadError) drawText(g, 'LOADING...', VIEW_W / 2, 170, C.white, { align: 'center' });
    else { // a level file or the sprite sheet failed to load (bad deploy, flaky network): say so, offer a retry
      drawText(g, 'COULD NOT LOAD THE GAME', VIEW_W / 2, 150, C.red, { align: 'center' });
      wrap(loadError.toUpperCase().replace(/[^A-Z0-9 .:/'-]/g, ' '), 56).slice(0, 3).forEach((l, i) => drawText(g, l, VIEW_W / 2, 166 + i * 9, C.gray, { align: 'center' }));
      if (Math.floor(age * 2) % 2) drawText(g, 'TAP TO RETRY', VIEW_W / 2, 210, C.yellow, { align: 'center' });
      if (input.tapPos || input.pressed('Enter') || input.pressed(' ')) location.reload();
    }
  }

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
  if (grantSiblings(save, levelIds()).length) persist(); // saves from before the story: the crew they already earned
  setMode('title');
  const q = new URLSearchParams(location.search);
  const jump = Number(q.get('level')); // ?level=2 jumps to level 2
  if (jump >= 1 && jump <= levels.length) start(jump - 1);
}).catch((e) => {
  console.error(e);
  loadError = String((e && e.message) || e || 'UNKNOWN ERROR');
  mode = 'loading';
});
let loadError = null;
requestAnimationFrame(frame);

// Debug hook for automated checks: window.__kupit
window.__kupit = { get play() { return play; }, get mode() { return mode; }, start, input,
  card: (i) => showCard(i), /* tools/qa/shot.mjs card:N */
  story: (panels, i = 0) => { startStory(panels, () => setMode('title')); story.i = i; age = 99; }, go: (m) => setMode(m), /* for tools/qa/shot.mjs */ get save() { return save; }, get cur() { return cur; }, get loadError() { return loadError; } };

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
