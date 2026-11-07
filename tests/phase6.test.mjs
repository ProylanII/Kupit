import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { TRACKS, stepNotes, midiHz } from '../src/data/tracks.js';
import { LOOKS } from '../src/render/sprites.js';
import { precacheList } from '../tools/build-precache.mjs';
import { vibrate, setHaptics } from '../src/core/haptics.js';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root));
const json = (p) => JSON.parse(read(p).toString('utf8'));
const pngSize = (p) => { const b = read(p); assert.equal(b.toString('latin1', 1, 4), 'PNG'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('music: every track is well formed and loops cleanly', () => {
  for (const name of ['menu', 'sneak', 'chase', 'boss']) {
    const t = TRACKS[name];
    assert.ok(t, name);
    assert.ok(t.bpm >= 60 && t.bpm <= 200 && t.steps % 16 === 0, `${name} tempo/length`);
    for (const v of t.voices) {
      assert.equal(v.notes.length, t.steps, `${name} voice length`);
      assert.ok(['square', 'triangle', 'sawtooth', 'sine'].includes(v.wave));
      assert.ok(v.vol > 0 && v.vol <= 0.4 && v.len > 0);
      for (const n of v.notes) assert.ok(n === 0 || (Number.isInteger(n) && n >= 24 && n <= 100), `${name} note ${n}`);
    }
    let sounding = 0;
    for (let s = 0; s < t.steps; s++) sounding += stepNotes(t, s).length;
    assert.ok(sounding >= 8, `${name} has notes`);
    assert.deepEqual(stepNotes(t, 0), stepNotes(t, t.steps), 'wraps around');
  }
  assert.ok(Math.abs(midiHz(69) - 440) < 1e-9);
  assert.ok(TRACKS.chase.bpm > TRACKS.sneak.bpm);
});

test('PWA: manifest, icons, service worker', () => {
  const m = json('manifest.webmanifest');
  assert.equal(m.display, 'standalone');
  assert.ok(m.name && m.short_name && m.start_url && m.theme_color && m.background_color);
  const sizes = new Set();
  for (const ic of m.icons) {
    assert.ok(existsSync(new URL(ic.src, root)), ic.src);
    const [w, h] = pngSize(ic.src);
    assert.equal(`${w}x${h}`, ic.sizes);
    sizes.add(ic.sizes);
  }
  assert.ok(sizes.has('192x192') && sizes.has('512x512'));
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  const html = read('index.html').toString('utf8');
  assert.ok(html.includes('rel="manifest"') && html.includes('apple-touch-icon'));
  assert.ok(read('sw.js').toString('utf8').includes('precache.json'));
});

test('PWA: precache.json lists every game file (run `npm run build` if this fails)', () => {
  const have = json('precache.json');
  const want = precacheList();
  assert.deepEqual(have.files, want.files);
  for (const f of have.files) assert.ok(existsSync(new URL(f, root)), `${f} exists`);
  assert.ok(have.files.includes('src/main.js') && have.files.includes('src/data/levels/index.json'));
});

test('sprite sheet: atlas covers every character, direction and frame', () => {
  const a = json('assets/sprites/atlas.json');
  const [w, h] = pngSize('assets/sprites/sheet.png');
  assert.deepEqual(a.size, [w, h]);
  const kinds = [...Object.keys(LOOKS), 'aso'];
  for (const k of kinds) for (const d of [0, 2, 3]) for (let f = 0; f < 4; f++) {
    const fr = a.frames[`${k}|${d}|${f}`];
    assert.ok(fr, `missing ${k}|${d}|${f}`);
    assert.ok(fr.x >= 0 && fr.y >= 0 && fr.x + fr.w <= w && fr.y + fr.h <= h, 'frame inside sheet');
  }
});

test('haptics are safe where vibration is unsupported', () => {
  setHaptics(true);
  assert.doesNotThrow(() => vibrate(20));
  setHaptics(false);
  assert.doesNotThrow(() => vibrate([10, 20]));
  setHaptics(true);
});
