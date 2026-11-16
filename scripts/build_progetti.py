"""Progetti del Programma triennale OO.PP. 2026-2028 con posizione, per la mappa del sito.
Uso: python3 -I scripts/build_progetti.py
Posizioni: elaborate da OpenDataSicilia dalle tavole PDF del Programma (non sono coordinate ufficiali).
Si disegnano solo geometrie collegate a un intervento; le altre (330 linee, 69 poligoni) restano fuori.
Nessuna posizione viene stimata qui."""
import ast, csv, json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = os.path.join(BASE, 'dati/progetti_geo')
T = json.load(open(os.path.join(BASE, 'data/geo/circoscrizioni.json')))['trasformazione']
items = {x['cod_int_amm']: x for x in json.load(open(os.path.join(BASE, 'dati/piano_triennale/interventi_2026_2028.json'), encoding='utf-8'))}
f = lambda v: 0.0 if v in (None, '', 'None') else float(v)
ok = lambda v: v not in (None, '', 'None')
def P(c): return round((c[0] - T['x0']) * T['scala'], 1), round((T['y1'] - c[1]) * T['scala'], 1)
def codici(p):
    return [x.strip() for x in str(p.get('cod_assegnato') or p.get('cod_int') or '').split(';') if x.strip()]
def ring(r): return 'M' + 'L'.join(f'{a},{b}' for a, b in map(P, r)) + 'Z'
def geo(x):
    v = x.get('geo'); v = ast.literal_eval(v) if isinstance(v, str) and ok(v) else v
    return v or []

prog = {}
def get(c):
    if c not in prog:
        x = items[c]; circ = sorted({g[0] for g in geo(x)})
        prog[c] = {'id': c, 'descrizione': ' '.join(x['descrizione_intervento'].split()), 'settore': x['settore_sottosettore'],
                   'importo_triennio_eur': round(f(x['importo']), 2), 'importo_complessivo_eur': round(f(x['importo_complessivo']), 2),
                   'cup': x['cup'] if ok(x['cup']) else None, 'cui': x['cui'] if ok(x.get('cui')) else None,
                   'circoscrizioni': circ, 'punti': [], 'linee': [], 'poligoni': []}
    return prog[c]

for ft in json.load(open(os.path.join(G, 'punti.geojson')))['features']:
    p = ft['properties']; c = codici(p)
    if len(c) != 1 or c[0] not in items: continue            # 42 punti «da_poligono» senza codice: non collegati
    x, y = P(ft['geometry']['coordinates'])
    get(c[0])['punti'].append([x, y, p['pos_da'] or p['origine'], int(p['precisione_m']) if p.get('precisione_m') is not None else None])
for nome, chiave in (('linee', 'linee'), ('poligoni', 'poligoni')):
    for ft in json.load(open(os.path.join(G, nome + '.geojson')))['features']:
        p = ft['properties']; c = codici(p)
        if not c or any(k not in items for k in c): continue    # geometrie non collegate a un intervento: non mostrate
        g = ft['geometry']
        if nome == 'linee':
            lines = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
            d = ''.join('M' + 'L'.join(f'{a},{b}' for a, b in map(P, ln)) for ln in lines)
        else:
            polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
            d = ''.join(ring(r) for poly in polys for r in poly)
        item = get(c[0]); item[chiave].append({'d': d, 'assegnazione': p.get('assegnazione'), 'codici': c if len(c) > 1 else None})

# collegamenti con altre fonti, solo dove il CUP o il CUI coincide
pnrr = {r['cup']: r for r in csv.DictReader(open(os.path.join(BASE, 'dati/pnrr_comune_palermo.csv'), encoding='utf-8'))}
oc = {}
csv.field_size_limit(10 ** 9)
for r in csv.DictReader(open(os.path.join(BASE, 'dati/opencoesione_palermo_20260831.csv'), encoding='utf-8'), delimiter=';'):
    if r['CUP'] and 'COMUNE DI PALERMO' in [y.strip().upper() for y in r['OC_DENOM_BENEFICIARIO'].split(':::')]:
        oc.setdefault(r['CUP'].upper(), []).append(r['OC_DESCRIZIONE_PROGRAMMA'].split(':::')[0])
cig = {}
for nome in ('anac_cig_palermo_2025.csv', 'anac_cig_palermo_2026.csv'):
    for r in csv.DictReader(open(os.path.join(BASE, 'dati', nome), encoding='utf-8'), delimiter=';'):
        if r['CUI_PROGRAMMA'].strip(): cig.setdefault(r['CUI_PROGRAMMA'].strip(), set()).add(r['cig'])
for c, x in prog.items():
    if x['cup'] and x['cup'] in pnrr: x['pnrr'] = {'stato': pnrr[x['cup']]['stato'] or None, 'importo_finanziato_eur': f(pnrr[x['cup']]['importo_finanziato_eur']), 'url': pnrr[x['cup']]['url']}
    if x['cup'] and x['cup'].upper() in oc: x['coesione'] = sorted(set(oc[x['cup'].upper()]))
    if x['cui'] and x['cui'] in cig: x['cig'] = sorted(cig[x['cui']])
lista = sorted(prog.values(), key=lambda x: -x['importo_triennio_eur'])
senza = [c for c in items if c not in prog]
out = {'fonte': 'Comune di Palermo, Programma triennale OO.PP. 2026-2028 (DCC 553/2026); posizioni elaborate da OpenDataSicilia dalle tavole PDF, con precisione dichiarata',
       'verificato': '2026-11-16',
       'precisione': {'pallino': 'punto letto sulla tavola, circa 3-10 m', 'etichetta': 'posizione dell\'etichetta sulla tavola, circa 25-40 m', 'toponimo': 'ricavata dal nome del luogo, circa 300 m', 'da_poligono': 'centro di un poligono'},
       'trasformazione': T, 'senza_posizione': len(senza), 'progetti': lista}
json.dump(out, open(os.path.join(BASE, 'data/geo/progetti.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
n = len(lista)
print(n, 'progetti con posizione;', len(senza), 'senza;', 'punti', sum(len(x['punti']) for x in lista), 'linee', sum(len(x['linee']) for x in lista), 'poligoni', sum(len(x['poligoni']) for x in lista))
print('collegati: pnrr', sum(1 for x in lista if 'pnrr' in x), 'coesione', sum(1 for x in lista if 'coesione' in x), 'cig', sum(1 for x in lista if 'cig' in x))
print('importo con posizione %.1f M€ su %.1f M€' % (sum(x['importo_triennio_eur'] for x in lista) / 1e6, sum(f(v['importo']) for v in items.values()) / 1e6), os.path.getsize(os.path.join(BASE, 'data/geo/progetti.json')) // 1024, 'KB')
