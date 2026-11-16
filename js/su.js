/* «Torna in cima»: un pulsante uguale in tutte le pagine. Compare dopo una schermata
   di scorrimento e riporta in cima, senza animazione se l'utente l'ha chiesto. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const ridotto = matchMedia('(prefers-reduced-motion: reduce)');

  function costruisci() {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'su';
    b.hidden = true;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('width', '14'); svg.setAttribute('height', '14');
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', 'M8 13V3M3.5 7.5 8 3l4.5 4.5');
    p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '2'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
    svg.append(p);
    b.append(svg, document.createTextNode('Torna in cima'));
    return b;
  }

  function avvia() {
    if (document.querySelector('.su')) return;
    const b = costruisci();
    document.body.append(b);

    const mostra = () => { b.hidden = window.scrollY < window.innerHeight * 0.8; };
    addEventListener('scroll', mostra, { passive: true });
    addEventListener('resize', mostra, { passive: true });
    mostra();

    b.addEventListener('click', () => {
      scrollTo({ top: 0, behavior: ridotto.matches ? 'auto' : 'smooth' });
      const marchio = document.querySelector('.marchio');
      if (marchio) marchio.focus({ preventScroll: true });
      else document.querySelector('h1')?.focus?.({ preventScroll: true });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia);
  else avvia();
})();
