"""Snapshot opere pubbliche: Programma triennale OO.PP. 2026-2028 del Comune di Palermo, per circoscrizione.
Uso: python3 -I scripts/snapshot_opere.py
Regole: un intervento con una sola circoscrizione va a quella; con più circoscrizioni resta in «più_circoscrizioni»
(non si divide l'importo); senza localizzazione in «non_localizzato». Nessuna stima. Si ferma se un controllo fallisce."""
import ast, json, os
from collections import defaultdict

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, 'dati/piano_triennale/interventi_2026_2028.json')
PROF = os.path.join(BASE, 'data/snapshot/profilo_circoscrizioni.json')
OUT = os.path.join(BASE, 'data/snapshot/opere_circoscrizioni.json')
ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

def f(v):
    return 0.0 if v in (None, '', 'None') else float(v)

def geo(x):
    v = x.get('geo')
    if isinstance(v, str):
        v = ast.literal_eval(v) if v not in ('', 'None') else None
    return v or []

def cup_ok(x):
    return x.get('cup') not in (None, '', 'None')

items = json.load(open(SRC, encoding='utf-8'))
gruppi = {c: [] for c in ROM}; gruppi['piu_circoscrizioni'] = []; gruppi['non_localizzato'] = []
for x in items:
    circ = sorted({g[0] for g in geo(x)})
    if not circ: gruppi['non_localizzato'].append(x)
    elif len(circ) == 1: gruppi[circ[0]].append(x)
    else: gruppi['piu_circoscrizioni'].append(x)

def blocco(lst):
    sett = defaultdict(lambda: [0, 0.0])
    for x in lst:
        s = sett[x['settore_sottosettore']]; s[0] += 1; s[1] += f(x['importo'])
    top = sorted(sett.items(), key=lambda kv: -kv[1][1])[:5]
    return {
        'interventi': len(lst),
        'importo_triennio_eur': round(sum(f(x['importo']) for x in lst), 2),
        'importo_2026_eur': round(sum(f(x['costo_1_anno']) for x in lst), 2),
        'importo_2027_eur': round(sum(f(x['costo_2_anno']) for x in lst), 2),
        'importo_2028_eur': round(sum(f(x['costo_3_anno']) for x in lst), 2),
        'importo_complessivo_eur': round(sum(f(x['importo_complessivo']) for x in lst), 2),
        'con_cup': sum(1 for x in lst if cup_ok(x)),
        'con_geometria_sul_territorio': sum(1 for x in lst if geo(x)),
        'principali_settori': [{'settore': k, 'interventi': v[0], 'importo_eur': round(v[1], 2)} for k, v in top],
    }

res = {c: json.load(open(PROF, encoding='utf-8'))['valori'][str(i + 1)]['residenti'] for i, c in enumerate(ROM)}
valori = {}
for i, c in enumerate(ROM):
    b = blocco(gruppi[c]); b['circoscrizione'] = c
    b['residenti_censimento_2021'] = res[c]
    b['importo_triennio_per_residente_eur'] = round(b['importo_triennio_eur'] / res[c], 0)
    valori[str(i + 1)] = b
tot = blocco(items)
out = {
    'fonte': {'nome': 'Comune di Palermo, Programma triennale dei lavori pubblici 2026-2028 (DCC 553/2026), elaborato da OpenDataSicilia',
              'ente': 'Comune di Palermo; elaborazione OpenDataSicilia con Claude AI', 'link': 'https://github.com/opendatasicilia',
              'licenza': 'non dichiarata nel repository di OpenDataSicilia (piano_triennale_26_28): da confermare con l\'autore. L\'atto di origine è una deliberazione pubblica del Comune.'},
    'periodo': 'Triennio 2026-2028',
    'verificato': '2026-11-16',
    'misura': 'Interventi e importi programmati nel Programma triennale per circoscrizione dove cade l\'intervento.',
    'non_misura': ['Spesa effettiva o pagamenti: sono importi programmati, non speso.',
                   'Spesa della circoscrizione: gli interventi li gestisce il Comune e la circoscrizione indica solo dove cadono.',
                   'Circa il 47% dell\'importo del triennio riguarda interventi senza localizzazione (reti e linee che attraversano il territorio, come la metropolitana leggera da 1.250 milioni): confrontare gli importi per circoscrizione, o per residente, senza questa quota dà un quadro parziale.',
                   'Gli interventi senza geometria o con più circoscrizioni non sono divisi: sono in gruppi separati.',
                   'Il dato è ricavato dai PDF del Comune (elaborazione OpenDataSicilia con Claude AI), a carattere informativo: per i valori ufficiali valgono gli atti.',
                   'Importi del triennio e importo complessivo (con annualità successive) misurano cose diverse e non si sommano.',
                   'Un valore insolito è un segnale da approfondire, non la prova di uno spreco o di un illecito.'],
    'valori': valori,
    'piu_circoscrizioni': blocco(gruppi['piu_circoscrizioni']),
    'non_localizzato': dict(blocco(gruppi['non_localizzato']), principali_interventi=[
        {'id': 'op-' + x['cod_int_amm'], 'descrizione': x['descrizione_intervento'][:140], 'settore': x['settore_sottosettore'], 'importo_triennio_eur': round(f(x['importo']), 2)}
        for x in sorted(gruppi['non_localizzato'], key=lambda x: -f(x['importo']))[:6]]),
    'totale_palermo': tot,
}
# controlli
assert tot['interventi'] == 548, tot['interventi']
s = sum(v['interventi'] for v in valori.values()) + out['piu_circoscrizioni']['interventi'] + out['non_localizzato']['interventi']
assert s == tot['interventi'], s
somma = sum(v['importo_triennio_eur'] for v in valori.values()) + out['piu_circoscrizioni']['importo_triennio_eur'] + out['non_localizzato']['importo_triennio_eur']
assert abs(somma - tot['importo_triennio_eur']) < 0.05, (somma, tot['importo_triennio_eur'])
anni = tot['importo_2026_eur'] + tot['importo_2027_eur'] + tot['importo_2028_eur']
print('importo triennio %.2f ; somma dei 3 anni %.2f' % (tot['importo_triennio_eur'], anni))
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('ok ->', OUT)
for k, v in valori.items():
    print(v['circoscrizione'].ljust(5), str(v['interventi']).rjust(4), ('%.1f M' % (v['importo_triennio_eur'] / 1e6)).rjust(9), str(v['importo_triennio_per_residente_eur']).rjust(7), 'cup', v['con_cup'])
for g in ['piu_circoscrizioni', 'non_localizzato']:
    print(g.ljust(20), out[g]['interventi'], '%.1f M' % (out[g]['importo_triennio_eur'] / 1e6))
