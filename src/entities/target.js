import { TILE } from '../world/tilemap.js';

// Something to kupit from: purse, wallet, bayong, piggy bank...
export class Target {
  constructor(def) {
    this.kind = def.kind || 'purse';
    this.x = def.at[0] * TILE + TILE / 2;
    this.y = def.at[1] * TILE + TILE / 2;
    this.coins = def.coins ?? 2;
    this.time = def.time ?? 1.6; // seconds of holding still to steal
    this.progress = 0;
    this.done = false;
  }
}
