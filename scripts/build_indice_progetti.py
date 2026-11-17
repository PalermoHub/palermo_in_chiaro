"""Indice unico dei progetti e dei finanziamenti del Comune di Palermo.

Uso: python3 -I scripts/build_indice_progetti.py

Unisce, senza sommare importi di fonti diverse:
  - opere pubbliche del Programma triennale 2026-2028 (548 interventi, con CUP, CUI, importi e posizione);
  - schede PNRR del Comune (61, con missione, ministero proponente, decreto e documenti);
  - progetti di coesione con il Comune tra i beneficiari (OpenCoesione, una riga per CUP);
  - appalti ANAC collegati per CUI (solo dove il codice coincide).

L'identificativo di ogni voce e' stabile: op-<cod_int_amm>, pn-<id_scheda>, co-<cup o codice locale>.
Una voce per progetto: se lo stesso CUP compare in piu' fonti, resta una sola scheda con le fonti elencate.
Nessun importo viene diviso, stimato o sommato tra fonti diverse.
"""
import collections, csv, json, os

csv.field_size_limit(10 ** 9)
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, 'data/progetti.json')
OUT_CIG = os.path.join(BASE, 'data/snapshot/appalti_cig.json')
VERIFICATO = '2026-11-16'

def f(v):
    if isinstance(v, (int, float)):
        return round(float(v), 2)
    try:
        t = (v or '0').strip()
        return round(float(t.replace('.', '').replace(',', '.')) if ',' in t else float(t), 2)
    except ValueError:
        return 0.0

def ok(v):
    return v not in (None, '', 'None', 'null')

def norm_cup(v):
    return (v or '').strip().upper() or None

# ---------- opere ----------
interventi = json.load(open(os.path.join(BASE, 'dati/piano_triennale/interventi_2026_2028.json'), encoding='utf-8'))
posizioni = {p['id']: p for p in json.load(open(os.path.join(BASE, 'data/geo/progetti.json'), encoding='utf-8'))['progetti']}

def territorio_da_geo(x):
    """Circoscrizione, quartiere e UPL del campo geo, che nel file e' la stringa di una lista di tuple (circ, quartiere, upl)."""
    import ast
    g = x.get('geo')
    if isinstance(g, str) and ok(g):
        try:
            g = ast.literal_eval(g)
        except (ValueError, SyntaxError):
            g = None
    g = [r for r in (g or []) if r and len(r) > 2]
    return (sorted({r[0] for r in g if r[0]}),
            sorted({r[1] for r in g if r[1]}),
            sorted({r[2] for r in g if r[2]}))

opere = {}
for x in interventi:
    pid = 'op-' + x['cod_int_amm']
    pos = posizioni.get(x['cod_int_amm'])
    circ, quart, upl = territorio_da_geo(x)
    if pos:
        circ = pos.get('circoscrizioni') or circ
    finanziamenti = []
    if ok(x.get('fonti_tipologia_risorsa')) or ok(x.get('fonti_descrizione_finanziamento')):
        finanziamenti.append({
            'tipologia_risorsa': x.get('fonti_tipologia_risorsa') or None,
            'descrizione': x.get('fonti_descrizione_finanziamento') or None,
            'importo_totale_eur': f(x.get('fonti_importo_totale')) if ok(x.get('fonti_importo_totale')) else None,
        })
    opere[pid] = {
        'id': pid,
        'titolo': ' '.join((x.get('descrizione_intervento') or '').split()),
        'fonti': ['opere'],
        'cup': norm_cup(x.get('cup')),
        'cui': (x.get('cui') or '').strip() or None,
        'circoscrizioni': circ,
        'quartieri': quart,
        'upl': upl,
        'localizzato': bool(pos),
        'opere': {
            'settore': x.get('settore_sottosettore'),
            'tipologia': x.get('tipologia'),
            'rup': x.get('rup') or None,
            'cup_stato': x.get('cup_stato') or None,
            'importo_triennio_eur': f(x.get('importo')),
            'importo_complessivo_eur': f(x.get('importo_complessivo')),
            'annualita_eur': {
                '2026': f(x.get('costo_1_anno')),
                '2027': f(x.get('costo_2_anno')),
                '2028': f(x.get('costo_3_anno')),
            },
        },
        'finanziamenti': finanziamenti,
        'link': {},
    }
    if ok(x.get('opencup_link')):
        opere[pid]['link']['opencup'] = x['opencup_link']
    if ok(x.get('cup_candidato_link')):
        opere[pid]['link']['opencup_candidato'] = x['cup_candidato_link']
        opere[pid]['link']['nota_opencup_candidato'] = 'CUP candidato, non confermato nel Programma: il collegamento va verificato'

per_cup = {}
per_cui = {}
for pid, r in opere.items():
    if r['cup']:
        per_cup.setdefault(r['cup'], []).append(pid)
    if r['cui']:
        per_cui.setdefault(r['cui'], []).append(pid)

