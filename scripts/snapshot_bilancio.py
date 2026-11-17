"""Snapshot bilancio di previsione 2026-2028 del Comune di Palermo: spese per missione e programma,
entrate per titolo (più FPV e avanzo), accanto ai residenti per il calcolo pro capite.
Fonte: Allegato A al bilancio (delibera CC n. 176 del 26/05/2026). Uso: python3 -I scripts/snapshot_bilancio.py
Si ferma se le somme dei programmi, delle missioni e dei titoli non tornano col totale generale della fonte,
e se le due facciate del bilancio (entrate e spese) non chiudono sullo stesso totale."""
import json, os, re
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, 'dati/raw/bilancio/2026-2028/01_Allegato_A_bilancio_pluriennale.txt')
OUT = os.path.join(BASE, 'data/snapshot/bilancio_comune.json')
num = lambda s: float(s.replace('.', '').replace(',', '.'))
N = r'(-?[\d.]+,\d\d)'
L = open(SRC, encoding='utf-8').read().split('\n')
ini = next(i for i, l in enumerate(L) if re.search(r'MISSIONE\s+01\s+SERVIZI ISTITUZIONALI', l))
fine = next(i for i, l in enumerate(L) if 'TOTALE GENERALE DELLE SPESE' in l and i > ini)
tot_gen = re.search(r'competenza\s+' + N + r'\s+' + N + r'\s+' + N + r'\s+' + N, L[fine])
tot_gen = [num(x) for x in tot_gen.groups()]           # 2025 def., 2026, 2027, 2028
miss, prog = {}, {}
cur_m = cur_p = None
# il disavanzo di amministrazione sta nella pagina delle spese, prima della prima missione
_d = next(re.match(r'\s*DISAVANZO DI AMMINISTRAZIONE\s+' + N + r'\s+' + N + r'\s+' + N + r'\s+' + N, l)
          for l in L[:ini] if re.match(r'\s*DISAVANZO DI AMMINISTRAZIONE\s+' + N, l) and L.index(l) > ini - 40)
disavanzo = [num(x) for x in _d.groups()[1:]]      # 2026, 2027, 2028
cassa_target = None
for i in range(ini, fine):
    l = L[i]
    m = re.match(r'\s*DISAVANZO DI AMMINISTRAZIONE\s+' + N + r'\s+' + N + r'\s+' + N + r'\s+' + N, l)
    if m: continue
    m = re.match(r'\s*MISSIONE\s+(\d\d)\s+(.+?)\s*$', l)
    if m: cur_m = m.group(1); miss.setdefault(cur_m, {'nome': m.group(2).strip()}); continue
    m = re.match(r'\s*\d{4}\s+Programma\s+(\d\d)\s+(.+?)\s*$', l)
    if m: cur_p = cur_m + '.' + m.group(1); prog.setdefault(cur_p, {'missione': cur_m, 'nome': m.group(2).strip()}); continue
    m = re.match(r'\s*Totale programma\s+(\d\d)\s+.*?\s+' + N + r'\s+previsione di competenza\s+' + N + r'\s+' + N + r'\s+' + N + r'\s+' + N, l)
    if m:
        v = [num(x) for x in m.groups()[2:]]
        d = prog[cur_m + '.' + m.group(1)]
        for a, x in zip(('2026', '2027', '2028'), v[1:]): d['competenza_' + a] = d.get('competenza_' + a, 0.0) + x
        cassa_target = ('p', cur_m + '.' + m.group(1)); continue
    m = re.match(r'\s*Totale MISSIONE\s+(\d\d)\s+.*?\s+' + N + r'\s+previsione di competenza\s+' + N + r'\s+' + N + r'\s+' + N + r'\s+' + N, l)
    if m:
        v = [num(x) for x in m.groups()[2:]]
        d = miss[m.group(1)]
        for a, x in zip(('2026', '2027', '2028'), v[1:]): d['competenza_' + a] = d.get('competenza_' + a, 0.0) + x
        cassa_target = ('m', m.group(1)); continue
    m = re.match(r'\s*previsione di cassa\s+' + N + r'(?:\s+' + N + r')?\s*$', l)
    if m and cassa_target:
        k, key = cassa_target
        dd = (prog if k == 'p' else miss)[key]; dd['cassa_2026'] = dd.get('cassa_2026', 0.0) + num(m.group(2) or m.group(1)); cassa_target = None
