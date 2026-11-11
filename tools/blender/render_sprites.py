"""Blender batch renderer for Kupit character sprites.

    blender -b art/blend/characters.blend -P tools/blender/render_sprites.py -- --out art/renders [--size 96] [--frames 4] [--kinds mama,jun]

Scene conventions (docs/ART_SPEC.md has the full contract):
  * one top-level object per character, named after the sprite kind (jun, bing, mama, aso, ...), facing -Y at
    rotation 0, feet at z=0. Optional custom props: kupit_group (kid/adult/dog), head_z (portrait height).
  * animation, either of:
      - a frame map on the scene, scene["kupit_frames"] = JSON {"walk": [first, last], "reach": 11, ...}
        (what tools/blender/build_characters.py writes: every pose is a frame on one timeline), or
      - actions on an armature inside the character: "<Kind>.Walk" / "Walk" (loop) and one-frame pose actions
        "<Kind>.Reach", "Reach", ... The pose list comes from tools/art/style.json so it cannot drift from the
        art lock test.
  * portraits: if a camera named "PortraitCam" exists it renders portrait_<kind>.png (a square bust); the script
    creates one if the file has none.
Output: <out>/<kind>_<dir>_<frame>.png, dir 0 = down, 2 = right, 3 = up (left is mirrored in the game),
        frame 0..N-1 over the walk cycle, then one file per pose. Then run tools/pack_atlas.py on that folder.
"""
import json
import math
import os
import sys

