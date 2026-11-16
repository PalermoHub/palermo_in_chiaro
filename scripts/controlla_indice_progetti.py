"""Controlli sull'indice dei progetti (data/progetti.json) e sugli appalti (data/snapshot/appalti_cig.json).
Uso: python3 -I scripts/controlla_indice_progetti.py
Si ferma con errore se un controllo non torna: l'indice non va pubblicato."""
import csv, json, os, sys

csv.field_size_limit(10 ** 9)
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = json.load(open(os.path.join(BASE, 'data/progetti.json'), encoding='utf-8'))
CIG = json.load(open(os.path.join(BASE, 'data/snapshot/appalti_cig.json'), encoding='utf-8'))
OPERE = json.load(open(os.path.join(BASE, 'dati/piano_triennale/interventi_2026_2028.json'), encoding='utf-8'))
PNRR = json.load(open(os.path.join(BASE, 'data/snapshot/pnrr_progetti.json'), encoding='utf-8'))['progetti']
OPERE_SNAP = json.load(open(os.path.join(BASE, 'data/snapshot/opere_circoscrizioni.json'), encoding='utf-8'))

errori = []

def controlla(cond, msg):
    if not cond:
        errori.append(msg)

ids = [p['id'] for p in D['progetti']]
controlla(len(ids) == len(set(ids)), 'identificativi duplicati')
controlla(all(isinstance(p['fonti'], list) and p['fonti'] for p in D['progetti']), 'voce senza fonti')
controlla(all(p['titolo'] for p in D['progetti']), 'voce senza titolo')

# una voce per ogni intervento del Programma triennale
op_ids = [p['id'] for p in D['progetti'] if p['id'].startswith('op-')]
controlla(len(op_ids) == len(OPERE), f'opere: {len(op_ids)} voci, {len(OPERE)} interventi in fonte')
controlla({i['cod_int_amm'] for i in OPERE} == {x[3:] for x in op_ids}, 'gli identificativi delle opere non coincidono con i cod_int_amm della fonte')

# somma degli importi delle opere = totale dello snapshot per circoscrizione
tot_fonte = OPERE_SNAP['totale_palermo']['importo_triennio_eur']
tot_indice = round(sum(p['opere']['importo_triennio_eur'] for p in D['progetti'] if p.get('opere')), 2)
controlla(abs(tot_fonte - tot_indice) < 0.5, f'importo triennio: indice {tot_indice}, fonte {tot_fonte}')

# ogni scheda PNRR compare una sola volta, come voce propria o agganciata a un'opera
schede = [p['pnrr']['id_scheda'] for p in D['progetti'] if p.get('pnrr')]
controlla(sorted(schede) == sorted(x['id_scheda'] for x in PNRR), 'le schede PNRR non compaiono tutte esattamente una volta')
controlla(len(schede) == len(set(schede)), 'una scheda PNRR compare piu\' volte')

# ogni CUP di coesione compare almeno una volta
coe = set()
for r in csv.DictReader(open(os.path.join(BASE, 'dati/opencoesione_palermo_20260831.csv'), encoding='utf-8'), delimiter=';'):
    if 'COMUNE DI PALERMO' in [x.strip().upper() for x in r['OC_DENOM_BENEFICIARIO'].split(':::')] and (r['CUP'] or '').strip():
        coe.add(r['CUP'].strip().upper())
cup_indice = set()
for p in D['progetti']:
    if p.get('coesione'):
        cup_indice.add((p['cup'] or '').upper())
mancanti = coe - cup_indice
controlla(not mancanti, f'CUP di coesione senza voce nell\'indice: {len(mancanti)} (es. {sorted(mancanti)[:3]})')

# appalti: una riga per CIG, nessun duplicato, stessi CIG dei file ANAC
cigs = [r['cig'] for r in CIG['cig']]
controlla(len(cigs) == len(set(cigs)), 'CIG duplicati nella lista appalti')
fonte = set()
for nome in ('anac_cig_palermo_2025.csv', 'anac_cig_palermo_2026.csv'):
    for r in csv.DictReader(open(os.path.join(BASE, 'dati', nome), encoding='utf-8'), delimiter=';'):
        fonte.add(r['cig'])
controlla(set(cigs) == fonte, f'CIG: {len(cigs)} nella lista, {len(fonte)} nei file ANAC')
controlla(all(r['progetto_id'] in set(ids) for r in CIG['cig'] if r['progetto_id']), 'un CIG punta a un progetto che non esiste')

if errori:
    print('CONTROLLI FALLITI:', len(errori))
    for e in errori:
        print(' -', e)
    sys.exit(1)

print(f'controlli superati: {len(ids)} voci ({len(op_ids)} opere, {len(PNRR)} schede PNRR, {len(coe)} CUP di coesione), {len(cigs)} CIG')
print(f'importo triennio delle opere: {tot_indice:,.2f} € = fonte')
