# Kupit: Game Design Implementation Blueprint

Date: 2026-11-13. Builds on `docs/DESIGN_AUDIT.md` and the final review.
This is a design specification only. No code or content has been changed.

All numbers are **starting values**. They will be tuned against playtest data in Phase 8. Where a value is a guess,
it says so.

---

## 0. How to read this

**Approved scope.** This blueprint assumes the final review's direction is approved:

1. MUNTIK NA (catches reframed) and HULI KA reserved for the ending
2. HINALA (household suspicion)
3. SOBRA (greed-based coins)
4. Chapter 4 reframe and the separate tattletale
5. A unique finale for each boss
6. The crew in play (pre-level pick, showcase levels, tag-team)
7. The storm finale
8. Story structure (low point, siblings in the ending, IBALIK aftermath, twist)
9. Readability
10. The economy tied to the story, with gear as new actions

It also includes the audit's level-pass rules and per-level items. Medium and Low audit items that aren't listed are
**deferred**; section 12 lists them.

**Every feature section follows the same eight headings:**
1. Player experience
2. Rules
3. Interactions
4. Affected content
5. Feedback (UI, visuals, animation, audio)
6. Balance
7. Preserve / modify / replace
8. Tests

**Terms**

| Term | Meaning |
|---|---|
| **Sobra** | Coins taken beyond the level's quota |
| **Sapat na** | "That's enough": the cue when the quota is met |
| **HINALA** | Household suspicion, 0–100, carried across the campaign |
| **Muntik na** | "That was close": an in-level catch |
| **Ledger** | The saved record of what was taken from whom |
| **First clear** | The first time a level is cleared. Only first clears move HINALA. |

---

## 1. Decisions needed before Phase 1

Each has a **default**. The blueprint is written for the defaults, so if you change one, the sections it affects need
rework.

| # | Decision | Default | Sections affected |
|---|---|---|---|
| Q1 | Who is the tattletale? | **Pinsan Jomar**, a cousin staying with the family, introduced in a scene before SWELDO (formerly KWARTO) | 3.2, 7 (L6, L9), 9 |
| Q2 | Ninang's level: Christmas party or fiesta? | **Christmas party** ("PARA KAY JUN" envelope; pamasko is then correct) | 3.5, 8.4 |
| Q3 | Mama-was-the-same twist (Lola reveals it in the ending)? | **Yes**, seeded by a photo collectible | 3.6, 10.3 |
| Q4 | Chapter 4 order | **PALENGKE → BARANGAY → PARTY (boss)** | 3.4, 7, save migration |
| Q5 | The vet visit | **Free at the barangay vaccination drive.** The store's BAKUNA item becomes **GAMOT** (medicine) | 3.4, 5.4, L14 |
| Q6 | How HINALA shows | **In the world:** Mama's mood in the hideout, a "new in the house" line before each level, and a breakdown on the clear screen. No numeric bar (a number is optional under Options) | 5.2 |
| Q7 | The tag-team level | **Rebuild SAMPAYAN** (no 18th level) | 6.3, L10 |
| Q8 | Post-game framing | **Random House = "LARO NG MAGKAKAPATID"**, the siblings' make-believe game | 11 |
| Q9 | A canonical house layout | **Deferred.** Only fixed room *looks* (furniture style per room type) are in scope | 12 |

---

## 2. Dependency map

```
Phase 0  Decisions Q1–Q9 + baseline playtest
   │
   ├─► Phase 1  Narrative integrity (text + data only) ─────────────────────────┐
   │      MUNTIK NA wording · Jomar · Ch4 story + order · low point ·          │
   │      IBALIK aftermath · ending siblings · twist seeds                     │
   │                                                                          │
   ├─► Phase 1R Readability (in parallel with Phase 1)                         │
   │      HUD band · adult scale · watcher vs harmless · mixed-case text       │
   │                                                                          ▼
   └─► Phase 2  Core systems ──► 2A stash owners + SOBRA ──► 2B HINALA ──► 2C save v4
                                 │                           │
                                 └──► 2D economy + gear ◄────┘ (prices need the new income)
                                          │
        Phase 3  Crew: 3A pre-level card ─► 3B skill changes ─► 3C tag-team swap
                                          │
        Phase 4  Level pass (non-boss): rules R1–R6, per-level specs,
                 the escort system (L14), errand pickups (L13), HINALA variants for every level
                                          │
        Phase 5  Bosses 1–4 + the new boss test rule
                 (needs: SOBRA, HINALA variants, the pre-level card, the readability pass)
                                          │
        Phase 6  Storm finale + in-game catch + ending + HINGI + case file + album
                 (needs: everything above; it pays off every system)
                                          │
        Phase 7  Presentation: scene backdrops, hideout reactions, post-game framing
                                          │
        Phase 8  Release playtests and tuning
```

### Hard dependencies (build them in this order or redo work)

| Feature | Needs first | Why |
|---|---|---|
| SOBRA | Stash **owner** tags | The ledger, IBALIK and the case file all need to know whose coins they were |
| HINALA | SOBRA | Sobra and emptied stashes are its main inputs |
| HINALA level variants | HINALA tiers fixed; level pass rules R1–R6 | Variants move stashes and lock doors, so the layouts must be final first |
| IBALIK (personal amount) | Ledger + HINALA | The amount and its relief come from both |
| Economy and gear prices | SOBRA | Income changes once greed is optional |
| Save v4 | 2A, 2B, 2D field lists **and** Q4 order | One schema bump, not three |
| Pre-level card | Mission wording (Phase 1) + HINALA "new in the house" line | The card shows all three |
| Showcase levels and tag-team | Pre-level card + skill changes | A level built for a kid needs that kid to be pickable |
| Boss finales | New boss test rule (5.0) | The current test (`tests/boss2.test.mjs:133`) requires every boss to end with a chase and timer |
| Tatay boss | Carried scent (8.3) | The dog follows the fish's smell |
| Party boss | The photo system (8.4) | The album and HINGI reuse the photo |
| Storm | Flood tiles, lightning reveal, hideout art, purchase effects | It uses all of them |
| HUD band | Must be decided before the level pass | The band covers map row 0, so every map must keep row 0 as wall (all 17 do today) |
| Adult scale | Before any boss or level playtest | It changes how cones and threats read |

### Soft dependencies (better together, not blocking)

- Mixed-case text and the pre-level card: build the card in the new font.
- Scene backdrops and the Phase 1 scenes: write the scenes first, then draw the backdrops.

---

## 3. Phase 1: Narrative integrity (text and level data only)

**Goal:** the story never contradicts itself. No new systems, so it's cheap and safe.

### 3.1 MUNTIK NA: reframe in-level catches; reserve HULI KA

