"""assets/robot.* (STEP-derived meshes) -> assets/logo.svg: the crouched robot's front silhouette on a navy tile.
Same joint maths as the web page (product of exponentials). Run: python tools/make_logo.py  (needs numpy, shapely)"""
import json, os, numpy as np, shapely
from shapely.geometry import Polygon
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
meta = json.load(open(f'{root}/assets/robot.json')); buf = open(f'{root}/assets/robot.bin', 'rb').read()
M = {}
for l in meta['links']:
    v = np.frombuffer(buf, '<i2', l['nv'] * 3, l['p']).reshape(-1, 3) / 100.0
    f = np.frombuffer(buf, '<u2', l['nt'] * 3, l['i']).reshape(-1, 3)
    M[l['id']] = (v, f)
# joint origins/axes from the page (neutral CAD frame, mm)
oL = [(-46.585, -4.859, 0.0), (-36.035, -4.859, -14.213), (-36.035, -6.073, -54.547), (-55.285, -5.407, -109.543), (-40.785, -9.968, -131.61)]
oR = [(-36.17 - o[0], o[1], o[2]) for o in oL]
AX = [(0, 0, 1), (1, 0, 0), (1, 0, 0), (1, 0, 0), (0, 1, 0)]
def rot(ax, q):
    x, y, z = ax; c, s = np.cos(q), np.sin(q); C = 1 - c
    return np.array([[c + x*x*C, x*y*C - z*s, x*z*C + y*s], [y*x*C + z*s, c + y*y*C, y*z*C - x*s], [z*x*C - y*s, z*y*C + x*s, c + z*z*C]])
def pose(org, ang):                      # returns the 4x4 for each link 1..5
    A = np.eye(4); out = []
    for o, ax, q in zip(org, AX, ang):
        J = np.eye(4); J[:3, :3] = rot(ax, q); J[:3, 3] = np.array(o) - rot(ax, q) @ np.array(o); A = A @ J; out.append(A.copy())
    return out
sq = np.radians([0, -26.513, 45.523, -19.010, 0])          # 8 mm squat, same angles the page's IK gives
V = {'base': M['base'][0].copy()}
for side, org in (('L', oL), ('R', oR)):
    for i, T in enumerate(pose(org, sq)):
        v = M[f'{side}{i+1}'][0]; V[f'{side}{i+1}'] = v @ T[:3, :3].T + T[:3, 3]
shift = -145.5 - V['L5'][:, 2].min(); tris = []
for k, (v0, f) in M.items():
    v = V[k] + [0, 0, shift]; p = np.c_[v[:, 0], v[:, 2]]  # front view (looking along +Y), +X to the right
    t = p[f]; a, b = t[:, 1] - t[:, 0], t[:, 2] - t[:, 0]; area = np.abs(a[:, 0] * b[:, 1] - a[:, 1] * b[:, 0]) / 2; tris.append(t[area > 1e-4])
t = np.concatenate(tris); t = np.concatenate([t, t[:, :1]], axis=1)
sil = shapely.union_all(shapely.polygons(t), grid_size=0.02)
sil = sil.buffer(0.9, join_style=1).buffer(-0.9, join_style=1).simplify(0.18)   # close pin-holes, then thin the path
if sil.geom_type != 'Polygon': sil = max(sil.geoms, key=lambda g: g.area)
sil = Polygon(sil.exterior)                                                    # solid mark
x0, y0, x1, y1 = sil.bounds; S = min(46 / (y1 - y0), 48 / (x1 - x0)); cx = 32 - S * (x0 + x1) / 2; fy = 8 + 46      # fit 46 px tall, feet at y=54
pt = lambda x, y: f'{cx + S * x:.1f} {fy - S * (y - y0):.1f}'
d = 'M' + ' L'.join(pt(x, y) for x, y in list(sil.exterior.coords)[:-1]) + 'Z'
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Microwrestler">
<rect width="64" height="64" rx="14" fill="#14213D"/>
<rect x="9" y="55" width="46" height="3.4" rx="1.7" fill="#A8782F"/>
<path d="{d}" fill="#FFB547" stroke="#FFB547" stroke-width=".3" stroke-linejoin="round"/>
</svg>
'''
open(f'{root}/assets/logo.svg', 'w').write(svg); print(len(svg), 'bytes', sil.bounds)
