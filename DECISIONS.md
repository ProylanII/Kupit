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

## Phase 4 (UX and release readiness)

- **One dev dependency added: `puppeteer-core`** (dev only, drives the Chrome/Edge already on the machine,
  downloads nothing). Justification: it found a P0 (AUDIT.md #11) that no Node test can see, and offline/install
  behaviour can only be verified in a real browser. `npm test` stays dependency-free; `npm run qa` is the
  browser layer (docs/QA.md). Not added to the precache, not shipped.
- **Service worker answers app navigations from a plain copy of `./`**, never from a redirected response, and
  only for the app's own path (`/` or `/index.html` under its scope); other paths go to the network.
- **Onboarding exists** (intro story, level-1 coach, one-time tips, pause-menu help) and was left as is.
- **Credits live on page 3 of How To Play** with a small Filipino glossary, rather than a separate screen.
- **Item-cycle button grew** from r=6 to r=8 game px with a 5 px hit pad (about 42 css px on a phone).
- **Load failure shows the error and a tap-to-retry** instead of "LOADING..." forever.

## Phase 6 (Blender art)

- **Characters are built procedurally in Blender** from the same look tables as the code-drawn generator, not
  hand-modelled: twelve consistent characters in one afternoon, regenerable, and every pose comes from one
  timeline. A hand-modelled character can replace any of them (docs/ART_SPEC.md).
- **The rendered sheet ships** because the brief named it as the remaining item. The code-drawn sheet is kept
  reproducible (`npm run art:code`) and the owner can pick either; both pass the art lock.
- **Camera 32 degrees down, not 50**: at 16 px a steeper view turns heads into hair blocks.
- **`art/renders/` and `art/blend/*.blend` are git-ignored**: 300 PNGs and a generated file; the build script and
  `sheet.png` + `atlas.json` are the source of truth.
- Fixed two bugs in the never-run render script while at it: direction 2 rendered the LEFT view (the camera's
  +X is screen right), and the sun was back-lighting the characters.

## Story pass (2026-11-11)

- **Coins are for the cats.** Siblings are no longer bought (15 + 25 + 30 = 70 coins); the kittens' five needs
  cost the same 70 in total, so the economy curve is unchanged. Needs gate nothing: they change the hideout only.
- **Siblings join in scenes** before 04-bakuran (Bing), 05-gabi (Ramil) and 08-palengke (Nene). Saves from before
  the story get the siblings their progress already passed.
- **Aling Nena is an ally.** The sari-sari boss level is gone; the finale is BAGYO (storm, escape timer). Her
  adult type stays for Random Houses. From the palengke scene on, cat needs cost 25% less.
- **HINGI replaces KUPIT only in the epilogue level.** Earlier levels stay replayable as they were.
- **IBALIK pays no coins** (you are returning them), only stars; a catch there takes nothing back out.
- **The epilogue has no stars**, so the total is 16 x 3 = 48 (the last milestone moved from 42 to 48).
- **Save v3** remaps the "furthest level" index onto the new level order and clears the old ending flag.

## Redesign pass (2026-11-11, later the same day)

- **The ending is a catch, not a confession.** The owner corrected the story: Jun is caught, and only then does the
  family realise the coins were for his pets, so they do not scold him. The earlier version (they knew all along and
  were waiting) is gone, along with its hints (the saucer, the fish left out, Lola's coins); in their place Mama
  counts her purse and Tatay misses his fish, so the suspicion grows toward the storm.
- **The ending plays the moment the storm is cleared**, before the results, and opens like the game's own caught
  screen (red frame, HULI KA!, the caught sting). A level flag (`"ending": true`) marks the level; the epilogue
  still plays it for saves that got past the storm another way. The storm's own fanfare is held back that once.
- **The shipped sprite sheet is the code-drawn one again**, redrawn: the owner was not satisfied with the
  characters, and the Blender toys were black-haired boxes at game size. 12×9 heads, sparkle eyes for kids, hand-drawn
  heads per character and view, Mingming and a kitten as real sprites, and four portrait moods. The style lock's
  palette was regenerated in the same change, on purpose.
- **Stars are missions, and they accumulate.** Each level names two besides "clear it"; a star earned stays earned
  (a bit mask per level). Old saves keep their star counts (n stars = the first n missions). Random and Daily
  Houses keep fast + silent and are scored per run as before, so the daily share card means the same thing.
- **Coins, quotas, boss phases and bonuses were not touched** in the room redesign, so the economy is unchanged.
  `tools/redesign-levels.mjs` is the record of what moved and why.
- **Blending is all or nothing**: beside a walking guest you are unseen beyond 30 px unless already chased. A softer
  "noticed slower" rule was harder to read on screen. Guests walk at half your sneak speed, so it costs time.
- **The videoke masks, it does not lure.** It runs on its own clock (a song, then a break) and cannot be switched
  on, so it is a rhythm to play to, like the thunder, not a second radio.
- **Routines end at the first noise.** A busy adult who hears anything looks up with her full cone. That keeps
  "she is cooking" from being a free pass: quiet is still the rule.
- **The kitten is company, not a mechanic.** Tigre follows after the story is over and nobody can see him; three
  follow in the epilogue. Nothing depends on them.
- **Wardrobe tops are drawn over the tile behind them**, so the validator keeps everything you need to see out of
  that tile. Credits moved to page 4 of How To Play (page 3 is the new rules).
- **Not done here**: softer cones were tuned by eye from screenshots only, and none of the new rooms, routines or
  missions has been played by a person. The bot proves each level can be finished, not that it is fair or fun.
