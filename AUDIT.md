# Kupit audit (Phase 0, 2026-11-11)

Severity: **P0** blocks completion, **P1** hurts core feel, **P2** polish. Status column is updated as phases land.

The design doc placeholder in the brief was not filled in ("[PASTE THE FULL TEXT OF ...]"), so the README,
`docs/LEVEL_FORMAT.md`, `docs/ART_PIPELINE.md` and `docs/ART_STYLE.md` were treated as the spec. Any real
design doc should be diffed against the "Doc vs code" table below.

## Repo structure

| Area | Files | Notes |
|---|---|---|
| Boot, screens, PWA glue | `index.html`, `src/main.js` (title, levels, help, options, house, store, chars, pause, caught, clear, story, dev menu) | One canvas, 240x392 game pixels, fixed 60 Hz sim |
| Simulation (DOM-free) | `src/game/world.js`, `src/entities/{player,adult,target}.js`, `src/world/{tilemap,los,pathfind,sound}.js` | All rules live here; tests drive it directly |
| Content | `src/data/levels/*.json` (14), `src/game/house.js` (Random/Daily House), `src/data/story.js` | `docs/LEVEL_FORMAT.md` |
| Progression | `src/game/progression.js` (kids, 6x3 upgrades, cosmetics, payouts), `src/core/save.js` (v2 schema + migrations + save codes) | |
| Rendering | `src/scenes/play.js`, `src/render/{tiles,sprites,atlas,palette}.js`, `src/ui/{font,menu}.js` | Sprites from `assets/sprites/sheet.png`+`atlas.json`, code-drawn fallback |
| Audio / input / options | `src/core/{audio,music,input,haptics,settings,dev,rng}.js`, `src/data/tracks.js` | |
| Offline | `sw.js`, `precache.json`, `manifest.webmanifest`, `tools/build-precache.mjs` | Versioned all-or-nothing cache, "UPDATE READY" prompt |
| Art pipeline | `tools/art/make_art.py` (code-drawn sheet, deterministic), `tools/pack_atlas.py`, `tools/blender/render_sprites.py` (never run), `tools/art/style.json` | Pillow 13 and Python 3.13 are on this machine, **Blender is not** |
| Tests | `tests/*.test.mjs` (125 tests, all green at audit time) | validator, AI, sound, save, economy, art lock, soak |

Working tree at the start of the audit held the whole "Roadmap pass (Nov 2026)" uncommitted (42 files). It was
committed as-is first (`648e7aa`) so each phase below is its own commit.

## What exists vs the spec

| Spec item | Status |
|---|---|
| Vision cone, alert fill/decay, A* chase, search, return | Present (`adult.js`). Fill `rate`/s (x2.5 within 2 tiles), decay 0.9/s on patrol, 0.4/s otherwise, search 2.5 s, repath every 0.35 s |
| Noise: running, creak, lego, stash noises, lures with distance delay, walls block / doors muffle | Present (`world.js` `hearNoises`, `world/sound.js`) |
| Hiding + "saw you hide" | Present (`sawHide`, eye icon, tip) |
| Distractions: tsinelas, TV/radio, pandesal | Present (lure r90; device pulse every 1.5 s r110 until an adult arrives and switches it off; dog eats 8 s) |
| Doors, keys, switches, timed gates | Present. Gates never shut on someone (pending close) |
| KAIN NA! dinner timer | Present: when `patience` hits 0 the level is **lost outright** (`fail('time')`), lives do not matter, "KAIN NA!" screen. Pasensya upgrade adds 10 s per level. Was only implied in the help text (fixed in Phase 2) |
| Boss phases by coins, hunt + escape finale, first-clear bonus | Present (5 bosses, phases table in JSON, `escape` timer, `bonus` paid once) |
| Stars: par time, "never fully spotted" | Present. Exact rule: clear = 1 star; `time <= par` = +1; **no adult's suspicion meter ever reached 0.3 and you were never caught** = +1 (`maxAlert < 0.3 && catches === 0`). `?` appears at 0.12, `!` at 0.6, a dog's bark sets 0.55 so a bark costs the star. Written into the help text in Phase 2 |
| Kid skills + cooldowns | Jun dash 5 s, Bing hide-anywhere 10 s, Ramil yell 8 s, Nene charm 14 s. Present and tested |
| Store 6 upgrades x 3 levels | Present, with stat bars and floors |
| Economy simulation | `node tools/economy.mjs`: store = 294 coins. Careful player (all coins, 3 stars, alkansya) can empty it after level 14/14 (337 earned); typical player (quota, 2 stars) ends 70 short, Random House fills the gap. README's target ("second half of the campaign") is met for careful play only. Judged acceptable, see DECISIONS.md |
| Save (progress, coins, kids, upgrades), pause, mute | Present, versioned, migrates, save codes |
| Tutorial / onboarding | Present: intro story, level 1 step coach, one-time tips stored in the save, pause-menu How To Play |
| Settings / accessibility | Music, SFX, mute, shake (full/low/off), red flash, vibrate, visual pulse, left-handed, ghost |
| Credits | **Missing** (P2) |
| Offline + install | SW + manifest present; `npm run build` stamps the version. Verified in headless Chrome in Phase 4 |
| Blender character art | **Not made**. `render_sprites.py` was never run and renders walk frames only (no poses), so a batch made with it would fail the art-lock test. See ART_SPEC.md (Phase 3) |

