/* Palermo in chiaro · la barra in basso dei telefoni.

   Sotto i 901 px il menù delle sezioni è questa barra (il menù della testata
   sparisce per CSS). Il file fa quattro cose, senza librerie:
   1. segna con aria-current="page" la voce della pagina che si sta guardando e,
      dentro il foglio delle otto, la circoscrizione aperta;
   2. apre e chiude i due fogli che salgono da sotto (le 8 circoscrizioni, le voci
      secondarie) come <dialog> modali: Esc, clic sul fondo e sul pulsante Chiudi
      sono quelli del browser, qui si aggiungono lo stato di aria-expanded e il
      blocco dello scorrimento dietro;
   3. sulla home la voce Mappa riporta in cima invece di ricaricare l'ancora;
   4. se lo schermo si allarga oltre i 900 px il foglio aperto si chiude. */
(() => {
  'use strict';
  const barra = document.querySelector('.barra-basso');
  if (!barra) return;

  const ridotto = matchMedia('(prefers-reduced-motion: reduce)');
  const stretto = matchMedia('(max-width: 900px)');

  /* ---------- 1. dove si è ---------- */
  const CHIAVE = [
    [/\/circoscrizione\/[1-8]\/?$/, 'territorio'],
    [/\/(?:progetti|progetto)\.html$/, 'progetti'],
    [/\/statistiche\.html$/, 'statistiche'],
    [/\/(?:fonti|metodo|guida|privacy)\.html$/, 'altro'],
    [/(?:\/|\/index\.html)$/, 'mappa'],
  ];
  const chiave = () => {
    const trovata = CHIAVE.find(([re]) => re.test(location.pathname));
    return trovata ? trovata[1] : null;
  };

  const corrente = chiave();
  const voce = corrente && barra.querySelector('[data-barra="' + corrente + '"]');
  if (voce) voce.setAttribute('aria-current', 'page');

  const circ = location.pathname.match(/\/circoscrizione\/([1-8])\/?$/);
  if (circ) {
    const dentro = document.querySelector('.foglio-otto a[data-circ="' + circ[1] + '"]');
    if (dentro) dentro.setAttribute('aria-current', 'page');
  }

  /* ---------- 2. i fogli ---------- */
  const fogli = [...document.querySelectorAll('.foglio')];
  const chiudi = (f) => { if (f && f.open) f.close(); };
  const chiudiTutti = () => fogli.forEach(chiudi);

  fogli.forEach((f) => {
    const bottone = barra.querySelector('[aria-controls="' + f.id + '"]');

    f.addEventListener('click', (e) => {
      /* il fondo scuro è il <dialog> stesso: un clic lì sopra chiude */
      if (e.target === f || e.target.closest('.foglio-chiudi')) { f.close(); return; }
      /* una voce scelta: il foglio si toglie prima che parta la pagina nuova */
      if (e.target.closest('a')) f.close();
    });

    f.addEventListener('close', () => {
      if (bottone) {
        bottone.setAttribute('aria-expanded', 'false');
        bottone.removeAttribute('data-corrente');
      }
      if (!fogli.some((o) => o.open)) document.documentElement.classList.remove('con-foglio');
    });
  });

  barra.querySelectorAll('button[aria-controls]').forEach((b) => {
    const f = document.getElementById(b.getAttribute('aria-controls'));
    if (!f) return;
    b.addEventListener('click', () => {
      const eraAperto = f.open;
      chiudiTutti();
      if (eraAperto) return;
      f.showModal();
      b.setAttribute('aria-expanded', 'true');
      b.setAttribute('data-corrente', '');
      document.documentElement.classList.add('con-foglio');
    });
  });

  /* ---------- 3. la voce Mappa: se sei già in home, torna in cima ---------- */
  const mappa = barra.querySelector('[data-barra="mappa"]');
  if (mappa) {
    mappa.addEventListener('click', (e) => {
      if (chiave() !== 'mappa') return;
      e.preventDefault();
      chiudiTutti();
      scrollTo({ top: 0, behavior: ridotto.matches ? 'auto' : 'smooth' });
      /* l'indirizzo resta pulito: niente #mappa appeso dopo essere tornati in cima */
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    });
  }

  /* ---------- 4. schermo largo: la barra non c'è più, il foglio nemmeno ---------- */
  stretto.addEventListener('change', (e) => { if (!e.matches) chiudiTutti(); });
})();
