"""Converte i confini delle circoscrizioni (EPSG:32632) in tracciati SVG per il sito.
Uso: python3 -I scripts/build_geo.py"""
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(os.path.join(BASE, 'dati/censimento_2021/geo_circoscrizioni.geojson')))
rings = []
for f in d['features']:
    g = f['geometry']; polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    rings.append((f['properties']['Circoscrizione'], polys))
xs = [p[0] for _, polys in rings for poly in polys for ring in poly for p in ring]
ys = [p[1] for _, polys in rings for poly in polys for ring in poly for p in ring]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
S = 1000 / (x1 - x0); W, H = 1000, round((y1 - y0) * S)
def pt(p): return (round((p[0] - x0) * S, 1), round((y1 - p[1]) * S, 1))
out = {'viewBox': [0, 0, W, H], 'trasformazione': {'crs': 'EPSG:32632', 'x0': x0, 'y1': y1, 'scala': S}, 'circoscrizioni': {}}
for c, polys in rings:
    parts, area_sum, cx, cy = [], 0, 0, 0
    for poly in polys:
        for ring in poly:
            q = [pt(p) for p in ring]; dedup = [q[0]]
            for p in q[1:]:
                if p != dedup[-1]: dedup.append(p)
            parts.append('M' + 'L'.join(f'{a},{b}' for a, b in dedup) + 'Z')
        # baricentro del poligono esterno (formula dell'area con segno)
        r = [pt(p) for p in poly[0]]; a = 0; sx = sy = 0
        for i in range(len(r) - 1):
            cr = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; a += cr; sx += (r[i][0] + r[i + 1][0]) * cr; sy += (r[i][1] + r[i + 1][1]) * cr
        if a: area_sum += abs(a / 2); cx += (sx / (3 * a)) * abs(a / 2); cy += (sy / (3 * a)) * abs(a / 2)
    out['circoscrizioni'][c] = {'d': ''.join(parts), 'cx': round(cx / area_sum, 1), 'cy': round(cy / area_sum, 1)}
q = json.load(open(os.path.join(BASE, 'dati/censimento_2021/geo_quartieri.geojson')))['features']
for c in out['circoscrizioni']:
    out['circoscrizioni'][c]['quartieri'] = sorted({f['properties']['Quartiere'] for f in q if f['properties']['Circoscrizione'] == c})
json.dump(out, open(os.path.join(BASE, 'data/geo/circoscrizioni.json'), 'w'), separators=(',', ':'))
print(W, H, {k: (v['cx'], v['cy']) for k, v in out['circoscrizioni'].items()}, os.path.getsize(os.path.join(BASE, 'data/geo/circoscrizioni.json')) // 1024, 'KB')
