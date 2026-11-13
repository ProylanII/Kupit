# Kupit: Visual, UI/UX and AI Audit

Date: 2026-11-13. Build inspected: `e4d8210`. This is an inspection only: no code, art, levels or earlier reports were
changed. It is a companion to `DESIGN_AUDIT.md` and `DESIGN_BLUEPRINT.md`, and the IDs here (V, U, A, P) are new.

---

## 0. Method, evidence and limits

### What was inspected, and how

| Area | How it was inspected |
|---|---|
| **Character sprite sheet**: 387 frames, 16 groups (`assets/sprites/sheet.png` + `atlas.json`) | Every frame of Jun, Bing, Mama, Tatay, Aso, Mingming and a kitten cropped and enlarged 4×. Frame sizes and pose lists read for all 16 groups |
| **Code-drawn objects**: 18 sprites (`src/render/sprites.js`) | Rebuilt from their pixel data and rendered at 8× on the wood-floor colour. Includes trike, purse, wallet, bayong, piggy, tsinelas, pandesal, key, box, curtain, basket, TV, radio, videoke, lever, lego, sandok, alkansya |
| **Recoloured characters**: bisita, tanod, tindera | Read from their colour-swap tables |
| **Tiles and furniture** (`src/render/tiles.js`) | Judged in place in the 17 level captures |
| **Screens** | QA captures dated 2026-11-12, which are newer than the current art and maps: title + hideout, map, store, crew, help 1, options, pause, clear (×2), storm results, ending (caught panel), all 17 levels (desktop), Random House, Noche Buena daily, phone level 1 |
| **AI** | `src/entities/adult.js` read in full; the rules in `src/game/world.js` for noise, lures, doors, items, the trike, blending and night; `src/world/los.js` behaviour, through its callers |
| **Sound** | `src/core/audio.js` cue list: names only |

### Limits (reported, not guessed)

- **No motion and no sound.** A local server was not permitted in this session, so animation is judged from frames, not
  playback, and the sound cues are inventoried by name, not heard.
- **No real-device check.** Not checked on a real phone or with real touch.
- **Uncaptured screens.** The Random House *menu*, the Daily menu, the gear and cosmetics sub-stores and the caught
  screen were judged from code only, because no current capture exists.
- **Tiles judged at game scale only.** The tile art was judged in the level captures, not frame by frame.

### Correction to `DESIGN_AUDIT.md`, item F1

That item said adults are "the same height" as kids. They are not: adult frames are **24 px** tall and kid frames
**18–20 px**, so adults are about 26% taller. The real problem is proportion: every character has the same 12×9 px
head, so the whole difference sits in a few pixels of legs, and at game size adults read as tall kids. The fix is still
needed (see V1), but the diagnosis has changed.

### Scales used in this report

- **Classification:** KEEP (works as is) · REFINE (sound idea, needs work) · REDESIGN (rework the same function) ·
  REPLACE (remove it and do something else).
- **Complexity:** S = under a day · M = a few days · L = a week or more.
- **Priority:** Critical · High · Medium · Low.

---

## 1. Sprites and visual assets

### 1.1 Characters

**V1 · Adult vs kid proportions** — REDESIGN · High · M
- **Problem:** Every adult uses one 18×24 body with the same head as the kids. Mama, Tita, Ninang and Nena share a single
  silhouette; Tatay and Kuya share another. At game size the family reads as a group of similar kids.
- **Why it matters:** Recognising threats instantly is the core skill of stealth. "Small kid in a house of big adults"
  is also the game's whole fantasy.
- **Recommendation:**
  - Adults: a smaller head relative to the body (about 10×8 px) on a taller body (26–28 px), with wider shoulders.
  - Give each adult one silhouette feature:
    - Mama: hair bun and an apron.
    - Lola: a stoop and a cane, or a shawl.
    - Tita: a big shoulder bag.
    - Tatay: a sando (sleeveless undershirt) with a towel over his shoulder.
    - Ninang: big hair and a fan.
  - Kids keep their big heads.
- **Depends on:** the style lock (`style.json` and the art test), the hideout crew layout, cone origins (unchanged).
  Blueprint 4.2. Needs your approval of the look first.

**V2 · Recolours copy the wrong person** — REDESIGN · High · M
- **Problem:** Three crowd characters are colour swaps of named family or allies:
  - **Tindera** is a recolour of **Aling Nena**, your ally. At the palengke, where Nena helps you, the hostile vendors
    are recoloured Nenas, portraits included.
  - **Bisita** (party guests) are recoloured **Titas**.
  - The **tanod** is a recoloured **kuya**.
- **Why it matters:** It blurs who is friend and who is foe, and the ally/enemy line is a story point.
- **Recommendation:** Give tindera, bisita and tanod their own bodies (at least their own head and clothes), and never
  recolour a character with story weight.
- **Depends on:** the sheet; portraits; the Phase 1 Jomar sprite.

**V3 · The dog's front and back views** — REFINE · Medium · S
- **Problem:** Aso seen from front or back is a brown block with ears, which reads as a teddy bear. The side view is
  good.
- **Why it matters:** The dog walks up and down the screen in 3 levels and his alert state matters.
- **Recommendation:** Add a visible snout and muzzle in the front view, a tail in the back view, and a lighter chest
  patch.
- **Depends on:** the sheet only.

**V4 · Mingming and the kittens** — KEEP
- The best-drawn characters in the game: readable sit, sleep and walk, with three distinct coats.

**V5 · Portraits** (30×30, four moods) — REFINE · Medium · S
- **Problem:** The moods are clear on Mama and Jun. Recolour portraits (tindera, bisita, tanod) inherit their base
  character's face (V2). Only one portrait shows per story panel.
- **Recommendation:** Separate faces for crowd characters. Optional: a two-character panel layout (see U4).
- **Depends on:** V2.

**V6 · Kid sizes** — REFINE · Medium · S
- **Problem:** Bing is 18 px tall and Jun 19 px; Ramil is 20 px. Ramil is a teenager and Bing "is small, nobody sees
  me", yet a 1–2 px spread doesn't show either.
