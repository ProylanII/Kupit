# Kupit

A pixel-art stealth game. You're a kid sneaking coins out of Mama's purse, Lola's bayong and Tita's wallet
without getting caught. (*Kupit* = Filipino slang for sneaking/pocketing something that isn't yours.)

| | | |
|---|---|---|
| ![Title](docs/screenshots/01-title.png) | ![Sala, the first level](docs/screenshots/04-sala.png) | ![Gabi, a night level](docs/screenshots/05-gabi-night.png) |
| Title | Sala: Mama and Lola's vision cones | Gabi: night lighting |
| ![Boss: Mama sa Kusina](docs/screenshots/06-boss-mama.png) | ![Palengke, a big scrolling level](docs/screenshots/07-palengke.png) | ![Random House](docs/screenshots/08-random-house.png) |
| Boss: Mama sa Kusina | Palengke (scrolling map) | Random House |
| ![Choose your kid](docs/screenshots/03-characters.png) | ![Level select](docs/screenshots/02-levels.png) | ![Caught!](docs/screenshots/09-caught.png) |
| Characters | Level select | Caught! |

## Play

ES modules need a web server (not `file://`):

```
npm start            # or: python -m http.server 8080
```

Open http://localhost:8080 (phone on same LAN works too). If 8080 is taken, `serve` picks another port and prints
it. `?level=2` jumps to a level, `?daily` to today's Daily House.

| Action | Keyboard | Touch |
|---|---|---|
| Move (sneak) | WASD / arrows | drag anywhere |
| Run (loud!) | Shift | drag far |
| Act: kupit (hold), hide, open/close door, switch, turn on TV/radio | E / Space | big button (its icon shows what it will do) |
| Throw tsinelas / pandesal: hold to aim, let go to throw | Q | blue button |
| Switch which item you throw | R / Tab | small dot next to it |
| Character skill | F / X | green button |
| Pause | P / Esc | pause button |
| Sound on/off | M | Options |

Collect the coin quota, then reach the exit.

- **Adults** have vision cones. Fill their meter and they **chase** you (A* pathing). Break line of sight or hide, and
  they search, then go back. `?` over an adult means suspicious, `!` means chase. On big maps, arrows on the screen
  edge show who is onto you, and pings show noises heard off screen.
- **Caught?** You get 3 chances per level. Each catch is a short scolding, a third of your coins go back to where
  they came from, and you start again at the last safe spot (a hiding spot or doorway you passed calmly). The third
  catch ends the level. A catch costs the "silent" star, and par time keeps running.
- **Noise** travels through the rooms: walls stop it and closed doors muffle it. Running, creaky floors, lego (ARAY!)
  and every stash make noise. Purses click, bayongs rustle, wallets zip, and riskier stashes hold more coins. Letting
  go of a half-done kupit keeps most of the progress.
- **Hide** in boxes, curtains and laundry baskets. An eye over you means someone watched you hide, so they'll find you.
- **Secret alkansya**: every level hides one bonus stash off the main route.
- **Bosses** each have a signature rule and finale. Lola's Siesta: a sleep meter that noise drains, then a finale
  where any sound sets her off. Mama sa Kusina: sandok throws. Tatay + Aso: Tatay follows the dog's barks, so
  pandesal splits them. Ninang's Fiesta: guests are moving cover. Sari-Sari Store: the shutter comes down.
- **Late levels** add the tanod (sweeping flashlight, whistle), tinderas (shout MAGNANAKAW!, stay by their stall)
  and a tricycle on a timed route.
- **Random House**: a seeded generator builds a new multi-room house at difficulty 1–5. Mutators (BROWNOUT, WALANG
  TSINELAS, BISITA) make it harder and pay more, and clearing them at level 3+ unlocks outfits. Payouts shrink with
  each house cleared the same day. The **Daily House** is the same for everyone (it rolls over at midnight Manila
  time). It is easier early in the week and hardest on Sunday, keeps a streak, and has a COPY RESULT share card.
  During Pasko season it's a Noche Buena house.
- **Kids**: each has a skill (cooldown). Jun: silent dash. Bing: hide anywhere 3s (smaller, slower). Kuya Ramil:
  yell to lure ahead (throws far, loud run). Nene: freeze watchers 3s (kupit faster).
- **Store**: upgrades show what they change ("NOISE 48 > 38"), with floors so no combination removes the
  tension. Outfits (palette swaps) and title-screen decor are looks only. Star milestones at 10/20/30/42 unlock more.
- **Story**: why Jun needs the coins (a short intro), paid off after the last boss.
- **Ghost**: your best run on each level replays as a see-through kid (Options → GHOST).
- Stars: clear = 1, under par time = +1, **silent** = +1. Silent means no adult's suspicion meter ever filled
  past a third (a brief `?` is fine, a `!` or a dog's bark is not) and you were never caught. The run tells you the
  moment it's gone.
- **KAIN NA!** Some levels have a dinner bar. When it runs out Mama calls you in and the level is over, no matter
  how many chances you have left. The green notch on the bar is par time. Noise comes in two kinds: lures (a
  thrown tsinelas, a creaky board, lego, the TV) make adults walk over to look; glances (running, rummaging in a
  stash) only make them turn their head, which may still put you in the cone, and can wake Lola.

## Install / offline (PWA)

Serve over http(s) and use the browser's "Install" / "Add to Home Screen". Run `npm run build` before deploying.
It writes `precache.json` with a content hash and stamps that version into `sw.js`. Each version is cached as a
whole. A new version downloads in the background and the title screen says **UPDATE READY**, so old and new files
never mix. The service worker is skipped on localhost so edits show up right away (add `?sw=1` to test it there).

Saves carry a schema version and migrate forward. Options → COPY SAVE CODE / LOAD SAVE CODE moves a save to
another device (there is no server).

## Options and accessibility

Music and sound-effect volume, mute, screen shake (full/low/off), red flash on/off, vibration, a visual edge pulse
instead of vibration (for iOS and desktops), left-handed buttons, ghost on/off. Alert states use shape and colour
(`?` / `!` and different cone dither patterns). Tips appear at the top of the screen, never under your thumbs.

## Sound, music, feel

Music is generated in the browser (`src/data/tracks.js`, 4 chiptune tracks). Each track is rendered once into an
audio buffer and looped, with crossfades between tracks. The chase track starts only after a real chase (not a
flicker) and stays a moment after it ends. The screen stays awake while you play (Wake Lock, where supported).
The simulation runs at a fixed 60 Hz, so the game plays the same on 60, 120 and 144 Hz screens.

## Dev mode

Open with `?dev=1` (remembered; `?dev=0` or the ` key turns it off). It unlocks every level in the level list and adds:
pause menu -> DEV TOOLS (god mode, fill quota, go to exit, clear level, next boss phase, previous/next level,
info overlay, game speed, +50 coins). Hotkeys while playing: `N` next level, `B` previous, `C` clear, `G` god,
`U` fill quota, `O` go to exit, `I` info overlay.

## Dev

```
npm test             # validator, AI, sound, save, economy, art-lock, soak and walkthrough-bot tests (no deps)
npm run qa           # headless Chrome: every screen/level, offline + install check (needs `npm i` once; see docs/QA.md)
node tools/economy.mjs          # campaign income vs store prices, level by level
node tools/place-alkansya.mjs   # suggest secret alkansya spots (--write to add them)
```

- `src/world` tilemap + line of sight (DOM-free, tested)
- `src/entities` player, adults (Mama/Lola/Tita), targets
- `src/render` palette, tiles, sprites (`sprites.js` draws the sheet, with code-drawn placeholders as a fallback)
- `src/render/atlas.js` the sprite sheet; `tools/blender/` builds, renders and packs it ([docs/ART_PIPELINE.md](docs/ART_PIPELINE.md), [docs/ART_SPEC.md](docs/ART_SPEC.md))
- `src/game/house.js` seeded Random House generator; `src/game/validate.js` level validator (both tested)
- `src/game/progression.js` characters, upgrades, `computeMods` (tested)
- `src/game/world.js` all level rules (DOM-free, tested); `src/scenes/play.js` draws it
- `src/world/sound.js` path-based noise (walls block, doors muffle); `src/world/pathfind.js` heap A*
- `src/core/save.js` versioned save + migrations + save codes; `src/core/settings.js` options; `src/core/rng.js` seeded RNG
- `src/game/ghost.js` best-run ghosts; `src/data/story.js` intro/ending panels
- Playtesting: `?playtest=1` logs deaths, pauses and idle moments locally ([docs/PLAYTEST.md](docs/PLAYTEST.md))
- `src/data/levels/*.json` levels; list them in `index.json`. Format: [docs/LEVEL_FORMAT.md](docs/LEVEL_FORMAT.md)
- `reference/` the old "Shadow Blade" prototype (not part of the game)

## Roadmap

- [x] Phase 1: vertical slice
- [x] Phase 2: hiding, items, traps, doors/keys, switches/gates, devices, chase AI, new adult types, 5 levels
- [x] UI pass: title menu, level select (best times), how-to-play, pause menu, sound toggle, tutorial coaching, end-of-level menus
- [x] Phase 3: sari-sari store (6 upgrades x 3 levels), character select with skills (Jun, Bing, Kuya Ramil, Nene)
- [x] Phase 4: five bosses with multi-phase fights (Lola's Siesta, Mama sa Kusina, Tatay + Aso, Ninang's Fiesta, Sari-Sari Store)
- [x] Phase 5: 14 levels (4 new big scrolling ones), camera + objective marker, Random House and Daily House modes
- [x] Phase 6 (code side): sprite-sheet pipeline, procedural music, PWA, juice
- [x] Roadmap pass (Nov 2026): failure state, onboarding, threat indicators, explicit actions, path-based sound, economy + cosmetics, kupit profiles, boss signatures + archetypes, accessibility, art lock, alkansya, daily streak/share, mutators, Pasko, story, ghosts, fixed timestep, versioned PWA + save, mobile polish, faster A*, music buffers, soak tests
- [x] Phase 6 (art): Blender characters rendered through the pipeline inside the locked style (`npm run art:blender`, [docs/ART_SPEC.md](docs/ART_SPEC.md)); the code-drawn sheet stays as `npm run art:code`
- [x] Finishing pass (Nov 2026): audit, walkthrough bot, logic review, full pose set, service-worker fix, headless QA ([STATUS.md](STATUS.md))
- [ ] Silent playtest with new players ([docs/PLAYTEST.md](docs/PLAYTEST.md))
