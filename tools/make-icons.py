"""Draws the Kupit app icons (pixel art, scaled with nearest-neighbour) into icons/.
Run:  python tools/make-icons.py      (needs Pillow)
"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'icons')
os.makedirs(OUT, exist_ok=True)

INK, GOLD, GOLD2 = (27, 20, 36), (255, 216, 77), (201, 150, 43)
PURSE, PURSE2, PLUM = (138, 59, 31), (185, 86, 46), (74, 58, 95)

K = ['1001', '1010', '1100', '1010', '1001']  # the "K" on the coin (4x5 pixels, drawn 1.5x wide below)


def art():
    """32x32 icon: a gold coin peeking out of a purse."""
    im = Image.new('RGB', (32, 32), INK)
    d = ImageDraw.Draw(im)
    for y in range(0, 32, 2):  # faint floor stripes
        d.line([(0, y + 29), (31, y + 29)], fill=(36, 28, 48))
    d.ellipse([8, 2, 23, 17], fill=GOLD2)
    d.ellipse([9, 3, 22, 16], fill=GOLD)
    for y, row in enumerate(K):
        for x, c in enumerate(row):
            if c == '1':
                d.rectangle([12 + x * 2 - 1, 6 + y * 2 - 1, 12 + x * 2, 6 + y * 2], fill=INK)
    d.rectangle([6, 15, 25, 28], fill=INK)             # outline
    d.rectangle([7, 16, 24, 27], fill=PURSE)
    d.rectangle([7, 16, 24, 19], fill=PURSE2)
    d.rectangle([14, 20, 17, 23], fill=GOLD)           # clasp
    d.rectangle([15, 21, 16, 22], fill=GOLD2)
    d.line([(7, 27), (24, 27)], fill=(98, 40, 20))
    return im


def scaled(im, size, pad=0):
    inner = size - 2 * pad
    big = im.resize((inner, inner), Image.NEAREST)
    out = Image.new('RGB', (size, size), INK)
    out.paste(big, (pad, pad))
    return out


a = art()
scaled(a, 192).save(os.path.join(OUT, 'icon-192.png'))
scaled(a, 512).save(os.path.join(OUT, 'icon-512.png'))
scaled(a, 512, pad=64).save(os.path.join(OUT, 'icon-maskable-512.png'))  # safe zone for round/squircle masks
scaled(a, 180, pad=10).save(os.path.join(OUT, 'apple-touch-icon.png'))
print('icons written to', os.path.normpath(OUT))
