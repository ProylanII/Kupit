import { TILE } from '../world/tilemap.js';

// Every stash steals differently, so each coin is a small decision:
//   hold  multiplies the level's hold time      start/tick/end: noises made while you rummage
//   (noises are not lures: adults in earshot turn to look, sleepers nearby may wake)
export const TARGET_KINDS = {
  purse:    { name: 'PURSE',  hold: 0.85, end: { r: 44, say: 'KLIK!' },                 tip: 'PURSE: QUICK, BUT THE CLASP CLICKS' },
  bayong:   { name: 'BAYONG', hold: 1.35, tick: { every: 0.7, r: 26 },                 tip: 'BAYONG: SLOW AND RUSTLY. BEST WHILE LOLA NAPS' },
  wallet:   { name: 'WALLET', hold: 1.0,  start: { r: 60, say: 'ZZZIP!' },             tip: 'WALLET: LOUD ZIPPER FIRST. WAIT FOR PHONE TIME' },
  piggy:    { name: 'PIGGY',  hold: 1.1,  tick: { every: 0.5, r: 34 },                 tip: 'PIGGY BANK: EVERY SHAKE JINGLES' },
  candy:    { name: 'GARAPON', hold: 1.0, tick: { every: 0.8, r: 40 },                 tip: 'GARAPON: THE BIG PRIZE. LID RATTLES' },
  // story stashes. verb: what the action button says instead of KUPIT.
  gatas:    { name: 'GATAS',  hold: 1.0, verb: 'KUNIN',  tip: 'MILK! WALK IT OUT SLOWLY. RUNNING SPILLS IT' },
  kuting:   { name: 'KUTING', hold: 1.0, verb: 'SAGIP',  tick: { every: 0.9, r: 30 }, end: { r: 0, say: 'MEOW!' }, tip: 'A KITTEN! IT MEOWS AS YOU PICK IT UP' },
  ibalik:   { name: 'PITAKA', hold: 1.0, verb: 'IBALIK', end: { r: 36, say: 'KLIK!' }, tip: 'PUT THE COINS BACK. QUIETLY' },
  regalo:   { name: 'HINGI',  hold: 0.6, verb: 'HINGI',  tip: 'NO SNEAKING. JUST ASK!' },
  alkansya: { name: 'ALKANSYA', hold: 1.0, tick: { every: 0.6, r: 30 }, end: { r: 50, say: 'KLING!' }, tip: 'SECRET ALKANSYA! BONUS COINS' },
};

// Something to kupit from: purse, wallet, bayong, piggy bank...
export class Target {
  constructor(def) {
    this.kind = def.kind || 'purse';
    this.x = def.at[0] * TILE + TILE / 2;
    this.y = def.at[1] * TILE + TILE / 2;
    this.coins = def.coins ?? 2;
    this.full = this.coins;
    this.profile = TARGET_KINDS[this.kind] || TARGET_KINDS.purse;
    this.time = (def.time ?? 1.6) * this.profile.hold; // seconds of holding still to steal
    this.bonus = !!def.bonus; // the alkansya: optional, does not count toward the quota
    this.carry = !!def.carry; // carried out by hand: running (or being knocked over) spills it and it goes back
    this.must = !!def.must;   // the exit stays shut until this one is taken, whatever the coin count
    this.from = def.from;     // HINGI: index of the adult who gives it, and what they say
    this.say = def.say;
    this.progress = 0;
    this.started = false; // the start noise (zipper) already played for this attempt
    this.tickT = 0;
    this.done = false;
  }
}
