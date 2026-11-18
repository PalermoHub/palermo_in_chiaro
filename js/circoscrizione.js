/* Palermo in chiaro · la scheda di una circoscrizione
   Legge gli stessi snapshot del sito e disegna i grafici di una circoscrizione:
   opere per anno e per settore, confronto con le altre sette, quartieri e UPL,
   i progetti che ricadono qui. Nessuna libreria: barre in HTML come altrove.
   Le pagine stanno in circoscrizione/1…8/index.html e passano il numero in
   data-circ sull'elemento <html>; data-base serve ai percorsi relativi. */
(() => {
  'use strict';
  const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  const NS = 'http://www.w3.org/2000/svg';
  const BASE = document.documentElement.dataset.base || './';
  const $ = (id) => document.getElementById(id);

  const it = (n, d = 0) => n == null || Number.isNaN(n) ? 'non disponibile'
    : Number(n).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
  const pct = (n, d = 1) => n == null ? 'non disponibile' : it(n, d) + '%';
  const eur = (n, d = 0) => n == null ? 'non disponibile' : it(n, d) + ' €';
  const mln = (n, d = 1) => n == null ? 'non disponibile' : it(n / 1e6, d) + ' M€';
  const somma = (a) => a.reduce((s, x) => s + (x || 0), 0);
  const media = (a) => somma(a) / (a.length || 1);
  const U = (p) => BASE + p;
  const NUM = (c) => String(ROM.indexOf(c) + 1);

  const el = (tag, attrs = {}, kids = []) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (k === 'style') e.setAttribute('style', v);
      else e.setAttribute(k, v);
    }
    for (const c of [].concat(kids)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  };

  /* ---- tooltip: uguale a quello delle statistiche ---- */
  const tip = el('div', { class: 'tip', 'aria-hidden': 'true', hidden: '' });
  document.body.append(tip);
  const posiziona = (ev) => {
    const p = ev.touches ? ev.touches[0] : ev;
    const x = p.clientX ?? 0, y = p.clientY ?? 0;
    const r = tip.getBoundingClientRect();
    let left = x + 14, top = y + 14;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > window.innerHeight - 8) top = y - r.height - 14;
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top = Math.max(8, top) + 'px';
  };
  const mostra = (ev, titolo, righe) => {
    tip.replaceChildren(el('b', { text: titolo }), ...righe.filter(Boolean).map(([k, v]) => el('span', { class: 'tip-riga' }, [
      el('span', { text: k }), el('strong', { text: v }),
    ])));
    tip.hidden = false;
    posiziona(ev);
  };
  const nascondi = () => { tip.hidden = true; };
  addEventListener('scroll', nascondi, { passive: true });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') nascondi(); });
  function conTip(node, titolo, righe) {
    node.addEventListener('pointerenter', (e) => mostra(e, titolo, righe));
    node.addEventListener('pointermove', posiziona);
    node.addEventListener('pointerleave', nascondi);
    node.addEventListener('focus', () => {
      const r = node.getBoundingClientRect();
      mostra({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }, titolo, righe);
    });
    node.addEventListener('blur', nascondi);
  }

  /* ---- dati ---- */
  const FILES = {
    prof: 'data/snapshot/profilo_circoscrizioni.json',
    opere: 'data/snapshot/opere_circoscrizioni.json',
    cnt: 'data/snapshot/conteggi_territorio.json',
    geo: 'data/geo/circoscrizioni.json',
    bil: 'data/snapshot/bilancio_comune.json',
    app: 'data/snapshot/appalti_comune.json',
    pnrr: 'data/snapshot/pnrr_comune.json',
    coe: 'data/snapshot/coesione_comune.json',
    prog: 'data/progetti.json',
    proggeo: 'data/geo/progetti.json',
    quartieri: 'data/geo/quartieri.json',
  };

  const CIRCO = (() => {
    const dalFile = (document.documentElement.dataset.circ || '').toUpperCase();
    if (ROM.includes(dalFile)) return dalFile;
    const m = location.pathname.match(/circoscrizione\/([1-8])(?:\/|$)/);
    return m ? ROM[Number(m[1]) - 1] : null;
  })();

  if (!CIRCO) return errore('Circoscrizione non indicata nell\'indirizzo.');

  document.title = `Circoscrizione ${CIRCO} · Palermo in chiaro`;
  const descr = $('meta-descrizione');
  if (descr) descr.setAttribute('content', `Opere programmate, finanziamenti, quartieri e progetti della Circoscrizione ${CIRCO} di Palermo, con il confronto con le altre sette. Ogni numero porta la fonte e quello che non misura.`);

  Promise.all(Object.entries(FILES).map(([k, u]) => fetch(U(u))
    .then((r) => { if (!r.ok) throw new Error(u); return r.json(); })
    .then((j) => [k, j])))
    .then((p) => avvia(Object.fromEntries(p)))
    .catch((err) => { console.error('circoscrizione:', err); errore(null); });

  function errore(testo) {
    const box = $('avviso');
    if (!box) return;
    box.hidden = false;
    box.replaceChildren(testo || 'I dati non si caricano. Se hai aperto il file direttamente, avvia un server locale: ', testo ? null : el('code', { text: 'python3 -m http.server 8000' }), testo ? null : ' e apri la pagina da lì.');
  }

  function avvia(D) {
    const i = ROM.indexOf(CIRCO);
    const P = D.prof.valori[String(i + 1)];
    const O = D.opere.valori[String(i + 1)];
    const CN = D.cnt.circoscrizioni[CIRCO];
    const T = D.prof.totale_palermo;
    const TO = D.opere.totale_palermo;
    const MULTI = D.opere.piu_circoscrizioni;
    const NON = D.opere.non_localizzato;
    const GEO = D.geo.circoscrizioni[CIRCO];
    const quartieri = GEO.quartieri || [];
    const OP = (c) => D.opere.valori[String(ROM.indexOf(c) + 1)];
    const PR = (c) => D.prof.valori[String(ROM.indexOf(c) + 1)];
    const CNT = (c) => D.cnt.circoscrizioni[c];

    const residentiCitta = T.residenti;
    const opereCitta = somma(ROM.map((c) => OP(c).importo_triennio_eur));
    const mediaPerAbitante = opereCitta / residentiCitta;
    const quotaImporto = 100 * O.importo_triennio_eur / TO.importo_triennio_eur;
    const quotaResidenti = 100 * P.residenti / residentiCitta;
    const posizione = (valori, v) => 1 + valori.filter((x) => x > v + 1e-6).length;
    const importoAnno = { 2026: O.importo_2026_eur, 2027: O.importo_2027_eur, 2028: O.importo_2028_eur };

    /* ---------- testa ---------- */
    const testa = $('circ-testa');
    if (testa) {
      const n = ROM.indexOf(CIRCO);
      const prev = ROM[(n + 7) % 8], next = ROM[(n + 1) % 8];
      testa.replaceChildren(
        el('p', { class: 'occhiello', text: `Circoscrizione ${CIRCO} di 8` }),
        el('h1', { id: 't-circ', text: `Circoscrizione ${CIRCO}` }),
        el('p', { class: 'circ-quartieri' }, quartieri.map((q, k) => [
          k ? el('span', { class: 'sep', text: ' · ' }) : null,
          el('a', { href: U('progetti.html?quartiere=' + encodeURIComponent(q)), text: q })]).flat()),
        el('p', { class: 'lede' }, [
          `${it(P.residenti)} residenti al censimento 2021, il ${pct(quotaResidenti)} della città. `,
          el('b', { text: mln(O.importo_triennio_eur, 0) }),
          ` di opere programmate nel triennio 2026-2028 in ${it(O.interventi)} interventi, il ${pct(quotaImporto)} dell'importo che ha una circoscrizione.`]),
        el('p', { class: 'badge-riga' }, [
          el('a', { class: 'badge-link', href: '#mappa-circ', text: 'Vai alla mappa dei progetti' }),
          el('a', { class: 'badge-link', href: U('progetti.html?circ=' + CIRCO), text: `Tutti i ${it(CN.voci)} progetti in elenco` }),
          el('a', { class: 'badge-link', href: U('statistiche.html?circ=' + CIRCO + '#per-circoscrizione'), text: 'Il profilo sociale su Statistiche' })]),
        el('p', { class: 'circ-frecce' }, [
          el('a', { href: U('circoscrizione/' + NUM(prev) + '/'), text: `‹ Circoscrizione ${prev}` }),
          el('a', { href: U('circoscrizione/' + NUM(next) + '/'), text: `Circoscrizione ${next} ›` })]),
      );
    }

    /* le otto circoscrizioni, con questa in evidenza */
    const nav = $('circ-nav');
    if (nav) nav.replaceChildren(...ROM.map((c) => el('a', {
      href: U('circoscrizione/' + NUM(c) + '/'),
      text: c,
      'aria-current': c === CIRCO ? 'page' : null,
      title: c === CIRCO ? `Circoscrizione ${c}` : `Apri la Circoscrizione ${c}`,
    })));

    /* ---------- sei numeri ---------- */
    const cifre = [
      { nome: 'Residenti', val: it(P.residenti), nota: `censimento 2021: ${it(P.densita_ab_kmq)} abitanti per km²` },
      { nome: 'Opere 2026-2028', val: mln(O.importo_triennio_eur, 0), nota: `${it(O.interventi)} interventi che ricadono qui` },
      { nome: 'Per abitante', val: eur(O.importo_triennio_per_residente_eur), nota: `la media delle 8 è ${eur(mediaPerAbitante)}` },
      { nome: 'Con CUP', val: `${it(O.con_cup)} su ${it(O.interventi)}`, nota: 'il codice per seguire l\'opera fino alla gara' },
      { nome: 'Voci con PNRR o coesione', val: it(CN.pnrr + CN.coesione), nota: `${it(CN.pnrr)} PNRR, ${it(CN.coesione)} coesione: fonti diverse` },
      { nome: 'CIG collegati', val: it(CN.appalti), nota: 'solo gli appalti con lo stesso CUI dell\'opera' },
    ];
    const boxCifre = $('cifre');
    if (boxCifre) {
      boxCifre.replaceChildren(...cifre.map((c) => el('div', { class: 'cifra' }, [
        el('p', { class: 'cifra-nome', text: c.nome }),
        el('p', { class: 'cifra-val', text: c.val }),
        el('p', { class: 'cifra-nota', text: c.nota }),
      ])));
      boxCifre.append(el('p', { class: 'cifra-fonte' }, [
        'Residenti: ISTAT, censimento 2021. Opere: Programma triennale OO.PP. 2026-2028 del Comune, per circoscrizione in cui cade l\'intervento. PNRR, coesione e CIG: schede del Comune e ANAC, collegati per CUP o CUI. ',
        el('a', { href: U('fonti.html'), text: 'Le fonti, con periodo e licenza' }), '.']));
    }

    /* ---------- la mappa della sola circoscrizione, con i suoi progetti ---------- */
    function disegnaMappa() {
      const svg = $('mappa-svg');
      if (!svg) return;
      const g = D.geo.circoscrizioni[CIRCO];
      const mk = (tag, attr) => {
        const e = document.createElementNS(NS, tag);
        for (const k in attr) e.setAttribute(k, attr[k]);
        return e;
      };
      const p = mk('path', { d: g.d, class: 'circ' });
      const gQ = mk('g', { id: 'quartieri-g' });
      const QG = (D.quartieri && D.quartieri.quartieri) || {};
      quartieri.forEach((n) => {
        const q = QG[n];
        if (!q) return;
        gQ.append(mk('path', { d: q.d, class: 'quartiere' }));
      });
      const progetti = ((D.proggeo && D.proggeo.progetti) || []).filter((pr) => (pr.circoscrizioni || []).includes(CIRCO));
      const apri = (id) => { location.href = U('progetto.html?da=circoscrizione/' + NUM(CIRCO) + '/&id=' + encodeURIComponent('op-' + id)); };
      const gPol = mk('g', { class: 'pol' }), gLin = mk('g', { class: 'lin' }), gPt = mk('g', { class: 'pt' }), gHit = mk('g', { class: 'hit' });
      const titolo = (e, testo) => {
        const t = document.createElementNS(NS, 'title');
        t.textContent = testo;
        e.append(t);
        return e;
      };
      progetti.forEach((pr) => {
        (pr.poligoni || []).forEach((x) => {
          const e = titolo(mk('path', { d: x.d, class: 'g-pol' + (x.assegnazione === 'per_vicinanza' ? ' vicinanza' : '') }), pr.descrizione);
          e.addEventListener('click', () => apri(pr.id));
          gPol.append(e);
        });
        (pr.linee || []).forEach((x) => {
          const e = titolo(mk('path', { d: x.d, class: 'g-lin' }), pr.descrizione);
          e.addEventListener('click', () => apri(pr.id));
          gLin.append(e);
          const hit = mk('path', { d: x.d, class: 'g-lin-hit' });
          hit.addEventListener('click', () => apri(pr.id));
          gHit.append(hit);
        });
        (pr.punti || []).forEach((q) => {
          const approx = q[2] === 'toponimo' || q[2] === 'da_poligono';
          const e = titolo(mk('circle', { cx: q[0], cy: q[1], class: 'g-pt' + (approx ? ' approx' : ''), 'data-r': approx ? 7.4 : 4.6 }), pr.descrizione);
          e.addEventListener('click', () => apri(pr.id));
          gPt.append(e);
        });
      });
      const gP = mk('g', { id: 'progetti-g' });
      gP.append(gPol, gLin, gPt, gHit);
      svg.replaceChildren(p, gQ, gP);
      /* l'inquadratura è quella del poligono: le posizioni dei progetti sono nello stesso sistema */
      const bb = p.getBBox();
      const m = Math.max(3, Math.max(bb.width, bb.height) * 0.045);
      const vb = [bb.x - m, bb.y - m, bb.width + 2 * m, bb.height + 2 * m];
      svg.setAttribute('viewBox', vb.join(' '));
      /* --k tiene uguali sullo schermo spessori e pallini, qualunque sia l'ingrandimento del poligono */
      const k = vb[2] / 1000;
      svg.style.setProperty('--k', k.toFixed(4));
      gPt.querySelectorAll('.g-pt').forEach((e) => e.setAttribute('r', ((+e.dataset.r) * k).toFixed(2)));
      const nota = $('mappa-nota');
      if (nota) nota.textContent = `Posizioni elaborate da OpenDataSicilia dalle tavole del Programma triennale, non coordinate ufficiali del Comune. ${it(progetti.length)} voci con una posizione disegnate nella Circoscrizione ${CIRCO}.`;
      const leg = $('legenda-mappa');
      if (leg) leg.replaceChildren(el('span', { class: 'leg-prog' }, [
        el('i', { class: 'k pieno' }), ' posizione letta o dall\'etichetta  ',
        el('i', { class: 'k anello' }), ' approssimata (circa 300 m)  ',
        el('i', { class: 'k linea' }), ' linee e aree']));
    }

    /* ---------- la scheda di sintesi accanto alla mappa ---------- */
    function schedaCirc() {
      const host = $('scheda-circ');
      if (!host) return;
      const dl = (voci) => el('dl', {}, voci.map(([k, v]) => el('div', { class: 'riga' }, [
        el('dt', { text: k }), el('dd', { text: v })])));
      const posImpO = 1 + ROM.filter((x) => OP(x).importo_triennio_eur > O.importo_triennio_eur).length;
      const posPcO = 1 + ROM.filter((x) => OP(x).importo_triennio_per_residente_eur > O.importo_triennio_per_residente_eur).length;
      const anni = ['2026', '2027', '2028'].map((a) => [a, O['importo_' + a + '_eur']]);
      const tot = O.importo_triennio_eur || 1;
      const anniBox = el('div', {}, [
        el('div', { class: 'anno-barra', 'aria-hidden': 'true' }, anni.map(([a, v]) => el('span', { class: 'anno-seg a' + a, style: `width:${100 * v / tot}%` }))),
        el('div', { class: 'anno-legenda' }, anni.map(([a, v]) => el('div', {}, [
          el('i', { class: 'a' + a }), el('span', { text: a }), el('span', { class: 'quota', text: mln(v, 0) }), el('b', { text: it(100 * v / tot) + '%' })]))),
      ]);
      const setts = (O.principali_settori || []).slice(0, 3);
      const maxS = setts.length ? setts[0].importo_eur : 1;
      const sett = el('div', { class: 'barre', role: 'list' }, setts.map((x) => el('div', { class: 'barra', role: 'listitem' }, [
        el('div', { class: 'nome' }, [x.settore.replace(/^\d+\.\d+ - /, ''), el('small', { text: `${x.interventi} interventi` })]),
        el('div', { class: 'pista' }, [el('span', { class: 'riempi', style: `width:${100 * x.importo_eur / maxS}%` })]),
        el('div', { class: 'val', text: mln(x.importo_eur, 0) })])));
      host.replaceChildren(
        el('h2', { text: `Circoscrizione ${CIRCO}` }),
        el('div', { class: 'quartieri-riga', role: 'group', 'aria-label': `Quartieri della Circoscrizione ${CIRCO}` },
          quartieri.map((n) => el('a', {
            class: 'quartiere-scendi', href: U('progetti.html?quartiere=' + encodeURIComponent(n)),
            text: n, title: `Apri i progetti del quartiere ${n}` }))),
        el('p', { class: 'badge-riga' }, [
          el('a', { class: 'badge-link', href: '#soldi', text: 'Le opere nel dettaglio' }),
          el('a', { class: 'badge-link', href: '#progetti', text: 'I progetti' })]),
        dl([
          ['Residenti', it(P.residenti)], ['Densità', it(P.densita_ab_kmq) + ' ab/km²'],
          ['Over 65', pct(P.quota_65_piu_pct)], ['Indice di vecchiaia', it(P.indice_vecchiaia, 0)],
          ['Stranieri', pct(P.quota_stranieri_pct)], ['Famiglie', it(P.famiglie)],
          ['Abitazioni vuote o non di residenti', pct(P.quota_abitazioni_vuote_pct)],
          ['Laureati (9 anni e più)', pct(P.quota_laureati_9_piu_pct)]]),
        el('h3', { text: 'Opere programmate 2026-2028' }),
        dl([
          ['Interventi', it(O.interventi)], ['Importo 2026-2028', mln(O.importo_triennio_eur)],
          ['Per residente', eur(O.importo_triennio_per_residente_eur)], ['Interventi con CUP', `${O.con_cup} su ${O.interventi}`],
          ['Posto per importo', `${posImpO}º su 8`], ['Posto per abitante', `${posPcO}º su 8`]]),
        el('h4', { text: 'In che anni cadono' }), anniBox,
        el('h4', { text: 'I primi tre settori' }), sett,
        el('p', { class: 'nota', text: 'Residenti e profilo: censimento ISTAT 2021. Opere: la circoscrizione in cui ricadono, non una spesa decisa dalla circoscrizione né denaro già speso. Le posizioni dei progetti sulla mappa le ha elaborate OpenDataSicilia dalle tavole del Programma triennale.' }));
    }

    disegnaMappa();
    schedaCirc();

    /* ---------- grafici ---------- */
    const G = $('grafici-soldi');
    const GT = $('grafici-territorio');

    if (G) {
      /* 0. dove sta questa circoscrizione tra le otto, misura per misura */
      const stri = (nome, sub, f, formatta, media) => ({
        nome, sub, formatta, media,
        punti: ROM.map((c) => ({ id: c, nome: 'Circ. ' + c, val: f(c) || 0 })),
      });
      window.GraficiPIC.strisce(figura(G, {
        titolo: `La Circoscrizione ${CIRCO} tra le otto`,
        nota: 'Ogni riga è una misura, ogni punto una circoscrizione: più a destra è il valore più alto. Ogni riga ha la sua scala, da 0 al massimo.',
        larga: true,
      }), {
        scelta: CIRCO, conTip,
        nota: 'La posizione 1ª è il valore più alto. Un valore alto o basso è un segnale da approfondire, non un giudizio. Le opere sono solo quelle con una sola circoscrizione.',
        righe: [
          stri('Importo delle opere', 'Programma 2026-2028', (c) => OP(c).importo_triennio_eur, (n) => mln(n, 1), somma(ROM.map((c) => OP(c).importo_triennio_eur)) / 8),
          stri('Opere per residente', 'importo diviso residenti 2021', (c) => OP(c).importo_triennio_per_residente_eur, (n) => eur(n), mediaPerAbitante),
          stri('Interventi', 'del Programma triennale', (c) => OP(c).interventi, (n) => it(n, Number.isInteger(n) ? 0 : 1), media(ROM.map((c) => OP(c).interventi))),
          stri('Voci con PNRR o coesione', 'progetti collegati', (c) => CNT(c).pnrr + CNT(c).coesione, (n) => it(n, Number.isInteger(n) ? 0 : 1), media(ROM.map((c) => CNT(c).pnrr + CNT(c).coesione))),
          stri('CIG collegati', 'appalti ANAC', (c) => CNT(c).appalti, (n) => it(n, Number.isInteger(n) ? 0 : 1), media(ROM.map((c) => CNT(c).appalti))),
          stri('Residenti', 'censimento 2021', (c) => PR(c).residenti, (n) => it(n), media(ROM.map((c) => PR(c).residenti))),
        ],
      });

      /* 1. il peso di ogni circoscrizione */
      const righeImp = ROM.map((c) => ({
        id: c, nome: 'Circ. ' + c, sub: `${it(OP(c).interventi)} interventi`, val: OP(c).importo_triennio_eur,
        href: c === CIRCO ? null : U('circoscrizione/' + NUM(c) + '/'),
      }));
      const posImp = posizione(righeImp.map((r) => r.val), O.importo_triennio_eur);
      const tab = {
        colonne: [{ nome: 'Misura' }, { nome: 'Circ. ' + CIRCO, num: true }, { nome: 'Media delle 8', num: true }, { nome: 'Posizione', num: true }],
        righe: [
          ['Importo opere 2026-2028', mln(O.importo_triennio_eur, 1), mln(somma(righeImp.map((r) => r.val)) / 8, 1), `${posImp}ª su 8`],
          ['Interventi', it(O.interventi), it(media(ROM.map((c) => OP(c).interventi)), 1), `${posizione(ROM.map((c) => OP(c).interventi), O.interventi)}ª su 8`],
          ['Opere per residente', eur(O.importo_triennio_per_residente_eur), eur(mediaPerAbitante), `${posizione(ROM.map((c) => OP(c).importo_triennio_per_residente_eur), O.importo_triennio_per_residente_eur)}ª su 8`],
          ['Voci con PNRR o coesione', it(CN.pnrr + CN.coesione), it(media(ROM.map((c) => CNT(c).pnrr + CNT(c).coesione)), 1), `${posizione(ROM.map((c) => CNT(c).pnrr + CNT(c).coesione), CN.pnrr + CN.coesione)}ª su 8`],
          ['CIG collegati', it(CN.appalti), it(media(ROM.map((c) => CNT(c).appalti)), 1), `${posizione(ROM.map((c) => CNT(c).appalti), CN.appalti)}ª su 8`],
          ['Residenti 2021', it(P.residenti), it(media(ROM.map((c) => PR(c).residenti)), 0), `${posizione(ROM.map((c) => PR(c).residenti), P.residenti)}ª su 8`],
        ],
      };
      barre(figura(G, {
        titolo: 'Gli importi delle opere, circoscrizione per circoscrizione',
        nota: 'Ogni riga è il Programma triennale 2026-2028 degli interventi che ricadono in una sola circoscrizione. La linea tratteggiata è la media delle otto. La riga scelta è questa circoscrizione; le altre portano alla loro scheda. Circa il 47% dell\'importo comunale non ha una circoscrizione e non entra in questo confronto.',
        tabella: tab,
      }), { voci: righeImp, formatta: (n) => mln(n, 1), evidenzia: CIRCO, riferimento: somma(righeImp.map((r) => r.val)) / 8 });

      /* 2. per abitante: gli euro da soli non dicono quanto pesano su chi ci abita */
      const righePc = ROM.map((c) => ({
        id: c, nome: 'Circ. ' + c, sub: `${it(PR(c).residenti)} residenti`, val: OP(c).importo_triennio_per_residente_eur,
        href: c === CIRCO ? null : U('circoscrizione/' + NUM(c) + '/'),
      }));
      barre(figura(G, {
        titolo: 'Quanto vale per abitante',
        nota: `Interventi con una sola circoscrizione divisi per i residenti del censimento 2021. La media delle otto è ${eur(mediaPerAbitante)}, calcolata sull'importo complessivo diviso per i residenti della città: non è la media delle otto cifre. Resta fuori il 47% dell'importo che non ha circoscrizione.`,
      }), { voci: righePc, formatta: (n) => eur(n), evidenzia: CIRCO, riferimento: mediaPerAbitante });

      /* 3. in che anno cadono gli importi */
      const anni = [['2026', importoAnno[2026]], ['2027', importoAnno[2027]], ['2028', importoAnno[2028]]];
      const maxAnno = Math.max(...anni.map((a) => a[1]));
      const quotaCittaAnno = (a) => 100 * TO[`importo_${a}_eur`] / TO.importo_triennio_eur;
      const quotaQuiAnno = (a) => 100 * importoAnno[a] / O.importo_triennio_eur;
      window.GraficiPIC.colonne(figura(G, {
        titolo: 'In che anno cadono gli importi',
        nota: `Il ${pct(quotaQuiAnno(2028))} dell'importo di questa circoscrizione è programmato nel 2028, contro il ${pct(quotaCittaAnno(2028))} del totale comunale. È la parte più lontana nel tempo, e la più esposta ai cambiamenti del Programma.`,
      }), {
        voci: anni.map(([a, v]) => ({ nome: a, sub: `${pct(quotaQuiAnno(a))} del triennio`, val: v })),
        formatta: (n) => mln(n, 1), conTip, nome: 'Importi per anno',
      });

      /* 4. per settore: come è fatto l'importo */
      const sett = (O.principali_settori || []).map((s) => ({
        nome: s.settore.replace(/^\d+\.\d+ - /, ''),
        sub: `${it(s.interventi)} interventi · ${s.settore.split(' - ')[0]}`,
        val: s.importo_eur,
      }));
      const sommaSett = somma(sett.map((s) => s.val));
      const resto = O.importo_triennio_eur - sommaSett;
      if (resto > 0.5) sett.push({ nome: 'Altri settori', sub: `${it(O.interventi - somma((O.principali_settori || []).map((s) => s.interventi)))} interventi`, val: resto });
      window.GraficiPIC.ciambella(figura(G, {
        titolo: 'Per cosa sono le opere',
        nota: `I cinque settori con l'importo più alto, più il resto. Il settore è quello del CUP (classificazione delle opere), non la missione del bilancio: sono due modi diversi di classificare la spesa e non si incrociano. I primi cinque valgono il ${pct(100 * sommaSett / O.importo_triennio_eur)} dell'importo.`,
      }), { voci: sett, formatta: (n) => mln(n, 1), conTip, nome: 'Importo per settore', centro: { valore: mln(O.importo_triennio_eur, 0), etichetta: 'triennio' } });

      /* 5. la composizione per settore delle otto: non quanto spendono, ma per cosa */
      const nomeSett = {}, perSett = {}, totSett = {};
      D.prog.progetti.forEach((p) => {
        if (!p.opere) return;
        const sigla = p.opere.settore.split(' - ')[0];
        nomeSett[sigla] = p.opere.settore.split(' - ')[1];
        if (p.circoscrizioni.length !== 1) return;
        const m = perSett[p.circoscrizioni[0]] = perSett[p.circoscrizioni[0]] || {};
        m[sigla] = (m[sigla] || 0) + p.opere.importo_triennio_eur;
        totSett[sigla] = (totSett[sigla] || 0) + p.opere.importo_triennio_eur;
      });
      const topSett = Object.entries(totSett).sort((a, b) => b[1] - a[1]).slice(0, 5).map((x) => x[0]);
      const valoriSett = (c) => {
        const m = perSett[c] || {}, t = somma(Object.values(m));
        const cima = topSett.map((s) => m[s] || 0);
        return { valori: cima.concat([t - somma(cima)]), totale: t, m };
      };
      const settQui = valoriSett(CIRCO);
      const inTop = topSett.filter((s) => (settQui.m[s] || 0) > 0).sort((a, b) => (settQui.m[b] || 0) - (settQui.m[a] || 0))[0];
      const primoQui = inTop || Object.entries(settQui.m).sort((a, b) => b[1] - a[1]).map((x) => x[0])[0] || topSett[0];
      const quotaPrimo = 100 * (settQui.m[primoQui] || 0) / (settQui.totale || 1);
      const quotaPrimoOtto = 100 * (totSett[primoQui] || 0) / (somma(ROM.map((c) => valoriSett(c).totale)) || 1);
      impilate(figura(G, {
        titolo: 'Per cosa sono le opere, circoscrizione per circoscrizione',
        nota: `Ogni riga è il 100% dell'importo 2026-2028 di una circoscrizione, diviso per settore del CUP. Qui il settore più pesante è «${nomeSett[primoQui] || primoQui}» con il ${pct(quotaPrimo)}; nelle otto circoscrizioni insieme è il ${pct(quotaPrimoOtto)}. Resta fuori la quota di importo che non ha una circoscrizione o ne tocca più di una.`,
        larga: true,
      }), {
        righe: ROM.map((c) => ({ nome: 'Circ. ' + c, valori: valoriSett(c).valori, scelta: c === CIRCO })),
        segmenti: topSett.map((s, k) => ({ nome: nomeSett[s] || s, colore: ['--s6', '--s5', '--s4', '--s3', '--s2'][k] })).concat([{ nome: 'Altri settori', colore: '--s1' }]),
        formatta: (n) => mln(n, 1),
      });

      /* 6. in che anno cadono gli importi delle otto: chi è spostato in avanti */
      const quota2028 = (c) => { const o = OP(c); return 100 * o.importo_2028_eur / (o.importo_triennio_eur || 1); };
      const piuAvanti = ROM.slice().sort((a, b) => quota2028(b) - quota2028(a))[0];
      const quotaOtto2028 = 100 * somma(ROM.map((c) => OP(c).importo_2028_eur)) / (opereCitta || 1);
      impilate(figura(G, {
        titolo: 'In che anno cadono gli importi, circoscrizione per circoscrizione',
        nota: `La composizione del triennio anno per anno. Nelle otto circoscrizioni il ${pct(quotaOtto2028)} dell'importo cade nel 2028, l'anno più lontano e il più esposto ai cambiamenti del Programma; la più spostata in avanti è la Circoscrizione ${piuAvanti} (${pct(quota2028(piuAvanti))}). Non è una previsione di spesa: gli investimenti vengono iscritti anno per anno.`,
        larga: true,
      }), {
        righe: ROM.map((c) => ({ nome: 'Circ. ' + c, valori: [OP(c).importo_2026_eur, OP(c).importo_2027_eur, OP(c).importo_2028_eur], scelta: c === CIRCO })),
        segmenti: [{ nome: '2026', colore: '--s2' }, { nome: '2027', colore: '--s4' }, { nome: '2028', colore: '--s6' }],
        formatta: (n) => mln(n, 1),
      });

      /* 7. dove sono i soldi del triennio: la parte che non si può attribuire */
      const localizzati = TO.importo_triennio_eur - MULTI.importo_triennio_eur - NON.importo_triennio_eur;
      const corpo = figura(G, {
        titolo: 'Dove sono i 4,37 miliardi del triennio',
        nota: `Questa circoscrizione pesa il ${pct(quotaImporto)} sull'importo comunale. Ma quasi metà dell'importo del Programma non ha una circoscrizione (metropolitana leggera compresa) o ne tocca più di una: per questo i confronti qui sopra sono parziali e non sommano al totale della città.`,
        larga: true,
      });
      impilate(corpo, {
        righe: [{ nome: 'Programma triennale', valori: [localizzati, MULTI.importo_triennio_eur, NON.importo_triennio_eur] }],
        segmenti: [
          { nome: 'In una circoscrizione', colore: '--s4' },
          { nome: 'In più circoscrizioni', colore: '--s3' },
          { nome: 'Senza circoscrizione', colore: '--s1' },
        ],
        formatta: (n) => mln(n, 0),
      });
      corpo.append(el('p', { class: 'grafico-nota sotto' }, [
        `${mln(localizzati, 0)} con una circoscrizione, ${mln(MULTI.importo_triennio_eur, 0)} in ${it(MULTI.interventi)} interventi che ne toccano più di una, ${mln(NON.importo_triennio_eur, 0)} in ${it(NON.interventi)} interventi senza localizzazione (reti, linee e lavori diffusi). I tre gruppi non si sommano tra loro. `,
        el('a', { href: U('index.html#opere'), text: 'Apri la sezione Opere della home' }), '.']));
    }

    /* ---------- quartieri e UPL ---------- */
    if (GT) {
      const perQuartiere = quartieri.map((q) => {
        const v = D.cnt.quartieri[q] || { voci: 0 };
        return { nome: q, sub: `${it(v.voci)} voci · ${it(v.con_cup)} con CUP`, val: v.voci, id: q,
          href: U('progetti.html?quartiere=' + encodeURIComponent(q)) };
      }).sort((a, b) => b.val - a.val);
      const corpoQ = figura(GT, {
        titolo: 'I progetti, quartiere per quartiere',
        nota: `Quante voci ricadono in ogni quartiere di questa circoscrizione: opere del Programma triennale e progetti PNRR o di coesione collegati. Una voce che tocca due quartieri si conta in entrambi, quindi la somma delle righe può superare il totale della circoscrizione. Un clic apre l'elenco filtrato.`,
        larga: true,
      });
      barre(corpoQ, { voci: perQuartiere, formatta: (n) => it(n) + (n === 1 ? ' voce' : ' voci'), ordina: false });

      const upl = [];
      Object.entries(GEO.upl || {}).forEach(([q, lista]) => lista.forEach((u) => upl.push({ quartiere: q, nome: u, ...(D.cnt.upl[u] || { voci: 0 }) })));
      const tabQ = {
        colonne: [{ nome: 'Quartiere' }, { nome: 'UPL', num: false }, { nome: 'Voci', num: true }, { nome: 'Con CUP', num: true }, { nome: 'PNRR o coesione', num: true }],
        righe: upl.sort((a, b) => b.voci - a.voci).map((u) => [u.quartiere, u.nome, it(u.voci), it(u.con_cup || 0), it((u.pnrr || 0) + (u.coesione || 0))]),
      };
      corpoQ.append(dettagli(tabQ));

      const impPerQuartiere = (() => {
        const m = {};
        D.prog.progetti.forEach((p) => {
          if (p.circoscrizioni.length !== 1 || p.circoscrizioni[0] !== CIRCO) return;
          if (p.quartieri.length !== 1 || !(p.quartieri[0] in (GEO.upl || {}))) return;
          const imp = p.opere ? p.opere.importo_triennio_eur : 0;
          m[p.quartieri[0]] = (m[p.quartieri[0]] || 0) + imp;
        });
        return m;
      })();
      const tabImp = {
        colonne: [{ nome: 'Quartiere' }, { nome: 'Importo 2026-2028', num: true }, { nome: 'Voci con un solo quartiere', num: true }],
        righe: quartieri.map((q) => ({
          nome: q,
          importo: impPerQuartiere[q] || 0,
          n: D.prog.progetti.filter((p) => p.circoscrizioni.length === 1 && p.circoscrizioni[0] === CIRCO && p.quartieri.length === 1 && p.quartieri[0] === q && p.opere).length,
        })).sort((a, b) => b.importo - a.importo).map((x) => [x.nome, mln(x.importo, 1), it(x.n)]),
      };
      const nUnico = D.prog.progetti.filter((p) => p.circoscrizioni.length === 1 && p.circoscrizioni[0] === CIRCO && p.quartieri.length === 1).length;
      const nMulti = D.prog.progetti.filter((p) => p.circoscrizioni.length === 1 && p.circoscrizioni[0] === CIRCO && p.quartieri.length > 1).length;
      const corpoImp = figura(GT, {
        titolo: 'Gli importi, dove il quartiere è uno solo',
        nota: `Gli importi si possono attribuire a un quartiere solo quando l'intervento ne tocca uno: ${it(nUnico)} voci su ${it(nUnico + nMulti)} di questa circoscrizione. Le altre ${it(nMulti)} toccano più quartieri e non si dividono a caso: restano fuori da questo grafico.`,
        tabella: tabImp,
      });
      const righeImpQ = quartieri.map((q) => ({
        nome: q,
        sub: `${it(D.prog.progetti.filter((p) => p.circoscrizioni.length === 1 && p.circoscrizioni[0] === CIRCO && p.quartieri.length === 1 && p.quartieri[0] === q && p.opere).length)} interventi con un quartiere`,
        val: impPerQuartiere[q] || 0,
      })).filter((x) => x.val > 0);
      barre(corpoImp, { voci: righeImpQ, formatta: (n) => mln(n, 1) });
    }

    /* ---------- i progetti ---------- */
    const EL = $('progetti-lista');
    if (EL) {
      const importoMax = (p) => Math.max(
        p.opere ? p.opere.importo_triennio_eur : -1,
        p.pnrr && p.pnrr.importo_finanziato_eur != null ? p.pnrr.importo_finanziato_eur : -1,
        p.coesione && p.coesione.length ? Math.max(...p.coesione.map((x) => x.finanziamento_pubblico_netto_eur || 0)) : -1);
      const ETICH = { opere: 'Opere', pnrr: 'PNRR', coesione: 'Coesione', appalti: 'Appalti' };
      const base = D.prog.progetti.filter((p) => p.circoscrizioni.length === 1 && p.circoscrizioni[0] === CIRCO)
        .sort((a, b) => (importoMax(b) - importoMax(a)) || a.titolo.localeCompare(b.titolo, 'it'));
      const top = base.slice(0, 12);
      const lista = el('div', { class: 'elenco-prog' }, top.map((p) => {
        const imp = importoMax(p);
        return el('a', { class: 'voce-prog', href: U('progetto.html?da=circoscrizione/' + NUM(CIRCO) + '/&id=' + encodeURIComponent(p.id)), title: 'Apri la scheda del progetto: ' + p.titolo }, [
          el('span', {}, [
            el('span', { class: 'tit', text: p.titolo.length > 120 ? p.titolo.slice(0, 118) + '…' : p.titolo }),
            el('span', { class: 'fonti-riga mini' }, (p.fonti || []).map((f) => el('span', { class: 'badge ' + f, text: ETICH[f] || f })))]),
          el('b', { text: imp > 0 ? mln(imp, 1) : 'importo non disponibile' })]);
      }));
      const lede = $('progetti-lede');
      if (lede) lede.replaceChildren(
        `Sono ${it(base.length)} le voci che ricadono in una sola circoscrizione e in questa: ${it(CN.opere)} opere del Programma triennale` +
        (CN.pnrr || CN.coesione ? ` e ${it(CN.pnrr + CN.coesione)} tra PNRR e coesione collegate per CUP o CUI` : '') +
        '. Qui i primi 12 per importo; l\'elenco completo ha filtri per fonte, quartiere e UPL.');
      EL.replaceChildren(
        el('p', { class: 'nota', text: 'L\'importo mostrato è il più alto fra le fonti del progetto: stanziamento, finanziamento PNRR, fondo di coesione e base di gara misurano cose diverse e non si sommano.' }),
        lista,
        el('p', { class: 'badge-riga' }, [
          el('a', { class: 'badge-link', href: U('progetti.html?circ=' + CIRCO), text: `Tutti i ${it(CN.voci)} progetti in elenco` }),
          el('a', { class: 'badge-link', href: U('progetti.html?circ=' + CIRCO + '&incroci=1'), text: 'Solo quelli presenti in più fonti' })]));
    }

    /* ---------- quello che il Comune non divide ---------- */
    const NONBOX = $('non-attribuito');
    if (NONBOX) {
      const bil = D.bil.totale_spese_competenza['2026'];
      const ap = D.app.anni;
      const appalti = ap['2025'].importo_base_gara_eur_senza_anomali + ap['2026'].importo_base_gara_eur_senza_anomali;
      const blocco = (titolo, grande, nota, href, link) => el('div', {}, [
        el('h3', { text: titolo }), el('div', { class: 'grande', text: grande }),
        el('p', { class: 'nota', text: nota }),
        el('p', { class: 'nota' }, [el('a', { class: 'badge-link', href: href, text: link })]),
      ]);
      NONBOX.replaceChildren(el('div', { class: 'due-colonne' }, [
        blocco('Bilancio del Comune, 2026', mln(bil, 0),
          'Previsione di competenza per tutto il Comune. Il bilancio non ha capitoli per circoscrizione: non esiste una cifra «spesa della Circoscrizione ' + CIRCO + '».',
          U('index.html#bilancio'), 'Le missioni di spesa e le entrate'),
        blocco('Appalti avviati 2025-2026', mln(appalti, 0),
          `Base di gara di ${it(ap['2025'].cig + ap['2026'].cig)} CIG del Comune. Solo ${it(CN.appalti)} CIG hanno un CUI che combacia con un intervento di questa circoscrizione.`,
          U('index.html#appalti'), 'Gli appalti del Comune'),
        blocco('PNRR', mln(D.pnrr.totale.importo_finanziato_eur, 1),
          `Finanziamenti su ${it(D.pnrr.totale.progetti)} progetti del Comune. La localizzazione è comunale: solo i progetti collegati a un'opera hanno una circoscrizione.`,
          U('index.html#progetti'), 'I progetti PNRR'),
        blocco('Fondi di coesione', mln(D.coe.totale.finanziamento_pubblico_netto_eur, 1),
          `Finanziamento pubblico su ${it(D.coe.totale.progetti)} progetti del Comune con il Comune tra i beneficiari. Anche qui la circoscrizione manca.`,
          U('index.html#progetti'), 'I progetti di coesione'),
      ]));
    }

    /* ---------- cosa non misurano ---------- */
    const LIM = $('limiti');
    if (LIM) {
      LIM.replaceChildren(el('h3', { text: 'Cosa non misurano questi numeri' }), el('ul', {}, [
        el('li', { text: `Gli importi sono programmati, non spesi: sono stanziamenti del Programma triennale, non pagamenti.` }),
        el('li', { text: `La circoscrizione dice dove cade l'opera, non chi la decide: il Programma è del Comune, non un bilancio della circoscrizione.` }),
        ...D.opere.non_misura.filter((t) => !t.startsWith('Spesa effettiva') && !t.startsWith('Spesa della circoscrizione') && !t.startsWith('Circa il 47%')).map((t) => el('li', { text: t })),
      ]));
    }
  }

  /* ================= primitive ================= */

  function figura(host, o) {
    const f = el('figure', { class: 'grafico' + (o.larga ? ' larga' : '') });
    f.append(el('figcaption', { class: 'grafico-testa' }, [
      el('h3', { text: o.titolo }),
      o.nota ? el('p', { class: 'grafico-nota', text: o.nota }) : null,
    ]));
    const corpo = el('div', { class: 'grafico-corpo' });
    f.append(corpo);
    if (o.tabella) f.append(dettagli(o.tabella));
    host.append(f);
    return corpo;
  }

  function dettagli(t) {
    const d = el('details', { class: 'dati' });
    d.append(el('summary', { text: 'Vedi i numeri' }));
    const table = el('table', { class: 'tabella-dati' });
    table.append(el('thead', {}, el('tr', {}, t.colonne.map((c) => el('th', { scope: 'col', class: c.num ? 'num' : null, text: c.nome })))));
    table.append(el('tbody', {}, t.righe.map((r) => el('tr', {}, r.map((v, k) => el('td', { class: t.colonne[k] && t.colonne[k].num ? 'num' : null, text: v }))))));
    d.append(el('div', { class: 'tabella-scroll' }, table));
    return d;
  }

  /* barre orizzontali: la stessa forma dei grafici del sito */
  function barre(host, o) {
    const voci = o.ordina === false ? o.voci.slice() : o.voci.slice().sort((a, b) => (b.val || 0) - (a.val || 0));
    const max = Math.max(...voci.map((x) => x.val || 0), o.riferimento || 0) || 1;
    const box = el('div', { class: 'barre-dato' });
    voci.forEach((x) => {
      const scelta = x.id != null && x.id === o.evidenzia;
      const dentro = [
        el('div', { class: 'nome' }, [el('b', { text: x.nome }), x.sub ? el('small', { text: x.sub }) : null]),
        el('div', { class: 'pista' }, [
          el('span', { class: 'riempi', style: `width:${Math.max(0.7, 100 * (x.val || 0) / max)}%` }),
          o.riferimento != null ? el('span', { class: 'rif', style: `left:${Math.min(100, Math.max(0, 100 * o.riferimento / max))}%`, 'aria-hidden': 'true' }) : null,
        ]),
        el('div', { class: 'val', text: o.formatta(x.val) }),
      ];
      const riga = x.href
        ? el('a', { class: 'riga-barra link' + (scelta ? ' scelta' : ''), href: x.href, title: `Apri la scheda: ${x.nome}` }, dentro)
        : el('div', { class: 'riga-barra' + (scelta ? ' scelta' : '') }, dentro);
      riga.setAttribute('aria-label', `${x.nome}: ${o.formatta(x.val)}${x.sub ? ', ' + x.sub : ''}${scelta ? ' (questa circoscrizione)' : ''}`);
      conTip(riga, x.nome, [
        ['Valore', o.formatta(x.val)],
        x.sub ? ['Dettaglio', x.sub] : null,
        o.riferimento != null ? ['Media delle 8', o.formatta(o.riferimento)] : null,
        x.href ? ['Clic', 'apri la scheda'] : null,
      ]);
      box.append(riga);
    });
    host.append(box);
  }

  function impilate(host, o) {
    const box = el('div', { class: 'impilate' });
    o.righe.forEach((r) => {
      const tot = somma(r.valori) || 1;
      const pista = el('div', { class: 'pista-imp' });
      r.valori.forEach((v, k) => {
        if (!v) return;
        const q = 100 * v / tot;
        const seg = el('span', { class: 'seg seg-' + (Number(o.segmenti[k].colore.replace('--s', '')) - 1), style: `width:${q}%;background:var(${o.segmenti[k].colore})` });
        if (q >= 10) seg.append(el('span', { class: 'seg-lab', text: pct(q, q < 20 ? 1 : 0) }));
        conTip(seg, o.segmenti[k].nome, [[r.nome, o.formatta(v)], ['Quota', pct(q)]]);
        pista.append(seg);
      });
      box.append(el('div', { class: 'riga-imp' + (r.scelta ? ' scelta' : '') + (r.citta ? ' citta' : ''), 'aria-current': r.scelta ? 'true' : null }, [el('div', { class: 'nome', text: r.nome }), pista]));
    });
    host.append(box);
    host.append(el('div', { class: 'legenda-imp' }, o.segmenti.map((s) => el('span', { class: 'voce-leg' }, [
      el('span', { class: 'pastiglia', style: `background:var(${s.colore})` }), s.nome]))));
  }
})();
