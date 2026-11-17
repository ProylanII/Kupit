// What every mini-game simulation shares (TUMBANG PRESO, HABOL!): a clock, a status, an event list for the scene,
// the level's three missions, and the same small surface main.js reads from a stealth World (time, coins, lives,
// result, the dev helpers). DOM-free, so tests drive the games headlessly.
import { MISSIONS, missionIds } from './missions.js';

export class MiniSim {
  constructor(level, { lives = 3 } = {}) {
    this.level = level;
    this.time = 0;
    this.status = 'play';  // play | caught | clear
    this.reason = null;
    this.result = null;
    this.events = [];
    this.coins = 0;
    this.lives = lives;
    this.catches = 0;
    this.adults = [];      // (main.js picks the chase music from adults; a mini-game picks its own)
    this.missionIds = missionIds(level);
    this.missionLost = this.missionIds.map(() => false);
    this.god = false;
  }

  get livesLeft() { return this.lives - this.catches; }
  get open() { return false; }
  get player() { return { tx: 0, ty: 0 }; }
  emit(e) { this.events.push(e); if (this.events.length > 512) this.events.splice(0, 256); }

  missionState() { return this.missionIds.map((id, i) => ({ id, ok: !this.missionLost[i] && MISSIONS[id].ok(this), lost: this.missionLost[i] })); }
  // a strict mission that can no longer be done this run: say so once (the scene shows "STAR LOST")
  checkMissions() {
    for (let i = 1; i < this.missionIds.length; i++) {
      const m = MISSIONS[this.missionIds[i]];
      if (m.strict && !this.missionLost[i] && !m.ok(this)) { this.missionLost[i] = true; this.emit({ type: 'missionLost', id: this.missionIds[i], i }); }
    }
  }

  finish(extra = {}) {
    if (this.status !== 'play') return;
    this.status = 'clear';
    const missions = this.missionIds.map((id, i) => !this.missionLost[i] && !!MISSIONS[id].ok(this));
    this.result = { coins: this.coins, time: this.time, stars: missions.filter(Boolean).length, missions, catches: this.catches,
      spotted: 0, bonus: 0, sobra: 0, emptied: 0, takenBy: {}, spills: 0, tattles: 0, palusot: 0, evidence: 0, tanod: 0, photo: null, ...extra };
    this.emit({ type: 'clear' });
  }
  fail(reason) {
    if (this.status !== 'play') return;
    this.status = 'caught'; this.reason = reason;
    this.emit({ type: 'caught', final: true });
  }

  // dev menu / hotkeys
  devFillQuota() {}
  devGoToExit() {}
  devNextPhase() { return false; }
  devClear() { this.finish(); }
}
