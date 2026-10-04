"""Build public/models/powertrain.glb: the Geely EX5 EM-i powertrain for section 9d (npm run model:powertrain).

Layout from lib/powertrain-layout.json (Blender: X forward, Y left, Z up). A transverse 1.5 engine, the E-DHT with the
generator P1 on the engine axis, a clutch, the traction motor P3 and a single-ratio gear train to the differential;
the LFP pack under the floor (lid off, modules and cells visible), the 60 L tank, the onboard charger, the charge port,
orange high-voltage cables, the exhaust, half-shafts and wheels.

Rotating nodes (axis along Blender Y = three.js −Z, origin on the axis, rotation left at identity):
  roda_fe, roda_fd, roda_te, roda_td, semieixo_e, semieixo_d, diferencial,
  pinhao_motor, embreagem, motor_polia, p1_rotor, p3_rotor, intermediaria
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from bkit import box, boolean, circle, cut_all, cyl, cyl_between, export, gear_x, join, log, mat, prism_x, reset, set_mat, smooth  # noqa: E402

import bpy  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
L = json.load(open(os.path.join(ROOT, 'lib', 'powertrain-layout.json')))
reset()

M = {
    'aluminio': mat('aluminio', (0.72, 0.72, 0.70), 0.6, 0.45),
    'aco': mat('aco', (0.55, 0.56, 0.58), 0.9, 0.3),
    'laminacao': mat('laminacao', (0.30, 0.32, 0.36), 0.7, 0.45),
    'cobre': mat('cobre', (0.80, 0.45, 0.25), 1.0, 0.3),
    'ima_n': mat('ima_n', (0.70, 0.18, 0.15), 0.3, 0.4),
    'ima_s': mat('ima_s', (0.18, 0.35, 0.65), 0.3, 0.4),
    'borracha': mat('borracha', (0.06, 0.06, 0.06), 0.0, 0.85),
    'roda': mat('roda', (0.65, 0.66, 0.68), 0.8, 0.35),
    'celula': mat('celula', (0.25, 0.32, 0.42), 0.2, 0.5),
    'plastico': mat('plastico', (0.10, 0.10, 0.11), 0.0, 0.6),
    'laranja': mat('laranja', (0.95, 0.45, 0.08), 0.0, 0.5),
    'ferro': mat('ferro', (0.32, 0.30, 0.28), 0.7, 0.6),
    'vidro': mat('vidro', (0.80, 0.84, 0.88), 0.0, 0.1),
    'chassi': mat('chassi', (0.45, 0.46, 0.48), 0.5, 0.5),
}
OUT = []
WB, TR, R = L['wheelbase'], L['track'], L['wheelR']
XF, XR = WB / 2, -WB / 2
YW = TR / 2


def along_y(o):
    """Turn an object built along X into one along Y (applied), keeping its origin."""
    o.rotation_euler = (0, 0, math.pi / 2)
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return o


def gear_y(r, teeth, width, centre, name, m):
    g = gear_x(r, teeth, max(1.6, r * 0.06), -width / 2, width / 2, name, m)
    along_y(g)
    g.location = centre
    return g


def place_origin(o, p):
    bpy.context.scene.cursor.location = p
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.context.scene.cursor.location = (0, 0, 0)


# ---- wheels: tyre, rim with five spokes, brake disc ---------------------------------------------------------
def wheel(name, x, y):
    side = 1 if y > 0 else -1
    tyre = cyl(R, L['tyreW'], (0, 0, 0), 'X', 72, M['borracha'])
    boolean(tyre, cyl(R - 75, L['tyreW'] + 10, (0, 0, 0), 'X', 72))
    rim = cyl(R - 74, L['tyreW'] - 30, (0, 0, 0), 'X', 72, M['roda'])
    boolean(rim, cyl(R - 92, L['tyreW'] + 10, (side * 10, 0, 0), 'X', 72))
    spokes = []
    for k in range(5):
        a = 2 * math.pi * k / 5
        c, sn = math.cos(a), math.sin(a)

        def pt(r, w):
            # radial distance r along the spoke direction, offset w across it
            return (c * r - sn * w, sn * r + c * w)

        spokes.append(prism_x([pt(30, -14), pt(R - 90, -20), pt(R - 90, 20), pt(30, 14)], -8, 22, 'spoke', M['roda']))
    for s in spokes:
        s.location.x = side * 50
    hub = cyl(55, 50, (side * 50, 0, 0), 'X', 32, M['roda'])
    disc = cyl(160, 26, (-side * 40, 0, 0), 'X', 64, M['aco'])
    boolean(disc, cyl(80, 40, (-side * 40, 0, 0), 'X', 32))
    w = join([tyre, rim, hub, disc] + spokes, name)
    along_y(w)
    w.location = (x, y, R)
    smooth(w, 40)
    OUT.append(w)


for name, x, y in (('roda_fe', XF, YW), ('roda_fd', XF, -YW), ('roda_te', XR, YW), ('roda_td', XR, -YW)):
    wheel(name, x, y)
log('wheels')

# ---- floor, sills, subframes (static; drawn as a light chassis) ----------------------------------------------
chassis = []  # no floor pan: the pack under it stays visible
for s in (-1, 1):
    chassis.append(box(-1700, 1050, s * 760 - 30, s * 760 + 30, 240, 330, M['chassi'], bevel=4))
    chassis.append(box(950, 1750, s * 420 - 30, s * 420 + 30, 260, 320, M['chassi'], bevel=4))
    chassis.append(box(-1950, -1100, s * 520 - 30, s * 520 + 30, 280, 340, M['chassi'], bevel=4))
chassi = join(chassis, 'chassi')
OUT.append(chassi)

# ---- battery pack: open case, 8 modules of 14 prismatic LFP cells, busbars; the lid is a separate ghost --------
case = box(-950, 450, -640, 640, 150, 292, M['aluminio'], bevel=6)
boolean(case, box(-940, 440, -630, 630, 160, 320))
cells, bars = [], []
for i in range(4):
    for j in range(2):
        x0 = -930 + i * 340
        y0 = -615 + j * 625
        cells.append(box(x0, x0 + 320, y0, y0 + 605, 162, 168, M['aco']))
        for k in range(14):
            cx = x0 + 8 + k * 22.2
            cells.append(box(cx, cx + 20, y0 + 10, y0 + 595, 168, 268, M['celula']))
        bars.append(box(x0 + 4, x0 + 316, y0 + 40, y0 + 70, 268, 272, M['cobre']))
        bars.append(box(x0 + 4, x0 + 316, y0 + 535, y0 + 565, 268, 272, M['cobre']))
bateria = join([case] + cells + bars, 'bateria')
OUT.append(bateria)
lid = box(-950, 450, -640, 640, 292, 298, M['vidro'])
lid.name = 'tampa_bateria'
OUT.append(lid)
log('battery')

# ---- fuel tank, exhaust ------------------------------------------------------------------------------------
tank = box(-1310, -980, -560, 560, 200, 430, M['plastico'], bevel=40)
tank.name = 'tanque'
OUT.append(tank)
ex = []
pts = [(1110, -260, 470), (1050, -260, 250), (700, -330, 220), (-900, -700, 220), (-1550, -700, 230)]
for a, b in zip(pts, pts[1:]):
    ex.append(cyl_between(a, b, 26, 20, M['ferro']))
ex.append(box(-1850, -1550, -800, -560, 170, 300, M['ferro'], bevel=30))
ex.append(cyl_between((-1850, -620, 210), (-2050, -620, 210), 30, 20, M['aco']))
ex.append(box(250, 600, -400, -260, 190, 280, M['ferro'], bevel=20))  # catalytic converter
escape = join(ex, 'escape')
OUT.append(escape)

# ---- 1.5 engine, transverse (crank along Y) -----------------------------------------------------------------
ex_, ez = L['engineAxis']
eng = [box(ex_ - 130, ex_ + 130, -410, 40, ez - 120, ez + 250, M['aluminio'], bevel=8)]
eng.append(box(ex_ - 120, ex_ + 120, -400, 30, ez + 250, ez + 350, M['aluminio'], bevel=6))
eng.append(box(ex_ - 100, ex_ + 100, -390, 20, ez + 350, ez + 400, M['plastico'], bevel=20))
eng.append(box(ex_ - 120, ex_ + 120, -400, 30, ez - 200, ez - 120, M['aluminio'], bevel=10))  # oil pan
for k in range(4):
    yk = -330 + k * 100
    eng.append(cyl_between((ex_ + 130, yk, ez + 230), (ex_ + 260, yk, ez + 280), 24, 20, M['aluminio']))  # intake runners
    eng.append(cyl_between((ex_, yk, ez + 400), (ex_, yk, ez + 440), 14, 16, M['plastico']))  # coils
eng.append(box(ex_ + 240, ex_ + 330, -380, 0, ez + 230, ez + 330, M['aluminio'], bevel=20))  # plenum
motor_bloco = join(eng, 'motor_bloco')
smooth(motor_bloco, 30)
OUT.append(motor_bloco)
pulley = cyl(75, 24, (ex_, -425, ez - 40), 'Y', 48, M['aco'])
mark = box(ex_ - 4, ex_ + 4, -438, -412, ez - 40 + 50, ez - 40 + 78, M['laranja'])
motor_polia = join([pulley, mark], 'motor_polia')
place_origin(motor_polia, (ex_, -425, ez - 40))
OUT.append(motor_polia)
log('engine')

# ---- E-DHT: ghost housing; P1 on the engine axis, clutch, engine pinion; P3 and its idler; differential --------
housing = box(980, 1480, 40, 470, 280, 640, M['vidro'], bevel=30)
housing.name = 'edht_carcaca'
OUT.append(housing)


def machine(prefix, axis_xz, y0, y1, r):
    """Stator (static, a quarter cut away) and rotor with magnet stripes (rotating), axis along Y."""
    ax, az = axis_xz
    stator = cyl(r, y1 - y0, (ax, (y0 + y1) / 2, az), 'Y', 64, M['laminacao'])
    boolean(stator, cyl(r * 0.66, y1 - y0 + 4, (ax, (y0 + y1) / 2, az), 'Y', 64))
    boolean(stator, box(ax, ax + r + 5, y0 - 5, y1 + 5, az, az + r + 5))
    coils = cyl(r * 0.92, y1 - y0 + 30, (ax, (y0 + y1) / 2, az), 'Y', 64, M['cobre'])
    boolean(coils, cyl(r * 0.7, y1 - y0 + 40, (ax, (y0 + y1) / 2, az), 'Y', 64))
    boolean(coils, cyl(r * 0.95, y1 - y0 - 2, (ax, (y0 + y1) / 2, az), 'Y', 64))
    boolean(coils, box(ax, ax + r + 5, y0 - 30, y1 + 30, az, az + r + 5))
    st = join([stator, coils], f'{prefix}_estator')
    rotor_core = cyl(r * 0.64, y1 - y0, (ax, (y0 + y1) / 2, az), 'Y', 64, M['laminacao'])
    stripes = []
    for k in range(8):
        a = 2 * math.pi * k / 8
        stripes.append(cyl_between((ax + math.cos(a) * r * 0.6, y0 + 4, az + math.sin(a) * r * 0.6), (ax + math.cos(a) * r * 0.6, y1 - 4, az + math.sin(a) * r * 0.6),
                                   r * 0.08, 12, M['ima_n'] if k % 2 == 0 else M['ima_s']))
    shaft = cyl(18, y1 - y0 + 120, (ax, (y0 + y1) / 2 + 40, az), 'Y', 24, M['aco'])
    rot = join([rotor_core, shaft] + stripes, f'{prefix}_rotor')
    place_origin(rot, (ax, (y0 + y1) / 2, az))
    return st, rot


p1_st, p1_rot = machine('p1', L['engineAxis'], 70, 210, 112)
p3_st, p3_rot = machine('p3', L['p3Axis'], 250, 430, 122)
OUT += [p1_st, p1_rot, p3_st, p3_rot]

ex_, ez = L['engineAxis']
clutch = join([cyl(95, 14, (ex_, 232, ez), 'Y', 64, M['aco']), cyl(80, 6, (ex_, 242, ez), 'Y', 64, M['laranja'])], 'embreagem')
place_origin(clutch, (ex_, 237, ez))
OUT.append(clutch)
pinion = join([gear_y(L['pinionR'], 11, 34, (ex_, 300, ez), 'g', M['aco']), cyl(16, 70, (ex_, 270, ez), 'Y', 16, M['aco'])], 'pinhao_motor')
place_origin(pinion, (ex_, 300, ez))
OUT.append(pinion)

dx, dz = L['diffAxis']
ring = gear_y(L['ringR'], 36, 34, (dx, 300, dz), 'coroa', M['aco'])
diff_case = cyl(70, 110, (dx, 300, dz), 'Y', 48, M['aluminio'])
diferencial = join([ring, diff_case], 'diferencial')
place_origin(diferencial, (dx, 300, dz))
OUT.append(diferencial)

ix, iz = L['idlerAxis']
p3x, p3z = L['p3Axis']
p3_pin = gear_y(L['p3PinionR'], 10, 30, (p3x, 445, p3z), 'g', M['aco'])
p3_rot = join([p3_rot, p3_pin], 'p3_rotor')
place_origin(p3_rot, (p3x, 340, p3z))
OUT[OUT.index(next(o for o in OUT if o.name == 'p3_rotor'))] = p3_rot
idler = join([gear_y(L['idlerBigR'], 42, 28, (ix, 445, iz), 'g', M['aco']), gear_y(L['idlerSmallR'], 13, 34, (ix, 300, iz), 'g', M['aco']),
              cyl(16, 170, (ix, 372, iz), 'Y', 16, M['aco'])], 'intermediaria')
place_origin(idler, (ix, 372, iz))
OUT.append(idler)

# Half-shafts with CV joints, from the differential to the front wheels.
for name, y_end in (('semieixo_e', YW - 90), ('semieixo_d', -YW + 90)):
    y0 = 300 + (60 if y_end > 0 else -60)
    shaft = cyl_between((dx, y0, dz), (dx, y_end, dz), 16, 16, M['aco'])
    j1 = cyl(42, 70, (dx, y0 + (20 if y_end > 0 else -20), dz), 'Y', 24, M['borracha'])
    j2 = cyl(48, 80, (dx, y_end - (40 if y_end > 0 else -40), dz), 'Y', 24, M['borracha'])
    s = join([shaft, j1, j2], name)
    place_origin(s, (dx, 0, dz))
    OUT.append(s)
log('edht')

# ---- charging: port, onboard charger, high-voltage cables (orange) --------------------------------------------
P = L['points']
port = join([box(P['port'][0] - 60, P['port'][0] + 60, P['port'][1] - 30, P['port'][1] + 20, P['port'][2] - 70, P['port'][2] + 70, M['plastico'], bevel=8),
             cyl(30, 12, (P['port'][0] - 25, P['port'][1] + 22, P['port'][2] + 25), 'Y', 24, M['laranja']),
             cyl(22, 12, (P['port'][0] + 25, P['port'][1] + 22, P['port'][2] - 25), 'Y', 24, M['laranja'])], 'tomada')
OUT.append(port)
obc = box(P['obc'][0] - 110, P['obc'][0] + 110, P['obc'][1] - 140, P['obc'][1] + 140, P['obc'][2] - 50, P['obc'][2] + 50, M['aluminio'], bevel=10)
for k in range(8):
    boolean(obc, box(P['obc'][0] - 100 + k * 26, P['obc'][0] - 92 + k * 26, P['obc'][1] - 150, P['obc'][1] + 150, P['obc'][2] + 40, P['obc'][2] + 60))
obc.name = 'carregador'
OUT.append(obc)
cables = []
for path in ([P['batteryFront'], (700, 300, 300), (980, 320, 360)],
             [(-950, 400, 250), (-1000, 430, 300), P['obc']],
             [P['obc'], (-1300, 650, 500), (-1550, 820, 720), P['port']]):
    for a, b in zip(path, path[1:]):
        cables.append(cyl_between(a, b, 13, 12, M['laranja']))
cabos = join(cables, 'cabos_at')
OUT.append(cabos)
log('charging')

out = os.path.join(ROOT, '.cache', 'powertrain-raw.glb')
os.makedirs(os.path.dirname(out), exist_ok=True)
export(OUT, out)
print('WROTE', out, os.path.getsize(out), 'bytes', len(OUT), 'nodes')
