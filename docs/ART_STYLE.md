# Locked art style

Settle these rules **before** the Blender batch, so nothing has to be re-rendered later. They are written down as data
in [`tools/art/style.json`](../tools/art/style.json) and checked by `tests/artstyle.test.mjs` on every `npm test`.
A new or re-rendered sprite that breaks a rule fails the test before it can ship. To change the style, change
`style.json` on purpose in its own commit, and re-render everything that the change affects.

Reference image: [`docs/art/style-reference.png`](art/style-reference.png) is one room at night with one adult and one kid,
built from the shipped tile set and night lighting. Compare new renders against it at 1:1 and 4x.

| Rule | Locked value | Why |
|---|---|---|
| Palette | The 82 colours in `style.json` → `palette` (the shipped sheet). `pack_atlas.py` snaps every pixel to them. | Characters and rooms read as one world. New outfits are palette swaps of existing colours. |
| Outline | 1 px `#1b1424` (ink) around every character silhouette. Portraits are exempt. | Keeps sprites readable on any floor, and in the dark. |
| Alpha | On or off only (0 or 255). No anti-aliasing and no soft shadows in the sprite. | Pixel-perfect scaling. The game draws the ground shadow itself. |
| Light | From the **top-left**. Highlights go on upper-left edges and shade colours (`t`, `b`, `h`) on the right column and bottom row. | One light source everywhere: tiles, furniture and characters. |
| Size vs tile (16 px) | Kids 16–20 px tall (about 1.1–1.25 tiles), adults 20–24 px (about 1.4 tiles), dog 11–14 px, cats 7–14 px, portraits 30×30 with the outline. Feet sit on the bottom edge and the body is centred. | Adults must loom over kids, and nobody may cover a whole doorway. |
| Proportions | A 12×9 px head on a small body for everyone (`HEADS` in `tools/art/make_art.py`, one hand-drawn head per character and view). Kids have 2×2 eyes with a white sparkle, adults solid 2×2 eyes (lashes or a brow), elders a 2 px line. | The face has to read at game size; the sparkle is what makes a kid a kid. |
| Portrait moods | Every speaker has `portrait\|kind` plus `happy`, `sad`, `angry`, `shock` (`style.json` → `moods`). | Story panels carry the scene with the face. |
| Directions | 4-way: down (`0`), right (`2`), up (`3`). Left is the right sprite **mirrored in code**, never stored. | Halves the render and animation work. 8 directions add little at this size. |
| Frame budget | 4-frame walk cycle per direction (frame 0 = idle). Kids add `reach`, `caught`, `cast`; adults add `alert`, `sleep`, `phone`, `reach`; the dog adds `sleep`, `alert`, `eat`. At most 24 frames per character (`docs/ART_SPEC.md` says when each shows). | Enough life at 6–8 fps without bloating the sheet. |
| Atlas | Everything in one `assets/sprites/sheet.png` + `atlas.json`, keys `kind\|dir\|frame`. | One texture and one request, which the offline cache (sw.js) handles as a unit. |
| Variants | New characters that are "the same body, different clothes" (guests, tanod, tindera, kid outfits) are palette swaps in `src/render/sprites.js` (`VARIANTS`, `KID_SLOTS`), not new renders. | Zero extra art for new content. |

## Before the Blender batch

1. Render **one** character with `tools/blender/render_sprites.py --kinds mama`, pack it with
   `python tools/pack_atlas.py art/renders` and run `npm test`. Fix the camera and light until `artstyle` passes and the
   sprite sits next to `docs/art/style-reference.png` without looking out of place.
2. Only then render the rest. The renderer's light is a sun from the top-left. Keep it there.
3. To add a colour, add it to `style.json` first, then render. Never let the packer invent new ones.

## The 2026-11 redesign

The palette in `style.json` was regenerated on purpose (`py -3 tools/art/make_art.py --palette`) when the characters
were redrawn: bigger heads, readable faces, the cats (`pusa`, `kuting`; Puti and Muning are recolours in
`src/render/sprites.js`) and the portrait moods. The shipped sheet is the code-drawn one. `npm run art:blender`
still runs, but its box toys have no cats and no moods, so its sheet fails `tests/redesign.test.mjs`: update
`tools/blender/build_characters.py` before using it again.
