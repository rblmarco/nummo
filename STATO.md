# Stato del progetto nummo

Ultimo aggiornamento: 25/11/2026 (19)

**Fase attuale**: Movimenti scritta e provata con un Bilanci API finto (lista, In programma, modifica, duplica, elimina, ricerca, filtri, coda offline per update e delete). Prossimo passo: prova di Movimenti sul telefono, poi service worker.

## Da dove riprendere

1. **Su un altro PC**: `git pull` (o clona il repo). Indirizzo e chiave di Bilanci API non sono nel repo: tienili a portata (URL `/exec` del deployment e `API_KEY` dalle proprietà dello script).
2. **App pubblicata** su GitHub Pages e collegata a Bilanci API (foglio `Dati nummo (prova)`). Su un nuovo dispositivo: aprire l'app e compilare il pannello Collegamento.
3. **Modificare `pages.yml`** richiede un token GitHub con il permesso Workflows (fine-grained) o `workflow` (classic).
4. **Da provare sul telefono**: in Movimenti modificare, duplicare ed eliminare qualche riga del foglio `Dati nummo (prova)` e controllare nel foglio che `update` aggiorni la riga giusta (con MODIFICATO_IL) e `delete` la tolga; provare anche in modalità aereo.
5. **Passo successivo di sviluppo**: service worker `frontend/sw.js` (l'app si apre senza rete) e prova di installazione sul telefono.

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
- [x] Movimenti: lista per giorno, In programma, avviso in attesa con Invia ora, modifica (anche della categoria), duplica, elimina, ricerca e filtri mese / categoria / conto (provato solo con un Bilanci API finto)
- [x] Coda offline anche per `update` e `delete`: una sola voce per ID; un movimento mai inviato modificato resta un `add`, eliminato sparisce dalla coda (provato solo con un Bilanci API finto)
- [ ] Prova di Movimenti sul telefono con il vero Bilanci API
- [x] Periodo come in 1Money, uno solo per Inserisci e Movimenti: intervallo, tutto il periodo, giorno, settimana, oggi, anno, mese; frecce, memoria dell'ultimo periodo, lettura `periodo` in Bilanci API (provato solo con un Bilanci API finto)
- [x] Aggiornare Bilanci API (nuova versione del deployment) e provare i periodi sul telefono
- [x] PWA: manifest e icone (anello sfumato con la n, sorgente `frontend/icons/icona.svg`)
- [ ] PWA: service worker (uso offline) e prova di installazione sul telefono

### 4. Messa in uso
- [ ] Prova in parallelo a 1Money per qualche giorno
- [ ] Giorno di cambio: ultimo import da 1Money, poi solo nummo

### 5. Dopo l'app principale
- [ ] **Sposta**: terza voce Spesa / Entrata / Sposta per spostare soldi tra Liquidità e i conti di investimento, nei due sensi. Scrive una riga come 1Money: TIPOLOGIA `Trasferimento`, DAL CONTO, AL CONTO, importo, data, nota; niente categoria. La dashboard ignora i trasferimenti, quindi il risparmio non cambia. Serve: pannello semplificato (da conto, a conto, importo, data, nota) con anteprima prima del codice; Bilanci API che scrive e legge anche `Trasferimento`; spostamenti visibili in Movimenti

## Punti aperti

- **Sposta (investimenti)**: deciso di farlo dopo la fine dell'app principale (vedi Da fare, punto 5). Da definire allora: anteprima del pannello e adattamento di Bilanci API.

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
| 25/11/2026 | Confermati: pannello Collegamento dal basso (indirizzo, chiave, dashboard); errori in ambra per ora; "Conto preselezionato" in sola lettura dal foglio Conti |
| 25/11/2026 | Il conto di spesa si chiama definitivamente "Liquidità" |
| 25/11/2026 | Movimenti: titolo = nota senza tag (tag come etichette), altrimenti sottocategoria o categoria; conto nascosto se è l'unico conto di spesa; In programma (tutte le date future) solo sul mese in corso |
| 25/11/2026 | Movimenti: tocco = modifica nello stesso pannello con in più il selettore Categoria ("Salva modifiche"); Duplica apre il pannello compilato con la data di oggi; Elimina chiede un secondo tocco su "Conferma" |
| 25/11/2026 | Categorie, sottocategorie e conti non più attivi: righe in grigio in Movimenti, restano scelti in modifica finché non li cambi, contano nei totali di Inserisci con un segmento grigio; movimenti vecchi senza sottocategoria mostrano "Nessuna". Filtri: ultimi 24 mesi, tutte le categorie, conti di spesa più quelli del mese; la ricerca vale sul mese scelto. Righe senza ID (storiche, prima di `assegnaID()`) visibili ma non modificabili |
| 25/11/2026 | La pagina non scorre mai: ogni schermata ha una parte fissa (Inserisci: titolo, mese, Spesa / Entrata; Movimenti: titolo, ricerca, filtri; Impostazioni: titolo) e sotto un'area che scorre solo se il contenuto non ci sta |
| 25/11/2026 | La parte in alto di ogni schermata (`.testata`) galleggia come la barra in basso: vetro sfocato che sfuma verso il basso, il contenuto le scorre sotto invece di essere tagliato di netto; copre anche la barra di stato |
| 25/11/2026 | Periodo come in 1Money al posto del solo mese: un solo periodo per Inserisci (etichetta tra le frecce) e Movimenti (primo filtro), stesso pannello con 7 voci; alla riapertura resta l'ultimo scelto ("Oggi" è sempre il giorno corrente). Settimana da lunedì a domenica; frecce per mese, anno, settimana e giorno, spente per intervallo e tutto il periodo, avanti fino al periodo che contiene oggi. Dal pannello mese, anno e settimana partono da quelli in corso |
| 25/11/2026 | Periodi più vecchi di circa 3 mesi: si scaricano con `mese` o `periodo` e restano sul dispositivo (tranne "Tutto il periodo"); Movimenti mostra 300 righe alla volta con "Mostra altri movimenti"; In programma compare quando il periodo arriva fino a oggi; nuova spesa con data = oggi se il periodo lo contiene, altrimenti il suo ultimo giorno |
| 25/11/2026 | Tasto Indietro di Android: chiude prima il pannello aperto (Nuova spesa, modifica, Periodo, Intervallo, filtri, Collegamento) e solo dopo cambia schermata. Un tocco al centro dell'anello passa da Spesa a Entrata e viceversa |
| 25/11/2026 | Investimenti: si registreranno in nummo come trasferimenti (voce "Sposta"), come in 1Money; sostituisce "niente trasferimenti tra conti" del 24/11. Si fa dopo la fine dell'app principale |

## Registro

- **25/11/2026** – Tasto Indietro: aprire un pannello aggiunge un passo alla cronologia (`history.pushState`), chiuderlo in qualunque modo lo toglie; un pannello che ne sostituisce un altro non aggiunge passi. Centro dell'anello cliccabile (`scambia-tipo`). Provato in Chrome headless (16 controlli, anche chiusura e apertura immediata), più tutte le prove precedenti.
- **25/11/2026** – Bilanci API aggiornato (mancava la Nuova versione del deployment): i periodi funzionano sul telefono. Allineati i documenti di specifica alle decisioni di oggi: `docs/overview_funzionale.md` (periodo, schermate senza scorrimento, Nuova spesa, Movimenti, Impostazioni, coda, Liquidità definitivo, Sposta dopo l'app principale, nessun punto aperto), `docs/design_v3.md` (area utile, testata, riga e pannello Periodo, capsula di sincronizzazione, righe scorrevoli, pannello compatto), `CLAUDE.md` (azioni di lettura, periodo, layout); stesse modifiche nelle copie del progetto Claude.
- **25/11/2026** – Periodi provati dall'utente: il pannello funziona, ma Anno risponde ancora "Aggiorna Bilanci API" (il deployment in uso non ha l'azione `periodo`). Corretto anche un difetto dell'app: un periodo non scaricato non veniva più richiesto fino alla riapertura; ora c'è il pulsante Riprova e si riprova a ogni cambio di periodo e a ogni sincronizzazione.
- **25/11/2026** – Periodo come in 1Money: `stato.periodo` salvato in `localStorage` (`nummo.periodo`), pannello Periodo, frecce, `movimentiDelPeriodo()` e `caricaPeriodo()` al posto di quelli per mese; Movimenti senza il filtro mese. Bilanci API: nuova azione `periodo` (`da`, `a`), descritta in `README-BE.md`. Provato in Chrome headless con un Bilanci API finto (25 controlli sui periodi, più tutte le prove precedenti) e la funzione `movimentiPeriodo_` con Node.
- **25/11/2026** – Testata galleggiante in tutte le schermate: `.testata` in posizione assoluta sopra `.scorre`, che occupa tutta la schermata e parte da sotto la testata grazie a `--testata-h` (misurata con un `ResizeObserver`). Provato in Chrome headless simulando il Galaxy A54, più le prove precedenti.
- **25/11/2026** – Corretto il pannello in modifica sul telefono: con tre selettori il contenuto non ci stava e il selettore Categoria veniva schiacciato sotto la Sottocategoria. Ora le parti del pannello non si schiacciano mai; se non c'entrano il pannello si compatta in due livelli (`compatto`, `compattissimo`) e solo come ultima risorsa scorre. Provato simulando il Galaxy A54 con uno e due conti, Chrome a 780 e 700 px.
- **25/11/2026** – Correzione del layout sul telefono: con l'app installata la pagina va da bordo a bordo e l'altezza dello schermo comprende barra di stato e barra di navigazione, quindi le misure basate sull'altezza dello schermo (`@media max-height`) mettevano la cornice troppo in basso. Ora Inserisci si adatta all'area utile (cornice che si stringe, container query sull'area che scorre), i bordi di sistema sono in `--sa-t` / `--sa-b`, il pannello si compatta da solo solo se non ci sta (`adattaPannello()`). Provato in Chrome headless simulando il Galaxy A54 (891 px con barre di 26 e 48 px, o 24 px con i gesti), Chrome a 780 px e 720 px: niente scorrimento e niente sotto la barra.
- **25/11/2026** – Struttura delle schermate: `html` e `body` non scorrono, ogni schermata è una colonna con parti `.fisso` e un'area `.scorre` che lascia libero lo spazio della barra in basso. Provato in Chrome headless a 892, 780 e 700 px: Inserisci non scorre fino a circa 720 px (sotto scorre solo la cornice), con più di 14 categorie scorre solo la cornice, in Movimenti ricerca e filtri restano fermi.
- **25/11/2026** – Schermata Movimenti in `frontend/app.js` e `frontend/app.css`: lista per giorno con totali, In programma, avviso in attesa, scorrimento con Duplica ed Elimina, pannello in modifica con selettore Categoria, filtri e ricerca; coda offline estesa a `update` e `delete` (`accoda()`, versioni per le voci cambiate durante l'invio). Provata in Chrome headless con un Bilanci API finto (25 controlli), più le prove di Inserisci e delle altezze.
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
