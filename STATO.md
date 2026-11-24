# Stato del progetto nummo

Ultimo aggiornamento: 25/11/2026 (2)

**Fase attuale**: backend installato e pubblicato; frontend iniziato (Impostazioni e lettura dati), da provare con il vero Bilanci API.

## Fatto

- [x] Specifica funzionale (`docs/overview_funzionale.md`)
- [x] Design v3 "vetro" approvato, con mockup (`docs/design_v3.md`, `docs/design/`)
- [x] Schema categorie e tag (`docs/categorie.md`)
- [x] Repo creato, `CLAUDE.md` e documentazione resi anonimi
- [x] Decisioni sui conti: un solo conto di spesa (Liquidità), niente trasferimenti tra conti
- [x] Letto il codice della dashboard: formato delle righe, colonne lette, trattamento dei trasferimenti

## Da fare

### 1. Preparazione
- [ ] Attivare GitHub Pages (Settings → Pages → Source: **GitHub Actions**; il workflow `.github/workflows/pages.yml` pubblica `frontend/` a ogni push su `main`)

### 2. Backend – Bilanci API (`backend/`)
- [x] `Code.gs`: `doGet` (ping, bootstrap, mese), `doPost` (add / update / delete con ID), chiave, lock
- [x] `setupFogli()`: crea i fogli Categorie, Conti, Tag e il foglio di prova
- [x] `assegnaID()`: ID alle righe storiche (da usare il giorno del cambio)
- [x] Installazione: progetto Apps Script, proprietà, `setupFogli()`, tag e conti a mano, deployment
- [ ] Dashboard: in `getDati()` saltare le righe con data successiva a oggi (serve solo dal giorno del cambio: durante la prova nummo scrive nel foglio di prova)
- [x] Proprietà `SHEET_NAME` per scegliere il foglio di destinazione (prova o definitivo)
- [x] Pubblicazione del progetto Apps Script e prova delle chiamate

### 3. Frontend – web app (`frontend/`)
- [x] Impostazioni: indirizzo e chiave, test del collegamento (provato solo con un Bilanci API finto)
- [x] Lettura dati: categorie, conti, tag, movimenti recenti, copia in IndexedDB (provato solo con un Bilanci API finto)
- [ ] Prova di Impostazioni e bootstrap con il vero Bilanci API
- [ ] Inserisci: anello del mese e categorie in cornice
- [ ] Pannello Nuova spesa: selettore sottocategoria, importo, nota, tag, tastierino, data
- [ ] Salvataggio locale e coda offline (IndexedDB), invio in background
- [ ] Movimenti: lista per giorno, In programma, modifica, duplica, elimina, ricerca e filtri
- [ ] PWA: manifest, icone, service worker, installazione sul telefono

### 4. Messa in uso
- [ ] Prova in parallelo a 1Money per qualche giorno
- [ ] Giorno di cambio: ultimo import da 1Money, poi solo nummo

## Punti aperti

- **Investimenti**: tipo "Investimento" nell'app (trasferimento da Liquidità al conto di investimento) oppure fuori dall'app? La dashboard ignora i trasferimenti, quindi registrarli non cambia il risparmio: serve solo a tenerne traccia.
- **Nome del conto di spesa**: "Liquidità" è provvisorio.
- **Da confermare (Impostazioni)**: indirizzo, chiave e indirizzo della dashboard si inseriscono in un pannello dal basso "Collegamento" (non disegnato nel design v3); gli errori sono mostrati in ambra, perché la palette non ha un rosso; la riga "Conto preselezionato" mostra il conto predefinito del foglio, senza scelta.

## Decisioni prese

| Data | Decisione |
| --- | --- |
| 21/11/2026 | Web app su GitHub Pages + backend Apps Script separato dalla dashboard |
| 22/11/2026 | Design v3 "vetro" scuro e piatto; pannello unico Nuova spesa con selettori a scorrimento |
| 22/11/2026 | Spese con data futura: diventano effettive da sole il giorno indicato |
| 23/11/2026 | Nome: nummo; repo pubblico, tutti i dati di esempio anonimi |
| 24/11/2026 | Frontend nella cartella `frontend/`, pubblicato su GitHub Pages con un workflow di GitHub Actions (senza build) |
| 24/11/2026 | Durante la prova in parallelo nummo scrive in "Dati nummo (prova)", per evitare doppioni con l'import di 1Money |
| 24/11/2026 | Niente trasferimenti tra conti; un solo conto di spesa, sempre preselezionato; selettore del conto nascosto se c'è un solo conto |

## Registro

- **25/11/2026** – README nella radice: `README.md` (presentazione), `README-BE.md` (era `backend/README.md`), `README-FE.md` (era `frontend/README.md`).
- **25/11/2026** – Scritto `frontend/README.md`: attivazione di GitHub Pages, primo avvio, prova in locale, workflow `pages.yml`.
- **24/11/2026** – Backend installato e pubblicato seguendo `backend/README.md` (fatto a mano).
- **24/11/2026** – Spostato il frontend in `frontend/` e aggiunto il workflow di pubblicazione su GitHub Pages.
- **24/11/2026** – Frontend: `index.html`, `app.css`, `api.js`, `app.js`. Impostazioni con pannello Collegamento (prova e salva), lettura con bootstrap salvata in IndexedDB, elenchi di categorie, conti e tag. Inserisci e Movimenti sono segnaposto.
- **24/11/2026** – Confermato il foglio di prova. Scritto il backend Bilanci API (`backend/Code.gs`) con istruzioni di installazione.
- **24/11/2026** – Letto il codice della dashboard: formato delle righe confermato, colonne nuove ignorate dalla dashboard, trasferimenti ignorati, serve un filtro per le date future. Proposto il foglio di prova.
- **24/11/2026** – Creato questo file. Registrate le decisioni sui conti e il punto aperto sugli investimenti.
- **23/11/2026** – Creato il repo con `CLAUDE.md`, specifiche, design e mockup anonimi.
