// The tutorial coach for a level marked "tutorial": true (L1 SALA). DOM-free: tests/tutorial.test.mjs drives it.
//
// A list of steps, one at a time. Each step says what to do (two short lines, touch or keyboard wording), points at
// the thing to use (focus: a spot in the room that play.js marks with an arrow) and at the button to press (btn: a
// ring around it), and knows when it is done. Steps already done are skipped, so a player who does things in their
// own order is never left reading an old instruction. Reactive lines (seen, hiding, the staged beat, a close call)
// take over while they apply, then the current step comes back.
import { TILE } from '../world/tilemap.js';

const REACH = 18;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const center = (tx, ty) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, tx, ty });

// What the coach needs to find in the level, looked up once.
function landmarks(w) {
  const sp = w.player;
  let door = null, bd = Infinity;
  for (let ty = 0; ty < w.map.h; ty++) for (let tx = 0; tx < w.map.w; tx++) {
    if (!'Dd'.includes(w.map.ch(tx, ty))) continue;
    const d = Math.hypot(tx * TILE + 8 - sp.x, ty * TILE + 8 - sp.y);
    if (d < bd) { bd = d; door = center(tx, ty); }
  }
  const lever = w.switches[0] || null;
  const gate = lever?.gates?.[0] ? center(lever.gates[0][0], lever.gates[0][1]) : null;
  const slipper = w.items.find((i) => i.kind === 'tsinelas');
  const t = w.level.coach?.throwAt; // where a slipper sends Mama away from the exit ("coach": { "throwAt": [x, y] })
  return {
    door, lever, gate,
    throwAt: t ? center(t[0], t[1]) : null,
    slipper: slipper ? { x: slipper.x, y: slipper.y } : null,
    stash: w.targets.find((t) => !t.bonus) || null,
    mama: w.adults[0] || null,
  };
}

const keyOr = (k, touch, keys) => (k.touch ? touch : keys);

// The SALA lesson plan: move, door, pick up, lever + gate, cones, kupit, (tago), sapat na, throw, exit.
export const SALA_STEPS = [
  {
    id: 'move',
    say: (k) => [keyOr(k, 'DRAG ANYWHERE ON THE SCREEN TO WALK', 'WASD OR THE ARROW KEYS TO WALK'), 'WALK UP TO THE DOOR'],
    focus: (w, m) => m.door,
    btn: () => 'move',
    done: (w, m) => !m.door || dist(w.player, m.door) < 24 || w.map.ch(m.door.tx, m.door.ty) === 'd',
  },
  {
    id: 'door',
    say: (k) => [keyOr(k, 'TAP THE BIG BUTTON TO OPEN THE DOOR', 'PRESS E (ACT) TO OPEN THE DOOR'), 'DOORS ALSO HIDE YOU FROM VIEW'],
    focus: (w, m) => m.door,
    btn: () => 'act',
    done: (w, m) => !m.door || w.map.ch(m.door.tx, m.door.ty) === 'd' || w.player.ty < m.door.ty,
  },
  {
    id: 'pickup',
    say: () => ['A TSINELAS! WALK OVER IT TO PICK IT UP', 'YOU CAN THROW IT LATER'],
    focus: (w, m) => m.slipper,
    done: (w, m) => !m.slipper || w.player.items.length > 0 || w.stats.throws > 0 || !w.items.some((i) => i.kind === 'tsinelas')
      || m.lever?.on || (m.gate && w.player.ty < m.gate.ty), // walked past it: the throw lesson is skipped later
  },
  {
    id: 'lever',
    say: (k) => ['THE GATE TO THE SALA IS SHUT', keyOr(k, 'STAND AT THE LEVER AND TAP THE BIG BUTTON', 'STAND AT THE LEVER AND PRESS E')],
    focus: (w, m) => m.lever,
    btn: (w, m) => (m.lever && dist(w.player, m.lever) <= REACH + 6 ? 'act' : null),
    done: (w, m) => !m.lever || m.lever.on || (m.gate && w.map.ch(m.gate.tx, m.gate.ty) === 'g') || (m.gate && w.player.ty < m.gate.ty),
  },
  {
    id: 'cone',
    say: (k) => ['THE YELLOW CONE IS WHAT MAMA SEES. STAY OUT OF IT', keyOr(k, 'SNEAK BEHIND HER TO THE PURSE. DRAG GENTLY', 'SNEAK BEHIND HER TO THE PURSE. NO SHIFT')],
    focus: (w, m) => m.stash,
    done: (w, m) => !m.stash || w.coins > 0 || (w.prompt?.kind === 'steal' && w.prompt.obj === m.stash),
  },
  {
    id: 'kupit',
    say: (k) => [keyOr(k, 'HOLD THE BIG BUTTON TO TAKE COINS', 'HOLD E TO TAKE COINS'), 'KEEP HOLDING... A COIN COMES OUT'],
    focus: (w, m) => m.stash,
    btn: (w, m) => (w.prompt?.kind === 'steal' ? 'act' : null),
    done: (w) => w.coins >= 1,
  },
  {
    id: 'more',
    say: (k, w) => [`GOOD! ${Math.max(0, w.level.quota - w.coins)} MORE. KEEP HOLDING TAKE`, 'AT THE AD BREAK SHE LOOKS THIS WAY: BACK OFF'],
    focus: (w, m) => m.stash,
    btn: (w) => (w.prompt?.kind === 'steal' ? 'act' : null),
    done: (w) => w.coins >= w.level.quota,
  },
  {
    id: 'sapat',
    say: () => ['SAPAT NA! THAT IS ENOUGH', 'LEAVE THE LAST COIN. TAKE TOO MUCH AND THEY NOTICE'],
    focus: () => null,
    done: (w, m, t) => t > 4 || (m.stash && dist(w.player, m.stash) > 48),
  },
  {
    id: 'throw',
    say: (k) => ['MAMA CAN SEE THE EXIT. THROW THE TSINELAS', keyOr(k, 'HOLD THE BLUE BUTTON, AIM AT THE MARK, LET GO', 'HOLD Q, AIM AT THE MARK, LET GO')],
    focus: (w, m) => m.throwAt,
    aim: true, // the mark turns green when the throw would land on it
    btn: () => 'throw',
    done: (w) => w.stats.throws > 0 || !w.player.items.length,
  },
  {
    id: 'exit',
    say: (k, w, m) => (lookingAway(m.mama)
      ? ['SHE IS LOOKING AWAY. NOW!', 'WALK OUT THE GREEN EXIT DOOR']
      : ['WAIT TILL SHE LOOKS AWAY', 'THEN WALK OUT THE GREEN EXIT DOOR']),
    focus: (w) => w.exit,
    done: () => false,
  },
];

