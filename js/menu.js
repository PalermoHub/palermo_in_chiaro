/* Palermo in chiaro · il menù della testata segna anche la sezione che si sta leggendo.
   Le voci che puntano a un'ancora della stessa pagina prendono aria-current="location"
   quando la loro sezione arriva sotto la testata; la voce della pagina resta
   aria-current="page". Nessuna libreria, nessuna osservazione continua: si ricalcola
   a ogni fotogramma di scorrimento e quando cambia la dimensione della finestra. */
(() => {
  'use strict';
  const nav = document.querySelector('.testata nav');
  if (!nav) return;

  const testata = document.querySelector('.testata');
  /* l'altezza vera della testata serve a questa pagina e alle ancore del menù:
     cambia quando le voci vanno a capo su schermi stretti */
  if (testata) {
    const misura = () => document.documentElement.style.setProperty('--testata', testata.offsetHeight + 'px');
    misura();
    if (window.ResizeObserver) new ResizeObserver(misura).observe(testata);
  }
  const normalizza = (p) => p.replace(/\/index\.html$/, '/');
  const qui = normalizza(location.pathname);

  /* solo le ancore della pagina che si sta guardando: quelle verso altre pagine
     (per esempio ../../index.html#opere da una circoscrizione) restano fuori */
  const voci = [];
  nav.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    const k = href.indexOf('#');
    if (k < 0 || href.slice(k + 1) === '') return;
    let u;
    try { u = new URL(href, location.href); } catch (e) { return; }
    if (normalizza(u.pathname) !== qui) return;
    const sezione = document.getElementById(decodeURIComponent(href.slice(k + 1)));
    if (!sezione) return;
    voci.push({ link: a, sezione });
  });
  if (!voci.length) return;

  const segna = (attiva) => {
    /* mentre si legge una sezione resta una sola voce sottolineata: quella della pagina
       perde il segno grafico ma tiene l'attributo, che dice ancora dove si è */
    if (attiva) nav.setAttribute('data-sezione', ''); else nav.removeAttribute('data-sezione');
    voci.forEach((v) => {
      const corrente = v === attiva;
      if (corrente) v.link.setAttribute('aria-current', 'location');
      else if (v.link.getAttribute('aria-current') === 'location') v.link.removeAttribute('aria-current');
    });
  };

  const soglia = () => 24 + (testata && getComputedStyle(testata).position === 'sticky' ? testata.offsetHeight : 0);

  let attesa = false;
  const calcola = () => {
    attesa = false;
    const linea = soglia();
    let attiva = null;
    voci.forEach((v) => {
      /* l'ultima sezione il cui inizio è passato sopra la linea; a fondo pagina
         vince comunque l'ultima, altrimenti un'ultima sezione bassa non si accende mai */
      const top = v.sezione.getBoundingClientRect().top;
      if (top - linea <= 0) attiva = v;
    });
    const fondo = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    if (fondo) attiva = voci[voci.length - 1];
    segna(attiva);
  };
  const chiedi = () => { if (!attesa) { attesa = true; requestAnimationFrame(calcola); } };

  addEventListener('scroll', chiedi, { passive: true });
  addEventListener('resize', chiedi);
  addEventListener('load', chiedi);
  addEventListener('hashchange', chiedi);
  /* i grafici si disegnano dopo: quando la pagina cambia altezza l'ancora non è
     più dove era, e senza uno scorrimento nessun evento lo direbbe */
  if (window.ResizeObserver) new ResizeObserver(chiedi).observe(document.body);
  calcola();
})();
