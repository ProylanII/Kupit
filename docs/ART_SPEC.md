# Sprite specification (the Blender batch)

The shipped sheet is rendered in Blender 5.2 from `art/blend/characters.blend`, built by
`tools/blender/build_characters.py` (`npm run art:blender` does build, render and pack). This file is the exact
contract any batch, procedural or hand-modelled, has to meet so it drops in with **no code changes**:
`tools/pack_atlas.py` writes the two files, `npm test` (art lock) accepts or rejects them, `npm run build` puts
them in the offline cache. The code-drawn sheet (`npm run art:code`) meets the same contract.

Everything here is also machine-readable in [`tools/art/style.json`](../tools/art/style.json), which the tests read.

## Files

| File | Format |
|---|---|
| `assets/sprites/sheet.png` | One RGBA PNG, alpha 0 or 255 only. Currently 256 px wide. Size is free. |
| `assets/sprites/atlas.json` | `{ "image": "sheet.png", "size": [w, h], "frames": { "<key>": { "x", "y", "w", "h" } } }` in sheet pixels |

Keys: `kind|dir|frame` and `portrait|kind`. Example `"mama|2|1"`, `"jun|0|reach"`, `"portrait|lola"`.

## Characters (kinds)

| Group | Kinds | Frame height incl. outline | Body height to render |
|---|---|---|---|
| kid | `jun bing ramil nene` (+ `kid`, a legacy alias of jun) | 16-20 px | 16 px |
| adult | `mama lola tita tatay kuya nena ninang` | 20-24 px | 21 px (Tatay can be 1 px shorter and wider: "big") |
| dog | `aso` | 11-14 px | 10 px |
| portrait | one per kind above | 30x30 px | 28x28 bust, outline optional |

Not rendered (palette swaps done in code, `src/render/sprites.js` VARIANTS/KID_SLOTS): `tanod` (from kuya),
`tindera` (from nena), `bisita` (from tita), every kid outfit, the tricycle (code-drawn object).

## Directions

`0` = facing down (towards the camera), `2` = facing right, `3` = facing up. **Left is never stored**: the game
mirrors `2`. A character must therefore be symmetric enough that a mirrored right view reads as left (no text on
shirts, accessories on both sides or centred).

## Frames and poses

| Frame | Who | When the game shows it |
|---|---|---|
| `0` | all | idle (also the first walk frame) |
| `1 2 3` | all | walk cycle with `0`: contact, pass, contact, pass. Sneak plays at 8 fps, run at 13.6 fps, adults at 6-12 fps scaled by speed (`stepT += dt * speed / 26`), so one 4-frame cycle covers about one tile. The chase uses the same cycle faster. |
| `reach` | kids | holding KUPIT (both arms forward, grabbing) |
| `caught` | kids | the scolding beat and the CAUGHT screen (arms up, eyes shut) |
| `cast` | kids | 0.35 s after using the skill (one arm straight up; the game adds a ring at the hand) |
| `alert` | adults, dog | shouting "HOY!" (chasing and standing still, or the one who caught you); dog: 0.6 s after each bark (mouth open) |
| `sleep` | adults, dog | asleep (Lola's nap, a sleepy dog). The game dims the sprite and draws ZZ |
| `phone` | adults | Tita's phone time (off-phase of `phone` adults): hand to the ear, phone visible |
| `reach` | adults | busy with both hands: Mama stirring the pot (the game draws the pot beside her) |
| `eat` | dog | eating pandesal (head down), 8 s |
| `portrait` | all | character select, boss banner, caught screen, story panels (drawn at 1x and 2x) |

States with **no sprite of their own** (by design): hiding (the kid is inside the box/curtain/basket, only
peeking eyes are drawn), search (idle frame while the adult turns around), run (walk cycle, faster, plus dust),
charmed by Nene (idle, no cone, "AWW!"), tanod/tindera/bisita (palette swaps of kuya/nena/tita).

Every frame of one character must be the **same canvas size** (same w and h in the atlas). The game places a
sprite by its own height (`y + 6 - h`), so frames of different heights pop up and down.

## Anchor and framing

- Feet on the bottom row of the frame, body centred horizontally. The game draws the sprite with its bottom
  edge 6 px below the entity's ground point and its own soft shadow under the feet (do not render a shadow).
- Nothing may extend past the frame; raised arms (`cast`, `caught`, `alert`) must fit inside the character's
  canvas height, so leave head-room in the body height above (16 / 21 / 10 px includes it).
- Camera: orthographic, 32 degrees down (`--tilt`), so "down" shows the face with a little of the top of the
  head, "up" shows the back of the head and shoulders. Steeper tilts make hair swallow the face at 16 px.
  Light: one sun from the **top-left** of the screen (travels +X, +Y, down), no cast shadows, a flat grey world
  for fill so shaded faces snap to the palette's shade swatches.

## Colour rules (checked by `tests/artstyle.test.mjs`)

- Only the 82 colours in `style.json` → `palette`. The packer snaps every pixel to the nearest one, so render with
  flat shading and no tonemapping, and pick materials close to palette colours. To add a colour, add it to
  `style.json` first, in its own commit.
- A 1 px `#1b1424` (ink) outline around the whole silhouette (the packer adds it). Portraits are exempt.
- Alpha is binary: no anti-aliasing, no soft shadows, no glow. Render with `filter_size = 0`.
- Highlights top-left, shade colour on the right column and bottom row.

## Workflow

1. `npm run art:blender` builds `art/blend/characters.blend` (one root Empty per kind, named after it, facing -Y,
   feet at z=0, custom props `kupit_group` and `head_z`), renders and packs. Animation is the scene frame map
   `scene["kupit_frames"]`: walk 1..9, reach 11, caught 12, cast 13, alert 14, sleep 15, phone 16, eat 17.
   A hand-made file may instead use actions on an armature: `Jun.Walk` / `Walk` (loop) and one-frame
   `Jun.Reach`, `Reach`, ... The renderer supports both; `PortraitCam` is created if missing.
2. To iterate on one character: `node tools/blender/run.mjs --kinds mama --skip-build` (or the raw
   `blender -b art/blend/characters.blend -P tools/blender/render_sprites.py -- --out art/renders --kinds mama`).
3. Pack: `python tools/pack_atlas.py art/renders` (per-group sizes from `style.json`; `--size WxH` to override).
   The packer lists any frame the art lock still wants.
4. `npm test` must be green (art lock, atlas coverage). Compare against `docs/art/style-reference.png` at 1x and 4x.
5. `npm run build` (new cache version) and commit `sheet.png` + `atlas.json` (the renders and the .blend are not committed).

`?noatlas` in the URL shows the code-drawn fallback for comparison. A frame missing from the atlas falls back to
that character's idle frame (poses) or to the placeholder (walk frames), so characters can be replaced one at a time.
