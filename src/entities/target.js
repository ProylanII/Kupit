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
  // story stashes. verb: what the action button says instead of TAKE.
  gatas:    { name: 'GATAS',  hold: 1.0, verb: 'TAKE',  tip: 'MILK! WALK IT OUT SLOWLY. RUNNING SPILLS IT' },
  kuting:   { name: 'KUTING', hold: 1.0, verb: 'SAVE',  tick: { every: 0.9, r: 30 }, end: { r: 0, say: 'MEOW!' }, tip: 'A KITTEN! IT MEOWS AS YOU PICK IT UP' },
  ibalik:   { name: 'PITAKA', hold: 1.0, verb: 'RETURN', end: { r: 36, say: 'KLIK!' }, tip: 'PUT THE COINS BACK. QUIETLY' },
  // BAGYO: Mingming, scared by the storm. calm = she only comes while it is quiet (thunder makes her flinch away)
  mingming: { name: 'MINGMING', hold: 1.5, verb: 'CALL', calm: true, tick: { every: 1.2, r: 22 }, end: { r: 0, say: 'MRRROW...' }, tip: 'MINGMING IS SCARED OF THE THUNDER: CALL HER IN THE QUIET' },
  isda:     { name: 'PRITONG ISDA', hold: 1.0, verb: 'TAKE', tip: 'THE FISH! ASO WILL SMELL IT. PANDESAL KEEPS HIM BUSY' }, // TATAY's boss
  bilin:    { name: 'BILIN',  hold: 0.8, verb: 'TAKE',  tip: 'AN ERRAND: JUST PICK IT UP. BUT NOT WHERE MAMA SEES' }, // PALENGKE: free things, an errand
  regalo:   { name: 'HINGI',  hold: 0.6, verb: 'ASK',  tip: 'NO SNEAKING. JUST ASK!' },
  alkansya: { name: 'ALKANSYA', hold: 1.0, tick: { every: 0.6, r: 30 }, end: { r: 50, say: 'KLING!' }, tip: 'SECRET ALKANSYA! BONUS COINS' },
};

// Whose stash it is, when the level does not say (the ledger, IBALIK and the case file read it).
export const OWNERS = { purse: 'mama', bayong: 'lola', wallet: 'tita', piggy: 'bahay', candy: 'nena' };

// SOBRA: ordinary stashes give their coins one at a time. Opening takes longest (the first 45% of the time), then
// the rest come out evenly, so emptying a stash takes exactly as long as it used to.
export const FIRST_COIN = 0.45;

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
    this.scent = !!def.scent;     // TATAY's fish: it leaves the trail the dog follows
    this.noSpill = !!def.noSpill; // (running does not spill it)
    this.then = def.then || null; // a phase-like change when it is taken ("ASO SMELLS THE FISH!")
    this.carry = !!def.carry; // carried out by hand: running (or being knocked over) spills it and it goes back
    this.must = !!def.must;   // the exit stays shut until this one is taken, whatever the coin count
    this.from = def.from;     // HINGI: index of the adult who gives it, and what they say
    this.say = def.say;
    this.label = def.label;
    this.verb = def.verb;     // what the action button says, if not the stash's own word (the cat: KAGAT)   // written on it (Ninang's envelope "PARA KAY JUN"): Jun reads it when he takes it
    this.owner = def.owner || OWNERS[this.kind] || null;
    // coin by coin (SOBRA)? Not for the alkansya, things you carry, or story stashes (milk, kittens, IBALIK, HINGI)
    this.perCoin = !this.bonus && !this.carry && !this.profile.verb && this.coins > 1;
    this.visit = 0;           // coins taken in this visit: each one after the first clinks louder
    this.progress = 0;
    this.started = false; // the start noise (zipper) already played for this attempt
    this.tickT = 0;
    this.done = false;
  }

  get taken() { return this.full - this.coins; }
  // Seconds (before skill and upgrade modifiers) for the next coin, when k coins are already out of this stash.
  coinTime(k = this.taken) {
    if (!this.perCoin) return this.time;
    return this.time * (k === 0 ? FIRST_COIN : (1 - FIRST_COIN) / (this.full - 1));
  }
}