## Verification done for this audit

- `npm test`: 125/125 green.
- Walkthrough bot (real inputs, no teleporting, god mode so adults cannot end the run; now `tests/walkthrough.test.mjs`):
  all 14 levels finish, sneaking only and running, with every boss reaching its last phase and escaping in time.

  | level | sneak s | run s | par s |
  |---|---|---|---|
  | 01-sala | 23 | 13 | 60 |
  | 02-kusina | 30 | 17 | 80 |
  | 03-buong-bahay | 26 | 16 | 110 |
  | boss1-lola | 30 | 20 | 90 |
  | 04-bakuran | 32 | 23 | 120 |
  | 06-kwarto | 57 | 32 | 150 |
  | boss2-mama | 33 | 20 | 110 |
  | 05-gabi | 47 | 27 | 120 |
  | 07-sampayan | 44 | 30 | 160 |
  | boss3-tatay | 46 | 26 | 120 |
  | 08-palengke | 44 | 25 | 190 |
  | boss4-fiesta | 26 | 16 | 120 |
  | 09-barangay | 75 | 42 | 230 |
  | boss5-sarisari | 59 | 37 | 160 |

  Par is 2x to 4x the direct sneak time, so the speed star rewards planning, not perfection.
- Same bot over Random House (30 seeds x 5 difficulties), each mutator, and 60 Daily Houses: 202/250 finished.
  Every failure had the same cause (finding 1 below).
- Headless Chrome (390x844 touch viewport, `?dev=1`): title, level select, store, characters, help, all 14 levels,
  a Random House, the Daily House and the clear screen load with **no console errors or failed requests**.
- `tools/art/make_art.py` regenerates `sheet.png` + `atlas.json` byte-for-byte (deterministic), so the sheet can be
  extended safely.

## Findings

