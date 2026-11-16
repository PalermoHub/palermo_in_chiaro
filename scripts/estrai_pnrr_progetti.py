"""Dettaglio dei 61 progetti PNRR del Comune di Palermo, con ministero, decreto e documenti.
Uso: python3 -I scripts/estrai_pnrr_progetti.py
Fonte: schede HTML gia' scaricate in dati/raw/pnrr_comune/schede/ (sito pnrr.comune.palermo.it).
Non stima nulla: un campo assente resta null. Nessuna localizzazione per circoscrizione:
il sito del Comune non la pubblica (vedi non_misura)."""
import glob, html, json, os, re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, 'dati/raw/pnrr_comune/schede')
ELENCO = os.path.join(BASE, 'dati/raw/pnrr_comune/elenco_missioni_20261116.html')
OUT = os.path.join(BASE, 'data/snapshot/pnrr_progetti.json')
ETICHETTE = {  # come le scrive il sito del Comune
    '1': 'Missione 1: Digitalizzazione, innovazione, competitività, cultura e turismo',
    '2': 'Missione 2: Rivoluzione verde e transizione ecologica',
    '3': 'Missione 3: Infrastrutture per una mobilità sostenibile',
    '4': 'Missione 4: Istruzione e ricerca',
    '5': 'Missione 5: Inclusione e coesione',
    '6': 'Altre e diverse misure',
}

def testo(h):
    h = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', h, flags=re.S)
    h = html.unescape(re.sub(r'<[^>]+>', '\n', h))
    return [l.strip() for l in h.split('\n') if l.strip()]

# Siti ufficiali dei soggetti proponenti, verificati con una richiesta HTTP il 16/11/2026.
# Due enti restano senza link: Citta' Metropolitana di Palermo (certificato scaduto) e
# Agenzia per la Coesione Territoriale (il sito non risponde). Non si inventano indirizzi.
PROPONENTI = {
    "ministero dell'istruzione e del merito": 'https://www.mim.gov.it/',
    'ministero del lavoro e delle politiche sociali': 'https://www.lavoro.gov.it/',
    "ministero dell'interno": 'https://www.interno.gov.it/',
    'dipartimento per gli affari interni e territoriali del ministero dell\'interno': 'https://dait.interno.gov.it/',
    'presidenza del consiglio dei ministri - dipartimento per la trasformazione digitale': 'https://innovazione.gov.it/',
    'ministro delle infrastrutture e della mobilità sostenibile': 'https://www.mit.gov.it/',
    "agenzia per l'italia digitale - agid": 'https://www.agid.gov.it/',
    'presidenza del consiglio dei ministri - dipartimento della funzione pubblica': 'https://www.funzionepubblica.gov.it/',
    'dipartimento per lo sport': 'https://www.sport.governo.it/',
    'comune di palermo': 'https://www.comune.palermo.it/',
    'agenzia per la cyber sicurezza nazionale': 'https://www.acn.gov.it/',
    'ministero della cultura': 'https://www.cultura.gov.it/',
}

def url_proponente(nome):
    chiave = re.sub(r'\s+', ' ', (nome or '')).strip().lower()
    return PROPONENTI.get(chiave)

ETICHETTE_CAMPI = {'Tipologia intervento:', 'Soggetto proponente:', 'Soggetto attuatore:', 'RUP:', 'CUP:',
                   'Importo finanziato:', 'Spesa rendicontata:', 'Area/Settore', 'Settore/Servizio',
                   'Stato avanzamento', 'Ammissione a Finanziamento', 'Scheda tecnica'}

def dopo(righe, etichetta):
    for i, l in enumerate(righe):
        if l == etichetta and i + 1 < len(righe):
            v = righe[i + 1]
            return '' if v in ETICHETTE_CAMPI else v
    return ''

def missioni_da_elenco():
    """id_scheda -> numero di missione, dall'elenco delle missioni del sito (stessa data delle schede)."""
    if not os.path.exists(ELENCO):
        return {}
    h = open(ELENCO, encoding='utf-8', errors='ignore').read()
    out = {}
    # il sito segna le missioni 1-5 con M1-..M5- e le "altre misure" con MV-
    for m in re.finditer(r'pnrr-palermo-progetto-scheda\.php\?id=(\d+)[^>]*>.*?<p>M(\d|V)-', h, flags=re.S):
        out[m.group(1)] = '6' if m.group(2) == 'V' else m.group(2)
    return out

def euro(s):
    s = re.sub(r'[^\d,.]', '', s or '')
    if not s:
        return None
    return round(float(s.replace('.', '').replace(',', '.')), 2)

def decreto(testo_righe):
    """Il primo decreto di ammissione a finanziamento citato nella scheda."""
    for i, l in enumerate(testo_righe):
        if l == 'Ammissione a Finanziamento':
            for k in range(i + 1, min(i + 4, len(testo_righe))):
                if testo_righe[k].lower().startswith('decreto'):
                    return re.sub(r'\s+', ' ', testo_righe[k])
    return None

def misura(righe):
    """Misura PNRR come scritta nella scheda (es. M2C2 I4.2), solo se compare."""
    m = re.search(r'\bM(\d)C(\d)\b(?:\s*[-\u2013]?\s*(?:I|Inv\.?)\s*(\d+(?:\.\d+)?))?', ' '.join(righe))
    if not m:
        return None
    base = f'M{m.group(1)}C{m.group(2)}'
    return base + (f' I{m.group(3)}' if m.group(3) else '')

