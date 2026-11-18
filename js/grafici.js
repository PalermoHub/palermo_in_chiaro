/* Palermo in chiaro · forme di grafico in più: ciambella e colonne
   Stesso stile delle barre del sito: SVG a mano, nessuna libreria, colori --s1…--s6.
   Ogni forma ha le etichette sul disegno (valore e quota) e il tooltip della pagina,
   che passa la propria funzione conTip(nodo, titolo, righe). */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const num = (n, d = 1) => Number(n).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
  const S = (tag, a = {}) => { const e = document.createElementNS(NS, tag); for (const k in a) if (a[k] != null) e.setAttribute(k, a[k]); return e; };
  const H = (tag, a = {}, kids = []) => {
    const e = document.createElement(tag);
    for (const k in a) if (a[k] != null) { if (k === 'text') e.textContent = a[k]; else e.setAttribute(k, a[k]); }
    [].concat(kids).forEach((c) => { if (c != null) e.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return e;
  };
  /* dal più scuro al più chiaro: la fetta più grande ha il colore più forte */
  const ORDINE = ['--s6', '--s5', '--s4', '--s3', '--s2', '--s1'];

  function ciambella(host, { voci, formatta, centro = null, conTip = null, nome = 'Composizione' }) {
    const v = voci.filter((x) => x.val > 0);
    const tot = v.reduce((s, x) => s + x.val, 0) || 1;
    const R = 92, r = 56, C = 110;
    const svg = S('svg', { viewBox: '0 0 220 220', class: 'ciambella', role: 'img' });
    svg.setAttribute('aria-label', `${nome}: ` + v.map((x) => `${x.nome} ${formatta(x.val)} (${num(100 * x.val / tot)}%)`).join('; '));
    let a0 = -Math.PI / 2;
    const punto = (ang, rag) => [C + rag * Math.cos(ang), C + rag * Math.sin(ang)];
    const fette = [];
    v.forEach((x, i) => {
      const q = x.val / tot;
      const colore = ORDINE[Math.min(i, ORDINE.length - 1)];
      const a1 = a0 + q * 2 * Math.PI - (v.length > 1 ? 0.012 : 0);
      let d;
      if (v.length === 1) {
        d = `M${C} ${C - R}A${R} ${R} 0 1 1 ${C - 0.01} ${C - R}Z M${C} ${C - r}A${r} ${r} 0 1 0 ${C - 0.01} ${C - r}Z`;
      } else {
        const [x0, y0] = punto(a0, R), [x1, y1] = punto(a1, R), [x2, y2] = punto(a1, r), [x3, y3] = punto(a0, r);
        const g = q > 0.5 ? 1 : 0;
        d = `M${x0} ${y0}A${R} ${R} 0 ${g} 1 ${x1} ${y1}L${x2} ${y2}A${r} ${r} 0 ${g} 0 ${x3} ${y3}Z`;
      }
      const p = S('path', { d, class: 'fetta', 'fill-rule': 'evenodd', style: `fill:var(${colore})`, tabindex: '0' });
      p.setAttribute('aria-label', `${x.nome}: ${formatta(x.val)}, ${num(100 * q)}%`);
      if (conTip) conTip(p, x.nome, [['Valore', formatta(x.val)], ['Quota', num(100 * q) + '%'], x.sub ? ['Dettaglio', x.sub] : null]);
      svg.append(p);
      fette.push({ p, colore, q, am: (a0 + a1) / 2 });
      a0 += q * 2 * Math.PI;
    });
    /* quota sulla fetta, solo dove ci sta */
    fette.forEach((f) => {
      if (f.q < 0.06) return;
      const [tx, ty] = punto(f.am, (R + r) / 2);
      const chiaro = f.colore === '--s5' || f.colore === '--s6' ? 'd5' : f.colore === '--s4' ? 'd4' : '';
      const t = S('text', { x: tx, y: ty + 4, 'text-anchor': 'middle', class: 'cia-lab ' + chiaro, 'aria-hidden': 'true' });
      t.textContent = num(100 * f.q, f.q < 0.1 ? 1 : 0) + '%';
      svg.append(t);
    });
    if (centro) {
      const t1 = S('text', { x: C, y: C - 2, 'text-anchor': 'middle', class: 'cia-centro', 'aria-hidden': 'true' });
      t1.textContent = centro.valore;
      const t2 = S('text', { x: C, y: C + 15, 'text-anchor': 'middle', class: 'cia-sotto', 'aria-hidden': 'true' });
      t2.textContent = centro.etichetta;
      svg.append(t1, t2);
    }
    const legenda = H('ul', { class: 'cia-legenda' }, v.map((x, i) => H('li', {}, [
      H('span', { class: 'pastiglia', style: `background:var(${ORDINE[Math.min(i, ORDINE.length - 1)]})` }),
      H('span', { class: 'cia-nome' }, [H('b', { text: x.nome }), x.sub ? H('small', { text: x.sub }) : null]),
      H('span', { class: 'cia-val' }, [H('b', { text: formatta(x.val) }), H('small', { text: num(100 * x.val / tot) + '%' })]),
    ])));
    host.append(H('div', { class: 'cia-box' }, [svg, legenda]));
  }

  function colonne(host, { voci, formatta, conTip = null, nome = 'Colonne', evidenzia = null }) {
    const n = voci.length;
    const mx = Math.max(...voci.map((x) => x.val || 0)) || 1;
    const larg = 62, W = Math.max(n * larg + 16, 340), x0 = (W - n * larg) / 2, top = 26, h = 150, bot = 30;
    const svg = S('svg', { viewBox: `0 0 ${W} ${top + h + bot}`, class: 'colonne', role: 'img' });
    svg.style.minWidth = Math.min(Math.max(280, n * 52), 760) + 'px';
    svg.style.maxWidth = Math.max(420, n * 78) + 'px';
    svg.setAttribute('aria-label', `${nome}: ` + voci.map((x) => `${x.nome} ${formatta(x.val)}`).join('; '));
    svg.append(S('line', { x1: x0, x2: W - x0, y1: top + h, y2: top + h, class: 'col-asse' }));
    voci.forEach((x, i) => {
      const bw = larg - 22, bx = x0 + i * larg + 11;
      const bh = Math.max(1.5, h * (x.val || 0) / mx);
      const g = S('g', { class: 'col' + (x.nome === evidenzia ? ' scelta' : ''), tabindex: '0' });
      g.setAttribute('aria-label', `${x.nome}: ${formatta(x.val)}${x.sub ? ', ' + x.sub : ''}`);
      g.append(S('rect', { x: bx, y: top + h - bh, width: bw, height: bh, rx: 1.5, class: 'col-barra' }));
      const v = S('text', { x: bx + bw / 2, y: top + h - bh - 6, 'text-anchor': 'middle', class: 'col-val', 'aria-hidden': 'true' });
      v.textContent = formatta(x.val);
      const l = S('text', { x: bx + bw / 2, y: top + h + 17, 'text-anchor': 'middle', class: 'col-nome', 'aria-hidden': 'true' });
      l.textContent = x.nome;
      g.append(v, l, S('rect', { x: bx - 11, y: 0, width: larg, height: top + h + bot, fill: 'transparent' }));
      if (conTip) conTip(g, x.nome, [['Valore', formatta(x.val)], x.sub ? ['Dettaglio', x.sub] : null]);
      svg.append(g);
    });
    host.append(H('div', { class: 'col-scroll' }, svg));
  }

  /* una riga per misura: un punto per unità, la tacca della media.
     Con `scelta` una unità è in evidenza e la riga dice la sua posizione («4ª su 8»);
     senza, tutte sono uguali e la riga dice il valore più alto, il più basso e la media.
     `apri(id)` rende i punti cliccabili. `mediaNome` è la parola per la tacca. */
  function strisce(host, { righe, scelta = null, conTip = null, nota = '', apri = null, mediaNome = 'media delle 8' }) {
    const box = H('div', { class: 'strisce' });
    box.append(H('div', { class: 'str-leg' }, [
      scelta ? H('span', {}, [H('i', { class: 'p-scelto' }), 'questa circoscrizione']) : null,
      H('span', {}, scelta ? [H('i', { class: 'p-altro' }), 'le altre'] : [H('i', { class: 'p-tutte', text: 'VII' }), 'il numero romano è la circoscrizione']),
      H('span', {}, [H('i', { class: 'p-media' }), mediaNome]),
    ]));
    righe.forEach((r) => {
      const mx = Math.max(...r.punti.map((p) => p.val), r.media || 0) || 1;
      const pos = (v) => Math.min(100, Math.max(0, 100 * v / mx));
      const pista = H('div', { class: 'str-pista' + (scelta ? '' : ' alta') });
      /* senza unità scelta i punti portano il numero: quelli vicini si dispongono su tre file */
      const fila = new Map(), ultimo = [-99, -99, -99];
      if (!scelta) r.punti.slice().sort((a, b) => a.val - b.val).forEach((p) => {
        let k = ultimo.findIndex((u) => pos(p.val) - u >= 3.6);
        if (k < 0) k = ultimo.indexOf(Math.min(...ultimo));
        ultimo[k] = pos(p.val); fila.set(p.id, k);
      });
      const DY = [0, -15, 15];
      r.punti.forEach((p) => {
        const d = H('i', { class: p.id === scelta ? 'p-scelto' : (scelta ? 'p-altro' : 'p-tutte') + (apri ? ' clic' : ''),
          style: `left:${pos(p.val)}%` + (scelta ? '' : `;margin-top:${DY[fila.get(p.id)]}px`), text: scelta ? null : p.id });
        if (!conTip) d.setAttribute('title', `${p.nome}: ${r.formatta(p.val)}`);
        if (conTip) conTip(d, p.nome, [['Valore', r.formatta(p.val)], ['Misura', r.nome], apri ? ['Clic', 'apri la scheda'] : null]);
        if (apri) d.addEventListener('click', () => apri(p.id));
        pista.append(d);
      });
      if (r.media != null) pista.append(H('i', { class: 'p-media', style: `left:${pos(r.media)}%` }));
      let val, sub;
      const mediaTxt = r.media != null ? (mediaNome === 'media delle 8' ? 'media ' : mediaNome + ' ') + r.formatta(r.media) : '';
      if (scelta) {
        const q = r.punti.find((p) => p.id === scelta);
        const posiz = 1 + r.punti.filter((p) => p.val > q.val + 1e-6).length;
        val = r.formatta(q.val); sub = `${mediaTxt} · ${posiz}ª su ${r.punti.length}`;
      } else {
        const ord = r.punti.slice().sort((a, b) => b.val - a.val);
        val = `${r.formatta(ord[0].val)} · ${ord[0].nome}`;
        sub = `più basso ${r.formatta(ord[ord.length - 1].val)} · ${ord[ord.length - 1].nome}${mediaTxt ? ' · ' + mediaTxt : ''}`;
      }
      const riga = H('div', { class: 'str-riga', role: 'group' }, [
        H('div', { class: 'str-nome' }, [H('b', { text: r.nome }), r.sub ? H('small', { text: r.sub }) : null]),
        pista,
        H('div', { class: 'str-val' }, [H('b', { text: val }), H('small', { text: sub })]),
      ]);
      riga.setAttribute('aria-label', `${r.nome}: ${val}; ${sub}`);
      box.append(riga);
    });
    if (nota) box.append(H('p', { class: 'grafico-nota sotto', text: nota }));
    host.append(box);
  }


  /* tabella a colori: una riga per unità, una colonna per misura, il numero in ogni cella.
     Il colore va dal più basso al più alto di ciascuna colonna (scala propria). */
  function calore(host, { righe, colonne, apri = null, mediaNome = 'Media' }) {
    const sc = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6'];
    const t = H('table', { class: 'calore' });
    t.append(H('thead', {}, H('tr', {}, [H('th', { scope: 'col', text: 'Circoscrizione' })].concat(colonne.map((c) =>
      H('th', { scope: 'col', class: 'num' }, [H('span', { text: c.nome }), c.sub ? H('small', { text: c.sub }) : null]))))));
    const corpo = H('tbody');
    const lim = colonne.map((c) => { const v = righe.map((r) => c.valori[r]); return [Math.min(...v), Math.max(...v)]; });
    righe.forEach((r) => {
      const tr = H('tr', { class: apri ? 'clic' : null });
      tr.append(H('th', { scope: 'row' }, apri ? H('a', { href: apri(r), text: 'Circ. ' + r }) : 'Circ. ' + r));
      colonne.forEach((c, k) => {
        const v = c.valori[r], [mn, mx] = lim[k];
        const b = mx > mn ? Math.min(5, Math.floor(6 * (v - mn) / (mx - mn))) : 2;
        const cls = 'num cal-' + (b + 1);
        const td = H('td', { class: cls, style: `background:var(${sc[b]})`, text: c.formatta(v) });
        td.setAttribute('title', `Circ. ${r} · ${c.nome}: ${c.formatta(v)}${v === mx ? ' (il più alto)' : v === mn ? ' (il più basso)' : ''}`);
        tr.append(td);
      });
      corpo.append(tr);
    });
    t.append(corpo);
    t.append(H('tfoot', {}, H('tr', {}, [H('th', { scope: 'row', text: mediaNome })].concat(colonne.map((c) =>
      H('td', { class: 'num', text: c.media != null ? c.formatta(c.media) : '' }))))));
    const leg = H('div', { class: 'cal-leg' }, [H('span', { text: 'più basso' })].concat(sc.map((x) => H('i', { style: `background:var(${x})` })), [H('span', { text: 'più alto' })]));
    host.append(H('div', { class: 'cal-scroll' }, t), leg);
  }

  window.GraficiPIC = { ciambella, colonne, strisce, calore };
})();
