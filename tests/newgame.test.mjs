// NEW GAME (Options): erase everything earned, keep the player's own settings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fresh, newGameSave } from '../src/core/save.js';

test('new game: story, coins, stars, crew, looks and tips are gone; settings, mute and vibration stay', () => {
  const old = { ...fresh(), bank: 120, unlocked: 9, stars: { '01-sala': 3 }, chars: ['jun', 'bing', 'ramil'], outfits: ['basic', 'pula'],
    seen: { throw: true }, story: { ...fresh().story, intro: true }, needs: { gatas: true }, hinala: 40, muted: true, haptics: false };
  old.opts = { ...old.opts, left: true, music: 0.25 };
  const s = newGameSave(old);
  const f = fresh();
  for (const k of ['bank', 'unlocked', 'stars', 'chars', 'outfits', 'seen', 'story', 'needs', 'hinala']) assert.deepEqual(s[k], f[k], k);
  assert.equal(s.opts.left, true); assert.equal(s.opts.music, 0.25);
  assert.equal(s.muted, true); assert.equal(s.haptics, false);
  assert.equal(s.v, f.v);
});
