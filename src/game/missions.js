// Per-level missions: the three stars of a level. The first is always "clear it"; the other two are picked per
// level ("missions": ["silent", "allCoins"] in the level file) so every level asks for a different kind of play.
// A star stays earned once you have done its mission, so they can be collected over several runs.
// DOM-free. ok(world) is read when the level is cleared; a `strict` mission can also be lost mid-run (the HUD says so).
export const MISSIONS = {
  clear:    { label: () => 'CLEAR THE LEVEL', ok: () => true },
  fast:     { label: (L) => `FINISH IN ${L.par}S`, strict: true, ok: (w) => w.time <= w.level.par },
  silent:   { label: () => 'NEVER RAISE AN ALARM', strict: true, ok: (w) => w.stealthOk },
  ghost:    { label: () => 'NOBODY EVEN GLANCES AT YOU', strict: true, ok: (w) => w.maxAlert < 0.12 && w.catches === 0 },
  noCatch:  { label: () => 'NEVER GET CAUGHT', strict: true, ok: (w) => w.catches === 0 },
  allCoins: { label: () => 'EMPTY EVERY STASH', ok: (w) => w.targets.every((t) => t.bonus || t.done) },
  alkansya: { label: () => 'FIND THE SECRET ALKANSYA', ok: (w) => w.bonus > 0 || w.alkansyaWasFound },
  noThrow:  { label: () => 'THROW NOTHING', strict: true, ok: (w) => w.stats.throws === 0 },
  noHide:   { label: () => 'NEVER HIDE', strict: true, ok: (w) => w.stats.hides === 0 },
  noRun:    { label: () => 'NEVER RUN', strict: true, ok: (w) => w.stats.runT < 0.4 },
  noSkill:  { label: () => 'DO NOT USE YOUR SKILL', strict: true, ok: (w) => w.stats.skills === 0 },
  noTrap:   { label: () => 'STEP ON NO CREAK OR LEGO', strict: true, ok: (w) => w.stats.traps === 0 },
  noWake:   { label: () => 'NEVER WAKE A SLEEPER', strict: true, ok: (w) => w.adults.every((a) => !a.woken) },
  noBark:   { label: () => 'THE DOG NEVER BARKS', strict: true, ok: (w) => w.stats.barks === 0 },
  noDevice: { label: () => 'LEAVE THE TV AND RADIO OFF', strict: true, ok: (w) => w.stats.devices === 0 },
  noSpill:  { label: () => 'NEVER SPILL THE MILK', strict: true, ok: (w) => w.stats.spills === 0 },
  thunder:  { label: () => 'ONLY RUN UNDER THUNDER', strict: true, ok: (w) => w.stats.loudRunT < 0.4 },
};
export const DEFAULT_MISSIONS = ['fast', 'silent']; // Random Houses, and any level that names none

// The three missions of a level, in star order.
export function missionIds(L) {
  const m = Array.isArray(L.missions) ? L.missions.filter((id) => MISSIONS[id] && id !== 'clear').slice(0, 2) : [];
  for (const d of DEFAULT_MISSIONS) if (m.length < 2 && !m.includes(d)) m.push(d);
  return ['clear', ...m];
}
export const missionLabel = (L, id) => MISSIONS[id].label(L);

// Bit i set = mission i done. Saved per level; a level's stars = the number of bits set.
export const maskOf = (flags) => flags.reduce((m, f, i) => m | (f ? 1 << i : 0), 0);
export const starsOf = (mask) => ((mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1));
// Saves from before missions only stored a star count: treat it as the first n missions.
export const maskFromStars = (n) => (1 << Math.max(0, Math.min(3, n | 0))) - 1;
