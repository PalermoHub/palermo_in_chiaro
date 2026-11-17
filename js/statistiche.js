/* Palermo in chiaro · Statistiche
   Legge gli snapshot in data/snapshot e disegna grafici in SVG e in HTML.
   Nessuna libreria: stessi colori e stesse forme del resto del sito. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  const IDX = Object.fromEntries(ROM.map((c, i) => [c, String(i + 1)]));
  const $ = (id) => document.getElementById(id);

  const it = (n, d = 0) => n == null || Number.isNaN(n) ? 'non disponibile'
    : Number(n).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
  const pct = (n, d = 1) => n == null ? 'non disponibile' : it(n, d) + '%';
  const eur = (n, d = 0) => n == null ? 'non disponibile' : it(n, d) + ' €';
  const mln = (n, d = 1) => n == null ? 'non disponibile' : it(n / 1e6, d) + ' M€';
  const media = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);

  const el = (tag, attrs = {}, kids = []) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (k === 'style') Object.assign(e.style, v);
      else e.setAttribute(k, v);
    }
    for (const c of [].concat(kids)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  };
  const S = (tag, attrs = {}) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === 'style') Object.assign(e.style, v);
      else e.setAttribute(k, v);
    }
    return e;
  };

  const testo = (host, attrs, t) => { const e = S('text', attrs); e.textContent = t; host.append(e); return e; };
  const titolo = (t) => { const e = S('title'); e.textContent = t; return e; };

  /* ---- tooltip ---- */
  const tip = el('div', { class: 'tip', 'aria-hidden': 'true', hidden: '' });
  document.body.append(tip);
  const posizionaTip = (ev) => {
    const p = ev.touches ? ev.touches[0] : ev;
    const x = p.clientX ?? 0, y = p.clientY ?? 0;
    const r = tip.getBoundingClientRect();
    let left = x + 14, top = y + 14;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > window.innerHeight - 8) top = y - r.height - 14;
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top = Math.max(8, top) + 'px';
  };
  const mostraTip = (ev, titoloTesto, righe) => {
    tip.replaceChildren(el('b', { text: titoloTesto }), ...righe.map(([k, v]) => el('span', { class: 'tip-riga' }, [
      el('span', { text: k }), el('strong', { text: v }),
    ])));
    tip.hidden = false;
    posizionaTip(ev);
  };
  const nascondiTip = () => { tip.hidden = true; };
  window.addEventListener('scroll', nascondiTip, { passive: true });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') nascondiTip(); });

  /* tooltip su hover, tocco e tastiera */
  function conTip(node, titoloTesto, righe) {
    node.addEventListener('pointerenter', (e) => mostraTip(e, titoloTesto, righe));
    node.addEventListener('pointermove', posizionaTip);
    node.addEventListener('pointerleave', nascondiTip);
    node.addEventListener('focus', () => {
      const r = node.getBoundingClientRect();
      mostraTip({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }, titoloTesto, righe);
    });
    node.addEventListener('blur', nascondiTip);
  }

  const FILES = {
    stat: 'data/snapshot/statistiche.json',
    prof: 'data/snapshot/profilo_circoscrizioni.json',
    opere: 'data/snapshot/opere_circoscrizioni.json',
    bil: 'data/snapshot/bilancio_comune.json',
    pnrr: 'data/snapshot/pnrr_comune.json',
    coe: 'data/snapshot/coesione_comune.json',
    app: 'data/snapshot/appalti_comune.json',
  };

  Promise.all(Object.entries(FILES).map(([k, u]) => fetch(u)
    .then((r) => { if (!r.ok) throw new Error(u); return r.json(); })
    .then((j) => [k, j])))
    .then((p) => avvia(Object.fromEntries(p)))
    .catch((err) => {
      console.error('statistiche:', err);
      const box = $('cifre');
      if (box) box.append(el('p', { class: 'errore' }, [
        'I grafici non si caricano. Se hai aperto il file direttamente, avvia un server locale: ',
        el('code', { text: 'python3 -m http.server 8000' }),
        ' e apri ',
        el('code', { text: 'http://localhost:8000/statistiche.html' }),
        '.',
      ]));
    });

  function avvia(D) {
    const P = (c) => D.prof.valori[IDX[c]];
    const S_ = (c) => D.stat.valori[IDX[c]];
    const OP = (c) => D.opere.valori[IDX[c]];
    const T = D.prof.totale_palermo;
    const TC = D.stat.palermo;
    const tau = D.opere.totale_palermo;
    const opereProResidenteCitta = tau.importo_triennio_eur / T.residenti;

    /* Il file ISTAT chiude l'ultima classe a «75 e più»: non è una classe di cinque
       anni e in piramide sarebbe alta il doppio delle altre. Si disegnano 0-74 e il
       valore della classe aperta va nella nota e nella tabella. */
    const NOMI_FAM = D.stat.classi_famiglie.map((n, i) => i < 5 ? n + (i ? ' persone' : ' persona') : '6 o più');
    const N5 = 15;
    const CLASSI_5 = D.stat.classi_eta.slice(0, N5);
    const taglia = (e) => ({ maschi: e.maschi.slice(0, N5), femmine: e.femmine.slice(0, N5) });
    const aperta = (e) => ({ m: e.maschi[N5], f: e.femmine[N5], t: e.maschi[N5] + e.femmine[N5] });

    const etaTot = (e) => e.totale.reduce((a, b) => a + b, 0);
    const quotaEta = (e, da, a) => { const t = etaTot(e); return t ? 100 * e.totale.slice(da, a).reduce((x, y) => x + y, 0) / t : null; };

    /* ---------- 1. I numeri della città ---------- */

    const cifre = [
      { nome: 'Residenti', val: it(TC.residenti), nota: `al censimento 2021, in 8 circoscrizioni. Il Comune ne stima 628.693 nel 2024.` },
      { nome: 'Famiglie', val: it(TC.famiglie.totale), nota: `${it(TC.famiglie.componenti_medi, 2)} persone per famiglia; ${pct(TC.famiglie.quota_single_pct)} vive da sola.` },
      { nome: 'Stranieri', val: pct(TC.stranieri.quota_pct), nota: `${it(TC.stranieri.totale)} residenti: ${it(TC.stranieri.ue)} dell'UE e ${it(TC.stranieri.extraue)} extra-UE.` },
      { nome: 'Laureati (9 anni e più)', val: pct(TC.istruzione.quote[4]), nota: `${it(TC.istruzione.conteggi[4])} persone su ${it(TC.istruzione.popolazione_9_piu)}.` },
      { nome: 'Occupati 15-64', val: pct(TC.lavoro.tasso_pct), nota: `${it(TC.lavoro.occupati)} occupati; ${it(TC.lavoro.occupati_m)} uomini e ${it(TC.lavoro.occupati_f)} donne.` },
      { nome: 'Abitazioni vuote', val: pct(TC.abitazioni.quota_vuote_pct), nota: `${it(TC.abitazioni.vuote)} su ${it(TC.abitazioni.totali)}: vuote o usate solo da non residenti.` },
    ];
    const cifreBox = $('cifre');
    cifre.forEach((c) => cifreBox.append(el('div', { class: 'cifra' }, [
      el('p', { class: 'cifra-nome', text: c.nome }),
      el('p', { class: 'cifra-val', text: c.val }),
      el('p', { class: 'cifra-nota', text: c.nota }),
    ])));
    cifreBox.append(el('p', { class: 'cifra-fonte', text: 'Censimento ISTAT 2021, sezioni di censimento sommate per circoscrizione. Dettaglio in fondo alla pagina.' }));

    const G = $('grafici-generali');

    /* piramide della città */
    {
      const { corpo } = figura(G, {
        titolo: 'La piramide dell\'età di Palermo',
        nota: `Ogni barra è una classe di cinque anni, maschi a sinistra e femmine a destra. La forma dice più di un indice: base stretta, rigonfiamento tra 40 e 54 anni. La classe «75 e più» (${it(aperta(TC.eta).t)} persone) è aperta, non è di cinque anni e resta fuori dal disegno: il valore è nella tabella. Censimento 2021.`,
        larga: true,
        tabella: tabellaEta('Palermo', TC.eta),
      });
      piramide(corpo, { classi: CLASSI_5, ...taglia(TC.eta) });
    }

    /* titolo di studio */
    {
      const { corpo } = figura(G, {
        titolo: 'Il titolo di studio',
        nota: 'Popolazione di 9 anni e più. Le quote non arrivano a 100% per le persone senza titolo o con titolo non dichiarato; qui «Nessun titolo» è la voce ISTAT. Censimento 2021.',
        tabella: tabellaQuote('Palermo', D.stat.classi_istruzione, TC.istruzione),
      });
      impilate(corpo, {
        righe: [{ nome: 'Palermo', valori: TC.istruzione.conteggi }],
        segmenti: D.stat.classi_istruzione.map((nome, i) => ({ nome, colore: '--s' + (i + 1) })),
        formatta: it, conValori: true,
      });
    }

    /* famiglie */
    {
      const { corpo } = figura(G, {
        titolo: 'Le famiglie per numero di componenti',
        nota: 'Famiglie residenti. La quota di famiglie da una persona è la più alta: da sola spiega perché il numero di famiglie cresce più della popolazione. Censimento 2021.',
        tabella: tabellaQuote('Palermo', NOMI_FAM, TC.famiglie),
      });
      impilate(corpo, {
        righe: [{ nome: 'Palermo', valori: TC.famiglie.conteggi }],
        segmenti: NOMI_FAM.map((nome, i) => ({ nome, colore: '--s' + (i + 1) })),
        formatta: it, conValori: true,
      });
    }

    /* abitazioni */
    {
      const { corpo } = figura(G, {
        titolo: 'Abitazioni occupate e vuote',
        nota: 'Abitazioni totali, occupate da almeno un residente e vuote o usate solo da non residenti. Un\'abitazione vuota non è per forza disponibile: può essere in vendita, in ristrutturazione o usata per altro. Censimento 2021.',
        tabella: tabellaAbitazioni([['Palermo', TC.abitazioni]]),
      });
      impilate(corpo, {
        righe: [{ nome: 'Palermo', valori: [TC.abitazioni.occupate, TC.abitazioni.vuote] }],
        segmenti: [{ nome: 'Occupate da residenti', colore: '--s4' }, { nome: 'Vuote o solo non residenti', colore: '--s1' }],
        formatta: it, conValori: true,
      });
      corpo.append(el('p', { class: 'grafico-nota sotto', text: `${it(TC.abitazioni.occupate)} abitazioni occupate; ${it(TC.abitazioni.vuote)} vuote o usate solo da non residenti, su ${it(TC.abitazioni.totali)}.` }));
    }

    /* stranieri */
    {
      const { corpo } = figura(G, {
        titolo: 'Gli stranieri residenti',
        nota: 'Cittadini non italiani e apolidi. Le dieci cittadinanze sono le prime del file ISTAT e coprono l\'81% degli stranieri: le altre sono fuori dal grafico, non assenti. Censimento 2021.',
        tabella: tabellaCittadinanze(TC.stranieri),
      });
      impilate(corpo, {
        righe: [{ nome: 'Palermo', valori: [TC.stranieri.ue, TC.stranieri.extraue] }],
        segmenti: [{ nome: 'Unione europea', colore: '--s3' }, { nome: 'Extra-UE e apolidi', colore: '--s5' }],
        formatta: it, conValori: true,
      });
      barre(corpo, {
        voci: Object.entries(TC.stranieri.cittadinanze).map(([nome, val]) => ({ nome, val })),
        formatta: it,
      });
    }

    /* lavoro */
    {
      const { corpo } = figura(G, {
        titolo: 'Chi lavora, per sesso',
        nota: 'Occupati di 15-64 anni sul totale della stessa età e sesso. Il tasso femminile è 20 punti sotto quello maschile: è il dato che più spiega le differenze tra circoscrizioni. Censimento 2021.',
        tabella: {
          colonne: [{ nome: 'Gruppo' }, { nome: 'Occupati', num: true }, { nome: 'Popolazione 15-64', num: true }, { nome: 'Tasso', num: true }],
          righe: [
            ['Uomini', it(TC.lavoro.occupati_m), it(TC.lavoro.pop_15_64_m), pct(TC.lavoro.tasso_m_pct)],
            ['Donne', it(TC.lavoro.occupati_f), it(TC.lavoro.pop_15_64_f), pct(TC.lavoro.tasso_f_pct)],
            ['Totale', it(TC.lavoro.occupati), it(TC.lavoro.pop_15_64), pct(TC.lavoro.tasso_pct)],
          ],
        },
      });
      barre(corpo, {
        voci: [
          { nome: 'Uomini', val: TC.lavoro.tasso_m_pct, sub: it(TC.lavoro.occupati_m) + ' occupati' },
          { nome: 'Donne', val: TC.lavoro.tasso_f_pct, sub: it(TC.lavoro.occupati_f) + ' occupate' },
        ],
        formatta: (n) => pct(n), ordina: false,
      });
      corpo.append(el('p', { class: 'grafico-nota sotto' }, [
        'Tasso di occupazione 15-64. ',
        el('b', { text: 'Differenza uomini-donne: ' }),
        pct(TC.lavoro.tasso_m_pct - TC.lavoro.tasso_f_pct),
        '. Il tasso degli stranieri è ' + pct(TC.lavoro.tasso_stranieri_pct) + ' (censimento 2021).',
      ]));
    }

    /* soldi del Comune */
    const soldi = el('div', { class: 'soldi-testa' }, [
      el('h3', { text: 'I soldi del Comune' }),
      el('p', { class: 'lede' }, [
        'Bilancio, PNRR, coesione e appalti sono per tutto il Comune: in fonte ',
        el('b', { text: 'non esiste la circoscrizione' }),
        '. Solo il Programma triennale delle opere ha un territorio, ed è nella pagina ',
        el('a', { href: '#per-circoscrizione', text: 'Una circoscrizione' }),
        '.',
      ]),
    ]);
    G.append(soldi);

    {
      const missioni = Object.entries(D.bil.missioni).map(([cod, m]) => ({
        nome: m.nome.charAt(0) + m.nome.slice(1).toLowerCase(),
        sub: 'Missione ' + cod,
        val: m.competenza_2026,
      }));
      const tot26 = D.bil.totale_spese_competenza['2026'];
      const { corpo } = figura(G, {
        titolo: 'Bilancio 2026: la spesa per missione',
        nota: `Stanziamenti di competenza 2026, ${mln(tot26, 0)} in tutto. Sono previsioni, non spese: i pagamenti sono un'altra cosa. La circoscrizione non c'è. Le annualità 2027 e 2028 sono nella tabella.`,
        larga: true,
        tabella: {
          colonne: [{ nome: 'Missione' }, { nome: '2026', num: true }, { nome: '2027', num: true }, { nome: '2028', num: true }],
          righe: Object.entries(D.bil.missioni).map(([cod, m]) => [`${cod} · ${m.nome}`, it(m.competenza_2026, 0) + ' €', it(m.competenza_2027, 0) + ' €', it(m.competenza_2028, 0) + ' €']),
        },
      });
      barre(corpo, { voci: missioni, formatta: (n) => mln(n) });
    }

    {
      const { corpo } = figura(G, {
        titolo: 'PNRR: i progetti del Comune per stato',
        nota: `Importo finanziato per stato dichiarato dal Comune: ${it(D.pnrr.totale.progetti)} progetti, ${mln(D.pnrr.totale.importo_finanziato_eur)} finanziati, ${mln(D.pnrr.totale.spesa_rendicontata_eur)} rendicontati. Il perimetro non è verificato: altre fonti contano un numero diverso di progetti.`,
        tabella: {
          colonne: [{ nome: 'Stato' }, { nome: 'Progetti', num: true }, { nome: 'Finanziato', num: true }, { nome: 'Rendicontato', num: true }],
          righe: D.pnrr.per_stato.map((x) => [x.voce, it(x.progetti), mln(x.importo_finanziato_eur), mln(x.spesa_rendicontata_eur)]),
        },
      });
      barre(corpo, {
        voci: D.pnrr.per_stato.map((x) => ({ nome: x.voce, sub: it(x.progetti) + ' progetti', val: x.importo_finanziato_eur })),
        formatta: (n) => mln(n),
      });
    }

    {
      const { corpo } = figura(G, {
        titolo: 'Fondi di coesione: i progetti per ciclo',
        nota: `Finanziamento pubblico netto dei progetti con beneficiario il Comune: ${it(D.coe.totale.progetti)} progetti per ${mln(D.coe.totale.finanziamento_pubblico_netto_eur)}. I cicli non si sommano alle altre fonti: lo stesso progetto può comparire anche nel PNRR o nel Programma triennale.`,
        tabella: {
          colonne: [{ nome: 'Ciclo' }, { nome: 'Progetti', num: true }, { nome: 'Finanziamento', num: true }, { nome: 'Pagamenti', num: true }],
          righe: D.coe.per_ciclo.map((x) => [x.voce, it(x.progetti), mln(x.finanziamento_pubblico_netto_eur), mln(x.pagamenti_eur)]),
        },
      });
      barre(corpo, {
        voci: D.coe.per_ciclo.map((x) => ({ nome: x.voce, sub: it(x.progetti) + ' progetti', val: x.finanziamento_pubblico_netto_eur })),
        formatta: (n) => mln(n),
      });
    }

    {
      const anni = Object.entries(D.app.anni);
      const { corpo } = figura(G, {
        titolo: 'Appalti avviati: importo a base di gara',
        nota: 'CIG pubblicati da ANAC per il Comune di Palermo. L\'importo è a base di gara, non aggiudicato né pagato. Due CIG del 2026 hanno un importo anomalo in fonte (circa 2.684 M€): restano fuori dal grafico e la tabella mostra entrambe le versioni.',
        tabella: {
          colonne: [{ nome: 'Anno' }, { nome: 'CIG', num: true }, { nome: 'Importo in fonte', num: true }, { nome: 'Senza i CIG anomali', num: true }],
          righe: anni.map(([a, x]) => [a, it(x.cig), it(x.importo_base_gara_eur_come_in_fonte, 0) + ' €', it(x.importo_base_gara_eur_senza_anomali, 0) + ' €']),
        },
      });
      barre(corpo, {
        voci: anni.map(([a, x]) => ({ nome: 'Anno ' + a, sub: it(x.cig_senza_anomali) + ' CIG senza anomali', val: x.importo_base_gara_eur_senza_anomali })),
        formatta: (n) => mln(n),
      });
    }

    /* ---------- 2. Una circoscrizione ---------- */

    let circ = ROM[0];
    const q = new URLSearchParams(location.search).get('circ');
    if (q) {
      const trovata = ROM.find((c) => c === q.toUpperCase()) || ROM[Number(q) - 1];
      if (trovata) circ = trovata;
    }

    const sel = $('sel-circ');
    function selezionaCirc(c) {
      if (!ROM.includes(c) || c === circ) return;
      circ = c;
      sel.querySelectorAll('button').forEach((x) => {
        const on = x.textContent === c;
        x.setAttribute('aria-checked', String(on));
        x.tabIndex = on ? 0 : -1;
      });
      disegnaCirc();
      const u = new URL(location.href); u.searchParams.set('circ', c);
      history.replaceState(null, '', u);
    }
    ROM.forEach((c) => {
      const b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(c === circ), tabindex: c === circ ? '0' : '-1', text: c });
      b.addEventListener('click', () => selezionaCirc(c));
      b.addEventListener('keydown', (e) => {
        if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        const i = ROM.indexOf(c);
        const n = e.key === 'Home' ? ROM[0] : e.key === 'End' ? ROM[ROM.length - 1]
          : ROM[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + ROM.length) % ROM.length];
        selezionaCirc(n);
        sel.querySelector(`button[aria-checked="true"]`).focus();
      });
      sel.append(b);
    });

    function disegnaCirc() {
      nascondiTip();
      const p = P(circ), s = S_(circ), o = OP(circ);
      const quotaCitta = 100 * s.eta.totale.reduce((a, b) => a + b, 0) / TC.residenti;

      const testa = el('div', { class: 'scheda-circ-testa' }, [
        el('p', { class: 'occhiello', text: 'Circoscrizione ' + circ }),
        el('h3', { text: `${it(s.eta.totale.reduce((a, b) => a + b, 0))} residenti, ${pct(quotaCitta)} della città` }),
        el('p', { class: 'scheda-circ-nota' }, [
          `${it(s.superficie_kmq, 2)} km², ${it(p.densita_ab_kmq)} abitanti per km². `,
          el('a', { href: 'index.html?circ=' + circ + '#mappa', text: 'Apri la mappa della circoscrizione' }),
          el('span', { class: 'sep', text: '·' }),
          el('a', { href: `progetti.html?circ=${circ}`, text: 'I progetti che ricadono qui' }),
        ]),
      ]);
      const num = [
        ['Famiglie', it(s.famiglie.totale), `${it(s.famiglie.componenti_medi, 2)} persone per famiglia`],
        ['Over 65', pct(quotaEta(s.eta, 13, 16)), `indice di vecchiaia ${it(p.indice_vecchiaia, 0)}`],
        ['Stranieri', pct(s.stranieri.quota_pct), `${it(s.stranieri.totale)} residenti`],
        ['Laureati 9+', pct(s.istruzione.quote[4]), `città ${pct(TC.istruzione.quote[4])}`],
        ['Occupazione 15-64', pct(s.lavoro.tasso_pct), `donne ${pct(s.lavoro.tasso_f_pct)}`],
        ['Abitazioni vuote', pct(s.abitazioni.quota_vuote_pct), `${it(s.abitazioni.vuote)} su ${it(s.abitazioni.totali)}`],
        ['Opere 2026-2028', mln(o.importo_triennio_eur), `${it(o.interventi)} interventi`],
        ['Opere per residente', eur(o.importo_triennio_per_residente_eur), 'parziale: il 47% non ha circoscrizione'],
      ];
      const griglia = el('div', { class: 'scheda-circ-numeri' }, num.map(([k, v, n]) =>
        el('div', { class: 'scheda-circ-num' }, [
          el('span', { class: 'k', text: k }), el('span', { class: 'v', text: v }), el('span', { class: 'n', text: n }),
        ])));
      $('scheda-circ').replaceChildren(testa, griglia);

      const C = $('grafici-circ');
      C.replaceChildren();

      /* piramide: circoscrizione contro città */
      {
        const { corpo } = figura(C, {
          titolo: `La piramide dell'età della circoscrizione ${circ}, con Palermo dietro`,
          nota: `Barre piene: la circoscrizione. Barre chiare: Palermo, ridimensionata sulla popolazione della circoscrizione per confrontare le forme, non i numeri assoluti. Dove la forma si allarga o si stringe si vede il profilo della circoscrizione: non è una graduatoria. Resta fuori la classe «75 e più» (${it(aperta(s.eta).t)} persone), aperta e non di cinque anni. Censimento 2021.`,
          larga: true,
          tabella: tabellaEta('Circoscrizione ' + circ, s.eta),
        });
        const etaS = taglia(s.eta), etaT = taglia(TC.eta);
        piramide(corpo, {
          classi: CLASSI_5, ...etaS,
          confronto: etaT,
          /* la città è otto volte la circoscrizione: senza ridimensionarla le due
             forme non si possono confrontare, perché una coprirebbe l'altra */
          scala: etaS.maschi.reduce((a, b) => a + b, 0) / etaT.maschi.reduce((a, b) => a + b, 0),
        });
      }

      /* mini colonne: come si colloca */
      {
        const { corpo } = figura(C, {
          titolo: `Dove si colloca la ${circ} tra le 8 circoscrizioni`,
          nota: 'Ogni colonna è una circoscrizione, nell\'ordine da I a VIII; quella scelta è in terracotta. La cifra grande è la circoscrizione, quella piccola la città. Le barre partono da zero. Passa il mouse o tocca una colonna per il valore esatto: con un clic la scheda passa a quella circoscrizione.',
          larga: true,
        });
        const ind = [
          { nome: 'Densità', val: (c) => P(c).densita_ab_kmq, f: (n) => it(n) + ' ab/km²', citta: T.densita_ab_kmq },
          { nome: 'Indice di vecchiaia', val: (c) => P(c).indice_vecchiaia, f: (n) => it(n, 0), citta: T.indice_vecchiaia },
          { nome: 'Quota 0-14', val: (c) => P(c).quota_0_14_pct, f: pct, citta: T.quota_0_14_pct },
          { nome: 'Quota 65 e più', val: (c) => P(c).quota_65_piu_pct, f: pct, citta: T.quota_65_piu_pct },
          { nome: 'Stranieri', val: (c) => P(c).quota_stranieri_pct, f: pct, citta: T.quota_stranieri_pct },
          { nome: 'Laureati 9+', val: (c) => P(c).quota_laureati_9_piu_pct, f: pct, citta: T.quota_laureati_9_piu_pct },
          { nome: 'Occupazione 15-64', val: (c) => P(c).tasso_occupazione_15_64_pct, f: pct, citta: T.tasso_occupazione_15_64_pct },
          { nome: 'Abitazioni vuote', val: (c) => P(c).quota_abitazioni_vuote_pct, f: pct, citta: T.quota_abitazioni_vuote_pct },
        ];
        const griglia = el('div', { class: 'minigriglia' });
        ind.forEach((x) => {
          const val = x.val(circ);
          const blocco = el('div', { class: 'minig' }, [
            el('div', { class: 'minig-testa' }, [el('span', { class: 'minig-nome', text: x.nome }), el('span', { class: 'minig-val', text: x.f(val) })]),
            el('p', { class: 'minig-citta', text: 'Palermo ' + x.f(x.citta) }),
          ]);
          miniColonne(blocco, {
            voci: ROM.map((c) => ({ nome: c, val: x.val(c) })),
            evidenzia: circ,
            f: x.f,
            clic: selezionaCirc,
          });
          griglia.append(blocco);
        });
        corpo.append(griglia);
        corpo.append(el('p', { class: 'grafico-nota sotto', text: 'Tutti i valori vengono dal censimento 2021; densità e indice di vecchiaia sono calcolati sulle sezioni di censimento. La linea di confronto con la città è scritta sotto ogni titolo, non disegnata.' }));
      }

      /* composizione contro la città */
      const coppie = [
        { titolo: 'Titolo di studio', nota: 'Popolazione di 9 anni e più. Righe affiancate per confrontare le due distribuzioni: la circoscrizione in alto, Palermo in basso.', classi: D.stat.classi_istruzione, valori: (x) => x.istruzione.conteggi, tab: (x) => tabellaQuote('Circoscrizione ' + circ, D.stat.classi_istruzione, x.istruzione) },
        { titolo: 'Famiglie per numero di componenti', nota: 'Famiglie residenti. Una quota alta di famiglie da una persona cambia il bisogno di case piccole e di servizi, non solo il numero di abitanti.', classi: NOMI_FAM, valori: (x) => x.famiglie.conteggi, tab: (x) => tabellaQuote('Circoscrizione ' + circ, NOMI_FAM, x.famiglie) },
        { titolo: 'Abitazioni occupate e vuote', nota: 'Le due barre hanno la stessa scala: il colore chiaro è la parte vuota o usata solo da non residenti. Il confronto con Palermo dice se il fenomeno è della circoscrizione o della città.', classi: ['Occupate da residenti', 'Vuote o solo non residenti'], valori: (x) => [x.abitazioni.occupate, x.abitazioni.vuote], tab: (x) => tabellaAbitazioni([['Circoscrizione ' + circ, x.abitazioni], ['Palermo', TC.abitazioni]]) },
      ];
      coppie.forEach((x, i) => {
        const { corpo } = figura(C, {
          titolo: x.titolo,
          nota: x.nota,
          tabella: x.tab(s),
        });
        impilate(corpo, {
          righe: [
            { nome: 'Circ. ' + circ, valori: x.valori(s), evidenzia: true },
            { nome: 'Palermo', valori: x.valori(TC), citta: true },
          ],
          segmenti: x.classi.map((nome, j) => ({ nome, colore: i === 2 ? (j ? '--s1' : '--s4') : '--s' + (j + 1) })),
          formatta: it,
        });
      });

      /* opere */
      {
        const { corpo } = figura(C, {
          titolo: `Le opere programmate che ricadono nella ${circ}`,
          nota: `Importo del Programma triennale 2026-2028 degli interventi che cadono in una sola circoscrizione. Il ${pct(100 * D.opere.non_localizzato.importo_triennio_eur / tau.importo_triennio_eur, 0)} dell'importo comunale non ha una circoscrizione e non è diviso qui: non è una spesa della circoscrizione, è dove cade l'opera.`,
          larga: true,
          tabella: {
            colonne: [{ nome: 'Circoscrizione' }, { nome: 'Interventi', num: true }, { nome: 'Importo 2026-2028', num: true }, { nome: 'Per residente', num: true }],
            righe: ROM.map((c) => ['Circ. ' + c, it(OP(c).interventi), it(OP(c).importo_triennio_eur, 0) + ' €', it(OP(c).importo_triennio_per_residente_eur, 0) + ' €']),
          },
        });
        barre(corpo, {
          voci: ROM.map((c) => ({ id: c, nome: 'Circ. ' + c, sub: it(OP(c).interventi) + ' interventi', val: OP(c).importo_triennio_eur })),
          formatta: (n) => mln(n),
          evidenzia: circ,
          clic: selezionaCirc,
        });
        corpo.append(el('p', { class: 'grafico-nota sotto' }, [
          `Nella ${circ}: ${mln(o.importo_triennio_eur)} in ${it(o.interventi)} interventi, ${eur(o.importo_triennio_per_residente_eur)} per residente. `,
          el('a', { href: './#opere', text: 'Le opere nella pagina principale' }),
          ' · ',
          el('a', { href: `progetti.html?circ=${circ}`, text: 'L\'elenco dei progetti' }),
        ]));
      }
    }
    disegnaCirc();

    /* ---------- 3. Un argomento ---------- */

    const ARGOMENTI = [
      {
        id: 'popolazione', nome: 'Popolazione',
        lede: 'Come si distribuisce la popolazione per età, e quanto le circoscrizioni hanno profili demografici diversi. La piramide della città è nel primo capitolo; qui il confronto tra le otto.',
        rendi(corpo) {
          figura(corpo, {
            titolo: 'Le piramidi delle 8 circoscrizioni',
            nota: 'Stessa scala per tutte e otto, così le forme si possono confrontare: alcune hanno la base larga, altre la punta pesante. Maschi a sinistra, femmine a destra, dai 70-74 anni in alto ai 0-4 in basso. Passa il mouse o tocca una fascia per i valori; un clic su una piramide apre la scheda di quella circoscrizione. Restano fuori le classi «75 e più», aperte e non confrontabili con quelle di cinque anni. Censimento 2021.',
            larga: true,
            tabella: tabellaEtaMulti(ROM, S_, 'eta'),
          }).corpo.append(grigliaPiramidi());
          const { corpo: c2 } = figura(corpo, {
            titolo: 'Tre classi d\'età, per circoscrizione',
            nota: 'Quote sul totale dei residenti. La riga Palermo è il riferimento: una circoscrizione con più over 65 e meno 0-14 ha un indice di vecchiaia più alto. Non dice nulla sul reddito o sui servizi.',
            larga: true,
            tabella: tabellaQuoteMulti(ROM, S_, (x) => [quotaEta(x.eta, 0, 3), quotaEta(x.eta, 3, 13), quotaEta(x.eta, 13, 16)], ['0-14 anni', '15-64 anni', '65 e più']),
          });
          impilate(c2, {
            righe: [
              ...ROM.map((c) => ({ nome: 'Circ. ' + c, valori: [quotaEta(S_(c).eta, 0, 3), quotaEta(S_(c).eta, 3, 13), quotaEta(S_(c).eta, 13, 16)] })),
              { nome: 'Palermo', valori: [quotaEta(TC.eta, 0, 3), quotaEta(TC.eta, 3, 13), quotaEta(TC.eta, 13, 16)], citta: true },
            ],
            segmenti: [{ nome: '0-14 anni', colore: '--s5' }, { nome: '15-64 anni', colore: '--s3' }, { nome: '65 e più', colore: '--s1' }],
            formatta: (n) => pct(n), unita: '%',
          });
          const { corpo: c3 } = figura(corpo, {
            titolo: 'L\'indice di vecchiaia',
            nota: `Over 65 ogni 100 residenti fino a 14 anni. Sopra 100 la circoscrizione ha più anziani che bambini. La linea verticale segna Palermo (${it(T.indice_vecchiaia, 1)}). Censimento 2021.`,
          });
          barre(c3, {
            voci: ROM.map((c) => ({ nome: 'Circ. ' + c, val: P(c).indice_vecchiaia })),
            formatta: (n) => it(n, 0), riferimento: T.indice_vecchiaia,
          });
        },
      },
      {
        id: 'istruzione', nome: 'Istruzione',
        lede: 'Il titolo di studio della popolazione di 9 anni e più. È la fotografia del 2021: non dice quanti ragazzi si diplomano oggi né la qualità delle scuole, che non è in questo dataset.',
        rendi(corpo) {
          const { corpo: c1 } = figura(corpo, {
            titolo: 'Il titolo di studio nelle 8 circoscrizioni',
            nota: 'Quote sul totale della popolazione di 9 anni e più. La scala va dal grigio (nessun titolo) al blu (laurea o più). La riga Palermo chiude il confronto.',
            larga: true,
            tabella: tabellaQuoteMulti(ROM, S_, (x) => x.istruzione.quote, D.stat.classi_istruzione),
          });
          impilate(c1, {
            righe: [
              ...ROM.map((c) => ({ nome: 'Circ. ' + c, valori: S_(c).istruzione.conteggi })),
              { nome: 'Palermo', valori: TC.istruzione.conteggi, citta: true },
            ],
            segmenti: D.stat.classi_istruzione.map((nome, i) => ({ nome, colore: '--s' + (i + 1) })),
            formatta: it,
          });
          const { corpo: c2 } = figura(corpo, {
            titolo: 'La quota di laureati',
            nota: `Persone con titolo terziario (laurea, master, dottorato) ogni 100 residenti di 9 anni e più. La linea verticale segna Palermo (${pct(TC.istruzione.quote[4])}). Un valore alto non dice se i laureati lavorano qui.`,
          });
          barre(c2, {
            voci: ROM.map((c) => ({ nome: 'Circ. ' + c, val: S_(c).istruzione.quote[4] })),
            formatta: (n) => pct(n), riferimento: TC.istruzione.quote[4],
          });
        },
      },
      {
        id: 'famiglie', nome: 'Famiglie',
        lede: 'Quante famiglie, e di quante persone. Il numero di famiglie non segue quello degli abitanti: dove ci sono più persone sole, a parità di residenti servono più case e più pratiche.',
        rendi(corpo) {
          const { corpo: c1 } = figura(corpo, {
            titolo: 'Famiglie per numero di componenti',
            nota: 'Quote sul totale delle famiglie residenti. Il grigio chiaro è la famiglia da una persona. Censimento 2021.',
            larga: true,
            tabella: tabellaQuoteMulti(ROM, S_, (x) => x.famiglie.quote, NOMI_FAM),
          });
          impilate(c1, {
            righe: [
              ...ROM.map((c) => ({ nome: 'Circ. ' + c, valori: S_(c).famiglie.conteggi })),
              { nome: 'Palermo', valori: TC.famiglie.conteggi, citta: true },
            ],
            segmenti: NOMI_FAM.map((nome, i) => ({ nome, colore: '--s' + (i + 1) })),
            formatta: it,
          });
          const { corpo: c2 } = figura(corpo, {
            titolo: 'Persone per famiglia',
            nota: `Componenti medi per famiglia. La linea verticale segna Palermo (${it(TC.famiglie.componenti_medi, 2)}). Un valore basso segnala molte famiglie da una o due persone, non famiglie più piccole in senso stretto.`,
          });
          barre(c2, {
            voci: ROM.map((c) => ({ nome: 'Circ. ' + c, val: S_(c).famiglie.componenti_medi })),
            formatta: (n) => it(n, 2), riferimento: TC.famiglie.componenti_medi,
          });
          const { corpo: c3 } = figura(corpo, {
            titolo: 'Famiglie da una persona sola',
            nota: `Quota di famiglie con un solo componente. La linea verticale segna Palermo (${pct(TC.famiglie.quota_single_pct)}). Censimento 2021.`,
          });
          barre(c3, {
            voci: ROM.map((c) => ({ nome: 'Circ. ' + c, val: S_(c).famiglie.quota_single_pct })),
            formatta: (n) => pct(n), riferimento: TC.famiglie.quota_single_pct,
          });
        },
      },
      {
        id: 'abitazioni', nome: 'Abitazioni',
        lede: 'Case occupate e case vuote. Il censimento conta le abitazioni, non le famiglie che le vorrebbero: una casa vuota può essere in vendita, in affitto, in ristrutturazione o usata per altro.',
        rendi(corpo) {
          const { corpo: c1 } = figura(corpo, {
            titolo: 'Abitazioni occupate e vuote',
            nota: 'Ogni riga arriva a 100% delle abitazioni della circoscrizione. La parte chiara è «vuote o occupate solo da non residenti». La riga Palermo è il confronto.',
            larga: true,
            tabella: tabellaAbitazioni([...ROM.map((c) => ['Circ. ' + c, S_(c).abitazioni]), ['Palermo', TC.abitazioni]]),
          });
          impilate(c1, {
            righe: [
              ...ROM.map((c) => ({ nome: 'Circ. ' + c, valori: [S_(c).abitazioni.occupate, S_(c).abitazioni.vuote] })),
              { nome: 'Palermo', valori: [TC.abitazioni.occupate, TC.abitazioni.vuote], citta: true },
            ],
            segmenti: [{ nome: 'Occupate da residenti', colore: '--s4' }, { nome: 'Vuote o solo non residenti', colore: '--s1' }],
            formatta: it,
          });
          const { corpo: c2 } = figura(corpo, {
            titolo: 'La quota di abitazioni vuote',
            nota: `Vuote o occupate solo da non residenti, ogni 100 abitazioni. La linea verticale segna Palermo (${pct(TC.abitazioni.quota_vuote_pct)}). Censimento 2021.`,
          });
          barre(c2, {
            voci: ROM.map((c) => ({ nome: 'Circ. ' + c, val: S_(c).abitazioni.quota_vuote_pct })),
            formatta: (n) => pct(n), riferimento: TC.abitazioni.quota_vuote_pct,
          });
          const { corpo: c3 } = figura(corpo, {
            titolo: 'Quante persone per abitazione occupata',
            nota: 'Residenti diviso abitazioni occupate da almeno un residente. Un valore alto indica case più affollate; non dice la dimensione delle case, che il censimento non riporta qui.',
          });
          barre(c3, {
            voci: ROM.map((c) => ({ nome: 'Circ. ' + c, val: S_(c).abitazioni.abitanti_per_abitazione_occupata })),
            formatta: (n) => it(n, 2), riferimento: TC.abitazioni.abitanti_per_abitazione_occupata,
          });
        },
      },
      {
        id: 'stranieri', nome: 'Stranieri',
        lede: 'Cittadini non italiani e apolidi residenti. La circoscrizione I concentra quasi un quinto dei residenti stranieri della città: è il dato che più cambia da una circoscrizione all\'altra.',
        rendi(corpo) {
          const { corpo: c1 } = figura(corpo, {
            titolo: 'La quota di stranieri',
            nota: `Stranieri e apolidi residenti ogni 100 residenti. La linea verticale segna Palermo (${pct(TC.stranieri.quota_pct)}). Censimento 2021.`,
          });
          barre(c1, {
            voci: ROM.map((c) => ({ nome: 'Circ. ' + c, val: S_(c).stranieri.quota_pct })),
            formatta: (n) => pct(n), riferimento: TC.stranieri.quota_pct,
          });
          const { corpo: c2 } = figura(corpo, {
            titolo: 'Cittadini dell\'Unione europea e extra-UE',
            nota: 'Quote sul totale degli stranieri residenti nella circoscrizione. La riga Palermo chiude il confronto: la composizione per cittadinanza cambia molto più della quota totale.',
            larga: true,
            tabella: tabellaQuoteMulti(ROM, S_, (x) => [100 * x.stranieri.ue / x.stranieri.totale, 100 * x.stranieri.extraue / x.stranieri.totale], ['Unione europea', 'Extra-UE e apolidi']),
          });
          impilate(c2, {
            righe: [
              ...ROM.map((c) => ({ nome: 'Circ. ' + c, valori: [S_(c).stranieri.ue, S_(c).stranieri.extraue] })),
              { nome: 'Palermo', valori: [TC.stranieri.ue, TC.stranieri.extraue], citta: true },
            ],
            segmenti: [{ nome: 'Unione europea', colore: '--s3' }, { nome: 'Extra-UE e apolidi', colore: '--s5' }],
            formatta: it,
          });
          const { corpo: c3 } = figura(corpo, {
            titolo: 'Le prime dieci cittadinanze a Palermo',
            nota: `Prime dieci cittadinanze del file ISTAT, su ${it(TC.stranieri.totale)} stranieri residenti: coprono il ${pct(100 * Object.values(TC.stranieri.cittadinanze).reduce((a, b) => a + b, 0) / TC.stranieri.totale, 0)}. Le altre non sono in questo elenco: il file non le dettaglia. Censimento 2021.`,
          });
          barre(c3, {
            voci: Object.entries(TC.stranieri.cittadinanze).map(([nome, val]) => ({ nome, val })),
            formatta: it,
          });
        },
      },
      {
        id: 'lavoro', nome: 'Lavoro',
        lede: 'Occupati e tassi di occupazione. Il censimento dice quante persone hanno un lavoro, non quale: professione, contratto e reddito non sono in questo dataset.',
        rendi(corpo) {
          const { corpo: c1 } = figura(corpo, {
            titolo: 'Il tasso di occupazione 15-64',
            nota: `Occupati ogni 100 residenti di 15-64 anni. La linea verticale segna Palermo (${pct(TC.lavoro.tasso_pct)}). Censimento 2021.`,
          });
          barre(c1, {
            voci: ROM.map((c) => ({ nome: 'Circ. ' + c, val: S_(c).lavoro.tasso_pct })),
            formatta: (n) => pct(n), riferimento: TC.lavoro.tasso_pct,
          });
          const { corpo: c2 } = figura(corpo, {
            titolo: 'Il tasso di occupazione femminile',
            nota: `Donne occupate ogni 100 residenti donne di 15-64 anni. La linea verticale segna Palermo (${pct(TC.lavoro.tasso_f_pct)}): il divario con gli uomini è di ${it(TC.lavoro.tasso_m_pct - TC.lavoro.tasso_f_pct, 1)} punti.`,
          });
          barre(c2, {
            voci: ROM.map((c) => ({ nome: 'Circ. ' + c, val: S_(c).lavoro.tasso_f_pct })),
            formatta: (n) => pct(n), riferimento: TC.lavoro.tasso_f_pct,
          });
          const { corpo: c3 } = figura(corpo, {
            titolo: 'Il divario tra uomini e donne',
            nota: 'Differenza in punti tra tasso maschile e femminile nella stessa circoscrizione: più è alta, più il lavoro è distribuito in modo diseguale. Non è un giudizio su chi lavora.',
            larga: true,
            tabella: {
              colonne: [{ nome: 'Circoscrizione' }, { nome: 'Uomini', num: true }, { nome: 'Donne', num: true }, { nome: 'Divario', num: true }],
              righe: [...ROM.map((c) => ['Circ. ' + c, pct(S_(c).lavoro.tasso_m_pct), pct(S_(c).lavoro.tasso_f_pct), pct(S_(c).lavoro.tasso_m_pct - S_(c).lavoro.tasso_f_pct)]), ['Palermo', pct(TC.lavoro.tasso_m_pct), pct(TC.lavoro.tasso_f_pct), pct(TC.lavoro.tasso_m_pct - TC.lavoro.tasso_f_pct)]],
            },
          });
          barre(c3, {
            voci: ROM.map((c) => ({ nome: 'Circ. ' + c, sub: `uomini ${pct(S_(c).lavoro.tasso_m_pct)} · donne ${pct(S_(c).lavoro.tasso_f_pct)}`, val: S_(c).lavoro.tasso_m_pct - S_(c).lavoro.tasso_f_pct })),
            formatta: (n) => pct(n), riferimento: TC.lavoro.tasso_m_pct - TC.lavoro.tasso_f_pct,
          });
        },
      },
      {
        id: 'opere', nome: 'Opere e soldi',
        lede: 'L\'unico denaro pubblico che il sito può collocare sul territorio è il Programma triennale delle opere. Bilancio, PNRR, coesione e appalti non hanno la circoscrizione: stanno nel primo capitolo, per tutto il Comune.',
        rendi(corpo) {
          const { corpo: c1 } = figura(corpo, {
            titolo: 'Opere programmate 2026-2028 per circoscrizione',
            nota: `Interventi che cadono in una sola circoscrizione. Restano fuori ${it(D.opere.non_localizzato.interventi)} interventi (${mln(D.opere.non_localizzato.importo_triennio_eur)}) senza circoscrizione e ${it(D.opere.piu_circoscrizioni.interventi)} che ne toccano più di una. Non è una spesa della circoscrizione: è dove cade l'opera.`,
            larga: true,
            tabella: {
              colonne: [{ nome: 'Circoscrizione' }, { nome: 'Interventi', num: true }, { nome: 'Importo', num: true }, { nome: 'Per residente', num: true }],
              righe: ROM.map((c) => ['Circ. ' + c, it(OP(c).interventi), it(OP(c).importo_triennio_eur, 0) + ' €', it(OP(c).importo_triennio_per_residente_eur, 0) + ' €']),
            },
          });
          barre(c1, {
            voci: ROM.map((c) => ({ nome: 'Circ. ' + c, sub: it(OP(c).interventi) + ' interventi', val: OP(c).importo_triennio_eur })),
            formatta: (n) => mln(n),
          });
          const { corpo: c2 } = figura(corpo, {
            titolo: 'Opere per residente',
            nota: `Importo 2026-2028 diviso per i residenti 2021. È un rapporto, non una spesa pro capite: l'opera serve il territorio in cui cade, non solo chi ci abita. Il ${pct(100 * D.opere.non_localizzato.importo_triennio_eur / tau.importo_triennio_eur, 0)} dell'importo comunale non ha circoscrizione e non entra in questo calcolo.`,
          });
          barre(c2, {
            voci: ROM.map((c) => ({ nome: 'Circ. ' + c, val: OP(c).importo_triennio_per_residente_eur })),
            formatta: (n) => eur(n), riferimento: opereProResidenteCitta,
          });
        },
      },
    ];

    const linguette = $('linguette');
    const pannello = $('pannello');
    let arg = ARGOMENTI[0];
    const daUrl = new URLSearchParams(location.search).get('argomento');
    const trovato = ARGOMENTI.find((a) => a.id === daUrl);
    if (trovato) arg = trovato;

    ARGOMENTI.forEach((a, i) => {
      const b = el('button', { type: 'button', role: 'tab', id: 'tab-' + a.id, 'aria-controls': 'pannello', 'aria-selected': String(a === arg), tabindex: a === arg ? '0' : '-1', text: a.nome });
      b.addEventListener('click', () => scegli(a));
      b.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'Home' ? -99 : e.key === 'End' ? 99 : 0;
        if (!d) return;
        e.preventDefault();
        const n = d === -99 ? ARGOMENTI[0] : d === 99 ? ARGOMENTI[ARGOMENTI.length - 1] : ARGOMENTI[(ARGOMENTI.indexOf(a) + d + ARGOMENTI.length) % ARGOMENTI.length];
        scegli(n);
        document.getElementById('tab-' + n.id).focus();
      });
      linguette.append(b);
    });

    function scegli(a) {
      arg = a;
      linguette.querySelectorAll('[role="tab"]').forEach((b) => {
        const on = b.id === 'tab-' + a.id;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      pannello.setAttribute('aria-labelledby', 'tab-' + a.id);
      const u = new URL(location.href); u.searchParams.set('argomento', a.id);
      history.replaceState(null, '', u);
      disegnaArgomento();
    }

    function disegnaArgomento() {
      nascondiTip();
      pannello.setAttribute('aria-labelledby', 'tab-' + arg.id);
      pannello.replaceChildren();
      pannello.append(el('p', { class: 'pannello-lede', text: arg.lede }));
      arg.rendi(pannello);
    }
    disegnaArgomento();

    /* ================= primitive dei grafici ================= */

    function figura(host, o) {
      const f = el('figure', { class: 'grafico' + (o.larga ? ' larga' : '') });
      f.append(el('figcaption', { class: 'grafico-testa' }, [
        el('h3', { text: o.titolo }),
        o.nota ? el('p', { class: 'grafico-nota', text: o.nota }) : null,
      ]));
      const corpo = el('div', { class: 'grafico-corpo' });
      f.append(corpo);
      if (o.tabella) f.append(dettagliTabella(o.tabella));
      host.append(f);
      return { figura: f, corpo };
    }

    function dettagliTabella(t) {
      const d = el('details', { class: 'dati' });
      d.append(el('summary', { text: 'Vedi i numeri' }));
      const table = el('table', { class: 'tabella-dati' });
      table.append(el('thead', {}, el('tr', {}, t.colonne.map((c) => el('th', { scope: 'col', class: c.num ? 'num' : null, text: c.nome })))));
      table.append(el('tbody', {}, t.righe.map((r) => el('tr', {}, r.map((v, i) => el('td', { class: t.colonne[i] && t.colonne[i].num ? 'num' : null, text: v }))))));
      d.append(el('div', { class: 'tabella-scroll' }, table));
      return d;
    }

    function barre(host, { voci, formatta, evidenzia = null, riferimento = null, ordina = true, clic = null }) {
      const v = ordina ? [...voci].sort((a, b) => (b.val || 0) - (a.val || 0)) : [...voci];
      const mx = Math.max(...v.map((x) => x.val || 0), riferimento || 0) || 1;
      const box = el('div', { class: 'barre-dato', role: clic ? 'group' : 'list' });
      v.forEach((x) => {
        const scelta = x.id === evidenzia || (evidenzia && x.nome === 'Circ. ' + evidenzia);
        const p = Math.max(0.7, 100 * (x.val || 0) / mx);
        const pista = el('div', { class: 'pista' }, [
          el('span', { class: 'riempi', style: { width: p + '%' } }),
        ]);
        if (riferimento != null) {
          pista.append(el('span', {
            class: 'rif', style: { left: Math.min(100, Math.max(0, 100 * riferimento / mx)) + '%' },
            'aria-hidden': 'true',
          }));
        }
        const attivo = clic && x.id;
        const row = el('div', {
          class: 'riga-barra' + (scelta ? ' scelta' : '') + (attivo ? ' cliccabile' : ''),
          role: attivo ? 'button' : 'listitem',
          tabindex: attivo ? '0' : null,
        }, [
          el('div', { class: 'nome' }, [el('b', { text: x.nome }), x.sub ? el('small', { text: x.sub }) : null]),
          pista,
          el('div', { class: 'val', text: formatta(x.val) }),
        ]);
        row.setAttribute('aria-label', x.nome + ': ' + formatta(x.val) + (x.sub ? ', ' + x.sub : '') +
          (scelta ? ' (circoscrizione scelta)' : '') + (attivo ? '. Premi per aprire la scheda' : ''));
        const righe = [['Valore', formatta(x.val)]];
        if (x.sub) righe.push(['Dettaglio', x.sub]);
        if (riferimento != null) righe.push(['Palermo', formatta(riferimento)]);
        if (attivo) righe.push(['Clic', 'apri la scheda della ' + x.id]);
        conTip(row, x.nome, righe);
        if (attivo) {
          const apri = () => { nascondiTip(); clic(x.id); };
          row.addEventListener('click', apri);
          row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apri(); }
          });
        }
        box.append(row);
      });
      host.append(box);
    }

    function impilate(host, { righe, segmenti, formatta, conValori = false }) {
      const box = el('div', { class: 'impilate', role: 'list' });
      const totali = righe.map((r) => r.valori.reduce((a, b) => a + b, 0) || 1);
      righe.forEach((r, ri) => {
        const tot = totali[ri];
        const pista = el('div', { class: 'pista-imp' });
        r.valori.forEach((v, i) => {
          if (!v) return;
          const quota = 100 * v / tot;
          const seg = el('span', { class: 'seg seg-' + i, style: { width: quota + '%', background: `var(${segmenti[i].colore})` } });
          if (quota >= 10) seg.append(el('span', { class: 'seg-lab', text: pct(quota) }));
          conTip(seg, segmenti[i].nome, [[r.nome, formatta(v)], ['Quota', pct(quota)]]);
          pista.append(seg);
        });
        const row = el('div', { class: 'riga-imp' + (r.evidenzia ? ' scelta' : '') + (r.citta ? ' citta' : ''), role: 'listitem' }, [
          el('div', { class: 'nome', text: r.nome }),
          pista,
        ]);
        row.setAttribute('aria-label', r.nome + ': ' + r.valori.map((v, i) => `${segmenti[i].nome} ${pct(100 * v / tot)}`).join(', '));
        box.append(row);
      });
      host.append(box);
      const conNumeri = conValori && righe.length === 1;
      host.append(el('div', { class: 'legenda-imp' }, segmenti.map((s, i) => el('span', { class: 'voce-leg' }, [
        el('span', { class: 'pastiglia', style: { background: `var(${s.colore})` } }),
        s.nome,
        conNumeri ? el('b', { text: pct(100 * righe[0].valori[i] / totali[0]) }) : null,
      ]))));
    }

    function piramide(host, { classi, maschi, femmine, confronto = null, scala = 1 }) {
      const W = 760, rowH = 22, top = 46, bottom = 22;
      const H = top + classi.length * rowH + bottom;
      const cx = W / 2, gap = 36, margine = 58, half = cx - margine - gap;
      const cm = confronto ? confronto.maschi.map((v) => v * scala) : null;
      const cf = confronto ? confronto.femmine.map((v) => v * scala) : null;
      const mx = Math.max(...maschi, ...femmine, ...(cm || [0]), ...(cf || [0])) || 1;
      const tot = maschi.reduce((a, b) => a + b, 0) + femmine.reduce((a, b) => a + b, 0);
      const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'piramide', role: 'group' });
      svg.setAttribute('aria-label', 'Piramide dell\'età in classi quinquennali, maschi a sinistra e femmine a destra. Ogni riga si può leggere con il mouse o con la tastiera.');
      const totM = maschi.reduce((a, b) => a + b, 0), totF = femmine.reduce((a, b) => a + b, 0);

      /* griglia */
      [0.25, 0.5, 0.75, 1].forEach((t) => {
        const xm = cx - gap - half * t, xf = cx + gap + half * t;
        svg.append(S('line', { x1: xm, x2: xm, y1: top - 6, y2: top + classi.length * rowH - 4, class: 'griglia' }));
        svg.append(S('line', { x1: xf, x2: xf, y1: top - 6, y2: top + classi.length * rowH - 4, class: 'griglia' }));
        if (t === 0.5 || t === 1) {
          const lab = it(Math.round(mx * t));
          testo(svg, { x: xm, y: top - 12, class: 'tick', 'text-anchor': 'end' }, lab);
          testo(svg, { x: xf, y: top - 12, class: 'tick', 'text-anchor': 'start' }, lab);
        }
      });

      testo(svg, { x: cx - gap - half / 2, y: 20, class: 'intestazione', 'text-anchor': 'middle' }, `Maschi 0-74 · ${it(totM)}`);
      testo(svg, { x: cx + gap + half / 2, y: 20, class: 'intestazione', 'text-anchor': 'middle' }, `Femmine 0-74 · ${it(totF)}`);

      /* piramide rovesciata: la classe 0-4 sta in basso, le più anziane salgono */
      classi.forEach((nome, i) => {
        const y = top + (classi.length - 1 - i) * rowH;
        const h = rowH - 7;
        const m = maschi[i], f = femmine[i];
        const fila = S('g', { class: 'fila', tabindex: '0', role: 'group' });
        fila.setAttribute('aria-label', `${nome} anni: maschi ${it(m)}, femmine ${it(f)}, totale ${it(m + f)}`);

        if (confronto) {
          [[cm[i], -1], [cf[i], 1]].forEach(([c, dir]) => {
            const wg = half * c / mx;
            fila.append(S('rect', {
              x: dir > 0 ? cx + gap : cx - gap - wg, y, width: wg, height: h,
              class: 'ghost', rx: 1,
            }));
          });
        }

        [[m, 'm', -1], [f, 'f', 1]].forEach(([v, sesso, dir]) => {
          const chi = sesso === 'm' ? 'maschi' : 'femmine';
          const w = half * v / mx;
          const r = S('rect', {
            x: dir > 0 ? cx + gap : cx - gap - w, y, width: Math.max(w, 0.6), height: h,
            class: 'barra-' + sesso, rx: 1,
          });
          r.append(titolo(`${nome} anni, ${chi}: ${it(v)}`));
          fila.append(r);
          /* etichetta dentro la barra solo se il numero ci sta */
          const txt = it(v);
          if (w > txt.length * 5.6 + 12) {
            testo(fila, {
              x: dir > 0 ? cx + gap + w - 5 : cx - gap - w + 5,
              y: y + h - 4.5, class: 'lab lab-' + sesso,
              'text-anchor': dir > 0 ? 'end' : 'start',
            }, txt);
          }
        });

        testo(fila, { x: cx, y: y + h - 3, class: 'classe', 'text-anchor': 'middle' }, nome);
        fila.append(S('rect', {
          x: cx - gap - half, y: y - 1.5, width: 2 * (gap + half), height: rowH - 4,
          class: 'hit', fill: 'transparent',
        }));
        conTip(fila, `Età ${nome}`, [
          ['Maschi', it(m)],
          ['Femmine', it(f)],
          ['Totale', it(m + f)],
          ['Quota sul 0-74', pct(100 * (m + f) / tot)],
        ]);
        svg.append(fila);
      });
      host.append(svg);
      if (confronto) {
        host.append(el('div', { class: 'legenda-imp' }, [
          el('span', { class: 'voce-leg' }, [el('span', { class: 'pastiglia', style: { background: 'var(--s5)' } }), 'Maschi, circoscrizione']),
          el('span', { class: 'voce-leg' }, [el('span', { class: 'pastiglia', style: { background: 'var(--s3)' } }), 'Femmine, circoscrizione']),
          el('span', { class: 'voce-leg' }, [el('span', { class: 'pastiglia chiara', style: { background: 'var(--linea)' } }), 'Palermo (stesse proporzioni)']),
        ]));
      }
    }

    function miniPiramide(host, { classi, maschi, femmine, nome }) {
      const W = 200, H = 116, cx = W / 2, half = 88, rowH = 6.4, top = 6;
      const mx = Math.max(...maschi, ...femmine) || 1;
      const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'mini-piramide', 'aria-hidden': 'true' });
      svg.append(S('line', { x1: cx, x2: cx, y1: top, y2: top + maschi.length * rowH, class: 'griglia' }));
      classi.forEach((classe, i) => {
        const y = top + (classi.length - 1 - i) * rowH;
        const m = maschi[i], f = femmine[i];
        const fila = S('g', { class: 'fila' });
        fila.append(S('rect', { x: cx - 2 - half * m / mx, y, width: Math.max(half * m / mx, 0.6), height: rowH - 2.2, class: 'barra-m', rx: 0.5 }));
        fila.append(S('rect', { x: cx + 2, y, width: Math.max(half * f / mx, 0.6), height: rowH - 2.2, class: 'barra-f', rx: 0.5 }));
        fila.append(S('rect', { x: cx - half - 2, y: y - 0.6, width: 2 * half + 4, height: rowH - 1, class: 'hit', fill: 'transparent' }));
        conTip(fila, `Circ. ${nome} · età ${classe}`, [
          ['Maschi', it(m)],
          ['Femmine', it(f)],
          ['Totale', it(m + f)],
        ]);
        svg.append(fila);
      });
      host.append(svg);
    }

    function miniColonne(host, { voci, evidenzia, f, clic = null }) {
      /* le colonne sono ripetute nella tabella e nella cifra grande: si cliccano col
         mouse, ma non fermano la tastiera 64 volte */
      const tela = el('div', { class: 'mini-tela', 'aria-hidden': 'true' });
      const serie = el('div', { class: 'mini-serie' });
      const mx = Math.max(...voci.map((x) => x.val || 0)) || 1;
      voci.forEach((x) => {
        const scelta = x.nome === evidenzia;
        const uno = el('span', { class: 'mini-uno' + (scelta ? ' scelta' : '') + (clic ? ' cliccabile' : '') });
        const asta = el('span', { class: 'mini-asta' });
        const bar = el('i', { class: 'mini-bar', style: { height: Math.max(1, 100 * (x.val || 0) / mx) + '%' } });
        asta.append(bar);
        uno.append(asta, el('i', { class: 'mini-n', text: x.nome }));
        conTip(uno, 'Circoscrizione ' + x.nome, [['Valore', f(x.val)], ...(scelta ? [['Stato', 'scelta']] : [])]);
        if (clic) uno.addEventListener('click', () => { nascondiTip(); clic(x.nome); });
        serie.append(uno);
      });
      tela.append(serie);
      host.append(tela);
    }

    /* ================= tabelle ================= */

    function tabellaEta(nome, e) {
      return {
        colonne: [{ nome: 'Età' }, { nome: 'Maschi', num: true }, { nome: 'Femmine', num: true }, { nome: 'Totale', num: true }],
        righe: e.totale.map((t, i) => [D.stat.classi_eta[i], it(e.maschi[i]), it(e.femmine[i]), it(t)]),
      };
    }
    function tabellaEtaMulti(circs, getter, chiave) {
      return {
        colonne: [{ nome: 'Circoscrizione' }, ...D.stat.classi_eta.map((c) => ({ nome: c, num: true }))],
        righe: circs.map((c) => ['Circ. ' + c, ...getter(c)[chiave].totale.map((v) => it(v))]),
      };
    }
    function tabellaQuote(nome, classi, blocco) {
      return {
        colonne: [{ nome: 'Voce' }, { nome: 'Persone', num: true }, { nome: 'Quota', num: true }],
        righe: classi.map((c, i) => [c, it(blocco.conteggi[i]), pct(blocco.quote[i])]),
      };
    }
    function tabellaQuoteMulti(circs, getter, valori, classi) {
      return {
        colonne: [{ nome: 'Circoscrizione' }, ...classi.map((c) => ({ nome: c, num: true }))],
        righe: circs.map((c) => ['Circ. ' + c, ...valori(getter(c)).map((v) => pct(v))]).concat([['Palermo', ...valori(TC).map((v) => pct(v))]]),
      };
    }
    function tabellaAbitazioni(righe) {
      return {
        colonne: [{ nome: 'Territorio' }, { nome: 'Abitazioni', num: true }, { nome: 'Occupate', num: true }, { nome: 'Vuote', num: true }, { nome: 'Quota vuote', num: true }],
        righe: righe.map(([nome, a]) => [nome, it(a.totali), it(a.occupate), it(a.vuote), pct(a.quota_vuote_pct)]),
      };
    }
    function tabellaCittadinanze(s) {
      return {
        colonne: [{ nome: 'Cittadinanza' }, { nome: 'Residenti', num: true }],
        righe: Object.entries(s.cittadinanze).map(([n, v]) => [n, it(v)]).concat([['Totale stranieri', it(s.totale)]]),
      };
    }

    function grigliaPiramidi() {
      const g = el('div', { class: 'mini-piramidi' });
      ROM.forEach((c) => {
        const box = el('button', {
          type: 'button', class: 'mini-piramide-box',
          'aria-label': `Circoscrizione ${c}: ${it(S_(c).eta.totale.reduce((a, b) => a + b, 0))} residenti. Apri il profilo della circoscrizione`,
        }, [
          el('p', { class: 'mini-piramide-nome' }, [el('b', { text: 'Circ. ' + c }), el('span', { text: it(S_(c).eta.totale.reduce((a, b) => a + b, 0)) })]),
        ]);
        miniPiramide(box, { classi: CLASSI_5, ...taglia(S_(c).eta), nome: c });
        box.addEventListener('click', () => {
          nascondiTip();
          selezionaCirc(c);
          const profilo = document.getElementById('per-circoscrizione');
          profilo.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        });
        g.append(box);
      });
      return g;
    }
  }
})();
