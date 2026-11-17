"""Indice unico della ricerca globale del sito (data/ricerca.json).

Uso: python3 -I scripts/build_ricerca.py

La ricerca della testata (js/cerca.js) legge questo file al primo uso: non deve
scaricare gli snapshot interi per suggerire una pagina, una circoscrizione, un
quartiere, una UPL o un progetto. Le voci sono volutamente leggere: nome, tipo,
indirizzo, una riga di contesto e le parole chiave (CUP, CUI, quartieri, UPL,
sinonimi). Nessun importo e nessun dato personale: solo quello che serve a
portare l'utente sulla pagina giusta.

Va rigenerato quando cambiano le pagine statiche, data/progetti.json o i confini
in data/geo. Non è un file di servizio: data/ è pubblicato.
"""
import html
import json
import os
import re
from urllib.parse import quote

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, 'data/ricerca.json')
VERIFICATO = '2026-11-17'
ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']
NUM = {r: str(i + 1) for i, r in enumerate(ROM)}

PAGINE = [
    ('index.html', 'Home', 'Mappa, opere, bilancio, appalti, PNRR e coesione del Comune di Palermo',
     'home mappa circoscrizioni opere bilancio appalti pnrr coesione palermo soldi pubblici'),
    ('progetti.html', 'Elenco progetti', 'Tutti i progetti e i finanziamenti: opere, PNRR, coesione e appalti',
     'progetti finanziamenti elenco opere pnrr coesione appalti cup cui cig'),
    ('statistiche.html', 'Statistiche', 'Palermo al censimento 2021, le circoscrizioni e gli argomenti',
     'statistiche censimento dati grafici popolazione eta istruzione famiglie abitazioni stranieri lavoro'),
    ('fonti.html', 'Fonti', 'Le fonti una volta sola, con periodo, licenza e data di lettura',
     'fonti licenze dati istat anac opencoesione pnrr comune palermo'),
    ('guida.html', 'Guida', 'Come si usa il sito: la mappa, come si leggono i numeri, come si cercano progetti, finanziamenti e appalti',
     'guida come si usa aiuto leggere numeri cercare progetti finanziamenti appalti cig cup cui mappa circoscrizioni spiegazione'),
    ('metodo.html', 'Metodo e licenze', 'Come nascono i numeri, cosa non misurano e come segnalare un errore',
     'metodo licenze numeri limiti errori segnala'),
    ('privacy.html', 'Privacy e cookie', 'Quali dati tratta il sito, cookie e come cambiare la scelta',
     'privacy cookie gdpr dati personali google analytics consenso'),
]

# Sinonimi utili per le sezioni: chi cerca «case vuote» o «disoccupazione» deve
# arrivare al grafico giusto anche se il titolo non usa quella parola.
SINONIMI = {
    'popolazione': 'eta anziani giovani residenti piramide demografia',
    'istruzione': 'laurea laureati diploma scuola titolo di studio',
    'famiglie': 'single componenti nucleo familiare',
    'abitazioni': 'case vuote edifici occupate',
    'stranieri': 'immigrati cittadinanze ue extraue',
    'lavoro': 'occupazione disoccupazione tasso lavoro',
    'opere': 'lavori pubblici programmazione triennale importi',
    'bilancio': 'spesa entrate missioni previsione',
    'pnrr': 'finanziamenti piano nazionale ripresa resilienza',
    'coesione': 'fondi coesione opencoesione',
    'appalti': 'cig gare anac base gara',
    'quartieri': 'quartiere territorio upl',
    'per-circoscrizione': 'profilo circoscrizione confronto',
    'argomenti': 'argomento confronto otto circoscrizioni',
    'mappa': 'mappa carta territorio quartieri upl',
}

SEZIONI_CIRC = [
    ('soldi', 'Le opere programmate: quanto, quando, per cosa', 'opere lavori pubblici importi triennio'),
    ('territorio', 'Quartieri e UPL', 'quartieri upl territorio mappa'),
    ('progetti', 'Le voci che ricadono qui', 'progetti pnrr coesione cup cui appalti'),
    ('comune', 'Quello che il Comune non divide per circoscrizione', 'non attribuito comune citta bilancio pnrr coesione'),
]


