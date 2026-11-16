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
    return el('article', { class: 'voce' }, [
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
    $('elenco').replaceChildren(...mostra.map(voce));
    const n = r.length;
    $('conteggio').textContent = n === 0
      ? 'Nessun progetto con questi filtri.'
      : `${it(Math.min(stato.limite, n))} di ${it(n)} voci${n !== D.progetti.length ? ` (su ${it(D.progetti.length)} totali)` : ''}. Un progetto può comparire in più fonti: gli importi restano separati e non si sommano.`;
    $('altri').hidden = n <= stato.limite;
    $('altri').textContent = `Mostra altri ${it(Math.min(30, n - stato.limite))}`;
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
      const qs = p.toString();
      try { history.replaceState(null, '', (qs ? '?' + qs : location.pathname) + location.hash); } catch (e) { /* file:// */ }
    };
    $('q').addEventListener('input', e => { stato.q = e.target.value; aggiorna(); });
    $('fonte').addEventListener('change', e => { stato.fonte = e.target.value; aggiorna(); });
    $('circ').addEventListener('change', e => { stato.circ = e.target.value; aggiorna(); });
    $('ordine').addEventListener('change', e => { stato.ordine = e.target.value; aggiorna(); });
    $('incroci').addEventListener('change', e => { stato.incroci = e.target.checked; aggiorna(); });
    $('altri').addEventListener('click', () => { stato.limite += 30; disegna(); });
    disegna();

    const params = new URLSearchParams(location.search);
    if (params.get('fonte')) { $('fonte').value = params.get('fonte'); stato.fonte = params.get('fonte'); }
    if (params.get('circ')) { $('circ').value = params.get('circ'); stato.circ = params.get('circ'); }
    if (params.get('q')) { $('q').value = params.get('q'); stato.q = params.get('q'); }
    if (params.get('stato')) stato.stato = params.get('stato');
    if (params.get('programma')) stato.programma = params.get('programma');
    if (stato.fonte || stato.circ || stato.q || stato.stato || stato.programma) aggiorna();
    chips();

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
