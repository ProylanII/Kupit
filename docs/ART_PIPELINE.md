# Art pipeline: Blender characters -> pixel sprites

The game draws characters from `assets/sprites/sheet.png` + `atlas.json` (loaded by `src/render/atlas.js`).
If a frame is missing from the atlas, `src/render/sprites.js` falls back to its code-drawn placeholder, so you can
replace characters one at a time. `?noatlas` in the URL forces the placeholders.

The shipped sheet is **drawn in code** by `tools/art/make_art.py` (Python + Pillow): every character is built from
parts (head, hair style, top, bottom, accessories) with a 4-frame walk, poses and a 28x28 portrait.
Edit `LOOKS`/`BUILDS` there and run `python tools/art/make_art.py` (add `--preview out.png --scale 6` to check it
zoomed in). Real Blender art has not been made yet; when it is, `pack_atlas.py` replaces the same two files.

## Sprite contract

| | |
|---|---|
| Kinds | `jun bing ramil nene` (kids), `mama lola tita tatay kuya nena ninang` (adults), `aso` (dog) |
| Directions | `0` down (towards camera), `2` right, `3` up. Left is mirrored in code. |
| Frames | `0..3` walk cycle. Frame 0 doubles as the idle pose. |
| Poses | Named frames, required by the art lock: kids `reach caught cast`, adults `alert sleep phone reach`, dog `sleep alert eat` (see [ART_SPEC.md](ART_SPEC.md) for when each shows). Missing poses fall back to frame 0. |
| Portraits | Optional `portrait|<kind>` (30x30 bust) for character select, boss banners and the caught screen. |
| Key | `"kind|dir|frame"` in `atlas.json`, e.g. `"mama|2|1"` |
| Size | Locked: kids 16-20 px tall, adults 20-24, dog 11-14 including the 1px ink outline (`tools/art/style.json`). Feet on the bottom edge, body centred, every frame of a character the same canvas size. |
| Colours | Flat colours, no anti-aliasing; alpha is on/off. `pack_atlas.py` snaps to `src/render/palette.js`. |

## Workflow

1. **Model + rig** each character in Blender (chunky, warm, toy-like low-poly; flat shading). Name the top-level
   object after the kind (`jun`, `mama`, ...), facing -Y. Add a `Walk` action (loopable cycle).
   Keep `.blend` files in `art/blend/` (not committed if large).
2. **Render** all directions and frames:
   `blender -b art/blend/characters.blend -P tools/blender/render_sprites.py -- --out art/renders`
   (orthographic ~50 degree camera, transparent film, no anti-aliasing, flat colours).
   `tools/blender/render_sprites.py` has **not been run yet** (Blender was not installed when it was written);
   expect to tweak camera distance/`ortho_scale` on first use.
3. **Pixelate + pack** (needs Python + Pillow):
   `python tools/pack_atlas.py art/renders`
   Crops and shrinks each render to the locked body height for its group, snaps every pixel to the locked palette,
   thresholds alpha, adds the ink outline and writes `assets/sprites/sheet.png` + `atlas.json`. Frames named
   `<kind>_<dir>_<frame|pose>.png` and `portrait_<kind>.png`; `_1_` (left) is skipped. It prints any frame the art
   lock still expects.
4. **Rebuild the offline list**: `npm run build`, then `npm test` (checks the atlas covers every character).

Hand-drawn pixel art (Aseprite/Piskel) works the same way: export frames with those names and run step 3, or write
the sheet + atlas yourself.

## Placeholders

`src/render/sprites.js` still has the old simple code-drawn characters as a fallback (`?noatlas`).
`tools/export-sprites.html` exports those placeholders as a sheet (only useful for comparing).

## Code-drawn art (not in the sheet)

- `src/render/tiles.js`: plank/tile/grass floors, rugs, contact shadows, furniture (gingham tables, sofas,
  banig beds, plants, kitchen counters with stove/sink/rice cooker, ref with magnets), walls with plaster,
  baseboards and decor (capiz and jalousie windows, giant spoon and fork, clock, calendar, photo), hollow-block
  fences on the yard side, and sunlight through windows. Extra colours live in `palette.js`.
- `src/render/sprites.js`: targets, items, hiding spots (box, curtain, labahan), TV, radio (ASCII maps).
- `src/scenes/play.js` `drawNight`: night levels get a dark layer with light pools (player, TV, moonlit windows, open exit).
- `src/main.js` `buildTitleBg`: title screen night skyline.
