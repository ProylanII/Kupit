"""Turns rendered character frames (e.g. from Blender) into the game's pixel sprite sheet.

    python tools/pack_atlas.py RENDER_DIR [--size 10x12] [--out assets/sprites]

RENDER_DIR holds transparent PNGs named  <kind>_<dir>_<frame>.png  where
  kind  = jun, bing, ramil, nene, mama, lola, tita, tatay, kuya, nena, ninang, aso (see src/render/sprites.js)
  dir   = 0 down (towards camera), 2 right, 3 up      (left is mirrored in the game)
  frame = 0..3 walk cycle                              (frame 0 is also the idle pose)

Each frame is scaled down to --size (the sprite body, without outline), every pixel is snapped to the game
palette (src/render/palette.js), alpha is thresholded (no anti-aliasing), and a 1px ink outline is added, so
the result matches the placeholder sprites. Feet should sit at the bottom edge and the body be centred.
Writes sheet.png + atlas.json (frame key "kind|dir|frame") into --out. Needs Pillow.
"""
import argparse, json, os, re, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
INK = (27, 20, 36)


def load_palette():
    # the locked art palette (docs/ART_STYLE.md); tests/artstyle.test.mjs rejects any colour outside it
    style = os.path.join(ROOT, 'tools', 'art', 'style.json')
    if os.path.exists(style):
        with open(style, encoding='utf8') as fh:
            return sorted({tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in json.load(fh)['palette']})
    src = open(os.path.join(ROOT, 'src', 'render', 'palette.js'), encoding='utf8').read()
    cols = sorted({tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) for h in re.findall(r"#([0-9a-fA-F]{6})", src)})
    return cols


def nearest(px, palette):
    return min(palette, key=lambda c: (c[0] - px[0]) ** 2 + (c[1] - px[1]) ** 2 + (c[2] - px[2]) ** 2)


def pixelate(im, size, palette):
    im = im.convert('RGBA').resize(size, Image.BOX)
    w, h = im.size
    out = Image.new('RGBA', (w + 2, h + 2), (0, 0, 0, 0))
    src = im.load()
    solid = [[src[x, y][3] >= 128 for x in range(w)] for y in range(h)]
    o = out.load()
    for y in range(h):
        for x in range(w):
            if solid[y][x]:
                o[x + 1, y + 1] = nearest(src[x, y][:3], palette) + (255,)
    for y in range(h):          # 1px outline around the silhouette
        for x in range(w):
            if solid[y][x]:
                continue
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and solid[ny][nx]:
                    o[x + 1, y + 1] = INK + (255,)
                    break
    for x in range(w):          # outline on the border rows/cols of the padded canvas
        for y in (0, h + 1):
            ny = 0 if y == 0 else h - 1
            if solid[ny][x]:
                o[x + 1, y] = INK + (255,)
    for y in range(h):
        for x in (0, w + 1):
            nx = 0 if x == 0 else w - 1
            if solid[y][nx]:
                o[x, y + 1] = INK + (255,)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('renders')
    ap.add_argument('--size', default='10x12', help='body size in pixels, WxH (default 10x12)')
    ap.add_argument('--out', default=os.path.join(ROOT, 'assets', 'sprites'))
    a = ap.parse_args()
    size = tuple(int(v) for v in a.size.lower().split('x'))
    palette = load_palette()

    frames = {}
    for name in sorted(os.listdir(a.renders)):
        m = re.fullmatch(r'([a-z]+)_(\d)_(\d)\.png', name)
        if not m:
            continue
        kind, d, f = m.group(1), int(m.group(2)), int(m.group(3))
        if d not in (0, 2, 3):
            print('skip (left is mirrored automatically):', name)
            continue
        frames[f'{kind}|{d}|{f}'] = pixelate(Image.open(os.path.join(a.renders, name)), size, palette)
    if not frames:
        sys.exit('no <kind>_<dir>_<frame>.png files found in ' + a.renders)

    cw = max(im.width for im in frames.values()); ch = max(im.height for im in frames.values())
    cols = 12
    keys = sorted(frames)
    rows = (len(keys) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cw, rows * ch), (0, 0, 0, 0))
    atlas = {'image': 'sheet.png', 'size': [sheet.width, sheet.height], 'frames': {}}
    for i, k in enumerate(keys):
        x, y = (i % cols) * cw, (i // cols) * ch
        sheet.paste(frames[k], (x, y))
        atlas['frames'][k] = {'x': x, 'y': y, 'w': frames[k].width, 'h': frames[k].height}
    os.makedirs(a.out, exist_ok=True)
    sheet.save(os.path.join(a.out, 'sheet.png'))
    with open(os.path.join(a.out, 'atlas.json'), 'w', encoding='utf8') as fh:
        json.dump(atlas, fh, indent=2)
    print(f'{len(keys)} frames -> {os.path.normpath(a.out)}')


if __name__ == '__main__':
    main()
