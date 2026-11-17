/* Consenso per le statistiche di visita. Il codice di Google Analytics non sta
   nelle pagine: lo carica questo file solo dopo un consenso esplicito, così prima
   della scelta nessun cookie di misurazione viene scritto e nessuna richiesta
   parte verso Google. La scelta resta in localStorage (chiave
   palermo-in-chiaro-consenso) e si può cambiare dal pulsante nella pagina
   privacy.html, che chiama window.consensoCookie.apri(). */
(() => {
  'use strict';
  const CHIAVE = 'palermo-in-chiaro-consenso';
  const ID = 'G-KHR1GHDRQS';

  const leggi = () => { try { const v = localStorage.getItem(CHIAVE); return v === 'si' || v === 'no' ? v : null; } catch (e) { return null; } };
  const scrivi = (v) => { try { localStorage.setItem(CHIAVE, v); } catch (e) { /* navigazione privata: vale per questa pagina */ } };

  /* Google Analytics 4: gtag deve esistere prima che lo script async risponda */
  function caricaGoogle() {
    if (document.querySelector('script[data-analytics]')) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', ID);
    const s = document.createElement('script');
    s.async = true;
    s.dataset.analytics = 'statistiche';
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.append(s);
  }

  /* se il consenso c'è già, Analytics parte subito (siamo nell'<head>). Se è stato
     revocato, i cookie scritti prima vengono cancellati a ogni caricamento: la
     revoca avviene mentre il codice di Google è ancora nella pagina e può
     riscrivere il cookie mentre la pagina si chiude. */
  if (leggi() === 'si') caricaGoogle();
  else if (leggi() === 'no') cancellacookie();

  const el = (tag, attrs = {}, testo) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (testo) e.textContent = testo;
    return e;
  };

  let banner = null;

  function misura() {
    if (!banner) return;
    const h = banner.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--altezza-consenso', Math.ceil(h) + 'px');
  }

  function chiudi() {
    if (!banner) return;
    banner.remove();
    banner = null;
    document.body.classList.remove('con-consenso');
    document.documentElement.style.removeProperty('--altezza-consenso');
  }

  function scegli(v) {
    const prima = leggi();
    scrivi(v);
    chiudi();
    if (v === 'si') {
      caricaGoogle();
    } else {
      /* revoca: via i cookie già scritti, e se Analytics era partito si ricarica
         la pagina, così il codice resta fuori dal documento */
      cancellacookie();
      if (prima === 'si' && document.querySelector('script[data-analytics]')) { location.reload(); return; }
    }
    document.dispatchEvent(new CustomEvent('consenso-cambia', { detail: { scelta: v } }));
  }

  function cancellacookie() {
    const nomi = ['_ga', '_ga_' + ID.slice(2)];
    for (const nome of nomi) {
      for (const dominio of ['', '; domain=' + location.hostname, '; domain=.' + location.hostname]) {
        document.cookie = nome + '=; path=/' + dominio + '; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      }
    }
  }

  function apri() {
    if (banner) { misura(); return; }
    banner = el('div', {
      class: 'consenso', role: 'region', 'aria-labelledby': 'consenso-titolo', 'aria-describedby': 'consenso-testo',
    });
    const dentro = el('div', { class: 'consenso-in' });
    const testo = el('p', { class: 'consenso-testo', id: 'consenso-testo' });
    testo.append(
      document.createTextNode('Per capire quali pagine vengono lette uso Google Analytics, che scrive cookie e manda i dati a Google anche fuori dall\'UE. Prima di un tuo consenso il codice non parte e nessun cookie di misurazione viene scritto. '),
      Object.assign(el('a', { href: 'privacy.html' }), { textContent: 'Informativa privacy e cookie' }),
    );
    dentro.append(el('p', { class: 'consenso-titolo', id: 'consenso-titolo' }, 'Statistiche di visita'), testo);
    const azioni = el('div', { class: 'consenso-azioni' });
    const accetta = el('button', { type: 'button', class: 'consenso-si' }, 'Accetta le statistiche');
    const rifiuta = el('button', { type: 'button', class: 'consenso-no' }, 'Rifiuta');
    accetta.addEventListener('click', () => scegli('si'));
    rifiuta.addEventListener('click', () => scegli('no'));
    azioni.append(accetta, rifiuta);
    dentro.append(azioni);
    banner.append(dentro);
    document.body.append(banner);
    document.body.classList.add('con-consenso');
    misura();
    /* il banner non ruba il fuoco: chi naviga da tastiera lo trova con Tab */
  }

  /* dalla pagina privacy.html: «Rivedi la scelta» riapre il banner anche se la
     scelta è già stata fatta (qui è l'utente a chiederlo, non il sito) */
  window.consensoCookie = { apri, scegli, stato: leggi };

  const avvia = () => { if (leggi() === null) apri(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia);
  else avvia();

  let attesa = null;
  addEventListener('resize', () => { if (!banner) return; clearTimeout(attesa); attesa = setTimeout(misura, 150); });
})();
