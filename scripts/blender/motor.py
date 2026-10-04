"""Build public/models/motor.glb: an inline four-cylinder 1.0, DOHC 16 valves, for section 7 ("O motor por dentro").

Run:  blender -b --factory-startup --python scripts/blender/motor.py
Dimensions come from lib/engine-layout.json (shared with components/Engine3D.tsx). Units are millimetres.
Blender axes: X along the crankshaft, Y across the engine (intake +Y, exhaust -Y), Z up.

Moving parts are separate nodes with their origin on their own axis, so the page animates them from lib/engine.ts:
  virabrequim, volante (rotate about X) · comando_adm, comando_esc (about X, half crank speed)
  pistao_N, biela_N (N = 1..4) · valvula_{adm,esc}_N_{a,b} (slide along local Y in glTF) · mola_{adm,esc}_N_{a,b} (scale along local Y)
Static parts come twice, cut two ways: "<name>_T" (transverse section through cylinder 1) and "<name>_L" (longitudinal section,
front half removed). Faces created by the section cut get the material "corte" (painted like a technical cutaway).
"""
import json
import math
import os
import time

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
L = json.load(open(os.path.join(ROOT, 'lib', 'engine-layout.json')))

BORE = L['bore']
CR = L['stroke'] / 2
ROD = L['rod']
AREA = math.pi * BORE ** 2 / 4
CLEAR_H = L['stroke'] / (12 - 1)  # clearance height for a 12:1 ratio (flat-equivalent)
DECK = CR + ROD + L['pinBelowCrown'] + CLEAR_H  # head face, from the crank axis
ROOF = L['roof']
TILT = math.radians(L['valveTilt'])
SEAT_Y = L['valveSeatY']
VLEN = L['valveLength']
CAM_R = L['camR']
LIFT = 8.0
X = L['cylX']
OFF = L['offsets']
HEAD_TOP = DECK + 100
X_SECTION = X[0]


def roof_z(y):
    return DECK + ROOF - abs(y) * math.tan(TILT)


SEAT_Z = roof_z(SEAT_Y)
U_IN = Vector((0, math.sin(TILT), math.cos(TILT)))
U_EX = Vector((0, -math.sin(TILT), math.cos(TILT)))
CAM_IN = Vector((0, SEAT_Y, SEAT_Z)) + U_IN * (VLEN + CAM_R)
CAM_EX = Vector((0, -SEAT_Y, SEAT_Z)) + U_EX * (VLEN + CAM_R)

# ---------------------------------------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
coll = scene.collection
MATS = {}


def mat(name, rgb, metal=0.0, rough=0.5):
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


M = {
    'aluminio': mat('aluminio', (0.72, 0.72, 0.70), 0.6, 0.45),
    'ferro': mat('ferro', (0.32, 0.30, 0.28), 0.7, 0.6),
    'aco': mat('aco', (0.55, 0.56, 0.58), 0.9, 0.3),
    'pistao': mat('pistao', (0.80, 0.80, 0.78), 0.8, 0.35),
    'valvula_adm': mat('valvula_adm', (0.55, 0.60, 0.68), 0.9, 0.3),
    'valvula_esc': mat('valvula_esc', (0.62, 0.52, 0.48), 0.9, 0.35),
    'mola': mat('mola', (0.25, 0.25, 0.27), 0.8, 0.4),
    'ceramica': mat('ceramica', (0.93, 0.92, 0.88), 0.0, 0.3),
    'borracha': mat('borracha', (0.06, 0.06, 0.06), 0.0, 0.8),
    'plastico': mat('plastico', (0.10, 0.10, 0.11), 0.0, 0.6),
    'corte': mat('corte', (0.75, 0.20, 0.15), 0.0, 0.7),
}


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
    """One exact boolean against all cutters at once (a collection operand), much faster than one by one."""
    t0 = time.time()
    tmp = bpy.data.collections.new('cutters')
    scene.collection.children.link(tmp)
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


T0 = time.time()


