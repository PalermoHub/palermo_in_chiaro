"""Snapshot per la pagina Statistiche: struttura per età, istruzione, famiglie,
abitazioni, stranieri e lavoro delle 8 circoscrizioni (Censimento ISTAT 2021).

Uso: python3 -I scripts/snapshot_statistiche.py

Somma le sezioni di censimento come fa snapshot_profilo.py e si ferma se un
controllo non torna. Nessun valore mancante viene stimato.
"""
import csv, json, os, sys
from collections import defaultdict

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(BASE, 'dati/censimento_2021')
OUT = os.path.join(BASE, 'data/snapshot/statistiche.json')
ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']
VERIFICATO = '2026-11-17'

# I campi ISTAT usati, con il nome che prendono nell'output.
ETA_M = ['P30', 'P31', 'P32', 'P33', 'P34', 'P35', 'P36', 'P37', 'P38', 'P39', 'P40', 'P41', 'P42', 'P43', 'P44', 'P45']
ETA_F = ['P67', 'P68', 'P69', 'P70', 'P71', 'P72', 'P73', 'P74', 'P75', 'P76', 'P77', 'P78', 'P79', 'P80', 'P81', 'P82']
SCUOLA = ['P86', 'P87', 'P88', 'P89', 'P90']
FAMIGLIE = ['PF3', 'PF4', 'PF5', 'PF6', 'PF7', 'PF8']
ABITAZIONI = ['A2', 'A3', 'A8', 'E3']
STRANIERI = ['ST1', 'ST16', 'ST19', 'ST22', 'ST23', 'ST24']
LAVORO = ['P101', 'P102', 'P103', 'IT2', 'ST23', 'ST31']
CIT_KEYS = ['CIT_1_BGD', 'CIT_2_LKA', 'CIT_3_ROU', 'CIT_4_GHA', 'CIT_5_PHL',
            'CIT_6_MAR', 'CIT_7_TUN', 'CIT_8_CHN', 'CIT_9_MUS', 'CIT_10_NGA']
CIT_NOMI = ['Bangladesh', 'Sri Lanka', 'Romania', 'Ghana', 'Filippine',
            'Marocco', 'Tunisia', 'Cina', 'Maurizio', 'Nigeria']
# dict.fromkeys: un campo ripetuto verrebbe sommato due volte (P83 sta in due gruppi)
CAMPI = list(dict.fromkeys(['P1', 'P2', 'P3', 'P83', 'PF1'] + ETA_M + ETA_F + SCUOLA + FAMIGLIE + ABITAZIONI + STRANIERI + LAVORO + CIT_KEYS))
assert len(CAMPI) == len(set(CAMPI))

def num(v):
    return None if v in (None, '', 'None') else float(v)

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
        if v is None:
            mancanti[c][k] += 1
        else:
            somma[c][k] += v

area = {x['properties']['Circoscrizione']: float(x['properties']['Area']) / 1e6
        for x in json.load(open(os.path.join(D, 'geo_circoscrizioni.geojson')))['features']}

# ATTENZIONE: le classi d'età ISTAT arrivano a «>74»; la piramide nasce da 16 classi
# quinquennali, quindi le ultime due si mostrano separate (70-74 e 75 e più).
CLASSI_ETA = ['0-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39',
              '40-44', '45-49', '50-54', '55-59', '60-64', '65-69', '70-74', '75+']
CLASSI_SCUOLA = ['Nessun titolo', 'Licenza elementare', 'Licenza media', 'Diploma', 'Laurea o più']
CLASSI_FAMIGLIE = ['1', '2', '3', '4', '5', '6 o più']

def quota(parte, tutto):
    return round(100 * parte / tutto, 1) if tutto else None

def blocco_eta(s):
    m = [int(s[k]) for k in ETA_M]
    f = [int(s[k]) for k in ETA_F]
    return {'maschi': m, 'femmine': f, 'totale': [a + b for a, b in zip(m, f)]}

def blocco_scuola(s):
    c = [int(s[k]) for k in SCUOLA]
    return {'popolazione_9_piu': int(s['P83']), 'conteggi': c, 'quote': [quota(x, s['P83']) for x in c]}

def blocco_famiglie(s):
    c = [int(s[k]) for k in FAMIGLIE]
    tot = sum(c)
    componenti = sum((i + 1) * x for i, x in enumerate(c[:-1])) + 6 * c[-1]
    return {'totale': int(s['PF1']), 'conteggi': c, 'quote': [quota(x, tot) for x in c],
            'componenti_medi': round(componenti / tot, 2) if tot else None,
            'quota_single_pct': quota(c[0], tot)}

def blocco_abitazioni(s, residenti):
    a2, a3, a8 = s['A2'], s['A3'], s['A8']
    return {'totali': int(a8), 'occupate': int(a2), 'vuote': int(a3), 'edifici': int(s['E3']),
            'quota_vuote_pct': quota(a3, a8),
            'abitanti_per_abitazione_occupata': round(residenti / a2, 2) if a2 else None,
            'quota_occupate_pct': quota(a2, a8)}

def blocco_stranieri(s):
    return {'totale': int(s['ST1']), 'ue': int(s['ST16']), 'extraue': int(s['ST19']),
            'quota_pct': quota(s['ST1'], s['P1']),
            'eta': {'0-14': int(s['ST22']), '15-64': int(s['ST23']), '65+': int(s['ST24'])},
            'cittadinanze': {nome: int(s[k]) for k, nome in zip(CIT_KEYS, CIT_NOMI)}}

