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
| Character skill | F / X | green button |
| Pause | P / Esc | pause button |
| Sound on/off | M | pause menu / title |

Collect the coin quota, then reach the exit.

- **Adults** have vision cones. Fill their meter and they **chase** you (A* pathing); break line of sight,
  hide, and they search, then go back. Mama, Lola (naps; noise wakes her), Tita (phone breaks),
  Tatay (fast), Kuya (tattletale: alerts everyone), Aso (dog: barks, loves pandesal).
- **Noise**: running, creaky floors and lego (ARAY!) make noise rings. Yellow rings lure adults over.
- **Hide** in boxes, curtains, laundry baskets. If someone watched you hide, they'll find you.
- **Random House**: a seeded generator builds a new multi-room house (doors, archways, locked doors with keys, adults, traps) at difficulty 1-5. Daily House is the same for everyone each day. Pays coins but has no unlocks.
- **Bosses**: multi-phase levels (14 levels, 5 of them bosses are marked BOSS). Hitting coin thresholds triggers phases: adults get faster, wake up, throw sandok, or reinforcements arrive. First clear pays a coin bonus.
- **Kids**: each has a skill (cooldown). Jun: silent dash. Bing: hide anywhere 3s (smaller, slower). Kuya Ramil: yell to lure ahead (throws far, loud run). Nene: freeze watchers 3s (kupit faster). Buy kids and upgrades in the store with coins earned (coins + stars per clear).
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
- `src/game/house.js` seeded Random House generator; `src/game/validate.js` level validator (both tested)
- `src/game/progression.js` characters, upgrades, `computeMods` (tested)
- `src/game/world.js` all level rules (DOM-free, tested); `src/scenes/play.js` draws it
- `src/data/levels/*.json` levels; list them in `index.json`. Format: [docs/LEVEL_FORMAT.md](docs/LEVEL_FORMAT.md)
- `reference/` the old "Shadow Blade" prototype (not part of the game)

## Roadmap

- [x] Phase 1: vertical slice
- [x] Phase 2: hiding, items, traps, doors/keys, switches/gates, devices, chase AI, new adult types, 5 levels
- [x] UI pass: title menu, level select (best times), how-to-play, pause menu, sound toggle, tutorial coaching, end-of-level menus
- [x] Phase 3: sari-sari store (6 upgrades x 3 levels), character select with skills (Jun, Bing, Kuya Ramil, Nene)
- [x] Phase 4: five bosses with multi-phase fights (Lola's Siesta, Mama sa Kusina, Tatay + Aso, Ninang's Fiesta, Sari-Sari Store)
- [x] Phase 5: 14 levels (4 new big scrolling ones), camera + objective marker, Random House and Daily House modes
- [ ] Phase 6: Blender-rendered pixel sprites, music, PWA
