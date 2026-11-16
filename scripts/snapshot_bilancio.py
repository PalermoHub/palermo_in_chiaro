"""Snapshot bilancio di previsione 2026-2028 del Comune di Palermo, per missione e programma.
Fonte: Allegato A al bilancio (delibera CC n. 176 del 26/05/2026). Uso: python3 -I scripts/snapshot_bilancio.py
Si ferma se le somme dei programmi, delle missioni e dei titoli non tornano col totale generale della fonte."""
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
out = {
    'fonte': {'nome': 'Comune di Palermo, Bilancio di previsione 2026/2028, Allegato A (delibera CC n. 176 del 26/05/2026)', 'ente': 'Comune di Palermo, Ragioneria Generale',
              'link': 'https://repository.comune.palermo.it/bilancio-rendiconti.php?id=1&per=2026%2F2028', 'licenza': 'non dichiarata nella pagina dei bilanci del Comune: atto pubblico, si cita la fonte'},
    'periodo': 'Competenza 2026, 2027 e 2028; cassa 2026', 'verificato': '2026-11-16',
    'misura': 'Stanziamenti di spesa del Comune di Palermo per missione e programma. Sono previsioni, non spesa effettiva.',
    'non_misura': ['La circoscrizione: il bilancio non ha capitoli per circoscrizione. Il testo di bilancio e dei suoi allegati non cita le circoscrizioni; il DUP le descrive solo come territorio.',
                   'I pagamenti: SIOPE tratta il Comune come un solo ente e questo bilancio è di previsione.',
                   'Le spese delle società partecipate e della Regione in città.',
                   'Le previsioni di competenza comprendono il fondo pluriennale vincolato e possono cambiare con le variazioni di bilancio (la più recente trovata è di luglio 2026).'],
    'disavanzo_di_amministrazione': dict(zip(('2026', '2027', '2028'), disavanzo)),
    'totale_spese_competenza': {'2026': tot_gen[1], '2027': tot_gen[2], '2028': tot_gen[3]},
    'missioni': {k: dict(v, programmi={p.split('.')[1]: pv for p, pv in prog.items() if pv['missione'] == k}) for k, v in sorted(miss.items())},
    'senza_cassa_nel_testo_estratto': senza_cassa,
}
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('ok:', len(miss), 'missioni,', len(prog), 'programmi; totale 2026 %.2f M€' % (tot_gen[1] / 1e6), '-> controlli di somma superati')
for k, v in sorted(miss.items(), key=lambda kv: -kv[1]['competenza_2026'])[:8]:
    print(k, v['nome'][:48].ljust(48), '%.1f M' % (v['competenza_2026'] / 1e6), 'cassa', '%.1f' % (v.get('cassa_2026', 0) / 1e6))
print('senza cassa:', senza_cassa)
