# App spese – istruzioni per Claude

Web app personale per registrare spese ed entrate che scrive direttamente nel Google Sheet "Bilanci". Sostituisce l'app 1Money per l'inserimento. Rispondi e scrivi i commenti in **italiano**.

## Dove sta cosa

- **Stato del progetto**: `STATO.md` nella radice: fatto, da fare, punti aperti, decisioni, registro. Leggilo all'inizio di ogni sessione.
- **Repo locale**: questa cartella (il percorso sul Mac è nelle istruzioni del progetto Claude, non qui: il repo è pubblico).
- **Specifiche**: `docs/overview_funzionale.md` (cosa fa l'app) e `docs/design_v3.md` (aspetto). Sono la fonte di verità: leggile prima di scrivere codice.
- **Riferimento visivo**: `docs/design/*.dc.html`, le schermate approvate del canvas di design. Sono HTML con stili inline: usale per misure e colori, non copiarle come codice.
- **Schema categorie**: `docs/categorie.md` (14 categorie di uscita, 5 di entrata, tag).

## Struttura da creare

```
README.md               presentazione del progetto, rimanda ai due README seguenti
README-BE.md            installazione e pubblicazione di Bilanci API
README-FE.md            pubblicazione su GitHub Pages e primo avvio della web app
frontend/               web app (pubblicata su GitHub Pages dal workflow .github/workflows/pages.yml)
  index.html
  app.css
  app.js                logica UI, stato, coda offline (IndexedDB)
  api.js                chiamate a Bilanci API
  sw.js                 service worker: cache dei file per uso offline
  manifest.webmanifest  icona e nome per "Aggiungi a schermata Home"
  icons/
backend/
  Code.gs               Bilanci API: progetto Apps Script separato, si incolla a mano
docs/                   specifiche (vedi sopra)
```

- Niente framework né build: HTML, CSS e JavaScript puri, così GitHub Pages pubblica i file così come sono. Il workflow `pages.yml` copia `frontend/` senza trasformarla.
- Font Inter e Material Symbols Rounded da Google Fonts.
- Il repo è pubblico: **mai** dati personali, ID del foglio, URL di Bilanci API o chiavi nel codice. Indirizzo e chiave si inseriscono nell'app al primo avvio e restano in `localStorage`.

## Backend: Bilanci API (`backend/Code.gs`)

- Progetto Apps Script **separato** dalla dashboard esistente. Apre il foglio con `SpreadsheetApp.openById(ID)`; ID e chiave stanno in `PropertiesService` (proprietà script `SHEET_ID`, `SHEET_NAME`, `API_KEY`).
- Pubblicato come app web: "Esegui come: me", "Chi ha accesso: Chiunque". Dopo ogni modifica: Gestisci deployment → matita → Nuova versione (l'URL non cambia).
- `doGet(e)`: `action=bootstrap` restituisce JSON con categorie attive, conti, tag e movimenti degli ultimi 3 mesi più quelli futuri.
- `doPost(e)`: corpo JSON in `text/plain` (evita il preflight CORS) con `key` e una lista di operazioni `add` / `update` / `delete` identificate da ID. Usa `LockService`; un `add` con ID già presente non duplica.
- Ogni risposta: `ContentService` JSON con `ok` ed eventuale `error`.
- Scrive in "Dati 1Money" con le stesse colonne del CSV di 1Money più `ID`, `INSERITO_IL`, `FONTE` (`app`), `MODIFICATO_IL`. Formato esatto (data `dd/mm/yy`, importo positivo con punto decimale, riga inserita in cima come testo) in `docs/overview_funzionale.md`, sezione Fogli e struttura dati. Il foglio di destinazione è nella proprietà `SHEET_NAME`: durante la prova "Dati nummo (prova)", poi "Dati 1Money".
- Fogli di configurazione: Categorie, Conti, Tag (colonne in `docs/overview_funzionale.md`). Includi una funzione `setupFogli()` da lanciare una volta che li crea e li compila dallo schema, e una `assegnaID()` che dà un ID alle righe storiche senza.

## Frontend

- Schermate e componenti come in `docs/design_v3.md`: Inserisci (anello al centro, categorie in cornice 5×4), pannello Nuova spesa dal basso (selettori a scorrimento per sottocategoria e conto, importo, nota, tag, tastierino), Movimenti, Impostazioni.
- Salvataggio prima in locale (IndexedDB) con ID e stato "in attesa", poi invio in background; ritenta all'apertura, al ritorno della rete e a ogni salvataggio.
- Spese con data futura: entrano subito nel foglio, ma nell'app stanno in "In programma" e sono escluse da anello e totali fino al giorno indicato.
- Categorie salvate come testo "Macro (Sub)": cambiare lo schema non tocca lo storico; le categorie non più attive si mostrano in grigio sui movimenti vecchi.
- Riferimento schermo: Galaxy A54 (412×892), layout fluido.

## Come lavorare

- **Non ipotizzare**: se una regola dei dati non è chiara, chiedi.
- Prima di modifiche visive non previste da `docs/design_v3.md`, proponi e aspetta l'ok.
- Lavora per passi piccoli e funzionanti: backend → bootstrap in lettura → inserimento → coda offline → Movimenti → Impostazioni → PWA.
- Commit piccoli con messaggi in italiano. Non fare push senza che te lo chieda.
- Dì sempre cosa non hai potuto provare (tutto ciò che gira dentro Google Apps Script).
- **Tieni aggiornato `STATO.md`** a ogni passo concluso o decisione presa: spunta le attività, aggiorna punti aperti e decisioni, aggiungi una riga al registro con la data. Aggiorna anche la data in cima.
