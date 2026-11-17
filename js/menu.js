/* Palermo in chiaro · il menù della testata.
   Fa tre cose, senza librerie:
   1. apre una tendina alla volta e la chiude con Esc, con un clic fuori o su una voce;
   2. segna con aria-current="page" la voce della pagina che si sta guardando, e se sta
      dentro una tendina la segna anche chiusa (data-corrente sul <details>);
   3. segna con aria-current="location" la voce che punta alla sezione che si sta leggendo:
      in testata solo le voci dirette, e le sezioni elencate in «In questa pagina». */
(() => {
  'use strict';
  const nav = document.querySelector('.testata nav.menu-principale')
    || document.querySelector('.testata nav:not(.briciole-testata)');
  if (!nav) return;

  const testata = document.querySelector('.testata');
  /* la briciola in testata: la pagina sta nel documento, la sezione che si legge
     la aggiunge questo file, così il percorso resta attaccato a ciò che si vede */
  const briciole = document.querySelector('.briciole-testata');
  const briciolaSezione = briciole && briciole.querySelector('[data-briciola-sezione]');
  /* l'altezza vera della testata serve a questa pagina e alle ancore del menù:
     cambia quando le voci vanno a capo su schermi stretti */
  if (testata) {
    const misura = () => document.documentElement.style.setProperty('--testata', testata.offsetHeight + 'px');
    misura();
    if (window.ResizeObserver) new ResizeObserver(misura).observe(testata);
  }

  /* ---------- 1. tendine ---------- */
  const tendine = [...nav.querySelectorAll('details.tendina')];
  const aggiornaAperta = () => nav.classList.toggle('aperta', tendine.some((t) => t.open));
  tendine.forEach((t) => {
    t.addEventListener('toggle', () => {
      if (t.open) tendine.forEach((o) => { if (o !== t) o.open = false; });
      aggiornaAperta();
    });
    t.addEventListener('click', (e) => { if (e.target.closest('a')) t.open = false; });
    /* la voce della pagina sta dentro la tendina: la tendina resta segnata anche chiusa */
    if (t.querySelector('[aria-current="page"]')) t.setAttribute('data-corrente', '');
  });
  document.addEventListener('pointerdown', (e) => {
    if (nav.contains(e.target)) return;
    tendine.forEach((t) => { t.open = false; });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    tendine.forEach((t) => { t.open = false; });
    nav.querySelectorAll('details.tendina > summary').forEach((s) => {
      if (s.closest('details').contains(document.activeElement)) s.focus();
    });
  });

  /* ---------- 2. e 3. la voce della pagina e la sezione che si legge ---------- */
  const normalizza = (p) => p.replace(/\/index\.html$/, '/');
  const qui = normalizza(location.pathname);
  const voci = [];

  const osserva = (a) => {
    const href = a.getAttribute('href') || '';
    const k = href.indexOf('#');
    if (k < 0 || href.slice(k + 1) === '') return;
    let u;
    try { u = new URL(href, location.href); } catch (err) { return; }
    if (normalizza(u.pathname) !== qui) return;
    const sezione = document.getElementById(decodeURIComponent(href.slice(k + 1)));
    if (!sezione) return;
    voci.push({ link: a, sezione });
  };
  nav.querySelectorAll("a[href]").forEach((a) => osserva(a));
  document.querySelectorAll('.nav-pagina a[href]').forEach((a) => osserva(a));
  if (!nav.querySelector('[aria-current="page"]')) {
    /* nessuna voce segnata a mano: si guarda se una voce porta a questa pagina intera
       (le voci con un'ancora sono sezioni, non la pagina) */
    nav.querySelectorAll('a[href]:not([href*="#"])').forEach((a) => {
      if (normalizza(new URL(a.getAttribute('href'), location.href).pathname) === qui) {
        a.setAttribute('aria-current', 'page');
        const t = a.closest('.tendina');
        if (t) t.setAttribute('data-corrente', '');
      }
    });
  }

  const aggiornaBriciola = (attiva) => {
    if (!briciolaSezione) return;
    const riga = briciolaSezione.closest('li');
    if (!attiva) {
      if (riga) riga.hidden = true;
      return;
    }
    briciolaSezione.textContent = attiva.link.textContent.trim();
    briciolaSezione.setAttribute('href', '#' + attiva.sezione.id);
    if (riga) riga.hidden = false;
  };

  if (voci.length) {
    const segna = (attiva) => {
      aggiornaBriciola(attiva);
      /* mentre si legge una sezione resta una sola voce sottolineata: quella della pagina
         perde il segno grafico ma tiene l'attributo, che dice ancora dove si è */
      if (attiva) nav.setAttribute('data-sezione', ''); else nav.removeAttribute('data-sezione');
      tendine.forEach((t) => t.removeAttribute('data-sezione'));
      if (attiva) {
        const dentro = attiva.link.closest('.tendina');
        if (dentro) dentro.setAttribute('data-sezione', '');
      }
      voci.forEach((v) => {
        if (v === attiva) v.link.setAttribute('aria-current', 'location');
        else if (v.link.getAttribute('aria-current') === 'location') v.link.removeAttribute('aria-current');
      });
    };

    /* la sezione conta quando il suo inizio è arrivato sotto la testata; i 40 px di
       tolleranza servono perché dopo un salto a #… l'ancora può fermarsi poco più giù */
    const soglia = () => 24 + (testata && getComputedStyle(testata).position === 'sticky' ? testata.offsetHeight : 0) + 40;

    let attesa = false;
    const calcola = () => {
      attesa = false;
      const linea = soglia();
      let attiva = null;
      voci.forEach((v) => {
        /* l'ultima sezione il cui inizio è passato sopra la linea; a fondo pagina
           vince comunque l'ultima, altrimenti un'ultima sezione bassa non si accende mai */
        if (v.sezione.getBoundingClientRect().top - linea <= 0) attiva = v;
      });
      const fondo = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      if (fondo) attiva = voci[voci.length - 1];
      /* in cima alla pagina non c'è ancora una sezione da segnare: vale la voce della pagina */
      if (window.scrollY <= 2 && !fondo) attiva = null;
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
  }
})();
