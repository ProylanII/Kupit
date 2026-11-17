# Level review: difficulty and flow, level by level

Date: 2026-11-17. Branch `design-overhaul`, after the new L1 tutorial. Nothing here has been changed in the game yet,
except L1 itself (see L1 below). Each proposed change has an ID (LR-1, LR-2...) so you can approve them one by one.

## How this was judged

- **The level files**: map, stashes, adults and their routes, items, timers, boss phases.
- **The walkthrough bot** (`tests/bot.mjs`): the shortest route through each level, in order. This gives the step-by-step
  flow below.
- **The playtest proxy** (`tools/playtest-proxy.mjs`), run today:
  - **expert**: the fastest possible clear.
  - **blind**: ignores every adult. If it still clears, the level never forces stealth.
  - **run**: the blind bot, running everywhere. If it clears and the sneaking blind bot does not, running is the
    better strategy, which a stealth game should not allow.
- **The rules tools**: `tools/level-rules.mjs` (R1-R7) and `tools/level-lint.mjs`.

Limits: a bot can't tell whether a level is fun, readable or fair to a first-time player. A human takes roughly 2-3×
the expert time; that figure is an assumption, not a measurement. Nothing was checked by eye in this session (the local
server was not allowed).

## The curve at a glance

"Seen" counts how many times the blind bot was spotted on the shortest route. It is a rough measure of how much
pressure the level puts on the obvious path.

| # | Level | New things to learn | Adults | Map | Expert | Blind bot | Seen | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | SALA (tutorial) | move, door, pick up, lever + gate, cones, kupit, hide, sapat na, throw | 1 | 1 screen | 23 s | fails | 3 | **New.** Teaches everything; one real stealth moment at the exit |
| 2 | KUSINA | cooking routine, sleeper, candy, piggy | 2 | 1 screen | 19 s | **clears** | 1 | **Too easy.** The dip right after the tutorial |
| 3 | BUONG BAHAY | key + lock, radio, lego, Tita's phone, bayong, wallet, HINALA | 3 | 1 screen | 45 s | fails | 4 | Right difficulty, too much new at once |
| 4 | LOLA'S SIESTA (boss) | snore cover, sleep depth, creaky boards, slow door, silent exit | 1 | 1 screen | 23 s | fails | 3 | Good. Many rules for a 4th level |
| 5 | BAKURAN | dog, pandesal, laundry, Tatay dozing, Bing | 2 | 1 screen | 29 s | fails | 3 | **Running beats sneaking** |
| 6 | SWELDO | scrolling map, Jomar, TV, shower, timed lever, 5 adults | 5 | 20×26 | 29 s | fails | 4 | **The spike**, and the lever does nothing (bug) |
| 7 | GATAS | carrying, spills, puddles | 3 | 1 screen | 45 s | fails | 3 | Right |
| 8 | MAMA SA KUSINA (boss) | stir window, sandok, boil-over, seat finale | 1 | 1 screen | 35 s | fails | 2 | Right |
| 9 | GABI | night, KAIN NA timer, Ramil | 3 | 1 screen | 34 s | fails | 3 | Right |
| 10 | KASABWAT | tag-team, washing comes down | 4 | 22×26 | 58 s | fails | 5 | Hard and long; fine as the chapter's peak |
| 11 | IBALIK | putting coins back, jingling pockets | 4 | 1 screen | 41 s | fails | 4 | Right |
| 12 | TATAY + ASO (boss) | fish scent, tracker dog, bread bag | 2 | 1 screen | 34 s | fails | 2 | **Escape timer does nothing** (3 s used of 35) |
| 13 | PALENGKE | stalls, tinderas, gossip, errand | 5 + Nena | 28×30 | 26 s | fails | 3 | Right, but a big map with low pressure |
| 14 | BARANGAY HALL | escort, tanod, neighbours, tricycle | 6 | 26×34 | 22 s | fails | 5 | **Running beats sneaking**; par is 6.7× expert |
| 15 | NINANG'S PARTY (boss) | name calls, blending, videoke, photo | 6 | 1 screen | 30 s | fails | 5 | Right; the hardest level |
| 16 | BAGYO (finale) | lightning, thunder cover, kittens | 1 → 2 | 1 screen | 44 s | **clears** | 1 | **Too easy for the finale** |
| 17 | HINGI (epilogue) | asking | 0 | 1 screen | 26 s | clears | 0 | Right (no threat on purpose) |

