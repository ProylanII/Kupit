# Kupit: Design Audit (pre-release)

Date: 2026-11-13. Build inspected: `e4d8210` (main, clean).
This is a design review only. No code or content was changed. Nothing here gets built until you approve it.

---

## 0. Scope, method, and limits

**What I inspected directly**

| Area | Source | Status |
|---|---|---|
| Story: intro, 10 pre-level scenes, ending, epilogue, chapters | `src/data/story.js` | Done, every panel |
| All 17 campaign levels: every map tile, stash, adult, route, routine, trap, item, hiding spot, boss phase, mission | `src/data/levels/*.json`, rendered to annotated ASCII maps | Done, every level |
| Per-level metrics: open floor, loops, stash approach sides, bot time vs par | `tools/level-lint.mjs` | Done |
| Enemy types, stats, routines | `src/entities/adult.js` | Done |
| Missions, economy, upgrades, cosmetics, payouts | `missions.js`, `progression.js`, `tools/economy.mjs` | Done |
| Hideout hub, barangay map, store, crew, pause, caught, clear, story panels, help, options | `src/main.js`, `src/scenes/hub.js`, `shop.js` | Done (code + screenshots) |
| Visuals | `assets/sprites/sheet.png`; the QA captures in `tools/qa/out/` (2026-11-12, newer than the current sheet and maps): title, map, store, crew, clear, ending, and levels 1, 4, 13, 14, 16, 17 | Done |
| Random House / Daily House | `src/game/house.js` (generator rules, mutators, daily rotation) | Rules read only |

**What I could not inspect (reported, not guessed)**

- **Real play.** I could not start a local server in this session (the permission was denied), and I can't play anyway. Everything about *feel* (timing windows, how fair a cone feels, whether a chase is scary) comes from the numbers and screenshots, not from playing. Anything that depends on feel is flagged **needs playtest**.
- **Motion and audio.** Animations are judged from the static sheet and stills only. Music and sound effects are not judged at all.
- **Generated houses.** I did not look at any Random or Daily House layouts.
- **Phone ergonomics.** Thumb reach and button size on a real device are not checked.
- **Human data.** No playtest data exists. The repo says the silent playtest has never been run (`STATUS.md`).

**Decisions I treated as settled.** Nothing below reopens these: the cat premise; Jun gets **caught first, then forgiven**, and the family does not know beforehand; KUPIT becomes HINGI in the epilogue; Aling Nena is an ally; Jun leads and the siblings join through the story. Every story recommendation was checked against these.

**Priority scale.**
- **Critical:** breaks the game's own premise or would embarrass a commercial release.
- **High:** a clear quality gap players will notice.
- **Medium:** polish and depth.
- **Low:** nice to have.

---

## A. Overall assessment

**Verdict.** The systems under Kupit are stronger than its content. Noise travels through rooms, adults have chores that blind them, laundry, stalls and crowds give cover, and thunder and videoke mask sound. That is a real stealth toolkit, and it is well tuned for a small game. The premise is warm and specific: a kid stealing coins to feed a secret cat, who learns he only had to ask. It is the game's biggest asset.

What keeps it from feeling *authored* is that the levels don't serve the story or the toolkit well enough:

1. **The story breaks its own moral in Chapter 4.** Jun pickpockets strangers at the market and burgles neighbours' houses around the barangay hall. The ending forgives *kupit from family*. Theft from strangers is a different act, and it is never addressed. (Critical)
2. **The "Kuya" tattletale enemy reads as Kuya Ramil**, a sibling who joined the crew, and he keeps hunting you after he joins. (Critical)
3. **Siblings join in the story but change nothing in play.** There is no pick-a-kid step before a level, and no level is built around a new sibling's skill. The KASABWAT ("partners in crime") chapter has no partners in its gameplay. (High)
4. **All five bosses have the same shape.** Each one: a coin threshold retunes the boss, a helper spawns (Kuya in three of five), then a final hunt plus a timer. The tests enforce this sameness. The escape timers give roughly 2–4× the time the run needs, so the finales are walks. (High)
5. **Half the levels are out-and-back in one room.** Spawn and exit share a room in 8 of 17 levels (Sala, Kusina, Lola, Bakuran, Mama, Ibalik, Tatay, Bagyo), so the last minute of a level is backtracking. (High)
6. **The economy and the story are out of sync.** The cats' needs cost 70 coins, out of 294 total. A typical player can buy the vet visit long before Chapter 4's scene says "they need a vet soon." Most of the money goes to sneaking gear. (High)
7. **Places have no continuity.** Fourteen levels are set in Jun's house, but the house is laid out differently every time. Level names often don't match the contents: the KUSINA level has beds, and the KWARTO level has a kitchen and a sala. (Medium, large scope)
8. **Readability.** Adults are drawn the same height as kids. The top HUD strip sits over wall art. Harmless guests and the dangerous Ninangs look alike at the fiesta. (High)
9. **No human has played it.** The bot proves every level can be finished. It cannot prove any level is fun or fair. **Release gate: Critical.** This is a process item, not a design change.

**Strongest assets: keep them.** The IBALIK reverse heist. The hideout home screen that changes as the kittens grow. The "HULI KA!" ending framed like the game's own caught screen. Lola's sleep-depth meter. Mama's stir-the-pot rhythm. Thunder as a rhythm. Laundry you can walk through. Missions that stay earned. Section I has the full keep list.

---

## B. Storyline assessment

### B.1 What the story is now

INTRO: Jun finds Mingming and three newborn kittens under the house. Mama: "No more animals." Jun decides to kupit.
- **Ch.1 ANG SIKRETO:** SALA, KUSINA, BUONG BAHAY, LOLA'S SIESTA. One scene, before Lola: "The milk is gone already."
- **Ch.2 GATAS:** BAKURAN (Bing joins), KWARTO, GATAS (carry the milk), MAMA SA KUSINA ("Who has been in my purse? I count it").
- **Ch.3 KASABWAT:** GABI (Ramil catches Jun, then joins), SAMPAYAN, IBALIK (Mama skipped her merienda, so Jun puts coins back), TATAY + ASO ("Who keeps taking my fried fish?").
- **Ch.4 SA LABAS:** PALENGKE (Nene blurts the secret; Aling Nena becomes an ally), NINANG'S FIESTA ("Ninang always brings fat envelopes"), BARANGAY HALL (no scene).
- **Ch.5 BAGYO:** BAGYO (storm rescue, then HULI KA, then forgiveness), HINGI (epilogue: ask for everything).

### B.2 What works

- **The premise does real work.** It turns a mischief game into a story about why a child hides things, and the title verb flips in the last level (KUPIT to HINGI). That flip is the best design idea in the game.
- **IBALIK** is a real character beat. Jun sees the cost (Mama skipped her merienda) and acts on it with the game's own verbs, played backwards.
- **Suspicion grows on schedule.** Mama counts her purse, then Tatay misses his fish. The storm is a natural finale: the one night he must be outside, at the worst moment.
- **The ending lands** because the catch uses the game's own failure screen.

### B.3 Problems and recommendations

**[S1] Chapter 4 turns kupit into theft from strangers.** *Critical*
- **Problem:** PALENGKE has you take purses at vendors' stalls while tinderas shout "MAGNANAKAW!" (thief). BARANGAY HALL has you take piggy banks, purses and wallets from six neighbours' houses while a tanod (watchman) patrols. No scene explains either.
- **Why it's a problem:** Kupit is forgivable because it happens inside a family. The ending forgives exactly that: "Every coin from my purse." Stealing from vendors and neighbours is a different act, and the ending never deals with it. The moral "you only had to ask" is false for coins taken from strangers. A player who notices will feel the ending is dishonest.
- **Proposal:** Keep the levels' *mechanics* (stalls, tinderas who tattle, a tanod who sweeps, a tricycle) and change *why you're sneaking*:
  - **PALENGKE:** Jun has the coins and needs to *buy* sardines at Aling Nena's stall. Mama and Tatay are at the market too, and every tindera is a gossip who'd tell Mama ("Mare, nakita ko anak mo!" — "I saw your kid!"). The goal becomes reaching Nena's stall and back unseen. Stashes become errands: pick up the fish scraps the fishmonger throws away, grab the free cardboard box. Nene's slip ("It's for Mingming!") then happens *at* the stall, in the level itself.
  - **BARANGAY HALL:** The barangay is running a free vaccination drive (*libreng bakuna*). That is the BAKUNA need from the store, already in the game. Jun has to get Mingming there and back past the curfew tanod and family members out on errands. The quota becomes "get the cat vaccinated", not coins.
- **Expected impact:** The moral holds from start to finish, and Chapter 4 becomes about the outside world closing in instead of escalating crime. The BAKUNA need finally gets a story moment.

