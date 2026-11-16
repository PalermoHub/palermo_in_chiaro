"""Estrae le schede del sito PNRR del Comune di Palermo in un CSV.
Uso: python3 -I scripts/parse_pnrr_comune.py
Non stima nulla: un campo assente resta vuoto."""
import csv, glob, html, os, re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, 'dati/raw/pnrr_comune/schede')
OUT = os.path.join(BASE, 'dati/pnrr_comune_palermo.csv')

def testo(h):
    h = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', h, flags=re.S)
    h = html.unescape(re.sub(r'<[^>]+>', '\n', h))
    return [l.strip() for l in h.split('\n') if l.strip()]

def dopo(righe, etichetta):
    for i, l in enumerate(righe):
        if l == etichetta and i + 1 < len(righe):
            return righe[i + 1]
    return ''

def euro(s):
    s = re.sub(r'[^\d,.]', '', s)
    if not s: return ''
    return s.replace('.', '').replace(',', '.')

rows = []
for f in sorted(glob.glob(SRC + '/*.html'), key=lambda x: int(os.path.basename(x)[:-5])):
    r = testo(open(f, encoding='utf-8', errors='ignore').read())
    titolo = r[0].replace(' - Comune di Palermo', '') if r else ''
    stato = ''
    for i, l in enumerate(r):
        if l.startswith('Stato avanzamento'):
            resto = ' '.join(r[i + 1:i + 3])
            stato = re.sub(r'\s+', ' ', resto.replace('\xa0', ' ')).strip(' :')
            stato = stato.split(' Scheda tecnica')[0].strip(' :')
            break
    rows.append({
        'id_scheda': os.path.basename(f)[:-5], 'titolo': titolo, 'stato': stato,
        'area_settore': dopo(r, 'Area/Settore'), 'servizio': dopo(r, 'Settore/Servizio'),
        'tipologia': dopo(r, 'Tipologia intervento:'), 'proponente': dopo(r, 'Soggetto proponente:'),
        'attuatore': dopo(r, 'Soggetto attuatore:'), 'rup': dopo(r, 'RUP:'),
        'cup': dopo(r, 'CUP:'), 'importo_finanziato_eur': euro(dopo(r, 'Importo finanziato:')),
        'spesa_rendicontata_eur': euro(dopo(r, 'Spesa rendicontata:')),
        'url': f'https://pnrr.comune.palermo.it/pnrr-palermo-progetto-scheda.php?id={os.path.basename(f)[:-5]}'})
with open(OUT, 'w', encoding='utf-8', newline='') as o:
    w = csv.DictWriter(o, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
print(len(rows), 'schede ->', OUT)
