"""Small modelling kit for the Blender build scripts (headless, millimetres, X is the shaft/crank axis)."""
import math
import time

import bmesh
import bpy
from mathutils import Vector

T0 = time.time()
MATS = {}


def log(msg):
    print(f'[{time.time() - T0:6.1f}s] {msg}', flush=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def scene():
    return bpy.context.scene


def mat(name, rgb, metal=0.0, rough=0.5, emit=None):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    MATS[name] = m
    return m


def active():
    return bpy.context.view_layer.objects.active


def set_mat(o, m):
    o.data.materials.clear()
    o.data.materials.append(m)
    return o


def cyl(r, depth, loc=(0, 0, 0), axis='Z', verts=48, m=None):
    rot = {'Z': (0, 0, 0), 'X': (0, math.pi / 2, 0), 'Y': (math.pi / 2, 0, 0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    o = active()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return set_mat(o, m) if m else o


def cyl_between(p0, p1, r, verts=40, m=None):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length, location=(p0 + p1) / 2)
    o = active()
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return set_mat(o, m) if m else o


def tube_x(r_out, r_in, x0, x1, verts=96, m=None):
    """Hollow cylinder along X."""
    o = cyl(r_out, x1 - x0, ((x0 + x1) / 2, 0, 0), 'X', verts, m)
    boolean(o, cyl(r_in, x1 - x0 + 4, ((x0 + x1) / 2, 0, 0), 'X', verts))
    return o


def box(x0, x1, y0, y1, z0, z1, m=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = active()
    o.scale = (x1 - x0, y1 - y0, z1 - z0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        bev = o.modifiers.new('bev', 'BEVEL')
        bev.width = bevel
        bev.segments = 3
        bev.limit_method = 'ANGLE'
        apply_mod(o, bev)
    return set_mat(o, m) if m else o


def apply_mod(o, mod):
    with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o]):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def boolean(target, cutter, op='DIFFERENCE', transfer=False, keep=False, self_check=False):
    mod = target.modifiers.new('b', 'BOOLEAN')
    mod.operation = op
    mod.solver = 'EXACT'
    mod.use_self = self_check
    if transfer:
        mod.material_mode = 'TRANSFER'
    mod.object = cutter
    apply_mod(target, mod)
    if not keep:
        bpy.data.objects.remove(cutter, do_unlink=True)
    return target


def cut_all(target, cutters):
    """One exact boolean against all cutters at once (a collection operand)."""
    t0 = time.time()
    tmp = bpy.data.collections.new('cutters')
    scene().collection.children.link(tmp)
    for c in cutters:
        for uc in list(c.users_collection):
            uc.objects.unlink(c)
        tmp.objects.link(c)
    mod = target.modifiers.new('b', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.operand_type = 'COLLECTION'
    mod.collection = tmp
    apply_mod(target, mod)
    for c in list(tmp.objects):
        bpy.data.objects.remove(c, do_unlink=True)
    bpy.data.collections.remove(tmp)
    log(f'cut {target.name}: {len(cutters)} cutters, {len(target.data.polygons)} faces, {time.time() - t0:.1f}s')
    return target


def join(objs, name):
    objs = [o for o in objs if o]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = active()
    o.name = name
    o.data.name = name
    return o


def origin_at(o, p):
    scene().cursor.location = p
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    scene().cursor.location = (0, 0, 0)


def smooth(o, angle=35):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))


def hull(points):
    pts = sorted(set((round(a, 4), round(b, 4)) for a, b in points))
    if len(pts) < 3:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def circle(cy, cz, r, n=48, a0=0, a1=2 * math.pi):
    return [(cy + r * math.cos(a0 + (a1 - a0) * i / n), cz + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


def rot_yz(points, ang):
    c, s = math.cos(ang), math.sin(ang)
    return [(y * c - z * s, y * s + z * c) for y, z in points]


def prism_x(profile, x0, x1, name, m=None):
    """Extrude a 2D (y, z) polygon along X from x0 to x1."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    a = [bm.verts.new((x0, y, z)) for y, z in profile]
    b = [bm.verts.new((x1, y, z)) for y, z in profile]
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    n = len(profile)
    for i in range(n):
        bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    scene().collection.objects.link(o)
    return set_mat(o, m) if m else o


def gear_x(r, teeth, depth, x0, x1, name, m):
    prof = []
    for i in range(teeth * 4):
        a = 2 * math.pi * i / (teeth * 4)
        rr = r + (depth if (i % 4) in (1, 2) else 0)
        prof.append((rr * math.cos(a), rr * math.sin(a)))
    return prism_x(prof, x0, x1, name, m)


def section(objs, bounds, corte, suffix='', overlapping=()):
    """Cut each object with a box (material `corte` on the new faces); returns the cut copies (or the objects themselves when suffix is empty)."""
    out = []
    for o in objs:
        c = o
        if suffix:
            c = o.copy()
            c.data = o.data.copy()
            scene().collection.objects.link(c)
            c.name = f'{o.name}{suffix}'
            c.data.name = c.name
        boolean(c, box(*bounds, corte), transfer=True, self_check=o.name in overlapping or o.name.startswith('ranhura'))
        if c.data.polygons:
            out.append(c)
        else:
            bpy.data.objects.remove(c, do_unlink=True)
    return out


def export(objs, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_draco_mesh_compression_enable=False,
        export_materials='EXPORT',
        export_texcoords=False,
    )
