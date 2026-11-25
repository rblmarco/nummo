# Stato del progetto nummo

Ultimo aggiornamento: 25/11/2026 (7)

**Fase attuale**: Inserisci, pannello Nuova spesa e coda offline funzionano anche sul telefono con il vero Bilanci API. Prossimo passo: schermata Movimenti.

## Da dove riprendere

1. **Su un altro PC**: `git pull` (o clona il repo). Indirizzo e chiave di Bilanci API non sono nel repo: tienili a portata (URL `/exec` del deployment e `API_KEY` dalle proprietà dello script).
2. **App pubblicata** su GitHub Pages e collegata a Bilanci API (foglio `Dati nummo (prova)`). Su un nuovo dispositivo: aprire l'app e compilare il pannello Collegamento.
3. **Modificare `pages.yml`** richiede un token GitHub con il permesso Workflows (fine-grained) o `workflow` (classic).
4. **Confermare o correggere** le tre scelte "Da confermare (Impostazioni)" nei Punti aperti.
5. **Passo successivo di sviluppo**: schermata **Movimenti** (`docs/design/LGMovimenti.dc.html`). In `frontend/app.js` ci sono già `movimentiTutti()` (bootstrap + coda) e `movimentiDivisi()` (effettivi / in programma); `update` e `delete` passano dalla stessa coda (`stato.coda`, store IndexedDB `coda`).

## Fatto

- [x] Specifica funzionale (`docs/overview_funzionale.md`)
- [x] Design v3 "vetro" approvato, con mockup (`docs/design_v3.md`, `docs/design/`)
- [x] Schema categorie e tag (`docs/categorie.md`)
- [x] Repo creato, `CLAUDE.md` e documentazione resi anonimi
- [x] Decisioni sui conti: un solo conto di spesa (Liquidità), niente trasferimenti tra conti
- [x] Letto il codice della dashboard: formato delle righe, colonne lette, trattamento dei trasferimenti

## Da fare

### 1. Preparazione
- [x] Attivare GitHub Pages (Settings → Pages → Source: **GitHub Actions**; il workflow `.github/workflows/pages.yml` pubblica `frontend/` a ogni push su `main`)

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
- [x] Prova di Impostazioni e bootstrap con il vero Bilanci API (19 categorie, 69 sottocategorie, 4 conti, 5 tag)
- [x] Inserisci: anello del mese e categorie in cornice, mesi precedenti, Spesa / Entrata (provato solo con un Bilanci API finto)
- [x] Pannello Nuova spesa: selettori sottocategoria e conto, importo, nota, tag, tastierino con operazioni, data anche futura (provato solo con un Bilanci API finto)
- [x] Salvataggio locale e coda offline (IndexedDB), invio in background, contatore "In attesa" (provato solo con un Bilanci API finto)
- [x] Prova di Inserisci e del salvataggio sul telefono con il vero Bilanci API
- [ ] Movimenti: lista per giorno, In programma, modifica, duplica, elimina, ricerca e filtri
- [x] PWA: manifest e icone (anello sfumato con la n, sorgente `frontend/icons/icona.svg`)
- [ ] PWA: service worker (uso offline) e prova di installazione sul telefono

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
| 25/11/2026 | Inserisci: in modalità Entrata le categorie di entrata occupano la cornice dall'alto e l'anello mostra le entrate; titolo, pulsante e suggerimento diventano "Entrate" / "Salva entrata". Categorie oltre la 14ª in righe da 5 sotto la cornice |
| 25/11/2026 | Capsula di sincronizzazione: Sincronizzato, N in attesa (ambra), Offline, Non collegato, Invio…; un tocco invia la coda e aggiorna dal foglio |
| 25/11/2026 | Mesi: freccia avanti fino al mese in corso; date future escluse da anello e importi; i mesi fuori dal bootstrap (circa 3 mesi) si scaricano con l'azione `mese` e servono la rete |
| 25/11/2026 | Data proposta nel pannello: oggi nel mese in corso, l'ultimo giorno del mese quando si guarda un mese passato; data futura evidenziata in accento |
| 25/11/2026 | Sottocategoria sempre obbligatoria (si propone la prima); tag salvati in coda alla nota, nell'ordine del foglio Tag |
| 25/11/2026 | Tastierino: massimo 2 decimali, risultato del calcolo mostrato sotto l'importo; importo zero o negativo non si salva. Selettori: trascinamento (una voce ogni circa 80 px) o tocco sulle voci laterali; con 2 voci si vede solo quella a destra |

## Registro

- **25/11/2026** – Inserisci si adatta all'altezza utile dello schermo (sul telefono le barre del browser la riducono): la cornice prende lo spazio che resta, sotto 820 px si stringono margini, icone e tastierino del pannello e sparisce il suggerimento. Provato in Chrome headless da 892 a 680 px di altezza: niente scorrimento.
- **25/11/2026** – Inserisci, Nuova spesa e coda offline provati dall'utente con il vero Bilanci API: funzionano.
- **25/11/2026** – Inserisci (anello, cornice 5×4, mese, Spesa / Entrata, capsula di sincronizzazione), pannello Nuova spesa e coda offline in `frontend/app.js` e `frontend/app.css`; `Api.invia` (POST con ops) in `frontend/api.js`. IndexedDB alla versione 2 con lo store `coda`. Provati in Chrome headless a 412×892 con un Bilanci API finto: salvataggio, calcoli, tag, data futura, offline con ricarica e invio al ritorno della rete, mesi vecchi, trascinamento dei selettori.
- **25/11/2026** – Icona dell'app scelta (anello sfumato con i colori delle categorie e la n al centro): `frontend/icons/`, `frontend/manifest.webmanifest`, collegamenti in `index.html`.
- **25/11/2026** – App pubblicata su GitHub Pages con il nuovo workflow; Impostazioni e bootstrap provati con il vero Bilanci API.
- **25/11/2026** – Workflow `pages.yml` fallito ("No artifacts named github-pages"): diviso in due job, prepara e pubblica, e aggiornate le azioni (`checkout@v5`, `upload-pages-artifact@v4`).
- **25/11/2026** – Aggiunta la sezione "Da dove riprendere".
- **25/11/2026** – README nella radice: `README.md` (presentazione), `README-BE.md` (era `backend/README.md`), `README-FE.md` (era `frontend/README.md`).
- **25/11/2026** – Scritto `frontend/README.md`: attivazione di GitHub Pages, primo avvio, prova in locale, workflow `pages.yml`.
- **24/11/2026** – Backend installato e pubblicato seguendo `backend/README.md` (fatto a mano).
- **24/11/2026** – Spostato il frontend in `frontend/` e aggiunto il workflow di pubblicazione su GitHub Pages.
- **24/11/2026** – Frontend: `index.html`, `app.css`, `api.js`, `app.js`. Impostazioni con pannello Collegamento (prova e salva), lettura con bootstrap salvata in IndexedDB, elenchi di categorie, conti e tag. Inserisci e Movimenti sono segnaposto.
- **24/11/2026** – Confermato il foglio di prova. Scritto il backend Bilanci API (`backend/Code.gs`) con istruzioni di installazione.
- **24/11/2026** – Letto il codice della dashboard: formato delle righe confermato, colonne nuove ignorate dalla dashboard, trasferimenti ignorati, serve un filtro per le date future. Proposto il foglio di prova.
- **24/11/2026** – Creato questo file. Registrate le decisioni sui conti e il punto aperto sugli investimenti.
- **23/11/2026** – Creato il repo con `CLAUDE.md`, specifiche, design e mockup anonimi.
