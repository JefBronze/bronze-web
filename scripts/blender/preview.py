"""Render quick previews of public/models/motor.glb (checks the geometry before it reaches the page).

Run:  blender -b --factory-startup --python scripts/blender/preview.py -- <outdir>
Writes <outdir>/blender-T.png (transverse cut, cylinder 1) and <outdir>/blender-L.png (longitudinal cut, 4 cylinders).
"""
import math
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'public', 'models', 'motor.glb'))
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_cavity = True
scene.display.shading.show_shadows = True
scene.render.resolution_x = 1200
scene.render.resolution_y = 900
scene.world = bpy.data.worlds.new('w')
scene.world.color = (0.95, 0.94, 0.92)

cam_data = bpy.data.cameras.new('cam')
cam_data.lens = 50
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam


def look(pos, target):
    cam.location = pos
    d = Vector(target) - Vector(pos)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def show(mode):
    for o in scene.objects:
        if o.type != 'MESH':
            continue
        n = o.name
        hide = False
        if n.endswith('_T') or n.endswith('_L'):
            hide = not n.endswith('_' + mode)
        if mode == 'T' and (n == 'volante' or n.endswith('_1_a')):
            hide = True
        o.hide_render = hide


# Imported glTF is Y-up converted back to Blender Z-up, so Blender coordinates apply.
show('T')
look((-700, 260, 300), (-120, 0, 140))
scene.render.filepath = os.path.join(out, 'blender-T.png')
bpy.ops.render.render(write_still=True)

show('L')
look((260, -760, 420), (0, 0, 120))
scene.render.filepath = os.path.join(out, 'blender-L.png')
bpy.ops.render.render(write_still=True)
print('RENDERED', out)
