/* Palermo in chiaro · ricerca globale della testata.

   Un solo indice leggero (data/ricerca.json, costruito da scripts/build_ricerca.py)
   per pagine, sezioni, circoscrizioni, quartieri, UPL, argomenti e progetti.
   I suggerimenti partono dalle prime tre lettere o numeri: la ricerca non
   distingue maiuscole, accenti e punteggiatura, e tollera un errore di battitura.

   Il pulsante è nella testata di tutte le pagine. La finestra è un <dialog>
   modale: si apre con un clic, con «/» o con Ctrl/⌘+K, si chiude con Esc o
   toccando fuori. Nessuna libreria e nessuna chiamata di rete prima del primo
   uso: l'indice si scarica solo quando serve. */
(() => {
  'use strict';

  const BASE = (document.documentElement.dataset.base || './').replace(/\/?$/, '/');
  const U = (p) => (/^(?:[a-z]+:|\/|#)/i.test(p) ? p : BASE + p);

  /* Da dove si sta cercando: la scheda del progetto lo usa per il percorso. */
  function contesto() {
    const p = location.pathname;
    const m = p.match(/\/circoscrizione\/([1-8])\/?$/);
    if (m) return 'circoscrizione/' + m[1] + '/';
    if (/\/progetti\.html$/.test(p)) return 'progetti';
    if (/\/statistiche\.html$/.test(p)) return 'statistiche';
    if (/\/fonti\.html$/.test(p)) return 'fonti';
    if (/\/metodo\.html$/.test(p)) return 'metodo';
    if (/\/privacy\.html$/.test(p)) return 'privacy';
    if (/\/progetto\.html$/.test(p)) return new URLSearchParams(location.search).get('da');
    return 'home';
  }

  const MIN = 3;
  const MAX = 9;
  const PESO = { pagina: 320, circoscrizione: 260, quartiere: 220, upl: 180, argomento: 260, sezione: 300, progetto: 40 };
  const TIPI = {
    pagina: 'Pagina', sezione: 'In questa pagina', circoscrizione: 'Circoscrizione',
    quartiere: 'Quartiere', upl: 'UPL', argomento: 'Statistica', progetto: 'Progetto',
  };
  const SCORCIATOIE = [
    { t: 'pagina', n: 'Elenco progetti', u: 'progetti.html', d: 'Tutti i progetti e i finanziamenti' },
    { t: 'pagina', n: 'Statistiche', u: 'statistiche.html', d: 'Palermo, le circoscrizioni e gli argomenti' },
    { t: 'pagina', n: 'Circoscrizioni', u: 'index.html#mappa', d: 'La mappa delle 8 circoscrizioni' },
    { t: 'pagina', n: 'Fonti', u: 'fonti.html', d: 'Da dove vengono i numeri' },
  ];

  const el = (tag, attrs = {}, kids = []) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    }
    for (const c of [].concat(kids)) {
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return e;
  };

  const icona = (classe = '') => {
    const NS = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', classe);
    s.setAttribute('viewBox', '0 0 20 20');
    s.setAttribute('width', '16'); s.setAttribute('height', '16');
    s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', '8.5'); c.setAttribute('cy', '8.5'); c.setAttribute('r', '5.5');
    c.setAttribute('fill', 'none'); c.setAttribute('stroke', 'currentColor'); c.setAttribute('stroke-width', '2');
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', 'M12.6 12.6 17 17');
    p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '2'); p.setAttribute('stroke-linecap', 'round');
    s.append(c, p);
    return s;
  };

  /* normalizza per confrontare: minuscole, senza accenti, senza punteggiatura */
  const norm = (s) => String(s == null ? '' : s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  /* distanza di Levenshtein con taglio: serve solo a perdonare un refuso */
  function distanza(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 99;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let minimo = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < minimo) minimo = cur[j];
      }
      if (minimo > 2) return 99;
      prev = cur;
    }
    return prev[b.length];
  }

  function prepara(v) {
    const n = norm(v.n);
    const k = norm(v.k);
    return {
      ...v, nome: v.n, n, k,
      nc: n.replace(/ /g, ''), kc: k.replace(/ /g, ''),
      parole: [...new Set(n.split(' ').filter((w) => w.length > 1))].slice(0, 14),
    };
  }

  function punteggio(v, q, qc, gettoni) {
    const n = v.n, k = v.k;
    let s = 0;
    if (n === q || v.nc === qc) s += 1400;
    else if (n.startsWith(q)) s += 760;
    else if (v.parole.some((w) => w.startsWith(q))) s += 560;
    else if (n.includes(q)) s += 410;
    else if (qc && v.nc.startsWith(qc)) s += 240;

    if (k === q || v.kc === qc) s += 420;
    else if (k.split(' ').some((w) => w.startsWith(q))) s += 220;
    else if (k.includes(q)) s += 175;

    /* CUP, CUI e identificativi: una sequenza di lettere e numeri vale di più */
    if (qc.length >= 4 && v.kc.includes(qc)) s += 260;

    if (gettoni.length > 1 && gettoni.every((t) => n.includes(t) || k.includes(t))) s += 220;

    /* nessuna corrispondenza diretta: un solo refuso si perdona, ma solo su
       parole abbastanza lunghe (con tre lettere «bal» non deve pescare «al») */
    if (!s && q.length >= 4) {
      let d = 99;
      for (const w of v.parole) {
        if (w.length < 4) continue;
        const x = distanza(q, w);
        if (x < d) d = x;
        if (d === 0) break;
      }
      if (d === 1) s += 150;
      else if (d === 2 && q.length >= 6) s += 70;
    }
    return s ? s + (PESO[v.t] || 0) : 0;
  }

  const btn = document.querySelector('.cerca-apri') || creaPulsante();
  if (!btn) return;

  let finestra = null, input = null, lista = null, stato = null, azioni = null;
  let indice = null, caricamento = null, risultati = [], attivo = -1;

  function creaPulsante() {
    const testata = document.querySelector('.testata-in');
    if (!testata) return null;
    const b = el('button', {
      type: 'button', class: 'cerca-apri', 'aria-haspopup': 'dialog',
      'aria-controls': 'cerca-finestra', 'aria-expanded': 'false',
      title: 'Cerca in tutto il sito (premi /)',
    }, [icona('cerca-ico'), el('span', { class: 'cerca-apri-parola', text: 'Cerca' }), el('kbd', { class: 'cerca-tasto', 'aria-hidden': 'true', text: '/' })]);
    const marchio = testata.querySelector('.marchio');
    if (marchio) marchio.after(b); else testata.prepend(b);
    return b;
  }

  function creaFinestra() {
    finestra = el('dialog', {
      class: 'cerca-dialogo', id: 'cerca-finestra', 'aria-labelledby': 'cerca-titolo',
    });
    const dentro = el('div', { class: 'cerca-in' });
    input = el('input', {
      type: 'search', id: 'cerca-input', class: 'cerca-input',
      placeholder: 'Cerca un progetto, una circoscrizione, un quartiere, un dato…',
      autocomplete: 'off', spellcheck: 'false',
      role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'true',
      'aria-controls': 'cerca-risultati', 'aria-describedby': 'cerca-aiuto',
    });
    const chiudi = el('button', { type: 'button', class: 'cerca-chiudi', 'aria-label': 'Chiudi la ricerca' }, [
      el('span', { class: 'cerca-chiudi-parola', text: 'Chiudi' }), el('kbd', { 'aria-hidden': 'true', text: 'Esc' }),
    ]);
    const campo = el('div', { class: 'cerca-campo' }, [icona('cerca-ico'), input, chiudi]);
    stato = el('p', { class: 'cerca-stato', id: 'cerca-stato', role: 'status', 'aria-live': 'polite' });
    lista = el('ul', { class: 'cerca-risultati', id: 'cerca-risultati', role: 'listbox', 'aria-label': 'Suggerimenti' });
    azioni = el('div', { class: 'cerca-azioni' });
    const aiuto = el('p', { class: 'cerca-aiuto', id: 'cerca-aiuto' }, [
      'Bastano le prime tre lettere o numeri. ',
      el('kbd', { text: '↑' }), el('kbd', { text: '↓' }), ' per scegliere, ', el('kbd', { text: 'Invio' }), ' per aprire.',
    ]);
    dentro.append(
      el('h2', { class: 'solo-lettori', id: 'cerca-titolo', text: 'Cerca in Palermo in chiaro' }),
      campo, stato, lista, azioni, aiuto,
    );
    finestra.append(dentro);
    document.body.append(finestra);

    chiudi.addEventListener('click', chiudiFinestra);
    finestra.addEventListener('click', (e) => { if (e.target === finestra) chiudiFinestra(); });
    finestra.addEventListener('close', () => {
      btn.setAttribute('aria-expanded', 'false');
      input.setAttribute('aria-expanded', 'false');
      btn.focus({ preventScroll: true });
    });

    input.addEventListener('input', cerca);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); muovi(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); muovi(-1); }
      else if (e.key === 'Enter') {
        const scelta = risultati[attivo];
        if (scelta) { e.preventDefault(); vai(scelta.u); }
        else {
          const q = input.value.trim();
          if (q.length >= MIN) { e.preventDefault(); vai('progetti.html?q=' + encodeURIComponent(q)); }
        }
      }
    });
    return finestra;
  }

  function apri() {
    if (!finestra) creaFinestra();
    if (!finestra.open) finestra.showModal();
    btn.setAttribute('aria-expanded', 'true');
    input.value = '';
    cerca();
    requestAnimationFrame(() => input.focus());
    carica().then(() => { if (finestra.open) cerca(); }).catch(() => {});
  }

  function chiudiFinestra() {
    if (finestra && finestra.open) finestra.close();
    else btn.setAttribute('aria-expanded', 'false');
  }

  function vai(u) {
    chiudiFinestra();
    location.assign(U(u));
  }

  function carica() {
    if (indice) return Promise.resolve(indice);
    if (caricamento) return caricamento;
    if (stato) stato.textContent = 'Carico i suggerimenti…';
    caricamento = fetch(U('data/ricerca.json'), { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then((j) => {
        indice = (j.voci || j).map(prepara);
        return indice;
      })
      .catch((err) => {
        caricamento = null;
        if (stato) stato.textContent = 'L’indice della ricerca non si carica. Riprova tra poco.';
        console.error('ricerca:', err);
        throw err;
      });
    return caricamento;
  }

  function cerca() {
    if (!input || !lista) return;
    const q = input.value.trim();
    const nq = norm(q);

    azioni.replaceChildren();
    if (q) {
      azioni.append(el('a', {
        class: 'cerca-azione', href: U('progetti.html?q=' + encodeURIComponent(q)),
      }, ['Cerca «' + q + '» in tutti i progetti']));
    }

    if (nq.length < MIN) {
      stato.textContent = nq.length
        ? `Ancora ${MIN - nq.length === 1 ? 'un carattere' : (MIN - nq.length) + ' caratteri'} e ti suggerisco…`
        : 'Scrivi almeno tre lettere o numeri: i suggerimenti arrivano subito.';
      disegna(SCORCIATOIE, []);
      return;
    }

    if (!indice) {
      stato.textContent = 'Carico i suggerimenti…';
      lista.replaceChildren();
      attivo = -1;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      carica().then(() => { if (finestra.open) cerca(); }).catch(() => {});
      return;
    }

    const qc = nq.replace(/ /g, '');
    const gettoni = nq.split(' ').filter(Boolean);
    const trovati = [];
    for (const v of indice) {
      const s = punteggio(v, nq, qc, gettoni);
      if (s > 0) trovati.push({ v, s });
    }
    trovati.sort((a, b) => b.s - a.s || a.v.n.localeCompare(b.v.n, 'it'));

    /* varietà: i progetti possono riempire la lista, le sezioni no. Senza questo
       limite una ricerca come «ope» mostrava le otto circoscrizioni una sotto
       l'altra e nessun progetto. */
    const CAP_TIPO = { progetto: MAX, pagina: 3, sezione: 4, circoscrizione: 4, quartiere: 3, upl: 3, argomento: 2 };
    const CAP_FAMIGLIA = 2;
    const famiglia = (v) => v.u.startsWith('circoscrizione/') ? 'circoscrizione' : v.u.split('#')[0];
    const perTipo = {}, perFamiglia = {};
    const scelti = [];
    for (const { v } of trovati) {
      if ((perTipo[v.t] || 0) >= (CAP_TIPO[v.t] || 3)) continue;
      const fam = famiglia(v);
      if (v.t !== 'progetto' && (perFamiglia[fam] || 0) >= CAP_FAMIGLIA) continue;
      scelti.push(v);
      perTipo[v.t] = (perTipo[v.t] || 0) + 1;
      perFamiglia[fam] = (perFamiglia[fam] || 0) + 1;
      if (scelti.length >= MAX) break;
    }
    risultati = scelti;

    if (!risultati.length) {
      stato.textContent = `Nessun suggerimento per «${q}».`;
      lista.replaceChildren(el('li', { class: 'cerca-vuoto' }, [
        'Prova con meno parole, oppure cerca nell’elenco completo dei progetti qui sotto.',
      ]));
      attivo = -1;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      return;
    }
    stato.textContent = risultati.length === 1 ? 'Un suggerimento' : `${risultati.length} suggerimenti`;
    disegna(risultati, gettoni);
  }

  function disegna(voci, gettoni) {
    risultati = voci;
    const da = contesto();
    lista.replaceChildren(...voci.map((v, i) => {
      const href = v.t === 'progetto' && da ? v.u + '&da=' + encodeURIComponent(da) : v.u;
      const a = el('a', { href: U(href), tabindex: '-1' }, [
        el('span', { class: 'cerca-tipo', text: TIPI[v.t] || v.t }),
        el('span', { class: 'cerca-nome' }, evidenzia(v.nome || v.n || '', gettoni)),
        v.d ? el('span', { class: 'cerca-dove' }, evidenzia(v.d, gettoni)) : null,
      ]);
      const li = el('li', { class: 'cerca-voce', role: 'option', id: 'cerca-opzione-' + i, 'aria-selected': 'false' }, [a]);
      li.addEventListener('pointerenter', () => segna(i, false));
      a.addEventListener('click', () => chiudiFinestra());
      return li;
    }));
    input.setAttribute('aria-expanded', 'true');
    attivo = -1;
    if (voci.length) segna(0, false);
    else {
      input.removeAttribute('aria-activedescendant');
      input.setAttribute('aria-expanded', 'false');
    }
  }

  function segna(i, scorri = true) {
    const opzioni = lista.querySelectorAll('[role="option"]');
    attivo = Math.max(0, Math.min(i, opzioni.length - 1));
    opzioni.forEach((o, k) => o.setAttribute('aria-selected', String(k === attivo)));
    if (opzioni.length) {
      input.setAttribute('aria-activedescendant', opzioni[attivo].id);
      if (scorri) opzioni[attivo].scrollIntoView({ block: 'nearest' });
    }
  }

  function muovi(d) {
    if (!risultati.length) return;
    segna(attivo + d);
  }

  /* Evidenzia le lettere e i numeri cercati anche quando il testo ha accenti o
     maiuscole diverse: si confronta una copia normalizzata e si riportano le
     posizioni sul testo originale, così «citta» accende «città». */
  function mappaNormalizzata(testo) {
    const caratteri = [];
    const posizioni = [];
    for (let i = 0; i < testo.length; i++) {
      const base = testo[i].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      for (const ch of base) {
        caratteri.push(/[a-z0-9]/.test(ch) ? ch : ' ');
        posizioni.push(i);
      }
    }
    return { testo: caratteri.join(''), posizioni };
  }

  function evidenzia(testo, gettoni) {
    if (!testo) return [document.createTextNode('')];
    const validi = [...new Set(gettoni)].filter((t) => t.length >= 2).sort((a, b) => b.length - a.length);
    if (!validi.length) return [document.createTextNode(testo)];

    const { testo: piatto, posizioni } = mappaNormalizzata(testo);
    const pezzi = [];
    for (const t of validi) {
      let da = 0;
      while (true) {
        const i = piatto.indexOf(t, da);
        if (i < 0) break;
        pezzi.push([posizioni[i], posizioni[i + t.length - 1] + 1]);
        da = i + t.length;
      }
    }
    if (!pezzi.length) return [document.createTextNode(testo)];

    pezzi.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    const uniti = [];
    for (const [a, b] of pezzi) {
      const ultimo = uniti[uniti.length - 1];
      if (ultimo && a <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], b);
      else uniti.push([a, b]);
    }

    const nodi = [];
    let pos = 0;
    for (const [a, b] of uniti) {
      if (a > pos) nodi.push(document.createTextNode(testo.slice(pos, a)));
      nodi.push(el('mark', { text: testo.slice(a, b) }));
      pos = b;
    }
    if (pos < testo.length) nodi.push(document.createTextNode(testo.slice(pos)));
    return nodi;
  }

  btn.addEventListener('click', apri);
  btn.addEventListener('pointerenter', () => { carica().catch(() => {}); }, { once: true });
  btn.addEventListener('focus', () => { carica().catch(() => {}); }, { once: true });

  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const scrive = t && t.matches && t.matches('input, textarea, select, [contenteditable="true"]');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      apri();
      return;
    }
    if (e.key === '/' && !scrive && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      apri();
    }
  });
})();
