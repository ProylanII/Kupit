# Mini-games: the first batch (v0.3.0)

Date: 2026-11-17. Approved batch from the mini-game proposal: **MG-1 TUMBANG PRESO**, **MG-5 SI MINGMING NAMAN**,
**MG-7 HABOL!**, **MG-4 BAGYO: TULO AT BAHA**. The rest of the list (MG-2 PATINTERO, MG-3 TAGUAN, MG-6 BROWNOUT, MG-8 BUBONG,
MG-9 VIDEOKE, MG-10 MANGGA, MG-11 IWAS KARITON, MG-12 ALAGA) is a later batch.

Rewards: a mini-game's three stars can each pay coins, a photo for the album, or a cosmetic (the owner's call).

## Where they sit

| # | Level | Chapter | Why there |
|---|---|---|---|
| 6 | TUMBANG PRESO (bonus) | 2 GATAS | A breather right after Bing joins, before SWELDO (the old difficulty cliff) |
| 13 | SI MINGMING | 3 KASABWAT | No kupit tonight, so Mingming takes Tatay's fish herself: the boss right after is Tatay's "who keeps taking my fish?" |
| 15 | HABOL! | 4 SA LABAS (now opens the chapter) | Chasing Tigre is what takes Jun out into the barangay |
| 19 | BAGYO | 5 | The finale: rescue, then TULO, then BAHA |

20 levels, 19 with stars: `MAX_STARS` is 57 (GINTONG KUPIT moved to 57). Save v6 keeps every player on the level they
had reached; if one of the new levels sits right before it, that one comes next. The others wait on the map with a NEW tag.

## MG-1 TUMBANG PRESO (`game/preso.js`, `scenes/preso.js`)

- A street in front of Aling Nena's store. Jun, Toto and Lina throw; Buboy is "it" (the taya). Bing cheers from the bench.
- **Aim:** hold BATO. A mark slides out along your aim and back (1.5 s cycle) and the arc is drawn; let go when the mark is
  on the can (it turns green). The stick, or A/D, turns the aim ±0.55 rad.
- **TUMBA:** the can flies, clanks and rolls. The taya must fetch it and stand it up before he may tag anyone, so that is
  when everyone runs for their slippers and back behind the line.
- **Safe:** behind the line, or standing on your own slipper (green ring, "SAFE"). The taya only chases kids within 104 px
  of the can, and only while it stands.
- A friend who is tagged becomes the taya. Jun tagged: one of three chances, and the round restarts.
- Win: three TUMBA of your own. Missions: never get tagged; TUMBA on your first throw. Rewards: 10 coins / photo / PANG-KALYE outfit.
- A bonus game: after two failed tries the caught screen offers SKIP FOR NOW.

## MG-7 HABOL! (`game/runner.js`, `scenes/runner.js`)

- Side view down the eskinita at sunset, in zones: yards, sari-sari row, washing lines, tricycle terminal, the court.
- Jun runs by himself. **TALON** (right button, Space/W, or a tap on the street) jumps; holding goes higher (a tap still
  gets 0.08 s of lift). **DAUSDOS** (left button, S, or a swipe down) slides; in the air it dives into a slide.
  Coyote time 0.09 s, jump buffer 0.14 s.
- Crates, benches, a cart and a parked tricycle can be stood on. Buckets, pots, a chicken and a sleeping dog trip you;
  washing lines and banderitas must be slid under; an open kanal drops you in; a puddle only slows you.
- Tigre runs ahead. A stumble lets him get 42 px further away and running clean closes the gap again (6 px/s). Three quick
  stumbles and he is gone. Coins in the street are laid along the arc of a real jump (`jumpFrom`), so they teach timing.
- New poses in the sprite sheet (`tools/art/make_art.py`): Jun's run cycle, jump, fall and slide; Tigre's leap.
- Missions: no stumbles; every coin (30). Rewards: 6 coins / photo / TIGRE SHIRT. The coins picked up are paid too.

