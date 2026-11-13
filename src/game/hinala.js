// HINALA: the household's suspicion, 0..100, carried across the campaign (design overhaul Phase 2B).
// The family suspects *something* (the wind, the cat next door, the cousin), never Jun: the settled ending is that
// they only find out in the storm. DOM-free (tests/hinala.test.mjs).
//
// - It moves only on a level's FIRST clear: retries and replays never change it, failed attempts never count.
// - Each chapter has a floor, so the story's "suspicion grows" always holds; how you play pushes it above that.
// - Four tiers change the house. A level lists up to two changes per tier in its "hinala" block (cumulative:
//   tier 2 gets the tier-1 and tier-2 changes), plus a few changes every level gets (TIER_BASE). Replays use the tier
//   the level was first cleared at, so you replay the house as it was.
//
// Level format:
//   "hinala": { "1": { "news": "MAMA COUNTS HER PURSE NOW", "do": [op, op] }, "2": {...}, "3": {...} }
//   op: { "move": targetIndex, "to": [x, y] }                    a stash moves (Mama hides her purse somewhere new)
//       { "stop": adultIndex, "at": [x, y, wait, face, "bilang"] } a new stop on someone's route (counting the purse)
//       { "adult": adultIndex, "cfg": { "lightSleeper": true } }  someone watches differently (cfg keys as in adult.js)

export const MAX = 100;
export const TIERS = [
  { name: 'KALMADO', en: 'CALM', mood: 'happy' },
  { name: 'NAGTATAKA', en: 'WONDERING', mood: '' },
  { name: 'NAGHIHINALA', en: 'SUSPICIOUS', mood: 'shock' },
  { name: 'NAGBABANTAY', en: 'ON GUARD', mood: 'angry' },
];
export const tierOf = (v) => (v >= 75 ? 3 : v >= 50 ? 2 : v >= 25 ? 1 : 0);
// Chapter floors (chapter index 0..4): the script's suspicion, whatever you do.
export const FLOORS = [0, 15, 30, 45, 75];
export const floorFor = (chapter) => FLOORS[Math.max(0, Math.min(FLOORS.length - 1, chapter | 0))];
export const effective = (value, chapter) => Math.max(value | 0, floorFor(chapter));

// What a first clear does to it. r = the World's result (coins, sobra, emptied, catches, spotted, spills, tattles).
// Returns { total, parts: [{ id, label, n }] } (parts with n = 0 left out).
export const INPUTS = {
  sobra:   { label: 'SOBRA',       each: 3, cap: 15 },
  emptied: { label: 'EMPTY STASH', each: 4, cap: 12 },
  catches: { label: 'CLOSE CALL',  each: 5, cap: 10 },
  spotted: { label: 'ALARM',       each: 2, cap: 6 },
  spills:  { label: 'EVIDENCE',    each: 3, cap: 6 },
  tattles: { label: 'TATTLE',      each: 2, cap: 4 },
};
export const CLEAN = -5;      // nothing taken past the quota, no alarm, no close call: the house seems normal
export const RETURNED = -2;   // IBALIK: per coin put back
export function delta(r, L = {}) {
  const parts = [];
  if (L.hingi || L.epilogue) return { total: 0, parts };
  for (const [id, d] of Object.entries(INPUTS)) {
    const n = Math.min(d.cap, (r[id] | 0) * d.each);
    if (n) parts.push({ id, label: d.label, n });
  }
  if (L.giveBack) parts.push({ id: 'returned', label: 'PUT BACK', n: RETURNED * (r.coins | 0) });
  else if (!(r.sobra | 0) && !(r.spotted | 0) && !(r.catches | 0)) parts.push({ id: 'clean', label: 'CLEAN', n: CLEAN });
  return { total: parts.reduce((s, p) => s + p.n, 0), parts };
}

// The new value after a first clear of a level in chapter `chapter` (never below that chapter's floor).
export const next = (value, d, chapter) => Math.max(floorFor(chapter), Math.min(MAX, Math.max(0, (value | 0) + d.total)));

// Changes every level gets, whatever its own block says (kept small on purpose: the level blocks carry the story).
export const TIER_BASE = {
  2: { searchMul: 1.3 },          // they look a little longer before giving up
  3: { searchMul: 1.3, light: true }, // and the sleepers sleep lightly
};

const clone = (o) => JSON.parse(JSON.stringify(o));

// The level as the house is at this tier. Returns a new level object (the input is not touched) with `news`, the
// lines for the "new in the house" card (newest tier first).
export function applyHinala(L, tier) {
  tier = Math.max(0, Math.min(3, tier | 0));
  if (!tier || L.hingi || L.epilogue) return L;
  const out = clone(L), news = [];
  for (let t = 1; t <= tier; t++) {
    const b = L.hinala?.[t];
    if (!b) continue;
    if (b.news) news.unshift(b.news);
    for (const op of b.do || []) applyOp(out, op);
  }
  const base = TIER_BASE[tier];
  if (base) {
    for (const a of out.adults) {
      if (['bisita', 'trike', 'aso'].includes(a.type)) continue;
      a.cfg = { ...a.cfg };
      if (base.searchMul) a.cfg.searchMul = Math.max(a.cfg.searchMul || 1, base.searchMul);
      if (base.light && (a.type === 'lola' || a.sleepy || a.cfg.sleepy)) a.cfg.lightSleeper = true;
    }
  }
  out.news = news;
  out.hinalaTier = tier;
  return out;
}

function applyOp(L, op) {
  if (op.move !== undefined && L.targets[op.move]) L.targets[op.move].at = op.to.slice();
  else if (op.stop !== undefined && L.adults[op.stop]) {
    const a = L.adults[op.stop];
    if (!a.route) a.route = [a.at.slice()];
    a.route.push(op.at.slice());
  } else if (op.adult !== undefined && L.adults[op.adult]) L.adults[op.adult].cfg = { ...(L.adults[op.adult].cfg || {}), ...op.cfg };
}

// Problems with a level's hinala block (the validator checks every tier variant on top of this).
export function hinalaProblems(L) {
  const bad = [];
  if (!L.hinala) return bad;
  for (const [k, b] of Object.entries(L.hinala)) {
    if (!['1', '2', '3'].includes(k)) bad.push(`hinala: tier ${k} (only 1, 2, 3)`);
    if ((b.do || []).length > 2) bad.push(`hinala ${k}: at most two changes per tier`);
    if (b.news && b.news.length > 40) bad.push(`hinala ${k}: news is ${b.news.length} chars (max 40: it follows "NEW IN THE HOUSE: ")`);
    for (const op of b.do || []) {
      if (op.move !== undefined && !(L.targets[op.move] && Array.isArray(op.to))) bad.push(`hinala ${k}: bad move`);
      if (op.stop !== undefined && !(L.adults[op.stop] && Array.isArray(op.at) && op.at.length >= 2)) bad.push(`hinala ${k}: bad stop`);
      if (op.adult !== undefined && !(L.adults[op.adult] && op.cfg)) bad.push(`hinala ${k}: bad adult change`);
    }
  }
  return bad;
}