# ---------- PNRR ----------
def classe_stato(s):
    """Le stesse classi dello snapshot pnrr_comune.json (per_stato)."""
    s = (s or '').lower()
    if not s:
        return 'stato non indicato nella scheda'
    if 'conclus' in s:
        return 'concluso'
    if 'lavori in corso' in s or 'collaudo' in s or 'affidat' in s:
        return 'in esecuzione o affidato'
    return 'in progettazione o gara'

pnrr = json.load(open(os.path.join(BASE, 'data/snapshot/pnrr_progetti.json'), encoding='utf-8'))['progetti']
senza_match = []
for p in pnrr:
    cup = norm_cup(p['cup'])
    pid = (per_cup.get(cup) or [None])[0] if cup else None
    dati = {
        'id_scheda': p['id_scheda'],
        'stato': p['stato'],
        'classe_stato': classe_stato(p['stato']),
        'tipologia': p['tipologia'],
        'missione': p['missione'],
        'missione_n': p['missione_n'],
        'proponente': p['proponente'],
        'proponente_url': p.get('proponente_url'),
        'attuatore': p['attuatore'],
        'rup': p['rup'],
        'importo_finanziato_eur': p['importo_finanziato_eur'],
        'spesa_rendicontata_eur': p['spesa_rendicontata_eur'],
        'decreto_finanziamento': p['decreto_finanziamento'],
        'documenti': p['documenti'][:6],
        'url': p['url'],
    }
    if pid:
        opere[pid]['pnrr'] = dati
        opere[pid]['fonti'].append('pnrr')
        opere[pid]['link']['pnrr_comune'] = p['url']
    else:
        senza_match.append({
            'id': 'pn-' + p['id_scheda'],
            'titolo': p['titolo'],
            'fonti': ['pnrr'],
            'cup': cup,
            'cui': None,
            'circoscrizioni': [],
            'quartieri': [],
            'upl': [],
            'localizzato': False,
            'pnrr': dati,
            'finanziamenti': [],
            'link': {'pnrr_comune': p['url']},
        })

# ---------- coesione ----------
coesione = []
for r in csv.DictReader(open(os.path.join(BASE, 'dati/opencoesione_palermo_20260831.csv'), encoding='utf-8'), delimiter=';'):
    if 'COMUNE DI PALERMO' in [x.strip().upper() for x in r['OC_DENOM_BENEFICIARIO'].split(':::')]:
        coesione.append(r)
per_cup_coe = collections.defaultdict(list)
for r in coesione:
    cup = norm_cup(r['CUP'])
    if cup:
        per_cup_coe[cup].append(r)

for cup, righe in sorted(per_cup_coe.items()):
    pids = per_cup.get(cup) or []
    dettaglio = [{
        'programma': x['OC_DESCRIZIONE_PROGRAMMA'].split(':::')[0].strip() or None,
        'ciclo': x['OC_DESCR_CICLO'] or None,
        'stato': x['OC_STATO_PROGETTO'] or None,
        'finanziamento_pubblico_netto_eur': f(x['OC_FINANZ_TOT_PUB_NETTO']),
        'pagamenti_eur': f(x['OC_TOT_PAGAMENTI_BENEFICIARI'] or x['TOT_PAGAMENTI']),
        'link': x['OC_LINK'] or None,
        'titolo': x['OC_TITOLO_PROGETTO'] or None,
    } for x in righe]
    if pids:
        for pid in pids:
            opere[pid]['coesione'] = dettaglio
            opere[pid]['fonti'].append('coesione')
            if dettaglio[0]['link']:
                opere[pid]['link']['opencoesione'] = dettaglio[0]['link']
    else:
        senza_match.append({
            'id': 'co-' + cup,
            'titolo': righe[0]['OC_TITOLO_PROGETTO'] or righe[0]['OC_SINTESI_PROGETTO'] or cup,
            'sintesi': (righe[0]['OC_SINTESI_PROGETTO'] or '')[:400] or None,
            'fonti': ['coesione'],
            'cup': cup,
            'cui': None,
            'circoscrizioni': [],
            'quartieri': [],
            'upl': [],
            'localizzato': False,
            'coesione': dettaglio,
            'finanziamenti': [],
            'link': {'opencoesione': dettaglio[0]['link']} if dettaglio[0]['link'] else {},
        })

# progetti di coesione senza CUP: restano fuori dall'indice per CUP, ma vanno contati
coesione_senza_cup = sum(1 for r in coesione if not norm_cup(r['CUP']))

