"""sim/wrestler.xml + sim/meshes/*.stl -> assets/robot.json + assets/robot.bin for the web page.
Per link (base, L1..L5, R1..R5): int16 positions (mm*100, CAD frame) + uint16 triangle indices. Run: python tools/export_model.py"""
import re, json, numpy as np, trimesh, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
xml = open(f'{root}/sim/wrestler.xml').read().split('<worldbody>')[1]
ID = {'base': 'base', **{f'{s}_{n}': f'{s}{i+1}' for s in 'LR' for i, n in enumerate(['yaw', 'thigh', 'shin', 'ankle', 'foot'])}}
links, cur = {}, None
for line in xml.split('\n'):
    b = re.match(r'<body name="(\w+)"', line)
    if b: cur = ID[b.group(1)]; links[cur] = {'parts': [], 'rgb': None}
    g = re.search(r'mesh="(p\d+)".*rgba="([^"]*)"', line)
    if g and cur: links[cur]['parts'].append(g.group(1)); links[cur]['rgb'] = [float(v) for v in g.group(2).split()[:3]]
buf, meta = bytearray(), []
for lid, L in links.items():
    V, F, n = [], [], 0
    for p in L['parts']:
        m = trimesh.load(f'{root}/sim/meshes/{p}.stl'); V.append(m.vertices); F.append(m.faces + n); n += len(m.vertices)
    q = np.round(np.vstack(V) * 100).astype(np.int16)
    u, inv = np.unique(q, axis=0, return_inverse=True)
    f = inv.reshape(-1)[np.vstack(F)]
    f = f[(f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 0] != f[:, 2])]
    assert len(u) < 65536, lid
    po = len(buf); buf += u.astype('<i2').tobytes(); buf += b'\0' * (-len(buf) % 4)
    io = len(buf); buf += f.astype('<u2').tobytes(); buf += b'\0' * (-len(buf) % 4)
    meta.append({'id': lid, 'rgb': L['rgb'], 'nv': len(u), 'nt': len(f), 'p': po, 'i': io})
json.dump({'unit': 'mm*100', 'links': meta}, open(f'{root}/assets/robot.json', 'w'))
open(f'{root}/assets/robot.bin', 'wb').write(buf)
print(len(buf) // 1024, 'KB', sum(m['nt'] for m in meta), 'triangles', [(m['id'], m['nt']) for m in meta])