1. **Player experience.**
   - An adult reaches Jun. The screen flashes amber, not red. A short line plays (the adult's face plus one line),
     Jun startles, and the coins visibly spill out of his pocket and fly back to their stashes. He restarts at the
     last safe spot.
   - The banner reads **MUNTIK NA!** ("that was close").
   - On the third catch the level ends with **BALIK SA KWARTO!** ("back to your room").
   - The words **HULI KA!** ("caught you!") appear exactly once in the whole game: in the ending.
2. **Rules.** The mechanics don't change: three chances, a third of coins returned, respawn at a checkpoint.
   Every in-play line must be non-accusatory: the family finds Jun *somewhere odd*, never *with coins*.
3. **Interactions.**
   - Each catch adds HINALA (5.2).
   - The `noCatch` mission label becomes **"NO CLOSE CALLS"**.
   - The escape-timeout failure uses the same screen.
   - KAIN NA (the dinner timer) keeps its own screen.
4. **Affected content.** `ADULT_TYPES` shout and scold lines for all types; the caught screen; the help pages
   ("CAUGHT" entry); tips (`caught`); the README. New lines (shout on spotting / scold on catch):

   | Type | Shout | Scold |
   |---|---|---|
   | Mama | "SINO 'YAN?!" (who's there?) | "JUN! ANO'NG GINAGAWA MO DITO?" (what are you doing here?) |
   | Lola | "APO?" | "APO, MAY KAILANGAN KA?" (do you need something?) |
   | Tita | "HOY!" | "LABAS DITO, BATA!" (out of here, kid!) |
   | Tatay | "HOY BATA!" | "DOON KA MAGLARO SA LABAS!" (go play outside!) |
   | Jomar | "TITA! SI JUN!" | "NANDITO SI JUN SA KWARTO NIYO!" (Jun's in your room!) |
   | Tindera | "MARE! ANAK MO!" (your kid!) | "BATA, HUWAG DIYAN!" (kid, not there!) |
   | Tanod | "TIGIL!" (stop!) | "CURFEW NA! UWI!" (curfew, go home!) |
   | Ninang | "IJO! ANO YAN?" | "MAMAYA PA ANG REGALO!" (gifts are later!) |
   | Aso | (unchanged) | (unchanged) |
5. **Feedback.**
   - A new, shorter "muntik" sting (a rising "whoop"). The current caught sting is **kept for the ending only**.
   - The amber flash respects the RED FLASH option.
   - Coins arc back to their stash over 0.6 s (the stashes are already tracked).
6. **Balance.** No change.
7. **Preserve / modify / replace.** Preserve the catch flow and the penalty. Replace the wording, the sting and the flash
   colour.
8. **Tests.**
   - A text test: no in-play string contains KUPIT, NANAKAW, MAGNANAKAW or HULI. The player's own action button
     (KUPIT) is exempt.
   - "HULI KA" appears only in `ENDING`.
   - Playtest question after the ending: *"When did the family first catch Jun?"* Target: at least 80% answer "at the end".

### 3.2 Pinsan Jomar (Q1)

1. **Player experience.** Before SWELDO, a two-panel scene: Jomar arrives to stay ("Bakasyon ko dito!" — "I'm
   on holiday here!"), a nosy cousin who loves telling on people. His tattle threat is now his own personality.
   Ramil stays family and becomes an ally in GABI.
2. **Rules.** The `kuya` type is renamed `jomar`, with its own look and the same behaviour (wind-up, then a shout
   that calls everyone nearby).
3. **Interactions.** He's a HINALA source: a successful tattle adds +2 (5.2).
4. **Affected content.**
   - Jomar appears in SWELDO, MAMA (as a spawn, see 8.2), GABI, IBALIK and PALENGKE.
   - He's removed from PARTY and BARANGAY.
   - Ramil's scene before GABI stays, and the GABI hint changes to "JOMAR TELLS EVERYONE IF HE SEES YOU".
   - Optional suspicion twist: at HINALA tier 2 or higher, the IBALIK scene adds "Jomar, ikaw ba?" (Mama suspects
     the cousin), which deepens Jun's guilt.
5. **Feedback.** A new sprite and portrait: an older teen in a basketball jersey with an always-on phone, so he
   doesn't read as Ramil (green shirt). A whiny "TITAAA!" sound on his tattle.
6. **Balance.** Unchanged.
7. **Preserve / modify / replace.** Preserve the tattle mechanic. Replace the identity.
8. **Tests.** A content check that no `jomar` appears in a level before his intro scene. Playtest: players can
   name the tattletale and say he isn't Ramil.

### 3.3 Story structure

| Beat | Where | Content |
|---|---|---|
| Intro to the greed system | L1 coach | "Sapat na. Huwag sosobra." ("That's enough. Don't take too much.") The first time the quota is met |
| First visible suspicion | Before L3 | Mama: "Parang may kulang..." ("Something seems missing..."). Her purse has moved (a scripted HINALA beat) |
| Jomar arrives | Before L6 | See 3.2 |
| IBALIK aftermath | After L11 (new AFTER scene) | Mama finds the coins: "Ay, nandito pala!" ("Oh, here it is!"). Jun: "No more money. Only food from now on." |
| Tatay's fish | Before L12 | Already there, now pays off in the level (8.3) |
| **Low point** | After L13 (new) | Aling Nena: "That kitten is sick, ijo." Muning is weak. The barangay has a free vaccination drive tomorrow; buy gamot today |
| Kitten saved | After L14 (new) | The vet volunteer: "Libre lang, iho. Ingatan mo sila." ("It's free. Take care of them.") Relief |
| Party | Before L15 | Nene names the kittens; Ninang's envelopes (Q2) |
| Storm | Before L16 | Unchanged |
| Ending | After L16 | Siblings step forward; Lola's twist (Q3); lines that vary by HINALA tier (5.2) |
| Epilogue | L17 + after | Conversations and the photo (10.2) |

- **AFTER scenes** are a new kind of scene that plays once after a level's first clear (like `BEFORE`). They're needed
  for IBALIK, PALENGKE and BARANGAY.
- **Ending additions**, inserted after "...was for them?":
  - Bing (sad): "Ako rin po, Ma. Tumulong ako." ("Me too, Ma. I helped.")
  - Ramil: "Kami pong lahat." ("All of us.")
  - Nene (happy): "Pero ako ang nagpangalan!" ("But I named them!")
  - Mama reacts with one line.
- **Twist (Q3):** Lola, after Mama's "I never said to let them go hungry": "Your Mama sneaked fish to a stray when she
  was your age. She cried for a week when it died. That's why: no more animals." Mama (sad): "...Nay."
- **Tests:** the existing story test (line length, glyphs) plus a test that every AFTER scene's level exists. Playtest:
  the ending makes at least half the testers say they were moved (a prompted question, 1–5 scale; target median 4+).

### 3.4 Chapter 4 story reframe (Q4, Q5)

- **PALENGKE:** an errand to Aling Nena's stall. Nene's "Oops" moment happens at the stall when you arrive (the scene
  moves from BEFORE to AFTER). It still sets the `nena` discount flag.
- **BARANGAY:** escort Mingming, who carries the sick Muning by the scruff, to the vaccination desk. There are no family
  members in the level; neighbours replace them.
- **PARTY:** the chapter's boss, now last in Chapter 4.
- **Save v4** remaps the "furthest level reached" index for the new order (2C).

### 3.5 Pamasko fix (Q2)

- The level is renamed **"CHRISTMAS PARTY NI NINANG"** (display: NINANG'S PARTY). The final-phase banner (8.4) changes.
- One envelope target gets `label: "PARA KAY JUN"`. Taking it plays a thought bubble once: "...Para sa akin 'to?" ("...This
  is for me?").

### 3.6 Twist seeds (Q3)

- A faded photo of a girl with a cat is placed as a wall decoration in Lola's room in LOLA'S SIESTA and GABI.
- It's the **Chapter 1 alaala** (memory) collectible (10.3).
- Lola's line in the BEFORE-PARTY scene: "Your Mama was just like you once..." (deliberately unexplained).

---

## 4. Phase 1R: Readability (in parallel with Phase 1)

### 4.1 HUD band

1. **Player experience.** Coins, chances, level name, timer and the boss bar sit on a solid dark band instead of
   on the wall art.
2. **Rules.**
   - The band is 16 game px (one tile), 90% opaque, drawn over map row 0.
   - Every map's row 0 must be wall, so nothing playable is hidden.
   - For scrolling maps, the camera's top clamp is shifted down by one tile so the band never covers floor.
3. **Interactions.** Tips and hints move just below the band.
4. **Affected content.** All levels. The validator adds a rule: row 0 is all wall.
5. **Feedback.** The level name uses the mixed-case font.
6. **Balance.** None.
7. **Preserve / modify / replace.** Preserve the HUD contents.
8. **Tests.** The validator rule. Screenshot QA on 15×22 and scrolling maps.

### 4.2 Character scale

1. **Player experience.** Adults visibly tower over kids. Bing is smaller than Jun; Ramil and Jomar are taller.
2. **Rules.**
   - Visual only. Collision radii, cone origins and catch distance stay the same.
   - Sizes: adults about 1.35× kid height; Bing 0.85×; Ramil and Jomar 1.15×.
   - Heads stay big for readable faces.
3. **Interactions.** Adults' heads may overlap the tile above. Draw order by y already handles this; test against wardrobes.
4. **Affected content.** The sprite sheet (`make_art.py` look tables, the style lock `style.json`) and the hideout
   crew positions.
5. **Feedback.** Walk cycles at the new heights. **Needs your approval** of the look before rollout, because the
   redrawn characters still await your verdict.
6. **Balance.** None. Cones are unchanged.
7. **Preserve / modify / replace.** Preserve the faces and palettes. Modify the bodies.
8. **Tests.** The art-lock test updated on purpose. A screenshot pass. Playtest: players point out the threat in a
   crowded screenshot in under 1 s.

### 4.3 Watchers vs harmless people

1. **Player experience.** At a glance: if it can catch you, it has a strong outline and an accessory; if it can't,
   it's soft and desaturated.
2. **Rules.**
   - Watchers get a one-pixel dark outline and an accessory: Ninang's fan and big hair, Tanod's cap and vest,
     Tindera's apron, Jomar's phone.
   - Harmless people (guests, epilogue family, neighbours who aren't watching) use 70% saturation, no outline,
     and never show a cone.
3. **Interactions.** Blending (walking beside a guest) still works on harmless guests only.
4. **Affected content.** The party level, BARANGAY neighbours, the HINGI epilogue.
5. **Feedback.** Optional: a tiny eye icon above any watcher within 3 tiles when the Options pulse setting is on.
6. **Balance.** Fairer blending.
7. **Preserve / modify / replace.** —
8. **Tests.** Playtest: in the party level, at least 80% of players correctly say which characters can catch them.

### 4.4 Mixed-case text

- Every sentence (tips, hints, help pages, missions, store descriptions, the pre-level card) uses the 5×8 mixed-case
  dialogue font.
- The 3×5 all-caps font stays for labels: buttons, counters, banners.
- Test: the glyph-coverage test already exists; extend it to all UI strings.

---

## 5. Phase 2: Core systems

### 5.1 SOBRA: coins taken one at a time, and greed as a choice  *(the signature mechanic)*

1. **Player experience.**
   - You hold KUPIT at Mama's purse. Coin pips float above it (●●●●). The first coin takes a moment: you're
     opening it. After that, coins pop out one by one, each with a clink that gets louder.
   - When your total reaches the quota, a soft chime plays and the counter turns green: **SAPAT NA** ("that's enough").
   - You can let go right there, or keep holding for more. Each extra coin is louder and is noted in the house's memory.
   - Taking a stash's **last** coin makes a hollow *klak*: the purse is empty, and someone will notice.
2. **Rules.**
   - **Timing.** A stash's total time `T` (today's `time × kind.hold`) is split up:
     - Coin 1 takes 0.45 T. The remaining coins share 0.55 T equally.
     - Emptying a stash therefore takes exactly as long as today, so pars and timings carry over.
     - Letting go keeps the progress toward the current coin; it drains as it does today. Coins already taken are
       yours.
   - **Noise.**
     - The kind's own noise profile still plays (purse click, wallet zip, bayong rustle, piggy jingle).
     - Each coin after the first in one visit adds a clink with radius 20 + 8·k px, where k is coins already taken
       this visit.
     - The last coin adds a 44 px "empty" noise. Like all stash noises, these make adults turn to look but don't
       draw them over, and they can wake sleepers.
   - **Quota.** The exit unlocks at the quota, as today. Coins beyond the quota are **sobra**: banked like normal coins,
     and an input to HINALA.
   - **Owners.** Each stash names an owner: `owner: mama | lola | tita | tatay | ninang | jun-family | none`.
     The ledger records coins taken per owner per first clear.
   - **Catches.** A third of carried coins return, taken from the most recently taken first (as today, via the stolen
     list). Returned coins refill their stash's pips.
3. **Interactions.**
   - Nene's faster kupit (`stealTime 0.75`) scales `T`.
   - The old QUICK HANDS upgrade is removed (5.4).
   - Missions: **`allCoins` is replaced by `sakto`** ("take exactly what you need": end with coins equal to the
     quota). Rewarding greed would contradict the game.
   - `allCoins` survives only as an optional **"SOBRA CHALLENGE"** in post-game Random House.
   - The alkansya is separate: it's a hidden bonus, counts as neither sobra nor quota, and has no owner.
   - HINALA reads sobra and emptied stashes (5.2).
   - IBALIK reads the ledger (7, L11).
4. **Affected content.**
   - Every stash in every level gets an `owner`.
   - Every level's coin totals are re-set by rule R1 (about 1.4× quota).
   - The coach in level 1 teaches SAPAT NA.
   - The help page "STASHES" is rewritten.
   - The tip set gets a new tip: "Sapat na! Coins beyond the quota are SOBRA. Someone may notice."
5. **Feedback.**
   - Pips above the stash being stolen from.
   - The coin counter shows `5/5` in green, then `+2` in orange for sobra.
   - A coin pop animation per coin.
   - Clink pitch rising per coin; a chime at SAPAT NA (first time per level only).
   - The hollow *klak* for an emptied stash, with that stash drawn open and empty afterwards (visible evidence).
6. **Balance.**
   - The temptation must be real, so sobra pays: it banks like any coin, and riskier stashes hold more.
   - The cost must be real, so sobra raises HINALA, which changes later levels.
   - Target behaviour (playtest metric): in the mid-game, **30–70% of stash visits end before the stash is empty**.
     If almost everyone empties everything, sobra is too cheap; if almost no one takes sobra, it's too costly.
7. **Preserve / modify / replace.** Preserve the hold verb, the noise identity of each stash kind, and the progress drain.
   Modify how a steal resolves (per coin instead of all at once). Replace the `allCoins` mission with `sakto`.
8. **Tests.**
   - Unit: per-coin timings sum to T; clink radii; the exit opens at the quota; sobra is counted; the ledger records
     the right owner; catches refill the right stashes.
   - Walkthrough bot: plays every level twice, once stopping at the quota and once emptying everything.
   - Playtest: the 30–70% metric, and players can say what SAPAT NA means.

### 5.2 HINALA: the house remembers  *(the unifying system)*

1. **Player experience.**
   - Between levels, the hideout shows Mama's mood through the floorboards (a small portrait plus a line): *calm*,
     *wondering*, *suspicious*, *on guard*.
   - Before a level, the card says what has changed: "NEW IN THE HOUSE: Mama keeps her purse in the bedroom now."
   - In the level, you see it: a purse in a new spot, a door that's now locked, Lola who wakes more easily.
   - After the level, the clear screen explains why: "HINALA +7: 2 sobra (+6), 1 empty purse (+4), clean exit (−3)."
2. **Rules.**
   - **Value:** 0–100, stored in the save. It moves **only on a level's first clear**, so retries and replays never
     change it and failed attempts never count.
   - **Inputs** per first clear, each capped per level:

     | Event | Change | Cap per level |
     |---|---|---|
     | Each sobra coin | +3 | +15 |
     | Each emptied stash | +4 | +12 |
     | Each MUNTIK NA catch | +5 | +10 |
     | Each alarm (an adult's meter filled) | +2 | +6 |
     | Each piece of evidence (spill puddle, open stash seen by its owner) | +3 | +6 |
     | Each successful Jomar or tindera tattle | +2 | +4 |
     | Clean clear (no sobra, no alarm, no catch) | −5 | — |
     | IBALIK (see L11) | −2 per coin returned | — |

   - **Story floors:** HINALA can't drop below the chapter's floor, so the script ("suspicion grows") always holds.
     The player's play pushes it above the floor.

     | Chapter | Floor |
     |---|---|
     | 1 | 0 |
     | 2 | 15 |
     | 3 | 30 |
     | 4 | 45 |
     | 5 | 75 |

   - **Tiers:**
     - 0 *Kalmado* (calm): 0–24
     - 1 *Nagtataka* (wondering): 25–49
     - 2 *Naghihinala* (suspicious): 50–74
     - 3 *Nagbabantay* (on guard): 75–100
   - **Effects.** Every campaign level from L3 on defines up to **two** changes per tier in its data (`hinala:
     { "1": [...], "2": [...], "3": [...] }`). Changes are taken from this fixed list only:
     - `move` a stash to a named alternate spot
     - `lock` a door (its key is placed on the near side, so the level stays solvable)
     - Add a routine stop: `bilang` (Mama counts her purse) or a wallet check
     - Set `lightSleeper` on a sleeper
     - Add `checksHides` to one adult
     - Extend search time by +30%
   - The tier is read when the level loads. **Replays use the tier saved at that level's first clear**: you replay the
     house as it was.
   - **Who they suspect:** the family suspects *something* (the wind, the cat next door, the cousin), **never Jun**,
     which keeps the settled ending intact. No line names Jun as the thief before the ending.
3. **Interactions.**
   - It reads SOBRA, MUNTIK NA, alarms, GATAS evidence and tattles.
   - IBALIK lowers it.
   - Scenes have variant lines by tier: the scenes before MAMA, before IBALIK (the Jomar suspicion), before TATAY, and
     the ending.
   - The storm sits at 75 or above by the floor.
   - Random House doesn't use it.
   - Upgrades don't affect it.
4. **Affected content.**
   - Levels L3–L15 get tier variants (L1–L2 are too early; bosses get variants too).
   - Scenes as above.
   - The hideout and the pre-level card.
   - The clear screen.
   - The ending's tier variant:
     - Tier 3: "Every coin from my purse. All this time!"
     - Tier 0–1: "So it WAS you... I thought I was imagining it."
5. **Feedback.**
   - Mama's mood portrait in the hideout, using the four portrait moods that already exist.
   - A "hmm" cue when the tier rises (heard on the clear screen).
   - "NEW IN THE HOUSE" on the pre-level card.
   - A moved stash gets a 2 s outline pulse at level start.
   - The clear-screen breakdown lists its reasons.
6. **Balance.**
   - Each tier adds at most two changes, and every variant must pass the validator and the bot.
   - Target distribution at the end of Chapter 4:
     - Careful player: tier 1–2.
     - Greedy player: tier 3.
   - Tier effects should cost about +15–25% clear time; measure with the bot, then the playtest.
7. **Preserve / modify / replace.**
   - Preserve the scenes (variants are additions).
   - Modify level data (tier blocks).
   - The scripted suspicion in L3 is the system's tutorial: it shows the move regardless of tier, once.
8. **Tests.**
   - Unit: inputs, caps, floors, the first-clear-only rule, replays reading the saved tier.
   - The validator and the bot run **every level × every tier** (4× the validation).
   - Playtest question: *"Why did the purse move?"* Target: at least 70% connect it to their own play ("because I
     took too much" or "because I got seen").

### 5.3 Save v4 (one migration)

New fields:
- `hinala` (number)
- `hinalaAt` (level id → the tier at first clear)
- `ledger` (level id → coins per owner, sobra, close calls, spills, evidence)
- `album` (photo ids)
- `alaala` (memory collectible ids)
- `gear` (owned items)
- `pick` (level id → last kid used)
- `after` (AFTER scenes already played)

Migration rules:
- Old upgrades: refund every coin spent on them to the bank.
- The "furthest level" index is remapped for the new Chapter 4 order.
- The `allCoins` mission bit maps onto the `sakto` bit: a star you earned stays earned.
- `hinala` is set to the floor of the saved chapter.

Tests: extend the existing migration tests from v1, v2 and v3 saves.

### 5.4 Economy, needs by story, gear as actions

1. **Player experience.**
   - The store opens each cat need when the story reaches it, with Aling Nena's line about it.
   - Gear is a few *things* that each give Jun a new trick, not percentage bars.
2. **Rules.**
   - **Needs.** Each unlocks after a story beat. They block nothing; the hideout mood and one scene line acknowledge
     a need that hasn't been bought:

     | Need | Unlocks after | Cost |
     |---|---|---|
     | GATAS (milk) | INTRO | 6 |
     | SARDINAS (sardines) | Before LOLA | 10 |
     | KUMOT (blanket) | Before GABI (cold nights) | 12 |
     | KAHON (bigger box) | IBALIK aftermath | 16 |
     | GAMOT (medicine) | The low point after PALENGKE | 14, replacing BAKUNA's 26 |

     Aling Nena's discount still applies after PALENGKE.
   - **Gear** (single tier each; replaces the six three-tier upgrades). Starting prices, rebalanced in 5.4.6:

     | Item | Effect | Price |
     |---|---|---|
     | **MEDYAS** (socks) | Creak boards make no sound (lego still hurts) | 18 |
     | **PANYO** (handkerchief) | Once per level, muffles one stash's opening noise (purse click, wallet zip) | 14 |
     | **HOLEN** (marbles) | A new throwable: rolls straight until a wall, making a trail of small lure noises. 2 per level | 20 |
     | **BAON** (packed snack) | Start each level with one tsinelas and one pandesal | 16 |
     | **BULSA** (pocket) | Carry one more throwable | 12 |

   - Removed: QUIET TSINELAS, QUICK HANDS, LONG SHADOW, PASENSYA (and STARTER STASH, which merges into BAON).
3. **Interactions.**
   - MEDYAS changes the Lola boss (the creak boards are her whole puzzle): there, MEDYAS halves creak noise instead of
     silencing it.
   - PANYO and SOBRA: it muffles only the kind's opening noise, never the sobra clinks.
   - HOLEN works with the noise system as lure noises; the dog ignores marbles.
   - Purchases affect the storm (9.1).
4. **Affected content.** The store, the help pages, `progression.js` tables, `tools/economy.mjs`, and save v4 refunds.
5. **Feedback.**
   - The store opens with Aling Nena's portrait and a changing line.
   - New gear gets a first-use tip in level.
   - A purchased need shows in the hideout immediately (already true).
6. **Balance.**
   - Re-run the economy tool with two profiles:
     - **Sakto** (quota only, alkansya found half the time) must afford every need *when it unlocks*, plus 3 of 5
       gear items by the end of Chapter 4.
     - **Sobra** (empties everything) affords everything early, but plays at a higher HINALA.
   - Cosmetics stay as they are and are only affordable through replays and Random House.
7. **Preserve / modify / replace.** Preserve the needs → hideout link and the cosmetics. Replace the upgrades.
8. **Tests.**
   - Economy tool rows for both profiles.
   - Unit tests for each gear item.
   - The save refund.
   - Playtest: which gear is bought first and used most. Any item never used by at least 20% of buyers gets cut or
     reworked.

---

## 6. Phase 3: Crew

### 6.1 The pre-level card ("SINO ANG PUPUNTA?" — "who's going?")

1. **Player experience.** Before every campaign level, one screen shows:
   - The level name and its three missions, with stars already earned.
   - The "NEW IN THE HOUSE" line (HINALA).
   - A row of crew portraits. A suggested kid has a small "!" with one line: "Bing fits under the tables here."
   Tap a kid, then GO.
2. **Rules.**
   - Any unlocked kid can play any level, except the tag-team level, where the pair is fixed.
   - **Every level must be finishable as Jun** (accessibility).
   - The suggestion comes from the level's `suggest` field. The last pick is remembered per level.
3. **Interactions.**
   - It replaces the 5 s in-play mission card (audit G2).
   - It also shows the KAIN NA and par notes only where those missions exist.
4. **Affected content.** All levels get `suggest` (optional). THE CREW menu stays for reading descriptions and choosing
   outfits.
5. **Feedback.** Portraits in the happy mood when suggested. A one-line skill reminder under the selected kid.
6. **Balance.** None.
7. **Preserve / modify / replace.** Preserve the crew screen. Replace the in-play mission card. The pause screen
   still shows missions.
8. **Tests.** Headless QA flow (card → level → back). Playtest: at least 60% of players try a suggested sibling at
   least once by Chapter 3.

### 6.2 Skill changes (each sibling distinct, and true to the story)

| Kid | Now | Change | Why |
|---|---|---|---|
| **Jun** | DASH: 0.7 s silent dash, 5 s cooldown | Keep | A balanced default |
| **Bing** | TAGO: hide anywhere 3 s; small, slower, noticed slower | Keep TAGO. **Add a passive "Maliit" (small):** Bing can crawl under tables (T) and beds (B). Under one, she's seen only by an adult within 1 tile | Her story line is "I am small. Nobody ever sees me." It also gives her routes only she can use, so maps gain a second layer |
| **Kuya Ramil** | YELL: lure ahead (radius 90); throws far; loud run | Keep YELL. **Add a passive "Palusot" (excuse), once per level:** the first catch is talked away. "Ma, tinutulungan ko lang siya!" ("Ma, I'm just helping him!") No coins lost, no chance used, but HINALA +3 | The big brother covers for you: the KASABWAT fantasy as a rule |
| **Nene** | CUTE: freeze watchers 3 s; kupit 25% faster | Keep both | With per-coin SOBRA she's the fastest at a stash. That makes greed tempting, a nice tension for the youngest |

Rules for the new passives:
- **Maliit:** tables and beds become passable for Bing only. Her collision radius (3) fits a single tile. Adults
  can't enter. Under furniture she can't throw, but she can use TAGO. Validator: Bing-only routes are bonus routes;
  every stash must still be reachable without them.
- **Palusot:** after it's used, a small icon on the HUD greys out. It doesn't work against the final phase of a boss.

Tests:
- Unit tests for each passive.
- The bot checks that every level is solvable as Jun, and as the suggested kid where one is set.
- Playtest: sibling win rate on their showcase level is at least Jun's.

### 6.3 Tag-team swap (L10 only, Q7)

1. **Player experience.**
   - In KASABWAT (the rebuilt SAMPAYAN), two kids enter the yard together: **Bing and Ramil**.
   - A SWITCH button (and Tab) flips control between them.
   - The kid you aren't controlling stays put, crouched in place. If they're standing in cover or laundry, they're
     safe. If they're out in the open, they can be spotted.
2. **Rules.**
   - Switching has a 1 s cooldown.
   - The inactive kid counts as hidden if in cover or laundry, under a table (Bing), or in a hiding spot.
     Otherwise adults can see them.
   - A catch of either kid counts against the shared three chances.
   - Coins are pooled.
   - The exit needs **both** kids.
3. **Interactions.** Each kid keeps their own skills. Bing's crawl and Ramil's yell are designed to combine: Ramil
   lures Tita away from a lever only Bing can reach.
4. **Affected content.** L10 only. Help pages get a TAG-TEAM entry.
5. **Feedback.**
   - The active kid has a gold marker; the inactive one a dim marker plus an edge arrow when off screen.
   - A swap "whoosh" sound.
6. **Balance.** The laundry is being taken down over time (L10), so standing still is a slow loss and both kids must
   keep moving.
7. **Preserve / modify / replace.** This adds a mode on top of the normal player. One-player levels are untouched.
8. **Tests.**
   - A bot strategy for L10 (scripted swaps at known points).
   - Playtest: at least 70% finish within three tries, and the post-level question "Did it feel like teamwork?"
     scores 4+ out of 5.
   - **Fallback** if the swap tests badly: scripted handover points (Bing's part, then Ramil's part), with no free
     swapping.

---

## 7. Phase 4: Level pass (non-boss levels)

### 7.0 Rules for every campaign level

| Rule | Requirement | Check |
|---|---|---|
| **R1** | Total coins ≈ 1.4× quota (±0.2), with the most coins in the riskiest stash | `level-lint` column |
| **R2** | Spawn and exit in different rooms, and the exit route differs from the entry route by at least 30% of tiles. Exceptions: L4 (the finale changes the route) and L16 (the flood changes it) | lint: path overlap |
| **R3** | One **designed near-miss** per level: a named spot where a cone or door sweeps close to the main path, written in the level's design notes | review checklist |
| **R4** | At least one of the two missions is specific to the level (`sakto`, `silent` and `noCatch` count as generic) | validator list |
| **R5** | At most one new mechanic per level after L3 (pacing table 7.1) | review |
| **R6** | Every stash sits beside furniture that explains it and has an `owner` | validator: stash adjacent to furniture |
| **R7** | HINALA tier blocks are valid in all four tiers | validator × tiers |

### 7.1 Pacing (the final introduction order)

| Level | Introduces |
|---|---|
| L1 SALA | move, cones, kupit, staged hide/search, SAPAT NA |
| L2 KUSINA | cooking routine, sleeper, tsinelas throw |
| L3 BUONG BAHAY | doors, key/lock, Tita's phone, radio, stash kinds, scripted HINALA |
| L4 LOLA (boss) | snore masking, creaky door, silent exit |
| L5 BAKURAN | dog + pandesal, laundry cover, Bing |
| L6 SWELDO | scrolling map, Jomar, TV, timed lever gate |
| L7 GATAS | carry + spill evidence |
| L8 MAMA (boss) | stir window, sandok, boil-over, seat goal |
| L9 GABI | night, KAIN NA, Ramil |
| L10 KASABWAT | tag-team, laundry coming down |
| L11 IBALIK | give back from the bank, jingling pockets |
| L12 TATAY (boss) | fish scent, refilling pandesal |
| L13 PALENGKE | Nene, stalls, tindera gossip, errand pickups |
| L14 BARANGAY | escort Mingming, tanod, tricycle |
| L15 PARTY (boss) | Ninang's calls, blending, videoke, photo |
| L16 BAGYO | lightning reveal + thunder, flood, Mingming in the calm |
| L17 HINGI | ask |

### 7.2 Per-level specifications

Each entry: **goal / layout changes / missions / suggested kid / HINALA tiers / near-miss / preserved**.

**L1 SALA (tutorial)**
- **Goal:** 3 coins (quota 3; Mama's bag holds 4: the tutorial teaches stopping at SAPAT NA).
- **Layout:** two rooms.
  - Top room: Mama on the sofa watching TV (`tv` routine: narrow cone), her bag on the side table.
  - Spawn: the kids' doorway, bottom. Exit: the side door to the yard, middle.
  - Staged beat: after the first coin, Mama "hears something" and walks to the bottom room. The coach says
    "TAGO!". She checks, then shrugs and goes back.
- **Missions:** `sakto`, `silent`. **Kid:** Jun only (crew not yet joined). **HINALA:** none (too early).
- **Near-miss:** the teleserye ad break turns her head toward the bag at a fixed beat.
- **Preserved:** the coaching system, the alkansya by the curtain.

**L2 KUSINA**
- **Goal:** quota 5, total 7: purse 3, coin jar by the stove 2, piggy 2.
- **Layout:**
  - Kitchen: Mama cooking (`luto`). The alkansya beside her stays.
  - Middle: Lola asleep by the piggy.
  - The bottom room becomes a dining area (spawn). Exit: the back door off the kitchen side hall.
  - The radio and lego move to L3.
- **Missions:** `silent`, `alkansya`. **Kid:** Jun. **HINALA:** none.
- **Near-miss:** Mama turns from the stove toward the jar when her cooking stop ends.
- **Preserved:** the alkansya-beside-the-cook idea (the best moment in early design).

**L3 BUONG BAHAY**
- **Goal:** quota 6, total 8.
- **Layout:**
  - The purse has **moved** to the bedroom (scripted HINALA tutorial).
  - The key is in Lola's room. The lever and gate move to L6.
  - The exit is reached through the locked door. The entry is from the top bedroom, so the route differs.
- **Missions:** `noWake` ("take Lola's key without waking her"), `sakto`.
- **HINALA:** tiers 1–3 start here: (1) Mama counts her purse; (2) the bedroom door is locked, key in the hall;
  (3) Lola becomes a light sleeper.
- **Near-miss:** Tita's phone break ends just as you pass the wallet.

**L5 BAKURAN** (Bing joins)
- **Goal:** quota 4, total 6.
- **Layout:**
  - The yard has one laundry line and an open-lawn stretch with no hiding spots (Bing's TAGO is the answer there).
  - A table under the mango tree that Bing can crawl under.
  - Aso patrols. Pandesal ×2.
  - Exit: the gate at the far side of the yard, not the spawn corner.
- **Missions:** `noBark`, `sakto`. **Kid:** suggests Bing.
- **HINALA:** (2) Tatay doesn't doze; (3) Aso doesn't sleep.
- **Near-miss:** the dog's loop passes the laundry line you're standing in.

**L6 SWELDO** (formerly KWARTO; Jomar arrives)
- **Goal:** quota 7, total 10. Tatay's payday wallet is the fat stash (4 coins), on the chair by the shower door.
- **Layout:**
  - The current six-room layout is kept.
  - A timed lever gate is added on the kids' side.
  - Jomar replaces the `kuya` enemy. The room name now matches (payday night).
- **Missions:** `noCatch` ("no close calls"), "take from Tatay's wallet while he showers" (a timed window).
- **Kid:** any; suggests Bing (beds in two rooms).
- **HINALA:** (1) Tatay checks his wallet; (2) the purse moves to the aparador room; (3) Mama checks hiding spots.
- **Near-miss:** Jomar's phone lights his face toward the hall.

**L7 GATAS**
- **Goal:** the milk only. No coin quota; coins in the level are optional sobra (coins 0/0 + up to 5 optional).
- **Layout:** the current one. The fridge is the start; the exit is the back stair under the house.
- **New rule: spill evidence.** A spill leaves a puddle. An adult who sees a puddle investigates it and says
  "Bakit basa dito?" ("Why is it wet here?"). That counts as evidence: HINALA +3.
- **Missions:** `noSpill`, "deliver with no puddle ever seen". **Kid:** any; suggests Jun.
- **HINALA:** (2) Mama is in the kitchen longer; (3) Tita mops (new `walis` stop near the fridge).
- **Near-miss:** Lola stirs as you pass with the bowl.

**L9 GABI** (Ramil joins)
- **Goal:** quota 6, total 9.
- **Layout:**
  - A long hall (Ramil's YELL range).
  - Jomar instead of the `kuya` enemy.
  - KAIN NA tuned to about 1.8× the expected human time (set after the Phase 0 baseline), with a warning call at
    30 s: Mama calls "Hugas kamay!" ("wash your hands!") and starts walking toward the kids' rooms.
- **Missions:** `noWake`, `alkansya`. **Kid:** suggests Ramil.
- **HINALA:** (2) the bayong is moved beside Lola's pillow; (3) the kitchen door is locked (key on the counter).
- **Near-miss:** the warning call reroutes Mama past your hiding spot.

**L10 KASABWAT** (formerly SAMPAYAN; the tag-team level)
- **Goal:** quota 7 (pooled), total 10, plus both kids at the exit.
- **Layout:**
  - The current big yard.
  - Tita takes the laundry down line by line: one line every 25 s, a starting value.
  - One lever reachable only through Bing's under-table route; one choke point Ramil's yell clears.
- **Missions:** "neither kid is ever seen", `sakto`. **Kids:** Bing + Ramil, fixed.
- **HINALA:** (2) Tita starts taking laundry down sooner; (3) Aso is loose all level.
- **Near-miss:** the last line of cover comes down beside the inactive kid.

**L11 IBALIK**
- **Goal:** put back the amount **J**:
  - J = clamp(total sobra from first clears of L1–L10, 5, 12), taken **from the bank**.
  - If the bank holds less, Jun breaks his own alkansya to make up the difference (a scene line). The bank never goes
    negative.
  - The amount is split across the owners in proportion to the ledger (at least 1 coin to each of Mama, Lola and Tita).
- **New rule: jingling pockets.** While you hold coins that haven't been returned, running makes a jingle
  (radius 36 px).
- **Missions:** `silent`, "return every coin while its owner is in the room".
- **HINALA:** −2 per coin returned (the big relief), then the AFTER scene.
- **Kid:** any.
- **Near-miss:** Mama mumbles "salamat..." as the clasp clicks.

**L13 PALENGKE** (Nene joins)
- **Goal:** errand pickups, a new `bilin` (errand) target kind with no coins: fish scraps from the fishmonger's
  bin, the free box behind the bakery, Mingming's sardines at Nena's.
- **Layout:** the exit is **Aling Nena's stall**. The family is at the market (Mama, Tatay). Tinderas are gossips:
  their tattle sends everyone nearby and adds HINALA +2.
- **Missions:** "no gossip reaches Mama" (no tattle), `noCatch`. **Kid:** suggests Nene (freezes a tindera at the
  choke point).
- **HINALA:** (2) Mama is at the fish stall (on your route); (3) Tatay is posted at the exit aisle.
- **Near-miss:** two tinderas chatting turn as you pass behind the stall.

**L14 BARANGAY**
- **Goal:** escort Mingming (who carries Muning) to the vaccination desk at the barangay hall (the new exit,
  a hall building at the top of the plaza).
- **Escort rules:**
  - Mingming follows about 1.5 tiles behind on your path, and stops when you stop.
  - She meows every 10 s (radius 30 px) unless you stand still beside her for 1 s (a "hush").
  - If an adult sees her: "Uy, pusa!" ("Oh, a cat!"). They walk toward her; she runs back to you. That's not a catch,
    but if they see *you* there it's a close call.
  - Mingming can't be caught and can't die. The worst case is time and close calls.
- **Layout:**
  - The current map. The side houses become neighbours' yards (new neighbour palette swaps, harmless unless marked
    as watchers).
  - The tanod's curfew sweep. The tricycle.
  - **No family members.**
- **Missions:** `noCatch`, "Mingming is never spotted". **Kid:** any.
- **HINALA:** none (it isn't the house), but tanod catches add +2 ("the tanod will tell your Tatay").
- **Near-miss:** the tricycle passes between you and Mingming at the plaza crossing.

### 7.3 Content preserved through the level pass

- Every validator rule that exists today.
- The alkansya in every level, still placed off the main route.
- Ghosts. When a level's layout changes, its saved ghost is discarded and best times reset; the stars stay.

### 7.4 Tests for the whole pass

- `level-lint` extended with R1, R2 and R6 columns.
- The validator and the bot run every level × every tier × (Jun, suggested kid).
- `tests/redesign.test.mjs` limits updated.
- Playtest: per-level median time, close calls, and a 1–5 "memorable" rating. Any level below 3 gets reworked.

---

## 8. Phase 5: Bosses

### 8.0 The new boss rule (replaces the test at `tests/boss2.test.mjs:133`)

Every boss must declare:
- a `finale` type from {`silentExit`, `seat`, `carryOut`, `photo`, `flood`},
- a fail condition,
- a success condition.

No two bosses may share a finale type. Escape timers become optional per finale. Only `carryOut` uses one by default.

### 8.1 LOLA'S SIESTA: "Tahimik" (silence)

1. **Player experience.**
   - Lola snores. When she snores loudly, you can move freely. Her "Zzz" grows and shrinks; that *is* her sleep meter.
     The HUD bar becomes secondary.
   - Take her coins from three places: the bayong by her chair, her coin purse under the pillow (riskiest, most coins),
     and the alkansya.
   - At the quota, she **sits up**, awake and listening. The door out creaks unless you open it slowly (hold ACT for
     1.5 s), and the creak boards lie between you and the door. One sound: "APO? IKAW BA 'YAN?" ("Grandchild, is that
     you?") — a close call.
2. **Rules.**
   - **Snore masking:** every 4 s a loud snore lasts 1.5 s and masks all noise within 64 px of her. This is
     Chapter 1's only masking sound.
   - **Phases:**
     - 2 coins: she turns over (new facing; the snore rhythm slows to every 5 s).
     - 4 coins: she talks in her sleep (a random "Apo...?" that's a false alarm, harmless), and her sleep recovers
       50% slower.
     - Quota (6 of 8 total): `silentExit`. She's stationary, with a hair trigger and a slow 70° cone sweep. Snoring
       stops. The creaky door tile is in play.
   - If you wait 25 s she gets up and shuffles toward the door at speed 14, so waiting it out isn't free.
   - No escape timer.
   - The helper (Mama) spawn is **removed**.
3. **Interactions.**
   - MEDYAS halves creak noise here (it doesn't silence it).
   - Bing can crawl under the beds (an alternate approach).
   - Ramil's Palusot doesn't work in the finale.
   - A creaky door (`d` tile, opened by holding) is a new tile, reusable later (GABI, at tier 3).
4. **Affected content.** The `boss1-lola` map: the bedroom gets a chair, a pillow stash, and the old-photo wall decoration
   (Q3). The bottom room stays as the exit room, reached only through the creaky door.
5. **Feedback.**
   - Zzz size shows sleep depth. A snore sound with a clear loud beat.
   - "Sitting up" pose and animation.
   - A door-open progress ring when holding.
   - Her "Apo?" lines.
6. **Balance.** The finale's path to the door crosses 3 creak boards, with one safe line that's visible if the player
   looks. Target finale success: about 60% on the first try (playtest).
7. **Preserve / modify / replace.** Preserve the depth meter (now shown in the room), the light sleeper, hide checks, and
   the `noWake` and `noTrap` missions. Replace the hunt and escape finale.
8. **Tests.** Unit tests for snore masking, the creaky door and the 25 s get-up. Bot finale strategy. Playtest metric
   above.

### 8.2 MAMA SA KUSINA: "Upo na!" (sit down!)

1. **Player experience.**
   - Mama cooks, stirring her pot. She's blind only while stirring, and she throws a sandok (ladle) when she sees you.
   - Midway, the pot **boils over**: she rushes to the stove, and that's a big, predictable window.
   - At the quota she shouts **"KAIN NA! UPO NA!"** ("dinner! sit down!") and starts setting plates in the dining room.
     You don't escape: you have to be **sitting at your place at the table** before she looks up.
   - If you make it, she turns around: "Aba, nauna ka pa?" ("Oh, you got here first?"). A comic clear.
2. **Rules.**
   - **Phases:**
     - Start: stir cycle as today (8 s watching, 3 s stirring). Sandok range 96, cooldown 3 s.
     - 2 coins: faster, sandok range 104, cooldown 2.2 s.
     - 5 coins: the pot boils over every 12 s, sending her to the stove for 4 s. This replaces the Kuya spawn.
     - Quota (7 of 10): `seat` finale. A `seat` tile at the dining table is the goal.
   - In the finale Mama walks the table route (6 plates, about 3 s each, a scanning cone).
   - Reach the seat and press ACT (sitting takes 0.5 s). If she sees you during the last 1 s before you sit
     ("sneaking in"), it's a close call.
   - If you aren't seated after the 6th plate (about 20 s): "JUN! KAIN NA!" — a close call, then respawn at the
     kitchen door with the finale reset.
   - The exit isn't used.
3. **Interactions.** She still checks hiding spots. `noHide` stays a mission. Jomar appears in phase 2 only at HINALA
   tier 3 (a tier variant, not a fixed spawn).
4. **Affected content.** The `boss2-mama` lower room becomes a dining room (table, chairs, a `seat` tile). The KAIN NA
   theme is unified with the dinner timer elsewhere.
5. **Feedback.**
   - A boil-over animation: steam puffs and a hiss. The stove glows as a telegraph 1 s ahead.
   - Plate clinks for Mama's table route (she announces her progress by sound).
   - A sitting pose. Her surprised pose for the clear.
6. **Balance.** Target: the seat is reached with 3–6 s to spare on a typical good run (playtest). The plate count is the
   main tuning knob.
7. **Preserve / modify / replace.** Preserve the stir window, the sandok, hide checks, missions and the banner joke.
   Replace the Kuya spawn and the hunt and escape finale.
8. **Tests.** Unit tests for the seat goal, the 1 s "sneaking in" check, the boil-over timing. Bot strategy. Playtest:
   is the clear moment rated funny (target median 4+ of 5)?

### 8.3 TATAY + ASO: "Ang Pritong Isda" (the fried fish)

1. **Player experience.**
   - Tatay's fried fish sits on the table. You need it for Mingming.
   - The moment you pick it up, **Aso smells it**. The dog follows the fish's trail, barks when close, and Tatay comes
     to the barks.
   - A bag of pandesal by the door gives one roll at a time. Throw it and the dog goes to eat.
   - Drop the fish (ACT) and the dog grabs it: Tatay laughs ("Ikaw pala, Aso!" — "So it was you, Aso!"). That's a
     close call, and the fish goes back to its plate.
   - Get the fish and the coins out to the crawlspace door in the yard.
2. **Rules.**
   - **The fish:** a `carry` target that doesn't spill. While carried:
     - It leaves a scent trail every 0.5 s.
     - The tracker dog follows the *fish* trail at speed 50, and barks within 3 tiles.
     - Running doubles scent density.
   - **The bread bag:** a refill point, one pandesal at a time, 8 s cooldown. Thrown pandesal keeps the dog eating 6 s.
   - **Phases:**
     - Coins first: piggy, purse, wallet (quota 7 of 10).
     - Picking up the fish: "ASO SMELLS THE FISH!" The dog is unchained (bigger roam).
     - Quota + fish: `carryOut` to the crawlspace door with a 35 s timer (starting value). Tatay hunts by barks at
       speed 42.
   - The Kuya spawn is removed.
3. **Interactions.**
   - BAON (gear) starts you with one pandesal.
   - Carrying the fish blocks hiding (you smell), but Bing can still crawl under tables.
   - The `noBark` mission stays and is now very hard: it's the master-level star.
4. **Affected content.**
   - The `boss3-tatay` map: a table with a fish plate (house half), the bread bag, the crawlspace door (yard, exit).
   - The story scene already sets this up, and its last line pays off.
5. **Feedback.**
   - Steam wisps rising from the fish (a scent visual), drifting toward the dog.
   - The dog's sniffing pose; a nose icon over him when he's on the trail.
   - Tatay's laugh line.
6. **Balance.** One pandesal buys about 6 s, and the bag refills every 8 s, so a careful player chains refills.
   Target: about 50% clear within three tries.
7. **Preserve / modify / replace.** Preserve "Tatay follows the barks" and the tracker dog. Replace the single pandesal,
   the Kuya spawn and the generic hunt.
8. **Tests.** Unit tests for fish scent, drop-to-dog, the refill cooldown. Bot strategy (pandesal chains). Playtest
   success rate.

### 8.4 NINANG'S PARTY: "Picture! Picture!" (Q2: Christmas party)

1. **Player experience.**
   - One Ninang, unmistakable: big hair, a fan, gold jewellery. She works the room handing out envelopes and calling
     kids by name.
   - When she calls **"JUN!"** you have 5 s to either come to her (and she hands you nothing: "Mamaya na!" — "Later!")
     or blend into the crowd. If you do neither, the whole room turns to look.
   - The videoke's chorus is your safest moment.
   - At the quota: **"PICTURE! PICTURE!"** Everyone gathers in front of a tripod while a countdown runs. Be *in the
     photo*, blending beside a guest, or completely out of sight when the flash fires.
   - If you're in it, you appear in the family photo that goes into your album.
2. **Rules.**
   - **Ninang's call:** every 15 s, telegraphed 2 s ahead (she raises her fan). If it's Jun's name (1 in 3, never
     twice in a row): within 5 s you must be within 2 tiles of her or blending. Otherwise every adult glances at you
     (a short alert spike, not an instant catch).
   - **Phases:**
     - 2 envelopes: she starts moving around (a bigger route).
     - 4: the videoke switches to a song with a clear chorus (masking) and lengthens.
     - Quota (6 of 8): `photo` finale. An 8 s countdown; adults walk to the photo zone. At the flash:
       - In the zone and blending: clear, **with photo**.
       - Fully out of every cone: clear, **without photo**. The album slot shows the family without you.
       - In the zone and not blending, or seen alone: close call, and the countdown restarts ("Isa pa!" — "One more!").
   - Removed: the extra-Ninang spawn and the Kuya spawn. The other adults become named relatives (Tito Boy, Tita Nora:
     palette swaps).
3. **Interactions.**
   - Blending and the videoke as today.
   - The "PARA KAY JUN" envelope: a thought line on taking it.
   - The photo id is saved to the album (10.3).
   - `noHide` stays. The second mission becomes "end up in the photo".
4. **Affected content.**
   - Party dressing: banderitas (string flags), a parol, a lechon table, monobloc chairs, a gift table.
   - The photo zone and tripod.
   - Level name and banners (3.5).
5. **Feedback.**
   - The fan-raise telegraph and a name call.
   - The countdown "3, 2, 1".
   - A white flash, and the captured photo shown as a polaroid on the clear screen.
6. **Balance.** The call is telegraphed and gives 5 s. The countdown is 8 s from the farthest likely stash, which is
   about 5 s of walking.
7. **Preserve / modify / replace.** Preserve blending, the videoke and the purse under the videoke. Replace the triple
   Ninang, the spawns and the hunt and escape finale.
8. **Tests.** Unit tests for call timing and the photo-outcome classifier. Bot strategy. Playtest: "most memorable
   moment" free-text mentions the photo at least as often as any other moment.

---

## 9. Phase 6: The storm finale, the ending, the epilogue

### 9.1 BAGYO: the storm finale  *(pays off every system)*

1. **Player experience.**
   - **Act 1, Out (the yard):** rain and wind. Lightning shows you for a heartbeat, so you **freeze at the flash**.
     Thunder hides every sound, so you **move on the roll**. Mama sweeps the yard with a flashlight, calling your name.
   - **Act 2, Rescue (the hideout itself):** you crawl into the same space you've seen on the home screen all game:
     dirt floor, posts, the cat box, the bowl and blanket you bought. Three kittens meow as you scoop them into your
     shirt. Then Mingming, who won't come while the thunder scares her. You have to coax her **in the quiet**, when
     you can be heard. Tatay's flashlight joins the search.
   - **Act 3, Flood:** the water starts rising behind you, row by row. The crawlspace entrance floods first, so you
     take the back way. Splashing is loud unless the thunder covers it.
   - You reach the house door. **The lights come on.** The whole family is standing in the doorway. Then the HULI KA
     panel.
2. **Rules.**
   - **Storm cycle** (per 7 s): a faint flicker as warning at −0.8 s → the **flash at 0** (reveal window 0.6 s) →
     **thunder 0.5–2.9 s** (masks all noise) → calm.
   - **Reveal:** during the reveal window, every cone's range is ×1.5 and the alert rate ×2. Cover tiles still block
     sight (fair).
   - **Kittens:** 3 `kuting` targets (1.6 s each).
     - If **KUMOT** (blanket) was bought, they meow quieter: radius 20 instead of 30.
     - If **KAHON** (bigger box) was bought, all three sit in the box: one 3.2 s pickup instead of three separate ones.
   - **Mingming:** a `kuting`-like target with 2.2 s hold that **pauses during thunder** (she flinches), so you can
     only finish her in the calm.
   - **Phases:**
     - 2 kittens: Tatay enters the crawlspace with a scanning flashlight.
     - Mingming collected: **`flood`** finale.
   - **Flood:** water tiles spread from the bottom row up by one row every 3.5 s (starting value) and stop 3 rows
     below the house strip. On water:
     - Speed ×0.6.
     - Every step splashes (radius 40 px) unless thunder is rolling.
     - The crawlspace's front entrance floods by the second row, which forces the side gap.
     - Water never kills. If the player is fully surrounded with nowhere higher to go, that's a close call and a
       respawn on high ground.
   - **The exit:** the house door. Arriving triggers the staged catch (9.2). No escape timer: the flood is the clock.
3. **Interactions.**
   - The `thunder` mission (only run under thunder) is now the master skill.
   - `noCatch` is "no close calls".
   - The hideout art is reused as the crawlspace's tiles and props.
   - Purchases change the finale (above). Every combination must be finishable.
   - HINALA is at 75+ by floor: all adults are on guard. Tier only changes ending lines.
   - Bing can crawl under the stored furniture in the crawlspace.
4. **Affected content.**
   - The `bagyo` map rebuilt: the house strip (top), the yard, and the crawlspace (bottom), with a front entrance and
     a side gap.
   - The existing escape-phase banner is replaced by "BAHA!" ("flood!").
   - The level's `ending` flag stays.
5. **Feedback.**
   - A flicker telegraph + rumble + optional haptic. The white flash (respects the RED FLASH option and reduced flash
     settings: a softer frame tint instead).
   - "KULOG!" (thunder) masking cue (exists).
   - Water tiles with ripples; a rising-water edge line.
   - Splash particles + sound.
   - The kittens peeking out of Jun's shirt (a carry pose with heads).
   - Mingming's flinch animation.
   - Mama's voice calling "JUUUN!" occasionally (direction cue).
6. **Balance.**
   - Act timings (starting values, from bot sneak speed × human factor): Act 1 ≈ 35 s, Act 2 ≈ 45 s, Act 3 ≈ 25 s.
   - The flood needs about 1.4× the human sneak time for the back route.
   - Target: first-time completion within five tries for at least 80% of players. The game's emotional climax must not
     become a wall.
   - Accessibility: a slower-storm option (cycle 9 s) under Options.
7. **Preserve / modify / replace.**
   - Preserve thunder masking, rain, the night tint, Mama's flashlight scan, Tatay's search spawn, the `ending` flag
     and the ending flow.
   - Replace the generic escape timer, the four identical kittens and the interior-room crawlspace.
8. **Tests.**
   - Unit tests for the storm cycle phases, the reveal multipliers, Mingming pausing on thunder, the flood spread,
     the purchase effects.
   - The bot across all purchase combinations × crew.
   - `tools/qa/ending.mjs` updated for the staged catch.
   - Playtest: completion rate, frustration rating, and "what did you feel at the door?" (free text).

### 9.2 The in-game catch (the doorway)

- **Player experience.** At the door, control stops. The camera centres on the doorway, the house strip's night tint
  lifts (the lights come on), and Mama, Tatay and Lola stand there (Bing, Ramil and Nene behind them). A one-second
  hold, then the HULI KA sting, then the ENDING panels.
- **Rules.** It plays only on the first clear, as today. On replays, the clear goes straight to results.
- **Tests.** The ending QA flow.

### 9.3 HINGI (the epilogue)

1. **Player experience.**
   - Daylight. No stealth buttons, just ASK.
   - Walk up to each family member. A two-line panel plays with their portrait and they hand you something.
   - Tatay gives you the next fried fish. Lola tells the photo story (Q3).
   - Bing, Ramil and Nene are around the house, playing with the kittens.
   - Last stop: everyone gathers for the family photo, and this time Jun is in the middle.
2. **Rules.** Everyone is harmless. There's no quota bar, and the door is never "LOCKED". The level ends after the photo.
3. **Interactions.** The photo goes into the album. Tigre follows as now.
4. **Affected content.** The `hingi` map: siblings added; the laundry tiles fixed (a pole and line sprite).
5. **Feedback.** Panels reuse the story system. Soft music.
6. **Balance.** None.
7. **Preserve / modify / replace.** Preserve the HINGI verb and the gift lines. Replace the HUD and the quota bar.
8. **Tests.** QA flow. Playtest: does the ending make people want to show someone? (The share prompt below.)

### 9.4 The case file: "Kuwaderno ni Mama" (Mama's notebook)

1. **Player experience.** After the epilogue, Mama's notebook opens. In her handwriting style are the things she
   noticed during *your* playthrough:
   - "Kulang ng ₱5 sa pitaka." ("₱5 short in my purse.")
   - "Basa ang sahig sa kusina?" ("Why is the kitchen floor wet?")
   - "Bumalik ang pera. Milagro?" ("The money came back. A miracle?")
   Last entry: "Nahuli ko na. Para pala sa pusa." ("I caught him. It was for a cat all along.")
2. **Rules.**
   - 6–8 entries, chosen from the ledger by priority: the biggest sobra, the first emptied stash, any spill evidence,
     the most close calls in one level, the IBALIK return, the fish.
   - Each event type has 2–3 phrasings.
   - Fallback lines for a squeaky-clean run: "Wala akong napansin... masyado siyang magaling." ("I noticed nothing... he's
     too good.")
3. **Interactions.** It reads the ledger (5.3). It can be reopened from the hideout.
4. **Affected content.** A new end screen, plus a share card (the Daily House share code can be reused).
5. **Feedback.** A notebook page backdrop; entries written in one at a time.
6. **Balance.** None.
7. **Preserve / modify / replace.** It adds to, and doesn't replace, the credits page in How To Play.
8. **Tests.** Unit tests for entry selection over synthetic ledgers (greedy, clean, mixed). Playtest: testers laugh or
   smile (observed).

---

## 10. Phase 7: Presentation

### 10.1 Scene backdrops

- Six backdrops: under the house, the kitchen, the market stall, the party, the storm sala, daylight sala.
- Each scene gets a `bg` key.
- Reuse level tiles at 40% contrast so it's cheap.
- Test: every scene names a valid backdrop.

### 10.2 Hideout reactions

1. **Player experience.**
   - When you come back from a level, the kittens react: curious after a clean clear, scared (huddled) after close
     calls, excited after a boss.
   - Tap Mingming to pet her: she purrs and blinks.
   - Mama's mood portrait sits through the floorboards (HINALA, 5.2).
2. **Rules.** Reactions are looks only and last 10 s. Petting does nothing to the game.
3. **Tests.** Headless QA screenshots of each reaction.

### 10.3 The album and alaala (memory collectibles)

- **The album** (in the hideout): Mama's childhood photo (Q3; the Chapter 1 alaala), the party photo (with or without
  Jun), the epilogue family photo, and two more alaala: Tatay's note about the missing fish (Ch3), Lola's rosary story
  (Ch5).
- **Alaala** are one per chapter: placed off the route like the alkansya, collected with ACT, never counted in quota or
  missions. Five in total.
- Test: each alaala is reachable (validator), and the album shows every possible state.

---

## 11. Post-game framing (Q8)

- After the epilogue, Random House is presented as **"LARO NG MAGKAKAPATID"**, the siblings' make-believe game.
  Bing as the narrator: "Kunwari tayo ang mga magnanakaw!" ("Let's pretend we're the thieves!").
- The coins are pretend (they still pay the bank). Mutators and the Daily House are unchanged. The SOBRA challenge
  (empty everything) is an optional mutator here.
- The family in Random House is drawn with a "kunwari" (pretend) tag, shown only on the Random House screen.
- Tests: the screen copy; nothing else changes.

---

## 12. Deferred (not in this blueprint)

- A canonical single house (D1) and the illustrated barangay map (G3). Both are large. Revisit after Phase 8.
- Store redesign beyond the Nena portrait and line (G4), and the title tagline (G6).
- The per-level "Low" items in the audit not absorbed above.
- New Random House content.

---

## 13. Phase 0 and Phase 8: playtest protocol

**Phase 0 baseline** (before building anything)
- 4–5 new players, levels 1–8, the current build, `?playtest=1`.
- Measure: median time per level, close calls per level, quits, and the five-second test ("what is this game about?").
- Purpose: calibrate pars, KAIN NA and finale timings; catch any problem in core feel (cones, noise, controls) before
  systems are built on it.

**Logging to add for Phase 8**
- HINALA changes with reasons.
- Sobra per stash visit (stopped early or emptied).
- The kid picked and the suggested kid.
- Boss finale outcomes.
- Storm act times.
- Album outcomes.

**Phase 8 release criteria** (all must hold)

| Area | Target |
|---|---|
| Ending | At least 80% say the family first caught Jun at the end |
| HINALA | At least 70% can explain why the purse moved |
| SOBRA | 30–70% of mid-game stash visits stop before empty |
| Levels | Every level rated 3+ out of 5 for "memorable" (median) |
| Bosses | Each boss named as a highlight by at least one tester |
| Storm | 80% finish in five or fewer tries |
| Ending, emotional | Median 4+ out of 5 |
| Crew | Siblings tried by 60% by Chapter 3 |
| Stability | `npm test` and `npm run qa` green; no level or tier variant failing the bot |

---

## 14. Phase summary

| Phase | Contents | Depends on | Priority | Rough size |
|---|---|---|---|---|
| 0 | Decisions Q1–Q9; baseline playtest | — | Critical | S |
| 1 | MUNTIK NA, Jomar, story structure, Ch4 story, pamasko, twist seeds | 0 | Critical | S–M (text and data) |
| 1R | HUD band, scale, watcher rule, mixed-case text | 0 (scale needs your look approval) | High | M (art) |
| 2 | SOBRA + owners, HINALA, save v4, economy + gear | 1 | Critical (the identity) | L |
| 3 | Pre-level card, skill passives, tag-team | 2 | High | M |
| 4 | Level pass R1–R7, per-level specs, escort, errands | 2, 3 | High | L |
| 5 | Four boss finales, boss rule | 2, 4 (shared rules), 1R | High | L |
| 6 | Storm, staged catch, HINGI, case file | 2–5 | Critical (the payoff) | L |
| 7 | Backdrops, hideout reactions, album/alaala, post-game | 1, 6 | Medium | M |
| 8 | Release playtests, tuning | all | Critical | M |

**Riskiest items, with fallbacks**

| Item | Risk | Fallback |
|---|---|---|
| HINALA | Readability: players don't connect cause and effect | The clear-screen breakdown, plus the "NEW IN THE HOUSE" card |
| Tag-team | Control confusion | Scripted handover points |
| Storm | Difficulty spike at the climax | The slower-storm option; a longer flood interval |
| SOBRA | The economy drifts | The two-profile economy check is a gate before Phase 3 |
