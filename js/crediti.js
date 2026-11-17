/* Finestra «Credits» del piede: l'idea da cui nasce il sito e chi lo ha
   sviluppato. Il collegamento nel piede ha data-crediti e href="#crediti": con
   JavaScript spento resta un'ancora inerte, quindi il link è nel documento e il
   contenuto lo costruisce questo file, in un solo posto per tutte le pagine. */
(() => {
  'use strict';

  const el = (tag, attrs = {}, testo) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (testo) e.textContent = testo;
    return e;
  };

  /* link esterno: sempre target+rel, e il title dice dove si finisce */
  const link = (href, testo, title) => el('a', {
    href, target: '_blank', rel: 'noopener', title,
  }, testo);

  let finestra = null;

  function costruisci() {
    finestra = el('dialog', { class: 'crediti', id: 'crediti', 'aria-labelledby': 'crediti-titolo' });
    const dentro = el('div', { class: 'crediti-in' });
    dentro.append(el('h2', { class: 'crediti-titolo', id: 'crediti-titolo' }, 'Credits'));

    dentro.append(el('h3', {}, 'L\'idea'));
    const idea = el('p', {});
    idea.append(
      document.createTextNode('L\'idea è ispirata a '),
      link('https://github.com/urbe-hub/roma-in-chiaro', 'Roma in chiaro', 'Roma in chiaro: il repository su GitHub (urbe-hub/roma-in-chiaro)'),
      document.createTextNode('.'),
    );
    dentro.append(idea);

    dentro.append(el('h3', {}, 'Sviluppo'));
    const sviluppo = el('p', {});
    sviluppo.append(
      document.createTextNode('Web app progettata e sviluppata da '),
      link('https://www.linkedin.com/in/gbvitrano', '@gbvitrano', 'gbvitrano su LinkedIn'),
      document.createTextNode(' in collaborazione con '),
      link('https://www.anthropic.com/claude', 'Claude AI (Anthropic)', 'Claude di Anthropic'),
      document.createTextNode(' e '),
      link('https://chat.deepseek.com/', 'DeepSeek', 'DeepSeek: chat.deepseek.com'),
      document.createTextNode(', che hanno affiancato le scelte architetturali, l\'ottimizzazione del codice e lo sviluppo delle funzionalità di visualizzazione geospaziale.'),
    );
    dentro.append(sviluppo);

    const azioni = el('form', { method: 'dialog', class: 'crediti-azioni' });
    azioni.append(el('button', { type: 'submit', class: 'crediti-chiudi' }, 'Chiudi'));
    dentro.append(azioni);

    finestra.append(dentro);
    document.body.append(finestra);

    /* clic sullo sfondo (fuori dal riquadro) chiude: il clic cade sul <dialog>
       stesso solo quando non colpisce il contenuto interno */
    finestra.addEventListener('click', (e) => { if (e.target === finestra) chiudi(); });
    /* senza <dialog> modale manca anche Esc: lo aggiungiamo a mano */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && finestra.hasAttribute('open') && finestra.classList.contains('crediti-senza-modale')) chiudi();
    });
  }

  function chiudi() {
    if (!finestra) return;
    if (typeof finestra.close === 'function' && finestra.open) { finestra.close(); return; }
    finestra.removeAttribute('open');
    finestra.classList.remove('crediti-senza-modale');
  }

  function apri() {
    if (!finestra) costruisci();
    if (typeof finestra.showModal === 'function') {
      finestra.showModal();
    } else {
      /* browser senza <dialog> modale: resta una finestra fissa, chiusa dal pulsante */
      finestra.setAttribute('open', '');
      finestra.classList.add('crediti-senza-modale');
    }
    const chiudiBtn = finestra.querySelector('.crediti-chiudi');
    if (chiudiBtn) chiudiBtn.focus();
  }

  function collega() {
    for (const trigger of document.querySelectorAll('[data-crediti]')) {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        apri();
      });
    }
    /* chi arriva con #crediti nell'indirizzo trova la finestra già aperta */
    if (location.hash === '#crediti') apri();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', collega);
  else collega();

  window.crediti = { apri };
})();
