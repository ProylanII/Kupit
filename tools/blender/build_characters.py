"""Builds every Kupit character in Blender from the same look data as the code-drawn sheet, with a walk cycle and
all the poses the art lock wants, and saves art/blend/characters.blend.

    blender -b -P tools/blender/build_characters.py -- [--out art/blend/characters.blend]

Chunky toy-like low-poly: boxes only, flat shading, palette colours (tools/art/style.json). Joints are Empties,
not bones (shoulder.L/R, hip.L/R, neck, pelvis), so one timeline holds every pose; the frame map is stored on the
scene as scene["kupit_frames"] and read by render_sprites.py:
    walk 1..9 (loop; sampled at 1,3,5,7), reach 11, caught 12, cast 13, alert 14, sleep 15, phone 16, eat 17
Units: 1 px of the pixel sprite = P (0.1 Blender units). Feet at z=0 ... the character is centred on the Z axis.
"""
import json
import math
import os
import sys
import types

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'art'))
# make_art.py imports Pillow at the top; Blender's Python has none and we only want its LOOKS/BUILDS data
if 'PIL' not in sys.modules:
    pil = types.ModuleType('PIL'); pil.Image = None; sys.modules['PIL'] = pil
from make_art import LOOKS, BUILDS, KIDS, ADULTS, DOG as DOG_PAL  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[argv.index('--out') + 1] if '--out' in argv else os.path.join(ROOT, 'art', 'blend', 'characters.blend'))
P = 0.1
FRAMES = {'walk': [1, 9], 'reach': 11, 'caught': 12, 'cast': 13, 'alert': 14, 'sleep': 15, 'phone': 16, 'eat': 17}
KEYS = [1, 3, 5, 7, 9, 11, 12, 13, 14, 15, 16, 17]
RAD = math.radians

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'  # poses are sampled on their frames only
scene = bpy.context.scene
scene.frame_start, scene.frame_end = 1, 17
scene['kupit_frames'] = json.dumps(FRAMES)
col = scene.collection

# ---------------------------------------------------------------- helpers
_mats = {}


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def material(hexcol):
    if hexcol in _mats:
        return _mats[hexcol]
    m = bpy.data.materials.new(hexcol)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    r, g, b = (int(hexcol[i:i + 2], 16) / 255 for i in (1, 3, 5))
    bsdf.inputs['Base Color'].default_value = (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1)
    bsdf.inputs['Roughness'].default_value = 1.0
    for name in ('Specular IOR Level', 'Specular'):
        if name in bsdf.inputs:
            bsdf.inputs[name].default_value = 0.0
    _mats[hexcol] = m
    return m


def empty(name, parent=None, loc=(0, 0, 0)):
    o = bpy.data.objects.new(name, None)
    o.empty_display_size = 0.05
    o.location = loc
    o.rotation_mode = 'XYZ'
    o.parent = parent
    col.objects.link(o)
    return o


def box(name, size, loc, color, parent):
    """Axis-aligned box: size (sx, sy, sz) in px units, loc = centre in px units, in the parent's space."""
    sx, sy, sz = (s * P / 2 for s in size)
    verts = [(x, y, z) for x in (-sx, sx) for y in (-sy, sy) for z in (-sz, sz)]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(material(color))
    o.location = tuple(v * P for v in loc)
    o.rotation_mode = 'XYZ'
    o.parent = parent
    col.objects.link(o)
    return o


class Rig:
    """Collects (object, channel, frame, value) keys; writes them all at once with every channel keyed on every
    frame so poses never bleed into each other."""

    def __init__(self):
        self.chan = {}   # (obj, channel) -> {frame: value}
        self.rest = {}

    def rest_of(self, obj, channel):
        if (obj, channel) not in self.rest:
            self.rest[(obj, channel)] = tuple(getattr(obj, channel))
        return self.rest[(obj, channel)]

    def key(self, obj, channel, frame, value):
        self.rest_of(obj, channel)
        self.chan.setdefault((obj, channel), {})[frame] = tuple(value)

    def rot(self, obj, frame, x=0, y=0, z=0):
        self.key(obj, 'rotation_euler', frame, (RAD(x), RAD(y), RAD(z)))

    def write(self):
        for (obj, channel), keys in self.chan.items():
            rest = self.rest[(obj, channel)]
            for f in KEYS:
                setattr(obj, channel, keys.get(f, rest))
                obj.keyframe_insert(channel, frame=f)
            setattr(obj, channel, rest)


