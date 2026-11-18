/* Palermo in chiaro · dentro un iframe.

   Il sito nasce per stare da solo su una pagina, ma PalermoHub lo carica dentro
   un iframe con la sua testata, il suo piede e due pulsanti fissi d'angolo
   (45×45, right: 15px, z-index 1000 — lib/css/ph-css.css). Qui si dice solo
   «sto dentro un pannello»: il foglio di stile poi toglie la barra di
   scorrimento verticale, che sul bordo destro duplicherebbe i pulsanti
   dell'ospite, e lascia alla barra in basso tutta la larghezza.

   Va caricato nell'<head>, prima che il corpo venga disegnato: così la classe
   c'è già al primo disegno e non si vede nulla cambiare a pagina caricata.
   Non è una scusa per disegnare in modo diverso: cambiano solo quei due dettagli. */
(() => {
  'use strict';
  let dentro = false;
  try { dentro = window.self !== window.top; } catch (e) { dentro = true; }
  if (dentro) document.documentElement.classList.add('in-iframe');
})();