# controlli
for a in ('2026', '2027', '2028'):
    s = round(sum(v['competenza_' + a] for v in miss.values()) + disavanzo[{'2026': 0, '2027': 1, '2028': 2}[a]], 2)
    t = tot_gen[{'2026': 1, '2027': 2, '2028': 3}[a]]
    assert abs(s - t) < 0.05, ('missioni', a, s, t)
    for mk, mv in miss.items():
        sp = round(sum(p['competenza_' + a] for p in prog.values() if p['missione'] == mk), 2)
        assert abs(sp - mv['competenza_' + a]) < 0.05, ('programmi', mk, a, sp, mv['competenza_' + a])
senza_cassa = [k for k, v in list(miss.items()) + list(prog.items()) if 'cassa_2026' not in v]

# --- entrate: stessa Allegato A, sezione ENTRATE (titoli, FPV e avanzo, due tipologie in evidenza) ---
TITOLI = {'1': 'Entrate correnti di natura tributaria, contributiva e perequativa', '2': 'Trasferimenti correnti',
          '3': 'Entrate extratributarie', '4': 'Entrate in conto capitale',
          '5': 'Entrate da riduzione di attività finanziarie', '6': 'Accensione prestiti',
          '7': 'Anticipazioni da istituto tesoriere/cassiere', '9': 'Entrate per conto terzi e partite di giro'}
FONDI = {'Fondo Pluriennale Vincolato per Spese Correnti': 'fpv_spese_correnti',
         'Fondo Pluriennale Vincolato per Spese in Conto Capitale': 'fpv_conto_capitale',
         'Utilizzo avanzo di Amministrazione': 'avanzo_di_amministrazione'}
# due tipologie che valgono da sole una lettura: nome ufficiale per esteso (nel testo estratto è spezzato su più righe)
EVIDENZA = {'30200': ('proventi_da_controllo', "Proventi derivanti dall'attività di controllo e repressione delle irregolarità e degli illeciti"),
           '40200': ('contributi_agli_investimenti', 'Contributi agli investimenti')}
