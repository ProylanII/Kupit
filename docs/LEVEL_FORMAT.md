# Level format

One JSON file per level in `src/data/levels/`, listed in order in `index.json`.
Coordinates are tile `[x, y]` (0,0 = top-left). Maps can be any size (all rows the same width). A 15×22 map fits the screen;
anything bigger scrolls with a camera that follows the player, and an edge marker points at the next objective.
`npm test` validates every level (`src/game/validate.js`): widths, placement, adult routes (A*), player solvability with keys/gates,
and that standing still at the spawn for 4 s is safe. The same validator checks every generated Random House.

## Tiles

| Char | Meaning | Solid | Blocks sight |
|---|---|---|---|
| `#` | wall | yes | yes |
| `.` | wood floor | | |
| `,` | kitchen tile floor | | |
| `;` | grass (yard) | | |
| `R` | rug | | |
| `T S B P C F` | table, sofa, bed, plant, counter, fridge | yes | no |
| `D` | door (closed; player/adults open it) | yes | yes |
| `G` | gate (closed; opened by a switch) | yes | no (bars) |

## Fields

```jsonc
{
  "id": "05-gabi", "name": "GABI",
  "tutorial": true,            // level 1 only: step-by-step coaching line, skill tip held back
  "hint": "SHORT TIP",         // shown for the first 8s (max 58 chars, checked)
  "night": true,               // dark tint
  "tiles": ["###...", ...],
  "spawn": [5, 1], "exit": [12, 20],
  "quota": 6,                  // coins needed to unlock the exit
  "par": 120,                  // seconds for the speed star
  "patience": 160,             // optional: "KAIN NA!" timer, caught when it runs out
  "targets": [{ "kind": "purse|bayong|wallet|piggy|candy", "at": [x,y], "coins": 3, "time": 1.6 }], // time 0.5..4
  "alkansya": { "at": [x,y], "coins": 5 }, // optional secret bonus stash (tools/place-alkansya.mjs suggests a spot)
  "items":   [{ "kind": "tsinelas|pandesal|key", "at": [x,y], "color": "red|blue|green|gold" }],
  "locks":   [{ "at": [x,y], "key": "blue" }],          // on a D tile
  "switches":[{ "at": [x,y], "gates": [[x,y]], "time": 6 }], // time = auto-close seconds (optional)
  "devices": [{ "kind": "tv|radio", "at": [x,y], "dur": 9 }], // lures adults while on
  "hide":    [{ "kind": "box|curtain|basket", "at": [x,y] }],
  "traps":   [{ "kind": "creak|lego", "at": [x,y] }],
  "adults": [
    { "type": "mama", "route": [[x,y], [x,y, waitSec, faceRadians], ...] },
    { "type": "lola", "at": [x,y], "face": 1.57, "sweep": 0.6, "phase": 3, "cycle": { "on": 9, "off": 9 } },
    { "type": "aso", "route": [...], "cycle": { "on": 9, "off": 6 }, "sleepy": true }
  ]
}
```

## Stashes (targets)

Each kind steals differently (`TARGET_KINDS` in `src/entities/target.js`). `time` is multiplied by the kind's hold factor.
Stash noises are not lures: adults in earshot turn to look, and sleepers close by may wake.

| Kind | Hold | Noise |
|---|---|---|
| `purse` | quick (x0.85) | the clasp clicks when it opens (at the end) |
| `bayong` | slow (x1.35) | a soft rustle every 0.7 s, so it's safest while Lola naps |
| `wallet` | normal | a loud zipper when you start, so time it against Tita's phone breaks |
| `piggy` | x1.1 | a jingle with every shake |
| `candy` | normal | the lid rattles |
| `alkansya` | normal | Optional. Its coins go to the bank, not the quota, and it can be found once per level. |

Letting go keeps your progress: it drains slowly (about 8 s from full), so you can duck out of sight and come back.
Put the bigger coin values in the riskier spots (Random House does this automatically).

## Sound

Noises travel along the rooms (`src/world/sound.js`). Walls stop them, and a closed door adds about 2.5 tiles of
distance. Furniture and gate bars let them through. An adult hears a noise if the path distance is shorter than the
noise's radius. Lures are answered a beat later the farther away the adult is, so a crowd turns one at a time.

## Adult extras

