# Stato del progetto nummo

Ultimo aggiornamento: 24/11/2026

**Fase attuale**: specifiche e design approvati, in attesa del codice della dashboard per scrivere il backend.

## Fatto

- [x] Specifica funzionale (`docs/overview_funzionale.md`)
- [x] Design v3 "vetro" approvato, con mockup (`docs/design_v3.md`, `docs/design/`)
- [x] Schema categorie e tag (`docs/categorie.md`)
- [x] Repo creato, `CLAUDE.md` e documentazione resi anonimi
- [x] Decisioni sui conti: un solo conto di spesa (Liquidità), niente trasferimenti tra conti

## Da fare

### 1. Preparazione
- [ ] Ricevere `Code.gs` e `Index.html` della dashboard, per il formato delle righe in "Dati 1Money"
- [ ] Attivare GitHub Pages (Settings → Pages → branch `main`, cartella root)

### 2. Backend – Bilanci API (`backend/`)
- [ ] `Code.gs`: `doGet` (bootstrap), `doPost` (add / update / delete con ID), chiave, lock
- [ ] `setupFogli()`: crea e compila i fogli Categorie, Conti, Tag
- [ ] `assegnaID()`: ID alle righe storiche
- [ ] Dashboard: contare solo le righe con data fino a oggi (spese programmate)
- [ ] Pubblicazione del progetto Apps Script e prova delle chiamate

### 3. Frontend – web app (radice del repo)
- [ ] Impostazioni: indirizzo e chiave, test del collegamento
- [ ] Lettura dati: categorie, conti, tag, movimenti recenti
- [ ] Inserisci: anello del mese e categorie in cornice
- [ ] Pannello Nuova spesa: selettore sottocategoria, importo, nota, tag, tastierino, data
- [ ] Salvataggio locale e coda offline (IndexedDB), invio in background
- [ ] Movimenti: lista per giorno, In programma, modifica, duplica, elimina, ricerca e filtri
- [ ] PWA: manifest, icone, service worker, installazione sul telefono

### 4. Messa in uso
- [ ] Prova in parallelo a 1Money per qualche giorno
- [ ] Giorno di cambio: ultimo import da 1Money, poi solo nummo

## Punti aperti

- **Investimenti**: tipo "Investimento" nell'app (trasferimento da Liquidità al conto di investimento) oppure fuori dall'app? Dipende da come la dashboard calcola quanto si mette via. Si decide dopo aver letto `Code.gs`.
- **Nome del conto di spesa**: "Liquidità" è provvisorio.

## Decisioni prese

| Data | Decisione |
| --- | --- |
| 21/11/2026 | Web app su GitHub Pages + backend Apps Script separato dalla dashboard |
| 22/11/2026 | Design v3 "vetro" scuro e piatto; pannello unico Nuova spesa con selettori a scorrimento |
| 22/11/2026 | Spese con data futura: diventano effettive da sole il giorno indicato |
| 23/11/2026 | Nome: nummo; repo pubblico, tutti i dati di esempio anonimi |
| 24/11/2026 | Niente trasferimenti tra conti; un solo conto di spesa, sempre preselezionato; selettore del conto nascosto se c'è un solo conto |

## Registro

- **24/11/2026** – Creato questo file. Registrate le decisioni sui conti e il punto aperto sugli investimenti.
- **23/11/2026** – Creato il repo con `CLAUDE.md`, specifiche, design e mockup anonimi.
