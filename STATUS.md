# Status

Updated after each phase. See AUDIT.md for the findings and DECISIONS.md for the calls made.

## Phase 0: audit — done (2026-11-11)

- Done: repo surveyed, tests green (125), walkthrough bot run on 14 levels + 250 generated houses, headless Chrome
  smoke pass (no console errors), art generator confirmed deterministic, AUDIT.md written.
- Remaining: Phases 1-5.
- Known issues: see AUDIT.md findings 1-10 (one P1 content bug, animation gaps, small UX items).

## Phase 1: every level finishable — done

- Done: door-approach rule in the validator (`besideDoor`) and in the Random House generator; moved the basket in
  Lola's Siesta, the piggy bank in Gabi and the purse in Tatay + Aso; `tests/walkthrough.test.mjs` plays all 14
  levels (sneak + run, every boss phase, under par), 40 houses, every mutator and 14 Daily Houses with real inputs.
  Bot re-run outside the test: 150/150 houses, 48/48 mutator houses, 60/60 dailies.
- Remaining: Phases 2-5.
- Known issues: AUDIT.md findings 2-10.

## Phase 2: game logic review — done

- Done: every item in the brief's checklist verified against `world.js`/`adult.js` and the tests (table in
  AUDIT.md). Added: exact SILENT-star rule with an in-run toast, explicit KAIN NA wording, spawn grace for
  phase-spawned adults, `tests/rules.test.mjs` (143 tests green).
- Remaining: Phases 3-5.
- Known issues: AUDIT.md findings 2-10.

## Phase 3: animation — done (with the generated art; Blender art is a hand-off)

- Done: sheet regenerated with the full pose set (kids `reach caught cast`, adults `alert sleep phone reach`,
  dog `sleep alert eat`; 306 frames, 256x479, 24 KB). Renderer shows every state: kid skill cast with a flash
  ring, dog bark and eating, Tita's phone, Mama stirring. Stars pop in one by one on the clear screen. Style lock
  (`style.json` + art test) now requires the poses. `pack_atlas.py` sizes per group and reports missing frames;
  `render_sprites.py` renders pose actions; both dry-run tested (the packer on exploded sheet frames, since
  Blender is absent). `docs/ART_SPEC.md` is the complete hand-off. Cache version bumped by `npm run build`.
- Remaining: Phases 4-5. Real Blender renders (human task, see ART_SPEC.md).
- Known issues: AUDIT.md findings 4-6, 9-10.

## Phase 4: UX and release readiness — done

- Done: onboarding confirmed (story intro, coach, tips, help in pause); settings/accessibility confirmed; item
  button enlarged; credits + glossary page; load-failure screen with retry; README port note. **Found and fixed
  a P0**: the service worker broke every navigation once it controlled the page on hosts that redirect
  `/index.html` (AUDIT.md #11). `tools/qa/smoke.mjs` (every screen and level, phone + desktop, dev hotkeys,
  load failure) and `tools/qa/pwa.mjs` (whole version cached, controlled navigation, offline boot + play,
  manifest/icons) both pass; `docs/QA.md` has the manual checklist.
- Remaining: Phase 5 (final QA pass, STATUS/AUDIT closure). Real Blender renders (human task).
- Known issues: AUDIT.md #9 (fractional phone scale, accepted).

## Phase 5: final QA — done

- Done on the final build (`cb9b497b`): `npm test` 143/143; `tools/qa/smoke.mjs` all checks on phone and desktop
  viewports (every screen, all 14 levels, Random + Daily House, pause/resume, `?dev=1` hotkeys, load-failure
  screen, zero console errors); `tools/qa/pwa.mjs` (whole version cached, controlled navigation, offline boot,
  offline level + Daily House, manifest + icons). Offline payload about 520 KB.
- Not done by a machine: the by-hand checklist in `docs/QA.md` section 3 (feel, not function) and the silent
  playtest in `docs/PLAYTEST.md`.

## Definition of done

| Item | State |
|---|---|
| All 14 levels + Random/Daily House completable and validated | Yes: validator + walkthrough bot in `npm test`, 150/150 houses, 60/60 dailies outside the test |
| No P0/P1 left in AUDIT.md | Yes: #1-#8 and #10-#11 fixed; #9 is P2 and accepted |
| Full animation set, or ART_SPEC.md if Blender is unavailable | Both: full pose set in the generated sheet; `docs/ART_SPEC.md` is the Blender hand-off |
| Tests green | 143/143 |
| Works offline and installs as a PWA | Verified headless (`tools/qa/pwa.mjs`); install from the home screen still worth one check by hand |
| STATUS.md current | This file |

## Needs the owner

- Render the Blender characters (docs/ART_SPEC.md), or decide to ship with the generated art as is.
- Run the silent playtest (docs/PLAYTEST.md) and the by-hand checklist (docs/QA.md) on a real phone.
- DECISIONS.md has one **ASK**: KAIN NA at zero ends the level regardless of chances (as implemented). Say if
  dinner should cost a chance instead.