- **Recommendation:** Bing about 15–16 px, Ramil about 23 px.
- **Depends on:** Blueprint 6.2 (Bing's crawl-under-tables), so her sprite must fit under a table.

### 1.2 Animation

**V7 · Walk cycles barely move** — REFINE · High · M
- **Problem:** In all four walk frames, the front and back views change by only 1–2 pixels at the feet. The side views
  are better. At game scale characters seem to glide.
- **Why it matters:** Movement is what the player watches all game. Gliding reads as unfinished, and it makes it harder
  to read *which way* an adult is about to go.
- **Recommendation:**
  - A 1 px body bob on frames 1 and 3.
  - Arm swing on adults.
  - A clear foot alternation in the front and back views.
  - Adult walks slightly slower and heavier; kids quicker.
- **Depends on:** the generator script (`make_art.py`) and the style lock.

**V8 · Sleep, phone and reach poses don't read** — REDESIGN · High · M
- **Problem:**
  - The adults' **sleep** pose is the standing idle frame with closed eyes. Lola and Tatay "doze" upright.
  - **Phone** is a single blue pixel at the ear.
  - **Reach** (cooking, washing up) is a small arm shift.
  - The game leans on these states everywhere: sleepers in 10 levels, Tita's phone breaks, routines. Only the "ZZ"
    text and the speech bubbles carry the information.
- **Why it matters:** "Is she asleep or watching?" is the most frequent decision in the game. It should be readable from
  the sprite alone.
- **Recommendation:**
  - **Sitting-asleep** poses: in a chair, on a sofa, on a bed or banig (sleeping mat), with the head tilted and a
    breathing bob, placed on the furniture.
  - **Phone:** the arm up and a visible phone.
  - **Chores** with props: a pot and ladle, a broom, a watering can.
- **Depends on:** levels must put sleepers on or beside furniture (see the level-pass rules in Blueprint 7.0); the
  routine data (`ACTIVITIES`).

**V9 · Missing poses** — REFINE · High · M
- **Problem:** There is no pose for:
  - adults sitting, so Mama "watching TV" in the redesigned SALA would stand;
  - kids carrying anything: the milk bottle floats *above Jun's head* (`play.js:573`), and kittens taken into his shirt
    aren't shown at all;
  - kids peeking from a hiding spot (there's only an eye icon);
  - a run cycle (running is the walk played 1.7× faster);
  - adults searching (the search state just turns them in place).
- **Why it matters:** These are the moments players watch most closely: carrying, hiding, being searched for.
- **Recommendation:**
  - A carry pose with the item held at the chest (milk, fish, kittens' heads peeking from the shirt).
  - A sitting adult pose.
  - A peek frame for each hiding spot.
  - A head-turn search animation.
  - A two-frame run lean.
- **Depends on:** Blueprint 8.3 (fish carry), 9.1 (kittens), 1.1 (SALA TV routine).

**V10 · Catch, cast and alert poses** — KEEP
- The kid "caught" pose (hand on head), the skill "cast" pose and the adult alert are clear.

### 1.3 Vehicles: the tricycle

**V11 · Tricycle** — REPLACE · High · M
- **Problem:**
  1. It is a **single side-view frame facing right**, 20×10 px, and its only alternative is a mirrored copy. In
     BARANGAY its route runs **north–south**, so it slides up and down the screen sideways.
  2. It is pure side profile, while every character uses a ¾ top-down view, so the perspective doesn't match.
  3. There is no wheel or body animation, no headlight, no shadow, and no outline (characters have one).
  4. The driver is a 2×2 px skin dot under a hat, with no body.
  5. It blocks sight with a **6 px radius**, but the sprite is 20 px long: players will hide "behind" visible parts of the
     tricycle that don't actually block anyone's view.
  6. It turns around instantly at the ends of its route.
- **Why it matters:** It's the most visible prop in the late game, and right now it looks like a placeholder.
- **Recommendation:**
  - A ¾ top-down tricycle in **four directions**:
    - Sidecar with a roof, in a recognisable barangay paint scheme.
    - A driver with a body.
    - A two-frame wheel and engine shake, a headlight cone at night, and a ground shadow.
  - Make its sight-blocking shape a **rectangle matching the sprite**.
  - Make the knock-down area match the front of the vehicle.
  - A three-point turn (or a pause and swap) at each end of the route.
  - Add an engine sound that gets louder as it approaches (U11).
- **Complexity / depends on:** art in four directions; the sight-blocking test in `adult.js`; collision in `world.js`
  (`trikeHit`).

### 1.4 Stashes

**V12 · Bayong is camouflaged** — REDESIGN · High · S
- **Problem:** The bayong's straw colour (`#d9c27a` and `#b99a4a`) sits on a wood floor (`#c99a5b`): nearly the same
  value and hue. It disappears in every house level.
- **Why it matters:** A goal you can't see.
- **Recommendation:** A darker weave with a coloured band (Lola's bayong in pandan green or violet), plus a 1 px dark
  outline. Place it on or beside Lola's chair (Blueprint rule R6).
- **Depends on:** R6.

**V13 · Purse and wallet look alike** — REFINE · Medium · S
- **Problem:** Both use the same rust palette. The purse is 8×7 with a handle, the wallet 8×5. They behave very
  differently: the purse is quick and clicks at the end; the wallet's zipper is loud at the start.
- **Why it matters:** The game asks players to plan around each stash's noise. They can't tell which is which.
- **Recommendation:**
  - Purse: Mama's red or pink handbag with a gold clasp.
  - Wallet: Tatay's dark brown leather, with a visible zipper line.
  - Piggy and alkansya stay as they are.
- **Depends on:** SOBRA's coin pips above stashes (Blueprint 5.1).

**V14 · Taken stashes** — REFINE · Medium · S
- **Problem:** An emptied stash turns grey, a flat palette swap.
- **Recommendation:** Draw it *open* (purse unclasped, piggy upside down). That's also the evidence image HINALA needs.
- **Depends on:** Blueprint 5.1 (the emptied state) and 5.2 (evidence).

**V15 · Story stashes** — REFINE · Low · S
- **Problem:**
  - The milk is a 4×6 bottle, but the story says a *bowl* of milk ("a full bowl spills").
  - The fallback kitten is a 6-row orange shape.
  - The gift (regalo) is fine.
- **Recommendation:** A bowl sprite for the milk, to match the story and the hideout's milk bowl.

**V16 · Piggy, alkansya, garapon (candy jar)** — KEEP
- All three are readable. The alkansya's bamboo look is a nice local touch.

### 1.5 Items, hiding spots, devices, traps

**V17 · Tsinelas** — REDESIGN · High · S
- **Problem:** Two blue ovals side by side, 10×3 px, with no straps. In every capture it reads as goggles or sunglasses.
- **Why it matters:** It's the game's signature item and the most-used tool.
- **Recommendation:** A top-down pair with the V-strap, slightly offset and angled as if dropped, in classic blue or
  green rubber with white soles. Add a spin frame for when it's thrown.

**V18 · Pandesal** — REFINE · Low · S
- **Problem:** A brown oval, read as a bread roll only from context.
- **Recommendation:** A lighter top crust with a split line, and crumbs visible in the dog's eating animation.

**V19 · Key** — REFINE · Low · S
- **Problem:** 7×3 px. It's tiny and gets lost on rugs.
- **Recommendation:** 7×5 with a round head; add a sparkle every 2 s until it's picked up.

**V20 · Curtain** — REDESIGN · Medium · S
- **Problem:** The curtain is a 12×12 floral block placed on open floor tiles, away from any wall or window. It reads as
  a blanket or a rug.
- **Why it matters:** Hiding spots must look like hiding spots.
- **Recommendation:** Only allow curtains on tiles next to a window wall, and draw a rod and a window behind them. Or
  replace the free-standing curtain with a **folding screen** (a common Filipino household item).
- **Depends on:** a validator rule; a check across every level that has curtains (most of them).

**V21 · Box, basket** — KEEP
- Clear, with a good level of detail, and the basket with clothes poking out is charming.

**V22 · TV, radio** — KEEP. **Videoke** — REFINE · Low · S
- **Problem:** The videoke reads as a speaker tower, not a karaoke machine.
- **Recommendation:** Add a lit lyrics screen (scrolling colour bars) and a mic on a stand, and blink the screen in time
  with the song cycle.

**V23 · Lever and gate** — REFINE · Medium · S
- **Problem:** The lever is 6×6 and easy to miss; the gate is drawn as bars in a wall gap. A lever's link to its gate
  is never shown.
- **Recommendation:**
  - A wall-mounted lever.
  - When pulled, a dotted line or a light flash from the lever to its gate.
  - A countdown ring on timed gates.

**V24 · Lego and creak boards** — KEEP (lego) · REFINE (creak) · Low · S
- **Problem:** Creak boards show only as faint marks on the floor. Being subtle is right, but on tile and concrete
  floors they look like the tile pattern.
- **Recommendation:** A consistent "loose board" mark (a slightly lifted plank with a darker gap). On tile floors, use
  a cracked tile.

**V25 · Sandok** — KEEP. The thrown ladle reads.

### 1.6 Tiles, furniture and environment

**V26 · The same table everywhere** — REFINE · Medium · M
- **Problem:** One red-checked tablecloth table is used in kitchens, salas, bedrooms, the yard house and the barangay
  houses. One bedside cabinet is repeated. One set of wall decorations (clock, capiz window, shelf, calendar) repeats in
  every room.
- **Why it matters:** Rooms look interchangeable (see audit D4).
- **Recommendation:** Per-room furniture sets:
  - Kitchen: a wooden dining table with a plastic cover.
  - Sala: a low coffee table.
  - Bedroom: a vanity.
  - Yard: a monobloc table.
  - Plus room-specific wall decorations (Santo Niño altar, family photos, school certificates, rosary).
- **Depends on:** `tiles.js`; furniture letters by room type (or new letters).

**V27 · A sofa as a street bench** — REPLACE · Medium · S
- **Problem:** BARANGAY's street uses `S`, the teal living-room sofa, as a bench (map row 29).
- **Recommendation:** A concrete or wooden *waiting shed* bench tile.
- **Depends on:** a new tile letter; the level edit.

**V28 · Doors on vertical walls** — REFINE · Low · M
- **Problem:** Doors in vertical (left–right) walls are drawn front-facing, like doors in horizontal walls, so their
  perspective is wrong.
- **Recommendation:** A side-on door sprite (a thin edge with a visible swing when open).

**V29 · The exit looks like any door** — REDESIGN · High · S
- **Problem:** The level exit is an ordinary door with a "LOCKED" text label above it, and the label overlaps nearby
  props (a plant in SALA). When it opens, only a green glow shows (at night).
- **Why it matters:** It's the goal of every level.
- **Recommendation:**
  - A distinct exit: the doorway out to the yard or the stairs down under the house, with Mingming's paw-print sign
    (Jun's chalk mark).
  - Locked: a closed door with a small padlock icon instead of the text.
  - Unlocked: the door swings open, a warm light spills out, and an arrow pulses on it.

**V30 · Laundry (`L`)** — REFINE · Medium · S
- **Problem:** Hanging laundry is drawn as coloured rectangles with no visible line or posts. In HINGI, two tiles render
  as an unexplained "||||" block; in BAKURAN and BOSS 3 they read as clothes only from context.
- **Recommendation:** Posts at each end of a run, a rope line, cloth that sways (two frames), and a shadow on the grass.

**V31 · Stalls, wardrobes, grass, concrete, wood, kitchen tile, rugs** — KEEP
- Palengke awnings are the strongest environment art. The aparador (wardrobe) reads. The floors are pleasant and
  consistent.

**V32 · Wall strips and outer border** — KEEP
- Consistent ¾ wall faces, and the dark outer border frames the map.

### 1.7 Lighting, cones, overlays

**V33 · Night lighting implies rules that don't exist** — REDESIGN · High · M (or S as a visual-only fix)
- **Problem:**
  - Night levels draw darkness with **light pools**: ceiling lamps, windows, the TV glow, a light around the player.
  - None of this affects detection: night is purely visual (A12). The brownout hint even says "STAY CLOSE TO THE LIGHT".
  - The pool around the player reads as Jun carrying a light, which makes him *more* visible in the fiction.
- **Why it matters:** The picture teaches players a rule the game doesn't have.
- **Recommendation:** Either make light real (A12), or keep night visual only and:
  - remove the brownout hint;
  - change the player pool to a subtle "eyes adjusting" vignette around the screen edges.
- **Depends on:** A12.

**V34 · Vision cones** — KEEP (REFINE in crowds)
- The soft wash with a crisp rim and different dither per alert state is good. It's also colour-blind friendly, since
  shape carries the state.
- In the party and market levels, 6–8 overlapping cones become noise. Refinement: fade the cones of adults who are far
  away and calm to 50%.

**V35 · Object outlines** — REFINE · Medium · M
- **Problem:** Characters have a 1 px dark outline and shading. Code-drawn objects (stashes, items, devices, the trike)
  have none and are flat.
- **Why it matters:** Two art styles sit side by side, which reads as unfinished.
- **Recommendation:** A 1 px dark outline pass on all objects that can be picked up or interacted with. The style lock
  should require it.

---

## 2. UI/UX

### 2.1 Layout and readability across the game

**U1 · The top HUD sits on the map** — REDESIGN · High · S
- **Problem:**
  - Coins, chances, level name, timer and the boss bar are drawn straight over map row 0 (the wall decorations).
  - For the first 8 s, the hint banner also covers **row 1**, which is playable. In KUSINA that row holds the counters
    and, beside them, the alkansya; in KWARTO Lola sleeps there.
  - The level name collides with windows and shelves in every capture.
- **Recommendation:**
  - A solid HUD band over row 0 only (Blueprint 4.1).
  - The hint shows as one line *inside* the band, not over the playfield.
  - Coins and chances as icons with numbers, and the boss bar under the band.
- **Depends on:** Blueprint 4.1.

**U2 · Phone layout wastes the screen** — REDESIGN · High · M
- **Problem:**
  - On a tall phone (the 390×844 capture), the 240×392 canvas is scaled 1.625× and centred, leaving about 25% of the
    height empty above and below.
  - The action buttons sit in the middle of the screen instead of in the thumb zone at the bottom.
  - Fractional scaling makes text strokes uneven ("NEED 3 MORE" has mixed stroke widths).
- **Why it matters:** The game is designed for phones, and this is the first thing a phone player sees.
- **Recommendation:**
  - Let the canvas grow taller on tall screens (more map rows visible, the HUD pinned to the safe area).
  - Anchor the control bar to the bottom safe area.
  - Render text at native resolution (a separate crisp UI layer) so the scaling can stay fractional without blurry
    letters.
- **Depends on:** the camera, `VIEW_H`, the input hit areas, every screen's layout constants. **L if done fully.** The
  minimum version (anchor the controls to the bottom, crisp text) is M.

**U3 · Text** — REDESIGN · High · M
- **Problem:** The 3×5 all-caps pixel font carries every sentence: help pages, tips, store descriptions, missions.
  Long all-caps text is slow to read, and the help pages are walls of it.
- **Recommendation:** Mixed-case 5×8 dialogue font for every sentence; caps only for labels (Blueprint 4.4). Also
  consider a text-size option (normal / large).
- **Depends on:** glyph coverage tests; every screen's layout.

**U4 · Button style** — REFINE · Medium · S
- **Problem:** Every screen uses the same flat purple rectangle, with a gold fill for the selected button. Consistent, but
  there's no pressed state, no icons, and no disabled style (locked or unaffordable items look the same as available).
- **Recommendation:**
  - A 1 px "press" offset with a click sound.
  - Small icons on the main buttons (map, store, crew, gear).
  - A disabled style: dim, with a lock or coin icon.
  - Keep the gold for "selected".

### 2.2 Screen by screen

| ID | Screen | Class | Problem | Recommendation | Pri | Cx | Depends on |
|---|---|---|---|---|---|---|---|
| U5 | **Title + hideout** | KEEP layout, REFINE | Good hierarchy: one gold primary button and six secondary ones. The top-left coin and star counters are tiny. The "NEXT GIFT AT 10" line is cryptic. The hideout panel is static between visits. | Bigger counters with icons. "NEXT GIFT: 10★ → JERSEY" (name the reward). Hideout reactions (Blueprint 10.2). | Medium | S | 10.2 |
| U6 | **Story panels** | REFINE | One centred portrait plus a text box over the faded title skyline for every scene. Conversations read as alternating mugshots. The skip button sits top right (fine). The panel dots are fine. | Scene backdrops (Blueprint 10.1). Two-sided staging: the speaker on the left or right, the listener dimmed. Hold the typewriter on story-critical lines. | Medium | M | 10.1 |
| U7 | **Barangay map** | REDESIGN | A vertical list of identical houses. The title bar clips the first chapter header and the "^" arrow overlaps the title. Shows PAR on levels where "fast" isn't one of the missions. Shows "BEST 0S" after dev clears (dev only). | Audit G3: an illustrated map. At minimum: fix the overlap; show each level's actual missions and alkansya state; give outdoor levels market and hall icons, not houses. | Medium | M (L if illustrated) | — |
| U8 | **Pre-level card** | (new) | The mission card currently appears mid-playfield for 5 s, covering the layout. | Blueprint 6.1: card before the level; nothing over the playfield. | High | M | 6.1 |
| U9 | **In-play bottom bar** | KEEP, REFINE | The context label on the action button (KUPIT / TAGO / BUKAS / HINGI) is excellent. "NEED 3 MORE" is small and grey. The keyboard legend shows on phones until the first touch (`play.js:874`). | "NEED 3 MORE" in white with a coin icon. On touch devices, show the touch legend from the start (detect touch support on load). | Medium | S | — |
| U10 | **Edge arrows and off-screen noise pings** | KEEP | Readable, and essential on scrolling maps. | — | — | — | — |
| U11 | **Speech bubbles** | REFINE | Small all-caps bubbles. Bubbles near the top can sit under the HUD. Chase bubbles turn red (good). | Mixed-case text; keep bubbles below the HUD band; routine bubbles get a small icon (pot, broom, phone) so they can be read at a glance. | Medium | S | U1, U3 |
| U12 | **Pause** | KEEP, REFINE | Clear menu plus missions. Seven items, with the dev item only in dev. | Add the current HINALA line once it exists; group as Resume / Restart / then the rest. | Low | S | 5.2 |
| U13 | **Caught screen** (code only) | REDESIGN | Catcher portrait plus "CAUGHT!", or "HULI KA!" after an escape-timer failure. | Blueprint 3.1 (MUNTIK NA): amber, not red, and HULI KA reserved for the ending. | Critical (part of Blueprint 3.1) | S | 3.1 |
| U14 | **Clear screen** | REFINE | The level shows through the dim behind the headline, so the player can look like part of the words (first reported here as a draw-order bug; a live check disproved that, see P1). The stats are a centred cluster of small lines. On the storm results, "NEVER GET CAUGHT — NEW!" appears immediately after the ending where Jun is caught. | A solid panel behind the results (done in Phase 1). Layout: headline → three missions → a coins row → an unlocks row, with more spacing. Rename the mission to "NO CLOSE CALLS" (Blueprint 3.1). Add the HINALA breakdown (5.2). | High | S | 3.1, 5.2 |
| U15 | **Aling Nena's store** | REFINE | A flat list, with the near-invisible line "FOR MINGMING AND THE KITTENS" repeated on every row. Nena is never shown. Buying anything shows no preview. | Nena's portrait at the counter with a changing line. Delete the repeated line. Show each item's effect on the hideout as a thumbnail. Gear as new actions (Blueprint 5.4). | Medium | M | 5.4 |
| U16 | **Gear and cosmetics sub-stores** (code only) | REDESIGN | Stat bars for percentage upgrades. | Replaced by the gear-as-actions list (Blueprint 5.4). Each item gets an icon and a one-line "what it lets you do". | Medium | M | 5.4 |
| U17 | **The Crew** | REFINE | Readable cards, but most of the screen is empty. "JOINS IN THE STORY" in dark grey. It's the only place to pick a kid. | Becomes a reference and outfit screen. Picking moves to the pre-level card (6.1). Show each skill with a small animated example. | Medium | M | 6.1 |
| U18 | **How to Play** | REDESIGN | Four pages of all-caps text, with no pictures. | Illustrated cards: one rule per card, each with its sprite (cone, hiding spot, stash, lure). Also open the matching card **from the tip** in-level ("?" on the tip). Credits and glossary on their own page. | High | M | U3 |
| U19 | **Options** | REFINE | Twelve identical buttons with the value inside the label; no groups. How volume is changed isn't shown (cycling by tapping). | Groups: Audio / Display / Controls / Accessibility / Save. Sliders for volume. Add text size, slower storm (Blueprint 9.1), and cone contrast. | Medium | M | — |
| U20 | **Random House and Daily menus** (code only) | REFINE | Text-only menus. The generated house name is just the seed number. | A house preview thumbnail; mutator icons; a friendly generated name ("BAHAY NI ALING ROSA"); the Daily streak shown big. | Low | M | Blueprint 11 |
| U21 | **Ending and epilogue panels** | KEEP the framing | The HULI KA panel is strong (red frame, big type). | Blueprint 9.2–9.4 (in-game catch, case file). | — | — | 9.x |
| U22 | **Load error** | KEEP | Clear error plus "tap to retry". | — | — | — | — |

### 2.3 Interaction feedback

**U23 · Stash progress** — REFINE · Medium · S
- **Problem:** Stealing shows a progress ring, with no sense of *how many* coins are inside.
- **Recommendation:** Coin pips (Blueprint 5.1).

**U24 · Lures you can't see** — REFINE · Medium · S
- **Problem:** Noise rings show where a sound went, but not *who heard it*.
- **Recommendation:** A brief "?" above each adult who will react (already partly there for the delayed reaction),
  plus a thin line from the noise to each listener for 0.5 s on the first three throws of the game (tutorial only).

---

## 3. AI behaviour

### 3.1 How the AI works today (from `adult.js` and `world.js`)

- **States:** `patrol` → (hears a lure) `investigate` → (arrives) `inspect` hiding spots (bosses only) or `search`
  2.5 s → `return` → `patrol`. Seeing the player fills an **alert meter** (`rate` per second, ×2.5 within 32 px).
  When it's full: `chase` at 1.5× speed to the last place they saw you. A **catch** needs chase state and under 10 px.
  Losing sight for 5 s, or reaching the last-seen spot without seeing you, → search.
- **Vision:** a cone (range, half-angle) with line of sight (a 32-ray cast). Cover tiles and "cover" actors (guests, the
  trike) block it. Blending hides you beyond 30 px.
- **Hearing:** noise spreads along room paths; walls block it; closed doors add distance.
  - **Lures** (thrown items, traps, devices, yells, tattles) send listeners to the spot, each after a delay by distance.
  - **Glances** (running, stash sounds) only turn their head.
- **Special behaviours:**
  - Sleep cycles (noise within 70% of its radius wakes; Lola's depth meter).
  - Phone and routines (blind or deaf windows).
  - The tattle shout (a wind-up, then a lure for everyone nearby).
  - The dog (barks instead of chasing, eats pandesal 8 s, sound-tracking ears, the scent-trail tracker).
  - The tanod's sweeping flashlight; the tindera's leash; boss hunts (every N s, head to the player's position ± spread).
- **Doors:** adults open closed doors (`D`→`d`) and walk around locked ones.

### 3.2 Findings by system

**A1 · Thrown tsinelas can be picked up and thrown again forever** — REFINE · High · S
- **Problem:** A landed tsinelas becomes a pickup again after 1 s (`world.js:364`). No adult ever picks it up. One
  slipper is an unlimited lure.
- **Why it matters:** It's the main exploit in the game. It makes pockets, the throw count, the old Pockets upgrade and
  "the THROW NOTHING mission" (unused) meaningless, and undercuts the throw-a-lure decision.
- **Recommendation:** The adult who investigates a lure **picks up the slipper** ("Kaninong tsinelas 'to?" — "Whose
  slipper is this?"), and it's gone, which also adds HINALA evidence (Blueprint 5.2). If no one reaches it, it stays
  pick-up-able.
- **Depends on:** the investigate arrival code (`arrived()`), HINALA evidence, the item counts in levels.

**A2 · Hiding is a free reset for everyone but bosses** — REFINE · High · S
- **Problem:** A hidden player is invisible unless that adult *watched* you hide (`canSee`). Only `checksHides` adults
  (bosses) search hiding spots. A normal adult chasing you runs to the last-seen spot, spins for 2.5 s and walks away,
  even if you dove into the box right in front of the spot they reached.
- **Why it matters:** Hiding never feels tense outside boss fights. It's a button, not a gamble.
- **Recommendation:** Light inspection for every non-boss adult:
  - After losing you in a chase, if a hiding spot is within 2 tiles of the last-seen spot, there's a 40% chance they
    check *that one* spot ("Hmm..."). Sleepers and dogs never check.
  - Hiding spots you were seen near in this level are checked first.
  - Bosses keep their full inspection.
- **Depends on:** `startInspect`; MUNTIK NA wording (the inspect line is "HULI KA!", `adult.js:502`, which must change:
  Blueprint 3.1).

**A3 · Searching is a spin on the spot** — REDESIGN · High · M
- **Problem:** `search` turns the adult with a sine wave for 2.5 s while standing still, then they walk back.
- **Why it matters:** It's the most robotic moment in the AI, and it's very short, so evading always feels guaranteed.
- **Recommendation:** A real search lasting 4–6 s:
  - Walk to 2–3 nearby points chosen by how the room is laid out (doorways, corners, behind furniture, in the direction
    you were last moving).
  - Look around at each one, with lines ("Nasaan na 'yon?" — "Where'd he go?").
  - Afterwards, a **heightened state** for 15 s: alert decays half as fast, and they glance at the room they searched.
  - Different people search differently:
    - Mama is thorough (3 points).
    - Tatay is quick (2 points, then gives up grumbling).
    - Lola goes back to her chair.
- **Depends on:** pathfinding (exists); per-type settings.

**A4 · Lures never wear off** — REFINE · Medium · S
- **Problem:** Every lure gets the same full response every time. Three tsinelas in a row → three identical trips.
- **Recommendation:**
  - The second lure in 20 s at the same spot (within 2 tiles): the adult only looks.
  - The third: they get suspicious and walk *toward where it was thrown from*.
  - The radio and TV: after being switched off once ("SINO NAGBUKAS?"), the next time they're turned on, the adult
    comes straight to the device, warier.
- **Depends on:** A1.

**A5 · Doors stay open forever** — REFINE · Medium · S
- **Problem:** Adults open closed doors and never close them. Over a level, the doors' sight-blocking slowly disappears.
  An open door the player left behind is never noticed.
- **Recommendation:** Adults close a door behind them if it was closed when they reached it (habitual). Mama notices a
  door the *player* left open on her route ("Bakit bukas 'to?" — "Why is this open?"), investigates the room beyond,
  and it counts as HINALA evidence.
- **Depends on:** a door-memory map; HINALA.

**A6 · Night and brownout change nothing** — REDESIGN · High · M
- **Problem:** Night tint and brownout are only visual. Detection uses the same ranges in a lit kitchen and a dark
  bedroom.
- **Why it matters:** Together with V33, the game shows players a light/dark rule it doesn't follow. Players will
  "stay in the dark" and still get seen, which feels unfair.
- **Recommendation:** Real light on night levels:
  - Outside a light pool, cone range ×0.6.
  - Inside a light pool (lamp, TV glow, window moonlight, a flashlight), full range.
  - The player's own glow is removed; replace it with screen-edge darkening.
  - Brownout: ×0.45 outside lights, and adults carry candles or phone lights (moving light pools).
  - This makes GABI, IBALIK and the storm into light-and-shadow levels without new maps.
- **Depends on:** a light map per level (lamp positions from the existing light-pool code); the cone drawing (must show
  the reduced range); storm lightning reveal (Blueprint 9.1, a full-range flash).

**A7 · Patrols are rectangles at constant speed** — REFINE · Medium · M
- **Problem:** Almost every patrol route in the campaign is a 2–4 point loop, mostly axis-aligned rectangles, walked at
  one speed with fixed waits. Routines added some life. Most adults still behave like Roombas.
- **Recommendation:**
  - Routes with purpose: point-to-point errands (kitchen → sala → bedroom with chores at each stop).
  - Plus or minus 15% randomness on wait times (seeded, so ghosts and the bot stay deterministic).
  - Occasional pauses to look out a window or check a phone.
  - Speed by type and mood (Tatay brisk, Lola slow, everyone faster when suspicious).
- **Depends on:** the level-pass rules; the walkthrough bot (deterministic seeding).

**A8 · Adults pass through each other** — REFINE · Medium · M
- **Problem:** There is no avoidance between actors. Guests, Ninangs and family members overlap and stack where their
  routes cross (the party level). The tricycle drives through people.
- **Recommendation:**
  - Simple avoidance: yield or sidestep when another actor is within 8 px, and have the tricycle stop for anyone in
    front of it, honking.
  - Two adults passing each other exchange a short line occasionally ("Nakita mo si Jun?" — "Have you seen Jun?"),
    which is HINALA-flavoured chatter (Blueprint 5.2).
- **Depends on:** movement in `adult.js`; the bot (routes may take longer).

**A9 · The vision model** — KEEP, REFINE · Medium · S
- **Keep:** cone + line of sight + an alert meter that fills over time. It's readable and fair, and close range filling
  2.5× faster is right.
- **Refine:** at the outer 30% of the cone (distance and angle), fill at half rate. That rewards skimming the edge,
  which matches the soft cone drawing.
- **Depends on:** cone tuning; SILENT mission thresholds.

**A10 · Hearing and noise** — KEEP
- Path-based noise, lures vs glances, delays by distance (a crowd turns one at a time). The best AI system in the
  game.

**A11 · Catch rule** — KEEP, REFINE · Low · S
- **Problem:** Only a chasing adult can catch. If an unalerted adult walks right past or into you, you aren't caught;
  you just get a very fast-filling meter. That's mostly fine, but it lets a sneaking player pass *through* a busy adult
  during routines.
- **Recommendation:** A "bump": touching any awake adult (not harmless) instantly sets their alert to 0.8.

**A12 · Boss hunting is perfect knowledge** — REFINE · Medium · S
- **Problem:** Hunting bosses head for the player's real position (± spread) every few seconds, wherever the player is.
- **Why it matters:** It feels like cheating once players notice it. Most finales are being replaced anyway (Blueprint 8).
- **Recommendation:** Where a hunt remains (the carry-out in Tatay's fight), hunt toward the last *noise* or *bark*,
  not the true position, and say so in a banner ("ASO SMELLS YOU").
- **Depends on:** Blueprint 8.

**A13 · Sleep cycles are clockwork** — REFINE · Medium · S
- **Problem:** Sleepers wake and sleep on fixed on/off timers. After being woken, the cycle restarts from awake, so it's
  fully predictable once learned. That's good for learning, robotic over 10 levels.
- **Recommendation:** Seeded ±20% cycle lengths. Woken sleepers stay up longer (+50% awake time) and are lighter
  sleepers for the rest of the level. Sitting-asleep poses (V8).

### 3.3 Character by character

| ID | Character | Current behaviour | Verdict | Problem → Recommendation | Pri | Cx |
|---|---|---|---|---|---|---|
| A14 | **Mama** | Patrols with chores; speed 26, range 72, rate 1.7 | REFINE | Her personality never shows: she's the most frequent enemy and behaves generically. → A thorough searcher (A3); closes doors; notices open doors and empty purses first; gets faster as HINALA rises; lines use her voice ("Anak?"). | Medium | S |
| A15 | **Lola** | Stationary sleeper; slow; the depth meter in her boss | REFINE | Always the same stationary sleeper, standing up. → Sits in her chair or bed (V8); when woken she *calls out* instead of chasing ("Apo? Ikaw ba 'yan?"), which is a lure toward her for others; only her boss has her move. | Medium | S |
| A16 | **Tita** | Phone cycle 7 s on / 3 s off; fast to notice (rate 2.0) | KEEP, REFINE | A good rhythm guard. 3 s phone windows are tight on a phone screen. → Vary her calls (long call 6 s, quick text 2 s), telegraphed by a ringtone a moment before. **Needs playtest.** | Low | S |
| A17 | **Tatay** | Fast patroller (34; 51 when chasing); follows the dog's barks | REFINE | Outside the dog link, just "faster Mama". → Brisk, short searches (A3); he dozes in front of the TV; whistles while walking (a sound cue to his position); checks his wallet at HINALA tier 1+. | Medium | S |
| A18 | **Kuya → Jomar** | Tattle: 0.5 s wind-up, then a shout (radius 170) that sends everyone in earshot | KEEP mechanic, REDESIGN identity | Blueprint 3.2. Make the wind-up readable (he lifts his phone, shouts "TITAAAA!"). | High | S |
| A19 | **Aso** | Barks instead of chasing (radius 150 lure), eats pandesal 8 s, scent tracker | KEEP, REFINE | Never chases or catches, so alone he's only an alarm. That's a fine role. He keeps barking every 2.5 s while he can see you. → Add a tail-wag tell when he's about to bark; once fed, he follows you for 5 s (Blueprint audit L5-b), a soft risk. | Low | S |
| A20 | **Tanod** | Sweeping flashlight (range 92, narrow 0.42 half-angle), whistle tattle | KEEP | Distinct and readable. Pair it with real light (A6): his flashlight becomes a real light pool. | — | — |
| A21 | **Tindera** | Tattle (radius 130) and a 64 px leash to her stall | KEEP mechanic, REDESIGN look (V2) | In the Chapter 4 reframe, her tattle becomes gossip (Blueprint 7, L13). | Medium | S |
| A22 | **Ninang** | Base stats only (speed 18, range 70); bosses check hiding spots | REDESIGN | No behaviour of her own. → Blueprint 8.4: name calls, handing out envelopes, the photo. | High | M |
| A23 | **Bisita (guests)** | Harmless, block sight, blending | KEEP, REFINE | They walk blind routes and pass through others. → Avoidance (A8); occasionally stop and chat in pairs (natural cover pockets that move). | Low | S |
| A24 | **Tricycle** | Harmless, sight cover (6 px), knocks you down within 11 px, route with waits | REDESIGN | See V11: the cover and hit shapes should match the sprite, it should stop for people, and it needs an engine sound that grows on approach and a three-point turn. | High | M |
| A25 | **Aling Nena** (ally, HINGI) | Harmless in HINGI; a regular adult in Random House | KEEP | Never hostile in the campaign, correct. Random House using her as an enemy contradicts her ally role. → Remove her from the generator's enemy pool after the palengke scene. | Low | S |

### 3.4 Exploits and fairness

| Exploit or issue | Effect | Fix |
|---|---|---|
| Re-throwing one tsinelas | Unlimited lures | A1 |
| Hide in any spot outside bosses | Guaranteed reset | A2 |
| Short spin search | Evasion always works | A3 |
| Same lure, same response, every time | Chained lures pull guards forever | A4 |
| Doors opened by adults stay open | Sight-blocking fades over a level | A5 |
| Dark looks safe but isn't | Unfair catches at night | A6 |
| Walking through a busy adult | Bypasses the alert meter | A11 |
| Boss hunts use perfect knowledge | Feels like cheating | A12, Blueprint 8 |
| Trike's cover is smaller than its sprite | "Hidden behind the trike" yet seen | V11, A24 |

---

## 4. Overall polish

**P1 · Clear-screen readability** (first reported as a draw-order bug; corrected) — High · S — **fixed in Phase 1**
- A live check on 2026-11-13 showed Jun's pixels at the headline *are* dimmed (skin ≈ (81, 64, 64) under the 75%
  dim). There is no draw-order bug. Jun just stands where the headline's word gap falls, and the faintly visible
  level reads as part of the title.
- Fix: a near-solid panel behind the results text on the clear and caught screens (`panel()` in `main.js`).

**P2 · No footsteps or room ambience** — REFINE · High · M
- **Problem:** The sound cue list is: alert, buy, caught, clasp, clear, click, coin, creak, hide, horn, jingle, meow,
  music, ouch, phase, pickup, rustle, scold, skill, steal, thud, thunder, unlock, whistle, whoosh, zipper. There are
  **no adult footsteps**, no dog bark, no snore, no rain or room ambience, and no door open/close (or it reuses the creak
  or thud sound).
- **Why it matters:** Hearing an adult before you see them is core to stealth. Off-screen pings are visual only.
- **Recommendation:**
  - Spatial footsteps per adult type: Mama's tsinelas slap, Tatay's heavier step, Lola's shuffle and cane. Panned, and
    louder as they get closer.
  - A bark sound, Lola's snore, rain and wind for the storm, a radio murmur, a market crowd, a party crowd.
  - Door sounds.
- **Depends on:** the procedural sound engine (all sound is generated in code); A15 and Blueprint 8.1 (the snore is a
  mechanic).
- **Not heard:** this judgement is from the cue list only.

**P3 · Juice at the key moments** — REFINE · Medium · S
- **Exists:** screen shake (adjustable), red flash, coin particles, noise rings, a skill flash ring.
- **Missing:**
  - Coins flying to the counter.
  - A brief freeze frame on catches.
  - A camera nudge toward a newly spotted adult.
  - A celebratory beat when the exit unlocks (a door-open animation plus a chime).
  - A different sting when a boss phase changes.

**P4 · Environmental storytelling** — REFINE · Medium · M
- **Problem:** Props are generic (V26). Nothing in a room says who lives there or reacts to the story's progress.
- **Recommendation:** Per-room storytelling props (the Santo Niño altar, school awards in the kids' room, Tatay's
  rooster cage in the yard, Lola's photo: Blueprint 3.6). HINALA-tier props: a new padlock on the drawer, a note on the
  fridge ("WALANG KUKUHA NG PERA!" — "Nobody takes money!").

**P5 · Transitions** — KEEP
- A 0.25 s fade between screens, with none on pause, is right.
- Refinement for later: a short establishing camera pan at level start (audit D6).

**P6 · Language consistency** — REFINE · Medium · S
- **Problem:** Tips, labels and help text mix English and Tagalog without a pattern ("SEEN? HIDE IN THE BOX", "KAIN NA
  BAR", "SILIPIN KO...").
- **Recommendation:** One rule:
  - Characters speak Taglish (flavour).
  - System text (tips, help, missions) speaks plain English, with Tagalog *terms* in a highlight colour that the
    glossary explains.
  - Optionally, a Filipino language setting later.

**P7 · First-impression flow on phones** — REFINE · Medium · S
- **Problem:** The first in-level tip is "DRAG OR WASD TO MOVE" on every device.
- **Recommendation:** Device-specific first tips (see U9).

**P8 · The hideout is the most charming screen; give it time** — KEEP, REFINE
- Blueprint 10.2 (reactions, petting). Its candle-light pool and the five need pips are already lovely.

---

## 5. Classification register (every inspected element)

| Element | Class | ID |
|---|---|---|
| Adult bodies and proportions | REDESIGN | V1 |
| Tindera / bisita / tanod recolours | REDESIGN | V2 |
| Aso front and back views | REFINE | V3 |
| Mingming and kittens | KEEP | V4 |
| Portraits | REFINE | V5 |
| Kid sizes | REFINE | V6 |
| Walk cycles | REFINE | V7 |
| Sleep / phone / reach poses | REDESIGN | V8 |
| Carry / sit / peek / run / search poses | REFINE (add) | V9 |
| Caught / cast / alert poses | KEEP | V10 |
| Tricycle sprite and behaviour | REPLACE | V11, A24 |
| Bayong | REDESIGN | V12 |
| Purse vs wallet | REFINE | V13 |
| Emptied stash look | REFINE | V14 |
| Milk / fallback kitten / gift | REFINE | V15 |
| Piggy / alkansya / garapon | KEEP | V16 |
| Tsinelas | REDESIGN | V17 |
| Pandesal | REFINE | V18 |
| Key | REFINE | V19 |
| Curtain | REDESIGN | V20 |
| Box / basket | KEEP | V21 |
| TV / radio | KEEP | V22 |
| Videoke | REFINE | V22 |
| Lever / gate | REFINE | V23 |
| Lego | KEEP | V24 |
| Creak board mark | REFINE | V24 |
| Sandok | KEEP | V25 |
| Tables and wall decorations | REFINE | V26 |
| Street bench | REPLACE | V27 |
| Doors in vertical walls | REFINE | V28 |
| Exit door | REDESIGN | V29 |
| Laundry | REFINE | V30 |
| Stalls / wardrobe / floors / rugs | KEEP | V31 |
| Walls and border | KEEP | V32 |
| Night lighting | REDESIGN | V33 |
| Vision cones | KEEP (REFINE in crowds) | V34 |
| Object outlines | REFINE | V35 |
| Top HUD | REDESIGN | U1 |
| Phone layout | REDESIGN | U2 |
| UI text font | REDESIGN | U3 |
| Buttons | REFINE | U4 |
| Title + hideout | KEEP / REFINE | U5 |
| Story panels | REFINE | U6 |
| Map | REDESIGN | U7 |
| Mission card | REPLACE (pre-level card) | U8 |
| Bottom bar and action button | KEEP / REFINE | U9 |
| Edge arrows and pings | KEEP | U10 |
| Speech bubbles | REFINE | U11 |
| Pause | KEEP / REFINE | U12 |
| Caught screen | REDESIGN | U13 |
| Clear screen | REFINE | U14, P1 |
| Store | REFINE | U15 |
| Gear / cosmetics stores | REDESIGN | U16 |
| Crew | REFINE | U17 |
| How to Play | REDESIGN | U18 |
| Options | REFINE | U19 |
| Random House / Daily menus | REFINE | U20 |
| Ending framing | KEEP | U21 |
| Load error | KEEP | U22 |
| Stash progress | REFINE | U23 |
| Lure feedback | REFINE | U24 |
| Tsinelas pickup loop | REFINE | A1 |
| Hiding vs normal adults | REFINE | A2 |
| Search behaviour | REDESIGN | A3 |
| Lures wearing off | REFINE | A4 |
| Doors | REFINE | A5 |
| Night / brownout effect on AI | REDESIGN | A6 |
| Patrol routes | REFINE | A7 |
| Avoidance between actors | REFINE | A8 |
| Vision model | KEEP / REFINE | A9 |
| Hearing and noise | KEEP | A10 |
| Catch rule | KEEP / REFINE | A11 |
| Boss hunt | REFINE | A12 |
| Sleep cycles | REFINE | A13 |
| Mama | REFINE | A14 |
| Lola | REFINE | A15 |
| Tita | KEEP / REFINE | A16 |
| Tatay | REFINE | A17 |
| Jomar (formerly kuya) | REDESIGN identity | A18 |
| Aso | KEEP / REFINE | A19 |
| Tanod | KEEP | A20 |
| Tindera | KEEP behaviour / REDESIGN look | A21 |
| Ninang | REDESIGN | A22 |
| Bisita | KEEP / REFINE | A23 |
| Aling Nena | KEEP | A25 |
| Clear-screen readability | REFINE (done) | P1 |
| Sound cues | REFINE | P2 |
| Juice | REFINE | P3 |
| Environmental storytelling | REFINE | P4 |
| Transitions | KEEP | P5 |
| Language | REFINE | P6 |
| Phone first tips | REFINE | P7 |
| Hideout | KEEP / REFINE | P8 |

**Totals (93 rows, classified by the first word):** 27 KEEP (including the "KEEP / REFINE" rows) · 44 REFINE ·
19 REDESIGN · 3 REPLACE (the clear-screen "bug" turned out to be a REFINE, see P1).

---

## 6. Where these fit in the blueprint

| Blueprint phase | Add these items | Why they go there |
|---|---|---|
| **Phase 1** (narrative integrity) | A2's inspect line, U13 (caught screen), P6 (language rule), A25 | The "HULI KA!" lines in `adult.js` are part of MUNTIK NA |
| **Phase 1R** (readability) | V1, V2, V6, V7, V8, V12, V13, V17, V20, V29, V35, U1, U3, U9, P1 | Sprite proportions and recognisability must be settled before level and boss playtests |
| **Phase 2** (core systems) | A1, A5, V14 (evidence), U23 | HINALA's evidence comes from these behaviours |
| **Phase 3** (crew) | U8, U17, V9 carry pose | The pre-level card and the sibling poses |
| **Phase 4** (level pass) | A2, A3, A4, A6 + V33 (real light), A7, A8, A13, A14–A17, V26, V27, V30, P4 | Real light and smarter searches change how every level plays, so do them once, together with the level pass |
| **Phase 5** (bosses) | A12, A22, V9 sit pose (Mama's seat), V22 videoke | |
| **Phase 6** (storm, ending) | P2 (rain, wind, footsteps), V9 kittens-in-shirt | |
| **Phase 7** (presentation) | U2 (full phone layout), U5, U6, U7, U15, U16, U18, U19, U20, P3, P8 | |
| **Separate track** | V11 + A24 (tricycle) | Self-contained; any time before the BARANGAY rebuild (L14) |

### Dependencies to respect

1. **A6 (real light) affects level balance.** Do it in Phase 4 with the level pass, not after, or every night level gets
   tuned twice.
2. **V1, V6 and V8 (proportions and poses) must come before Blueprint 6.2 (Bing's crawl).** Her sprite has to fit
   under a table.
3. **A1, A4 and A5 feed HINALA evidence (Blueprint 5.2).** Build the behaviours first, then the evidence inputs.
4. **U2 (phone layout) changes `VIEW_H`.** If the full version is chosen, do it **before** any further level work,
   because visible rows change how levels read. Otherwise take the minimum version (controls at the bottom, crisp text).

### The ten items that matter most here

1. **A6 + V33** — real light (or drop the false visual promise).
2. **A1** — the endless tsinelas.
3. **A3** — real searches.
4. **A2** — light inspection of hiding spots.
5. **V8** — sleep and phone poses that read.
6. **V11 / A24** — the tricycle.
7. **V17 / V12** — tsinelas and bayong recognisability.
8. **U1** — the HUD band (P1, the clear-screen panel, is done).
9. **U2** — phone layout.
10. **P2** — footsteps and ambience.
