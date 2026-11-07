# Level format

One JSON file per level in `src/data/levels/`, listed in order in `index.json`.
Coordinates are tile `[x, y]` (0,0 = top-left). Maps are 15×22 tiles (240×352 px).
`npm test` validates every level: widths, placement, adult routes (A*), and player solvability with keys/gates.

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

Adult types: `mama`, `lola` (sleeps in cycles, noise wakes her), `tita` (phone cycles), `tatay` (fast),
`kuya` (tattletale: alerts everyone), `aso` (dog: barks instead of chasing, eats pandesal).
Routes are walked with A* (adults open closed doors, never pass gates).
Objects must sit on plain floor and not overlap.