# ---------------------------------------------------------------- humanoids
def humanoid(name, look):
    b = BUILDS[look['build']]
    tw, torso_h, legs_h = b['tw'], b['torso'], b['legs']
    head_h, head_w = 8, 10
    S, T, B, H, F = look['S'], look['T'], look['B'], look['H'], look['F']
    A = look.get('A', H)
    root = empty(name)
    root['kupit_group'] = 'kid' if look.get('kid') else 'adult'
    total = legs_h + torso_h + head_h + 1
    root['head_z'] = (legs_h + torso_h + head_h / 2) * P
    pelvis = empty(f'{name}.pelvis', root, (0, 0, legs_h * P))
    rig = Rig()

    # legs + feet (hang from the hips)
    bot = look['bottom']
    leg_c = B if bot in ('shorts', 'pants') else S
    for side, sx in (('L', -2.5), ('R', 2.5)):
        hip = empty(f'{name}.hip.{side}', pelvis, (sx * P, 0, 0))
        box(f'{name}.leg.{side}', (2, 2.2, legs_h), (0, 0, -legs_h / 2), leg_c, hip)
        box(f'{name}.foot.{side}', (2.4, 3, 1), (0, -0.6, -legs_h + 0.5), F, hip)
        if bot == 'shorts' and legs_h > 3:
            box(f'{name}.short.{side}', (2.6, 2.8, 1.2), (0, 0, -0.8), B, hip)
    if bot in ('skirt', 'longskirt', 'daster'):
        rows = {'skirt': 2, 'longskirt': legs_h - 1, 'daster': legs_h - 2}[bot]
        box(f'{name}.skirt', (tw + 2, 5.5, rows), (0, 0, -rows / 2), B, pelvis)
    # torso
    box(f'{name}.torso', (tw, 4.5, torso_h), (0, 0, torso_h / 2), T, pelvis)
    if look.get('apron'):
        box(f'{name}.apron', (tw - 2, 1, torso_h - 1.5), (0, -2.5, torso_h / 2 - 0.5), A, pelvis)
    if look.get('cane'):
        box(f'{name}.cane', (1, 1, legs_h + torso_h - 1), ((tw / 2 + 3), -1, (legs_h + torso_h - 1) / 2 - legs_h), look.get('A', '#8a5a2b'), pelvis)
    # arms
    sleeve = look['top'] not in ('sando', 'jersey')
    arm_len = max(3, torso_h - 0.5)
    shoulders = {}
    for side, sx in (('L', -1), ('R', 1)):
        sh = empty(f'{name}.shoulder.{side}', pelvis, (sx * (tw / 2 + 1) * P, 0, (torso_h - 0.6) * P))
        shoulders[side] = sh
        box(f'{name}.arm.{side}', (2, 2, arm_len), (0, 0, -arm_len / 2), S, sh)
        if sleeve:
            box(f'{name}.sleeve.{side}', (2.3, 2.3, 1.4), (0, 0, -0.6), T, sh)
        box(f'{name}.hand.{side}', (2.1, 2.1, 1), (0, 0, -arm_len), look['s'], sh)
    phone = box(f'{name}.phone', (1.6, 0.6, 2.6), (0.6, -0.6, -arm_len - 0.2), '#1b1424', shoulders['R'])
    box(f'{name}.phone.screen', (1, 0.3, 1.6), (0, -0.2, 0), '#7fd7ff', phone)
    # head
    neck = empty(f'{name}.neck', pelvis, (0, 0, torso_h * P))
    box(f'{name}.head', (head_w, 8, head_h), (0, 0, head_h / 2), S, neck)
    for sx in (-2.5, 2.5):
        box(f'{name}.eye{sx}', (1.3, 0.6, 1.6 if look.get('kid') else 1.2), (sx, -4.1, 3.6), '#1b1424', neck)
    lids = box(f'{name}.lids', (8, 0.5, 2.4), (0, -4.3, 3.6), S, neck)
    if look.get('stache'):
        box(f'{name}.stache', (4, 0.6, 1), (0, -4.2, 2), H, neck)
    if look.get('glasses'):
        for sx in (-2.5, 2.5):
            box(f'{name}.glass{sx}', (2.6, 0.5, 2.2), (sx, -4.4, 3.4), look.get('G', '#9a94a8'), neck)
            box(f'{name}.lens{sx}', (1.8, 0.6, 1.4), (sx, -4.5, 3.4), '#dfe7ee', neck)
    if look.get('shades'):
        box(f'{name}.shades', (10.4, 1, 1.4), (0, -3.6, 6.5), A, neck)
    if look.get('band'):
        box(f'{name}.band', (10.4, 8.4, 1.2), (0, 0, 6), A, neck)
    hair(name, look, neck, head_w, head_h)
    # ---- animation
    L, R = shoulders['L'], shoulders['R']
    hipL, hipR = bpy.data.objects[f'{name}.hip.L'], bpy.data.objects[f'{name}.hip.R']
    for f, k in zip((1, 3, 5, 7, 9), (1, 0, -1, 0, 1)):
        rig.rot(hipL, f, x=-25 * k); rig.rot(hipR, f, x=25 * k)
        rig.rot(L, f, x=20 * k); rig.rot(R, f, x=-20 * k)
        rig.key(pelvis, 'location', f, (0, 0, legs_h * P + (0.5 * P if k == 0 else 0)))
    rig.rot(L, 11, x=-90); rig.rot(R, 11, x=-90)                     # reach: both arms forward
    rig.rot(L, 12, x=-165); rig.rot(R, 12, x=-165)                   # caught: arms up
    rig.rot(R, 13, y=-160)                                           # cast: one arm straight up
    rig.rot(L, 14, x=-125, z=15); rig.rot(R, 14, x=-125, z=-15)      # alert: HOY!
    rig.rot(neck, 15, x=14)                                          # sleep: head nods
    rig.rot(R, 16, x=-150, z=-25)                                    # phone: hand to the ear
    for f in KEYS:
        rig.key(lids, 'scale', f, (1, 1, 1) if f in (12, 15) else (0, 0, 0))
        rig.key(phone, 'scale', f, (1, 1, 1) if f == 16 else (0, 0, 0))
    rig.write()
    return root


