"""Kupit art generator: draws every character sprite (walk cycle + poses) and the portraits in code,
then writes assets/sprites/sheet.png + atlas.json (the same files tools/pack_atlas.py makes from Blender renders).

    python tools/art/make_art.py [--preview PATH] [--scale 6]

Frame keys in atlas.json:
  kind|dir|0..3     walk cycle (0 = idle). dir 0 down, 2 right, 3 up; left is mirrored in the game.
  kind|dir|reach    kids: grabbing coins        adults: n/a
  kind|dir|alert    adults: "HOY!" (spotted you / chasing a sound)
  kind|dir|sleep    adults: eyes closed (asleep, eating)
  kind|dir|caught   kids: arms up, eyes shut
  portrait|kind     28x28 bust for menus and boss banners

Characters are built from parts (head, hair style, top, bottom, accessories) so every one has its own silhouette.
Needs Pillow.
"""
import argparse, json, os
from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
INK = '#1b1424'


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


class Cv:
    """Tiny pixel canvas. Colours are look keys ('S', 'T', ...) or '#rrggbb'."""

    def __init__(self, w, h):
        self.w, self.h, self.p = w, h, {}

    def px(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            if c is None:
                self.p.pop((x, y), None)
            else:
                self.p[(x, y)] = c

    def rect(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.px(xx, yy, c)

    def hline(self, x0, x1, y, c):
        for x in range(x0, x1 + 1):
            self.px(x, y, c)

    def vline(self, x, y0, y1, c):
        for y in range(y0, y1 + 1):
            self.px(x, y, c)

    def has(self, x, y):
        return (x, y) in self.p

    def rows(self, x, y, rows, pal):
        """Stamp an ASCII block; '.' is transparent, other chars map through pal (or are look keys)."""
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch != '.':
                    self.px(x + i, y + j, pal.get(ch, ch))

    def image(self, look, outline=True):
        pad = 1 if outline else 0
        im = Image.new('RGBA', (self.w + 2 * pad, self.h + 2 * pad), (0, 0, 0, 0))
        o = im.load()
        if outline:
            for (x, y) in self.p:
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    if (x + dx, y + dy) not in self.p:
                        o[x + dx + pad, y + dy + pad] = rgb(INK) + (255,)
        for (x, y), c in self.p.items():
            col = c if c.startswith('#') else look.get(c, INK)
            o[x + pad, y + pad] = rgb(col) + (255,)
        return im


# ---------------------------------------------------------------- characters
SKIN = {'S': '#f2c394', 's': '#d89f6c'}
TAN = {'S': '#d9a06a', 's': '#b07a4c'}
OLD = {'S': '#ecb98f', 's': '#c98e62'}
BLUSH = '#ec8f86'

# build: canvas width, rows above the head (hair volume), torso rows, leg rows, torso width
BUILDS = {
    'kid':   dict(W=12, top=1, torso=4, legs=3, tw=8),
    'small': dict(W=12, top=1, torso=3, legs=3, tw=8),
    'teen':  dict(W=12, top=1, torso=5, legs=4, tw=8),
    'adult': dict(W=14, top=2, torso=6, legs=5, tw=8),
    'big':   dict(W=14, top=1, torso=6, legs=5, tw=10),
    'old':   dict(W=14, top=2, torso=6, legs=4, tw=8),
    'perm':  dict(W=16, top=2, torso=6, legs=5, tw=8),
}

# H/h/k hair (base/shade/shine)  T/t/U top (base/shade/pattern)  B/b bottom  F shoes  A/a accessory
LOOKS = {
    'jun':   dict(build='kid', **SKIN, H='#2a1f33', h='#1b1424', k='#4a3d5c', T='#ffd84d', t='#e0a92e', U='#f6f1e7',
                  B='#2f5fbf', b='#24488f', F='#5f8fe0', hair='spiky', top='tee', bottom='shorts', kid=True),
    'bing':  dict(build='small', **SKIN, H='#2a1f33', h='#1b1424', k='#4a3d5c', T='#ff7eb6', t='#d9578f', U='#f6f1e7',
                  B='#ff7eb6', b='#d9578f', F='#c0306a', A='#ffe36b', hair='pigtails', top='dress', bottom='skirt', kid=True, dots=True),
    'ramil': dict(build='teen', **TAN, H='#2a1f33', h='#1b1424', k='#4a3d5c', T='#2fa55b', t='#227a43', U='#f6f1e7',
                  B='#3a3550', b='#2a2640', F='#f6f1e7', A='#d94040', a='#a82e2e', hair='capback', top='jersey', bottom='shorts', kid=True),
    'nene':  dict(build='kid', **SKIN, H='#4a2c1c', h='#33201a', k='#6e4430', T='#ff9a3c', t='#d9762a', U='#f6f1e7',
                  B='#f6f1e7', b='#cfc7b8', F='#a8433f', A='#ff4b4b', a='#c02f3a', hair='long', top='blouse', bottom='skirt', kid=True, band=True),
    'mama':  dict(build='adult', **SKIN, H='#3a2418', h='#24160f', k='#5a3a28', T='#d94a4a', t='#a83a3a', U='#ffd0a0',
                  B='#d94a4a', b='#a83a3a', F='#ff7eb6', A='#ffd84d', hair='bun', top='dress', bottom='daster', flowers=True, clip=True),
    'lola':  dict(build='old', **OLD, H='#ece6dc', h='#bdb6ab', k='#ffffff', T='#8a5fb5', t='#6b4a8c', U='#c9a8e8',
                  B='#4a3a5f', b='#382a4a', F='#5a5468', A='#8a5a2b', a='#c48a4a', G='#9a94a8', hair='bun', top='blouse',
                  bottom='longskirt', cane=True, glasses=True),
    'tita':  dict(build='adult', **SKIN, H='#ff7eb6', h='#d9578f', k='#ffb0d4', T='#2fa59b', t='#22807a', U='#7fe0d4',
                  B='#f6f1e7', b='#cfc7b8', F='#ffd84d', A='#1b1424', a='#7fd7ff', hair='long', top='blouse', bottom='pants', shades=True),
    'tatay': dict(build='big', **TAN, H='#2a1f33', h='#1b1424', k='#4a3d5c', T='#f6f1e7', t='#cfc7b8', U='#ffffff',
                  B='#3a4f8a', b='#2b3b6a', F='#5a5468', hair='short', top='sando', bottom='shorts', stache=True),
    'kuya':  dict(build='adult', **SKIN, H='#3a2418', h='#24160f', k='#5a3a28', T='#46a0e0', t='#3580b8', U='#f6f1e7',
                  B='#5a5468', b='#46415a', F='#f6f1e7', A='#2f5fbf', a='#24488f', hair='cap', top='tee', bottom='pants', stripe=True),
    'nena':  dict(build='adult', **SKIN, H='#9a94a8', h='#7a7488', k='#c4bfd0', T='#4f7fd0', t='#3a62a8', U='#f6f1e7',
                  B='#6b3a5a', b='#4f2a44', F='#5a5468', A='#f0e6c8', a='#d6c9a4', hair='bun', top='tee', bottom='longskirt', apron=True, towel=True),
    'ninang': dict(build='perm', **SKIN, H='#4a2c5a', h='#2e1a3a', k='#7a5a8c', T='#c0306a', t='#8a2050', U='#ff7eb6',
                   B='#c0306a', b='#8a2050', F='#ffd84d', A='#ffd84d', a='#ff4b4b', hair='perm', top='terno', bottom='longskirt',
                   lips=True, earrings=True, fan=True),
}
KIDS = ['jun', 'bing', 'ramil', 'nene']
ADULTS = ['mama', 'lola', 'tita', 'tatay', 'kuya', 'nena', 'ninang']
WALK = [0, 1, 2, 3]


def layout(look):
    b = BUILDS[look['build']]
    W, top, torso, legs, tw = b['W'], b['top'], b['torso'], b['legs'], b['tw']
    H = top + 8 + torso + legs
    return dict(W=W, H=H, top=top, torso=torso, legs=legs, tw=tw, x0=(W - 10) // 2, tx0=(W - tw) // 2, cx=W // 2)


# ---- head ---------------------------------------------------------------------
def face_front(c, L, look, hy, pose):
    x0 = L['x0']
    c.rect(x0, hy + 2, 10, 5, 'S')
    c.hline(x0 + 1, x0 + 8, hy + 7, 'S')
    c.vline(x0 + 9, hy + 3, hy + 6, 's')
    c.px(x0 + 8, hy + 7, 's')
    kid = look.get('kid')
    shut = pose in ('sleep', 'caught')
    for ex in (x0 + 2, x0 + 7):
        if shut:
            c.hline(ex - (0 if ex == x0 + 2 else 1), ex + (1 if ex == x0 + 2 else 0), hy + 5, INK)
        elif kid or pose == 'alert':
            c.vline(ex, hy + 4, hy + 5, INK)
        else:
            c.px(ex, hy + 5, INK)
            c.hline(ex - (1 if ex == x0 + 2 else 0), ex + (0 if ex == x0 + 2 else 1), hy + 4 if pose != 'alert' else hy + 3, 'h')
    if kid and not shut:
        c.px(x0 + 1, hy + 6, BLUSH); c.px(x0 + 8, hy + 6, BLUSH)
    if pose in ('alert', 'caught'):
        c.hline(x0 + 4, x0 + 5, hy + 7, INK)
    if look.get('stache'):
        c.hline(x0 + 3, x0 + 6, hy + 6, 'H')
    if look.get('lips') and pose not in ('alert',):
        c.hline(x0 + 4, x0 + 5, hy + 6, '#e0304a')
    if look.get('glasses') and not shut:
        for ex in (x0 + 2, x0 + 7):
            c.px(ex - 1, hy + 4, 'G'); c.px(ex + 1, hy + 4, 'G'); c.px(ex - 1, hy + 5, 'G'); c.px(ex + 1, hy + 5, 'G')
            c.px(ex, hy + 4, '#dfe7ee')
        c.hline(x0 + 4, x0 + 5, hy + 4, 'G')
    if look.get('earrings'):
        c.px(x0, hy + 7, 'A'); c.px(x0 + 9, hy + 7, 'A')


def face_side(c, L, look, hy, pose):
    x0 = L['x0']
    c.hline(x0 + 3, x0 + 9, hy + 3, 'S')
    c.hline(x0 + 3, x0 + 9, hy + 4, 'S')
    c.hline(x0 + 2, x0 + 9, hy + 5, 'S')
    c.hline(x0 + 2, x0 + 9, hy + 6, 'S')
    c.hline(x0 + 3, x0 + 8, hy + 7, 'S')
    c.px(x0 + 10, hy + 5, 'S')            # nose
    c.px(x0 + 4, hy + 5, 's')             # ear
    c.hline(x0 + 3, x0 + 5, hy + 7, 's')  # jaw shade
    kid = look.get('kid')
    shut = pose in ('sleep', 'caught')
    if shut:
        c.hline(x0 + 7, x0 + 8, hy + 5, INK)
    elif kid or pose == 'alert':
        c.vline(x0 + 8, hy + 4, hy + 5, INK)
    else:
        c.px(x0 + 8, hy + 5, INK); c.hline(x0 + 7, x0 + 9, hy + 4, 'h')
    if kid and not shut:
        c.px(x0 + 8, hy + 6, BLUSH)
    if pose in ('alert', 'caught'):
        c.px(x0 + 9, hy + 7, INK)
    if look.get('stache'):
        c.hline(x0 + 8, x0 + 10, hy + 6, 'H')
    if look.get('lips') and pose != 'alert':
        c.px(x0 + 9, hy + 7, '#e0304a')
    if look.get('glasses') and not shut:
        c.px(x0 + 7, hy + 4, 'G'); c.px(x0 + 9, hy + 4, 'G'); c.px(x0 + 9, hy + 5, 'G'); c.px(x0 + 7, hy + 5, 'G')
        c.px(x0 + 6, hy + 4, 'G'); c.px(x0 + 5, hy + 4, 'G')
    if look.get('earrings'):
        c.px(x0 + 4, hy + 7, 'A')


def back_head(c, L, look, hy):
    x0 = L['x0']
    c.hline(x0 + 2, x0 + 7, hy, 'H')
    c.hline(x0 + 1, x0 + 8, hy + 1, 'H')
    c.rect(x0, hy + 2, 10, 5, 'H')
    c.hline(x0 + 1, x0 + 8, hy + 7, 'H')
    c.vline(x0 + 9, hy + 3, hy + 6, 'h')
    c.hline(x0 + 2, x0 + 7, hy + 7, 'h')
    c.hline(x0 + 3, x0 + 5, hy + 1, 'k')


def cap_dome(c, x0, hy):
    """Hair dome rows hy..hy+2 (shared by most styles)."""
    c.hline(x0 + 2, x0 + 7, hy, 'H')
    c.hline(x0 + 1, x0 + 8, hy + 1, 'H')
    c.hline(x0, x0 + 9, hy + 2, 'H')
    c.hline(x0 + 3, x0 + 5, hy + 1, 'k')
    c.px(x0 + 9, hy + 2, 'h'); c.px(x0 + 8, hy + 1, 'h')


def hair(c, L, look, hy, view):
    x0, st = L['x0'], look['hair']
    if view == 'back':
        back_head(c, L, look, hy)
        if st in ('short', 'spiky', 'cap', 'capback'):
            c.hline(x0 + 3, x0 + 6, hy + 7, 's')      # neck
            c.px(x0, hy + 4, 's'); c.px(x0 + 9, hy + 4, 's')   # ears
    else:
        cap_dome(c, x0, hy)
    if st == 'spiky':
        for sx in (x0 + 2, x0 + 5, x0 + 7):
            c.px(sx, hy - 1, 'H')
        c.px(x0 + 1, hy, 'H'); c.px(x0 + 8, hy, 'H')
        if view == 'front':
            for i, on in enumerate('HHH.HH.HHH'):
                if on == 'H':
                    c.px(x0 + i, hy + 3, 'H')
            c.px(x0, hy + 4, 'H'); c.px(x0 + 9, hy + 4, 'h')
        elif view == 'side':
            c.hline(x0, x0 + 4, hy + 3, 'H'); c.hline(x0, x0 + 3, hy + 4, 'H'); c.hline(x0, x0 + 2, hy + 5, 'H')
            c.hline(x0 + 1, x0 + 2, hy + 6, 'h'); c.px(x0 + 8, hy + 3, 'H'); c.px(x0 + 10, hy + 2, 'H'); c.px(x0 - 1, hy + 2, 'H')
    elif st == 'short':
        if view == 'front':
            c.px(x0, hy + 3, 'H'); c.px(x0 + 9, hy + 3, 'h'); c.hline(x0 + 1, x0 + 3, hy + 3, 'H')
        elif view == 'side':
            c.hline(x0, x0 + 4, hy + 3, 'H'); c.hline(x0, x0 + 3, hy + 4, 'H'); c.hline(x0 + 1, x0 + 2, hy + 5, 'h')
    elif st in ('long', 'pigtails', 'bun', 'perm'):
        if view == 'front':
            if st == 'pigtails':
                c.hline(x0, x0 + 9, hy + 3, 'H')
            elif st == 'perm':
                for i, on in enumerate('HHHH..HHHH'):
                    if on == 'H':
                        c.px(x0 + i, hy + 3, 'H')
            else:
                c.hline(x0, x0 + 5, hy + 3, 'H'); c.hline(x0 + 8, x0 + 9, hy + 3, 'H'); c.px(x0, hy + 4, 'H')
            if st == 'long':
                for y in range(hy + 3, hy + 11):
                    c.px(x0 - 1, y, 'H'); c.px(x0 + 10, y, 'h')
                for y in range(hy + 4, hy + 9):
                    c.px(x0, y, 'H'); c.px(x0 + 9, y, 'h')
            if st == 'bun':
                c.px(x0 + 9, hy + 4, 'h')
        elif view == 'side':
            c.hline(x0, x0 + 4, hy + 3, 'H'); c.hline(x0, x0 + 3, hy + 4, 'H'); c.hline(x0, x0 + 2, hy + 5, 'H')
            c.hline(x0 + 5, x0 + 9, hy + 3, 'H') if st == 'pigtails' else c.hline(x0 + 7, x0 + 9, hy + 3, 'H')
            if st == 'long':
                for y in range(hy + 3, hy + 11):
                    c.hline(x0 - 1, x0 + 2, y, 'H')
                c.vline(x0 - 1, hy + 4, hy + 10, 'h')
            else:
                c.hline(x0 + 1, x0 + 2, hy + 6, 'h')
        else:  # back
            if st == 'long':
                for y in range(hy + 7, hy + 11):
                    c.hline(x0, x0 + 9, y, 'H')
                c.vline(x0 - 1, hy + 3, hy + 10, 'H'); c.vline(x0 + 10, hy + 3, hy + 10, 'h')
                c.hline(x0 + 1, x0 + 8, hy + 10, 'h')
            elif st == 'bun':
                c.hline(x0 + 4, x0 + 5, hy + 2, 'h'); c.rect(x0 + 3, hy + 3, 4, 2, 'h'); c.hline(x0 + 4, x0 + 5, hy + 5, 'h')
                c.px(x0 + 4, hy + 3, 'k')
                c.hline(x0 + 3, x0 + 6, hy + 7, 's')
            elif st == 'pigtails':
                c.hline(x0 + 3, x0 + 6, hy + 7, 's')
        if st == 'pigtails':
            for sx in ((x0 - 2, x0 - 1), (x0 + 10, x0 + 11)) if view != 'side' else ((x0 - 2, x0 - 1),):
                for y in range(hy + 2, hy + 7):
                    c.hline(sx[0], sx[1], y, 'H')
                c.px(sx[0], hy + 6, None)
                c.px(sx[1], hy + 6, 'h')
                c.hline(sx[0], sx[1], hy + 2, 'A')
        if st == 'bun':  # bun on top
            c.hline(x0 + 3, x0 + 6, hy - 2, 'H'); c.hline(x0 + 3, x0 + 6, hy - 1, 'H')
            c.px(x0 + 4, hy - 2, 'k'); c.px(x0 + 5, hy - 2, 'k'); c.px(x0 + 6, hy - 1, 'h'); c.hline(x0 + 3, x0 + 6, hy, 'h')
            if look.get('clip'):
                if view == 'front':
                    c.hline(x0 + 6, x0 + 7, hy, 'A')
                elif view == 'side':
                    c.hline(x0 + 2, x0 + 3, hy, 'A')
                else:
                    c.hline(x0 + 2, x0 + 3, hy, 'A')
        if st == 'perm':
            c.hline(x0 + 1, x0 + 8, hy - 1, 'H'); c.hline(x0 + 3, x0 + 6, hy - 2, 'H')
            sides = (range(x0 - 3, x0 + 1), range(x0 + 9, x0 + 13)) if view != 'side' else (range(x0 - 3, x0 + 3),)
            for xs in sides:
                for x in xs:
                    for y in range(hy, hy + 8):
                        if abs(y - (hy + 3)) + (0 if x in (x0, x0 + 9) else abs(x - (x0 - 1 if x < x0 + 5 else x0 + 10))) <= 4:
                            if view == 'back' or x not in range(x0 + 1, x0 + 9) or view == 'side':
                                if not (view != 'back' and x0 < x < x0 + 9 and y >= hy + 3):
                                    c.px(x, y, 'H')
            for (x, y) in list(c.p):
                if c.p[(x, y)] == 'H' and (x * 3 + y * 5) % 7 == 0:
                    c.px(x, y, 'k' if y < hy + 3 else 'h')
    elif st in ('cap', 'capback'):
        # short hair under a cap (A/a). 'cap' brim faces forward, 'capback' is worn backwards
        c.hline(x0 + 2, x0 + 7, hy - 1, 'A')
        c.hline(x0 + 1, x0 + 8, hy, 'A')
        c.hline(x0, x0 + 9, hy + 1, 'A')
        c.hline(x0, x0 + 9, hy + 2, 'a')
        c.hline(x0 + 3, x0 + 4, hy, '#ffffff' if st == 'cap' else 'A')
        fwd = st == 'cap'
        if view == 'front':
            if fwd:
                c.hline(x0, x0 + 9, hy + 3, 'a'); c.px(x0, hy + 4, 'H'); c.px(x0 + 9, hy + 4, 'h')
            else:
                c.hline(x0 + 1, x0 + 3, hy + 3, 'H'); c.hline(x0 + 6, x0 + 8, hy + 3, 'H'); c.px(x0, hy + 3, 'H'); c.px(x0 + 9, hy + 3, 'h')
                c.px(x0 + 4, hy - 1, 'a')
        elif view == 'side':
            c.hline(x0, x0 + 3, hy + 3, 'H'); c.hline(x0, x0 + 2, hy + 4, 'H'); c.hline(x0 + 1, x0 + 2, hy + 5, 'h')
            if fwd:
                c.hline(x0 + 8, x0 + 11, hy + 2, 'a')
            else:
                c.hline(x0 - 2, x0 + 1, hy + 2, 'a')
        else:
            c.hline(x0, x0 + 9, hy + 2, 'a')
            if fwd:
                c.hline(x0 + 3, x0 + 6, hy + 2, 'H')  # strap gap
            else:
                c.hline(x0 + 1, x0 + 8, hy + 3, 'a')
    if look.get('band'):
        if view == 'front':
            c.hline(x0, x0 + 9, hy + 2, 'A'); c.hline(x0 + 7, x0 + 9, hy, 'A'); c.hline(x0 + 8, x0 + 10, hy + 1, 'a')
        elif view == 'side':
            c.hline(x0 + 1, x0 + 9, hy + 2, 'A'); c.hline(x0 + 1, x0 + 3, hy, 'A'); c.hline(x0, x0 + 2, hy + 1, 'a')
        else:
            c.hline(x0, x0 + 9, hy + 2, 'A'); c.hline(x0 + 1, x0 + 3, hy, 'A'); c.hline(x0 - 1, x0 + 1, hy + 1, 'a')
    if look.get('shades'):
        if view == 'front':
            c.hline(x0 + 1, x0 + 3, hy + 2, 'A'); c.hline(x0 + 6, x0 + 8, hy + 2, 'A'); c.hline(x0 + 4, x0 + 5, hy + 2, 'h')
            c.px(x0 + 2, hy + 2, 'a'); c.px(x0 + 7, hy + 2, 'a')
        elif view == 'side':
            c.hline(x0 + 6, x0 + 9, hy + 2, 'A'); c.px(x0 + 8, hy + 2, 'a')


def pattern(x, y):
    return y % 3 == 1 and (x + (y // 3) * 2) % 4 == 1


# ---- body -----------------------------------------------------------------------
def arm_front(c, x, ty, n, sleeve, hand_drop=0):
    """Vertical arm: sleeve rows then skin, last pixel is the hand."""
    for i in range(n + hand_drop):
        c.px(x, ty + i, ('T' if i == 0 else 't') if i < sleeve else ('S' if i < n + hand_drop - 1 else 's'))


def torso_front(c, L, look, ty, view, pose, f):
    tx0, tw, n, cx = L['tx0'], L['tw'], L['torso'], L['cx']
    top = look['top']
    c.rect(tx0, ty, tw, n, 'T')
    c.vline(tx0 + tw - 1, ty, ty + n - 1, 't')
    c.hline(tx0, tx0 + tw - 1, ty + n - 1, 't') if look['bottom'] not in ('daster',) else None
    if top in ('sando', 'jersey'):  # bare shoulders
        c.px(tx0, ty, 'S'); c.px(tx0 + tw - 1, ty, 's')
        if top == 'jersey':
            c.px(tx0 + 1, ty, 'U'); c.px(tx0 + tw - 2, ty, 'U')
    if view == 'front':
        if top in ('tee', 'sando', 'jersey', 'dress'):
            c.hline(cx - 1, cx, ty, 'S')
        if top == 'blouse':
            c.hline(cx - 2, cx + 1, ty, 'U'); c.hline(cx - 1, cx, ty, 'S')
        if top == 'terno':
            c.hline(cx - 2, cx + 1, ty, 'S'); c.hline(cx - 1, cx, ty + 1, 'S')
        if top == 'jersey':
            c.rect(cx - 1, ty + 1, 2, 2, 'U'); c.px(cx, ty + 2, 't')
        if look.get('stripe'):
            c.hline(tx0, tx0 + tw - 2, ty + 2, 'U')
        if top == 'sando':
            c.hline(tx0 + 2, tx0 + tw - 3, ty + n - 2, 'U')   # belly shine
            c.px(cx - 1, ty + n - 3, 't')                     # belly button
    if look.get('dots') or look.get('flowers'):
        for y in range(ty, ty + n + L['legs']):
            for x in range(tx0 - 1, tx0 + tw + 1):
                if pattern(x, y) and c.p.get((x, y)) in ('T', 't', 'B', 'b'):
                    c.px(x, y, 'U')
    if look.get('apron') and view != 'back':
        if view == 'front':
            c.rect(tx0 + 1, ty + 2, tw - 2, n - 2, 'A'); c.vline(tx0 + tw - 2, ty + 2, ty + n - 1, 'a')
            c.px(tx0 + 2, ty + 1, 'A'); c.px(tx0 + tw - 3, ty + 1, 'A')
        else:
            c.vline(cx + 2, ty + 1, ty + n - 1, 'A')
    if look.get('apron') and view == 'back':
        c.hline(tx0, tx0 + tw - 1, ty + 2, 'A'); c.hline(cx - 1, cx, ty + 3, 'a')
    if look.get('towel') and view != 'side':
        side = tx0 if view == 'front' else tx0 + tw - 2
        c.rect(side, ty - 1, 2, 2, '#f6f1e7'); c.px(side + 1, ty + 1, '#cfc7b8')
    if top == 'terno':  # butterfly sleeves stick up past the shoulders
        if view != 'side':
            c.hline(tx0 - 2, tx0, ty - 1, 'T'); c.hline(tx0 + tw - 1, tx0 + tw + 1, ty - 1, 't')
            c.px(tx0 - 2, ty - 2, 'T'); c.px(tx0 + tw + 1, ty - 2, 't')
        else:
            c.hline(cx - 2, cx + 1, ty - 1, 'T'); c.px(cx - 2, ty - 2, 'T')


def torso_side(c, L, look, ty, pose, f):
    n, cx = L['torso'], L['cx']
    w = 6 if L['tw'] <= 8 else 7
    sx0 = cx - 3
    c.rect(sx0, ty, w, n, 'T')
    c.vline(sx0, ty, ty + n - 1, 't')
    c.hline(sx0, sx0 + w - 1, ty + n - 1, 't') if look['bottom'] != 'daster' else None
    if look['top'] == 'sando':
        c.px(sx0 + w, ty + n - 3, 'T'); c.px(sx0 + w, ty + n - 2, 'T')   # belly
        c.px(sx0 + 1, ty, 'S'); c.px(sx0 + w - 2, ty, 'S')
    if look['top'] == 'jersey':
        c.px(sx0 + 1, ty, 'U'); c.px(sx0 + w - 2, ty, 'S'); c.px(sx0 + 2, ty, 'S')
    if look['top'] in ('tee', 'dress', 'terno', 'blouse'):
        c.px(sx0 + w - 2, ty, 'S')
    if look.get('stripe'):
        c.hline(sx0 + 1, sx0 + w - 1, ty + 2, 'U')
    if look.get('dots') or look.get('flowers'):
        for y in range(ty, ty + n + L['legs']):
            for x in range(sx0 - 1, sx0 + w + 1):
                if pattern(x, y) and c.p.get((x, y)) in ('T', 't', 'B', 'b'):
                    c.px(x, y, 'U')
    if look.get('apron'):
        c.vline(sx0 + w - 1, ty + 1, ty + n + 2, 'A')


def arm_side(c, L, look, ty, pose, f):
    cx, n = L['cx'], L['torso']
    sleeve = 0 if look['top'] in ('sando', 'jersey') else 1 if look['top'] != 'terno' else 2
    col = lambda i, last: ('t' if i < sleeve else ('S' if not last else 's'))
    x = cx - 1
    if pose == 'reach':
        pts = [(x, ty), (x + 1, ty + 1)] + [(x + 2 + i, ty + 1) for i in range(3)]
    elif pose == 'alert':
        pts = [(x, ty), (x + 1, ty)] + [(x + 2 + i, ty) for i in range(4)]
    elif pose == 'caught':
        pts = [(x, ty), (x, ty - 1), (x + 1, ty - 2), (x + 1, ty - 3)]
    elif f == 1:
        pts = [(x, ty)] + [(x + (i + 1) // 2, ty + i) for i in range(1, n)]
    elif f == 3:
        pts = [(x, ty)] + [(x - (i + 1) // 2, ty + i) for i in range(1, n)]
    else:
        pts = [(x, ty + i) for i in range(n)]
    for i, (px, py) in enumerate(pts):
        c.px(px, py, col(i, i == len(pts) - 1))


def legs_front(c, L, look, f, view):
    tx0, tw, H, n = L['tx0'], L['tw'], L['H'], L['legs']
    lt = L['top'] + 8 + L['torso']
    bot = look['bottom']
    long = bot in ('pants',)
    shorts_rows = {'shorts': 1 if n <= 4 else 2, 'pants': n - 1, 'skirt': 1, 'longskirt': n - 1, 'daster': n - 2}[bot]
    for i, lx in enumerate((tx0 + 1, tx0 + tw - 3)):
        lifted = (f == 1 and i == 0) or (f == 3 and i == 1)
        b = H - 1 - (1 if lifted else 0)
        for y in range(lt, b + 1):
            if y == b:
                c.hline(lx, lx + 1, y, 'F')
                if not lifted:
                    c.px(lx - 1 if i == 0 else lx + 2, y, 'F') if view == 'front' else None
            elif y - lt < shorts_rows and bot in ('shorts', 'pants'):
                c.hline(lx, lx + 1, y, 'B' if i == 0 else 'b')
            else:
                c.hline(lx, lx + 1, y, 'S' if i == 0 else 's')
    if bot == 'shorts' or bot == 'pants':
        c.hline(tx0, tx0 + tw - 1, lt, 'B'); c.px(tx0 + tw - 1, lt, 'b')
        if bot == 'shorts' and shorts_rows > 1:
            c.hline(tx0, tx0 + 2, lt + 1, 'B'); c.hline(tx0 + tw - 3, tx0 + tw - 1, lt + 1, 'b')
    else:
        rows = shorts_rows + (1 if bot == 'skirt' else 0)
        for j in range(rows):
            flare = 1 if j >= rows - 2 or bot == 'skirt' else 0
            c.hline(tx0 - flare, tx0 + tw - 1 + flare, lt + j, 'B')
            c.px(tx0 + tw - 1 + flare, lt + j, 'b')
        c.hline(tx0 - 1, tx0 + tw, lt + rows - 1, 'b')


def legs_side(c, L, look, f):
    cx, H, n = L['cx'], L['H'], L['legs']
    lt = L['top'] + 8 + L['torso']
    bot = look['bottom']
    shorts_rows = {'shorts': 1 if n <= 4 else 2, 'pants': n - 1, 'skirt': 1, 'longskirt': n - 1, 'daster': n - 2}[bot]
    stride = f in (1, 3)
    for leg in (0, 1):  # 0 = far leg (shaded), 1 = near leg
        fwd = (leg == 1) == (f == 1)
        for j in range(n):
            y = lt + j
            off = round(j * 2 / max(1, n - 1)) if stride else 0
            x = cx - 2 + (off if fwd else -off) + (0 if leg else 0)
            if y == H - 1:
                col = 'F'
            elif j < shorts_rows and bot in ('shorts', 'pants'):
                col = 'B' if leg else 'b'
            else:
                col = 'S' if leg else 's'
            if leg == 0 and not stride:
                continue
            c.hline(x, x + 1, y, col)
            if y == H - 1:
                c.px(x + 2, y, 'F')
    if bot in ('skirt', 'longskirt', 'daster'):
        rows = shorts_rows + (1 if bot == 'skirt' else 0)
        for j in range(rows):
            flare = 1 if j >= rows - 2 or bot == 'skirt' else 0
            c.hline(cx - 3 - flare, cx + 2 + flare, lt + j, 'B'); c.px(cx - 3 - flare, lt + j, 'b')
    else:
        c.hline(cx - 3, cx + 2, lt, 'B'); c.px(cx - 3, lt, 'b')


def accessories(c, L, look, ty, view, pose, f):
    tx0, tw, H, n, cx = L['tx0'], L['tw'], L['H'], L['torso'], L['cx']
    if look.get('cane') and pose != 'alert':
        if view == 'front':
            x = tx0 + tw + 1
            c.vline(x, ty + n - 2, H - 1, 'A'); c.hline(x - 1, x, ty + n - 2, 'a')
        elif view == 'side':
            x = cx + 3
            c.vline(x, ty + n - 2, H - 1, 'A'); c.hline(x - 1, x, ty + n - 2, 'a')
        else:
            x = tx0 - 2
            c.vline(x, ty + n - 2, H - 1, 'A')
    if look.get('fan') and view != 'back':
        if view == 'front':
            fx, fy = tx0 - 3, ty + n - 4
            c.rows(fx, fy, ['AaA', 'aAa', '.A.'], {})
        else:
            fx, fy = cx + 1, ty + 1
            c.rows(fx, fy, ['.A', 'Aa', 'aA', 'A.'], {}) if pose != 'alert' else None


def humanoid(name, d, f):
    look = LOOKS[name]
    L = layout(look)
    c = Cv(L['W'], L['H'])
    pose = f if isinstance(f, str) else None
    fr = f if isinstance(f, int) else 0
    bob = 1 if fr in (1, 3) else 0
    hy = L['top'] + bob
    ty = L['top'] + 8 + bob
    view = {0: 'front', 2: 'side', 3: 'back'}[d]
    tx0, tw, n = L['tx0'], L['tw'], L['torso']
    sleeve = 0 if look['top'] in ('sando', 'jersey') else 2 if look['top'] == 'terno' else 1
    if view == 'side':
        legs_side(c, L, look, fr)
        torso_side(c, L, look, ty, pose, fr)
    else:
        legs_front(c, L, look, fr, view)
        torso_front(c, L, look, ty, view, pose, fr)
    # head
    if view == 'front':
        face_front(c, L, look, hy, pose)
    elif view == 'side':
        face_side(c, L, look, hy, pose)
    hair(c, L, look, hy, view)
    # arms
    if view == 'side':
        arm_side(c, L, look, ty, pose, fr)
    else:
        ax = (tx0 - 1, tx0 + tw)
        if pose in ('alert', 'caught') and view != 'side':
            for i, x in enumerate((L['x0'] - 1, L['x0'] + 10)):
                c.px(x, ty, 'T' if sleeve else 'S')
                c.vline(x, ty - 3, ty - 1, 'S'); c.px(x, ty - 3, 's')
                c.px(tx0 - 1 if i == 0 else tx0 + tw, ty, 'T' if sleeve else 'S')
        elif pose == 'reach' and view == 'front':
            arm_front(c, ax[0], ty, n - 1, sleeve); arm_front(c, ax[1], ty, n - 1, sleeve)
            c.hline(tx0, tx0 + 1, ty + n - 2, 'S'); c.hline(tx0 + tw - 2, tx0 + tw - 1, ty + n - 2, 's')
        else:
            for i, x in enumerate(ax):
                short = (fr == 1 and i == 1) or (fr == 3 and i == 0)
                arm_front(c, x, ty, n - (1 if short else 0), sleeve)
    accessories(c, L, look, ty, view, pose, fr)
    return c, look


# ---- the dog (askal) ------------------------------------------------------------
DOG = {'H': '#c98a4a', 'h': '#9a6232', 'D': '#6e4424', 'w': '#f0dcb8', 'N': INK, 'E': INK, 'F': '#9a6232'}
DOG_SIDE = [
    '..........DD...',
    '.........HHHD..',
    '.........HHEHHN',
    'D........HHHwh.',
    '.D......HHHw...',
    '.DHHHHHHHHHH...',
    '..HHHHHHHHHh...',
    '..hHHHHHHHHh...',
]
DOG_SIDE_LEGS = {
    0: ['..hH.....hH....', '..FF.....FF....'],
    1: ['.h..H...h..H...', 'F....F.F....F..'],
    2: ['..Hh.....Hh....', '..FF.....FF....'],
    3: ['...hH....hH....', '...FF....FF....'],
}
DOG_FRONT = [
    '.DD....DD.',
    '.DHHHHHHD.',
    '.HHHHHHHH.',
    '.HEHHHHEH.',
    '.HHhNNhHH.',
    '..HwwwwH..',
    '..wwwwww..',
    '..HwwwwH..',
    '..HHHHHh..',
]
DOG_BACK = [
    '.DD....DD.',
    '.DHHHHHHD.',
    '.HHHHHHHH.',
    '.HHHHHHHH.',
    '.hHHHHHHh.',
    '..HHHHHH..',
    '..HHDDHH..',
    '..HHHDHH..',
    '..hHHHHh..',
]
DOG_FB_LEGS = {0: ['..H.HH.H..', '..F.FF.F..'], 1: ['..H.HH.H..', '..F.F..F..'], 2: ['..H.HH.H..', '..F.FF.F..'], 3: ['..H.HH.H..', '..F..F.F..']}


def dog(d, f):
    fr = f if isinstance(f, int) else 0
    if d == 2:
        body = DOG_SIDE[:]
        if f == 'sleep':
            body[2] = '.........HHDHHN'
        rows = body + DOG_SIDE_LEGS[fr]
        if fr in (1, 3):  # tail wag
            rows[3] = '.........HHHwh.'; rows[4] = 'DD......HHHw...'
    else:
        body = (DOG_FRONT if d == 0 else DOG_BACK)[:]
        if f == 'sleep' and d == 0:
            body[3] = '.HDDHHDDH.'
        rows = body + DOG_FB_LEGS[fr]
    c = Cv(len(rows[0]), len(rows))
    c.rows(0, 0, rows, {})
    return c, DOG


# ---- portraits (28x28 busts) --------------------------------------------------------
def portrait(name):
    look = LOOKS[name]
    c = Cv(28, 28)
    S = 2  # draw the front head at 2x, then add details at 1x
    small = Cv(14, 14)
    L = dict(layout(look))
    L.update(x0=2, tx0=2, tw=10, cx=7, torso=4, legs=0, top=3, H=14, W=14)
    hy = 3
    face_front(small, L, dict(look, kid=False, stache=False, lips=False, glasses=False, earrings=False), hy, 'portrait')
    hair(small, L, look, hy, 'front')
    # shoulders
    small.rect(1, 11, 12, 3, 'T'); small.vline(12, 11, 13, 't')
    if look['top'] in ('sando', 'jersey'):
        small.hline(1, 2, 11, 'S'); small.hline(11, 12, 11, 's')
    small.hline(6, 7, 11, 'S')
    for (x, y), col in small.p.items():
        if col == INK:
            continue
        c.rect(x * S, y * S, S, S, col)
    # big expressive eyes, brows, mouth at 1x
    ey = (hy + 4) * S
    for ex in ((2 + 2) * S, (2 + 7) * S - 1):
        c.rect(ex, ey, 2, 3, INK); c.px(ex, ey, '#ffffff')
        if look.get('kid'):
            c.px(ex + 1, ey + 3, INK) if False else None
    if look.get('kid'):
        c.rect(5, ey + 4, 2, 1, BLUSH); c.rect(21, ey + 4, 2, 1, BLUSH)
        c.hline(12, 15, ey + 6, '#a8433f'); c.px(13, ey + 7, '#c25a4f'); c.px(14, ey + 7, '#c25a4f')
    else:
        c.hline(3, 7, ey - 2, 'h'); c.hline(18, 22, ey - 2, 'h')
        c.hline(12, 15, ey + 6, '#a8433f')
    if look.get('stache'):
        c.hline(10, 17, ey + 5, 'H'); c.hline(11, 16, ey + 6, 'H')
    if look.get('lips'):
        c.hline(12, 15, ey + 6, '#e0304a'); c.hline(13, 14, ey + 7, '#e0304a')
    if look.get('glasses'):
        for ex in (4, 17):
            c.hline(ex - 1, ex + 4, ey - 1, 'G'); c.hline(ex - 1, ex + 4, ey + 3, 'G')
            c.vline(ex - 1, ey - 1, ey + 3, 'G'); c.vline(ex + 4, ey - 1, ey + 3, 'G')
        c.hline(9, 16, ey, 'G')
    if look.get('earrings'):
        c.rect(3, ey + 6, 2, 2, 'A'); c.rect(23, ey + 6, 2, 2, 'A')
    return c, look


# ---- sheet ---------------------------------------------------------------------------
def frames_for(name):
    if name == 'aso':
        poses = WALK + ['sleep', 'alert']
    elif name in KIDS:
        poses = WALK + ['reach', 'caught']
    else:
        poses = WALK + ['alert', 'sleep']
    for d in (0, 2, 3):
        for f in poses:
            yield d, f


DOG_FACE = [
    '..DD......DD..',
    '.DDHD....DHDD.',
    '.DHHHHHHHHHHD.',
    '..HHHHHHHHHH..',
    '..HHHHHHHHHH..',
    '.HHEEHHHHEEHH.',
    '.HHEKHHHHEKHH.',
    '.HHHHwwwwHHHH.',
    '..HHwwNNwwHH..',
    '..HHwwNNwwHH..',
    '...Hwwwwwwh...',
    '....wwMMww....',
    '..HHHwwwwHHH..',
    '.HHHHHHHHHHHH.',
]


def dog_portrait():
    c = Cv(28, 28)
    for j, r in enumerate(DOG_FACE):
        for i, ch in enumerate(r):
            if ch != '.':
                c.rect(i * 2, j * 2, 2, 2, {'K': '#ffffff', 'M': '#ff7eb6'}.get(ch, ch))
    return c, DOG


def build_all():
    out = {}
    for name in KIDS + ADULTS + ['aso']:
        for d, f in frames_for(name):
            c, look = dog(d, f) if name == 'aso' else humanoid(name, d, f)
            out[f'{name}|{d}|{f}'] = c.image(look)
        if name == 'jun':  # legacy 'kid' look used by old saves/tests
            for d, f in frames_for(name):
                out[f'kid|{d}|{f}'] = out[f'jun|{d}|{f}']
    for name in KIDS + ADULTS + ['aso']:
        c, look = dog_portrait() if name == 'aso' else portrait(name)
        out[f'portrait|{name}'] = c.image(look)
    return out


def pack(frames):
    keys = list(frames)
    W = 256
    x = y = rowh = 0
    pos = {}
    for k in keys:
        im = frames[k]
        if x + im.width > W:
            x, y, rowh = 0, y + rowh + 1, 0
        pos[k] = (x, y)
        x += im.width + 1
        rowh = max(rowh, im.height)
    H = y + rowh
    sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    atlas = {'image': 'sheet.png', 'size': [W, H], 'frames': {}}
    for k in keys:
        sheet.paste(frames[k], pos[k])
        atlas['frames'][k] = {'x': pos[k][0], 'y': pos[k][1], 'w': frames[k].width, 'h': frames[k].height}
    return sheet, atlas


def preview(frames, path, scale, only=None):
    names = only or (KIDS + ADULTS + ['aso'])
    cell = 26
    cols = 18
    im = Image.new('RGBA', (cols * cell * scale, (len(names) + (0 if only else 2)) * cell * scale), (205, 154, 91, 255))
    for r, name in enumerate(names):
        for i, (d, f) in enumerate(frames_for(name)):
            fr = frames[f'{name}|{d}|{f}']
            im.alpha_composite(fr.resize((fr.width * scale, fr.height * scale), Image.NEAREST), ((i * cell) * scale, (r * cell + cell - fr.height) * scale))
    for i, name in enumerate(KIDS + ADULTS):
        fr = frames[f'portrait|{name}']
        if only is None and (i + 1) * 30 <= cols * cell:
            im.alpha_composite(fr.resize((fr.width * scale, fr.height * scale), Image.NEAREST), (i * 30 * scale, len(names) * cell * scale))
    im.save(path)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--out', default=os.path.join(ROOT, 'assets', 'sprites'))
    ap.add_argument('--preview')
    ap.add_argument('--scale', type=int, default=6)
    ap.add_argument('--only', help='comma-separated kinds for the preview')
    a = ap.parse_args()
    frames = build_all()
    sheet, atlas = pack(frames)
    os.makedirs(a.out, exist_ok=True)
    sheet.save(os.path.join(a.out, 'sheet.png'))
    with open(os.path.join(a.out, 'atlas.json'), 'w', encoding='utf8') as fh:
        json.dump(atlas, fh, indent=1)
    if a.preview:
        preview(frames, a.preview, a.scale, a.only.split(',') if a.only else None)
    print(f'{len(frames)} frames -> {os.path.relpath(a.out, ROOT)} ({sheet.width}x{sheet.height})')


if __name__ == '__main__':
    main()