| # | Sev | Finding | Status |
|---|---|---|---|
| 1 | **P1** | A hiding spot (or stash) placed beside a door's approach square makes the ACT button say TAGO/KUPIT instead of BUKAS, so the door "won't open" from the natural approach (`ACT_PRIORITY` puts steal and hide above door, reach is 18 px, adjacent tiles are 16 px). Handmade: `boss1-lola` basket [6,11], `05-gabi` piggy [7,10], `boss3-tatay` purse [2,8]. Generator: 19 % of houses. A player can escape it by nudging sideways, but it reads as a stuck door. | Fixed in Phase 1: content moved, generator keeps hides/targets off door approaches, validator rejects it, walkthrough test added |
| 2 | **P1** | Aso's `alert` (bark) frame is never drawn: a dog never chases, so the only trigger (`state === 'chase'`) never fires; an eating dog shows its idle frame. The signature states "bark" and "bribed" are not readable. | Fixed in Phase 3 |
| 3 | **P1** | Animation set incomplete vs the brief: kids have no skill-cast pose; Tita's phone and Mama's stirring are code-drawn boxes next to an idle frame; dog has no eat pose. | Fixed in Phase 3 (poses added to the generator, style lock extended) |
| 4 | **P1** | Item-cycle touch button is r=6 game px (about 20 css px on a phone): too small for a thumb. | Fixed in Phase 4 (bigger hit pad, bigger button) |
| 5 | **P2** | No credits screen. | Fixed in Phase 4 (third How To Play page) |
| 6 | **P2** | If a level file fails to load, the game sits on "LOADING..." forever with the error only in the console. | Fixed in Phase 4 (error text + tap to retry) |
| 7 | **P2** | Star reveal on the clear screen is instant (no juice). | Fixed in Phase 3 |
| 8 | **P2** | `tools/pack_atlas.py` default `--size 10x12` produces 14 px kids, below the locked 16-20 px, so a packed Blender batch would fail the art lock. `render_sprites.py` renders no poses. | Fixed in Phase 3 (per-kind sizes, pose actions, ART_SPEC.md) |
| 9 | **P2** | Phones get a fractional canvas scale (1.625x on a 390 px wide phone), so pixels are uneven. Integer scale would leave the game at 1x (too small). | Left as is; noted in DECISIONS.md |
| 10 | **P2** | `npm start` fixes port 8080; on this machine another app owns 8080 and `serve` silently moved to a random port. | Fixed in Phase 4: README notes it, the port is shown by `serve` |
| 11 | **P0** | Found in Phase 4 by the headless offline check: once the service worker controlled the page, every navigation to the game failed (`net::ERR_FAILED`). The worker stored the start page by cloning the cached `index.html` response; on hosts that redirect `/index.html` to `/` (serve, Netlify, ...) that response is "redirected", and Chrome refuses redirected responses for navigations. An installed copy would have been dead after its first visit on such a host. | Fixed in Phase 4: `sw.js` stores a plain copy of `./` and answers app navigations from it; `tools/qa/pwa.mjs` proves cache, controlled navigation, offline boot and play |

## Doc vs code mismatches

| Doc | Says | Code | Action |
|---|---|---|---|
| LEVEL_FORMAT.md | `"tutorial": true // show move controls for 6s` | enables the step-by-step coach on level 1 and hides the skill tip | doc fixed (Phase 2) |
| LEVEL_FORMAT.md | hint max ~55 chars | validator allows 58 | doc fixed |
| README | stars: "never caught or really spotted" | `maxAlert < 0.3 && catches === 0` | README + help made precise |
| README / help | KAIN NA bar "is dinner time" | at zero the level is lost, lives ignored | help made explicit |
| ART_PIPELINE.md | kids ~12x16 body, adults ~14x20, pack default 10x12 | style.json locks kids 16-20, adults 20-24 incl. outline | pipeline doc + packer defaults fixed (Phase 3) |
| ART_PIPELINE.md | Blender script renders the walk cycle | art lock also requires `reach`/`caught` (kids), `alert`/`sleep` (adults) | script renders pose actions too; ART_SPEC.md |
| README | "Phase 6 (art): actual Blender characters ... not made" | true | unchanged; ART_SPEC.md is the hand-off |

## Risks

- **Blender art is still a human task.** Everything downstream (packer, art lock test, atlas keys, game) is ready and
  documented in ART_SPEC.md, but nothing can be rendered on this machine.
- **No human playtest yet** (`docs/PLAYTEST.md`). The bot proves levels are completable, not that they are fun.
- Per-pixel cone rasterising (`play.js drawCones`) scales with adult count x range squared; fine on the biggest
  level in Chrome, untested on a low-end Android.
- Offline cache is about 420 KB for the whole game; well inside any phone budget.