def hair(name, look, neck, head_w, head_h):
    st, H = look['hair'], look['H']
    A = look.get('A', H)
    top = head_h
    if st in ('cap', 'capback'):
        box(f'{name}.cap', (head_w + 0.6, 8.6, 2.6), (0, 0, top - 0.3), A, neck)
        box(f'{name}.brim', (head_w - 2, 3.5, 0.8), (0, -5.5 if st == 'cap' else 5.5, top - 0.3), look.get('a', A), neck)
        box(f'{name}.hairback', (head_w + 0.4, 2, 5), (0, 3.2, top - 4.5), H, neck)
        return
    # every style: a dome on top and hair at the back of the head
    box(f'{name}.dome', (head_w + 0.6, 8.6, 1.8), (0, 0, top - 0.1), H, neck)
    box(f'{name}.hairback', (head_w + 0.4, 2, 6 if st in ('long', 'perm') else 4.5), (0, 3.2, top - (3 if st in ('long', 'perm') else 2.3)), H, neck)
    box(f'{name}.fringe', (head_w + 0.4, 1, 1), (0, -3.7, top - 0.9), H, neck)
    if st == 'spiky':
        for i, sx in enumerate((-3, 0, 3)):
            box(f'{name}.spike{i}', (2, 2, 1.6), (sx, 0, top + 1.2), H, neck)
    elif st == 'long':
        for sx in (-1, 1):
            box(f'{name}.side{sx}', (1.6, 7, 9), (sx * (head_w / 2 + 0.6), 1, top - 4), H, neck)
    elif st == 'pigtails':
        for sx in (-1, 1):
            box(f'{name}.tail{sx}', (2.4, 2.4, 4), (sx * (head_w / 2 + 1.4), 0, top - 3.5), H, neck)
            box(f'{name}.tie{sx}', (2.8, 2.8, 0.8), (sx * (head_w / 2 + 1.4), 0, top - 1.3), A, neck)
    elif st == 'bun':
        box(f'{name}.bun', (4, 4, 2.6), (0, 1, top + 1.6), H, neck)
        if look.get('clip'):
            box(f'{name}.clip', (1.6, 1.6, 1), (2.6, -0.5, top + 0.8), A, neck)
    elif st == 'perm':
        box(f'{name}.perm', (head_w + 3, 9, 3), (0, 0.8, top + 0.6), H, neck)
        for sx in (-1, 1):
            box(f'{name}.curl{sx}', (2.4, 7, 6), (sx * (head_w / 2 + 0.9), 1.2, top - 3), H, neck)