**[S2] The "Kuya" enemy is indistinguishable from Kuya Ramil.** *Critical*
- **Problem:** The `kuya` enemy (blue shirt, shout "MAAA! KUMUKUPIT SIYA!" — "Ma! He's stealing!") does exactly what Ramil threatens in his join scene: "I saw you at Mama's purse. I am telling!" Ramil joins the crew before GABI. GABI's hint is then "KUYA TELLS EVERYONE IF HE SEES YOU". The kuya enemy also appears in IBALIK, TATAY + ASO (as a spawn), PALENGKE, FIESTA (as a spawn) and BARANGAY, all after Ramil joined.
- **Why it's a problem:** It reads as a continuity error. Ramil swore he "saw nothing", then keeps hunting you, in the chapter named for him being your accomplice.
- **Proposal:** Make the tattletale a named, separate character with his own story role. My suggestion: cousin **Pinsan Jomar**, who is staying with the family. Introduce him in a scene. Alternatively, keep Kuya Ramil himself as the tattletale only in the levels *before* he joins (KWARTO, MAMA SA KUSINA), so GABI becomes the level where you finally deal with him.
- **Expected impact:** Removes a visible plot hole. Taking the second option also gives Ramil a payoff: the enemy you dodged for two levels becomes your partner.

**[S3] The siblings vanish from the ending.** *High*
- **Problem:** Bing, Ramil and Nene helped all along, but none of them appears in ENDING or EPILOGUE. Tita and the kuya enemy appear in many levels and never in a single scene.
- **Why it's a problem:** The KASABWAT chapter sets up a team, and the climax drops it. The natural solidarity moment is missing: "Kami rin po, Ma" ("Us too, Ma").
- **Proposal:**
  - In ENDING, after Jun confesses, add two panels: Bing steps forward ("Ako rin po. I helped." — "Me too."), then Ramil ("Kami pong lahat." — "All of us."). That softens Mama further.
  - Put Tita in one mid-game scene so she isn't an anonymous recurring guard. For example, she suspects the yaya, or she's the one who tells Mama about the missing fish.
  - Both stay inside the settled ending. The *adults* still didn't know.
- **Expected impact:** The ending pays off every relationship the game built, and the cast stops feeling half-used.

**[S4] Jun's arc regresses after IBALIK.** *High*
- **Problem:** In IBALIK, Jun returns every coin out of guilt. The next level, TATAY + ASO, has him stealing coins again (piggy, purse, wallet), followed by market purses, fiesta envelopes and neighbours' houses.
- **Why it's a problem:** The best character moment is undone one level later, with no line acknowledging it.
- **Proposal:**
  - Give IBALIK an AFTER scene: Mama finds the coins ("Ay, nandito pala!" — "Oh, here it is!"). Jun decides "No more money. Only food."
  - From then on, the stashes become food. TATAY + ASO becomes about **Tatay's fried fish**, which the scene already mentions but the level never contains (see L12). FIESTA becomes handa, the party food (see S6).
  - With S1 applied, Chapter 4 no longer escalates the stealing either.
- **Expected impact:** A clean arc: kupit coins → realise the cost → put them back → take only what the cats need → caught → learn to ask.

**[S5] "No more animals" has no reason, and the ending has no twist.** *Medium*
- **Problem:** Mama's rule has no backstory. The ending resolves sweetly but without surprise. Her change of heart rests on one line: "I never said to let them go hungry."
- **Why it's a problem:** The emotional peak has nothing seeded for it to pay off.
- **Proposal (an optional twist that keeps the settled ending):**
  - In ENDING, Lola reveals that Mama did the *same thing* as a girl: she sneaked fish to a stray, and when it died she cried for a week. That is why "no more animals" was about Mama's own heartbreak, not cruelty.
  - Foreshadow it lightly: a faded photo of a girl holding a cat as one wall decoration in Lola's room, plus one Lola line mid-game ("Your Mama was like you once...").
  - The family still didn't know about Jun beforehand. The twist is about Mama's past, not about Jun.
- **Expected impact:** The forgiveness becomes earned and surprising, and the ending gains a generational echo, which suits a Filipino family story.

**[S6] Fiesta and pamasko are mixed up.** *Medium*
- **Problem:** NINANG'S FIESTA has Ninang's "fat envelopes", and the final banner reads "NINANG WANTS HER PAMASKO!". Pamasko is the Christmas gift a godparent *gives* a child, so Ninang wanting *hers* is backwards. A fiesta is also not Christmas.
- **Why it's a problem:** Filipino players will notice, and authenticity is one of the game's selling points.
- **Proposal:** Pick one of two:
  - (a) Make it **Ninang's Christmas party**. That fits the existing Pasko season and makes the envelopes correct. Twist: the envelope Jun steals is labelled **"PARA KAY JUN"** ("for Jun"). He stole his own gift, which he'd have been given for the asking. Final banner, e.g. "NINANG COUNTED HER ENVELOPES!"
  - (b) Keep the fiesta and make the stash the handa, the party food, for Mingming.
- **Expected impact:** Option (a) is a small change that seeds the HINGI theme two levels early. It's one of the most memorable beats you could add for very little cost.

**[S7] Five levels have no story contribution.** *Medium*
- **Problem:** KUSINA, BUONG BAHAY, KWARTO, SAMPAYAN and BARANGAY have no scene and no story purpose; they are "get coins". BAGYO's banner "THE WATER IS RISING!" promises a mechanic that doesn't exist (see L16).
- **Why it's a problem:** Those levels feel like filler between story beats.
- **Proposal:** Give each one a two-panel beat that changes the situation. These also feed S8. Examples:
  - **KUSINA:** "Milk is ₱X. I have ₱0."
  - **BUONG BAHAY:** Mama moves her purse to a new hiding place. The level is then about finding it, which makes the key-and-lock layout part of the story.
  - **KWARTO:** Bing almost tells.
  - **SAMPAYAN:** Mingming moves a kitten. You follow the sound. A kitten target that meows (the `kuting` kind already exists) adds a light second objective.
- **Expected impact:** Every level advances something. Rising suspicion becomes visible *in the maps*: the purse moves, a lock appears, a dog is let loose.

**[S8] Show suspicion in the levels, not only in dialogue.** *Medium*
- **Problem:** The family's suspicion grows only in scene text.
- **Proposal:** Escalate the house as the story goes:
  - Mama's purse moves: to the sala first, then the bedroom, then a locked drawer.
  - Tatay starts locking a door that used to be open.
  - Lola starts sleeping lightly (`lightSleeper`) after the siesta boss.
  - Spilled milk in GATAS leaves a puddle that adults notice (see L7).
- **Expected impact:** This is the environmental storytelling a professional stealth game uses. Players feel the net tightening.

---

## C. Level-by-level audit

How to read these:
- Coordinates are tiles `[x, y]`.
- "Bot" is the walkthrough bot's sneak time from `level-lint`. Humans will be slower, so par needs a playtest, but the ratios are telling.
- **Mechanics** lists what the level introduces.

---

### L1. SALA (tutorial, 15×22, quota 3/3, par 60, bot 22 s)

**Current state**
- Three stacked rooms. Spawn at [2,19], bottom left. Exit at [12,20], bottom right, in the same room.
- Mama walks a slow (speed 17) rectangle in the top room.
- The only stash is a purse in the open, mid-floor at [8,4], beside a rug.
- Hiding spots: a box in the middle room, a curtain top right. The alkansya is at [13,1], top-right corner, next to the curtain.
- Missions: fast, silent.
- **Mechanics:** move, cones, kupit (hold), exit unlock.

**Works**
- One threat and one stash: readable.
- The alkansya beside the curtain is a good first secret (risk next to safety).
- The coaching line responds to what the player does.

**Weak**
- The bottom two-thirds of the map (rows 8–20) has no threat. The player walks through two furnished but empty rooms, then walks back the same way.
- The purse sits on bare floor for no reason.
- Hiding is offered but never needed, so the tutorial never shows the core loop: seen → hide → she searches → she gives up.

**Recommendations**
- **[L1-a] Stage the core loop once.** *High*
  - Problem: The player can finish without ever learning hiding or how a search works.
  - Why: Level 2 then expects both, and its hint opens with "SEEN? HIDE IN THE BOX".
  - Proposal: A scripted, safe beat. After the purse, Mama "hears something" and walks toward the middle room. Coaching says "TAGO!". She checks the room, shrugs, and walks back.
  - Impact: Teaches the game's central rhythm in level 1 and builds confidence.
- **[L1-b] Make the room tell a story.** *Medium*
  - Problem: The purse floats on the floor, and Mama walks an aimless loop.
  - Why: It's generic, and level 1 sets the player's expectations for the whole game.
  - Proposal: Mama watches a teleserye on the sofa (`tv` routine: narrow cone), with her bag beside her. The ad break is when she turns around.
  - Impact: First lesson in "busy adults see less". The opening image is unmistakably a Filipino home.
