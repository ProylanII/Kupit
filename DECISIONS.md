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

## Phase 2 (game logic review)

- **Rules kept as implemented.** Vision, alert, chase, search, noise tiers (lures vs glances), hiding, devices,
  doors/keys/gates, dinner timer, boss phases, skills, store, save, pause and mute all matched the README and the
  tests; nothing was redesigned. See AUDIT.md "What exists vs the spec" for the exact numbers.
- **SILENT star defined precisely** (`World.stealthOk`, `STEALTH_ALERT = 0.3`): no adult's meter ever reached
  0.3 and no catch. The help text and README now say so, and a one-time toast tells the player the moment the
  star is gone, so the clear screen never surprises them.
- **KAIN NA at zero** stays "level over regardless of chances" (it was already implemented that way); the help
  text now says it. **ASK** if you would rather have dinner cost a chance instead.
- **Adults who spawn in a boss phase are blind for 1.2 s** (`SPAWN_GRACE`, reuses the charm freeze). Before,
  a phase could drop Kuya right onto the player and catch them in a quarter second. Fairness, not a design change.
- **Economy untouched** (see Phase 0).

## Phase 3 (animation)

- **Extended the generated art instead of waiting for Blender.** `make_art.py` is deterministic and already
  produces the shipped sheet, so the missing poses were added there; the game is complete with it and the
  Blender batch stays a drop-in replacement (ART_SPEC.md).
- **Style lock changed on purpose** (poses added to `style.json`) in this phase's commit, as ART_STYLE.md asks.
- **Hiding has no sprite**: the kid is inside the box; peeking eyes and the eye-icon do the job. Run is the walk
  cycle at 1.7x plus dust, not separate frames (the 16 px scale does not read a second cycle).
- **Dog bark pose shows 0.6 s per bark** (render-side timer), not for the whole bark cooldown.
- **Packer sizes come from `style.json`** (group mid-height) so a batch cannot land outside the lock; `--size`
  still overrides. `kid` frames are copied from `jun` (legacy alias) rather than rendered.
