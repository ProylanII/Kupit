# Kupit

A pixel-art stealth game. You're a kid sneaking coins out of Mama's purse, Lola's bayong and Tita's wallet
without getting caught. (*Kupit* = Filipino slang for sneaking/pocketing something that isn't yours.)

## Play

ES modules need a web server (not `file://`):

```
npm start            # or: python -m http.server 8080
```

Open http://localhost:8080 (phone on same LAN works too). `?level=2` jumps to a level.

| Action | Keyboard | Touch |
|---|---|---|
| Move (sneak) | WASD / arrows | drag anywhere |
| Run (loud!) | Shift | drag far |
| Kupit | hold Space | hold KUPIT button, standing next to a bag |

Collect the coin quota, then reach the exit. Adults have vision cones; running makes noise;
Lola sleeps in cycles (noise wakes her); Tita looks at her phone in cycles.
Stars: clear = 1, under par time = +1, never really spotted = +1.

## Dev

```
npm test             # level validator (solvability) + LOS/AI unit tests
```

- `src/world` tilemap + line of sight (DOM-free, tested)
- `src/entities` player, adults (Mama/Lola/Tita), targets
- `src/render` palette, tiles, placeholder pixel sprites (`sprites.js` is the swap point for Blender-rendered sheets)
- `src/data/levels/*.json` levels; list them in `index.json`
- `reference/` the old "Shadow Blade" prototype (not part of the game)

## Roadmap

Hiding spots, distraction items, traps, doors/keys, puzzles, bosses, upgrades shop, more characters, many more maps,
Blender-rendered pixel sprites, PWA. See the plan in the repo history / issues.