# ---------- appalti CIG ----------
ordine = lambda r: (0 if r['file_origine'].startswith('cig-csv-2025') else 1, r['file_origine'])
per_cig = {}
for nome in ('anac_cig_palermo_2025.csv', 'anac_cig_palermo_2026.csv'):
    righe = list(csv.DictReader(open(os.path.join(BASE, 'dati', nome), encoding='utf-8'), delimiter=';'))
    for r in sorted(righe, key=ordine):
        cur = per_cig.get(r['cig'])
        if cur is None or ordine(r) > ordine(cur) or (ordine(r) == ordine(cur) and r['flag_prevalente'] == '1'):
            per_cig[r['cig']] = r

cig_rows, cig_per_progetto = [], collections.defaultdict(list)
for cig, r in sorted(per_cig.items()):
    cui = (r['CUI_PROGRAMMA'] or '').strip() or None
    pids = per_cui.get(cui) if cui else []
    pid = pids[0] if pids else None
    riga = {
        'cig': cig,
        'anno_pubblicazione': r['anno_pubblicazione'] or None,
        'oggetto': ' '.join((r['oggetto_lotto'] or r['oggetto_principale_contratto'] or '').split())[:220] or None,
        'importo_base_gara_eur': f(r['importo_lotto']),
        'procedura': r['tipo_scelta_contraente'] or None,
        'cui': cui,
        'progetto_id': pid,
        'pnrr_pnc': r['FLAG_PNRR_PNC'] == '1',
    }
    cig_rows.append(riga)
    if pid:
        cig_per_progetto[pid].append(riga)

for pid, righe in cig_per_progetto.items():
    if pid in opere:
        opere[pid]['appalti'] = sorted(righe, key=lambda x: -x['importo_base_gara_eur'])
        opere[pid]['fonti'].append('appalti')

tutti = sorted(opere.values(), key=lambda x: -(x['opere']['importo_triennio_eur'] if x['opere'] else 0)) + \
        sorted(senza_match, key=lambda x: -((x.get('pnrr') or {}).get('importo_finanziato_eur') or 0))

out = {
    'fonte': 'Comune di Palermo (Programma triennale OO.PP. 2026-2028, schede PNRR, appalti ANAC) e OpenCoesione; una voce per progetto, con la fonte di ogni campo',
    'verificato': VERIFICATO,
    'misura': 'Elenco dei progetti e dei finanziamenti del Comune di Palermo: una scheda per progetto, con le fonti che lo citano. Gli importi restano separati per fonte e non si sommano.',
    'non_misura': [
        'Un progetto puo\' comparire in piu\' fonti: la scheda le elenca tutte, ma gli importi non si sommano (stanziamento, finanziamento PNRR, fondo di coesione e base di gara misurano cose diverse).',
        'Il collegamento tra fonti avviene solo per CUP o CUI identico: dove il codice manca o e\' diverso, i progetti restano voci separate.',
        'Molti progetti PNRR e di coesione non hanno una circoscrizione: la localizzazione resta comunale.',
        'Quartiere e UPL sono quelli dichiarati nel Programma triennale per ogni intervento (campo geo della tavola): non sono calcolati qui e mancano dove la fonte non li indica.',
        'I CIG senza CUI collegato non hanno un progetto a cui appartenere: restano nella lista appalti, senza scheda progetto.',
    ],
    'conteggi': {
        'voci': len(tutti),
        'opere': len(opere),
        'opere_localizzate': sum(1 for r in opere.values() if r['localizzato']),
        'opere_con_quartiere': sum(1 for r in opere.values() if r['quartieri']),
        'opere_con_upl': sum(1 for r in opere.values() if r['upl']),
        'pnrr_totali': len(pnrr),
        'pnrr_collegati_a_opere': sum(1 for r in opere.values() if 'pnrr' in r),
        'pnrr_voci_proprie': sum(1 for r in senza_match if 'pnrr' in r['fonti']),
        'coesione_righe': len(coesione),
        'coesione_cup': len(per_cup_coe),
        'coesione_collegati_a_opere': sum(1 for r in opere.values() if 'coesione' in r),
        'coesione_voci_proprie': sum(1 for r in senza_match if 'coesione' in r['fonti']),
        'coesione_senza_cup': coesione_senza_cup,
        'cig': len(cig_rows),
        'cig_collegati_a_opere': sum(len(v) for v in cig_per_progetto.values()),
    },
    'progetti': tutti,
}
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

# ---------- conteggi per territorio ----------
# Servono ai popup della mappa: quante voci, quante con PNRR o coesione, quante linee di
# finanziamento dichiarate e quanti CIG ricadono in una circoscrizione, in un quartiere, in una UPL.
# Sono conteggi, non importi: un importo non si divide tra più territori, una voce sì (si conta in ognuno).
ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']
def vuoto():
    return {'voci': 0, 'opere': 0, 'pnrr': 0, 'coesione': 0, 'straordinari': 0, 'appalti': 0,
            'finanziamenti': 0, 'con_cup': 0}