**The shape of the curve:** the pressure goes 3, **1**, 4, 3, 3, 4, 3, 2, 3, 5, 4, 2, 3, 5, 5, **1**. There are two
holes, L2 right after the tutorial and L16 at the very end, and one cliff, L6, where the map starts scrolling and the
house goes from 2 adults to 5.

## The findings that matter most

1. **The finale is the easiest real level** (L16 BAGYO). The blind bot clears it after one close call. The flood escape
   gives 45 s and the expert needs 12. Phase 6 (the storm finale) is still unbuilt, so this is expected, but it should be
   the next level worked on. → LR-16a/b/c
2. **L6 SWELDO is a cliff, and its lever is broken.** It is the first scrolling map and adds 5 adults, 2 locked doors, a
   TV, Jomar's tattling and Tatay's shower all at once. The timed lever's gate at (17,3) opens onto a wall, and the exit
   nook is reached through the top-right room anyway (checked with pathfinding: the exit is reachable with the gate
   shut). The lever is decoration. → LR-6a/b
3. **L2 KUSINA needs no stealth.** The obvious route never meets Mama's eyes, because she is cooking (blind) or walking
   the far side. Now that L1 makes you sneak, L2 is easier than L1. → LR-2a/b
4. **On three levels running beats sneaking:** BAKURAN, SWELDO and BARANGAY. Running past the threat is faster than
   sneaking, so the stealth choice costs nothing. → LR-5, LR-6c, LR-14a
5. **Escape timers are too generous to create panic.** TATAY gives 35 s and the expert uses 3 s. BAGYO gives 45 s for
   12 s of running. LOLA's 25 s get-up is fine, because there the exit is slow on purpose. → LR-12a, LR-16b
6. **The tutorial has changed what L2 and L3 need to teach.** L2's hint still teaches hiding and throwing, and L3's
   still teaches doors. All three are in L1 now, so both levels can spend that room on their own idea. → LR-2b, LR-3a
7. **Small rule breaks in the bosses:** stashes on bare floor with no furniture to explain them (MAMA's wallet and
   piggy, TATAY's wallet, the party's purses). This is a readability issue, not a difficulty one. → LR-B

## Level by level

