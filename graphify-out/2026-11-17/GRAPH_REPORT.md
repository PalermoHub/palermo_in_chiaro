# Graph Report - palermo_in_chiaro  (2026-11-17)

## Corpus Check
- 42 files · ~154,486 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 148 nodes · 175 edges · 25 communities (18 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.65)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `83580ceb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- build_indice_progetti.py
- estrai_pnrr_progetti.py
- progetti.js
- snapshot_statistiche.py
- build_geo.py
- consenso.js
- Licenze
- snapshot_comunali.py
- snapshot_opere.py
- parse_pnrr_comune.py
- Segnalare un errore nei dati
- tema.js
- snapshot_profilo.py
- su.js
- Palermo in chiaro
- controlla_indice_progetti.py
- estrai_cig_palermo.py
- snapshot_bilancio.py
- circoscrizione.js
- build_pagine_circoscrizioni.py
- crediti.js

## God Nodes (most connected - your core abstractions)
1. `disegna()` - 8 edges
2. `avvia()` - 6 edges
3. `quota()` - 6 edges
4. `Licenze` - 6 edges
5. `avvia()` - 5 edges
6. `scegli()` - 5 edges
7. `appalti()` - 5 edges
8. `baricentro()` - 4 edges
9. `converti()` - 4 edges
10. `ok()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `geo()` --calls--> `ok()`  [INFERRED]
  scripts/build_progetti.py → scripts/build_indice_progetti.py
- `get()` --calls--> `ok()`  [INFERRED]
  scripts/build_progetti.py → scripts/build_indice_progetti.py

## Import Cycles
- None detected.

## Communities (25 total, 7 thin omitted)

### Community 0 - "build_indice_progetti.py"
Cohesion: 0.14
Nodes (12): classe_stato(), ok(), Indice unico dei progetti e dei finanziamenti del Comune di Palermo. Uso:…, Le stesse classi dello snapshot pnrr_comune.json (per_stato)., Circoscrizione, quartiere e UPL del campo geo, che nel file e' la stringa di…, territorio_da_geo(), codici(), geo() (+4 more)

### Community 1 - "estrai_pnrr_progetti.py"
Cohesion: 0.15
Nodes (7): decreto(), missioni_da_elenco(), misura(), Dettaglio dei 61 progetti PNRR del Comune di Palermo, con ministero, decreto e…, id_scheda -> numero di missione, dall'elenco delle missioni del sito (stessa…, Il primo decreto di ammissione a finanziamento citato nella scheda., Misura PNRR come scritta nella scheda (es. M2C2 I4.2), solo se compare.

### Community 2 - "progetti.js"
Cohesion: 0.36
Nodes (11): ambito(), avvia(), chiedi(), disegna(), disegnaCig(), disegnaMini(), evidenziaInMini(), evidenziaRiga() (+3 more)

### Community 3 - "snapshot_statistiche.py"
Cohesion: 0.31
Nodes (7): blocco_abitazioni(), blocco_famiglie(), blocco_lavoro(), blocco_scuola(), blocco_stranieri(), quota(), Snapshot per la pagina Statistiche: struttura per età, istruzione, famiglie,…

### Community 4 - "build_geo.py"
Cohesion: 0.31
Nodes (6): baricentro(), converti(), pt(), Converte i confini di circoscrizioni, quartieri e UPL (EPSG:32632) in tracciati…, Baricentro pesato sull'area dei poligoni esterni, in coordinate SVG., {nome: {d, cx, cy, ...proprieta'}} con area e baricentro.

### Community 5 - "consenso.js"
Cohesion: 0.52
Nodes (6): apri(), cancellacookie(), caricaGoogle(), chiudi(), misura(), scegli()

### Community 6 - "Licenze"
Cohesion: 0.29
Nodes (6): Codice, Cosa ne segue, Dati, Licenze, Logo e immagini, Non affiliazione

### Community 7 - "snapshot_comunali.py"
Cohesion: 0.33
Nodes (6): appalti(), classe_procedura(), f(), fascia_importo(), Snapshot a livello comunale: appalti (ANAC CIG), PNRR (sito del Comune), fondi…, top()

### Community 8 - "snapshot_opere.py"
Cohesion: 0.53
Nodes (5): blocco(), cup_ok(), f(), geo(), Snapshot opere pubbliche: Programma triennale OO.PP. 2026-2028 del Comune di…

### Community 10 - "Segnalare un errore nei dati"
Cohesion: 0.50
Nodes (3): Come, Cosa non si fa, Segnalare un errore nei dati

### Community 11 - "tema.js"
Cohesion: 0.83
Nodes (3): applica(), etichetta(), pulsante()

### Community 21 - "circoscrizione.js"
Cohesion: 0.50
Nodes (6): avvia(), barre(), conTip(), dettagli(), figura(), impilate()

### Community 22 - "build_pagine_circoscrizioni.py"
Cohesion: 0.50
Nodes (4): nav(), Genera le otto pagine di circoscrizione (circoscrizione/1…8/index.html). Uso:…, Il menù della testata, uguale a quello delle altre pagine: una tendina per ogni…, scrivi()

### Community 23 - "crediti.js"
Cohesion: 0.70
Nodes (4): apri(), chiudi(), collega(), costruisci()

## Knowledge Gaps
- **8 isolated node(s):** `Come`, `Cosa non si fa`, `Dati`, `Cosa ne segue`, `Codice` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `Come`, `Cosa non si fa`, `Dati` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `build_indice_progetti.py` be split into smaller, more focused modules?**
  _Cohesion score 0.1437908496732026 - nodes in this community are weakly interconnected._