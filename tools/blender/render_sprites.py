"""Blender batch renderer for Kupit character sprites.   (UNTESTED here: Blender was not installed.)

    blender -b art/blend/characters.blend -P tools/blender/render_sprites.py -- --out art/renders [--size 48] [--frames 4]

Scene conventions (see docs/ART_PIPELINE.md):
  * one top-level Empty/Collection per character, named after the sprite kind (jun, bing, mama, aso, ...),
    containing the mesh + armature; the character faces -Y (towards the default camera) at rotation 0
  * a walk Action on each armature named "Walk" (its frame range is the cycle)
Output: <out>/<kind>_<dir>_<frame>.png, dir 0 = down, 2 = right, 3 = up (left is mirrored in the game),
        frame 0..N-1 sampled evenly over the Walk cycle. Then run tools/pack_atlas.py on that folder.
"""
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
        if ob.name.startswith('Kupit'):
            continue
        ob.hide_render = not (ob == root or ob.parent == root or root in ob.parent_recursive)


roots = [o for o in scene.objects if o.parent is None and not o.name.startswith('Kupit') and o.type in {'EMPTY', 'ARMATURE', 'MESH'}]
for root in roots:
    kind = root.name.lower()
    if KINDS and kind not in KINDS:
        continue
    hide_all_but(root)
    arm = next((o for o in [root, *root.children_recursive] if o.type == 'ARMATURE'), None)
    action = bpy.data.actions.get(f'{root.name}.Walk') or bpy.data.actions.get('Walk')
    if arm and action:
        arm.animation_data_create().action = action
    start, end = (int(action.frame_range[0]), int(action.frame_range[1])) if action else (1, 1)
    for d, z in DIR_Z.items():
        root.rotation_euler[2] = z
        for f in range(FRAMES):
            scene.frame_set(start + round((end - start) * f / FRAMES))
            scene.render.filepath = os.path.join(OUT, f'{kind}_{d}_{f}.png')
            bpy.ops.render.render(write_still=True)
    root.rotation_euler[2] = 0.0
    print('rendered', kind)
