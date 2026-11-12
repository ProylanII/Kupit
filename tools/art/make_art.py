"""Kupit art generator: draws every character sprite (walk cycle + poses), the cats and the portraits in code,
then writes assets/sprites/sheet.png + atlas.json (the same files tools/pack_atlas.py makes from Blender renders).

    python tools/art/make_art.py [--preview PATH] [--scale 6] [--palette]

Frame keys in atlas.json:
  kind|dir|0..3     walk cycle (0 = idle). dir 0 down, 2 right, 3 up; left is mirrored in the game.
  kind|dir|reach    kids: grabbing coins        adults: both arms forward (stirring the pot, busy)
  kind|dir|alert    adults: "HOY!" (spotted you / chasing a sound)   dog: barking (mouth open)
  kind|dir|sleep    adults: eyes closed (asleep)                     dog, cats: asleep
  kind|dir|caught   kids: arms up, eyes shut
  kind|dir|cast     kids: one arm straight up (skill)
  kind|dir|phone    adults: hand to the ear with a phone (Tita's phone time)
  kind|dir|eat      dog: head down in the food
  kind|dir|sit      cats: sitting, tail curled
  portrait|kind          28x28 bust for menus, boss banners and story panels
  portrait|kind|mood     the same face happy / sad / angry / shock (story panels)
The pose list per group is locked in tools/art/style.json and checked by tests/artstyle.test.mjs.

Design (the 2026-11 redesign): every character is a big 12x9 head on a small body, so the face reads at game size.
Heads are hand-drawn per character and per view (HEADS below); bodies are built from parts (top, bottom,
accessories) so each one keeps its own silhouette; eyes, brows and mouths are drawn on top per pose.
Needs Pillow.
"""
import argparse, json, os
from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
INK = '#1b1424'
WHITE = '#ffffff'
HEAD_W, HEAD_H, TOP = 12, 9, 2   # head box, and the rows above it that hair may use
W = 16                           # every humanoid canvas is 16 wide (18 with the outline)
X0 = 2                           # the head box starts at x = 2


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

    def rows(self, x, y, rows, pal=None):
        """Stamp an ASCII block; '.' is transparent, other chars map through pal (or are look keys)."""
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch != '.':
                    self.px(x + i, y + j, (pal or {}).get(ch, ch))

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
MOUTH = '#c25a4f'

# Legacy table: tools/blender/build_characters.py still imports it for its box proportions.
BUILDS = {
    'kid':   dict(W=12, top=1, torso=4, legs=3, tw=8),
    'small': dict(W=12, top=1, torso=3, legs=3, tw=8),
    'teen':  dict(W=12, top=1, torso=5, legs=4, tw=8),
    'adult': dict(W=14, top=2, torso=6, legs=5, tw=8),
    'big':   dict(W=14, top=1, torso=6, legs=5, tw=10),
    'old':   dict(W=14, top=2, torso=6, legs=4, tw=8),
    'perm':  dict(W=16, top=2, torso=6, legs=5, tw=8),
}
# body: torso rows, leg rows, torso width. Kids are a head and a half tall; adults loom over them.
BODY = {
    'kid':   dict(torso=3, legs=3, tw=8),
    'small': dict(torso=3, legs=2, tw=8),
    'teen':  dict(torso=4, legs=3, tw=8),
    'adult': dict(torso=6, legs=5, tw=8),
    'big':   dict(torso=6, legs=5, tw=10),
    'old':   dict(torso=6, legs=4, tw=8),
    'perm':  dict(torso=6, legs=5, tw=8),
}

# H/h/k hair (base/shade/shine)  T/t/U top (base/shade/pattern)  B/b bottom  F shoes  A/a accessory  G glasses
LOOKS = {
    'jun':   dict(build='kid', **SKIN, H='#2a1f33', h='#1b1424', k='#4a3d5c', T='#ffd84d', t='#e0a92e', U='#f6f1e7',
                  B='#2f5fbf', b='#24488f', F='#5f8fe0', top='tee', bottom='shorts', kid=True),
    'bing':  dict(build='small', **SKIN, H='#2a1f33', h='#1b1424', k='#4a3d5c', T='#ff7eb6', t='#d9578f', U='#f6f1e7',
                  B='#ff7eb6', b='#d9578f', F='#c0306a', A='#ffe36b', a='#e0a92e', top='dress', bottom='skirt', kid=True, dots=True),
    'ramil': dict(build='teen', **TAN, H='#2a1f33', h='#1b1424', k='#4a3d5c', T='#2fa55b', t='#227a43', U='#f6f1e7',
                  B='#3a3550', b='#2a2640', F='#f6f1e7', A='#d94040', a='#a82e2e', top='jersey', bottom='shorts', kid=True),
    'nene':  dict(build='kid', **SKIN, H='#4a2c1c', h='#33201a', k='#6e4430', T='#ff9a3c', t='#d9762a', U='#f6f1e7',
                  B='#f6f1e7', b='#cfc7b8', F='#a8433f', A='#ff4b4b', a='#c02f3a', top='blouse', bottom='skirt', kid=True),
    'mama':  dict(build='adult', **SKIN, H='#3a2418', h='#24160f', k='#5a3a28', T='#d94a4a', t='#a83a3a', U='#ffd0a0',
                  B='#d94a4a', b='#a83a3a', F='#ff7eb6', A='#ffd84d', a='#e0a92e', top='dress', bottom='daster', flowers=True, lashes=True),
    'lola':  dict(build='old', **OLD, H='#ece6dc', h='#bdb6ab', k='#ffffff', T='#8a5fb5', t='#6b4a8c', U='#c9a8e8',
                  B='#4a3a5f', b='#382a4a', F='#5a5468', A='#8a5a2b', a='#c48a4a', G='#9a94a8', top='blouse',
                  bottom='longskirt', cane=True, glasses=True, elder=True, shawl=True),
    'tita':  dict(build='adult', **SKIN, H='#ff7eb6', h='#d9578f', k='#ffb0d4', T='#2fa59b', t='#22807a', U='#7fe0d4',
                  B='#f6f1e7', b='#cfc7b8', F='#ffd84d', A='#1b1424', a='#7fd7ff', top='blouse', bottom='pants', lips=True, lashes=True),
    'tatay': dict(build='big', **TAN, H='#2a1f33', h='#1b1424', k='#4a3d5c', T='#f6f1e7', t='#cfc7b8', U='#ffffff',
                  B='#3a4f8a', b='#2b3b6a', F='#5a5468', top='sando', bottom='shorts', stache=True),
    'kuya':  dict(build='adult', **SKIN, H='#3a2418', h='#24160f', k='#5a3a28', T='#46a0e0', t='#3580b8', U='#f6f1e7',
                  B='#5a5468', b='#46415a', F='#f6f1e7', A='#2f5fbf', a='#24488f', top='tee', bottom='pants', stripe=True),
    'nena':  dict(build='adult', **SKIN, H='#9a94a8', h='#7a7488', k='#c4bfd0', T='#4f7fd0', t='#3a62a8', U='#f6f1e7',
                  B='#6b3a5a', b='#4f2a44', F='#5a5468', A='#f0e6c8', a='#d6c9a4', top='tee', bottom='longskirt', apron=True, towel=True, elder=True),
    'ninang': dict(build='perm', **SKIN, H='#4a2c5a', h='#2e1a3a', k='#7a5a8c', T='#c0306a', t='#8a2050', U='#ff7eb6',
                   B='#c0306a', b='#8a2050', F='#ffd84d', A='#ffd84d', a='#ff4b4b', top='terno', bottom='longskirt',
                   lips=True, earrings=True, fan=True, lashes=True),
}
KIDS = ['jun', 'bing', 'ramil', 'nene']
ADULTS = ['mama', 'lola', 'tita', 'tatay', 'kuya', 'nena', 'ninang']
WALK = [0, 1, 2, 3]