def blocco_lavoro(s):
    return {'occupati': int(s['P101']), 'pop_15_64': int(s['IT2'] + s['ST23']),
            'pop_15_64_m': int(sum(s[k] for k in ETA_M[3:13])),
            'pop_15_64_f': int(sum(s[k] for k in ETA_F[3:13])),
            'tasso_pct': quota(s['P101'], s['IT2'] + s['ST23']),
            'occupati_m': int(s['P102']), 'occupati_f': int(s['P103']),
            'tasso_m_pct': quota(s['P102'], sum(s[k] for k in ETA_M[3:13])),
            'tasso_f_pct': quota(s['P103'], sum(s[k] for k in ETA_F[3:13])),
            'occupati_stranieri': int(s['ST31']),
            'tasso_stranieri_pct': quota(s['ST31'], s['ST23'])}

tot = defaultdict(float)
for c in ROM:
    for k in CAMPI:
        tot[k] += somma[c][k]

valori = {}
for i, c in enumerate(ROM):
    s = somma[c]
    valori[str(i + 1)] = {
        'circoscrizione': c,
        'superficie_kmq': round(area[c], 2),
        'eta': blocco_eta(s),
        'istruzione': blocco_scuola(s),
        'famiglie': blocco_famiglie(s),
        'abitazioni': blocco_abitazioni(s, s['P1']),
        'stranieri': blocco_stranieri(s),
        'lavoro': blocco_lavoro(s),
    }

out = {
    'fonte': {'nome': 'ISTAT, Censimento permanente della popolazione e delle abitazioni 2021, indicatori per sezione di censimento',
              'ente': 'ISTAT', 'link': 'https://www.istat.it/notizia/basi-territoriali-e-variabili-censuarie/',
              'licenza': 'CC BY 4.0 (ISTAT, https://www.istat.it/dati/open-data/, verificata il 16/11/2026)',
              'confini': 'Circoscrizioni del Comune di Palermo; attribuzione delle sezioni nel file dati/censimento_2021/geo_sezioni_2021.geojson'},
    'periodo': 'Censimento 2021 (dati al 31/12/2021)',
    'verificato': VERIFICATO,
    'misura': 'Struttura per età e sesso, titolo di studio, famiglie, abitazioni, stranieri e occupazione per circoscrizione, sommando le sezioni di censimento.',
    'non_misura': [
        'Variazioni dopo il 2021: il Comune stima 628.693 residenti nel 2024 (Repertorio statistico 2024), senza dettaglio per circoscrizione.',
        'Il reddito: non è in questo dataset, quindi non c\'è un grafico sul reddito.',
        'Le cittadinanze elencate sono le prime dieci del file ISTAT: coprono circa l\'81% degli stranieri residenti, non tutti.',
        'Le quote di laureati e occupati usano le definizioni censuarie e non sono confrontabili con altre fonti.',
        'Una circoscrizione con valori insoliti è un segnale da approfondire, non la prova di un problema.',
    ],
    'sezioni_per_circoscrizione': {c: nsez[c] for c in ROM},
    'valori_mancanti_sezioni': {c: dict(mancanti[c]) for c in ROM if mancanti[c]},
    'circoscrizioni': ROM,
    'classi_eta': CLASSI_ETA,
    'classi_istruzione': CLASSI_SCUOLA,
    'classi_famiglie': CLASSI_FAMIGLIE,
    'cittadinanze': CIT_NOMI,
    'palermo': {
        'residenti': int(tot['P1']),
        'superficie_kmq': round(sum(area.values()), 2),
        'eta': blocco_eta(tot),
        'istruzione': blocco_scuola(tot),
        'famiglie': blocco_famiglie(tot),
        'abitazioni': blocco_abitazioni(tot, tot['P1']),
        'stranieri': blocco_stranieri(tot),
        'lavoro': blocco_lavoro(tot),
    },
    'valori': valori,
}

# controlli: se un totale non torna, lo snapshot non si scrive
assert round(tot['P1']) == 635439, tot['P1']
assert round(tot['P2'] + tot['P3']) == round(tot['P1'])
assert sum(round(tot[k]) for k in ETA_M) == round(tot['P2'])
assert sum(round(tot[k]) for k in ETA_F) == round(tot['P3'])
assert sum(round(tot[k]) for k in SCUOLA) == round(tot['P83'])
assert sum(round(tot[k]) for k in FAMIGLIE) == round(tot['PF1'])
assert round(tot['A2'] + tot['A3']) == round(tot['A8'])
assert round(tot['ST16'] + tot['ST19']) == round(tot['ST1'])
assert sum(round(tot[k]) for k in CIT_KEYS) <= round(tot['ST1'])
assert sum(nsez.values()) == len(righe) == 3079
assert sum(v['lavoro']['occupati'] for v in valori.values()) == out['palermo']['lavoro']['occupati']
assert round(sum(somma[c]['P1'] for c in ROM)) == out['palermo']['residenti']
for v in valori.values():
    for k in ['eta', 'istruzione', 'famiglie', 'abitazioni', 'stranieri', 'lavoro']:
        assert v[k] is not None

os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('ok', len(righe), 'sezioni;', int(tot['P1']), 'residenti ->', OUT, os.path.getsize(OUT) // 1024, 'KB')
for k, v in valori.items():
    p = v['circoscrizione']
    print(p.ljust(4), str(int(somma[p]['P1'])).rjust(7),
          'eta 0-14:', sum(v['eta']['totale'][:3]), '| 75+:', v['eta']['totale'][-1],
          '| laurea:', v['istruzione']['quote'][4], '% | vuote:', v['abitazioni']['quota_vuote_pct'],
          '% | stranieri:', v['stranieri']['quota_pct'], '% | occ.:', v['lavoro']['tasso_pct'], '%')
