"""Quick render of .cache/emotor-raw.glb to check the geometry.  blender -b --factory-startup --python scripts/blender/preview_emotor.py -- <outdir>"""
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, '.cache', 'emotor-raw.glb'))
s = bpy.context.scene
s.render.engine = 'BLENDER_WORKBENCH'
s.display.shading.light = 'STUDIO'
s.display.shading.color_type = 'MATERIAL'
s.display.shading.show_cavity = True
s.render.resolution_x, s.render.resolution_y = 1200, 900
s.world = bpy.data.worlds.new('w')
s.world.color = (0.95, 0.94, 0.92)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
s.collection.objects.link(cam)
s.camera = cam
for name, pos, target in (('emotor-a', (-520, -260, 260), (0, 0, 40)), ('emotor-b', (-600, 0, 0), (0, 0, 0))):
    cam.location = pos
    cam.rotation_euler = (Vector(target) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
    s.render.filepath = os.path.join(out, name + '.png')
    bpy.ops.render.render(write_still=True)
print('RENDERED')