E = r'(?:-|-?[\d.]+,\d\d)'
EC = r'(-|-?[\d.]+,\d\d)'   # come E, ma con i gruppi: serve per leggere la cassa
ne = lambda s: 0.0 if s.strip() in ('-', '') else num(s)
norm = lambda s: re.sub(r'[^A-Z0-9]', '', s.upper())
fine_e = next(i for i, l in enumerate(L) if 'TOTALE GENERALE DELLE ENTRATE' in l)
tit, tip, fondi = {}, {}, {}
tot_titoli = tot_entrate = None
trovate = 0
for i, l in enumerate(L[:fine_e + 1]):
    m = re.match(r'\s*(' + '|'.join(map(re.escape, FONDI)) + r')\s+Previsioni di competenza\s+' + r'\s+'.join([EC] * 4) + r'\s*$', l)
    if m:
        fondi[FONDI[m.group(1)]] = dict(zip(('2026', '2027', '2028'), (ne(x) for x in m.groups()[-3:]))); continue
    m = re.match(r'\s*(\d{5})\s+Tipologia\s+(\d{3}):\s*(.+?)\s{2,}' + EC + r'\s+previsione di competenza\s+' + r'\s+'.join([EC] * 4) + r'\s*$', l)
    if m:
        trovate += 1
        cassa = None
        for j in (i + 1, i + 2, i + 3):
            c = re.search(r'previsione di cassa\s+' + EC + r'\s+' + EC, L[j]) if j < len(L) else None
            if c: cassa = ne(c.group(2)); break
        tip[m.group(1)] = dict({'nome': re.sub(r'\s+', ' ', m.group(3)).strip(), 'cassa_2026': cassa},
                               **dict(zip(('competenza_2026', 'competenza_2027', 'competenza_2028'), (ne(x) for x in m.groups()[-3:]))))
        continue
    m = re.match(r'\s*\d{5}\s+Totale TITOLO (\d)\s+(.+?)\s{2,}' + EC + r'\s+previsione di competenza\s+' + r'\s+'.join([EC] * 4) + r'\s*$', l)
    if m:
        k, nome = m.group(1), m.group(2)
        assert norm(nome).startswith(norm(TITOLI[k])[:24]), ('titolo inatteso', k, nome)
        c = re.search(r'previsione di cassa\s+' + EC + r'\s+' + EC, L[i + 1])
        tit[k] = dict({'nome': TITOLI[k], 'cassa_2026': ne(c.group(2))},
                      **dict(zip(('competenza_2026', 'competenza_2027', 'competenza_2028'), (ne(x) for x in m.groups()[-3:]))))
        continue
    m = re.match(r'\s*TOTALE TITOLI\s+' + EC + r'\s+previsione di competenza\s+' + r'\s+'.join([EC] * 4), l)
    if m: tot_titoli = [ne(x) for x in m.groups()[-3:]]; continue
    m = re.match(r'\s*TOTALE GENERALE DELLE ENTRATE\s+' + EC + r'\s+previsione di competenza\s+' + r'\s+'.join([EC] * 4), l)
    if m: tot_entrate = [ne(x) for x in m.groups()[-3:]]; continue
for n, a in enumerate(('2026', '2027', '2028')):
    s = round(sum(v['competenza_' + a] for v in tit.values()), 2)
    assert abs(s - tot_titoli[n]) < 0.05, ('titoli di entrata', a, s, tot_titoli[n])
    s = round(s + sum(v[a] for v in fondi.values()), 2)
    assert abs(s - tot_entrate[n]) < 0.05, ('entrate', a, s, tot_entrate[n])
    assert abs(tot_entrate[n] - tot_gen[n + 1]) < 0.05, ('le due facciate non chiudono', a, tot_entrate[n], tot_gen[n + 1])
assert set(tit) == set(TITOLI), ('titoli mancanti', sorted(set(TITOLI) - set(tit)))
assert trovate == sum(1 for l in L[:fine_e + 1] if re.search(r'\bTipologia\s+\d{3}:', l)), 'tipologie non lette tutte'
assert set(EVIDENZA) <= set(tip), ('tipologie in evidenza assenti', sorted(set(EVIDENZA) - set(tip)))
for k, (_, nome) in EVIDENZA.items():
    assert norm(EVIDENZA[k][1]).startswith(norm(tip[k]['nome'])[:20]), ('tipologia inattesa', k, tip[k]['nome'])
    tip[k]['nome'] = nome
entrate = {
    'fonte': {'nome': 'Comune di Palermo, Bilancio di previsione 2026/2028, Allegato A, sezione Entrate (delibera CC n. 176 del 26/05/2026)',
              'ente': 'Comune di Palermo, Ragioneria Generale',
              'link': 'https://repository.comune.palermo.it/bilancio-rendiconti.php?id=1&per=2026%2F2028',
              'licenza': 'non dichiarata nella pagina dei bilanci del Comune: atto pubblico, si cita la fonte'},
    'misura': 'Previsioni di accertamento (competenza) e di cassa delle entrate, per titolo; fondo pluriennale vincolato e avanzo di amministrazione che finanziano la spesa. La somma dei titoli e dei fondi è il totale generale delle entrate, uguale al totale generale delle spese.',
    'titoli': {k: tit[k] for k in sorted(tit)},
    'fondi': fondi,
    'totale_titoli': dict(zip(('2026', '2027', '2028'), tot_titoli)),
    'totale_generale': dict(zip(('2026', '2027', '2028'), tot_entrate)),
    'evidenza': {EVIDENZA[k][0]: tip[k] for k in EVIDENZA},
}
# residenti per il pro capite: stima comunale 2024 (Repertorio statistico) e censimento 2021, come in snapshot_statistiche.py
popolazione = {'residenti_2024': 628693, 'residenti_censimento_2021': 635439,
               'fonte': 'Comune di Palermo, Ufficio statistica, Repertorio statistico 2024; ISTAT, censimento 2021',
               'nota': 'La stima 2024 non ha il dettaglio per circoscrizione: qui serve solo a dividere le cifre comunali per gli abitanti.'}
