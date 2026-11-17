"""Snapshot a livello comunale: appalti (ANAC CIG), PNRR (sito del Comune), fondi coesione (OpenCoesione).
Uso: python3 -I scripts/snapshot_comunali.py
Le fonti non hanno la circoscrizione: i valori sono per Comune. Nessuna stima; si ferma se un controllo fallisce."""
import csv, json, os, collections
csv.field_size_limit(10**9)
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = os.path.join(BASE, 'data/snapshot'); D = os.path.join(BASE, 'dati')
os.makedirs(S, exist_ok=True)
VERIFICATO = '2026-11-16'

def f(v):
    try: return float((v or '0').replace(',', '.'))
    except ValueError: return 0.0

def top(c, n=8):
    return [{'voce': k, 'cig': v[0], 'importo_eur': round(v[1], 2)} for k, v in sorted(c.items(), key=lambda kv: -kv[1][1])[:n]]

# classi di procedura: le stesse quattro in tutti gli anni, cosi` i grafici si confrontano
def classe_procedura(s):
    s = (s or '').strip().upper()
    if s.startswith('AFFIDAMENTO DIRETTO'): return 'Affidamento diretto, anche in house'
    if s in ('PROCEDURA APERTA', 'PROCEDURA RISTRETTA', 'PROCEDURA DI GARA'): return 'Procedura aperta o ristretta'
    if s.startswith('PROCEDURA NEGOZIATA'): return 'Procedura negoziata'
    return 'Altre procedure o non indicata'

# fasce di importo sui valori di soglia del codice degli appalti
FASCE = [(0, 40000, 'fino a 40.000 €'), (40000, 150000, 'da 40.000 a 150.000 €'),
         (150000, 1000000, 'da 150.000 a 1 milione €'), (1000000, float('inf'), 'oltre 1 milione €')]
def fascia_importo(v):
    for lo, hi, nome in FASCE:
        if lo <= v < hi: return nome
    return FASCE[-1][2]

# ---------- APPALTI ----------
def leggi(nome):
    return list(csv.DictReader(open(os.path.join(D, nome), encoding='utf-8'), delimiter=';'))
r25, r26 = leggi('anac_cig_palermo_2025.csv'), leggi('anac_cig_palermo_2026.csv')
ordine = lambda r: (0 if r['file_origine'].startswith('cig-csv-2025') else 1, r['file_origine'])
per_cig = {}
for r in sorted(r25 + r26, key=ordine):           # vince la riga del file più recente
    k = r['cig']; cur = per_cig.get(k)
    if cur is None or ordine(r) > ordine(cur) or (ordine(r) == ordine(cur) and r['flag_prevalente'] == '1'):
        per_cig[k] = r
ANOMALI = {'B7129C8050', 'B71B482B61'}      # importo 2.684 M€ nella fonte, evidente errore: non corretto
def appalti(anno):
    rs = [r for r in per_cig.values() if r['anno_pubblicazione'] == str(anno)]
    def tot(lst): return round(sum(f(r['importo_lotto']) for r in lst), 2)
    senza = [r for r in rs if r['cig'] not in ANOMALI]
    scelta = collections.defaultdict(lambda: [0, 0.0]); ogg = collections.defaultdict(lambda: [0, 0.0]); cpv = collections.defaultdict(lambda: [0, 0.0])
    classi = collections.defaultdict(lambda: [0, 0.0]); fasce = collections.defaultdict(lambda: [0, 0.0])
    for r in senza:
        for d, k in ((scelta, r['tipo_scelta_contraente']), (ogg, r['oggetto_principale_contratto']), (cpv, (r['cod_cpv'] or '')[:2] + ' ' + r['descrizione_cpv'])):
            d[k][0] += 1; d[k][1] += f(r['importo_lotto'])
        for d, k in ((classi, classe_procedura(r['tipo_scelta_contraente'])), (fasce, fascia_importo(f(r['importo_lotto'])))):
            d[k][0] += 1; d[k][1] += f(r['importo_lotto'])
    ordine_classi = ['Affidamento diretto, anche in house', 'Procedura aperta o ristretta', 'Procedura negoziata', 'Altre procedure o non indicata']
    ordine_fasce = [n for _, _, n in FASCE]
    imp = tot(senza)
    return {'cig': len(rs), 'importo_base_gara_eur_come_in_fonte': tot(rs),
            'per_classe_procedura': [{'voce': k, 'cig': classi[k][0], 'importo_eur': round(classi[k][1], 2),
                                      'quota_cig_pct': round(100 * classi[k][0] / len(senza), 1) if senza else None,
                                      'quota_importo_pct': round(100 * classi[k][1] / imp, 1) if imp else None} for k in ordine_classi if classi[k][0]],
            'per_fascia_importo': [{'voce': k, 'cig': fasce[k][0], 'importo_eur': round(fasce[k][1], 2),
                                    'quota_cig_pct': round(100 * fasce[k][0] / len(senza), 1) if senza else None,
                                    'quota_importo_pct': round(100 * fasce[k][1] / imp, 1) if imp else None} for k in ordine_fasce if fasce[k][0]],
            'cig_con_importo_anomalo_non_corretti': sorted(r['cig'] for r in rs if r['cig'] in ANOMALI),
            'importo_base_gara_eur_senza_anomali': tot(senza), 'cig_senza_anomali': len(senza),
            'cig_flag_pnrr_pnc': sum(1 for r in rs if r['FLAG_PNRR_PNC'] == '1'),
            'cig_con_cui_programma': sum(1 for r in rs if r['CUI_PROGRAMMA'].strip()),
            'per_procedura': top(scelta), 'per_tipo_contratto': top(ogg), 'per_cpv_prime_due_cifre': top(cpv),
            'data_ultima_pubblicazione': max((r['data_pubblicazione'] for r in rs), default='')}
