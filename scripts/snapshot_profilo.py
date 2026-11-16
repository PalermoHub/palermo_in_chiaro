"""Snapshot profilo demografico delle 8 circoscrizioni di Palermo (Censimento ISTAT 2021).
Uso: python3 -I scripts/snapshot_profilo.py
Somma i valori delle sezioni di censimento; si ferma se un controllo fallisce.
Un valore mancante non viene stimato."""
import csv, json, os, sys
from collections import defaultdict

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(BASE, 'dati/censimento_2021')
OUT = os.path.join(BASE, 'data/snapshot/profilo_circoscrizioni.json')
ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']
CAMPI = ['P1', 'P2', 'P3', 'P14', 'P15', 'P16', 'P27', 'P28', 'P29', 'P30', 'P31', 'P32', 'P44', 'P45', 'P67', 'P68', 'P69',
         'P80', 'P81', 'P82', 'P83', 'P90', 'P101', 'IT2', 'ST1', 'ST23', 'PF1', 'A2', 'A3', 'A8', 'E3']

def num(v):
    return None if v in (None, '', 'None') else float(v)

# indicatori dal CSV ufficiale, con la circoscrizione presa dal file geografico
geo = {str(x['properties']['SEZ21_ID']): x['properties']['Circoscrizione']
       for x in json.load(open(os.path.join(D, 'geo_sezioni_2021.geojson')))['features']}
somma = {c: defaultdict(float) for c in ROM}
mancanti = {c: defaultdict(int) for c in ROM}
nsez = defaultdict(int)
with open(os.path.join(D, 'Palermo_indicatori_2021_sezioni.csv'), encoding='utf-8-sig', newline='') as f:
    righe = list(csv.DictReader(f))
for r in righe:
    c = geo.get(r['SEZ21_ID'])
    if c not in somma:
        sys.exit('sezione senza circoscrizione: ' + r['SEZ21_ID'])
    nsez[c] += 1
    for k in CAMPI:
        v = num(r.get(k))
        if v is None: mancanti[c][k] += 1
        else: somma[c][k] += v

area = {x['properties']['Circoscrizione']: float(x['properties']['Area']) / 1e6
        for x in json.load(open(os.path.join(D, 'geo_circoscrizioni.geojson')))['features']}

def blocco(s, a):
    p = s['P1']
    f64 = s['IT2'] + s['ST23']
    return {
        'residenti': int(p), 'maschi': int(s['P2']), 'femmine': int(s['P3']),
        'eta_0_14': int(s['P14'] + s['P15'] + s['P16']),
        'eta_65_piu': int(s['P27'] + s['P28'] + s['P29']),
        'eta_15_64': int(f64),
        'stranieri': int(s['ST1']),
        'famiglie': int(s['PF1']),
        'abitazioni_totali': int(s['A8']), 'abitazioni_occupate_da_residenti': int(s['A2']),
        'abitazioni_vuote_o_non_residenti': int(s['A3']),
        'laureati_9_piu': int(s['P90']), 'popolazione_9_piu': int(s['P83']),
        'occupati_15_64': int(s['P101']),
        'superficie_kmq': round(a, 2),
        'densita_ab_kmq': round(p / a, 0) if a else None,
        'quota_0_14_pct': round(100 * (s['P14'] + s['P15'] + s['P16']) / p, 1),
        'quota_65_piu_pct': round(100 * (s['P27'] + s['P28'] + s['P29']) / p, 1),
        'indice_vecchiaia': round(100 * (s['P27'] + s['P28'] + s['P29']) / (s['P14'] + s['P15'] + s['P16']), 1),
        'quota_stranieri_pct': round(100 * s['ST1'] / p, 1),
        'quota_laureati_9_piu_pct': round(100 * s['P90'] / s['P83'], 1),
        'tasso_occupazione_15_64_pct': round(100 * s['P101'] / f64, 1),
        'quota_abitazioni_vuote_pct': round(100 * s['A3'] / s['A8'], 1),
    }

tot = defaultdict(float)
for c in ROM:
    for k in CAMPI: tot[k] += somma[c][k]
out = {
    'fonte': {'nome': 'ISTAT, Censimento permanente della popolazione e delle abitazioni 2021, indicatori per sezione di censimento',
              'ente': 'ISTAT', 'link': 'https://www.istat.it/notizia/basi-territoriali-e-variabili-censuarie/',
              'licenza': 'CC BY 4.0 (ISTAT, https://www.istat.it/dati/open-data/, verificata il 16/11/2026)',
              'confini': 'Circoscrizioni, quartieri e UPL del Comune di Palermo, attribuzione delle sezioni nel file dati/censimento_2021/geo_sezioni_2021.geojson'},
    'periodo': 'Censimento 2021 (dati al 31/12/2021)',
    'verificato': '2026-11-16',
    'misura': 'Residenti, età, stranieri, famiglie, abitazioni, titolo di studio e occupazione per circoscrizione, sommando le sezioni di censimento.',
    'non_misura': ['Variazioni dopo il 2021: il Comune stima 628.693 residenti nel 2024 (Repertorio statistico 2024), ma senza dettaglio per circoscrizione.',
                   'Il reddito: non esiste per circoscrizione in questo dataset.',
                   'Le quote di laureati e occupati usano le definizioni censuarie e non sono confrontabili con altre fonti.',
                   'Una circoscrizione con valori insoliti è un segnale da approfondire, non la prova di un problema.'],
    'sezioni_per_circoscrizione': {c: nsez[c] for c in ROM},
    'valori_mancanti_sezioni': {c: dict(mancanti[c]) for c in ROM if mancanti[c]},
    'valori': {str(i + 1): dict(blocco(somma[c], area[c]), circoscrizione=c) for i, c in enumerate(ROM)},
    'totale_palermo': blocco(tot, sum(area.values())),
}
# controlli
assert int(tot['P1']) == 635439, tot['P1']
assert int(tot['P2'] + tot['P3']) == int(tot['P1'])
assert sum(len(v) for v in [nsez]) and sum(nsez.values()) == len(righe)
assert sum(v['residenti'] for v in out['valori'].values()) == out['totale_palermo']['residenti']
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('ok', len(righe), 'sezioni;', int(tot['P1']), 'residenti ->', OUT)
for k, v in out['valori'].items():
    print(v['circoscrizione'].ljust(5), str(v['residenti']).rjust(7), str(v['densita_ab_kmq']).rjust(7), v['quota_65_piu_pct'], v['indice_vecchiaia'], v['quota_stranieri_pct'], v['tasso_occupazione_15_64_pct'])
