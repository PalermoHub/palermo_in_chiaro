"""Converte i confini di circoscrizioni, quartieri e UPL (EPSG:32632) in tracciati SVG per il sito.
Uso: python3 -I scripts/build_geo.py

Tutti i livelli usano la stessa trasformazione (quella delle circoscrizioni): così i poligoni di
quartieri e UPL stanno esattamente sopra quelli delle circoscrizioni e sopra le posizioni dei progetti.
Scrive:
  data/geo/circoscrizioni.json  i 8 poligoni, con dentro la gerarchia quartieri -> UPL
  data/geo/quartieri.json       i 25 quartieri (si scaricano solo quando servono)
  data/geo/upl.json             le 55 UPL (idem)
"""
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CEN = os.path.join(BASE, 'dati/censimento_2021')

def livelli(nome_file):
    return json.load(open(os.path.join(CEN, nome_file)))['features']

circ = livelli('geo_circoscrizioni.geojson')
quart = livelli('geo_quartieri.geojson')
upl = livelli('geo_upl.geojson')

# la trasformazione resta quella delle circoscrizioni: gli altri livelli ci si appoggiano sopra
xs, ys = [], []
for f in circ:
    g = f['geometry']; polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    xs += [p[0] for poly in polys for ring in poly for p in ring]
    ys += [p[1] for poly in polys for ring in poly for p in ring]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
S = 1000 / (x1 - x0); W, H = 1000, round((y1 - y0) * S)
TRASFORMAZIONE = {'crs': 'EPSG:32632', 'x0': x0, 'y1': y1, 'scala': S}

def pt(p):
    return round((p[0] - x0) * S, 1), round((y1 - p[1]) * S, 1)

def baricentro(rings):
    """Baricentro pesato sull'area dei poligoni esterni, in coordinate SVG."""
    area_sum = cx = cy = 0
    for ring in rings:
        r = [pt(p) for p in ring]
        a = sx = sy = 0
        for i in range(len(r) - 1):
            cr = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]
            a += cr; sx += (r[i][0] + r[i + 1][0]) * cr; sy += (r[i][1] + r[i + 1][1]) * cr
        if a:
            area_sum += abs(a / 2); cx += (sx / (3 * a)) * abs(a / 2); cy += (sy / (3 * a)) * abs(a / 2)
    return (round(cx / area_sum, 1), round(cy / area_sum, 1)) if area_sum else (W / 2, H / 2)

def converti(features, chiave):
    """{nome: {d, cx, cy, ...proprieta'}} con area e baricentro."""
    out = {}
    for f in features:
        g = f['geometry']
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        parts = []
        for poly in polys:
            for ring in poly:
                q = [pt(p) for p in ring]; dedup = [q[0]]
                for p in q[1:]:
                    if p != dedup[-1]: dedup.append(p)
                parts.append('M' + 'L'.join(f'{a},{b}' for a, b in dedup) + 'Z')
        cx, cy = baricentro([poly[0] for poly in polys])
        p = f['properties']
        voce = {'d': ''.join(parts), 'cx': cx, 'cy': cy}
        voce['circ'] = p['Circoscrizione']
        if 'Quartiere' in p:
            voce['quartiere'] = p['Quartiere']
        out[p[chiave]] = voce
    return out

Q = converti(quart, 'Quartiere')
U = converti(upl, 'UPL')

# gerarchia a scalare circoscrizione -> quartiere -> UPL, presa dalle UPL (il livello piu' fine).
# Un quartiere puo' stare su due circoscrizioni (nell'insieme di confini Oreto-Stazione e' diviso tra II e III):
# contano le UPL, che dicono in quale circoscrizione cade ciascun pezzo.
circ_di_q = {}
for n, d in U.items():
    circ_di_q.setdefault(d['quartiere'], set()).add(d['circ'])
for n, d in Q.items():
    d['circ'] = sorted(circ_di_q.get(n, [d['circ']]))
gerarchia = {}
for c in sorted({d['circ'] for d in U.values()}):
    qs = sorted({d['quartiere'] for d in U.values() if d['circ'] == c})
    gerarchia[c] = {'quartieri': qs, 'upl': {
        q: sorted(n for n, d in U.items() if d['circ'] == c and d['quartiere'] == q) for q in qs}}

out = {'viewBox': [0, 0, W, H], 'trasformazione': TRASFORMAZIONE,
       'fonte': 'Confini delle unità amministrative e statistiche di Palermo: sezioni di censimento ISTAT 2011 aggregate in quartieri, UPL e circoscrizioni (dati/censimento_2021).',
       'circoscrizioni': {}}
for c, f in ((c, next(x for x in circ if x['properties']['Circoscrizione'] == c)) for c in gerarchia):
    g = f['geometry']; polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    parts = []
    for poly in polys:
        for ring in poly:
            q = [pt(p) for p in ring]; dedup = [q[0]]
            for p in q[1:]:
                if p != dedup[-1]: dedup.append(p)
            parts.append('M' + 'L'.join(f'{a},{b}' for a, b in dedup) + 'Z')
    cx, cy = baricentro([poly[0] for poly in polys])
    out['circoscrizioni'][c] = {'d': ''.join(parts), 'cx': cx, 'cy': cy,
                                'quartieri': gerarchia[c]['quartieri'], 'upl': gerarchia[c]['upl']}

def scrivi(nome, dati):
    p = os.path.join(BASE, 'data/geo', nome)
    json.dump(dati, open(p, 'w'), separators=(',', ':'))
    return os.path.getsize(p) // 1024

k = scrivi('circoscrizioni.json', out)
kq = scrivi('quartieri.json', {'viewBox': [0, 0, W, H], 'trasformazione': TRASFORMAZIONE,
                               'fonte': out['fonte'], 'quartieri': Q})
ku = scrivi('upl.json', {'viewBox': [0, 0, W, H], 'trasformazione': TRASFORMAZIONE,
                         'fonte': out['fonte'], 'upl': U})
print(W, H, '| circoscrizioni', k, 'KB | quartieri', len(Q), kq, 'KB | upl', len(U), ku, 'KB')
print({c: (v['cx'], v['cy']) for c, v in out['circoscrizioni'].items()})
