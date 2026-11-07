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
| Act: kupit (hold), hide, open/close door, switch, turn on TV/radio | E / Space | big button |
| Throw tsinelas / pandesal | Q | small button |
| Pause | P / Esc | pause button |
| Sound on/off | M | pause menu / title |

Collect the coin quota, then reach the exit.

- **Adults** have vision cones. Fill their meter and they **chase** you (A* pathing); break line of sight,
  hide, and they search, then go back. Mama, Lola (naps; noise wakes her), Tita (phone breaks),
  Tatay (fast), Kuya (tattletale: alerts everyone), Aso (dog: barks, loves pandesal).
- **Noise**: running, creaky floors and lego (ARAY!) make noise rings. Yellow rings lure adults over.
- **Hide** in boxes, curtains, laundry baskets. If someone watched you hide, they'll find you.
- **Distract**: throw a tsinelas, turn on the TV/radio, toss pandesal to the dog.
- **Puzzles**: doors block sight; locked doors need the matching key; switches open gates (some close again on a timer).
- **Timing**: patrol waits, nap/phone cycles, timed gates, and the KAIN NA! dinner timer.
- Stars: clear = 1, under par time = +1, never really spotted = +1.

## Dev

```
npm test             # level validator (solvability) + LOS/AI unit tests
```

- `src/world` tilemap + line of sight (DOM-free, tested)
- `src/entities` player, adults (Mama/Lola/Tita), targets
- `src/render` palette, tiles, placeholder pixel sprites (`sprites.js` is the swap point for Blender-rendered sheets)
- `src/game/world.js` all level rules (DOM-free, tested); `src/scenes/play.js` draws it
- `src/data/levels/*.json` levels; list them in `index.json`. Format: [docs/LEVEL_FORMAT.md](docs/LEVEL_FORMAT.md)
- `reference/` the old "Shadow Blade" prototype (not part of the game)

## Roadmap

- [x] Phase 1: vertical slice
- [x] Phase 2: hiding, items, traps, doors/keys, switches/gates, devices, chase AI, new adult types, 5 levels
- [x] UI pass: title menu, level select (best times), how-to-play, pause menu, sound toggle, tutorial coaching, end-of-level menus
- [ ] Phase 3: sari-sari store upgrades, character select (Jun, Bing, Kuya Ramil, Nene)
- [ ] Phase 4: bosses (Lola's Siesta, Mama sa Kusina, Tatay + Aso, Ninang's Fiesta, Sari-Sari Store)
- [ ] Phase 5: 12+ levels, bigger scrolling maps, random-house mode
- [ ] Phase 6: Blender-rendered pixel sprites, music, PWA
