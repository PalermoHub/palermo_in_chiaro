/* Scheda di un progetto o finanziamento: legge data/progetti.json e mostra la voce con id=... */
(() => {
  'use strict';
  const it = (n, d = 0) => n == null ? 'non disponibile' : n.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
  const eur = (n) => n == null ? 'non disponibile' : it(n, 2) + ' €';
  const mln = (n, d = 2) => n == null ? 'non disponibile' : it(n / 1e6, d) + ' M€';
  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs = {}, kids = []) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'text') e.textContent = v;
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const c of [].concat(kids).flat(Infinity)) if (c != null && c !== false) e.append(c);
    return e;
  };
  const ETICHETTE = { opere: 'Opere pubbliche', pnrr: 'PNRR', coesione: 'Fondi di coesione', appalti: 'Appalti' };
  const ESTERNO = { target: '_blank', rel: 'noopener' };

  const riga = (dt, dd) => el('div', { class: 'riga' }, [el('dt', { text: dt }), el('dd', {}, [dd])]);
  const link = (href, testo, extra = {}) => el('a', Object.assign({ href, text: testo }, ESTERNO, extra));
  const riquadro = (titolo, nodi) => el('section', { class: 'riquadro' }, [el('h2', { text: titolo }), ...[].concat(nodi).flat(Infinity).filter(Boolean)]);
  /* Collegamento alla fonte ufficiale: badge in evidenza, poi il link e il dominio. */
  const voceUfficiale = (href, testo, dominio, badge = 'Fonte ufficiale') => el('li', { class: 'ufficiale' }, [
    el('span', { class: 'badge ufficiale', text: badge }), link(href, testo), el('span', { class: 'est', text: dominio })]);
  const voceVerifica = (href, testo, nota) => el('li', { class: 'ufficiale' }, [
    el('span', { class: 'badge verifica', text: 'Da verificare' }), link(href, testo), el('span', { class: 'est', text: nota })]);

  const id = new URLSearchParams(location.search).get('id');

  fetch('data/progetti.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('dati'); return r.json(); })
    .then(D => {
      const p = id ? D.progetti.find(x => x.id === id) : null;
      if (!p) return nonTrovato(D);
      mostra(p, D);
    })
    .catch(() => {
      $('scheda-progetto').replaceChildren(el('p', { class: 'avviso', text: 'I dati non si caricano. Avvia un server locale: python3 -m http.server 8823, poi apri http://localhost:8823/progetto.html?id=...' }));
    });

  function nonTrovato(D) {
    $('scheda-progetto').replaceChildren(
      el('h1', { text: 'Scheda non trovata' }),
      el('p', { class: 'lede', text: id ? `Nessuna voce con identificativo «${id}».` : 'Manca l\'identificativo della voce: aggiungi ?id=... all\'indirizzo, oppure parti dall\'elenco.' }),
      el('p', {}, [el('a', { href: 'progetti.html', text: `Vai all'elenco dei ${it(D.progetti.length)} progetti e finanziamenti` })]),
    );
  }

  function mostra(p, D) {
    const fonti = p.fonti.map(f => el('span', { class: 'badge ' + f, text: ETICHETTE[f] || f }));
    document.title = p.titolo.slice(0, 70) + ' · Palermo in chiaro';
    const testa = el('header', { class: 'pagina-testa' }, [
      el('h1', { text: p.titolo }),
      el('div', { class: 'fonti-riga', style: 'margin-top:10px' }, fonti),
      el('p', { class: 'lede', style: 'font-size:.95rem' }, [
        p.cup ? el('span', {}, ['CUP ', el('b', { text: p.cup })]) : null,
        p.cup && p.cui ? ' · ' : null,
        p.cui ? el('span', {}, ['CUI ', el('b', { text: p.cui })]) : null,
        (p.cup || p.cui) ? ' · ' : null,
        el('span', { text: 'voce ' + p.id }),
      ]),
    ]);

    /* ---- colonna sinistra: importi ---- */
    const importi = [];
    if (p.opere) {
      const o = p.opere;
      importi.push(el('h3', { text: 'Opere pubbliche, Programma triennale 2026-2028' }));
      importi.push(el('div', { class: 'grande', text: mln(o.importo_triennio_eur, 2) }));
      importi.push(el('p', { class: 'nota', text: 'importo programmato nel triennio (stanziamento, non spesa)' }));
      importi.push(el('dl', {}, [
        riga('Importo complessivo', eur(o.importo_complessivo_eur)),
        riga('2026', eur(o.annualita_eur['2026'])),
        riga('2027', eur(o.annualita_eur['2027'])),
        riga('2028', eur(o.annualita_eur['2028'])),
        o.settore ? riga('Settore', o.settore) : null,
        o.tipologia ? riga('Tipologia', o.tipologia) : null,
        o.rup ? riga('RUP', o.rup) : null,
        o.cup_stato ? riga('Stato del CUP', o.cup_stato) : null,
      ].filter(Boolean)));
    }
    if (p.finanziamenti && p.finanziamenti.length) {
      importi.push(el('h3', { text: 'Fonte di finanziamento dichiarata nel Programma' }));
      p.finanziamenti.forEach(f => importi.push(el('dl', {}, [
        f.tipologia_risorsa ? riga('Tipologia di risorsa', f.tipologia_risorsa) : null,
        f.descrizione ? riga('Descrizione', f.descrizione) : null,
        f.importo_totale_eur != null ? riga('Importo della fonte', eur(f.importo_totale_eur)) : null,
      ].filter(Boolean))));
    }
    if (p.pnrr) {
      const n = p.pnrr;
      importi.push(el('h3', { text: 'PNRR' }));
      importi.push(el('div', { class: 'grande', text: mln(n.importo_finanziato_eur, 2) }));
      importi.push(el('p', { class: 'nota', text: 'importo finanziato dichiarato dal Comune nella scheda' }));
      importi.push(el('dl', {}, [
        riga('Spesa rendicontata', eur(n.spesa_rendicontata_eur)),
        n.stato ? riga('Stato', n.stato) : null,
        n.missione ? riga('Missione', n.missione) : null,
        n.proponente ? riga('Soggetto proponente', n.proponente_url ? link(n.proponente_url, n.proponente) : n.proponente) : null,
        n.attuatore ? riga('Soggetto attuatore', n.attuatore) : null,
        n.decreto_finanziamento ? riga('Decreto di finanziamento', n.decreto_finanziamento) : null,
      ].filter(Boolean)));
      if (n.url) importi.push(el('p', { class: 'nota' }, ['Scheda ufficiale: ', link(n.url, 'pnrr.comune.palermo.it')]));
    }
    if (p.coesione && p.coesione.length) {
      importi.push(el('h3', { text: 'Fondi di coesione' }));
      if (p.coesione.length > 1) importi.push(el('p', { class: 'nota', text: `${p.coesione.length} linee di finanziamento sullo stesso CUP: si mostrano separate, non si sommano.` }));
      p.coesione.forEach(c => importi.push(el('dl', {}, [
        c.programma ? riga('Programma', c.programma) : null,
        c.ciclo ? riga('Ciclo', c.ciclo) : null,
        c.stato ? riga('Stato del progetto', c.stato) : null,
        c.finanziamento_pubblico_netto_eur != null ? riga('Finanziamento pubblico netto', eur(c.finanziamento_pubblico_netto_eur)) : null,
        c.pagamenti_eur != null ? riga('Pagamenti', eur(c.pagamenti_eur)) : null,
        c.link ? riga('Scheda OpenCoesione', link(c.link, 'opencoesione.gov.it')) : null,
      ].filter(Boolean))));
    }
    if (p.appalti && p.appalti.length) {
      importi.push(el('h3', { text: `Appalti collegati per CUI (${p.appalti.length})` }));
      importi.push(el('div', { class: 'tabella-scroll' }, [el('table', { class: 'appalti' }, [
        el('thead', {}, [el('tr', {}, [el('th', { scope: 'col', text: 'CIG' }), el('th', { scope: 'col', text: 'Oggetto' }), el('th', { scope: 'col', text: 'Anno' }), el('th', { scope: 'col', class: 'num', text: 'Base di gara' })])]),
        el('tbody', {}, p.appalti.map(a => el('tr', {}, [
          el('td', { text: a.cig }),
          el('td', { text: a.oggetto || 'non disponibile' }),
          el('td', { text: a.anno_pubblicazione || '' }),
          el('td', { class: 'num', text: eur(a.importo_base_gara_eur) }),
        ]))),
      ])]));
    }
    if (!importi.length) importi.push(el('p', { class: 'nota', text: 'Nessun importo disponibile in fonte per questa voce.' }));

    const limiti = el('div', { class: 'limiti' }, [
      el('h3', { text: 'Cosa non misura' }),
      el('ul', {}, [
        el('li', { text: p.opere ? 'L\'importo delle opere è uno stanziamento programmato: non è la spesa sostenuta e può cambiare con una variazione.' : 'Nessun importo di questo tipo è una spesa effettiva.' }),
        el('li', { text: 'Gli importi delle diverse fonti non si sommano: stanziamento, finanziamento PNRR, fondo di coesione e base di gara misurano cose diverse.' }),
        el('li', { text: p.pnrr ? 'L\'importo PNRR e la spesa rendicontata sono quelli dichiarati dal Comune, non verificati da un terzo.' : 'PNRR e coesione non riportano la circoscrizione: il progetto resta comunale.' }),
        el('li', { text: 'Il collegamento tra fonti avviene solo per CUP o CUI identico; dove il codice manca, possono esistere altri collegamenti non dimostrabili con i dati aperti.' }),
        el('li', { text: 'Un valore insolito è un segnale da approfondire, non la prova di uno spreco o di un illecito.' }),
      ]),
    ]);

    /* ---- colonna destra ---- */
    const ident = el('dl', {}, [
      riga('Identificativo', p.id),
      riga('CUP', p.cup || 'non presente'),
      riga('CUI', p.cui || 'non presente'),
      riga('Circoscrizioni', p.circoscrizioni.length ? p.circoscrizioni.join(', ') : 'non indicata'),
      riga('Posizione', p.localizzato ? 'sulla mappa' : 'non geolocalizzato'),
      riga('Fonti', p.fonti.map(f => ETICHETTE[f] || f).join(', ')),
    ]);

    const collegamenti = [];
    const interni = [];
    if (p.link.opencup) collegamenti.push(voceUfficiale(p.link.opencup, 'Scheda OpenCUP del CUP', 'opencup.gov.it'));
    if (p.pnrr && p.pnrr.url) collegamenti.push(voceUfficiale(p.pnrr.url, 'Scheda PNRR del Comune', 'pnrr.comune.palermo.it'));
    if (p.link.opencoesione) collegamenti.push(voceUfficiale(p.link.opencoesione, 'Scheda OpenCoesione', 'opencoesione.gov.it'));
    if (p.link.opencup_candidato) collegamenti.push(voceVerifica(p.link.opencup_candidato, 'OpenCUP, CUP candidato', p.link.nota_opencup_candidato || 'collegamento da verificare'));
    if (p.cup && !p.link.opencup) collegamenti.push(el('li', { class: 'ufficiale' }, [el('span', { class: 'badge cerca', text: 'Ricerca' }), link('https://www.opencup.gov.it/portale/web/opencup/ricerca?cup=' + encodeURIComponent(p.cup), 'Cerca il CUP su OpenCUP'), el('span', { class: 'est', text: 'ricerca sul portale OpenCUP: nessuna scheda diretta nel Programma' })]));
    if (p.appalti && p.appalti.length) collegamenti.push(voceUfficiale('https://dati.anticorruzione.it/opendata/dataset/cig', 'Open data CIG (ANAC)', 'dati.anticorruzione.it', 'Dati ufficiali'));
    if (p.localizzato) interni.push(el('li', {}, [el('a', { href: './#mappa', text: 'Vedi la posizione sulla mappa' }), el('span', { class: 'est', text: 'attiva «Mostra i singoli progetti»' })]));

    /* una voce su due non ha in fonte né CUP né collegamenti: meglio dirlo che lasciare il vuoto */
    const vuoto = collegamenti.length === 0;
    const notaCollegamenti = vuoto ? el('p', { class: 'nota' }, [el('span', { class: 'badge nessuno', text: 'Nessun collegamento in fonte' }), ' Il Programma triennale non riporta il CUP di questo intervento: senza CUP non c\'è una scheda ufficiale da collegare.']) : null;

    const docs = (p.pnrr && p.pnrr.documenti || []).map(d => el('li', {}, [link(d.url, d.titolo.slice(0, 90) + (d.titolo.length > 90 ? '…' : '')), el('span', { class: 'est', text: 'documento sul sito del Comune' })]));

    $('scheda-progetto').replaceChildren(
      testa,
      el('div', { class: 'dettaglio' }, [
        el('div', { class: 'colonna' }, [
          riquadro('Importi e finanziamenti', [importi, el('p', { class: 'nota', text: 'Le cifre sono quelle della fonte indicata per ciascuna voce. Nessuna è stata stimata o ripartita.' })]),
          p.appalti && p.appalti.length ? riquadro('Appalti avviati', [el('p', { class: 'nota', text: 'Gli appalti sono collegati per CUI identico. La base di gara non è l\'importo aggiudicato.' })]) : null,
          limiti,
        ]),
        el('div', { class: 'colonna' }, [
          riquadro('Identificativi e territorio', [ident, el('p', { class: 'nota' }, [el('a', { href: 'progetti.html?q=' + encodeURIComponent(p.cup || p.id), text: 'Cerca le voci collegate' })])]),
          riquadro('Collegamenti', [notaCollegamenti, (collegamenti.length || interni.length) ? el('ul', { class: 'link' }, [...collegamenti, ...interni]) : null]),
          docs.length ? riquadro('Documenti PNRR', el('ul', { class: 'link' }, docs)) : null,
        ]),
      ]),
      el('p', { class: 'piede' }, [
        'Dati generati da ', el('code', { text: 'scripts/build_indice_progetti.py' }),
        '. Regole, fonti e licenze: ', el('a', { href: 'metodo.html', text: 'metodo e licenze' }), '.',
      ]),
    );
  }
})();