def pulisci(testo):
    """Testo di un titolo HTML: via i tag, via gli spazi doppi."""
    testo = re.sub(r'<[^>]+>', ' ', testo)
    return re.sub(r'\s+', ' ', html.unescape(testo)).strip()


def attributi(tag):
    return dict(re.findall(r'([\w:-]+)\s*=\s*"([^"]*)"', tag))


def leggi_pagina(nome, titolo_pagina, descrizione, parole_pagina):
    percorso = os.path.join(BASE, nome)
    with open(percorso, encoding='utf-8') as f:
        testo = f.read()

    titoli = {}
    for m in re.finditer(r'<h([1-3])\b([^>]*)>(.*?)</h\1>', testo, re.S | re.I):
        attrs = attributi(m.group(2))
        if attrs.get('id'):
            titoli[attrs['id']] = pulisci(m.group(3))

    voci = [{
        't': 'pagina',
        'n': titolo_pagina,
        'u': nome,
        'd': descrizione,
        'k': parole_pagina,
    }]
    gia = set()
    etichette = set()

    # Le sezioni con id e aria-labelledby sono le destinazioni stabili delle ancore.
    for m in re.finditer(r'<section\b([^>]*)>', testo, re.I):
        attrs = attributi(m.group(1))
        sid, label = attrs.get('id'), attrs.get('aria-labelledby')
        if not sid or not label or label not in titoli:
            continue
        nome_sezione = titoli[label]
        etichette.add(label)
        chiavi = ' '.join(filter(None, [nome_sezione, SINONIMI.get(sid, '')]))
        voci.append({
            't': 'sezione',
            'n': nome_sezione,
            'u': f'{nome}#{sid}',
            'd': f'{titolo_pagina} · in questa pagina',
            'k': chiavi,
        })
        gia.add(sid)

    # I titoli con id che non sono già coperti da una sezione (metodo, privacy, fonti).
    for hid, nome_sezione in titoli.items():
        if hid in gia or hid in etichette:
            continue
        voci.append({
            't': 'sezione',
            'n': nome_sezione,
            'u': f'{nome}#{hid}',
            'd': f'{titolo_pagina} · in questa pagina',
            'k': ' '.join(filter(None, [nome_sezione, SINONIMI.get(hid, '')])),
        })
    return voci


def voce_progetto(p):
    dove = []
    if p.get('circoscrizioni'):
        dove.append('Circoscrizione ' + ', '.join(p['circoscrizioni']))
    if p.get('quartieri'):
        dove.append('Quartiere ' + ', '.join(p['quartieri'][:2]) + ('…' if len(p['quartieri']) > 2 else ''))
    if p.get('upl') and not p.get('quartieri'):
        dove.append('UPL ' + ', '.join(p['upl'][:2]) + ('…' if len(p['upl']) > 2 else ''))
    fonti = ', '.join({'opere': 'Opere', 'pnrr': 'PNRR', 'coesione': 'Coesione', 'appalti': 'Appalti'}.get(f, f) for f in p.get('fonti', []))
    if fonti:
        dove.append(fonti)
    if p.get('cup'):
        dove.append('CUP ' + p['cup'])

    chiavi = [p.get('id'), p.get('cup'), p.get('cui')]
    chiavi += p.get('quartieri', []) + p.get('upl', []) + p.get('circoscrizioni', []) + p.get('fonti', [])
    return {
        't': 'progetto',
        'n': p['titolo'],
        'u': 'progetto.html?id=' + quote(p['id'], safe=''),
        'd': ' · '.join(dove) or 'Progetto senza territorio indicato',
        'k': ' '.join(str(x) for x in chiavi if x),
    }