- **[L1-c] Shorten the map.** *Low*
  - Problem: Two rooms do nothing.
  - Why: Slack in a tutorial reads as padding.
  - Proposal: Cut to two rooms, or put the exit in the middle room so the return trip is short.
  - Impact: A faster first win.

**Memorable idea:** the teleserye cliff-hanger. Mama gasps at the TV ("HINDI!") at a set moment, and that is your window.

---

### L2. KUSINA (15×22, quota 5/5, par 80, bot 28 s)

**Current state**
- Top room, the kitchen: Mama cooks at [2,2] (`luto`: blind for 3.5 s), then patrols. Purse at [9,3].
- Middle room: Lola sleeps at [8,11], facing west. A piggy bank at [11,10] sits behind the sofa. Radio, lego, creak board.
- Bottom room: bunk beds, a tsinelas (slipper) to throw. Spawn and exit both here, again.
- Missions: silent, alkansya. The alkansya is at [1,2], right beside Mama's cooking spot.
- **Mechanics (7 new):** cooking routine, sleeper, tsinelas throw, radio lure, lego, creak, piggy bank, basket.

**Works**
- The alkansya next to the cooking spot is excellent. You steal it while she's blind at the stove: a lesson in reading routines.
- Lola's sleeper beside the piggy bank is a clear risk.

**Weak**
- Seven new concepts in level 2.
- Quota equals the total coins, so there's no choice.
- The bottom room has beds in a level called KUSINA.
- Same spawn and exit as SALA, so it feels like a re-skin of level 1.

**Recommendations**
- **[L2-a] Spread out the new mechanics.** *High*
  - Problem: See the pacing table in H.1. Levels 2–3 introduce about 13 concepts.
  - Why: Players forget tools they meet in a crowd, and later levels assume them.
  - Proposal: Keep cooking + sleeper + throw here. Move the radio and lego to level 3, and the lever/gate to level 4 or later.
  - Impact: Each tool gets its own "aha" moment.
- **[L2-b] Give the player a choice.** *Medium*
  - Problem: Quota 5 with 5 coins total.
  - Why: There is no decision to make.
  - Proposal: Add a third stash with a different risk, e.g. Mama's coin jar by the stove, worth 2. Keep quota 5.
  - Impact: First risk-versus-route decision.
- **[L2-c] Make the room match the name.** *Low*
  - Proposal: Turn the bottom room into a dining area: a table and chairs with rice and ulam (side dishes) on it.

**Memorable idea:** the rice cooker clicks to "warm" on a timer, with a loud beep that masks you (a small kitchen version of the videoke).

---

### L3. BUONG BAHAY (15×22, quota 6/8, par 110, bot 21 s)

**Current state**
- Spawn in the top-left bedroom.
- Lola sleeps in the top-right bedroom beside a bayong (woven bag, [12,2]). The red key is in her room at [13,5].
- Mama sweeps (`walis`) in the middle hall. Purse at [12,10].
- Tita patrols the bottom-left room. A lever at [5,16] opens a gate at [5,18] to the wallet at [2,19].
- The exit room, bottom right, is behind a red lock at [12,14].
- Missions: fast, noCatch.
- **Mechanics:** doors, keys, locks, lever/gate, bayong, wallet, Tita's phone cycle, sweeping routine.

**Works**
- The first true "house": a key in the sleeping grandmother's room is a lovely, readable risk.
- Doors blocking sight is taught by the layout itself.

**Weak**
- **The lever and gate can be skipped.** Purse (3) + bayong (3) = 6 = quota, so the wallet behind the gate is optional, and with it the only lever lesson in the game before BAKURAN.
- Bot 21 s against par 110 (5×) suggests "fast" is trivial. **Needs playtest.**
- The missions are generic.

**Recommendations**
- **[L3-a] Make the lever mandatory, or move it.** *High*
  - Problem: A teaching element that can be skipped teaches nothing.
  - Why: BAKURAN relies on timed gates.
  - Proposal: Put the key behind the gate, or set the quota to 7.
  - Impact: Every player learns levers.
- **[L3-b] Story hook: "Mama moved her purse."** *Medium*
  - Proposal: See S7. The level becomes a search: the purse isn't where it was in SALA.
  - Impact: Purpose, plus the first sign of suspicion.
- **[L3-c] Better missions.** *Low*
  - Proposal: Replace noCatch with `noWake` ("take the key without waking Lola").
  - Impact: The mission underlines the level's best moment.

**Memorable idea:** Lola talks in her sleep. A random "Apo...?" makes the player freeze, but it's harmless. That's comedy and tension in one line.

---

### L4. BOSS: LOLA'S SIESTA (15×22, quota 6/6, par 90, escape 25 s)

**Current state**
- The top half is a bedroom. Lola sleeps at [7,5] with a sleep-depth meter (every noise drains it) and `lightSleeper`.
- Three bayongs are placed in a ring 2–3 tiles from her. Around them: 3 creak boards and a lego. A radio at [13,6]. Four hiding spots.
- Phases:
  - 2 coins: shorter sleep cycles.
  - 4 coins: Mama spawns in the bottom room, checking hiding spots.
  - 6 coins: Lola wakes and hunts with a hair trigger. 25-second escape.
- Spawn [7,19] and exit [13,19] are in the bottom room.
- Missions: noWake, noTrap.

**Works**
- The depth meter is a genuine signature mechanic. It turns "be quiet" into a visible resource.
- Creak boards around the bayongs make the approach a puzzle.
- The missions match the theme.

**Weak**
- **Three bayongs for one Lola**, scattered on the floor: no logic.
- The **finale contradicts the boss.** A siesta boss becomes a chase, and hunting Lola moves at speed 24 while you sneak at 30, so you simply walk away. The route out is about 20 tiles, roughly 11 s sneaking, against a 25 s timer.
- Mama's spawn in the bottom room is the same "helper arrives" beat every boss uses.

**Recommendations**
- **[L4-a] A finale that fits a sleeper.** *High*
  - Problem: The hunt-and-escape template doesn't suit Lola.
  - Why: The climax should test the skill the fight taught: silence.
  - Proposal: At quota, Lola *half-wakes* and sits up listening (hair trigger, no hunting). The bedroom door creaks unless you open it slowly (hold), and the creak boards are now between you and the door. If you're heard: "APO!?", caught.
  - Impact: The finale becomes the hardest *quiet* moment instead of an easy walk.
- **[L4-b] Stashes with a reason.** *Medium*
  - Proposal: One bayong by her chair, plus her coin purse under the pillow (the riskiest stash, worth the most) and the alkansya.
  - Impact: Readable and believable, with a real risk gradient.
- **[L4-c] Drop the Mama spawn.** *Medium*
  - Proposal: Use the electric fan as the phase-2 event instead: it oscillates and switches off, so the room's white noise disappears. Noise radius grows.
  - Impact: An escalation that's unique to this boss.

**Memorable idea:** the fan's white noise as a moving mask. While it faces you, you're covered; when it turns away, you're exposed.

---

### L5. BAKURAN (15×22, quota 4/5, par 120, bot 31 s) — Bing joins before this level

**Current state**
- The house strip at the top holds the wallet (top-left room) and the piggy bank (top-right room, where Tatay patrols and dozes).
- The yard below: Aso (the dog) patrols a rectangle with sleep cycles. Laundry lines. A timed gate at [6,12] with a lever on each side (6 s).
- Spawn and exit are both in the bottom yard.
- Missions: noBark, fast.
- **Mechanics:** grass, laundry cover, the dog, pandesal (bread roll) as dog food, timed gates, Tatay, the dozing routine.

**Works**
- Laundry as walk-through cover is strong and readable.
- The dog plus pandesal is a clear tool-and-answer pair.

**Weak**
- **Bing just joined, and nothing here asks for Bing.** Nothing even tells the player they can switch to her. Character pick is only in the title menu (THE CREW).
- 4 of 5 coins needed: 3 + 2, so both stashes are forced anyway.

**Recommendations**
- **[L5-a] Each sibling's first level showcases their skill.** *High* (see H.3)
  - Problem: Joining is cosmetic.
  - Why: The KASABWAT promise ("partners") needs to show up in play.
  - Proposal: Start BAKURAN as Bing, or offer her on a level-start screen. Make one stretch of yard open lawn with no hiding spots, so her hide-anywhere TAGO is the answer.
  - Impact: The new partner matters the moment she arrives.
- **[L5-b] Dog behaviour with personality.** *Low*
  - Proposal: Aso wags and follows you for a few seconds after you feed him (a soft threat).
  - Impact: Charm, and a light second-order risk.

**Memorable idea:** a tsinelas thrown into the laundry knocks a shirt off the line, and the adult who sees it goes to pick it up. Laundry becomes a lure.

---

### L6. KWARTO (20×26, scrolling, quota 7/9, par 150, bot 57 s)