def somma(voce, p):
    voce['voci'] += 1
    if 'opere' in p['fonti']:
        voce['opere'] += 1
    if 'pnrr' in p['fonti']:
        voce['pnrr'] += 1
    if 'coesione' in p['fonti']:
        voce['coesione'] += 1
    if 'pnrr' in p['fonti'] or 'coesione' in p['fonti']:
        voce['straordinari'] += 1
    voce['appalti'] += len(p.get('appalti') or [])
    voce['finanziamenti'] += len(p.get('finanziamenti') or [])
    if p.get('cup'):
        voce['con_cup'] += 1

conteggi = {'circoscrizioni': {c: vuoto() for c in ROM}, 'quartieri': {}, 'upl': {}}
for p in tutti:
    if len(p['circoscrizioni']) == 1:
        somma(conteggi['circoscrizioni'][p['circoscrizioni'][0]], p)
    for q in p['quartieri']:
        somma(conteggi['quartieri'].setdefault(q, vuoto()), p)
    for u in p['upl']:
        somma(conteggi['upl'].setdefault(u, vuoto()), p)
conteggi['quartieri'] = dict(sorted(conteggi['quartieri'].items()))
conteggi['upl'] = dict(sorted(conteggi['upl'].items()))

cnt_out = dict({
    'fonte': 'Conteggi calcolati su data/progetti.json: una voce per progetto, con la circoscrizione, il quartiere e la UPL che il Programma triennale dichiara.',
    'verificato': VERIFICATO,
    'misura': 'Quante voci, quante con PNRR o coesione, quante linee di finanziamento dichiarate e quanti CIG ricadono in ogni circoscrizione, quartiere e UPL.',
    'non_misura': [
        'Non è una spesa: le voci sono stanziamenti, finanziamenti e basi di gara, misure diverse che non si sommano.',
        'Gli importi non si dividono per territorio, i conteggi sì: una voce che tocca due quartieri si conta in entrambi.',
        'Nella circoscrizione finiscono solo le voci con una sola circoscrizione, come nel resto del sito.',
    ],
}, **conteggi)
json.dump({'fonte': cnt_out['fonte'], 'verificato': VERIFICATO, 'misura': cnt_out['misura'],
           'non_misura': cnt_out['non_misura'], 'circoscrizioni': conteggi['circoscrizioni'],
           'quartieri': conteggi['quartieri'], 'upl': conteggi['upl']},
          open(os.path.join(BASE, 'data/snapshot/conteggi_territorio.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, separators=(',', ':'))

cig_out = {
    'fonte': {
        'nome': 'ANAC, open data CIG (2025 e aggiornamenti mensili 2026), stazione appaltante Comune di Palermo (CF 80016350821)',
        'ente': 'ANAC', 'link': 'https://dati.anticorruzione.it/opendata/dataset/cig',
        'licenza': 'CC BY-SA 4.0 (metadato dei dataset ANAC, verificato il 16/11/2026)',
    },
    'periodo': {'2025': 'CIG pubblicati nel 2025', '2026': 'CIG pubblicati nel 2026, file fino al 01/11/2026'},
    'verificato': VERIFICATO,
    'misura': 'Un appalto per CIG, con importo a base di gara e il progetto collegato quando il CUI coincide.',
    'non_misura': [
        'La base di gara non e\' l\'importo aggiudicato e non e\' la spesa: il dataset non contiene l\'impresa aggiudicataria.',
        'Due CIG hanno un importo anomalo in fonte (circa 2.684 M€): non sono corretti e sono segnalati.',
        'Solo una parte dei CIG ha un CUI che compare nel Programma triennale: gli altri non sono attribuibili a un progetto.',
    ],
    'conteggi': {'cig': len(cig_rows), 'collegati': sum(1 for r in cig_rows if r['progetto_id'])},
    'cig': cig_rows,
}
json.dump(cig_out, open(OUT_CIG, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

print('voci', len(tutti), '| opere', len(opere), '| pnrr propri', out['conteggi']['pnrr_voci_proprie'],
      '| coesione propri', out['conteggi']['coesione_voci_proprie'], '| cig', len(cig_rows))
print('collegati: pnrr->opere', out['conteggi']['pnrr_collegati_a_opere'], 'coesione->opere', out['conteggi']['coesione_collegati_a_opere'],
      'cig->opere', out['conteggi']['cig_collegati_a_opere'], '| coesione senza CUP', coesione_senza_cup)
print('scritti', os.path.getsize(OUT) // 1024, 'KB e', os.path.getsize(OUT_CIG) // 1024, 'KB;',
      'conteggi territorio', os.path.getsize(os.path.join(BASE, 'data/snapshot/conteggi_territorio.json')) // 1024, 'KB')
print('conteggi per circoscrizione', {c: v['voci'] for c, v in conteggi['circoscrizioni'].items()})
