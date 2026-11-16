# Palermo in chiaro

Prototipo di un sito su dove cadono i soldi pubblici nelle 8 circoscrizioni di Palermo: residenti, opere programmate, bilancio, appalti, PNRR e fondi di coesione. Ogni numero ha fonte, periodo e quello che non misura. Impostazione ispirata a [Roma in chiaro](https://github.com/urbe-hub/roma-in-chiaro).

**Stato: prototipo.** I dati sono in revisione e le licenze non sono definitive: vedi `LICENZE.md` e `PIANO.md`.

## Cosa non è

- **Un bilancio per circoscrizione.** Il bilancio del Comune non ha capitoli per circoscrizione (verificato su Allegato A, nota integrativa e DUP 2026-2028). Bilancio, appalti, PNRR e coesione sono quindi per tutto il Comune.
- **Spesa effettiva.** Gli importi sono previsioni, importi a base di gara o finanziamenti programmati.
- **Un dato sempre aggiornato.** Il profilo demografico è del censimento 2021.
- **Un'attribuzione dell'intero importo delle opere.** Il 47% dell'importo del Programma triennale (94 interventi, tra cui la metropolitana leggera da 1.250 M€) non ha una circoscrizione.

## Vederlo

```bash
python3 -m http.server 8823        # nella cartella del progetto
# poi http://127.0.0.1:8823  (non aprire index.html direttamente)
```

Il server serve anche `dati/` (circa 1 GB): in pubblicazione va escluso, vedi sotto.

## Struttura

```
index.html, metodo.html     pagine principali
progetti.html, progetto.html  elenco e scheda di ogni progetto o finanziamento
css/, js/                   stile e logica (nessuna libreria)
data/snapshot/              snapshot JSON letti dal sito
data/geo/                   confini e progetti per la mappa
data/progetti.json          indice unico: una voce per progetto, con CUP e fonti collegate
dati/                       fonti scaricate e estratti (vedi dati/README.md)
scripts/                    script che producono gli snapshot
PIANO.md                    piano a fasi e cronologia delle verifiche
LICENZE.md                  licenze verificate
```

## Rifare gli snapshot

Servono Python 3.12 o più recente e `ogr2ogr` (solo per le geometrie dei progetti). Non servono pacchetti Python esterni.

```bash
python3 -I scripts/snapshot_profilo.py     # profilo circoscrizioni (censimento 2021)
python3 -I scripts/snapshot_opere.py       # opere per circoscrizione
python3 -I scripts/snapshot_bilancio.py    # bilancio per missione e programma
python3 -I scripts/snapshot_comunali.py    # appalti, PNRR, coesione
python3 -I scripts/build_geo.py            # confini per la mappa
python3 -I scripts/build_progetti.py       # progetti per la mappa
python3 -I scripts/estrai_pnrr_progetti.py # dettaglio PNRR: missione, ministero, decreto, documenti
python3 -I scripts/build_indice_progetti.py # indice progetti + appalti per CIG
```

Ogni progetto ha un indirizzo proprio, `progetto.html?id=…` (per esempio `progetto.html?id=op-01-01_206`), e l'elenco filtrabile è `progetti.html`.

Ogni script si ferma se un controllo di somma non torna con la fonte.

I dati scaricati in `dati/raw/` non sono nel repository di codice e vanno riscaricati. Il download dei CIG ANAC funziona dal browser; `curl` viene rifiutato dal server.

## Pubblicare

Escludere `dati/`, `.playwright-mcp/` e `PIANO.md`, e decidere la licenza del codice. Vedi `LICENZE.md`.
