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
    rgs: 'data/missioni_rgs.json', cnt: 'data/snapshot/conteggi_territorio.json' };

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
    let ind = IND[0], sel = null, selQ = null, selU = null, selProj = null, layerOn = false, PR = null;
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
      p.addEventListener('click', (ev) => { const id = progettoSotto(ev); if (id) apriProgetto(id); else location.href = paginaCirc(c); });
      p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); location.href = paginaCirc(c); } });
      agganciaTip(p, () => [`Circoscrizione ${c}`, righeCirc(c)]);
      svg.append(p);
      gruppi[c] = { p };
    });
    const SPOSTA = { VIII: [-12, 100] };   // il baricentro cade sul bordo: sposta l'etichetta dentro l'area
    ROM.forEach(c => {
      const g = Object.assign({}, D.geo.circoscrizioni[c]);
      if (SPOSTA[c]) { g.cx += SPOSTA[c][0]; g.cy += SPOSTA[c][1]; }
      /* sul poligono resta solo il numero della circoscrizione: le cifre stanno nel popup */
      const t1 = document.createElementNS(NS, 'text');
      t1.setAttribute('x', g.cx); t1.setAttribute('y', g.cy); t1.setAttribute('dy', '0.35em');
      t1.setAttribute('class', 'etichetta'); t1.textContent = c;
      svg.append(t1); gruppi[c].t1 = t1;
    });

    /* ---- popup della mappa ----
       Tutto quello che non sta scritto sul poligono (il valore dell'indicatore, gli altri indicatori,
       la circoscrizione di un quartiere) compare qui al passaggio del mouse o col fuoco da tastiera. */
    const tip = el('div', { class: 'tip', hidden: true, 'aria-hidden': 'true' });
    document.body.append(tip);
    function posizionaTip(x, y) {
      tip.hidden = false;
      const r = tip.getBoundingClientRect();
      let left = x + 14, top = y + 14;
      if (left + r.width > innerWidth - 8) left = x - r.width - 14;
      if (top + r.height > innerHeight - 8) top = y - r.height - 14;
      tip.style.left = Math.max(8, left) + 'px';
      tip.style.top = Math.max(8, top) + 'px';
    }
    addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });
    function contenutoTip(titolo, righe) {
      tip.replaceChildren(el('b', { text: titolo }), ...righe.map(r => el('div', { class: 'tip-riga' + (r[2] ? ' divisa' : '') }, [
        el('span', { text: r[0] }), el('strong', { text: r[1] })])));
    }
    const conteggiDi = (livello, nome) => (D.cnt && D.cnt[livello] && D.cnt[livello][nome]) || null;
    /* quante voci, quante con PNRR o coesione, quante linee di finanziamento, quanti CIG: le stesse
       voci che si aprono scegliendo il territorio (data/snapshot/conteggi_territorio.json) */
    const righeConteggi = (livello, nome) => {
      const n = conteggiDi(livello, nome);
      if (!n) return [];
      const out = [['Progetti in elenco', it(n.voci), true]];
      if (n.straordinari) out.push(['Con PNRR o coesione', it(n.straordinari)]);
      out.push(['Finanziamenti dichiarati', it(n.finanziamenti)]);
      out.push(['CIG collegati', it(n.appalti)]);
      return out;
    };
    const righeCirc = (c) => {
      const g = D.geo.circoscrizioni[c];
      const upl = Object.values(g.upl).reduce((s, l) => s + l.length, 0);
      return [
        ...IND.map(i => [i.nome, i.f(i.val(c))]),
        ['Quartieri e UPL', `${it(g.quartieri.length)} · ${it(upl)}`, true],
        ...righeConteggi('circoscrizioni', c),
      ];
    };
    const righeQuartiere = (n, g) => {
      const upl = new Set();
      Object.values(D.geo.circoscrizioni).forEach(v => (v.upl[n] || []).forEach(u => upl.add(u)));
      const circQ = (g.circ && g.circ[0]) || '';
      return [
        ['Circoscrizione', (g.circ || []).join(', ') || 'non indicata'],
        ['UPL', it(upl.size)],
        /* la cifra è quella della circoscrizione: il quartiere non ha un indicatore proprio */
        ...(circQ ? [[`${ind.nome} (circ. ${circQ})`, ind.f(ind.val(circQ))]] : []),
        ...righeConteggi('quartieri', n),
      ];
    };
    const righeUpl = (n, g) => [['Quartiere', g.quartiere], ['Circoscrizione', g.circ], ...righeConteggi('upl', n)];
    function agganciaTip(nodo, contenuto) {
      nodo.addEventListener('pointerenter', (e) => { contenutoTip(...contenuto()); posizionaTip(e.clientX, e.clientY); });
      nodo.addEventListener('pointermove', (e) => { if (!tip.hidden) posizionaTip(e.clientX, e.clientY); });
      nodo.addEventListener('pointerleave', () => { tip.hidden = true; });
      nodo.addEventListener('focus', () => {
        const b = nodo.getBoundingClientRect();
        contenutoTip(...contenuto()); posizionaTip(b.left + b.width / 2, b.top + b.height / 2);
      });
      nodo.addEventListener('blur', () => { tip.hidden = true; });
    }

    /* ---- livelli sotto la circoscrizione: quartieri e UPL ----
       I poligoni si disegnano solo quando il livello è scelto; la gerarchia invece è già nei confini,
       così i due menù a discesa funzionano subito. */
    const gQ = document.createElementNS(NS, 'g'); gQ.setAttribute('id', 'quartieri-g'); gQ.setAttribute('hidden', '');
    const gU = document.createElementNS(NS, 'g'); gU.setAttribute('id', 'upl-g'); gU.setAttribute('hidden', '');
    svg.append(gQ, gU);
    let QG = null, UG = null, qStato = 'idle', uStato = 'idle';
    const GQ = {}, GU = {};   // nome -> path
    const selQEl = $('sel-quartiere'), selUEl = $('sel-upl');
    const quartieriDi = (c) => c ? D.geo.circoscrizioni[c].quartieri.slice()
      : [...new Set(Object.values(D.geo.circoscrizioni).flatMap(v => v.quartieri))].sort((a, b) => a.localeCompare(b, 'it'));
    const uplDi = (q, c) => {
      const out = new Set();
      Object.entries(D.geo.circoscrizioni).forEach(([cc, v]) => {
        if (c && cc !== c) return;
        if (q) { (v.upl[q] || []).forEach(u => out.add(u)); return; }
        Object.values(v.upl).forEach(l => l.forEach(u => out.add(u)));
      });
      return [...out].sort((a, b) => a.localeCompare(b, 'it'));
    };
    const quartiereDellaUpl = (u) => {
      for (const v of Object.values(D.geo.circoscrizioni)) {
        for (const [q, l] of Object.entries(v.upl)) if (l.includes(u)) return q;
      }
      return null;
    };
    /* i due menù si riempiono a scalare: la circoscrizione limita i quartieri, il quartiere limita le UPL */
    function popolaQuartieri() {
      const nomi = quartieriDi(sel);
      /* il contatore nell'opzione vuota dice subito quanto è grande il livello che si sta guardando */
      selQEl.replaceChildren(el('option', { value: '', text: nomi.length ? `Tutti i quartieri (${nomi.length})` : 'Quartieri' }),
        ...nomi.map(n => el('option', { value: n, text: n })));
      selQEl.value = selQ || '';
      $('pillola-quartiere').dataset.attivo = String(!!selQ);
      popolaUpl();
    }
    function popolaUpl() {
      const nomi = uplDi(selQ, sel);
      selUEl.replaceChildren(el('option', { value: '', text: nomi.length ? `Tutte le UPL (${nomi.length})` : 'Nessuna UPL' }),
        ...nomi.map(n => el('option', { value: n, text: n })));
      selUEl.disabled = !nomi.length;
      selUEl.value = selU || '';
      $('pillola-upl').dataset.attivo = String(!!selU);
    }
    /* le quattro cifre di sintesi stanno sotto la scheda: si vedono solo quando non c'è una selezione */
    function aggiornaCifre() { $('cifre-apertura').hidden = !!(sel || selQ || selU || selProj); }
    /* menù, poligoni e classe della mappa allineati allo stato: un solo punto da chiamare dopo ogni scelta */
    function allinea() {
      ROM.forEach(x => gruppi[x].p.setAttribute('aria-pressed', String(x === sel && !selQ)));
      popolaQuartieri();
      svg.classList.toggle('livello-quartieri', !!selQ);
      /* con una circoscrizione scelta si vedono i suoi quartieri; con un quartiere, le sue UPL.
         Così la discesa si fa anche cliccando i poligoni, non solo dai menù. */
      gQ.toggleAttribute('hidden', !(layerOn && (selQ || sel) && QG));
      gU.toggleAttribute('hidden', !(layerOn && selQ && UG));
      Object.entries(GQ).forEach(([n, p]) => {
        /* con una circoscrizione scelta restano i suoi quartieri: gli altri stanno fuori dalla mappa inquadrata */
        p.style.display = !sel || (QG.quartieri[n].circ || []).includes(sel) ? '' : 'none';
        p.setAttribute('aria-pressed', String(n === selQ && !selU));
      });
      Object.entries(GU).forEach(([n, p]) => {
        p.setAttribute('aria-pressed', String(n === selU));
        p.style.display = !selQ || UG.upl[n].quartiere === selQ ? '' : 'none';
      });
      legendaProgetti();
      aggiornaCifre();
    }
    function disegnaQuartieri() {
      Object.entries(QG.quartieri).forEach(([n, g]) => {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', g.d); p.setAttribute('class', 'quartiere'); p.setAttribute('tabindex', '0');
        p.setAttribute('role', 'button'); p.setAttribute('aria-label', `Quartiere ${n}`);
        p.append(Object.assign(document.createElementNS(NS, 'title'), { textContent: `Quartiere ${n}` }));
        p.addEventListener('click', (ev) => {
          const id = progettoSotto(ev); if (id) { apriProgetto(id); return; }
          if (n === selQ && !selU) scegli(sel, false); else scegliQuartiere(n);
        });
        p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scegliQuartiere(n); } });
        agganciaTip(p, () => [`Quartiere ${n}`, righeQuartiere(n, g)]);
        gQ.append(p); GQ[n] = p;
      });
    }
    function disegnaUpl() {
      Object.entries(UG.upl).forEach(([n, g]) => {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', g.d); p.setAttribute('class', 'upl'); p.setAttribute('tabindex', '0');
        p.setAttribute('role', 'button'); p.setAttribute('aria-label', `UPL ${n}`);
        p.append(Object.assign(document.createElementNS(NS, 'title'), { textContent: `UPL ${n} — quartiere ${g.quartiere}` }));
        p.addEventListener('click', (ev) => {
          const id = progettoSotto(ev); if (id) { apriProgetto(id); return; }
          if (n === selU) scegliQuartiere(selQ); else scegliUpl(n);
        });
        p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scegliUpl(n); } });
        agganciaTip(p, () => [`UPL ${n}`, righeUpl(n, g)]);
        gU.append(p); GU[n] = p;
      });
    }
    /* i confini si scaricano la prima volta che il livello serve (109 e 141 KB) */
    function caricaLivello(quale) {
      if (quale === 'quartieri') {
        if (qStato !== 'idle') return;
        qStato = 'carica';
        $('mappa-nota').textContent = 'Carico i confini dei quartieri…';
        fetch('data/geo/quartieri.json', { cache: 'no-cache' })
          .then(r => { if (!r.ok) throw new Error('quartieri'); return r.json(); })
          .then(j => { QG = j; qStato = 'pronto'; disegnaQuartieri(); allinea(); zoomA(); scheda(); $('mappa-nota').textContent = ind.nota; })
          .catch(() => { qStato = 'errore'; $('mappa-nota').textContent = 'I confini dei quartieri non si caricano.'; });
      } else {
        if (uStato !== 'idle') return;
        uStato = 'carica';
        $('mappa-nota').textContent = 'Carico i confini delle UPL…';
        fetch('data/geo/upl.json', { cache: 'no-cache' })
          .then(r => { if (!r.ok) throw new Error('upl'); return r.json(); })
          .then(j => { UG = j; uStato = 'pronto'; disegnaUpl(); allinea(); zoomA(); scheda(); $('mappa-nota').textContent = ind.nota; })
          .catch(() => { uStato = 'errore'; $('mappa-nota').textContent = 'I confini delle UPL non si caricano.'; });
      }
    }

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
        gruppi[c].t1.style.fill = txt;
        gruppi[c].t1.style.stroke = 'none';
        gruppi[c].p.setAttribute('aria-label', `Circoscrizione ${c}: ${ind.nome} ${ind.f(ind.val(c))}`);
      });
      $('mappa-nota').textContent = ind.nota;
      $('legenda').replaceChildren(el('span', { text: ind.f(mn) }), el('span', { class: 'scala' }), el('span', { text: ind.f(mx) }));
      legendaProgetti();
    }

    /* scheda */
    function scegli(c, scorri) {
      /* un secondo clic sulla stessa circoscrizione riporta a tutta la città */
      if (c === sel && !selQ && !selU && !selProj && scorri) { deseleziona(); return; }
      sel = c; selQ = null; selU = null; selProj = null; qProg = ''; evidenziaProgetto();
      document.querySelectorAll('#opere-barre .barra').forEach(b => b.removeAttribute('aria-current'));
      const b = document.querySelector(`#opere-barre .barra[data-c="${c}"]`); if (b) b.setAttribute('aria-current', 'true');
      tutta.hidden = false;
      caricaLivello('quartieri');   /* i quartieri diventano cliccabili dentro la circoscrizione */
      /* sulla mappa restano i progetti di questa circoscrizione, dentro il suo poligono */
      if (!layerOn) { allinea(); accendiProgetti(); }
      else { allinea(); aggiornaVisibilitaProgetti(); zoomA(); scheda(); }
      /* su schermo stretto la scheda sta sotto la mappa: senza questo resta fuori vista */
      if (scorri && matchMedia('(max-width: 900px)').matches) {
        $('scheda').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    }

    /* scendere di un livello: il quartiere porta con sé la sua circoscrizione, la UPL il suo quartiere */
    function scegliQuartiere(n) {
      if (!n) { if (selQ) { selQ = null; selU = null; selProj = null; } }
      else {
        selQ = n; selU = null; selProj = null;
        if (QG && QG.quartieri[n]) sel = QG.quartieri[n].circ[0];
        else { const c = Object.entries(D.geo.circoscrizioni).find(([, v]) => v.quartieri.includes(n)); if (c) sel = c[0]; }
      }
      qProg = '';
      if (selQ) { caricaLivello('quartieri'); caricaLivello('upl'); }
      tutta.hidden = !(sel || selQ || selU);
      document.querySelectorAll('#opere-barre .barra').forEach(x => x.removeAttribute('aria-current'));
      const b = sel ? document.querySelector(`#opere-barre .barra[data-c="${sel}"]`) : null;
      if (b) b.setAttribute('aria-current', 'true');
      if (!layerOn) { allinea(); accendiProgetti(); }
      else { allinea(); aggiornaVisibilitaProgetti(); zoomA(); scheda(); }
    }
    function scegliUpl(n) {
      if (!n) { scegliQuartiere(selQ); return; }
      const q = (UG && UG.upl[n] && UG.upl[n].quartiere) || quartiereDellaUpl(n);
      selU = n; selProj = null; qProg = '';
      if (q) {
        selQ = q;
        /* la circoscrizione si ricava dalla gerarchia: la geometria della UPL può non essere ancora arrivata */
        const c = (UG && UG.upl[n] && UG.upl[n].circ)
          || (Object.entries(D.geo.circoscrizioni).find(([, v]) => v.quartieri.includes(q)) || [])[0];
        if (c) sel = c;
      }
      caricaLivello('upl');
      if (selQ) caricaLivello('quartieri');
      tutta.hidden = !(sel || selQ || selU);
      if (!layerOn) { allinea(); accendiProgetti(); }
      else { allinea(); aggiornaVisibilitaProgetti(); zoomA(); scheda(); }
    }

    /* dalle barre delle opere: circoscrizione sulla mappa e scheda, senza cambiare pagina */
    function mostraCircoscrizione(c) {
      scegli(c, false);
      document.querySelector('.mappa-blocco').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }

    function deseleziona() {
      sel = null; selQ = null; selU = null; selProj = null; qProg = ''; evidenziaProgetto();
      document.querySelectorAll('#opere-barre .barra').forEach(b => b.removeAttribute('aria-current'));
      tutta.hidden = true;
      allinea(); zoomA(true); aggiornaVisibilitaProgetti(); scheda();
    }

    /* i progetti della circoscrizione: data/progetti.json pesa, si carica solo quando serve */
    function caricaProgetti() {
      if (progStato !== 'idle') return;
      progStato = 'carica';
      fetch('data/progetti.json', { cache: 'no-cache' })
        .then(r => { if (!r.ok) throw new Error('progetti'); return r.json(); })
        .then(j => { PROG = j; progStato = 'pronto'; if (sel || selQ || selU) scheda(); })
        .catch(() => { progStato = 'errore'; if (sel || selQ || selU) scheda(); });
    }
    function riga(k, v) { return el('div', { class: 'riga' }, [el('dt', { text: k }), el('dd', { text: v })]); }
    function scheda() {
      const s = $('scheda');
      if (!s) return;   /* la scheda di sintesi sta nella pagina della circoscrizione */
      if (selProj) { s.replaceChildren(...schedaProgetto(selProj)); return; }
      if (selQ || selU) { schedaTerritorio(); return; }
      if (!sel) {
        s.replaceChildren(el('div', { class: 'vuota' }, [
          el('h2', { text: 'Palermo' }),
          el('p', { text: `${it(D.prof.totale_palermo.residenti)} residenti al censimento 2021, in 8 circoscrizioni.` }),
          el('p', { text: 'Clicca una circoscrizione sulla mappa: si apre la sua scheda con residenti, famiglie e opere programmate.' }),
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
      const posImpO = 1 + ROM.filter(x => O(x).importo_triennio_eur > o.importo_triennio_eur).length;
      const posPcO = 1 + ROM.filter(x => O(x).importo_triennio_per_residente_eur > o.importo_triennio_per_residente_eur).length;
      const dlo = el('dl', {}, [
        riga('Interventi', it(o.interventi)), riga('Importo 2026-2028', mln(o.importo_triennio_eur)),
        riga('Per residente', it(o.importo_triennio_per_residente_eur) + ' €'), riga('Interventi con CUP', `${o.con_cup} su ${o.interventi}`),
        riga('Posto per importo', `${posImpO}º su 8`), riga('Posto per abitante', `${posPcO}º su 8`),
      ]);
      /* la stessa barra per anni che sta nella colonna destra della sezione Opere */
      const anniO = ['2026', '2027', '2028'].map(a => [a, o['importo_' + a + '_eur']]);
      const totO = o.importo_triennio_eur || 1;
      const anniBox = el('div', {}, [
        el('div', { class: 'anno-barra', 'aria-hidden': 'true' }, anniO.map(([a, v]) => el('span', { class: 'anno-seg a' + a, style: `width:${100 * v / totO}%` }))),
        el('div', { class: 'anno-legenda' }, anniO.map(([a, v]) => el('div', {}, [
          el('i', { class: 'a' + a }), el('span', { text: a }), el('span', { class: 'quota', text: mln(v, 0) }), el('b', { text: it(100 * v / totO) + '%' })]))),
      ]);
      /* i primi tre settori come barre compatte: il resto sta nella scheda completa */
      const setts = (o.principali_settori || []).slice(0, 3);
      const maxS = setts.length ? setts[0].importo_eur : 1;
      const sett = el('div', { class: 'barre', role: 'list' }, setts.map(x => el('div', { class: 'barra', role: 'listitem' }, [
        el('div', { class: 'nome' }, [x.settore.replace(/^\d+\.\d+ - /, ''), el('small', { text: `${x.interventi} interventi` })]),
        el('div', { class: 'pista' }, [el('span', { class: 'riempi', style: `width:${100 * x.importo_eur / maxS}%` })]),
        el('div', { class: 'val', text: mln(x.importo_eur, 0) })])));
      s.replaceChildren(
        el('h2', { text: `Circoscrizione ${sel}` }),
        /* i quartieri sono il livello sotto: ci si scende con un clic */
        el('div', { class: 'quartieri-riga', role: 'group', 'aria-label': `Quartieri della Circoscrizione ${sel}` },
          q.map(n => { const b = el('button', { type: 'button', class: 'quartiere-scendi', text: n, title: `Scendi al quartiere ${n}` }); b.addEventListener('click', () => scegliQuartiere(n)); return b; })),
        el('p', { class: 'badge-riga' }, [el('a', { class: 'badge-link', href: paginaCirc(sel), text: `La scheda completa della Circoscrizione ${sel}` })]),
        dl,
        el('h3', { text: 'Opere programmate 2026-2028' }), dlo,
        el('h4', { text: 'In che anni cadono' }), anniBox,
        el('h4', { text: 'I primi tre settori' }), sett,
        el('p', { class: 'nota', text: 'La scheda completa ha tutte le opere per anno e settore, il confronto con le altre circoscrizioni, quartieri e UPL, i progetti e il profilo della circoscrizione. Residenti e profilo: censimento ISTAT 2021. Opere: la circoscrizione in cui ricadono, non una spesa decisa dalla circoscrizione né denaro già speso.' }),
        ...progettiDelTerritorio().filter(Boolean)
      );
    }

    /* quali progetti ricadono in questa circoscrizione, con la ricerca */
    const ETICH = { opere: 'Opere', pnrr: 'PNRR', coesione: 'Coesione', appalti: 'Appalti' };
    const importoMax = (p) => Math.max(
      p.opere ? p.opere.importo_triennio_eur : -1,
      p.pnrr && p.pnrr.importo_finanziato_eur != null ? p.pnrr.importo_finanziato_eur : -1,
      p.coesione && p.coesione.length ? Math.max(...p.coesione.map(x => x.finanziamento_pubblico_netto_eur || 0)) : -1);
    /* un intervento con più circoscrizioni non si divide: vale solo per il suo insieme */
    const inCirc = (p, c) => p.circoscrizioni.length === 1 && p.circoscrizioni[0] === c;
    /* il territorio scelto a scalare: circoscrizione, poi quartiere, poi UPL (ognuno stringe il precedente) */
    const inTerritorio = (p) => (!sel || inCirc(p, sel)) && (!selQ || p.quartieri.includes(selQ)) && (!selU || p.upl.includes(selU));
    const doveSono = () => selU ? `nella UPL ${selU}` : selQ ? `nel quartiere ${selQ}` : `in Circoscrizione ${sel}`;
    const hrefElenco = () => elenco(Object.assign({}, sel ? { circ: sel } : {}, selQ ? { quartiere: selQ } : {}, selU ? { upl: selU } : {}));
    function progettiDelTerritorio() {
      if (!sel && !selQ && !selU) return [];
      const h = el('h3', { text: 'Progetti' });
      if (!PROG) {
        caricaProgetti();
        return [h,
          el('p', { class: 'nota', text: progStato === 'errore' ? 'L\'elenco dei progetti non si carica.' : 'Caricamento dei progetti del territorio…' }),
          el('p', { class: 'nota' }, [el('a', { class: 'badge-link', href: hrefElenco(), text: 'Apri l\'elenco dei progetti di questo territorio' })])];
      }
      const base = PROG.progetti.filter(inTerritorio)
        .sort((a, b) => (importoMax(b) - importoMax(a)) || a.titolo.localeCompare(b.titolo, 'it'));
      const inp = el('input', { type: 'search', placeholder: 'Cerca fra i progetti (es. scuola, strada, via)', 'aria-label': `Cerca fra i progetti ${doveSono()}` });
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
          return el('a', { href: 'progetto.html?id=' + encodeURIComponent(p.id), role: 'listitem', class: 'voce-prog', title: 'Apri la scheda del progetto: ' + p.titolo }, [
            el('span', {}, [el('span', { class: 'tit', text: p.titolo.length > 96 ? p.titolo.slice(0, 94) + '…' : p.titolo }),
              el('span', { class: 'fonti-riga mini' }, p.fonti.map(f => el('span', { class: 'badge ' + f, text: ETICH[f] || f })))]),
            el('b', { text: imp > 0 ? mln(imp, 1) : 'importo non disponibile' })]);
        }) : [el('p', { class: 'nota', text: 'Nessun progetto trovato con questa ricerca.' })]));
        conta.textContent = (r.length ? `${it(Math.min(12, r.length))} di ${it(r.length)} progetti` : 'Nessun progetto') +
          (q ? ' con questa ricerca' : '') + (r.length ? ', per importo decrescente.' : '.');
      };
      inp.addEventListener('input', mostra);
      mostra();
      const nOpere = base.filter(p => p.fonti.includes('opere')).length;
      const nAltre = base.length - nOpere;
      const nGeo = layerOn && PR ? PR.progetti.filter(inTerritorio).length : null;
      return [h,
        el('p', { class: 'nota', text: `Le ${it(base.length)} voci che ricadono ${doveSono()}: ${it(nOpere)} opere del Programma triennale` +
          (nAltre ? ` e ${it(nAltre)} tra PNRR e coesione collegate per CUP o CUI` : '') +
          `. L'importo è quello più alto fra le fonti del progetto: fonti diverse non si sommano.` }),
        inp, out, conta,
        nGeo == null ? null : el('p', { class: 'nota', text: `I progetti con una posizione sono già disegnati sulla mappa: scegliendone uno qui sotto lo si evidenzia, gli altri aprono la loro scheda.` }),
        el('p', { class: 'nota' }, [el('a', { class: 'badge-link', href: hrefElenco(), text: `Vedi tutti i ${it(base.length)} progetti in elenco` })]),
        el('p', { class: 'nota', text: selU ? 'La UPL è la suddivisione statistica del quartiere: poche voci per volta, perché quasi nessun progetto è localizzato così in basso.' : 'L\'elenco ha filtri e collegamenti alle fonti. Gli interventi che toccano più circoscrizioni non si dividono: restano nell\'elenco sotto «Più circoscrizioni».' })];
    }

    /* quartiere o UPL: la scheda scende di un livello, con i progetti che ci ricadono */
    function schedaTerritorio() {
      const g = selQ && QG ? QG.quartieri[selQ] : null;
      const u = selU && UG ? UG.upl[selU] : null;
      const circ = (u && u.circ) || (g && g.circ[0]) || sel;
      const parti = [];
      if (selU) {
        const su = el('button', { type: 'button', class: 'livello-su', text: `‹ Quartiere ${selQ}` });
        su.addEventListener('click', () => scegliQuartiere(selQ));
        parti.push(el('div', { class: 'livelli' }, [su]));
      }
      const upl = selQ && !selU ? uplDi(selQ, circ) : [];
      const bloccoUpl = upl.length ? el('div', {}, [
        el('h3', { text: `UPL del quartiere (${upl.length})` }),
        el('div', { class: 'upl-riga' }, upl.map(n => {
          const b = el('button', { type: 'button', class: 'upl-scendi', text: n, title: `Scendi alla UPL ${n}` });
          b.addEventListener('click', () => scegliUpl(n));
          return b;
        })),
      ]) : null;
      $('scheda').replaceChildren(
        el('h2', { text: selU ? `UPL ${selU}` : `Quartiere ${selQ}` }),
        el('p', { class: 'quartieri', text: [selU ? `Quartiere ${selQ}` : null, circ ? `Circoscrizione ${circ}` : null].filter(Boolean).join(' · ') }),
        ...[...parti, bloccoUpl].filter(Boolean),
        el('p', { class: 'nota', text: 'Quartieri e UPL sono le unità statistiche dei confini ISTAT del censimento 2021. Residenti e altri indicatori sono pubblicati per circoscrizione: qui non si stimano cifre per quartiere.' }),
        ...progettiDelTerritorio().filter(Boolean)
      );
    }

    /* senza circoscrizione scelta la scheda è quella di Palermo: elenca gli interventi che stanno sulla mappa */
    function progettiSullaMappa() {
      if (!layerOn || !PR) return [];
      const base = PR.progetti.slice().sort((a, b) => b.importo_triennio_eur - a.importo_triennio_eur);
      const out = el('div', { class: 'elenco-prog', role: 'list' });
      base.slice(0, 12).forEach(pr => {
        out.append(el('a', { href: 'progetto.html?id=' + encodeURIComponent('op-' + pr.id), role: 'listitem', class: 'voce-prog', title: 'Apri la scheda del progetto: ' + pr.descrizione }, [
          el('span', {}, [el('span', { class: 'tit', text: pr.descrizione.length > 96 ? pr.descrizione.slice(0, 94) + '…' : pr.descrizione })]),
          el('b', { text: mln(pr.importo_triennio_eur, 1) })]));
      });
      const quota = it(100 * base.reduce((s, p) => s + p.importo_triennio_eur, 0) / tot.importo_triennio_eur, 0);
      return [el('h3', { text: `Progetti con posizione (${base.length})` }), out,
        el('p', { class: 'nota', text: `I primi 12 per importo: sono ${base.length} interventi con una posizione, il ${quota}% dell'importo del Programma. Gli altri ${PR.senza_posizione} (reti, linee e interventi diffusi) non sono sulla mappa.` }),
        el('p', { class: 'nota' }, [el('a', { class: 'badge-link', href: 'progetti.html', text: 'Tutti i progetti e i finanziamenti' })]),
        el('p', { class: 'nota', text: 'Compresi quelli senza posizione.' })];
    }

    /* sezione opere */
    $('opere-lede').replaceChildren(
      'Gli interventi del Programma triennale dei lavori pubblici valgono ', el('strong', { text: mln(tot.importo_triennio_eur, 0) }),
      `. Il ${it(100 * nonLoc.importo_triennio_eur / tot.importo_triennio_eur, 0)}% (${mln(nonLoc.importo_triennio_eur, 0)}, ${nonLoc.interventi} interventi) non ha una circoscrizione: sono reti e linee che attraversano la città.`,
      ' Scegli una circoscrizione: la mappa la mostra con i progetti che hanno una posizione; il nome della circoscrizione apre la sua scheda, con i grafici e l\'elenco completo.',
      ' I due menù sopra la mappa scendono al quartiere e alla UPL: il poligono si disegna e i progetti si stringono a quel livello.');
    const maxO = Math.max(...ROM.map(c => O(c).importo_triennio_eur), D.opere.piu_circoscrizioni.importo_triennio_eur, nonLoc.importo_triennio_eur);
    const barra = (cls, nome, sub, v, extra = {}, href = null, vai = null, azione = 'Apri l\'elenco dei progetti') => {
      const riga = el('div', Object.assign({ class: 'barra ' + cls + (href ? ' cliccabile' : ''), role: 'listitem' }, extra), [
        el('div', { class: 'nome' }, [href ? el('a', { href, text: nome, 'aria-label': `${nome}${sub ? ': ' + sub + ', ' : ': '}${v.testo}. ${azione}` }) : nome, sub ? el('small', { text: sub }) : null]),
        el('div', { class: 'pista' }, [el('span', { class: 'riempi', style: `width:${100 * v.n / v.max}%` })]),
        el('div', { class: 'val' }, [v.testo, href && !vai ? el('span', { class: 'freccia', 'aria-hidden': 'true', text: ' →' }) : null])]);
      if (href) {
        riga.addEventListener('click', (e) => {
          if (e.target.closest('a')) return;
          if (vai) vai(); else location.href = href;
        });
        riga.title = vai
          ? `Mostra ${nome} sulla mappa, con i progetti che hanno una posizione. ${azione}.`
          : `${azione}: ${sub ? sub + ', ' : ''}${v.testo}`;
      }
      return riga;
    };
    const elenco = (params) => 'progetti.html?' + Object.entries(params).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
    const paginaCirc = (c) => `circoscrizione/${ROM.indexOf(c) + 1}/`;
    const ob = $('opere-barre');
    ROM.forEach(c => ob.append(barra('', `Circoscrizione ${c}`, `${O(c).interventi} interventi`, { n: O(c).importo_triennio_eur, max: maxO, testo: mln(O(c).importo_triennio_eur, 0) }, { 'data-c': c }, paginaCirc(c), null, 'Apri la scheda della circoscrizione')));
    const pc = D.opere.piu_circoscrizioni;
    ob.append(barra('piu', 'Più circoscrizioni', `${pc.interventi} interventi, non divisi`, { n: pc.importo_triennio_eur, max: maxO, testo: mln(pc.importo_triennio_eur, 0) }, {}, elenco({ fonte: 'opere', circ: '__multi' })));
    ob.append(barra('senza', 'Senza circoscrizione', `${nonLoc.interventi} interventi`, { n: nonLoc.importo_triennio_eur, max: maxO, testo: mln(nonLoc.importo_triennio_eur, 0) }, {}, elenco({ fonte: 'opere', circ: '__nessuna' })));
    const big = nonLoc.principali_interventi[0];
    $('opere-limiti').replaceChildren(el('h3', { text: 'Cosa non misura' }), el('ul', {}, [
      el('li', {}, ['L\'intervento più grande senza circoscrizione vale ' + mln(big.importo_triennio_eur, 0) + ': ',
        el('a', { href: 'progetto.html?id=' + encodeURIComponent(big.id), text: big.descrizione.replace(/\s+/g, ' ') }), '.']),
      ...D.opere.non_misura.filter(t => !t.startsWith('Circa il')).map(t => el('li', { text: t })),
    ]));

    /* gli stessi importi letti in altro modo: pro capite, i più grandi senza circoscrizione, l'anno in cui cadono */
    const nota = (t) => el('p', { class: 'nota', text: t });

    /* 1. importo per abitante: gli euro da soli non dicono quanto pesa su chi ci abita */
    const residentiTot = ROM.reduce((s, c) => s + P(c).residenti, 0);
    const mediaPc = ROM.reduce((s, c) => s + O(c).importo_triennio_eur, 0) / residentiTot;
    const pcRank = ROM.map(c => ({ c, v: O(c).importo_triennio_per_residente_eur })).sort((a, b) => b.v - a.v);
    const maxPc = Math.max(pcRank[0].v, mediaPc);
    const pcRighe = el('div', { class: 'pc-righe' }, pcRank.map(x => {
      const b = el('button', { type: 'button', class: 'pc-riga', title: `Circoscrizione ${x.c}: ${it(x.v)} € per abitante. Apri la scheda della circoscrizione.` }, [
        el('span', { class: 'pc-nome', text: x.c }),
        el('span', { class: 'pc-pista' }, [el('span', { class: 'pc-riempi', style: `width:${100 * x.v / maxPc}%` })]),
        el('span', { class: 'pc-val', text: it(x.v) + ' €' })]);
      b.addEventListener('click', () => { location.href = paginaCirc(x.c); });
      return b;
    }));
    pcRighe.append(el('div', { class: 'pc-media' }, [
      el('span', { class: 'pc-nome', text: 'Media' }),
      el('span', { class: 'pc-pista' }, [el('span', { class: 'pc-riempi', style: `width:${100 * mediaPc / maxPc}%` })]),
      el('span', { class: 'pc-val', text: it(mediaPc) + ' €' })]));
    $('opere-pro-capite').replaceChildren(
      el('h3', { text: 'Quanto vale per abitante' }), pcRighe,
      nota(`Interventi con una sola circoscrizione divisi per i residenti del censimento 2021. La media delle 8 circoscrizioni è ${it(mediaPc)} €; il ${it(100 * nonLoc.importo_triennio_eur / tot.importo_triennio_eur, 0)}% dell'importo non ha circoscrizione e resta fuori da queste cifre. Una riga porta alla circoscrizione sulla mappa.`));

    /* 2. i più grandi fra i 94 interventi senza circoscrizione: rendono verificabile la cifra aggregata */
    const topSenza = nonLoc.principali_interventi.slice(0, 5);
    $('opere-senza').replaceChildren(
      el('h3', { text: 'I più grandi senza circoscrizione' }),
      el('ul', { class: 'senza-righe' }, topSenza.map(x => {
        const d = x.descrizione.replace(/\s+/g, ' ');
        return el('li', {}, [
          el('a', { href: 'progetto.html?id=' + encodeURIComponent(x.id), title: 'Apri la scheda del progetto: ' + d, text: d.length > 92 ? d.slice(0, 90) + '…' : d }),
          el('b', { text: mln(x.importo_triennio_eur, 0) })]);
      })),
      nota(`I primi 5 per importo dei ${nonLoc.interventi} interventi senza circoscrizione (${mln(nonLoc.importo_triennio_eur, 0)}): reti, linee e lavori diffusi che il Programma non assegna a una circoscrizione. Il primo vale da solo il ${it(100 * topSenza[0].importo_triennio_eur / tot.importo_triennio_eur, 0)}% del triennio.`),
      el('p', { class: 'nota' }, [el('a', { class: 'badge-link', href: elenco({ fonte: 'opere', circ: '__nessuna' }), text: `Tutti i ${nonLoc.interventi} interventi senza circoscrizione` })]));

    /* 3. in che anno cadono gli importi: quasi due terzi stanno nel 2028 */
    const anniOp = [['2026', tot.importo_2026_eur], ['2027', tot.importo_2027_eur], ['2028', tot.importo_2028_eur]];
    const quotaAnno = (v) => 100 * v / tot.importo_triennio_eur;
    $('opere-anni').replaceChildren(
      el('h3', { text: 'In che anno cadono gli importi' }),
      el('div', { class: 'anno-barra', 'aria-hidden': 'true' }, anniOp.map(([a, v]) => el('span', { class: 'anno-seg a' + a, style: `width:${quotaAnno(v)}%` }))),
      el('div', { class: 'anno-legenda' }, anniOp.map(([a, v]) => el('div', {}, [
        el('i', { class: 'a' + a }), el('span', { text: a }),
        el('span', { class: 'quota', text: mln(v, 0) }), el('b', { text: it(quotaAnno(v)) + '%' })]))),
      nota(`Il ${it(quotaAnno(tot.importo_2028_eur))}% dell'importo è programmato nel 2028: è la parte più lontana, e la più esposta ai cambiamenti del Programma. Il CUP, il codice che permette di seguire un'opera fino alla gara, c'è per ${tot.con_cup} interventi su ${tot.interventi}.`));

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
          riga('Quota della spesa ' + anno, pct(100 * mm['competenza_' + anno] / D.bil.totale_spese_competenza[anno], 1)),
          riga('Programmi con una previsione', `${prog.length} di ${Object.keys(mm.programmi).length}`),
        ]),
        el('h4', { text: 'Come cambia nel triennio' }),
        (() => {
          const maxM = Math.max(...anni.map(a => mm['competenza_' + a])) || 1;
          return el('div', { class: 'barre', role: 'list', style: 'max-width: 40rem' }, anni.map(a => el('div', { class: 'barra' + (a === anno ? ' anno-scelto' : ''), role: 'listitem' }, [
            el('div', { class: 'nome' }, [a, a === anno ? el('small', { text: "l'anno scelto qui sopra" }) : null]),
            el('div', { class: 'pista' }, [el('span', { class: 'riempi', style: `width:${100 * mm['competenza_' + a] / maxM}%` })]),
            el('div', { class: 'val', text: mln(mm['competenza_' + a], 1) })])));
        })(),
        el('p', { class: 'nota', text: 'Competenza di previsione per anno. La cassa è quella del solo 2026: per il 2027 e il 2028 il documento riporta la sola competenza.' }),
        el('h4', { text: `Programmi della missione nel ${anno}` }),
        prog.length
          ? el('ul', { class: 'programmi' }, prog.map(([pc, p]) => el('li', {}, [
            el('span', { class: 'cod', text: `${k}.${pc}` }),
            el('span', { class: 'nome', text: nome(p.nome) }),
            el('b', { text: mln(p['competenza_' + anno], 1) }),
            el('span', { class: 'pista', 'aria-hidden': 'true' }, [el('span', { class: 'riempi', style: `width:${100 * p['competenza_' + anno] / prog[0][1]['competenza_' + anno]}%` })])
          ])))
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

    /* il bilancio si legge da due parti: le missioni di spesa a sinistra, le entrate a destra */
    const ENT = D.bil.entrate, POP = D.bil.popolazione;
    const partiteGiro = (a) => D.bil.missioni['99'] ? D.bil.missioni['99']['competenza_' + a] : 0;
    const fondiAnno = (a) => ['fpv_spese_correnti', 'fpv_conto_capitale', 'avanzo_di_amministrazione'].reduce((s, k) => s + ENT.fondi[k][a], 0);
    const entrata = (cls, etichetta, nome, v, max) => el('div', { class: 'entrata ' + cls, role: 'listitem' }, [
      el('div', { class: 'et' }, [el('b', { text: etichetta }), nome]),
      el('div', { class: 'ev', text: mln(v, 1) }),
      el('div', { class: 'ep', 'aria-hidden': 'true' }, [el('span', { style: `width:${100 * v / max}%` })]),
    ]);

    /* 1. entrate per titolo: la facciata che manca quando si guardano solo le missioni */
    function disegnaEntrate() {
      const voci = Object.entries(ENT.titoli).map(([k, v]) => ({ k, nome: v.nome, v: v['competenza_' + anno] })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
      const fondi = fondiAnno(anno), max = Math.max(voci[0].v, fondi), ev = ENT.evidenza;
      $('bilancio-entrate').replaceChildren(
        el('h3', { text: 'Da dove arrivano i soldi nel ' + anno }),
        el('div', { class: 'entrate-righe', role: 'list', 'aria-label': 'Entrate per titolo, ' + anno }, [
          ...voci.map(x => entrata(x.k === '9' ? 'conto-terzi' : '', 'Titolo ' + x.k, x.nome, x.v, max)),
          fondi > 0 ? entrata('fondi', 'In più', 'Fondo pluriennale vincolato e avanzo di amministrazione', fondi, max) : null,
        ]),
        el('p', { class: 'nota' }, [
          'I titoli valgono ', el('b', { text: mln(ENT.totale_titoli[anno], 1) }), ', il fondo pluriennale vincolato e l\'avanzo aggiungono ', el('b', { text: mln(fondi, 1) }),
          ': in tutto ', el('b', { text: mln(ENT.totale_generale[anno], 1) }), ', lo stesso totale delle spese qui accanto. Entrate e spese, insomma, tornano al centesimo.',
        ]),
        el('p', { class: 'nota' }, anno === '2026'
          ? [`Il Comune prevede di accertare `, el('b', { text: mln(ev.proventi_da_controllo.competenza_2026, 1) }),
            ` da controllo e repressione delle irregolarità (contravvenzioni comprese) e di incassarne `, el('b', { text: mln(ev.proventi_da_controllo.cassa_2026, 1) }),
            `: ${it(ev.proventi_da_controllo.competenza_2026 / ev.proventi_da_controllo.cassa_2026, 1)} volte tanto. I contributi agli investimenti valgono `,
            el('b', { text: mln(ev.contributi_agli_investimenti.competenza_2026, 1) }), ' di competenza contro ',
            el('b', { text: mln(ev.contributi_agli_investimenti.cassa_2026, 1) }), ' di cassa: la differenza sono residui già impegnati e non ancora pagati, non spesa nuova.']
          : ['La cassa della fonte è quella del 2026: per gli anni successivi il documento riporta la sola competenza, quindi qui non si confronta con gli incassi.']),
      );
    }

    /* 2. quanta parte di quel totale è spesa vera, e quanto pesa su chi ci abita */
    function disegnaNetto() {
      const tot = D.bil.totale_spese_competenza[anno], pg = partiteGiro(anno), netto = tot - pg;
      const perAbitante = (pop) => it(netto / pop) + '\u00a0€';
      $('bilancio-netto').replaceChildren(
        el('h3', { text: 'La spesa che conta' }),
        el('dl', {}, [
          riga('Totale di competenza ' + anno, mln(tot, 1)),
          riga('Partite di giro, in entrata e in uscita', mln(pg, 1)),
          riga('Spesa che conta', mln(netto, 1)),
          riga('Per residente', perAbitante(POP.residenti_2024)),
        ]),
        el('p', { class: 'nota' }, [
          `Il ${it(100 * pg / tot)}% del totale sono partite di giro: incassi e pagamenti che il Comune fa per conto di altri e che si compensano, non servizi. Toglierle è il modo per leggere quanto spende davvero. Il pro capite divide per i `,
          el('b', { text: it(POP.residenti_2024) }), ` residenti della stima comunale 2024; con i `, el('b', { text: it(POP.residenti_censimento_2021) }),
          ` del censimento 2021 sarebbero ${perAbitante(POP.residenti_censimento_2021)}.`,
        ]),
      );
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
      disegnaEntrate(); disegnaNetto();
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

    /* la stessa voce letta in due modi: quanto pesa sull'importo e quanto sul numero di CIG.
       Le due barre stanno sulla stessa scala 0-100%, cosi` il confronto è immediato. */
    const confronto = (o) => {
      const box = el('div', { class: 'confronto' });
      o.righe.forEach(r => {
        const g = el('div', { class: 'confronto-gruppo', role: 'group' });
        g.setAttribute('aria-label', `${r.nome}: ${o.misure.map((m, k) => `${m.nome} ${pct(r.valori[k])}`).join(', ')}`);
        g.append(el('div', { class: 'nome' }, [el('b', { text: r.nome }), r.sub ? el('small', { text: r.sub }) : null]));
        o.misure.forEach((m, k) => {
          const q = Math.max(0, r.valori[k] || 0);
          g.append(el('div', { class: 'confronto-barra' + (k ? ' numero' : ''), title: `${m.nome}: ${pct(q)}` }, [
            el('span', { class: 'et', text: m.nome }),
            el('div', { class: 'pista' }, [el('span', { class: 'riempi', style: `width:${Math.max(0.6, q)}%` })]),
            el('span', { class: 'val', text: pct(q) }),
          ]));
        });
        box.append(g);
      });
      return box;
    };
    const bloccoConfronto = (titolo, nota, righe, misure) => el('div', {}, [
      el('h3', { text: titolo }), el('p', { class: 'nota', text: nota }), confronto({ righe, misure })]);

    const A25 = A['2025'], anomalo = A25.cig_con_importo_anomalo_non_corretti.length;
    const baseCig = `Importi a base di gara, non aggiudicati né pagati. ${it(A25.cig_senza_anomali)} CIG del 2025 con importo valido` +
      (anomalo ? `: esclusi ${it(anomalo)} CIG con un importo anomalo in fonte (circa 2.684 M€ ciascuno)` : '') + '.';
    $('appalti-grafici').replaceChildren(
      bloccoConfronto('Come è scelto il contraente (2025)',
        `${baseCig} Una quota alta di affidamenti diretti è la norma sotto le soglie di legge: non è da sola un'anomalia. Il confronto che conta è fra le due barre.`,
        A25.per_classe_procedura.map(r => ({ nome: r.voce, sub: `${it(r.cig)} CIG · ${mln(r.importo_eur, 1)}`, valori: [r.quota_importo_pct, r.quota_cig_pct] })),
        [{ nome: 'importo' }, { nome: 'CIG' }]),
      bloccoConfronto('In che fasce di importo (2025)',
        `Le fasce sono quelle delle soglie del codice degli appalti. Pochi contratti grandi fanno quasi tutto l'importo, molti contratti piccoli fanno quasi tutto il numero: sono due cose diverse e vanno lette insieme.`,
        A25.per_fascia_importo.map(r => ({ nome: r.voce, sub: `${it(r.cig)} CIG · ${mln(r.importo_eur, 1)}`, valori: [r.quota_importo_pct, r.quota_cig_pct] })),
        [{ nome: 'importo' }, { nome: 'CIG' }]),
    );
    $('appalti-limiti').replaceChildren(el('h3', { text: 'Cosa non misura' }), el('ul', {}, D.app.non_misura.map(t => el('li', { text: t }))));

    /* PNRR e coesione */
    $('progetti-lede').replaceChildren('Progetti del Comune finanziati dal PNRR e dalla politica di coesione europea e nazionale. Le due fonti non hanno la circoscrizione e non si sommano. Ogni progetto ha una scheda nell\'elenco, filtrato per fonte:', el('span', { class: 'badge-riga' }, [
      el('a', { class: 'badge-link', href: 'progetti.html?fonte=pnrr', text: 'Elenco dei progetti PNRR' }),
      el('a', { class: 'badge-link', href: 'progetti.html?fonte=coesione', text: 'Elenco dei progetti di coesione' })]));
    const bloccoSt = (titolo, grande, nota, righe, limiti, extra) => {
      const mx = righe && righe.length ? Math.max(...righe.map(r => r.n)) : 1;
      return el('div', {}, [el('h3', { text: titolo }), el('div', { class: 'grande', text: grande }), el('p', { class: 'nota', text: nota }),
        righe && righe.length ? el('div', { class: 'barre', role: 'list' }, righe.map(r => barra('', r.nome, r.sub, { n: r.n, max: mx, testo: r.testo }, {}, r.href))) : null,
        extra || null,
        el('div', { class: 'limiti' }, [el('h3', { text: 'Cosa non misura' }), el('ul', {}, limiti.map(t => el('li', { text: t })))])]);
    };
    const zero = (n) => n ? mln(n, 0) : '0 €';
    /* quanto è stato speso di quanto è stato stanziato: barra chiara = finanziato, barra piena = speso */
    const avanzamento = (titolo, nota, righe, etSpeso) => {
      const mx = Math.max(...righe.map(r => r.fin)) || 1;
      const box = el('div', { class: 'avanz' });
      righe.forEach(r => {
        const q = r.fin ? 100 * r.speso / r.fin : 0;
        const dentro = [
          el('div', { class: 'nome' }, [el('b', { text: r.nome }), el('small', { text: r.sub })]),
          el('div', { class: 'pista', title: `${r.nome}: ${etSpeso} ${mln(r.speso, 1)} su ${mln(r.fin, 1)} finanziati` }, [
            el('span', { class: 'fondo', style: `width:${100 * r.fin / mx}%` }),
            el('span', { class: 'riempi', style: `width:${Math.max(r.speso ? 0.4 : 0, 100 * r.speso / mx)}%` }),
          ]),
          el('div', { class: 'val' }, [pct(q), el('small', { text: `${zero(r.speso)} di ${zero(r.fin)}` })]),
        ];
        const etichetta = `${r.nome}: ${etSpeso} ${mln(r.speso, 1)} su ${mln(r.fin, 1)} finanziati, ${pct(q)}`;
        const riga = r.href
          ? el('a', { class: 'avanz-riga link', href: r.href, 'aria-label': etichetta + '. Apri l\'elenco filtrato', title: etichetta }, dentro)
          : el('div', { class: 'avanz-riga', 'aria-label': etichetta }, dentro);
        box.append(riga);
      });
      return el('div', { class: 'avanz-blocco' }, [
        el('h4', { class: 'avanz-titolo', text: titolo }),
        el('p', { class: 'nota', text: nota }), box,
        el('p', { class: 'nota', text: `Barra chiara: importo finanziato. Barra piena: ${etSpeso.toLowerCase()}. La scala è la stessa per tutte le righe.` }),
      ]);
    };
    const pn = D.pnrr;
    $('pnrr-blocco').replaceChildren(bloccoSt('PNRR', mln(pn.totale.importo_finanziato_eur, 0),
      `finanziati su ${pn.totale.progetti} progetti, ${mln(pn.totale.spesa_rendicontata_eur, 0)} rendicontati.`,
      null, pn.non_misura,
      avanzamento('Quanto è stato rendicontato',
        `La spesa rendicontata è quella che il Comune dichiara nella scheda del progetto, non un pagamento verificato da un terzo. Un progetto «in progettazione o gara» ha speso poco perché non è ancora partito, non perché i soldi siano spariti.`,
        pn.per_stato.map(s => ({ nome: s.voce.charAt(0).toUpperCase() + s.voce.slice(1), sub: `${s.progetti} progetti`, fin: s.importo_finanziato_eur, speso: s.spesa_rendicontata_eur, href: elenco({ fonte: 'pnrr', stato: s.voce }) }))
          .concat([{ nome: 'Tutti i 61 progetti', sub: 'somma delle schede', fin: pn.totale.importo_finanziato_eur, speso: pn.totale.spesa_rendicontata_eur, href: elenco({ fonte: 'pnrr' }) }]), 'Rendicontato')));
    const co = D.coe;
    const prog6 = co.per_programma.slice(0, 6);
    $('coesione-blocco').replaceChildren(bloccoSt('Coesione', mln(co.totale.finanziamento_pubblico_netto_eur, 0),
      `di finanziamento pubblico su ${co.totale.progetti} progetti con il Comune tra i beneficiari.`,
      null, co.non_misura,
      avanzamento('Quanto è stato pagato',
        `I pagamenti sono quelli certificati su OpenCoesione allo stesso 31/08/2026 del finanziamento. Una percentuale bassa può voler dire progetto appena avviato: è un dato di avanzamento, non un giudizio. Il programma con la percentuale più bassa è il POR FESR Sicilia, 152,1 M€ senza pagamenti.`,
        prog6.map(s => ({ nome: s.voce.split(':::')[0].slice(0, 40), sub: `${s.progetti} progetti`, fin: s.finanziamento_pubblico_netto_eur, speso: s.pagamenti_eur, href: elenco({ fonte: 'coesione', programma: s.voce.split(':::')[0] }) })), 'Pagato')));

    /* ---- singoli progetti sulla mappa ---- */
    const PREC = { pallino: 'letta sulla tavola, circa 3-10 m', etichetta: 'dall\'etichetta sulla tavola, circa 25-40 m', toponimo: 'ricavata dal nome del luogo, circa 300 m (approssimata)', da_poligono: 'centro di un poligono' };
    const gP = document.createElementNS(NS, 'g'); gP.setAttribute('id', 'progetti-g'); gP.setAttribute('hidden', ''); svg.append(gP);
    const nodi = {};   // id progetto -> elementi svg
    const swit = el('button', { type: 'button', role: 'switch', 'aria-checked': 'false', class: 'interruttore' }, [el('span', { class: 'pallino-sw' }), 'Mostra i singoli progetti']);
    /* interruttore dei progetti, ritorno alla città e filtri del territorio: una riga sola sopra la mappa */
    const controlli = $('controlli-mappa');
    controlli.prepend(swit);
    const tutta = el('button', { type: 'button', class: 'interruttore torna', hidden: true, text: 'Tutta la città' });
    controlli.insertBefore(tutta, controlli.children[1]);
    tutta.addEventListener('click', () => deseleziona());

    /* livello dei progetti: on/off, classi sul disegno, legenda e visibilità per circoscrizione */
    function statoProgetti(on) {
      layerOn = on;
      swit.setAttribute('aria-checked', String(on));
      svg.classList.toggle('con-progetti', on);
      gP.toggleAttribute('hidden', !on);
      aggiornaVisibilitaProgetti();
      allinea();
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
      });
      if (!PR) return;
      PR.progetti.forEach(pr => {
        const n = nodi[pr.id]; if (!n) return;
        const mostra = (!sel || pr.circoscrizioni.includes(sel))
          && (!selQ || (pr.quartieri || []).includes(selQ))
          && (!selU || (pr.upl || []).includes(selU));
        [...n.pol, ...n.lin, ...n.pt, ...n.hit].forEach(e => { e.style.display = mostra ? '' : 'none'; });
      });
    }
    /* accende il livello dei progetti: le posizioni si scaricano la prima volta che servono */
    function accendiProgetti() {
      const finito = () => { statoProgetti(true); zoomA(); scheda(); };
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
    /* l'inquadratura segue il livello più profondo scelto: UPL, poi quartiere, poi circoscrizione */
    function poligonoScelto() {
      if (selU && GU[selU]) return GU[selU];
      if (selQ && GQ[selQ] && !GQ[selQ].style.display) return GQ[selQ];
      if (sel && gruppi[sel]) return gruppi[sel].p;
      return null;
    }
    function zoomA(tutta) {
      if (!layerOn && !tutta) return;
      const p = tutta ? null : poligonoScelto();
      if (!p) vb = [0, 0, W, H];
      else { const b = p.getBBox(), m = Math.max(5, Math.min(24, Math.max(b.width, b.height) * 0.07)); vb = [b.x - m, b.y - m, b.width + 2 * m, b.height + 2 * m]; }
      svg.setAttribute('viewBox', vb.join(' ')); svg.style.setProperty('--ar', `${vb[2].toFixed(1)} / ${vb[3].toFixed(1)}`); ridimensiona();
    }
    function evidenziaProgetto() {
      gP.querySelectorAll('.sel').forEach(e => e.classList.remove('sel'));
      if (selProj && nodi[selProj]) { const n = nodi[selProj]; [...n.pol, ...n.lin, ...n.pt].forEach(e => { e.classList.add('sel'); e.parentNode.append(e); }); }
    }
    function apriProgetto(id) {
      location.href = 'progetto.html?id=' + encodeURIComponent('op-' + id);
    }
    function legendaProgetti() {
      const l = $('legenda'); l.querySelector('.leg-prog')?.remove();
      if (!layerOn) { l.querySelector('.leg-circ')?.remove(); return; }
      const voci = [el('i', { class: 'k pieno' }), ' posizione letta o dall\'etichetta  ', el('i', { class: 'k anello' }), ' approssimata (circa 300 m)  ', el('i', { class: 'k linea' }), ' linee e aree'];
      const n = (sel || selQ) && PR ? PR.progetti.filter(inTerritorio).length : null;
      if (n != null) voci.push(el('b', { class: 'leg-nota', text: `${selU ? 'UPL ' + selU : selQ ? 'Quartiere ' + selQ : 'Circoscrizione ' + sel}: ${it(n)} progetti disegnati` }));
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
        /* la circoscrizione porta all'elenco filtrato, come quartiere e UPL nella scheda completa */
        el('div', { class: 'riga' }, [el('dt', { text: 'Circoscrizione' }), el('dd', {}, [
          p.circoscrizioni.length === 1
            ? el('a', { href: 'progetti.html?circ=' + encodeURIComponent(p.circoscrizioni[0]), text: p.circoscrizioni[0] })
            : p.circoscrizioni.length ? p.circoscrizioni.join(', ') : 'non indicata'])]),
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

    /* i due menù portano all'elenco filtrato: la discesa territorio per territorio si fa lì */
    selQEl.addEventListener('change', e => {
      if (e.target.value) location.href = 'progetti.html?quartiere=' + encodeURIComponent(e.target.value);
    });
    selUEl.addEventListener('change', e => {
      if (e.target.value) location.href = 'progetti.html?upl=' + encodeURIComponent(e.target.value);
    });

    /* ---- quattro cifre di sintesi, nello spazio sotto la scheda (non si sommano: fonti e periodi diversi) ---- */
    const soldi = (n) => n >= 1e9 ? it(n / 1e9, 2) + ' mld €' : mln(n, 0);
    const appaltiTot = A['2025'].importo_base_gara_eur_senza_anomali + A['2026'].importo_base_gara_eur_senza_anomali;
    const cifra = (cls, nome, valori, nota, href) => el('a', { class: 'cifra-card ' + cls, href },
      [el('p', { class: 'cifra-card-nome', text: nome }),
       ...valori.map(v => el('p', { class: 'cifra-card-val' }, [v[0], v[1] ? el('span', { class: 'unita', text: ' ' + v[1] }) : null])),
       el('p', { class: 'cifra-card-nota', text: nota })]);
    $('cifre-apertura').replaceChildren(
      el('div', { class: 'cifre-elenco' }, [
        cifra('opere', 'Opere programmate 2026-2028', [[soldi(tot.importo_triennio_eur)]],
          `${it(tot.interventi)} interventi, il ${pct(100 * nonLoc.importo_triennio_eur / tot.importo_triennio_eur)} senza circoscrizione`, '#opere'),
        cifra('bilancio', 'Bilancio previsto 2026', [[soldi(D.bil.totale_spese_competenza['2026'])]],
          'competenza: previsione, non spesa', '#bilancio'),
        cifra('appalti', 'Appalti avviati 2025-2026', [[soldi(appaltiTot)]],
          `${it(A['2025'].cig + A['2026'].cig)} CIG a base di gara`, '#appalti'),
        cifra('fondi', 'PNRR e fondi di coesione', [
          [mln(pn.totale.importo_finanziato_eur, 1), 'PNRR'],
          [mln(co.totale.finanziamento_pubblico_netto_eur, 1), 'coesione']],
          `${pn.totale.progetti} progetti PNRR e ${co.totale.progetti} di coesione: fonti diverse, non si sommano`, '#progetti'),
      ]),
      el('p', { class: 'cifre-nota' }, ['Quattro cifre di fonti e periodi diversi: non si sommano e ognuna porta alla sua sezione. Cosa misurano e cosa no: ',
        el('a', { href: 'metodo.html', text: 'metodo e licenze' }), '.']),
    );

    colora(); allinea(); scheda();
    document.addEventListener('tema-cambia', colora);
    /* gli indirizzi della vecchia home con un territorio scelto portano alla pagina che lo contiene */
    const params = new URLSearchParams(location.search);
    const circDaUrl = params.get('circ'), qDaUrl = params.get('quartiere'), uDaUrl = params.get('upl');
    if (uDaUrl) location.replace('progetti.html?upl=' + encodeURIComponent(uDaUrl));
    else if (qDaUrl) location.replace('progetti.html?quartiere=' + encodeURIComponent(qDaUrl));
    else if (ROM.includes(circDaUrl)) location.replace(paginaCirc(circDaUrl));
  }
})();
