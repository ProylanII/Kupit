// Characters, store upgrades and how they modify a level. DOM-free (tested in tests/phase3.test.mjs).

export const CHAR_ORDER = ['jun', 'bing', 'ramil', 'nene'];

// skill ids are implemented in World.useAbility. cd = cooldown seconds.
export const CHARACTERS = {
  jun: {
    name: 'JUN', cost: 0, look: 'jun',
    skill: { id: 'dash', label: 'DASH', cd: 5 },
    lines: ['SNEAKY STEP: SILENT DASH', 'BALANCED. NO WEAKNESS.'],
  },
  bing: {
    name: 'BING', cost: 15, look: 'bing', speed: 0.88, alertRate: 0.7, radius: 3,
    skill: { id: 'hide', label: 'TAGO', cd: 10 },
    lines: ['TAGO: HIDE ANYWHERE FOR 3S', 'TINY: HARD TO SPOT, SLOWER.'],
  },
  ramil: {
    name: 'KUYA RAMIL', cost: 25, look: 'ramil', throwRange: 1.6, runNoise: 1.25,
    skill: { id: 'shout', label: 'YELL', cd: 8 },
    lines: ['SIGAW: YELL TO LURE AHEAD', 'STRONG: THROWS FAR, LOUD RUN.'],
  },
  nene: {
    name: 'NENE', cost: 30, look: 'nene', stealTime: 0.75,
    skill: { id: 'charm', label: 'CUTE', cd: 14 },
    lines: ['PA-CUTE: FREEZE WATCHERS 3S', 'CHARMER: KUPIT MUCH FASTER.'],
  },
};

export const UPGRADE_ORDER = ['quiet', 'hands', 'pockets', 'shadow', 'pasensya', 'stash'];

// costs[i] = price of level i+1
export const UPGRADES = {
  quiet:    { name: 'QUIET TSINELAS', desc: 'RUNNING MAKES LESS NOISE', costs: [6, 12, 20] },
  hands:    { name: 'QUICK HANDS',    desc: 'KUPIT FASTER',             costs: [6, 12, 20] },
  pockets:  { name: 'POCKETS',        desc: 'CARRY MORE ITEMS',         costs: [5, 10, 18] },
  shadow:   { name: 'LONG SHADOW',    desc: 'ADULTS NOTICE YOU SLOWER', costs: [8, 14, 24] },
  pasensya: { name: 'PASENSYA',       desc: '+10S BEFORE KAIN NA!',     costs: [5, 10, 16] },
  stash:    { name: 'STARTER STASH',  desc: 'START WITH TSINELAS',      costs: [6, 12, 20] },
};

export const BASE_RUN_NOISE = 48;
export const BASE_ITEM_CAP = 3;

const lvl = (ups, id) => (ups && ups[id]) | 0;

export function computeMods(charId = 'jun', ups = {}) {
  const c = CHARACTERS[charId] || CHARACTERS.jun;
  return {
    charId: CHARACTERS[charId] ? charId : 'jun',
    look: c.look,
    skill: c.skill,
    speed: c.speed ?? 1,
    radius: c.radius ?? 4,
    runNoise: BASE_RUN_NOISE * (c.runNoise ?? 1) * (1 - 0.2 * lvl(ups, 'quiet')),
    stealTime: (c.stealTime ?? 1) * (1 - 0.15 * lvl(ups, 'hands')),
    alertRate: (c.alertRate ?? 1) * (1 - 0.1 * lvl(ups, 'shadow')),
    itemCap: BASE_ITEM_CAP + lvl(ups, 'pockets'),
    startItems: lvl(ups, 'stash'),
    patienceBonus: 10 * lvl(ups, 'pasensya'),
    throwRange: c.throwRange ?? 1,
  };
}

// ---- store ---------------------------------------------------------------------
// Price of the next level of an upgrade, or null when maxed.
export function upgradeCost(save, id) {
  const costs = UPGRADES[id].costs;
  const l = lvl(save.upgrades, id);
  return l >= costs.length ? null : costs[l];
}

export function buyUpgrade(save, id) {
  const cost = upgradeCost(save, id);
  if (cost === null || save.bank < cost) return false;
  save.bank -= cost;
  save.upgrades = { ...save.upgrades, [id]: lvl(save.upgrades, id) + 1 };
  return true;
}

export const owns = (save, id) => save.chars.includes(id);

// Buy (if needed) and select a character. Returns 'selected' | 'bought' | 'poor'.
export function pickChar(save, id) {
  if (owns(save, id)) { save.char = id; return 'selected'; }
  const cost = CHARACTERS[id].cost;
  if (save.bank < cost) return 'poor';
  save.bank -= cost;
  save.chars = [...save.chars, id];
  save.char = id;
  return 'bought';
}