def log(msg):
    print(f'[{time.time() - T0:6.1f}s] {msg}', flush=True)


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
    scene.cursor.location = p
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    scene.cursor.location = (0, 0, 0)


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
    coll.objects.link(o)
    return set_mat(o, m) if m else o


def rot_yz(points, ang):
    c, s = math.cos(ang), math.sin(ang)
    return [(y * c - z * s, y * s + z * c) for y, z in points]


def helix(r, h, turns, wire, name, m):
    """Coil spring along +Z from 0 to h, as a mesh."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = wire
    cu.bevel_resolution = 3
    sp = cu.splines.new('POLY')
    n = int(turns * 24)
    sp.points.add(n)
    for i in range(n + 1):
        t = i / n
        a = 2 * math.pi * turns * t
        sp.points[i].co = (r * math.cos(a), r * math.sin(a), wire + (h - 2 * wire) * t, 1)
    o = bpy.data.objects.new(name, cu)
    coll.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH')
    o = active()
    return set_mat(o, m)


def gear_x(r, teeth, depth, x0, x1, name, m):
    prof = []
    for i in range(teeth * 4):
        a = 2 * math.pi * i / (teeth * 4)
        rr = r + (depth if (i % 4) in (1, 2) else 0)
        prof.append((rr * math.cos(a), rr * math.sin(a)))
    return prism_x(prof, x0, x1, name, m)


moving, static = [], []

# ---------------------------------------------------------------------------------------------------------
# Crankshaft: main journals between the cylinders, two webs per throw with counterweights, crank pins,
# the toothed timing pulley at +X. Pins of cylinders 1 and 4 point up (+Z), 2 and 3 down: the 180° flat crank.
parts = []
for xb in (-160, -80, 0, 80, 160):
    parts.append(cyl(22, 24, (xb, 0, 0), 'X', 48, M['aco']))
for i, x in enumerate(X):
    up = 1 if OFF[i] % 360 == 0 else -1
    pin_z = up * CR
    parts.append(cyl(18, 26, (x, 0, pin_z), 'X', 40, M['aco']))
    # Web and counterweight in one convex outline: the pin boss on one side, a 54 mm half-disc on the other.
    web = hull(circle(0, pin_z, 23, 32) + [(y, -up * abs(z)) for y, z in circle(0, 0, 54, 48, 0, math.pi)] + circle(0, 0, 26, 32))
    for x0, x1 in ((x - 28, x - 13), (x + 13, x + 28)):
        parts.append(prism_x(web, x0, x1, 'web', M['aco']))
parts.append(cyl(15, 50, (183, 0, 0), 'X', 32, M['aco']))
parts.append(gear_x(L['crankPulleyR'], 19, 1.6, L['timingX'] - 9, L['timingX'] + 9, 'polia', M['aco']))
parts.append(cyl(15, 30, (-184, 0, 0), 'X', 32, M['aco']))
crank = join(parts, 'virabrequim')
log('crankshaft')
# Timing mark on the pulley, so the 2:1 ratio is visible.
mark = box(L['timingX'] + 8.5, L['timingX'] + 10, -2, 2, L['crankPulleyR'] - 6, L['crankPulleyR'] + 1, M['corte'])
crank = join([crank, mark], 'virabrequim')
smooth(crank)
origin_at(crank, (0, 0, 0))
moving.append(crank)

# Flywheel with starter ring gear.
fx = L['flywheelX']
fw = cyl(100, 12, (fx, 0, 0), 'X', 96, M['ferro'])
for k in range(6):
    a = 2 * math.pi * k / 6
    boolean(fw, cyl(9, 20, (fx, 60 * math.cos(a), 60 * math.sin(a)), 'X', 24))
ring = gear_x(103, 64, 3, fx - 5, fx + 5, 'coroa', M['aco'])
fw = join([fw, ring], 'volante')
smooth(fw)
origin_at(fw, (0, 0, 0))
moving.append(fw)

# ---------------------------------------------------------------------------------------------------------
# Pistons (origin at the pin centre) and connecting rods (origin at the small end, shank pointing down).
for i, x in enumerate(X):
    n = i + 1
    top = L['pinBelowCrown']
    bottom = top - L['pistonHeight']
    p = cyl(BORE / 2 - 0.3, top - bottom, (0, 0, (top + bottom) / 2), 'Z', 72, M['pistao'])
    cutters = [cyl(BORE / 2 - 4.5, top - bottom - 9, (0, 0, (bottom - 1 + top - 9) / 2), 'Z', 48)]
    for gz in (top - 4, top - 7.5, top - 11):
        g = cyl(BORE / 2 + 2, 1.6, (0, 0, gz), 'Z', 72)
        boolean(g, cyl(BORE / 2 - 1.4, 3, (0, 0, gz), 'Z', 72))
        cutters.append(g)
    for sy in (SEAT_Y, -SEAT_Y):
        for dx in (-L['valvePairDx'], L['valvePairDx']):
            cutters.append(cyl(L['intakeValveR'] + 1 if sy > 0 else L['exhaustValveR'] + 1, 3, (dx, sy, top + 0.4), 'Z', 32))
    cut_all(p, cutters)
    boss = cyl(12, BORE - 10, (0, 0, 0), 'X', 32, M['pistao'])
    pin = cyl(8.6, BORE - 6, (0, 0, 0), 'X', 32, M['aco'])
    p = join([p, boss, pin], f'pistao_{n}')
    smooth(p)
    origin_at(p, (0, 0, 0))
    p.location = (x, 0, CR + ROD)
    moving.append(p)

    small = cyl(13, 20, (0, 0, 0), 'X', 40, M['aco'])
    boolean(small, cyl(8.9, 30, (0, 0, 0), 'X', 32))
    big = cyl(28, 22, (0, 0, -ROD), 'X', 56, M['aco'])
    boolean(big, cyl(18.4, 30, (0, 0, -ROD), 'X', 48))
    shank = prism_x([(-7, -10), (7, -10), (11, -ROD + 22), (-11, -ROD + 22)], -9, 9, 'haste', M['aco'])
    for s in (-1, 1):
        boolean(shank, prism_x([(-4, -16), (4, -16), (6.5, -ROD + 28), (-6.5, -ROD + 28)], s * 9 - 3.5, s * 9 + 3.5, 'rebaixo'))
    bolts = [cyl(3.6, 34, (0, s * 23, -ROD + 2), 'Z', 16, M['aco']) for s in (-1, 1)]
    r = join([small, big, shank] + bolts, f'biela_{n}')
    smooth(r)
    origin_at(r, (0, 0, 0))
    r.location = (x, 0, CR + ROD)
    moving.append(r)

# ---------------------------------------------------------------------------------------------------------
# Valves (origin at the seat, stem along local +Z, then tilted), each with its bucket tappet; springs between
# the head and the bucket. Node rotation is kept, so in glTF each valve slides along its own local Y.
def valve(name, r_head, m):
    head = cyl_between((0, 0, -2.2), (0, 0, 0.6), r_head, 48, m)
    neck = cyl_between((0, 0, 0.6), (0, 0, 7), 0.1, 32, m)
    bm = bmesh.new()
    bm.from_mesh(neck.data)
    for v in bm.verts:
        if v.co.z < 1:
            v.co.x *= r_head * 8
            v.co.y *= r_head * 8
        else:
            v.co.x *= 30
            v.co.y *= 30
    bm.to_mesh(neck.data)
    bm.free()
    stem = cyl_between((0, 0, 6), (0, 0, VLEN - 10), 2.8, 20, M['aco'])
    retainer = cyl_between((0, 0, VLEN - 52), (0, 0, VLEN - 49), 9, 32, M['aco'])
    bucket = cyl_between((0, 0, VLEN - 13), (0, 0, VLEN), 13, 40, M['aco'])
    o = join([head, neck, stem, retainer, bucket], name)
    smooth(o)
    origin_at(o, (0, 0, 0))
    return o


for i, x in enumerate(X):
    n = i + 1
    for side, u, sy, r_head, mat_v in (('adm', U_IN, SEAT_Y, L['intakeValveR'], M['valvula_adm']), ('esc', U_EX, -SEAT_Y, L['exhaustValveR'], M['valvula_esc'])):
        tilt = -TILT if side == 'adm' else TILT
        for tag, dx in (('a', -L['valvePairDx']), ('b', L['valvePairDx'])):
            v = valve(f'valvula_{side}_{n}_{tag}', r_head, mat_v)
            v.rotation_euler = (tilt, 0, 0)
            v.location = (x + dx, sy, roof_z(sy))
            moving.append(v)
            sp = helix(10.5, L['springH'], 6.5, 1.6, f'mola_{side}_{n}_{tag}', M['mola'])
            sp.rotation_euler = (tilt, 0, 0)
            seat = Vector((x + dx, sy, roof_z(sy))) + u * (VLEN - 13 - L['springH'])
            sp.location = seat
            moving.append(sp)

# ---------------------------------------------------------------------------------------------------------
# Camshafts: base circle + nose (lift 8 mm). Each lobe is turned so that, with the cam at crank/2 about X,
# its nose meets the bucket exactly when lib/engine.ts says the valve is fully open.
def lobe_profile():
    return hull(circle(0, 0, CAM_R, 48) + circle(0, CAM_R + LIFT - 6, 6, 24))


def camshaft(name, centre, u, peak_of_cylinder):
    parts = [cyl(10, 380, (25, 0, 0), 'X', 32, M['aco'])]
    for xb in (-160, -80, 0, 80, 160):
        parts.append(cyl(13, 14, (xb, 0, 0), 'X', 40, M['aco']))
    down = -u  # from the cam centre toward the valve
    base_ang = math.atan2(down.z, down.y) - math.pi / 2  # rotates the profile's +Z nose onto `down`
    for i, x in enumerate(X):
        crank_peak = (peak_of_cylinder - OFF[i]) % 720
        cam_peak = math.radians(crank_peak / 2)
        prof = rot_yz(lobe_profile(), base_ang - cam_peak)
        for dx in (-L['valvePairDx'], L['valvePairDx']):
            parts.append(prism_x(prof, x + dx - 7, x + dx + 7, 'came', M['aco']))
    parts.append(gear_x(L['camPulleyR'], 38, 1.6, L['timingX'] - 9, L['timingX'] + 9, 'polia', M['aco']))
    parts.append(box(L['timingX'] + 8.5, L['timingX'] + 10, -2, 2, L['camPulleyR'] - 6, L['camPulleyR'] + 1, M['corte']))
    for k in range(5):
        a = 2 * math.pi * k / 5
        boolean(parts[-2], cyl(7, 30, (L['timingX'], 26 * math.cos(a), 26 * math.sin(a)), 'X', 20))
    o = join(parts, name)
    smooth(o)
    o.location = centre
    moving.append(o)
    return o


camshaft('comando_adm', CAM_IN, U_IN, 90)
log('intake camshaft')
camshaft('comando_esc', CAM_EX, U_EX, 630)

# ---------------------------------------------------------------------------------------------------------
# Static parts.
XA, XB = -165, 165
block = box(XA, XB, -62, 62, -38, DECK, M['aluminio'], bevel=2)
cut = [cyl(BORE / 2, DECK - 52, (x, 0, 52 + (DECK - 52) / 2 + 0.5), 'Z', 72) for x in X]
for x in X:
    cut.append(box(x - 28, x + 28, -56, 56, -45, 62))
cut.append(cyl(23, 400, (0, 0, 0), 'X', 48))
for s in (-1, 1):
    cut.append(box(-150, 150, s * 43 - 3, s * 43 + 3, 88, DECK - 6))  # water jacket
cut_all(block, cut)
block.name = 'bloco'
smooth(block, 30)
static.append(block)

head = box(XA, XB, -62, 62, DECK, HEAD_TOP, M['aluminio'], bevel=2)
cut = []
for i, x in enumerate(X):
    # Pent-roof chamber: a box whose top follows the roof, intersected with the bore.
    ch = box(x - BORE / 2, x + BORE / 2, -BORE / 2, BORE / 2, DECK - 1, DECK + ROOF + 1)
    bm = bmesh.new()
    bm.from_mesh(ch.data)
    bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if abs(e.verts[0].co.y - e.verts[1].co.y) > 1], cuts=10, use_grid_fill=True)
    for v in bm.verts:
        if v.co.z > DECK:
            v.co.z = max(DECK + 0.3, roof_z(v.co.y))
    bm.to_mesh(ch.data)
    bm.free()
    boolean(ch, cyl(BORE / 2, 40, (x, 0, DECK + 10), 'Z', 72), 'INTERSECT')
    cut.append(ch)
    for sy, u, rr, out in ((SEAT_Y, U_IN, 12.5, Vector((0, 1, 0.55))), (-SEAT_Y, U_EX, 11, Vector((0, -1, 0.42)))):
        for dx in (-L['valvePairDx'], L['valvePairDx']):
            seat = Vector((x + dx, sy, roof_z(sy)))
            cut.append(cyl_between(seat - u * 1, seat + u * 14, rr, 40))
            port_out = Vector((x + dx * 0.4, 70 * (1 if sy > 0 else -1), roof_z(sy) + 47 * out.z))
            cut.append(cyl_between(seat + u * 8, port_out, rr, 40))
            cut.append(cyl_between(seat, seat + u * (VLEN - 13), 3.5, 16))  # guide
            cut.append(cyl_between(seat + u * (VLEN - 13 - L['springH'] - 2), seat + u * (VLEN + 30), 14, 40))  # bucket bore and spring pocket
    cut.append(cyl_between((x, 0, DECK + ROOF - 2), (x, 0, HEAD_TOP + 5), 7, 32))  # plug thread
    cut.append(cyl_between((x, 0, DECK + 40), (x, 0, HEAD_TOP + 5), 12, 32))  # plug well
    inj0 = Vector((x, 38, roof_z(38) + 40))
    cut.append(cyl_between(inj0, inj0 + Vector((0, 40, 22)), 6.5, 24))
for c in (CAM_IN, CAM_EX):
    cut.append(cyl(CAM_R + 9, 400, (0, c.y, c.z), 'X', 48))
cut_all(head, cut)
head.name = 'cabecote'
smooth(head, 30)
static.append(head)

cover = box(XA + 5, XB - 5, -80, 80, HEAD_TOP, CAM_IN.z + 40, M['plastico'], bevel=6)
boolean(cover, box(XA + 9, XB - 9, -76, 76, HEAD_TOP - 1, CAM_IN.z + 36))
for x in X:
    boolean(cover, cyl(14, 80, (x, 0, CAM_IN.z + 20), 'Z', 32))
cover.name = 'tampa'
smooth(cover, 30)
static.append(cover)

pan = box(XA + 5, XB - 5, -60, 60, -110, -38, M['aluminio'], bevel=4)
boolean(pan, box(XA + 9, XB - 9, -56, 56, -106, -30))
pan.name = 'carter'
static.append(pan)

# Spark plugs (steel shell, ceramic insulator, electrode) and their coils.
plugs = []
for x in X:
    plugs.append(cyl_between((x, 0, DECK + ROOF - 3), (x, 0, DECK + ROOF + 18), 6, 24, M['aco']))
    plugs.append(cyl_between((x, 0, DECK + ROOF + 18), (x, 0, DECK + ROOF + 30), 9.5, 6, M['aco']))
    plugs.append(cyl_between((x, 0, DECK + ROOF + 30), (x, 0, DECK + ROOF + 62), 5.5, 24, M['ceramica']))
    plugs.append(cyl_between((x, 0, DECK + ROOF + 62), (x, 0, CAM_IN.z + 60), 11, 24, M['plastico']))
    plugs.append(cyl_between((x, 0, DECK + ROOF - 3), (x, 0, DECK + ROOF - 6), 1.2, 8, M['aco']))
vel = join(plugs, 'velas')
smooth(vel)
static.append(vel)

# Injectors aimed at the intake valves, and the fuel rail.
inj = []
for x in X:
    a = Vector((x, 38, roof_z(38) + 40))
    inj.append(cyl_between(a, a + Vector((0, 40, 22)), 6, 24, M['plastico']))
    inj.append(cyl_between(a - Vector((0, 4, 2)), a, 3, 12, M['aco']))
inj.append(cyl_between((XA + 10, 84, roof_z(38) + 66), (XB - 10, 84, roof_z(38) + 66), 9, 24, M['aco']))
injetores = join(inj, 'injetores')
smooth(injetores)
static.append(injetores)

# Intake manifold: four runners into a plenum with the throttle body.
runners = []
for x in X:
    a = Vector((x, 62, roof_z(SEAT_Y) + 26))
    b = Vector((x, 150, roof_z(SEAT_Y) + 70))
    t = cyl_between(a, b, 17, 40, M['aluminio'])
    boolean(t, cyl_between(a - Vector((0, 4, 2)), b + Vector((0, 4, 2)), 14, 40))
    runners.append(t)
plenum = box(XA, XB, 140, 195, roof_z(SEAT_Y) + 40, roof_z(SEAT_Y) + 110, M['aluminio'], bevel=14)
boolean(plenum, box(XA + 4, XB - 4, 144, 191, roof_z(SEAT_Y) + 44, roof_z(SEAT_Y) + 106))
throttle = cyl(30, 40, (XA - 18, 168, roof_z(SEAT_Y) + 75), 'X', 48, M['aluminio'])
boolean(throttle, cyl(26, 50, (XA - 18, 168, roof_z(SEAT_Y) + 75), 'X', 48))
adm = join(runners + [plenum, throttle], 'coletor_adm')
smooth(adm, 30)
static.append(adm)

# Exhaust: 4-into-1 header.
pipes = []
z0 = roof_z(SEAT_Y) + 20
for x in X:
    a = Vector((x, -62, z0))
    b = Vector((x * 0.35, -120, z0 - 50))
    c = Vector((0, -128, z0 - 150))
    for p0, p1 in ((a, b), (b, c)):
        t = cyl_between(p0, p1, 15, 36, M['ferro'])
        boolean(t, cyl_between(p0 - (p1 - p0).normalized() * 2, p1 + (p1 - p0).normalized() * 2, 12, 36))
        pipes.append(t)
pipes.append(cyl_between((0, -128, z0 - 150), (0, -128, z0 - 260), 22, 40, M['ferro']))
esc = join(pipes, 'coletor_esc')
smooth(esc, 30)
static.append(esc)

# ---------------------------------------------------------------------------------------------------------
# Two section cuts of every static part.
corte = M['corte']
final = []
for o in static:
    for tag, bounds in (('T', (-1000, X_SECTION, -1000, 1000, -1000, 1000)), ('L', (-1000, 1000, -1000, 0, -1000, 1000))):
        c = o.copy()
        c.data = o.data.copy()
        coll.objects.link(c)
        c.name = f'{o.name}_{tag}'
        c.data.name = c.name
        cutter = box(*bounds, corte)
        boolean(c, cutter, transfer=True, self_check=o.name in ('velas', 'injetores', 'coletor_adm', 'coletor_esc'))
        log(f'section {c.name}: {len(c.data.polygons)} faces')
        if c.data.polygons:
            final.append(c)
        else:
            bpy.data.objects.remove(c, do_unlink=True)
    bpy.data.objects.remove(o, do_unlink=True)

final += moving
out = os.path.join(ROOT, '.cache', 'motor-raw.glb')  # optimized into public/models/motor.glb by npm run model
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for o in final:
    o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    use_selection=True,
    export_yup=True,
    export_apply=True,
    export_draco_mesh_compression_enable=False,
    export_materials='EXPORT',
    export_texcoords=False,
)
print('WROTE', out, os.path.getsize(out), 'bytes', len(final), 'nodes')
print('LAYOUT', json.dumps({'deck': DECK, 'camIn': list(CAM_IN), 'camEx': list(CAM_EX), 'seatZ': SEAT_Z, 'headTop': HEAD_TOP}))
