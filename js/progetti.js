/* Elenco dei progetti e dei finanziamenti. Legge data/progetti.json e, su richiesta, data/snapshot/appalti_cig.json. */
(() => {
  'use strict';
  const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  const it = (n, d = 0) => n == null ? 'non disponibile' : n.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
  const mln = (n, d = 1) => it(n / 1e6, d) + ' M€';
  const eur = (n) => n == null ? 'non disponibile' : it(n, 0) + ' €';
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
  const ETICHETTE = { opere: 'Opere', pnrr: 'PNRR', coesione: 'Coesione', appalti: 'Appalti' };
  /* Nomi delle voci filtrate: serve a dire subito che cosa si sta guardando. */
  const NOMI_FONTE = {
    opere: ['intervento di opere pubbliche 2026-2028', 'interventi di opere pubbliche 2026-2028'],
    pnrr: ['scheda PNRR', 'schede PNRR'],
    coesione: ['voce dei fondi di coesione', 'voci dei fondi di coesione'],
    appalti: ['appalto collegato', 'appalti collegati'],
  };
  const NOMI_ORDINE = { opere: 'importo delle opere 2026-2028', pnrr: 'importo PNRR finanziato', coesione: 'finanziamento di coesione', titolo: 'titolo' };
  const ORDINE_PER_FONTE = { opere: 'opere', pnrr: 'pnrr', coesione: 'coesione' };
  const doveCirc = (c) => c === '__nessuna' ? 'senza circoscrizione indicata' : c === '__multi' ? 'che interessano più circoscrizioni' : 'in Circoscrizione ' + c;

  const stato = { q: '', fonte: '', circ: '', stato: '', programma: '', ordine: 'opere', incroci: false, limite: 30 };
  let D = null, CIG = null;

  Promise.all([fetch('data/progetti.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('progetti'); return r.json(); })])
    .then(([j]) => { D = j; avvia(); })
    .catch(() => {
      $('lede').textContent = 'I dati non si caricano. Avvia un server locale nella cartella del progetto: python3 -m http.server 8823, poi apri http://localhost:8823/progetti.html';
      $('lede').className = 'avviso';
    });

  function importi(p) {
    const out = [];
    if (p.opere) out.push({ fonte: 'Opere 2026-2028', valore: p.opere.importo_triennio_eur });
    if (p.pnrr && p.pnrr.importo_finanziato_eur != null) out.push({ fonte: 'PNRR finanziato', valore: p.pnrr.importo_finanziato_eur });
    if (p.coesione && p.coesione.length) {
      const righe = p.coesione.map(x => x.finanziamento_pubblico_netto_eur || 0).sort((a, b) => b - a);
      out.push({ fonte: 'Coesione, finanziamento' + (righe.length > 1 ? ` (linea più alta di ${righe.length})` : ''), valore: righe[0] });
    }
    return out;
  }

  const valore = (p, chiave) => {
    if (chiave === 'opere') return p.opere ? p.opere.importo_triennio_eur : -1;
    if (chiave === 'pnrr') return p.pnrr && p.pnrr.importo_finanziato_eur != null ? p.pnrr.importo_finanziato_eur : -1;
    if (chiave === 'coesione') return p.coesione && p.coesione.length ? Math.max(...p.coesione.map(x => x.finanziamento_pubblico_netto_eur || 0)) : -1;
    return 0;
  };

  function filtra() {
    const q = stato.q.trim().toLowerCase();
    return D.progetti.filter(p => {
      if (stato.fonte && !p.fonti.includes(stato.fonte)) return false;
      if (stato.incroci && p.fonti.length < 2) return false;
      if (stato.circ === '__nessuna') { if (p.circoscrizioni.length) return false; }
      else if (stato.circ === '__multi') { if (p.circoscrizioni.length < 2) return false; }
      else if (stato.circ && !(p.circoscrizioni.length === 1 && p.circoscrizioni[0] === stato.circ)) return false;
      if (stato.stato) {
        const s = stato.stato.toLowerCase();
        const pnrrOk = p.pnrr && p.pnrr.classe_stato === s;
        const coeOk = p.coesione && p.coesione.some(x => (x.stato || '').toLowerCase() === s);
        if (!pnrrOk && !coeOk) return false;
      }
      if (stato.programma) {
        const prog = stato.programma.toLowerCase();
        if (!p.coesione || !p.coesione.some(x => (x.programma || '').toLowerCase().startsWith(prog))) return false;
      }
      if (!q) return true;
      return (p.titolo + ' ' + (p.cup || '') + ' ' + (p.cui || '') + ' ' + p.id).toLowerCase().includes(q);
    }).sort((a, b) => {
      if (stato.ordine === 'titolo') return a.titolo.localeCompare(b.titolo, 'it');
      const d = valore(b, stato.ordine) - valore(a, stato.ordine);
      return d || a.titolo.localeCompare(b.titolo, 'it');
    });
  }

  function voce(p) {
    const href = 'progetto.html?id=' + encodeURIComponent(p.id);
    const dove = [];
    if (p.circoscrizioni.length) dove.push(el('span', { text: 'Circoscrizione ' + p.circoscrizioni.join(', ') }));
    else dove.push(el('span', { text: p.localizzato ? 'Posizione senza circoscrizione' : 'Senza circoscrizione' }));
    if (p.cup) dove.push(el('span', { text: 'CUP ' + p.cup }));
    if (p.cui) dove.push(el('span', { text: 'CUI ' + p.cui }));
    const imp = importi(p).map(x => el('span', {}, [x.fonte + ': ', el('b', { text: eur(x.valore) })]));
    return el('article', { class: 'voce', 'data-id': p.id }, [
      el('div', {}, [
        el('h2', { class: 'titolo' }, [el('a', { href, text: p.titolo.length > 210 ? p.titolo.slice(0, 208) + '…' : p.titolo })]),
        el('div', { class: 'dove' }, dove),
        el('div', { class: 'fonti-riga' }, p.fonti.map(f => el('span', { class: 'badge ' + f, text: ETICHETTE[f] || f }))),
      ]),
      imp.length ? el('div', { class: 'importi' }, imp) : el('div', { class: 'importi' }, [el('span', { text: 'Nessun importo in fonte' })]),
    ]);
  }

  function disegna() {
    const r = filtra(), mostra = r.slice(0, stato.limite);
    ambito(r);
    disegnaMini();
    $('elenco').replaceChildren(...mostra.map(voce));
    const n = r.length;
    $('conteggio').textContent = n === 0
      ? 'Nessun progetto con questi filtri.'
      : `${it(Math.min(stato.limite, n))} di ${it(n)} voci${n !== D.progetti.length ? ` (su ${it(D.progetti.length)} totali)` : ''}. Un progetto può comparire in più fonti: gli importi restano separati e non si sommano.`;
    $('altri').hidden = n <= stato.limite;
    $('altri').textContent = `Mostra altri ${it(Math.min(30, n - stato.limite))}`;
    /* clic sulla riga (fuori dal titolo) o passaggio del mouse: il progetto si accende sulla mappa */
    $('elenco').querySelectorAll('.voce').forEach(art => {
      art.addEventListener('click', (ev) => {
        if (ev.target.closest('a')) return;
        selezionato = art.dataset.id;
        evidenziaRiga(selezionato);
        evidenziaInMini(selezionato);
      });
      art.addEventListener('mouseenter', () => evidenziaInMini(art.dataset.id));
      art.addEventListener('mouseleave', () => evidenziaInMini(selezionato));
    });
  }

  /* Che cosa sto guardando: titolo, conteggio, importo e filtri attivi */
  function ambito(r) {
    const n = r.length;
    const attivo = !!(stato.fonte || stato.circ || stato.stato || stato.programma || stato.q || stato.incroci);
    const blocco = $('ambito');
    blocco.hidden = !attivo;
    const base = stato.fonte ? NOMI_FONTE[stato.fonte][n === 1 ? 0 : 1] : (n === 1 ? 'voce' : 'voci');
    const parti = [`${it(n)} ${base}`];
    if (stato.circ) parti.push(doveCirc(stato.circ));
    if (stato.q) parti.push(`che contengono «${stato.q}»`);
    const titolo = parti.join(' ');
    document.title = (attivo ? titolo + ' · ' : '') + 'Elenco progetti · Palermo in chiaro';
    if (!attivo) { blocco.replaceChildren(); return; }
    const nota = [];
    if (stato.stato) nota.push('Stato: ' + stato.stato);
    if (stato.programma) nota.push('Programma: ' + stato.programma);
    if (stato.incroci) nota.push('Solo voci presenti in più fonti');
    if (stato.fonte === 'opere') {
      const tot = r.reduce((s, p) => s + (p.opere ? p.opere.importo_triennio_eur : 0), 0);
      nota.push(`importo programmato nel triennio ${mln(tot, 0)}`);
    }
    nota.push('ordinati per ' + NOMI_ORDINE[stato.ordine]);
    blocco.replaceChildren(
      el('p', { class: 'ambito-occhiello', text: 'Stai guardando' }),
      el('h2', { class: 'ambito-titolo', text: titolo }),
      el('p', { class: 'ambito-nota' }, [
        nota.join(' · ') + '. ',
        el('a', { href: 'progetti.html', text: `Togli i filtri e vedi tutte le ${it(D.progetti.length)} voci` }), '.',
      ]),
    );
  }

  /* ---- mini mappa della circoscrizione filtrata: poligono e progetti con posizione ---- */
  const NS = 'http://www.w3.org/2000/svg';
  let GEO = null, PRJ = null, geoStato = 'idle', miniCirc = null;
  let vaiAllaRiga = null;   // assegnato in avvia: dal punto sulla mappa alla voce dell'elenco
  let miniPunti = [];       // posizioni disegnate, per il clic caduto vicino a un pallino
  let miniClicPronto = false;
  let rigaEvidenziata = null, timerRiga = null;
  let selezionato = null;   // progetto scelto: resta acceso sulla mappa

  /* la riga si accende per qualche secondo (vale per il clic in mappa e per quello in elenco) */
  function evidenziaRiga(id) {
    if (rigaEvidenziata) rigaEvidenziata.classList.remove('evidenzia');
    const riga = [...document.querySelectorAll('#elenco .voce')].find(e => e.dataset.id === id);
    if (!riga) return null;
    riga.classList.add('evidenzia');
    rigaEvidenziata = riga;
    clearTimeout(timerRiga);
    timerRiga = setTimeout(() => {
      riga.classList.remove('evidenzia');
      if (rigaEvidenziata === riga) rigaEvidenziata = null;
    }, 6000);
    return riga;
  }
  /* e il progetto resta segnato sulla mini mappa */
  function evidenziaInMini(id) {
    const svg = $('mini-svg');
    svg.querySelectorAll('.sel').forEach(e => {
      e.classList.remove('sel');
      if (e.dataset.r0) e.setAttribute('r', e.dataset.r0);
    });
    if (!id) return;
    svg.querySelectorAll('[data-id="' + id + '"]').forEach(e => {
      e.classList.add('sel');
      if (e.dataset.r0) e.setAttribute('r', (+e.dataset.r0 * 1.9).toFixed(2));
    });
  }
  function caricaGeo() {
    if (geoStato !== 'idle') return;
    geoStato = 'carica';
    Promise.all([
      fetch('data/geo/circoscrizioni.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('circoscrizioni'); return r.json(); }),
      fetch('data/geo/progetti.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('progetti'); return r.json(); }),
    ]).then(([g, p]) => { GEO = g; PRJ = p; geoStato = 'pronto'; disegnaMini(true); })
      .catch(() => { geoStato = 'errore'; disegnaMini(true); });
  }
  function disegnaMini(forza) {
    const c = stato.circ, box = $('mini-mappa'), pagina = $('contenuto');
    if (!ROM.includes(c) || geoStato === 'errore') {
      box.hidden = true; pagina.classList.remove('con-mappa'); miniCirc = null; return;
    }
    if (geoStato !== 'pronto') { caricaGeo(); return; }
    if (!forza && miniCirc === c) return;
    miniCirc = c; selezionato = null;
    box.hidden = false; pagina.classList.add('con-mappa');
    const mk = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
    /* il titolo compare al passaggio del mouse, come sulla mappa della home */
    const conTitolo = (e, testo) => { e.append(Object.assign(document.createElementNS(NS, 'title'), { textContent: testo })); return e; };
    const pol = mk('path', { d: GEO.circoscrizioni[c].d, class: 'circ' });
    const gPol = mk('g'), gLin = mk('g'), gPt = mk('g');
    /* gli stessi progetti dell'elenco: quelli con una sola circoscrizione */
    const prj = PRJ.progetti.filter(p => p.circoscrizioni.length === 1 && p.circoscrizioni[0] === c);
    const punti = [];
    prj.forEach(p => {
      /* l'id della posizione è quello dell'intervento, senza il prefisso «op-» delle voci dell'elenco */
      const idVoce = p.id.startsWith('op-') ? p.id : 'op-' + p.id;
      const apri = (e) => { e.addEventListener('click', () => { if (vaiAllaRiga) vaiAllaRiga(idVoce); }); return e; };
      p.poligoni.forEach(x => gPol.append(apri(conTitolo(mk('path', { d: x.d, class: 'pol', 'data-id': idVoce }), p.descrizione + ' — clicca per la riga nell\'elenco'))));
      p.linee.forEach(x => gLin.append(apri(conTitolo(mk('path', { d: x.d, class: 'lin', 'data-id': idVoce }), p.descrizione + ' — clicca per la riga nell\'elenco'))));
      p.punti.forEach(q => {
        const approx = q[2] === 'toponimo' || q[2] === 'da_poligono';
        gPt.append(apri(conTitolo(mk('circle', { cx: q[0], cy: q[1], class: 'pt' + (approx ? ' approx' : ''), 'data-r': approx ? 1.7 : 1, 'data-id': idVoce }), p.descrizione + ' — clicca per la riga nell\'elenco')));
        punti.push({ x: q[0], y: q[1], id: idVoce });
      });
    });
    const svg = $('mini-svg');
    svg.replaceChildren(pol, gPol, gLin, gPt);
    const b = pol.getBBox(), m = 12;
    const vb = [b.x - m, b.y - m, b.width + 2 * m, b.height + 2 * m];
    svg.setAttribute('viewBox', vb.join(' '));
    svg.setAttribute('aria-label', `Mappa della Circoscrizione ${c}: il poligono e ${it(prj.length)} progetti con una posizione`);
    const k = vb[2] / 110;
    gPt.querySelectorAll('.pt').forEach(e => {
      const r0 = (+e.dataset.r * k).toFixed(2);
      e.setAttribute('data-r0', r0);
      e.setAttribute('r', r0);
    });
    miniPunti = punti;
    if (!miniClicPronto) {
      miniClicPronto = true;
      /* i pallini sono 6 px: un clic sul vuoto entro 12 px apre la riga del progetto più vicino */
      svg.addEventListener('click', (ev) => {
        if (ev.target !== svg || !vaiAllaRiga) return;
        const m = svg.getScreenCTM(); if (!m) return;
        const pt = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
        const limite = 12 / Math.hypot(m.a, m.b);
        let best = null, d0 = Infinity;
        miniPunti.forEach(o => { const d = Math.hypot(o.x - pt.x, o.y - pt.y); if (d < d0) { d0 = d; best = o.id; } });
        if (best) vaiAllaRiga(best);
      });
    }
    const url = './?circ=' + encodeURIComponent(c) + '#mappa';
    $('mini-cap').replaceChildren(`Circoscrizione ${c}: ${it(prj.length)} progetti con una posizione. Clicca un punto per la sua riga. `,
      el('a', { href: url, text: 'Aprila sulla mappa' }), ' per vederli uno per uno.');
  }

  function avvia() {
    const conteggi = D.conteggi;
    $('lede').replaceChildren(
      `Una voce per progetto: ${it(conteggi.opere)} opere del Programma triennale, ${it(conteggi.pnrr_totali)} schede PNRR, `,
      `${it(conteggi.coesione_cup)} CUP di coesione e ${it(conteggi.cig)} appalti. `,
      'Il collegamento tra fonti avviene solo per CUP o CUI identico, e gli importi non si sommano. ',
      'Per la coesione una voce può raccogliere più linee di finanziamento sullo stesso CUP: le voci possono essere meno dei progetti.');
    const sel = $('circ');
    ROM.forEach(c => sel.append(el('option', { value: c, text: 'Circoscrizione ' + c })));
    sel.append(el('option', { value: '__nessuna', text: 'Senza circoscrizione' }));
    sel.append(el('option', { value: '__multi', text: 'Più circoscrizioni' }));

    const aggiorna = () => { stato.limite = 30; disegna(); chips(); sincronizzaUrl(); };
    const chips = () => {
      const voci = [];
      if (stato.fonte) voci.push(['Fonte: ' + (ETICHETTE[stato.fonte] || stato.fonte), () => { stato.fonte = ''; $('fonte').value = ''; }]);
      if (stato.circ) voci.push([stato.circ === '__nessuna' ? 'Senza circoscrizione' : stato.circ === '__multi' ? 'Più circoscrizioni' : 'Circoscrizione ' + stato.circ, () => { stato.circ = ''; $('circ').value = ''; }]);
      if (stato.q) voci.push(['Cerca: «' + stato.q + '»', () => { stato.q = ''; $('q').value = ''; }]);
      if (stato.incroci) voci.push(['Solo in più fonti', () => { stato.incroci = false; $('incroci').checked = false; }]);
      if (stato.stato) voci.push(['Stato: ' + stato.stato, () => { stato.stato = ''; }]);
      if (stato.programma) voci.push(['Programma: ' + stato.programma, () => { stato.programma = ''; }]);
      $('filtri-attivi').replaceChildren(...voci.map(([testo, togli]) => el('span', { class: 'chip' }, [testo,
        el('button', { type: 'button', title: 'Togli questo filtro', 'aria-label': 'Togli il filtro ' + testo, text: '×' })])));
      $('filtri-attivi').querySelectorAll('button').forEach((b, i) => b.addEventListener('click', () => { voci[i][1](); aggiorna(); }));
    };
    const sincronizzaUrl = () => {
      const p = new URLSearchParams();
      if (stato.q) p.set('q', stato.q);
      if (stato.fonte) p.set('fonte', stato.fonte);
      if (stato.circ) p.set('circ', stato.circ);
      if (stato.stato) p.set('stato', stato.stato);
      if (stato.programma) p.set('programma', stato.programma);
      if (stato.ordine !== 'opere') p.set('ordine', stato.ordine);
      if (stato.incroci) p.set('incroci', '1');
      const qs = p.toString();
      try { history.replaceState(null, '', (qs ? '?' + qs : location.pathname) + location.hash); } catch (e) { /* file:// */ }
    };
    $('q').addEventListener('input', e => { stato.q = e.target.value; aggiorna(); });
    $('fonte').addEventListener('change', e => { stato.fonte = e.target.value; aggiorna(); });
    $('circ').addEventListener('change', e => { stato.circ = e.target.value; aggiorna(); });
    $('ordine').addEventListener('change', e => { stato.ordine = e.target.value; aggiorna(); });
    $('incroci').addEventListener('change', e => { stato.incroci = e.target.checked; aggiorna(); });
    $('altri').addEventListener('click', () => { stato.limite += 30; disegna(); });

    const params = new URLSearchParams(location.search);
    if (params.get('fonte')) { $('fonte').value = params.get('fonte'); stato.fonte = params.get('fonte'); }
    if (params.get('circ')) { $('circ').value = params.get('circ'); stato.circ = params.get('circ'); }
    if (params.get('q')) { $('q').value = params.get('q'); stato.q = params.get('q'); }
    if (params.get('stato')) stato.stato = params.get('stato');
    if (params.get('programma')) stato.programma = params.get('programma');
    if (params.get('ordine') && NOMI_ORDINE[params.get('ordine')]) { stato.ordine = params.get('ordine'); $('ordine').value = stato.ordine; }
    else if (stato.fonte && ORDINE_PER_FONTE[stato.fonte]) { stato.ordine = ORDINE_PER_FONTE[stato.fonte]; $('ordine').value = stato.ordine; }
    if (params.get('incroci') === '1') { stato.incroci = true; $('incroci').checked = true; }

    /* dal punto sulla mini mappa alla riga dell'elenco: se un filtro la nasconde, lo si toglie */
    vaiAllaRiga = (id) => {
      const cerca = () => filtra().findIndex(p => p.id === id);
      let i = cerca();
      if (i < 0) {
        stato.q = ''; $('q').value = '';
        stato.fonte = ''; $('fonte').value = '';
        stato.incroci = false; $('incroci').checked = false;
        i = cerca();
      }
      if (i < 0) return;
      if (i + 1 > stato.limite) stato.limite = i + 1;
      disegna(); chips(); sincronizzaUrl();
      selezionato = id;
      const riga = evidenziaRiga(id);
      evidenziaInMini(id);
      if (!riga) return;
      riga.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    };
    aggiorna();

    $('carica-cig').addEventListener('click', () => {
      $('carica-cig').hidden = true;
      $('cig-conteggio').textContent = 'Caricamento…';
      fetch('data/snapshot/appalti_cig.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('cig'); return r.json(); })
        .then(j => { CIG = j; $('cig-blocco').hidden = false; $('cig-conteggio').remove(); disegnaCig(); })
        .catch(() => { $('cig-conteggio').textContent = 'Gli appalti non si caricano.'; });
    });
    if (location.hash === '#cig') { $('carica-cig').click(); setTimeout(() => $('cig').scrollIntoView({ block: 'start' }), 400); }
  }

  /* ---- appalti ---- */
  let limiteCig = 60;
  function disegnaCig() {
    const q = $('q-cig').value.trim().toLowerCase();
    const anno = $('anno-cig').value;
    const r = CIG.cig.filter(x => (!anno || x.anno_pubblicazione === anno)
      && (!q || (x.oggetto + ' ' + x.cig + ' ' + (x.cui || '')).toLowerCase().includes(q)));
    const mostra = r.slice(0, limiteCig);
    $('cig-numero').textContent = `${it(Math.min(limiteCig, r.length))} di ${it(r.length)} appalti` +
      (r.length !== CIG.cig.length ? ` (su ${it(CIG.cig.length)} totali)` : '') +
      `. ${it(CIG.conteggi.collegati)} CIG hanno un progetto collegato.`;
    $('cig-righe').replaceChildren(...mostra.map(x => el('tr', {}, [
      el('td', { text: x.cig }),
      el('td', { text: x.oggetto || 'non disponibile' }),
      el('td', { text: x.anno_pubblicazione || '' }),
      el('td', { class: 'num', text: eur(x.importo_base_gara_eur) }),
      el('td', {}, [x.progetto_id ? el('a', { href: 'progetto.html?id=' + encodeURIComponent(x.progetto_id), text: 'Scheda progetto' }) : el('span', { class: 'est', text: 'non collegato' })]),
    ])));
    $('altri-cig').hidden = r.length <= limiteCig;
  }
  document.addEventListener('DOMContentLoaded', () => {
    ['q-cig', 'anno-cig'].forEach(id => $(id).addEventListener('input', () => { limiteCig = 60; if (CIG) disegnaCig(); }));
    $('anno-cig').addEventListener('change', () => { limiteCig = 60; if (CIG) disegnaCig(); });
    $('altri-cig').addEventListener('click', () => { limiteCig += 60; disegnaCig(); });
  });
})();