def scrivi():
    geo = json.load(open(os.path.join(BASE, 'data/geo/circoscrizioni.json'), encoding='utf-8'))['circoscrizioni']
    progetti = json.load(open(os.path.join(BASE, 'data/progetti.json'), encoding='utf-8'))['progetti']

    voci = []
    for nome, titolo, descrizione, parole in PAGINE:
        voci += leggi_pagina(nome, titolo, descrizione, parole)

    # Circoscrizioni, quartieri e UPL: le stesse destinazioni dei filtri dell'elenco.
    quartieri = {}
    upl = {}
    for rom in ROM:
        g = geo[rom]
        for q in g.get('quartieri', []):
            quartieri.setdefault(q, set()).add(rom)
        for q, lista in (g.get('upl') or {}).items():
            for u in lista:
                upl.setdefault(u, set()).add(rom)

    for rom in ROM:
        g = geo[rom]
        tutte_upl = [u for lista in (g.get('upl') or {}).values() for u in lista]
        voci.append({
            't': 'circoscrizione',
            'n': f'Circoscrizione {rom}',
            'u': f'circoscrizione/{NUM[rom]}/',
            'd': ' · '.join(g.get('quartieri', [])),
            'k': ' '.join(g.get('quartieri', []) + tutte_upl + [f'circoscrizione {NUM[rom]}', rom]),
        })
        for sid, nome, chiavi in SEZIONI_CIRC:
            voci.append({
                't': 'sezione',
                'n': f'Circoscrizione {rom} · {nome}',
                'u': f'circoscrizione/{NUM[rom]}/#{sid}',
                'd': 'Circoscrizione ' + rom,
                'k': ' '.join([nome, chiavi, 'Circoscrizione ' + rom] + g.get('quartieri', [])),
            })

    for nome, circs in sorted(quartieri.items()):
        voci.append({
            't': 'quartiere',
            'n': nome,
            'u': 'progetti.html?quartiere=' + quote(nome, safe=''),
            'd': 'Quartiere · Circoscrizione ' + ', '.join(sorted(circs, key=ROM.index)),
            'k': 'quartiere ' + nome + ' ' + ' '.join(circs),
        })

    for nome, circs in sorted(upl.items()):
        voci.append({
            't': 'upl',
            'n': nome,
            'u': 'progetti.html?upl=' + quote(nome, safe=''),
            'd': 'UPL · Circoscrizione ' + ', '.join(sorted(circs, key=ROM.index)),
            'k': 'upl unita di pianificazione locale ' + nome + ' ' + ' '.join(circs),
        })

    # Argomenti delle statistiche: il titolo del grafico non sempre usa la parola cercata.
    for nome, chiavi in [
        ('Popolazione ed età', 'popolazione eta piramide anziani giovani residenti demografia'),
        ('Titolo di studio', 'istruzione laurea laureati diploma scuola'),
        ('Famiglie', 'famiglie single componenti nucleo'),
        ('Abitazioni', 'case abitazioni vuote occupate edifici'),
        ('Stranieri', 'stranieri immigrati cittadinanze ue extraue'),
        ('Lavoro e occupazione', 'lavoro occupazione disoccupazione tasso'),
        ('Bilancio del Comune', 'bilancio spesa entrate missioni previsione'),
        ('PNRR', 'pnrr finanziamenti piano nazionale ripresa resilienza'),
        ('Fondi di coesione', 'coesione fondi opencoesione'),
        ('Appalti', 'appalti cig gare anac base gara'),
        ('Opere programmate', 'opere lavori pubblici triennio importi'),
    ]:
        voci.append({
            't': 'argomento',
            'n': nome,
            'u': 'statistiche.html#argomenti',
            'd': 'Statistiche · argomento per argomento',
            'k': chiavi,
        })

    voci += [voce_progetto(p) for p in progetti]

    out = {
        'fonte': 'Pagine statiche del sito, data/progetti.json, data/geo/circoscrizioni.json',
        'verificato': VERIFICATO,
        'misura': 'Solo parole chiave e indirizzi: la ricerca non scarica gli snapshot interi.',
        'voci': voci,
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print(f'scritte {len(voci)} voci in {os.path.relpath(OUT, BASE)}')
    print('progetti:', sum(1 for v in voci if v['t'] == 'progetto'),
          '· quartieri:', sum(1 for v in voci if v['t'] == 'quartiere'),
          '· UPL:', sum(1 for v in voci if v['t'] == 'upl'))


if __name__ == '__main__':
    scrivi()
