// Economy check: how fast does the campaign pay for the store?   node tools/economy.mjs
// Prints income per level for a "careful" player (every coin, 3 stars, finds the alkansya) and a "typical" one
// (just the quota, 2 stars, no alkansya), against what the store sells. Goal: the store can only be emptied in the
// second half of the campaign, never early.
import { readFileSync } from 'node:fs';
import { UPGRADES, CHARACTERS, OUTFITS, DECOR, campaignPayout } from '../src/game/progression.js';

const dir = new URL('../src/data/levels/', import.meta.url);
const levels = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8')).map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));

const upgrades = Object.values(UPGRADES).reduce((s, u) => s + u.costs.reduce((a, b) => a + b, 0), 0);
const kids = Object.values(CHARACTERS).reduce((s, c) => s + c.cost, 0);
const cosmetics = [...Object.values(OUTFITS), ...Object.values(DECOR)].reduce((s, c) => s + (c.how.cost || 0), 0);
const store = upgrades + kids;

const players = {
  careful: (L) => campaignPayout({ coins: L.targets.reduce((s, t) => s + t.coins, 0), stars: 3, first: true, bossBonus: L.boss?.bonus || 0, alkansya: L.alkansya?.coins || 0 }),
  typical: (L) => campaignPayout({ coins: L.quota, stars: 2, first: true, bossBonus: L.boss?.bonus || 0 }),
};

console.log(`store: upgrades ${upgrades} + kids ${kids} = ${store} coins (cosmetics ${cosmetics} more, optional)\n`);
console.log('#  level                  careful  total |  typical  total');
const tot = { careful: 0, typical: 0 }, emptied = {};
levels.forEach((L, i) => {
  const row = {};
  for (const [k, f] of Object.entries(players)) {
    row[k] = f(L); tot[k] += row[k];
    if (!emptied[k] && tot[k] >= store) emptied[k] = i + 1;
  }
  console.log(`${String(i + 1).padStart(2)} ${L.id.padEnd(22)} ${String(row.careful).padStart(7)} ${String(tot.careful).padStart(6)} | ${String(row.typical).padStart(8)} ${String(tot.typical).padStart(6)}`);
});
const half = Math.ceil(levels.length / 2);
for (const k of Object.keys(players)) {
  const at = emptied[k];
  console.log(`\n${k}: ${at ? `can empty the store after level ${at}/${levels.length}` : `ends the campaign ${store - tot[k]} short (Random House / replays make up the rest)`}${at && at <= half ? '  <-- TOO EARLY' : ''}`);
}
