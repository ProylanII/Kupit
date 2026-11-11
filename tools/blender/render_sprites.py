"""Blender batch renderer for Kupit character sprites.   (UNTESTED: Blender was not installed on the dev machine.)

    blender -b art/blend/characters.blend -P tools/blender/render_sprites.py -- --out art/renders [--size 48] [--frames 4] [--kinds mama,jun]

Scene conventions (docs/ART_SPEC.md has the full contract):
  * one top-level Empty/Armature/Mesh per character, named after the sprite kind (jun, bing, mama, aso, ...),
    containing the mesh + armature; the character faces -Y (towards the default camera) at rotation 0
  * actions, per character "<Kind>.<Name>" or shared "<Name>":
      Walk                      loopable cycle, sampled evenly into --frames frames (frame 0 doubles as idle)
      Reach Caught Cast         kid poses (one frame each: the action's first frame)
      Alert Sleep Phone Reach   adult poses
      Sleep Alert Eat           dog poses
    The pose list is read from tools/art/style.json so it can never drift from what the art lock test wants.
  * portraits: a camera named "PortraitCam" (optional) renders portrait_<kind>.png, a square bust
Output: <out>/<kind>_<dir>_<frame>.png, dir 0 = down, 2 = right, 3 = up (left is mirrored in the game),
        frame 0..N-1 over the Walk cycle, then one file per pose. Then run tools/pack_atlas.py on that folder.
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
SIZE = int(opt('--size', 48))        # render big, pack_atlas.py shrinks it to pixel size
FRAMES = int(opt('--frames', 4))
KINDS = opt('--kinds', '').split(',') if opt('--kinds', '') else None
DIR_Z = {0: 0.0, 2: -math.pi / 2, 3: math.pi}   # rotate the model so it faces down / right / up on screen
HERE = os.path.dirname(os.path.abspath(__file__))
STYLE = json.load(open(os.path.join(HERE, '..', 'art', 'style.json'), encoding='utf8'))


def group_of(kind):
    return next((g for g, kinds in STYLE['kinds'].items() if kind in kinds), None)


os.makedirs(OUT, exist_ok=True)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = scene.render.resolution_y = SIZE
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filter_size = 0.0                  # no anti-aliasing: hard pixel edges
scene.view_settings.view_transform = 'Standard'  # flat colours, no filmic tonemapping

# orthographic ~45 degree top-down camera, shared by every character
cam = bpy.data.objects.get('KupitCam')
if cam is None:
    cam_data = bpy.data.cameras.new('KupitCam')
    cam = bpy.data.objects.new('KupitCam', cam_data)
    scene.collection.objects.link(cam)
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 2.6
cam.location = (0, -6.0, 5.2)
cam.rotation_euler = (math.radians(50), 0, 0)
scene.camera = cam

# flat, even lighting so the palette snap stays clean. The light comes from the TOP-LEFT of the screen,
# like every sprite and tile in the game (docs/ART_STYLE.md): it travels right (+X), toward the camera (-Y), and down.
if 'KupitSun' not in bpy.data.objects:
    sun_data = bpy.data.lights.new('KupitSun', 'SUN')
    sun_data.energy = 3.0
    sun = bpy.data.objects.new('KupitSun', sun_data)
    scene.collection.objects.link(sun)
bpy.data.objects['KupitSun'].rotation_euler = (math.radians(-45), 0, math.radians(45))


def hide_all_but(root):
    for ob in scene.objects:
        if ob.name.startswith('Kupit') or ob.name == 'PortraitCam':
            continue
        ob.hide_render = not (ob == root or ob.parent == root or root in ob.parent_recursive)


def action_for(root, name):
    return bpy.data.actions.get(f'{root.name}.{name}') or bpy.data.actions.get(name)


def render(path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


roots = [o for o in scene.objects if o.parent is None and not o.name.startswith('Kupit') and o.name != 'PortraitCam' and o.type in {'EMPTY', 'ARMATURE', 'MESH'}]
missing = []
for root in roots:
    kind = root.name.lower()
    if KINDS and kind not in KINDS:
        continue
    group = group_of(kind)
    if not group:
        print('skip', kind, '(not a kind in style.json)')
        continue
    hide_all_but(root)
    arm = next((o for o in [root, *root.children_recursive] if o.type == 'ARMATURE'), None)
    walk = action_for(root, 'Walk')
    if arm and walk:
        arm.animation_data_create().action = walk
    start, end = (int(walk.frame_range[0]), int(walk.frame_range[1])) if walk else (1, 1)
    for d, z in DIR_Z.items():
        root.rotation_euler[2] = z
        for f in range(FRAMES):
            scene.frame_set(start + round((end - start) * f / FRAMES))
            render(os.path.join(OUT, f'{kind}_{d}_{f}.png'))
        for pose in STYLE['poses'].get(group, []):
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
    pcam = bpy.data.objects.get('PortraitCam')
    if pcam:
        scene.camera = pcam
        scene.frame_set(start)
        render(os.path.join(OUT, f'portrait_{kind}.png'))
        scene.camera = cam
    print('rendered', kind)
if missing:
    print('no action for these poses (the art lock test will want them):', ', '.join(sorted(set(missing))))