// Mama is off the sofa (gone to look at a noise) or in her ad break (facing the bag, not the TV).
function lookingAway(a) {
  if (!a) return true;
  if (a.state !== 'patrol') return true;
  return !a.busy; // the ad break: no routine, turned toward the bag
}

export class Coach {
  constructor(world, steps = SALA_STEPS) {
    this.w = world;
    this.steps = steps;
    this.m = landmarks(world);
    this.i = 0;
    this.t = 0;      // seconds on this step
    this.okT = 0;    // a step was just done: the panel flashes green
    this.skip();
  }

  get step() { return this.steps[this.i] || null; }
  get total() { return this.steps.length; }

  skip() { while (this.step && this.step.done(this.w, this.m, this.t)) { this.i++; this.t = 0; } }

  // Returns true when a step was finished this frame (for a sound).
  update(dt) {
    const s = this.step;
    if (!s) return false;
    this.t += dt;
    this.okT = Math.max(0, this.okT - dt);
    if (!s.done(this.w, this.m, this.t)) return false;
    this.i++; this.t = 0; this.okT = 0.6;
    this.skip();
    return true;
  }

  // What to show now: { lines: [a, b], col, focus: {x,y} | null, btn: 'act'|'throw'|'move'|null, reactive }.
  // k = { touch } picks the wording.
  view(k = { touch: false }) {
    const w = this.w, p = w.player, m = this.m, mama = m.mama;
    if (w.scold) return { lines: ['MUNTIK NA! SHE CAUGHT YOU', 'YOU DROPPED SOME COINS. TRY AGAIN, SLOWER'], col: 'orange', focus: null, btn: null, reactive: true };
    if (p.hidden) {
      const away = mama && (mama.staged || dist(mama, mama.home) > 20);
      return { lines: away ? ['SAFE! STAY HIDDEN', 'WAIT TILL SHE GOES BACK TO THE SOFA'] : ['SAFE! SHE IS BACK ON THE SOFA', keyOr(k, 'DRAG TO COME OUT AGAIN', 'MOVE TO COME OUT AGAIN')], col: 'green', focus: null, btn: null, reactive: true };
    }
    if ((mama && mama.staged) || (w.stagedT > 0 && !w.stagedDone)) {
      const box = nearestHide(w);
      return { lines: ['HIDE! SHE HEARD SOMETHING', keyOr(k, 'GO TO A HIDING BOX AND TAP THE BIG BUTTON', 'GO TO A HIDING BOX AND PRESS E')], col: 'orange', focus: box, btn: w.prompt?.kind === 'hide' ? 'act' : null, reactive: true };
    }
    if (w.adults.some((a) => a.awake && a.alert > 0.3)) return { lines: ['SHE SEES YOU!', 'BACK OFF, OUT OF THE YELLOW CONE'], col: 'red', focus: null, btn: null, reactive: true };
    const s = this.step;
    if (!s) return null;
    return { lines: s.say(k, w, m), col: 'white', focus: s.focus(w, m), btn: s.btn ? s.btn(w, m) : null, aim: !!s.aim, reactive: false };
  }
}

function nearestHide(w) {
  let best = null, bd = Infinity;
  for (const h of w.hides) { const d = dist(h, w.player); if (d < bd) { bd = d; best = h; } }
  return best;
}

// One-time tips the tutorial teaches itself (play.js marks them seen instead of showing them twice).
export const COACHED_TIPS = new Set(['hide', 'throw', 'door', 'switch', 'kind:purse', 'sapat', 'caught']);
