// The save lives in localStorage (there is no server). It carries a schema version; older saves are migrated
// forward on load, unknown or broken fields fall back to defaults, and every access is wrapped in try/catch
// (private mode, full storage, blocked site data). Save codes let players move a save to another device.
import { hashStr } from './rng.js';

const KEY = 'kupit.save.v1'; // the storage key never changes; the schema version is inside the save
export const SAVE_VERSION = 2;

export const DEFAULT_OPTS = { music: 0.75, sfx: 1, shake: 1, flash: true, pulse: true, left: false, ghost: true };

export const fresh = () => ({
  v: SAVE_VERSION,
  unlocked: 0, stars: {}, best: {}, bank: 0, muted: false, upgrades: {}, chars: ['jun'], char: 'jun',
  houses: 0, houseDiff: 2, daily: null, haptics: true,
  // v2
  opts: { ...DEFAULT_OPTS },
  seen: {},                 // one-time tips already shown
  alkansya: {},             // level id -> true once its secret alkansya was emptied
  outfits: ['basic'], outfit: 'basic', decor: [], decorOff: [],
  mutators: [], mutatorClears: {},
  streak: { last: null, n: 0, best: 0 },
  houseDay: { id: null, n: 0 }, // Random Houses cleared today (diminishing payouts)
  story: { intro: false, ending: false },
});

// version -> function that upgrades a save of that version by one step
const MIGRATIONS = {
  1: (s) => { // v1 had no options, cosmetics or tips; the haptics flag moves into the options too
    s.opts = { ...DEFAULT_OPTS };
    s.v = 2;
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
  out.streak = { ...def.streak, ...(isObj(s.streak) ? s.streak : {}) };
  out.houseDay = { ...def.houseDay, ...(isObj(s.houseDay) ? s.houseDay : {}) };
  out.story = { ...def.story, ...(isObj(s.story) ? s.story : {}) };
  if (!out.chars.includes('jun')) out.chars = ['jun', ...out.chars];
  if (!out.chars.includes(out.char)) out.char = 'jun';
  if (!out.outfits.includes('basic')) out.outfits = ['basic', ...out.outfits];
  if (!out.outfits.includes(out.outfit)) out.outfit = 'basic';
  out.bank = Math.max(0, Math.floor(Number(out.bank) || 0));
  out.unlocked = Math.max(0, Math.floor(Number(out.unlocked) || 0));
  return out;
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
