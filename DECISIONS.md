# Decisions log

Small calls made while finishing the game, newest last. Anything that changes the design is flagged **ASK** and
was not done without the owner.

## Phase 0 (audit)

- **Committed the pre-existing uncommitted roadmap pass first** (`648e7aa`) so that each phase is its own commit.
  It was the previous session's finished work, all tests green.
- **README and `docs/` are the spec.** The brief's design-doc placeholder was empty. Where the README and the code
  disagreed the README was corrected only where the code behaviour is clearly intended (star rule, KAIN NA).
- **No new runtime dependencies.** Headless-Chrome QA uses `puppeteer-core` installed in a scratch folder outside
  the repo, driving the Chrome already on the machine; nothing was added to `package.json`.
- **Economy left as tuned.** Careful play affords the whole store by the end of the campaign, typical play about
  three quarters of it, with Random House for the rest. That matches "earned"; making it looser would empty the
  store before the bosses that need the upgrades.
- **Fractional phone scaling stays.** A 390 px phone gets 1.625x; snapping to 1x would make the game 240 px wide.
  Pixel unevenness is mild and every other option (2x with cropping, non-pixel smoothing) is worse.

## Phase 1 (P0 fixes)

- **Door approach rule.** Hiding spots and stashes may not sit within one tile (Chebyshev) of a door's walkable
  neighbours. Rather than changing the ACT priority (steal > hide > door is predictable and the button shows its
  label), the content is fixed and the validator refuses the layout. The Random House generator applies the same
  rule when it places targets and hiding spots. Seeds that previously produced such a house now produce a different
  (valid) layout for the same seed; the Daily House stays identical for everyone because the generator is still
  deterministic.
- **Walkthrough bot becomes a test** (`tests/walkthrough.test.mjs`): every handmade level, 10 house seeds per
  difficulty, every mutator and the next 14 Daily Houses must be finishable with real inputs.
