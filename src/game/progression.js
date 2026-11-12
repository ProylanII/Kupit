// Characters, store upgrades and how they modify a level. DOM-free (tested in tests/phase3.test.mjs).

export const CHAR_ORDER = ['jun', 'bing', 'ramil', 'nene'];

// skill ids are implemented in World.useAbility. cd = cooldown seconds.
// joins: the sibling finds out about the kittens in the story scene before this level (never bought with coins).
export const CHARACTERS = {
  jun: {
    name: 'JUN', look: 'jun',
    skill: { id: 'dash', label: 'DASH', cd: 5 },
    lines: ['SNEAKY STEP: SILENT DASH', 'BALANCED. NO WEAKNESS.'],
  },
  bing: {
    name: 'BING', joins: '04-bakuran', look: 'bing', speed: 0.88, alertRate: 0.7, radius: 3,
    skill: { id: 'hide', label: 'TAGO', cd: 10 },
    lines: ['TAGO: HIDE ANYWHERE FOR 3S', 'TINY: HARD TO SPOT, SLOWER.'],
  },
  ramil: {
    name: 'KUYA RAMIL', joins: '05-gabi', look: 'ramil', throwRange: 1.6, runNoise: 1.25,
    skill: { id: 'shout', label: 'YELL', cd: 8 },
    lines: ['SIGAW: YELL TO LURE AHEAD', 'STRONG: THROWS FAR, LOUD RUN.'],
  },
  nene: {
    name: 'NENE', joins: '08-palengke', look: 'nene', stealTime: 0.75,
    skill: { id: 'charm', label: 'CUTE', cd: 14 },
    lines: ['PA-CUTE: FREEZE WATCHERS 3S', 'CHARMER: KUPIT MUCH FASTER.'],
  },
};

// ---- what the coins are for: Mingming and her kittens ---------------------------------
// Each need is bought once at Aling Nena's store. The hideout under the house changes with every one, and the
// kittens grow (catStage). Once Aling Nena learns who the sardines are for (story flag 'nena'), she gives a discount.
export const NEED_ORDER = ['gatas', 'sardinas', 'kumot', 'kahon', 'vet'];
export const NEEDS = {
  gatas:    { name: 'GATAS',        desc: 'A BOWL OF MILK FOR MINGMING',     cost: 6,  got: 'MINGMING DRINKS AND DRINKS.' },
  sardinas: { name: 'SARDINAS',     desc: 'REAL FOOD. SHE IS SO THIN',       cost: 10, got: 'THE KITTENS OPEN THEIR EYES!' },
  kumot:    { name: 'KUMOT',        desc: 'A WARM BLANKET FOR COLD NIGHTS',  cost: 12, got: 'THREE KITTENS IN A WARM PILE.' },
  kahon:    { name: 'BAGONG KAHON', desc: 'A BIGGER BOX. THEY ARE GROWING',  cost: 16, got: 'ROOM TO TUMBLE AND PLAY!' },
  vet:      { name: 'BAKUNA',       desc: 'A VISIT TO THE VET FOR ALL FOUR', cost: 26, got: 'HEALTHY, LOUD AND HUNGRY.' },
};
export const NENA_DISCOUNT = 0.75;
export const hasNeed = (save, id) => !!(save.needs && save.needs[id]);
export const needCost = (save, id) => Math.ceil(NEEDS[id].cost * (save.story?.nena ? NENA_DISCOUNT : 1));
export const catStage = (save) => NEED_ORDER.filter((id) => hasNeed(save, id)).length; // 0 newborn ... 5 thriving
export function buyNeed(save, id) {
  if (!NEEDS[id] || hasNeed(save, id)) return 'owned';
  const cost = needCost(save, id);
  if (save.bank < cost) return 'poor';
  save.bank -= cost;
  save.needs = { ...save.needs, [id]: true };
  return 'bought';
}

// Siblings who should be in the crew by now: their story scene has played, or (for saves from before the story
// existed) the campaign is already past it. Returns the ids newly added.
export function grantSiblings(save, levelIds = []) {
  const got = [];
  for (const id of CHAR_ORDER) {
    const j = CHARACTERS[id].joins;
    if (!j || save.chars.includes(id)) continue;
    const at = levelIds.indexOf(j);
    if (save.story?.seen?.[j] || (at >= 0 && save.unlocked > at)) { save.chars = [...save.chars, id]; got.push(id); }
  }
  return got;
}

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
// No stack of upgrades and kid traits may remove the tension: these are hard floors.
export const FLOORS = { runNoise: 24, stealTime: 0.5, alertRate: 0.55 };

