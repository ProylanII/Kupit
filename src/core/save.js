// The save lives in localStorage (there is no server). It carries a schema version; older saves are migrated
// forward on load, unknown or broken fields fall back to defaults, and every access is wrapped in try/catch
// (private mode, full storage, blocked site data). Save codes let players move a save to another device.
import { oldUpgradeSpend } from '../game/progression.js';
import { hashStr } from './rng.js';
import { maskFromStars, starsOf } from '../game/missions.js';

const KEY = 'kupit.save.v1'; // the storage key never changes; the schema version is inside the save
export const SAVE_VERSION = 7;

export const DEFAULT_OPTS = { music: 0.75, sfx: 1, shake: 1, flash: true, pulse: true, left: false, ghost: true };

export const fresh = () => ({
  v: SAVE_VERSION,
  unlocked: 0, stars: {}, best: {}, bank: 0, muted: false, upgrades: {}, chars: ['jun'], char: 'jun', haptics: true,
  // v2
  opts: { ...DEFAULT_OPTS },
  seen: {},                 // one-time tips already shown
  alkansya: {},             // level id -> true once its secret alkansya was emptied
  outfits: ['basic'], outfit: 'basic', decor: [], decorOff: [],
  story: { intro: false, ending: false, epilogue: false, nena: false, seen: {}, after: {} }, // seen / after: level id -> its scene (before / after the level) has played
  // v3
  needs: {},                // what has been bought for Mingming and the kittens (progression.js NEEDS)
  missions: {},             // level id -> bit mask of its missions done so far (stars[id] = how many bits are set)
  // design overhaul
  ledger: {},               // level id -> what the first clear took { by: {owner: n}, sobra, emptied, catches, spills }
  pick: {},                 // level id -> the kid who went last time (the pre-level card remembers)
  // v6
  album: [],                // photos earned on mini-game missions (scenes/album.js)
});

// version -> function that upgrades a save of that version by one step
const MIGRATIONS = {
  1: (s) => { // v1 had no options, cosmetics or tips; the haptics flag moves into the options too
    s.opts = { ...DEFAULT_OPTS };
    s.v = 2;
    return s;
  },
  2: (s) => { // v3: the cat story. Three levels were added and the sari-sari boss became the storm, so the
    // "furthest level" index moves; the old ending is not the new one; kids are no longer bought.
    const NEW_INDEX = [0, 1, 2, 3, 4, 5, 7, 8, 9, 11, 12, 13, 14, 15];
    const u = Math.max(0, Math.floor(Number(s.unlocked) || 0));
    s.unlocked = NEW_INDEX[Math.min(u, NEW_INDEX.length - 1)];
    for (const k of ['stars', 'best', 'alkansya']) if (s[k] && typeof s[k] === 'object') delete s[k]['boss5-sarisari'];
    if (s.story && typeof s.story === 'object') s.story.ending = false;
    s.v = 3;
    return s;
  },
  3: (s) => { // v4 (design overhaul): the six percentage upgrades became five gear items. Every coin spent on the
    // old ones comes back to the bank, to spend on the new gear. (The Chapter 4 order change comes in a later version.)
    s.bank = Math.max(0, Math.floor(Number(s.bank) || 0)) + oldUpgradeSpend(s.upgrades && typeof s.upgrades === 'object' ? s.upgrades : {});
    s.upgrades = {};
    s.v = 4;
    return s;
  },
  4: (s) => { // v5 (design overhaul Phase 4): Chapter 4 is now PALENGKE -> BARANGAY -> PARTY. Someone who had reached
    // the barangay (index 14, the party cleared) now finds it at 13; the cleared party is skipped over once it is done.
    const u = Math.max(0, Math.floor(Number(s.unlocked) || 0));
    if (u === 14) s.unlocked = 13;
    s.v = 5;
    return s;
  },
  5: (s) => { // v6 (mini-games): TUMBANG PRESO, SI MINGMING and HABOL! join the campaign at 5, 12 and 14. Progress stays on the
    // same level, unless one of the new ones sits right before it: then that is next (the rest wait on the map).
    const NEW_INDEX = [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 13, 15, 16, 17, 18, 19], ADDED = new Set([5, 12, 14]);
    const u = Math.max(0, Math.floor(Number(s.unlocked) || 0)), n = NEW_INDEX[Math.min(u, NEW_INDEX.length - 1)];
    s.unlocked = ADDED.has(n - 1) ? n - 1 : n;
    s.v = 6;
    return s;
  },
  6: (s) => { // v7 (the arcade pass): HINALA, the Random House, the Daily House and the star gifts are gone. Their
    // fields simply drop out (migrate keeps only what fresh() has); looks already earned with them stay owned.
    s.v = 7;
    return s;
  },
};

