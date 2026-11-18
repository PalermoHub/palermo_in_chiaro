/* Palermo in chiaro · dentro un iframe.

   Il sito nasce per stare da solo su una pagina, ma PalermoHub lo carica dentro
   un iframe con la sua testata, il suo piede e due pulsanti fissi d'angolo
   (45×45, right: 15px, z-index 1000 — lib/css/ph-css.css). Sopra l'iframe
   quei pulsanti non si possono spostare: l'unica cosa che si può fare è
   lasciargli il posto, e la barra in basso non deve finirci sotto.

   Va caricato nell'<head>, prima che il corpo venga disegnato: così la barra
   nasce già con lo spazio a destra, senza uno spostamento a pagina caricata.
   Non è una scusa per disegnare in modo diverso: cambia solo quel margine. */
(() => {
  'use strict';
  let dentro = false;
  try { dentro = window.self !== window.top; } catch (e) { dentro = true; }
  if (dentro) document.documentElement.classList.add('in-iframe');
})();
