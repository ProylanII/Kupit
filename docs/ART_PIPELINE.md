# Art pipeline: Blender characters -> pixel sprites

The game draws characters from `assets/sprites/sheet.png` + `atlas.json` (loaded by `src/render/atlas.js`).
If a frame is missing from the atlas, `src/render/sprites.js` falls back to its code-drawn placeholder, so you can
replace characters one at a time. `?noatlas` in the URL forces the placeholders.

The shipped sheet is currently an **export of the placeholders** (pixel-identical), made with
`tools/export-sprites.html`. Real Blender art has not been made yet.

## Sprite contract

| | |
|---|---|
| Kinds | `jun bing ramil nene` (kids), `mama lola tita tatay kuya nena ninang` (adults), `aso` (dog) |
| Directions | `0` down (towards camera), `2` right, `3` up. Left is mirrored in code. |
| Frames | `0..3` walk cycle. Frame 0 doubles as the idle pose. |
| Key | `"kind|dir|frame"` in `atlas.json`, e.g. `"mama|2|1"` |
| Size | ~10x12 px body + 1px ink outline (adults are a bit taller). Any size works: feet sit on the bottom edge, body centred. |
| Colours | Only the colours in `src/render/palette.js`; no anti-aliasing; alpha is on/off |

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
   `python tools/pack_atlas.py art/renders --size 10x12`
   Shrinks each render, snaps every pixel to the game palette, thresholds alpha, adds the ink outline and writes
   `assets/sprites/sheet.png` + `atlas.json`. Frames named `<kind>_<dir>_<frame>.png`; `_1_` (left) is skipped.
4. **Rebuild the offline list**: `npm run build`, then `npm test` (checks the atlas covers every character).

Hand-drawn pixel art (Aseprite/Piskel) works the same way: export frames with those names and run step 3, or write
the sheet + atlas yourself.

## Regenerating the placeholder sheet

`python -m http.server 8080`, open `/tools/export-sprites.html`, download `sheet.png` and `atlas.json` into
`assets/sprites/`. Do this if `LOOKS` in `src/render/sprites.js` changes and you still use the placeholders.

## Not covered yet

Targets (purse, bayong, ...), furniture, tiles and UI icons are still code-drawn (`sprites.js`, `tiles.js`).
Tile/object art can use the same atlas approach later.
