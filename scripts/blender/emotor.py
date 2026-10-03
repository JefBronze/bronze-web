"""Build public/models/emotor.glb: the traction motor and its inverter for section 8 (cut through the middle of the stack).

Run:  blender -b --factory-startup --python scripts/blender/emotor.py   (or npm run model:emotor)
Geometry from lib/emotor-layout.json. Blender axes: X along the shaft, Z up; the section removes everything at x < 0,
a plane perpendicular to the shaft, so the cut stays valid while the rotor turns.

Nodes the page drives:
  rotor (turns about X; laminations, V magnets, shaft, resolver target in one node)
  ranhura_0 … ranhura_47 (one per slot, coloured by the current of its phase)
  chave_{a,b,c}_{h,l} (the six power switches, lit when on)
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from bkit import (box, circle, cut_all, cyl, export, gear_x, join, log, mat, origin_at, prism_x, reset, rot_yz,  # noqa: E402
                  set_mat, smooth, tube_x)

import bpy  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
L = json.load(open(os.path.join(ROOT, 'lib', 'emotor-layout.json')))
reset()

M = {
    'laminacao': mat('laminacao', (0.30, 0.32, 0.36), 0.7, 0.45),
    'cobre': mat('cobre', (0.80, 0.45, 0.25), 1.0, 0.3),
    'ima_n': mat('ima_n', (0.70, 0.18, 0.15), 0.3, 0.4),
    'ima_s': mat('ima_s', (0.18, 0.35, 0.65), 0.3, 0.4),
    'aluminio': mat('aluminio', (0.72, 0.72, 0.70), 0.6, 0.45),
    'aco': mat('aco', (0.55, 0.56, 0.58), 0.9, 0.3),
    'ceramica': mat('ceramica', (0.93, 0.92, 0.88), 0.0, 0.3),
    'silicio': mat('silicio', (0.12, 0.12, 0.16), 0.5, 0.3),
    'capacitor': mat('capacitor', (0.15, 0.15, 0.17), 0.0, 0.6),
    'isolante': mat('isolante', (0.85, 0.75, 0.40), 0.0, 0.6),
    'corte': mat('corte', (0.75, 0.20, 0.15), 0.0, 0.7),
}

HALF = L['stack'] / 2
# The section plane. Every part is a prism along X, so instead of cutting we build it starting at the plane: the exposed
# face keeps the part's own material (copper, magnet, lamination), which is what an electric-machine cross-section shows.
XS = 0.0
R_SI = L['statorID'] / 2
R_SO = L['statorOD'] / 2
R_R = R_SI - L['airgap']
NS = L['slots']
P = L['polePairs']
OUT = []

# ---- stator: lamination stack with 48 open rectangular slots ------------------------------------------------
stator = tube_x(R_SO, R_SI, XS, HALF, 192, M['laminacao'])
w, wo = L['slotWidth'] / 2, L['slotOpening'] / 2
r0, r1, r2 = R_SI - 1, R_SI + L['toothTip'], R_SI + L['toothTip'] + L['slotDepth']
slot_profile = [(-wo, r0), (wo, r0), (wo, r1), (w, r1), (w, r2), (-w, r2), (-w, r1), (-wo, r1)]
cutters = []
for k in range(NS):
    a = 2 * math.pi * k / NS
    cutters.append(prism_x(rot_yz(slot_profile, a), XS - 2, HALF + 2, f'slotcut{k}'))
cut_all(stator, cutters)
stator.name = 'estator'

# ---- hairpin conductors: six rectangular bars per slot, one node per slot ----------------------------------
layers = L['layersPerSlot']
bar_h = (r2 - r1 - 1.2) / layers
slots = []
for k in range(NS):
    a = 2 * math.pi * k / NS
    bars = []
    for i in range(layers):
        z0 = r1 + 0.6 + i * bar_h + 0.18
        z1 = z0 + bar_h - 0.36
        bw = w - 0.55
        prof = rot_yz([(-bw, z0), (bw, z0), (bw, z1), (-bw, z1)], a)
        bars.append(prism_x(prof, XS, HALF + 14, 'bar', M['cobre']))
    liner = prism_x(rot_yz([(-w + 0.1, r1 + 0.1), (w - 0.1, r1 + 0.1), (w - 0.1, r2 - 0.1), (-w + 0.1, r2 - 0.1)], a), XS + 0.01, HALF + 2, 'liner', M['isolante'])
    bars.append(liner)
    slots.append(join(bars, f'ranhura_{k}'))
log('slots')

# End windings at the rear (the front ones go with the section): a copper crown of hairpin ends.
bpy.ops.mesh.primitive_torus_add(major_radius=(r1 + r2) / 2, minor_radius=(r2 - r1) / 2 + 1, major_segments=96, minor_segments=24,
                                 location=(HALF + L['endTurn'] / 2 - 2, 0, 0), rotation=(0, math.pi / 2, 0))
crown = bpy.context.view_layer.objects.active
crown.scale = (1, 1, L['endTurn'] / ((r2 - r1) + 2))
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
set_mat(crown, M['cobre'])
crown.name = 'cabeca_bobina'
smooth(crown)

# ---- rotor: laminations with V-shaped magnet pockets, magnets, shaft, resolver target ---------------------
rotor = tube_x(R_R, L['shaftR'], XS, HALF, 192, M['laminacao'])


def magnet_rect(inner, outer, length, thick):
    (y0, z0), (y1, z1) = inner, outer
    cy, cz = (y0 + y1) / 2, (z0 + z1) / 2
    ly, lz = y1 - y0, z1 - z0
    n = math.hypot(ly, lz)
    uy, uz = ly / n, lz / n
    ny, nz = -uz, uy
    hl, ht = length / 2, thick / 2
    return [(cy + uy * sx * hl + ny * sy * ht, cz + uz * sx * hl + nz * sy * ht) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]


depth = L['magnetDepth']
v_half = math.radians(L['magnetVAngle'])
pockets, magnets = [], []
for j in range(2 * P):
    phi = 2 * math.pi * j / (2 * P)
    for side in (-1, 1):
        # Each leg of the V runs from near the pole axis (the apex, deep in the rotor) out toward the air gap.
        apex_r = R_R - depth - 22
        inner = (side * 2.6, apex_r)
        outer = (side * (2.6 + 21 * math.cos(v_half)), apex_r + 21 * math.sin(v_half))
        pocket = rot_yz(magnet_rect(inner, outer, L['magnetW'] + 3, L['magnetT'] + 0.6), phi)
        pockets.append(prism_x(pocket, XS - 2, HALF + 2, 'pocket'))
        tip = rot_yz([outer], phi)[0]
        pockets.append(prism_x(circle(tip[0], tip[1], 2.4, 16), XS - 2, HALF + 2, 'barrier'))
        mag = rot_yz(magnet_rect(inner, outer, L['magnetW'], L['magnetT']), phi)
        magnets.append(prism_x(mag, XS, HALF - 1, f'ima_{j}', M['ima_n'] if j % 2 == 0 else M['ima_s']))
cut_all(rotor, pockets)
shaft = cyl(L['shaftR'], 155 - XS, ((155 + XS) / 2, 0, 0), 'X', 48, M['aco'])
splines = gear_x(L['shaftR'] - 2, 24, 1.6, 125, 155, 'estrias', M['aco'])
resolver_target = prism_x([(r * math.cos(t), r * math.sin(t)) for t, r in ((2 * math.pi * i / 96, 34 + 3 * math.cos(P * 2 * math.pi * i / 96)) for i in range(96))],
                          L['resolverX'] - 4, L['resolverX'] + 4, 'resolver', M['aco'])
rotor = join([rotor] + magnets + [shaft, splines, resolver_target], 'rotor')
smooth(rotor, 30)
origin_at(rotor, (0, 0, 0))
log('rotor')

# ---- bearings, resolver stator, housing with cooling channels and ribs, end bell -------------------------
bearings = []
for bx in (HALF + 22,):
    bearings.append(tube_x(L['shaftR'] + 6, L['shaftR'], bx - 9, bx + 9, 48, M['aco']))
    bearings.append(tube_x(L['shaftR'] + 20, L['shaftR'] + 14, bx - 9, bx + 9, 48, M['aco']))
    for i in range(11):
        t = 2 * math.pi * i / 11
        bpy.ops.mesh.primitive_uv_sphere_add(radius=5, location=(bx, (L['shaftR'] + 10) * math.cos(t), (L['shaftR'] + 10) * math.sin(t)), segments=16, ring_count=8)
        bearings.append(set_mat(bpy.context.view_layer.objects.active, M['aco']))
bearings.append(tube_x(46, 38, L['resolverX'] - 5, L['resolverX'] + 5, 64, M['cobre']))
rolamentos = join(bearings, 'rolamentos')
smooth(rolamentos)

H_OUT = L['housingOD'] / 2
housing = tube_x(H_OUT, R_SO + 0.5, XS, HALF + 15, 192, M['aluminio'])
holes = [cyl(3, L['stack'] + 40, (XS + L['stack'] / 2, (R_SO + 10) * math.cos(2 * math.pi * i / 24), (R_SO + 10) * math.sin(2 * math.pi * i / 24)), 'X', 16) for i in range(24)]
cut_all(housing, holes)
ribs = []
for i in range(18):
    t = 2 * math.pi * i / 18
    prof = rot_yz([(-2.5, H_OUT - 1), (2.5, H_OUT - 1), (2.5, H_OUT + 6), (-2.5, H_OUT + 6)], t)
    ribs.append(prism_x(prof, XS, HALF + 15, 'rib', M['aluminio']))
bell = cyl(H_OUT, 16, (HALF + 50, 0, 0), 'X', 128, M['aluminio'])
cut_all(bell, [cyl(L['shaftR'] + 20.5, 30, (HALF + 50, 0, 0), 'X', 64)])
bell_ring = tube_x(H_OUT, H_OUT - 10, HALF + 15, HALF + 42, 128, M['aluminio'])
carcaca = join([housing] + ribs + [bell, bell_ring], 'carcaca')
smooth(carcaca, 30)
log('housing')

# Phase busbars U, V, W from the end winding up to the inverter.
bus = []
for i, y in enumerate((-22, 0, 22)):
    bus.append(box(HALF + 18, HALF + 24, y - 6, y + 6, r2 - 4, H_OUT + 30, M['cobre']))
    bus.append(box(HALF + 18, 60, y - 6, y + 6, H_OUT + 24, H_OUT + 30, M['cobre']))
barramentos = join(bus, 'barramentos')

# ---- section: everything above is cut by the plane x = 0 --------------------------------------------------
# The housing's exposed face gets the cutaway red, as in a technical drawing; the machine itself keeps its colours.
ring = tube_x(H_OUT + 0.2, R_SO + 0.6, XS - 0.6, XS - 0.05, 192, M['corte'])
cut_holes = [cyl(3.05, 2, (XS - 0.2, (R_SO + 10) * math.cos(2 * math.pi * i / 24), (R_SO + 10) * math.sin(2 * math.pi * i / 24)), 'X', 16) for i in range(24)]
cut_all(ring, cut_holes)
carcaca = join([carcaca, ring], 'carcaca')
OUT += [stator, rotor, carcaca, rolamentos, crown, barramentos] + slots
log('section')

# ---- inverter on top (not cut; its lid is off): cold plate, three DBC half-bridges, six dies, DC link -------
Z0 = H_OUT + 30
inv = [box(-40, 130, -80, 80, Z0, Z0 + 8, M['aluminio'], bevel=1.5)]
for i, x in enumerate((-5, 40, 85)):
    inv.append(box(x - 18, x + 18, -60, 40, Z0 + 8, Z0 + 10, M['ceramica']))
    inv.append(box(x - 16, x + 16, -58, 38, Z0 + 10, Z0 + 10.6, M['cobre']))
inversor_base = join(inv, 'inversor_base')
for i, (leg, x) in enumerate(zip('abc', (-5, 40, 85))):
    for tag, y in (('h', -30), ('l', 10)):
        die = box(x - 7, x + 7, y - 7, y + 7, Z0 + 10.6, Z0 + 11.6, M['silicio'])
        die.name = f'chave_{leg}_{tag}'
        OUT.append(die)
cap = box(-40, 130, 46, 80, Z0 + 8, Z0 + 52, M['capacitor'], bevel=3)
cap.name = 'capacitor'
dc = join([box(-40, 130, 40, 46, Z0 + 12, Z0 + 16, M['cobre']), box(-40, 130, 40, 46, Z0 + 18, Z0 + 22, M['ima_n'])], 'barramento_dc')
OUT += [inversor_base, cap, dc]

out = os.path.join(ROOT, '.cache', 'emotor-raw.glb')
os.makedirs(os.path.dirname(out), exist_ok=True)
export(OUT, out)
print('WROTE', out, os.path.getsize(out), 'bytes', len(OUT), 'nodes')