a = {'fonte': {'nome': 'ANAC, open data CIG (anno 2025 e aggiornamenti mensili 2026), stazione appaltante Comune di Palermo (CF 80016350821)',
               'ente': 'ANAC', 'link': 'https://dati.anticorruzione.it/opendata/dataset/cig', 'licenza': 'CC BY-SA 4.0 (metadato dei dataset ANAC, verificato il 16/11/2026): anche questo snapshot e gli estratti in dati/ vanno rilasciati con CC BY-SA 4.0'},
     'periodo': {'2025': 'CIG pubblicati nel 2025', '2026': 'CIG pubblicati nel 2026, file fino al 01/11/2026'}, 'verificato': VERIFICATO,
     'misura': 'Appalti avviati dal Comune di Palermo: numero di CIG e importo a base di gara, per anno di pubblicazione, a livello comunale.',
     'non_misura': ['L\'importo aggiudicato o pagato: l\'importo ANAC è a base di gara.',
                    'Le imprese aggiudicatarie: il dataset dei CIG non le contiene.',
                    'La circoscrizione: il luogo è solo il comune (codice ISTAT 082053).',
                    'Il 2026 può essere incompleto: i file mensili sono aggiornamenti e non è disponibile il periodo gennaio-marzo come file a sé; i CIG di quel periodo compaiono solo se aggiornati dopo.',
                    'Due CIG hanno importi di circa 2.684 milioni nella fonte (evidente errore di inserimento): sono riportati e non corretti, e i totali sono dati anche senza di essi.',
                    'Una riga per CIG: se un CIG ha più codici CPV si tiene la riga prevalente; se compare in più file si tiene il file più recente.'],
     'anni': {'2025': appalti(2025), '2026': appalti(2026)}}