- `"cfg": { ... }` overrides stats for one adult: `range`, `fov`, `speed`, `rate`, `cycle`, `sleepy`,
  `cook` (off phase = stirring a pot: blind, stands still), `ranged: { "range": 88, "cd": 3.5 }` (throws a sandok;
  dodge by sidestepping), `checksHides` (when she loses you or hears a noise she looks inside the nearest hiding
  spots: hiding is no longer a free reset), `lightSleeper` (stealing within ~3 tiles drains her sleep 2.5x faster),
  `tracker` (dog follows the player's scent trail), `hunt: { "every": 4, "spread": 24 }` (keeps heading for roughly
  where the player is).
- Signature keys used by bosses and archetypes:
  - `depth`: a sleep-depth meter. Every noise drains it, and she only wakes at zero. Used by Lola's Siesta.
  - `hairTrigger`: any noise she hears means an instant chase toward it.
  - `followsDog: <adult index>`: hears that dog's barks anywhere and goes to look. Checked by the validator.
  - `ears: 1.6`: hears this much farther. A dog with `ears` barks toward lures it hears.
  - `tattle: { "r": 170, "windup": 0.5, "say": "MAAA!" }`: when he spots you, a wind-up, then a shout of radius `r`
    from where he stands. It sends everyone in earshot to where he saw you.
  - `leash: 64`: gives up a chase this far from home.
  - `scan: { "amp": 0.85, "speed": 1.4 }`: the cone sweeps side to side while walking.
- `"sweepPhase": 3.5` offsets a sweeping adult's rotation so several cones "roll" out of sync.

## Bosses

Add a `boss` block to make a level a boss fight (bosses are just levels; list them in `index.json`):

```jsonc
"boss": {
  "title": "LOLA'S SIESTA",   // intro banner
  "bonus": 10,                // extra coins the first time it is cleared
  "index": 0,                 // which adult is the boss: her name, cycle/alert bar in the HUD; catches on escape timeout
  "phases": [                 // fire in order once coins >= "at" (must be reachable)
    { "at": 2, "banner": "LOLA IS A LIGHT SLEEPER!",   // <= 30 chars
      "adult": { "index": 0, "cycle": { "on": 9, "off": 7 } },     // retune; null removes a stat; also speed/range/fov/rate/sweep/ranged/route
      "spawn": [ { "type": "mama", "route": [[2,15],[12,15]] } ],  // new adults join
      "open": [[x,y]], "close": [[x,y]],                         // gates (G closed / g open)
      "escape": 25 }                                                // TAKBO! seconds to reach the exit, else caught
  ]
}
```

Boss design rules (checked by tests): the last phase fires at the quota and has an `escape` timer, and the boss
checks hiding spots (or a tracker dog hunts you). Hints must be <= 58 characters.

Extra target kind `candy` (the garapon prize). Adult types `nena` (Aling Nena) and `ninang`.
`npm test` also checks phases (thresholds reachable, spawn points on floor, gates exist) and that standing still
at spawn for 4s is safe on every level.

Adult types: `mama`, `lola` (sleeps in cycles, noise wakes her), `tita` (phone cycles), `tatay` (fast),
`kuya` (tattletale: a wind-up, then a shout that calls everyone nearby), `aso` (dog: barks instead of chasing, eats
pandesal), `nena`, `ninang`. Late-game community archetypes, built from the same behaviours:

- `tanod`: barangay watchman. His flashlight cone sweeps while he walks, and his whistle calls everyone.
- `tindera`: market vendor. Shouts MAGNANAKAW! but never strays far from her stall.
- `bisita`: party guest. Harmless and walks a route, but **blocks sight**, so you can hide behind them.
- `trike`: a tricycle on a timed route. Harmless and blocks sight, but it knocks you down and honks.

Generated houses can also carry `mutators`, `brownout` (darker night), `noThrow` (no throwables) and `pasko`
(Noche Buena decorations). See `src/game/house.js`.
Routes are walked with A* (adults open closed doors, never pass gates).
Objects must sit on plain floor and not overlap. Hiding spots, stashes and the alkansya may not sit within one
tile of a door's walkable neighbours: standing there to open the door, the action button would say TAGO or KUPIT
(they outrank BUKAS) and the door would look stuck. The validator rejects it, and `tests/walkthrough.test.mjs`
plays every level with real inputs to prove it can be finished.
