// Design overhaul, Phase 1 (narrative integrity): in play a catch is only a close call ("muntik na!"), the family
// never accuses Jun of taking anything until the story's ending, the one real "HULI KA!". The tattletale is
// Pinsan Jomar (not Kuya Ramil), after-scenes close story beats, and the crew stands with Jun in the ending.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INTRO, BEFORE, AFTER, ENDING, EPILOGUE, NAMES } from '../src/data/story.js';
import { ADULT_TYPES, ACTIVITIES } from '../src/entities/adult.js';
import { MISSIONS } from '../src/game/missions.js';
import { hasBigGlyph } from '../src/ui/font.js';
import { World } from '../src/game/world.js';
import { fresh, migrate } from '../src/core/save.js';

const dir = new URL('../src/data/levels/', import.meta.url);
const levels = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8')).map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
const byId = Object.fromEntries(levels.map((L) => [L.id, L]));
const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const IDLE = { mv: { x: 0, y: 0, mag: 0, run: false }, action: false, actionPressed: false, throwPressed: false, abilityPressed: false };
const step = (w, n, inp = IDLE) => { for (let i = 0; i < n; i++) w.update(1 / 60, inp); };

// Words that would mean the family knows (or says) that Jun steals.
const ACCUSES = /\bHULI\b|NANAKAW|MAGNANAKAW|KUMUKUPIT|KUPIT|SUMBONG|LAGOT/i;

// Every line a character says during play: type lines, routine bubbles, per-level overrides, gift lines.
function characterLines() {
  const out = [];
  const fromCfg = (where, c = {}) => {
    for (const k of ['shout', 'scold']) if (c[k]) out.push([where, c[k]]);
    if (c.tattle?.say) out.push([where, c.tattle.say]);
  };
  for (const [t, c] of Object.entries(ADULT_TYPES)) fromCfg(`type ${t}`, c);
  for (const [k, a] of Object.entries(ACTIVITIES)) if (a.say) out.push([`routine ${k}`, a.say]);
  for (const L of levels) {
    const adults = [...L.adults, ...(L.boss?.phases || []).flatMap((ph) => ph.spawn || [])];
    for (const a of adults) fromCfg(`${L.id} ${a.type}`, a.cfg);
    for (const t of L.targets) if (t.say) out.push([`${L.id} gift`, t.say]);
  }
  return out;
}