assert len(per_cig) == len({r['cig'] for r in r25 + r26})
json.dump(a, open(os.path.join(S, 'appalti_comune.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

# ---------- PNRR ----------
pn = list(csv.DictReader(open(os.path.join(D, 'pnrr_comune_palermo.csv'), encoding='utf-8')))
assert len(pn) == 61 and len({r['cup'] for r in pn}) == 61
def classe(s):
    s = s.lower()
    if not s: return 'stato non indicato nella scheda'
    if 'conclus' in s: return 'concluso'
    if 'lavori in corso' in s or 'collaudo' in s or 'affidat' in s: return 'in esecuzione o affidato'
    return 'in progettazione o gara'
st = collections.defaultdict(lambda: [0, 0.0, 0.0]); tp = collections.defaultdict(lambda: [0, 0.0, 0.0])
for r in pn:
    for d, k in ((st, classe(r['stato'])), (tp, r['tipologia'])):
        d[k][0] += 1; d[k][1] += f(r['importo_finanziato_eur']); d[k][2] += f(r['spesa_rendicontata_eur'])
fmt = lambda d: [{'voce': k, 'progetti': v[0], 'importo_finanziato_eur': round(v[1], 2), 'spesa_rendicontata_eur': round(v[2], 2)} for k, v in sorted(d.items(), key=lambda kv: -kv[1][1])]
p = {'fonte': {'nome': 'Comune di Palermo, sito PNRR (schede dei progetti)', 'ente': 'Comune di Palermo', 'link': 'https://pnrr.comune.palermo.it/', 'licenza': 'non dichiarata nelle pagine lette: si cita la fonte'},
     'periodo': 'Schede lette il 16/11/2026', 'verificato': VERIFICATO,
     'misura': 'Progetti PNRR elencati sul sito del Comune: importo finanziato, spesa rendicontata e stato dichiarato, per Comune.',
     'non_misura': ['La circoscrizione: le schede non la indicano.',
                    'Il numero di progetti non coincide con altre fonti: 61 voci sul sito, 52 su OpenPNRR, 48 nel report del Comune. Non è stato spiegato e non va confrontato.',
                    'L\'importo finanziato non è speso: la spesa rendicontata è la somma dichiarata dal Comune.',
                    '4 schede non riportano lo stato: il campo è lasciato vuoto.'],
     'totale': {'progetti': len(pn), 'importo_finanziato_eur': round(sum(f(r['importo_finanziato_eur']) for r in pn), 2),
                'spesa_rendicontata_eur': round(sum(f(r['spesa_rendicontata_eur']) for r in pn), 2)},
     'per_stato': fmt(st), 'per_tipologia': fmt(tp)}
json.dump(p, open(os.path.join(S, 'pnrr_comune.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

# ---------- COESIONE ----------
oc = [r for r in csv.DictReader(open(os.path.join(D, 'opencoesione_palermo_20260831.csv'), encoding='utf-8'), delimiter=';')
      if 'COMUNE DI PALERMO' in [x.strip().upper() for x in r['OC_DENOM_BENEFICIARIO'].split(':::')]]
assert len({r['COD_LOCALE_PROGETTO'] for r in oc}) == len(oc), 'progetti duplicati'   # lo stesso CUP può comparire in più linee di finanziamento
pr = collections.defaultdict(lambda: [0, 0.0, 0.0]); ci = collections.defaultdict(lambda: [0, 0.0, 0.0]); sp = collections.defaultdict(lambda: [0, 0.0, 0.0])
for r in oc:
    for d, k in ((pr, r['OC_DESCRIZIONE_PROGRAMMA']), (ci, r['OC_DESCR_CICLO']), (sp, r['OC_STATO_PROGETTO'])):
        d[k][0] += 1; d[k][1] += f(r['OC_FINANZ_TOT_PUB_NETTO']); d[k][2] += f(r['OC_TOT_PAGAMENTI_BENEFICIARI'] or r['TOT_PAGAMENTI'])
fm = lambda d, n=None: [{'voce': k, 'progetti': v[0], 'finanziamento_pubblico_netto_eur': round(v[1], 2), 'pagamenti_eur': round(v[2], 2)} for k, v in sorted(d.items(), key=lambda kv: -kv[1][1])[:n]]
c = {'fonte': {'nome': 'OpenCoesione, progetti con beneficiario Comune di Palermo (file Sicilia, aggiornato al 31/08/2026)', 'ente': 'Dipartimento per le politiche di coesione', 'link': 'https://opencoesione.gov.it/it/opendata/', 'licenza': 'CC BY 4.0 (dichiarata da OpenCoesione su /it/opendata/, verificata il 16/11/2026)'},
     'periodo': 'Cicli 2000-2006, 2007-2013, 2014-2020, 2021-2027; dati al 31/08/2026', 'verificato': VERIFICATO,
     'misura': 'Progetti di coesione (PON Metro, PSC, POC, FSC e altri) con beneficiario il Comune di Palermo: finanziamento pubblico netto e pagamenti, per Comune.',
     'non_misura': ['La circoscrizione: il file ha solo il codice del comune.',
                    'Il Piano triennale e il PNRR: gli stessi progetti possono comparire anche lì (solo pochi CUP coincidono) e le somme tra fonti non vanno sommate.',
                    'Un progetto può avere più beneficiari: sono qui tutti quelli in cui il Comune è tra i beneficiari indicati. Lo stesso CUP può comparire in più progetti (una riga per linea di finanziamento): i progetti sono contati per codice locale, non per CUP.'],
     'totale': {'progetti': len(oc), 'cup_distinti': len({r['CUP'] for r in oc}), 'finanziamento_pubblico_netto_eur': round(sum(f(r['OC_FINANZ_TOT_PUB_NETTO']) for r in oc), 2)},
     'per_programma': fm(pr, 10), 'per_ciclo': fm(ci), 'per_stato': fm(sp)}
json.dump(c, open(os.path.join(S, 'coesione_comune.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

print('appalti', {y: (v['cig'], round(v['importo_base_gara_eur_senza_anomali'] / 1e6, 1), round(v['importo_base_gara_eur_come_in_fonte'] / 1e6, 1)) for y, v in a['anni'].items()})
print('pnrr', p['totale']); print([ (x['voce'], x['progetti']) for x in p['per_stato']])
print('coesione', c['totale']); print([(x['voce'][:35], x['progetti']) for x in c['per_programma'][:5]])