**Current state**
- Six rooms in three bands. Spawn in the bottom-left kitchen; exit at [18,1], top right, behind locks.
- Mama sweeps the middle hall. Lola sleeps in the top-left room by the wallet and the alkansya.
- Tita stands at [14,21], facing up, near the purse. The kuya enemy patrols the bottom-right room.
- The blue key at [17,16] opens locks at [9,5] and [14,9]. A TV and a radio.
- Missions: allCoins, noCatch.
- **Mechanics:** the scrolling camera, the kuya tattle, the TV.

**Works**
- The first big map. Edge arrows and the objective marker get room to shine.
- One key, two locks, and four stashes in different rooms make it a genuine route-planning level.

**Weak**
- Named KWARTO (bedroom), but it's a whole house with a kitchen.
- It introduces the kuya tattletale with no story, right before Ramil joins (S2).

**Recommendations**
- **[L6-a] Rename, or rebuild around the bedrooms.** *Low*
  - Proposal: Call it "BUONG BAHAY 2" / "GABI NG PAYDAY" (payday night: Tatay's wallet is fat), or make the kids' bedroom the centrepiece.
  - Impact: Coherence.
- **[L6-b] Introduce the tattletale with a scene.** *High* (part of S2)
  - Impact: The tattle mechanic arrives with a face and a motive.

**Memorable idea:** Kuya is on a video call. His phone screen lights the room, so his cone is visible only when he looks up.

---

### L7. GATAS (15×22, quota 3/5 + carry the milk, par 140, bot 45 s)

**Current state**
- The milk is at the fridge, [2,2], in the kitchen. Mama paces there.
- You must carry it to the exit, bottom right, through the middle room (Lola asleep, Tita patrolling) and a door at [7,17]. Running spills it.
- Coins: purse 3 or bayong 2. The quota of 3 means the purse, or both.
- Missions: noSpill, silent.
- **Mechanics:** carry, spill.

**Works**
- A distinct verb with built-in tension: slow, can't run, everything matters.
- The best "new rule" level in the mid-game.

**Weak**
- The coin quota dilutes the story beat. This level is about the milk.
- A spill has no consequence besides losing the mission.

**Recommendations**
- **[L7-a] Milk only, and spills become evidence.** *Medium*
  - Problem: Two goals blur one strong idea, and spilling costs nothing in-world.
  - Why: The most memorable version of this level is about *carrying something precious*.
  - Proposal: Drop the coin quota. A spill leaves a puddle and a drip trail that adults notice and follow ("Bakit basa dito?" — "Why is it wet here?"). That's the evidence mechanic from S8.
  - Impact: A focused, unique level, and suspicion grows through play.
- **[L7-b] Hiding with the bowl.** *Low*
  - Proposal: If hiding while carrying is allowed, make it slower or noisier. If it isn't, say so on screen.

**Memorable idea:** Mingming meets you halfway and meows, and you have to keep her quiet. A cat following you is noise you can't control.

---

### L8. BOSS: MAMA SA KUSINA (15×22, quota 7/7, par 110, escape 22 s)

**Current state**
- The kitchen is the arena. Mama patrols it while cooking: blind 3 s of every 11 while stirring. She checks hiding spots and throws a sandok (ladle; range 96, then 104).
- Three stashes in the kitchen.
- Phases:
  - 2 coins: faster, plus throws.
  - 5 coins: Kuya spawns in the lower room.
  - 7 coins: "KAIN NA! MAMA IS COMING!" She hunts at speed 40. 22-second escape.
- Spawn and exit are in the lower room.
- Missions: noCatch, noHide.

**Works**
- The most boss-like fight: a rhythm (the stir window) plus a projectile to dodge.
- The noHide mission is a great twist, since she checks hiding spots anyway.
- The final banner is funny and fits the culture.

**Weak**
- The Kuya spawn is the shared template again.
- The finale is the template: hunt plus escape.

**Recommendations**
- **[L8-a] A kitchen-specific escalation.** *High* (part of E.2)
  - Proposal: Phase 2: the pot boils over and Mama turns to it, so a timed blind spot opens at a predictable place. Phase 3: she calls "JUN! Set the table!" The goal becomes *being seated at the dinner table* (an "upo na!" spot) before she turns around, not reaching the door.
  - Impact: The only boss that ends at a *spot that isn't the exit*. Funny and memorable.

**Memorable idea:** "Upo na!" (sit down!) as the finish line. The kid who stole from her purse innocently eats rice while she glares.

---

### L9. GABI (night, 15×22, quota 6/8, par 120, KAIN NA 160 s, bot 43 s) — Ramil joins before this level

**Current state**
- Spawn in the top-left bedroom. Lola sleeps in the top-right bedroom beside a bayong; the blue key is there too.
- Kuya patrols the hall loop. Mama washes up in the bottom-left kitchen beside the purse.
- Two blue locks gate the lower rooms. A TV lure.
- Missions: noWake, alkansya.
- **Mechanics:** night, the KAIN NA (dinner) timer.

**Works**
- Night lighting changes the mood.
- Washing up as a blind routine next to the purse is a good, readable window.

**Weak**
- **Kuya is the tattletale here, right after Ramil joined** (S2).
- KAIN NA: 160 s against a 43 s bot run. Unless humans are 4× slower, the timer never matters. **Needs playtest.**
- This is the **only campaign level with a dinner timer**, yet the store sells a three-tier upgrade for it (H.4).

**Recommendations**
- **[L9-a] A Ramil showcase level.** *High* (see H.3)
  - Proposal: Start as Ramil. A long hall makes his long-range yell lure the obvious tool.
- **[L9-b] KAIN NA that matters.** *Medium*
  - Proposal: Tighten it to about 1.8× expected human time once a playtest gives a baseline. Add a 30-second "Jun! Hugas kamay!" ("wash your hands!") warning call that also makes Mama start walking toward the kids' rooms.
  - Impact: The timer becomes pressure, not decoration.

**Memorable idea:** the dinner bell schedule moves the whole household. At "KAIN NA" everyone walks toward the kitchen, and their routes change mid-level.

---

### L10. SAMPAYAN (22×26 yard, quota 7/9, par 160, bot 44 s)

**Current state**
- A big laundry yard. Tita patrols the top-left yard. Lola sleeps in the yard at [8,6]. A shed room top right holds a purse.
- Below: a band split by two gates (10 s each). Tatay waters plants (`dilig`). Aso patrols the bottom right.
- Spawn at the bottom middle; exit at [1,1], top left.
- Missions: noBark, allCoins.

**Works**
- The strongest cover level: long laundry lines, many loops (5 % open floor).
- A clear "cross the yard" goal from bottom to top.

**Weak**
- It's BAKURAN again: yard, dog, laundry, gates.
- Lola asleep in the open yard is odd.

**Recommendations**
- **[L10-a] Laundry that changes over time.** *Medium*
  - Problem: A reprise with no new idea.
  - Why: Mid-campaign levels need a new wrinkle to keep momentum.
  - Proposal: Tita *takes the laundry down* as the level goes on (`sampay` routine, in reverse). Cover disappears line by line, so the clock is a shrinking map. Optionally add wind gusts that lift the sheets for a second.
  - Impact: A memorable, mechanical identity for this level.
- **[L10-b] Lola in the yard.** *Low*
  - Proposal: Give her a duyan (hammock) or a bench under a mango tree, so the sleeping spot reads as intended.

**Memorable idea:** the last laundry line comes down and you're standing in the open, holding a bayong. (Played for comedy, not a forced catch.)

---

### L11. IBALIK (night, 15×22, put back 7/7, par 150, bot 47 s)

**Current state**
- Return 3 + 2 + 2 coins: to Mama's purse in the top-left bedroom, where Mama starts; to Lola's bayong beside sleeping Lola; to Tita's bag right beside Tita, who stands at [2,14].
- Kuya patrols the middle.
- No coins are paid out, only stars.
- Missions: silent, fast.

**Works**
- **The best story idea in the game.** The verbs are reversed, the stakes are moral, and the payout is zero.
- Putting things back *next to the owners* is the right kind of tension.

**Weak**
- Mechanically it's identical to stealing (hold at the stash).
- The emotional beat has no close: there's no scene after.

**Recommendations**
- **[L11-a] Make giving feel different.** *Medium*
  - Proposal: Coins in your pocket jingle when you run, so you are *loud* until you've put them back. That's the reverse of normal levels, where you get louder as you steal. The clasp click at each return stays.
  - Impact: The level plays differently, not just reads differently.
- **[L11-b] An AFTER scene.** *High* (S4)
  - Proposal: Mama finds the money ("Ay, nandito pala!"). Jun: "No more money. Only food."
  - Impact: Closes the arc beat and sets up the rest of the game.

**Memorable idea:** Mama, half-asleep, mumbles "salamat..." as the clasp clicks. She doesn't know who it was. The player does.

---

### L12. BOSS: TATAY + ASO (15×22, quota 7/7, par 120, escape 25 s)

**Current state**
- The top is the yard: Aso (dog), a scent tracker with big ears. The bottom is the house: Tatay follows the dog's barks and checks hiding spots.
- **One** pandesal, at [7,16].
- Phases:
  - 3 coins: the dog speeds up and picks up your scent.
  - 5 coins: Tatay speeds up, Kuya spawns.
  - 7 coins: both hunt. 25-second escape.
- Spawn and exit are in the bottom room.
- Missions: noBark, noCatch.

**Works**
- A boss *pair* with a link you can exploit: bark → Tatay. "Pandesal splits them" is a clear strategic idea.

**Weak**
- **The signature tool is single-use.** Waste the only pandesal and the fight's strategy is gone.
- **The fish is missing.** The scene says "Who keeps taking my fried fish?" and "Mingming needs that fish", but there's no fish in the level.
- Third boss with a Kuya spawn.

**Recommendations**
- **[L12-a] Tatay's fried fish as the carried objective.** *High*
  - Problem: The story promise isn't delivered, and the boss lacks a centrepiece.
  - Why: The dog *smelling the fish you're carrying* is the most natural mechanic imaginable.
  - Proposal: The fish is a `carry` target. While you hold it, the tracker dog follows the fish's scent trail and barks, and the barks draw Tatay. Pandesal (from a bread bag that refills) buys you seconds.
  - Impact: The best boss concept in the game. It ties story, item and enemy together.
- **[L12-b] Remove the Kuya spawn.** *Medium*
  - Proposal: Phase 2 instead: Tatay unchains the dog, which then has a longer route.

**Memorable idea:** the dog gets the fish if you drop it, and Tatay laughs: "Ikaw pala!" ("so it was you!"), said to the dog. Comic relief, and a "fail" that becomes a tactic.

---

### L13. PALENGKE (28×30, quota 8/10, par 190, bot 44 s) — Nene joins before this level

**Current state**
- A big market: four rows of stall blocks with awnings that block sight. Two tinderas (vendors) at stalls: one counting money, one chatting.
- Mama stands mid-market sweeping her gaze. Kuya patrols a long horizontal loop. Tatay patrols the bottom row.
- Four stashes: purses at stalls, a wallet, a piggy bank.
- Missions: noCatch, allCoins.

**Works**
- The best-looking level, with a distinct identity (concrete, striped awnings).
- 23 islands give lots of loops: the most stealth-rich map.
- Tinderas who shout but stay by their stalls are a clever archetype.

**Weak**
- Stealing from vendors (S1).
- **Aling Nena is missing from her own market.** The scene before happens at her stall, but she isn't in the level.
- Your whole family is at the market, with no reason given.

**Recommendations**
- **[L13-a] Rework it as an errand.** *Critical* (part of S1)
  - Proposal: Reach Nena's stall and get back unseen by family and gossiping tinderas. Errand pickups replace purses.
- **[L13-b] Nene showcase.** *High* (H.3)
  - Proposal: Her "freeze watchers" skill on a tindera lets you slip past a choke point. Her fast kupit suits the errand pickups.

**Memorable idea:** the tinderas gossip about Jun to each other (*kwento* routine), and the bubble text gets closer to the truth each time you're spotted ("Anak ni Mare 'yon... may pusa daw?" — "That's Mare's kid... they say he has a cat?").

---

### L14. BOSS: NINANG'S FIESTA (15×22, quota 6/6, par 120, escape 25 s)

**Current state**
- The upper hall: 3 Ninangs, Tita, Tatay, 2 bisita (guests), a radio, and a videoke at [7,9] that masks sound while someone sings.
- Three purses. One, at [7,10], sits right under the videoke.
- The lower room: spawn, plus one guest.
- Phases:
  - 2 coins: another Ninang.
  - 4 coins: Kuya.
  - 6 coins: the boss Ninang hunts. 25-second escape.
- Missions: noHide, noCatch.

**Works**
- The purse under the videoke is excellent intentional design.
- Crowd blending plus the videoke rhythm make a strong, distinct ruleset.
- The noHide mission suits a party where you blend instead of hide.

**Weak**
- **Which Ninang is the boss?** Three to four identical Ninangs, and the boss is index 0.
- Guests and Ninangs look alike, so threat and safety are hard to tell apart (F.3).
- It looks like any house level: same wood floor, a few checked tables. Not festive.
- The pamasko inversion (S6). A fourth Kuya spawn.

**Recommendations**
- **[L14-a] One Ninang, with personality.** *High*
  - Proposal: A single boss Ninang in a distinct outfit (big hair, fan, gold jewellery). The other adults are named relatives (Tito, Tita). Phase 2: Ninang starts *handing out* envelopes and calls the kids over by name. If she calls "JUN!" you must go to her (a forced approach) or the crowd turns to look.
  - Impact: A boss with a face and a social mechanic nobody else has.
- **[L14-b] Party dressing.** *Medium*
  - Proposal: Banderitas (string flags), a lechon (roast pig) table, a pabitin (prize lattice) that kids crowd under (moving cover), monobloc chairs.
- **[L14-c] The "PARA KAY JUN" envelope.** *Medium* (S6)

**Memorable idea:** the group photo. "Picture! Picture!" Everyone freezes for a three-second countdown, and if you're in the frame you're caught *on camera*. Or you blend in and end up in the family photo. That photo could even appear on the epilogue screen.

---

### L15. BARANGAY HALL (26×34, quota 9/12, par 230, bot 56 s)

**Current state**
- A central plaza strip with a tricycle running north–south down the middle. Six side houses (two locked, with a red→blue key chain). A bottom street.
- Tanod (watchman): sweeping flashlight, whistle that calls everyone. Tatay sweeps the street. Lola, Tita and Kuya sit in neighbours' houses.
- Five stashes. Exit at the top of the plaza.
- Missions: noCatch, allCoins.

**Works**
- The tanod's flashlight and the tricycle hazard are distinct, readable late-game threats.
- The red→blue key chain across houses is good route planning.

**Weak**
- Burglary of neighbours (S1).
- Named "Barangay Hall", but it's a neighbourhood. No hall.
- **It comes after the chapter boss**, which is an anticlimax, and it's the longest level in the game.
- Jun's own family members are sitting in strangers' houses.

**Recommendations**
- **[L15-a] Rework it as the vaccination-drive run.** *Critical* (part of S1)
  - Proposal: Carry Mingming in a box (`carry`; she meows on a timer, a moving noise source) to the barangay hall's free bakuna desk and back past the curfew tanod.
- **[L15-b] Reorder Chapter 4.** *Medium*
  - Proposal: PALENGKE → BARANGAY → FIESTA (boss), so the chapter ends on its boss like the others.

**Memorable idea:** the tanod's whistle is the curfew signal. After it, the street lights go out section by section.

---

### L16. BOSS: BAGYO (night storm, 15×22, quota 4 kittens, par 150, escape 45 s)

**Current state**
- The house strip at the top holds spawn and exit. The yard has Mama with a sweeping flashlight. The crawlspace below holds four kitten targets that meow as you pick them up.
- Thunder every 7 s for 2.4 s masks all noise.
- Phases:
  - 2 kittens: Tatay searches the crawlspace.
  - 4 kittens: "THE WATER IS RISING! TAKBO!" Mama speeds up. 45-second escape.
- On clear, the ENDING plays (HULI KA!).
- Missions: thunder, noCatch.

**Works**
- Thunder as rhythm is a great finale rule: it rewards the patience the whole game taught.
- The stakes are emotional, the kittens meowing is the right touch, and the catch-then-forgive ending lands.

**Weak**
- **No rising water.** The banner promises a mechanic that doesn't exist; it's only a timer, and a generous one (about 4× the run).
- **The crawlspace looks like interior rooms** (wood floor, walls), not the hideout the player has stared at on the home screen for 15 levels.
- Mingming herself isn't distinct: four identical `kuting` targets.
- For the finale it's small (15×22) and has only two adults.
- Lightning is only a warning flash, so the storm helps you but never hurts you.

**Recommendations**
- **[L16-a] Real flooding.** *High*
  - Problem: A false promise in the climax.
  - Why: Players notice when a banner lies, and the finale should be the most dynamic level.
  - Proposal: After the last kitten, the lowest rows turn to water tile by tile: slower, splashing, noisy outside thunder. The crawlspace exit floods first, forcing a different route out. That also fixes out-and-back.
  - Impact: A climax with real momentum.
- **[L16-b] Lightning reveals, thunder hides.** *High*
  - Proposal: During the flash, every cone extends and catches silhouettes, so you're *seen*. During the roll, you're *unheard*. That is a two-sided rhythm: stop at the flash, move on the thunder.
  - Impact: The finale's mechanic becomes the game's most sophisticated rule, built from what already exists.
- **[L16-c] The crawlspace is the hideout.** *Medium*
  - Proposal: Use the hub art: dirt floor, posts, the cat box, the bowl and blanket the player bought (reflecting `save.needs`). Mingming is the last and slowest pickup.
  - Impact: A huge emotional payoff for the hub, and the player's purchases matter in the finale.
- **[L16-d] Stage the catch in the game itself.** *Medium*
  - Proposal: At the exit door, the lights come on and the whole family stands in the doorway, in-engine, a second before the HULI KA panel.
  - Impact: Smooths the jump from "you succeeded" to "you're caught".

**Memorable idea:** the last kitten won't come out. You must wait for thunder, because it only comes to you when the noise stops scaring it.

---

### L17. HINGI (epilogue, 15×22, quota 10/10, no stars)

**Current state**
- Every adult is harmless. Walk up to each of five people (Lola, Tatay, Mama, Tita, Aling Nena) and press HINGI. Each gives a gift with a line.
- One sleeping cat. Three kittens follow you.
- Exit in the yard.

**Works**
- The verb swap is the thesis of the game made playable. Each gift line is warm and specific.

**Weak**
- The HUD still shows DASH, THROW and SKILL. Combat tools in a level about not sneaking undercut the point.
- Two laundry tiles in the yard ([7,20], [8,20]) render as a coloured "||||" block with no poles. In the screenshot it reads as a glitch.
- The siblings aren't there.
- Aling Nena stands in Jun's yard with no reason given.
- The interaction is a one-line toast. The level ends when the bar fills.

**Recommendations**
- **[L17-a] Strip the stealth HUD.** *Medium*
  - Proposal: No dash, throw or skill buttons. The action button reads HINGI. Hide the exit's "LOCKED" label; the door simply opens.
- **[L17-b] Small conversations.** *Medium*
  - Proposal: Each HINGI opens a two-line panel with that person's portrait (the story system already exists), and the siblings appear around the house. Tatay's gift is the next fried fish (callback to L12); Lola's comes with the Mama-was-the-same reveal (S5).
  - Impact: The emotional coda the whole game builds toward.
- **[L17-c] Fix the laundry rendering.** *Low*
  - Proposal: Add a pole or line sprite, or remove those tiles.

**Memorable idea:** end on the group photo from L14. Everyone, cats included, with Jun in the middle this time.

---

## D. Rooms and environment

**[D1] One house, many layouts.** *Medium (large scope; the highest-impact environment change)*
- **Problem:** Fourteen of 17 levels are in Jun's house, and each draws the house differently. The kitchen sits top left in KUSINA, bottom left in KWARTO, and top in GATAS and MAMA.
- **Why it's a problem:** Players never learn the house. Stealth games get much of their depth from *knowing a place and seeing it change* (familiarity → mastery → subversion). With no continuity, every level feels like a random room set.
- **Proposal:** A canonical Jun's house: a ground floor (sala, kusina, dining), the bedrooms, the yard and sampayan, the crawlspace. Levels become *situations* in it: night, siesta, dinner, payday, typhoon. Each opens a subset of rooms and adds story changes (the purse moves, a door gets locked). If that's too big, a cheaper version: keep the layouts, but give each named room a fixed look and position, so the kitchen is always top left with the same counter and ref.
- **Expected impact:** Coherence, environmental storytelling, and "my house" attachment that makes the storm finale hit harder.

**[D2] Stashes don't sit anywhere believable.** *Medium*
- **Problem:** Purses, bayongs and wallets sit on bare floor, mid-room. The validator requires objects on plain floor, so this is systemic.
- **Why it's a problem:** Every room looks staged. Real stealth fantasy is "Mama's bag on the sofa, Tatay's wallet in his pants on the chair".
- **Proposal:** Draw stashes on or beside furniture (sofa arm, side table, bedside, nail on the wall), approached from a floor tile. Pair each stash with its owner's habit.
- **Expected impact:** Rooms tell who lives there. The stealing fantasy becomes specific.

**[D3] Level names don't describe the level.** *Low*
- **Problem:** KUSINA has beds; KWARTO is the whole house; BARANGAY HALL has no hall.
- **Proposal:** Rename to the *situation* (e.g., "SIESTA", "PAYDAY", "HAPUNAN") or fix the contents. This follows naturally from D1.

**[D4] Room identity props.** *Medium*
- **Problem:** House rooms share one wood floor and one wall strip (clock, windows, shelves). Rooms are interchangeable at a glance.
- **Proposal:** One signature prop per room type:
  - Sala: altar with Santo Niño, family photos, electric fan, TV.
  - Kusina: rice cooker, *banga* (clay water jar), dish rack.
  - Kids' room: banig (sleeping mat), school bags.
  - Lola's room: rosary, the old photo (S5).
  - Yard: mango tree, *batya* (wash basin).
  The props can double as mechanics: the fan as noise cover, the rice cooker beep (L2).
- **Expected impact:** Instant readability and authenticity.

**[D5] Empty filler space.** *Medium*
- **Problem:** `level-lint` shows little open floor in most levels, but several have whole rooms with no threat and no reward: the bottom of SALA and LOLA'S SIESTA, the lower room of FIESTA.
- **Proposal:** Every room gets a purpose: a threat, a reward, a shortcut or a story beat. Otherwise cut it.

**[D6] Transitions.** *Low*
- **Problem:** Levels open and close abruptly: a hint banner, then the level, then a results card.
- **Proposal:** A two-second establishing beat at level start: the camera pans from the stash to the player, the way the camera can already follow. It shows the goal before control begins.

---

## E. Enemies, bosses, combat

### E.1 Roster

| Type | Verb | Verdict |
|---|---|---|
| Mama | patrols, does chores; sandok throws as a boss | Core, good. Over-used (11 levels). |
| Lola | sleeps in cycles; depth meter as a boss | Strong idea. Only ever stationary outside her boss (10 levels). |
| Tita | phone breaks (blind and deaf) | Good rhythm guard. No story identity (S3). |
| Tatay | fast patroller | Plain. Becomes interesting only with the dog. |
| Kuya | tattletale shout | Good mechanic, broken identity (S2). |
| Aso | barks, eats pandesal, tracks scent | Strong. Single pandesal is a trap (L12). |
| Tanod | sweeping flashlight, whistle | Good late threat. |
| Tindera | tattle + leash to her stall | A Kuya reskin, but the leash makes it distinct. Fine. |
| Ninang | stats only | **No unique behaviour.** A boss with none (L14). |
| Bisita | moving cover, blending | Good. Too similar in look to the Ninangs (F.3). |
| Tricycle | timed hazard | Good, used once. |

**[E1] Mama and Lola everywhere.** *Medium*
- **Problem:** Mama appears in 11 levels and Lola in 10, usually in the same role. When Mama's own boss arrives, she isn't special.
- **Proposal:** Rotate who's home. Mama is at the market in Chapter 4. Lola is the threat only in Chapter 1 and the finale. Let each family member's chapter be where they're the main watcher, so their boss is the peak of that chapter's study.
- **Expected impact:** Each boss feels like the culmination of what you learned about that person.

### E.2 Bosses

**[E2] All five bosses share one structure.** *High*
- **Problem:** Every boss is: coin thresholds → retune → spawn a helper (Kuya in 3 of 5) → final hunt + escape timer. The tests *require* "the last phase fires at the quota and has an escape timer, and the boss checks hiding spots."
- **Why it's a problem:** By boss 3 the player knows the script. Bosses are where a game should be most distinctive.
- **Proposal:** Give each boss its own climax, and relax that test rule to "a boss has a distinct final phase":

| Boss | Finale |
|---|---|
| Lola | Silent exit past a half-awake listener (L4-a) |
| Mama | Be seated at the table before she turns: "Upo na!" (L8-a) |
| Tatay + Aso | Carry the fish out while the dog tracks its scent (L12-a) |
| Ninang | The group-photo countdown, plus her calling you by name (L14-a) |
| Bagyo | Rising water plus lightning reveals (L16-a, b) |

- **Expected impact:** Five memorable set pieces instead of one, repeated.

**[E3] Escape timers have no teeth.** *High (needs playtest)*
- **Problem:** Rough sneak times from the last stash to the exit:
  - Lola: about 11 s against 25 s.
  - Mama: about 11 s against 22 s.
  - Bagyo: about 12 s against 45 s.
  Lola hunts at speed 24, while you sneak at 30.
- **Why it's a problem:** The finale should be the tensest moment. With 2–4× slack it's a walk.
- **Proposal:** Measure in the playtest, then target about 1.5× the human sneak time, and make the hunter faster than your sneak speed but slower than your run (Tatay already does this at 42). With E2, several bosses no longer need an escape timer at all.
- **Expected impact:** Climaxes that feel like climaxes.

**[E4] Helper spawns are repetitive.** *Medium*
- **Problem:** Kuya spawns in MAMA, TATAY and FIESTA; Mama spawns in LOLA.
- **Proposal:** Replace them with environmental escalations unique to each arena (see the per-level notes).

**[E5] Bosses tie into the story unevenly.** *Medium*
- **Problem:** Lola, Mama and Tatay are family, with motives in the scenes. Ninang has no relationship to Jun on screen. The storm has none of that.
- **Proposal:** S6 ("PARA KAY JUN") gives Ninang a reason to be in the story. The storm's "boss" is the weather, and the family as searchers fits, so keep it.

---

## F. Sprites, characters, visual identity

From `sheet.png` and the QA captures.

**Works**
- The code-drawn chibi style is consistent across 12 characters and the cats.
- Faces read at 16 px, and the portraits have four clear moods.
- The palette is warm and cohesive.
- The title skyline with capiz windows and the Pasko parols has real charm.
- PALENGKE's awnings and BAGYO's storm lighting are the most atmospheric scenes.

**[F1] Adults are the same size as kids.** *High*
- **Problem:** Mama, Tatay and Lola are drawn at the same height and build as Jun (seen in SALA, FIESTA and HINGI).
- **Why it's a problem:** It hurts readability (threat versus self should read instantly) and theme (a small kid in a house of big adults is the game's whole fantasy). Bing's "I am small, nobody sees me" has no visual support.
- **Proposal:** Adults about 1.3–1.4× the kid's height, with wider shoulders. Bing visibly smaller than Jun, and Ramil taller (a teen). Keep big heads for faces.
- **Expected impact:** Instant threat reading, and the fantasy becomes visible.

