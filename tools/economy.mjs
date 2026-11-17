// Economy check (design overhaul 5.4):   node tools/economy.mjs
// Two players play the campaign once, buying each cat need the moment it opens and they can afford it, then gear:
//   sakto  takes only the quota (SOBRA never), 2 stars, finds the alkansya half the time
//   sobra  empties every stash, 3 stars, finds every alkansya
// Targets: the sakto player can buy every need when it opens (or within a level) and owns 3 of the 5 gear items by
// the end of Chapter 4; the sobra player gets everything sooner, and pays for it in HINALA, not in coins.
import { readFileSync } from 'node:fs';
import { UPGRADES, UPGRADE_ORDER, NEEDS, NEED_ORDER, OUTFITS, DECOR, campaignPayout } from '../src/game/progression.js';
import { BEFORE, AFTER, CHAPTERS } from '../src/data/story.js';

const dir = new URL('../src/data/levels/', import.meta.url);
const levels = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8')).map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
const idOf = (i) => levels[i].id;

// After which level's clear can each need first be bought? (the story beat that opens it, see NEEDS[id].open)
const sceneBefore = (pred) => levels.findIndex((L) => (BEFORE[L.id] || []).some(pred) || pred({ id: L.id }));
const opensAfter = {
  gatas: 0,                                                                  // after the intro: buy after level 1
  sardinas: levels.findIndex((L) => L.id === 'boss1-lola'),                  // its scene plays as that level starts
  kumot: levels.findIndex((L) => L.id === '05-gabi'),
  kahon: levels.findIndex((L) => AFTER[L.id] && L.id === 'ibalik'),
  vet: levels.findIndex((L) => (BEFORE[L.id] || []).some((p) => p.flag === 'nena')),
};
const gearTotal = UPGRADE_ORDER.reduce((s, id) => s + UPGRADES[id].costs[0], 0);
const needTotal = NEED_ORDER.reduce((s, id) => s + NEEDS[id].cost, 0);
const cosmetics = [...Object.values(OUTFITS), ...Object.values(DECOR)].reduce((s, c) => s + (c.how.cost || 0), 0);
const coinsIn = (L) => (L.targets || []).filter((t) => !t.bonus).reduce((s, t) => s + (t.coins ?? 2), 0)
  + (L.course || []).filter((c) => c.t === 'coins').reduce((s, c) => s + (c.n ?? 1), 0); // (HABOL!: the coins in the street)
const prize = (L, stars) => (L.rewards || []).slice(0, stars).reduce((s, r) => s + (r.coins || 0), 0); // mini-game rewards
const ch4End = levels.findIndex((L) => L.id === CHAPTERS[4].from) - 1; // the level before the storm chapter

const players = {
  sakto: (L) => campaignPayout({ coins: L.giveBack ? 0 : L.quota ?? 0, stars: L.epilogue ? 0 : 2, first: true, bossBonus: L.boss?.bonus || 0, alkansya: Math.floor((L.alkansya?.coins || 0) / 2) }) + prize(L, 2),
  sobra: (L) => campaignPayout({ coins: L.giveBack ? 0 : coinsIn(L), stars: L.epilogue ? 0 : 3, first: true, bossBonus: L.boss?.bonus || 0, alkansya: L.alkansya?.coins || 0 }) + prize(L, 3),
};

console.log(`store: cat needs ${needTotal} + gear ${gearTotal} = ${needTotal + gearTotal} coins (cosmetics ${cosmetics} more, optional)`);
console.log(`needs open after level: ${NEED_ORDER.map((id) => `${NEEDS[id].name} ${opensAfter[id] + 1}`).join(', ')}\n`);
for (const [who, pay] of Object.entries(players)) {
  let bank = 0;
  const got = {}, gear = [], late = [];
  const nena = (i) => i >= opensAfter.vet; // Aling Nena's discount from her scene on
  levels.forEach((L, i) => {
    bank += pay(L);
    for (const id of NEED_ORDER) { // the kittens first
      if (got[id] || i < opensAfter[id]) continue;
      const cost = Math.ceil(NEEDS[id].cost * (nena(i) ? 0.75 : 1));
      if (bank >= cost) { bank -= cost; got[id] = i; if (i > opensAfter[id]) late.push(`${NEEDS[id].name} +${i - opensAfter[id]}`); }
    }
    if (NEED_ORDER.every((id) => got[id] !== undefined || i < opensAfter[id])) {
      for (const id of UPGRADE_ORDER) if (!gear.includes(id) && bank >= UPGRADES[id].costs[0]) { bank -= UPGRADES[id].costs[0]; gear.push(id); gear[`at_${id}`] = i; }
    }
  });
  const byCh4 = UPGRADE_ORDER.filter((id) => gear.includes(id) && gear[`at_${id}`] <= ch4End);
  const missed = NEED_ORDER.filter((id) => got[id] === undefined);
  console.log(`${who.toUpperCase()}: needs ${missed.length ? `NEVER bought: ${missed.join(', ')}` : late.length ? `late: ${late.join(', ')}` : 'all bought the moment they open'}`);
  console.log(`  gear by the end of chapter 4 (${idOf(ch4End)}): ${byCh4.length}/5 (${byCh4.join(', ') || 'none'})`);
  console.log(`  gear by the end: ${gear.length}/5, coins left ${bank}\n`);
}
