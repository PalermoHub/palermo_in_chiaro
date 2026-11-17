/* Galleria degli screenshot della guida: le immagini di cui parla guida.html si
   aprono una alla volta, a tutta finestra, con le frecce per passare alla
   successiva. Senza JavaScript i collegamenti restano quelli del documento e
   aprono il file .webp in una nuova scheda, quindi la guida funziona lo stesso.
   Il <dialog> modale mette la finestra sopra tutto, blocca il resto della pagina
   e riporta il fuoco sul collegamento quando si chiude. */
(() => {
  'use strict';

  const el = (tag, attrs = {}, kids = []) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    }
    for (const c of [].concat(kids)) if (c != null && c !== '') e.append(c);
    return e;
  };

  const link = [...document.querySelectorAll('.guida-figura-link')].filter((a) => a.querySelector('img'));
  if (!link.length) return;

  const voci = link.map((a) => {
    const img = a.querySelector('img');
    const fig = a.closest('figure');
    const didascalia = fig && fig.querySelector('figcaption');
    return {
      src: a.getAttribute('href'),
      alt: img.getAttribute('alt') || '',
      testo: didascalia ? didascalia.textContent.trim() : '',
    };
  });

  let finestra = null;
  let indice = 0;
  let partenza = null;
  let immagine, didascalia, contatore, prev, next;

  const freccia = (classe, punti) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', '22');
    s.setAttribute('height', '22');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    s.setAttribute('class', 'galleria-ico');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    p.setAttribute('points', punti);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '2');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    s.append(p);
    s.setAttribute('class', 'galleria-ico ' + classe);
    return s;
  };

  function costruisci() {
    finestra = el('dialog', { class: 'galleria', id: 'galleria', 'aria-label': 'Screenshot della guida' });

    contatore = el('p', { class: 'galleria-contatore', role: 'status', 'aria-live': 'polite' });
    const chiudi = el('button', { type: 'button', class: 'galleria-chiudi', 'aria-label': 'Chiudi la galleria' }, [
      'Chiudi', el('kbd', { class: 'galleria-tasto', 'aria-hidden': 'true', text: 'Esc' }),
    ]);
    const testa = el('div', { class: 'galleria-testa' }, [contatore, chiudi]);

    immagine = el('img', { class: 'galleria-img', alt: '' });
    prev = el('button', { type: 'button', class: 'galleria-freccia galleria-prev', 'aria-label': 'Screenshot precedente' }, [freccia('galleria-prev-ico', '15 5 8 12 15 19')]);
    next = el('button', { type: 'button', class: 'galleria-freccia galleria-next', 'aria-label': 'Screenshot successivo' }, [freccia('galleria-next-ico', '9 5 16 12 9 19')]);
    const palco = el('div', { class: 'galleria-palco' }, [immagine, prev, next]);

    didascalia = el('figcaption', { class: 'galleria-piede' });

    const dentro = el('div', { class: 'galleria-in' }, [
      testa, palco, el('figure', { class: 'galleria-figura' }, [didascalia]),
    ]);
    finestra.append(dentro);
    document.body.append(finestra);

    chiudi.addEventListener('click', chiudiGalleria);
    prev.addEventListener('click', () => mostra(indice - 1));
    next.addEventListener('click', () => mostra(indice + 1));
    /* clic sullo sfondo (fuori dal contenuto) chiude */
    finestra.addEventListener('click', (e) => { if (e.target === finestra) chiudiGalleria(); });

    finestra.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); mostra(indice - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); mostra(indice + 1); }
    });

    /* scorrimento orizzontale col dito: oltre 40 px cambia immagine */
    let x0 = null;
    palco.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    palco.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) < 40) return;
      mostra(dx < 0 ? indice + 1 : indice - 1);
    });
    palco.addEventListener('pointercancel', () => { x0 = null; });

    finestra.addEventListener('close', () => {
      document.body.classList.remove('galleria-aperta');
      if (partenza && document.contains(partenza)) partenza.focus({ preventScroll: true });
    });
  }

  function mostra(i) {
    indice = (i + voci.length) % voci.length;
    const v = voci[indice];
    immagine.src = v.src;
    immagine.alt = v.alt;
    didascalia.textContent = v.testo;
    contatore.textContent = `${indice + 1} di ${voci.length}`;
    /* le immagini vicine si scaricano durante la lettura della prima */
    [voci[indice + 1], voci[indice - 1]].forEach((n) => {
      if (n) { const pre = new Image(); pre.src = n.src; }
    });
    if (finestra.classList.contains('senza-modale')) prev.focus({ preventScroll: true });
  }

  function apri(i, origine) {
    if (!finestra) costruisci();
    partenza = origine || null;
    document.body.classList.add('galleria-aperta');
    mostra(i);
    if (typeof finestra.showModal === 'function') finestra.showModal();
    else {
      finestra.setAttribute('open', '');
      finestra.classList.add('senza-modale');
    }
    requestAnimationFrame(() => prev.focus({ preventScroll: true }));
  }

  function chiudiGalleria() {
    if (!finestra) return;
    if (typeof finestra.close === 'function' && finestra.open) finestra.close();
    else {
      finestra.removeAttribute('open');
      document.body.classList.remove('galleria-aperta');
      if (partenza && document.contains(partenza)) partenza.focus({ preventScroll: true });
    }
  }

  link.forEach((a, i) => {
    a.setAttribute('aria-haspopup', 'dialog');
    a.addEventListener('click', (e) => {
      /* tasto centrale o modificatori: si lascia fare al browser */
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      apri(i, a);
    });
  });
})();