## MG-5 SI MINGMING NAMAN (`level.cat`, in `game/world.js`)

- You are the cat, whoever was picked. Quick and quiet; can walk over tables, counters, sofas, beds, stools, shelves and drums.
  Up there, adults see her from 0.55 of the distance (`UP_SEE`). She can hide in boxes but has no hands: no doors, no levers,
  nothing to throw.
- Skill **TABIG**: swats a cup off the counter in front of her, a crash that pulls people over.
- Evening: Mama washes up and walks the house, Tatay dozes on the sofa, the dog dozes in the yard and follows the fish's
  scent (if he reaches her, he snatches the fish back: a close call). Home is the gap in the sala floorboards.
- Missions: never raise an alarm; the dog never barks. Rewards: photo / 6 coins / MGA KUTING (kittens on the title fence).
- Playtest proxy: a blind bot is now spotted by Mama but usually escapes over the kitchen table (the furniture is a real
  refuge), so it still reads "no stealth needed". Left for a human playtest.

## MG-4 BAGYO: TULO AT BAHA (`level.tulo`, `level.flood`, `finale: "tulo"`)

1. **SAGIP** (stealth, as before): the thunder scared them out of the box. Three kittens and Mingming; she only comes in the
   quiet (her pickup pauses while it thunders). Mama looks under the house at 2.
2. **TULO** (22 s): bring them back to the box, then the floor above starts leaking over it, four drips one by one.
   BUHAT a container (palanggana 12 drops, kaldero 8, timba 16), SAHOD it under a drip, TAPON it down the drain when full.
   Emptying it splashes (heard, unless the thunder rolls); running with a full one sloshes it out. Uncovered drips soak the
   box; a soaked box makes the kittens cry (a lure).
3. **BAHA**: the kanal breaks at two places and the water spreads a tile every 0.8 s (deep after 6 s next to deep water),
   down into the crawlspace too. The family goes inside; the clock (30 s) runs. Walk into a sandbag to push it; push it into a
   breach to seal it. With both sealed the water drains away. Shallow water slows you to 0.7, deep to 0.45.
4. The house door: caught, and the ending plays, as before.

- Missions: keep the box dry; stop the flood. Bot: 74 s sneaking, 51 s running (par 200). Blind bot: fails (stealth needed).
- A fix found on the way: guests and other "harmless" adults with a one-point route never walked anywhere (adult.js).

## The rest

- **Rewards** (`grantRewards`, the level's `rewards`): given once, the first time each star is earned; shown on the clear
  screen and on the pre-level card (an icon next to each mission).
- **Album** (`scenes/album.js`, title button ALBUM): PRESO, HABOL!, MINGMING, Ninang's party photo (with or without Jun),
  and the family after the storm. Each photo is a small scene drawn in code.
- **Cards:** a mini-game's card shows PAANO? (how to play) with icons instead of the crew row.
- **Map:** mini-games have their own node (a can, Tigre running, the cat), "BONUS: LARO!" and a NEW tag when added by update.
- **Music:** two new tracks, `laro` (PRESO) and `takbo` (HABOL!). New sounds: jump, splash, clank, cheer, drip, sandbag push, bark.
- **Tests:** `tests/minigames.test.mjs` (15 tests: bots for PRESO and HABOL!, the tag and slipper rules, jump physics,
  the cat's rules, TULO, the flood and sandbags, save v6, rewards). Screenshots: `node tools/qa/minigame-shots.mjs <url> <out>`.

## Open (needs a person playing)

- Feel of PRESO's aim timing (1.5 s cycle) and HABOL!'s speed (96 to 122 px/s) on a real phone.
- Whether TULO's juggling is fun or fiddly with the touch controls (the action button changes to BUHAT / SAHOD / TAPON / BABA).
- MINGMING's difficulty (see above).
