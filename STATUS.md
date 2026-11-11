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