test('muntik na: nobody in play accuses Jun of taking anything', () => {
  for (const [where, line] of characterLines()) assert.doesNotMatch(line, ACCUSES, `${where}: "${line}"`);
  // lines said straight from the AI code (search, inspect, hunt)
  assert.doesNotMatch(src('entities/adult.js').replace(/\/\/.*$/gm, ''), /'HULI/, 'adult.js says HULI');
});

test('muntik na: "HULI" never appears in level text, and "HULI KA!" only as the ending\'s caught panel', () => {
  for (const L of levels) {
    for (const s of [L.name, L.hint, L.clearText, L.boss?.title, ...(L.boss?.phases || []).map((p) => p.banner)]) {
      if (s) assert.doesNotMatch(s, /\bHULI\b/, `${L.id}: "${s}"`);
    }
  }
  const text = (panels) => panels.map((p) => p.lines.join(' ')).join(' ');
  assert.doesNotMatch(text([...INTRO, ...Object.values(BEFORE).flat(), ...Object.values(AFTER).flat(), ...EPILOGUE]), /\bHULI\b/i);
  const code = (p) => src(p).replace(/\/\/.*$/gm, ''); // comments may talk about it; drawn text may not
  const main = code('main.js'), play = code('scenes/play.js');
  assert.equal(main.match(/'HULI KA!'/g)?.length, 1, 'main.js draws HULI KA! once: the story panel flagged caught');
  assert.match(main, /if \(p\.caught\) drawText\(g, 'HULI KA!'/);
  assert.doesNotMatch(play, /HULI/);
  assert.equal(ENDING.filter((p) => p.caught).length, 1);
  assert.equal(MISSIONS.noCatch.label(), 'NO CLOSE CALLS');
});

test('muntik na: a catch with chances left is still the same rule (a third of the coins back, a respawn)', () => {
  const w = new World(byId['02-kusina'], { lives: 3 });
  w.coins = 3;
  w.caught(w.adults[0]);
  assert.ok(w.scold && w.scold.lost === 1 && w.coins === 2 && w.status === 'play');
  assert.equal(w.adults[0].say?.text, ADULT_TYPES.mama.scold);
});

test('jomar: the tattletale is the cousin, introduced before his first level, and never Kuya Ramil', () => {
  assert.equal(ADULT_TYPES.kuya.name, 'JOMAR');
  assert.equal(NAMES.kuya, 'Pinsan Jomar');
  const intro = levels.findIndex((L) => BEFORE[L.id]?.some((p) => p.who === 'kuya'));
  assert.ok(intro >= 0, 'a scene introduces Jomar');
  const uses = (L) => [...L.adults, ...(L.boss?.phases || []).flatMap((ph) => ph.spawn || [])].some((a) => a.type === 'kuya');
  const first = levels.findIndex(uses);
  assert.ok(first >= intro, `Jomar is in ${levels[first].id} before his scene (${levels[intro].id})`);
  for (const L of levels) for (const s of [L.hint, ...(L.boss?.phases || []).map((p) => p.banner)]) if (s) assert.doesNotMatch(s, /\bKUYA\b/, `${L.id}: "${s}"`);
});

test('after-scenes: fit the dialogue box, point at real levels, and are remembered in the save', () => {
  assert.ok(AFTER.ibalik?.length, 'IBALIK has an aftermath');
  for (const [id, panels] of Object.entries(AFTER)) {
    assert.ok(byId[id], `after-scene for unknown level ${id}`);
    for (const p of panels) {
      assert.ok(NAMES[p.who], `${id}: unknown speaker ${p.who}`);
      assert.ok(p.lines.length >= 1 && p.lines.length <= 4);
      for (const l of p.lines) {
        assert.ok(l.length <= 37, `${id}: "${l}" is ${l.length} chars`);
        for (const ch of l) assert.ok(hasBigGlyph(ch), `${id}: no glyph for "${ch}"`);
      }
    }
  }
  assert.deepEqual(fresh().story.after, {});
  const s = migrate({ ...fresh(), story: { ...fresh().story, after: { ibalik: true } } });
  assert.equal(s.story.after.ibalik, true);
  const old = migrate({ ...fresh(), story: { intro: true, seen: {} } }); // a save from before after-scenes
  assert.deepEqual(old.story.after, {});
});

test('ending: the crew steps forward, and Lola explains why "no more animals"', () => {
  const cat = ENDING.findIndex((p) => p.who === 'cat');
  const after = ENDING.slice(cat + 1);
  for (const sib of ['bing', 'ramil', 'nene']) assert.ok(after.some((p) => p.who === sib), `${sib} is in the ending`);
  const why = after.findIndex((p) => p.who === 'lola' && /no more animals/i.test(p.lines.join(' ')));
  const ask = after.findIndex((p) => /Magsabi ka lang/.test(p.lines.join(' ')));
  assert.ok(why >= 0 && why < ask, 'Lola tells the story before Mama says "just ask"');
  assert.ok(BEFORE['boss4-fiesta'].some((p) => p.who === 'lola' && /under the/i.test(p.lines.join(' '))), 'seeded before the party');
});

test('party: it is a Christmas party (no inverted pamasko), and one envelope says PARA KAY JUN', () => {
  const L = byId['boss4-fiesta'];
  assert.match(L.name, /PARTY/);
  for (const ph of L.boss.phases) assert.doesNotMatch(ph.banner, /WANTS HER PAMASKO/);
  assert.equal(L.targets.filter((t) => t.label === 'PARA KAY JUN').length, 1);
  const w = new World(L, { lives: 3 });
  const env = w.targets.find((t) => t.label);
  w.player.x = env.x; w.player.y = env.y + 12; w.player.graceT = 99; // nobody looks while we test the envelope
  step(w, 1);
  for (let i = 0; i < 300 && !env.done; i++) w.update(1 / 60, { ...IDLE, action: true });
  assert.ok(env.done);
  assert.match(w.say?.text || '', /PARA SA AKIN/);
});