# ---- heads -----------------------------------------------------------------------
# One hand-drawn head per character and view, 16 columns wide. The first two rows are above the head box (hair
# that sticks up), then the nine rows of the head; extra rows hang over the shoulders (long hair).
# H/h/k hair, S/s skin, A/a accessory (cap, ribbon, clip, shades). Eyes and mouths are drawn on top.
HEADS = {
    'jun': dict(front=[
        '................',
        '...H..HH..H.H...',
        '...HHHHHHHHHH...',
        '..HHkkHHHHHHHh..',
        '..HHHHHHHHHHHh..',
        '..HHHSHHSSHHSh..',
        '..HSSSSSSSSSSh..',
        '..SSSSSSSSSSSS..',
        '..SSSSSSSSSSSS..',
        '..SSSSSSSSSSSs..',
        '...SSSSSSSSss...',
    ], side=[
        '................',
        '...H..H.HH..H...',
        '..HHHHHHHHHHH...',
        '.HHHkkHHHHHHHH..',
        '..HHHHHHHHHHHH..',
        '.HHHHHHHHSHHSS..',
        '..HHHHHSSSSSSS..',
        '..HHHHSSSSSSSS..',
        '...HHHsSSSSSSS..',
        '...HhSSSSSSSSs..',
        '....sSSSSSSSs...',
    ], back=[
        '................',
        '...H.H..HH..H...',
        '...HHHHHHHHHH...',
        '..HHkkHHHHHHHh..',
        '..HHHHHHHHHHHh..',
        '..HHHHHHHHHHHh..',
        '..HHHHHHHHHHHh..',
        '..sHHHHHHHHHhs..',
        '..sHHHHHHHHhhs..',
        '...hHhHHhHhhh...',
        '....sSSSSSSs....',
    ]),
    'bing': dict(front=[
        '................',
        '.HH..........HH.',
        'HHHH.HHHHHH.HHHh',
        'HHHAHHkkHHHHAHHh',
        '.hHHHHHHHHHHHHh.',
        '..HHHHHHHHHHHh..',
        '..HSSSSSSSSSSh..',
        '..SSSSSSSSSSSS..',
        '..SSSSSSSSSSSS..',
        '..SSSSSSSSSSSs..',
        '...SSSSSSSSss...',
    ], side=[
        '................',
        '.HH.............',
        'HHHH.HHHHHHH....',
        'HHHAHHkkHHHHHH..',
        '.hHHHHHHHHHHHH..',
        '..HHHHHHHHHHHH..',
        '..HHHHHSSSSSSS..',
        '..HHHHSSSSSSSS..',
        '...HHHsSSSSSSS..',
        '...HhSSSSSSSSs..',
        '....sSSSSSSSs...',
    ], back=[
        '................',
        '.HH..........HH.',
        'HHHH.HHHHHH.HHHh',
        'HHHAHHkkHHHHAHHh',
        '.hHHHHHHHHHHHHh.',
        '..HHHHHHHHHHHh..',
        '..HHHHHHHHHHHh..',
        '..HHHHHHHHHHHh..',
        '..hHHHHHHHHHhh..',
        '...hhHHHHHhhh...',
        '....sSSSSSSs....',
    ]),
    'ramil': dict(front=[
        '................',
        '....AAAAAAAA....',
        '...AAAAAAAAAA...',
        '..AAAkAAAAAAAa..',
        '..AAAAHHHHAAAa..',
        '..aaaHHHHHHaaa..',
        '..HSSSSSSSSSSh..',
        '..SSSSSSSSSSSS..',
        '..SSSSSSSSSSSS..',
        '..SSSSSSSSSSSs..',
        '...SSSSSSSSss...',
    ], side=[
        '................',
        '....AAAAAAAA....',
        '...AAAAAAAAAA...',
        '..AAAkAAAAAAAA..',
        'aaAAAAAAAAAAAA..',
        '.aaaaaaaaaHHSS..',
        '..HHHHHSSSSSSS..',
        '..HHHHSSSSSSSS..',
        '...HHHsSSSSSSS..',
        '...HhSSSSSSSSs..',
        '....sSSSSSSSs...',
    ], back=[
        '................',
        '....AAAAAAAA....',
        '...AAAAAAAAAA...',
        '..AAAkAAAAAAAa..',
        '..AAAAAAAAAAAa..',
        '..aaaaaaaaaaaa..',
        '...aAAAAAAAAa...',
        '..sHaaaaaaaaHs..',
        '..sHHHHHHHHHhs..',
        '...hHHHHHHHhh...',
        '....sSSSSSSs....',
    ]),
    'nene': dict(front=[
        '................',
        '..........AA.AA.',
        '....HHHHHHHAAA..',
        '...HHkkHHHAAaAA.',
        '..AAAAAAAAAAAAh.',
        '.HHHHHSSSSSHHHh.',
        '.HHSSSSSSSSSSHh.',
        '.HHSSSSSSSSSSHh.',
        '.HHSSSSSSSSSSHh.',
        '.HHSSSSSSSSSSHh.',
        '.HH.SSSSSSSS.Hh.',
        '.HH..........Hh.',
        '.Hh..........hh.',
    ], side=[
        '................',
        '..AA.AA.........',
        '...AAAHHHHHH....',
        '..AAaAAkkHHHHH..',
        '..HAAAAAAAAAAA..',
        '.HHHHHHHHSSSSS..',
        '.HHHHHHSSSSSSS..',
        '.HHHHHHSSSSSSS..',
        '.HHHHHsSSSSSSS..',
        '.HHHHhSSSSSSSs..',
        '.HHHHhSSSSSSs...',
        '.HHHh...........',
        '..Hhh...........',
    ], back=[
        '................',
        '.AA.AA..........',
        '..AAAHHHHHHH....',
        '.AAaAAHkkHHHHh..',
        '..AAAAAAAAAAAA..',
        '.HHHHHHHHHHHHHh.',
        '.HHHHHHHHHHHHHh.',
        '.HHHHHHHHHHHHHh.',
        '.HHHHHHHHHHHHHh.',
        '.HHHHHHHHHHHHHh.',
        '.HHHHHHHHHHHHhh.',
        '.HHHHHHHHHHHHhh.',
        '..hHHhHHhHHhhh..',
    ]),
    'mama': dict(front=[
        '......HHHH......',
        '.....HkkHHA.....',
        '....HHHHHHHH....',
        '...HHkHHHHHHH...',
        '..HHHHHHHHHHHh..',
        '..HHHSSSSSHHHh..',
        '..HSSSSSSSSSSh..',
        '..SSSSSSSSSSSS..',
        '..SSSSSSSSSSSS..',
        '..SSSSSSSSSSSs..',
        '...SSSSSSSSss...',
    ], side=[
        '...HHHH.........',
        '..HkkHHA........',
        '..HHHHHHHHHH....',
        '...HHHkHHHHHH...',
        '..HHHHHHHHHHHH..',
        '..HHHHHHHHSSSS..',
        '..HHHHHHSSSSSS..',
        '..HHHHHSSSSSSS..',
        '...HHHsSSSSSSS..',
        '...HhSSSSSSSSs..',
        '....sSSSSSSSs...',
    ], back=[
        '......HHHH......',
        '.....HkkHHA.....',
        '....HHHHHHHH....',
        '...HHkHHHHHHH...',
        '..HHHHHhhHHHHh..',
        '..HHHHhhhhHHHh..',
        '..HHHHHhhHHHHh..',
        '..HHHHHHHHHHHh..',
        '..hHHHHHHHHHhh..',
        '...hhHHHHHhhh...',
        '....sSSSSSSs....',
    ]),
    'lola': dict(front=[
        '......HHHH......',
        '.....HkkHHh.....',
        '....HHHHHHHH....',
        '...HHkkHHHHHH...',
        '..HHHHHHHHHHHh..',
        '..HHHSSSSSSHHh..',
        '..HSSSSSSSSSSh..',
        '..SSSSSSSSSSSS..',
        '..SSSSSSSSSSSS..',
        '..sSSSSSSSSSSs..',
        '...sSSSSSSSss...',
    ], side=[
        '..HHHH..........',
        '.HkkHHh.........',
        '..HHHHHHHHHH....',
        '...HHHkkHHHHH...',
        '..HHHHHHHHHHHH..',
        '..HHHHHHHSSSSS..',
        '..HHHHHHSSSSSS..',
        '..HHHHHSSSSSSS..',
        '...HHhsSSSSSSS..',
        '...hhSSSSSSSSs..',
        '....sSSSSSSss...',
    ], back=[
        '......HHHH......',
        '.....HkkHHh.....',
        '....HHHHHHHH....',
        '...HHkkHHHHHH...',
        '..HHHHHhhHHHHh..',
        '..HHHHhkHhHHHh..',
        '..HHHHHhhHHHHh..',
        '..HHHHHHHHHHHh..',
        '..hHHHHHHHHHhh..',
        '...hhHHHHHhhh...',
        '....sSSSSSSs....',
    ]),
    'tita': dict(front=[
        '................',
        '....HHHHHHHH....',
        '...HHkkHHHHHH...',
        '..HHHHHHHHHHHh..',
        '..AAAaAAAAAaAA..',
        '.HHHHSSSSSSHHHh.',
        '.HHSSSSSSSSSSHh.',
        '.HHSSSSSSSSSSHh.',
        '.HHSSSSSSSSSSHh.',
        '.HHSSSSSSSSSSHh.',
        '.HH.SSSSSSSS.Hh.',
        '.HH..........Hh.',
        '.HH..........Hh.',
        '.Hh..........hh.',
    ], side=[
        '................',
        '....HHHHHHHH....',
        '...HHkkHHHHHH...',
        '..HHHHHHHHHHHH..',
        '..HHHHAAAAAaAA..',
        '.HHHHHHHHSSSSS..',
        '.HHHHHHSSSSSSS..',
        '.HHHHHHSSSSSSS..',
        '.HHHHHsSSSSSSS..',
        '.HHHHhSSSSSSSs..',
        '.HHHHhSSSSSSs...',
        '.HHHHh..........',
        '.HHHh...........',
        '..Hhh...........',
    ], back=[
        '................',
        '....HHHHHHHH....',
        '...HHkkHHHHHH...',
        '..HHHHHHHHHHHh..',
        '..HHkHHHHHHHHh..',
        '.HHHHHHHHHHHHHh.',
        '.HHHHHHHHHHHHHh.',
        '.HHHHHHHHHHHHHh.',
        '.HHHHHHHHHHHHHh.',
        '.HHHHHHHHHHHHHh.',
        '.HHHHHHHHHHHHhh.',
        '.HHHHHHHHHHHHhh.',
        '.HHHHHHHHHHHHhh.',
        '..hHHhHHhHHhhh..',
    ]),
    'tatay': dict(front=[
        '................',
        '................',
        '....HHHHHHHH....',
        '...HHkkHHHHHH...',
        '..HHHHHHHHHHHh..',
        '..HHSSSSSSSSHh..',
        '..HSSSSSSSSSSh..',
        '..SSSSSSSSSSSS..',
        '..SSSSSSSSSSSS..',
        '..SSSSSSSSSSSs..',
        '...sSSSSSSSss...',
    ], side=[
        '................',
        '................',
        '....HHHHHHHH....',
        '...HHkkHHHHHH...',
        '..HHHHHHHHHHHH..',
        '..HHHHHHSSSSSS..',
        '..HHHHHSSSSSSS..',
        '..HHHHSSSSSSSS..',
        '...HHhsSSSSSSS..',
        '...hsSSSSSSSSs..',
        '....sSSSSSSSs...',
    ], back=[
        '................',
        '................',
        '....HHHHHHHH....',
        '...HHkkHHHHHH...',
        '..HHHHHHHHHHHh..',
        '..HHHHHHHHHHHh..',
        '..HHHHHHHHHHHh..',
        '..sHHHHHHHHHhs..',
        '..sShHHHHHhhSs..',
        '...SSsssssSSs...',
        '....sSSSSSSs....',
    ]),
    'kuya': dict(front=[
        '................',
        '....AAAAAAAA....',
        '...AAAAAAAAAA...',
        '..AAAUUAAAAAAa..',
        '..AAAAAAAAAAAa..',
        '.aaaaaaaaaaaaaa.',
        '..HSSSSSSSSSSh..',
        '..SSSSSSSSSSSS..',
        '..SSSSSSSSSSSS..',
        '..SSSSSSSSSSSs..',
        '...SSSSSSSSss...',
    ], side=[
        '................',
        '....AAAAAAAA....',
        '...AAAAAAAAAA...',
        '..AAAAAAAUUAAA..',
        '..AAAAAAAAAAAA..',
        '..aaaaaaaaaaaaaa',
        '..HHHHHSSSSSSS..',
        '..HHHHSSSSSSSS..',
        '...HHHsSSSSSSS..',
        '...HhSSSSSSSSs..',
        '....sSSSSSSSs...',
    ], back=[
        '................',
        '....AAAAAAAA....',
        '...AAAAAAAAAA...',
        '..AAAAAAAAAAAa..',
        '..AAAAAAAAAAAa..',
        '..aaaaHHHHaaaa..',
        '..HHHHHHHHHHHh..',
        '..sHHHHHHHHHhs..',
        '..sHHHHHHHHhhs..',
        '...hHHHHHHHhh...',
        '....sSSSSSSs....',
    ]),
    'nena': dict(front=[
        '......HHHH......',
        '.....HkkHHh.....',
        '....HHHHHHHH....',
        '...HHkHHHHHHH...',
        '..HHHHHHHHHHHh..',
        '..HHSSSSSSSSHh..',
        '..HSSSSSSSSSSh..',
        '..SSSSSSSSSSSS..',
        '..SSSSSSSSSSSS..',
        '..sSSSSSSSSSSs..',
        '...sSSSSSSSss...',
    ], side=[
        '..HHHH..........',
        '.HkkHHh.........',
        '..HHHHHHHHHH....',
        '...HHHkHHHHHH...',
        '..HHHHHHHHHHHH..',
        '..HHHHHHHSSSSS..',
        '..HHHHHHSSSSSS..',
        '..HHHHHSSSSSSS..',
        '...HHhsSSSSSSS..',
        '...hhSSSSSSSSs..',
        '....sSSSSSSss...',
    ], back=[
        '......HHHH......',
        '.....HkkHHh.....',
        '....HHHHHHHH....',
        '...HHkHHHHHHH...',
        '..HHHHHhhHHHHh..',
        '..HHHHhkHhHHHh..',
        '..HHHHHhhHHHHh..',
        '..HHHHHHHHHHHh..',
        '..hHHHHHHHHHhh..',
        '...hhHHHHHhhh...',
        '....sSSSSSSs....',
    ]),
    'ninang': dict(front=[
        '....HHHHHHHH....',
        '..HHHkHHHhHHHH..',
        '.HHkHHHHHHHHhHH.',
        'HHHHHhHHHkHHHHHh',
        'HHkHHHHHHHHHHhHh',
        'HHHHHSSSSSSHHHHh',
        'HhHSSSSSSSSSSHHh',
        'HHHSSSSSSSSSSHhh',
        '.HHSSSSSSSSSSHh.',
        '.hHSSSSSSSSSSHh.',
        '..hSSSSSSSSSsh..',
    ], side=[
        '....HHHHHHHH....',
        '..HHHkHHHhHHHH..',
        '.HHkHHHHHHHHHHH.',
        'HHHHHhHHHkHHHHH.',
        'HHkHHHHHHHHHHHH.',
        'HHHHHHHHHHSSSS..',
        'HhHHHHHHSSSSSS..',
        'HHHHkHHSSSSSSS..',
        '.HHHHHsSSSSSSS..',
        '.hHHHhSSSSSSSs..',
        '..hhhsSSSSSSs...',
    ], back=[
        '....HHHHHHHH....',
        '..HHHkHHHhHHHH..',
        '.HHkHHHHHHHHhHH.',
        'HHHHHhHHHkHHHHHh',
        'HHkHHHHHHHHHHhHh',
        'HHHHHHHkHHHHHHHh',
        'HhHHHHHHHHHhHHHh',
        'HHHHkHHHHHHHHHhh',
        '.HHHHHHhHHHHHHh.',
        '.hHHHHHHHHHHhh..',
        '..hhhSSSSSShh...',
    ]),
}