**[F2] Threats and harmless people look alike.** *High*
- **Problem:** At the fiesta, guests and Ninangs share builds and palettes. Only the cone tells them apart.
- **Proposal:** A visual rule: harmless characters in soft, desaturated tones with no cone. Watchers get a strong silhouette accessory (Ninang's fan and big hair, Tanod's cap and vest, Tindera's apron). Optionally, a tiny eye icon over every watcher's head when you're near.
- **Expected impact:** Fair blending play, and the fiesta reads at a glance.

**[F3] The crawlspace and the hub don't match.** *Medium* (L16-c)

**[F4] Story scenes use the same backdrop.** *Medium*
- **Problem:** Every scene, from the kitchen to the market to the typhoon, plays over the faded title skyline.
- **Proposal:** Five or six simple backdrops: under the house, the kitchen, the market stall, the fiesta, the storm with rain, and the sala for the ending. Reuse the level tiles at low contrast.
- **Expected impact:** Scenes feel located. The ending in a rain-soaked sala with lights on will hit much harder.

**[F5] Visual bugs seen in the QA captures.** *Medium — verify*
- On the clear screen (`desktop-clear-stars.png`), the player sprite draws on top of the "NICE KUPIT!" headline, between the words, undimmed.
- In HINGI, the laundry tiles render as an unexplained "||||" block (L17-c).

**[F6] Motion.** *Not inspected*
- I could only see stills. Things to check by eye: idle animations (are adults alive while they wait?), the stir and phone poses, the chase run, and the catch.

---

## G. Main menu and UI/UX

**Works**
- One primary button on the title (NEXT: …) with six secondary ones: correct hierarchy.
- The hideout panel on the home screen is the game's emotional anchor.
- The pause screen shows the missions.
- Tips sit at the top, away from your thumbs.
- Options are broad (shake, flash, pulse, left-handed). Few small games manage that.

**[G1] The top HUD strip overlaps the map.** *High*
- **Problem:** Coins, chances, level name and timer are drawn straight over the top wall row (clocks, windows, shelves). The level name is hard to read in every capture.
- **Why it's a problem:** Glance-ability during stealth is critical.
- **Proposal:** A solid or 80 % opaque HUD band, with the map pushed down or the camera offset by one row.
- **Expected impact:** Legibility, and a cleaner, more professional frame.

**[G2] The mission card covers the play area.** *Medium*
- **Problem:** For 5 s at level start the three-mission card sits mid-map, exactly where the player is reading the layout.
- **Proposal:** Show missions on a short pre-level card (combined with the crew pick, H.3). In play, dock it under the HUD as one line.

**[G3] The map is a list, not a barangay.** *Medium*
- **Problem:** The "BARANGAY MAP" is a vertical list of identical house icons on a dotted road. The title bar overlaps the first chapter header, and the "^" arrow overlaps the title. Each entry shows PAR even when "fast" isn't one of that level's missions (e.g., KUSINA, GATAS), which hints at a goal that doesn't exist.
- **Proposal:**
  - An illustrated top-down barangay: Jun's house (rooms light up per level), the market, the chapel or fiesta plaza, the barangay hall, the creek for the storm. Chapters become neighbourhoods.
  - Show the level's actual missions and the alkansya state, not par.
  - Fix the header overlap.
- **Expected impact:** Progress feels like a journey through a place, not a checklist.

**[G4] The store has no personality.** *Medium*
- **Problem:** A flat list, with "FOR MINGMING AND THE KITTENS" repeated in near-invisible grey on every row. Aling Nena, the ally, is never shown.
- **Proposal:** Her portrait at the counter with a line that changes as the story goes on. Remove the repeated subline. Show what each item *does to the hideout* (a small preview).
- **Expected impact:** The store becomes a place and a relationship.

**[G5] Crew pick is buried in the menu.** *High* (H.3)

**[G6] The title tagline doesn't fit the story.** *Low*
- **Problem:** "SNEAK. KUPIT. ESCAPE." describes a heist game.
- **Proposal:** "PARA KAY MINGMING" ("for Mingming"), with "SNEAK. KUPIT. ESCAPE." under it.

**[G7] Post-game messaging.** *Low* (see H.5)

**[G8] Docs out of date.** *Low*
- **Problem:** The README intro says "His family works it out long before he does", which contradicts the settled ending. `package.json`'s description is from before the story.
- **Proposal:** Update both.

---

## H. Gameplay depth and replayability

### H.1 Pacing of new mechanics

| Level | New |
|---|---|
| 1 SALA | move, cones, kupit |
| 2 KUSINA | cooking routine, sleeper, throw, radio, lego, creak, piggy, basket (**7**) |
| 3 BUONG BAHAY | doors, keys, lever/gate, bayong, wallet, phone cycle, sweeping (**6**) |
| 4 LOLA | depth meter, light sleeper, hide checks, boss phases, escape |
| 5 BAKURAN | yard, laundry, dog, pandesal, timed gates, dozing, + Bing |
| 6 KWARTO | scrolling, tattle, TV |
| 7 GATAS | carry |
| 8 MAMA | stir cycle, sandok |
| 9 GABI | night, KAIN NA, + Ramil |
| 10 SAMPAYAN | (none: a yard reprise) |
| 11 IBALIK | give back |
| 12 TATAY | dog-follow, tracker |
| 13 PALENGKE | stalls, tinderas, + Nene |
| 14 FIESTA | crowd blend, videoke |
| 15 BARANGAY | tanod, tricycle |
| 16 BAGYO | thunder |
| 17 HINGI | ask |

**[H1] Front-loaded, then a mid-game lull.** *High*
- **Problem:** About 13 concepts arrive in levels 2–3, and SAMPAYAN adds nothing.
- **Proposal:** Spread the concepts out (L2-a). Give SAMPAYAN its laundry-removal twist (L10-a). After a mechanic is introduced, give it a "twist" level later on: KAIN NA beyond GABI, the tricycle beyond BARANGAY.
- **Expected impact:** A steady cadence of "something new" for the whole campaign.

### H.2 Choice inside levels

**[H2] Quota often equals the total.** *High*
- **Problem:** In 8 of 17 levels the quota equals every coin available: SALA, KUSINA, all five bosses, IBALIK. Even where there's slack, the slack is often one stash.
- **Why it's a problem:** Stealth thrives on choosing *which* risk to take. A forced checklist is the opposite.
- **Proposal:** Standard rule: total coins are about 1.4× the quota, spread across stashes of different risk. The riskiest stash (beside a sleeper, in a guarded room) pays the most. The allCoins mission is the challenge for completionists.
- **Expected impact:** Every run is a plan, which helps replay a lot.

### H.3 The crew

**[H3] Siblings join in story but not in play.** *High*
- **Problem:** Characters are picked only from the title (THE CREW). No level asks for a particular sibling, and none is designed around one.
- **Proposal:**
  - A pre-level card: missions, plus "WHO GOES?" with the crew portraits. Recommend a kid per level; any is allowed.
  - Each sibling's join level is built so their skill is the elegant solution: BAKURAN (Bing), GABI (Ramil), PALENGKE (Nene).
  - Later, one or two "tag-team" levels where you switch kids at set points, e.g. Bing distracts, Jun steals. That's the KASABWAT fantasy.
- **Expected impact:** The cast becomes gameplay. Replays gain a "try it with Nene" axis.

### H.4 Economy and rewards

**[H4] The cats' needs are only 24 % of the economy and run ahead of the story.** *High*
- **Problem:** Needs total 70 coins, out of 294 total; 224 goes to gear. Typical income passes 90 coins by level 8, so all five needs can be bought by mid-campaign. That is before the scenes say "the coins never last" (level 8) and "they need a vet soon" (level 14).
- **Why it's a problem:** The emotional reason to collect coins is used up halfway through, and the story then contradicts the hub, where the kittens are already "healthy and loud".
- **Proposal:** Unlock each need in the store when its story beat happens (the vet after the fiesta scene, or via the vaccination-drive level in S1). Keep the prices. Gear stays as the long-tail sink. Optionally add two late needs (a collar, a name tag) for Chapter 4.
- **Expected impact:** The hub and the story move together, and every chapter has a "this is what I'm saving for" goal.

**[H5] PASENSYA is a near-dead upgrade.** *Medium*
- **Problem:** It costs 31 coins over three tiers for KAIN NA, which appears in one campaign level (GABI) and in Random House at difficulty 3 and up.
- **Proposal:** Either add KAIN NA to two or three more campaign levels (see L9-b), or swap the upgrade for something used everywhere, e.g. a "soft-close" for doors.

**[H6] Mission variety.** *Medium*
- **Problem:**
  - noCatch is used in 8 levels; fast, silent and allCoins in 4 each.
  - Five defined missions are unused in the campaign: ghost, noThrow, noRun, noSkill, noDevice.
  - Fast pars sit at 2.5–5× bot time, so they're probably easy. **Needs playtest.**
- **Proposal:** Give each level at least one mission that only makes sense there:
  - BUONG BAHAY: "take Lola's key without waking her".
  - GATAS: "deliver without a single drop".
  - IBALIK: "return every coin while its owner is in the room".
  - FIESTA: "end up in the group photo".
  Use noCatch sparingly.
- **Expected impact:** Each level's stars teach its identity, and replays mean something.

### H.5 Secrets and post-game

**[H7] The alkansya is the only secret.** *Medium*
- **Problem:** One hidden piggy bank per level, and the map's "?" already tells you it exists.
- **Proposal:** Add one story collectible per chapter, *alaala* (memories): Mama's old cat photo (S5), Tatay's note about the missing fish, Lola's rosary story. They unlock a "family album" page in the hideout and foreshadow the twist.
- **Expected impact:** Exploration gains story value, and the twist is earned.

**[H8] Post-game contradicts the moral.** *Medium*
- **Problem:** After "you never have to kupit", Random House, Daily House and replays are still about kupit. Tigre follows you as you steal.
- **Proposal:** Frame post-game explicitly. Random House is "LARO NG MAGKAKAPATID" (the siblings' game: tagu-taguan, hide and seek, with pretend coins). Or post-game daily houses use IBALIK rules: sneak *gifts* into the family's things as surprises. The Daily share card keeps working either way.
- **Expected impact:** The ending's lesson survives into the long tail.

**[H9] Ghosts, Daily, streaks.** Keep. Low-cost, high-retention features that are already built.

---

## I. What should remain unchanged

- The core verbs: hold-to-kupit with progress that drains slowly, sneak/run noise, hiding, throwing.
- **Path-based noise** (walls stop it, doors muffle it): the best system in the game.
- **Routines** (cooking, phone, dozing make adults blind; sweeping, TV narrow the cone). Strong and readable.
- **Cover tiles**: laundry you walk through, stalls, wardrobes. **Masking**: videoke, thunder.
- **IBALIK**, **GATAS** (carry), **HINGI**: the three story-rule levels are the most original content.
- Lola's **sleep-depth meter**; Mama's **stir window** and **sandok**; **Tatay follows the dog's barks**.
- The **hideout home screen** that grows with the kittens.
- The **HULI KA!** ending framing, and the caught-then-forgiven script (settled).
- **Missions that stay earned**, ghosts, the Daily House with streak and share card, accessibility options.
- The three-chances catch rule, and returning a third of the coins on a catch.

---

## J. Prioritised recommendation index

| ID | Recommendation | Priority |
|---|---|---|
| — | Run the silent playtest before any tuning (release gate) | **Critical** |
| S1 / L13-a / L15-a | Chapter 4: stop theft from strangers; palengke errand + vaccination-drive run | **Critical** |
| S2 / L6-b | Separate the tattletale from Kuya Ramil | **Critical** |
| S3 | Siblings in the ending; give Tita a story role | High |
| S4 / L11-b | IBALIK after-scene; "only food" from then on | High |
| E2 / L4-a / L8-a / L12-a / L14-a / L16-a,b | A distinct finale per boss; relax the boss-template test | High |
| E3 | Escape timers about 1.5× human time; hunters faster than sneak speed | High (playtest) |
| L12-a | Tatay's fried fish as the carried, scent-tracked objective | High |
| L16-a,b | Real rising water; lightning reveals, thunder hides | High |
| H3 / L5-a / L9-a / L13-b / G5 | Pre-level "who goes?" pick; sibling showcase levels | High |
| H4 | Unlock cat needs on story beats | High |
| H1 / L2-a / L3-a | Spread out the new mechanics; make the lever mandatory | High |
| H2 | Total coins about 1.4× quota with risk-graded stashes | High |
| C-wide | Fix out-and-back: separate entry and exit routes in 8 levels | High |
| L1-a | Stage seen → hide → search in the tutorial | High |
| F1 | Adults taller than kids; Bing smaller, Ramil taller | High |
| F2 | Threat versus harmless visual rule | High |
| G1 | Solid HUD band | High |
| S5 | Mama-was-the-same twist via Lola, foreshadowed | Medium |
| S6 / L14-c | Pamasko fix; "PARA KAY JUN" envelope | Medium |
| S7 / S8 | Two-panel beats for the scene-less levels; suspicion shown in the maps | Medium |
| L7-a | GATAS: milk only, spills as evidence | Medium |
| L10-a | SAMPAYAN: laundry comes down over time | Medium |
| L11-a | IBALIK: pocket coins jingle | Medium |
| L14-a,b | One Ninang with personality; party dressing; group photo | Medium |
| L15-b | Reorder Chapter 4 so it ends on its boss | Medium |
| L16-c,d | Crawlspace equals the hideout; in-engine catch | Medium |
| L17-a,b | HINGI: no stealth HUD; small conversations | Medium |
| D1 | Canonical house (or at least fixed room positions) | Medium (large) |
| D2 / D4 / D5 | Stashes on furniture; room props; no empty rooms | Medium |
| E1 / E4 | Rotate who's home; no repeated helper spawns | Medium |
| F4 / F5 | Scene backdrops; verify the two visual bugs | Medium |
| G2 / G3 / G4 | Mission card placement; illustrated map; store with Nena | Medium |
| H5 / H6 / H7 / H8 | PASENSYA; level-specific missions; alaala collectibles; post-game framing | Medium |
| L1-b / L2-b / L3-b / L9-b | SALA teleserye, KUSINA third stash, BUONG BAHAY purse moved, KAIN NA tuning | Medium |
| L1-c / L2-c / L3-c / L5-b / L6-a / L7-b / L10-b / L17-c | Small per-level fixes | Low |
| D3 / D6 / G6 / G7 / G8 | Names, transitions, tagline, post-game messaging, docs | Low |

### Suggested order of work, once approved

1. **Story fixes (no new systems):** S2, S3, S4, S6 and the S1 reframing. These are mostly scene text and level files.
2. **Bosses:** E2 + E3 + L12-a + L16-a,b. The biggest jump in memorability.
3. **Crew and economy:** H3 + H4. Make the story's structure playable.
4. **Readability pass:** F1, F2, G1.
5. **Level pass:** out-and-back, H2 quotas, H1 pacing, the per-level items.
6. **Environment** (D1/D4) and the **map and store** (G3/G4), if the scope allows.
7. Playtest between every step. The bot tells you a level can be finished, not whether it's good.

---

## Audit checklist

| Area | State |
|---|---|
| Story: every scene, ending, epilogue, chapters | ✅ inspected |
| Levels 1–17, every object and route | ✅ inspected individually |
| Rooms and environment | ✅ from maps + 6 level captures (levels 1, 4, 13, 14, 16, 17) |
| Enemy roster and stats | ✅ |
| All 5 bosses and their phases | ✅ |
| Sprite sheet, portraits | ✅ (stills only) |
| Title, map, store, crew, clear, ending screens | ✅ (captures + code) |
| Pause, caught, help, options | ✅ code; captures exist but were not all viewed |
| Economy, upgrades, cosmetics, missions | ✅ |
| Random House / Daily House | ⚠️ rules only; no generated layout seen |
| Animation in motion, music, sound effects | ❌ not inspectable here |
| Feel and difficulty with a human | ❌ no playtest data exists |
| Phone hands-on ergonomics | ❌ not inspected |
