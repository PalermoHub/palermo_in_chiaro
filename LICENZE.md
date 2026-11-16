# Licenze

Stato al 16/11/2026. Le licenze dei dati sono quelle dichiarate dalle fonti e le ho lette direttamente sui siti indicati. Dove la fonte non dichiara nulla lo scrivo, e non lo deduco.

## Dati

| Dato | Fonte | Licenza dichiarata | Dove l'ho verificata |
| --- | --- | --- | --- |
| Profilo delle circoscrizioni (censimento 2021, sezioni) | ISTAT | CC BY 4.0, anche per uso commerciale, citando la fonte | https://www.istat.it/dati/open-data/ |
| Appalti (CIG) e stazioni appaltanti | ANAC | **CC BY-SA 4.0** | metadato `license_id` dei dataset `cig`, `cig-2025` e `stazioni-appaltanti` su dati.anticorruzione.it |
| Progetti di coesione | OpenCoesione | CC BY 4.0 | https://opencoesione.gov.it/it/opendata/ («Tutti i dati sono rilasciati con licenza CC BY 4.0») |
| Bilancio di previsione 2026-2028, DUP | Comune di Palermo | Non dichiarata nella pagina dei bilanci | https://repository.comune.palermo.it/bilancio-rendiconti.php?id=1&per=2026%2F2028 |
| Schede PNRR | Comune di Palermo | Non dichiarata nelle pagine lette | https://pnrr.comune.palermo.it/ |
| Repertorio statistico | Comune di Palermo, Ufficio Statistica | «La riproduzione e la diffusione dei dati sono consentite a condizione di citare la fonte» | testo dei PDF in `dati/raw/statistica/` |
| Programma triennale OO.PP. 2026-2028 con le posizioni | Atto del Comune (DCC 553/2026); elaborazione OpenDataSicilia con Claude AI | **Nessun file di licenza** nel repository `piano_triennale_26_28` | da confermare con l'autore |

## Cosa ne segue

- **ANAC è CC BY-SA 4.0 (ShareAlike).** Gli estratti `dati/anac_cig_palermo_*.csv` e lo snapshot `data/snapshot/appalti_comune.json` sono opere derivate: vanno rilasciati con la stessa licenza e citando ANAC. Lo snapshot lo dichiara già nel campo `licenza`. Questo vincolo riguarda i dati, non il codice del sito.
- **Dati senza licenza dichiarata** (bilancio, DUP, PNRR del Comune): sono atti e pagine pubbliche. Il sito li riusa citando la fonte, ma una licenza esplicita non c'è. Prima della pubblicazione conviene controllare le note legali del sito del Comune. La pagina `note-legali.php` che ho provato non esiste.
- **Il Piano triennale** con le posizioni elaborate è un lavoro di OpenDataSicilia: serve una licenza esplicita dell'autore prima di ripubblicarlo. Nel repository `palermo_popolazione`, dello stesso autore, c'è una licenza CC BY 4.0.
- **Posizioni dei progetti:** non sono coordinate ufficiali del Comune. Il sito lo dichiara accanto a ogni progetto.
- **File derivati che uniscono più fonti:** `data/progetti.json` (opere, PNRR, coesione e appalti) e `data/snapshot/appalti_cig.json` contengono campi di fonti con licenze diverse. Per la parte ANAC vale CC BY-SA 4.0; per le altre valgono le licenze della tabella. Il file non somma gli importi e dichiara la fonte di ogni campo.
- **Schede PNRR:** `data/snapshot/pnrr_progetti.json` deriva dalle pagine del Comune, che non dichiarano una licenza: si cita la fonte. Missione, ministero, decreto e documenti sono quelli pubblicati nelle schede.

## Codice

Da decidere. Il codice (`index.html`, `css/`, `js/`, `scripts/`) non ha ancora una licenza. Roma in chiaro usa AGPL-3.0; i repository dello stesso autore usano CC BY 4.0. Finché non c'è una scelta, il codice non è rilasciato con alcuna licenza.

## Logo e immagini

`img/` contiene l'icona del sito e il logo di OpenDataSicilia. Il logo non è coperto da alcuna licenza del codice o dei dati: va autorizzato dal titolare.

## Non affiliazione

Il sito è indipendente. Non è un sito del Comune di Palermo, di ANAC, dell'ISTAT né di OpenCoesione, e non usa stemmi o marchi di questi enti.
