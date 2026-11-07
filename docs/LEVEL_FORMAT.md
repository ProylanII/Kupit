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
  "tutorial": true,            // show move controls for 6s
  "hint": "SHORT TIP",         // shown for 6s (max ~55 chars)
  "night": true,               // dark tint
  "tiles": ["###...", ...],
  "spawn": [5, 1], "exit": [12, 20],
  "quota": 6,                  // coins needed to unlock the exit
  "par": 120,                  // seconds for the speed star
  "patience": 160,             // optional: "KAIN NA!" timer, caught when it runs out
  "targets": [{ "kind": "purse|bayong|wallet|piggy", "at": [x,y], "coins": 3, "time": 1.6 }],
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

## Adult extras

- `"cfg": { ... }` overrides stats for one adult: `range`, `fov`, `speed`, `rate`, `cycle`, `sleepy`,
  `cook` (off phase = stirring a pot: blind, stands still), `ranged: { "range": 88, "cd": 3.5 }` (throws a sandok;
  dodge by sidestepping).
- `"sweepPhase": 3.5` offsets a sweeping adult's rotation so several cones "roll" out of sync.

## Bosses

Add a `boss` block to make a level a boss fight (bosses are just levels; list them in `index.json`):

```jsonc
"boss": {
  "title": "LOLA'S SIESTA",   // intro banner
  "bonus": 10,                // extra coins the first time it is cleared
  "bar": 0,                   // optional: adult index whose sleep/watch cycle is shown as a bar
  "phases": [                 // fire in order once coins >= "at" (must be reachable)
    { "at": 2, "banner": "LOLA IS A LIGHT SLEEPER!",   // <= 30 chars
      "adult": { "index": 0, "cycle": { "on": 9, "off": 7 } },     // retune; null removes a stat; also speed/range/fov/rate/sweep/ranged/route
      "spawn": [ { "type": "mama", "route": [[2,15],[12,15]] } ],  // new adults join
      "open": [[x,y]], "close": [[x,y]] }                          // gates (G/g)
  ]
}
```

Extra target kind `candy` (the garapon prize). Adult types `nena` (Aling Nena) and `ninang`.
`npm test` also checks phases (thresholds reachable, spawn points on floor, gates exist) and that standing still
at spawn for 4s is safe on every level.

Adult types: `mama`, `lola` (sleeps in cycles, noise wakes her), `tita` (phone cycles), `tatay` (fast),
`kuya` (tattletale: alerts everyone), `aso` (dog: barks instead of chasing, eats pandesal), `nena`, `ninang`.
Routes are walked with A* (adults open closed doors, never pass gates).
Objects must sit on plain floor and not overlap.
