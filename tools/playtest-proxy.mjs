// Automated playtest PROXY: not a human playtest. It cannot tell whether a level is fun, fair or readable; it
// measures what a bot can: route length, whether stealth is needed at all, whether running beats sneaking, and how
// much slack the timers leave. Re-run after every design phase:  node tools/playtest-proxy.mjs
//   expert  bot that cannot be caught, sneaking: the shortest possible clear (humans are slower)
//   blind   bot that ignores every adult, sneaking, catchable (3 chances): CLEAR with 0 close calls = the level
//           never demands stealth; CLEAR with some = it can be brute-forced by spending chances
//   run     the blind bot running everywhere: CLEAR while blind fails = noise is not worth avoiding
//   escape  boss final phase: seconds the expert needed / seconds the timer gives
import { readFileSync } from 'node:fs';
import { World } from '../src/game/world.js';
import { playBot } from '../tests/bot.mjs';

let w = null, escAt = null;
const update = World.prototype.update;
World.prototype.update = function (...a) { // watch the bot's world without changing it
  if (w !== this) { w = this; escAt = null; }
  const r = update.apply(this, a);
  if (this.escapeT > 0 && escAt === null) escAt = { t: this.time, len: this.escapeT };
  return r;
};
const dir = new URL('../src/data/levels/', import.meta.url);
const only = process.argv.slice(2); // optional level ids: node tools/playtest-proxy.mjs 02-kusina bagyo
const levels = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8')).map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')))
  .filter((L) => !L.mode) // (the mini-games have bots of their own: tests/minigames.test.mjs)
  .filter((L) => !only.length || only.includes(L.id));
const play = (L, o) => { const r = playBot(L, { maxT: 600, ...o }); return { ...r, catches: w.catches, spotted: w.spotted, esc: escAt && { used: w.time - escAt.t, len: escAt.len } }; };
const out = (r) => (r.ok ? `CLEAR ${r.time}s, ${r.catches} close` : `fail (${r.reason || r.why})`);

const rows = [];
for (const L of levels) {
  if (L.hingi) continue;
  const expert = play(L, { god: true }), blind = play(L, { god: false }), run = play(L, { god: false, run: true });
  rows.push({
    level: L.id, expert: expert.time, par: L.par, 'par/expert': +(L.par / expert.time).toFixed(1),
    dinner: L.patience ? +(L.patience / expert.time).toFixed(1) : '',
    escape: expert.esc ? `${expert.esc.used.toFixed(1)}/${Math.round(expert.esc.len)}s` : '',
    blind: out(blind), 'blind seen': blind.spotted, run: out(run),
    // 0 close calls: the level never forced stealth. Some: it can be brute-forced by spending chances.
    flag: blind.ok ? (blind.catches ? `SURVIVABLE BLIND (${blind.catches} close)` : 'NO STEALTH NEEDED') : run.ok ? 'RUNNING BEATS SNEAKING' : '',
  });
}
console.table(rows);