import bpy

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def opt(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


OUT = os.path.abspath(opt('--out', 'art/renders'))
SIZE = int(opt('--size', 96))        # render big, pack_atlas.py shrinks it to pixel size
FRAMES = int(opt('--frames', 4))
TILT = float(opt('--tilt', 32))      # degrees the camera looks down (32: faces stay readable, tops of heads stay small)
KINDS = opt('--kinds', '').split(',') if opt('--kinds', '') else None
# the camera sits at -Y looking +Y with +X to the right, so "right" = the character turned to face +X
DIR_Z = {0: 0.0, 2: math.pi / 2, 3: math.pi}
HERE = os.path.dirname(os.path.abspath(__file__))
STYLE = json.load(open(os.path.join(HERE, '..', 'art', 'style.json'), encoding='utf8'))


def group_of(kind, root):
    g = root.get('kupit_group')
    return g or next((g for g, kinds in STYLE['kinds'].items() if kind in kinds), None)


os.makedirs(OUT, exist_ok=True)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = scene.render.resolution_y = SIZE
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filter_size = 0.0                  # no anti-aliasing: hard pixel edges
scene.view_settings.view_transform = 'Standard'  # flat colours, no filmic tonemapping
scene.view_settings.look = 'None'
for attr, val in (('taa_render_samples', 1), ('use_gtao', False), ('use_bloom', False), ('use_shadows', False)):
    if hasattr(scene.eevee, attr):
        setattr(scene.eevee, attr, val)

# orthographic camera about 50 degrees down, aimed at the character's centre, shared by every character
cam = bpy.data.objects.get('KupitCam')
if cam is None:
    cam_data = bpy.data.cameras.new('KupitCam')
    cam = bpy.data.objects.new('KupitCam', cam_data)
    scene.collection.objects.link(cam)
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 3.0
cam.rotation_euler = (math.radians(90 - TILT), 0, 0)
scene.camera = cam

# one sun from the TOP-LEFT of the screen (docs/ART_STYLE.md): it travels right (+X), away from the camera (+Y)
# and down, so left-facing and top faces are lit and the right column / bottom row fall into shade.
sun = bpy.data.objects.get('KupitSun')
if sun is None:
    sun_data = bpy.data.lights.new('KupitSun', 'SUN')
    sun = bpy.data.objects.new('KupitSun', sun_data)
    scene.collection.objects.link(sun)
sun.data.energy = 3.0
sun.data.use_shadow = False
sun.rotation_euler = (math.radians(45), 0, math.radians(-45))

pcam = bpy.data.objects.get('PortraitCam')
if pcam is None:
    pdata = bpy.data.cameras.new('PortraitCam')
    pcam = bpy.data.objects.new('PortraitCam', pdata)
    scene.collection.objects.link(pcam)
pcam.data.type = 'ORTHO'
pcam.rotation_euler = (math.radians(90), 0, 0)

frames_map = None
if scene.get('kupit_frames'):
    frames_map = json.loads(scene['kupit_frames'])

HELPERS = {'KupitCam', 'KupitSun', 'PortraitCam'}


def hide_all_but(root):
    keep = {root, *root.children_recursive}
    for ob in scene.objects:
        if ob.name in HELPERS:
            continue
        ob.hide_render = ob not in keep


def action_for(root, name):
    return bpy.data.actions.get(f'{root.name}.{name}') or bpy.data.actions.get(name)


def render(path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


# the character's vertical centre, from its bounding box at the rest frame, so the camera aims at it
def centre_z(root):
    scene.frame_set(frames_map['walk'][0] if frames_map else 1)
    zs = []
    for ob in [root, *root.children_recursive]:
        if ob.type == 'MESH':
            for v in ob.bound_box:
                zs.append((ob.matrix_world @ __import__('mathutils').Vector(v)).z)
    return (min(zs) + max(zs)) / 2 if zs else 0.5


roots = [o for o in scene.objects if o.parent is None and o.name not in HELPERS and o.type in {'EMPTY', 'ARMATURE', 'MESH'}]
missing = []
for root in roots:
    kind = root.name.lower()
    if KINDS and kind not in KINDS:
        continue
    group = group_of(kind, root)
    if not group:
        print('skip', kind, '(not a kind in style.json)')
        continue
    hide_all_but(root)
    home = tuple(root.location)
    root.location = (0, 0, 0)
    cz = centre_z(root)
    cam.location = (0, -6.0, cz + 6.0 * math.tan(math.radians(TILT)))  # looking at (0, 0, cz)
    poses = STYLE['poses'].get(group, [])
    arm = next((o for o in [root, *root.children_recursive] if o.type == 'ARMATURE'), None)
    walk = action_for(root, 'Walk') if arm else None
    if arm and walk:
        arm.animation_data_create().action = walk
    if frames_map:
        start, end = frames_map['walk']
    else:
        start, end = (int(walk.frame_range[0]), int(walk.frame_range[1])) if walk else (1, 1)
    for d, z in DIR_Z.items():
        root.rotation_euler[2] = z
        for f in range(FRAMES):
            scene.frame_set(start + round((end - start) * f / FRAMES))
            render(os.path.join(OUT, f'{kind}_{d}_{f}.png'))
        for pose in poses:
            if frames_map:
                if pose not in frames_map:
                    missing.append(f'{kind}.{pose}')
                    continue
                scene.frame_set(int(frames_map[pose]))
            else:
                act = action_for(root, pose.capitalize())
                if not (arm and act):
                    missing.append(f'{kind}.{pose.capitalize()}')
                    continue
                arm.animation_data.action = act
                scene.frame_set(int(act.frame_range[0]))
            render(os.path.join(OUT, f'{kind}_{d}_{pose}.png'))
        if arm and walk:
            arm.animation_data.action = walk
    root.rotation_euler[2] = 0.0
    # portrait: a square bust, straight on
    hz = float(root.get('head_z', cz + 0.4))
    scene.frame_set(start)
    scene.camera = pcam
    pcam.data.ortho_scale = 1.6
    pcam.location = (0, -6.0, hz - 0.15)
    render(os.path.join(OUT, f'portrait_{kind}.png'))
    scene.camera = cam
    root.location = home
    print('rendered', kind)
if missing:
    print('no frame/action for these poses (the art lock test will want them):', ', '.join(sorted(set(missing))))
