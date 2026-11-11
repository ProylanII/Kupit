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
