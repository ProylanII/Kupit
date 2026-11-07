import { Input, VIEW_W, VIEW_H } from './core/input.js';
import { loadSave, writeSave } from './core/save.js';
import { sfx } from './core/audio.js';
import { Play } from './scenes/play.js';
import { drawText } from './ui/font.js';
import { drawActor, drawStar, drawTarget } from './render/sprites.js';
import { C } from './render/palette.js';

const canvas = document.getElementById('game');
const g = canvas.getContext('2d');
g.imageSmoothingEnabled = false;
const input = new Input(canvas);
const save = loadSave();

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
let mode = 'loading'; // loading | title | play | caught | clear | win
let play = null;
let age = 0;

function start(i) {
  idx = i;
  play = new Play(levels[idx], input);
  mode = 'play';
  age = 0;
}

function dim(a = 0.6) {
  g.globalAlpha = a; g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H); g.globalAlpha = 1;
}

function drawTitle() {
  g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H);
  // little scene: kid sneaking toward a purse
  for (let x = 0; x < VIEW_W; x += 16) { g.fillStyle = (x / 16) % 2 ? C.wood : C.wood2; g.fillRect(x, 200, 16, 16); }
  const t = performance.now() / 1000;
  const kx = 40 + ((t * 18) % 120);
  drawActor(g, 'kid', kx, 208, 2, Math.floor(t * 6) % 4);
  drawTarget(g, 'purse', 190, 208, false);
  drawActor(g, 'mama', 215, 214, 1, 0);
  drawText(g, 'KUPIT', VIEW_W / 2, 70, C.gold, { scale: 9, align: 'center', shadow: C.gold2 });
  drawText(g, 'SNEAK. KUPIT. ESCAPE.', VIEW_W / 2, 135, C.white, { align: 'center' });
  if (Math.floor(t * 2) % 2) drawText(g, 'TAP OR PRESS ENTER', VIEW_W / 2, 262, C.yellow, { scale: 1, align: 'center' });
  const lvl = Math.min(save.unlocked, levels.length - 1);
  drawText(g, save.unlocked > 0 ? `CONTINUE: LEVEL ${lvl + 1}` : 'LEVEL 1', VIEW_W / 2, 276, C.gray, { align: 'center' });
  drawText(g, 'A PIXEL STEALTH GAME', VIEW_W / 2, 336, C.dgray, { align: 'center' });
}

function drawCaught() {
  play.draw(g);
  dim();
  const a = play.catcher;
  drawText(g, 'CAUGHT!', VIEW_W / 2, 120, C.red, { scale: 6, align: 'center', shadow: C.ink });
  drawText(g, `${a.cfg.name}: "ANO 'YAN?!"`, VIEW_W / 2, 175, C.white, { align: 'center' });
  if (age > 0.6) drawText(g, 'TAP TO TRY AGAIN', VIEW_W / 2, 230, C.yellow, { align: 'center' });
}

function drawClear() {
  play.draw(g);
  dim(0.7);
  const r = play.result;
  const last = idx === levels.length - 1;
  drawText(g, last ? 'ALL DONE!' : 'NICE KUPIT!', VIEW_W / 2, 100, C.gold, { scale: 5, align: 'center', shadow: C.gold2 });
  for (let i = 0; i < 3; i++) drawStar(g, VIEW_W / 2 - 22 + i * 15, 150, i < r.stars);
  drawText(g, `COINS ${r.coins}   TIME ${Math.floor(r.time)}S`, VIEW_W / 2, 175, C.white, { align: 'center' });
  drawText(g, `${r.fast ? 'FAST + ' : ''}${r.stealth ? 'SILENT' : 'SPOTTED A BIT'}`, VIEW_W / 2, 188, C.gray, { align: 'center' });
  if (age > 0.6) drawText(g, last ? 'TAP FOR TITLE' : 'TAP FOR NEXT LEVEL', VIEW_W / 2, 230, C.yellow, { align: 'center' });
}

function onTap() {
  if (mode === 'title') { sfx.unlock(); start(Math.min(save.unlocked, levels.length - 1)); }
  else if (mode === 'caught' && age > 0.6) start(idx);
  else if (mode === 'clear' && age > 0.6) {
    if (idx === levels.length - 1) { mode = 'title'; save.unlocked = 0; writeSave(save); }
    else start(idx + 1);
  }
}

function afterPlay() {
  if (play.status === 'caught') { mode = 'caught'; age = 0; }
  else if (play.status === 'clear') {
    mode = 'clear'; age = 0;
    const id = levels[idx].id;
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
  if (mode !== 'play' && mode !== 'loading' && input.consumeTap()) onTap();

  if (mode === 'play') { play.update(dt); if (play.status !== 'play') afterPlay(); play.draw(g); }
  else if (mode === 'caught') drawCaught();
  else if (mode === 'clear') drawClear();
  else if (mode === 'title') drawTitle();
  else { g.fillStyle = C.ink; g.fillRect(0, 0, VIEW_W, VIEW_H); drawText(g, 'LOADING...', VIEW_W / 2, 170, C.white, { align: 'center' }); }

  input.endFrame();
  requestAnimationFrame(frame);
}

loadLevels().then((l) => {
  levels = l;
  mode = 'title';
  const jump = Number(new URLSearchParams(location.search).get('level')); // ?level=2 jumps to level 2
  if (jump >= 1 && jump <= levels.length) start(jump - 1);
}).catch((e) => {
  console.error(e);
  mode = 'loading';
});
requestAnimationFrame(frame);

// Debug hook for automated checks: window.__kupit
window.__kupit = { get play() { return play; }, get mode() { return mode; }, start, input };