def layout(look):
    b = BODY[look['build']]
    torso, legs, tw = b['torso'], b['legs'], b['tw']
    H = TOP + HEAD_H + torso + legs
    return dict(W=W, H=H, top=TOP, torso=torso, legs=legs, tw=tw, x0=X0, tx0=(W - tw) // 2, cx=W // 2)


# ---- faces -------------------------------------------------------------------------
def face_front(c, look, hy, pose):
    """Eyes, brows, mouth and extras on a front head. hy = y of the head box."""
    kid, elder = look.get('kid'), look.get('elder')
    shut = pose in ('sleep', 'caught')
    loud = pose in ('alert', 'caught')
    ey = hy + 5
    for i, ex in enumerate((X0 + 2, X0 + 8)):          # each eye is a 2x2 box at ex..ex+1, ey..ey+1
        if shut:
            c.hline(ex, ex + 1, ey + 1, INK)
        elif kid or pose == 'alert':                    # big shiny eyes
            c.rect(ex, ey, 2, 2, INK); c.px(ex, ey, WHITE)
        elif elder:                                     # small, kind eyes
            c.hline(ex, ex + 1, ey + 1, INK)
            if not look.get('glasses'):
                c.hline(ex, ex + 1, ey - 1, 's')
        else:                                           # adults: solid dark eyes, no sparkle
            c.rect(ex, ey, 2, 2, INK)
            if look.get('lashes'):
                c.px(ex - 1 if i == 0 else ex + 2, ey, INK)
            else:
                c.hline(ex, ex + 1, ey - 1, 'h')
    if pose == 'alert' and not kid:                     # brows shoot up
        c.hline(X0 + 2, X0 + 3, ey - 2, 'h'); c.hline(X0 + 8, X0 + 9, ey - 2, 'h')
    if kid and not shut:
        c.px(X0 + 1, hy + 7, BLUSH); c.px(X0 + 10, hy + 7, BLUSH)
    if look.get('stache'):
        c.hline(X0 + 3, X0 + 8, hy + 7, 'H')
        if loud:
            c.hline(X0 + 5, X0 + 6, hy + 8, INK)
    elif loud:
        c.hline(X0 + 5, X0 + 6, hy + 7, INK); c.hline(X0 + 5, X0 + 6, hy + 8, '#a8433f')
    elif look.get('lips'):
        c.hline(X0 + 5, X0 + 6, hy + 7, '#e0304a')
    elif kid:
        c.hline(X0 + 5, X0 + 6, hy + 7, MOUTH)
    else:
        c.hline(X0 + 5, X0 + 6, hy + 7, 's')
    if elder and not kid:                               # laugh lines
        c.px(X0 + 1, hy + 7, 's'); c.px(X0 + 10, hy + 7, 's')
    if look.get('glasses'):
        for ex in (X0 + 2, X0 + 8):
            c.hline(ex - 1, ex + 2, ey - 1, 'G'); c.hline(ex - 1, ex + 2, ey + 2, 'G')
            c.vline(ex - 1, ey, ey + 1, 'G'); c.vline(ex + 2, ey, ey + 1, 'G')
            if not shut:
                c.px(ex, ey, '#dfe7ee'); c.px(ex + 1, ey, '#dfe7ee'); c.px(ex, ey + 1, '#dfe7ee'); c.px(ex + 1, ey + 1, INK)
        c.hline(X0 + 5, X0 + 6, ey, 'G')
    if look.get('earrings'):
        c.px(X0, hy + 8, 'A'); c.px(X0 + 11, hy + 8, 'A')


def face_side(c, look, hy, pose):
    kid, elder = look.get('kid'), look.get('elder')
    shut = pose in ('sleep', 'caught')
    loud = pose in ('alert', 'caught')
    ey, ex = hy + 5, X0 + 8
    if shut:
        c.hline(ex, ex + 1, ey + 1, INK)
    elif kid or pose == 'alert':
        c.rect(ex, ey, 2, 2, INK); c.px(ex, ey, WHITE)
    elif elder:
        c.hline(ex, ex + 1, ey + 1, INK)
    else:
        c.rect(ex, ey, 2, 2, INK)
        if look.get('lashes'):
            c.px(ex - 1, ey, INK)
        else:
            c.hline(ex, ex + 2, ey - 1, 'h')
    if kid and not shut:
        c.px(X0 + 7, hy + 7, BLUSH)
    if look.get('stache'):
        c.hline(X0 + 10, X0 + 11, hy + 7, 'H')
    elif loud:
        c.hline(X0 + 10, X0 + 11, hy + 7, INK)
    elif look.get('lips'):
        c.px(X0 + 11, hy + 7, '#e0304a')
    else:
        c.px(X0 + 10, hy + 7, MOUTH if kid else 's')
    if look.get('glasses'):
        c.hline(ex - 1, ex + 2, ey - 1, 'G'); c.hline(ex - 1, ex + 2, ey + 2, 'G')
        c.vline(ex - 1, ey, ey + 1, 'G'); c.vline(ex + 2, ey, ey + 1, 'G')
        c.hline(X0 + 4, ex - 2, ey, 'G')
        if not shut:
            c.px(ex, ey, '#dfe7ee'); c.px(ex + 1, ey, '#dfe7ee'); c.px(ex, ey + 1, '#dfe7ee'); c.px(ex + 1, ey + 1, INK)
    if look.get('earrings'):
        c.px(X0 + 5, hy + 8, 'A')


def head(c, name, look, hy, view, pose):
    c.rows(0, hy - TOP, HEADS[name][view])
    if view == 'front':
        face_front(c, look, hy, pose)
    elif view == 'side':
        face_side(c, look, hy, pose)


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
            c.hline(tx0, tx0 + tw - 2, ty + 2, 'U'); c.hline(tx0, tx0 + tw - 2, ty + 4, 'U')
        if top == 'sando':
            c.hline(tx0 + 2, tx0 + tw - 3, ty + n - 2, 'U')   # belly shine
            c.px(cx - 1, ty + n - 3, 't')                     # belly button
    if look.get('dots') or look.get('flowers'):
        for y in range(ty, ty + n + L['legs']):
            for x in range(tx0 - 1, tx0 + tw + 1):
                if pattern(x, y) and c.p.get((x, y)) in ('T', 't', 'B', 'b'):
                    c.px(x, y, 'U')
    if look.get('shawl'):
        if view == 'front':
            c.hline(tx0, tx0 + tw - 1, ty, 'U'); c.px(tx0, ty + 1, 'U'); c.px(tx0 + tw - 1, ty + 1, 'U'); c.hline(cx - 1, cx, ty, 'S')
        elif view == 'back':
            c.hline(tx0, tx0 + tw - 1, ty, 'U'); c.hline(tx0 + 1, tx0 + tw - 2, ty + 1, 'U'); c.hline(cx - 1, cx, ty + 2, 'U')
    if look.get('apron') and view != 'back':
        c.rect(tx0 + 1, ty + 2, tw - 2, n - 2, 'A'); c.vline(tx0 + tw - 2, ty + 2, ty + n - 1, 'a')
        c.px(tx0 + 2, ty + 1, 'A'); c.px(tx0 + tw - 3, ty + 1, 'A')
    if look.get('apron') and view == 'back':
        c.hline(tx0, tx0 + tw - 1, ty + 2, 'A'); c.hline(cx - 1, cx, ty + 3, 'a')
    if look.get('towel'):
        side = tx0 if view == 'front' else tx0 + tw - 2
        c.rect(side, ty - 1, 2, 2, '#f6f1e7'); c.px(side + 1, ty + 1, '#cfc7b8')
    if top == 'terno':  # butterfly sleeves stick up past the shoulders
        c.hline(tx0 - 2, tx0, ty, 'T'); c.hline(tx0 + tw - 1, tx0 + tw + 1, ty, 't')
        c.hline(tx0 - 2, tx0 - 1, ty - 1, 'T'); c.hline(tx0 + tw, tx0 + tw + 1, ty - 1, 't')
        c.px(tx0 - 2, ty + 1, 'T'); c.px(tx0 + tw + 1, ty + 1, 't')


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
    if look.get('stripe'):
        c.hline(sx0 + 1, sx0 + w - 1, ty + 2, 'U'); c.hline(sx0 + 1, sx0 + w - 1, ty + 4, 'U')
    if look.get('dots') or look.get('flowers'):
        for y in range(ty, ty + n + L['legs']):
            for x in range(sx0 - 1, sx0 + w + 1):
                if pattern(x, y) and c.p.get((x, y)) in ('T', 't', 'B', 'b'):
                    c.px(x, y, 'U')
    if look.get('shawl'):
        c.hline(sx0, sx0 + w - 1, ty, 'U'); c.px(sx0 + w - 1, ty + 1, 'U')
    if look.get('apron'):
        c.vline(sx0 + w - 1, ty + 1, ty + n + 2, 'A')
    if look.get('towel'):
        c.rect(sx0 + 2, ty - 1, 2, 2, '#f6f1e7')
    if look['top'] == 'terno':
        c.hline(cx - 2, cx + 1, ty, 'T'); c.hline(cx - 2, cx, ty - 1, 'T'); c.px(cx + 1, ty + 1, 't')


def arm_side(c, L, look, ty, pose, f):
    cx, n = L['cx'], L['torso']
    sleeve = 0 if look['top'] in ('sando', 'jersey') else 1 if look['top'] != 'terno' else 2
    col = lambda i, last: ('t' if i < sleeve else ('S' if not last else 's'))
    x = cx - 1
    if pose == 'reach':
        pts = [(x, ty), (x + 1, ty + 1)] + [(x + 2 + i, ty + 1) for i in range(4)]
    elif pose == 'alert':
        pts = [(x, ty), (x + 1, ty)] + [(x + 2 + i, ty) for i in range(5)]
    elif pose == 'caught':   # both hands up past the face
        pts = [(x + 1, ty), (x + 3, ty), (x + 5, ty), (x + 6, ty - 1), (x + 7, ty - 2), (x + 7, ty - 3)]
    elif pose == 'cast':     # one arm straight up in front of the face
        pts = [(x + 1, ty), (x + 3, ty), (x + 5, ty), (x + 6, ty - 1), (x + 7, ty - 2), (x + 7, ty - 3), (x + 7, ty - 4), (x + 7, ty - 5)]
    elif pose == 'phone':    # hand up to the ear
        pts = [(x, ty), (x - 1, ty), (x - 2, ty - 1), (x - 2, ty - 2)]
    elif f == 1:
        pts = [(x, ty)] + [(x + (i + 1) // 2, ty + i) for i in range(1, n)]
    elif f == 3:
        pts = [(x, ty)] + [(x - (i + 1) // 2, ty + i) for i in range(1, n)]
    else:
        pts = [(x, ty + i) for i in range(n)]
    for i, (px, py) in enumerate(pts):
        c.px(px, py, col(i, i == len(pts) - 1))
    if pose == 'phone':
        c.vline(x - 2, ty - 5, ty - 3, INK); c.px(x - 2, ty - 4, '#7fd7ff')


def legs_front(c, L, look, f, view):
    tx0, tw, H, n = L['tx0'], L['tw'], L['H'], L['legs']
    lt = L['top'] + HEAD_H + L['torso']
    bot = look['bottom']
    shorts_rows = {'shorts': 1 if n <= 4 else 2, 'pants': n - 1, 'skirt': 1, 'longskirt': n - 1, 'daster': n - 2}[bot]
    for i, lx in enumerate((tx0 + 1, tx0 + tw - 3)):
        lifted = (f == 1 and i == 0) or (f == 3 and i == 1)
        b = H - 1 - (1 if lifted else 0)
        for y in range(lt, b + 1):
            if y == b:
                c.hline(lx, lx + 1, y, 'F')
                if not lifted and view == 'front':
                    c.px(lx - 1 if i == 0 else lx + 2, y, 'F')
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
        rows = min(rows, n - 1)
        for j in range(rows):
            flare = 1 if j >= rows - 2 or bot == 'skirt' else 0
            c.hline(tx0 - flare, tx0 + tw - 1 + flare, lt + j, 'B')
            c.px(tx0 + tw - 1 + flare, lt + j, 'b')
        c.hline(tx0 - 1, tx0 + tw, lt + rows - 1, 'b')


def legs_side(c, L, look, f):
    cx, H, n = L['cx'], L['H'], L['legs']
    lt = L['top'] + HEAD_H + L['torso']
    bot = look['bottom']
    shorts_rows = {'shorts': 1 if n <= 4 else 2, 'pants': n - 1, 'skirt': 1, 'longskirt': n - 1, 'daster': n - 2}[bot]
    stride = f in (1, 3)
    for leg in (0, 1):  # 0 = far leg (shaded), 1 = near leg
        fwd = (leg == 1) == (f == 1)
        for j in range(n):
            y = lt + j
            off = round(j * 2 / max(1, n - 1)) if stride else 0
            x = cx - 2 + (off if fwd else -off)
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
        rows = min(shorts_rows + (1 if bot == 'skirt' else 0), n - 1)
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
            c.vline(x, ty + n - 3, H - 1, 'A'); c.hline(x - 1, x, ty + n - 3, 'a')
        elif view == 'side':
            x = cx + 4
            c.vline(x, ty + n - 3, H - 1, 'A'); c.hline(x - 1, x, ty + n - 3, 'a')
        else:
            x = tx0 - 2
            c.vline(x, ty + n - 3, H - 1, 'A')
    if look.get('fan') and view != 'back' and pose not in ('alert', 'phone'):
        if view == 'front':
            c.rows(tx0 - 4, ty + n - 4, ['AaA', 'aAa', '.A.'])
        else:
            c.rows(cx + 3, ty + 1, ['.A', 'Aa', 'aA', 'A.'])


def humanoid(name, d, f):
    look = LOOKS[name]
    L = layout(look)
    c = Cv(L['W'], L['H'])
    pose = f if isinstance(f, str) else None
    fr = f if isinstance(f, int) else 0
    bob = 1 if fr in (1, 3) else 0
    hy = L['top'] + bob
    ty = L['top'] + HEAD_H + bob
    view = {0: 'front', 2: 'side', 3: 'back'}[d]
    tx0, tw, n = L['tx0'], L['tw'], L['torso']
    sleeve = 0 if look['top'] in ('sando', 'jersey') else 2 if look['top'] == 'terno' else 1
    if view == 'side':
        legs_side(c, L, look, fr)
        torso_side(c, L, look, ty, pose, fr)
    else:
        legs_front(c, L, look, fr, view)
        torso_front(c, L, look, ty, view, pose, fr)
    # arms (under the head, so long hair falls over the shoulders)
    if view == 'side':
        arm_side(c, L, look, ty, pose, fr)
    else:
        ax = (tx0 - 1, tx0 + tw)
        up = (X0 - 1, X0 + HEAD_W)   # the columns just outside the head
        sl = 'T' if sleeve else 'S'
        if pose in ('alert', 'caught'):
            for i in (0, 1):
                c.px(ax[i], ty, sl); c.px(ax[i] + (-1 if i == 0 else 1), ty, sl)
                c.vline(up[i], ty - 4, ty - 1, 'S'); c.px(up[i], ty - 4, 's')
        elif pose == 'reach' and view == 'front':
            arm_front(c, ax[0], ty, max(2, n - 1), sleeve); arm_front(c, ax[1], ty, max(2, n - 1), sleeve)
            c.hline(tx0, tx0 + 1, ty + max(1, n - 2), 'S'); c.hline(tx0 + tw - 2, tx0 + tw - 1, ty + max(1, n - 2), 's')
        elif pose == 'reach':
            arm_front(c, ax[0], ty, max(2, n - 2), sleeve); arm_front(c, ax[1], ty, max(2, n - 2), sleeve)
        elif pose == 'cast':  # skill: one arm straight up past the head, the other at the side
            arm_front(c, ax[0], ty, n, sleeve)
            c.px(ax[1], ty, sl); c.px(ax[1] + 1, ty, sl)
            c.vline(up[1], hy + 1, ty - 1, 'S'); c.px(up[1], hy + 1, 's')
        elif pose == 'phone':  # hand up to the ear, holding a phone
            arm_front(c, ax[0], ty, n, sleeve)
            c.px(ax[1], ty, sl); c.px(ax[1] + 1, ty, sl)
            c.vline(up[1], hy + 6, ty - 1, 'S')
        else:
            for i, x in enumerate(ax):
                short = (fr == 1 and i == 1) or (fr == 3 and i == 0)
                arm_front(c, x, ty, n - (1 if short and n > 2 else 0), sleeve)
    head(c, name, look, hy, view, pose)
    if pose == 'phone' and view != 'side':
        x = X0 + HEAD_W
        c.rect(x - 1, hy + 3, 2, 3, INK); c.px(x - 1, hy + 4, '#7fd7ff')
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
DOG_SIDE_EAT = [  # head down in the food, tail up
    '...............',
    '.D.............',
    'D..............',
    '.D.........DD..',
    '.DHHHHHHHHHHHD.',
    '..HHHHHHHHHHEHH',
    '..hHHHHHHHHHwhN',
    '..hHHHHHHHhwww.',
]


def dog(d, f):
    fr = f if isinstance(f, int) else 0
    if d == 2:
        body = DOG_SIDE[:]
        if f == 'sleep':
            body[2] = '.........HHDHHN'
        if f == 'alert':  # barking: ears up, mouth open
            body[0] = '.........DD.DD.'
            body[3] = 'D........HHHNh.'
        if f == 'eat':
            body = DOG_SIDE_EAT[:]
        rows = body + DOG_SIDE_LEGS[fr]
        if fr in (1, 3):  # tail wag
            rows[3] = '.........HHHwh.'; rows[4] = 'DD......HHHw...'
    else:
        body = (DOG_FRONT if d == 0 else DOG_BACK)[:]
        if f in ('sleep', 'eat') and d == 0:
            body[3] = '.HDDHHDDH.'
        if f == 'alert' and d == 0:
            body[7] = '..HwNNwH..'
        rows = body + DOG_FB_LEGS[fr]
    c = Cv(len(rows[0]), len(rows))
    c.rows(0, 0, rows)
    return c, DOG


# ---- the cats: Mingming (pusa) and a kitten (kuting; Puti and Muning are recolours in the game) -----------
# W white fur, w its shade, O orange patch, o its shade, E eye, P pink nose/ears
CAT = {'W': '#f6f1e7', 'w': '#cfc7b8', 'O': '#ff9a3c', 'o': '#d9762a', 'E': '#227a43', 'P': '#ff7eb6', 'N': INK}
KIT = {'W': '#ff9a3c', 'w': '#d9762a', 'O': '#d9762a', 'o': '#a8433f', 'E': INK, 'P': '#ff7eb6', 'N': INK}
PUSA_SIDE = [
    '.W.........O.W.',
    'W.........OOWWW',
    'W.........WWEWE',
    'W.........WWWPW',
    '.WWOOOWWWWWWWW.',
    '.wWOOOOWWWWWW..',
    '..wWWOWWWWWWw..',
]
PUSA_SIDE_LEGS = {
    0: ['..wW.....wW....', '..ww.....ww....'],
    1: ['.w..W...w..W...', 'w....w.w....w..'],
    2: ['..Ww.....Ww....', '..ww.....ww....'],
    3: ['...wW....wW....', '...ww....ww....'],
}
PUSA_FRONT = [
    '.O......W.',
    '.OO....WW.',
    '.OOWWWWWW.',
    '.WEWWWWEW.',
    '.WWWPPWWW.',
    '..WWWWWW..',
    '..WWOOWW..',
    '..wWOOWw..',
]
PUSA_BACK = [
    '.O......W.',
    '.OO....WW.',
    '.OOOWWWWW.',
    '.WOOWWWWW.',
    '.wWWWWWWw.',
    '..WWWOOW..',
    '..WWOOOW..',
    '..wWWWWwW.',
]
PUSA_FB_LEGS = {0: ['..W.WW.W..', '..w.ww.w..'], 1: ['..W.WW.W..', '..w.w..w..'], 2: ['..W.WW.W..', '..w.ww.w..'], 3: ['..W.WW.W..', '..w..w.w..']}
PUSA_SIT = [
    '.O......W.',
    '.OO....WW.',
    '.OOWWWWWW.',
    '.WEWWWWEW.',
    '.WWWPPWWW.',
    '..WWWWWW..',
    '.WWWOOWWW.',
    '.WWWOOWWW.',
    'WwWWWWWWwW',
    'W.ww..ww..',
]
PUSA_SLEEP = [
    '...............',
    '....WWWWW.O.W..',
    '..WWOOOWWWOWWW.',
    '.WWOOOOWWWNWNW.',
    'WWWWOOWWWWWWPW.',
    'WwWWWWWWWWWWw..',
    '.wwwwwwwwwww...',
]
KIT_SIDE = [
    'W.....W.W',
    'W.....WWW',
    '.W...WEWE',
    '.WWOWWWPW',
    '..WWOWWW.',
]
KIT_SIDE_LEGS = {0: ['..w..w...'], 1: ['.w....w..'], 2: ['..w..w...'], 3: ['...w.w...']}
KIT_FRONT = [
    'W....W',
    'WWWWWW',
    'WEWWEW',
    'WWPPWW',
    '.WOOW.',
]
KIT_BACK = [
    'W....W',
    'WWWWWW',
    'WOWWOW',
    'WWOOWW',
    '.WWWWW',
]
KIT_FB_LEGS = {0: ['.w..w.'], 1: ['.w....'], 2: ['.w..w.'], 3: ['....w.']}
KIT_SIT = [
    'W....W',
    'WWWWWW',
    'WEWWEW',
    'WWPPWW',
    '.WOOW.',
    'WWOOWW',
    'ww..ww',
]
KIT_SLEEP = [
    '.........',
    '..WWW.W.W',
    '.WOOWWWWW',
    'WWOWWWNWN',
    'wwwwwwww.',
]


def cat(kind, d, f):
    big = kind == 'pusa'
    fr = f if isinstance(f, int) else 0
    if f == 'sit':
        rows = (PUSA_SIT if big else KIT_SIT)[:]
    elif f == 'sleep':
        rows = (PUSA_SLEEP if big else KIT_SLEEP)[:]
    elif d == 2:
        rows = (PUSA_SIDE if big else KIT_SIDE)[:] + (PUSA_SIDE_LEGS if big else KIT_SIDE_LEGS)[fr]
        if fr in (1, 3):  # the tail flicks
            rows[0] = ('W' + rows[0][1:]) if big else rows[0]
            rows[1] = ('.' + rows[1][1:]) if not big else rows[1]
    else:
        rows = ((PUSA_FRONT if d == 0 else PUSA_BACK) if big else (KIT_FRONT if d == 0 else KIT_BACK))[:] + (PUSA_FB_LEGS if big else KIT_FB_LEGS)[fr]
    c = Cv(len(rows[0]), len(rows))
    c.rows(0, 0, rows)
    return c, (CAT if big else KIT)


# ---- portraits (28x28 busts, with moods) -----------------------------------------------
MOODS = ['', 'happy', 'sad', 'angry', 'shock']


def portrait(name, mood=''):
    """The front head at 2x (cropped to 28 wide), then a face drawn at 1x so it can carry an expression."""
    look = LOOKS[name]
    kid, elder = look.get('kid'), look.get('elder')
    c = Cv(28, 28)
    rows = HEADS[name]['front']
    for j, r in enumerate(rows):                      # head: template col 1..14 -> x 0..27, row j -> y 2j
        for i, ch in enumerate(r):
            if ch != '.' and 1 <= i <= 14 and 2 * j < 22:
                c.rect((i - 1) * 2, j * 2, 2, 2, ch)
    # shoulders
    c.rect(2, 22, 24, 6, 'T'); c.rect(24, 22, 2, 6, 't'); c.rect(0, 24, 2, 4, 'T'); c.rect(26, 24, 2, 4, 't')
    c.rect(11, 22, 6, 2, 'S'); c.rect(12, 24, 4, 1, 's')
    if look['top'] in ('sando', 'jersey'):
        c.rect(2, 22, 4, 3, 'S'); c.rect(22, 22, 4, 3, 's'); c.rect(0, 24, 2, 4, 'S'); c.rect(26, 24, 2, 4, 's')
    if look.get('collar') or look['top'] == 'blouse':
        c.rect(8, 22, 3, 2, 'U'); c.rect(17, 22, 3, 2, 'U')
    if look.get('stripe'):
        c.rect(2, 25, 22, 1, 'U')
    if look.get('dots') or look.get('flowers'):
        for (x, y) in ((4, 25), (9, 26), (19, 25), (23, 26), (14, 26)):
            c.rect(x, y, 2, 1, 'U')
    if look.get('apron'):
        c.rect(9, 24, 10, 4, 'A')
    if look.get('shawl'):
        c.rect(2, 22, 9, 2, 'U'); c.rect(17, 22, 9, 2, 'U')
    for (x, y), col in list(c.p.items()):             # long hair falls in front of the shoulders
        pass
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch in 'Hhk' and 1 <= i <= 14 and 2 * j >= 22:
                c.rect((i - 1) * 2, j * 2, 2, 2, ch)
    # ---- the face, at 1x. Face box: x 2..25, y 10..21. Eyes centred on x = 8 and x = 19.
    ey = 13
    L_, R_ = 6, 17                                    # left edge of each 4-wide eye
    skin_lid = 's'
    wide = mood == 'shock'
    for ex in (L_, R_):
        if mood == 'happy':                            # eyes squeezed into arcs
            c.hline(ex, ex + 3, ey + 1, INK); c.px(ex, ey + 2, INK); c.px(ex + 3, ey + 2, INK)
        elif wide:                                     # whites all round a small pupil
            c.rect(ex, ey - 1, 4, 5, WHITE); c.rect(ex + 1, ey, 2, 3, INK); c.px(ex + 1, ey, WHITE)
        elif elder and not kid:
            c.rect(ex + 1, ey + 1, 2, 2, INK); c.px(ex + 1, ey + 1, WHITE)
        else:
            h = 4 if kid else 3
            c.rect(ex, ey + (4 - h), 3 if not kid else 4, h, INK)
            c.rect(ex, ey + (4 - h), 2, 2, WHITE) if kid else c.px(ex, ey + 1, WHITE)
            if kid:
                c.px(ex + 3, ey + 3, '#4a3d5c')
            if mood == 'sad':                          # lids drop
                c.hline(ex, ex + 3, ey + (4 - h), skin_lid)
            if mood == 'angry':
                c.hline(ex, ex + 3, ey + (4 - h), 'S')
    # brows
    bc = 'h' if look['H'] != '#2a1f33' else 'H'
    if look.get('elder'):
        bc = 'h'
    by = ey - 3 if wide else ey - 2
    if mood == 'angry':
        for k in range(4):
            c.px(L_ + k, by + (k // 2), INK); c.px(L_ + k, by + 1 + (k // 2), INK)
            c.px(R_ + 3 - k, by + (k // 2), INK); c.px(R_ + 3 - k, by + 1 + (k // 2), INK)
    elif mood == 'sad':
        for k in range(4):
            c.px(L_ + k, by + 1 - (k // 2), bc); c.px(R_ + 3 - k, by + 1 - (k // 2), bc)
    elif mood == 'happy':
        c.hline(L_, L_ + 3, by - 1, bc); c.hline(R_, R_ + 3, by - 1, bc)
    else:
        c.hline(L_, L_ + 3, by, bc); c.hline(R_, R_ + 3, by, bc)
    # cheeks
    if kid or mood == 'happy':
        c.rect(3, ey + 5, 3, 2, BLUSH); c.rect(22, ey + 5, 3, 2, BLUSH)
    # nose
    c.px(13, ey + 4, 's'); c.px(14, ey + 4, 's')
    # mouth
    my = 19
    if look.get('stache'):
        c.rect(9, my - 1, 10, 2, 'H'); c.px(9, my + 1, 'H'); c.px(18, my + 1, 'H')
        my += 1
    lip = '#e0304a' if look.get('lips') else '#a8433f'
    if mood == 'happy':
        c.hline(10, 17, my, INK); c.rect(11, my + 1, 6, 1, '#a8433f'); c.hline(12, 15, my + 2, INK) if not look.get('stache') else None
        c.px(13, my + 1, '#ff7eb6'); c.px(14, my + 1, '#ff7eb6')
    elif mood == 'sad':
        c.hline(12, 15, my, lip); c.px(11, my + 1, lip); c.px(16, my + 1, lip)
        c.px(L_ + 1, ey + 5, '#7fd7ff'); c.px(L_ + 1, ey + 6, '#7fd7ff')        # a tear
    elif mood == 'angry':
        c.rect(11, my - 1, 6, 3, INK); c.hline(12, 15, my - 1, WHITE); c.hline(12, 15, my + 1, '#a8433f')
    elif mood == 'shock':
        c.rect(12, my - 1, 4, 3, INK); c.rect(13, my, 2, 1, '#a8433f')
    else:
        c.hline(12, 15, my, lip)
        if kid:
            c.px(11, my - 1, lip); c.px(16, my - 1, lip)
    if elder and not kid:
        c.px(8, my, 's'); c.px(19, my, 's')
    if look.get('glasses'):
        for ex in (L_, R_):
            c.hline(ex - 1, ex + 4, ey - 1, 'G'); c.hline(ex - 1, ex + 4, ey + 4, 'G')
            c.vline(ex - 1, ey - 1, ey + 4, 'G'); c.vline(ex + 4, ey - 1, ey + 4, 'G')
        c.hline(L_ + 5, R_ - 2, ey + 1, 'G')
    if look.get('earrings'):
        c.rect(1, 20, 2, 2, 'A'); c.rect(25, 20, 2, 2, 'A')
    return c, look


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
# Mingming, close up: one orange ear, one white, green eyes.
CAT_FACE = [
    '.OO........WW.',
    '.OOO......WWW.',
    '.OPOO....WWPW.',
    '.OOOOWWWWWWWW.',
    '.OOOWWWWWWWWW.',
    '.WOWWWWWWWWWW.',
    '.WEEEWWWWEEEW.',
    '.WEKNWWWWEKNW.',
    '.WEENWWWWEENW.',
    '.WWWWWPPWWWWW.',
    'NwWWWNWWNWWWwN',
    '..wWWWNNWWWw..',
    '..OOWWWWWWWW..',
    '.OOOOWWWWWWWW.',
]


def face_portrait(rows, pal):
    c = Cv(28, 28)
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != '.':
                c.rect(i * 2, j * 2, 2, 2, {'K': WHITE, 'M': '#ff7eb6'}.get(ch, ch))
    return c, pal


# ---- sheet ---------------------------------------------------------------------------
CATS = ['pusa', 'kuting']


def frames_for(name):
    if name == 'aso':
        poses = WALK + ['sleep', 'alert', 'eat']
    elif name in CATS:
        poses = WALK + ['sit', 'sleep']
    elif name in KIDS:
        poses = WALK + ['reach', 'caught', 'cast']
    else:
        poses = WALK + ['alert', 'sleep', 'phone', 'reach']
    for d in (0, 2, 3):
        for f in poses:
            yield d, f


def build_all():
    out = {}
    for name in KIDS + ADULTS + ['aso'] + CATS:
        for d, f in frames_for(name):
            c, look = dog(d, f) if name == 'aso' else cat(name, d, f) if name in CATS else humanoid(name, d, f)
            out[f'{name}|{d}|{f}'] = c.image(look)
        if name == 'jun':  # legacy 'kid' look used by old saves/tests
            for d, f in frames_for(name):
                out[f'kid|{d}|{f}'] = out[f'jun|{d}|{f}']
    for name in KIDS + ADULTS:
        for mood in MOODS:
            c, look = portrait(name, mood)
            out[f'portrait|{name}' + (f'|{mood}' if mood else '')] = c.image(look)
    c, look = face_portrait(DOG_FACE, DOG)
    out['portrait|aso'] = c.image(look)
    c, look = face_portrait(CAT_FACE, CAT)
    out['portrait|cat'] = c.image(look)
    return out


def pack(frames):
    keys = list(frames)
    SW = 256
    x = y = rowh = 0
    pos = {}
    for k in keys:
        im = frames[k]
        if x + im.width > SW:
            x, y, rowh = 0, y + rowh + 1, 0
        pos[k] = (x, y)
        x += im.width + 1
        rowh = max(rowh, im.height)
    SH = y + rowh
    sheet = Image.new('RGBA', (SW, SH), (0, 0, 0, 0))
    atlas = {'image': 'sheet.png', 'size': [SW, SH], 'frames': {}}
    for k in keys:
        sheet.paste(frames[k], pos[k])
        atlas['frames'][k] = {'x': pos[k][0], 'y': pos[k][1], 'w': frames[k].width, 'h': frames[k].height}
    return sheet, atlas


def preview(frames, path, scale, only=None):
    names = only or (KIDS + ADULTS + ['aso'] + CATS)
    cell = 26
    cols = max(len(list(frames_for(n))) for n in names)
    prow = 0 if only else 5
    im = Image.new('RGBA', (cols * cell * scale, (len(names) * cell + prow * 31) * scale), (205, 154, 91, 255))
    for r, name in enumerate(names):
        for i, (d, f) in enumerate(frames_for(name)):
            fr = frames[f'{name}|{d}|{f}']
            im.alpha_composite(fr.resize((fr.width * scale, fr.height * scale), Image.NEAREST), ((i * cell) * scale, (r * cell + cell - fr.height) * scale))
    if not only:
        for j, mood in enumerate(MOODS):
            for i, name in enumerate(KIDS + ADULTS + (['aso', 'cat'] if not mood else [])):
                fr = frames[f'portrait|{name}' + (f'|{mood}' if mood else '')]
                if (i + 1) * 31 <= cols * cell:
                    im.alpha_composite(fr.resize((fr.width * scale, fr.height * scale), Image.NEAREST), (i * 31 * scale, (len(names) * cell + j * 31) * scale))
    im.save(path)


def palette_of(frames):
    cols = set()
    for im in frames.values():
        px = im.load()
        for (r, g, b, a) in (px[x, y] for y in range(im.height) for x in range(im.width)):
            if a:
                cols.add('#%02x%02x%02x' % (r, g, b))
    return sorted(cols)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--out', default=os.path.join(ROOT, 'assets', 'sprites'))
    ap.add_argument('--preview')
    ap.add_argument('--scale', type=int, default=6)
    ap.add_argument('--only', help='comma-separated kinds for the preview')
    ap.add_argument('--palette', action='store_true', help='rewrite the palette in tools/art/style.json from this sheet (a deliberate style change)')
    a = ap.parse_args()
    for name, views in HEADS.items():
        for view, rows in views.items():
            for r in rows:
                assert len(r) == 16, f'{name} {view}: "{r}" is {len(r)} wide'
            assert len(rows) >= TOP + HEAD_H, f'{name} {view}: {len(rows)} rows'
    frames = build_all()
    sheet, atlas = pack(frames)
    os.makedirs(a.out, exist_ok=True)
    sheet.save(os.path.join(a.out, 'sheet.png'))
    with open(os.path.join(a.out, 'atlas.json'), 'w', encoding='utf8') as fh:
        json.dump(atlas, fh, indent=1)
    if a.palette:
        p = os.path.join(ROOT, 'tools', 'art', 'style.json')
        with open(p, encoding='utf8') as fh:
            style = json.load(fh)
        style['palette'] = palette_of(frames)
        with open(p, 'w', encoding='utf8') as fh:
            json.dump(style, fh, indent=2)
            fh.write('\n')
    if a.preview:
        preview(frames, a.preview, a.scale, a.only.split(',') if a.only else None)
    print(f'{len(frames)} frames -> {os.path.relpath(a.out, ROOT)} ({sheet.width}x{sheet.height})')


if __name__ == '__main__':
    main()