def documenti(h, scheda_id):
    out = []
    for m in re.finditer(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', h, flags=re.S):
        href = html.unescape(m.group(1)).strip()
        titolo = re.sub(r'<[^>]+>', ' ', m.group(2))
        titolo = re.sub(r'\s+', ' ', html.unescape(titolo)).strip()
        if 'docs.comune.palermo.it' not in href or not titolo:
            continue
        out.append({'titolo': titolo, 'url': href})
    # dedup mantenendo l'ordine
    visti, unici = set(), []
    for d in out:
        if d['url'] not in visti:
            visti.add(d['url']); unici.append(d)
    return unici

missioni = missioni_da_elenco()
progetti = []
for f in sorted(glob.glob(SRC + '/*.html'), key=lambda x: int(os.path.basename(x)[:-5])):
    sid = os.path.basename(f)[:-5]
    raw = open(f, encoding='utf-8', errors='ignore').read()
    r = testo(raw)
    titolo = r[0].replace(' - Comune di Palermo', '') if r else ''
    stato = ''
    for i, l in enumerate(r):
        if l.startswith('Stato avanzamento'):
            stato = re.sub(r'\s+', ' ', ' '.join(r[i + 1:i + 3]).replace('\xa0', ' ')).strip(' :')
            stato = stato.split(' Scheda tecnica')[0].strip(' :')
            break
    cup = dopo(r, 'CUP:').strip() or None
    progetti.append({
        'id_scheda': sid,
        'titolo': titolo,
        'stato': stato or None,
        'cup': cup,
        'tipologia': dopo(r, 'Tipologia intervento:') or None,
        'area_settore': dopo(r, 'Area/Settore') or None,
        'servizio': dopo(r, 'Settore/Servizio') or None,
        'proponente': dopo(r, 'Soggetto proponente:') or None,
        'proponente_url': url_proponente(dopo(r, 'Soggetto proponente:')),
        'attuatore': dopo(r, 'Soggetto attuatore:') or None,
        'rup': dopo(r, 'RUP:') or None,
        'importo_finanziato_eur': euro(dopo(r, 'Importo finanziato:')),
        'spesa_rendicontata_eur': euro(dopo(r, 'Spesa rendicontata:')),
        'missione_n': missioni.get(sid) or None,
        'missione': ETICHETTE.get(missioni.get(sid)) if missioni.get(sid) else None,
        'misura_pnrr': misura(r),
        'decreto_finanziamento': decreto(r),
        'documenti': documenti(raw, sid),
        'url': f'https://pnrr.comune.palermo.it/pnrr-palermo-progetto-scheda.php?id={sid}',
    })

senza_cup = [p['id_scheda'] for p in progetti if not p['cup']]
senza_proponente = [p['id_scheda'] for p in progetti if not p['proponente']]
out = {
    'fonte': {
        'nome': 'Comune di Palermo, sito PNRR (schede dei progetti)',
        'ente': 'Comune di Palermo',
        'link': 'https://pnrr.comune.palermo.it/',
        'licenza': 'non dichiarata nelle pagine lette: si cita la fonte',
    },
    'periodo': 'Schede lette il 16/11/2026',
    'verificato': '2026-11-16',
    'misura': 'Dettaglio delle schede PNRR del Comune: importo finanziato, spesa rendicontata, stato dichiarato, ministero proponente, decreto di finanziamento e documenti pubblicati.',
    'non_misura': [
        'Il sito elenca 61 schede: non e\' detto che siano tutte le operazioni PNRR del Comune (OpenPNRR ne conta 52, il Comune ne dichiara 48 in un report). Il perimetro non e\' verificato.',
        'Importo finanziato e spesa rendicontata sono quelli dichiarati dal Comune nella scheda, non accertati da un terzo.',
        'Nessuna scheda riporta la circoscrizione: il PNRR non e\' attribuibile a un territorio dal solo sito del Comune.',
        'Il decreto e\' il primo citato tra gli step di ammissione a finanziamento: se la scheda ne cita piu\' di uno, gli altri restano nei documenti.',
    ],
    'conteggi': {
        'progetti': len(progetti),
        'con_cup': sum(1 for p in progetti if p['cup']),
        'con_decreto': sum(1 for p in progetti if p['decreto_finanziamento']),
        'con_missione': sum(1 for p in progetti if p['missione_n']),
        'con_misura': sum(1 for p in progetti if p['misura_pnrr']),
        'per_missione': {k: sum(1 for p in progetti if p['missione_n'] == k) for k in sorted(ETICHETTE, key=int)},
        'con_documenti': sum(1 for p in progetti if p['documenti']),
        'senza_cup': senza_cup,
        'senza_proponente': senza_proponente,
    },
    'progetti': sorted(progetti, key=lambda p: (-(p['importo_finanziato_eur'] or 0), p['titolo'])),
}
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(progetti), 'schede ->', OUT, os.path.getsize(OUT) // 1024, 'KB')
print('con CUP', out['conteggi']['con_cup'], 'con missione', out['conteggi']['con_missione'],
      'con decreto', out['conteggi']['con_decreto'], 'senza CUP', len(senza_cup))
print('per missione', out['conteggi']['per_missione'])