out = {
    'fonte': {'nome': 'Comune di Palermo, Bilancio di previsione 2026/2028, Allegato A (delibera CC n. 176 del 26/05/2026)', 'ente': 'Comune di Palermo, Ragioneria Generale',
              'link': 'https://repository.comune.palermo.it/bilancio-rendiconti.php?id=1&per=2026%2F2028', 'licenza': 'non dichiarata nella pagina dei bilanci del Comune: atto pubblico, si cita la fonte'},
    'periodo': 'Competenza 2026, 2027 e 2028; cassa 2026', 'verificato': '2026-11-17',
    'misura': 'Stanziamenti di spesa del Comune di Palermo per missione e programma, e previsioni di entrata per titolo. Sono previsioni, non spesa effettiva.',
    'non_misura': ['La circoscrizione: il bilancio non ha capitoli per circoscrizione. Il testo di bilancio e dei suoi allegati non cita le circoscrizioni; il DUP le descrive solo come territorio.',
                   'I pagamenti: SIOPE tratta il Comune come un solo ente e questo bilancio è di previsione.',
                   'Le spese delle società partecipate e della Regione in città.',
                   'Le previsioni di competenza comprendono il fondo pluriennale vincolato e possono cambiare con le variazioni di bilancio (la più recente trovata è di luglio 2026).',
                   'Gli incassi: le entrate sono previsioni di accertamento e di cassa, non soldi riscossi; la cassa del 2026 porta dentro anche i residui degli anni passati.'],
    'disavanzo_di_amministrazione': dict(zip(('2026', '2027', '2028'), disavanzo)),
    'totale_spese_competenza': {'2026': tot_gen[1], '2027': tot_gen[2], '2028': tot_gen[3]},
    'missioni': {k: dict(v, programmi={p.split('.')[1]: pv for p, pv in prog.items() if pv['missione'] == k}) for k, v in sorted(miss.items())},
    'entrate': entrate,
    'popolazione': popolazione,
    'senza_cassa_nel_testo_estratto': senza_cassa,
}
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('ok:', len(miss), 'missioni,', len(prog), 'programmi; totale 2026 %.2f M€' % (tot_gen[1] / 1e6), '-> controlli di somma superati')
print('entrate 2026: ' + ' + '.join('%s %.1f M' % (k, v['competenza_2026'] / 1e6) for k, v in sorted(tit.items()))
      + ' + fondi %.1f M = %.1f M' % (sum(v['2026'] for v in fondi.values()) / 1e6, tot_entrate[0] / 1e6))
print('in evidenza:', ', '.join('%s %.1f M di competenza, %.1f M di cassa' % (k, v['competenza_2026'] / 1e6, (v['cassa_2026'] or 0) / 1e6) for k, v in entrate['evidenza'].items()))
for k, v in sorted(miss.items(), key=lambda kv: -kv[1]['competenza_2026'])[:8]:
    print(k, v['nome'][:48].ljust(48), '%.1f M' % (v['competenza_2026'] / 1e6), 'cassa', '%.1f' % (v.get('cassa_2026', 0) / 1e6))
print('senza cassa:', senza_cassa)
