/* Palermo in chiaro: prototipo. Legge gli snapshot in data/snapshot e disegna mappa, schede e barre. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  const it = (n, d = 0) => n == null ? 'non disponibile' : n.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
  const mln = (n, d = 1) => it(n / 1e6, d) + ' M€';
  const pct = (n) => it(n, 1) + '%';
  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs = {}, kids = []) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (k === 'text') e.textContent = v; else e.setAttribute(k, v); }
    for (const c of [].concat(kids)) if (c) e.append(c);
    return e;
  };

  const FILES = { geo: 'data/geo/circoscrizioni.json', prof: 'data/snapshot/profilo_circoscrizioni.json', opere: 'data/snapshot/opere_circoscrizioni.json',
    bil: 'data/snapshot/bilancio_comune.json', app: 'data/snapshot/appalti_comune.json', pnrr: 'data/snapshot/pnrr_comune.json', coe: 'data/snapshot/coesione_comune.json',
    rgs: 'data/missioni_rgs.json' };

  // altezza reale della testata (va a capo su schermi stretti): serve per far stare la mappa nello schermo
  const testata = document.querySelector('.testata');
  const misura = () => document.documentElement.style.setProperty('--testata', testata.offsetHeight + 'px');
  misura(); new ResizeObserver(misura).observe(testata);

  Promise.all(Object.entries(FILES).map(([k, u]) => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); }).then(j => [k, j])))
    .then(p => avvia(Object.fromEntries(p)))
    .catch(() => {
      const a = $('avviso-locali'); a.hidden = false;
      a.textContent = 'I dati non si caricano. Se hai aperto il file direttamente, avvia un server locale: python3 -m http.server 8000, poi apri http://localhost:8000.';
    });

  function avvia(D) {
    const idx = (c) => String(ROM.indexOf(c) + 1);
    const P = (c) => D.prof.valori[idx(c)], O = (c) => D.opere.valori[idx(c)];
    const nonLoc = D.opere.non_localizzato, tot = D.opere.totale_palermo;

    /* indicatori della mappa */
    const IND = [
      { id: 'res', nome: 'Residenti', val: c => P(c).residenti, f: n => it(n), nota: 'Residenti al censimento 2021 (ISTAT).' },
      { id: 'den', nome: 'Densità', val: c => P(c).densita_ab_kmq, f: n => it(n) + ' ab/km²', nota: 'Residenti 2021 per km² di superficie della circoscrizione.' },
      { id: 'anz', nome: 'Over 65', val: c => P(c).quota_65_piu_pct, f: pct, nota: 'Quota di residenti con 65 anni o più, censimento 2021.' },
      { id: 'str', nome: 'Stranieri', val: c => P(c).quota_stranieri_pct, f: pct, nota: 'Quota di stranieri residenti, censimento 2021.' },
      { id: 'ope', nome: 'Opere programmate', val: c => O(c).importo_triennio_eur, f: n => mln(n, 0), nota: 'Importo 2026-2028 degli interventi con una sola circoscrizione. Non comprende il 47% dell\'importo, che non ha circoscrizione (vedi Opere).' },
      { id: 'opr', nome: 'Opere per residente', val: c => O(c).importo_triennio_per_residente_eur, f: n => it(n) + ' €', nota: 'Importo 2026-2028 diviso per i residenti 2021. Parziale: il 47% dell\'importo non ha circoscrizione.' },
    ];
    let ind = IND[0], sel = null, selProj = null, layerOn = false, PR = null;
    let PROG = null, progStato = 'idle', qProg = '';   // elenco completo dei progetti, caricato alla prima circoscrizione scelta
    let progGeoStato = 'idle';                         // posizioni dei progetti per la mappa

    /* selettore */
    const sg = $('selettore');
    IND.forEach(i => {
      const b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(i === ind), text: i.nome });
      b.addEventListener('click', () => { ind = i; sg.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', String(x === b))); colora(); });
      sg.append(b);
    });

    /* mappa */
    const svg = $('mappa-svg'); const [, , W, H] = D.geo.viewBox;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.style.setProperty('--k', 1);
    const gruppi = {};
    ROM.forEach(c => {
      const g = D.geo.circoscrizioni[c];
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', g.d); p.setAttribute('class', 'circ'); p.setAttribute('tabindex', '0'); p.setAttribute('role', 'button');
      p.setAttribute('aria-pressed', 'false'); p.setAttribute('aria-label', `Circoscrizione ${c}`);
      p.addEventListener('click', (ev) => { const id = progettoSotto(ev); if (id) apriProgetto(id); else scegli(c, true); });
      p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scegli(c, true); } });
      svg.append(p);
      gruppi[c] = { p };
    });
    const SPOSTA = { VIII: [-12, 100] };   // il baricentro cade sul bordo: sposta l'etichetta dentro l'area
    ROM.forEach(c => {
      const g = Object.assign({}, D.geo.circoscrizioni[c]);
      if (SPOSTA[c]) { g.cx += SPOSTA[c][0]; g.cy += SPOSTA[c][1]; }
      const t1 = document.createElementNS(NS, 'text'), t2 = document.createElementNS(NS, 'text');
      t1.setAttribute('x', g.cx); t1.setAttribute('y', g.cy - 4); t1.setAttribute('class', 'etichetta'); t1.textContent = c;
      t2.setAttribute('x', g.cx); t2.setAttribute('y', g.cy + 26); t2.setAttribute('class', 'valore');
      svg.append(t1, t2); gruppi[c].t1 = t1; gruppi[c].t2 = t2;
    });

    function mix(a, b, t) { return a.map((x, i) => Math.round(x + (b[i] - x) * t)); }
    function colora() {
      const cs = getComputedStyle(document.documentElement);
      const hex = (v) => { const s = cs.getPropertyValue(v).trim().replace('#', ''); return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16)); };
      const c0 = hex('--s0'), c4 = hex('--s4');
      const vals = ROM.map(c => ind.val(c)), mn = Math.min(...vals), mx = Math.max(...vals);
      ROM.forEach(c => {
        const t = mx === mn ? 0.5 : (ind.val(c) - mn) / (mx - mn), rgb = mix(c0, c4, t);
        gruppi[c].p.style.fill = `rgb(${rgb})`;
        const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255, txt = lum > 0.55 ? '#0f2233' : '#ffffff';
        gruppi[c].t1.style.fill = txt; gruppi[c].t2.style.fill = txt;
        gruppi[c].t1.style.stroke = 'none'; gruppi[c].t2.textContent = ind.f(ind.val(c));
        gruppi[c].p.setAttribute('aria-label', `Circoscrizione ${c}: ${ind.nome} ${ind.f(ind.val(c))}`);
      });
      $('mappa-nota').textContent = ind.nota;
      $('legenda').replaceChildren(el('span', { text: ind.f(mn) }), el('span', { class: 'scala' }), el('span', { text: ind.f(mx) }));
      legendaProgetti();
    }

    /* scheda */
    function scegli(c, scorri) {
      /* un secondo clic sulla stessa circoscrizione riporta a tutta la città */
      if (c === sel && !selProj && scorri) { deseleziona(); return; }
      sel = c; selProj = null; qProg = ''; evidenziaProgetto();
      ROM.forEach(x => gruppi[x].p.setAttribute('aria-pressed', String(x === c)));
      document.querySelectorAll('#opere-barre .barra').forEach(b => b.removeAttribute('aria-current'));
      const b = document.querySelector(`#opere-barre .barra[data-c="${c}"]`); if (b) b.setAttribute('aria-current', 'true');
      tutta.hidden = false;
      /* sulla mappa restano i progetti di questa circoscrizione, dentro il suo poligono */
      if (!layerOn) accendiProgetti();
      else { aggiornaVisibilitaProgetti(); zoomA(c); scheda(); }
      /* su schermo stretto la scheda sta sotto la mappa: senza questo resta fuori vista */
      if (scorri && matchMedia('(max-width: 900px)').matches) {
        $('scheda').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    }

    /* dalle barre delle opere: circoscrizione sulla mappa e scheda, senza cambiare pagina */
    function mostraCircoscrizione(c) {
      scegli(c, false);
      document.querySelector('.mappa-blocco').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }

    function deseleziona() {
      sel = null; selProj = null; qProg = ''; evidenziaProgetto();
      ROM.forEach(x => gruppi[x].p.setAttribute('aria-pressed', 'false'));
      document.querySelectorAll('#opere-barre .barra').forEach(b => b.removeAttribute('aria-current'));
      tutta.hidden = true;
      zoomA(null, true); aggiornaVisibilitaProgetti(); legendaProgetti(); scheda();
    }

    /* i progetti della circoscrizione: data/progetti.json pesa, si carica solo quando serve */
    function caricaProgetti() {
      if (progStato !== 'idle') return;
      progStato = 'carica';
      fetch('data/progetti.json', { cache: 'no-cache' })
        .then(r => { if (!r.ok) throw new Error('progetti'); return r.json(); })
        .then(j => { PROG = j; progStato = 'pronto'; if (sel) scheda(); })
        .catch(() => { progStato = 'errore'; if (sel) scheda(); });
    }
    function riga(k, v) { return el('div', { class: 'riga' }, [el('dt', { text: k }), el('dd', { text: v })]); }
    function scheda() {
      const s = $('scheda');
      if (selProj) { s.replaceChildren(...schedaProgetto(selProj)); return; }
      if (!sel) {
        s.replaceChildren(el('div', { class: 'vuota' }, [
          el('h2', { text: 'Palermo' }),
          el('p', { text: `${it(D.prof.totale_palermo.residenti)} residenti al censimento 2021, in 8 circoscrizioni.` }),
          el('p', { text: 'Scegli una circoscrizione sulla mappa per vedere residenti, famiglie e opere programmate.' }),
          el('p', { class: 'nota', text: 'Il Comune non ha un bilancio per circoscrizione: le somme di bilancio, appalti, PNRR e coesione sono per tutto il Comune.' }),
          ...progettiSullaMappa(),
        ]));
        return;
      }
      const p = P(sel), o = O(sel), q = D.geo.circoscrizioni[sel].quartieri;
      const dl = el('dl', {}, [
        riga('Residenti', it(p.residenti)), riga('Densità', it(p.densita_ab_kmq) + ' ab/km²'), riga('Over 65', pct(p.quota_65_piu_pct)),
        riga('Indice di vecchiaia', it(p.indice_vecchiaia, 0)), riga('Stranieri', pct(p.quota_stranieri_pct)), riga('Famiglie', it(p.famiglie)),
        riga('Abitazioni vuote o non di residenti', pct(p.quota_abitazioni_vuote_pct)), riga('Laureati (9 anni e più)', pct(p.quota_laureati_9_piu_pct)),
      ]);
      const dlo = el('dl', {}, [
        riga('Interventi', it(o.interventi)), riga('Importo 2026-2028', mln(o.importo_triennio_eur)),
        riga('Per residente', it(o.importo_triennio_per_residente_eur) + ' €'), riga('Interventi con CUP', `${o.con_cup} su ${o.interventi}`),
      ]);
      const sett = el('p', { class: 'nota', text: 'Settori principali: ' + o.principali_settori.slice(0, 3).map(x => `${x.settore.replace(/^\d+\.\d+ - /, '')} (${mln(x.importo_eur, 0)})`).join('; ') + '.' });
      s.replaceChildren(
        el('h2', { text: `Circoscrizione ${sel}` }),
        el('p', { class: 'quartieri', text: q.join(', ') }),
        dl,
        el('h3', { text: 'Opere programmate 2026-2028' }), dlo, sett,
        el('p', { class: 'nota', text: 'Residenti e profilo: censimento ISTAT 2021. Opere: la circoscrizione in cui ricadono, non una spesa decisa dalla circoscrizione né denaro già speso.' }),
        ...progettiDellaCircoscrizione().filter(Boolean)
      );
    }

    /* quali progetti ricadono in questa circoscrizione, con la ricerca */
    const ETICH = { opere: 'Opere', pnrr: 'PNRR', coesione: 'Coesione', appalti: 'Appalti' };
    const importoMax = (p) => Math.max(
      p.opere ? p.opere.importo_triennio_eur : -1,
      p.pnrr && p.pnrr.importo_finanziato_eur != null ? p.pnrr.importo_finanziato_eur : -1,
      p.coesione && p.coesione.length ? Math.max(...p.coesione.map(x => x.finanziamento_pubblico_netto_eur || 0)) : -1);
    /* se il progetto è anche sulla mappa lo si apre qui, altrimenti nella sua pagina */
    function apriVoce(p) {
      const geo = p.id.startsWith('op-') ? p.id.slice(3) : null;
      if (layerOn && PR && geo && PR.progetti.some(x => x.id === geo)) { apriProgetto(geo); return; }
      location.href = 'progetto.html?id=' + encodeURIComponent(p.id);
    }
    /* un intervento con più circoscrizioni non si divide: vale solo per il suo insieme */
    const inCirc = (p, c) => p.circoscrizioni.length === 1 && p.circoscrizioni[0] === c;
    function progettiDellaCircoscrizione() {
      if (!sel) return [];
      const h = el('h3', { text: 'Progetti' });
      if (!PROG) {
        caricaProgetti();
        return [h,
          el('p', { class: 'nota', text: progStato === 'errore' ? 'L\'elenco dei progetti non si carica.' : 'Caricamento dei progetti della circoscrizione…' }),
          el('p', { class: 'nota' }, [el('a', { class: 'badge-link', href: elenco({ circ: sel }), text: 'Apri l\'elenco dei progetti della circoscrizione' })])];
      }
      const base = PROG.progetti.filter(p => inCirc(p, sel))
        .sort((a, b) => (importoMax(b) - importoMax(a)) || a.titolo.localeCompare(b.titolo, 'it'));
      const inp = el('input', { type: 'search', placeholder: 'Cerca fra i progetti (es. scuola, strada, via)', 'aria-label': `Cerca fra i progetti della Circoscrizione ${sel}` });
      inp.value = qProg;
      const out = el('div', { class: 'elenco-prog', role: 'list' });
      const conta = el('p', { class: 'nota' });
      const mostra = () => {
        qProg = inp.value;
        const q = qProg.trim().toLowerCase();
        const r = base.filter(p => !q || (p.titolo + ' ' + (p.cup || '') + ' ' + (p.cui || '')).toLowerCase().includes(q));
        const vis = r.slice(0, 12);
        out.replaceChildren(...(vis.length ? vis.map(p => {
          const imp = importoMax(p);
          const b = el('button', { type: 'button', role: 'listitem', class: 'voce-prog', title: 'Apri la scheda: ' + p.titolo }, [
            el('span', {}, [el('span', { class: 'tit', text: p.titolo.length > 96 ? p.titolo.slice(0, 94) + '…' : p.titolo }),
              el('span', { class: 'fonti-riga mini' }, p.fonti.map(f => el('span', { class: 'badge ' + f, text: ETICH[f] || f })))]),
            el('b', { text: imp > 0 ? mln(imp, 1) : 'importo non disponibile' })]);
          b.addEventListener('click', () => apriVoce(p));
          return b;
        }) : [el('p', { class: 'nota', text: 'Nessun progetto trovato con questa ricerca.' })]));
        conta.textContent = (r.length ? `${it(Math.min(12, r.length))} di ${it(r.length)} progetti` : 'Nessun progetto') +
          (q ? ' con questa ricerca' : '') + (r.length ? ', per importo decrescente.' : '.');
      };
      inp.addEventListener('input', mostra);
      mostra();
      const nOpere = base.filter(p => p.fonti.includes('opere')).length;
      const nAltre = base.length - nOpere;
      const nGeo = layerOn && PR ? PR.progetti.filter(p => inCirc(p, sel)).length : null;
      return [h,
        el('p', { class: 'nota', text: `Le ${it(base.length)} voci che ricadono in Circoscrizione ${sel}: ${it(nOpere)} opere del Programma triennale` +
          (nAltre ? ` e ${it(nAltre)} tra PNRR e coesione collegate per CUP o CUI` : '') +
          `. L'importo è quello più alto fra le fonti del progetto: fonti diverse non si sommano.` }),
        inp, out, conta,
        nGeo == null ? null : el('p', { class: 'nota', text: `I progetti con una posizione sono già disegnati sulla mappa: scegliendone uno qui sotto lo si evidenzia, gli altri aprono la loro scheda.` }),
        el('p', { class: 'nota' }, [el('a', { class: 'badge-link', href: elenco({ circ: sel }), text: `Vedi tutti i ${it(base.length)} progetti in elenco` })]),
        el('p', { class: 'nota', text: 'L\'elenco ha filtri e collegamenti alle fonti. Gli interventi che toccano più circoscrizioni non si dividono: restano nell\'elenco sotto «Più circoscrizioni».' })];
    }

    /* senza circoscrizione scelta la scheda è quella di Palermo: elenca gli interventi che stanno sulla mappa */
    function progettiSullaMappa() {
      if (!layerOn || !PR) return [];
      const base = PR.progetti.slice().sort((a, b) => b.importo_triennio_eur - a.importo_triennio_eur);
      const out = el('div', { class: 'elenco-prog', role: 'list' });
      base.slice(0, 12).forEach(pr => {
        const b = el('button', { type: 'button', role: 'listitem', class: 'voce-prog', title: 'Apri sulla mappa: ' + pr.descrizione }, [
          el('span', {}, [el('span', { class: 'tit', text: pr.descrizione.length > 96 ? pr.descrizione.slice(0, 94) + '…' : pr.descrizione })]),
          el('b', { text: mln(pr.importo_triennio_eur, 1) })]);
        b.addEventListener('click', () => apriProgetto(pr.id));
        out.append(b);
      });
      const quota = it(100 * base.reduce((s, p) => s + p.importo_triennio_eur, 0) / tot.importo_triennio_eur, 0);
      return [el('h3', { text: `Progetti con posizione (${base.length})` }), out,
        el('p', { class: 'nota', text: `I primi 12 per importo: sono ${base.length} interventi con una posizione, il ${quota}% dell'importo del Programma. Gli altri ${PR.senza_posizione} (reti, linee e interventi diffusi) non sono sulla mappa.` }),
        el('p', { class: 'nota' }, [el('a', { href: 'progetti.html', text: 'Tutti i progetti e i finanziamenti, in elenco' }), ' (compresi quelli senza posizione).'])];
    }

    /* sezione opere */
    $('opere-lede').replaceChildren(
      'Gli interventi del Programma triennale dei lavori pubblici valgono ', el('strong', { text: mln(tot.importo_triennio_eur, 0) }),
      `. Il ${it(100 * nonLoc.importo_triennio_eur / tot.importo_triennio_eur, 0)}% (${mln(nonLoc.importo_triennio_eur, 0)}, ${nonLoc.interventi} interventi) non ha una circoscrizione: sono reti e linee che attraversano la città.`,
      ' Scegli una circoscrizione: la mappa la mostra con i progetti che hanno una posizione; il nome della circoscrizione apre l\'elenco completo.');
    const maxO = Math.max(...ROM.map(c => O(c).importo_triennio_eur), D.opere.piu_circoscrizioni.importo_triennio_eur, nonLoc.importo_triennio_eur);
    const barra = (cls, nome, sub, v, extra = {}, href = null, vai = null) => {
      const riga = el('div', Object.assign({ class: 'barra ' + cls + (href ? ' cliccabile' : ''), role: 'listitem' }, extra), [
        el('div', { class: 'nome' }, [href ? el('a', { href, text: nome, 'aria-label': `${nome}${sub ? ': ' + sub + ', ' : ': '}${v.testo}. Apri l'elenco dei progetti` }) : nome, sub ? el('small', { text: sub }) : null]),
        el('div', { class: 'pista' }, [el('span', { class: 'riempi', style: `width:${100 * v.n / v.max}%` })]),
        el('div', { class: 'val' }, [v.testo, href && !vai ? el('span', { class: 'freccia', 'aria-hidden': 'true', text: ' →' }) : null])]);
      if (href) {
        riga.addEventListener('click', (e) => {
          if (e.target.closest('a')) return;
          if (vai) vai(); else location.href = href;
        });
        riga.title = vai
          ? `Mostra ${nome} sulla mappa, con i progetti che hanno una posizione. Il nome apre l'elenco.`
          : `Apri l'elenco: ${sub ? sub + ', ' : ''}${v.testo}`;
      }
      return riga;
    };
    const elenco = (params) => 'progetti.html?' + Object.entries(params).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
    const ob = $('opere-barre');
    ROM.forEach(c => ob.append(barra('', `Circoscrizione ${c}`, `${O(c).interventi} interventi`, { n: O(c).importo_triennio_eur, max: maxO, testo: mln(O(c).importo_triennio_eur, 0) }, { 'data-c': c }, elenco({ fonte: 'opere', circ: c }), () => mostraCircoscrizione(c))));
    const pc = D.opere.piu_circoscrizioni;
    ob.append(barra('piu', 'Più circoscrizioni', `${pc.interventi} interventi, non divisi`, { n: pc.importo_triennio_eur, max: maxO, testo: mln(pc.importo_triennio_eur, 0) }, {}, elenco({ fonte: 'opere', circ: '__multi' })));
    ob.append(barra('senza', 'Senza circoscrizione', `${nonLoc.interventi} interventi`, { n: nonLoc.importo_triennio_eur, max: maxO, testo: mln(nonLoc.importo_triennio_eur, 0) }, {}, elenco({ fonte: 'opere', circ: '__nessuna' })));
    const big = nonLoc.principali_interventi[0];
    $('opere-limiti').replaceChildren(el('h3', { text: 'Cosa non misura' }), el('ul', {}, [
      el('li', {}, ['L\'intervento più grande senza circoscrizione vale ' + mln(big.importo_triennio_eur, 0) + ': ',
        el('a', { href: 'progetto.html?id=' + encodeURIComponent(big.id), text: big.descrizione.replace(/\s+/g, ' ') }), '.']),
      ...D.opere.non_misura.filter(t => !t.startsWith('Circa il')).map(t => el('li', { text: t })),
    ]));

    /* sezione bilancio: ogni missione apre la sua scheda */
    const anni = ['2026', '2027', '2028']; let anno = '2026', missioneSel = null;
    const ridottoM = matchMedia('(prefers-reduced-motion: reduce)');
    const ag = $('bilancio-anni');
    anni.forEach(a => { const b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(a === anno), text: a }); b.addEventListener('click', () => { anno = a; ag.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', String(x === b))); disegnaBilancio(); }); ag.append(b); });
    const nome = s => s.charAt(0) + s.slice(1).toLowerCase();

    /* scheda di una missione: importi, programmi, link al glossario ufficiale */
    function schedaMissione() {
      const box = $('bilancio-scheda');
      if (!missioneSel) { box.hidden = true; box.replaceChildren(); return; }
      const k = missioneSel, mm = D.bil.missioni[k], r = D.rgs.missioni[k];
      const prog = Object.entries(mm.programmi).filter(([, p]) => p['competenza_' + anno] > 0)
        .sort((a, b) => b[1]['competenza_' + anno] - a[1]['competenza_' + anno]);
      const chiudi = el('button', { type: 'button', class: 'chiudi', 'aria-label': 'Chiudi la scheda della missione', text: '×' });
      chiudi.addEventListener('click', () => { missioneSel = null; schedaMissione(); sincronizzaBarre(); });
      box.hidden = false;
      box.replaceChildren(
        el('div', { class: 'testa' }, [el('p', { class: 'occhiello', text: `Missione ${k}` }), el('h3', { text: nome(mm.nome) }), chiudi]),
        r ? el('p', { class: 'nota' }, [
          el('span', { class: 'badge ufficiale', text: 'Fonte ufficiale' }), ' ', r.descrizione + ' ',
          el('a', { href: D.rgs.url + '#page=' + r.pagina, text: `Glossario RGS, pag. ${r.pagina}`, target: '_blank', rel: 'noopener' }), '.',
        ]) : null,
        el('dl', {}, [
          riga('Competenza ' + anno, mln(mm['competenza_' + anno], 1)),
          riga('Cassa ' + anno, mln(mm['cassa_' + anno], 1)),
          riga('Programmi con una previsione', `${prog.length} di ${Object.keys(mm.programmi).length}`),
        ]),
        el('h4', { text: `Programmi della missione nel ${anno}` }),
        prog.length
          ? el('ul', { class: 'programmi' }, prog.map(([pc, p]) => el('li', {}, [
            el('span', { class: 'cod', text: `${k}.${pc}` }),
            el('span', { class: 'nome', text: nome(p.nome) }),
            el('b', { text: mln(p['competenza_' + anno], 1) })])))
          : el('p', { class: 'nota', text: `Nessun programma di questa missione ha una previsione nel ${anno}.` }),
        el('p', { class: 'nota progetti' }, [
          'Il bilancio classifica la spesa per missioni e programmi, il Programma triennale delle opere per settore e sottosettore del CUP: sono due classificazioni diverse e nei dati aperti non c\'è un campo che le colleghi. Qui quindi si vedono i programmi, non i progetti. I progetti si esplorano a parte: ',
          el('a', { href: '#opere', text: 'opere pubbliche programmate' }), ', ',
          el('a', { href: 'progetti.html', text: 'elenco dei progetti e finanziamenti' }), '.',
        ]),
      );
    }

    function sincronizzaBarre() {
      document.querySelectorAll('#bilancio-barre .barra').forEach(b => b.setAttribute('aria-expanded', String(b.dataset.m === missioneSel)));
    }

    function disegnaBilancio() {
      const m = Object.entries(D.bil.missioni).map(([k, v]) => ({ k, nome: v.nome, v: v['competenza_' + anno] })).sort((a, b) => b.v - a.v);
      const maxB = m[0].v, totale = D.bil.totale_spese_competenza[anno];
      $('bilancio-lede').replaceChildren(`Il Comune prevede di spendere `, el('strong', { text: mln(totale, 0) }), ` nel ${anno} (competenza). Le previsioni sono quelle del bilancio approvato il 26/05/2026, non spesa effettiva. Il bilancio non ha capitoli per circoscrizione. Scegli una missione per vedere i suoi programmi e il link alla descrizione ufficiale.`);
      $('bilancio-barre').replaceChildren(...m.filter(x => x.v > 0).map(x => {
        const b = barra(x.k === '99' ? 'conto-terzi' : '', nome(x.nome), x.k === '99' ? 'Partite di giro: entrano ed escono' : `Missione ${x.k}`, { n: x.v, max: maxB, testo: mln(x.v, 1) });
        b.classList.add('cliccabile');
        b.setAttribute('role', 'button');
        b.setAttribute('tabindex', '0');
        b.setAttribute('data-m', x.k);
        b.setAttribute('aria-expanded', String(x.k === missioneSel));
        b.title = `Apri la scheda della missione ${x.k}`;
        b.querySelector('.val').append(el('span', { class: 'freccia', 'aria-hidden': 'true', text: ' →' }));
        const apri = () => {
          missioneSel = missioneSel === x.k ? null : x.k;
          schedaMissione(); sincronizzaBarre();
          if (missioneSel) $('bilancio-scheda').scrollIntoView({ block: 'nearest', behavior: ridottoM.matches ? 'auto' : 'smooth' });
        };
        b.addEventListener('click', apri);
        b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apri(); } });
        return b;
      }));
      schedaMissione();
    }
    disegnaBilancio();
    $('bilancio-limiti').replaceChildren(el('h3', { text: 'Cosa non misura' }), el('ul', {}, D.bil.non_misura.map(t => el('li', { text: t }))));

    /* appalti */
    const A = D.app.anni;
    $('appalti-lede').replaceChildren(`Gare e affidamenti avviati dal Comune di Palermo, con l'importo posto a base di gara. Sono ${it(A['2025'].cig)} nel 2025 e ${it(A['2026'].cig)} nel 2026 fino al 01/11/2026.`);
    const coppia = (anno) => {
      const a = A[anno];
      return el('div', { class: 'coppia' }, [el('h3', { text: anno }), el('div', { class: 'grande', text: mln(a.importo_base_gara_eur_senza_anomali, 0) }),
        el('p', { class: 'nota', text: `a base di gara, ${it(a.cig_senza_anomali)} CIG${a.cig_con_importo_anomalo_non_corretti.length ? `. Esclusi ${a.cig_con_importo_anomalo_non_corretti.length} CIG con importo anomalo in fonte (${mln(a.importo_base_gara_eur_come_in_fonte, 0)} con essi)` : ''}.` }),
        el('p', { class: 'nota', text: `Più usata: ${a.per_procedura[0].voce.toLowerCase()} (${a.per_procedura[0].cig} CIG).` }),
        el('p', { class: 'nota' }, [el('a', { class: 'badge-link', href: 'progetti.html#cig', text: `Vedi i ${it(a.cig)} CIG con oggetto e importo` })])]);
    };
    $('appalti-dati').replaceChildren(coppia('2025'), coppia('2026'));
    $('appalti-limiti').replaceChildren(el('h3', { text: 'Cosa non misura' }), el('ul', {}, D.app.non_misura.map(t => el('li', { text: t }))));

    /* PNRR e coesione */
    $('progetti-lede').replaceChildren('Progetti del Comune finanziati dal PNRR e dalla politica di coesione europea e nazionale. Le due fonti non hanno la circoscrizione e non si sommano. Ogni progetto ha una scheda: ', el('a', { href: 'progetti.html?fonte=pnrr', text: 'elenco dei progetti PNRR' }), ' e ', el('a', { href: 'progetti.html?fonte=coesione', text: 'elenco dei progetti di coesione' }), '.');
    const bloccoSt = (titolo, grande, nota, righe, limiti) => {
      const mx = Math.max(...righe.map(r => r.n));
      return el('div', {}, [el('h3', { text: titolo }), el('div', { class: 'grande', text: grande }), el('p', { class: 'nota', text: nota }),
        el('div', { class: 'barre', role: 'list' }, righe.map(r => barra('', r.nome, r.sub, { n: r.n, max: mx, testo: r.testo }, {}, r.href))),
        el('div', { class: 'limiti' }, [el('h3', { text: 'Cosa non misura' }), el('ul', {}, limiti.map(t => el('li', { text: t })))])]);
    };
    const pn = D.pnrr;
    $('pnrr-blocco').replaceChildren(bloccoSt('PNRR', mln(pn.totale.importo_finanziato_eur, 0),
      `finanziati su ${pn.totale.progetti} progetti, ${mln(pn.totale.spesa_rendicontata_eur, 0)} rendicontati.`,
      pn.per_stato.map(s => ({ nome: s.voce.charAt(0).toUpperCase() + s.voce.slice(1), sub: `${s.progetti} progetti`, n: s.importo_finanziato_eur, testo: mln(s.importo_finanziato_eur, 0), href: elenco({ fonte: 'pnrr', stato: s.voce }) })), pn.non_misura));
    const co = D.coe;
    $('coesione-blocco').replaceChildren(bloccoSt('Coesione', mln(co.totale.finanziamento_pubblico_netto_eur, 0),
      `di finanziamento pubblico su ${co.totale.progetti} progetti con il Comune tra i beneficiari.`,
      co.per_programma.slice(0, 6).map(s => ({ nome: s.voce.split(':::')[0].slice(0, 40), sub: `${s.progetti} progetti`, n: s.finanziamento_pubblico_netto_eur, testo: mln(s.finanziamento_pubblico_netto_eur, 0), href: elenco({ fonte: 'coesione', programma: s.voce.split(':::')[0] }) })), co.non_misura));

    /* fonti */
    const fonte = (n, s) => {
      const periodo = typeof s.periodo === 'string' ? s.periodo : Object.values(s.periodo).join('; ');
      const nome = s.fonte.link ? el('a', { href: s.fonte.link, text: s.fonte.nome, target: '_blank', rel: 'noopener' }) : s.fonte.nome;
      return el('li', {}, [el('b', { text: n + ': ' }), nome,
        el('span', { class: 'ver', text: `Periodo: ${periodo}. Letto il ${s.verificato.split('-').reverse().join('/')}.${s.fonte.link ? ' Il nome della fonte apre la pagina ufficiale.' : ''}` })]);
    };
    $('fonti').replaceChildren(...[['Profilo', D.prof], ['Opere pubbliche', D.opere], ['Bilancio', D.bil], ['Appalti', D.app], ['PNRR', D.pnrr], ['Coesione', D.coe]].map(([n, s]) => fonte(n, s)));
    $('fonti').append(el('li', {}, [el('b', { text: 'Tutti i progetti: ' }),
      el('a', { href: 'progetti.html', text: 'elenco e singole schede' }),
      el('span', { class: 'ver', text: 'Una voce per progetto con CUP, importi per fonte e collegamenti a OpenCUP, OpenCoesione, PNRR del Comune e ANAC.' })]));


    /* ---- singoli progetti sulla mappa ---- */
    const PREC = { pallino: 'letta sulla tavola, circa 3-10 m', etichetta: 'dall\'etichetta sulla tavola, circa 25-40 m', toponimo: 'ricavata dal nome del luogo, circa 300 m (approssimata)', da_poligono: 'centro di un poligono' };
    const gP = document.createElementNS(NS, 'g'); gP.setAttribute('id', 'progetti-g'); gP.setAttribute('hidden', ''); svg.append(gP);
    const nodi = {};   // id progetto -> elementi svg
    const swit = el('button', { type: 'button', role: 'switch', 'aria-checked': 'false', class: 'interruttore' }, [el('span', { class: 'pallino-sw' }), 'Mostra i singoli progetti']);
    sg.after(swit);
    const tutta = el('button', { type: 'button', class: 'interruttore torna', hidden: true, text: 'Tutta la città' });
    swit.after(tutta);
    tutta.addEventListener('click', () => deseleziona());

    /* livello dei progetti: on/off, classi sul disegno, legenda e visibilità per circoscrizione */
    function statoProgetti(on) {
      layerOn = on;
      swit.setAttribute('aria-checked', String(on));
      svg.classList.toggle('con-progetti', on);
      gP.toggleAttribute('hidden', !on);
      aggiornaVisibilitaProgetti();
      legendaProgetti();
    }
    function aggiornaVisibilitaProgetti() {
      const solo = layerOn && !!sel;
      svg.classList.toggle('filtro-circ', solo);
      /* con una circoscrizione scelta resta solo il suo poligono */
      ROM.forEach(x => {
        const vis = !solo || x === sel;
        gruppi[x].p.style.display = vis ? '' : 'none';
        gruppi[x].t1.style.display = vis ? '' : 'none';
        gruppi[x].t2.style.display = vis ? '' : 'none';
      });
      if (!PR) return;
      PR.progetti.forEach(pr => {
        const n = nodi[pr.id]; if (!n) return;
        const mostra = !sel || pr.circoscrizioni.includes(sel);
        [...n.pol, ...n.lin, ...n.pt, ...n.hit].forEach(e => { e.style.display = mostra ? '' : 'none'; });
      });
    }
    /* accende il livello dei progetti: le posizioni si scaricano la prima volta che servono */
    function accendiProgetti() {
      const finito = () => { statoProgetti(true); zoomA(sel); scheda(); };
      if (PR) return finito();
      if (progGeoStato === 'carica') return;
      progGeoStato = 'carica';
      $('mappa-nota').textContent = 'Carico le posizioni dei progetti…';
      fetch('data/geo/progetti.json')
        .then(r => { if (!r.ok) throw new Error('posizioni'); return r.json(); })
        .then(j => { PR = j; progGeoStato = 'pronto'; disegnaProgetti(); colora(); finito(); })
        .catch(() => { progGeoStato = 'errore'; statoProgetti(false); $('mappa-nota').textContent = 'Le posizioni dei progetti non si caricano.'; });
    }
    swit.addEventListener('click', () => {
      if (layerOn) { statoProgetti(false); zoomA(null, true); scheda(); }
      else accendiProgetti();
    });
    function disegnaProgetti() {
      const mk = (tag, a) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); return e; };
      const gPol = mk('g', { class: 'pol' }), gLin = mk('g', { class: 'lin' }), gPt = mk('g', { class: 'pt' }), gHit = mk('g', { class: 'hit' });
      PR.progetti.forEach(pr => {
        const n = nodi[pr.id] = { pol: [], lin: [], pt: [], hit: [] };
        const apri = () => apriProgetto(pr.id);
        const bersaglio = (e) => { e.addEventListener('click', apri); gHit.append(e); n.hit.push(e); return e; };
        pr.poligoni.forEach(g => {
          const e = mk('path', { d: g.d, class: 'g-pol' + (g.assegnazione === 'per_vicinanza' ? ' vicinanza' : '') }); e.addEventListener('click', apri);
          e.append(Object.assign(document.createElementNS(NS, 'title'), { textContent: pr.descrizione }));
          gPol.append(e); n.pol.push(e);
        });
        pr.linee.forEach(g => {
          const e = mk('path', { d: g.d, class: 'g-lin' }); e.addEventListener('click', apri); gLin.append(e); n.lin.push(e);
          e.append(Object.assign(document.createElementNS(NS, 'title'), { textContent: pr.descrizione }));
          /* una linea spessa 1,5 px sullo schermo non si riesce a centrare: sotto ci va un bersaglio trasparente */
          bersaglio(mk('path', { d: g.d, class: 'g-lin-hit' }));
        });
        pr.punti.forEach(q => {
          const approx = q[2] === 'toponimo' || q[2] === 'da_poligono';
          const e = mk('circle', { cx: q[0], cy: q[1], class: 'g-pt' + (approx ? ' approx' : ''), 'data-r': approx ? 7.4 : 4.6 });
          e.addEventListener('click', apri); e.append(Object.assign(document.createElementNS(NS, 'title'), { textContent: pr.descrizione }));
          gPt.append(e); n.pt.push(e);
        });
      });
      gP.append(gPol, gLin, gPt, gHit); ridimensiona();
      aggiornaVisibilitaProgetti();
    }
    /* un pallino di 5 px non si centra: i clic sulla mappa entro 14 px da un punto aprono quel progetto */
    function progettoSotto(ev) {
      if (!layerOn || !PR) return null;
      const m = svg.getScreenCTM(); if (!m) return null;
      const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
      const limite = 14 / Math.hypot(m.a, m.b);
      let best = null, bestD = Infinity;
      PR.progetti.forEach(pr => {
        const n = nodi[pr.id]; if (!n) return;
        pr.punti.forEach((q, i) => {
          const e = n.pt[i]; if (!e || e.style.display === 'none') return;
          const d = Math.hypot(q[0] - p.x, q[1] - p.y);
          if (d < bestD) { bestD = d; best = pr.id; }
        });
      });
      return bestD <= limite ? best : null;
    }
    /* i pallini cadono anche fuori dal poligono (posizioni approssimate): il clic sul vuoto vicino li apre lo stesso */
    svg.addEventListener('click', (ev) => {
      if (ev.target !== svg) return;
      const id = progettoSotto(ev);
      if (id) apriProgetto(id);
    });
    let vb = [0, 0, W, H];
    function ridimensiona() { const k = vb[2] / 1000; gP.querySelectorAll('.g-pt').forEach(e => e.setAttribute('r', (+e.dataset.r * k).toFixed(2))); svg.style.setProperty('--k', k); }
    function zoomA(c, tutta) {
      if (!layerOn && !tutta) return;
      if (!c || tutta) vb = [0, 0, W, H];
      else { const b = gruppi[c].p.getBBox(), m = 24; vb = [b.x - m, b.y - m, b.width + 2 * m, b.height + 2 * m]; }
      svg.setAttribute('viewBox', vb.join(' ')); svg.style.setProperty('--ar', `${vb[2].toFixed(1)} / ${vb[3].toFixed(1)}`); ridimensiona();
    }
    function evidenziaProgetto() {
      gP.querySelectorAll('.sel').forEach(e => e.classList.remove('sel'));
      if (selProj && nodi[selProj]) { const n = nodi[selProj]; [...n.pol, ...n.lin, ...n.pt].forEach(e => { e.classList.add('sel'); e.parentNode.append(e); }); }
    }
    function apriProgetto(id) {
      selProj = id; evidenziaProgetto();
      const pr = PR.progetti.find(x => x.id === id);
      if (pr && pr.circoscrizioni.length === 1 && sel !== pr.circoscrizioni[0]) {
        sel = pr.circoscrizioni[0];
        ROM.forEach(x => gruppi[x].p.setAttribute('aria-pressed', String(x === sel)));
      }
      tutta.hidden = !sel;
      aggiornaVisibilitaProgetti();
      zoomA(sel);
      scheda();
      if (matchMedia('(max-width: 900px)').matches) $('scheda').scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    function legendaProgetti() {
      const l = $('legenda'); l.querySelector('.leg-prog')?.remove();
      if (!layerOn) { l.querySelector('.leg-circ')?.remove(); return; }
      const voci = [el('i', { class: 'k pieno' }), ' posizione letta o dall\'etichetta  ', el('i', { class: 'k anello' }), ' approssimata (circa 300 m)  ', el('i', { class: 'k linea' }), ' linee e aree'];
      const n = sel && PR ? PR.progetti.filter(p => p.circoscrizioni.includes(sel)).length : null;
      if (n != null) voci.push(el('b', { class: 'leg-nota', text: `Circoscrizione ${sel}: ${it(n)} progetti disegnati` }));
      l.append(el('span', { class: 'leg-prog' }, voci));
    }
    function schedaProgetto(id) {
      const p = PR.progetti.find(x => x.id === id), tipo = [p.punti.length && 'punto', p.linee.length && 'linea', p.poligoni.length && 'area'].filter(Boolean).join(', ');
      const precs = [...new Set(p.punti.map(q => q[2]))].map(k => PREC[k] || k);
      const indietro = el('button', { type: 'button', class: 'indietro', text: sel ? `‹ Circoscrizione ${sel}` : '‹ Palermo' });
      indietro.addEventListener('click', () => { selProj = null; evidenziaProgetto(); scheda(); });
      const dl = el('dl', {}, [
        riga('Settore', p.settore.replace(/^\d+\.\d+ - /, '')), riga('Importo 2026-2028', mln(p.importo_triennio_eur, 2)),
        riga('Importo complessivo', mln(p.importo_complessivo_eur, 2)),
        riga('Circoscrizione', p.circoscrizioni.length ? p.circoscrizioni.join(', ') : 'non indicata'),
        riga('CUP', p.cup || 'non ancora richiesto'), riga('Sulla mappa come', tipo)]);
      const extra = [];
      /* le fonti della voce, come nell'elenco e nella scheda completa */
      const fonti = ['opere', p.pnrr && 'pnrr', p.coesione && 'coesione', p.cig && 'appalti'].filter(Boolean);
      if (p.pnrr) extra.push(el('p', { class: 'nota' }, ['Compare anche nel PNRR del Comune' + (p.pnrr.stato ? ` (${p.pnrr.stato.toLowerCase()})` : '') + ': ', el('span', { class: 'badge ufficiale', text: 'Fonte ufficiale' }), ' ', el('a', { href: p.pnrr.url, text: 'scheda sul sito del Comune', target: '_blank', rel: 'noopener' }), `, ${mln(p.pnrr.importo_finanziato_eur, 2)} finanziati. Gli importi di fonti diverse non si sommano.`]));
      if (p.coesione) extra.push(el('p', { class: 'nota', text: 'Compare anche tra i progetti di coesione: ' + p.coesione.join('; ') + '.' }));
      if (p.cig) extra.push(el('p', { class: 'nota', text: `Appalti ANAC collegati tramite il codice dell'intervento: ${p.cig.length} CIG (${p.cig.slice(0, 3).join(', ')}${p.cig.length > 3 ? '…' : ''}).` }));
      extra.push(el('p', { class: 'nota' }, [el('a', { href: 'progetto.html?id=' + encodeURIComponent('op-' + p.id), text: 'Scheda completa del progetto' }), ' con importi per fonte, finanziamenti e collegamenti.']));
      return [indietro, el('h2', { class: 'titolo-prog', text: p.descrizione.length > 140 ? p.descrizione.slice(0, 138) + '…' : p.descrizione }),
        el('div', { class: 'fonti-riga', style: 'margin: 4px 0 12px' }, fonti.map(f => el('span', { class: 'badge ' + f, text: ETICH[f] || f }))),
        dl, ...extra,
        el('p', { class: 'nota', text: 'Posizione ' + (precs.length ? precs.join('; ') : 'dalla geometria') + '. È una posizione elaborata da OpenDataSicilia dalle tavole PDF del Programma, non una coordinata ufficiale del Comune. Importo programmato, non speso.' })];
    }

    colora(); scheda();
    document.addEventListener('tema-cambia', colora);
    /* arrivo da «Aprila sulla mappa» dell'elenco: circoscrizione già scelta */
    const circDaUrl = new URLSearchParams(location.search).get('circ');
    if (ROM.includes(circDaUrl)) {
      scegli(circDaUrl, false);
      if (location.hash) document.querySelector('.mappa-blocco').scrollIntoView({ block: 'start' });
    }
  }
})();
