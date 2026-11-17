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
    name: 'BING', joins: '04-bakuran', look: 'bing', speed: 0.88, alertRate: 0.7, radius: 3, crawl: true,
    skill: { id: 'hide', label: 'TAGO', cd: 10 },
    lines: ['TAGO: HIDE ANYWHERE FOR 3S', 'MALIIT: CRAWLS UNDER TABLES, BEDS.'],
  },
  ramil: {
    name: 'KUYA RAMIL', joins: '05-gabi', look: 'ramil', throwRange: 1.6, runNoise: 1.25, palusot: 1,
    skill: { id: 'shout', label: 'YELL', cd: 8 },
    lines: ['SIGAW: YELL TO LURE AHEAD', 'PALUSOT: TALKS AWAY ONE CLOSE CALL.'],
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
// Each need opens at Aling Nena's when the story reaches it (open), so the hideout and the story move together. Needs
// gate nothing in play. (The vet visit becomes free at the barangay vaccination drive in the Chapter 4 rework; until
// then the fifth need is the medicine, GAMOT. Its id stays 'vet' so saves keep it.)
export const NEED_ORDER = ['gatas', 'sardinas', 'kumot', 'kahon', 'vet'];
export const NEEDS = {
  gatas:    { name: 'GATAS',        desc: 'A BOWL OF MILK FOR MINGMING',     cost: 6,  got: 'MINGMING DRINKS AND DRINKS.',
              open: (s) => !!s.story?.intro, when: 'AFTER THE FIRST NIGHT' },
  sardinas: { name: 'SARDINAS',     desc: 'REAL FOOD. SHE IS SO THIN',       cost: 10, got: 'THE KITTENS OPEN THEIR EYES!',
              open: (s) => !!s.story?.seen?.['boss1-lola'], when: "WHEN LOLA'S MILK RUNS OUT" },
  kumot:    { name: 'KUMOT',        desc: 'A WARM BLANKET FOR COLD NIGHTS',  cost: 12, got: 'THREE KITTENS IN A WARM PILE.',
              open: (s) => !!s.story?.seen?.['05-gabi'], when: 'WHEN THE NIGHTS GET COLD' },
  kahon:    { name: 'BAGONG KAHON', desc: 'A BIGGER BOX. THEY ARE GROWING',  cost: 16, got: 'ROOM TO TUMBLE AND PLAY!',
              open: (s) => !!s.story?.after?.ibalik, when: 'WHEN THEY OUTGROW THE BOX' },
  vet:      { name: 'GAMOT',        desc: 'MEDICINE AND VITAMINS FOR ALL FOUR', cost: 14, got: 'HEALTHY, LOUD AND HUNGRY.',
              open: (s) => !!s.story?.nena, when: "WHEN ALING NENA KNOWS" },
};
export const NENA_DISCOUNT = 0.75;

// SI MINGMING NAMAN (level "cat": true): you are the cat. Quick and quiet, up on the tables, counters, beds and
// sofas (where only someone right beside her notices her), into boxes, but no hands: no doors, no levers, nothing
// to throw. Her trick: TABIG, a swat that knocks a cup off the counter ahead (a noise that pulls people away).
// Not one of the crew (she never shows up in the SINO ANG PUPUNTA? row).
export const MINGMING = {
  name: 'MINGMING', look: 'pusa', speed: 1.3, radius: 3, runNoise: 0.5, crawl: 'cat', cat: true,
  skill: { id: 'tabig', label: 'TABIG', cd: 7 },
  lines: ['TABIG: KNOCK A CUP OFF THE COUNTER', 'UP ON THE TABLES, SHE IS HARD TO SEE.'],
};
export const hasNeed = (save, id) => !!(save.needs && save.needs[id]);
export const needOpen = (save, id) => !!NEEDS[id] && (hasNeed(save, id) || NEEDS[id].open(save));
export const needCost = (save, id) => Math.ceil(NEEDS[id].cost * (save.story?.nena ? NENA_DISCOUNT : 1));
export const catStage = (save) => NEED_ORDER.filter((id) => hasNeed(save, id)).length; // 0 newborn ... 5 thriving
export function buyNeed(save, id) {
  if (!NEEDS[id] || hasNeed(save, id)) return 'owned';
  if (!needOpen(save, id)) return 'later';
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

// ---- sneaking gear: things that each give Jun a new trick (design overhaul 5.4), bought once --------------------
// They replaced six three-level percentage upgrades (OLD_UPGRADES: their coins are refunded by the v4 migration).
export const UPGRADE_ORDER = ['medyas', 'panyo', 'holen', 'baon', 'bulsa'];
export const UPGRADES = {
  medyas: { name: 'MEDYAS', desc: 'SOCKS: CREAKY BOARDS MAKE NO SOUND',      costs: [50] },
  panyo:  { name: 'PANYO',  desc: 'ONCE A LEVEL: MUFFLES A CLASP OR ZIPPER', costs: [40] },
  holen:  { name: 'HOLEN',  desc: '2 MARBLES A LEVEL: THEY ROLL AND LURE',   costs: [55] },
  baon:   { name: 'BAON',   desc: 'START WITH A TSINELAS AND A PANDESAL',    costs: [45] },
  bulsa:  { name: 'BULSA',  desc: 'A BIGGER POCKET: CARRY ONE MORE THING',   costs: [35] },
};
export const OLD_UPGRADES = { quiet: [6, 12, 20], hands: [6, 12, 20], pockets: [5, 10, 18], shadow: [8, 14, 24], pasensya: [5, 10, 16], stash: [6, 12, 20] };
// Coins spent on the old upgrades (for the refund).
export const oldUpgradeSpend = (ups = {}) => Object.entries(OLD_UPGRADES).reduce((s, [id, c]) => s + c.slice(0, Math.max(0, Math.min(c.length, ups[id] | 0))).reduce((a, b) => a + b, 0), 0);

export const BASE_RUN_NOISE = 48;
export const BASE_ITEM_CAP = 3;
// No stack of upgrades and kid traits may remove the tension: these are hard floors.
export const FLOORS = { runNoise: 24, stealTime: 0.5, alertRate: 0.55 };

const lvl = (ups, id) => (ups && ups[id]) | 0;

export function computeMods(charId = 'jun', ups = {}) {
  const c = CHARACTERS[charId] || (charId === 'mingming' ? MINGMING : CHARACTERS.jun);
  return {
    charId: CHARACTERS[charId] || charId === 'mingming' ? charId : 'jun',
    look: c.look,
    skill: c.skill,
    speed: c.speed ?? 1,
    radius: c.radius ?? 4,
    // kid traits only (gear no longer scales numbers; the floors still hold for every kid)
    runNoise: Math.max(FLOORS.runNoise, BASE_RUN_NOISE * (c.runNoise ?? 1)),
    stealTime: Math.max(FLOORS.stealTime, c.stealTime ?? 1),
    alertRate: Math.max(FLOORS.alertRate, c.alertRate ?? 1),
    itemCap: BASE_ITEM_CAP + lvl(ups, 'bulsa'),
    // what you start a level holding: BAON (a tsinelas and a pandesal), HOLEN (two marbles)
    startItems: [...(lvl(ups, 'baon') ? ['tsinelas', 'pandesal'] : []), ...(lvl(ups, 'holen') ? ['holen', 'holen'] : [])],
    patienceBonus: 0,
    medyas: !!lvl(ups, 'medyas'), // creaky boards stay quiet
    panyo: lvl(ups, 'panyo') ? 1 : 0, // stash openings it can muffle per level
    throwRange: c.throwRange ?? 1,
    crawl: c.crawl || false, // Bing: under tables and beds (MALIIT); 'cat': Mingming up on the furniture
    cat: !!c.cat,
    palusot: c.palusot | 0, // Ramil: close calls he can talk away per level (PALUSOT)
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

// ---- cosmetics: they never touch balance -------------------------------------------
// Outfits are palette swaps of the kid's top and bottom (see render/sprites.js).
// how: cost (coins) | stars (milestone) | mutator (clear a level-3+ Random House with it) | pasko (free in season)
// reward: given by a mini-game mission (the level's "rewards"), never bought
export const OUTFIT_ORDER = ['basic', 'pula', 'lila', 'jersey', 'pambahay', 'barong', 'glow', 'pasko', 'kalye', 'tigre', 'ginto'];
export const OUTFITS = {
  basic:    { name: 'PAMBAHAY NI NANAY', how: { cost: 0 } },
  pula:     { name: 'PULANG DAMIT', how: { cost: 12 }, top: ['#d94a4a', '#a83a3a'], bottom: ['#3a3550', '#2a2640'] },
  lila:     { name: 'LILA', how: { cost: 15 }, top: ['#8a5fb5', '#6b4a8c'], bottom: ['#ece6dc', '#bdb6ab'] },
  jersey:   { name: 'BASKETBALL JERSEY', how: { stars: 10 }, top: ['#2f5fbf', '#24488f'], bottom: ['#d94a4a', '#a83a3a'] },
  pambahay: { name: 'SANDO AT SHORTS', how: { mutator: 'tsinelas' }, top: ['#f6f1e7', '#cfc7b8'], bottom: ['#46a0e0', '#3580b8'] },
  barong:   { name: 'MINI BARONG', how: { mutator: 'bisita' }, top: ['#f3ead2', '#d9cba6'], bottom: ['#5a5468', '#46415a'] },
  glow:     { name: 'GLOW SHIRT', how: { mutator: 'brownout' }, top: ['#7fd7ff', '#4f8fff'], bottom: ['#2a3560', '#1d2448'] },
  pasko:    { name: 'PAMASKONG DAMIT', how: { pasko: true }, top: ['#d94a4a', '#a83a3a'], bottom: ['#2fa55b', '#227a43'] },
  kalye:    { name: 'PANG-KALYE', how: { reward: 'preso' }, top: ['#f6f1e7', '#cfc7b8'], bottom: ['#d94a4a', '#a83a3a'] },
  tigre:    { name: 'TIGRE SHIRT', how: { reward: 'habol' }, top: ['#ff9a3c', '#d9762a'], bottom: ['#6e4424', '#4a2c1c'] },
  ginto:    { name: 'GINTONG KUPIT', how: { stars: 57 }, top: ['#ffd84d', '#c9962b'], bottom: ['#ffd84d', '#c9962b'] },
};
// Title-screen skyline decorations.
export const DECOR_ORDER = ['pusa', 'alitaptap', 'parol', 'banderitas', 'kuting', 'jeep', 'paputok'];
export const DECOR = {
  pusa:       { name: 'PUSA SA BUBONG', how: { cost: 6 } },
  alitaptap:  { name: 'ALITAPTAP', how: { cost: 8 } },
  parol:      { name: 'PAROL', how: { cost: 10 } },
  banderitas: { name: 'BANDERITAS', how: { cost: 12 } },
  kuting:     { name: 'MGA KUTING', how: { reward: 'mingming' } }, // three kittens tumbling along the fence
  jeep:       { name: 'JEEPNEY', how: { stars: 20 } },
  paputok:    { name: 'PAPUTOK', how: { stars: 30 } },
};
export const MAX_STARS = 57; // 19 levels with stars (the epilogue has none)
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

// ---- mini-game rewards ----------------------------------------------------------------
// A level can pay each of its three stars with something ("rewards": [r0, r1, r2], same order as its missions):
//   { "coins": 10 }   coins into the bank
//   { "photo": "preso" }  a picture for the album (scenes/album.js)
//   { "outfit": "kalye" } / { "decor": "kuting" }   a look (OUTFITS / DECOR with how.reward)
// Each is given once, the first time its star is earned. fresh = bit mask of the stars earned for the first time.
// Returns what was given, for the clear screen: [{ kind, id, name, n }].
export function grantRewards(save, L, fresh) {
  const out = [];
  (L.rewards || []).forEach((rw, i) => {
    if (!rw || !((fresh >> i) & 1)) return;
    if (rw.coins) { save.bank += rw.coins; out.push({ kind: 'coins', n: rw.coins, name: `+${rw.coins} COINS` }); }
    if (rw.photo && !(save.album || []).includes(rw.photo)) { save.album = [...(save.album || []), rw.photo]; out.push({ kind: 'photo', id: rw.photo, name: rw.photoName || 'A NEW PHOTO' }); }
    if (rw.outfit && OUTFITS[rw.outfit] && !save.outfits.includes(rw.outfit)) { save.outfits.push(rw.outfit); out.push({ kind: 'outfit', id: rw.outfit, name: OUTFITS[rw.outfit].name }); }
    if (rw.decor && DECOR[rw.decor] && !save.decor.includes(rw.decor)) { save.decor.push(rw.decor); out.push({ kind: 'decor', id: rw.decor, name: DECOR[rw.decor].name }); }
  });
  return out;
}

// Select a kid. Siblings join through the story, so one who hasn't yet is 'locked'. Returns 'selected' | 'locked'.
export function pickChar(save, id) {
  if (!owns(save, id)) return 'locked';
  save.char = id;
  return 'selected';
}
