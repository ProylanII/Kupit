"""Turns rendered character frames (e.g. from Blender) into the game's pixel sprite sheet.

    python tools/pack_atlas.py RENDER_DIR [--size WxH] [--out assets/sprites]

RENDER_DIR holds transparent PNGs named  <kind>_<dir>_<frame>.png  and  portrait_<kind>.png  where
  kind  = jun, bing, ramil, nene, mama, lola, tita, tatay, kuya, nena, ninang, aso (tools/art/style.json "kinds")
  dir   = 0 down (towards camera), 2 right, 3 up      (left is mirrored in the game)
  frame = 0..3 walk cycle (0 is also the idle pose), or a pose name: reach, caught, cast (kids),
          alert, sleep, phone, reach (adults), sleep, alert, eat (dog)   -- see docs/ART_SPEC.md

Each render is cropped to its silhouette and scaled so the body is as tall as the locked style says
(kids 16, adults 21, dog 10 px before the outline; portraits 28x28), every pixel is snapped to the locked palette,
alpha is thresholded (no anti-aliasing) and a 1px ink outline is added. --size WxH forces one body size for all.
Writes sheet.png + atlas.json (frame key "kind|dir|frame", "portrait|kind") into --out. Needs Pillow.
Then: npm run build (offline list) and npm test (the art lock checks the result).
"""
import argparse, json, os, re, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
INK = (27, 20, 36)


def load_style():
    # the locked art style (docs/ART_STYLE.md); tests/artstyle.test.mjs rejects anything outside it
    with open(os.path.join(ROOT, 'tools', 'art', 'style.json'), encoding='utf8') as fh:
        return json.load(fh)


def palette_of(style):
    return sorted({tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in style['palette']})


def group_of(style, kind):
    for g, kinds in style['kinds'].items():
        if kind in kinds:
            return g
    return None


# body height (without the 1px outline) that lands in the middle of the locked range for the group
def body_height(style, group):
    lo, hi = style['height'][group]
    return (lo + hi) // 2 - 2


def nearest(px, palette):
    return min(palette, key=lambda c: (c[0] - px[0]) ** 2 + (c[1] - px[1]) ** 2 + (c[2] - px[2]) ** 2)


def fit(im, body_h, force=None):
    """Crop to the silhouette, then scale to the body height (keeping the aspect) or to a forced WxH."""
    im = im.convert('RGBA')
    box = im.getbbox()
    if box:
        im = im.crop(box)
    if force:
        return im.resize(force, Image.BOX)
    w = max(1, round(im.width * body_h / im.height))
    return im.resize((w, body_h), Image.BOX)


def pixelate(im, palette):
    w, h = im.size
    out = Image.new('RGBA', (w + 2, h + 2), (0, 0, 0, 0))
    src = im.load()
    solid = [[src[x, y][3] >= 128 for x in range(w)] for y in range(h)]
    o = out.load()
    for y in range(h):
        for x in range(w):
            if solid[y][x]:
                o[x + 1, y + 1] = nearest(src[x, y][:3], palette) + (255,)
    for y in range(-1, h + 1):          # 1px outline around the silhouette (includes the padding ring)
        for x in range(-1, w + 1):
            if 0 <= x < w and 0 <= y < h and solid[y][x]:
                continue
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and solid[ny][nx]:
                    o[x + 1, y + 1] = INK + (255,)
                    break
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('renders')
    ap.add_argument('--size', help='force one body size in pixels, WxH (default: per group from style.json)')
    ap.add_argument('--out', default=os.path.join(ROOT, 'assets', 'sprites'))
    a = ap.parse_args()
    style = load_style()
    palette = palette_of(style)
    force = tuple(int(v) for v in a.size.lower().split('x')) if a.size else None

    frames = {}
    for name in sorted(os.listdir(a.renders)):
        m = re.fullmatch(r'([a-z]+)_(\d)_([a-z0-9]+)\.png', name)
        pm = re.fullmatch(r'portrait_([a-z]+)\.png', name)
        if pm:
            kind = pm.group(1)
            im = Image.open(os.path.join(a.renders, name)).convert('RGBA')
            frames[f'portrait|{kind}'] = pixelate(im.resize((28, 28), Image.BOX), palette)
            continue
        if not m:
            continue
        kind, d, f = m.group(1), int(m.group(2)), m.group(3)
        if d not in (0, 2, 3):
            print('skip (left is mirrored automatically):', name)
            continue
        group = group_of(style, kind)
        if not group:
            print('skip (unknown kind, add it to style.json):', name)
            continue
        im = Image.open(os.path.join(a.renders, name))
        frames[f'{kind}|{d}|{f}'] = pixelate(fit(im, body_height(style, group), force), palette)
    if not frames:
        sys.exit('no <kind>_<dir>_<frame>.png files found in ' + a.renders)
    for k in list(frames):  # 'kid' is a legacy alias of jun (old saves, tests): never render it, copy it
        if k.startswith('jun|') and ('kid|' + k[4:]) not in frames:
            frames['kid|' + k[4:]] = frames[k]

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
    # what the art lock will want and is not here yet
    want = []
    for group, kinds in style['kinds'].items():
        for kind in kinds:
            for d in style['directions']:
                for fr in list(range(style['walkFrames'])) + list(style['poses'].get(group, [])):
                    if f'{kind}|{d}|{fr}' not in frames:
                        want.append(f'{kind}_{d}_{fr}.png')
    if want:
        print(f'missing {len(want)} frames the art lock requires, e.g. {", ".join(want[:6])}')


if __name__ == '__main__':
    main()