Each entry gives the step-by-step route (the bot's shortest one, plus what a first-time player meets), where the
tension is, the verdict, and the proposed changes.

### L1 SALA (the new tutorial)

1. **Kids' room:** you start by the wardrobe. The coach says DRAG (or WASD) and points at the door. A ghost finger
   shows the drag on phones.
2. **Door:** a ring on the big button: "BUKAS opens the door".
3. **Hall:** an arrow on the tsinelas ("walk over it"), then on the lever ("the gate to the sala is shut").
4. **Sala:** "the yellow cone is what Mama sees". You sneak behind her to the purse and hold KUPIT (the ring says HOLD).
5. **After the first coin** she hears something and walks out to the hall. The coach says TAGO and points at a box; she
   shrugs and goes back.
6. **Two more coins**, then SAPAT NA: "leave the last coin".
7. **The exit** is the front door by the TV, inside her cone. The coach points at a mark on the floor: throw the
   tsinelas there and she leaves the sofa for about 14 s, or wait for the ad break.

- **Tension:** the ad break (she turns to the bag every ~15 s) and the exit sitting in her cone.
- **Verdict:** it teaches every basic tool once, in order. The blind bot now fails, which means L1 has one real stealth
  moment.
- **Watch for in a human playtest:** whether a first-timer who ignores the coach gets sent back. If so, the softener is
  LR-1.
- **LR-1 (only if the playtest shows it):** on the tutorial, the first catch rewinds you to the gate instead of costing
  a chance.

### L2 KUSINA

1. Dining room (spawn), then the middle room: Lola asleep beside the piggy.
2. Kitchen: Mama cooks at the stove, then walks the far side.
3. Take the purse (3 coins) from the table, then out the side-hall back door. Quota 5 of 7.

- **Tension:** almost none. The route never crosses Mama's cone (the blind bot is seen once and clears).
- **Verdict:** too easy, and it repeats lessons L1 now teaches.
- **LR-2a:** add a stop at (10,2) facing the purse table, and lengthen her stop at (10,6), where she faces the
  middle-room doorway. Her cooking stop at the stove then becomes the window you have to wait for.
- **LR-2b:** the hint becomes the cooking lesson: "MAMA SEES NOTHING WHILE SHE COOKS. MOVE THEN". Drop the
  hide/throw text.

### L3 BUONG BAHAY

1. Top-left bedroom (spawn), then Lola's room: take the bayong while she sleeps, and the red key.
2. Down the hall past Mama sweeping, then the bottom-left bedroom: the purse (moved there: the HINALA tutorial).
3. Tita's corner (the wallet is optional: bayong and purse make the quota), the red door, the exit. Forget the key on
   the way down and you walk the house twice.

- **Tension:** Mama sweeping the hall, Tita's phone ending, Lola waking.
- **Verdict:** the right difficulty, but 6-7 new things at once.
- **LR-3a:** the radio goes later (L5 or L7), so L3 is about the key and the three kinds of stash. The doors line in
  the hint can go; L1 teaches doors now.

### L4 LOLA'S SIESTA (boss)

1. Bottom room, through the creaky door, to Lola's room: bayong and purse right beside her bed.
2. Phases at 2, 4 and 6 coins: she turns over, she talks in her sleep, she sits up.
3. The finale: any sound or sight is a close call. Three creaky boards guard the door, with one safe line down
   column 11. Hold ACT 1.5 s to open the door quietly. After 25 s she gets up.

- **Verdict:** good, a finale with its own rule. It does pile five rules onto the 4th level.
- **LR-4:** reuse the tutorial highlight for the first creaky door: a ring on ACT with "HOLD", and the safe line marked.

### L5 BAKURAN

1. Yard (spawn), across the middle lawn where the dog loops (laundry to stand in), into the house.
2. Wallet in Tatay's room, then the piggy in the other room (Tatay dozes at the right end), out to the yard exit.

- **Tension:** the dog's loop past the laundry.
- **Verdict:** running past the dog works better than the pandesal or the laundry, so the lesson can be skipped.
- **LR-5:** when the dog barks, Tatay comes to look (the `followsDog` the TATAY boss already uses). Running past then
  costs you a visit.

### L6 SWELDO

1. Kitchen (spawn, bottom-left): the bayong.
2. Tatay's shower corner: the wallet is safe while he showers (10 s, deaf).
3. The purse, then the blue key, then up the right side to the exit nook.
4. Five adults: Mama sweeping the long hall, Lola, Tita, Jomar on his phone at the hall door, Tatay.

- **Tension:** a lot, all at once, on the first map that scrolls.
- **Verdict:** the spike, and the timed lever is a bug: its gate leads into a wall, and the exit is reachable without
  it.
- **LR-6a (bug):** move the gate so it really guards the exit nook (close (17,1) and open (17,2)), or delete the
  lever.
- **LR-6b:** remove one adult (Lola, who is already the L3/L4 lesson) so the new things are the scroll, Jomar and the
  shower.
- **LR-6c:** running beats sneaking here. With LR-6a the exit sits behind a 6 s gate, and a sprint to it should cross
  Jomar's hall.

### L7 GATAS

1. Bottom room (spawn), up past Lola and Tita, to the kitchen fridge for the bowl of milk.
2. Carry it to the bottom-right exit without running (running spills it, and a spill leaves a puddle someone may
   find). All coins are optional sobra.

- **Verdict:** right. The level's idea is clear.

### L8 MAMA SA KUSINA (boss)

1. Wallet, piggy, then the purse, timed against her stirring (8 s on, 3 s off) and the sandok throws.
2. The pot boils over every 12 s from 5 coins.
3. At KAIN NA, sit in your seat before the sixth plate.

- **Verdict:** right.
- **LR-B:** see the rule breaks below (the wallet and piggy sit on bare floor).

### L9 GABI

1. Top bedroom (spawn): Lola's bayong while she sleeps, then the piggy in the middle room. Jomar walks the long hall
   and tells everyone.
2. Back for the blue key, which opens the way down to the exit (the kitchen purse is optional). Dinner comes at 160 s;
   at 30 s left Mama walks up the hall.

- **Verdict:** right. The dinner timer gives 4.7× the expert's time, which is comfortable for a first-timer.

### L10 KASABWAT

1. Two kids, Z switches. Bing can crawl under the bench tables on the left. Ramil yells the dog away from the gate.
2. Lever to the top yard, the purse and the piggy, then both kids out. The washing comes down one line every 25 s.

- **Verdict:** the longest level (58 s expert, about 2-3 min for a person) and among the hardest. Fine as the chapter's
  peak.
- **Watch for:** first-time players not realising the waiting kid can be seen.

### L11 IBALIK

1. Put back what you took from three owners. The amounts come from the ledger. Full pockets jingle when you run.

- **Verdict:** right. A good change of verb.

### L12 TATAY + ASO (boss)

1. House (bottom): the fish from the table, then the wallet by Tatay's loop.
2. Yard (top): the piggy and the purse, with the dog following the fish's scent.
3. Out the yard corner.

- **Verdict:** the chase never happens. The 35 s escape is used up in 3 s, because the exit is next to the last stash.
- **LR-12a:** make the escape 15 s and move the exit to the crawlspace in the far corner of the house (bottom-right), so
  the fish has to be carried back past Tatay's loop.

### L13 PALENGKE

1. An errand: three free things (two tinderas, then Aling Nena's stall) across a 28×30 market. Mama, Tatay and Jomar
   are shopping too. Gossip reaching Mama costs a star.

- **Verdict:** right on pressure, but a big map with long empty walks.
- **LR-13:** watch for wandering in the playtest. If players get lost, the compass arrow should point at the next
  errand.

### L14 BARANGAY HALL

1. Escort Mingming from the plaza up the central street to the vaccination desk. Stand still to hush her. The tanod
   walks the street, the neighbours watch, and the tricycle crosses.

- **Verdict:** running beats sneaking, and par is 150 s against a 22 s expert run.
- **LR-14a:** neighbours who hear running turn to look, and the tanod's route covers the crossing.
- **LR-14b:** par 90.

### L15 NINANG'S PARTY (boss)

1. Three purses among the guests. Every 15 s Ninang calls a name, and one in three is JUN: go to her or blend in.
2. The videoke covers you. At 6 coins: PICTURE!, an 8 s countdown, and you must be in the photo or out of every cone.

- **Verdict:** right, and the hardest level in the game.

### L16 BAGYO (finale)

1. The yard in the storm: four kittens. Mama is out looking, and Tatay joins at 2 kittens.
2. At 4 kittens: the water rises, 45 s to the door. Thunder covers your noise.

- **Verdict:** too easy for the last level. The blind bot clears it, and the escape is 3.7× what is needed. This is the
  unbuilt Phase 6.
- **LR-16a:** Tatay is out from the start, not from 2 kittens (Mama already checks the hiding spots).
- **LR-16b:** escape 25 s.
- **LR-16c (the Phase 6 flood):** the water closes the short path through the yard, so the way back is different from
  the way in.

### L17 HINGI (epilogue)

No threat on purpose. No change.

## Rule breaks (bosses)

- **LR-B:** give these stashes furniture that explains them: MAMA's wallet (2,7) and piggy (12,8), TATAY's wallet
  (13,14), and the party's purses (2,4) and (7,10). For example a chair beside the wallet, a shelf for the piggy, a
  table for each purse.

## The proposed changes, in priority order

| ID | Level | Change | Why |
|---|---|---|---|
| LR-6a | SWELDO | Fix the lever gate (it opens onto a wall) | Bug |
| LR-16a/b/c | BAGYO | Tatay from the start, 25 s escape, flood path | The finale is the easiest level |
| LR-2a/b | KUSINA | Mama stops facing the purse; cooking hint | Needs no stealth; now easier than L1 |
| LR-6b/c | SWELDO | One adult fewer; the gate makes the sprint cost | The difficulty cliff |
| LR-12a | TATAY | 15 s escape, exit across the house | The escape never matters |
| LR-5 | BAKURAN | The dog's bark brings Tatay | Running beats sneaking |
| LR-14a/b | BARANGAY | Running is heard; par 90 | Running beats sneaking |
| LR-3a | BUONG BAHAY | Radio moves later; drop the doors hint | Too much new at once |
| LR-4 | LOLA | Highlight the first creaky door | Many rules at once |
| LR-B | Bosses | Furniture for bare stashes | Readability |
| LR-13 | PALENGKE | Compass to the next errand, if needed | Possible wandering |
| LR-1 | SALA | First catch rewinds, if needed | Only if first-timers fail |

## Applied (2026-11-17, same day)

What was built from the list, and what the proxy says now (`node tools/playtest-proxy.mjs <ids>` takes level ids now).

| ID | Done | Proxy before → after |
|---|---|---|
| LR-6a | The gate moved to (18,3) and (17,1) walled, so the exit nook is only reached through the timed gate | the lever was skippable → it is on the route |
| LR-6b | Lola removed from SWELDO (HINALA adult indexes shifted) | |
| LR-6c | Tita moved to the top room (13,6), facing the gate and the piggy: time the lever with her phone call | run CLEAR → run fails |
| LR-16a | BAGYO: Tatay is out from the start; at 2 kittens Mama extends her search under the house | |
| LR-16b | BAGYO escape 45 → 25 s | blind CLEAR → blind fails; escape 12/45 → 12/25 |
| LR-16c | **Not done**: the flood path is the Phase 6 storm finale and needs its own art | |
| LR-2a | KUSINA: Mama cooks 4 s (the window), stops facing the purse table, and looks into the middle room from the doorway; Lola faces the piggy | still SURVIVABLE BLIND (1 close call); accepted for L2 |
| LR-2b | KUSINA hint: "MAMA SEES NOTHING WHILE SHE COOKS. MOVE THEN" | |
| LR-12a | TATAY: the fish waits on the table until the finale (it is the last thing you take), escape 35 → 15 s; before the finale the dog follows Jun's own trail | escape 3/35 → 9/15; blind fails |
| LR-5 | BAKURAN: Tatay comes when the dog barks (`followsDog`) | **still RUNNING BEATS SNEAKING**: Tatay spots runners in the house and cannot catch them (run 58 px/s against his chase 51 px/s). This is a game-wide speed question, not this level's layout |
| LR-14a/b | BARANGAY: the neighbours have sharper ears (1.6); par 150 → 90 | run CLEAR → run fails |
| LR-3a | L3 hint: "LOLA HAS THE BACK DOOR KEY. DON'T WAKE HER". **The radio stays**: the LOLA boss right after uses one, and a boss shouldn't be where you first meet a tool | |
| LR-4 | A creaky door now shows its own tip ("HOLD ACT TO OPEN IT SLOWLY AND QUIETLY"). Any tip about a button rings that button with TAP / HOLD / the key | |
| LR-B | Furniture by the bare boss stashes (a stool and a shelf in MAMA, Tatay's chair, two chairs at the party): R6 now passes on every boss | |
| LR-1, LR-13 | Not done: both wait for a human playtest | |

Found while doing it: **a respawn could put Jun inside a closed door.** Doorway checkpoints are remembered while the door
is open. An adult closing that door behind them (A5), followed by a close call, respawned Jun inside the shut door. The
respawn now opens it (tests/bugfix.test.mjs).

Accepted by the owner (2026-11-17): running through BAKURAN is fine. Still open: KUSINA can be brute-forced with one close call. The general fix would be
a chase that can catch a runner for a few seconds (for example the chase multiplier 1.5 → 1.75, so a chasing Tatay reaches
60 px/s), or running filling an adult's alert faster on all levels. Both touch every level, so they need their own pass.
