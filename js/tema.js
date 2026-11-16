/* Tema chiaro/scuro. Va caricato nell'<head>, prima del primo disegno, così la pagina
   non lampeggia. La scelta fatta col pulsante resta nel browser e batte la preferenza
   di sistema; senza scelta salvata vale quella di sistema. */
(() => {
  'use strict';
  const CHIAVE = 'palermo-in-chiaro-tema';
  const FONDO = { chiaro: '#edf1f0', scuro: '#0e1b27' };
  const sistema = matchMedia('(prefers-color-scheme: dark)');
  const el = (tag, attrs = {}, kids = []) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (k === 'text') e.textContent = v; else e.setAttribute(k, v); }
    for (const c of [].concat(kids)) if (c) e.append(c);
    return e;
  };
  const NS = 'http://www.w3.org/2000/svg';
  const icona = ( classe, forme ) => {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', classe); s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', '15'); s.setAttribute('height', '15');
    s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    forme.forEach(([tag, attrs]) => {
      const n = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      s.append(n);
    });
    return s;
  };

  const scelto = () => { try { const v = localStorage.getItem(CHIAVE); return v === 'chiaro' || v === 'scuro' ? v : null; } catch (e) { return null; } };
  const decidi = () => scelto() || (sistema.matches ? 'scuro' : 'chiaro');

  function applica(tema) {
    const scuro = tema === 'scuro';
    document.documentElement.setAttribute('data-theme', scuro ? 'dark' : 'light');
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', scuro ? FONDO.scuro : FONDO.chiaro));
    document.dispatchEvent(new CustomEvent('tema-cambia', { detail: { tema } }));
  }

  /* etichetta e icona mostrano il tema verso cui porta il pulsante */
  function etichetta(b) {
    const ora = document.documentElement.getAttribute('data-theme') === 'dark' ? 'scuro' : 'chiaro';
    const dopo = ora === 'chiaro' ? 'scuro' : 'chiaro';
    b.setAttribute('data-tema', dopo);
    b.setAttribute('aria-label', `Passa al tema ${dopo}. Adesso è attivo il tema ${ora}.`);
    b.title = `Passa al tema ${dopo}`;
    const parola = b.querySelector('.tema-parola');
    if (parola) parola.textContent = dopo === 'scuro' ? 'Scuro' : 'Chiaro';
  }

  function pulsante() {
    const testata = document.querySelector('.testata-in');
    if (!testata) return null;
    const gia = testata.querySelector('.tema');
    if (gia) return gia;
    const b = el('button', { type: 'button', class: 'tema' }, [
      icona('tema-sole', [
        ['circle', { cx: '12', cy: '12', r: '4.2', fill: 'currentColor' }],
        ['path', { d: 'M12 2.4v2.3M12 19.3v2.3M2.4 12h2.3M19.3 12h2.3M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.9', 'stroke-linecap': 'round' }],
      ]),
      icona('tema-luna', [
        ['path', { d: 'M15.4 2.8a9.4 9.4 0 1 0 5.8 15.1A9.6 9.6 0 0 1 15.4 2.8z', fill: 'currentColor' }],
      ]),
      el('span', { class: 'tema-parola' }),
    ]);
    b.addEventListener('click', () => {
      const dopo = document.documentElement.getAttribute('data-theme') === 'dark' ? 'chiaro' : 'scuro';
      try { localStorage.setItem(CHIAVE, dopo); } catch (e) { /* navigazione privata */ }
      applica(dopo); etichetta(b);
    });
    etichetta(b);
    return b;
  }

  applica(decidi());

  let b = null;
  const avvia = () => { b = pulsante(); if (b && !b.isConnected) (document.querySelector('.testata nav') || document.querySelector('.testata-in')).after(b); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia);
  else avvia();

  sistema.addEventListener('change', () => {
    if (scelto()) return;
    applica(decidi());
    if (b) etichetta(b);
  });
})();
