// The art style is locked in tools/art/style.json (see docs/ART_STYLE.md). New or re-rendered sprites
// (Blender batch, make_art.py, hand-drawn) must keep to it, or this test fails before anything ships.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readPng, hex } from '../tools/art/png.mjs';

const root = new URL('../', import.meta.url);
const style = JSON.parse(readFileSync(new URL('tools/art/style.json', root), 'utf8'));
const atlas = JSON.parse(readFileSync(new URL('assets/sprites/atlas.json', root), 'utf8'));
const sheet = readPng(readFileSync(new URL('assets/sprites/sheet.png', root)));
const palette = new Set(style.palette);

const pixels = (f, fn) => {
  for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) {
    const o = (y * sheet.w + x) * 4;
    fn(x, y, sheet.px[o + 3], hex(sheet.px[o], sheet.px[o + 1], sheet.px[o + 2]));
  }
};
const groupOf = (kind) => Object.keys(style.kinds).find((g) => style.kinds[g].includes(kind));

test('art lock: only palette colours, hard alpha', () => {
  for (const [k, f] of Object.entries(atlas.frames)) {
    pixels(f, (x, y, a, c) => {
      assert.ok(a === 0 || a === 255, `${k}: soft alpha ${a} at ${x},${y}`);
      if (a) assert.ok(palette.has(c), `${k}: colour ${c} is not in the locked palette`);
    });
  }
});

test('art lock: every character has a 1px ink outline', () => {
  for (const [k, f] of Object.entries(atlas.frames)) {
    if (k.startsWith('portrait|')) continue;
    const solid = (x, y) => x >= f.x && y >= f.y && x < f.x + f.w && y < f.y + f.h && sheet.px[(y * sheet.w + x) * 4 + 3] > 0;
    pixels(f, (x, y, a, c) => {
      if (!a) return;
      const edge = !solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1);
      if (edge) assert.equal(c, style.outline, `${k}: edge pixel ${x},${y} is ${c}, not ink`);
    });
  }
});

test('art lock: sprite heights relative to the 16px tile, directions and frame budget', () => {
  for (const [group, kinds] of Object.entries(style.kinds)) {
    const [lo, hi] = style.height[group];
    for (const kind of kinds) {
      for (const d of style.directions) for (let fr = 0; fr < style.walkFrames; fr++) {
        const f = atlas.frames[`${kind}|${d}|${fr}`];
        assert.ok(f, `${kind}|${d}|${fr} missing`);
        assert.ok(f.h >= lo && f.h <= hi, `${kind}|${d}|${fr} is ${f.h}px tall (${group}: ${lo}..${hi})`);
      }
      assert.equal(atlas.frames[`${kind}|1|0`], undefined, 'left is mirrored in code, not stored');
      for (const pose of style.poses[group] || []) for (const d of style.directions) assert.ok(atlas.frames[`${kind}|${d}|${pose}`], `${kind} ${pose} pose`);
    }
  }
  for (const [k, f] of Object.entries(atlas.frames)) {
    if (!k.startsWith('portrait|')) { assert.ok(groupOf(k.split('|')[0]) || k.startsWith('kid|'), `unknown kind in ${k}`); continue; }
    const [lo, hi] = style.height.portrait;
    assert.ok(f.h >= lo && f.h <= hi && f.w === f.h, `${k} portrait size ${f.w}x${f.h}`);
  }
});