# ---------------------------------------------------------------- the dog
def dog(name='aso'):
    Hc, D, F = DOG_PAL['H'], DOG_PAL['D'], DOG_PAL['F']
    root = empty(name)
    root['kupit_group'] = 'dog'
    root['head_z'] = 7 * P
    body = empty(f'{name}.body', root, (0, 0, 5 * P))
    box(f'{name}.trunk', (6.5, 10, 4.5), (0, 0, 0), Hc, body)
    box(f'{name}.belly', (5.5, 8, 1), (0, 0, -2), DOG_PAL['w'], body)
    neck = empty(f'{name}.neck', body, (0, -5 * P, 1.5 * P))
    box(f'{name}.head', (6.5, 5, 5), (0, -1.5, 0.5), Hc, neck)
    box(f'{name}.snout', (3.5, 2.5, 2), (0, -5, -0.5), DOG_PAL['w'], neck)
    box(f'{name}.nose', (1.6, 0.8, 1), (0, -6.4, 0), '#1b1424', neck)
    for sx in (-1.6, 1.6):
        box(f'{name}.eye{sx}', (0.9, 0.5, 0.9), (sx, -4.1, 1.4), '#1b1424', neck)
        box(f'{name}.ear{sx}', (1.6, 2.4, 2.8), (sx * 1.9, -0.5, 3.2), D, neck)
    lids = box(f'{name}.lids', (5, 0.4, 1.3), (0, -4.3, 1.4), Hc, neck)
    mouth = box(f'{name}.mouth', (2.2, 1.2, 0.8), (0, -5.6, -1.4), '#1b1424', neck)
    tail = empty(f'{name}.tail', body, (0, 5 * P, 1.5 * P))
    box(f'{name}.tailbox', (1.4, 1.4, 3), (0, 0.4, 1.5), D, tail)
    hips = {}
    for i, (sx, sy) in enumerate(((-2.2, -3.5), (2.2, -3.5), (-2.2, 3.5), (2.2, 3.5))):
        h = empty(f'{name}.hip{i}', body, (sx * P, sy * P, -2 * P))
        hips[i] = h
        box(f'{name}.leg{i}', (1.6, 1.6, 3), (0, 0, -1.5), Hc, h)
        box(f'{name}.paw{i}', (1.8, 2, 0.8), (0, -0.2, -2.8), F, h)
    rig = Rig()
    for f, k in zip((1, 3, 5, 7, 9), (1, 0, -1, 0, 1)):
        rig.rot(hips[0], f, x=-22 * k); rig.rot(hips[3], f, x=-22 * k)
        rig.rot(hips[1], f, x=22 * k); rig.rot(hips[2], f, x=22 * k)
        rig.rot(tail, f, y=25 if f in (3, 7) else -25)
        rig.key(body, 'location', f, (0, 0, 5 * P + (0.4 * P if k == 0 else 0)))
    rig.rot(neck, 14, x=-20); rig.rot(tail, 14, x=-30)   # alert: head up, tail up
    rig.rot(neck, 15, x=35)                              # sleep: head down
    rig.rot(neck, 17, x=55); rig.rot(tail, 17, x=-40)    # eat: nose in the food
    for f in KEYS:
        rig.key(lids, 'scale', f, (1, 1, 1) if f in (15, 17) else (0, 0, 0))
        rig.key(mouth, 'scale', f, (1, 1, 1) if f == 14 else (0, 0, 0))
    rig.write()
    return root


# ---------------------------------------------------------------- build everything
roots = []
for n in KIDS + ADULTS:
    roots.append(humanoid(n, LOOKS[n]))
roots.append(dog())
# spread them out on the X axis in the file (handy when opened by hand); the renderer moves each to the origin
for i, r in enumerate(roots):
    r.location = (i * 3.0, 0, 0)
    r['kupit_home_x'] = i * 3.0

# a world with a soft ambient fill so shaded faces still show their colour (then snap to the shade swatch)
world = bpy.data.worlds.new('KupitWorld')
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value = (0.22, 0.22, 0.24, 1)
bg.inputs['Strength'].default_value = 1.0
scene.world = world

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('saved', OUT, 'characters:', [r.name for r in roots])