const lvl = (ups, id) => (ups && ups[id]) | 0;

export function computeMods(charId = 'jun', ups = {}) {
  const c = CHARACTERS[charId] || CHARACTERS.jun;
  return {
    charId: CHARACTERS[charId] ? charId : 'jun',
    look: c.look,
    skill: c.skill,
    speed: c.speed ?? 1,
    radius: c.radius ?? 4,
    runNoise: Math.max(FLOORS.runNoise, BASE_RUN_NOISE * (c.runNoise ?? 1) * (1 - 0.2 * lvl(ups, 'quiet'))),
    stealTime: Math.max(FLOORS.stealTime, (c.stealTime ?? 1) * (1 - 0.15 * lvl(ups, 'hands'))),
    alertRate: Math.max(FLOORS.alertRate, (c.alertRate ?? 1) * (1 - 0.1 * lvl(ups, 'shadow'))),
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

// What an upgrade does for the kid you're playing, now and after the next level (store stat bars).
// frac: 0..1 how far along the stat is from "no upgrade" to its best (floors included).
const STAT = {
  quiet:    { key: 'runNoise', label: 'NOISE', lowGood: true, fmt: (v) => Math.round(v) },
  hands:    { key: 'stealTime', label: 'KUPIT TIME', lowGood: true, fmt: (v) => `${Math.round(v * 100)}%` },
  pockets:  { key: 'itemCap', label: 'POCKETS', fmt: (v) => v },
  shadow:   { key: 'alertRate', label: 'NOTICED', lowGood: true, fmt: (v) => `${Math.round(v * 100)}%` },
  pasensya: { key: 'patienceBonus', label: 'DINNER', fmt: (v) => `+${v}S` },
  stash:    { key: 'startItems', label: 'START WITH', fmt: (v) => v },
};
export function upgradeStat(save, id) {
  const s = STAT[id], max = UPGRADES[id].costs.length, have = lvl(save.upgrades, id);
  const at = (n) => computeMods(save.char, { ...save.upgrades, [id]: n })[s.key];
  const v0 = at(0), vMax = at(max), now = at(have);
  const frac = v0 === vMax ? 1 : (now - v0) / (vMax - v0);
  return { label: s.label, now: s.fmt(now), next: have < max ? s.fmt(at(have + 1)) : null, frac: Math.max(0, Math.min(1, frac)) };
}

export const owns = (save, id) => save.chars.includes(id);

// ---- cosmetics: they never touch balance -------------------------------------------
// Outfits are palette swaps of the kid's top and bottom (see render/sprites.js).
// how: cost (coins) | stars (milestone) | mutator (clear a level-3+ Random House with it) | pasko (free in season)
export const OUTFIT_ORDER = ['basic', 'pula', 'lila', 'jersey', 'pambahay', 'barong', 'glow', 'pasko', 'ginto'];
export const OUTFITS = {
  basic:    { name: 'PAMBAHAY NI NANAY', how: { cost: 0 } },
  pula:     { name: 'PULANG DAMIT', how: { cost: 12 }, top: ['#d94a4a', '#a83a3a'], bottom: ['#3a3550', '#2a2640'] },
  lila:     { name: 'LILA', how: { cost: 15 }, top: ['#8a5fb5', '#6b4a8c'], bottom: ['#ece6dc', '#bdb6ab'] },
  jersey:   { name: 'BASKETBALL JERSEY', how: { stars: 10 }, top: ['#2f5fbf', '#24488f'], bottom: ['#d94a4a', '#a83a3a'] },
  pambahay: { name: 'SANDO AT SHORTS', how: { mutator: 'tsinelas' }, top: ['#f6f1e7', '#cfc7b8'], bottom: ['#46a0e0', '#3580b8'] },
  barong:   { name: 'MINI BARONG', how: { mutator: 'bisita' }, top: ['#f3ead2', '#d9cba6'], bottom: ['#5a5468', '#46415a'] },
  glow:     { name: 'GLOW SHIRT', how: { mutator: 'brownout' }, top: ['#7fd7ff', '#4f8fff'], bottom: ['#2a3560', '#1d2448'] },
  pasko:    { name: 'PAMASKONG DAMIT', how: { pasko: true }, top: ['#d94a4a', '#a83a3a'], bottom: ['#2fa55b', '#227a43'] },
  ginto:    { name: 'GINTONG KUPIT', how: { stars: 48 }, top: ['#ffd84d', '#c9962b'], bottom: ['#ffd84d', '#c9962b'] },
};
// Title-screen skyline decorations.
export const DECOR_ORDER = ['pusa', 'alitaptap', 'parol', 'banderitas', 'jeep', 'paputok'];
export const DECOR = {
  pusa:       { name: 'PUSA SA BUBONG', how: { cost: 6 } },
  alitaptap:  { name: 'ALITAPTAP', how: { cost: 8 } },
  parol:      { name: 'PAROL', how: { cost: 10 } },
  banderitas: { name: 'BANDERITAS', how: { cost: 12 } },
  jeep:       { name: 'JEEPNEY', how: { stars: 20 } },
  paputok:    { name: 'PAPUTOK', how: { stars: 30 } },
};
export const MAX_STARS = 48; // 16 levels with stars (the epilogue has none)
export const STAR_MILESTONES = [10, 20, 30, MAX_STARS].map((stars) => ({
  stars,
  rewards: [
    ...OUTFIT_ORDER.filter((id) => OUTFITS[id].how.stars === stars).map((id) => ({ kind: 'outfit', id, name: OUTFITS[id].name })),
    ...DECOR_ORDER.filter((id) => DECOR[id].how.stars === stars).map((id) => ({ kind: 'decor', id, name: DECOR[id].name })),
  ],
}));

export const totalStars = (save) => Object.values(save.stars || {}).reduce((s, n) => s + (n | 0), 0);

// Grant whatever the save now qualifies for (star milestones, mutator clears, the Pasko season).
// Returns the newly unlocked rewards, for a "NEW!" toast.
export function grantUnlocks(save, { pasko = false } = {}) {
  const got = [];
  const stars = totalStars(save);
  const give = (kind, id, name) => {
    const list = kind === 'outfit' ? save.outfits : save.decor;
    if (!list.includes(id)) { list.push(id); got.push({ kind, id, name }); }
  };
  for (const id of OUTFIT_ORDER) {
    const h = OUTFITS[id].how;
    if ((h.stars && stars >= h.stars) || (h.mutator && save.mutatorClears?.[h.mutator]) || (h.pasko && pasko) || h.cost === 0) give('outfit', id, OUTFITS[id].name);
  }
  for (const id of DECOR_ORDER) {
    const h = DECOR[id].how;
    if ((h.stars && stars >= h.stars) || (id === 'parol' && pasko)) give('decor', id, DECOR[id].name);
  }
  return got;
}

export function buyCosmetic(save, kind, id) {
  const def = (kind === 'outfit' ? OUTFITS : DECOR)[id], list = kind === 'outfit' ? save.outfits : save.decor;
  if (!def || list.includes(id)) return 'owned';
  if (def.how.cost === undefined) return 'locked';
  if (save.bank < def.how.cost) return 'poor';
  save.bank -= def.how.cost;
  list.push(id);
  return 'bought';
}

// ---- payouts -------------------------------------------------------------------------
// Campaign: the first clear pays everything; replays pay half the coins plus only newly earned stars,
// so the store empties in the second half of the campaign instead of by grinding level 1.
export function campaignPayout({ coins, stars, prevStars, first, bossBonus = 0, alkansya = 0 }) {
  const newStars = Math.max(0, stars - (prevStars || 0));
  return (first ? coins + stars + bossBonus : Math.ceil(coins / 2) + newStars) + alkansya;
}
// Random House: scales with difficulty and mutators, with diminishing returns for each house cleared today.
// Daily House: full pay on the day's first clear; replays only pay for better stars.
// mult = the mutator multiplier (house.js mutatorMult).
export function housePayout({ coins, stars, diff, housesToday = 0, daily = false, prevStars = 0, mult = 1 }) {
  const base = (coins + stars) * (0.6 + 0.2 * diff) * mult;
  if (daily) return prevStars ? Math.max(0, stars - prevStars) : Math.round(base) + 2;
  const day = Math.max(0.25, 1 - 0.15 * housesToday);
  return Math.max(1, Math.round(base * day));
}

// Select a kid. Siblings join through the story, so one who hasn't yet is 'locked'. Returns 'selected' | 'locked'.
export function pickChar(save, id) {
  if (!owns(save, id)) return 'locked';
  save.char = id;
  return 'selected';
}