const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

// Any object in, a complete and well-typed current-version save out.
export function migrate(raw) {
  if (!isObj(raw)) return fresh();
  let s = { ...raw };
  s.v = Number.isInteger(s.v) ? s.v : 1;
  while (s.v < SAVE_VERSION && MIGRATIONS[s.v]) s = MIGRATIONS[s.v](s);
  const def = fresh();
  const out = { ...def };
  for (const k of Object.keys(def)) {
    const want = def[k], got = s[k];
    if (got === undefined) continue;
    if (Array.isArray(want) ? Array.isArray(got) : isObj(want) ? isObj(got) : want === null || typeof got === typeof want) out[k] = got;
  }
  out.v = SAVE_VERSION;
  out.opts = { ...DEFAULT_OPTS, ...(isObj(s.opts) ? s.opts : {}) };
  out.story = { ...def.story, ...(isObj(s.story) ? s.story : {}) };
  if (!isObj(out.story.seen)) out.story.seen = {};
  if (!isObj(out.story.after)) out.story.after = {};
  if (!out.chars.includes('jun')) out.chars = ['jun', ...out.chars];
  if (!out.chars.includes(out.char)) out.char = 'jun';
  if (!out.outfits.includes('basic')) out.outfits = ['basic', ...out.outfits];
  if (!out.outfits.includes(out.outfit)) out.outfit = 'basic';
  // stars are missions now: a save that only has a star count gets that many missions ticked, and the two always agree
  for (const [id, n] of Object.entries(out.stars)) {
    if (!Number.isInteger(out.missions[id])) out.missions[id] = maskFromStars(n);
    out.stars[id] = starsOf(out.missions[id]);
  }
  out.bank = Math.max(0, Math.floor(Number(out.bank) || 0));
  out.unlocked = Math.max(0, Math.floor(Number(out.unlocked) || 0));
  return out;
}

// NEW GAME (Options): everything earned goes (story, coins, stars, crew, looks, tips); the player's own settings stay
// (volume, mute, vibration, left-handed buttons...). DOM-free: tests/newgame.test.mjs.
export function newGameSave(old = {}) {
  const s = fresh();
  if (old.opts && typeof old.opts === 'object') s.opts = { ...s.opts, ...old.opts };
  if (typeof old.muted === 'boolean') s.muted = old.muted;
  if (typeof old.haptics === 'boolean') s.haptics = old.haptics;
  return s;
}

export function loadSave() {
  try { return migrate(JSON.parse(localStorage.getItem(KEY))); } catch { return fresh(); }
}

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; /* private mode, quota... */ }
}

// Ask the browser not to evict our storage when the device runs low (best effort, once).
let persistAsked = false;
export function requestPersist() {
  if (persistAsked) return;
  persistAsked = true;
  try { navigator.storage?.persist?.().catch(() => {}); } catch { /* ignore */ }
}

// ---- save codes: "KUPIT2-<base64>-<checksum>" ---------------------------------------
const b64 = (str) => (typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(str))) : Buffer.from(str, 'utf8').toString('base64'));
const unb64 = (str) => (typeof atob === 'function' ? decodeURIComponent(escape(atob(str))) : Buffer.from(str, 'base64').toString('utf8'));

export function saveCode(s) {
  const body = b64(JSON.stringify(s));
  return `KUPIT${SAVE_VERSION}-${body}-${hashStr(body).toString(36)}`;
}

// Returns a migrated save, or null if the code is damaged.
export function readSaveCode(code) {
  const m = /^KUPIT(\d+)-([A-Za-z0-9+/=]+)-([0-9a-z]+)$/.exec(String(code || '').replace(/\s+/g, ''));
  if (!m || hashStr(m[2]).toString(36) !== m[3]) return null;
  try { return migrate(JSON.parse(unb64(m[2]))); } catch { return null; }
}
